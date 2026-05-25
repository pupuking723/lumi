import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_AGENT_TOKEN = "dev-token";
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
  const token = process.env.LUMI_AGENT_API_TOKEN ?? DEFAULT_AGENT_TOKEN;
  const userId = process.env.LUMI_AGENT_USER_ID ?? "user-a";
  const tenantId = process.env.LUMI_AGENT_TENANT_ID ?? "default";
  const tokenCookieName =
    process.env.LUMI_LIVE_TOKEN_COOKIE_NAME ?? "lumi_live_token";
  const userCookieName =
    process.env.LUMI_LIVE_USER_COOKIE_NAME ?? "lumi_live_user_id";
  const tenantCookieName =
    process.env.LUMI_LIVE_TENANT_COOKIE_NAME ?? "lumi_live_tenant_id";

  const response = NextResponse.json({ ok: true });
  const options = cookieOptions(request);

  response.cookies.set(tokenCookieName, token, options);
  response.cookies.set(userCookieName, userId, options);
  response.cookies.set(tenantCookieName, tenantId, options);

  return response;
}
