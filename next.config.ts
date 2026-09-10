import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit loads its font-metric (.afm) files from disk at runtime, so it must
  // not be bundled — keep it external to the server build.
  serverExternalPackages: ["pdfkit"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
