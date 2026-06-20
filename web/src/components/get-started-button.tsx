"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

/**
 * "Get Started" call-to-action for the landing top nav.
 *
 * Uses RainbowKit's headless ConnectButton.Custom so the disconnected label
 * reads exactly "Get Started" (the inbox's required wording) while still using
 * the real RainbowKit connect modal underneath. Once a wallet is connected we
 * move the user toward the app at /app (a stub for now — the dashboard does
 * not exist yet).
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
      {({
        account,
        chain,
        openConnectModal,
        openAccountModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        const baseClasses =
          "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

        return (
          <div
            aria-hidden={!ready}
            style={{
              opacity: ready ? 1 : 0,
              pointerEvents: ready ? "auto" : "none",
              userSelect: ready ? "auto" : "none",
            }}
          >
            {!connected ? (
              <button
                type="button"
                onClick={openConnectModal}
                className={`${baseClasses} bg-accent text-[#0a0e14] hover:opacity-90`}
              >
                Get Started
              </button>
            ) : (
              <button
                type="button"
                onClick={openAccountModal}
                className={`${baseClasses} border border-border bg-surface text-foreground hover:bg-surface-2 font-mono`}
              >
                {account.displayName}
              </button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
