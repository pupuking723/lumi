import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleAuthButton } from "./google-auth-button";

const authMocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("next-auth/react", () => authMocks);

describe("GoogleAuthButton", () => {
  beforeEach(() => {
    authMocks.signIn.mockReset();
    authMocks.signOut.mockReset();
    authMocks.useSession.mockReturnValue({ data: null, status: "unauthenticated" });
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "google-client";
  });

  it("starts Google sign in with the current path as callback", () => {
    window.history.pushState({}, "", "/chat?from=test");
    render(<GoogleAuthButton />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(authMocks.signIn).toHaveBeenCalledWith("google", {
      callbackUrl: "/chat?from=test",
    });
  });

  it("signs out authenticated users", () => {
    authMocks.useSession.mockReturnValue({
      data: { user: { name: "Mochi" } },
      status: "authenticated",
    });
    render(<GoogleAuthButton />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(authMocks.signOut).toHaveBeenCalledWith({ callbackUrl: "/" });
  });
});
