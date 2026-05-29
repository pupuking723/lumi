import { describe, expect, it, vi } from "vitest";
import { createOotdShareImageBlob } from "./ootd-report-modal";
import type { OotdReport } from "@/types/lumi";

describe("createOotdShareImageBlob", () => {
  it("draws the full OOTD report content shown in the modal", async () => {
    const drawnText: string[] = [];
    const context = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
      font: "",
      textAlign: "left",
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      arcTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      clip: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn((text: string) => {
        drawnText.push(text);
      }),
      measureText: vi.fn((text: string) => ({ width: text.length * 12 })),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback: BlobCallback) => {
        callback(new Blob(["image"], { type: "image/png" }));
      },
    );

    const report: OotdReport = {
      id: "report-1",
      mediaId: "media-1",
      imageUrl: "",
      status: "completed",
      todayJudgment: {
        title: "Effortless Chic with Potential",
        score: 7,
        label: "Solid Base",
        summary:
          "A comfortable and stylish foundation, ready for a touch more intention.",
      },
      overallStyle: "Casual-chic with a relaxed, modern silhouette.",
      palette: [
        { name: "Black", hex: "#000000" },
        { name: "Powder Blue", hex: "#9DBBD5" },
      ],
      highlights: ["The denim and black base feels balanced."],
      biggestIssue:
        "The light, unstructured duster feels a bit disconnected.",
      suggestions: [
        {
          title: "Elevate the Outerwear",
          body: "Swap the current duster for a structured blazer.",
        },
      ],
      mochiLine:
        "Good bones, but the right outer layer is waiting for its moment.",
      shareCard: {
        title: "Share title should not replace the modal title",
        quote: "Share quote should not replace the modal summary",
        advice: ["Share advice should not replace suggestions"],
        cta: "Try Lumi",
      },
      createdAt: "2026-05-25T00:00:00.000Z",
    };

    await createOotdShareImageBlob({ report, imageUrl: "" });

    expect(drawnText).toContain("Effortless Chic with Potential");
    expect(drawnText).toContain("Overall style");
    expect(drawnText).toContain("Color DNA");
    expect(drawnText).toContain("Black");
    expect(drawnText).toContain("What works");
    expect(drawnText).toContain("Biggest issue");
    expect(drawnText).toContain("Fix it now");
    expect(drawnText).toContain("Elevate the Outerwear");
    expect(drawnText).toContain(
      "Good bones, but the right outer layer is waiting for its moment.",
    );
    expect(drawnText).not.toContain("Share title should not replace the modal title");
  });
});
