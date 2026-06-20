/*
 * veylix-data.ts — MOCK calibration + demo wallet books + formatters.
 *
 * Calibration values and the demo books use the real Bybit-shaped schema so a
 * live wallet read / calibration feed drops in later with no shape changes.
 * MOCK only — no live Bybit / MSTR / Moralis calls in this build.
 */
import { type Calibration, type WalletBalance } from "@/lib/veylix-sim";

export const CALIB: Calibration = {
  as_of: "2026-06-20T15:34:44Z",
  source: "Bybit /v5/market (kline + funding) for crypto; Stooq/yfinance for MSTR",
  lookback_days: 365,
  btc_factor_vol_daily: 0.0224,
  funding_annual: 0.0107,
  mstr_borrow_annual: 0.05,
  symbols: {
    BTC: { beta: 1.0, idio_vol_daily: 0.0 },
    ETH: { beta: 1.3531, idio_vol_daily: 0.0181 },
    SOL: { beta: 1.408, idio_vol_daily: 0.0209 },
    LINK: { beta: 1.4304, idio_vol_daily: 0.0252 },
    DOGE: { beta: 1.3767, idio_vol_daily: 0.0276 },
    PEPE: { beta: 1.6201, idio_vol_daily: 0.038 },
    FLOKI: { beta: 1.5932, idio_vol_daily: 0.039 },
    BONK: { beta: 1.6661, idio_vol_daily: 0.0442 },
    WIF: { beta: 1.764, idio_vol_daily: 0.0428 },
    USDT: { beta: 0.0, idio_vol_daily: 0.0 },
  },
  hedge_instruments: { MSTR: { beta: 1.3683, idio_vol_daily: 0.0296 } },
  model_version: "v1",
};

function book(totalEquity: string, coins: Array<[string, string, string]>): WalletBalance {
  return {
    result: {
      list: [
        { totalEquity, coin: coins.map(([coin, usdValue, walletBalance]) => ({ coin, usdValue, walletBalance })) },
      ],
    },
  };
}

export const BOOKS: Record<string, WalletBalance> = {
  client_alpha: book("24860.00", [
    ["BTC", "9000.00", "0.0857"],
    ["ETH", "6500.00", "1.857"],
    ["SOL", "5360.00", "32.48"],
    ["USDT", "4000.00", "4000"],
  ]),
  client_beta: book("8000.00", [
    ["WIF", "2500.00", "2941"],
    ["BONK", "2000.00", "100000000"],
    ["PEPE", "2000.00", "210526316"],
    ["FLOKI", "1500.00", "12500000"],
  ]),
  client_gamma: book("50000.00", [
    ["BTC", "20000.00", "0.1905"],
    ["ETH", "8000.00", "2.286"],
    ["USDT", "22000.00", "22000"],
  ]),
};

export const PORTFOLIO_META: Array<{ id: string; label: string; note: string }> = [
  { id: "client_alpha", label: "Balanced", note: "$24,860 · BTC / ETH / SOL" },
  { id: "client_beta", label: "Degen", note: "$8,000 · memecoins" },
  { id: "client_gamma", label: "Conservative", note: "$50,000 · 44% stables" },
];

/** Categorical per-asset colours for pies/legends (data viz, not brand tokens). */
export const COIN_COLORS: Record<string, string> = {
  BTC: "#f7931a",
  ETH: "#627eea",
  SOL: "#14f195",
  DOGE: "#c2a633",
  LINK: "#2a5ada",
  USDT: "#26a17b",
  WIF: "#e879a6",
  BONK: "#f5a623",
  PEPE: "#3ec300",
  FLOKI: "#f0a020",
};

/** Illustrative spot prices — only used to size the educational "actions". */
export const MOCK_SPOT: Record<string, number> = { BTC: 105000, MSTR: 1750 };

export interface Jurisdiction {
  id: string;
  label: string;
  cryptoDerivativesAllowed: boolean;
  note: string;
}
export const JURISDICTIONS: Jurisdiction[] = [
  { id: "intl", label: "Most regions", cryptoDerivativesAllowed: true, note: "Crypto perpetuals are available to you." },
  { id: "uk", label: "UK retail", cryptoDerivativesAllowed: false, note: "The FCA bars crypto derivatives for retail — use a regulated equity proxy." },
  { id: "us", label: "US retail", cryptoDerivativesAllowed: false, note: "Crypto perps are generally unavailable to retail — use an equity proxy." },
];

export const HORIZONS = [7, 30, 90] as const;
export function horizonWord(h: number): string {
  return h <= 7 ? "week" : h <= 30 ? "month" : "quarter";
}

// --- formatters ----------------------------------------------------------- //
export function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) return Math.round(n).toLocaleString("en-US");
  return n.toFixed(0);
}
export function fmtPct(n: number, dp = 1): string {
  return (n >= 0 ? "+" : "") + n.toFixed(dp) + "%";
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Deterministic, locale-independent date (UTC) — locale-based Intl formatting
// renders differently on server vs client and causes React hydration mismatches.
export function calibDate(): string {
  const d = new Date(CALIB.as_of);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
