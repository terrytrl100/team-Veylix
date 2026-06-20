import type { Calibration } from "./types";

const BINANCE = "https://api.binance.com/api/v3";

const BINANCE_SYMBOLS: Record<string, string> = {
  BTC:   "BTCUSDT",
  ETH:   "ETHUSDT",
  SOL:   "SOLUSDT",
  LINK:  "LINKUSDT",
  DOGE:  "DOGEUSDT",
  PEPE:  "PEPEUSDT",
  FLOKI: "FLOKIUSDT",
  BONK:  "BONKUSDT",
  WIF:   "WIFUSDT",
};

let priceCache: { data: Record<string, number>; ts: number } | null = null;
const PRICE_CACHE_TTL = 30_000; // 30 s

export async function fetchLivePrices(
  symbols: string[]
): Promise<Record<string, number>> {
  if (priceCache && Date.now() - priceCache.ts < PRICE_CACHE_TTL) {
    return priceCache.data;
  }

  const result: Record<string, number> = { USDT: 1.0 };
  const known = symbols.filter((s) => BINANCE_SYMBOLS[s]);
  const binanceSyms = JSON.stringify(known.map((s) => BINANCE_SYMBOLS[s]));

  const res = await fetch(
    `${BINANCE}/ticker/price?symbols=${encodeURIComponent(binanceSyms)}`
  );
  if (!res.ok) throw new Error(`Binance price fetch: ${res.status}`);

  const data = (await res.json()) as Array<{ symbol: string; price: string }>;

  const reverseMap: Record<string, string> = {};
  for (const sym of known) reverseMap[BINANCE_SYMBOLS[sym]] = sym;

  for (const { symbol, price } of data) {
    const coin = reverseMap[symbol];
    if (coin) result[coin] = parseFloat(price);
  }

  priceCache = { data: result, ts: Date.now() };
  return result;
}

// Use the engine-calibrated parameters (1 year of data, proper regression)
// rather than recomputing betas in the browser from short windows.
export async function fetchLiveCalibration(): Promise<Calibration> {
  const res = await fetch("/data/calibration.json");
  if (!res.ok) throw new Error("Failed to load calibration data");
  return res.json();
}
