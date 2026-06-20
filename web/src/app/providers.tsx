"use client";

import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RainbowKitProvider,
  darkTheme,
  type Theme,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { wagmiConfig } from "@/lib/wagmi";

/**
 * Veylix-flavoured RainbowKit dark theme: amber accent on a cool-ink base.
 * Kept close to the design tokens in globals.css so re-theming stays in one place.
 */
const veylixTheme: Theme = darkTheme({
  accentColor: "#f5a524",
  accentColorForeground: "#0a0e14",
  borderRadius: "medium",
  overlayBlur: "small",
});

export function Providers({ children }: { children: ReactNode }) {
  // One QueryClient per browser session; created lazily so it is stable across renders.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={veylixTheme} modalSize="compact">
          {/* @ts-expect-error — RainbowKit bundles its own @types/react; safe at runtime */}
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
