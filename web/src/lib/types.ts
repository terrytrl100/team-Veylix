export interface CoinParams {
  beta: number;
  idio_vol_daily: number;
}

export interface Calibration {
  as_of: string;
  btc_factor_vol_daily: number;
  funding_annual: number;
  mstr_borrow_annual: number;
  symbols: Record<string, CoinParams>;
  hedge_instruments: Record<string, CoinParams>;
  model_version: string;
}

export interface PortfolioCoin {
  coin: string;
  usdValue: string;
  walletBalance: string;
}

export interface Portfolio {
  result: {
    list: Array<{
      accountType: string;
      totalEquity: string;
      coin: PortfolioCoin[];
    }>;
  };
}

export interface CoinRow {
  symbol: string;
  usdValue: number;
  walletBalance: number;
  weight: number;
  beta: number;
  idio_vol_daily: number;
}

export interface PortfolioMetrics {
  totalEquity: number;
  coins: CoinRow[];
  effectiveBeta: number;
  btcShare: number;
}
