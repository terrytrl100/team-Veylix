// Hedge solver — find the hedge ratio h that makes the engine produce a target
// 95% VaR. Solves against the REAL simulate() output (not a closed form), so
// everything the engine models — funding/borrow carry, MSTR basis risk, the
// return floor — is automatically included.
//
// VaR is NOT globally monotonic in h: more hedge improves downside until the
// portfolio nears market-neutral, then funding drag + opposite exposure make it
// worse again. So we (1) coarse-scan h for the best achievable VaR, then
// (2) binary-search within the well-behaved region between h=0 and that optimum.

import { simulate, type Instrument } from "./veylix-sim";
import type { Portfolio, Calibration } from "./types";

export interface HedgeSolution {
  reached: boolean;          // did we hit the requested target (within tolerance)?
  h: number;                 // hedge ratio (fraction of portfolio value) the model implies
  achievedVar: number;       // 95% VaR the engine produces at that h (e.g. -0.15)
  targetVar: number;         // the target the user asked for
  bestVar: number;           // best achievable VaR with this instrument
  bestH: number;             // the h that achieves bestVar
  notionalUsd: number;       // dollar notional of the short
  units: number;             // BTC-equivalent units, or MSTR shares (0 if price unknown)
  unitLabel: string;         // "BTC" | "MSTR shares"
  carryOverHorizonPct: number; // carry cost over the horizon at solved h (negative = cost)
}

interface SolveArgs {
  portfolio: Portfolio;
  calibration: Calibration;
  instrument: Instrument;
  horizonDays: number;
  targetVar: number;         // e.g. -0.15 for a -15% VaR
  btcPrice?: number;         // for BTC unit conversion (optional)
  mstrPrice?: number;        // for MSTR share conversion (optional)
}

const varAt = (
  portfolio: Portfolio, calibration: Calibration,
  instrument: Instrument, horizonDays: number, h: number,
): number =>
  simulate(portfolio, calibration, { h, instrument, horizonDays }).final.worstCase5pctReturn;

export function solveHedgeForVar(args: SolveArgs): HedgeSolution {
  const { portfolio, calibration, instrument, horizonDays, targetVar } = args;

  const gross = simulate(portfolio, calibration, { h: 0, instrument, horizonDays }).grossLoading;
  const hMax = Math.max(gross * 1.5, 0.1);

  // 1) Coarse scan for the best (least-negative) achievable VaR and its h.
  const STEPS = 60;
  let bestH = 0;
  let bestVar = varAt(portfolio, calibration, instrument, horizonDays, 0);
  for (let i = 1; i <= STEPS; i++) {
    const h = (i / STEPS) * hMax;
    const v = varAt(portfolio, calibration, instrument, horizonDays, h);
    if (v > bestVar) { bestVar = v; bestH = h; }
  }

  const var0 = varAt(portfolio, calibration, instrument, horizonDays, 0);

  const finish = (h: number, reached: boolean): HedgeSolution => {
    const sim = simulate(portfolio, calibration, { h, instrument, horizonDays });
    const total = parseFloat(portfolio.result.list[0].totalEquity);
    const notionalUsd = h * total;
    let units = 0;
    let unitLabel = "BTC";
    if (instrument === "BTC") {
      unitLabel = "BTC";
      units = args.btcPrice && args.btcPrice > 0 ? notionalUsd / args.btcPrice : 0;
    } else {
      unitLabel = "MSTR shares";
      const m = calibration.hedge_instruments["MSTR"];
      const k = m ? h / m.beta : h;
      const mstrNotional = k * total;
      units = args.mstrPrice && args.mstrPrice > 0 ? mstrNotional / args.mstrPrice : 0;
    }
    return {
      reached, h,
      achievedVar: sim.final.worstCase5pctReturn,
      targetVar, bestVar, bestH,
      notionalUsd, units, unitLabel,
      carryOverHorizonPct: sim.carryOverHorizonPct,
    };
  };

  // 2) Target better than best achievable → unreachable.
  if (targetVar > bestVar + 1e-4) return finish(bestH, false);
  // Target at/worse than unhedged → h=0 already satisfies it.
  if (targetVar <= var0 + 1e-9) return finish(0, true);

  // 3) Binary-search h in [0, bestH] where VaR rises monotonically.
  let lo = 0, hi = bestH, hSol = bestH;
  for (let iter = 0; iter < 40; iter++) {
    const mid = (lo + hi) / 2;
    const v = varAt(portfolio, calibration, instrument, horizonDays, mid);
    if (v >= targetVar) { hSol = mid; hi = mid; } else { lo = mid; }
    if (Math.abs(v - targetVar) < 1e-4) { hSol = mid; break; }
  }

  return finish(hSol, true);
}
