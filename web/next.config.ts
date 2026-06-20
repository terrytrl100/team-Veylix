import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // RainbowKit/WalletConnect deps don't bundle cleanly under Next 16 Turbopack
  // (QR encoder "invalid border" + WC module parse errors). Run on webpack and
  // externalise the optional node-only deps WalletConnect references.
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding", "@react-native-async-storage/async-storage");
    return config;
  },
};

export default nextConfig;
