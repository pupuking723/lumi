import type {
  AnalyzeVisionInput,
  CreateLookInput,
  LumiApiClient,
  SubmitOotdReviewInput,
} from "./client";

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
    async uploadAttachment(file) {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${root}/v1/chat/attachments/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Lumi upload ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    sendMessage: (conversationId, input) =>
      request(root, `/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    analyzeVision: (input: AnalyzeVisionInput) =>
      request(root, "/vision/analyses", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    submitOotdReview: (input: SubmitOotdReviewInput) =>
      request(root, "/v1/closy/ootd/reviews", {
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
