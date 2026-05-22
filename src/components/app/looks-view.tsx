"use client";

import Image from "next/image";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Link as LinkIcon, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { AppChrome } from "./app-chrome";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { apiClient } from "@/lib/api/client";

export function LooksView() {
  const { data: looks = [], isLoading } = useQuery({
    queryKey: ["looks"],
    queryFn: apiClient.listLooks,
  });
  const [visibility, setVisibility] = useState<Record<string, "private" | "public">>(
    {},
  );
  const [links, setLinks] = useState<Record<string, string>>({});

  const shareMutation = useMutation({
    mutationFn: apiClient.createShareLink,
    onSuccess: (link) =>
      setLinks((current) => ({
        ...current,
        [link.lookId]: link.url,
      })),
  });

  return (
    <AppChrome>
      <div className="space-y-4">
        <section className="flex items-center justify-between rounded-[28px] border border-white/70 bg-white/70 p-4">
          <div>
            <Pill tone="rose">Style diary</Pill>
            <h1 className="mt-2 font-display text-4xl font-semibold text-[#343145]">
              Saved looks
            </h1>
          </div>
          <Link
            href="/camera"
            className="flex size-12 items-center justify-center rounded-[20px] bg-[#242235] text-white"
            aria-label="Create new look"
          >
            <Plus aria-hidden />
          </Link>
        </section>

        {isLoading && (
          <div className="rounded-[24px] border border-white/70 bg-white/70 p-4 text-sm font-bold text-[#716a7e]">
            Pulling outfits from the tiny archive...
          </div>
        )}

        <div className="space-y-3">
          {looks.map((look) => {
            const currentVisibility = visibility[look.id] ?? look.visibility;
            return (
              <article
                key={look.id}
                className="overflow-hidden rounded-[30px] border border-white/75 bg-white/76 soft-stitch"
              >
                <div className="relative aspect-[5/4] bg-[#edeaf1]">
                  {look.imageUrl ? (
                    <Image
                      src={look.imageUrl}
                      alt={look.title}
                      fill
                      sizes="(max-width: 768px) 92vw, 430px"
                      className="object-cover"
                      unoptimized={
                        look.imageUrl.startsWith("blob:") ||
                        look.imageUrl.startsWith("data:")
                      }
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[#5f586f]">
                      <Sparkles aria-hidden />
                    </div>
                  )}
                  <div className="absolute left-3 top-3">
                    <Pill tone={currentVisibility === "private" ? "lilac" : "emerald"}>
                      {currentVisibility}
                    </Pill>
                  </div>
                </div>
                <div className="p-4">
                  <h2 className="text-xl font-extrabold text-[#242235]">
                    {look.title}
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#716a7e]">
                    {look.analysis.mochiLine}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {look.tags.slice(0, 4).map((tag) => (
                      <Pill key={tag} tone="mint">
                        {tag}
                      </Pill>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setVisibility((current) => ({
                          ...current,
                          [look.id]:
                            currentVisibility === "private" ? "public" : "private",
                        }))
                      }
                    >
                      {currentVisibility === "private" ? (
                        <EyeOff size={16} aria-hidden />
                      ) : (
                        <Eye size={16} aria-hidden />
                      )}
                      {currentVisibility === "private" ? "Private" : "Public"}
                    </Button>
                    <Button
                      onClick={() => shareMutation.mutate(look.id)}
                      disabled={shareMutation.isPending}
                    >
                      <LinkIcon size={16} aria-hidden />
                      Share
                    </Button>
                  </div>
                  {links[look.id] && (
                    <p className="mt-3 break-all rounded-[18px] bg-[#edeaf1] px-3 py-2 text-xs font-bold text-[#5f586f]">
                      {links[look.id]}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </AppChrome>
  );
}
