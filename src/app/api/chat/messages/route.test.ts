import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const authMocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

vi.mock("next-auth", () => authMocks);

describe("chat messages route", () => {
  beforeEach(() => {
    vi.stubEnv("LUMI_AGENT_API_BASE_URL", "https://agent.test");
    vi.stubEnv("LUMI_AGENT_ACCEPT_LANGUAGE", "en");
    vi.stubEnv("LUMI_AGENT_MODEL", "agent:closy");
    authMocks.getServerSession.mockResolvedValue({
      goclawAccessToken: "goclaw-session-token",
    });
  });

  it("forwards session history requests with auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        session_id: "agent:closy:cchat:direct:user-mochi-1",
        messages: [{ id: "m1", role: "assistant", content: "Hi" }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("https://lumi.test/api/chat/messages?session_id=mochi-1"),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        "https://agent.test/v1/chat/messages?session_id=mochi-1&model=agent%3Aclosy",
      ),
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: "Bearer goclaw-session-token",
          "Accept-Language": "en",
          Accept: "application/json",
        }),
      }),
    );
    await expect(response.json()).resolves.toEqual({
      session_id: "agent:closy:cchat:direct:user-mochi-1",
      messages: [{ id: "m1", role: "assistant", content: "Hi" }],
    });
  });

  it("returns 401 without a GoClaw session token", async () => {
    authMocks.getServerSession.mockResolvedValue(null);

    const response = await GET(
      new Request("https://lumi.test/api/chat/messages?session_id=mochi-1"),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Google sign-in is required.",
    });
    expect(response.status).toBe(401);
  });

  it("returns 400 without a session id", async () => {
    const response = await GET(
      new Request("https://lumi.test/api/chat/messages"),
    );

    await expect(response.json()).resolves.toEqual({
      error: "session_id is required.",
    });
    expect(response.status).toBe(400);
  });
});
