"use client";

import { useState, useEffect, useMemo, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  fetchCalibration,
  applyLivePrices,
  computeMetrics,
} from "@/lib/engine-data";
import type { Portfolio, Calibration, PortfolioMetrics } from "@/lib/types";
import { fetchLivePrices, fetchLiveCalibration, bustPriceCache } from "@/lib/coingecko";
import { RefreshCw } from "lucide-react";
import { useWalletPortfolio } from "@/hooks/useWalletPortfolio";
import { simulate } from "@/lib/veylix-sim";
import { solveHedgeForVar } from "@/lib/hedge-solver";
import ScenarioPanel from "@/components/ScenarioPanel";
import AnchorReport from "@/components/AnchorReport";
import type { SimResult, Instrument } from "@/lib/veylix-sim";

type DataSource = "wallet" | "demo-live" | "demo-static" | null;
type Horizon = 1 | 7 | 30;
type Tab = "portfolio" | "risk";

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function InfoTip({ text, align = "center", direction = "up" }: {
  text: string;
  align?: "center" | "start" | "end";
  direction?: "up" | "down";
}) {
  const posClass =
    align === "start" ? "left-0" :
    align === "end"   ? "right-0" :
    "left-1/2 -translate-x-1/2";
  const dirClass = direction === "down"
    ? "top-[calc(100%+6px)]"
    : "bottom-[calc(100%+6px)]";
  return (
    <span className="group relative inline-flex items-center shrink-0">
      <span className="cursor-help text-[11px] leading-none text-muted/40 hover:text-muted/80 select-none transition-colors">
        ⓘ
      </span>
      <span
        className={`pointer-events-none absolute ${dirClass} ${posClass} z-50 w-56 rounded-lg border border-border bg-surface-2 p-2.5 text-[11px] leading-relaxed text-foreground shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-normal font-normal normal-case tracking-normal`}
      >
        {text}
      </span>
    </span>
  );
}

// ─── Tooltip copy keyed by field name ────────────────────────────────────────
// Plain-English explanations. Add new keys here as the schema grows.

const TIPS = {
  // Portfolio summary tiles
  totalValue:
    "The combined USD value of all your holdings right now.",
  effectiveBtcBeta:
    "How much your whole portfolio moves when Bitcoin moves 1%. A beta of 1.5x means if BTC drops 10%, you'd typically lose ~15%. Most crypto portfolios land close to 1.",
  btcRiskShare:
    "The share of your total risk that comes from Bitcoin's price moving. Even a portfolio of 10 different coins can be 90%+ one BTC bet — because most altcoins follow BTC closely.",

  // Holdings table columns
  colQty:
    "How many units of this asset are in the wallet. For BTC this might be 0.5; for USDT it might be 10,000.",
  colValue:
    "The current USD value of this holding — quantity × live price.",
  colWeight:
    "What percentage of the total portfolio is in this asset. Weights add up to 100%.",
  colBeta:
    "How much this coin moves when Bitcoin moves 1%. BTC itself is 1.0. A coin with beta 1.5 typically rises or falls 1.5× as much as BTC.",
  colIdioVol:
    "This coin's daily volatility that has nothing to do with Bitcoin — its own independent risk. Higher means bigger coin-specific swings on top of whatever BTC does.",

  // Risk tab hero numbers
  heroWorstCase:
    "Value at Risk at 95% confidence — the loss your portfolio is not expected to exceed in 95% of scenarios over this period. Only the worst 1 in 20 outcomes fall below it. A standard institutional downside measure: a realistic bad case, not the absolute worst.",
  heroMedian:
    "The midpoint across all 3,000 simulated paths. Half the paths end up better than this, half worse. Not a prediction, just the most likely zone.",

  // Controls
  hedgeInstrument:
    "What you sell short to reduce your Bitcoin exposure. Shorting means you borrow and sell an asset now, then buy it back later — you profit if the price falls, which offsets losses in your long portfolio.",
  hedgeAmount:
    "What fraction of your portfolio's value you offset with the short. 50% means you short half your BTC exposure. Higher = more protection, but more carry cost every day.",
  horizon:
    "How many days ahead the simulation looks. Longer horizons give losses (and gains) more time to compound, so the outcome cone widens.",

  // Horizon card rate rows
  btcFunding:
    "The annual interest you pay to hold a BTC short (perpetual futures). This fee is paid to traders holding the long side. It varies with market conditions.",
  mstrBorrow:
    "The annual fee charged by your broker to borrow MSTR shares for short-selling. It's like rent on the shares you don't own yet.",
  btcFactorVol:
    "Bitcoin's average daily price swing used in the model. A higher number widens the outcome cone — more uncertainty in either direction.",

  // Stat tiles
  tileMedian:
    "The middle result across all simulations. Half of paths end up better, half worse.",
  tileWorstCase:
    "Value at Risk (95%): only 1 in 20 simulated paths ends up worse than this number — your realistic bad case.",
  tileMaxDrawdown:
    "How far your portfolio typically falls from its highest point before recovering. Even if you end the period flat, you might sit through a painful dip along the way.",
  tileProbLoss25:
    "Out of all 3,000 simulated paths, this many end with a loss greater than 25%. Useful for gut-checking: could you stomach losing a quarter of your money?",
  tileEffBeta:
    "Your portfolio's remaining sensitivity to Bitcoin after the hedge. 0 = fully market-neutral. 1 = still moves with BTC dollar-for-dollar.",
  tileFundingRate:
    "The annual cost of holding the hedge position, as a percentage per year.",
  tileCostInsurance:
    "The total dollar drag from carrying the hedge over your chosen time period. This is the price of the downside protection.",
} as const;

// ─── Donut pie chart (SVG) ────────────────────────────────────────────────────

const BRAND_COLORS: Record<string, string> = {
  BTC:  "#f7931a", ETH:  "#627eea", USDT: "#26a17b", SOL:  "#9945ff",
  LINK: "#2a5ada", DOGE: "#c2a633", PEPE: "#4aa84a", WIF:  "#cbb1e8",
  FLOKI:"#e0a44a", BONK: "#f5a524",
};
const FALLBACK_COLORS = ["#8b97ad", "#4fd1c5", "#a78bd9", "#60a5fa"];

function PieChart({ coins, totalEquity }: {
  coins: Array<{ symbol: string; weight: number; usdValue: number; walletBalance: number }>;
  totalEquity: number;
}) {
  const R = 76, IR = 44, CX = 96, CY = 96;
  const visible = coins.filter((c) => c.weight > 0.001);

  const [hovered, setHovered] = useState<{ symbol: string; weight: number; usdValue: number; walletBalance: number; color: string } | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  let a = -Math.PI / 2;
  const slices = visible.map((c, i) => {
    const s = a;
    a += c.weight * 2 * Math.PI;
    return { ...c, s, e: a, color: BRAND_COLORS[c.symbol] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length] };
  });

  const arcPath = (s: number, e: number) => {
    const cos = Math.cos, sin = Math.sin;
    const x1 = (CX + R  * cos(s)).toFixed(2), y1 = (CY + R  * sin(s)).toFixed(2);
    const x2 = (CX + R  * cos(e)).toFixed(2), y2 = (CY + R  * sin(e)).toFixed(2);
    const ix1 = (CX + IR * cos(e)).toFixed(2), iy1 = (CY + IR * sin(e)).toFixed(2);
    const ix2 = (CX + IR * cos(s)).toFixed(2), iy2 = (CY + IR * sin(s)).toFixed(2);
    const lg = e - s > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${R} ${R} 0 ${lg} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${IR} ${IR} 0 ${lg} 0 ${ix2} ${iy2} Z`;
  };

  return (
    <div
      className="flex flex-col sm:flex-row items-center gap-8"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
    >
      <div className="relative shrink-0">
        <svg viewBox="0 0 192 192" className="w-44 h-44">
          {slices.map((sl, i) => (
            <path
              key={i}
              d={arcPath(sl.s, sl.e)}
              fill={sl.color}
              opacity={hovered && hovered.symbol !== sl.symbol ? 0.4 : 0.9}
              className="cursor-pointer transition-opacity duration-100"
              onMouseEnter={() => setHovered(sl)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="font-mono text-xs text-muted">Total</p>
          <p className="font-mono text-sm font-bold tabular">
            ${totalEquity.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
        </div>

        {/* Hover tooltip */}
        {hovered && (
          <div
            className="pointer-events-none absolute z-50 rounded-lg border border-border bg-surface-2 px-3 py-2 shadow-xl text-xs space-y-0.5"
            style={{ left: mouse.x + 12, top: mouse.y - 10 }}
          >
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: hovered.color }} />
              {(hovered.weight * 100).toFixed(1)}% {hovered.symbol}
            </p>
            <p className="font-mono tabular text-muted">
              ${hovered.usdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="font-mono tabular text-muted">
              {hovered.walletBalance.toLocaleString("en-US", { maximumFractionDigits: 6 })} {hovered.symbol}
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        {slices.map((sl, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: sl.color }} />
            <span className="font-mono text-sm font-semibold w-12">{sl.symbol}</span>
            <span className="font-mono text-sm tabular text-muted">{(sl.weight * 100).toFixed(1)}%</span>
            <span className="font-mono text-xs tabular text-muted">
              ${sl.usdValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

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

  const xTickMap: Record<number, number[]> = { 1: [0, 1], 7: [0,1,2,3,4,5,6,7], 30: [0,7,14,21,30] };
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

// ─── Small shared components ──────────────────────────────────────────────────

function LiveBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-upside/30 bg-upside/10 px-2 py-0.5 text-[11px] text-upside">
      <span className="h-1.5 w-1.5 rounded-full bg-upside animate-pulse" />
      {label}
    </span>
  );
}

function Tile({ label, value, color, tip }: {
  label: string; value: string; color?: "coral" | "teal" | "amber"; tip?: string;
}) {
  const cls = color === "coral" ? "text-downside" : color === "teal" ? "text-upside" : color === "amber" ? "text-accent" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-1 mb-2">
        <p className="text-[10px] uppercase tracking-widest text-muted leading-tight">{label}</p>
        {tip && <InfoTip text={tip} />}
      </div>
      <p className={`font-mono text-lg font-semibold tabular ${cls}`}>{value}</p>
    </div>
  );
}

// labelled row used in the horizon card rate section
function RateRow({ label, value, tip }: { label: string; value: string; tip?: string }) {
  return (
    <div className="flex justify-between text-xs text-muted">
      <span className="flex items-center gap-1">
        {label}
        {tip && <InfoTip text={tip} align="start" />}
      </span>
      <span className="font-mono tabular">{value}</span>
    </div>
  );
}

// ─── Hedge solver (solve-for-target-VaR) ──────────────────────────────────────
// Inverts the engine: given a target 95% VaR, finds the hedge ratio that the
// model implies, by solving against the real simulation (carry cost included).
// A calculator, not advice — it answers "to reach X, the model implies Y".

function HedgeSolver({
  portfolio, calibration, instrument, horizon, btcPrice, currentVar, onApply,
}: {
  portfolio: Portfolio;
  calibration: Calibration;
  instrument: Instrument;
  horizon: Horizon;
  btcPrice: number | null;
  currentVar: number;
  onApply: (hPct: number) => void;
}) {
  const [targetPct, setTargetPct] = useState("15");
  const [result, setResult] = useState<ReturnType<typeof solveHedgeForVar> | null>(null);
  const [solving, setSolving] = useState(false);

  const onSolve = useCallback(() => {
    const t = parseFloat(targetPct);
    if (!isFinite(t) || t <= 0) return;
    setSolving(true);
    // Defer so the spinner can paint before the synchronous solve runs.
    setTimeout(() => {
      const sol = solveHedgeForVar({
        portfolio, calibration, instrument, horizonDays: horizon,
        targetVar: -Math.abs(t) / 100,
        btcPrice: btcPrice ?? undefined,
      });
      setResult(sol);
      setSolving(false);
    }, 10);
  }, [targetPct, portfolio, calibration, instrument, horizon, btcPrice]);

  const pf = (n: number) => (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%";

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center gap-1 mb-1">
        <p className="text-[10px] uppercase tracking-widest text-muted">Solve for a target</p>
        <InfoTip
          text="Enter a Value-at-Risk you'd like to target. The model inverts the simulation — including carry cost — to find the hedge ratio that gets there, and the position it implies. This is a calculation, not a recommendation."
        />
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] text-muted">Target 95% VaR</label>
            <button
              onClick={() => setTargetPct(Math.abs(currentVar * 100).toFixed(1))}
              className="text-[10px] text-accent hover:underline"
            >
              use current ({(currentVar * 100).toFixed(1)}%)
            </button>
          </div>
          <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-2">
            <span className="text-muted text-sm">−</span>
            <input
              type="number" min={0} max={99} step={0.5} value={targetPct}
              onChange={(e) => setTargetPct(e.target.value)}
              className="w-full bg-transparent text-sm text-foreground outline-none tabular font-mono"
            />
            <span className="text-muted text-sm">%</span>
          </div>
        </div>
        <button
          onClick={onSolve}
          disabled={solving}
          className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20 transition-colors disabled:opacity-40"
        >
          {solving ? "Solving…" : "Solve"}
        </button>
      </div>

      {result && !solving && (
        <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-2 text-sm">
          {result.reached ? (
            <>
              <p className="text-foreground leading-relaxed">
                To target a 95% VaR of{" "}
                <span className="font-mono font-semibold text-downside">{pf(result.targetVar)}</span>,
                the model implies a{" "}
                <span className="font-mono font-semibold text-accent">{Math.round(result.h * 100)}%</span>{" "}
                {instrument === "BTC" ? "short-BTC" : "short-MSTR"} hedge.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted">Notional to short</p>
                  <p className="font-mono tabular text-foreground">
                    ${Math.round(result.notionalUsd).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted">
                    {instrument === "BTC" ? "≈ BTC to short" : "Carry over horizon"}
                  </p>
                  <p className="font-mono tabular text-foreground">
                    {instrument === "BTC"
                      ? (result.units > 0 ? `${result.units.toFixed(4)} BTC` : "—")
                      : pf(result.carryOverHorizonPct)}
                  </p>
                </div>
              </div>
              {instrument === "BTC" && (
                <p className="text-[11px] text-muted">
                  Carry cost over {horizon}d at this hedge: {pf(result.carryOverHorizonPct)}.
                </p>
              )}
              <button
                onClick={() => onApply(Math.round(result.h * 100))}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-[12px] font-medium text-foreground hover:border-muted transition-colors"
              >
                Apply this hedge to the slider
              </button>
            </>
          ) : (
            <p className="text-foreground leading-relaxed">
              A 95% VaR of <span className="font-mono font-semibold">{pf(result.targetVar)}</span> isn&apos;t
              reachable with a {instrument === "BTC" ? "short-BTC" : "short-MSTR"} hedge — carry cost
              outweighs further protection. The best this hedge achieves is{" "}
              <span className="font-mono font-semibold text-accent">{pf(result.bestVar)}</span> at a{" "}
              <span className="font-mono font-semibold text-accent">{Math.round(result.bestH * 100)}%</span> hedge.
              <button
                onClick={() => onApply(Math.round(result.bestH * 100))}
                className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-[12px] font-medium text-foreground hover:border-muted transition-colors"
              >
                Apply the best achievable hedge
              </button>
            </p>
          )}
          <p className="text-[10px] text-muted/70 leading-relaxed pt-1">
            Calculated by inverting the simulation — not financial advice. VaR is a confidence
            level from the model, not a guaranteed floor.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { portfolio: walletPortfolio, isLoading: walletLoading, hasBalances } = useWalletPortfolio();

  const [activeTab,        setActiveTab]        = useState<Tab>("portfolio");
  const [metrics,          setMetrics]          = useState<PortfolioMetrics | null>(null);
  const [livePortfolio,    setLivePortfolio]    = useState<Portfolio | null>(null);
  const [liveCalibration,  setLiveCalibration]  = useState<Calibration | null>(null);
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState<string | null>(null);
  const [dataSource,       setDataSource]       = useState<DataSource>(null);
  const [asOf,             setAsOf]             = useState<string | null>(null);
  const [btcPrice,         setBtcPrice]         = useState<number | null>(null);

  const [hedge,      setHedge]      = useState(0);
  const [sliderPct,  setSliderPct]  = useState(0);
  const [instrument, setInstrument] = useState<Instrument>("BTC");
  const [horizon,    setHorizon]    = useState<Horizon>(30);
  const [refreshKey, setRefreshKey] = useState(0);
  const [, startTransition] = useTransition();

  const handleRefresh = useCallback(() => {
    bustPriceCache();
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!isConnected) router.replace("/app");
  }, [isConnected, router]);

  useEffect(() => {
    if (!isConnected || walletLoading) return;

    // Connected wallet with no supported holdings: do NOT fall back to demo data.
    // Clear any prior result and show the empty-wallet message instead.
    if (!hasBalances || !walletPortfolio) {
      setMetrics(null);
      setLivePortfolio(null);
      setLiveCalibration(null);
      setDataSource(null);
      setAsOf(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const ALL_SYMBOLS = ["BTC","ETH","SOL","LINK","DOGE","PEPE","FLOKI","BONK","WIF","USDT"];
    const sourcePortfolio: Promise<Portfolio> = Promise.resolve(walletPortfolio);

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
        setBtcPrice(prices["BTC"] ?? null);
        setDataSource("wallet");
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
          setDataSource("wallet");
          setAsOf(null);
          setError("Live market prices unavailable — showing your holdings at last-known prices.");
        } catch (e2) {
          setError((e2 as Error).message);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [isConnected, walletLoading, hasBalances, walletPortfolio, refreshKey]);

  const simResult = useMemo<SimResult | null>(() => {
    if (!livePortfolio || !liveCalibration) return null;
    return simulate(livePortfolio, liveCalibration, { h: hedge, instrument, horizonDays: horizon });
  }, [livePortfolio, liveCalibration, hedge, instrument, horizon]);

  const baseSim = useMemo<SimResult | null>(() => {
    if (!livePortfolio || !liveCalibration || hedge === 0) return null;
    return simulate(livePortfolio, liveCalibration, { h: 0, instrument: "BTC", horizonDays: horizon });
  }, [livePortfolio, liveCalibration, hedge, horizon]);

  const onSlider = useCallback((val: number) => {
    setSliderPct(val);
    startTransition(() => setHedge(val / 100));
  }, [startTransition]);

  const fmtPct  = (n: number) => (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%";
  const equity  = metrics?.totalEquity ?? 0;
  const usd     = (ret: number) => "≈ $" + Math.round(equity * (1 + ret)).toLocaleString();
  const fundRate = instrument === "BTC"
    ? (liveCalibration?.funding_annual ?? 0)
    : (liveCalibration?.mstr_borrow_annual ?? 0);

  const emptyWallet = isConnected && !walletLoading && !hasBalances;
  const ready = simResult && !loading && !walletLoading && !emptyWallet;

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
                {emptyWallet ? "No holdings found" : "Your wallet · Arbitrum"}
              </p>
              {dataSource === "wallet" && asOf && <LiveBadge label={`Live · ${asOf}`} />}
              {walletLoading && <span className="text-[11px] text-muted">Reading wallet…</span>}
              {!walletLoading && !emptyWallet && (
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  title="Refresh live prices from Bybit"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] text-muted hover:border-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
              )}
            </div>
            {emptyWallet && (
              <div className="rounded-xl border border-border bg-surface px-5 py-6">
                <p className="text-sm font-medium text-foreground">No holdings found in this wallet</p>
                <p className="mt-1.5 text-sm text-muted">
                  Veylix reads your live positions to model their downside risk. This wallet has no
                  supported holdings on Arbitrum, so there&apos;s nothing to analyse yet. Connect a
                  wallet that holds assets (e.g. ETH, WBTC, USDT) to see your risk profile.
                </p>
                <div className="mt-4">
                  <ConnectButton showBalance={false} />
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-downside">{error}</p>}

          {/* Loading skeleton */}
          {(loading || walletLoading) && !emptyWallet && (
            <div className="space-y-4">
              <div className="h-10 w-64 animate-pulse rounded-lg border border-border bg-surface" />
              <div className="h-56 animate-pulse rounded-xl border border-border bg-surface" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-28 animate-pulse rounded-xl border border-border bg-surface" />
                <div className="h-28 animate-pulse rounded-xl border border-border bg-surface" />
              </div>
            </div>
          )}

          {/* ── Tabs ── */}
          {ready && (
            <>
              {/* Tab bar */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1 rounded-lg border border-border bg-surface-2 p-1 w-fit">

                {(["portfolio", "risk"] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-md px-5 py-2 text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? "bg-surface text-foreground shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {tab === "portfolio" ? "Portfolio" : "Risk & Hedging"}
                  </button>
                ))}
                </div>
                {livePortfolio && liveCalibration && (
                  <ScenarioPanel
                    portfolio={livePortfolio}
                    calibration={liveCalibration}
                    h={hedge}
                    instrument={instrument}
                    horizon={horizon}
                  />
                )}
              </div>

              {/* ── Tab 1: Portfolio ── */}
              {activeTab === "portfolio" && metrics && (
                <div className="space-y-6">
                  {/* Summary stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Tile
                      label="Total value"
                      value={`$${metrics.totalEquity.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                      tip={TIPS.totalValue}
                    />
                    <Tile
                      label="Effective BTC beta"
                      value={`${metrics.effectiveBeta.toFixed(2)}x`}
                      color="amber"
                      tip={TIPS.effectiveBtcBeta}
                    />
                    <Tile
                      label="BTC risk share"
                      value={`${(metrics.btcShare * 100).toFixed(0)}%`}
                      color={metrics.btcShare > 0.8 ? "coral" : metrics.btcShare > 0.5 ? "amber" : undefined}
                      tip={TIPS.btcRiskShare}
                    />
                  </div>

                  {/* Pie chart */}
                  <div className="rounded-xl border border-border bg-surface p-6">
                    <p className="text-[10px] uppercase tracking-widest text-muted mb-5">Allocation</p>
                    <PieChart coins={metrics.coins} totalEquity={metrics.totalEquity} />
                  </div>

                  {/* Holdings table */}
                  <div className="overflow-hidden rounded-xl border border-border bg-surface">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-muted">
                          <th className="px-5 py-3">Asset</th>
                          <th className="px-5 py-3 text-right">
                            <span className="inline-flex items-center justify-end gap-1">
                              Qty
                              <InfoTip text={TIPS.colQty} align="end" direction="down" />
                            </span>
                          </th>
                          <th className="px-5 py-3 text-right">
                            <span className="inline-flex items-center justify-end gap-1">
                              Value (USD)
                              <InfoTip text={TIPS.colValue} align="end" direction="down" />
                            </span>
                          </th>
                          <th className="px-5 py-3 text-right">
                            <span className="inline-flex items-center justify-end gap-1">
                              Weight
                              <InfoTip text={TIPS.colWeight} align="end" direction="down" />
                            </span>
                          </th>
                          <th className="px-5 py-3 text-right">
                            <span className="inline-flex items-center justify-end gap-1">
                              Beta
                              <InfoTip text={TIPS.colBeta} align="end" direction="down" />
                            </span>
                          </th>
                          <th className="px-5 py-3 text-right">
                            <span className="inline-flex items-center justify-end gap-1">
                              Daily idio σ
                              <InfoTip text={TIPS.colIdioVol} align="end" direction="down" />
                            </span>
                          </th>
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
                </div>
              )}

              {/* ── Tab 2: Risk & Hedging ── */}
              {activeTab === "risk" && simResult && (
                <div className="space-y-6">
                  {/* Cone hero */}
                  <div className="rounded-xl border border-border bg-surface p-5">
                    <div className="grid grid-cols-[110px_1fr] gap-5 items-start">
                      <div className="flex flex-col gap-5">
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <p className="text-[10px] uppercase tracking-widest text-muted">Value at Risk (95%)</p>
                            <InfoTip text={TIPS.heroWorstCase} />
                          </div>
                          <p className="font-mono text-3xl font-bold tabular text-downside leading-none">
                            {fmtPct(simResult.final.worstCase5pctReturn)}
                          </p>
                          <p className="font-mono text-xs text-muted mt-1 tabular">
                            {usd(simResult.final.worstCase5pctReturn)}
                          </p>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <p className="text-[10px] uppercase tracking-widest text-muted">Median outcome</p>
                            <InfoTip text={TIPS.heroMedian} />
                          </div>
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
                        <div className="flex items-center gap-1 mb-2">
                          <p className="text-[10px] uppercase tracking-widest text-muted">Hedge instrument</p>
                          <InfoTip text={TIPS.hedgeInstrument} />
                        </div>
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
                        <div className="flex items-center gap-1 mb-2">
                          <p className="text-[10px] uppercase tracking-widest text-muted">Hedge amount</p>
                          <InfoTip text={TIPS.hedgeAmount} />
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="range" min={0} max={100} value={sliderPct}
                            onChange={(e) => onSlider(+e.target.value)}
                            className="flex-1 h-1 rounded-full appearance-none cursor-pointer accent-accent bg-border"
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
                        <div className="flex items-center gap-1 mb-2">
                          <p className="text-[10px] uppercase tracking-widest text-muted">Horizon</p>
                          <InfoTip text={TIPS.horizon} />
                        </div>
                        <div className="flex rounded-lg border border-border bg-surface-2 p-1 gap-1">
                          {([1, 7, 30] as Horizon[]).map((d) => (
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
                          {horizon === 1 ? "A bad day" : horizon === 7 ? "A bad week" : "A bad month"} scenario window.
                        </p>
                      </div>
                      <div className="pt-3 border-t border-border space-y-1">
                        <RateRow
                          label={instrument === "BTC" ? "BTC funding (ann.)" : "MSTR borrow (ann.)"}
                          value={`${(fundRate * 100).toFixed(2)}%/yr`}
                          tip={instrument === "BTC" ? TIPS.btcFunding : TIPS.mstrBorrow}
                        />
                        <RateRow
                          label="BTC factor vol (daily)"
                          value={`${((liveCalibration?.btc_factor_vol_daily ?? 0) * 100).toFixed(2)}%`}
                          tip={TIPS.btcFactorVol}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Solve for a target VaR */}
                  {livePortfolio && liveCalibration && (
                    <HedgeSolver
                      portfolio={livePortfolio}
                      calibration={liveCalibration}
                      instrument={instrument}
                      horizon={horizon}
                      btcPrice={btcPrice}
                      currentVar={simResult.final.worstCase5pctReturn}
                      onApply={(hPct) => { setSliderPct(hPct); setHedge(hPct / 100); }}
                    />
                  )}

                  {/* Stat tiles */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    <Tile
                      label="Median outcome"
                      value={fmtPct(simResult.final.medianReturn)}
                      color={simResult.final.medianReturn >= 0 ? "teal" : "coral"}
                      tip={TIPS.tileMedian}
                    />
                    <Tile
                      label="Value at Risk"
                      value={fmtPct(simResult.final.worstCase5pctReturn)}
                      color="coral"
                      tip={TIPS.tileWorstCase}
                    />
                    <Tile
                      label="Typical max drawdown"
                      value={`-${(-simResult.final.typicalMaxDrawdown * 100).toFixed(1)}%`}
                      color="coral"
                      tip={TIPS.tileMaxDrawdown}
                    />
                    <Tile
                      label="Chance loss >25%"
                      value={`${(simResult.final.probLossGt25pct * 100).toFixed(1)}%`}
                      color="coral"
                      tip={TIPS.tileProbLoss25}
                    />
                    <Tile
                      label="Effective BTC beta"
                      value={`${simResult.effectiveBeta.toFixed(2)}x`}
                      color="amber"
                      tip={TIPS.tileEffBeta}
                    />
                    <Tile
                      label={instrument === "BTC" ? "BTC funding" : "MSTR borrow"}
                      value={`${(fundRate * 100).toFixed(1)}%/yr`}
                      tip={TIPS.tileFundingRate}
                    />
                    <Tile
                      label="Cost of insurance"
                      value={
                        Math.abs(simResult.carryOverHorizonPct * equity) < 0.5
                          ? "$0"
                          : `-$${Math.round(simResult.carryOverHorizonPct * equity).toLocaleString()}`
                      }
                      color={simResult.carryOverHorizonPct * equity >= 0.5 ? "coral" : undefined}
                      tip={TIPS.tileCostInsurance}
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

                  {/* Anchor the base report on-chain */}
                  {livePortfolio && liveCalibration && (
                    <AnchorReport
                      portfolio={livePortfolio}
                      calibration={liveCalibration}
                      scenarioOverrides={null}
                      params={{ h: hedge, instrument, horizonDays: horizon }}
                      sim={simResult}
                      note="Anchor this risk report's fingerprint to Arbitrum, then download the data. Anyone can re-run the engine with these exact inputs (current hedge & horizon), re-hash, and confirm it matches the chain."
                    />
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-6 py-6">
          <p className="text-xs leading-relaxed text-muted">
            Educational use only.
          </p>
        </div>
      </footer>
    </div>
  );
}