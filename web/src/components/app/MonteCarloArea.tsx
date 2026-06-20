"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { type ConeRow } from "@/lib/veylix-view";
import { fmtUsd } from "@/lib/veylix-data";

const config: ChartConfig = {
  band95: { label: "5–95% range" },
  band50: { label: "25–75% range" },
  median: { label: "Median", color: "var(--color-primary)" },
  worst: { label: "Worst 5%", color: "var(--color-destructive)" },
};

interface Props {
  cone: ConeRow[];
  baseCone?: ConeRow[]; // unhedged baseline (ghost); omit on the Current view
  horizon: number;
  equity: number;
}

interface Row {
  t: number;
  band95: [number, number];
  band50: [number, number];
  median: number;
  worst: number;
  best: number;
  baseBand?: [number, number];
}

export function MonteCarloArea({ cone, baseCone, horizon, equity }: Props) {
  const rows: Row[] = cone.map((c, i) => ({
    t: c.t,
    band95: [c.p5, c.p95],
    band50: [c.p25, c.p75],
    median: c.p50,
    worst: c.p5,
    best: c.p95,
    baseBand: baseCone ? [baseCone[i].p5, baseCone[i].p95] : undefined,
  }));

  let lo = Infinity;
  let hi = -Infinity;
  for (const c of cone) {
    lo = Math.min(lo, c.p5);
    hi = Math.max(hi, c.p95);
  }
  if (baseCone) for (const c of baseCone) { lo = Math.min(lo, c.p5); hi = Math.max(hi, c.p95); }
  const pad = (hi - lo) * 0.08 || 4;
  lo -= pad;
  hi += pad;

  const xTicks = horizon <= 7 ? Array.from({ length: horizon + 1 }, (_, i) => i)
    : horizon <= 30 ? [0, 7, 14, 21, horizon] : [0, 30, 60, 90];

  return (
    <ChartContainer config={config} className="aspect-[16/9] w-full">
      <AreaChart data={rows} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="mcWide" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--color-destructive)" stopOpacity={0.22} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.25} />
        <XAxis dataKey="t" type="number" domain={[0, horizon]} ticks={xTicks}
          tickFormatter={(t) => (t === 0 ? "now" : `${t}d`)} tickLine={false} axisLine={false}
          tickMargin={8} fontSize={11} />
        <YAxis yAxisId="pct" domain={[lo, hi]} tickFormatter={(v) => `${v >= 0 ? "+" : ""}${Math.round(v)}%`}
          tickLine={false} axisLine={false} width={42} fontSize={11} />
        <YAxis yAxisId="usd" orientation="right" domain={[lo, hi]}
          tickFormatter={(v) => `$${fmtUsd(equity * (1 + v / 100))}`} tickLine={false} axisLine={false}
          width={58} fontSize={11} />
        <ReferenceLine yAxisId="pct" y={0} stroke="var(--color-foreground)" strokeDasharray="4 4" strokeOpacity={0.3} />

        {baseCone && (
          <Area yAxisId="pct" dataKey="baseBand" stroke="var(--color-muted-foreground)" strokeOpacity={0.35}
            strokeDasharray="3 3" strokeWidth={1} fill="var(--color-muted-foreground)" fillOpacity={0.06}
            isAnimationActive={false} connectNulls dot={false} activeDot={false} />
        )}
        <Area yAxisId="pct" dataKey="band95" stroke="none" fill="url(#mcWide)" isAnimationActive={false} dot={false} activeDot={false} />
        <Area yAxisId="pct" dataKey="band50" stroke="none" fill="var(--color-muted-foreground)" fillOpacity={0.12} isAnimationActive={false} dot={false} activeDot={false} />
        <Area yAxisId="pct" dataKey="worst" stroke="var(--color-destructive)" strokeWidth={1.5} fill="none" isAnimationActive={false} dot={false} activeDot={{ r: 3 }} />
        <Area yAxisId="pct" dataKey="median" stroke="var(--color-primary)" strokeWidth={2.25} fill="none" isAnimationActive={false} dot={false} activeDot={{ r: 3 }} />

        <Tooltip
          cursor={{ stroke: "var(--color-border)" }}
          content={({ active, payload }) => {
            if (!active || !payload || !payload.length) return null;
            const r = payload[0].payload as Row;
            const line = (lbl: string, pct: number, color: string) => (
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ background: color }} />{lbl}
                </span>
                <span className="font-mono tabular-nums">
                  {pct >= 0 ? "+" : ""}{pct.toFixed(1)}% · ${fmtUsd(equity * (1 + pct / 100))}
                </span>
              </div>
            );
            return (
              <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                <div className="mb-1 font-medium">{r.t === 0 ? "Today" : `Day ${r.t}`}</div>
                {line("Best 5%", r.best, "var(--color-chart-2)")}
                {line("Median", r.median, "var(--color-primary)")}
                {line("Worst 5%", r.worst, "var(--color-destructive)")}
              </div>
            );
          }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
