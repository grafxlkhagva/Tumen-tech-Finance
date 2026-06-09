import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Банкны хуулга upload — default 1MB-ийн body хязгаарыг өсгөнө.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
