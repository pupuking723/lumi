import { NextResponse } from "next/server";
import { getGoClawBaseUrl } from "@/lib/api/go-claw-env";
import {
  publicUrl,
  resolvePublicRequestParts,
} from "@/lib/api/public-origin";

export const dynamic = "force-dynamic";

function getForwardedHeaders(request: Request) {
  const { host, proto } = resolvePublicRequestParts(request);
  return {
    host,
    proto,
  };
}

function wantsJSON(request: Request) {
  const accept = request.headers.get("accept")?.toLowerCase() ?? "";
  return accept.includes("application/json") || accept.includes("text/json");
}

function wantsSocialPreview(request: Request) {
  const userAgent = request.headers.get("user-agent")?.toLowerCase() ?? "";
  if (!userAgent) return false;
  return [
    "facebookexternalhit",
    "facebot",
    "twitterbot",
    "telegrambot",
    "whatsapp",
    "linkedinbot",
    "slackbot",
    "discordbot",
    "pinterest",
    "embedly",
    "quora link preview",
    "vkshare",
    "redditbot",
  ].some((bot) => userAgent.includes(bot));
}

function frontendShareUrl(request: Request, slug: string) {
  return publicUrl(request, `/s/closy/${slug}`);
}

function appRedirectUrl(request: Request, slug: string) {
  return publicUrl(
    request,
    "/",
    new URLSearchParams({
      from: "mochi_share",
      share: slug,
    }),
  );
}

async function fetchUpstreamShare(
  baseUrl: string,
  slug: string,
  forwarded: ReturnType<typeof getForwardedHeaders>,
  accept: string,
) {
  return fetch(`${baseUrl}/s/closy/${encodeURIComponent(slug)}`, {
    cache: "no-store",
    redirect: "manual",
    headers: {
      Accept: accept,
      "X-Forwarded-Host": forwarded.host,
      "X-Forwarded-Proto": forwarded.proto,
    },
  });
}

function textFrom(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function payloadRecord(value: unknown) {
  if (!value || typeof value !== "object") return {};
  const root = value as Record<string, unknown>;
  const payload = root.payload;
  if (payload && typeof payload === "object") {
    return payload as Record<string, unknown>;
  }
  return root;
}

function shareTitle(payload: Record<string, unknown>) {
  return (
    textFrom(payload.overall_judgement) ||
    textFrom(payload.style_label) ||
    "Mochi OOTD"
  );
}

function shareDescription(payload: Record<string, unknown>) {
  return (
    textFrom(payload.mochi_line) ||
    textFrom(payload.highlight) ||
    textFrom(payload.suggestion) ||
    textFrom(payload.main_issue) ||
    "See this Mochi OOTD report."
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function socialImageUrl(request: Request, title: string, description: string) {
  const url = new URL(publicUrl(request, "/api/closy/ootd/share-preview"));
  url.searchParams.set("title", title);
  url.searchParams.set("description", description);
  return url.toString();
}

function socialHtml({
  request,
  slug,
  payload,
}: {
  request: Request;
  slug: string;
  payload: Record<string, unknown>;
}) {
  const title = shareTitle(payload);
  const description = shareDescription(payload);
  const shareUrl = frontendShareUrl(request, slug);
  const redirectUrl = appRedirectUrl(request, slug);
  const imageUrl = socialImageUrl(request, title, description);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(shareUrl)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl)}" />
</head>
<body>
  <a href="${escapeHtml(redirectUrl)}">${escapeHtml(description)}</a>
</body>
</html>`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const baseUrl = getGoClawBaseUrl();
  const forwarded = getForwardedHeaders(request);

  let upstreamResponse: Response | null = null;
  try {
    upstreamResponse = await fetchUpstreamShare(
      baseUrl,
      slug,
      forwarded,
      "application/json",
    );
  } catch {
    upstreamResponse = null;
  }

  if (wantsJSON(request)) {
    if (!upstreamResponse) {
      return NextResponse.json(
        { error: "share card not found" },
        { status: 404 },
      );
    }
    const text = await upstreamResponse.text();
    return new Response(text, {
      status: upstreamResponse.status,
      headers: {
        "content-type":
          upstreamResponse.headers.get("content-type") ?? "application/json",
      },
    });
  }

  if (upstreamResponse?.ok) {
    if (!wantsSocialPreview(request)) {
      return NextResponse.redirect(appRedirectUrl(request, slug));
    }
    const payload = payloadRecord(await upstreamResponse.json().catch(() => null));
    return new Response(socialHtml({ request, slug, payload }), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  try {
    upstreamResponse = await fetchUpstreamShare(baseUrl, slug, forwarded, "text/html");
  } catch {
    upstreamResponse = null;
  }

  if (upstreamResponse && upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
    return NextResponse.redirect(appRedirectUrl(request, slug), upstreamResponse.status);
  }

  return NextResponse.redirect(appRedirectUrl(request, slug));
}
