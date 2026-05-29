import { describe, expect, it } from "vitest";
import { normalizeMediaImageUrl } from "./media-url";

describe("normalizeMediaImageUrl", () => {
  it("routes GoClaw media paths through the Next.js media proxy", () => {
    expect(normalizeMediaImageUrl("/v1/media/media-1")).toBe(
      "/api/media/media-1",
    );
    expect(
      normalizeMediaImageUrl("http://127.0.0.1:9600/v1/media/media-2?ft=abc"),
    ).toBe("/api/media/media-2?ft=abc");
  });

  it("keeps browser-local and external image URLs unchanged", () => {
    expect(normalizeMediaImageUrl("blob:preview")).toBe("blob:preview");
    expect(normalizeMediaImageUrl("data:image/png;base64,abc")).toBe(
      "data:image/png;base64,abc",
    );
    expect(normalizeMediaImageUrl("https://cdn.example.test/look.png")).toBe(
      "https://cdn.example.test/look.png",
    );
  });
});
