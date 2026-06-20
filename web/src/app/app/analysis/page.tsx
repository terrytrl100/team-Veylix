"use client";

import { useState, useEffect, useMemo, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  fetchPortfolio,
  fetchCalibration,
  applyLivePrices,
  computeMetrics,
  PORTFOLIOS,
} from "@/lib/engine-data";
import type { PortfolioName } from "@/lib/engine-data";
import type { Portfolio, Calibration, PortfolioMetrics } from "@/lib/types";
import { fetchLivePrices, fetchLiveCalibration } from "@/lib/coingecko";
import { useWalletPortfolio } from "@/hooks/useWalletPortfolio";
import { simulate } from "@/lib/veylix-sim";
import type { SimResult, Instrument } from "@/lib/veylix-sim";

type DataSource = "wallet" | "demo-live" | "demo-static" | null;
type Horizon = 7 | 30 | 90;

// ─── Cone chart (SVG) ────────────────────────────────────────────────────────

type ConeRow = { p5: number; p25: number; p50: number; p75: number; p95: number };

function buildConeRows(sim: SimResult): ConeRow[] {
  return sim.cone.p5.map((_, t) => ({
    p5:  sim.cone.p5[t]  * 100,
    p25: sim.cone.p25[t] * 100,
    p50: sim.cone.p50[t] * 100,
    p75: sim.cone.p75[t] * 100,
    p95: sim.cone.p95[t] * 100,
  }));
}

function ConeChart({ sim, baseSim, horizon }: { sim: SimResult; baseSim: SimResult | null; horizon: Horizon }) {
  const H = horizon;
  const W = 800, SH = 230, ML = 46, MR = 12, MT = 10, MB = 26;
  const CW = W - ML - MR, CH = SH - MT - MB;

  const rows     = buildConeRows(sim);
  const baseRows = baseSim ? buildConeRows(baseSim) : null;

  let mn = Infinity, mx = -Infinity;
  for (const r of rows) { if (r.p5 < mn) mn = r.p5; if (r.p95 > mx) mx = r.p95; }
  if (baseRows) for (const r of baseRows) { if (r.p5 < mn) mn = r.p5; if (r.p95 > mx) mx = r.p95; }
  const pad = Math.max((mx - mn) * 0.1, 2);
  mn -= pad; mx += pad;
  const rng = mx - mn || 1;

  const cx = (t: number) => (ML + (t / H) * CW).toFixed(1);
  const cy = (v: number) => (MT + CH - ((v - mn) / rng) * CH).toFixed(1);

  const band = (rs: ConeRow[], lo: keyof ConeRow, hi: keyof ConeRow) => {
    const top = rs.map((r, t) => `${cx(t)},${cy(r[hi])}`);
    const bot = rs.map((r, t) => `${cx(t)},${cy(r[lo])}`).reverse();
    return `M ${top[0]} L ${top.slice(1).join(" L ")} L ${bot.join(" L ")} Z`;
  };
  const polyline = (rs: ConeRow[], key: keyof ConeRow) =>
    rs.map((r, t) => `${t === 0 ? "M" : "L"} ${cx(t)},${cy(r[key])}`).join(" ");

  const xTickMap: Record<number, number[]> = { 7: [0,1,2,3,4,5,6,7], 30: [0,7,14,21,30], 90: [0,30,60,90] };
  const xTicks = xTickMap[H] ?? [0, H];
  const yTicks = Array.from({ length: 6 }, (_, i) => mn + (i / 5) * rng);
  const zeroY  = cy(0);

  return (
    <svg viewBox={`0 0 ${W} ${SH}`} className="w-full h-auto block" aria-hidden="true">
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={ML} x2={ML + CW} y1={cy(v)} y2={cy(v)} stroke="#1e2d45" strokeWidth={0.5} />
          <text x={ML - 4} y={+cy(v) + 3.5} textAnchor="end" fill="#8b97ad" fontSize={9} fontFamily="ui-monospace,monospace">
            {v >= 0 ? "+" : ""}{v.toFixed(0)}%
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <g key={t}>
          <line x1={cx(t)} x2={cx(t)} y1={MT} y2={MT + CH + 3} stroke="#1e2d45" strokeWidth={0.5} />
          <text x={cx(t)} y={MT + CH + 15} textAnchor="middle" fill="#8b97ad" fontSize={9} fontFamily="ui-monospace,monospace">
            {t === 0 ? "now" : `${t}d`}
          </text>
        </g>
      ))}
      <line x1={ML} x2={ML + CW} y1={zeroY} y2={zeroY} stroke="white" strokeWidth={0.5} strokeDasharray="4 4" opacity={0.1} />
      {baseRows && (
        <>
          <path d={band(baseRows, "p5", "p95")} fill="#8b97ad" opacity={0.05} />
          <path d={polyline(baseRows, "p5")} fill="none" stroke="#8b97ad" strokeWidth={1} strokeDasharray="3 3" opacity={0.35} />
        </>
      )}
      <path d={band(rows, "p5",  "p25")} fill="#ff6f6f" opacity={0.18} />
      <path d={band(rows, "p25", "p75")} fill="#94a3b8" opacity={0.07} />
      <path d={band(rows, "p75", "p95")} fill="#4fd1c5" opacity={0.14} />
      <path d={polyline(rows, "p50")} fill="none" stroke="#f5a524" strokeWidth={2} strokeLinecap="round" />
      <path d={polyline(rows, "p5")}  fill="none" stroke="#ff6f6f" strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={cx(H)} cy={cy(rows[H].p5)} r={4} fill="#ff6f6f" />
    </svg>
  );
}

// ─── Why-text builder ─────────────────────────────────────────────────────────

function buildWhy(
  sim: SimResult, base: SimResult | null,
  hedge: number, instrument: Instrument, horizon: Horizon, coinCount: number,
): string {
  const pf  = (n: number) => (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%";
  const fP5  = sim.final.worstCase5pctReturn;
  const fP50 = sim.final.medianReturn;

  if (hedge === 0) {
    return (
      `Your portfolio holds ${coinCount} asset${coinCount !== 1 ? "s" : ""}, but ` +
      `~${Math.round(sim.btcVarShare * 100)}% of your risk is a single bet on BTC ` +
      `(driven by ${sim.topDriver || "your largest holding"}). ` +
      `Over ${horizon} days, the 1-in-20 worst case lands at ${pf(fP5)} ` +
      `with a median of ${pf(fP50)}. ` +
      `Drag the hedge slider to see how adding a ${instrument === "MSTR" ? "Short MSTR" : "Short BTC"} hedge lifts the downside floor.`
    );
  }

  const basePf = base ? pf(base.final.worstCase5pctReturn) : "—";
  let txt =
    `The ${Math.round(hedge * 100)}% hedge lifts your 1-in-20 floor from ${basePf} to ${pf(fP5)}, ` +
    `while the median barely moves (${pf(fP50)}). ` +
    `Effective BTC beta drops to ${sim.effectiveBeta.toFixed(2)}x (from ${sim.grossLoading.toFixed(2)}x unhedged). ` +
    `Carry cost over ${horizon}d: ~${(sim.carryOverHorizonPct * 100).toFixed(2)}%.`;
  if (instrument === "MSTR")
    txt += " Note: Short MSTR adds basis risk — MSTR tracks BTC loosely, so the floor lifts less than a direct BTC short at the same ratio.";
  return txt;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function LiveBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-upside/30 bg-upside/10 px-2 py-0.5 text-[11px] text-upside">
      <span className="h-1.5 w-1.5 rounded-full bg-upside animate-pulse" />
      {label}
    </span>
  );
}

function Tile({ label, value, color, title }: {
  label: string; value: string; color?: "coral" | "teal" | "amber"; title?: string;
}) {
  const cls = color === "coral" ? "text-downside" : color === "teal" ? "text-upside" : color === "amber" ? "text-accent" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-surface p-4" title={title}>
      <p className="text-[10px] uppercase tracking-widest text-muted leading-tight mb-2">{label}</p>
      <p className={`font-mono text-lg font-semibold tabular ${cls}`}>{value}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { portfolio: walletPortfolio, isLoading: walletLoading, hasBalances } = useWalletPortfolio();

  const [demoSelected,      setDemoSelected]      = useState<PortfolioName>("client_alpha");
  const [metrics,           setMetrics]           = useState<PortfolioMetrics | null>(null);
  const [livePortfolio,     setLivePortfolio]     = useState<Portfolio | null>(null);
  const [liveCalibration,   setLiveCalibration]   = useState<Calibration | null>(null);
  const [loading,           setLoading]           = useState(false);
  const [error,             setError]             = useState<string | null>(null);
  const [dataSource,        setDataSource]        = useState<DataSource>(null);
  const [asOf,              setAsOf]              = useState<string | null>(null);

  // simulation controls
  const [hedge,       setHedge]       = useState(0);
  const [sliderPct,   setSliderPct]   = useState(0);
  const [instrument,  setInstrument]  = useState<Instrument>("BTC");
  const [horizon,     setHorizon]     = useState<Horizon>(30);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!isConnected) router.replace("/app");
  }, [isConnected, router]);

  useEffect(() => {
    if (!isConnected || walletLoading) return;
    setLoading(true);
    setError(null);

    const ALL_SYMBOLS = ["BTC","ETH","SOL","LINK","DOGE","PEPE","FLOKI","BONK","WIF","USDT"];
    const sourcePortfolio: Promise<Portfolio> =
      hasBalances && walletPortfolio
        ? Promise.resolve(walletPortfolio)
        : fetchPortfolio(demoSelected);

    (async () => {
      try {
        const [portfolio, prices, calibration] = await Promise.all([
          sourcePortfolio,
          fetchLivePrices(ALL_SYMBOLS),
          fetchLiveCalibration(),
        ]);
        const priced = applyLivePrices(portfolio, prices);
        setMetrics(computeMetrics(priced, calibration));
        setLivePortfolio(priced);
        setLiveCalibration(calibration);
        setDataSource(hasBalances ? "wallet" : "demo-live");
        setAsOf(new Date().toLocaleTimeString());
      } catch {
        try {
          const [portfolio, calibration] = await Promise.all([
            sourcePortfolio,
            fetchCalibration(),
          ]);
          setMetrics(computeMetrics(portfolio, calibration));
          setLivePortfolio(portfolio);
          setLiveCalibration(calibration);
          setDataSource("demo-static");
          setAsOf(null);
          setError("Live market data unavailable — showing snapshot.");
        } catch (e2) {
          setError((e2 as Error).message);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [isConnected, walletLoading, hasBalances, walletPortfolio, demoSelected]);

  // deterministic simulation — runs synchronously (~10–30 ms per run)
  const simResult = useMemo<SimResult | null>(() => {
    if (!livePortfolio || !liveCalibration) return null;
    return simulate(livePortfolio, liveCalibration, { h: hedge, instrument, horizonDays: horizon });
  }, [livePortfolio, liveCalibration, hedge, instrument, horizon]);

  // unhedged baseline for ghost cone and floor-lift text
  const baseSim = useMemo<SimResult | null>(() => {
    if (!livePortfolio || !liveCalibration || hedge === 0) return null;
    return simulate(livePortfolio, liveCalibration, { h: 0, instrument: "BTC", horizonDays: horizon });
  }, [livePortfolio, liveCalibration, hedge, horizon]);

  const onSlider = useCallback((val: number) => {
    setSliderPct(val);
    startTransition(() => setHedge(val / 100));
  }, [startTransition]);

  const fmtPct = (n: number) => (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%";
  const equity = metrics?.totalEquity ?? 0;
  const usd    = (ret: number) => "≈ $" + Math.round(equity * (1 + ret)).toLocaleString();
  const fundRate = instrument === "BTC"
    ? (liveCalibration?.funding_annual ?? 0)
    : (liveCalibration?.mstr_borrow_annual ?? 0);

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
          <div className="flex items-center gap-4">
            {equity > 0 && (
              <div className="text-right">
                <p className="text-[11px] text-muted">Portfolio value</p>
                <p className="font-mono text-base font-semibold tabular">
                  ${equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
            <ConnectButton showBalance={false} />
          </div>
        </nav>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-6xl px-6 py-8 space-y-6">

          {/* Source label + demo selector */}
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <p className="text-xs uppercase tracking-widest text-muted">
                {hasBalances ? "Your wallet · Arbitrum" : "Demo portfolio"}
              </p>
              {dataSource === "wallet"    && asOf && <LiveBadge label={`Live · ${asOf}`} />}
              {dataSource === "demo-live" && asOf && <LiveBadge label={`Live prices · ${asOf}`} />}
              {dataSource === "demo-static" && (
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">Snapshot</span>
              )}
              {walletLoading && <span className="text-[11px] text-muted">Reading wallet…</span>}
              {!walletLoading && !hasBalances && (
                <span className="text-[11px] text-muted">No supported tokens on Arbitrum — showing demo</span>
              )}
            </div>

            {!hasBalances && !walletLoading && (
              <>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(PORTFOLIOS) as PortfolioName[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => setDemoSelected(key)}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                        demoSelected === key
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border bg-surface text-muted hover:border-muted"
                      }`}
                    >
                      {PORTFOLIOS[key].label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">{PORTFOLIOS[demoSelected].description}</p>
              </>
            )}
          </div>

          {error && <p className="text-xs text-downside">{error}</p>}

          {/* Loading skeleton */}
          {(loading || walletLoading) && (
            <div className="space-y-4">
              <div className="h-56 animate-pulse rounded-xl border border-border bg-surface" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-28 animate-pulse rounded-xl border border-border bg-surface" />
                <div className="h-28 animate-pulse rounded-xl border border-border bg-surface" />
              </div>
              <div className="h-16 animate-pulse rounded-xl border border-border bg-surface" />
            </div>
          )}

          {/* ── Simulation dashboard ── */}
          {simResult && !loading && !walletLoading && (
            <>
              {/* Cone hero */}
              <div className="rounded-xl border border-border bg-surface p-5">
                <div className="grid grid-cols-[110px_1fr] gap-5 items-start">
                  <div className="flex flex-col gap-5">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted mb-1">1-in-20 worst case</p>
                      <p className="font-mono text-3xl font-bold tabular text-downside leading-none">
                        {fmtPct(simResult.final.worstCase5pctReturn)}
                      </p>
                      <p className="font-mono text-xs text-muted mt-1 tabular">
                        {usd(simResult.final.worstCase5pctReturn)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Median outcome</p>
                      <p className={`font-mono text-3xl font-bold tabular leading-none ${simResult.final.medianReturn >= 0 ? "text-upside" : "text-downside"}`}>
                        {fmtPct(simResult.final.medianReturn)}
                      </p>
                      <p className="font-mono text-xs text-muted mt-1 tabular">
                        {usd(simResult.final.medianReturn)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <ConeChart sim={simResult} baseSim={baseSim} horizon={horizon} />
                    <p className="text-[10px] text-muted mt-2 text-center">
                      3,000 simulated paths · single-factor zero-drift model ·{" "}
                      {horizon}d{liveCalibration?.as_of
                        ? ` · calibrated from live market data as of ${new Date(liveCalibration.as_of).toLocaleDateString()}`
                        : " · snapshot calibration"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Controls row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Hedge */}
                <div className="rounded-xl border border-border bg-surface p-5 space-y-5">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Hedge instrument</p>
                    <div className="flex rounded-lg border border-border bg-surface-2 p-1 gap-1">
                      {(["BTC", "MSTR"] as Instrument[]).map((i) => (
                        <button
                          key={i}
                          onClick={() => setInstrument(i)}
                          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                            instrument === i ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
                          }`}
                        >
                          {i === "BTC" ? "Short BTC" : "Short MSTR"}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-muted leading-relaxed">
                      {instrument === "BTC"
                        ? "Short BTC perps neutralise your portfolio's BTC market factor directly."
                        : "Short MSTR in any stock brokerage — accessible if you can't short crypto. Tracks the same BTC factor but adds basis risk."}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Hedge amount</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="range" min={0} max={100} value={sliderPct}
                        onChange={(e) => onSlider(+e.target.value)}
                        className="flex-1 h-1 rounded-full appearance-none cursor-pointer accent-accent"
                        aria-label="Hedge amount, percent of portfolio value"
                      />
                      <span className="font-mono text-sm font-semibold text-accent min-w-[36px] text-right tabular">
                        {sliderPct}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Horizon */}
                <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Horizon</p>
                    <div className="flex rounded-lg border border-border bg-surface-2 p-1 gap-1">
                      {([7, 30, 90] as Horizon[]).map((d) => (
                        <button
                          key={d}
                          onClick={() => setHorizon(d)}
                          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            horizon === d ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
                          }`}
                        >
                          {d}d
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-muted">
                      {horizon === 7 ? "A bad week" : horizon === 30 ? "A bad month" : "A bad quarter"} scenario window.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-border">
                    <div className="flex justify-between text-xs text-muted">
                      <span>{instrument === "BTC" ? "BTC funding (ann.)" : "MSTR borrow (ann.)"}</span>
                      <span className="font-mono tabular">{(fundRate * 100).toFixed(2)}%/yr</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted mt-1">
                      <span>BTC factor vol (daily)</span>
                      <span className="font-mono tabular">
                        {((liveCalibration?.btc_factor_vol_daily ?? 0) * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stat tiles — 7 across */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <Tile
                  label="Median outcome"
                  value={fmtPct(simResult.final.medianReturn)}
                  color={simResult.final.medianReturn >= 0 ? "teal" : "coral"}
                  title="Your middle result; half of scenarios do better, half worse."
                />
                <Tile
                  label="1-in-20 downside"
                  value={fmtPct(simResult.final.worstCase5pctReturn)}
                  color="coral"
                  title="A realistic bad outcome — worse than this only ~5% of the time."
                />
                <Tile
                  label="Typical max drawdown"
                  value={`-${(-simResult.final.typicalMaxDrawdown * 100).toFixed(1)}%`}
                  color="coral"
                  title="The usual worst dip from a peak along the way, before any recovery."
                />
                <Tile
                  label="Chance loss >25%"
                  value={`${(simResult.final.probLossGt25pct * 100).toFixed(1)}%`}
                  color="coral"
                  title="How often you would lose more than a quarter of your money."
                />
                <Tile
                  label="Effective BTC beta"
                  value={`${simResult.effectiveBeta.toFixed(2)}x`}
                  color="amber"
                  title="How hard your portfolio still moves with BTC after hedging (0 = market-neutral)."
                />
                <Tile
                  label={instrument === "BTC" ? "BTC funding" : "MSTR borrow"}
                  value={`${(fundRate * 100).toFixed(1)}%/yr`}
                  title="Annual rate to hold the hedge; a market rate, not advice."
                />
                <Tile
                  label="Cost of insurance"
                  value={
                    Math.abs(simResult.carryOverHorizonPct * equity) < 0.5
                      ? "$0"
                      : `-$${Math.round(simResult.carryOverHorizonPct * equity).toLocaleString()}`
                  }
                  color={simResult.carryOverHorizonPct * equity >= 0.5 ? "coral" : undefined}
                  title="Dollar cost of holding the hedge over the horizon."
                />
              </div>

              {/* Why these numbers */}
              <div className="rounded-xl border border-border bg-surface p-5">
                <p className="text-[10px] uppercase tracking-widest text-muted mb-3">Why these numbers</p>
                <p
                  className="text-sm leading-relaxed text-foreground"
                  dangerouslySetInnerHTML={{
                    __html: buildWhy(
                      simResult, baseSim, hedge, instrument, horizon,
                      livePortfolio?.result.list[0].coin.length ?? 0,
                    )
                    .replace(/([\+\-]?\d+\.?\d*%)/g, '<em class="text-accent font-semibold not-italic">$1</em>')
                    .replace(/(\d+\.\d+x)/g,          '<em class="text-accent font-semibold not-italic">$1</em>')
                    .replace(/(\$[\d,]+)/g,            '<em class="text-accent font-semibold not-italic">$1</em>'),
                  }}
                />
              </div>

              {/* Holdings table */}
              {metrics && (
                <div className="overflow-hidden rounded-xl border border-border bg-surface">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-muted">
                        <th className="px-5 py-3">Asset</th>
                        <th className="px-5 py-3 text-right">Qty</th>
                        <th className="px-5 py-3 text-right">Value (USD)</th>
                        <th className="px-5 py-3 text-right">Weight</th>
                        <th className="px-5 py-3 text-right">Beta</th>
                        <th className="px-5 py-3 text-right">Daily idio σ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.coins.map((c, i) => (
                        <tr key={c.symbol} className={`border-b border-border last:border-0 ${i % 2 !== 0 ? "bg-surface-2/40" : ""}`}>
                          <td className="px-5 py-3 font-semibold">{c.symbol}</td>
                          <td className="px-5 py-3 text-right font-mono text-muted tabular">
                            {c.walletBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                          </td>
                          <td className="px-5 py-3 text-right font-mono text-muted tabular">
                            ${c.usdValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-5 py-3 text-right font-mono tabular">{(c.weight * 100).toFixed(1)}%</td>
                          <td className="px-5 py-3 text-right font-mono tabular">{c.beta.toFixed(3)}</td>
                          <td className="px-5 py-3 text-right font-mono text-muted tabular">{(c.idio_vol_daily * 100).toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-6 py-6">
          <p className="text-xs leading-relaxed text-muted">
            Simulated from modelled volatility — not forecasts or predictions of future prices.
            Does not recommend any position, allocation, or hedge. Educational use only.
          </p>
        </div>
      </footer>
    </div>
  );
}
