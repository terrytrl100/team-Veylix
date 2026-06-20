# Veylix — engine data (static inputs for the frontend)

These are the **static JSON inputs** the browser app loads (no backend). Produced by the
quant/engine lane. Full spec: [`../assets/veylix_engine_handoff.md`](../assets/veylix_engine_handoff.md).

- **`calibration.json`** — the market model: per-coin `beta` + `idio_vol`, BTC factor vol, real
  funding, and the MSTR hedge instrument. Shared across all portfolios.
- **`portfolios/*.json`** — given client books, Bybit `wallet-balance` shape. Weight
  `w_i = usdValue_i / totalEquity`; the `coin` string keys into `calibration.json → symbols`.

Demo books (validated):

| File | Value | Eff. beta @h=0 | BTC-variance share | Use |
|---|---|---|---|---|
| `client_alpha.json` | $24,860 | 1.01 | 91% | hero demo — "looks diversified, 91% one BTC bet" |
| `client_beta.json`  | $12,000 | 1.45 | 78% | high-beta degen book (DOGE-led) |
| `client_gamma.json` | $50,000 | 0.58 | 97% | 44% cash, risky half ≈ pure BTC |

> **Values are demo placeholders.** They'll be replaced with Bybit-kline / yfinance-measured
> numbers; the **schema is frozen for `model_version: v1`** — build against it now.
