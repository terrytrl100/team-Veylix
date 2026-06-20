"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

/**
 * Wallet connect entry point for the landing page.
 *
 * Uses RainbowKit's plain <ConnectButton /> (no ConnectButton.Custom, no
 * opacity/visibility gating) — this is the reliable, recommended usage and
 * matches the known-good reference app. RainbowKit renders the button itself
 * (label "Connect Wallet" when disconnected) and handles the connect modal +
 * WalletConnect QR.
 *
 * Once a wallet connects we move the user toward the app at /app.
 */
export function GetStartedButton() {
  const router = useRouter();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (isConnected) {
      router.push("/app");
    }
  }, [isConnected, router]);

  return <ConnectButton showBalance={false} chainStatus="icon" />;
}
