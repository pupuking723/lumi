import type {
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

interface GoClawStreamResult {
  content: string;
  upstreamId?: string;
}

const now = () => new Date().toISOString();

function makeMessageId(prefix: string, seed?: string) {
  const generated =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
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

export function extractGoClawAssistantText(payload: GoClawChatCompletion): string {
  const messageText = payload.choices?.[0]?.message?.content?.trim();
  if (messageText) return messageText;

  const deltaText = payload.choices
    ?.map((choice) => choice.delta?.content ?? "")
    .join("")
    .trim();

  if (deltaText) return deltaText;

  throw new Error("GoClaw chat response did not include assistant content.");
}

export function extractGoClawStreamDelta(payload: GoClawChatCompletion): string {
  return payload.choices
    ?.map((choice) => choice.delta?.content ?? "")
    .join("") ?? "";
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
    throw new Error(errorText || `Chat proxy failed with ${response.status}`);
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
