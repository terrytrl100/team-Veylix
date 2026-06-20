"use client";

import { Bar, BarChart, Cell, XAxis, YAxis, Tooltip } from "recharts";
import { ShieldCheck, TriangleAlert, AlertTriangle, Info } from "lucide-react";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { type StructuralRisk, type Severity, severityLabel } from "@/lib/moralis-mock";
import { InfoTip } from "@/components/app/InfoTip";

const cfg: ChartConfig = { pct: { label: "Share of supply" } };

function sevIcon(s: Severity) {
  if (s === "high") return <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden />;
  if (s === "medium") return <AlertTriangle className="size-4 shrink-0 text-chart-4" aria-hidden />;
  if (s === "low") return <Info className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
  return <ShieldCheck className="size-4 shrink-0 text-chart-2" aria-hidden />;
}
function sevBorder(s: Severity) {
  return s === "high" ? "border-destructive/40 bg-destructive/5"
    : s === "medium" ? "border-chart-4/40 bg-chart-4/5"
    : "border-border bg-card/40";
}

export function StructuralRiskPanel({ risk }: { risk: StructuralRisk }) {
  const scoreColor = risk.score >= 60 ? "text-destructive" : risk.score >= 35 ? "text-chart-4" : "text-chart-2";
  const data = risk.holders.map((h) => ({ label: h.label, pct: h.pct, whale: h.whale }));

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Structural-risk flags · {risk.asset}
              <InfoTip label="Structural risk" text="On-chain health of your riskiest holding — holder concentration and contract-safety signals. Mock data, shaped for live Moralis." />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{risk.summary}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className={`font-mono text-2xl font-bold leading-none tabular-nums ${scoreColor}`}>{risk.score}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">risk score</div>
          </div>
        </div>
        <ul className="flex flex-col gap-2">
          {risk.flags.map((f) => (
            <li key={f.id} className={`flex items-start gap-2.5 rounded-xl border p-2.5 ${sevBorder(f.severity)}`}>
              {sevIcon(f.severity)}
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {f.title}
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {severityLabel(f.severity)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{f.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Holder concentration · top-10 hold {risk.top10Pct}%
          <InfoTip label="Holder concentration" text="How much of the supply sits in the largest wallets. High concentration means a few holders can move the price." />
        </div>
        <ChartContainer config={cfg} className="aspect-[4/3] w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <XAxis type="number" domain={[0, "dataMax"]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} fontSize={11} />
            <YAxis type="category" dataKey="label" width={92} tickLine={false} axisLine={false} fontSize={11} />
            <Tooltip cursor={{ fill: "var(--color-muted)", opacity: 0.3 }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-lg border border-border bg-popover px-3 py-1.5 text-xs shadow-md">
                    <div className="font-medium">{d.label}{d.whale ? " · whale" : ""}</div>
                    <div className="font-mono tabular-nums text-muted-foreground">{d.pct}% of supply</div>
                  </div>
                );
              }} />
            <Bar dataKey="pct" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.whale ? "var(--color-destructive)" : "var(--color-primary)"} fillOpacity={d.whale ? 0.85 : 0.55} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}
