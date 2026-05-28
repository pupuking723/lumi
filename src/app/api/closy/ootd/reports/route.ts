import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import {
  getGoClawBaseUrl,
  resolveGoClawProxyAuth,
} from "@/lib/api/go-claw-env";
import { resolveProxyAcceptLanguage } from "@/lib/api/language";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const baseUrl = getGoClawBaseUrl();
  const session = await getServerSession(authOptions);
  const auth = resolveGoClawProxyAuth(session);
  const acceptLanguage = resolveProxyAcceptLanguage(
    typeof body.note === "string" ? body.note : "",
    request.headers.get("accept-language"),
  );

  if (!auth) {
    return NextResponse.json(
      { error: "Google sign-in is required." },
      { status: 401 },
    );
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(`${baseUrl}/v1/closy/ootd/reports`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "X-GoClaw-User-Id": auth.userId,
        "X-GoClaw-Tenant-Id": auth.tenantId,
        "Accept-Language": acceptLanguage,
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({
        ...body,
        user_id: typeof body.user_id === "string" ? body.user_id : auth.userId,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Mochi could not create the OOTD report.",
        detail: getErrorMessage(error),
      },
      { status: 502 },
    );
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return NextResponse.json(
      {
        error: "Mochi could not create the OOTD report.",
        status: upstreamResponse.status,
        detail: text,
      },
      { status: upstreamResponse.status },
    );
  }

  return NextResponse.json(text.trim() ? JSON.parse(text) : {});
}
