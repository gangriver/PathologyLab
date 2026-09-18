import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  serverExternalPackages: ["node:sqlite", "pdfjs-dist"],
  outputFileTracingIncludes: { "/api/papers/**": ["./lib/pdf-worker.mjs", "./lib/pdf-basic-info.mjs", "./node_modules/pdfjs-dist/**/*"] },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
    ] }];
  },
};
export default nextConfig;
