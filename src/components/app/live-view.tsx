"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff, PhoneOff, RefreshCw, Sparkles } from "lucide-react";
import { AppChrome } from "./app-chrome";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { apiClient } from "@/lib/api/client";
import { getLiveStatusCopy } from "@/lib/live";
import { useLumiStore } from "@/lib/store/use-lumi-store";
import type { LiveSessionStatus } from "@/types/lumi";

export function LiveView() {
  const { liveStatus, setLiveSession, setLiveStatus } = useLumiStore();
  const timers = useRef<number[]>([]);
  const copy = getLiveStatusCopy(liveStatus);

  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const queueStatus = (status: LiveSessionStatus, ms: number) => {
    const timer = window.setTimeout(() => setLiveStatus(status), ms);
    timers.current.push(timer);
  };

  const startLive = async () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    setLiveStatus("permission");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone is not available in this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setLiveStatus("connecting");
      const session = await apiClient.createLiveSession();
      setLiveSession(session);
      queueStatus("listening", 720);
      queueStatus("responding", 3900);
      queueStatus("listening", 6800);
    } catch {
      setLiveStatus("error");
    }
  };

  const endLive = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    setLiveStatus("ended");
    setLiveSession(undefined);
  };

  const reconnect = () => {
    setLiveStatus("reconnecting");
    queueStatus("listening", 900);
  };

  const active =
    liveStatus === "listening" ||
    liveStatus === "responding" ||
    liveStatus === "connecting" ||
    liveStatus === "reconnecting";

  return (
    <AppChrome>
      <div className="space-y-4">
        <section className="relative overflow-hidden rounded-[34px] border border-white/75 bg-[#242235] p-5 text-white shadow-[0_24px_70px_rgba(51,36,63,0.25)]">
          <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_50%_0%,rgba(217,192,235,0.45),transparent_62%)]" />
          <div className="relative">
            <Pill tone="gold">Realtime voice</Pill>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-none">
              {copy.title}
            </h1>
            <p className="mt-3 max-w-[18rem] text-sm font-bold leading-6 text-[#f4e7f7]">
              {copy.body}
            </p>
          </div>

          <div className="relative my-10 flex justify-center">
            <div className="flex size-52 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-[0_0_80px_rgba(217,192,235,0.32)]">
              <div className="flex size-36 items-end justify-center gap-2 rounded-full bg-[#f6f5f7] px-8 py-9 text-[#5f586f]">
                {[0, 1, 2, 3, 4].map((bar) => (
                  <span
                    key={bar}
                    className="wave-bar w-3 rounded-full bg-[#5f586f]"
                    style={{
                      height: `${34 + bar * 9}px`,
                      animationDelay: `${bar * 0.1}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="relative grid grid-cols-2 gap-2">
            <Button
              onClick={active ? endLive : startLive}
              className="bg-white text-[#242235] hover:bg-[#edeaf1]"
            >
              {active ? <PhoneOff size={18} /> : <Mic size={18} />}
              {active ? "End" : copy.cta}
            </Button>
            <Button
              variant="secondary"
              onClick={liveStatus === "error" ? startLive : reconnect}
              disabled={liveStatus === "idle" || liveStatus === "permission"}
              className="border-white/25 bg-white/12 text-white hover:bg-white/18"
            >
              <RefreshCw size={17} />
              Reconnect
            </Button>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/70 bg-white/72 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#343145]">
            <Sparkles size={17} className="text-[#b99955]" aria-hidden />
            Mochi live notes
          </div>
          <div className="space-y-2 text-sm font-bold leading-6 text-[#716a7e]">
            <p>“Show me the shoe before we blame the dress.”</p>
            <p>“One texture can whisper. Two textures can flirt.”</p>
            <p>“No body critique. We style the outfit, darling.”</p>
          </div>
        </section>

        {liveStatus === "error" && (
          <section className="rounded-[24px] border border-[#ffd1dc] bg-[#fff0f2] p-4 text-sm font-bold leading-6 text-[#a4445c]">
            <MicOff className="mb-2" size={20} aria-hidden />
            Microphone permission is required for Live. Browser support is
            checked before creating a backend session.
          </section>
        )}
      </div>
    </AppChrome>
  );
}
