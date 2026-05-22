import { NextResponse } from "next/server";
import {
  extractGoClawAssistantText,
  toGoClawMessages,
  type GoClawChatCompletion,
} from "@/lib/api/go-claw-chat";
import type {
  ChatMessage,
  SendMessageInput,
  SendMessageResult,
} from "@/types/lumi";

export const dynamic = "force-dynamic";

const DEFAULT_AGENT_BASE_URL = "http://192.168.7.231:9600";
const DEFAULT_AGENT_MODEL = "agent:fox-spirit";

interface ChatProxyBody {
  conversationId?: string;
  message?: SendMessageInput;
  history?: ChatMessage[];
}

const now = () => new Date().toISOString();

function makeMessageId(prefix: string, seed?: string) {
  const generated =
    globalThis.crypto?.randomUUID() ?? Math.random().toString(36).slice(2, 10);
  return `${prefix}-${seed ?? generated}`;
}

export async function POST(request: Request) {
  const body = (await request.json()) as ChatProxyBody;
  const conversationId = body.conversationId ?? "conv-mochi-1";
  const message = body.message;

  if (!message?.content?.trim() && !message?.imageUrl) {
    return NextResponse.json(
      { error: "Message content or imageUrl is required." },
      { status: 400 },
    );
  }

  const baseUrl =
    process.env.LUMI_AGENT_API_BASE_URL?.replace(/\/$/, "") ??
    DEFAULT_AGENT_BASE_URL;
  const model = process.env.LUMI_AGENT_MODEL ?? DEFAULT_AGENT_MODEL;
  const token = process.env.LUMI_AGENT_API_TOKEN ?? "dev-token";
  const userId = process.env.LUMI_AGENT_USER_ID ?? "user-a";
  const tenantId = process.env.LUMI_AGENT_TENANT_ID ?? "default";
  const acceptLanguage = process.env.LUMI_AGENT_ACCEPT_LANGUAGE ?? "zh";

  const upstreamResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "X-GoClaw-User-Id": userId,
      "X-GoClaw-Tenant-Id": tenantId,
      "Accept-Language": acceptLanguage,
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      messages: toGoClawMessages(body.history, message),
      stream: false,
    }),
  });

  const upstreamText = await upstreamResponse.text();

  if (!upstreamResponse.ok) {
    return NextResponse.json(
      {
        error: "GoClaw chat request failed.",
        status: upstreamResponse.status,
        detail: upstreamText,
      },
      { status: upstreamResponse.status },
    );
  }

  let payload: GoClawChatCompletion;
  try {
    payload = JSON.parse(upstreamText) as GoClawChatCompletion;
  } catch {
    return NextResponse.json(
      {
        error: "GoClaw chat response was not valid JSON.",
        detail: upstreamText,
      },
      { status: 502 },
    );
  }

  const createdAt = now();
  const assistantContent = extractGoClawAssistantText(payload);
  const result: SendMessageResult = {
    userMessage: {
      id: makeMessageId("msg-user"),
      conversationId,
      role: "user",
      kind: message.imageUrl ? "image" : "text",
      content: message.content || "Can you read this outfit?",
      imageUrl: message.imageUrl,
      status: "sent",
      createdAt,
    },
    assistantMessage: {
      id: makeMessageId("msg-go-claw", payload.id),
      conversationId,
      role: "mochi",
      kind: "text",
      content: assistantContent,
      status: "sent",
      createdAt: now(),
    },
  };

  return NextResponse.json(result);
}
