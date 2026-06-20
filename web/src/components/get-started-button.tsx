"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";

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

        if (!connected) {
          return (
            <Button
              onClick={openConnectModal}
              className="bg-accent text-[#0a0e14] hover:bg-accent/90 px-5 py-2.5 text-sm font-semibold sm:px-6 sm:py-3 sm:text-base"
            >
              Get Started
            </Button>
          );
        }

        if (chain.unsupported) {
          return (
            <Button
              onClick={openChainModal}
              className="bg-downside text-[#0a0e14] hover:bg-downside/90 px-5 py-2.5 sm:px-6 sm:py-3 sm:text-base"
            >
              Wrong network
            </Button>
          );
        }

        return (
          <Button
            variant="outline"
            onClick={openAccountModal}
            className="border-border bg-surface text-foreground hover:bg-surface-2 font-mono px-5 py-2.5 sm:px-6 sm:py-3 sm:text-base"
          >
            {account.displayName}
          </Button>
        );
      }}
    </ConnectButton.Custom>
  );
}
