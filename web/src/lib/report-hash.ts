// Deterministic report fingerprinting for on-chain anchoring.
// The hash MUST be reproducible byte-for-byte across machines, so we:
//   1. include every input that affects the output (incl. the RNG seed),
//   2. sort all object keys recursively,
//   3. round every number to a fixed precision before serialising.
// Any verifier that re-runs the engine and applies the same canonicalisation
// will get an identical keccak256 — that is the proof.

import { keccak256, toBytes } from "viem";
import type { Portfolio, Calibration } from "./types";
import type { SimResult, Instrument } from "./veylix-sim";
import type { ScenarioOverrides } from "./scenario";

// Veylix uses a fixed RNG seed; record it so re-runs reproduce exactly.
export const REPORT_SEED = 388821; // 0x5EED5

const DP = 8; // fixed decimal precision for every number in the fingerprint
const r = (n: number) => Number(n.toFixed(DP));
const rArr = (a: number[]) => a.map(r);

export interface ReportParams {
  h: number;
  instrument: Instrument;
  horizonDays: number;
}

export interface ReportInput {
  portfolio: Portfolio;
  calibration: Calibration;
  scenarioOverrides: ScenarioOverrides | null;
  params: ReportParams;
  sim: SimResult;
}

// Recursively sort object keys so JSON.stringify is order-independent.
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = sortDeep((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

// Build the canonical report object (sorted keys, fixed-precision numbers).
export function canonicalReport(input: ReportInput): unknown {
  const { portfolio, calibration, scenarioOverrides, params, sim } = input;
  const acct = portfolio.result.list[0];

  const coins = acct.coin
    .map((c) => ({
      coin: c.coin,
      usdValue: parseFloat(c.usdValue).toFixed(2),
      walletBalance: parseFloat(c.walletBalance).toFixed(6),
    }))
    .sort((a, b) => (a.coin < b.coin ? -1 : a.coin > b.coin ? 1 : 0));

  const symbols: Record<string, { beta: number; idio_vol_daily: number }> = {};
  for (const k of Object.keys(calibration.symbols)) {
    symbols[k] = {
      beta: r(calibration.symbols[k].beta),
      idio_vol_daily: r(calibration.symbols[k].idio_vol_daily),
    };
  }

  const report = {
    version: "veylix-1",
    portfolio: {
      totalEquity: parseFloat(acct.totalEquity).toFixed(2),
      coins,
    },
    calibration: {
      model_version: calibration.model_version,
      btc_factor_vol_daily: r(calibration.btc_factor_vol_daily),
      funding_annual: r(calibration.funding_annual),
      mstr_borrow_annual: r(calibration.mstr_borrow_annual),
      symbols,
    },
    scenarioOverrides: scenarioOverrides ?? null,
    params: {
      h: r(params.h),
      instrument: params.instrument,
      horizonDays: params.horizonDays,
      seed: REPORT_SEED,
    },
    outputs: {
      medianReturn: r(sim.final.medianReturn),
      worstCase5pctReturn: r(sim.final.worstCase5pctReturn),
      probLossGt25pct: r(sim.final.probLossGt25pct),
      typicalMaxDrawdown: r(sim.final.typicalMaxDrawdown),
      effectiveBeta: r(sim.effectiveBeta),
      btcVarShare: r(sim.btcVarShare),
      cone: {
        p5: rArr(sim.cone.p5),
        p50: rArr(sim.cone.p50),
        p95: rArr(sim.cone.p95),
      },
    },
  };

  return sortDeep(report);
}

// Stable JSON string of the canonical report (what gets hashed).
export function canonicalJSON(input: ReportInput): string {
  return JSON.stringify(canonicalReport(input));
}

// 32-byte keccak256 fingerprint, as 0x-hex — this is what we anchor on-chain.
export function hashReport(input: ReportInput): `0x${string}` {
  return keccak256(toBytes(canonicalJSON(input)));
}

// The downloadable "verification kit": the exact canonical report that was
// hashed, plus the resulting hash and instructions to re-verify. A holder of
// this file can re-run the engine, re-hash, and compare against the chain.
export interface VerificationKit {
  veylix_report_version: string;
  generated_at: string;
  report_hash: `0x${string}`;
  hash_algorithm: string;
  canonical_report: unknown;
  how_to_verify: string;
}

export function buildVerificationKit(input: ReportInput): VerificationKit {
  return {
    veylix_report_version: "veylix-1",
    generated_at: new Date().toISOString(),
    report_hash: hashReport(input),
    hash_algorithm:
      "keccak256 of JSON.stringify(canonical_report). Canonicalisation: all object keys sorted alphabetically (recursively), all numbers rounded to 8 decimal places, USD values to 2dp and wallet balances to 6dp. See VERIFY.md.",
    canonical_report: canonicalReport(input),
    how_to_verify:
      "Re-run the open-source Veylix engine with the inputs in canonical_report (same fixed seed), re-hash using the algorithm above, and confirm the result equals report_hash AND matches the hash anchored in the VeylixAnchor contract on Arbitrum One.",
  };
}
