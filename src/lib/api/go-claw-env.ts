const DEFAULT_AGENT_BASE_URL = "http://127.0.0.1:9600";
const DEFAULT_AGENT_TOKEN = "dev-token";

export function getGoClawBaseUrl() {
  return (
    process.env.LUMI_AGENT_API_BASE_URL ??
    process.env.GOCLAW_API_BASE_URL ??
    DEFAULT_AGENT_BASE_URL
  ).replace(/\/$/, "");
}

export function getGoClawToken() {
  return (
    process.env.LUMI_AGENT_API_TOKEN ??
    process.env.GOCLAW_GATEWAY_TOKEN ??
    DEFAULT_AGENT_TOKEN
  );
}

export function getGoClawUserId() {
  return process.env.LUMI_AGENT_USER_ID ?? process.env.GOCLAW_USER_ID ?? "user-a";
}

export function getGoClawTenantId() {
  return process.env.LUMI_AGENT_TENANT_ID ?? "default";
}

interface GoClawProxySession {
  goclawAccessToken?: string;
  goclawUser?: {
    id?: string;
  };
  goclawTenant?: {
    id?: string;
    slug?: string;
  };
  user?: {
    id?: string;
  };
}

export function isGoClawAuthRequired() {
  return process.env.LUMI_AUTH_REQUIRED !== "false";
}

export function resolveGoClawProxyAuth(session?: GoClawProxySession | null) {
  if (session?.goclawAccessToken) {
    return {
      token: session.goclawAccessToken,
      userId: session.goclawUser?.id ?? session.user?.id ?? getGoClawUserId(),
      tenantId:
        session.goclawTenant?.slug ??
        session.goclawTenant?.id ??
        getGoClawTenantId(),
    };
  }

  if (isGoClawAuthRequired()) {
    return null;
  }

  return {
    token: getGoClawToken(),
    userId: getGoClawUserId(),
    tenantId: getGoClawTenantId(),
  };
}
