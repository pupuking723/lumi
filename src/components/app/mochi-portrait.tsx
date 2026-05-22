import Image from "next/image";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function MochiPortrait({
  variant = "main",
  priority = false,
  className,
}: {
  variant?: "main" | "variants";
  priority?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border border-white/80 bg-white/50 soft-stitch",
        className,
      )}
    >
      <Image
        src={variant === "main" ? "/mochi/mochi-main.png" : "/mochi/mochi-variants.png"}
        alt={
          variant === "main"
            ? "Mochi cotton elf character reference"
            : "Mochi hair and frame variants reference"
        }
        fill
        priority={priority}
        sizes="(max-width: 768px) 92vw, 430px"
        className="object-cover"
        style={{
          objectPosition: variant === "main" ? "33% 46%" : "50% 30%",
        }}
      />
      <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/82 bg-[#fbfafc]/72 px-3 py-1 text-xs font-extrabold text-[#5f586f] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] backdrop-blur-xl">
        <Sparkles size={13} aria-hidden />
        Mochi
      </div>
    </div>
  );
}
