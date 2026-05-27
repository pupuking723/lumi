import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_SECRET;
const DEFAULT_AGENT_BASE_URL = "http://127.0.0.1:9600";

interface GoClawAuthUser {
  id: string;
  provider: string;
  provider_id: string;
  name?: string;
  email?: string;
  avatar?: string;
}

interface GoClawAuthTenant {
  id: string;
  slug: string;
  role: string;
}

interface GoClawLoginResponse {
  authenticated: boolean;
  token_type: string;
  access_token: string;
  expires_at?: string;
  expires_in?: number;
  user: GoClawAuthUser;
  tenant: GoClawAuthTenant;
}

export const isGoogleAuthConfigured = Boolean(
  googleClientId && googleClientSecret && process.env.NEXTAUTH_SECRET,
);

function getProviders() {
  if (!googleClientId || !googleClientSecret) return [];

  return [
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ];
}

function getGoClawBaseUrl() {
  return (
    process.env.LUMI_AGENT_API_BASE_URL?.replace(/\/$/, "") ??
    DEFAULT_AGENT_BASE_URL
  );
}

function getExpiresAt(payload: GoClawLoginResponse) {
  if (payload.expires_at) return payload.expires_at;
  if (typeof payload.expires_in === "number") {
    return new Date(Date.now() + payload.expires_in * 1000).toISOString();
  }
  return undefined;
}

async function exchangeGoogleTokenForGoClawSession(input: {
  idToken?: string;
  accessToken?: string;
}) {
  const body: Record<string, string> = {};
  if (input.idToken) {
    body.credential = input.idToken;
    body.id_token = input.idToken;
  }
  if (input.accessToken) body.access_token = input.accessToken;

  const response = await fetch(`${getGoClawBaseUrl()}/v1/auth/google/login`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`GoClaw Google login failed with ${response.status}`);
  }

  const payload = (await response.json()) as GoClawLoginResponse;
  if (!payload.authenticated || !payload.access_token) {
    throw new Error("GoClaw Google login did not return an access token");
  }

  return payload;
}

async function verifyGoClawSession(accessToken: string) {
  const response = await fetch(`${getGoClawBaseUrl()}/v1/auth/me`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.ok;
}

async function logoutGoClawSession(accessToken?: string) {
  if (!accessToken) return;

  await fetch(`${getGoClawBaseUrl()}/v1/auth/logout`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  }).catch(() => undefined);
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  providers: getProviders(),
  callbacks: {
    async jwt({ token, account }) {
      if (account?.provider === "google") {
        const idToken =
          typeof account.id_token === "string" ? account.id_token : undefined;
        const accessToken =
          typeof account.access_token === "string"
            ? account.access_token
            : undefined;

        try {
          const goclaw = await exchangeGoogleTokenForGoClawSession({
            idToken,
            accessToken,
          });
          token.goclawAccessToken = goclaw.access_token;
          token.goclawExpiresAt = getExpiresAt(goclaw);
          token.goclawUser = goclaw.user;
          token.goclawTenant = goclaw.tenant;
          token.goclawAuthError = undefined;
        } catch (error) {
          token.goclawAccessToken = undefined;
          token.goclawExpiresAt = undefined;
          token.goclawUser = undefined;
          token.goclawTenant = undefined;
          token.goclawAuthError =
            error instanceof Error ? error.message : "GoClaw login failed";
        }
      } else if (typeof token.goclawAccessToken === "string") {
        const isValid = await verifyGoClawSession(token.goclawAccessToken);
        if (!isValid) {
          token.goclawAccessToken = undefined;
          token.goclawExpiresAt = undefined;
          token.goclawUser = undefined;
          token.goclawTenant = undefined;
          token.goclawAuthError = "GoClaw session expired";
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id =
          token.goclawUser?.id ?? (typeof token.sub === "string" ? token.sub : undefined);
        session.user.image = token.goclawUser?.avatar ?? session.user.image;
      }
      session.goclawAccessToken = token.goclawAccessToken;
      session.goclawExpiresAt = token.goclawExpiresAt;
      session.goclawUser = token.goclawUser;
      session.goclawTenant = token.goclawTenant;
      session.goclawAuthError = token.goclawAuthError;

      return session;
    },
  },
  events: {
    async signOut({ token }) {
      await logoutGoClawSession(token?.goclawAccessToken);
    },
  },
};
