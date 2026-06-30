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
  // @vercel/nft (Vercels File-Tracer) übersieht die dynamisch geladenen
  // Binärdateien in @sparticuz/chromium/bin (chromium.br, ~62 MB etc.),
  // weil sie nicht statisch importiert werden. Ohne diesen Eintrag fehlt
  // das komplette bin/-Verzeichnis im Lambda-Bundle → Error 500.
  outputFileTracingIncludes: {
    '/api/generate-pdf': ['./node_modules/@sparticuz/chromium/**/*'],
  },
};

export default nextConfig;
