import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const authMocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

vi.mock("next-auth", () => authMocks);

describe("live session route", () => {
  beforeEach(() => {
    authMocks.getServerSession.mockResolvedValue({
      goclawAccessToken: "goclaw-session-token",
      user: { id: "google:user-test" },
    });
  });

  it("sets HttpOnly live cookies for browser websocket upgrades", async () => {
    const response = await POST(
      new Request("https://lumi.test/api/live/session", {
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({ ok: true });
    const setCookie = response.headers.getSetCookie();

    expect(setCookie).toEqual(
      expect.arrayContaining([
        expect.stringContaining("lumi_live_token=goclaw-session-token"),
      ]),
    );
    expect(setCookie.join("\n")).toContain("HttpOnly");
    expect(setCookie.join("\n")).toContain("SameSite=lax");
    expect(setCookie.join("\n")).toContain("Secure");
  });

  it("supports backend-specific cookie names", async () => {
    vi.stubEnv("LUMI_LIVE_TOKEN_COOKIE_NAME", "goclaw_token");

    const response = await POST(
      new Request("http://lumi.test/api/live/session", {
        method: "POST",
      }),
    );

    const setCookie = response.headers.getSetCookie().join("\n");
    expect(setCookie).toContain("goclaw_token=goclaw-session-token");
    expect(setCookie).not.toContain("Secure");
  });

  it("returns 401 without a GoClaw session token", async () => {
    authMocks.getServerSession.mockResolvedValue(null);

    const response = await POST(
      new Request("https://lumi.test/api/live/session", {
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Google sign-in is required.",
    });
    expect(response.status).toBe(401);
  });
});
