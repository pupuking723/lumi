// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

function requestWithFile(file?: Blob) {
  const formData = new FormData();
  if (file) formData.append("file", file, "look.png");

  return new Request("https://lumi.test/api/chat/attachments/upload", {
    method: "POST",
    body: formData,
  });
}

describe("chat attachment upload route", () => {
  beforeEach(() => {
    vi.stubEnv("LUMI_AGENT_API_BASE_URL", "https://agent.test");
    vi.stubEnv("LUMI_AGENT_API_TOKEN", "test-token");
    vi.stubEnv("LUMI_AGENT_USER_ID", "user-test");
    vi.stubEnv("LUMI_AGENT_TENANT_ID", "tenant-test");
  });

  it("requires an image file", async () => {
    const response = await POST(requestWithFile());

    await expect(response.json()).resolves.toEqual({
      error: "Image file is required.",
    });
    expect(response.status).toBe(400);
  });

  it("normalizes successful upstream media ids", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        id: "media-1",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      requestWithFile(new Blob(["image"], { type: "image/png" })),
    );

    await expect(response.json()).resolves.toEqual({
      id: "media-1",
      media_id: "media-1",
      fileName: "look.png",
      mimeType: "image/png",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.test/v1/chat/attachments/upload",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: "Bearer test-token",
          "X-GoClaw-User-Id": "user-test",
          "X-GoClaw-Tenant-Id": "tenant-test",
        },
      }),
    );
  });

  it("returns 502 when upstream omits media_id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));

    const response = await POST(
      requestWithFile(new Blob(["image"], { type: "image/png" })),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Upload response did not include media_id.",
    });
    expect(response.status).toBe(502);
  });
});
