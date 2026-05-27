"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Session } from "next-auth";
import { Brain, Menu, MessageCircle, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";

const navItems = [
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/memory", label: "Memory", icon: Brain },
  { href: "/profile", label: "Me", icon: UserRound },
];

export function AppChrome({
  children,
  contentScroll = false,
  fixedViewport = false,
  mainClassName,
}: {
  children: React.ReactNode;
  contentScroll?: boolean;
  fixedViewport?: boolean;
  mainClassName?: string;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const lockedViewport = fixedViewport || contentScroll;

  return (
    <div className={cn("lumi-grain", lockedViewport ? "h-dvh overflow-hidden" : "min-h-dvh")}>
      <div
        className={cn(
          "flex w-full flex-col bg-white/[0.18] text-[#242235] backdrop-blur md:flex-row",
          lockedViewport ? "h-dvh overflow-hidden" : "min-h-dvh",
        )}
      >
        <aside className="hidden w-[264px] shrink-0 border-r border-white/70 bg-[#f7f6f8]/72 px-5 py-6 shadow-[18px_0_54px_rgba(47,45,58,0.08)] backdrop-blur-2xl md:sticky md:top-0 md:flex md:h-dvh md:flex-col">
          <Link
            href="/"
            className="font-display text-[2.35rem] font-semibold leading-none text-[#332f43]"
            aria-label="Lumi home"
          >
            Lumi
          </Link>
          <nav className="mt-10 flex flex-col gap-1">
            {navItems.map((item) => (
              <SideNavItem key={item.href} item={item} pathname={pathname} compact />
            ))}
          </nav>
          <div className="mt-auto pt-8">
            <AccountChip session={session} />
          </div>
        </aside>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            lockedViewport ? "h-dvh overflow-hidden" : "min-h-dvh",
          )}
        >
          <header className="sticky top-0 z-20 shrink-0 px-5 pb-3 pt-[calc(0.9rem+env(safe-area-inset-top))] md:hidden">
            <div className="mx-auto w-full max-w-[760px]">
              <div className="flex items-center justify-between md:hidden">
                <div className="flex items-center gap-3">
                  <Sheet>
                    <SheetTrigger asChild>
                      <button
                        type="button"
                        aria-label="Open navigation"
                        className="flex size-11 items-center justify-center rounded-full border border-white/75 bg-[#f7f6f8]/76 text-[#5f586f] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_16px_34px_rgba(42,39,55,0.16)] backdrop-blur-xl transition hover:bg-white/86 hover:text-[#302d43]"
                      >
                        <Menu size={20} strokeWidth={2.45} aria-hidden />
                      </button>
                    </SheetTrigger>
                    <SheetContent
                      side="left"
                      showCloseButton={false}
                      className="w-[min(21rem,calc(100vw-1.75rem))] gap-0 rounded-r-[30px] border-r border-white/72 bg-[#f7f6f8]/94 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] shadow-[22px_0_64px_rgba(47,45,58,0.18)] backdrop-blur-2xl sm:max-w-none"
                    >
                      <SheetTitle className="sr-only">Lumi navigation</SheetTitle>
                      <SheetDescription className="sr-only">
                        Navigate between Lumi chat, memory, and profile.
                      </SheetDescription>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <SheetClose asChild>
                            <Link
                              href="/"
                              className="font-display text-[2.35rem] font-semibold leading-none text-[#332f43]"
                              aria-label="Lumi home"
                            >
                              Lumi
                            </Link>
                          </SheetClose>
                        </div>
                        <SheetClose asChild>
                          <button
                            type="button"
                            aria-label="Close navigation"
                            className="flex size-11 items-center justify-center rounded-full border border-white/75 bg-[#f7f6f8]/76 text-[#5f586f] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_16px_34px_rgba(42,39,55,0.16)] backdrop-blur-xl transition hover:bg-white/86 hover:text-[#302d43]"
                          >
                            <X size={19} strokeWidth={2.35} aria-hidden />
                          </button>
                        </SheetClose>
                      </div>
                      <nav className="mt-14 flex flex-col gap-1.5">
                        {navItems.map((item) => (
                          <SheetClose asChild key={item.href}>
                            <SideNavItem item={item} pathname={pathname} />
                          </SheetClose>
                        ))}
                      </nav>
                      <div className="mt-auto flex items-end justify-between gap-4 pt-8">
                        <SheetClose asChild>
                          <AccountChip session={session} />
                        </SheetClose>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
                <GoogleAuthButton compact />
              </div>
            </div>
          </header>

          <main
            className={cn(
              "mx-auto w-full max-w-[760px] flex-1 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-8 md:pt-6",
              lockedViewport && "min-h-0",
              fixedViewport && !contentScroll && "overflow-hidden",
              contentScroll &&
                "scrollbar-pearl overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]",
              mainClassName,
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function SideNavItem({
  compact = false,
  item,
  pathname,
}: {
  compact?: boolean;
  item: (typeof navItems)[number];
  pathname: string;
}) {
  const active = pathname.startsWith(item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center font-extrabold transition",
        compact
          ? "min-h-11 gap-2.5 rounded-[18px] px-3 text-sm"
          : "min-h-14 gap-3 rounded-[24px] px-3.5 text-base",
        active
          ? "bg-[#ebe8ef]/86 text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.82)_inset]"
          : "text-[#777188] hover:bg-white/42 hover:text-[#302d43]",
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full transition",
          compact ? "size-8" : "size-9",
          active
            ? "bg-[#e2dfe8]/92 shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_12px_24px_rgba(42,39,55,0.09)]"
            : "group-hover:bg-white/54",
        )}
      >
        <Icon size={compact ? 17 : 20} strokeWidth={2.25} aria-hidden />
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

function AccountChip({ session }: { session: Session | null }) {
  const user = session?.user;
  const name = user?.name ?? user?.email ?? "Guest";
  const subtitle = user?.email ?? (user ? "Signed in" : "Not signed in");
  const avatarUrl = user?.image ?? session?.goclawUser?.avatar;
  const initial = (name.trim().charAt(0) || "L").toUpperCase();

  return (
      <Link
        href={user ? "/profile" : "/"}
      className="inline-flex max-w-full items-center gap-2.5 rounded-full border border-white/78 bg-[#fbfafc]/78 py-1.5 pl-1.5 pr-3.5 text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_18px_42px_rgba(42,39,55,0.14)] backdrop-blur-xl"
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e7e4ec] text-xs font-extrabold text-[#5f586f]"
        style={
          avatarUrl
            ? {
                backgroundImage: `url(${avatarUrl})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
              }
            : undefined
        }
        aria-hidden
      >
        {!avatarUrl && initial}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-extrabold leading-4">{name}</span>
        <span className="block truncate text-[0.72rem] font-bold leading-4 text-[#81798e]">
          {subtitle}
        </span>
      </span>
    </Link>
  );
}
