import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const authMocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

vi.mock("next-auth", () => authMocks);

describe("OOTD report share-card proxy route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("LUMI_AGENT_API_BASE_URL", "https://agent.test");
    vi.stubEnv("LUMI_AGENT_API_TOKEN", "token-test");
    vi.stubEnv("LUMI_AGENT_USER_ID", "user-test");
    vi.stubEnv("LUMI_AGENT_TENANT_ID", "tenant-test");
    authMocks.getServerSession.mockResolvedValue({
      goclawAccessToken: "goclaw-session-token",
      user: { id: "google:user-test" },
      goclawTenant: { slug: "tenant-session" },
    });
  });

  it("uses the GoClaw session token before the development gateway token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "share-1",
          shortUrl: "http://127.0.0.1:9600/s/closy/share-1",
          qrImageUrl:
            "https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=http%3A%2F%2F127.0.0.1%3A9600%2Fs%2Fclosy%2Fshare-1",
        }),
        {
        headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("https://lumi.test/api/closy/ootd/reports/report-1/share-card", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "report-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        id: "share-1",
        shortUrl: "https://lumi.test/s/closy/share-1",
        qrImageUrl: expect.stringContaining(
          encodeURIComponent("https://lumi.test/s/closy/share-1"),
        ),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.test/v1/closy/ootd/reports/report-1/share-card",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer goclaw-session-token",
          "X-GoClaw-User-Id": "google:user-test",
          "X-GoClaw-Tenant-Id": "tenant-session",
          "X-Forwarded-Host": "lumi.test",
          "X-Forwarded-Proto": "https",
        }),
      }),
    );
  });

  it("uses configured public origin when normalizing returned share links", async () => {
    vi.stubEnv("LUMI_PUBLIC_APP_ORIGIN", "https://public.example");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "share-1",
          shortUrl: "http://127.0.0.1:9600/s/closy/share-1",
          qrImageUrl:
            "https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=http%3A%2F%2F127.0.0.1%3A9600%2Fs%2Fclosy%2Fshare-1",
        }),
        {
          headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/closy/ootd/reports/report-1/share-card", {
        method: "POST",
        headers: {
          host: "internal.example",
          "x-forwarded-proto": "https",
        },
      }),
      { params: Promise.resolve({ id: "report-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        shortUrl: "https://public.example/s/closy/share-1",
        qrImageUrl: expect.stringContaining(
          encodeURIComponent("https://public.example/s/closy/share-1"),
        ),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.test/v1/closy/ootd/reports/report-1/share-card",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Forwarded-Host": "public.example",
          "X-Forwarded-Proto": "https",
        }),
      }),
    );
  });
});
