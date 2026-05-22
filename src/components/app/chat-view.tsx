"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
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
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { AppChrome } from "./app-chrome";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { starterPrompts } from "@/lib/data/mochi";
import type { ChatMessage, SendMessageInput, SendMessageResult } from "@/types/lumi";

const DEFAULT_VOICE_LEVELS = [
  0.34, 0.52, 0.42, 0.7, 0.48, 0.82, 0.56, 0.76, 0.44, 0.62, 0.38,
  0.58,
];

export function ChatView() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageScrollRef = useRef<HTMLElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceFrameRef = useRef<number | null>(null);
  const streamingAssistantIdRef = useRef<string | null>(null);
  const [draft, setDraft] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [lastPayload, setLastPayload] = useState<SendMessageInput | null>(null);
  const [voiceActive, setVoiceActive] = useState(false);
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
  const messagesKey = ["messages", conversationId] as const;

  const messagesQuery = useQuery({
    queryKey: messagesKey,
    enabled: Boolean(conversationId),
    queryFn: () => apiClient.listMessages(conversationId as string),
  });
  const messages = messagesQuery.data ?? [];
  const streamingAssistant = streamingAssistantId
    ? messages.find((message) => message.id === streamingAssistantId)
    : undefined;
  const lastMessageContent = messages.at(-1)?.content;

  const stopVoiceSession = useCallback((resetState = true) => {
    if (voiceFrameRef.current !== null) {
      window.cancelAnimationFrame(voiceFrameRef.current);
      voiceFrameRef.current = null;
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    analyserRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    if (resetState) {
      setVoiceActive(false);
      setVoiceLevels(DEFAULT_VOICE_LEVELS);
    }
  }, []);

  const startVoiceSession = useCallback(async () => {
    setVoiceError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Microphone access is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextCtor) {
        throw new Error("Web Audio is not available in this browser.");
      }

      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);

      mediaStreamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      setVoiceActive(true);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const barCount = DEFAULT_VOICE_LEVELS.length;

      const updateLevels = () => {
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
    } catch {
      stopVoiceSession(false);
      setVoiceActive(false);
      setVoiceError("Mic permission is needed for live voice chat.");
    }
  }, [stopVoiceSession]);

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
        kind: input.imageUrl ? "image" : "text",
        content: input.content || "Can you read this outfit?",
        imageUrl: input.imageUrl,
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
      setAttachmentName("");
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
    onError: (_error, _variables, context) => {
      if (!context) return;
      if (streamingAssistantIdRef.current === context.optimisticAssistantId) {
        streamingAssistantIdRef.current = null;
      }
      setStreamingAssistantId((current) =>
        current === context.optimisticAssistantId ? null : current,
      );

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

  const submit = (payload?: SendMessageInput) => {
    if (!conversationId) return;
    const content = payload?.content ?? draft.trim();
    const imageUrl =
      payload?.imageUrl ??
      (attachmentName ? `attachment://${encodeURIComponent(attachmentName)}` : undefined);

    if (!content && !imageUrl) return;
    const nextPayload = {
      content: content || "Can you read this outfit?",
      imageUrl,
    };
    setLastPayload(nextPayload);
    sendMutation.mutate(nextPayload);
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
              </div>
            )}
            {sendMutation.isError && (
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
                        Live listening
                      </span>
                      <span className="block truncate text-xs font-extrabold text-white/72">
                        Tap to hang up
                      </span>
                    </span>
                  </span>
                  <VoiceLevelMeter levels={voiceLevels} />
                </button>
              ) : (
                <>
                  {attachmentName && (
                    <div className="mb-2 flex items-center justify-between rounded-[22px] border border-white/72 bg-[#edeaf1]/72 px-3 py-2 text-xs font-extrabold text-[#5f586f] shadow-[0_1px_0_rgba(255,255,255,0.78)_inset]">
                      <span className="truncate">
                        Attached: {attachmentName}
                      </span>
                      <button type="button" onClick={() => setAttachmentName("")}>
                        remove
                      </button>
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) =>
                        setAttachmentName(event.target.files?.[0]?.name ?? "")
                      }
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
                      onClick={startVoiceSession}
                      className="rounded-full text-[#5f586f] hover:text-[#302d43]"
                    >
                      <Mic size={19} aria-hidden />
                    </Button>
                    <Button
                      aria-label="Send message"
                      type="submit"
                      size="icon"
                      disabled={
                        !conversationId ||
                        sendMutation.isPending ||
                        (!draft.trim() && !attachmentName)
                      }
                      className="rounded-full bg-[#302d43] hover:bg-[#3d394f]"
                    >
                      <SendHorizonal size={19} aria-hidden />
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
      {starterPrompts.slice(0, 3).map((prompt) => (
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
          <div className="mb-2 rounded-[16px] bg-white/18 px-3 py-2 text-xs">
            Outfit image attached
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
