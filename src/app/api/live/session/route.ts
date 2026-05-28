import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { resolveGoClawProxyAuth } from "@/lib/api/go-claw-env";

export const dynamic = "force-dynamic";

const LIVE_COOKIE_MAX_AGE_SECONDS = 15 * 60;

function cookieOptions(request: Request) {
  return {
    httpOnly: true,
    maxAge: LIVE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: new URL(request.url).protocol === "https:",
  };
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const auth = resolveGoClawProxyAuth(session);

  if (!auth) {
    return NextResponse.json(
      { error: "Google sign-in is required." },
      { status: 401 },
    );
  }

  const tokenCookieName =
    process.env.LUMI_LIVE_TOKEN_COOKIE_NAME ?? "lumi_live_token";
  const userCookieName =
    process.env.LUMI_LIVE_USER_COOKIE_NAME ?? "lumi_live_user_id";
  const tenantCookieName =
    process.env.LUMI_LIVE_TENANT_COOKIE_NAME ?? "lumi_live_tenant_id";

  const response = NextResponse.json({ ok: true });
  const options = cookieOptions(request);

  response.cookies.set(tokenCookieName, auth.token, options);
  response.cookies.set(userCookieName, auth.userId, options);
  response.cookies.set(tenantCookieName, auth.tenantId, options);

  return response;
}
