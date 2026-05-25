import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_AGENT_BASE_URL = "http://192.168.6.203:9600";
const DEFAULT_AGENT_TOKEN = "dev-token";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required." }, { status: 400 });
  }

  const baseUrl =
    process.env.LUMI_AGENT_API_BASE_URL?.replace(/\/$/, "") ??
    DEFAULT_AGENT_BASE_URL;
  const token = process.env.LUMI_AGENT_API_TOKEN ?? DEFAULT_AGENT_TOKEN;
  const userId = process.env.LUMI_AGENT_USER_ID ?? "user-a";
  const tenantId = process.env.LUMI_AGENT_TENANT_ID ?? "default";

  const upstreamBody = new FormData();
  upstreamBody.append("file", file, file.name);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(`${baseUrl}/v1/chat/attachments/upload`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "X-GoClaw-User-Id": userId,
        "X-GoClaw-Tenant-Id": tenantId,
        Authorization: `Bearer ${token}`,
      },
      body: upstreamBody,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Mochi could not upload that image yet.",
        detail: getErrorMessage(error),
      },
      { status: 502 },
    );
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return NextResponse.json(
      {
        error: "Mochi could not upload that image yet.",
        status: upstreamResponse.status,
        detail: text,
      },
      { status: upstreamResponse.status },
    );
  }

  let payload: Record<string, unknown> = {};
  if (text.trim()) {
    payload = JSON.parse(text) as Record<string, unknown>;
  }

  const mediaId = payload.media_id ?? payload.mediaId ?? payload.id;
  if (typeof mediaId !== "string" || !mediaId) {
    return NextResponse.json(
      {
        error: "Upload response did not include media_id.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ...payload,
    media_id: mediaId,
    fileName: payload.fileName ?? file.name,
    mimeType: payload.mimeType ?? file.type,
  });
}
