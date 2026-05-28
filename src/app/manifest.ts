import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lumi",
    short_name: "Lumi",
    description:
      "AI outfit companion with Mochi for chat, live voice, and camera styling.",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf3",
    theme_color: "#f7eff9",
    icons: [
      {
        src: "/icons/lumi-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icons/lumi-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
}
