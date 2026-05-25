"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import {
  Check,
  Copy,
  ImagePlus,
  Mic,
  PhoneOff,
  SendHorizonal,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { AppChrome } from "./app-chrome";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { starterPrompts } from "@/lib/data/mochi";
import { getOrCreateMochiSessionId } from "@/lib/session/mochi-session";
import {
  base64ToBytes,
  bytesToBase64,
  getLiveWebSocketUrl,
  parseLiveEvent,
  sampleRateFromMime,
  type LiveConnectionStatus,
} from "@/lib/live/ws-client";
import type {
  ChatAttachment,
  ChatMessage,
  SendMessageInput,
  SendMessageResult,
} from "@/types/lumi";

const DEFAULT_VOICE_LEVELS = [
  0.34, 0.52, 0.42, 0.7, 0.48, 0.82, 0.56, 0.76, 0.44, 0.62, 0.38,
  0.58,
];
const LIVE_PROCESSOR_BUFFER_SIZE = 1024;
const LIVE_TARGET_SAMPLE_RATE = 16000;
const LIVE_BACKPRESSURE_BYTES = 512 * 1024;
const LIVE_PRE_SPEECH_FRAME_LIMIT = 4;
const LIVE_END_OF_SPEECH_MS = 650;
const LIVE_CALIBRATION_FRAMES = 36;

type PendingAttachment = ChatAttachment & {
  localId: string;
  uploadStatus: "uploading" | "ready" | "failed";
  error?: string;
};

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function ChatView() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageScrollRef = useRef<HTMLElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const attachmentUrlsRef = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const captureAudioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const liveSocketRef = useRef<WebSocket | null>(null);
  const liveAudioQueueRef = useRef<Promise<void>>(Promise.resolve());
  const livePlaybackTimeRef = useRef(0);
  const livePlaybackGenerationRef = useRef(0);
  const livePlaybackSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const liveManualStopRef = useRef(false);
  const liveExpectedCloseRef = useRef(false);
  const liveReconnectAttemptRef = useRef(0);
  const liveReconnectTimerRef = useRef<number | null>(null);
  const liveSessionGenerationRef = useRef(0);
  const liveCaptureGenerationRef = useRef(0);
  const liveSentMediaIdsRef = useRef<Set<string>>(new Set());
  const startVoiceSessionRef = useRef<(resetReconnect?: boolean) => Promise<void>>(
    async () => undefined,
  );
  const voiceFrameRef = useRef<number | null>(null);
  const streamingAssistantIdRef = useRef<string | null>(null);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [sessionId, setSessionId] = useState(() =>
    typeof window === "undefined" ? "" : getOrCreateMochiSessionId(),
  );
  const [lastPayload, setLastPayload] = useState<SendMessageInput | null>(null);
  const [lastSendStopped, setLastSendStopped] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<LiveConnectionStatus>("idle");
  const [voiceError, setVoiceError] = useState("");
  const [voiceLevels, setVoiceLevels] = useState(DEFAULT_VOICE_LEVELS);
  const [streamingAssistantId, setStreamingAssistantId] = useState<string | null>(
    null,
  );

  const conversationQuery = useQuery({
    queryKey: ["mochi-conversation"],
    queryFn: async () => {
      const conversations = await apiClient.listConversations();
      return conversations[0] ?? apiClient.createConversation();
    },
  });

  const conversationId = conversationQuery.data?.id;
  const messagesKey = useMemo(
    () => ["messages", conversationId] as const,
    [conversationId],
  );

  const messagesQuery = useQuery({
    queryKey: messagesKey,
    enabled: Boolean(conversationId),
    queryFn: () => apiClient.listMessages(conversationId as string),
  });
  const messages = messagesQuery.data ?? [];
  const hasUploadingAttachments = attachments.some(
    (attachment) => attachment.uploadStatus === "uploading",
  );
  const hasFailedAttachments = attachments.some(
    (attachment) => attachment.uploadStatus === "failed",
  );
  const streamingAssistant = streamingAssistantId
    ? messages.find((message) => message.id === streamingAssistantId)
    : undefined;
  const lastMessageContent = messages.at(-1)?.content;

  const appendLiveMessage = useCallback(
    (content: string, role: ChatMessage["role"] = "mochi") => {
      if (!conversationId || !content.trim()) return;

      queryClient.setQueryData<ChatMessage[]>(messagesKey, (current = []) => [
        ...current,
        {
          id: `msg-live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          conversationId,
          role,
          kind: "text",
          content,
          status: "sent",
          createdAt: new Date().toISOString(),
        },
      ]);
    },
    [conversationId, messagesKey, queryClient],
  );

  const stopLivePlayback = useCallback(() => {
    livePlaybackGenerationRef.current += 1;
    livePlaybackSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // The source may already have ended.
      }
    });
    livePlaybackSourcesRef.current.clear();
    livePlaybackTimeRef.current = 0;
    liveAudioQueueRef.current = Promise.resolve();
  }, []);

  const ensurePlaybackContext = useCallback(async () => {
    const AudioContextCtor = getAudioContextCtor();
    if (!AudioContextCtor) throw new Error("Audio playback is unavailable.");

    const context = audioContextRef.current ?? new AudioContextCtor();
    audioContextRef.current = context;
    if (context.state === "suspended") {
      await context.resume();
    }
    return context;
  }, []);

  const playLiveAudio = useCallback(
    async (payload: unknown) => {
      const generation = livePlaybackGenerationRef.current;
      liveAudioQueueRef.current = liveAudioQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (generation !== livePlaybackGenerationRef.current) return;
          const audio =
            typeof payload === "string"
              ? { data: payload, mime_type: "audio/pcm;rate=24000" }
              : (payload as { data?: string; mime_type?: string; mimeType?: string });
          if (!audio?.data) return;

          const mimeType = audio.mime_type ?? audio.mimeType ?? "";
          const sampleRate = sampleRateFromMime(mimeType) || 24000;
          const samples = base64PCMToFloat32(audio.data, mimeType);
          if (!samples.length) return;

          const context = await ensurePlaybackContext();
          if (generation !== livePlaybackGenerationRef.current) return;

          const buffer = context.createBuffer(1, samples.length, sampleRate);
          buffer.getChannelData(0).set(samples);
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(context.destination);
          livePlaybackSourcesRef.current.add(source);
          source.onended = () => livePlaybackSourcesRef.current.delete(source);

          const startAt = Math.max(context.currentTime + 0.02, livePlaybackTimeRef.current || 0);
          source.start(startAt);
          livePlaybackTimeRef.current = startAt + buffer.duration;
        })
        .catch(() => undefined);
      await liveAudioQueueRef.current;
    },
    [ensurePlaybackContext],
  );

  const stopVoiceSession = useCallback((resetState = true) => {
    liveManualStopRef.current = true;
    liveExpectedCloseRef.current = true;
    liveSessionGenerationRef.current += 1;
    liveCaptureGenerationRef.current += 1;
    if (liveReconnectTimerRef.current !== null) {
      window.clearTimeout(liveReconnectTimerRef.current);
      liveReconnectTimerRef.current = null;
    }

    if (liveSocketRef.current?.readyState === WebSocket.OPEN) {
      liveSocketRef.current.send(JSON.stringify({ type: "audio_end" }));
      liveSocketRef.current.send(JSON.stringify({ type: "close" }));
    }
    liveSocketRef.current?.close();
    liveSocketRef.current = null;

    if (audioProcessorRef.current) {
      audioProcessorRef.current.onaudioprocess = null;
      safeDisconnect(audioProcessorRef.current);
    }
    if (audioSourceRef.current) {
      safeDisconnect(audioSourceRef.current);
    }
    if (voiceFrameRef.current !== null) {
      window.cancelAnimationFrame(voiceFrameRef.current);
      voiceFrameRef.current = null;
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    audioSourceRef.current = null;
    audioProcessorRef.current = null;
    analyserRef.current = null;

    void captureAudioContextRef.current?.close().catch(() => undefined);
    captureAudioContextRef.current = null;
    stopLivePlayback();

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    if (resetState) {
      setVoiceActive(false);
      setVoiceStatus("idle");
      setVoiceLevels(DEFAULT_VOICE_LEVELS);
    }
  }, [stopLivePlayback]);

  const sendLiveMediaAttachment = useCallback((attachment: PendingAttachment) => {
    const socket = liveSocketRef.current;
    if (
      !attachment.media_id ||
      attachment.uploadStatus !== "ready" ||
      liveSentMediaIdsRef.current.has(attachment.media_id) ||
      socket?.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    liveSentMediaIdsRef.current.add(attachment.media_id);
    socket.send(
      JSON.stringify({
        type: "media",
        media_id: attachment.media_id,
        caption: attachment.caption || "Use this image as the current visual context.",
        source: attachment.source || "chat",
        role: attachment.role || "user",
        turn_complete: false,
      }),
    );
  }, []);

  const startLiveCapture = useCallback(
    async (socket: WebSocket, generation: number) => {
      if (socket.readyState !== WebSocket.OPEN || liveSessionGenerationRef.current !== generation) return;
      if (mediaStreamRef.current) return;

      const captureGeneration = ++liveCaptureGenerationRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (liveSessionGenerationRef.current !== generation || liveCaptureGenerationRef.current !== captureGeneration) {
        stopMediaStream(stream);
        return;
      }

      const AudioContextCtor = getAudioContextCtor();
      if (!AudioContextCtor) {
        stopMediaStream(stream);
        throw new Error("Web Audio is not available in this browser.");
      }

      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      const processor = audioContext.createScriptProcessor(LIVE_PROCESSOR_BUFFER_SIZE, 1, 1);
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      source.connect(processor);
      processor.connect(audioContext.destination);

      mediaStreamRef.current = stream;
      captureAudioContextRef.current = audioContext;
      audioSourceRef.current = source;
      audioProcessorRef.current = processor;
      analyserRef.current = analyser;

      const track = stream.getAudioTracks()[0];
      socket.send(
        JSON.stringify({
          type: "client_trace",
          content: JSON.stringify({
            kind: "input_device",
            label: track?.label ?? "",
            sample_rate: audioContext.sampleRate,
            context_sample_rate: audioContext.sampleRate,
          }),
        }),
      );

      let speechActive = false;
      let lastSpeechAt = 0;
      let calibrationFrames = 0;
      let calibrationRMS = 0;
      let noiseFloor = 0.006;
      const preSpeechFrames: Uint8Array[] = [];
      const sendAudioFrame = (data: string) => {
        if (
          socket.readyState !== WebSocket.OPEN ||
          socket.bufferedAmount > LIVE_BACKPRESSURE_BYTES ||
          liveSessionGenerationRef.current !== generation
        ) {
          return;
        }
        socket.send(
          JSON.stringify({
            type: "audio",
            mime_type: `audio/pcm;rate=${LIVE_TARGET_SAMPLE_RATE}`,
            data,
          }),
        );
      };
      const sendActivity = (type: "activity_start" | "activity_end") => {
        if (socket.readyState === WebSocket.OPEN && liveSessionGenerationRef.current === generation) {
          socket.send(JSON.stringify({ type }));
        }
      };

      processor.onaudioprocess = (event) => {
        if (liveSessionGenerationRef.current !== generation || socket.readyState !== WebSocket.OPEN) return;
        const input = event.inputBuffer.getChannelData(0);
        const metrics = audioFrameMetrics(input);
        const now = performance.now();

        if (calibrationFrames < LIVE_CALIBRATION_FRAMES) {
          calibrationFrames += 1;
          calibrationRMS += metrics.rms;
          noiseFloor = Math.max(0.003, calibrationRMS / calibrationFrames);
        } else if (!speechActive) {
          noiseFloor = noiseFloor * 0.96 + metrics.rms * 0.04;
        }

        const pcm = downsampleToPCM16(input, audioContext.sampleRate, LIVE_TARGET_SAMPLE_RATE);
        if (!pcm.length) return;

        const speechThreshold = Math.max(0.012, Math.min(0.08, noiseFloor * 3.4 + 0.004));
        const peakThreshold = Math.max(0.08, speechThreshold * 4);
        const hasSpeech = metrics.rms >= speechThreshold || metrics.peak >= peakThreshold;

        if (hasSpeech) {
          lastSpeechAt = now;
          if (!speechActive) {
            speechActive = true;
            sendActivity("activity_start");
            setVoiceStatus("speaking");
            for (const frame of preSpeechFrames.splice(0)) {
              sendAudioFrame(bytesToBase64(frame));
            }
          }
        }

        if (speechActive) {
          sendAudioFrame(bytesToBase64(pcm));
          if (!hasSpeech && now - lastSpeechAt > LIVE_END_OF_SPEECH_MS) {
            speechActive = false;
            preSpeechFrames.length = 0;
            sendActivity("activity_end");
            setVoiceStatus("thinking");
          }
          return;
        }

        preSpeechFrames.push(pcm);
        if (preSpeechFrames.length > LIVE_PRE_SPEECH_FRAME_LIMIT) {
          preSpeechFrames.shift();
        }
      };

      const data = new Uint8Array(analyser.frequencyBinCount);
      const barCount = DEFAULT_VOICE_LEVELS.length;
      const updateLevels = () => {
        if (liveSessionGenerationRef.current !== generation || !analyserRef.current) return;
        analyser.getByteFrequencyData(data);
        const bucketSize = Math.max(1, Math.floor(data.length / barCount));
        const nextLevels = Array.from({ length: barCount }, (_, index) => {
          const start = index * bucketSize;
          const bucket = data.slice(start, start + bucketSize);
          const average = bucket.reduce((total, value) => total + value, 0) / bucket.length;
          return Math.max(0.18, Math.min(1, average / 150));
        });
        setVoiceLevels(nextLevels);
        voiceFrameRef.current = window.requestAnimationFrame(updateLevels);
      };
      updateLevels();
      setVoiceStatus("listening");
    },
    [],
  );

  const startVoiceSession = useCallback(async (resetReconnect = true) => {
    liveManualStopRef.current = false;
    liveExpectedCloseRef.current = false;
    if (resetReconnect) {
      liveReconnectAttemptRef.current = 0;
      liveSentMediaIdsRef.current.clear();
    }
    setVoiceError("");
    setVoiceStatus("connecting");

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Microphone access is not available in this browser.");
      setVoiceStatus("error");
      return;
    }

    try {
      await ensurePlaybackContext();
      const generation = ++liveSessionGenerationRef.current;
      setVoiceActive(true);

      const socket = new WebSocket(
        getLiveWebSocketUrl(sessionId || getOrCreateMochiSessionId()),
      );
      liveSocketRef.current = socket;

      socket.addEventListener("open", () => {
        if (liveSessionGenerationRef.current !== generation) {
          socket.close();
          return;
        }
        socket.send(
          JSON.stringify({
            type: "start",
            session_id: sessionId || getOrCreateMochiSessionId(),
            source: "chat",
            mode: "voice",
          }),
        );
      });

      socket.addEventListener("message", (event) => {
        const parsed = parseLiveEvent(event.data);
        if (!parsed) return;

        const eventType = parsed.type ?? parsed.event;
        if (eventType === "ready" || eventType === "live_ready") {
          setVoiceStatus("listening");
          return;
        }
        if (eventType === "live_setup_complete") {
          void startLiveCapture(socket, generation).then(() => {
            attachments.forEach(sendLiveMediaAttachment);
          });
          return;
        }
        if (eventType === "media_received") {
          return;
        }

        if (eventType === "error") {
          setVoiceError(parsed.message ?? parsed.error ?? "Live voice connection failed.");
          setVoiceStatus("error");
          return;
        }

        if (eventType === "done" || parsed.done) {
          setVoiceStatus("listening");
          return;
        }

        const audio =
          parsed.audio ??
          (eventType === "audio" || eventType === "live_audio" ? parsed.data : undefined);
        if (audio) {
          setVoiceStatus("responding");
          void playLiveAudio(audio);
          return;
        }

        const text = parsed.content ?? parsed.text ?? parsed.message ?? parsed.transcript;
        if (text) {
          setVoiceStatus("responding");
          if (eventType === "live_transcript" && parsed.role === "user") return;
          if (eventType === "message") {
            appendLiveMessage(text, parsed.role === "user" ? "user" : "mochi");
            return;
          }
          appendLiveMessage(text);
        }
      });

      socket.addEventListener("close", () => {
        if (
          !liveExpectedCloseRef.current &&
          !liveManualStopRef.current &&
          liveReconnectAttemptRef.current < 3
        ) {
          liveReconnectAttemptRef.current += 1;
          setVoiceStatus("connecting");
          liveReconnectTimerRef.current = window.setTimeout(() => {
            stopVoiceSession(false);
            void startVoiceSessionRef.current(false);
          }, 700 + liveReconnectAttemptRef.current * 450);
          return;
        }

        setVoiceStatus((current) => (current === "error" ? "error" : "idle"));
      });

      socket.addEventListener("error", () => {
        setVoiceError("Live voice connection failed. Check the proxy and try again.");
        setVoiceStatus("error");
      });
    } catch {
      stopVoiceSession(false);
      setVoiceActive(false);
      setVoiceStatus("error");
      setVoiceError("Mic permission is needed for live voice chat.");
    }
  }, [
    appendLiveMessage,
    attachments,
    ensurePlaybackContext,
    playLiveAudio,
    sendLiveMediaAttachment,
    sessionId,
    startLiveCapture,
    stopVoiceSession,
  ]);

  useEffect(() => {
    startVoiceSessionRef.current = startVoiceSession;
  }, [startVoiceSession]);

  const sendMutation = useMutation<
    SendMessageResult,
    Error,
    SendMessageInput,
    {
      optimisticId: string;
      optimisticAssistantId: string;
    }
  >({
    mutationFn: (input: SendMessageInput) =>
      apiClient.sendMessage(conversationId as string, {
        ...input,
        history: messagesQuery.data ?? [],
        onAssistantDelta: (delta) => {
          const assistantId = streamingAssistantIdRef.current;
          if (!assistantId) return;

          queryClient.setQueryData<ChatMessage[]>(
            messagesKey,
            (current = []) =>
              current.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      content: `${message.content}${delta}`,
                      status: "sending",
                    }
                  : message,
              ),
          );
        },
        abortSignal: input.abortSignal,
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: messagesKey });
      const previousMessages =
        queryClient.getQueryData<ChatMessage[]>(messagesKey) ?? [];
      const pendingSeed = Date.now();
      const optimisticId = `msg-pending-${pendingSeed}`;
      const optimisticAssistantId = `msg-stream-${pendingSeed}`;
      const optimisticMessage: ChatMessage = {
        id: optimisticId,
        conversationId: conversationId as string,
        role: "user",
        kind: input.attachments?.length || input.imageUrl ? "image" : "text",
        content: input.content || "Can you review this look?",
        imageUrl: input.imageUrl,
        attachments: input.attachments,
        status: "sent",
        createdAt: new Date().toISOString(),
      };
      const optimisticAssistantMessage: ChatMessage = {
        id: optimisticAssistantId,
        conversationId: conversationId as string,
        role: "mochi",
        kind: "text",
        content: "",
        status: "sending",
        createdAt: new Date().toISOString(),
      };

      streamingAssistantIdRef.current = optimisticAssistantId;
      setStreamingAssistantId(optimisticAssistantId);

      queryClient.setQueryData<ChatMessage[]>(
        messagesKey,
        [...previousMessages, optimisticMessage, optimisticAssistantMessage],
      );
      setDraft("");
      setAttachments([]);
      return { optimisticId, optimisticAssistantId };
    },
    onSuccess: (result, _variables, context) => {
      if (streamingAssistantIdRef.current === context.optimisticAssistantId) {
        streamingAssistantIdRef.current = null;
      }
      setStreamingAssistantId((current) =>
        current === context.optimisticAssistantId ? null : current,
      );

      queryClient.setQueryData<ChatMessage[]>(messagesKey, (current = []) => {
        let replacedUser = false;
        let replacedAssistant = false;
        const nextMessages = current.map((message) => {
          if (message.id === context.optimisticId) {
            replacedUser = true;
            return result.userMessage;
          }

          if (message.id === context.optimisticAssistantId) {
            replacedAssistant = true;
            return result.assistantMessage;
          }

          return message;
        });

        if (!replacedUser) nextMessages.push(result.userMessage);
        if (!replacedAssistant) nextMessages.push(result.assistantMessage);

        return nextMessages;
      });
      setLastPayload(null);
    },
    onError: (error, variables, context) => {
      if (!context) return;
      if (streamingAssistantIdRef.current === context.optimisticAssistantId) {
        streamingAssistantIdRef.current = null;
      }
      setStreamingAssistantId((current) =>
        current === context.optimisticAssistantId ? null : current,
      );

      if (variables.abortSignal?.aborted || isAbortError(error)) {
        setLastSendStopped(true);
        queryClient.setQueryData<ChatMessage[]>(messagesKey, (current = []) =>
          current
            .map((message) =>
              message.id === context.optimisticId
                ? { ...message, status: "sent" as const }
                : message,
            )
            .filter(
              (message) =>
                message.id !== context.optimisticAssistantId ||
                message.content.trim(),
            )
            .map((message) =>
              message.id === context.optimisticAssistantId
                ? { ...message, status: "sent" as const }
                : message,
            ),
        );
        return;
      }

      queryClient.setQueryData<ChatMessage[]>(messagesKey, (current = []) =>
        current
          .filter((message) => message.id !== context.optimisticAssistantId)
          .map((message) =>
            message.id === context.optimisticId
              ? { ...message, status: "failed" }
              : message,
          ),
      );
    },
    onSettled: () => {
      abortControllerRef.current = null;
    },
  });
  const showPendingIndicator =
    sendMutation.isPending && !streamingAssistant?.content;

  useEffect(() => {
    const scrollArea = messageScrollRef.current;
    if (!scrollArea) return;

    window.requestAnimationFrame(() => {
      scrollArea.scrollTop = scrollArea.scrollHeight;
    });
  }, [messages.length, lastMessageContent, sendMutation.isPending]);

  useEffect(() => {
    return () => stopVoiceSession(false);
  }, [stopVoiceSession]);

  useEffect(() => {
    const urls = attachmentUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const removeAttachment = (localId: string) => {
    setAttachments((current) => {
      const attachment = current.find((item) => item.localId === localId);
      if (attachment?.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
        attachmentUrlsRef.current.delete(attachment.previewUrl);
      }

      return current.filter((item) => item.localId !== localId);
    });
  };

  const onFilesSelected = (files: FileList | null) => {
    if (!files?.length) return;

    Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 4)
      .forEach((file) => {
        const localId =
          globalThis.crypto?.randomUUID?.() ??
          `attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const previewUrl = URL.createObjectURL(file);
        attachmentUrlsRef.current.add(previewUrl);

        const pendingAttachment: PendingAttachment = {
          localId,
          media_id: "",
          caption: draft.trim() || "Outfit image for Mochi to review",
          source: "chat",
          role: "user",
          previewUrl,
          fileName: file.name,
          mimeType: file.type,
          uploadStatus: "uploading",
        };

        setAttachments((current) => [...current, pendingAttachment]);

        void apiClient
          .uploadAttachment(file)
          .then((uploaded) => {
            const readyAttachment: PendingAttachment = {
              ...pendingAttachment,
              media_id: uploaded.media_id,
              fileName: uploaded.fileName ?? pendingAttachment.fileName,
              mimeType: uploaded.mimeType ?? pendingAttachment.mimeType,
              uploadStatus: "ready",
            };
            setAttachments((current) =>
              current.map((attachment) =>
                attachment.localId === localId
                  ? readyAttachment
                  : attachment,
              ),
            );
            sendLiveMediaAttachment(readyAttachment);
          })
          .catch((error: unknown) => {
            setAttachments((current) =>
              current.map((attachment) =>
                attachment.localId === localId
                  ? {
                      ...attachment,
                      uploadStatus: "failed",
                      error:
                        error instanceof Error
                          ? error.message
                          : "Upload failed. Remove it and try again.",
                    }
                  : attachment,
              ),
            );
          });
      });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
  };

  const submit = (payload?: SendMessageInput) => {
    if (!conversationId) return;
    if (!payload && (hasUploadingAttachments || hasFailedAttachments)) return;

    const content = payload?.content ?? draft.trim();
    const readyAttachments =
      payload?.attachments ??
      attachments
        .filter((attachment) => attachment.uploadStatus === "ready")
        .map((attachment) => ({
          media_id: attachment.media_id,
          caption: content || attachment.caption,
          source: attachment.source,
          role: attachment.role,
          previewUrl: attachment.previewUrl,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
        }));
    const imageUrl = payload?.imageUrl ?? readyAttachments[0]?.previewUrl;

    if (!content && !readyAttachments.length && !imageUrl) return;

    const currentSessionId = sessionId || getOrCreateMochiSessionId();
    if (!sessionId) setSessionId(currentSessionId);

    const retryPayload: SendMessageInput = {
      content: content || "Can you review this look?",
      imageUrl,
      attachments: readyAttachments,
      sessionId: currentSessionId,
      scenario: readyAttachments.length ? "image_review" : "text_chat",
      inputContext: {
        source: "chat",
        mode: readyAttachments.length && content ? "multimodal" : readyAttachments.length ? "image" : "text",
        refers_to_media_id: readyAttachments[0]?.media_id,
      },
    };
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setLastSendStopped(false);
    sendMutation.reset();
    setLastPayload(retryPayload);
    sendMutation.mutate({
      ...retryPayload,
      abortSignal: abortController.signal,
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  return (
    <AppChrome
      fixedViewport
      mainClassName="flex min-h-0 flex-col overflow-hidden !pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:!pb-[6.25rem]"
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <section
          ref={messageScrollRef}
          className="scrollbar-pearl min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pb-3 pr-1 [-webkit-overflow-scrolling:touch]"
        >
          <div className="flex flex-col gap-3">
            {messages.length === 0 && <WelcomeMessage />}
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}
            {!sendMutation.isPending && (
              <PromptSuggestions
                onSelect={(prompt) => setDraft(prompt)}
                hidden={messages.at(-1)?.role === "user"}
              />
            )}
            {showPendingIndicator && (
              <div className="lumi-fade-in px-1 py-2 text-sm font-bold text-[#716a7e]">
                Mochi is stitching a thought
                <span className="ml-1 inline-flex gap-1 align-middle">
                  <span className="size-1 rounded-full bg-[#8b8497]" />
                  <span className="size-1 rounded-full bg-[#8b8497]" />
                  <span className="size-1 rounded-full bg-[#8b8497]" />
                </span>
                <button
                  type="button"
                  onClick={stopGeneration}
                  className="ml-3 underline"
                >
                  Stop
                </button>
              </div>
            )}
            {sendMutation.isError && !lastSendStopped && (
              <div className="lumi-fade-in rounded-[22px] border border-[#ead1d8] bg-[#fff3f5]/86 p-3 text-sm font-bold text-[#9c4a61] shadow-[0_1px_0_rgba(255,255,255,0.86)_inset] backdrop-blur-xl">
                The thread snagged.{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => lastPayload && submit(lastPayload)}
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        </section>

        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(0.85rem+env(safe-area-inset-bottom))] z-40 px-4 md:bottom-6 md:left-[244px] md:px-0">
          <div className="mx-auto w-full max-w-[480px] md:max-w-[760px] md:px-8">
            <form
              onSubmit={onSubmit}
              className={cn(
                "pointer-events-auto w-full rounded-[34px] border border-white/82 bg-[#fbfafc]/76 p-2 shadow-[0_1px_0_rgba(255,255,255,0.96)_inset,0_22px_58px_rgba(42,39,55,0.18)] backdrop-blur-2xl",
                voiceActive &&
                  "border-[#ffb0bd]/42 bg-[#b8324d]/92 shadow-[0_1px_0_rgba(255,255,255,0.24)_inset,0_22px_58px_rgba(111,21,42,0.28)]",
              )}
            >
              {voiceActive ? (
                <button
                  type="button"
                  aria-label="End live voice chat"
                  onClick={() => stopVoiceSession()}
                  className="flex h-16 w-full items-center justify-between gap-3 rounded-[28px] bg-[#b8324d] px-4 text-left text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/16">
                      <PhoneOff size={20} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black">
                        {voiceStatus === "connecting"
                          ? "Live connecting"
                          : voiceStatus === "speaking"
                            ? "Listening to you"
                            : voiceStatus === "thinking"
                              ? "Mochi is thinking"
                          : voiceStatus === "responding"
                            ? "Mochi is responding"
                            : voiceStatus === "error"
                              ? "Live paused"
                              : "Live listening"}
                      </span>
                      <span className="block truncate text-xs font-extrabold text-white/72">
                        {voiceError || "Tap to hang up"}
                      </span>
                    </span>
                  </span>
                  <VoiceLevelMeter levels={voiceLevels} />
                </button>
              ) : (
                <>
                  {attachments.length > 0 && (
                    <div className="mb-2 space-y-2">
                      {attachments.map((attachment) => (
                        <div
                          key={attachment.localId}
                          className="flex items-center justify-between gap-3 rounded-[22px] border border-white/72 bg-[#edeaf1]/72 px-2 py-2 text-xs font-extrabold text-[#5f586f] shadow-[0_1px_0_rgba(255,255,255,0.78)_inset]"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            {attachment.previewUrl && (
                              <span className="relative size-10 shrink-0 overflow-hidden rounded-[14px] bg-white/50">
                                <Image
                                  src={attachment.previewUrl}
                                  alt=""
                                  fill
                                  sizes="40px"
                                  className="object-cover"
                                  unoptimized
                                />
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block truncate">
                                {attachment.fileName ?? "Outfit image"}
                              </span>
                              <span
                                className={cn(
                                  "block text-[0.68rem]",
                                  attachment.uploadStatus === "failed"
                                    ? "text-[#9c4a61]"
                                    : "text-[#8c7897]",
                                )}
                              >
                                {attachment.uploadStatus === "uploading"
                                  ? "Uploading..."
                                  : attachment.uploadStatus === "ready"
                                    ? "Ready for Mochi"
                                    : "Upload failed"}
                              </span>
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(attachment.localId)}
                          >
                            remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      className="hidden"
                      onChange={(event) => onFilesSelected(event.target.files)}
                    />
                    <Button
                      aria-label="Attach outfit image"
                      variant="secondary"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-[24px] text-[#302d43]"
                    >
                      <ImagePlus size={19} aria-hidden />
                    </Button>
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onInput={(event) =>
                        setDraft((event.currentTarget as HTMLTextAreaElement).value)
                      }
                      placeholder="Ask Mochi about the look..."
                      rows={1}
                      className="max-h-28 min-h-11 flex-1 resize-none rounded-[24px] border border-white/82 bg-[#f6f5f7]/68 px-4 py-3 text-sm font-extrabold text-[#2b2938] shadow-[0_1px_0_rgba(255,255,255,0.86)_inset] outline-none transition focus:border-white focus:bg-white/32 focus:shadow-[0_1px_0_rgba(255,255,255,0.96)_inset,0_0_0_1px_rgba(255,255,255,0.55)] placeholder:text-[#9d96ab]"
                    />
                    <Button
                      aria-label="Start live voice chat"
                      variant="secondary"
                      size="icon"
                      onClick={() => {
                        void startVoiceSession();
                      }}
                      className="rounded-full text-[#5f586f] hover:text-[#302d43]"
                    >
                      <Mic size={19} aria-hidden />
                    </Button>
                    <Button
                      aria-label={
                        sendMutation.isPending ? "Stop generating" : "Send message"
                      }
                      type={sendMutation.isPending ? "button" : "submit"}
                      size="icon"
                      onClick={
                        sendMutation.isPending ? stopGeneration : undefined
                      }
                      disabled={
                        !sendMutation.isPending &&
                        (!conversationId ||
                          hasUploadingAttachments ||
                          hasFailedAttachments ||
                          (!draft.trim() && !attachments.length))
                      }
                      className="rounded-full bg-[#302d43] hover:bg-[#3d394f]"
                    >
                      {sendMutation.isPending ? (
                        <Square size={17} aria-hidden />
                      ) : (
                        <SendHorizonal size={19} aria-hidden />
                      )}
                    </Button>
                  </div>
                  {voiceError && (
                    <p className="px-3 pb-1 pt-2 text-xs font-extrabold text-[#9c4a61]">
                      {voiceError}
                    </p>
                  )}
                </>
              )}
            </form>
          </div>
        </div>
      </div>
    </AppChrome>
  );
}

function VoiceLevelMeter({ levels }: { levels: number[] }) {
  return (
    <span className="flex h-10 shrink-0 items-center gap-1.5" aria-hidden>
      {levels.map((level, index) => (
        <span
          key={index}
          className="w-1.5 rounded-full bg-white/86 shadow-[0_0_16px_rgba(255,255,255,0.25)] transition-[height] duration-75"
          style={{ height: `${Math.round(10 + level * 30)}px` }}
        />
      ))}
    </span>
  );
}

function getAudioContextCtor() {
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  );
}

function stopMediaStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => {
    track.enabled = false;
    track.stop();
  });
}

function safeDisconnect(node: AudioNode) {
  try {
    node.disconnect();
  } catch {
    // Already disconnected.
  }
}

function downsampleToPCM16(
  input: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number,
): Uint8Array {
  if (!input.length || inputSampleRate <= 0 || targetSampleRate <= 0) {
    return new Uint8Array();
  }
  const ratio = Math.max(inputSampleRate / targetSampleRate, 1);
  const outputLength = Math.floor(input.length / ratio);
  const bytes = new Uint8Array(outputLength * 2);
  const view = new DataView(bytes.buffer);

  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(Math.floor((index + 1) * ratio), input.length);
    let total = 0;
    const count = Math.max(end - start, 1);

    for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) {
      total += input[sourceIndex] || 0;
    }

    const sample = Math.max(-1, Math.min(1, total / count));
    view.setInt16(
      index * 2,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    );
  }

  return bytes;
}

function audioFrameMetrics(input: Float32Array): { rms: number; peak: number } {
  if (!input.length) return { rms: 0, peak: 0 };
  let sum = 0;
  let peak = 0;

  for (let index = 0; index < input.length; index += 1) {
    const value = Math.abs(input[index] || 0);
    sum += value * value;
    if (value > peak) peak = value;
  }

  return { rms: Math.sqrt(sum / input.length), peak };
}

function base64PCMToFloat32(value: string, mimeType: string): Float32Array {
  const bytes = base64ToBytes(value);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const samples = new Float32Array(sampleCount);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const littleEndian = !/audio\/l16/i.test(mimeType);

  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = Math.max(
      -1,
      Math.min(1, view.getInt16(index * 2, littleEndian) / 32768),
    );
  }

  return samples;
}

function PromptSuggestions({
  hidden,
  onSelect,
}: {
  hidden: boolean;
  onSelect: (prompt: string) => void;
}) {
  if (hidden) return null;

  return (
    <div className="lumi-fade-in flex flex-wrap gap-2 px-1 pt-1">
      {starterPrompts.slice(0, 6).map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => onSelect(prompt)}
          className="rounded-full border border-white/82 bg-[#fbfafc]/58 px-3 py-2 text-left text-xs font-extrabold text-[#5f586f] shadow-[0_1px_0_rgba(255,255,255,0.82)_inset] backdrop-blur-xl transition hover:bg-white/76 hover:text-[#2b2938]"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}

function WelcomeMessage() {
  return (
    <div className="max-w-full px-1 py-2 text-[#343145]">
      <div className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase text-[#716a7e]">
        <Sparkles size={13} className="text-[#b99955]" aria-hidden />
        Mochi
      </div>
      <MarkdownMessage content="Hi, I’m Mochi. Send me the outfit, the occasion, or the tiny doubt before you leave. I’ll help with taste, proportion, color, and expression, without pretending to be your doctor, therapist, lawyer, or life oracle." />
    </div>
  );
}

function MessageItem({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const hasContent = message.content.trim().length > 0;
  const canShowActions = hasContent && message.status === "sent";

  if (!isUser) {
    return (
      <div className="max-w-full px-1 py-2 text-[#343145]">
        <div className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase text-[#716a7e]">
          <Sparkles size={13} className="text-[#b99955]" aria-hidden />
          Mochi
        </div>
        {hasContent ? (
          <>
            <MarkdownMessage content={message.content} />
            {canShowActions && (
              <AgentMessageActions
                content={message.content}
                messageId={message.id}
              />
            )}
          </>
        ) : (
          <div className="lumi-fade-in inline-flex items-center gap-1.5 rounded-full bg-white/56 px-3 py-2 text-sm font-bold text-[#716a7e] shadow-[0_1px_0_rgba(255,255,255,0.82)_inset]">
            Mochi is listening
            <span className="size-1 rounded-full bg-[#8b8497]" />
            <span className="size-1 rounded-full bg-[#8b8497]" />
            <span className="size-1 rounded-full bg-[#8b8497]" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <div
        className={cn(
          "max-w-[84%] rounded-[25px] px-4 py-3 text-sm font-bold leading-6 shadow-[0_14px_34px_rgba(38,36,52,0.14)]",
          "bg-[#2c293d] text-white",
          message.status === "failed" && "bg-[#8f334d]",
        )}
      >
        {message.imageUrl && (
          <div className="relative mb-2 aspect-[4/3] overflow-hidden rounded-[18px] bg-white/18">
            {message.imageUrl.startsWith("blob:") ||
            message.imageUrl.startsWith("data:") ||
            message.imageUrl.startsWith("http") ? (
              <Image
                src={message.imageUrl}
                alt="Uploaded outfit preview"
                fill
                sizes="(max-width: 768px) 72vw, 320px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center px-3 py-2 text-xs">
                Outfit image attached
              </div>
            )}
          </div>
        )}
        {message.content}
        {message.status === "failed" && (
          <div className="mt-1 text-[0.68rem] font-extrabold uppercase tracking-wide text-white/70">
            Not sent
          </div>
        )}
      </div>
    </div>
  );
}

type FeedbackState = "liked" | "disliked" | null;

function AgentMessageActions({
  content,
  messageId,
}: {
  content: string;
  messageId: string;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const copied = copiedId === messageId;

  const copyMessage = async () => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = content;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }
    setCopiedId(messageId);
    window.setTimeout(() => setCopiedId(null), 1600);
  };

  return (
    <div className="lumi-fade-in mt-2 flex items-center gap-1.5 text-[#81798e]">
      <button
        type="button"
        onClick={copyMessage}
        className="inline-flex size-8 items-center justify-center rounded-full transition hover:text-[#2b2938]"
        aria-label={copied ? "Copied" : "Copy agent message"}
      >
        {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      </button>
      <button
        type="button"
        onClick={() =>
          setFeedback((current) => (current === "liked" ? null : "liked"))
        }
        className="inline-flex size-8 items-center justify-center rounded-full transition hover:text-[#2b2938]"
        aria-label="Like agent message"
        aria-pressed={feedback === "liked"}
      >
        <ThumbsUp
          size={15}
          aria-hidden
          fill={feedback === "liked" ? "currentColor" : "none"}
        />
      </button>
      <button
        type="button"
        onClick={() =>
          setFeedback((current) => (current === "disliked" ? null : "disliked"))
        }
        className="inline-flex size-8 items-center justify-center rounded-full transition hover:text-[#2b2938]"
        aria-label="Dislike agent message"
        aria-pressed={feedback === "disliked"}
      >
        <ThumbsDown
          size={15}
          aria-hidden
          fill={feedback === "disliked" ? "currentColor" : "none"}
        />
      </button>
    </div>
  );
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        p: ({ children }) => (
          <p className="mb-3 text-[0.95rem] font-semibold leading-7 text-[#343145] last:mb-0">
            {children}
          </p>
        ),
        strong: ({ children }) => (
          <strong className="font-extrabold text-[#242235]">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="font-semibold text-[#5f586f]">{children}</em>
        ),
        ul: ({ children }) => (
          <ul className="mb-3 ml-5 list-disc space-y-1 text-[0.95rem] font-semibold leading-7 text-[#343145] last:mb-0">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 ml-5 list-decimal space-y-1 text-[0.95rem] font-semibold leading-7 text-[#343145] last:mb-0">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="pl-1">{children}</li>,
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-extrabold text-[#157464] underline decoration-[#b6cbc8] underline-offset-4"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-3 border-l-4 border-[#cfc5d9] pl-3 text-[#5f586f] last:mb-0">
            {children}
          </blockquote>
        ),
        code: ({ children }) => (
          <code className="rounded-md bg-white/68 px-1.5 py-0.5 text-[0.84rem] font-extrabold text-[#5f586f]">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="mb-3 overflow-x-auto rounded-[18px] bg-[#2c293d] p-3 text-sm text-white last:mb-0">
            {children}
          </pre>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
