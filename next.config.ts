import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
  cacheComponents: true,
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
