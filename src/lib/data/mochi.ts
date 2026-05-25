import type { LookCard, StyleIntent, VisionAnalysis } from "@/types/lumi";

export const mochiProfile = {
  id: "mochi" as const,
  name: "Mochi",
  role: "Fashion companion",
  species: "Cotton elf",
  mantra: "Fashion is made to play.",
  traits: ["playful", "stylish", "kind", "fearless"],
  palette: ["#d9c0eb", "#f6dbe7", "#fff1dc", "#a9d8d2", "#f7cd72", "#157464"],
};

export const styleIntents: Array<{
  id: StyleIntent;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: "fit-check",
    label: "Fit check",
    shortLabel: "Fit",
    description: "Read the silhouette, balance, and polish.",
  },
  {
    id: "color-match",
    label: "Color match",
    shortLabel: "Color",
    description: "Tune the palette and contrast.",
  },
  {
    id: "missing-piece",
    label: "What’s missing?",
    shortLabel: "Missing",
    description: "Find the tiny detail that makes it click.",
  },
  {
    id: "main-character",
    label: "Make it main character",
    shortLabel: "Icon",
    description: "Turn the look up with one confident move.",
  },
];

export const starterPrompts = [
  "Does this outfit work for today?",
  "Help me choose between A and B.",
  "Should I buy this piece or skip it?",
  "I want to switch up my style.",
  "Quick check before I go out.",
  "I feel low-energy. What can I wear that still feels like me?",
];

export const homeActions = [
  {
    href: "/chat",
    label: "Chat",
    detail: "Text Mochi",
    accent: "bg-[#d9c0eb]",
  },
  {
    href: "/camera",
    label: "Snap",
    detail: "Fit check",
    accent: "bg-[#f6a8c8]",
  },
];

export const demoAnalysis: VisionAnalysis = {
  id: "analysis-demo",
  intent: "main-character",
  title: "Soft Icon Energy",
  summary:
    "The outfit already has a gentle shape. Add one crisp accessory so the softness feels intentional, not sleepy.",
  palette: ["lilac", "cream", "emerald", "soft gold"],
  strengths: ["cozy texture", "balanced proportions", "easy color story"],
  suggestions: [
    "Try a cat-eye frame or tiny gold hoop to sharpen the face line.",
    "Add one emerald detail so the palette has a confident anchor.",
    "Keep the shoe chunky if the top layer is oversized.",
  ],
  mochiLine: "Good fabric. Great fit. Needs one wink of drama, darling.",
  createdAt: new Date().toISOString(),
};

export const seedLooks: LookCard[] = [
  {
    id: "look-soft-icon",
    title: "Soft Icon Errands",
    imageUrl: "/mochi/mochi-variants.webp",
    visibility: "private",
    analysis: demoAnalysis,
    tags: ["lilac", "gold", "main character"],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
];
