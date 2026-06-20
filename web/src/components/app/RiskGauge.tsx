import { fmtUsd } from "@/lib/veylix-data";

interface RiskGaugeProps {
  varPct: number; // 1-in-20 downside magnitude (positive %)
  varUsd: number;
  max?: number;
  size?: number;
}

/**
 * Radial speedometer for the 1-in-20 Value-at-Risk. Pure SVG (themes from CSS
 * vars, no JS layout measurement). Needle and value fall live as the hedge rises.
 */
export function RiskGauge({ varPct, varUsd, max = 60, size = 240 }: RiskGaugeProps) {
  const W = size;
  const H = size * 0.62;
  const cx = W / 2;
  const cy = H - 14;
  const r = W * 0.42;
  const A0 = 180;
  const A1 = 360;

  const clamped = Math.max(0, Math.min(max, varPct));
  const frac = clamped / max;
  const needle = A0 + frac * (A1 - A0);

  const polar = (deg: number, rad: number) => {
    const a = (deg * Math.PI) / 180;
    return { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) };
  };
  const arc = (a0: number, a1: number, rad: number) => {
    const p0 = polar(a0, rad);
    const p1 = polar(a1, rad);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A ${rad} ${rad} 0 ${large} 1 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  };

  const z1 = A0 + 0.4 * 180;
  const z2 = A0 + 0.7 * 180;
  const np = polar(needle, r - W * 0.06);
  const sw = W * 0.055;

  const word = varPct < max * 0.4 ? "LOWER" : varPct < max * 0.7 ? "ELEVATED" : "SEVERE";
  const wordColor = varPct < max * 0.4 ? "var(--color-chart-2)" : varPct < max * 0.7 ? "var(--color-chart-4)" : "var(--color-destructive)";

  // tick marks every 20%
  const ticks = [];
  for (let v = 0; v <= max; v += 20) {
    const a = A0 + (v / max) * 180;
    const o = polar(a, r + sw * 0.5);
    const i = polar(a, r - sw * 0.5);
    ticks.push(
      <line key={v} x1={i.x.toFixed(2)} y1={i.y.toFixed(2)} x2={o.x.toFixed(2)} y2={o.y.toFixed(2)} stroke="var(--color-background)" strokeWidth={2} opacity={0.6} />,
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: size }} role="img"
      aria-label={`Risk gauge: 1-in-20 worst case about ${varPct.toFixed(1)} percent, roughly ${fmtUsd(varUsd)} dollars.`}>
      <path d={arc(A0, A1, r)} fill="none" stroke="var(--color-muted)" strokeWidth={sw} strokeLinecap="round" />
      <path d={arc(A0, z1, r)} fill="none" stroke="var(--color-chart-2)" strokeWidth={sw} strokeLinecap="round" />
      <path d={arc(z1, z2, r)} fill="none" stroke="var(--color-chart-4)" strokeWidth={sw} />
      <path d={arc(z2, A1, r)} fill="none" stroke="var(--color-destructive)" strokeWidth={sw} strokeLinecap="round" />
      {ticks}
      <line x1={cx} y1={cy} x2={np.x.toFixed(1)} y2={np.y.toFixed(1)} stroke="var(--color-foreground)" strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={W * 0.03} fill="var(--color-foreground)" />
      <text x={cx} y={cy - H * 0.34} textAnchor="middle" fontSize={W * 0.15} fontWeight={800} fill="var(--color-destructive)"
        style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
        −{varPct.toFixed(1)}%
      </text>
      <text x={cx} y={cy - H * 0.18} textAnchor="middle" fontSize={W * 0.058} fill="var(--color-muted-foreground)"
        style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
        ≈ −${fmtUsd(varUsd)}
      </text>
      <text x={cx} y={cy - H * 0.03} textAnchor="middle" fontSize={W * 0.05} fontWeight={700} fill={wordColor} letterSpacing="0.08em">
        {word} RISK
      </text>
    </svg>
  );
}
