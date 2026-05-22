import { describe, expect, it } from "vitest";
import { getLiveStatusCopy } from "./live";

describe("live status copy", () => {
  it("keeps microphone failure user-facing and recoverable", () => {
    const copy = getLiveStatusCopy("error");

    expect(copy.title).toContain("Mic");
    expect(copy.cta).toBe("Try again");
  });
});
