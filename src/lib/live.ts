import type { LiveSessionStatus } from "@/types/lumi";

export const liveStatusCopy: Record<
  LiveSessionStatus,
  { title: string; body: string; cta: string }
> = {
  idle: {
    title: "Mochi is waiting by the mirror",
    body: "Start a voice styling session when your hands are busy with hangers.",
    cta: "Start live",
  },
  permission: {
    title: "Asking for the mic",
    body: "Lumi only needs audio while the session is open.",
    cta: "Allow mic",
  },
  connecting: {
    title: "Threading the call",
    body: "Mochi is pulling up your style memory.",
    cta: "Connecting",
  },
  listening: {
    title: "Mochi is listening",
    body: "Ask about colors, layers, shoes, or the final little charm.",
    cta: "Listening",
  },
  responding: {
    title: "Mochi is styling",
    body: "A tiny opinion is being stitched together.",
    cta: "Responding",
  },
  reconnecting: {
    title: "Reconnecting",
    body: "Keeping the mirror warm while the signal comes back.",
    cta: "Reconnect",
  },
  ended: {
    title: "Session wrapped",
    body: "Save the thought, change the shoes, go be seen.",
    cta: "Start again",
  },
  error: {
    title: "Mic access paused",
    body: "Check browser permissions or try again in a calmer tab.",
    cta: "Try again",
  },
};

export function getLiveStatusCopy(status: LiveSessionStatus) {
  return liveStatusCopy[status];
}
