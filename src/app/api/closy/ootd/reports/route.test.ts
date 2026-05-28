import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const authMocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

vi.mock("next-auth", () => authMocks);

describe("OOTD reports proxy route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LUMI_AGENT_API_BASE_URL", "https://agent.test");
    vi.stubEnv("LUMI_AGENT_API_TOKEN", "token-test");
    vi.stubEnv("LUMI_AGENT_USER_ID", "user-test");
    vi.stubEnv("LUMI_AGENT_TENANT_ID", "tenant-test");
    vi.stubEnv("LUMI_AGENT_ACCEPT_LANGUAGE", "zh");
    authMocks.getServerSession.mockResolvedValue({
      goclawAccessToken: "goclaw-session-token",
      user: { id: "google:user-test" },
      goclawTenant: { slug: "tenant-session" },
    });
  });

  it("uses the GoClaw session token before the development gateway token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "report-1" }), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("https://lumi.test/api/closy/ootd/reports", {
        method: "POST",
        body: JSON.stringify({
          media_id: "media-1",
          note: "Can you review this look?",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.test/v1/closy/ootd/reports",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer goclaw-session-token",
          "X-GoClaw-User-Id": "google:user-test",
          "X-GoClaw-Tenant-Id": "tenant-session",
        }),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual(
      expect.objectContaining({
        media_id: "media-1",
        user_id: "google:user-test",
      }),
    );
  });

  it("uses the report note language ahead of the environment fallback", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "report-1" }), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("https://lumi.test/api/closy/ootd/reports", {
        method: "POST",
        headers: { "accept-language": "zh-CN,zh;q=0.9" },
        body: JSON.stringify({
          media_id: "media-1",
          note: "Can you review this look?",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.test/v1/closy/ootd/reports",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Accept-Language": "en",
        }),
      }),
    );
  });
});
