"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MochiPortrait } from "./mochi-portrait";
import { Pill } from "@/components/ui/pill";
import { apiClient } from "@/lib/api/client";

const colorOptions = ["lilac", "cream", "emerald", "rose", "denim", "soft gold"];

export function OnboardingView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [colors, setColors] = useState(["lilac", "emerald"]);
  const mutation = useMutation({
    mutationFn: () => apiClient.updateStyleProfile({ favoriteColors: colors }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.push("/");
    },
  });

  return (
    <main className="min-h-screen lumi-grain px-4 py-[calc(1.2rem+env(safe-area-inset-top))]">
      <div className="mx-auto max-w-[480px] space-y-4">
        <section className="rounded-[34px] border border-white/75 bg-white/74 p-4 soft-stitch">
          <MochiPortrait priority className="min-h-[330px]" />
          <Pill tone="gold" className="mt-4">
            Welcome to Lumi
          </Pill>
          <h1 className="mt-3 font-display text-5xl font-semibold leading-none text-[#343145]">
            Meet Mochi, your tiny fashion witness.
          </h1>
          <p className="mt-3 text-base font-semibold leading-7 text-[#716a7e]">
            Pick a few colors she should remember. Backend persona can replace
            this later; the front end keeps the ritual.
          </p>
        </section>

        <section className="rounded-[28px] border border-white/70 bg-white/70 p-4">
          <h2 className="text-sm font-extrabold text-[#343145]">
            Favorite color energy
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {colorOptions.map((color) => {
              const selected = colors.includes(color);
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() =>
                    setColors((current) =>
                      selected
                        ? current.filter((item) => item !== color)
                        : [...current, color],
                    )
                  }
                  className={`rounded-[20px] border px-3 py-3 text-left text-sm font-extrabold ${
                    selected
                      ? "border-[#5f586f] bg-[#e6e4ea] text-[#343145]"
                      : "border-white/78 bg-white/62 text-[#716a7e]"
                  }`}
                >
                  {color}
                </button>
              );
            })}
          </div>
        </section>

        <Button
          size="lg"
          className="w-full"
          disabled={mutation.isPending || colors.length === 0}
          onClick={() => mutation.mutate()}
        >
          <Sparkles size={18} aria-hidden />
          {mutation.isPending ? "Threading profile..." : "Enter Lumi"}
          <ArrowRight size={18} aria-hidden />
        </Button>
      </div>
    </main>
  );
}
