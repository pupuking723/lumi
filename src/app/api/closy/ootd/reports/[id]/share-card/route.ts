import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import {
  getGoClawBaseUrl,
  resolveGoClawProxyAuth,
} from "@/lib/api/go-claw-env";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function frontendOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host") ?? requestUrl.host;
  return `${requestUrl.protocol}//${host}`;
}

function normalizeShareCardLinks(value: unknown, origin: string) {
  if (!value || typeof value !== "object") return value;
  const shareCard = value as Record<string, unknown>;
  if (typeof shareCard.shortUrl !== "string") return shareCard;

  let shortUrl: URL;
  try {
    shortUrl = new URL(shareCard.shortUrl);
  } catch {
    return shareCard;
  }
  if (shortUrl.pathname.startsWith("/s/closy/")) {
    const publicShortUrl = `${origin}${shortUrl.pathname}`;
    shareCard.shortUrl = publicShortUrl;
    shareCard.qrImageUrl = qrImageUrl(publicShortUrl);
  }
  return shareCard;
}

function qrImageUrl(value: string) {
  const params = new URLSearchParams({ size: "160x160", data: value });
  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const baseUrl = getGoClawBaseUrl();
  const session = await getServerSession(authOptions);
  const auth = resolveGoClawProxyAuth(session);
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("host") ?? requestUrl.host;
  const forwardedProto = requestUrl.protocol.replace(":", "") || "http";

  if (!auth) {
    return NextResponse.json(
      { error: "Google sign-in is required." },
      { status: 401 },
    );
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(
      `${baseUrl}/v1/closy/ootd/reports/${encodeURIComponent(id)}/share-card`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "X-GoClaw-User-Id": auth.userId,
          "X-GoClaw-Tenant-Id": auth.tenantId,
          "X-Forwarded-Host": forwardedHost,
          "X-Forwarded-Proto": forwardedProto,
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({}),
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Mochi could not create the share card.",
        detail: getErrorMessage(error),
      },
      { status: 502 },
    );
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return NextResponse.json(
      {
        error: "Mochi could not create the share card.",
        status: upstreamResponse.status,
        detail: text,
      },
      { status: upstreamResponse.status },
    );
  }

  const payload = text.trim() ? JSON.parse(text) : {};
  return NextResponse.json(
    normalizeShareCardLinks(payload, frontendOrigin(request)),
  );
}
