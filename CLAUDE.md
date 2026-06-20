# Veylix — Project Hub (team_xyz)

## What this project is

Veylix is a browser-based tool for retail crypto investors to understand their portfolio's real risk exposure and explore hedging strategies to minimise downside. The tagline is "see the consequence first."

There is no backend. Everything runs in the browser as a standalone HTML app.

---

## Repo structure

```
team_xyz/                        ← hub repo (this repo)
  CLAUDE.md                      ← you are here
  .gitmodules
  repos/
    team-Veylix/                 ← git submodule → github.com/terrytrl100/team-Veylix
      Veylix (standalone).html   ← the browser app (bundled, ~1.9MB)
      assets/
        veylix_engine_handoff.md ← full engine↔frontend contract (read this first)
      data/
        calibration.json         ← market model: beta, idio_vol, BTC factor vol, carry rates
        portfolios/
          client_alpha.json      ← $24,860 hero demo — "looks diversified, 91% BTC"
          client_beta.json       ← $12,000 high-beta degen book
          client_gamma.json      ← $50,000 cash-heavy book
      UX requirements            ← full UX spec
```

### Adding a new repo

```bash
git submodule add https://github.com/terrytrl100/<repo-name> repos/<repo-name>
```

### Updating a submodule to latest

```bash
git submodule update --remote repos/team-Veylix
```

---

## Two-lane architecture

| Lane | Branch | Responsibility |
|---|---|---|
| **Quant / Engine** | `quant_engine` (merged → `main`) | Produces `calibration.json` + `portfolios/*.json`; owns the factor model spec and test vectors |
| **Frontend** | `main` / `feature/frontend-engine-integration` | Loads the static JSON, implements `veylix-sim.js`, renders the UI |

The engine does **not** run simulations or serve an API. It provides parameters and the exact math so the frontend simulation is correct, deterministic, and reproducible.

---

## Active branches

| Branch | Purpose |
|---|---|
| `main` | Stable — quant_engine has been merged in (PR #1) |
| `feature/frontend-engine-integration` | WIP — wiring the frontend to load `data/*.json` instead of hardcoded values |

---

## The data contract (frozen for v1)

Full spec: `repos/team-Veylix/assets/veylix_engine_handoff.md`

### calibration.json schema
```json
{
  "as_of": "<ISO timestamp>",
  "btc_factor_vol_daily": 0.032,
  "funding_annual": 0.10,
  "mstr_borrow_annual": 0.05,
  "symbols": {
    "<COIN>": { "beta": 1.0, "idio_vol_daily": 0.0 }
  },
  "hedge_instruments": {
    "MSTR": { "beta": 1.8, "idio_vol_daily": 0.045 }
  },
  "model_version": "v1"
}
```

### portfolio.json schema (Bybit wallet-balance shape)
```json
{
  "result": { "list": [ {
    "totalEquity": "24860.00",
    "coin": [
      { "coin": "BTC", "usdValue": "9000.00", "walletBalance": "0.085" }
    ]
  } ] }
}
```

Weight: `w_i = usdValue_i / totalEquity`. The `coin` string keys into `calibration.json → symbols`.

**Schema is frozen.** Only values will change when real Bybit/yfinance-measured numbers land. A schema change bumps `model_version`.

---

## The simulation model (veylix-sim.js)

Single-factor zero-drift dispersion model. ~3,000 paths, fixed seed (`0x5EED5`), horizon in days.

Key formula per simulated day:
```
F        = gauss(0, btc_factor_vol_daily)
factor   = (gross_loading − h) · F
idio     = Σ_risky_i  w[i] · gauss(0, idio_vol[i])
carry    = funding_annual · h / 365          # BTC mode
r        = clamp(factor + idio − carry, −0.99, +∞)
value   *= (1 + r)
```

Where `gross_loading = Σ w[i] · beta[i]` and `h` is the hedge slider (0–1).

Sanity check (no RNG needed):
- `client_alpha` at h=0: effective beta ≈ 1.008, BTC variance share ≈ 91%
- BTC hedge carry at h=0.5, 30d ≈ 0.41% of PV (cost)
- MSTR hedge carry at h=0.5, 30d ≈ 0.11% of PV (cost)

---

## Demo portfolios

| File | Value | Eff. beta @h=0 | BTC share | Use case |
|---|---|---|---|---|
| `client_alpha` | $24,860 | 1.01 | 91% | Hero demo — "looks diversified, 91% one BTC bet" |
| `client_beta`  | $12,000 | 1.45 | 78% | High-beta degen book (DOGE-led) |
| `client_gamma` | $50,000 | 0.58 | 97% | 44% cash, risky half ≈ pure BTC |

Default on load: `client_alpha`, 30d horizon, 0% hedge, BTC instrument.

---

## Running the app

```bash
open "repos/team-Veylix/Veylix (standalone).html"
```

No build step, no server needed. Fully offline.
