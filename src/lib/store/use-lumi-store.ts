"use client";

import { create } from "zustand";
import type { LiveSession, LiveSessionStatus } from "@/types/lumi";

interface LumiState {
  liveStatus: LiveSessionStatus;
  liveSession?: LiveSession;
  selectedVibe: string;
  setLiveStatus: (status: LiveSessionStatus) => void;
  setLiveSession: (session?: LiveSession) => void;
  setSelectedVibe: (vibe: string) => void;
}

export const useLumiStore = create<LumiState>((set) => ({
  liveStatus: "idle",
  selectedVibe: "soft icon",
  setLiveStatus: (liveStatus) => set({ liveStatus }),
  setLiveSession: (liveSession) => set({ liveSession }),
  setSelectedVibe: (selectedVibe) => set({ selectedVibe }),
}));
