import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // NEXT_DIST_DIR lets a production build run beside the dev server without touching its .next folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
