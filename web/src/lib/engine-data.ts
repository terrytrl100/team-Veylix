import type { Calibration, Portfolio, PortfolioMetrics } from "./types";

export type PortfolioName = "client_alpha" | "client_beta" | "client_gamma";

export const PORTFOLIOS: Record<PortfolioName, { label: string; description: string }> = {
  client_alpha: { label: "Alpha",  description: "$24,860 · looks diversified, 91% BTC risk" },
  client_beta:  { label: "Beta",   description: "$8,000 · high-beta meme book"               },
  client_gamma: { label: "Gamma",  description: "$50,000 · 44% cash, rest pure BTC"          },
};

export async function fetchCalibration(): Promise<Calibration> {
  const res = await fetch("/data/calibration.json");
  if (!res.ok) throw new Error("Failed to load calibration data");
  return res.json();
}

export async function fetchPortfolio(name: PortfolioName): Promise<Portfolio> {
  const res = await fetch(`/data/portfolios/${name}.json`);
  if (!res.ok) throw new Error(`Failed to load portfolio ${name}`);
  return res.json();
}

export function applyLivePrices(
  portfolio: Portfolio,
  prices: Record<string, number>
): Portfolio {
  const account = portfolio.result.list[0];
  const updatedCoins = account.coin.map((c) => {
    const price = prices[c.coin];
    if (!price) return c;
    const usdValue = (parseFloat(c.walletBalance) * price).toFixed(2);
    return { ...c, usdValue };
  });
  const totalEquity = updatedCoins
    .reduce((s, c) => s + parseFloat(c.usdValue), 0)
    .toFixed(2);
  return {
    result: { list: [{ ...account, totalEquity, coin: updatedCoins }] },
  };
}

export function computeMetrics(
  portfolio: Portfolio,
  calibration: Calibration
): PortfolioMetrics {
  const account = portfolio.result.list[0];
  const totalEquity = parseFloat(account.totalEquity);

  const coins = account.coin.map((c) => {
    const params = calibration.symbols[c.coin] ?? { beta: 0, idio_vol_daily: 0 };
    return {
      symbol: c.coin,
      usdValue: parseFloat(c.usdValue),
      walletBalance: parseFloat(c.walletBalance),
      weight: parseFloat(c.usdValue) / totalEquity,
      beta: params.beta,
      idio_vol_daily: params.idio_vol_daily,
    };
  });

  const effectiveBeta = coins.reduce((s, c) => s + c.weight * c.beta, 0);

  const f = calibration.btc_factor_vol_daily;
  const btcVar = Math.pow(effectiveBeta * f, 2);
  const totalVar =
    btcVar +
    coins.reduce((s, c) => s + Math.pow(c.weight * c.idio_vol_daily, 2), 0);
  const btcShare = totalVar > 0 ? btcVar / totalVar : 0;

  return { totalEquity, coins, effectiveBeta, btcShare };
}
