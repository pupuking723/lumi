import type { NextConfig } from "next";

const agentApiBaseUrl =
  process.env.LUMI_AGENT_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:9600";
const liveWsPath =
  process.env.LUMI_AGENT_LIVE_WS_PATH ?? "/v1/closy/live/gemini/ws";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "192.168.6.239", "192.168.7.231"],
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/live/gemini/ws",
        destination: `${agentApiBaseUrl}${liveWsPath}`,
      },
    ];
  },
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
