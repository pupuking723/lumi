import type { AnalyzeVisionInput, CreateLookInput, LumiApiClient } from "./client";

async function request<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Lumi API ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function createHttpClient(baseUrl: string): LumiApiClient {
  const root = baseUrl.replace(/\/$/, "");

  return {
    getMe: () => request(root, "/me"),
    updateStyleProfile: (input) =>
      request(root, "/me/style-profile", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    listConversations: () => request(root, "/agents/mochi/conversations"),
    createConversation: () =>
      request(root, "/agents/mochi/conversations", {
        method: "POST",
        body: JSON.stringify({ agentId: "mochi" }),
      }),
    listMessages: (conversationId) =>
      request(root, `/conversations/${conversationId}/messages`),
    sendMessage: (conversationId, input) =>
      request(root, `/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    createLiveSession: () =>
      request(root, "/live/sessions", {
        method: "POST",
        body: JSON.stringify({ agentId: "mochi" }),
      }),
    analyzeVision: (input: AnalyzeVisionInput) =>
      request(root, "/vision/analyses", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    listLooks: () => request(root, "/looks"),
    createLook: (input: CreateLookInput) =>
      request(root, "/looks", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    createShareLink: (lookId) =>
      request(root, `/looks/${lookId}/share-link`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
  };
}
