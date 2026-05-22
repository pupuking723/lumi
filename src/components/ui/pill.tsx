import { cn } from "@/lib/utils";

export function Pill({
  children,
  tone = "lilac",
  className,
}: {
  children: React.ReactNode;
  tone?: "lilac" | "emerald" | "gold" | "rose" | "mint";
  className?: string;
}) {
  const tones = {
    lilac: "border border-white/76 bg-[#e7e4ec]/72 text-[#5f586f]",
    emerald: "border border-white/76 bg-[#dcecea]/72 text-[#157464]",
    gold: "border border-white/76 bg-[#f2ead8]/78 text-[#84662b]",
    rose: "border border-white/76 bg-[#f2e1e7]/74 text-[#8b5264]",
    mint: "border border-white/76 bg-[#e2eeeb]/74 text-[#2f716b]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold shadow-[0_1px_0_rgba(255,255,255,0.82)_inset] backdrop-blur-xl",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
