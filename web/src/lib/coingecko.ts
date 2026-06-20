import type { Calibration } from "./types";

const BINANCE_API = "https://api.binance.com/api/v3";
const BYBIT_API   = "https://api.bybit.com/v5/market";

const COIN_TO_USDT: Record<string, string> = {
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
const PRICE_CACHE_TTL = 30_000;

export function bustPriceCache() {
  priceCache = null;
}

async function fetchBybitSpot(symbols: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = { USDT: 1.0 };
  const known = symbols.filter((s) => COIN_TO_USDT[s]);
  if (!known.length) return result;

  const reverseMap: Record<string, string> = {};
  for (const sym of known) reverseMap[COIN_TO_USDT[sym]] = sym;

  const res = await fetch(`${BYBIT_API}/tickers?category=spot`);
  if (!res.ok) throw new Error(`Bybit tickers: ${res.status}`);

  const json = (await res.json()) as {
    retCode: number;
    retMsg: string;
    result: { list: Array<{ symbol: string; lastPrice: string }> };
  };
  if (json.retCode !== 0) throw new Error(`Bybit: ${json.retMsg}`);

  for (const t of json.result.list) {
    const coin = reverseMap[t.symbol];
    if (coin) result[coin] = parseFloat(t.lastPrice);
  }
  return result;
}

async function fetchBinanceSpot(symbols: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = { USDT: 1.0 };
  const known = symbols.filter((s) => COIN_TO_USDT[s]);
  if (!known.length) return result;

  const binanceSyms = JSON.stringify(known.map((s) => COIN_TO_USDT[s]));
  const reverseMap: Record<string, string> = {};
  for (const sym of known) reverseMap[COIN_TO_USDT[sym]] = sym;

  const res = await fetch(
    `${BINANCE_API}/ticker/price?symbols=${encodeURIComponent(binanceSyms)}`
  );
  if (!res.ok) throw new Error(`Binance tickers: ${res.status}`);

  const data = (await res.json()) as Array<{ symbol: string; price: string }>;
  for (const { symbol, price } of data) {
    const coin = reverseMap[symbol];
    if (coin) result[coin] = parseFloat(price);
  }
  return result;
}

export async function fetchLivePrices(
  symbols: string[]
): Promise<Record<string, number>> {
  if (priceCache && Date.now() - priceCache.ts < PRICE_CACHE_TTL) {
    return priceCache.data;
  }

  let data: Record<string, number>;
  try {
    data = await fetchBybitSpot(symbols);
  } catch {
    data = await fetchBinanceSpot(symbols);
  }

  priceCache = { data, ts: Date.now() };
  return data;
}

export async function fetchLiveCalibration(): Promise<Calibration> {
  const res = await fetch("/data/calibration.json");
  if (!res.ok) throw new Error("Failed to load calibration data");
  return res.json();
}
