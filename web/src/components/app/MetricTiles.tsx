import { type Snapshot } from "@/lib/veylix-view";
import { fmtPct, fmtUsd } from "@/lib/veylix-data";
import { InfoTip } from "@/components/app/InfoTip";

function Tile({ label, tip, value, sub, tone, testId }: {
  label: string; tip: string; value: string; sub?: string;
  tone?: "down" | "up" | "accent"; testId?: string;
}) {
  const color = tone === "down" ? "text-destructive" : tone === "up" ? "text-chart-2" : tone === "accent" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-xl border bg-card/40 p-3">
      <div className="mb-1.5 flex items-center gap-1 text-[10px] uppercase leading-tight tracking-wide text-muted-foreground">
        <span>{label}</span>
        <InfoTip label={label} text={tip} />
      </div>
      <div data-testid={testId} className={`font-mono text-[17px] font-bold leading-none tabular-nums ${color}`}>{value}</div>
      {sub && <div className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function MetricTiles({
  snap, effBeta, grossLoading, fundingLabel, fundingRatePct, carryUsd, carryPct, showCost, testPrefix = "",
}: {
  snap: Snapshot; effBeta: number; grossLoading: number;
  fundingLabel: string; fundingRatePct: number; carryUsd: number; carryPct: number; showCost: boolean; testPrefix?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      <Tile label="Median outcome" tip="Your middle result over the horizon; half of scenarios do better, half worse."
        value={fmtPct(snap.p50Pct)} sub={`≈ $${fmtUsd(snap.p50Usd)}`} tone={snap.p50Pct >= 0 ? "up" : "down"} testId={`${testPrefix}tile-median`} />
      <Tile label="1-in-20 downside" tip="A realistic bad outcome — worse than this only about 5% of the time."
        value={fmtPct(snap.p5Pct)} sub={`≈ $${fmtUsd(snap.p5Usd)}`} tone="down" testId={`${testPrefix}tile-p5`} />
      <Tile label="Typical max drawdown" tip="The usual worst dip from a peak along the way, before any recovery."
        value={`−${snap.maxDrawdownPct.toFixed(1)}%`} tone="down" />
      <Tile label="Chance loss > 25%" tip="How often you would lose more than a quarter of your money over the horizon."
        value={`${snap.chanceLossPct.toFixed(1)}%`} tone="down" />
      <Tile label="Effective BTC beta" tip="How hard the portfolio still moves with BTC after hedging (0 = market-neutral)."
        value={`${effBeta.toFixed(2)}×`} sub={showCost ? `from ${grossLoading.toFixed(2)}×` : "unhedged"} tone="accent" testId={`${testPrefix}tile-beta`} />
      {showCost ? (
        <Tile label="Cost of insurance" tip="Dollar cost of holding the hedge over the horizon — the premium for the protection."
          value={carryUsd < 0.5 ? "$0" : `−$${fmtUsd(carryUsd)}`} sub={carryUsd < 0.5 ? undefined : `${carryPct.toFixed(2)}% / horizon`} tone={carryUsd < 0.5 ? undefined : "down"} />
      ) : (
        <Tile label={fundingLabel} tip="Annual rate to hold the hedge; a live market rate, not a recommendation."
          value={`${fundingRatePct.toFixed(1)}%/yr`} />
      )}
    </div>
  );
}
