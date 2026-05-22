"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, MessageCircle, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/memory", label: "Memory", icon: Brain },
  { href: "/profile", label: "Me", icon: UserRound },
];

const titles: Record<string, string> = {
  "/": "Today’s mirror",
  "/chat": "Chat",
  "/memory": "Closy remembers you",
  "/live": "Live styling",
  "/camera": "Snap check",
  "/looks": "Saved looks",
  "/profile": "Me",
  "/profile/settings": "Settings",
  "/profile/notifications": "Notifications",
  "/profile/subscription": "Subscription",
  "/profile/privacy": "Privacy",
};

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
  const title = titles[pathname] ?? "Lumi";
  const lockedViewport = fixedViewport || contentScroll;

  return (
    <div className={cn("lumi-grain", lockedViewport ? "h-dvh overflow-hidden" : "min-h-dvh")}>
      <div
        className={cn(
          "flex w-full flex-col bg-white/[0.18] text-[#242235] backdrop-blur md:flex-row",
          lockedViewport ? "h-dvh overflow-hidden" : "min-h-dvh",
        )}
      >
        <aside className="hidden w-[244px] shrink-0 border-r border-white/70 bg-[#f7f6f8]/58 px-4 py-5 shadow-[18px_0_54px_rgba(47,45,58,0.08)] backdrop-blur-2xl md:sticky md:top-0 md:flex md:h-dvh md:flex-col">
          <Link
            href="/"
            className="font-display text-[2.25rem] font-semibold leading-none text-[#332f43]"
            aria-label="Lumi home"
          >
            Lumi
          </Link>
          <p className="mt-2 text-sm font-extrabold text-[#7a728a]">Closy</p>
          <nav className="mt-8 flex flex-col gap-1.5">
            {navItems.map((item) => (
              <NavItem key={item.href} item={item} pathname={pathname} mode="side" />
            ))}
          </nav>
        </aside>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            lockedViewport ? "h-dvh overflow-hidden" : "min-h-dvh",
          )}
        >
          <header className="sticky top-0 z-20 shrink-0 border-b border-white/62 bg-[#f7f6f8]/64 px-5 pb-3 pt-[calc(0.9rem+env(safe-area-inset-top))] shadow-[0_12px_34px_rgba(47,45,58,0.05)] backdrop-blur-2xl md:px-8 md:pt-5">
            <div className="mx-auto w-full max-w-[760px]">
              <div className="flex items-center justify-between md:hidden">
                <Link
                  href="/"
                  className="font-display text-[2rem] font-semibold leading-none text-[#332f43]"
                  aria-label="Lumi home"
                >
                  Lumi
                </Link>
                <div className="rounded-full border border-white/78 bg-white/56 px-4 py-2 text-xs font-extrabold text-[#5f586f] shadow-[0_1px_0_rgba(255,255,255,0.95)_inset] backdrop-blur-xl">
                  Closy
                </div>
              </div>
              <p className="mt-1 text-sm font-extrabold text-[#5f586f] md:mt-0">
                {title}
              </p>
            </div>
          </header>

          <main
            className={cn(
              "mx-auto w-full max-w-[760px] flex-1 px-4 pb-[calc(7.25rem+env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-8 md:pt-6",
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
      <nav className="fixed inset-x-0 bottom-0 z-50 bg-gradient-to-t from-[#eeedf1] via-[#eeedf1]/76 to-transparent px-5 pb-[calc(0.72rem+env(safe-area-inset-bottom))] pt-3 md:hidden">
        <div className="mx-auto grid h-[70px] w-[min(21rem,calc(100vw-2.5rem))] grid-cols-3 items-center gap-1.5 rounded-[33px] border border-white/82 bg-[#f9f8fa]/74 p-2 shadow-[0_1px_0_rgba(255,255,255,0.96)_inset,0_20px_54px_rgba(42,39,55,0.18)] backdrop-blur-2xl">
          {navItems.map((item) => (
            <NavItem key={item.href} item={item} pathname={pathname} mode="bottom" />
          ))}
        </div>
      </nav>
    </div>
  );
}

function NavItem({
  item,
  pathname,
  mode,
}: {
  item: (typeof navItems)[number];
  pathname: string;
  mode: "bottom" | "side";
}) {
  const active = pathname.startsWith(item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative font-extrabold transition",
        mode === "bottom"
          ? "flex h-14 flex-col items-center justify-center gap-0.5 rounded-[25px] px-1 text-center text-[0.68rem] leading-none text-[#81798e] md:hidden"
          : "flex min-h-12 items-center gap-3 rounded-[24px] px-3 py-3 text-sm text-[#81798e] hover:bg-white/36 hover:text-[#3b374c]",
        active && "text-[#2b2938]",
        active && mode === "side" && "bg-white/34 shadow-[0_1px_0_rgba(255,255,255,0.68)_inset]",
      )}
    >
      {active && mode === "side" && (
        <span className="absolute left-1 top-3 bottom-3 w-1 rounded-full bg-[#6f6880]/72" />
      )}
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center transition duration-200",
          mode === "bottom"
            ? "size-9 rounded-full"
            : "size-8 rounded-[16px]",
          active
            ? "bg-[#e3e1e8]/78 shadow-[0_1px_0_rgba(255,255,255,0.88)_inset,0_10px_24px_rgba(42,39,55,0.1)]"
            : "bg-transparent group-hover:bg-white/48",
        )}
      >
        <Icon size={mode === "bottom" ? 19 : 18} strokeWidth={2.35} aria-hidden />
      </span>
      <span className={cn(mode === "bottom" && active && "font-black")}>
        {item.label}
      </span>
    </Link>
  );
}
