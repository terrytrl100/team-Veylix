// ERC-20 contract addresses for calibration symbols, keyed by chain ID.
// WBTC/cbBTC are mapped to the "BTC" calibration symbol.
// Native ETH is handled separately via useBalance — not listed here.

export interface TokenConfig {
  symbol: string;           // calibration symbol (BTC, ETH, USDT, …)
  address: `0x${string}`;
  decimals: number;
}

export const TOKEN_REGISTRY: Record<number, TokenConfig[]> = {
  // Arbitrum One
  42161: [
    { symbol: "BTC",  address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8  }, // WBTC
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6  },
    { symbol: "LINK", address: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4", decimals: 18 },
  ],
};
