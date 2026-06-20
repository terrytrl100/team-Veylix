/*
 * veylix-view.ts — view-model adapters mapping the audited engine to the
 * two-view app (CURRENT = risk as-is, HEDGE = target/post-hedge). Pure
 * functions over mock data; deterministic.
 */
import { simulate, type Instrument, type SimResult, parsePortfolio } from "@/lib/veylix-sim";
import { BOOKS, CALIB, COIN_COLORS, JURISDICTIONS, MOCK_SPOT } from "@/lib/veylix-data";

export interface PieSlice {
  sym: string;
  label: string;
  usd: number;
  w: number;
  color: string;
  short?: boolean;
}
export interface ConeRow {
  t: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}
export interface HedgeAction {
  n: number;
  step: string;
  detail: string;
  emphasis?: boolean;
}
export interface Snapshot {
  varPct: number; // 1-in-20 downside magnitude (positive)
  varUsd: number;
  p5Pct: number;
  p5Usd: number;
  p50Pct: number;
  p50Usd: number;
  p95Pct: number;
  p95Usd: number;
  maxDrawdownPct: number;
  chanceLossPct: number;
  cone: ConeRow[];
}

export interface AppView {
  equity: number;
  hedge: number; // 0..1
  hedgeNotional: number;
  horizon: number;
  resolvedInstrument: Instrument;
  proxyApprox: boolean;
  jurisdictionNote: string;
  cryptoDerivativesAllowed: boolean;
  grossLoading: number;
  effectiveBeta: number;
  btcVarShare: number;
  topDriver: string | null;
  fundingRatePct: number;
  carryPct: number;
  carryUsd: number;
  currentPie: PieSlice[];
  targetPie: PieSlice[];
  current: Snapshot; // h = 0
  hedged: Snapshot; // h = hedge
  actions: HedgeAction[];
}

const HORIZON_SCALE = 100; // cone returned in percent

function coneRows(r: SimResult): ConeRow[] {
  return r.cone.p5.map((_, t) => ({
    t,
    p5: r.cone.p5[t] * HORIZON_SCALE,
    p25: r.cone.p25[t] * HORIZON_SCALE,
    p50: r.cone.p50[t] * HORIZON_SCALE,
    p75: r.cone.p75[t] * HORIZON_SCALE,
    p95: r.cone.p95[t] * HORIZON_SCALE,
  }));
}

function snapshot(r: SimResult, equity: number): Snapshot {
  const f = r.final;
  return {
    varPct: Math.max(0, -f.worstCase5pctReturn * 100),
    varUsd: Math.max(0, -f.worstCase5pctReturn * equity),
    p5Pct: f.worstCase5pctReturn * 100,
    p5Usd: equity * (1 + f.worstCase5pctReturn),
    p50Pct: f.medianReturn * 100,
    p50Usd: equity * (1 + f.medianReturn),
    p95Pct: f.p95Return * 100,
    p95Usd: equity * (1 + f.p95Return),
    maxDrawdownPct: Math.max(0, -f.typicalMaxDrawdown * 100),
    chanceLossPct: f.probLossGt25pct * 100,
    cone: coneRows(r),
  };
}

export interface ViewInputs {
  portfolioId: string;
  hedge: number; // 0..1
  instrument: Instrument;
  horizonDays: number;
  jurisdictionId: string;
}

export function buildView(inputs: ViewInputs): AppView {
  const raw = BOOKS[inputs.portfolioId];
  const pf = parsePortfolio(raw);
  const equity = pf.totalEquity;
  const acct = raw.result.list[0];

  const jur = JURISDICTIONS.find((j) => j.id === inputs.jurisdictionId) ?? JURISDICTIONS[0];
  const resolvedInstrument: Instrument = jur.cryptoDerivativesAllowed ? inputs.instrument : "MSTR";
  const proxyApprox = resolvedInstrument === "MSTR";

  const rHedged = simulate(pf, CALIB, { h: inputs.hedge, instrument: resolvedInstrument, horizonDays: inputs.horizonDays });
  const rCurrent = simulate(pf, CALIB, { h: 0, instrument: resolvedInstrument, horizonDays: inputs.horizonDays });

  const hedgeNotional = inputs.hedge * equity;
  const grossDenom = equity + hedgeNotional;

  const currentPie: PieSlice[] = acct.coin.map((c) => {
    const usd = parseFloat(c.usdValue);
    return { sym: c.coin, label: c.coin, usd, w: usd / equity, color: COIN_COLORS[c.coin] ?? "#94a3b8" };
  });
  const targetPie: PieSlice[] =
    hedgeNotional <= 0
      ? currentPie.map((s) => ({ ...s }))
      : [
          ...acct.coin.map((c) => {
            const usd = parseFloat(c.usdValue);
            return { sym: c.coin, label: c.coin, usd, w: usd / grossDenom, color: COIN_COLORS[c.coin] ?? "#94a3b8" };
          }),
          {
            sym: resolvedInstrument,
            label: resolvedInstrument === "BTC" ? "Short BTC" : "Short MSTR",
            usd: hedgeNotional,
            w: hedgeNotional / grossDenom,
            color: "var(--color-destructive)",
            short: true,
          },
        ];

  return {
    equity,
    hedge: inputs.hedge,
    hedgeNotional,
    horizon: inputs.horizonDays,
    resolvedInstrument,
    proxyApprox,
    jurisdictionNote: jur.note,
    cryptoDerivativesAllowed: jur.cryptoDerivativesAllowed,
    grossLoading: rHedged.grossLoading,
    effectiveBeta: rHedged.effectiveBeta,
    btcVarShare: rHedged.btcVarShare,
    topDriver: rHedged.topDriver,
    fundingRatePct: (resolvedInstrument === "BTC" ? CALIB.funding_annual : CALIB.mstr_borrow_annual) * 100,
    carryPct: rHedged.carryOverHorizonPct * 100,
    carryUsd: rHedged.carryOverHorizonPct * equity,
    currentPie,
    targetPie,
    current: snapshot(rCurrent, equity),
    hedged: snapshot(rHedged, equity),
    actions: deriveActions(resolvedInstrument, hedgeNotional, inputs.hedge, proxyApprox),
  };
}

function deriveActions(instrument: Instrument, hedgeNotional: number, h: number, proxyApprox: boolean): HedgeAction[] {
  if (hedgeNotional <= 0) {
    return [
      { n: 1, step: "No hedge in place yet", detail: "Your book carries its full BTC-factor exposure. Drag the hedge slider to model an offset." },
    ];
  }
  const pct = Math.round(h * 100);
  const u = (x: number) => Math.round(x).toLocaleString("en-US");
  if (instrument === "BTC") {
    const btc = hedgeNotional / MOCK_SPOT.BTC;
    return [
      { n: 1, step: `Open a short BTC perpetual ≈ $${u(hedgeNotional)}`, detail: `≈ ${btc.toFixed(3)} BTC notional (at ~$${u(MOCK_SPOT.BTC)}/BTC, illustrative) — offsets ${pct}% of your BTC-factor exposure.`, emphasis: true },
      { n: 2, step: "Fund margin from your stablecoin balance", detail: "Hold enough USDT as collateral so funding swings don't risk a forced liquidation." },
      { n: 3, step: "Budget for funding carry", detail: `At ${(CALIB.funding_annual * 100).toFixed(2)}%/yr the carry is small, but it accrues for as long as the short is open.` },
    ];
  }
  const mstrExposure = hedgeNotional / CALIB.hedge_instruments.MSTR.beta;
  const shares = mstrExposure / MOCK_SPOT.MSTR;
  const actions: HedgeAction[] = [
    { n: 1, step: `Short MSTR ≈ $${u(mstrExposure)} in any stock brokerage`, detail: `≈ ${shares.toFixed(1)} shares (at ~$${u(MOCK_SPOT.MSTR)}/share, illustrative), scaled by MSTR's ${CALIB.hedge_instruments.MSTR.beta.toFixed(2)}× BTC beta to cover the exposure.`, emphasis: true },
    { n: 2, step: "Borrow the shares to short", detail: `Borrow cost ≈ ${(CALIB.mstr_borrow_annual * 100).toFixed(1)}%/yr. Available to investors who can't trade crypto derivatives.` },
  ];
  if (proxyApprox) {
    actions.push({ n: 3, step: "Treat the proxy as approximate", detail: "MSTR tracks BTC loosely and carries its own company risk, so the downside floor lifts a little less than a direct BTC short at the same ratio." });
  }
  return actions;
}
