"use client";

import { useEffect, useRef } from "react";
import { signIn, useSession } from "next-auth/react";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          cancel: () => void;
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            use_fedcm_for_prompt?: boolean;
            ux_mode?: "popup" | "redirect";
          }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GIS_SCRIPT_ID = "google-identity-services";

function loadGoogleIdentityServices() {
  return new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(GIS_SCRIPT_ID) as
      | HTMLScriptElement
      | null;
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GIS_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject();
    document.head.appendChild(script);
  });
}

export function GoogleOneTap() {
  const { status, update } = useSession();
  const initializedRef = useRef(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const oneTapEnabled = process.env.NEXT_PUBLIC_GOOGLE_ONE_TAP_ENABLED === "true";

  useEffect(() => {
    if (
      !oneTapEnabled ||
      !clientId ||
      status !== "unauthenticated" ||
      initializedRef.current
    ) {
      return;
    }

    let cancelled = false;

    loadGoogleIdentityServices()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id) return;

        initializedRef.current = true;
        window.google.accounts.id.initialize({
          client_id: clientId,
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: false,
          ux_mode: "popup",
          callback: async ({ credential }) => {
            if (!credential) return;

            const result = await signIn("google-one-tap", {
              credential,
              redirect: false,
            });
            if (result?.ok) await update();
          },
        });
        window.google.accounts.id.prompt();
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [clientId, oneTapEnabled, status, update]);

  return null;
}
