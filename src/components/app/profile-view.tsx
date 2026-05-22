"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Brain,
  ChevronRight,
  CreditCard,
  Lock,
  Settings,
  Shield,
} from "lucide-react";
import { AppChrome } from "./app-chrome";
import { MochiPortrait } from "./mochi-portrait";
import { Pill } from "@/components/ui/pill";
import { apiClient } from "@/lib/api/client";

const profileItems = [
  {
    label: "Settings",
    description: "Account, language, display preferences",
    href: "/profile/settings",
    icon: Settings,
  },
  {
    label: "Notifications",
    description: "Message alerts, Live reminders, look recaps",
    href: "/profile/notifications",
    icon: Bell,
  },
  {
    label: "Subscription",
    description: "Plan, perks, billing",
    href: "/profile/subscription",
    icon: CreditCard,
  },
  {
    label: "Privacy",
    description: "Photos, share links, data permissions",
    href: "/profile/privacy",
    icon: Shield,
  },
  {
    label: "Memory management",
    description: "Review, update, or clear what mochi remembers",
    href: "/memory",
    icon: Brain,
  },
];

export function ProfileView({ settings = false }: { settings?: boolean }) {
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: apiClient.getMe,
  });

  return (
    <AppChrome contentScroll>
      <div className="space-y-4">
        <section className="grid grid-cols-[1fr_130px] gap-3 rounded-[30px] border border-white/70 bg-white/70 p-4 soft-stitch">
          <div>
            <Pill tone="lilac">@{me?.handle ?? "softicon"}</Pill>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-none text-[#343145]">
              Me
            </h1>
            <p className="mt-3 text-sm font-semibold leading-5 text-[#716a7e]">
              Manage your account, notifications, subscription, privacy, and
              how mochi remembers you.
            </p>
          </div>
          <MochiPortrait variant="variants" className="min-h-[170px]" />
        </section>

        <section className="rounded-[28px] border border-white/70 bg-white/70 p-2">
          {profileItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between rounded-[22px] px-3 py-3 text-sm font-extrabold text-[#343145] transition hover:bg-white/60"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[16px] bg-[#e6e4ea] text-[#5f586f]">
                    <Icon size={17} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block">{item.label}</span>
                    <span className="mt-0.5 block truncate text-xs font-bold text-[#8c7897]">
                      {item.description}
                    </span>
                  </span>
                </span>
                <ChevronRight size={17} aria-hidden />
              </Link>
            );
          })}
        </section>

        {settings && (
          <section className="space-y-3 rounded-[28px] border border-white/70 bg-white/70 p-4">
            <h2 className="text-lg font-extrabold text-[#242235]">
              Frontend adapter
            </h2>
            <p className="text-sm font-semibold leading-6 text-[#716a7e]">
              Set <code className="font-extrabold">NEXT_PUBLIC_API_BASE_URL</code>{" "}
              to connect Lumi to the external backend. Leave it empty to use the
              local mock adapter.
            </p>
            <div className="rounded-[18px] bg-[#edeaf1] px-3 py-2 text-xs font-extrabold text-[#5f586f]">
              Current mode:{" "}
              {process.env.NEXT_PUBLIC_API_BASE_URL ? "external API" : "mock API"}
            </div>
          </section>
        )}

        <section className="rounded-[28px] border border-[#d7eadf] bg-[#effaf6] p-4">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 text-[#157464]" size={20} aria-hidden />
            <div>
              <h2 className="text-sm font-extrabold text-[#157464]">
                Privacy by default
              </h2>
              <p className="mt-1 text-sm font-bold leading-6 text-[#4b8178]">
                Your photos, sizes, and memories are private by default. Once the
                backend is connected, full permission controls will live here.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppChrome>
  );
}
