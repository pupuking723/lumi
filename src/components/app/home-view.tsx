"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Camera, MessageCircle, Radio, ShieldCheck, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppChrome } from "./app-chrome";
import { MochiPortrait } from "./mochi-portrait";
import { Pill } from "@/components/ui/pill";
import { apiClient } from "@/lib/api/client";
import { homeActions, mochiProfile, starterPrompts } from "@/lib/data/mochi";

const icons = {
  Chat: MessageCircle,
  Live: Radio,
  Snap: Camera,
};

export function HomeView() {
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: apiClient.getMe,
  });
  const { data: looks = [] } = useQuery({
    queryKey: ["looks"],
    queryFn: apiClient.listLooks,
  });

  return (
    <AppChrome>
      <div className="space-y-4">
        <section className="grid grid-cols-[1fr_140px] gap-3">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[30px] border border-white/70 bg-white/70 p-4 soft-stitch"
          >
            <Pill tone="emerald">Mochi is online</Pill>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-[0.95] text-[#343145]">
              What are we making iconic today?
            </h1>
            <p className="mt-3 text-sm font-semibold leading-5 text-[#716a7e]">
              Hi {me?.displayName ?? "darling"}. Bring the layers, the mirror,
              and one brave accessory.
            </p>
          </motion.div>
          <MochiPortrait priority className="min-h-[230px]" />
        </section>

        <section className="grid grid-cols-3 gap-2">
          {homeActions.map((action) => {
            const Icon = icons[action.label as keyof typeof icons];
            return (
              <Link
                key={action.href}
                href={action.href}
                className="rounded-[24px] border border-white/70 bg-white/72 p-3 soft-stitch transition hover:-translate-y-0.5"
              >
                <span
                  className={`mb-3 flex size-11 items-center justify-center rounded-2xl ${action.accent} text-white`}
                >
                  <Icon size={20} strokeWidth={2.5} aria-hidden />
                </span>
                <span className="block text-base font-extrabold text-[#343145]">
                  {action.label}
                </span>
                <span className="block text-xs font-bold text-[#8c7897]">
                  {action.detail}
                </span>
              </Link>
            );
          })}
        </section>

        <section className="rounded-[28px] border border-white/78 bg-[#f6f5f7]/78 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase text-[#5f586f]">
              Today’s prompt
            </h2>
            <Sparkles size={16} className="text-[#b99955]" aria-hidden />
          </div>
          <p className="text-xl font-extrabold leading-7 text-[#242235]">
            {starterPrompts[1]}
          </p>
          <Link
            href="/chat"
            className="mt-4 inline-flex items-center gap-2 rounded-[18px] bg-[#242235] px-4 py-3 text-sm font-extrabold text-white"
          >
            Ask Mochi
            <MessageCircle size={17} aria-hidden />
          </Link>
        </section>

        <section className="grid grid-cols-[1.1fr_0.9fr] gap-3">
          <div className="rounded-[26px] border border-white/70 bg-white/70 p-4">
            <h2 className="text-sm font-extrabold text-[#343145]">
              Mochi’s mode
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {mochiProfile.traits.map((trait) => (
                <Pill key={trait} tone={trait === "kind" ? "mint" : "lilac"}>
                  {trait}
                </Pill>
              ))}
            </div>
            <p className="mt-3 text-sm font-semibold leading-5 text-[#716a7e]">
              {mochiProfile.mantra}
            </p>
          </div>
          <div className="rounded-[26px] border border-[#d7eadf] bg-[#effaf6] p-4">
            <ShieldCheck className="text-[#157464]" size={22} aria-hidden />
            <h2 className="mt-3 text-sm font-extrabold text-[#157464]">
              Private by default
            </h2>
            <p className="mt-1 text-xs font-bold leading-5 text-[#4b8178]">
              Outfit photos stay in this styling flow until backend storage rules
              say otherwise.
            </p>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/70 bg-white/70 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[#343145]">
              Latest saved look
            </h2>
            <Link href="/looks" className="text-xs font-extrabold text-[#5f586f]">
              View all
            </Link>
          </div>
          <p className="mt-2 text-sm font-semibold text-[#716a7e]">
            {looks[0]?.title ?? "No looks yet. Snap one and let Mochi judge kindly."}
          </p>
        </section>
      </div>
    </AppChrome>
  );
}
