import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@neogild/core", "@neogild/gmail"],
  serverExternalPackages: ["imapflow", "mailparser"],
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
