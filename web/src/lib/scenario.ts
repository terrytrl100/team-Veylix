// Veylix scenario engine — turns AI-chosen stress MULTIPLIERS into a modified
// calibration, and diffs it against the baseline for transparent display.
// Pure functions: no network, no React. The AI never computes risk — it only
// proposes which parameters to stress; this module clamps and applies them, and
// the existing deterministic simulate() does the math.

import type { Calibration } from "./types";

export interface ScenarioOverrides {
  btc_factor_vol_mult?: number;
  funding_mult?: number;
  mstr_borrow_mult?: number;
  symbols?: Record<string, { beta_mult?: number; idio_vol_mult?: number }>;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const safeMult = (m: unknown, lo: number, hi: number, fallback = 1) =>
  typeof m === "number" && Number.isFinite(m) ? clamp(m, lo, hi) : fallback;

// Apply stress multipliers to a baseline calibration. Every resulting value is
// clamped to a sane absolute band so a bad AI response can never produce
// nonsense parameters.
export function applyOverrides(base: Calibration, ov: ScenarioOverrides): Calibration {
  const next: Calibration = structuredClone(base);

  if (ov.btc_factor_vol_mult != null)
    next.btc_factor_vol_daily = clamp(
      base.btc_factor_vol_daily * safeMult(ov.btc_factor_vol_mult, 0.5, 5),
      0.005, 0.25,
    );

  if (ov.funding_mult != null)
    next.funding_annual = clamp(base.funding_annual * safeMult(ov.funding_mult, 0.5, 10), 0, 2);

  if (ov.mstr_borrow_mult != null)
    next.mstr_borrow_annual = clamp(base.mstr_borrow_annual * safeMult(ov.mstr_borrow_mult, 0.5, 10), 0, 2);

  if (ov.symbols) {
    for (const [coin, m] of Object.entries(ov.symbols)) {
      const s = next.symbols[coin];
      if (!s) continue; // ignore coins not in calibration
      if (m.beta_mult != null)
        s.beta = clamp(s.beta * safeMult(m.beta_mult, 0.5, 5), 0, 3);
      if (m.idio_vol_mult != null)
        s.idio_vol_daily = clamp(s.idio_vol_daily * safeMult(m.idio_vol_mult, 0.5, 5), 0, 0.5);
    }
  }
  return next;
}

export interface DiffRow { param: string; from: number; to: number }

// List every calibration field that actually changed, for the transparency table.
export function diffCalibration(base: Calibration, next: Calibration): DiffRow[] {
  const rows: DiffRow[] = [];
  const push = (param: string, a: number, b: number) => {
    if (Math.abs(a - b) > 1e-9) rows.push({ param, from: a, to: b });
  };
  push("BTC factor vol (daily)", base.btc_factor_vol_daily, next.btc_factor_vol_daily);
  push("Funding (annual)", base.funding_annual, next.funding_annual);
  push("MSTR borrow (annual)", base.mstr_borrow_annual, next.mstr_borrow_annual);
  for (const c of Object.keys(base.symbols)) {
    if (!next.symbols[c]) continue;
    push(`${c} beta`, base.symbols[c].beta, next.symbols[c].beta);
    push(`${c} idio vol`, base.symbols[c].idio_vol_daily, next.symbols[c].idio_vol_daily);
  }
  return rows;
}