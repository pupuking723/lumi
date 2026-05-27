import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export const dynamic = "force-dynamic";

const DEFAULT_AGENT_BASE_URL = "http://127.0.0.1:9600";
const DEFAULT_AGENT_MODEL = "agent:closy";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id")?.trim();

  if (!sessionId) {
    return NextResponse.json(
      { error: "session_id is required." },
      { status: 400 },
    );
  }

  const session = await getServerSession(authOptions);
  const token = session?.goclawAccessToken;

  if (!token) {
    return NextResponse.json(
      { error: "Google sign-in is required." },
      { status: 401 },
    );
  }

  const baseUrl =
    process.env.LUMI_AGENT_API_BASE_URL?.replace(/\/$/, "") ??
    DEFAULT_AGENT_BASE_URL;
  const model = process.env.LUMI_AGENT_MODEL ?? DEFAULT_AGENT_MODEL;
  const acceptLanguage = process.env.LUMI_AGENT_ACCEPT_LANGUAGE ?? "zh";
  const upstreamUrl = new URL(`${baseUrl}/v1/chat/messages`);
  upstreamUrl.searchParams.set("session_id", sessionId);
  upstreamUrl.searchParams.set("model", model);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Accept-Language": acceptLanguage,
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "GoClaw messages request could not reach the upstream service.",
        detail: getErrorMessage(error),
      },
      { status: 502 },
    );
  }

  if (!upstreamResponse.ok) {
    const upstreamText = await upstreamResponse.text();
    return NextResponse.json(
      {
        error: "GoClaw messages request failed.",
        status: upstreamResponse.status,
        detail: upstreamText,
      },
      { status: upstreamResponse.status },
    );
  }

  return NextResponse.json(await upstreamResponse.json());
}
