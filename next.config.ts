import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
  cacheComponents: true,
  // Next 16 requires every non-default `quality` used by <Image> to be listed
  // here; member photos render at 90.
  images: {
    qualities: [75, 90],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
