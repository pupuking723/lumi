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

export async function sendMessageThroughChatProxy(
  chatProxyPath: string,
  conversationId: string,
  input: SendMessageInput,
): Promise<SendMessageResult> {
  const response = await fetch(chatProxyPath, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conversationId,
      message: input,
      history: input.history ?? [],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Chat proxy failed with ${response.status}`);
  }

  return response.json() as Promise<SendMessageResult>;
}
