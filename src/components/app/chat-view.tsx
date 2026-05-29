"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { AppChrome } from "./app-chrome";
import {
  BottomActionControls,
  ChatComposer,
  ChatMessagesPanel,
  MediaMenuLayer,
  StandaloneMediaButton,
} from "./chat/chat-view-ui";
import {
  downloadOotdShareImage,
  OotdReportModal,
} from "./ootd-report-modal";
import { apiClient } from "@/lib/api/client";
import { isOotdReportChatError } from "@/lib/api/go-claw-chat";
import { getOrCreateMochiSessionId } from "@/lib/session/mochi-session";
import {
  bytesToBase64,
  getLiveWebSocketUrl,
  parseLiveEvent,
  prepareLiveWebSocketSession,
  sampleRateFromMime,
  type LiveConnectionStatus,
} from "@/lib/live/ws-client";
import {
  appendLiveTranscript,
  audioFrameMetrics,
  base64PCMToFloat32,
  downsampleToPCM16,
  getAudioContextCtor,
  mergeLiveTranscript,
  safeDisconnect,
  stopMediaStream,
  textsOverlap,
} from "./chat/chat-live-audio";
import { ChatProxyError } from "@/lib/api/go-claw-chat";
import type { PendingAttachment } from "./chat/chat-types";
import type {
  ChatAttachment,
  ChatMessage,
  OotdReport,
  OotdShareCard,
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
const LIVE_END_OF_SPEECH_MS = 500;
const LIVE_CALIBRATION_FRAMES = 16;
const LIVE_CONNECT_TIMEOUT_MS = 12000;
const LIVE_PREWARM_DELAY_MS = 1500;
const LIVE_LISTENING_READY_DELAY_MS = 2000;
const LIVE_STANDBY_IDLE_MS = 90000;
const DEFAULT_IMAGE_REVIEW_PROMPT = "Can you review this look?";

type OotdReportState =
  | {
      status: "generating";
      imageUrl?: string;
      localId?: string;
    }
  | {
      status: "ready";
      report: OotdReport;
      imageUrl?: string;
      localId?: string;
    }
  | {
      status: "failed";
      error: string;
      imageUrl?: string;
      localId?: string;
    };

function isUnauthenticatedError(error: unknown) {
  return (
    (error instanceof ChatProxyError && error.status === 401) ||
    (error instanceof Error &&
      /Google sign-in is required|unauthorized|401/i.test(error.message))
  );
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function isShareCardOnCurrentOrigin(shareCard: OotdShareCard) {
  if (typeof window === "undefined") return true;
  try {
    return new URL(shareCard.shortUrl).origin === window.location.origin;
  } catch {
    return false;
  }
}

function ootdShareTitle(report: OotdReport) {
  return report.shareCard?.title || report.todayJudgment.title || "Mochi OOTD";
}

function ootdShareDescription(report: OotdReport) {
  return (
    report.shareCard?.quote ||
    report.mochiLine ||
    report.todayJudgment.summary ||
    ootdShareTitle(report)
  ).trim();
}

function ootdShareText(report: OotdReport, url: string) {
  return `${ootdShareDescription(report)} ${url}`.trim();
}

function summarizeOotdReport(report: OotdReport) {
  const suggestions = (report.suggestions ?? [])
    .map((item) => [item.title, item.body].filter(Boolean).join(": "))
    .filter((item) => item.trim())
    .slice(0, 2)
    .join(" | ");
  return [
    `Judgment: ${report.todayJudgment.title} (${report.todayJudgment.score}/10, ${report.todayJudgment.label}).`,
    report.todayJudgment.summary,
    report.overallStyle ? `Style: ${report.overallStyle}.` : "",
    report.highlights?.length ? `Highlights: ${report.highlights.join("; ")}.` : "",
    report.biggestIssue ? `Biggest issue: ${report.biggestIssue}.` : "",
    suggestions ? `Suggestions: ${suggestions}.` : "",
    report.mochiLine ? `Mochi line: ${report.mochiLine}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function ChatView() {
  const { status: authStatus } = useSession();
  const queryClient = useQueryClient();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const composerBodyRef = useRef<HTMLDivElement>(null);
  const draftInputRef = useRef<HTMLTextAreaElement>(null);
  const messageScrollRef = useRef<HTMLElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const attachmentUrlsRef = useRef<Set<string>>(new Set());
  const ootdReportByMediaIdRef = useRef<Record<string, OotdReportState>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const captureAudioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const liveSocketRef = useRef<WebSocket | null>(null);
  const liveResumptionHandleRef = useRef<string | null>(null);
  const liveAudioQueueRef = useRef<Promise<void>>(Promise.resolve());
  const livePlaybackTimeRef = useRef(0);
  const livePlaybackGenerationRef = useRef(0);
  const livePlaybackSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const liveManualStopRef = useRef(false);
  const liveExpectedCloseRef = useRef(false);
  const liveInputPausedRef = useRef(false);
  const liveResumeTimerRef = useRef<number | null>(null);
  const liveListeningReadyTimerRef = useRef<number | null>(null);
  const liveConnectTimeoutRef = useRef<number | null>(null);
  const liveSocketConnectPromiseRef = useRef<Promise<void> | null>(null);
  const liveStandbyIdleTimerRef = useRef<number | null>(null);
  const liveReconnectAttemptRef = useRef(0);
  const liveReconnectTimerRef = useRef<number | null>(null);
  const liveSessionGenerationRef = useRef(0);
  const liveCaptureGenerationRef = useRef(0);
  const liveSocketReadyRef = useRef(false);
  const liveCaptureRequestedRef = useRef(false);
  const liveSentMediaIdsRef = useRef<Set<string>>(new Set());
  const livePendingMediaAttachmentsRef = useRef<PendingAttachment[]>([]);
  const attachmentsRef = useRef<PendingAttachment[]>([]);
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
  // 从 sessionStorage 恢复 resumption token（页面刷新后仍可快速重连）
  useEffect(() => {
    if (!sessionId) return;
    const stored = sessionStorage.getItem(`live_rh_${sessionId}`);
    if (stored) liveResumptionHandleRef.current = stored;
  }, [sessionId]);
  const [lastPayload, setLastPayload] = useState<SendMessageInput | null>(null);
  const [lastSendStopped, setLastSendStopped] = useState(false);
  const [uploadAuthRequired, setUploadAuthRequired] = useState(false);
  const [voiceAuthRequired, setVoiceAuthRequired] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<LiveConnectionStatus>("idle");
  const [voiceError, setVoiceError] = useState("");
  const [voiceLevels, setVoiceLevels] = useState(DEFAULT_VOICE_LEVELS);
  const [streamingAssistantId, setStreamingAssistantId] = useState<
    string | null
  >(null);
  const [ootdReportOpen, setOotdReportOpen] = useState(false);
  const [ootdShareCard, setOotdShareCard] = useState<OotdShareCard | null>(
    null,
  );
  const [ootdShareFallbackOpen, setOotdShareFallbackOpen] = useState(false);
  const [ootdShareError, setOotdShareError] = useState("");
  const [ootdShareInProgress, setOotdShareInProgress] = useState(false);
  const [ootdActiveMediaId, setOotdActiveMediaId] = useState<string | null>(
    null,
  );
  const [ootdReportByMediaId, setOotdReportByMediaId] = useState<
    Record<string, OotdReportState>
  >({});
  const [activeOotdReportId, setActiveOotdReportId] = useState<string | null>(
    null,
  );
  const [activeOotdReportSummary, setActiveOotdReportSummary] = useState("");

  const conversationQuery = useQuery({
    queryKey: ["mochi-conversation"],
    queryFn: async () => {
      const conversations = await apiClient.listConversations();
      return conversations[0] ?? apiClient.createConversation();
    },
  });

  const conversationId = conversationQuery.data?.id;
  const messagesKey = useMemo(
    () => ["messages", conversationId, sessionId] as const,
    [conversationId, sessionId],
  );

  const messagesQuery = useQuery({
    queryKey: messagesKey,
    enabled: Boolean(conversationId && sessionId),
    queryFn: () => apiClient.listMessages(conversationId as string, sessionId),
  });
  const messages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);
  const hasUploadingAttachments = attachments.some(
    (attachment) => attachment.uploadStatus === "uploading",
  );
  const hasFailedAttachments = attachments.some(
    (attachment) => attachment.uploadStatus === "failed",
  );
  const hasComposerContent = Boolean(draft.trim() || attachments.length);
  const streamingAssistant = streamingAssistantId
    ? messages.find((message) => message.id === streamingAssistantId)
    : undefined;
  const lastMessageContent = messages.at(-1)?.content;
  const activeOotdState = ootdActiveMediaId
    ? ootdReportByMediaId[ootdActiveMediaId]
    : undefined;
  const ootdStatusByMediaId = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(ootdReportByMediaId).map(([mediaId, state]) => [
          mediaId,
          state.status,
        ]),
      ),
    [ootdReportByMediaId],
  );

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

  const clearLiveResumeTimer = useCallback(() => {
    if (liveResumeTimerRef.current !== null) {
      window.clearTimeout(liveResumeTimerRef.current);
      liveResumeTimerRef.current = null;
    }
  }, []);

  const clearLiveStandbyIdleTimer = useCallback(() => {
    if (liveStandbyIdleTimerRef.current !== null) {
      window.clearTimeout(liveStandbyIdleTimerRef.current);
      liveStandbyIdleTimerRef.current = null;
    }
  }, []);

  const pauseLiveInput = useCallback(() => {
    clearLiveResumeTimer();
    liveInputPausedRef.current = true;
    setVoiceStatus("responding");
  }, [clearLiveResumeTimer]);

  const resumeLiveInputAfterPlayback = useCallback(async () => {
    clearLiveResumeTimer();
    await liveAudioQueueRef.current.catch(() => undefined);
    if (!liveInputPausedRef.current) return;

    const context = audioContextRef.current;
    const remainingMs = context
      ? Math.max(0, (livePlaybackTimeRef.current - context.currentTime) * 1000)
      : 0;
    liveResumeTimerRef.current = window.setTimeout(() => {
      liveResumeTimerRef.current = null;
      liveInputPausedRef.current = false;
      setVoiceStatus((current) =>
        current === "responding" ? "listening" : current,
      );
    }, remainingMs + 80);
  }, [clearLiveResumeTimer]);

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
      liveInputPausedRef.current = false;
      liveSocketReadyRef.current = false;
      liveCaptureRequestedRef.current = false;
      liveSocketConnectPromiseRef.current = null;
      clearLiveResumeTimer();
      clearLiveStandbyIdleTimer();
      if (liveListeningReadyTimerRef.current !== null) {
        window.clearTimeout(liveListeningReadyTimerRef.current);
        liveListeningReadyTimerRef.current = null;
      }
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

      const liveSocket = liveSocketRef.current;
      if (liveSocket && liveSocket.readyState === WebSocket.OPEN) {
        liveSocket.send(JSON.stringify({ type: "audio_end" }));
        liveSocket.send(JSON.stringify({ type: "close" }));
      }
      liveSocket?.close();
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
      if (resetState) {
        livePendingMediaAttachmentsRef.current = [];
      }

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
    [
      clearLiveAssistantDraft,
      clearLiveResumeTimer,
      clearLiveStandbyIdleTimer,
      stopLivePlayback,
    ],
  );

  const sendLiveMediaAttachment = useCallback(
    (attachment: PendingAttachment) => {
      const socket = liveSocketRef.current;
      if (
        attachment.media_id &&
        liveSentMediaIdsRef.current.has(attachment.media_id)
      ) {
        return true;
      }
      if (
        !attachment.media_id ||
        attachment.uploadStatus !== "ready" ||
        socket?.readyState !== WebSocket.OPEN
      ) {
        return false;
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
      return true;
    },
    [],
  );

  const sendOrQueueLiveMediaAttachment = useCallback(
    (attachment: PendingAttachment) => {
      if (sendLiveMediaAttachment(attachment)) return;
      if (!attachment.media_id || attachment.uploadStatus !== "ready") return;

      const alreadyQueued = livePendingMediaAttachmentsRef.current.some(
        (item) => item.media_id === attachment.media_id,
      );
      if (!alreadyQueued) {
        livePendingMediaAttachmentsRef.current.push(attachment);
      }
    },
    [sendLiveMediaAttachment],
  );

  const flushQueuedLiveMediaAttachments = useCallback(() => {
    livePendingMediaAttachmentsRef.current =
      livePendingMediaAttachmentsRef.current.filter(
        (attachment) => !sendLiveMediaAttachment(attachment),
      );
  }, [sendLiveMediaAttachment]);

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
        if (liveInputPausedRef.current) {
          if (speechActive) {
            speechActive = false;
            sendActivity("activity_end");
          }
          preSpeechFrames.length = 0;
          return;
        }
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
      if (liveListeningReadyTimerRef.current !== null) {
        window.clearTimeout(liveListeningReadyTimerRef.current);
      }
      liveListeningReadyTimerRef.current = window.setTimeout(() => {
        liveListeningReadyTimerRef.current = null;
        if (
          liveSessionGenerationRef.current !== generation ||
          !analyserRef.current
        ) {
          return;
        }
        setVoiceStatus((current) =>
          current === "connecting" ? "listening" : current,
        );
      }, LIVE_LISTENING_READY_DELAY_MS);
    },
    [],
  );

  const startLiveCaptureForSocket = useCallback(
    (socket: WebSocket, generation: number) => {
      liveCaptureRequestedRef.current = true;
      clearLiveStandbyIdleTimer();
      if (
        socket !== liveSocketRef.current ||
        socket.readyState !== WebSocket.OPEN ||
        liveSessionGenerationRef.current !== generation ||
        !liveSocketReadyRef.current
      ) {
        return;
      }
      void startLiveCapture(socket, generation).then(() => {
        attachmentsRef.current.forEach(sendOrQueueLiveMediaAttachment);
        flushQueuedLiveMediaAttachments();
      });
    },
    [
      clearLiveStandbyIdleTimer,
      flushQueuedLiveMediaAttachments,
      sendOrQueueLiveMediaAttachment,
      startLiveCapture,
    ],
  );

  const scheduleLiveStandbyClose = useCallback(
    (socket: WebSocket, generation: number) => {
      clearLiveStandbyIdleTimer();
      if (liveCaptureRequestedRef.current) return;
      liveStandbyIdleTimerRef.current = window.setTimeout(() => {
        liveStandbyIdleTimerRef.current = null;
        if (
          socket !== liveSocketRef.current ||
          liveSessionGenerationRef.current !== generation ||
          liveCaptureRequestedRef.current
        ) {
          return;
        }
        liveExpectedCloseRef.current = true;
        socket.send(JSON.stringify({ type: "close" }));
        socket.close();
      }, LIVE_STANDBY_IDLE_MS);
    },
    [clearLiveStandbyIdleTimer],
  );

  const connectLiveSocket = useCallback(
    async (captureRequested: boolean) => {
      if (captureRequested) {
        clearLiveStandbyIdleTimer();
      }
      if (liveSocketConnectPromiseRef.current) {
        if (captureRequested) {
          liveCaptureRequestedRef.current = true;
        }
        await liveSocketConnectPromiseRef.current;
        return;
      }
      const connectBaseGeneration = liveSessionGenerationRef.current;
      const connectPromise = prepareLiveWebSocketSession();
      liveSocketConnectPromiseRef.current = connectPromise;
      try {
        await connectPromise;
      } finally {
        if (liveSocketConnectPromiseRef.current === connectPromise) {
          liveSocketConnectPromiseRef.current = null;
        }
      }
      if (liveSessionGenerationRef.current !== connectBaseGeneration) {
        return;
      }
      liveManualStopRef.current = false;
      liveExpectedCloseRef.current = false;
      liveInputPausedRef.current = false;
      liveCaptureRequestedRef.current =
        captureRequested || liveCaptureRequestedRef.current;
      liveSocketReadyRef.current = false;

      const generation = ++liveSessionGenerationRef.current;
      const liveSessionId = sessionId || getOrCreateMochiSessionId();
      const resumeHandle = liveResumptionHandleRef.current;
      const socket = new WebSocket(getLiveWebSocketUrl(liveSessionId, resumeHandle));
      liveSocketRef.current = socket;
      let socketOpened = false;
      let setupCompleted = false;

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
        if (liveCaptureRequestedRef.current) {
          setVoiceError(
            "Live voice connection timed out. Check the websocket URL and gateway.",
          );
          setVoiceStatus("error");
        }
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
            session_id: liveSessionId,
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
          return;
        }
        if (eventType === "live_resumption_token") {
          const data = parsed.data;
          const handle = (typeof data === "object" && data !== null ? (data as Record<string, unknown>).handle : null) as string | null ?? null;
          liveResumptionHandleRef.current = handle;
          if (handle && sessionId) {
            sessionStorage.setItem(`live_rh_${sessionId}`, handle);
          }
          return;
        }
        if (eventType === "live_go_away") {
          // GoAway 预警：提前重连，用户无感知
          void connectLiveSocket(liveCaptureRequestedRef.current);
          return;
        }
        if (eventType === "live_setup_complete") {
          setupCompleted = true;
          liveSocketReadyRef.current = true;
          if (liveCaptureRequestedRef.current) {
            startLiveCaptureForSocket(socket, generation);
          } else {
            scheduleLiveStandbyClose(socket, generation);
          }
          return;
        }
        if (eventType === "media_received") {
          return;
        }

        if (eventType === "error") {
          if (liveCaptureRequestedRef.current) {
            setVoiceError(
              parsed.message ?? parsed.error ?? "Live voice connection failed.",
            );
            setVoiceStatus("error");
          }
          return;
        }

        if (eventType === "done" || parsed.done) {
          void resumeLiveInputAfterPlayback();
          return;
        }
        if (eventType === "live_response_start") {
          pauseLiveInput();
          return;
        }
        if (eventType === "live_response_end") {
          void resumeLiveInputAfterPlayback();
          return;
        }
        if (eventType === "live_interrupted") {
          liveInputPausedRef.current = false;
          clearLiveResumeTimer();
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
          pauseLiveInput();
          void playLiveAudio(audio);
          return;
        }

        const text =
          parsed.content ?? parsed.text ?? parsed.message ?? parsed.transcript;
        if (text) {
          if (eventType === "live_transcript" && parsed.role === "user") {
            if (!liveInputPausedRef.current) setVoiceStatus("speaking");
            upsertLiveUserTranscript(text);
            return;
          }
          if (
            eventType === "live_transcript" &&
            parsed.role === "assistant"
          ) {
            pauseLiveInput();
            finishLiveUserTranscript();
            appendLiveAssistantDelta(text);
            return;
          }
          if (eventType === "message") {
            if (parsed.role === "assistant") {
              pauseLiveInput();
              finishLiveUserTranscript();
              finalizeLiveAssistantMessage(text);
              void resumeLiveInputAfterPlayback();
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
        clearLiveStandbyIdleTimer();
        if (socket === liveSocketRef.current) {
          liveSocketRef.current = null;
          liveSocketReadyRef.current = false;
        }
        // resumption token 失效降级：带 handle 但 setup 未完成 → 清 token 立即重试（不计重连次数）
        if (resumeHandle && !setupCompleted && !liveManualStopRef.current && liveSessionGenerationRef.current === generation) {
          liveResumptionHandleRef.current = null;
          if (sessionId) sessionStorage.removeItem(`live_rh_${sessionId}`);
          void connectLiveSocket(liveCaptureRequestedRef.current);
          return;
        }
        if (
          liveCaptureRequestedRef.current &&
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

        if (liveCaptureRequestedRef.current) {
          setVoiceStatus((current) => (current === "error" ? "error" : "idle"));
        }
        liveCaptureRequestedRef.current = false;
      });

      socket.addEventListener("error", () => {
        clearConnectTimeout();
        if (!socketOpened) {
          liveExpectedCloseRef.current = true;
        }
        if (liveCaptureRequestedRef.current) {
          setVoiceError(
            "Live voice connection failed. Check the proxy and try again.",
          );
          setVoiceStatus("error");
        }
      });

    },
    [
      appendLiveMessage,
      appendLiveAssistantDelta,
      clearLiveAssistantDraft,
      clearLiveResumeTimer,
      clearLiveStandbyIdleTimer,
      finishLiveUserTranscript,
      finalizeLiveAssistantMessage,
      pauseLiveInput,
      playLiveAudio,
      resumeLiveInputAfterPlayback,
      scheduleLiveStandbyClose,
      sessionId,
      startLiveCaptureForSocket,
      stopLivePlayback,
      stopVoiceSession,
      upsertLiveUserTranscript,
    ],
  );

  const prewarmLiveSession = useCallback(async () => {
    if (
      authStatus !== "authenticated" ||
      voiceActive ||
      liveSocketRef.current?.readyState === WebSocket.OPEN ||
      liveSocketRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }
    try {
      await connectLiveSocket(false);
    } catch {
      if (!liveCaptureRequestedRef.current) {
        liveSocketRef.current = null;
        liveSocketReadyRef.current = false;
      }
    }
  }, [authStatus, connectLiveSocket, voiceActive]);

  const startVoiceSession = useCallback(
    async (resetReconnect = true) => {
      if (authStatus !== "authenticated") {
        setChatPanelOpen(true);
        setMediaSheetOpen(false);
        setUploadAuthRequired(false);
        setVoiceAuthRequired(true);
        setVoiceActive(false);
        setVoiceStatus("idle");
        liveCaptureRequestedRef.current = false;
        return;
      }

      liveManualStopRef.current = false;
      liveExpectedCloseRef.current = false;
      liveInputPausedRef.current = false;
      liveCaptureRequestedRef.current = true;
      clearLiveResumeTimer();
      clearLiveStandbyIdleTimer();
      if (resetReconnect) {
        liveReconnectAttemptRef.current = 0;
        liveSentMediaIdsRef.current.clear();
        livePendingMediaAttachmentsRef.current = [];
      }
      setVoiceError("");
      setVoiceStatus("connecting");
      setVoiceActive(true);

      if (!navigator.mediaDevices?.getUserMedia) {
        setVoiceError("Microphone access is not available in this browser.");
        setVoiceActive(false);
        setVoiceStatus("error");
        return;
      }

      try {
        await ensurePlaybackContext();
        const socket = liveSocketRef.current;
        const generation = liveSessionGenerationRef.current;
        if (
          socket?.readyState === WebSocket.OPEN &&
          liveSocketReadyRef.current
        ) {
          startLiveCaptureForSocket(socket, generation);
          return;
        }
        if (
          socket?.readyState === WebSocket.OPEN ||
          socket?.readyState === WebSocket.CONNECTING
        ) {
          liveCaptureRequestedRef.current = true;
          return;
        }
        await connectLiveSocket(true);
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
      authStatus,
      clearLiveResumeTimer,
      clearLiveStandbyIdleTimer,
      connectLiveSocket,
      ensurePlaybackContext,
      startLiveCaptureForSocket,
      stopVoiceSession,
    ],
  );

  useEffect(() => {
    startVoiceSessionRef.current = startVoiceSession;
  }, [startVoiceSession]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        void prewarmLiveSession();
      }
    }, LIVE_PREWARM_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [prewarmLiveSession]);

  useEffect(() => {
    if (authStatus === "authenticated") return;
    if (!liveSocketRef.current && !liveCaptureRequestedRef.current) return;
    stopVoiceSession();
  }, [authStatus, stopVoiceSession]);

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
        content: input.content || DEFAULT_IMAGE_REVIEW_PROMPT,
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

      if (isOotdReportChatError(error)) {
        queryClient.setQueryData<ChatMessage[]>(messagesKey, (current = []) =>
          current
            .filter((message) => message.id !== context.optimisticAssistantId)
            .map((message) =>
              message.id === context.optimisticId
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
  const setOotdMediaState = useCallback(
    (mediaId: string, state: OotdReportState) => {
      setOotdReportByMediaId((current) => {
        const next = { ...current, [mediaId]: state };
        ootdReportByMediaIdRef.current = next;
        return next;
      });
    },
    [],
  );
  const ootdShareCardMutation = useMutation<OotdShareCard, Error, string>({
    mutationFn: (reportId) => apiClient.createOotdShareCard(reportId),
    onSuccess: (shareCard) => {
      setOotdShareCard(shareCard);
    },
  });

  const ensureOotdReportForAttachment = useCallback(
    (
      attachment: PendingAttachment | ChatAttachment,
      options: {
        imageUrl?: string;
        note?: string;
        open?: boolean;
        sessionId?: string;
      } = {},
    ) => {
      if (!attachment.media_id) return;

      const mediaId = attachment.media_id;
      const sourceImageUrl = options.imageUrl ?? attachment.previewUrl ?? "";
      const localId = "localId" in attachment ? attachment.localId : undefined;
      const existing = ootdReportByMediaIdRef.current[mediaId];
      if (options.open) {
        setOotdActiveMediaId(mediaId);
        setOotdShareCard(null);
        setOotdShareFallbackOpen(false);
        setOotdShareError("");
        setOotdReportOpen(true);
      }
      if (existing) {
        return;
      }

      setOotdMediaState(mediaId, {
        status: "generating",
        imageUrl: sourceImageUrl,
        localId,
      });
      void apiClient
        .createOotdReport({
          media_id: mediaId,
          session_id: options.sessionId,
          scene: "daily",
          note: options.note ?? draft.trim(),
        })
        .then((report) => {
          setOotdMediaState(mediaId, {
            status: "ready",
            report,
            imageUrl: sourceImageUrl || report.imageUrl,
            localId,
          });
          setActiveOotdReportId(report.id);
          setActiveOotdReportSummary(summarizeOotdReport(report));
        })
        .catch((error: unknown) => {
          setOotdMediaState(mediaId, {
            status: "failed",
            error:
              error instanceof Error
                ? error.message
                : "Mochi could not create the OOTD report.",
            imageUrl: sourceImageUrl,
            localId,
          });
        });
    },
    [draft, setOotdMediaState],
  );

  const openOotdReportForAttachment = useCallback(
    (attachment: PendingAttachment | ChatAttachment, imageUrl?: string) => {
      ensureOotdReportForAttachment(attachment, {
        imageUrl,
        note: draft.trim(),
        open: true,
      });
    },
    [draft, ensureOotdReportForAttachment],
  );
  const sendControlActive =
    chatPanelOpen &&
    !voiceActive &&
    (hasComposerContent || sendMutation.isPending);
  const textComposerOpen = chatPanelOpen && !voiceActive;
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
    setUploadAuthRequired(false);
    setVoiceAuthRequired(false);

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

        if (!voiceActive) {
          setAttachments((current) => [...current, pendingAttachment]);
        }

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
            if (voiceActive) {
              sendOrQueueLiveMediaAttachment(readyAttachment);
              if (readyAttachment.previewUrl) {
                URL.revokeObjectURL(readyAttachment.previewUrl);
                attachmentUrlsRef.current.delete(readyAttachment.previewUrl);
              }
              return;
            }

            setAttachments((current) =>
              current.map((attachment) =>
                attachment.localId === localId ? readyAttachment : attachment,
              ),
            );
          })
          .catch((error: unknown) => {
            if (isUnauthenticatedError(error)) {
              if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                attachmentUrlsRef.current.delete(previewUrl);
              }
              setAttachments((current) =>
                current.filter((attachment) => attachment.localId !== localId),
              );
              setUploadAuthRequired(true);
              return;
            }

            if (voiceActive) {
              if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                attachmentUrlsRef.current.delete(previewUrl);
              }
              return;
            }

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

  const handleStartVoice = () => {
    if (authStatus !== "authenticated") {
      setChatPanelOpen(true);
      setMediaSheetOpen(false);
      setUploadAuthRequired(false);
      setVoiceAuthRequired(true);
      return;
    }

    setVoiceAuthRequired(false);
    setChatPanelOpen(false);
    void startVoiceSession();
  };

  const submit = (payload?: SendMessageInput) => {
    if (!conversationId) return;
    if (!payload && (hasUploadingAttachments || hasFailedAttachments)) return;
    setVoiceAuthRequired(false);

    const content = payload?.content ?? draft.trim();
    const messageContent = content || DEFAULT_IMAGE_REVIEW_PROMPT;
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
    const includeOotdContext = readyAttachments.length === 0;

    const retryPayload: SendMessageInput = {
      content: messageContent,
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
        refers_to_ootd_report_id: includeOotdContext
          ? (activeOotdReportId ?? undefined)
          : undefined,
        ootd_report_summary: includeOotdContext
          ? activeOotdReportSummary || undefined
          : undefined,
      },
    };
    const primaryAttachment = readyAttachments[0];
    if (primaryAttachment?.media_id) {
      ensureOotdReportForAttachment(primaryAttachment, {
        imageUrl,
        note: messageContent,
      });
    }
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

  const visibleOotdReport =
    activeOotdState?.status === "ready" ? activeOotdState.report : null;
  const visibleOotdImageUrl =
    activeOotdState?.imageUrl ||
    (activeOotdState?.status === "ready"
      ? activeOotdState.report.imageUrl
      : "");

  const getOotdShareCard = async (report: OotdReport) => {
    let shareCard = ootdShareCard;
    if (!shareCard || !isShareCardOnCurrentOrigin(shareCard)) {
      shareCard = await ootdShareCardMutation.mutateAsync(report.id);
    }
    return shareCard;
  };

  const shareOotdReport = async () => {
    if (!visibleOotdReport || ootdShareInProgress) return;
    setOotdShareInProgress(true);
    setOotdShareError("");
    try {
      await getOotdShareCard(visibleOotdReport);
      setOotdShareFallbackOpen(true);
    } catch (error) {
      setOotdShareError(
        error instanceof Error
          ? error.message
          : "Sharing failed. Use another option.",
      );
      setOotdShareFallbackOpen(true);
    } finally {
      setOotdShareInProgress(false);
    }
  };

  const copyOotdShareLink = async () => {
    if (!visibleOotdReport) return;
    try {
      const shareCard = await getOotdShareCard(visibleOotdReport);
      await navigator.clipboard?.writeText(
        ootdShareText(visibleOotdReport, shareCard.shortUrl),
      );
      setOotdShareError("");
    } catch (error) {
      setOotdShareError(
        error instanceof Error ? error.message : "Copy failed.",
      );
    }
  };

  const downloadOotdShareImageFallback = async () => {
    if (!visibleOotdReport) return;
    try {
      const shareCard = await getOotdShareCard(visibleOotdReport);
      await downloadOotdShareImage({
        report: visibleOotdReport,
        imageUrl: visibleOotdImageUrl || visibleOotdReport.imageUrl,
        shareCard,
      });
    } catch (error) {
      setOotdShareError(
        error instanceof Error ? error.message : "Download failed.",
      );
    }
  };

  return (
    <AppChrome
      fixedViewport
      mainClassName="relative min-h-0 overflow-hidden !p-0"
    >
      <div
        className="pointer-events-none fixed inset-y-0 left-0 right-0 bg-cover bg-center md:left-[264px]"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(248, 243, 255, 0.12) 0%, rgba(255, 238, 245, 0.2) 58%, rgba(245, 224, 248, 0.3) 100%), url('/chat/mochi-bg.webp')",
        }}
        aria-hidden
      />
      {chatPanelOpen && (
        <>
          <ChatMessagesPanel
            messageScrollRef={messageScrollRef}
            messages={messages}
            composerExpanded={attachments.length > 0}
            showPendingIndicator={showPendingIndicator}
            showSendError={
              voiceAuthRequired ||
              uploadAuthRequired ||
              (sendMutation.isError && !lastSendStopped)
            }
            sendErrorKind={
              voiceAuthRequired ||
              uploadAuthRequired ||
              isUnauthenticatedError(sendMutation.error)
                ? "auth"
                : "generic"
            }
            authPromptKind={voiceAuthRequired ? "voice" : "message"}
            onRetry={() => lastPayload && submit(lastPayload)}
            onCreateOotdReport={openOotdReportForAttachment}
            ootdReportStatusByMediaId={ootdStatusByMediaId}
          />
          {textComposerOpen && (
            <ChatComposer
              composerBodyRef={composerBodyRef}
              draftInputRef={draftInputRef}
              draft={draft}
              attachments={attachments}
              mediaSheetOpen={mediaSheetOpen}
              voiceActive={voiceActive}
              sendControlActive={sendControlActive}
              onDraftChange={setDraft}
              onSubmit={() => submit()}
              onToggleMediaMenu={() => setMediaSheetOpen((open) => !open)}
              onRemoveAttachment={removeAttachment}
              onCreateOotdReport={openOotdReportForAttachment}
              ootdReportStatusByMediaId={ootdStatusByMediaId}
            />
          )}
        </>
      )}
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
      <MediaMenuLayer
        open={mediaSheetOpen}
        chatPanelOpen={textComposerOpen}
        onClose={() => setMediaSheetOpen(false)}
        onPickCamera={() => cameraInputRef.current?.click()}
        onPickGallery={() => galleryInputRef.current?.click()}
      />
      {!chatPanelOpen && (
        <StandaloneMediaButton
          open={mediaSheetOpen}
          onToggle={() => setMediaSheetOpen((open) => !open)}
        />
      )}
      <BottomActionControls
        chatPanelOpen={chatPanelOpen}
        voiceActive={voiceActive}
        voiceStatus={voiceStatus}
        voiceLevels={voiceLevels}
        sendControlActive={sendControlActive}
        sendPending={sendMutation.isPending}
        sendDisabled={
          !sendMutation.isPending &&
          (!conversationId || hasUploadingAttachments || hasFailedAttachments)
        }
        onSend={() => submit()}
        onStopGeneration={stopGeneration}
        onStartVoice={handleStartVoice}
        onPrewarmVoice={() => void prewarmLiveSession()}
        onStopVoice={() => stopVoiceSession()}
        onOpenChat={() => setChatPanelOpen(true)}
        onCloseChat={() => setChatPanelOpen(false)}
      />
      <OotdReportModal
        open={ootdReportOpen}
        report={visibleOotdReport}
        imageUrl={visibleOotdImageUrl}
        shareCard={ootdShareCard}
        pending={activeOotdState?.status === "generating"}
        error={
          activeOotdState?.status === "failed" ? activeOotdState.error : ""
        }
        sharePending={ootdShareCardMutation.isPending || ootdShareInProgress}
        shareFallbackOpen={ootdShareFallbackOpen}
        shareError={ootdShareError}
        onClose={() => {
          setOotdReportOpen(false);
          setOotdShareFallbackOpen(false);
          setOotdShareError("");
        }}
        onShare={() => {
          void shareOotdReport();
        }}
        onCopyShareLink={() => {
          void copyOotdShareLink();
        }}
        onDownloadShareImage={() => {
          void downloadOotdShareImageFallback();
        }}
      />
    </AppChrome>
  );
}
