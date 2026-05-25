import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "192.168.6.239","192.168.7.231"],
  devIndicators: false,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
