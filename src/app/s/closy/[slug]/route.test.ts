import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("public OOTD share route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LUMI_AGENT_API_BASE_URL", "https://agent.test");
  });

  it("uses the frontend origin for the public redirect", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          Location: "https://lumi.test/?from=mochi_share&share=share-1",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("https://lumi.test/s/closy/share-1"),
      { params: Promise.resolve({ slug: "share-1" }) },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.test/s/closy/share-1",
      expect.objectContaining({
        redirect: "manual",
        headers: expect.objectContaining({
          Accept: "text/html",
          "X-Forwarded-Host": "lumi.test",
          "X-Forwarded-Proto": "https",
        }),
      }),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://lumi.test/?from=mochi_share&share=share-1",
    );
  });

  it("returns social metadata with description and image for HTML shares", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        slug: "share-1",
        share_url: "https://lumi.test/s/closy/share-1",
        payload: {
          overall_judgement: "City Casual Minimalism",
          mochi_line: "The base is fine; give it a backbone.",
          highlight: "The palette reads intentional.",
          share_url: "https://lumi.test/s/closy/share-1",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("https://lumi.test/s/closy/share-1", {
        headers: { Accept: "text/html" },
      }),
      { params: Promise.resolve({ slug: "share-1" }) },
    );

    const html = await response.text();
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain('property="og:title" content="City Casual Minimalism"');
    expect(html).toContain(
      'property="og:description" content="The base is fine; give it a backbone."',
    );
    expect(html).toContain(
      'property="og:url" content="https://lumi.test/s/closy/share-1"',
    );
    expect(html).toContain('property="og:image"');
    expect(html).toContain("/api/closy/ootd/share-preview");
  });
});
