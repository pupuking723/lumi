"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import {
  Check,
  Camera,
  Images,
  LoaderCircle,
  MessageCircle,
  Mic,
  PhoneOff,
  SendHorizonal,
  Square,
  X,
} from "lucide-react";
import { AppChrome } from "./app-chrome";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { getOrCreateMochiSessionId } from "@/lib/session/mochi-session";
import {
  base64ToBytes,
  bytesToBase64,
  getLiveWebSocketUrl,
  parseLiveEvent,
  prepareLiveWebSocketSession,
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
  0.34, 0.52, 0.42, 0.7, 0.48, 0.82, 0.56, 0.76, 0.44, 0.62, 0.38, 0.58,
];
const LIVE_PROCESSOR_BUFFER_SIZE = 1024;
const LIVE_TARGET_SAMPLE_RATE = 16000;
const LIVE_BACKPRESSURE_BYTES = 512 * 1024;
const LIVE_PRE_SPEECH_FRAME_LIMIT = 4;
const LIVE_END_OF_SPEECH_MS = 650;
const LIVE_CALIBRATION_FRAMES = 36;
const LIVE_CONNECT_TIMEOUT_MS = 12000;

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
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const composerBodyRef = useRef<HTMLDivElement>(null);
  const draftInputRef = useRef<HTMLTextAreaElement>(null);
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
  const liveConnectTimeoutRef = useRef<number | null>(null);
  const liveReconnectAttemptRef = useRef(0);
  const liveReconnectTimerRef = useRef<number | null>(null);
  const liveSessionGenerationRef = useRef(0);
  const liveCaptureGenerationRef = useRef(0);
  const liveSentMediaIdsRef = useRef<Set<string>>(new Set());
  const liveAssistantMessageIdRef = useRef<string | null>(null);
  const liveUserMessageIdRef = useRef<string | null>(null);
  const liveLastUserTranscriptRef = useRef("");
  const startVoiceSessionRef = useRef<
    (resetReconnect?: boolean) => Promise<void>
  >(async () => undefined);
  const voiceFrameRef = useRef<number | null>(null);
  const streamingAssistantIdRef = useRef<string | null>(null);
  const [draft, setDraft] = useState("");
  const [composerMultiline, setComposerMultiline] = useState(false);
  const [mediaSheetOpen, setMediaSheetOpen] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(true);
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
  const [streamingAssistantId, setStreamingAssistantId] = useState<
    string | null
  >(null);

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

  const upsertLiveUserTranscript = useCallback(
    (content: string, status: ChatMessage["status"] = "sending") => {
      const text = content.trim();
      if (!conversationId || !text) return false;

      let handled = false;
      queryClient.setQueryData<ChatMessage[]>(messagesKey, (current = []) => {
        const messageId = liveUserMessageIdRef.current;

        if (messageId) {
          let found = false;
          const nextMessages = current.map((message) => {
            if (message.id !== messageId) return message;

            found = true;
            handled = true;
            const nextContent = mergeLiveTranscript(message.content, text);
            liveLastUserTranscriptRef.current = nextContent;
            return {
              ...message,
              content: nextContent,
              status,
            };
          });

          if (found) return nextMessages;
        }

        const nextMessageId = `msg-live-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        liveUserMessageIdRef.current = nextMessageId;
        liveLastUserTranscriptRef.current = text;
        handled = true;
        return [
          ...current,
          {
            id: nextMessageId,
            conversationId,
            role: "user",
            kind: "text",
            content: text,
            status,
            createdAt: new Date().toISOString(),
          },
        ];
      });

      return handled;
    },
    [conversationId, messagesKey, queryClient],
  );

  const finishLiveUserTranscript = useCallback(() => {
    const messageId = liveUserMessageIdRef.current;
    liveUserMessageIdRef.current = null;
    if (!messageId) return;

    queryClient.setQueryData<ChatMessage[]>(messagesKey, (current = []) =>
      current.map((message) =>
        message.id === messageId ? { ...message, status: "sent" } : message,
      ),
    );
  }, [messagesKey, queryClient]);

  const appendLiveAssistantDelta = useCallback(
    (delta: string) => {
      if (!conversationId || !delta.trim()) return;

      queryClient.setQueryData<ChatMessage[]>(messagesKey, (current = []) => {
        let messageId = liveAssistantMessageIdRef.current;
        if (
          !messageId ||
          !current.some((message) => message.id === messageId)
        ) {
          messageId = `msg-live-stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          liveAssistantMessageIdRef.current = messageId;
          return [
            ...current,
            {
              id: messageId,
              conversationId,
              role: "mochi",
              kind: "text",
              content: delta,
              status: "sending",
              createdAt: new Date().toISOString(),
            },
          ];
        }

        return current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                content: appendLiveTranscript(message.content, delta),
                status: "sending",
              }
            : message,
        );
      });
    },
    [conversationId, messagesKey, queryClient],
  );

  const finalizeLiveAssistantMessage = useCallback(
    (content: string) => {
      if (!conversationId || !content.trim()) return;

      const messageId = liveAssistantMessageIdRef.current;
      if (!messageId) {
        appendLiveMessage(content);
        return;
      }

      liveAssistantMessageIdRef.current = null;
      queryClient.setQueryData<ChatMessage[]>(messagesKey, (current = []) => {
        let replaced = false;
        const next = current.map((message) => {
          if (message.id !== messageId) return message;
          replaced = true;
          return {
            ...message,
            content,
            status: "sent" as const,
          };
        });

        if (!replaced) {
          next.push({
            id: messageId,
            conversationId,
            role: "mochi",
            kind: "text",
            content,
            status: "sent",
            createdAt: new Date().toISOString(),
          });
        }

        return next;
      });
    },
    [appendLiveMessage, conversationId, messagesKey, queryClient],
  );

  const clearLiveAssistantDraft = useCallback(() => {
    const messageId = liveAssistantMessageIdRef.current;
    liveAssistantMessageIdRef.current = null;
    if (!messageId) return;

    queryClient.setQueryData<ChatMessage[]>(messagesKey, (current = []) =>
      current
        .filter((message) => message.id !== messageId || message.content.trim())
        .map((message) =>
          message.id === messageId ? { ...message, status: "sent" } : message,
        ),
    );
  }, [messagesKey, queryClient]);

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
              : (payload as {
                  data?: string;
                  mime_type?: string;
                  mimeType?: string;
                });
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

          const startAt = Math.max(
            context.currentTime + 0.02,
            livePlaybackTimeRef.current || 0,
          );
          source.start(startAt);
          livePlaybackTimeRef.current = startAt + buffer.duration;
        })
        .catch(() => undefined);
      await liveAudioQueueRef.current;
    },
    [ensurePlaybackContext],
  );

  const stopVoiceSession = useCallback(
    (resetState = true) => {
      liveManualStopRef.current = true;
      liveExpectedCloseRef.current = true;
      liveSessionGenerationRef.current += 1;
      liveCaptureGenerationRef.current += 1;
      if (liveReconnectTimerRef.current !== null) {
        window.clearTimeout(liveReconnectTimerRef.current);
        liveReconnectTimerRef.current = null;
      }
      if (liveConnectTimeoutRef.current !== null) {
        window.clearTimeout(liveConnectTimeoutRef.current);
        liveConnectTimeoutRef.current = null;
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
      liveUserMessageIdRef.current = null;
      liveLastUserTranscriptRef.current = "";

      void captureAudioContextRef.current?.close().catch(() => undefined);
      captureAudioContextRef.current = null;
      stopLivePlayback();
      clearLiveAssistantDraft();

      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => undefined);
        audioContextRef.current = null;
      }

      if (resetState) {
        setVoiceActive(false);
        setVoiceStatus("idle");
        setVoiceLevels(DEFAULT_VOICE_LEVELS);
      }
    },
    [clearLiveAssistantDraft, stopLivePlayback],
  );

  const sendLiveMediaAttachment = useCallback(
    (attachment: PendingAttachment) => {
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
          caption:
            attachment.caption ||
            "Use this image as the current visual context.",
          source: attachment.source || "chat",
          role: attachment.role || "user",
          turn_complete: false,
        }),
      );
    },
    [],
  );

  const startLiveCapture = useCallback(
    async (socket: WebSocket, generation: number) => {
      if (
        socket.readyState !== WebSocket.OPEN ||
        liveSessionGenerationRef.current !== generation
      )
        return;
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
      if (
        liveSessionGenerationRef.current !== generation ||
        liveCaptureGenerationRef.current !== captureGeneration
      ) {
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
      const processor = audioContext.createScriptProcessor(
        LIVE_PROCESSOR_BUFFER_SIZE,
        1,
        1,
      );
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
        if (
          socket.readyState === WebSocket.OPEN &&
          liveSessionGenerationRef.current === generation
        ) {
          socket.send(JSON.stringify({ type }));
        }
      };

      processor.onaudioprocess = (event) => {
        if (
          liveSessionGenerationRef.current !== generation ||
          socket.readyState !== WebSocket.OPEN
        )
          return;
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

        const pcm = downsampleToPCM16(
          input,
          audioContext.sampleRate,
          LIVE_TARGET_SAMPLE_RATE,
        );
        if (!pcm.length) return;

        const speechThreshold = Math.max(
          0.012,
          Math.min(0.08, noiseFloor * 3.4 + 0.004),
        );
        const peakThreshold = Math.max(0.08, speechThreshold * 4);
        const hasSpeech =
          metrics.rms >= speechThreshold || metrics.peak >= peakThreshold;

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
        if (
          liveSessionGenerationRef.current !== generation ||
          !analyserRef.current
        )
          return;
        analyser.getByteFrequencyData(data);
        const bucketSize = Math.max(1, Math.floor(data.length / barCount));
        const nextLevels = Array.from({ length: barCount }, (_, index) => {
          const start = index * bucketSize;
          const bucket = data.slice(start, start + bucketSize);
          const average =
            bucket.reduce((total, value) => total + value, 0) / bucket.length;
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

  const startVoiceSession = useCallback(
    async (resetReconnect = true) => {
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
        await prepareLiveWebSocketSession();
        const generation = ++liveSessionGenerationRef.current;
        setVoiceActive(true);

        const socket = new WebSocket(
          getLiveWebSocketUrl(sessionId || getOrCreateMochiSessionId()),
        );
        liveSocketRef.current = socket;
        let socketOpened = false;
        const clearConnectTimeout = () => {
          if (liveConnectTimeoutRef.current !== null) {
            window.clearTimeout(liveConnectTimeoutRef.current);
            liveConnectTimeoutRef.current = null;
          }
        };
        liveConnectTimeoutRef.current = window.setTimeout(() => {
          if (
            liveSessionGenerationRef.current !== generation ||
            socket.readyState !== WebSocket.CONNECTING
          ) {
            return;
          }
          liveExpectedCloseRef.current = true;
          setVoiceError(
            "Live voice connection timed out. Check the websocket URL and gateway.",
          );
          setVoiceStatus("error");
          socket.close();
        }, LIVE_CONNECT_TIMEOUT_MS);

        socket.addEventListener("open", () => {
          clearConnectTimeout();
          socketOpened = true;
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
            setVoiceError(
              parsed.message ?? parsed.error ?? "Live voice connection failed.",
            );
            setVoiceStatus("error");
            return;
          }

          if (eventType === "done" || parsed.done) {
            setVoiceStatus("listening");
            return;
          }
          if (eventType === "live_interrupted") {
            clearLiveAssistantDraft();
            stopLivePlayback();
            setVoiceStatus("listening");
            return;
          }

          const audio =
            parsed.audio ??
            (eventType === "audio" || eventType === "live_audio"
              ? parsed.data
              : undefined);
          if (audio) {
            setVoiceStatus("responding");
            void playLiveAudio(audio);
            return;
          }

          const text =
            parsed.content ??
            parsed.text ??
            parsed.message ??
            parsed.transcript;
          if (text) {
            setVoiceStatus("responding");
            if (eventType === "live_transcript" && parsed.role === "user") {
              upsertLiveUserTranscript(text);
              return;
            }
            if (
              eventType === "live_transcript" &&
              parsed.role === "assistant"
            ) {
              finishLiveUserTranscript();
              appendLiveAssistantDelta(text);
              return;
            }
            if (eventType === "message") {
              if (parsed.role === "assistant") {
                finishLiveUserTranscript();
                finalizeLiveAssistantMessage(text);
              } else {
                if (parsed.role === "user") {
                  const alreadyShown =
                    liveLastUserTranscriptRef.current.trim() &&
                    textsOverlap(liveLastUserTranscriptRef.current, text);
                  if (!alreadyShown) {
                    upsertLiveUserTranscript(text, "sent");
                  }
                  finishLiveUserTranscript();
                } else {
                  appendLiveMessage(text);
                }
              }
              return;
            }
            finishLiveUserTranscript();
            appendLiveMessage(text);
          }
        });

        socket.addEventListener("close", () => {
          clearConnectTimeout();
          if (
            !liveExpectedCloseRef.current &&
            !liveManualStopRef.current &&
            liveReconnectAttemptRef.current < 3
          ) {
            liveReconnectAttemptRef.current += 1;
            setVoiceStatus("connecting");
            liveReconnectTimerRef.current = window.setTimeout(
              () => {
                stopVoiceSession(false);
                void startVoiceSessionRef.current(false);
              },
              700 + liveReconnectAttemptRef.current * 450,
            );
            return;
          }

          setVoiceStatus((current) => (current === "error" ? "error" : "idle"));
        });

        socket.addEventListener("error", () => {
          clearConnectTimeout();
          if (!socketOpened) {
            liveExpectedCloseRef.current = true;
          }
          setVoiceError(
            "Live voice connection failed. Check the proxy and try again.",
          );
          setVoiceStatus("error");
        });
      } catch {
        stopVoiceSession(false);
        setVoiceActive(false);
        setVoiceStatus("error");
        setVoiceError(
          "Live voice could not start. Check microphone permission and Live session setup.",
        );
      }
    },
    [
      appendLiveMessage,
      appendLiveAssistantDelta,
      attachments,
      clearLiveAssistantDraft,
      ensurePlaybackContext,
      finishLiveUserTranscript,
      finalizeLiveAssistantMessage,
      playLiveAudio,
      sendLiveMediaAttachment,
      sessionId,
      startLiveCapture,
      stopLivePlayback,
      stopVoiceSession,
      upsertLiveUserTranscript,
    ],
  );

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

          queryClient.setQueryData<ChatMessage[]>(messagesKey, (current = []) =>
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

      queryClient.setQueryData<ChatMessage[]>(messagesKey, [
        ...previousMessages,
        optimisticMessage,
        optimisticAssistantMessage,
      ]);
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

  const measureDraftInput = useCallback(() => {
    const input = draftInputRef.current;
    if (!input) return;

    const styles = window.getComputedStyle(input);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 20;
    const paddingY =
      (Number.parseFloat(styles.paddingTop) || 0) +
      (Number.parseFloat(styles.paddingBottom) || 0);
    const singleLineHeight = lineHeight + paddingY;
    const maxHeight = lineHeight * 3 + paddingY;
    const composerWidth =
      composerBodyRef.current?.clientWidth ?? input.clientWidth;
    const inlineDraftWidth = Math.max(80, composerWidth - 44 - 8);
    const previousWidth = input.style.width;

    input.style.width = `${inlineDraftWidth}px`;
    input.style.height = "auto";
    const inlineScrollHeight = input.scrollHeight;
    input.style.width = previousWidth;

    const nextHeight = Math.min(input.scrollHeight, maxHeight);
    input.style.height = `${Math.max(nextHeight, singleLineHeight)}px`;
    setComposerMultiline(inlineScrollHeight > singleLineHeight + 1);
  }, []);

  useLayoutEffect(() => {
    measureDraftInput();
  }, [draft, measureDraftInput]);

  useEffect(() => {
    window.addEventListener("resize", measureDraftInput);
    return () => window.removeEventListener("resize", measureDraftInput);
  }, [measureDraftInput]);

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
                attachment.localId === localId ? readyAttachment : attachment,
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

    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setMediaSheetOpen(false);
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
        mode:
          readyAttachments.length && content
            ? "multimodal"
            : readyAttachments.length
              ? "image"
              : "text",
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
      showPageTitle={false}
      mainClassName="relative min-h-0 overflow-hidden !p-0"
    >
      {chatPanelOpen && (
        <div
          className={cn(
            "fixed right-4 bottom-[calc(5.1rem+env(safe-area-inset-bottom))] z-20 flex h-[66.666dvh] w-[66.666vw] max-w-[520px] flex-col overflow-hidden rounded-[24px] border border-white/82 bg-[#fbfafc]/78 p-3 shadow-[0_1px_0_rgba(255,255,255,0.96)_inset,0_24px_70px_rgba(42,39,55,0.2)] backdrop-blur-2xl md:bottom-[calc(5.4rem+env(safe-area-inset-bottom))] md:right-[max(1rem,calc((100vw-760px)/2+1rem))]",
            voiceActive && "bg-[#b8324d]/12",
          )}
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
                {showPendingIndicator && (
                  <div className="lumi-fade-in max-w-full px-1 py-2 text-[#343145]">
                    <span className="thinking-text-wave text-sm font-bold">
                      stitching a thought
                    </span>
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
            <div className="shrink-0 pt-2">
          <div className="w-full">
            <form
              onSubmit={onSubmit}
              className="w-full rounded-[24px] border border-white/82 bg-[#fbfafc]/76 p-2 shadow-[0_1px_0_rgba(255,255,255,0.96)_inset,0_22px_58px_rgba(42,39,55,0.18)] backdrop-blur-2xl"
            >
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
                <div
                    ref={composerBodyRef}
                    className={cn(
                      "gap-2",
                      composerMultiline ? "flex flex-col" : "flex items-end",
                    )}
                  >
                    <textarea
                      ref={draftInputRef}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onInput={(event) =>
                        setDraft(
                          (event.currentTarget as HTMLTextAreaElement).value,
                        )
                      }
                      placeholder="Ask Mochi..."
                      rows={1}
                      className={cn(
                        "max-h-[4.875rem] min-h-11 resize-none rounded-[24px] border-0 bg-transparent px-4 py-3 text-sm font-extrabold text-[#2b2938] shadow-none outline-none transition placeholder:text-[#9d96ab] focus:bg-transparent focus:shadow-none",
                        composerMultiline ? "w-full" : "flex-1",
                      )}
                    />
                    {composerMultiline ? (
                      <div className="flex items-end justify-end">
                        <Button
                          aria-label={
                            sendMutation.isPending
                              ? "Stop generating"
                              : "Send message"
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
                    ) : (
                      <Button
                        aria-label={
                          sendMutation.isPending
                            ? "Stop generating"
                            : "Send message"
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
                    )}
                </div>
                {voiceError && (
                  <p className="px-3 pb-1 pt-2 text-xs font-extrabold text-[#9c4a61]">
                    {voiceError}
                  </p>
                )}
              </>
            </form>
          </div>
            </div>
          </div>
        </div>
      )}
      <Sheet open={mediaSheetOpen} onOpenChange={setMediaSheetOpen}>
        <MediaSourceSheet
          onPickGallery={() => galleryInputRef.current?.click()}
          onPickCamera={() => cameraInputRef.current?.click()}
        />
      </Sheet>
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => onFilesSelected(event.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => onFilesSelected(event.target.files)}
      />
      <Button
        aria-label="Attach outfit image"
        variant="secondary"
        size="icon"
        onClick={() => setMediaSheetOpen(true)}
        className="fixed bottom-[calc(1.05rem+env(safe-area-inset-bottom))] left-6 z-40 rounded-[24px] text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_16px_34px_rgba(42,39,55,0.16)] md:left-[max(1.5rem,calc((100vw-760px)/2+1.5rem))]"
      >
        <Camera size={19} aria-hidden />
      </Button>
      <Button
        aria-label={
          voiceActive ? "Live voice level" : "Start live voice chat"
        }
        variant={voiceActive ? "primary" : "secondary"}
        size="icon"
        onClick={
          voiceActive
            ? undefined
            : () => {
                void startVoiceSession();
              }
        }
        className={cn(
          "fixed bottom-[calc(1.05rem+env(safe-area-inset-bottom))] right-[5rem] z-40 rounded-full md:right-[max(5rem,calc((100vw-760px)/2+5rem))]",
          voiceActive
            ? "bg-[#302d43] text-white shadow-[0_1px_0_rgba(255,255,255,0.22)_inset,0_18px_42px_rgba(42,39,55,0.24)] hover:bg-[#302d43]"
            : "text-[#5f586f] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_16px_34px_rgba(42,39,55,0.16)] hover:text-[#302d43]",
        )}
      >
        {voiceActive && voiceStatus === "connecting" ? (
          <LoaderCircle size={19} className="animate-spin" aria-hidden />
        ) : voiceActive ? (
          <MiniVoiceLevelMeter levels={voiceLevels} />
        ) : (
          <Mic size={19} aria-hidden />
        )}
      </Button>
      {voiceActive ? (
        <Button
          aria-label="End live voice chat"
          variant="danger"
          size="icon"
          onClick={() => stopVoiceSession()}
          className="fixed bottom-[calc(1.05rem+env(safe-area-inset-bottom))] right-6 z-40 rounded-full bg-[#b8324d] text-white shadow-[0_1px_0_rgba(255,255,255,0.22)_inset,0_18px_42px_rgba(111,21,42,0.26)] hover:bg-[#9f2942] md:right-[max(1.5rem,calc((100vw-760px)/2+1.5rem))]"
        >
          <PhoneOff size={19} aria-hidden />
        </Button>
      ) : (
        <Button
          aria-label={chatPanelOpen ? "Close chat" : "Open chat"}
          variant={chatPanelOpen ? "primary" : "secondary"}
          size="icon"
          onClick={() => setChatPanelOpen((open) => !open)}
          className={cn(
            "fixed bottom-[calc(1.05rem+env(safe-area-inset-bottom))] right-6 z-40 rounded-full md:right-[max(1.5rem,calc((100vw-760px)/2+1.5rem))]",
            chatPanelOpen
              ? "bg-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.22)_inset,0_18px_42px_rgba(42,39,55,0.24)] hover:bg-[#3d394f]"
              : "text-[#5f586f] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_16px_34px_rgba(42,39,55,0.16)] hover:text-[#302d43]",
          )}
        >
          {chatPanelOpen ? (
            <X size={19} aria-hidden />
          ) : (
            <MessageCircle size={19} aria-hidden />
          )}
        </Button>
      )}
    </AppChrome>
  );
}

function MediaSourceSheet({
  onPickGallery,
  onPickCamera,
}: {
  onPickGallery: () => void;
  onPickCamera: () => void;
}) {
  return (
    <SheetContent
      side="bottom"
      showCloseButton={false}
      className="rounded-t-[34px] border-white/70 bg-[#f7f6f8]/94 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-20px_54px_rgba(47,45,58,0.16)] backdrop-blur-2xl"
    >
      <SheetTitle className="text-center font-display text-2xl font-semibold text-[#332f43]">
        Add a look
      </SheetTitle>
      <SheetDescription className="sr-only">
        Choose whether to upload an outfit image from the album or take a new
        photo.
      </SheetDescription>
      <div className="mx-auto flex w-full max-w-[480px] flex-col gap-2">
        <button
          type="button"
          onClick={onPickCamera}
          className="flex h-14 items-center gap-3 rounded-[24px] border border-white/78 bg-white/66 px-4 text-left text-sm font-extrabold text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.92)_inset]"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[18px] bg-[#e3e1e8]/78">
            <Camera size={19} aria-hidden />
          </span>
          Take photo
        </button>
        <button
          type="button"
          onClick={onPickGallery}
          className="flex h-14 items-center gap-3 rounded-[24px] border border-white/78 bg-white/66 px-4 text-left text-sm font-extrabold text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.92)_inset]"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[18px] bg-[#e3e1e8]/78">
            <Images size={19} aria-hidden />
          </span>
          Choose from album
        </button>
      </div>
    </SheetContent>
  );
}

function MiniVoiceLevelMeter({ levels }: { levels: number[] }) {
  const visibleLevels = levels.slice(0, 4);

  return (
    <span className="flex h-6 items-center gap-0.5" aria-hidden>
      {visibleLevels.map((level, index) => (
        <span
          key={index}
          className="w-1 rounded-full bg-white/88 shadow-[0_0_10px_rgba(255,255,255,0.28)] transition-[height] duration-75"
          style={{ height: `${Math.round(7 + level * 16)}px` }}
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

function appendLiveTranscript(current: string, next: string): string {
  const text = next.trim();
  if (!text) return current;
  if (!current) return text;
  if (/^[，。！？,.!?;；:：]/.test(text)) return `${current}${text}`;
  return `${current}${/[\s\n]$/.test(current) ? "" : " "}${text}`;
}

function mergeLiveTranscript(current: string, next: string): string {
  const currentText = current.trim();
  const nextText = next.trim();
  if (!currentText) return nextText;
  if (!nextText) return currentText;
  if (nextText.startsWith(currentText)) return nextText;
  if (currentText.startsWith(nextText)) return currentText;
  return appendLiveTranscript(currentText, nextText);
}

function textsOverlap(current: string, next: string): boolean {
  const currentText = current.trim();
  const nextText = next.trim();
  return (
    Boolean(currentText && nextText) &&
    (currentText === nextText ||
      currentText.includes(nextText) ||
      nextText.includes(currentText))
  );
}

function WelcomeMessage() {
  return (
    <AgentBubble>
      <MarkdownMessage content="Hi, I’m Mochi. Send me the outfit, the occasion, or the tiny doubt before you leave. I’ll help with taste, proportion, color, and expression, without pretending to be your doctor, therapist, lawyer, or life oracle." />
    </AgentBubble>
  );
}

function MessageItem({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const hasContent = message.content.trim().length > 0;

  if (!isUser) {
    if (!hasContent) return null;

    return (
      <AgentBubble>
        <MarkdownMessage content={message.content} />
      </AgentBubble>
    );
  }

  return (
    <div className="flex justify-end">
      <div
        className={cn(
          "max-w-[84%] overflow-hidden break-words rounded-[24px] px-3.5 py-2.5 text-sm font-bold leading-5 shadow-[0_14px_34px_rgba(38,36,52,0.14)] [overflow-wrap:anywhere]",
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

function AgentBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] overflow-hidden break-words rounded-[24px] border border-white/72 bg-white/64 px-3.5 py-2.5 text-sm font-bold leading-5 text-[#343145] shadow-[0_1px_0_rgba(255,255,255,0.88)_inset,0_14px_34px_rgba(38,36,52,0.08)] backdrop-blur-xl [overflow-wrap:anywhere]">
        {children}
      </div>
    </div>
  );
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        p: ({ children }) => (
          <p className="mb-2 text-[0.95rem] font-semibold leading-5 text-inherit last:mb-0">
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
          <ul className="mb-2 ml-5 list-disc space-y-1 text-[0.95rem] font-semibold leading-5 text-[#343145] last:mb-0">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 ml-5 list-decimal space-y-1 text-[0.95rem] font-semibold leading-5 text-[#343145] last:mb-0">
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
