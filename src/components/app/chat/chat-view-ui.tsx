"use client";

import {
  useEffect,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  Camera,
  ChevronDown,
  Images,
  LoaderCircle,
  MessageCircle,
  Mic,
  MicOff,
  Plus,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import {
  isPartialOotdReportContent,
  parseOotdReportContent,
} from "@/lib/ootd-report-content";
import { cn } from "@/lib/utils";
import type { LiveConnectionStatus } from "@/lib/live/ws-client";
import type {
  ChatAttachment,
  ChatMessage,
  MochiConversation,
} from "@/types/lumi";
import type { PendingAttachment } from "./chat-types";

export function ChatSessionSwitcher({
  conversations,
  selectedId,
  creating,
  deleting,
  deleteDisabled,
  deleteConfirmOpen,
  deleteError,
  onSelect,
  onCreate,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  conversations: MochiConversation[];
  selectedId: string;
  creating: boolean;
  deleting: boolean;
  deleteDisabled: boolean;
  deleteConfirmOpen: boolean;
  deleteError: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  return (
    <div className="fixed right-4 top-[4.15rem] z-30 flex w-[66.666vw] max-w-[520px] items-center gap-2 px-3 md:right-[max(1rem,calc((100vw-264px-760px)/2+1rem))]">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Chat session</span>
        <select
          value={selectedId}
          onChange={(event) => onSelect(event.target.value)}
          className="h-9 w-full appearance-none rounded-full border border-white/80 bg-[#fbfafc]/88 pl-3 pr-9 text-xs font-extrabold text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_12px_28px_rgba(46,43,60,0.1)] outline-none backdrop-blur-xl"
        >
          {conversations.length === 0 && (
            <option value="">Loading chat</option>
          )}
          {conversations.map((conversation) => (
            <option key={conversation.id} value={conversation.id}>
              {conversation.title}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6f6880]"
        />
      </label>
      <Button
        aria-label="New chat session"
        type="button"
        variant="secondary"
        size="icon"
        onClick={onCreate}
        disabled={creating}
        className="h-9 w-9 shrink-0 rounded-full text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_12px_28px_rgba(42,39,55,0.12)]"
      >
        {creating ? (
          <LoaderCircle size={16} className="animate-spin" aria-hidden />
        ) : (
          <Plus size={18} strokeWidth={2.6} aria-hidden />
        )}
      </Button>
      <Button
        aria-label="Delete chat session"
        type="button"
        variant="secondary"
        size="icon"
        onClick={onDelete}
        disabled={deleteDisabled || deleting || !selectedId}
        className="h-9 w-9 shrink-0 rounded-full text-[#8f5e66] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_12px_28px_rgba(42,39,55,0.12)] disabled:opacity-40"
      >
        {deleting ? (
          <LoaderCircle size={15} className="animate-spin" aria-hidden />
        ) : (
          <Trash2 size={15} strokeWidth={2.4} aria-hidden />
        )}
      </Button>
      {deleteConfirmOpen && (
        <div className="absolute right-3 top-12 w-[min(18rem,calc(100vw-2rem))] rounded-[18px] border border-white/78 bg-[#fbfafc]/90 p-3 text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_18px_42px_rgba(42,39,55,0.16)] backdrop-blur-xl">
          <p className="text-sm font-extrabold leading-5">Delete chat?</p>
          <p className="mt-1 text-xs font-bold leading-4 text-[#6f6880]">
            Messages and media will be removed.
          </p>
          <p className="mt-1 text-[0.7rem] font-bold leading-4 text-[#8b8496]">
            Last chat starts a new one.
          </p>
          {deleteError && (
            <p className="mt-2 text-xs font-bold leading-4 text-[#a8515d]">
              {deleteError}
            </p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancelDelete}
              disabled={deleting}
              className="h-8 rounded-full px-3 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onConfirmDelete}
              disabled={deleting}
              className="h-8 rounded-full bg-[#f4dde1] px-3 text-xs text-[#8f4d59] hover:bg-[#efd0d6]"
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ChatMessagesPanel({
  messageScrollRef,
  messages,
  composerExpanded,
  showPendingIndicator,
  showSendError,
  sendErrorKind,
  authPromptKind = "message",
  onRetry,
  onCreateOotdReport,
  ootdReportStatusByMediaId,
}: {
  messageScrollRef: RefObject<HTMLElement | null>;
  messages: ChatMessage[];
  composerExpanded: boolean;
  showPendingIndicator: boolean;
  showSendError: boolean;
  sendErrorKind: "auth" | "generic";
  authPromptKind?: "message" | "voice";
  onRetry: () => void;
  onCreateOotdReport: (attachment: ChatAttachment, imageUrl?: string) => void;
  ootdReportStatusByMediaId?: Record<
    string,
    "generating" | "ready" | "failed"
  >;
}) {
  return (
    <div
      className={cn(
        "fixed right-4 top-[6.5rem] z-20 flex w-[66.666vw] max-w-[520px] flex-col overflow-hidden rounded-[24px] bg-transparent p-3 transition-[bottom] duration-200 md:right-[max(1rem,calc((100vw-264px-760px)/2+1rem))]",
        composerExpanded
          ? "bottom-[calc(8.4rem+env(safe-area-inset-bottom))]"
          : "bottom-[calc(4.65rem+env(safe-area-inset-bottom))]",
      )}
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <section
          ref={messageScrollRef}
          className="scrollbar-pearl min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pb-3 pr-1 [-webkit-overflow-scrolling:touch]"
        >
          <div className="flex min-h-full flex-col justify-end gap-3">
            {messages.length === 0 && <WelcomeMessage />}
            {messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                onCreateOotdReport={onCreateOotdReport}
                ootdReportStatusByMediaId={ootdReportStatusByMediaId}
              />
            ))}
            {showPendingIndicator && (
              <div className="lumi-fade-in max-w-full px-1 py-2 text-[#343145]">
                <span className="thinking-text-wave text-sm font-bold">
                  stitching a thought
                </span>
              </div>
            )}
            {showSendError && sendErrorKind === "auth" && (
              <div className="lumi-fade-in space-y-2 rounded-[22px] border border-[#d8d6ee] bg-[#f7f4ff]/90 p-3 text-sm font-bold text-[#51466c] backdrop-blur-xl">
                <p>
                  {authPromptKind === "voice"
                    ? "Sign in to use live voice with Mochi."
                    : "Sign in to send messages to Mochi."}
                </p>
                <GoogleAuthButton compact className="w-full" />
              </div>
            )}
            {showSendError && sendErrorKind === "generic" && (
              <div className="lumi-fade-in rounded-[22px] border border-[#ead1d8] bg-[#fff3f5]/86 p-3 text-sm font-bold text-[#9c4a61] backdrop-blur-xl">
                The thread snagged.{" "}
                <button type="button" className="underline" onClick={onRetry}>
                  Retry
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function ChatComposer({
  composerBodyRef,
  draftInputRef,
  draft,
  attachments,
  mediaSheetOpen,
  voiceActive,
  sendControlActive,
  onDraftChange,
  onSubmit,
  onToggleMediaMenu,
  onRemoveAttachment,
  onCreateOotdReport,
  ootdReportStatusByMediaId,
}: {
  composerBodyRef: RefObject<HTMLDivElement | null>;
  draftInputRef: RefObject<HTMLTextAreaElement | null>;
  draft: string;
  attachments: PendingAttachment[];
  mediaSheetOpen: boolean;
  voiceActive: boolean;
  sendControlActive: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onToggleMediaMenu: () => void;
  onRemoveAttachment: (localId: string) => void;
  onCreateOotdReport: (attachment: PendingAttachment) => void;
  ootdReportStatusByMediaId?: Record<
    string,
    "generating" | "ready" | "failed"
  >;
}) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  const handleDraftKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    onSubmit();
  };

  return (
    <div
      className={cn(
        "fixed bottom-[calc(1.05rem+env(safe-area-inset-bottom))] left-6 z-30 md:left-[calc(264px+max(1.5rem,calc((100vw-264px-760px)/2+1.5rem)))]",
        voiceActive && !sendControlActive
          ? "right-[11.5rem] md:right-[calc(max(1.5rem,calc((100vw-264px-760px)/2+1.5rem))+10rem)]"
          : "right-[8.75rem] md:right-[calc(max(1.5rem,calc((100vw-264px-760px)/2+1.5rem))+7.25rem)]",
      )}
    >
      <form
        onSubmit={handleSubmit}
        className={cn(
          "w-full rounded-[24px] border border-white/82 bg-[#fbfafc]/90 shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_16px_36px_rgba(46,43,60,0.12)] backdrop-blur-2xl",
          attachments.length > 0 ? "p-1.5" : "h-11 overflow-hidden p-0",
        )}
      >
        {attachments.length > 0 && (
          <div className="mb-1.5 space-y-1.5">
            {attachments.map((attachment) => (
              <AttachmentPreview
                key={attachment.localId}
                attachment={attachment}
                onRemove={() => onRemoveAttachment(attachment.localId)}
                onCreateOotdReport={() => onCreateOotdReport(attachment)}
                ootdStatus={
                  attachment.media_id
                    ? ootdReportStatusByMediaId?.[attachment.media_id]
                    : undefined
                }
              />
            ))}
          </div>
        )}
        <div
          ref={composerBodyRef}
          className={cn(
            "flex items-end gap-1",
            attachments.length === 0 && "h-11",
          )}
        >
          <MediaPlusButton
            open={mediaSheetOpen}
            onClick={onToggleMediaMenu}
            className={cn(
              "shrink-0 rounded-[20px] text-[#302d43] hover:bg-white/58",
              mediaSheetOpen && "relative z-[55] !bg-white hover:!bg-white",
            )}
          />
          <textarea
            ref={draftInputRef}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onInput={(event) =>
              onDraftChange((event.currentTarget as HTMLTextAreaElement).value)
            }
            onKeyDown={handleDraftKeyDown}
            placeholder="Ask Mochi..."
            rows={1}
            className="h-11 max-h-[4.875rem] min-h-11 flex-1 resize-none rounded-[24px] border-0 bg-transparent py-3 pl-1 pr-3 text-sm font-extrabold text-[#2b2938] shadow-none outline-none transition placeholder:text-[#9d96ab] focus:bg-transparent focus:shadow-none"
          />
        </div>
      </form>
    </div>
  );
}

function AttachmentPreview({
  attachment,
  onRemove,
  onCreateOotdReport,
  ootdStatus,
}: {
  attachment: PendingAttachment;
  onRemove: () => void;
  onCreateOotdReport: () => void;
  ootdStatus?: "generating" | "ready" | "failed";
}) {
  const canCreateReport =
    attachment.uploadStatus === "ready" && attachment.media_id;
  const ootdPending = ootdStatus === "generating";

  return (
    <div className="flex h-14 items-center justify-between gap-2 rounded-[20px] border border-white/76 bg-[#f1eef4]/90 px-2 text-xs font-extrabold text-[#5f586f] shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]">
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {attachment.previewUrl && (
          <span className="relative size-11 shrink-0 overflow-hidden rounded-[15px] bg-white/60">
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
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.78rem] leading-4 text-[#4a4559]">
            {attachment.fileName ?? "Outfit image"}
          </span>
          <span
            className={cn(
              "block truncate text-[0.68rem] leading-4",
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
      <span className="flex shrink-0 items-center gap-1">
        {canCreateReport && (
          <button
            type="button"
            aria-label="OOTD report"
            onClick={onCreateOotdReport}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-2.5 text-[0.72rem] font-extrabold text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.92)_inset] transition hover:bg-[#fbfafc]"
          >
            {ootdPending ? (
              <LoaderCircle size={12} className="animate-spin" aria-hidden />
            ) : (
              <Sparkles size={12} aria-hidden />
            )}
            OOTD
          </button>
        )}
        <button
          type="button"
          aria-label="remove"
          onClick={onRemove}
          className="inline-flex size-8 items-center justify-center rounded-full text-[#6f6880] transition hover:bg-white/72 hover:text-[#302d43]"
        >
          <X size={13} strokeWidth={3} aria-hidden />
          <span className="sr-only">remove</span>
        </button>
      </span>
    </div>
  );
}

export function MediaMenuLayer({
  open,
  chatPanelOpen,
  onClose,
  onPickCamera,
  onPickGallery,
}: {
  open: boolean;
  chatPanelOpen: boolean;
  onClose: () => void;
  onPickCamera: () => void;
  onPickGallery: () => void;
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close media menu"
        onClick={onClose}
        className="media-menu-scrim fixed inset-0 z-[45] bg-[#171321]/32"
      />
      <div className="media-menu-rise fixed bottom-[calc(4.35rem+env(safe-area-inset-bottom))] left-6 z-50 flex w-[9.75rem] flex-col gap-2 md:left-[calc(264px+max(1.5rem,calc((100vw-264px-760px)/2+1.5rem)))]">
        <MediaMenuButton
          icon={<Camera size={14} aria-hidden />}
          label="Take a photo"
          onClick={onPickCamera}
        />
        <MediaMenuButton
          icon={<Images size={14} aria-hidden />}
          label="Send a photo"
          onClick={onPickGallery}
        />
      </div>
      {chatPanelOpen && (
        <Button
          aria-label="Close media menu"
          type="button"
          variant="secondary"
          size="icon"
          onClick={onClose}
          className="fixed bottom-[calc(1.05rem+env(safe-area-inset-bottom))] left-6 z-[55] rounded-[20px] !bg-white text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_16px_34px_rgba(42,39,55,0.16)] hover:!bg-white md:left-[calc(264px+max(1.5rem,calc((100vw-264px-760px)/2+1.5rem)))]"
        >
          <Plus
            size={20}
            strokeWidth={2.6}
            aria-hidden
            className="rotate-45 transition-transform duration-200 ease-out"
          />
        </Button>
      )}
    </>
  );
}

export function StandaloneMediaButton({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <MediaPlusButton
      open={open}
      onClick={onToggle}
      variant="secondary"
      className={cn(
        "fixed bottom-[calc(1.05rem+env(safe-area-inset-bottom))] left-6 rounded-[24px] text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_16px_34px_rgba(42,39,55,0.16)] md:left-[calc(264px+max(1.5rem,calc((100vw-264px-760px)/2+1.5rem)))]",
        open ? "z-[55] !bg-white hover:!bg-white" : "z-40",
      )}
    />
  );
}

function MediaPlusButton({
  open,
  onClick,
  className,
  variant = "ghost",
}: {
  open: boolean;
  onClick: () => void;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  return (
    <Button
      aria-label={open ? "Close media menu" : "Open media menu"}
      type="button"
      variant={variant}
      size="icon"
      onClick={onClick}
      className={className}
    >
      <Plus
        size={20}
        strokeWidth={2.6}
        aria-hidden
        className={cn(
          "transition-transform duration-200 ease-out",
          open && "rotate-45",
        )}
      />
    </Button>
  );
}

function MediaMenuButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 items-center gap-2 rounded-full bg-white px-3 text-left text-[0.72rem] font-extrabold text-[#242235] shadow-[0_1px_0_rgba(255,255,255,0.92)_inset] transition hover:bg-[#f7f6f8]"
    >
      <span className="flex size-4 shrink-0 items-center justify-center text-[#242235]">
        {icon}
      </span>
      {label}
    </button>
  );
}

export function BottomActionControls({
  chatPanelOpen,
  voiceActive,
  voiceStatus,
  voiceLevels,
  sendControlActive,
  sendPending,
  sendDisabled,
  onSend,
  onStopGeneration,
  onPrewarmVoice,
  onStartVoice,
  onStopVoice,
  onOpenChat,
  onCloseChat,
}: {
  chatPanelOpen: boolean;
  voiceActive: boolean;
  voiceStatus: LiveConnectionStatus;
  voiceLevels: number[];
  sendControlActive: boolean;
  sendPending: boolean;
  sendDisabled: boolean;
  onSend: () => void;
  onStopGeneration: () => void;
  onPrewarmVoice: () => void;
  onStartVoice: () => void;
  onStopVoice: () => void;
  onOpenChat: () => void;
  onCloseChat: () => void;
}) {
  return (
    <>
      {sendControlActive ? (
        <Button
          aria-label={sendPending ? "Stop generating" : "Send message"}
          variant="primary"
          size="icon"
          onClick={sendPending ? onStopGeneration : onSend}
          disabled={sendDisabled}
          className="fixed bottom-[calc(1.05rem+env(safe-area-inset-bottom))] right-6 z-40 rounded-full bg-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.22)_inset,0_18px_42px_rgba(42,39,55,0.24)] hover:bg-[#3d394f] md:right-[max(1.5rem,calc((100vw-264px-760px)/2+1.5rem))]"
        >
          {sendPending ? (
            <Square size={17} aria-hidden />
          ) : (
            <ArrowUp size={20} strokeWidth={2.8} aria-hidden />
          )}
        </Button>
      ) : voiceActive ? (
        <VoiceActiveControl
          voiceStatus={voiceStatus}
          voiceLevels={voiceLevels}
          onStopVoice={onStopVoice}
        />
      ) : (
        <Button
          aria-label="Start live voice chat"
          variant="secondary"
          size="icon"
          onPointerDown={onPrewarmVoice}
          onClick={onStartVoice}
          className="fixed bottom-[calc(1.05rem+env(safe-area-inset-bottom))] right-6 z-40 rounded-full text-[#5f586f] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_16px_34px_rgba(42,39,55,0.16)] hover:text-[#302d43] md:right-[max(1.5rem,calc((100vw-264px-760px)/2+1.5rem))]"
        >
          <Mic size={19} aria-hidden />
        </Button>
      )}
      <Button
        aria-label={chatPanelOpen ? "Close chat" : "Open chat"}
        variant={chatPanelOpen ? "primary" : "secondary"}
        size="icon"
        onClick={chatPanelOpen ? onCloseChat : onOpenChat}
        className={cn(
          "fixed bottom-[calc(1.05rem+env(safe-area-inset-bottom))] z-40 rounded-full",
          voiceActive && !sendControlActive
            ? "right-[7.25rem] md:right-[calc(max(1.5rem,calc((100vw-264px-760px)/2+1.5rem))+5.75rem)]"
            : "right-[5rem] md:right-[calc(max(1.5rem,calc((100vw-264px-760px)/2+1.5rem))+3.5rem)]",
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
    </>
  );
}

function VoiceActiveControl({
  voiceStatus,
  voiceLevels,
  onStopVoice,
}: {
  voiceStatus: LiveConnectionStatus;
  voiceLevels: number[];
  onStopVoice: () => void;
}) {
  const micPaused = voiceStatus === "responding";

  return (
    <div className="fixed bottom-[calc(1.05rem+env(safe-area-inset-bottom))] right-6 z-40 inline-flex h-11 items-center overflow-hidden rounded-full border border-white/75 bg-[#f7f6f8]/86 text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_16px_34px_rgba(42,39,55,0.16)] backdrop-blur-xl md:right-[max(1.5rem,calc((100vw-264px-760px)/2+1.5rem))]">
      <button
        type="button"
        aria-label="End live voice chat"
        onClick={onStopVoice}
        className="flex h-11 w-10 items-center justify-center"
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-[#ef334e] text-white">
          <X size={14} strokeWidth={3} aria-hidden />
        </span>
      </button>
      <span className="h-6 w-px bg-[#d7d3dd]" aria-hidden />
      <span
        className={cn(
          "flex h-11 w-10 items-center justify-center",
          micPaused && "text-[#8b8498]",
        )}
        aria-label={
          micPaused
            ? "Microphone paused while Mochi responds"
            : "Live voice level"
        }
        role="status"
      >
        {voiceStatus === "connecting" ? (
          <LoaderCircle size={18} className="animate-spin" aria-hidden />
        ) : micPaused ? (
          <MicOff size={18} strokeWidth={2.5} aria-hidden />
        ) : (
          <MiniVoiceLevelMeter levels={voiceLevels} tone="dark" />
        )}
      </span>
    </div>
  );
}

function MiniVoiceLevelMeter({
  levels,
  tone = "light",
}: {
  levels: number[];
  tone?: "light" | "dark";
}) {
  const visibleLevels = levels.slice(0, 4);

  return (
    <span className="flex h-6 items-center gap-0.5" aria-hidden>
      {visibleLevels.map((level, index) => (
        <span
          key={index}
          className={cn(
            "w-1 rounded-full transition-[height] duration-75",
            tone === "dark"
              ? "bg-[#302d43]"
              : "bg-white/88 shadow-[0_0_10px_rgba(255,255,255,0.28)]",
          )}
          style={{ height: `${Math.round(7 + level * 16)}px` }}
        />
      ))}
    </span>
  );
}

function WelcomeMessage() {
  return (
    <AgentBubble>
      <MarkdownMessage content="Hi, I’m Mochi. Send me the outfit, the occasion, or the tiny doubt before you leave. I’ll help with taste, proportion, color, and expression, without pretending to be your doctor, therapist, lawyer, or life oracle." />
    </AgentBubble>
  );
}

function MessageItem({
  message,
  onCreateOotdReport,
  ootdReportStatusByMediaId,
}: {
  message: ChatMessage;
  onCreateOotdReport: (attachment: ChatAttachment, imageUrl?: string) => void;
  ootdReportStatusByMediaId?: Record<
    string,
    "generating" | "ready" | "failed"
  >;
}) {
  const isUser = message.role === "user";
  const hasContent = message.content.trim().length > 0;
  const ootdAttachment = message.attachments?.find(
    (attachment) => attachment.media_id,
  );

  if (!isUser) {
    if (!hasContent) return null;
    if (
      parseOotdReportContent(message.content) ||
      isPartialOotdReportContent(message.content)
    ) {
      return null;
    }

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
          "max-w-[84%] break-words rounded-[24px] rounded-br-[4px] border px-3.5 py-2.5 text-sm font-bold leading-5 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_12px_28px_rgba(154,92,132,0.16)] backdrop-blur-xl [overflow-wrap:anywhere]",
          "border-white/72 bg-[#ffe3ef]/82 text-[#4a2f45]",
          message.status === "failed" &&
            "border-[#f0b9c7]/80 bg-[#9c4a61] text-white",
        )}
      >
        {message.imageUrl && (
          <div className="mb-2 space-y-2">
            <ChatMessageImage
              src={message.imageUrl}
              alt="Uploaded outfit preview"
            />
            {ootdAttachment && (
              (() => {
                const ootdStatus =
                  ootdReportStatusByMediaId?.[ootdAttachment.media_id];
                const ootdPending = ootdStatus === "generating";
                return (
              <button
                type="button"
                aria-label="OOTD report"
                onClick={() =>
                  onCreateOotdReport(ootdAttachment, message.imageUrl)
                }
                className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-2.5 text-[0.72rem] font-extrabold text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] transition hover:bg-[#f5f3f7]"
              >
                {ootdPending ? (
                  <LoaderCircle size={12} className="animate-spin" aria-hidden />
                ) : (
                  <Sparkles size={12} aria-hidden />
                )}
                OOTD
              </button>
                );
              })()
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

function isDisplayableChatImage(src: string) {
  return (
    src.startsWith("blob:") ||
    src.startsWith("data:") ||
    src.startsWith("/api/media/") ||
    src.startsWith("http://") ||
    src.startsWith("https://")
  );
}

function ChatMessageImage({
  src,
  alt,
  width = 220,
  className,
}: {
  src: string;
  alt: string;
  width?: number;
  className?: string;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!isDisplayableChatImage(src)) {
    return (
      <div
        className={cn(
          "flex min-h-24 items-center rounded-[18px] bg-white/18 px-3 py-2 text-xs",
          className,
        )}
        style={{ width, maxWidth: "100%" }}
      >
        Outfit image attached
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Open image preview"
        onClick={() => setPreviewOpen(true)}
        className={cn(
          "block overflow-hidden rounded-[18px] bg-white/18 text-left",
          className,
        )}
        style={{ width, maxWidth: "100%" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="block h-auto max-w-full"
          style={{ width: "100%" }}
        />
      </button>
      {previewOpen && (
        <ChatImagePreviewOverlay
          src={src}
          alt={alt}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  );
}

function ChatImagePreviewOverlay({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      tabIndex={-1}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/82 p-4 backdrop-blur-sm"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-h-[88vh] max-w-[92vw] object-contain"
        onClick={onClose}
      />
    </div>,
    document.body,
  );
}

function AgentBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] break-words rounded-[24px] rounded-bl-[4px] border border-white/72 bg-white/64 px-3.5 py-2.5 text-sm font-bold leading-5 text-[#343145] backdrop-blur-xl [overflow-wrap:anywhere]">
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
