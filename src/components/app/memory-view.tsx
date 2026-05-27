"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  Camera,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { AppChrome } from "./app-chrome";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { apiClient } from "@/lib/api/client";
import type { LookCard, UserProfile } from "@/types/lumi";

const memorySummary = {
  moodCues: ["date-ready", "color curious", "low effort"],
  savedAdvice: [
    "Emerald works as your confidence anchor.",
    "Sharp glasses make cozy outfits feel intentional.",
    "Keep one chunky element when the top layer is oversized.",
  ],
};

export function MemoryView() {
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: apiClient.getMe,
  });
  const { data: looks = [] } = useQuery({
    queryKey: ["looks"],
    queryFn: apiClient.listLooks,
  });

  const latestLook = looks[0];

  return (
    <AppChrome contentScroll>
      <div className="space-y-4">
        <section className="rounded-[30px] border border-white/70 bg-white/72 p-4 soft-stitch">
          <Pill tone="emerald">Memory layer</Pill>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-none text-[#343145]">
            Mochi remembers you
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#716a7e]">
            Style notes, boundaries, and recent cues stay ready for the next
            chat.
          </p>
        </section>

        <StyleMemoryCard profile={me} />

        <RecentContextCard
          latestLook={latestLook}
          moodCues={memorySummary.moodCues}
        />

        <SavedAdviceCard advice={memorySummary.savedAdvice} />

        <Button className="w-full">
          <Sparkles size={17} aria-hidden />
          Ask Mochi to update memory
        </Button>
      </div>
    </AppChrome>
  );
}

function StyleMemoryCard({ profile }: { profile?: UserProfile }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<{
    vibe: string;
    colors: string;
    avoidNotes: string;
  }>();
  const [hasSaved, setHasSaved] = useState(false);
  const form = draft ?? {
    vibe: profile?.styleProfile.vibe ?? "",
    colors: profile?.styleProfile.favoriteColors.join(", ") ?? "",
    avoidNotes: profile?.styleProfile.avoidNotes.join(", ") ?? "",
  };

  const updateField =
    (field: keyof typeof form) =>
    (value: string) => {
      setDraft((current) => ({
        ...(current ?? form),
        [field]: value,
      }));
      setHasSaved(false);
    };

  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient.updateStyleProfile({
        vibe: form.vibe.trim() || "soft icon",
        favoriteColors: form.colors
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        avoidNotes: form.avoidNotes
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    onSuccess: async () => {
      setHasSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  return (
    <section className="rounded-[28px] border border-white/70 bg-white/72 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-[#343145]">
            Style memory
          </h2>
          <p className="mt-1 text-xs font-bold leading-5 text-[#8c7897]">
            Mochi uses these notes to make outfit advice feel more like you.
          </p>
        </div>
        {hasSaved && <Pill tone="mint">Saved</Pill>}
      </div>
      <div className="space-y-2">
        <MemoryInput
          label="Style summary"
          value={form.vibe}
          onChange={updateField("vibe")}
          placeholder="soft icon, relaxed, clean"
        />
        <MemoryInput
          label="Favorite colors"
          value={form.colors}
          onChange={updateField("colors")}
          placeholder="lilac, cream, emerald"
        />
        <MemoryInput
          label="Avoid"
          value={form.avoidNotes}
          onChange={updateField("avoidNotes")}
          placeholder="body shaming, diet talk"
        />
      </div>
      <div className="mt-3 rounded-[18px] bg-[#f6f5f7] px-3 py-2">
        <p className="text-[0.68rem] font-extrabold uppercase text-[#5f586f]">
          Privacy
        </p>
        <p className="mt-0.5 text-sm font-extrabold text-[#242235]">
          {profile?.styleProfile.sizesPrivate ?? true
            ? "Sizes stay private"
            : "Sizes can be used in advice"}
        </p>
      </div>
      <Button
        className="mt-3 w-full"
        disabled={saveMutation.isPending}
        onClick={() => saveMutation.mutate()}
      >
        <Sparkles size={17} aria-hidden />
        {saveMutation.isPending ? "Saving..." : "Save Mochi memory"}
      </Button>
    </section>
  );
}

function RecentContextCard({
  latestLook,
  moodCues,
}: {
  latestLook?: LookCard;
  moodCues: string[];
}) {
  return (
    <section className="rounded-[28px] border border-white/70 bg-white/72 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera size={18} className="text-[#b99955]" aria-hidden />
          <h2 className="text-sm font-extrabold text-[#343145]">
            Recent context
          </h2>
        </div>
        <Link
          href="/looks"
          className="inline-flex items-center gap-1 text-xs font-extrabold text-[#5f586f]"
        >
          All
          <ChevronRight size={14} aria-hidden />
        </Link>
      </div>
      <div className="mt-3 rounded-[22px] bg-[#f6f5f7] p-3">
        <p className="text-[0.68rem] font-extrabold uppercase text-[#5f586f]">
          Latest look
        </p>
        <p className="mt-1 text-base font-extrabold text-[#242235]">
          {latestLook?.title ?? "No saved looks yet"}
        </p>
        <p className="mt-1 text-sm font-semibold leading-5 text-[#716a7e]">
          {latestLook?.analysis.mochiLine ??
            "Snap an outfit and Mochi will remember the key style notes."}
        </p>
      </div>
      <div className="mt-3">
        <p className="text-[0.68rem] font-extrabold uppercase text-[#5f586f]">
          Mood cues
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {moodCues.map((cue) => (
            <Pill key={cue} tone="mint">
              {cue}
            </Pill>
          ))}
        </div>
      </div>
    </section>
  );
}

function SavedAdviceCard({ advice }: { advice: string[] }) {
  return (
    <section className="rounded-[28px] border border-white/70 bg-white/72 p-4">
      <div className="flex items-center gap-2">
        <Bookmark size={17} className="text-[#b99955]" aria-hidden />
        <h2 className="text-sm font-extrabold text-[#343145]">Saved advice</h2>
      </div>
      <div className="mt-3 space-y-2">
        {advice.slice(0, 2).map((suggestion) => (
          <p
            key={suggestion}
            className="rounded-[18px] bg-[#f6f5f7] px-3 py-2 text-sm font-semibold leading-5 text-[#716a7e]"
          >
            {suggestion}
          </p>
        ))}
      </div>
    </section>
  );
}

function MemoryInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.68rem] font-extrabold uppercase text-[#5f586f]">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-[18px] border border-white/78 bg-[#f6f5f7]/78 px-3 text-sm font-bold text-[#242235] outline-none placeholder:text-[#aaa2b5]"
      />
    </label>
  );
}
