import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["web-push", "sharp"],
  experimental: {
    // fotos dos itens da loja enviadas pelo celular
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
