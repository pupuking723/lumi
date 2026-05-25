import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQueryClient } from "@/test/render";
import { MemoryView } from "./memory-view";

const apiMocks = vi.hoisted(() => ({
  getMe: vi.fn(),
  updateStyleProfile: vi.fn(),
  listLooks: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: apiMocks,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/memory",
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

describe("MemoryView", () => {
  beforeEach(() => {
    apiMocks.getMe.mockResolvedValue({
      id: "user",
      handle: "softicon",
      displayName: "Lumi Girl",
      styleProfile: {
        vibe: "soft icon",
        favoriteColors: ["lilac", "cream"],
        avoidNotes: ["diet talk"],
        sizesPrivate: true,
      },
      createdAt: "2026-05-25T00:00:00.000Z",
    });
    apiMocks.listLooks.mockResolvedValue([]);
    apiMocks.updateStyleProfile.mockImplementation(async (input) => ({
      id: "user",
      handle: "softicon",
      displayName: "Lumi Girl",
      styleProfile: {
        vibe: input.vibe,
        favoriteColors: input.favoriteColors,
        avoidNotes: input.avoidNotes,
        sizesPrivate: true,
      },
      createdAt: "2026-05-25T00:00:00.000Z",
    }));
  });

  it("shows editable style memory and saves normalized fields", async () => {
    renderWithQueryClient(<MemoryView />);

    const summary = await screen.findByLabelText("Style summary");
    fireEvent.change(summary, { target: { value: "clean casual" } });
    fireEvent.change(screen.getByLabelText("Favorite colors"), {
      target: { value: "black, white" },
    });
    fireEvent.change(screen.getByLabelText("Avoid"), {
      target: { value: "neon, logos" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Mochi memory/i }));

    await waitFor(() =>
      expect(apiMocks.updateStyleProfile).toHaveBeenCalledWith({
        vibe: "clean casual",
        favoriteColors: ["black", "white"],
        avoidNotes: ["neon", "logos"],
      }),
    );
    await waitFor(() => expect(apiMocks.getMe).toHaveBeenCalledTimes(2));
  });
});
