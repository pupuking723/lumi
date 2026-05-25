"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  Camera,
  ChevronRight,
  Heart,
  Palette,
  Sparkles,
} from "lucide-react";
import { AppChrome } from "./app-chrome";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { apiClient } from "@/lib/api/client";
import type { UserProfile } from "@/types/lumi";

const stateKeywords = ["soft icon", "date-ready", "color curious", "low effort"];
const savedSuggestions = [
  "Emerald works as your confidence anchor.",
  "Sharp glasses make cozy outfits feel intentional.",
  "Keep one chunky element when the top layer is oversized.",
];

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
            Your repeated style notes, preferences, and recent mood live here so
            the next chat does not start from zero.
          </p>
        </section>

        <MemoryEditor key={me?.id ?? "empty"} profile={me} />

        <section className="rounded-[28px] border border-white/70 bg-white/72 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Palette size={18} className="text-[#5f586f]" aria-hidden />
            <h2 className="text-sm font-extrabold text-[#343145]">Style profile</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MemoryStat label="Current vibe" value={me?.styleProfile.vibe ?? "soft icon"} />
            <MemoryStat label="Privacy" value="sizes private" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(me?.styleProfile.favoriteColors ?? ["lilac", "cream", "emerald"]).map(
              (color) => (
                <Pill key={color} tone={color === "emerald" ? "emerald" : "lilac"}>
                  {color}
                </Pill>
              ),
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/70 bg-white/72 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera size={18} className="text-[#b99955]" aria-hidden />
              <h2 className="text-sm font-extrabold text-[#343145]">
                Recently discussed look
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
          <div className="mt-3 rounded-[22px] bg-[#edeaf1] p-3">
            <p className="text-base font-extrabold text-[#242235]">
              {latestLook?.title ?? "No saved looks yet"}
            </p>
            <p className="mt-1 text-sm font-semibold leading-5 text-[#716a7e]">
              {latestLook?.analysis.mochiLine ??
                "Snap an outfit and Mochi will remember the key style notes."}
            </p>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/70 bg-white/72 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Heart size={18} className="text-[#dba9b9]" aria-hidden />
            <h2 className="text-sm font-extrabold text-[#343145]">
              Remembered preferences
            </h2>
          </div>
          <div className="space-y-2">
            {(me?.styleProfile.avoidNotes ?? []).map((note) => (
              <div
                key={note}
                className="rounded-[18px] bg-[#f6f5f8] px-3 py-2 text-sm font-bold text-[#5f586f]"
              >
                Avoid: {note}
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-[0.9fr_1.1fr] gap-3">
          <div className="rounded-[26px] border border-[#d7eadf] bg-[#effaf6] p-4">
            <h2 className="text-sm font-extrabold text-[#157464]">
              Recent state keywords
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {stateKeywords.map((keyword) => (
                <Pill key={keyword} tone="mint">
                  {keyword}
                </Pill>
              ))}
            </div>
          </div>
          <div className="rounded-[26px] border border-white/70 bg-white/72 p-4">
            <div className="flex items-center gap-2">
              <Bookmark size={17} className="text-[#b99955]" aria-hidden />
              <h2 className="text-sm font-extrabold text-[#343145]">
                Saved advice
              </h2>
            </div>
            <div className="mt-3 space-y-2">
              {savedSuggestions.slice(0, 2).map((suggestion) => (
                <p
                  key={suggestion}
                  className="text-sm font-semibold leading-5 text-[#716a7e]"
                >
                  {suggestion}
                </p>
              ))}
            </div>
          </div>
        </section>

        <Button className="w-full">
          <Sparkles size={17} aria-hidden />
          Ask Mochi to refresh my memory
        </Button>
      </div>
    </AppChrome>
  );
}

function MemoryEditor({ profile }: { profile?: UserProfile }) {
  const queryClient = useQueryClient();
  const [vibe, setVibe] = useState(profile?.styleProfile.vibe ?? "");
  const [colors, setColors] = useState(
    profile?.styleProfile.favoriteColors.join(", ") ?? "",
  );
  const [avoidNotes, setAvoidNotes] = useState(
    profile?.styleProfile.avoidNotes.join(", ") ?? "",
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient.updateStyleProfile({
        vibe: vibe.trim() || "soft icon",
        favoriteColors: colors
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        avoidNotes: avoidNotes
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  return (
    <section className="rounded-[28px] border border-white/70 bg-white/72 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-[#343145]">
            Edit style memory
          </h2>
          <p className="mt-1 text-xs font-bold leading-5 text-[#8c7897]">
            Mochi uses these notes to make outfit advice feel more like you.
          </p>
        </div>
        {saveMutation.isSuccess && (
          <Pill tone="mint">Saved</Pill>
        )}
      </div>
      <div className="space-y-2">
        <MemoryInput
          label="Style summary"
          value={vibe}
          onChange={setVibe}
          placeholder="soft icon, relaxed, clean"
        />
        <MemoryInput
          label="Favorite colors"
          value={colors}
          onChange={setColors}
          placeholder="lilac, cream, emerald"
        />
        <MemoryInput
          label="Avoid"
          value={avoidNotes}
          onChange={setAvoidNotes}
          placeholder="body shaming, diet talk"
        />
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

function MemoryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-[#f6f5f7] px-3 py-3">
      <p className="text-[0.68rem] font-extrabold uppercase text-[#5f586f]">
        {label}
      </p>
      <p className="mt-1 text-sm font-extrabold text-[#242235]">{value}</p>
    </div>
  );
}
