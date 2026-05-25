import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQueryClient } from "@/test/render";
import { CameraView } from "./camera-view";

const apiMocks = vi.hoisted(() => ({
  uploadAttachment: vi.fn(),
  submitOotdReview: vi.fn(),
  analyzeVision: vi.fn(),
  createLook: vi.fn(),
}));
const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: apiMocks,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/camera",
  useRouter: () => routerMock,
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

describe("CameraView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    routerMock.push.mockReset();
    apiMocks.uploadAttachment.mockResolvedValue({
      media_id: "media-1",
      fileName: "look.png",
      mimeType: "image/png",
    });
    apiMocks.submitOotdReview.mockResolvedValue({
      id: "ootd-1",
      session_id: "session",
      media_id: "media-1",
      overall_judgement: "Wear it",
      style_label: "Fit Check",
      highlight: "Strong palette.",
      main_issue: "Needs one anchor.",
      suggestion: "Add a sharper shoe.",
      mochi_line: "Good base. Make it sharper.",
      createdAt: "2026-05-25T00:00:00.000Z",
    });
    apiMocks.createLook.mockResolvedValue({});
  });

  it("uploads an OOTD image, submits a review, and saves the look", async () => {
    const { container } = renderWithQueryClient(<CameraView />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: {
        files: [new File(["image"], "look.png", { type: "image/png" })],
      },
    });

    await waitFor(() => expect(apiMocks.uploadAttachment).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Ask Mochi" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Ask Mochi" }));

    expect(await screen.findByText("Good base. Make it sharper.")).toBeInTheDocument();
    expect(apiMocks.submitOotdReview).toHaveBeenCalledWith(
      expect.objectContaining({
        media_id: "media-1",
        occasion: "Fit check",
        note: "look.png",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Save look" }));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/looks"));
  });

  it("keeps the selected image state visible when upload fails", async () => {
    apiMocks.uploadAttachment.mockRejectedValue(new Error("offline"));
    const { container } = renderWithQueryClient(<CameraView />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: {
        files: [new File(["image"], "look.png", { type: "image/png" })],
      },
    });

    expect(
      await screen.findByText("Mochi could not upload that image. Try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask Mochi" })).toBeDisabled();
  });
});
