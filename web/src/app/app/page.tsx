"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

/**
 * Stub app destination reached after the user connects a wallet on the landing
 * page. The real dashboard (outcome cone, risk engine, charts) does not exist
 * yet and is out of scope for this task — this placeholder simply confirms the
 * connected state and gives the user a way to manage / disconnect the wallet.
 */
export default function AppHome() {
  const router = useRouter();
  const { address, isConnected, chain, status } = useAccount();

  // If the user lands here without a connected wallet, send them back.
  // useEffect(() => {
  //   if (status !== "connecting" && status !== "reconnecting" && !isConnected) {
  //     router.replace("/");
  //   }
  // }, [isConnected, status, router]);

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
          {/* Full RainbowKit button here: account, chain, balance, disconnect */}
          <ConnectButton showBalance={false} />
        </nav>
      </header>

      <main className="flex flex-1 items-center">
        <section className="mx-auto w-full max-w-6xl px-6 py-24">
          {isConnected ? (
            <div className="max-w-xl">
              <p className="mb-3 inline-flex items-center gap-2 text-sm text-upside">
                <span className="h-2 w-2 rounded-full bg-upside" />
                Wallet connected
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">
                You&rsquo;re in.
              </h1>
              <p className="mt-4 text-muted">
                This is a placeholder for the Veylix dashboard. The outcome cone,
                live scenarios, and risk metrics will build on this skeleton.
              </p>
              <dl className="mt-8 space-y-3 rounded-lg border border-border bg-surface p-5 text-sm">
                <div className="flex justify-between gap-6">
                  <dt className="text-muted">Address</dt>
                  <dd className="font-mono">{address}</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="text-muted">Network</dt>
                  <dd className="font-mono">
                    {chain?.name ?? "unknown"}
                    {chain ? ` · id ${chain.id}` : ""}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
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
          )}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-6 py-6">
          <p className="text-xs leading-relaxed text-muted">
            Veylix surfaces and explains risk using simulated outcomes from a
            modelled volatility process — these are not forecasts. It does not
            recommend any position, allocation, or hedge. Educational use only.
          </p>
        </div>
      </footer>
    </div>
  );
}
