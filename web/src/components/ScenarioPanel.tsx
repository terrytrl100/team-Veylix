"use client";

import { useCallback, useMemo, useState } from "react";
import { X, ArrowUp, Loader2 } from "lucide-react";
import { simulate } from "@/lib/veylix-sim";
import type { SimResult, Instrument } from "@/lib/veylix-sim";
import type { Portfolio, Calibration } from "@/lib/types";
import { applyOverrides, diffCalibration, type ScenarioOverrides } from "@/lib/scenario";
import AnchorReport from "@/components/AnchorReport";
import { useTextareaResize } from "@/hooks/use-textarea-resize";

interface Props {
  portfolio: Portfolio;
  calibration: Calibration;
  h: number;
  instrument: Instrument;
  horizon: number;
}

const PRESETS = [
  "A 2022 LUNA-style correlated crypto crash",
  "A COVID-March liquidity shock across all markets",
  "A perp funding squeeze with no spot crash",
  "A calm, sideways market for the next month",
];

const pf = (n: number) => (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%";

function fmtParam(param: string, v: number): string {
  if (/vol/i.test(param)) return (v * 100).toFixed(2) + "%";
  if (/beta/i.test(param)) return v.toFixed(3);
  if (/annual|funding|borrow/i.test(param)) return (v * 100).toFixed(1) + "%/yr";
  return v.toFixed(3);
}

export default function ScenarioPanel({ portfolio, calibration, h, instrument, horizon }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rationale, setRationale] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<ScenarioOverrides | null>(null);

  const taRef = useTextareaResize(text, 1);

  const stressedCalibration = useMemo(
    () => (overrides ? applyOverrides(calibration, overrides) : null),
    [overrides, calibration],
  );

  const baseSim = useMemo<SimResult | null>(
    () => (overrides ? simulate(portfolio, calibration, { h, instrument, horizonDays: horizon }) : null),
    [overrides, portfolio, calibration, h, instrument, horizon],
  );
  const stressedSim = useMemo<SimResult | null>(
    () => (stressedCalibration ? simulate(portfolio, stressedCalibration, { h, instrument, horizonDays: horizon }) : null),
    [stressedCalibration, portfolio, h, instrument, horizon],
  );
  const diff = useMemo(
    () => (stressedCalibration ? diffCalibration(calibration, stressedCalibration) : []),
    [stressedCalibration, calibration],
  );

  const reset = useCallback(() => {
    setOverrides(null); setRationale(null); setError(null); setText("");
  }, []);

  const close = useCallback(() => { setOpen(false); reset(); }, [reset]);

  const run = useCallback(async (scenario: string) => {
    const s = scenario.trim();
    if (!s || loading) return;
    setLoading(true); setError(null);
    try {
      const coins = portfolio.result.list[0].coin.map((c) => c.coin);
      const res = await fetch("/api/scenario", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scenarioText: s,
          portfolioSummary: { coins },
          baseline: {
            btc_factor_vol_daily: calibration.btc_factor_vol_daily,
            funding_annual: calibration.funding_annual,
            mstr_borrow_annual: calibration.mstr_borrow_annual,
            symbols: calibration.symbols,
          },
        }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error ?? "Scenario could not be applied."); setOverrides(null); }
      else { setOverrides(data.overrides ?? {}); setRationale(data.rationale ?? null); }
    } catch {
      setError("Network error — could not run scenario.");
    } finally {
      setLoading(false);
    }
  }, [loading, portfolio, calibration]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20 transition-colors"
      >
        <img src="/claude-icon.svg" className="h-4 w-4" alt="" />
        Test a market scenario with AI
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(440px,calc(100vw-2rem))] max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <img src="/claude-icon.svg" className="h-4 w-4" alt="" />
          <p className="text-sm font-semibold">AI scenario test</p>
          <span className="text-[10px] text-muted/60">powered by Claude Haiku 4.5</span>
        </div>
        <button onClick={close} aria-label="Close scenario panel"
          className="rounded-md p-1 text-muted hover:text-foreground hover:bg-surface-2 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <p className="text-xs text-muted leading-relaxed">
          Describe a market condition in plain English. The AI translates it into stress
          parameters; the modelling engine re-runs with the same seed, so the result is exactly
          reproducible. The change is shown in full below.
        </p>

        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p} onClick={() => { setText(p); run(p); }} disabled={loading}
              className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] text-muted hover:border-muted hover:text-foreground transition-colors disabled:opacity-40">
              {p.length > 34 ? p.slice(0, 32) + "…" : p}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-2 rounded-xl border border-border bg-surface-2 p-2 focus-within:border-muted transition-colors">
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(text); } }}
            placeholder="e.g. what if there's a sudden ETF outflow shock?"
            rows={1}
            maxLength={500}
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted/60 outline-none max-h-[160px] self-start pt-1"
          />
          <button onClick={() => run(text)} disabled={loading || !text.trim()} aria-label="Run scenario"
            className="shrink-0 rounded-full bg-accent p-1.5 text-background disabled:opacity-40 hover:opacity-90 transition-opacity">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>

        {error && <p className="text-xs text-downside">{error}</p>}

        {rationale && (
          <div className="rounded-lg border border-border bg-surface-2 p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted mb-1.5">What the AI modelled</p>
            <p className="text-xs leading-relaxed text-foreground">{rationale}</p>
          </div>
        )}

        {baseSim && stressedSim && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted">Before → after this scenario</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["Value at Risk (95%)", baseSim.final.worstCase5pctReturn, stressedSim.final.worstCase5pctReturn, "pct"],
                ["Median", baseSim.final.medianReturn, stressedSim.final.medianReturn, "pct"],
                ["Loss >25%", baseSim.final.probLossGt25pct, stressedSim.final.probLossGt25pct, "prob"],
              ] as Array<[string, number, number, string]>).map(([label, b, s, kind]) => {
                const fmt = (v: number) => kind === "prob" ? (v * 100).toFixed(1) + "%" : pf(v);
                const deltaPts = (s - b) * 100;
                const changed = Math.abs(deltaPts) >= 0.05;
                // For VaR/Loss, more negative VaR or higher loss-prob = worse (red).
                // For Median, lower = worse.
                const worse = label === "Median" ? s < b : (kind === "prob" ? s > b : s < b);
                return (
                  <div key={label} className="rounded-lg border border-border bg-surface-2 p-2.5">
                    <p className="text-[9px] uppercase tracking-widest text-muted leading-tight">{label}</p>
                    <div className="mt-1.5 flex flex-col gap-1">
                      <span className="flex items-baseline gap-1.5">
                        <span className="text-[8px] uppercase tracking-wider text-muted/60 w-9">before</span>
                        <span className="font-mono text-[11px] text-muted tabular line-through decoration-muted/40">{fmt(b)}</span>
                      </span>
                      <span className="flex items-baseline gap-1.5">
                        <span className="text-[8px] uppercase tracking-wider text-muted/60 w-9">after</span>
                        <span className={`font-mono text-sm font-semibold tabular ${changed ? (worse ? "text-downside" : "text-upside") : "text-foreground"}`}>{fmt(s)}</span>
                      </span>
                    </div>
                    <p className={`font-mono text-[10px] tabular mt-1 ${changed ? (worse ? "text-downside" : "text-upside") : "text-muted"}`}>
                      {changed ? `${deltaPts >= 0 ? "+" : ""}${deltaPts.toFixed(1)} pts` : "no change"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {diff.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden">
            <p className="text-[10px] uppercase tracking-widest text-muted px-3 py-2 border-b border-border bg-surface-2">
              Parameters changed
            </p>
            <table className="w-full text-[11px]">
              <tbody>
                {diff.map((r) => (
                  <tr key={r.param} className="border-b border-border last:border-0">
                    <td className="px-3 py-1.5 text-muted">{r.param}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular text-muted">{fmtParam(r.param, r.from)}</td>
                    <td className="px-2 py-1.5 text-center text-muted">→</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular text-accent">{fmtParam(r.param, r.to)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular text-muted">
                      {r.from !== 0 ? (r.to / r.from).toFixed(2) + "×" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {overrides && diff.length === 0 && !error && (
          <p className="text-xs text-muted">No parameters changed — this scenario is close to current market conditions.</p>
        )}

        {baseSim && stressedSim && stressedCalibration && (
          <AnchorReport
            portfolio={portfolio}
            calibration={stressedCalibration}
            scenarioOverrides={overrides}
            params={{ h, instrument, horizonDays: horizon }}
            sim={stressedSim}
            note="Anchor this stressed scenario's fingerprint to Arbitrum, then download the data. Anyone can re-run the engine with these inputs, re-hash, and confirm it matches the chain."
          />
        )}

        <p className="text-[10px] text-muted/70 leading-relaxed">
          Modelled scenario — not financial advice. The AI only proposes which parameters to
          stress; all risk numbers come from the deterministic engine.
        </p>
      </div>
    </div>
  );
}