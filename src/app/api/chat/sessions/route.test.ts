import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";

const authMocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

vi.mock("next-auth", () => authMocks);

describe("chat sessions route", () => {
  beforeEach(() => {
    vi.stubEnv("LUMI_AGENT_API_BASE_URL", "https://agent.test");
    vi.stubEnv("LUMI_AGENT_ACCEPT_LANGUAGE", "en");
    vi.stubEnv("LUMI_AGENT_MODEL", "agent:closy");
    authMocks.getServerSession.mockResolvedValue({
      goclawAccessToken: "goclaw-session-token",
      goclawUser: { id: "google:user-1" },
      goclawTenant: { slug: "tenant-a" },
    });
  });

  it("forwards delete requests and preserves 204 without a response body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await DELETE(
      new Request("https://lumi.test/api/chat/sessions?session_id=mochi-1"),
    );

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe("");
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        "https://agent.test/v1/chat/sessions?model=agent%3Aclosy&session_id=mochi-1",
      ),
      expect.objectContaining({
        method: "DELETE",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: "Bearer goclaw-session-token",
          "X-GoClaw-User-Id": "google:user-1",
          "X-GoClaw-Tenant-Id": "tenant-a",
        }),
      }),
    );
  });

  it("returns 400 without a session id", async () => {
    const response = await DELETE(
      new Request("https://lumi.test/api/chat/sessions"),
    );

    await expect(response.json()).resolves.toEqual({
      error: "session_id is required.",
    });
    expect(response.status).toBe(400);
  });
});
