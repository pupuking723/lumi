"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { Heart, MessageCircle, Star } from "lucide-react";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";

const featureCards = [
  {
    title: "Meet Mochi",
    body: "Your sassy style bestie, always ready to judge and guide.",
    image: "/landing/mochi-feature-1.webp",
    crop: "object-center",
  },
  {
    title: "Sharp Fashion Advice",
    body: "Spots the flaws, gives honest, witty outfit tips.",
    image: "/landing/mochi-feature-2.webp",
    crop: "object-center",
  },
  {
    title: "Remembers You",
    body: "Keeps track of your style, preferences, and past choices.",
    image: "/landing/mochi-feature-3.webp",
    crop: "object-center",
  },
  {
    title: "More Than Fashion",
    body: "Beyond outfits: emotional support, style guidance, and tiny daily decisions.",
    image: "/landing/mochi-feature-4.webp",
    crop: "object-center",
  },
] as const;

export function HomeView() {
  return (
    <main className="lumi-grain min-h-dvh overflow-x-hidden text-[#242235]">
      <HeroSection />
      <FeatureSection />
      <FinalCta />
    </main>
  );
}

function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden border-b border-white/70">
      <Image
        src="/landing/mochi-hero.webp"
        alt="Mochi waving in a dreamy flower field"
        fill
        priority
        unoptimized
        sizes="100vw"
        className="absolute inset-0 -z-20 object-cover object-[36%_50%] sm:object-[34%_50%] md:object-[30%_50%]"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(247,246,248,0.64)_0%,rgba(246,240,248,0.16)_36%,rgba(238,237,241,0.76)_100%)] md:bg-[linear-gradient(90deg,rgba(238,237,241,0.08)_0%,rgba(238,237,241,0.16)_48%,rgba(238,237,241,0.9)_100%)]" />

      <div className="mx-auto flex min-h-svh w-full max-w-[1120px] flex-col px-5 pb-[calc(1.35rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] md:px-8 md:pb-8 md:pt-7">
        <nav className="flex items-center justify-between gap-3">
          <Link
            href="/"
            aria-label="lumi home"
            className="font-display text-[2.05rem] font-semibold leading-none text-[#332f43]"
          >
            Lumi
          </Link>
          <div className="flex items-center gap-2">
            <GoogleAuthButton compact className="hidden sm:inline-flex" />
          </div>
        </nav>

        <div className="max-w-[19rem] pt-9 md:ml-auto mt-auto md:max-w-[32rem] md:pb-28 md:pt-20 md:text-right">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.52, ease: "easeOut" }}
          >
            <h1 className="mt-3 max-w-[9rem] font-display text-[3.35rem] font-semibold leading-[0.86] text-[#2c293d] md:ml-auto md:mt-4 md:max-w-none md:text-[6.35rem]">
              Meet Mochi
            </h1>
            <p className="mt-3 max-w-[18rem] text-sm font-extrabold leading-6 text-[#343145] md:ml-auto md:mt-4 md:max-w-[28rem] md:text-lg md:leading-8">
              Your sassy style bestie for outfit judgment, memory, emotional
              support, and every tiny decision before you step out.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 md:mt-7 md:justify-end">
              <Link
                href="/chat"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#282638] px-5 text-sm font-extrabold text-white shadow-[0_14px_34px_rgba(38,36,52,0.22)] transition hover:bg-[#343145] md:h-12 md:px-6"
              >
                Start chatting
                <MessageCircle size={17} aria-hidden />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function FeatureSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const editorialDrift = useTransform(
    scrollYProgress,
    [0, 1],
    ["-18px", "22px"],
  );

  return (
    <section
      ref={sectionRef}
      id="features"
      className="relative isolate overflow-hidden border-y border-white/70 bg-[#f3f1f5] py-14 md:py-20"
    >
      <motion.div
        aria-hidden
        style={{ y: editorialDrift }}
        className="pointer-events-none absolute -left-5 top-10 -z-10 font-display text-[8.5rem] font-semibold leading-none text-[#d8d1df]/30 md:-left-8 md:top-16 md:text-[18rem]"
      >
        Mochi
      </motion.div>

      <div className="mx-auto w-full max-w-[1120px] px-5 md:px-8">
        <div className="mx-auto max-w-[42rem] text-center">
          <h2 className="mt-4 font-display text-[3rem] font-semibold leading-[0.92] text-[#343145] md:text-[4.5rem]">
            Four moods, one sharp bestie.
          </h2>
          <p className="mx-auto mt-4 max-w-[34rem] text-sm font-bold leading-6 text-[#716a7e] md:text-base md:leading-7">
            A fashion companion with judgment, memory, softness, and just enough
            drama to make the outfit click.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 md:mt-14 md:gap-6">
          <FeatureFrame
            feature={featureCards[0]}
            className=""
            imageClassName="aspect-square"
          />
          <FeatureFrame
            feature={featureCards[1]}
            className=""
            imageClassName="aspect-square"
          />
          <FeatureFrame
            feature={featureCards[2]}
            className=""
            imageClassName="aspect-square"
          />
          <FeatureFrame
            feature={featureCards[3]}
            className=""
            imageClassName="aspect-square"
          />
        </div>
      </div>
    </section>
  );
}

function FeatureFrame({
  feature,
  className,
  imageClassName,
}: {
  feature: (typeof featureCards)[number];
  className?: string;
  imageClassName?: string;
}) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-[30px] border border-white/72 bg-[#fbfafc]/72 shadow-[0_20px_56px_rgba(44,39,60,0.12)] backdrop-blur-xl",
        className,
      )}
    >
      <motion.div
        whileHover={{ scale: 1.018, y: -4 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        className={cn(
          "relative overflow-hidden bg-[#e7e4ec]/70",
          imageClassName,
        )}
      >
        <Image
          src={feature.image}
          alt={`${feature.title} illustration`}
          fill
          unoptimized
          sizes="(max-width: 768px) 92vw, 620px"
          className={cn("object-cover", feature.crop)}
        />
      </motion.div>
      <div className="px-5 py-5 md:px-6 md:py-6">
        <h3 className="text-balance break-words font-display text-[2rem] font-semibold leading-[0.94] text-[#302d43] md:text-[2.35rem]">
          {feature.title}
        </h3>
        <p className="mt-3 text-sm font-bold leading-6 text-[#716a7e] md:text-base md:leading-7">
          {feature.body}
        </p>
      </div>
    </article>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-[1120px] px-5 py-10 md:px-8 md:py-16">
      <div className="relative isolate overflow-hidden rounded-[32px] border border-white/76 bg-[#fbfafc]/72 p-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_18px_52px_rgba(50,46,63,0.14)] backdrop-blur-xl md:grid md:grid-cols-[1fr_auto] md:items-end md:p-7">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,rgba(217,192,235,0.46),rgba(226,238,235,0.36),rgba(242,234,216,0.4))]" />
        <div>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-none text-[#343145] md:text-5xl">
            Ready for the mirror verdict?
          </h2>
          <p className="mt-3 max-w-[38rem] text-sm font-bold leading-6 text-[#716a7e] md:text-base">
            Send Mochi your outfit panic, your mood, or the tiny choice slowing
            down your day.
          </p>
        </div>
        <Link
          href="/chat"
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[22px] bg-[#282638] px-6 text-sm font-extrabold text-white shadow-[0_14px_34px_rgba(38,36,52,0.22)] transition hover:bg-[#343145] md:mt-0 md:w-auto"
        >
          Chat with Mochi
          <Heart size={18} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
