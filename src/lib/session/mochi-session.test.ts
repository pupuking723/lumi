import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOrCreateMochiSessionId } from "./mochi-session";

describe("Mochi session id", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000001",
    );
  });

  it("creates and persists a Mochi session id", () => {
    const sessionId = getOrCreateMochiSessionId();

    expect(sessionId).toBe("mochi-00000000-0000-4000-8000-000000000001");
    expect(getOrCreateMochiSessionId()).toBe(sessionId);
    expect(window.localStorage.getItem("lumi.mochi.session_id")).toBe(sessionId);
  });

  it("reuses an existing stored session id", () => {
    window.localStorage.setItem("lumi.mochi.session_id", "mochi-existing");

    expect(getOrCreateMochiSessionId()).toBe("mochi-existing");
  });
});
