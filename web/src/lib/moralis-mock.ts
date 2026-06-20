/*
 * moralis-mock.ts — MOCK structural-risk shell (no live Moralis calls).
 *
 * Shapes mirror what Moralis returns so a live call drops in later:
 *  - token security / red-flags  (Moralis "Token Analytics" / security signals)
 *  - holder concentration         (Moralis "Top token holders")
 * The picker surfaces the most structurally-risky holding in the portfolio.
 */
import { BOOKS, CALIB } from "@/lib/veylix-data";

export type Severity = "high" | "medium" | "low" | "ok";

export interface RedFlag {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
}
export interface HolderBar {
  label: string;
  pct: number;
  whale?: boolean;
}
export interface StructuralRisk {
  asset: string;
  score: number; // 0 (safe) .. 100 (severe)
  summary: string;
  flags: RedFlag[];
  holders: HolderBar[];
  top10Pct: number;
}

// Per-asset mock structural profiles (deterministic).
const PROFILES: Record<string, StructuralRisk> = {
  WIF: {
    asset: "WIF",
    score: 72,
    summary: "Concentrated holder base and unlocked liquidity — typical memecoin structural risk.",
    top10Pct: 49,
    holders: [
      { label: "Wallet 1", pct: 16, whale: true },
      { label: "Wallet 2", pct: 9, whale: true },
      { label: "Wallet 3", pct: 7 },
      { label: "Wallet 4", pct: 6 },
      { label: "Wallet 5", pct: 5 },
      { label: "Next 5", pct: 6 },
      { label: "Everyone else", pct: 51 },
    ],
    flags: [
      { id: "conc", severity: "high", title: "Top-10 wallets hold ~49%", detail: "A handful of wallets could move the price hard if they sell." },
      { id: "liq", severity: "high", title: "Liquidity not fully locked", detail: "Part of the LP can be withdrawn — heightens rug/exit risk." },
      { id: "verify", severity: "ok", title: "Contract verified", detail: "Source is public and matches the deployed bytecode." },
      { id: "mint", severity: "medium", title: "Mint authority active", detail: "New supply can still be minted; watch for dilution." },
      { id: "honeypot", severity: "ok", title: "No honeypot signals", detail: "Sells simulate successfully in the latest scan." },
    ],
  },
  BONK: {
    asset: "BONK",
    score: 64,
    summary: "Wide retail float but a few large wallets and active mint authority.",
    top10Pct: 41,
    holders: [
      { label: "Wallet 1", pct: 12, whale: true },
      { label: "Wallet 2", pct: 8, whale: true },
      { label: "Wallet 3", pct: 6 },
      { label: "Wallet 4", pct: 5 },
      { label: "Wallet 5", pct: 4 },
      { label: "Next 5", pct: 6 },
      { label: "Everyone else", pct: 59 },
    ],
    flags: [
      { id: "conc", severity: "medium", title: "Top-10 wallets hold ~41%", detail: "Moderately concentrated; large holders can amplify moves." },
      { id: "liq", severity: "ok", title: "Liquidity locked", detail: "LP is time-locked per the latest scan." },
      { id: "verify", severity: "ok", title: "Contract verified", detail: "Public, verified source." },
      { id: "mint", severity: "medium", title: "Mint authority active", detail: "Supply can expand; monitor for dilution." },
      { id: "honeypot", severity: "ok", title: "No honeypot signals", detail: "Sells simulate successfully." },
    ],
  },
  BTC: {
    asset: "BTC",
    score: 8,
    summary: "Deep, decentralised market — negligible structural/contract risk.",
    top10Pct: 5,
    holders: [
      { label: "Largest known wallet", pct: 1.1, whale: true },
      { label: "Top 2-10 (exchanges)", pct: 3.9 },
      { label: "Everyone else", pct: 95 },
    ],
    flags: [
      { id: "conc", severity: "ok", title: "Highly distributed", detail: "No single wallet is a structural threat." },
      { id: "liq", severity: "ok", title: "Deep liquidity", detail: "Among the most liquid assets in the world." },
      { id: "contract", severity: "ok", title: "No token contract", detail: "Native asset — no smart-contract attack surface." },
    ],
  },
};

const GENERIC_SAFE = (asset: string): StructuralRisk => ({
  asset,
  score: 18,
  summary: "Established asset with broad distribution and deep liquidity.",
  top10Pct: 12,
  holders: [
    { label: "Top wallet", pct: 3, whale: true },
    { label: "Top 2-10", pct: 9 },
    { label: "Everyone else", pct: 88 },
  ],
  flags: [
    { id: "conc", severity: "low", title: "Broadly distributed", detail: "Holder concentration is low relative to memecoins." },
    { id: "liq", severity: "ok", title: "Deep liquidity", detail: "Liquid across major venues." },
    { id: "verify", severity: "ok", title: "Audited / verified", detail: "Public, verified contract with audit history." },
  ],
});

/** Pick the most structurally-risky holding (highest idiosyncratic vol, non-stable). */
export function riskiestAsset(portfolioId: string): string {
  const acct = BOOKS[portfolioId].result.list[0];
  let best: string | null = null;
  let bestIdio = -1;
  for (const c of acct.coin) {
    if (c.coin === "USDT") continue;
    const idio = CALIB.symbols[c.coin]?.idio_vol_daily ?? 0;
    if (idio > bestIdio) {
      bestIdio = idio;
      best = c.coin;
    }
  }
  return best ?? "BTC";
}

export function buildStructuralRisk(portfolioId: string): StructuralRisk {
  const asset = riskiestAsset(portfolioId);
  return PROFILES[asset] ?? GENERIC_SAFE(asset);
}

export function severityLabel(s: Severity): string {
  return s === "high" ? "High risk" : s === "medium" ? "Caution" : s === "low" ? "Low" : "OK";
}
