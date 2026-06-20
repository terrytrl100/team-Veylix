"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

/**
 * Wallet connect entry point for the landing page.
 *
 * Uses RainbowKit's ConnectButton.Custom ONLY to relabel the disconnected
 * button to "Get Started" — the real RainbowKit connect modal (incl.
 * WalletConnect QR) is still used underneath via openConnectModal.
 *
 * IMPORTANT: unlike the earlier broken version, this does NOT gate the button's
 * visibility on RainbowKit's `mounted` flag (that left the button invisible).
 * The button always renders; we only swap the label/handler based on state.
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

  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openAccountModal, openChainModal }) => {
        const connected = account && chain;

        const base =
          "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

        if (!connected) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className={`${base} bg-accent text-[#0a0e14] hover:opacity-90`}
            >
              Get Started
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className={`${base} bg-downside text-[#0a0e14] hover:opacity-90`}
            >
              Wrong network
            </button>
          );
        }

        return (
          <button
            type="button"
            onClick={openAccountModal}
            className={`${base} border border-border bg-surface text-foreground hover:bg-surface-2 font-mono`}
          >
            {account.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
