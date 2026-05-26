"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

const titles: Record<string, string> = {
  "/": "Today’s mirror",
  "/chat": "Chat",
  "/memory": "Mochi remembers you",
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
  showPageTitle = true,
  mainClassName,
}: {
  children: React.ReactNode;
  contentScroll?: boolean;
  fixedViewport?: boolean;
  showPageTitle?: boolean;
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
          <p className="mt-2 text-sm font-extrabold text-[#7a728a]">Mochi</p>
          <nav className="mt-8 flex flex-col gap-1.5">
            {navItems.map((item) => (
              <NavItem key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>
          <div className="mt-auto pt-5">
            <GoogleAuthButton />
          </div>
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
                <div className="flex items-center gap-3">
                  <Sheet>
                    <SheetTrigger asChild>
                      <button
                        type="button"
                        aria-label="Open navigation"
                        className="flex size-11 items-center justify-center rounded-[20px] border border-white/78 bg-white/56 text-[#5f586f] shadow-[0_1px_0_rgba(255,255,255,0.95)_inset] backdrop-blur-xl transition hover:bg-white/76 hover:text-[#302d43]"
                      >
                        <Menu size={20} strokeWidth={2.45} aria-hidden />
                      </button>
                    </SheetTrigger>
                    <SheetContent
                      side="left"
                      showCloseButton={false}
                      className="w-[min(19rem,calc(100vw-2rem))] border-r border-white/72 bg-[#f7f6f8]/88 px-4 py-[calc(1rem+env(safe-area-inset-top))] shadow-[18px_0_54px_rgba(47,45,58,0.18)] backdrop-blur-2xl sm:max-w-none"
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
                              className="font-display text-[2.25rem] font-semibold leading-none text-[#332f43]"
                              aria-label="Lumi home"
                            >
                              Lumi
                            </Link>
                          </SheetClose>
                          <p className="mt-2 text-sm font-extrabold text-[#7a728a]">
                            Mochi
                          </p>
                        </div>
                        <SheetClose asChild>
                          <button
                            type="button"
                            aria-label="Close navigation"
                            className="flex size-10 items-center justify-center rounded-[18px] border border-white/78 bg-white/56 text-[#5f586f] shadow-[0_1px_0_rgba(255,255,255,0.95)_inset]"
                          >
                            <X size={18} strokeWidth={2.45} aria-hidden />
                          </button>
                        </SheetClose>
                      </div>
                      <nav className="mt-8 flex flex-col gap-1.5">
                        {navItems.map((item) => (
                          <SheetClose asChild key={item.href}>
                            <NavItem item={item} pathname={pathname} />
                          </SheetClose>
                        ))}
                      </nav>
                    </SheetContent>
                  </Sheet>
                  <Link
                    href="/"
                    className="font-display text-[2rem] font-semibold leading-none text-[#332f43]"
                    aria-label="Lumi home"
                  >
                    Lumi
                  </Link>
                </div>
                <GoogleAuthButton compact />
              </div>
              {showPageTitle && (
                <p className="mt-1 text-sm font-extrabold text-[#5f586f] md:mt-0">
                  {title}
                </p>
              )}
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

function NavItem({
  item,
  pathname,
}: {
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
        "group relative font-extrabold transition",
        "flex min-h-12 items-center gap-3 rounded-[24px] px-3 py-3 text-sm text-[#81798e] hover:bg-white/36 hover:text-[#3b374c]",
        active && "text-[#2b2938]",
        active && "bg-white/34 shadow-[0_1px_0_rgba(255,255,255,0.68)_inset]",
      )}
    >
      {active && (
        <span className="absolute left-1 top-3 bottom-3 w-1 rounded-full bg-[#6f6880]/72" />
      )}
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center transition duration-200",
          "size-8 rounded-[16px]",
          active
            ? "bg-[#e3e1e8]/78 shadow-[0_1px_0_rgba(255,255,255,0.88)_inset,0_10px_24px_rgba(42,39,55,0.1)]"
            : "bg-transparent group-hover:bg-white/48",
        )}
      >
        <Icon size={18} strokeWidth={2.35} aria-hidden />
      </span>
      <span>{item.label}</span>
    </Link>
  );
}
