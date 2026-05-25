import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("chat completions route", () => {
  beforeEach(() => {
    vi.stubEnv("LUMI_AGENT_API_BASE_URL", "https://agent.test");
    vi.stubEnv("LUMI_AGENT_API_TOKEN", "test-token");
    vi.stubEnv("LUMI_AGENT_USER_ID", "user-test");
    vi.stubEnv("LUMI_AGENT_TENANT_ID", "tenant-test");
    vi.stubEnv("LUMI_AGENT_ACCEPT_LANGUAGE", "en");
    vi.stubEnv("LUMI_AGENT_MODEL", "agent:closy");
  });

  it("forwards stream chat requests with session, scenario, context, and attachments", async () => {
    const upstream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(upstream, {
        headers: { "content-type": "text/event-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("https://lumi.test/api/chat/completions", {
        method: "POST",
        body: JSON.stringify({
          conversationId: "conv-1",
          history: [
            {
              id: "old",
              conversationId: "conv-1",
              role: "mochi",
              kind: "text",
              content: "Old advice",
              status: "sent",
              createdAt: "2026-05-25T00:00:00.000Z",
            },
          ],
          message: {
            content: "Review this",
            sessionId: "session-1",
            scenario: "image_review",
            inputContext: {
              source: "chat",
              mode: "multimodal",
              refers_to_media_id: "media-1",
            },
            attachments: [
              {
                media_id: "media-1",
                caption: "Mirror",
                source: "chat",
                role: "user",
              },
            ],
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          "X-GoClaw-User-Id": "user-test",
          "X-GoClaw-Tenant-Id": "tenant-test",
          "Accept-Language": "en",
          Accept: "text/event-stream",
        }),
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual(
      expect.objectContaining({
        model: "agent:closy",
        stream: true,
        session_id: "session-1",
        scenario: "image_review",
        input_context: {
          source: "chat",
          mode: "multimodal",
          refers_to_media_id: "media-1",
        },
        attachments: [
          {
            media_id: "media-1",
            caption: "Mirror",
            source: "chat",
            role: "user",
          },
        ],
      }),
    );
    expect(body.messages).toEqual([
      { role: "assistant", content: "Old advice" },
      { role: "user", content: "Review this" },
    ]);
  });

  it("returns 400 when content and image are missing", async () => {
    const response = await POST(
      new Request("https://lumi.test/api/chat/completions", {
        method: "POST",
        body: JSON.stringify({ message: { content: "" } }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Message content or imageUrl is required.",
    });
    expect(response.status).toBe(400);
  });

  it("returns a 502 when the upstream service cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const response = await POST(
      new Request("https://lumi.test/api/chat/completions", {
        method: "POST",
        body: JSON.stringify({ message: { content: "Hi" } }),
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(502);
    expect(payload.error).toBe(
      "GoClaw chat request could not reach the upstream service.",
    );
    expect(payload.detail).toBe("offline");
  });
});
