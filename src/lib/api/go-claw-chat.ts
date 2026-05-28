import type {
  ChatAttachment,
  ChatMessage,
  SendMessageInput,
  SendMessageResult,
} from "@/types/lumi";

export interface GoClawChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GoClawChatCompletion {
  id?: string;
  choices?: Array<{
    index?: number;
    message?: {
      role?: string;
      content?: string;
    };
    delta?: {
      role?: string;
      content?: string;
    };
    finish_reason?: string | null;
  }>;
}

export interface GoClawSessionMessages {
  session_id?: string;
  messages?: GoClawSessionMessage[];
}

interface GoClawSessionMessage {
  id?: string;
  role?: string;
  content?: string;
  created_at?: string;
  media_refs?: Array<{
    id?: string;
    kind?: string;
    mime_type?: string;
    url?: string;
    preview_url?: string;
  }>;
}

interface GoClawStreamResult {
  content: string;
  upstreamId?: string;
}

export class ChatProxyError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ChatProxyError";
    this.status = status;
  }
}

const now = () => new Date().toISOString();

function makeMessageId(prefix: string, seed?: string) {
  const generated =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2, 10);
  return `${prefix}-${seed ?? generated}`;
}

export function toGoClawMessages(
  history: ChatMessage[] = [],
  input: SendMessageInput,
): GoClawChatMessage[] {
  const previousMessages = history
    .filter((message) => message.kind === "text" && message.content.trim())
    .map<GoClawChatMessage>((message) => ({
      role:
        message.role === "user"
          ? "user"
          : message.role === "system"
            ? "system"
            : "assistant",
      content: message.content,
    }))
    .slice(-12);

  return [
    ...previousMessages,
    {
      role: "user",
      content: input.content || "Can you read this outfit?",
    },
  ];
}

export function extractGoClawAssistantText(
  payload: GoClawChatCompletion,
): string {
  const messageText = payload.choices?.[0]?.message?.content?.trim();
  if (messageText) return messageText;

  const deltaText = payload.choices
    ?.map((choice) => choice.delta?.content ?? "")
    .join("")
    .trim();

  if (deltaText) return deltaText;

  throw new Error("GoClaw chat response did not include assistant content.");
}

export function extractGoClawStreamDelta(
  payload: GoClawChatCompletion,
): string {
  return (
    payload.choices?.map((choice) => choice.delta?.content ?? "").join("") ?? ""
  );
}

function cleanHistoryContent(content: string) {
  return content
    .replace(
      /<mochi_multimodal_context>[\s\S]*?<\/mochi_multimodal_context>/g,
      "",
    )
    .split("\n")
    .filter((line) => !line.trim().startsWith("<media:"))
    .join("\n")
    .trim();
}

function extractHistoryMediaRefs(content: string): ChatAttachment[] {
  const refs: ChatAttachment[] = [];
  const mediaTagPattern = /<media:image\b([^>]*)>/g;
  let match: RegExpExecArray | null;

  while ((match = mediaTagPattern.exec(content)) !== null) {
    const attributes = match[1] ?? "";
    const url = attributes.match(/\burl=(["'])(.*?)\1/)?.[2];
    if (!url) continue;

    refs.push({
      media_id: attributes.match(/\bid=(["'])(.*?)\1/)?.[2] ?? url,
      source: "chat",
      role: "user",
      previewUrl: url,
    });
  }

  return refs;
}

export function toLumiChatMessages(
  conversationId: string,
  payload: GoClawSessionMessages,
): ChatMessage[] {
  return (payload.messages ?? [])
    .map((message, index): ChatMessage | null => {
      const role =
        message.role === "assistant"
          ? "mochi"
          : message.role === "user" || message.role === "system"
            ? message.role
            : null;
      if (!role) return null;

      const contentWithMediaTags = message.content ?? "";
      const mediaRefAttachments: ChatAttachment[] = (message.media_refs ?? [])
        .filter((ref) => ref.id)
        .map((ref) => ({
          media_id: ref.id as string,
          source: "chat" as const,
          role: "user" as const,
          previewUrl: ref.preview_url ?? ref.url,
          mimeType: ref.mime_type,
        }));
      const attachments = [
        ...mediaRefAttachments,
        ...extractHistoryMediaRefs(contentWithMediaTags),
      ];
      const imageUrl = attachments.find((attachment) =>
        attachment.previewUrl?.trim(),
      )?.previewUrl;
      const content = cleanHistoryContent(contentWithMediaTags);
      if (!content && attachments.length === 0) return null;

      return {
        id: message.id ?? makeMessageId("msg-history", String(index)),
        conversationId,
        role,
        kind: imageUrl ? "image" : "text",
        content: content || "Can you review this look?",
        imageUrl,
        attachments: attachments.length > 0 ? attachments : undefined,
        status: "sent",
        createdAt: message.created_at || now(),
      };
    })
    .filter((message): message is ChatMessage => message !== null);
}

function getSseDataLines(rawEvent: string) {
  return rawEvent
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .filter(Boolean);
}

export async function collectGoClawEventStream(
  stream: ReadableStream<Uint8Array>,
  onAssistantDelta?: (delta: string) => void,
  signal?: AbortSignal,
): Promise<GoClawStreamResult> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let upstreamId: string | undefined;
  let aborted = false;

  const abortStream = () => {
    aborted = true;
    void reader.cancel().catch(() => undefined);
  };

  if (signal?.aborted) abortStream();
  signal?.addEventListener("abort", abortStream, { once: true });

  const handleEvent = (rawEvent: string) => {
    const dataLines = getSseDataLines(rawEvent);

    for (const data of dataLines) {
      if (data === "[DONE]") return true;

      let payload: GoClawChatCompletion;
      try {
        payload = JSON.parse(data) as GoClawChatCompletion;
      } catch {
        throw new Error("GoClaw stream included invalid JSON data.");
      }

      upstreamId ??= payload.id;
      const delta = extractGoClawStreamDelta(payload);
      if (!delta) continue;

      content += delta;
      onAssistantDelta?.(delta);
    }

    return false;
  };

  while (true) {
    if (aborted) {
      throw new DOMException("The chat stream was aborted.", "AbortError");
    }

    const { done, value } = await reader.read();

    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");

    let boundaryIndex = buffer.indexOf("\n\n");
    while (boundaryIndex !== -1) {
      const rawEvent = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);

      if (handleEvent(rawEvent)) {
        await reader.cancel().catch(() => undefined);
        return { content, upstreamId };
      }

      boundaryIndex = buffer.indexOf("\n\n");
    }
  }

  buffer += decoder.decode();
  buffer = buffer.replace(/\r\n/g, "\n");
  if (buffer.trim()) {
    handleEvent(buffer);
  }

  signal?.removeEventListener("abort", abortStream);
  return { content, upstreamId };
}

function makeChatResult(
  conversationId: string,
  input: SendMessageInput,
  assistantContent: string,
  upstreamId?: string,
): SendMessageResult {
  const createdAt = now();

  return {
    userMessage: {
      id: makeMessageId("msg-user"),
      conversationId,
      role: "user",
      kind: input.imageUrl ? "image" : "text",
      content: input.content || "Can you read this outfit?",
      imageUrl: input.imageUrl,
      attachments: input.attachments,
      status: "sent",
      createdAt,
    },
    assistantMessage: {
      id: makeMessageId("msg-go-claw", upstreamId),
      conversationId,
      role: "mochi",
      kind: "text",
      content: assistantContent,
      status: "sent",
      createdAt: now(),
    },
  };
}

export async function sendMessageThroughChatProxy(
  chatProxyPath: string,
  conversationId: string,
  input: SendMessageInput,
): Promise<SendMessageResult> {
  const response = await fetch(chatProxyPath, {
    method: "POST",
    signal: input.abortSignal,
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conversationId,
      message: {
        content: input.content,
        imageUrl: input.imageUrl,
        attachments: input.attachments,
        sessionId: input.sessionId,
        scenario: input.scenario,
        inputContext: input.inputContext,
      },
      history: input.history ?? [],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let message = errorText || `Chat proxy failed with ${response.status}`;
    try {
      const payload = JSON.parse(errorText) as { error?: unknown; detail?: unknown };
      message =
        (typeof payload.error === "string" && payload.error) ||
        (typeof payload.detail === "string" && payload.detail) ||
        message;
    } catch {
      // Keep the raw response text when the proxy does not return JSON.
    }
    throw new ChatProxyError(message, response.status);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    if (!response.body) {
      throw new Error("Chat proxy returned an event stream without a body.");
    }

    const result = await collectGoClawEventStream(
      response.body,
      input.onAssistantDelta,
      input.abortSignal,
    );

    return makeChatResult(
      conversationId,
      input,
      result.content,
      result.upstreamId,
    );
  }

  return response.json() as Promise<SendMessageResult>;
}

export async function fetchMessagesThroughChatProxy(
  messagesProxyPath: string,
  conversationId: string,
  sessionId: string,
): Promise<ChatMessage[]> {
  const url = new URL(
    messagesProxyPath,
    globalThis.location?.origin ?? "http://localhost",
  );
  url.searchParams.set("session_id", sessionId);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      errorText || `Messages proxy failed with ${response.status}`,
    );
  }

  return toLumiChatMessages(
    conversationId,
    (await response.json()) as GoClawSessionMessages,
  );
}
