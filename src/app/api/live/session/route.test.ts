import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("live session route", () => {
  beforeEach(() => {
    vi.stubEnv("LUMI_AGENT_API_TOKEN", "test-token");
    vi.stubEnv("LUMI_AGENT_USER_ID", "user-test");
    vi.stubEnv("LUMI_AGENT_TENANT_ID", "tenant-test");
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
        expect.stringContaining("lumi_live_token=test-token"),
        expect.stringContaining("lumi_live_user_id=user-test"),
        expect.stringContaining("lumi_live_tenant_id=tenant-test"),
      ]),
    );
    expect(setCookie.join("\n")).toContain("HttpOnly");
    expect(setCookie.join("\n")).toContain("SameSite=lax");
    expect(setCookie.join("\n")).toContain("Secure");
  });

  it("supports backend-specific cookie names", async () => {
    vi.stubEnv("LUMI_LIVE_TOKEN_COOKIE_NAME", "goclaw_token");
    vi.stubEnv("LUMI_LIVE_USER_COOKIE_NAME", "goclaw_user");
    vi.stubEnv("LUMI_LIVE_TENANT_COOKIE_NAME", "goclaw_tenant");

    const response = await POST(
      new Request("http://lumi.test/api/live/session", {
        method: "POST",
      }),
    );

    const setCookie = response.headers.getSetCookie().join("\n");
    expect(setCookie).toContain("goclaw_token=test-token");
    expect(setCookie).toContain("goclaw_user=user-test");
    expect(setCookie).toContain("goclaw_tenant=tenant-test");
    expect(setCookie).not.toContain("Secure");
  });
});
