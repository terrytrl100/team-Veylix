"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function AppHome() {
  const router = useRouter();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (isConnected) {
      router.replace("/app/analysis");
    }
  }, [isConnected, router]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Veylix</span>
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
              Educational · not investment advice
            </span>
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 items-center">
        <section className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="max-w-xl">
            <h1 className="text-3xl font-semibold tracking-tight">
              Connect your wallet to continue
            </h1>
            <p className="mt-4 text-muted">
              Veylix needs read-only access to your on-chain holdings to model
              your real risk exposure.
            </p>
            <div className="mt-8">
              <ConnectButton />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-6 py-6">
          <p className="text-xs leading-relaxed text-muted">
            Veylix surfaces and explains risk using simulated outcomes from a
            modelled volatility process — these are not forecasts. Educational
            use only.
          </p>
        </div>
      </footer>
    </div>
  );
}
