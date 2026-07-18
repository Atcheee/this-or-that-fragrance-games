import type { NextConfig } from "next";
import path from "node:path";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Scripts/styles are left to Next.js defaults (a stricter CSP needs nonce
  // wiring); these directives are safe to enforce and block object embeds,
  // base-tag hijacking, and clickjacking.
  {
    key: "Content-Security-Policy",
    value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  },
];

const nextConfig: NextConfig = {
  // The workspace path contains spaces ("This or that"); pin the Turbopack
  // root so Next doesn't mis-infer it from a nested directory.
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
