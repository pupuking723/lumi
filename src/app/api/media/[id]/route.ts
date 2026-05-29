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

function passthroughHeaders(upstreamHeaders: Headers) {
  const headers = new Headers();
  const contentType = upstreamHeaders.get("content-type");
  const contentLength = upstreamHeaders.get("content-length");
  const cacheControl = upstreamHeaders.get("cache-control");
  const etag = upstreamHeaders.get("etag");

  if (contentType) headers.set("content-type", contentType);
  if (contentLength) headers.set("content-length", contentLength);
  if (cacheControl) headers.set("cache-control", cacheControl);
  if (etag) headers.set("etag", etag);
  return headers;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const baseUrl = getGoClawBaseUrl();
  const session = await getServerSession(authOptions);
  const auth = resolveGoClawProxyAuth(session);

  if (!auth) {
    return NextResponse.json(
      { error: "Google sign-in is required." },
      { status: 401 },
    );
  }

  const requestUrl = new URL(request.url);
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(
      `${baseUrl}/v1/media/${encodeURIComponent(id)}${requestUrl.search}`,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          "X-GoClaw-User-Id": auth.userId,
          "X-GoClaw-Tenant-Id": auth.tenantId,
          Accept: request.headers.get("accept") ?? "image/*,*/*",
          Authorization: `Bearer ${auth.token}`,
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Mochi could not load that image.",
        detail: getErrorMessage(error),
      },
      { status: 502 },
    );
  }

  if (!upstreamResponse.ok) {
    return new Response(await upstreamResponse.text(), {
      status: upstreamResponse.status,
      headers: passthroughHeaders(upstreamResponse.headers),
    });
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: passthroughHeaders(upstreamResponse.headers),
  });
}
