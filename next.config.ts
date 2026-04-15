import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Extend dev server timeout for long-running API routes (podcast TTS generation)
  devIndicators: false,
  serverExternalPackages: ["pg"],
  experimental: {
    proxyTimeout: 300_000, // 5 min proxy timeout for dev server
  },
};

export default nextConfig;
