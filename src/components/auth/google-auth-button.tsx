"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { GoogleIcon } from "./google-icon";
import { cn } from "@/lib/utils";

export function GoogleAuthButton({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";
  const authAvailable = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  const label = compact ? "Sign in" : "Continue with Google";

  if (isAuthenticated && session.user) {
    return (
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className={cn(
          "inline-flex min-w-0 items-center justify-center gap-2 rounded-full border border-white/78 bg-[#fbfafc]/68 px-3 py-2 text-xs font-extrabold text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.92)_inset] backdrop-blur-xl transition hover:bg-white/86",
          compact ? "h-10 max-w-[8.5rem]" : "h-11 w-full",
          className,
        )}
        aria-label="Sign out"
      >
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#e7e4ec] text-[0.65rem] uppercase text-[#5f586f]">
          {session.user.name?.charAt(0) ?? "M"}
        </span>
        <span className="min-w-0 truncate">
          {compact ? session.user.name ?? "Signed in" : "Sign out"}
        </span>
        {!compact && <LogOut size={14} aria-hidden />}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={isLoading || !authAvailable}
      onClick={() =>
        signIn("google", {
          callbackUrl:
            typeof window === "undefined"
              ? "/"
              : `${window.location.pathname}${window.location.search}`,
        })
      }
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border border-white/78 bg-[#fbfafc]/68 px-3 py-2 text-xs font-extrabold text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.92)_inset] backdrop-blur-xl transition hover:bg-white/86 disabled:pointer-events-none disabled:opacity-45",
        compact ? "h-10" : "h-11 w-full",
        className,
      )}
      aria-label={label}
      title={authAvailable ? label : "Google login is not configured"}
    >
      <GoogleIcon className="size-4 shrink-0" aria-hidden />
      <span>{isLoading ? "Checking..." : label}</span>
    </button>
  );
}
