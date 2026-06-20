/**
 * Veylix Monte Carlo engine — TypeScript port of web/veylix-sim.js.
 * Faithful to the spec in assets/veylix_engine_handoff.md §3.
 * Deterministic: fixed seed → identical inputs → identical cone.
 */
import type { Portfolio, Calibration } from "./types";

const DEFAULT_SEED  = 0x5eed5;
const DEFAULT_PATHS = 3000;

// mulberry32 PRNG → uniform [0, 1)
function mulberry32(a: number): () => number {
  let s = (a | 0) >>> 0;
  return () => {
    s = ((s + 0x6d2b79f5) | 0) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Marsaglia polar — standard normal, caches the spare
function makeGauss(rng: () => number) {
  let spare: number | null = null;
  return (mean = 0, std = 1): number => {
    if (spare !== null) { const s = spare; spare = null; return mean + std * s; }
    let u: number, v: number, s: number;
    do { u = rng() * 2 - 1; v = rng() * 2 - 1; s = u * u + v * v; } while (s === 0 || s >= 1);
    const mul = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * mul;
    return mean + std * (u * mul);
  };
}

// Linear-interpolation percentile on ascending sorted array (matches numpy default)
function ptile(sorted: Float64Array, p: number): number {
  const n = sorted.length;
  if (!n) return NaN;
  const idx = (p / 100) * (n - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export type Instrument = "BTC" | "MSTR";

export interface SimOptions {
  h?: number;
  instrument?: Instrument;
  horizonDays?: number;
  nPaths?: number;
  seed?: number;
}

export interface ConeData {
  p5: number[]; p25: number[]; p50: number[]; p75: number[]; p95: number[];
}

export interface SimResult {
  grossLoading: number;
  effectiveBeta: number;
  btcVarShare: number;
  topDriver: string;
  carryOverHorizonPct: number;
  cone: ConeData;
  final: {
    medianReturn: number;
    worstCase5pctReturn: number;
    probLossGt25pct: number;
    typicalMaxDrawdown: number;
  };
}

export function simulate(
  portfolio: Portfolio,
  calibration: Calibration,
  opts: SimOptions = {}
): SimResult {
  const h      = opts.h            ?? 0;
  const inst   = opts.instrument   ?? "BTC";
  const H      = opts.horizonDays  ?? 30;
  const N      = opts.nPaths       ?? DEFAULT_PATHS;
  const seed   = opts.seed         ?? DEFAULT_SEED;

  const acct   = portfolio.result.list[0];
  const total  = parseFloat(acct.totalEquity);
  const sym    = calibration.symbols;
  const sBtc   = calibration.btc_factor_vol_daily;

  // portfolio factor loading and idiosyncratic variance
  let gross = 0, idioVar = 0;
  const drivers: Record<string, number> = {};
  for (const c of acct.coin) {
    const params = sym[c.coin];
    if (!params) continue;
    const w  = parseFloat(c.usdValue) / total;
    const { beta, idio_vol_daily: iv } = params;
    gross    += w * beta;
    idioVar  += (w * iv) ** 2;
    drivers[c.coin] = w * w * (beta * beta * sBtc * sBtc + iv * iv);
  }
  const topDriver = Object.entries(drivers).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  // hedge economics
  let carryDay = 0, hedgeIdioV = 0;
  if (inst === "BTC") {
    carryDay = (calibration.funding_annual * h) / 365;
  } else {
    const m   = calibration.hedge_instruments["MSTR"]!;
    const k   = h / m.beta;
    carryDay  = (calibration.mstr_borrow_annual * k) / 365;
    hedgeIdioV = k * k * m.idio_vol_daily ** 2;
  }

  const net     = gross - h;
  const idioStd = Math.sqrt(idioVar + hedgeIdioV);
  const gauss   = makeGauss(mulberry32(seed));

  // simulate N paths of length H+1
  const paths: Float64Array[] = Array.from({ length: N }, () => {
    const arr = new Float64Array(H + 1);
    arr[0] = 1.0;
    let v = 1.0;
    for (let d = 1; d <= H; d++) {
      let r = net * gauss(0, sBtc) + gauss(0, idioStd) - carryDay;
      if (r < -0.99) r = -0.99;
      v *= 1 + r;
      arr[d] = v;
    }
    return arr;
  });

  // cone: percentile bands per day
  const cone: ConeData = { p5: [], p25: [], p50: [], p75: [], p95: [] };
  const col = new Float64Array(N);
  for (let day = 0; day <= H; day++) {
    for (let j = 0; j < N; j++) col[j] = paths[j][day];
    const sorted = col.slice().sort();
    cone.p5.push(ptile(sorted,  5) - 1);
    cone.p25.push(ptile(sorted, 25) - 1);
    cone.p50.push(ptile(sorted, 50) - 1);
    cone.p75.push(ptile(sorted, 75) - 1);
    cone.p95.push(ptile(sorted, 95) - 1);
  }

  // final statistics
  const finals = new Float64Array(N);
  const maxdd  = new Float64Array(N);
  let lossCount = 0;
  for (let k = 0; k < N; k++) {
    const p    = paths[k];
    finals[k]  = p[H] - 1;
    if (finals[k] < -0.25) lossCount++;
    let peak = 1, dd = 0;
    for (let t = 0; t <= H; t++) {
      if (p[t] > peak) peak = p[t];
      const cur = p[t] / peak - 1;
      if (cur < dd) dd = cur;
    }
    maxdd[k] = dd;
  }

  const fSorted  = finals.slice().sort();
  const ddSorted = maxdd.slice().sort();
  const factorVar = net * net * sBtc * sBtc;
  const denom     = factorVar + idioVar;

  return {
    grossLoading: gross,
    effectiveBeta: net,
    btcVarShare: denom > 0 ? factorVar / denom : 0,
    topDriver,
    carryOverHorizonPct: carryDay * H,
    cone,
    final: {
      medianReturn:        ptile(fSorted,  50),
      worstCase5pctReturn: ptile(fSorted,   5),
      probLossGt25pct:     lossCount / N,
      typicalMaxDrawdown:  ptile(ddSorted, 50),
    },
  };
}
