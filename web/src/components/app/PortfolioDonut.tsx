"use client";

import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { type PieSlice } from "@/lib/veylix-view";
import { fmtUsd } from "@/lib/veylix-data";

const config: ChartConfig = { value: { label: "Allocation" } };

export function PortfolioDonut({
  slices,
  centerTop,
  centerBottom,
}: {
  slices: PieSlice[];
  centerTop: string;
  centerBottom: string;
}) {
  const data = slices.map((s) => ({ name: s.label, value: Math.max(s.w * 100, 0.0001), color: s.color, usd: s.usd, short: s.short }));
  return (
    <div className="flex items-center gap-4">
      <ChartContainer config={config} className="aspect-square h-[140px] w-[140px] shrink-0">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={64}
            paddingAngle={1.5} startAngle={90} endAngle={-270} stroke="var(--color-background)" strokeWidth={1.5} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} fillOpacity={d.short ? 0.55 : 1} />
            ))}
          </Pie>
          <Tooltip content={({ active, payload }) => {
            if (!active || !payload || !payload.length) return null;
            const d = payload[0].payload;
            return (
              <div className="rounded-lg border border-border bg-popover px-3 py-1.5 text-xs shadow-md">
                <div className="font-medium">{d.short ? "− " : ""}{d.name}</div>
                <div className="font-mono tabular-nums text-muted-foreground">{d.value.toFixed(1)}% · ${fmtUsd(d.usd)}</div>
              </div>
            );
          }} />
          <text x="50%" y="47%" textAnchor="middle" className="fill-foreground" style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
            {centerTop}
          </text>
          <text x="50%" y="59%" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9 }}>
            {centerBottom}
          </text>
        </PieChart>
      </ChartContainer>
      <ul className="flex flex-1 flex-col gap-1.5">
        {slices.map((s, i) => (
          <li key={i} className="grid grid-cols-[10px_1fr_auto] items-center gap-2">
            <span className="size-2.5 rounded-[3px]" style={{ background: s.color, opacity: s.short ? 0.6 : 1 }} />
            <span className="truncate text-xs">
              <span className="font-medium">{s.short ? "Short " : ""}{s.sym}</span>{" "}
              <span className="text-muted-foreground">{(s.w * 100).toFixed(1)}%</span>
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{s.short ? "−" : ""}${fmtUsd(s.usd)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
