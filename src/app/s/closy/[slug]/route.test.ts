import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("public OOTD share route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
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

  it("uses the configured public origin instead of leaking an upstream localhost redirect", async () => {
    vi.stubEnv("LUMI_PUBLIC_APP_ORIGIN", "https://public.example");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          Location: "https://localhost:3000/?from=mochi_share&share=share-1",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://127.0.0.1:3000/s/closy/share-1", {
        headers: {
          host: "internal.example",
          "x-forwarded-proto": "https",
        },
      }),
      { params: Promise.resolve({ slug: "share-1" }) },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.test/s/closy/share-1",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Forwarded-Host": "public.example",
          "X-Forwarded-Proto": "https",
        }),
      }),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://public.example/?from=mochi_share&share=share-1",
    );
  });

  it("redirects normal browsers even when the share payload exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        slug: "share-1",
        payload: {
          overall_judgement: "City Casual Minimalism",
          mochi_line: "The base is fine; give it a backbone.",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("https://lumi.test/s/closy/share-1", {
        headers: {
          Accept: "text/html",
          "user-agent":
            "Mozilla/5.0 AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
        },
      }),
      { params: Promise.resolve({ slug: "share-1" }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://lumi.test/?from=mochi_share&share=share-1",
    );
  });

  it("returns social metadata with description and image for crawler shares", async () => {
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
        headers: {
          Accept: "text/html",
          "user-agent": "facebookexternalhit/1.1",
        },
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
