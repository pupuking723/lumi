"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Heart, MessageCircle, Star } from "lucide-react";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";

const featureCards = [
  {
    title: "Meet Mochi",
    body: "Your sassy style bestie, always ready to judge and guide.",
    image: "/landing/mochi-feature-1.webp",
    crop: "object-[50%_26%]",
  },
  {
    title: "Sharp Fashion Advice",
    body: "Spots the flaws, gives honest, witty outfit tips.",
    image: "/landing/mochi-feature-2.webp",
    crop: "object-[50%_28%]",
  },
  {
    title: "Remembers You",
    body: "Keeps track of your style, preferences, and past choices.",
    image: "/landing/mochi-feature-3.webp",
    crop: "object-[50%_22%]",
  },
  {
    title: "More Than Fashion",
    body: "Beyond outfits: emotional support, style guidance, and tiny daily decisions.",
    image: "/landing/mochi-feature-4.webp",
    crop: "object-[50%_32%]",
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
        alt="Mochi in a dreamy fashion closet"
        fill
        priority
        sizes="100vw"
        className="absolute inset-0 -z-20 object-cover object-[50%_42%] md:object-[50%_40%]"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(247,246,248,0.18)_0%,rgba(246,240,248,0.28)_32%,rgba(238,237,241,0.86)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.5),transparent_32%),linear-gradient(90deg,rgba(238,237,241,0.82)_0%,rgba(238,237,241,0.32)_48%,rgba(238,237,241,0.12)_100%)] md:bg-[linear-gradient(90deg,rgba(238,237,241,0.9)_0%,rgba(238,237,241,0.44)_42%,rgba(238,237,241,0.1)_100%)]" />

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
            <Link
              href="/chat"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/78 bg-[#fbfafc]/68 px-4 text-sm font-extrabold text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.92)_inset] backdrop-blur-xl transition hover:bg-white/86"
            >
              Open chat
              <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
        </nav>

        <div className="mt-auto max-w-[24rem] pb-2 pt-16 md:max-w-[34rem] md:pb-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.52, ease: "easeOut" }}
          >
            <Pill tone="emerald" className="bg-[#fbfafc]/70">
              AI fashion bestie
            </Pill>
            <h1 className="mt-4 font-display text-[4.25rem] font-semibold leading-[0.86] text-[#2c293d] md:text-[7.25rem]">
              Meet Mochi
            </h1>
            <p className="mt-4 text-base font-extrabold leading-7 text-[#343145] md:max-w-[31rem] md:text-xl md:leading-8">
              Your sassy style bestie for outfit judgment, memory, emotional
              support, and every tiny decision before you step out.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/chat"
                className="inline-flex h-12 items-center gap-2 rounded-[20px] bg-[#282638] px-5 text-sm font-extrabold text-white shadow-[0_14px_34px_rgba(38,36,52,0.22)] transition hover:bg-[#343145]"
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
  const editorialDrift = useTransform(scrollYProgress, [0, 1], ["-28px", "34px"]);

  return (
    <section
      ref={sectionRef}
      id="features"
      className="relative isolate overflow-hidden border-y border-white/70 bg-[#f3f1f5] py-14 md:py-24"
    >
      <motion.div
        aria-hidden
        style={{ y: editorialDrift }}
        className="pointer-events-none absolute -left-5 top-10 -z-10 font-display text-[8.5rem] font-semibold leading-none text-[#d8d1df]/42 md:-left-8 md:top-16 md:text-[20rem]"
      >
        Mochi
      </motion.div>
      <div className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-px bg-white/76" />
      <div className="pointer-events-none absolute right-0 top-20 -z-10 h-72 w-72 rounded-full bg-[#f2e1e7]/42 blur-3xl" />

      <div className="mx-auto grid w-full max-w-[1180px] gap-9 px-5 md:grid-cols-[0.72fr_1.28fr] md:gap-12 md:px-8">
        <div className="md:sticky md:top-10 md:h-fit">
          <Pill tone="rose">Mochi dossier</Pill>
          <h2 className="mt-4 max-w-[28rem] font-display text-[3.15rem] font-semibold leading-[0.92] text-[#343145] md:text-[4.9rem]">
            Four moods, one sharp bestie.
          </h2>
          <p className="mt-5 max-w-[23rem] text-sm font-bold leading-6 text-[#716a7e] md:text-base md:leading-7">
            A fashion companion with judgment, memory, softness, and just
            enough drama to make the outfit click.
          </p>
          <div className="mt-7 hidden h-px w-32 bg-[#c9c1cf] md:block" />
        </div>

        <div className="grid gap-8 md:grid-cols-12 md:gap-x-5 md:gap-y-11">
          <FeatureFrame
            feature={featureCards[0]}
            className="md:col-span-7"
            imageClassName="aspect-[941/1220] md:aspect-[941/1120]"
            captionClassName="md:ml-10"
          />
          <FeatureFrame
            feature={featureCards[1]}
            className="md:col-span-5 md:mt-24 md:[transform:rotate(1.2deg)]"
            imageClassName="aspect-[941/1180]"
            captionClassName="md:ml-3"
            compactCaption
          />
          <FeatureFrame
            feature={featureCards[2]}
            className="md:col-span-5 md:-mt-8 md:ml-8 md:[transform:rotate(-1.3deg)]"
            imageClassName="aspect-[941/1160]"
            captionClassName="md:ml-3"
            compactCaption
          />
          <FeatureFrame
            feature={featureCards[3]}
            className="md:col-span-7 md:mt-14"
            imageClassName="aspect-[941/980] md:aspect-[941/860]"
            captionClassName="md:ml-8"
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
  captionClassName,
  compactCaption = false,
}: {
  feature: (typeof featureCards)[number];
  className?: string;
  imageClassName?: string;
  captionClassName?: string;
  compactCaption?: boolean;
}) {
  return (
    <article className={cn("relative", className)}>
      <motion.div
        whileHover={{ scale: 1.018, y: -4 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        className={cn(
          "relative overflow-hidden rounded-[34px] bg-[#e7e4ec]/70 shadow-[0_28px_70px_rgba(44,39,60,0.16)]",
          imageClassName,
        )}
      >
        <Image
          src={feature.image}
          alt={`${feature.title} illustration`}
          fill
          sizes="(max-width: 768px) 92vw, 620px"
          className={cn("object-cover", feature.crop)}
        />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#f3f1f5]/94 via-[#f3f1f5]/34 to-transparent" />
      </motion.div>
      <div
        className={cn(
          "relative z-10 -mt-9 w-[calc(100%-1.5rem)] max-w-[24rem] border-l border-[#bdb4c8] bg-[#f9f7fa]/82 py-4 pl-4 pr-3 shadow-[0_18px_42px_rgba(44,39,60,0.1)] backdrop-blur-xl md:-mt-11 md:max-w-none md:py-5 md:pl-5",
          compactCaption ? "md:w-[min(100%,19rem)]" : "md:w-[min(92%,28rem)]",
          captionClassName,
        )}
      >
        <h3
          className={cn(
            "text-balance break-words font-display text-[2.05rem] font-semibold leading-[0.92] text-[#302d43]",
            compactCaption
              ? "md:text-[2.08rem] md:leading-[0.98]"
              : "md:text-[2.5rem]",
          )}
        >
          {feature.title}
        </h3>
        <p
          className={cn(
            "mt-3 text-sm font-bold leading-6 text-[#716a7e]",
            compactCaption ? "md:leading-6" : "md:text-base md:leading-7",
          )}
        >
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
          <div className="flex flex-wrap gap-2">
            {["playful", "honest", "remembering", "supportive"].map((trait) => (
              <Pill key={trait} tone={trait === "honest" ? "gold" : "lilac"}>
                <Star size={12} aria-hidden />
                {trait}
              </Pill>
            ))}
          </div>
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
