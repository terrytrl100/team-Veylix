import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // WalletConnect pulls in `pino` (logger) transitively. Turbopack tries to
  // bundle pino/thread-stream and chokes on their non-code test fixtures
  // (.ts/.md/.zip). Keep these node-only logging deps external so they are
  // required at runtime instead of bundled.
  serverExternalPackages: ["pino", "pino-pretty", "thread-stream"],
};

export default nextConfig;
