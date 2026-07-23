import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@neogild/core", "@neogild/gmail"],
  serverExternalPackages: ["imapflow", "mailparser"],
};

export default nextConfig;
