"use client";

import Image from "next/image";
import { ChangeEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, ImageUp, Lock, Save, Sparkles } from "lucide-react";
import { AppChrome } from "./app-chrome";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { apiClient } from "@/lib/api/client";
import { styleIntents } from "@/lib/data/mochi";
import { getOrCreateMochiSessionId } from "@/lib/session/mochi-session";
import { cn } from "@/lib/utils";
import type { OotdReview, StyleIntent, VisionAnalysis } from "@/types/lumi";

export function CameraView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [intent, setIntent] = useState<StyleIntent>("fit-check");
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [analysis, setAnalysis] = useState<VisionAnalysis | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => apiClient.uploadAttachment(file),
    onSuccess: (uploaded) => {
      setMediaId(uploaded.media_id);
      setUploadError("");
    },
    onError: () => {
      setMediaId("");
      setUploadError("Mochi could not upload that image. Try again.");
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (mediaId) {
        const review = await apiClient.submitOotdReview({
          media_id: mediaId,
          session_id: getOrCreateMochiSessionId(),
          occasion: styleIntents.find((item) => item.id === intent)?.label,
          note: fileName,
        });
        return ootdReviewToAnalysis(review, intent);
      }

      return apiClient.analyzeVision({
        intent,
        imageName: fileName,
        imageUrl: previewUrl,
      });
    },
    onSuccess: setAnalysis,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient.createLook({
        title: analysis?.title ?? "Mochi fit check",
        imageUrl: previewUrl || "/mochi/mochi-main.webp",
        analysis: analysis as VisionAnalysis,
        visibility: "private",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["looks"] });
      router.push("/looks");
    },
  });

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setMediaId("");
    setUploadError("");
    setAnalysis(null);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(String(reader.result));
    reader.readAsDataURL(file);
    uploadMutation.mutate(file);
  };

  return (
    <AppChrome>
      <div className="space-y-4">
        <section className="rounded-[32px] border border-white/75 bg-white/74 p-4 soft-stitch">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <Pill tone="emerald">Visual styling</Pill>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[#343145]">
                Snap the look
              </h1>
            </div>
            <Camera className="text-[#5f586f]" aria-hidden />
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-[28px] border border-dashed border-[#cdb6d8] bg-[#edeaf1]"
          >
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt="Selected outfit preview"
                fill
                sizes="(max-width: 768px) 92vw, 430px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex flex-col items-center px-8 text-center">
                <ImageUp size={34} className="text-[#5f586f]" aria-hidden />
                <p className="mt-3 text-base font-extrabold text-[#343145]">
                  Upload or capture an outfit
                </p>
                <p className="mt-1 text-sm font-bold leading-5 text-[#8c7897]">
                  Photos are treated as private styling context in this MVP.
                </p>
              </div>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onFileChange}
          />
        </section>

        <section className="grid grid-cols-2 gap-2">
          {styleIntents.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIntent(item.id)}
              className={cn(
                "rounded-[22px] border p-3 text-left transition",
                intent === item.id
                  ? "border-[#5f586f] bg-[#e6e4ea]"
                  : "border-white/70 bg-white/70",
              )}
            >
              <span className="flex items-center justify-between text-sm font-extrabold text-[#343145]">
                {item.label}
                {intent === item.id && <Check size={16} aria-hidden />}
              </span>
              <span className="mt-1 block text-xs font-bold leading-5 text-[#8c7897]">
                {item.description}
              </span>
            </button>
          ))}
        </section>

        <Button
          size="lg"
          className="w-full"
          disabled={
            !previewUrl ||
            uploadMutation.isPending ||
            Boolean(uploadError) ||
            analyzeMutation.isPending
          }
          onClick={() => analyzeMutation.mutate()}
        >
          <Sparkles size={18} aria-hidden />
          {uploadMutation.isPending
            ? "Uploading OOTD..."
            : analyzeMutation.isPending
              ? "Mochi is looking..."
              : "Ask Mochi"}
        </Button>

        {uploadError && (
          <section className="rounded-[24px] border border-[#ffd1dc] bg-[#fff0f2] p-3 text-sm font-bold leading-6 text-[#a4445c]">
            {uploadError}
          </section>
        )}

        {analysis && (
          <section className="rounded-[30px] border border-white/78 bg-white/78 p-4 soft-stitch">
            <Pill tone="gold">{analysis.title}</Pill>
            <p className="mt-3 text-lg font-extrabold leading-7 text-[#242235]">
              {analysis.mochiLine}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#716a7e]">
              {analysis.summary}
            </p>
            <div className="mt-4 space-y-2">
              {analysis.suggestions.map((suggestion) => (
                <div
                  key={suggestion}
                  className="rounded-[18px] bg-[#f6f5f8] px-3 py-2 text-sm font-bold leading-5 text-[#5f586f]"
                >
                  {suggestion}
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-[18px] bg-[#effaf6] px-3 py-2 text-xs font-extrabold text-[#157464]">
              <Lock size={14} aria-hidden />
              Saved looks default to private.
            </div>
            <Button
              className="mt-4 w-full"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              <Save size={17} aria-hidden />
              {saveMutation.isPending ? "Saving..." : "Save look"}
            </Button>
          </section>
        )}
      </div>
    </AppChrome>
  );
}

function ootdReviewToAnalysis(
  review: OotdReview,
  intent: StyleIntent,
): VisionAnalysis {
  return {
    id: review.id,
    intent,
    title: review.style_label
      ? `${review.style_label}: ${review.overall_judgement}`
      : review.overall_judgement,
    summary: `${review.highlight} ${review.main_issue}`,
    palette: review.style_label ? [review.style_label] : ["ootd"],
    strengths: [review.highlight],
    suggestions: [review.suggestion],
    mochiLine: review.mochi_line,
    createdAt: review.createdAt,
  };
}
