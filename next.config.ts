import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_VERSION: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
  },
  // @sparticuz/chromium und puppeteer-core nicht bündeln — Chromium
  // sucht seine Binärdateien über absolute Pfade, die beim Bündeln
  // verschoben werden und dann nicht mehr gefunden werden.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
};

export default nextConfig;
