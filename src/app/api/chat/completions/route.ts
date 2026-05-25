import { NextResponse } from "next/server";
import { toGoClawMessages } from "@/lib/api/go-claw-chat";
import type { ChatMessage, SendMessageInput } from "@/types/lumi";

export const dynamic = "force-dynamic";

const DEFAULT_AGENT_BASE_URL = "http://192.168.6.203:9600";
const DEFAULT_AGENT_MODEL = "agent:closy";
const DEFAULT_AGENT_TOKEN = "dev-token";

interface ChatProxyBody {
  conversationId?: string;
  message?: SendMessageInput;
  history?: ChatMessage[];
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(request: Request) {
  const body = (await request.json()) as ChatProxyBody;
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
  const token = process.env.LUMI_AGENT_API_TOKEN ?? DEFAULT_AGENT_TOKEN;
  const userId = process.env.LUMI_AGENT_USER_ID ?? "user-a";
  const tenantId = process.env.LUMI_AGENT_TENANT_ID ?? "default";
  const acceptLanguage = process.env.LUMI_AGENT_ACCEPT_LANGUAGE ?? "zh";

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "X-GoClaw-User-Id": userId,
        "X-GoClaw-Tenant-Id": tenantId,
        "Accept-Language": acceptLanguage,
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model,
        messages: toGoClawMessages(body.history, message),
        stream: true,
        session_id: message.sessionId ?? body.conversationId,
        scenario: message.scenario ?? (message.attachments?.length ? "image_review" : "text_chat"),
        input_context:
          message.inputContext ??
          (message.attachments?.[0]?.media_id
            ? {
                source: "chat",
                mode: "multimodal",
                refers_to_media_id: message.attachments[0].media_id,
              }
            : { source: "chat", mode: "text" }),
        attachments: message.attachments?.map((attachment) => ({
          media_id: attachment.media_id,
          caption: attachment.caption,
          source: attachment.source,
          role: attachment.role,
        })),
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "GoClaw chat request could not reach the upstream service.",
        detail: getErrorMessage(error),
      },
      { status: 502 },
    );
  }

  if (!upstreamResponse.ok) {
    const upstreamText = await upstreamResponse.text();
    return NextResponse.json(
      {
        error: "GoClaw chat request failed.",
        status: upstreamResponse.status,
        detail: upstreamText,
      },
      { status: upstreamResponse.status },
    );
  }

  if (!upstreamResponse.body) {
    return NextResponse.json(
      {
        error: "GoClaw chat response did not include a stream body.",
      },
      { status: 502 },
    );
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: {
      "Content-Type":
        upstreamResponse.headers.get("content-type") ??
        "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
