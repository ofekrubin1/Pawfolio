import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Pages load their data in the browser (Supabase + RLS), so dev-time "instant navigation"
  // checks only run where a segment opts in with `export const instant`.
  // Local phone testing: forward /sb/* to the local Supabase (see NEXT_PUBLIC_SUPABASE_VIA_APP).
  async rewrites() {
    return process.env.SUPABASE_PROXY_TARGET
      ? [{ source: "/sb/:path*", destination: `${process.env.SUPABASE_PROXY_TARGET}/:path*` }]
      : [];
  },
  experimental: {
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
