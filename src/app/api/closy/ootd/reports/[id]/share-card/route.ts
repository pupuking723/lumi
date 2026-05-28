import { NextResponse } from "next/server";
import {
  getGoClawBaseUrl,
  getGoClawTenantId,
  getGoClawToken,
  getGoClawUserId,
} from "@/lib/api/go-claw-env";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const baseUrl = getGoClawBaseUrl();
  const token = getGoClawToken();
  const userId = getGoClawUserId();
  const tenantId = getGoClawTenantId();

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(
      `${baseUrl}/v1/closy/ootd/reports/${encodeURIComponent(id)}/share-card`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "X-GoClaw-User-Id": userId,
          "X-GoClaw-Tenant-Id": tenantId,
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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

  return NextResponse.json(text.trim() ? JSON.parse(text) : {});
}
