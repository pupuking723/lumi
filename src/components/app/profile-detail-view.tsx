"use client";

import Link from "next/link";
import { ArrowLeft, Bell, CreditCard, Shield, SlidersHorizontal } from "lucide-react";
import { AppChrome } from "./app-chrome";
import { Pill } from "@/components/ui/pill";

const detailCopy = {
  settings: {
    eyebrow: "Settings",
    title: "Settings",
    icon: SlidersHorizontal,
    body: "Account, language, and display preferences will live here. For the MVP, this stays as a frontend entry point.",
  },
  notifications: {
    eyebrow: "Notifications",
    title: "Notifications",
    icon: Bell,
    body: "Message alerts, Live reminders, and look recap reminders will be configured here.",
  },
  subscription: {
    eyebrow: "Subscription",
    title: "Subscription",
    icon: CreditCard,
    body: "Plans, perks, billing, and purchase restore controls will be configured here.",
  },
  privacy: {
    eyebrow: "Privacy",
    title: "Privacy",
    icon: Shield,
    body: "Photo permissions, share links, data retention, and visibility controls will be managed here.",
  },
};

export type ProfileDetailKind = keyof typeof detailCopy;

export function ProfileDetailView({ kind }: { kind: ProfileDetailKind }) {
  const item = detailCopy[kind];
  const Icon = item.icon;

  return (
    <AppChrome contentScroll>
      <div className="space-y-4">
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-sm font-extrabold text-[#5f586f]"
        >
          <ArrowLeft size={16} aria-hidden />
          Back
        </Link>

        <section className="rounded-[30px] border border-white/70 bg-white/72 p-4 soft-stitch">
          <div className="flex size-12 items-center justify-center rounded-[20px] bg-[#e6e4ea] text-[#5f586f]">
            <Icon size={20} aria-hidden />
          </div>
          <Pill tone="lilac" className="mt-4">
            {item.eyebrow}
          </Pill>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-none text-[#343145]">
            {item.title}
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#716a7e]">
            {item.body}
          </p>
        </section>
      </div>
    </AppChrome>
  );
}
