import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import {
  getGoClawBaseUrl,
  resolveGoClawProxyAuth,
} from "@/lib/api/go-claw-env";

export const dynamic = "force-dynamic";

const DEFAULT_AGENT_MODEL = "agent:closy";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

async function proxyChatSessions(
  method: "GET" | "POST" | "DELETE",
  request: Request,
) {
  const session = await getServerSession(authOptions);
  const auth = resolveGoClawProxyAuth(session);

  if (!auth) {
    return NextResponse.json(
      { error: "Google sign-in is required." },
      { status: 401 },
    );
  }

  const baseUrl = getGoClawBaseUrl();
  const model = process.env.LUMI_AGENT_MODEL ?? DEFAULT_AGENT_MODEL;
  const acceptLanguage = process.env.LUMI_AGENT_ACCEPT_LANGUAGE ?? "zh";
  const upstreamUrl = new URL(`${baseUrl}/v1/chat/sessions`);
  upstreamUrl.searchParams.set("model", model);
  if (method === "DELETE") {
    const requestUrl = new URL(request.url);
    const sessionId = requestUrl.searchParams.get("session_id")?.trim();
    if (!sessionId) {
      return NextResponse.json(
        { error: "session_id is required." },
        { status: 400 },
      );
    }
    upstreamUrl.searchParams.set("session_id", sessionId);
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method,
      cache: "no-store",
      headers: {
        "Accept-Language": acceptLanguage,
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-GoClaw-User-Id": auth.userId,
        "X-GoClaw-Tenant-Id": auth.tenantId,
        Authorization: `Bearer ${auth.token}`,
      },
      body: method === "POST" ? await request.text() : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "GoClaw sessions request could not reach the upstream service.",
        detail: getErrorMessage(error),
      },
      { status: 502 },
    );
  }

  const payload = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return NextResponse.json(
      {
        error: "GoClaw sessions request failed.",
        status: upstreamResponse.status,
        detail: payload,
      },
      { status: upstreamResponse.status },
    );
  }

  if (upstreamResponse.status === 204) {
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(payload, {
    status: upstreamResponse.status,
    headers: {
      "Content-Type":
        upstreamResponse.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export function GET(request: Request) {
  return proxyChatSessions("GET", request);
}

export function POST(request: Request) {
  return proxyChatSessions("POST", request);
}

export function DELETE(request: Request) {
  return proxyChatSessions("DELETE", request);
}
