"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Heart,
  MessageCircle,
  Mic2,
  Sparkles,
  Star,
} from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { mochiProfile, starterPrompts } from "@/lib/data/mochi";

const featureCards = [
  {
    title: "Chat styling",
    body: "把今天的场景、衣柜和犹豫发给 mochi，拿到能直接执行的搭配建议。",
    icon: MessageCircle,
    tone: "bg-[#e7e4ec] text-[#5f586f]",
  },
  {
    title: "Live voice",
    body: "试衣服时直接语音聊，像有个审美稳定的朋友在旁边帮你定稿。",
    icon: Mic2,
    tone: "bg-[#dcecea] text-[#157464]",
  },
  {
    title: "Snap check",
    body: "拍一张 outfit，快速看比例、色彩、缺的那一个小重点。",
    icon: Camera,
    tone: "bg-[#f2e1e7] text-[#8b5264]",
  },
];

const flowSteps = [
  "Tell mochi the occasion",
  "Add a photo or voice note",
  "Leave with one confident move",
];

const trustNotes = [
  "private by default",
  "memory you can review",
  "kind, practical feedback",
];

export function HomeView() {
  return (
    <main className="lumi-grain min-h-dvh overflow-x-hidden pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-[#242235] md:pb-0">
      <HeroSection />
      <FeatureSection />
      <FlowSection />
      <FinalCta />
      <MobileStickyCta />
    </main>
  );
}

function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden border-b border-white/70">
      <Image
        src="/mochi/mochi-main.png"
        alt="mochi AI fashion companion character"
        fill
        priority
        sizes="100vw"
        className="absolute inset-0 -z-20 object-cover object-[34%_48%] opacity-85 md:object-[50%_44%]"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(247,246,248,0.28)_0%,rgba(238,237,241,0.7)_58%,#eeedf1_100%)]" />

      <div className="mx-auto flex min-h-[86svh] w-full max-w-[1120px] flex-col px-5 pb-5 pt-[calc(1rem+env(safe-area-inset-top))] md:min-h-[82svh] md:px-8 md:pt-7">
        <nav className="flex items-center justify-between">
          <Link
            href="/"
            aria-label="Lumi home"
            className="font-display text-[2.15rem] font-semibold leading-none text-[#332f43]"
          >
            Lumi
          </Link>
          <Link
            href="/chat"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/78 bg-[#fbfafc]/68 px-4 text-sm font-extrabold text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.92)_inset] backdrop-blur-xl transition hover:bg-white/86"
          >
            Open chat
            <ArrowRight size={15} aria-hidden />
          </Link>
        </nav>

        <div className="mt-auto max-w-[22rem] pb-2 pt-20 md:max-w-[30rem] md:pb-10 md:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, ease: "easeOut" }}
          >
            <Pill tone="emerald" className="bg-[#fbfafc]/72">
              AI fashion companion
            </Pill>
            <h1 className="mt-4 font-display text-[4.5rem] font-semibold leading-[0.82] text-[#2c293d] md:text-[7rem]">
              mochi
            </h1>
            <p className="mt-4 text-[1.05rem] font-extrabold leading-7 text-[#343145] md:text-xl md:leading-8">
              Your pocket stylist for outfit chat, live voice, and camera fit
              checks before you step out.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/chat"
                className="inline-flex h-12 items-center gap-2 rounded-[20px] bg-[#282638] px-5 text-sm font-extrabold text-white shadow-[0_14px_34px_rgba(38,36,52,0.22)] transition hover:bg-[#343145]"
              >
                Start styling
                <MessageCircle size={17} aria-hidden />
              </Link>
              <Link
                href="/camera"
                className="inline-flex h-12 items-center gap-2 rounded-[20px] border border-white/78 bg-[#fbfafc]/72 px-5 text-sm font-extrabold text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_10px_24px_rgba(43,39,58,0.08)] backdrop-blur-xl transition hover:bg-white/86"
              >
                Snap a look
                <Camera size={17} aria-hidden />
              </Link>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-3 gap-2 md:max-w-[31rem]">
          {[
            ["3 modes", "chat live snap"],
            ["1 answer", "clear next move"],
            ["0 drama", "kind by design"],
          ].map(([value, label]) => (
            <div
              key={value}
              className="rounded-[22px] border border-white/72 bg-[#fbfafc]/58 px-3 py-3 shadow-[0_1px_0_rgba(255,255,255,0.82)_inset] backdrop-blur-xl"
            >
              <p className="text-sm font-black text-[#302d43]">{value}</p>
              <p className="mt-0.5 text-[0.68rem] font-extrabold leading-4 text-[#7a728a]">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureSection() {
  return (
    <section className="mx-auto w-full max-w-[1120px] px-5 py-8 md:px-8 md:py-14">
      <div className="max-w-[42rem]">
        <Pill tone="rose">Built for the mirror moment</Pill>
        <h2 className="mt-3 font-display text-4xl font-semibold leading-none text-[#343145] md:text-5xl">
          From “is this working?” to “yes, wear that.”
        </h2>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3 md:gap-4">
        {featureCards.map((feature) => {
          const Icon = feature.icon;

          return (
            <article
              key={feature.title}
              className="rounded-[26px] border border-white/76 bg-[#fbfafc]/66 p-4 shadow-[0_1px_0_rgba(255,255,255,0.86)_inset,0_16px_38px_rgba(42,38,58,0.1)] backdrop-blur-xl"
            >
              <span
                className={`flex size-11 items-center justify-center rounded-[18px] ${feature.tone}`}
              >
                <Icon size={20} strokeWidth={2.45} aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-extrabold text-[#302d43]">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#716a7e]">
                {feature.body}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FlowSection() {
  return (
    <section className="border-y border-white/70 bg-[#f7f6f8]/48">
      <div className="mx-auto grid w-full max-w-[1120px] gap-6 px-5 py-8 md:grid-cols-[0.9fr_1.1fr] md:px-8 md:py-14">
        <div className="relative min-h-[19rem] overflow-hidden rounded-[30px] border border-white/78 bg-white/52 shadow-[0_1px_0_rgba(255,255,255,0.86)_inset,0_18px_42px_rgba(42,38,58,0.12)]">
          <Image
            src="/mochi/mochi-variants.png"
            alt="mochi character styling variants"
            fill
            sizes="(max-width: 768px) 90vw, 420px"
            className="object-cover object-[50%_28%]"
          />
          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/82 bg-[#fbfafc]/74 px-3 py-1 text-xs font-extrabold text-[#5f586f] shadow-[0_1px_0_rgba(255,255,255,0.92)_inset] backdrop-blur-xl">
            <Sparkles size={13} aria-hidden />
            {mochiProfile.mantra}
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <Pill tone="gold">H5-ready flow</Pill>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-none text-[#343145] md:text-5xl">
            One tiny landing page, then straight into the agent.
          </h2>
          <div className="mt-5 space-y-3">
            {flowSteps.map((step, index) => (
              <div key={step} className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e7e4ec]/82 text-sm font-black text-[#5f586f] shadow-[0_1px_0_rgba(255,255,255,0.86)_inset]">
                  {index + 1}
                </span>
                <p className="pt-1 text-base font-extrabold leading-6 text-[#343145]">
                  {step}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {trustNotes.map((note) => (
              <Pill key={note} tone="mint">
                <CheckCircle2 size={13} aria-hidden />
                {note}
              </Pill>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-[1120px] px-5 py-8 md:px-8 md:py-14">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <div className="flex flex-wrap gap-2">
            {mochiProfile.traits.map((trait) => (
              <Pill key={trait} tone={trait === "kind" ? "mint" : "lilac"}>
                <Star size={12} aria-hidden />
                {trait}
              </Pill>
            ))}
          </div>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-none text-[#343145] md:text-5xl">
            Ask the outfit question before the outfit asks you.
          </h2>
          <p className="mt-3 max-w-[38rem] text-sm font-semibold leading-6 text-[#716a7e] md:text-base">
            Try a prompt like: “{starterPrompts[1]}” mochi will keep it playful,
            specific, and wearable.
          </p>
        </div>
        <Link
          href="/chat"
          className="inline-flex h-13 items-center justify-center gap-2 rounded-[22px] bg-[#282638] px-6 text-base font-extrabold text-white shadow-[0_14px_34px_rgba(38,36,52,0.22)] transition hover:bg-[#343145]"
        >
          Chat with mochi
          <Heart size={18} aria-hidden />
        </Link>
      </div>
    </section>
  );
}

function MobileStickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-[#eeedf1] via-[#eeedf1]/90 to-transparent px-4 pb-[calc(0.8rem+env(safe-area-inset-bottom))] pt-5 md:hidden">
      <Link
        href="/chat"
        className="mx-auto flex h-14 w-full max-w-[25rem] items-center justify-center gap-2 rounded-[24px] bg-[#282638] text-sm font-extrabold text-white shadow-[0_14px_34px_rgba(38,36,52,0.24)]"
      >
        Start with mochi
        <ArrowRight size={17} aria-hidden />
      </Link>
    </div>
  );
}
