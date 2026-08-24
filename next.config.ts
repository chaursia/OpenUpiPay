import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Required for tesseract.js in API routes (Next.js 16+)
  serverExternalPackages: ["tesseract.js"],

  images: {
    remotePatterns: [],
  },
} as NextConfig;

export default nextConfig;
