import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@what-if/engine"],
  // The local build (a 2-core machine) skips its own TS pass; the CI typecheck
  // runs it properly with `next typegen` + `tsc --noEmit`.
  typescript: { ignoreBuildErrors: process.env.SAAS_FAST_BUILD === "1" },
};

export default nextConfig;
