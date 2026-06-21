"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CoinScene } from "@/components/coin-scene";
import { GetStartedButton } from "@/components/get-started-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function LandingPage() {
  const router = useRouter();
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10 sm:py-6">
        <span className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Veylix
        </span>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild className="border-border bg-surface text-foreground hover:bg-surface-2 px-5 py-2.5 text-sm font-semibold sm:px-6 sm:py-3 sm:text-base">
            <Link href="/demo">Demo</Link>
          </Button>
          <GetStartedButton />
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative flex flex-1 flex-col items-center justify-center">

        {/* Ambient glow behind the coin */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <div className="h-[480px] w-[480px] rounded-full bg-[#4fd1c5]/[0.04] blur-[110px]" />
          <div className="absolute h-[260px] w-[260px] rounded-full bg-[#f5a524]/[0.05] blur-[80px]" />
        </div>

        {/* Hero pill */}
        <button onClick={() => router.push("/app")} className="relative z-10 mb-2">
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 rounded-full border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <img src="/claude-icon.svg" className="h-4 w-4 shrink-0" alt="" />
            Test your portfolio against custom market conditions
          </Badge>
        </button>

        {/* Hologram V coin */}
        <div className="relative h-[460px] w-full max-w-[460px]">
          <CoinScene />
        </div>

        {/* Copy */}
        <div className="relative z-10 -mt-4 px-6 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-[52px] md:leading-[1.1]">
            Institutional-grade tools, for everyone.
          </h1>
          <p className="mx-auto mt-5 max-w-[380px] text-[15px] leading-relaxed text-muted">
            Understand the real risk in your crypto portfolio — Monte Carlo simulations, hedging strategies, and verifiable reports. Before you trade.
          </p>
          <p className="mt-10 text-[11px] uppercase tracking-[0.18em] text-muted/40">
            Educational &middot; not investment advice
          </p>
        </div>
      </section>
    </main>
  );
}
