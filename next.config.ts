import type { NextConfig } from "next";

// Security headers on every page: no framing by other sites (clickjacking), no MIME guessing, no full URLs leaked
// to other sites in the Referer header. Pages get the full Content Security Policy from src/middleware.ts, because it
// carries a fresh nonce on every request, and it replaces the short one below. The short one still covers API replies
// and static files, which the middleware skips.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers: async () => [{ source: "/:path*", headers: securityHeaders }],
  // NEXT_DIST_DIR lets a production build run beside the dev server without touching its .next folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
