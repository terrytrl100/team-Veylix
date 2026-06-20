# Veylix — Engine → Frontend Handoff (v1)

**Audience:** the frontend lane (`veylix-sim.js` + UI). **From:** the quant/engine lane.
**Goal:** everything you need to build the browser app against, with zero further questions.
No backend — both inputs are **static JSON files** you load and bake into the offline build.

See also: [`implementation_plan.md`](implementation_plan.md) (engine plan), [`../ux/UX requirements`](../ux/UX%20requirements) (your UX spec).

---

## 1. Who computes what

| | Engine (me) | Frontend (you) |
|---|---|---|
| Two static JSON inputs (§2) | ✅ produce | load + bake in |
| The factor model (§3) | ✅ own the spec + test vectors | ✅ implement in `veylix-sim.js` |
| Monte Carlo, cone, tiles, live recompute | — | ✅ |
| Hedge instrument economics (§3) | ✅ params + formula | ✅ apply |

I do **not** run the simulation or serve an API. I give you parameters + the exact math + test
vectors so your sim is correct, deterministic, and reproducible.

---

## 2. The two inputs (static JSON)

> **These files now exist in the repo** — build against them directly:
> [`data/calibration.json`](../data/calibration.json) and
> [`data/portfolios/`](../data/portfolios/) (`client_alpha` = hero demo, `client_beta`,
> `client_gamma`). Values are demo placeholders; the **schema is frozen** (§8).

### 2a. `portfolio.json` — the given book (Bybit `wallet-balance` shape)

Holdings + total value. Weights are derived, not entered. Sample demo book ($24,860, looks
diversified but ~91% BTC-driven — see §6):

```json
{
  "retCode": 0, "retMsg": "OK",
  "result": { "list": [ {
    "accountType": "UNIFIED",
    "totalEquity": "24860.00",
    "coin": [
      { "coin": "BTC",  "usdValue": "9000.00", "walletBalance": "0.085" },
      { "coin": "ETH",  "usdValue": "6500.00", "walletBalance": "1.85"  },
      { "coin": "SOL",  "usdValue": "5360.00", "walletBalance": "32.5"  },
      { "coin": "USDT", "usdValue": "4000.00", "walletBalance": "4000"  }
    ]
  } ] },
  "time": 1718879290000
}
```

- Use `coin[].usdValue` and top-level `totalEquity`. Weight `w_i = usdValue_i / totalEquity`.
- The `coin` string (`"BTC"`) is the key into the calibration `symbols` map (§2b).
- I'll ship 2–3 of these (concentrated / over-leveraged-looking) so the demo has drama.

### 2b. `calibration.json` — the market model (keyed by coin)

One file, shared across all portfolios. Covers every coin any book holds. Stablecoins → 0/0.

```json
{
  "as_of": "2026-06-20T00:00:00Z",
  "source": "bybit /v5/market/kline (crypto), yfinance (MSTR)",
  "lookback_days": 365,
  "btc_factor_vol_daily": 0.032,
  "funding_annual": 0.10,
  "mstr_borrow_annual": 0.05,
  "symbols": {
    "BTC":  { "beta": 1.0,  "idio_vol_daily": 0.0   },
    "ETH":  { "beta": 1.15, "idio_vol_daily": 0.021 },
    "SOL":  { "beta": 1.6,  "idio_vol_daily": 0.038 },
    "USDT": { "beta": 0.0,  "idio_vol_daily": 0.0   }
  },
  "hedge_instruments": {
    "MSTR": { "beta": 1.8, "idio_vol_daily": 0.045 }
  },
  "model_version": "v1"
}
```

| Field | Meaning |
|---|---|
| `btc_factor_vol_daily` | daily stdev of the common BTC market factor |
| `symbols[c].beta` | how hard coin `c` moves per unit BTC move |
| `symbols[c].idio_vol_daily` | coin `c`'s own daily noise (independent of BTC) |
| `funding_annual` | real BTC perp funding — the BTC-hedge carry (fixed, not a slider) |
| `mstr_borrow_annual` | MSTR short borrow cost — the MSTR-hedge carry |
| `hedge_instruments.MSTR` | MSTR's beta/idio for the alternative hedge mode |
| `as_of` / `source` / `model_version` | provenance — needed for the reproducibility hash |

> Values above are realistic **demo** placeholders so you can build now. I'll swap in the
> Bybit/yfinance-measured numbers later; the **schema won't change**.

---

## 3. The model to implement (`veylix-sim.js`)

Single-factor, **zero-drift** dispersion model (models downside spread, not expected return).
~3,000 paths, fixed seed, horizon in days.

**Per-portfolio constants (compute once):**
```
w[i]          = usdValue[i] / totalEquity
gross_loading = Σ w[i] · beta[i]            # portfolio's BTC-factor exposure
```

**Controls → parameters:**
```
h          = hedge slider, 0..1   (TARGET BTC-factor offset, as a fraction of PV)
instrument = "BTC" | "MSTR"       (toggle)
H          = horizon days         (7 | 30 | 90)
```

**One simulated day (per path):**
```
F        = gauss(0, btc_factor_vol_daily)              # shared market factor draw
factor   = (gross_loading − h) · F                     # SAME for both instruments
idio     = Σ_risky_i  w[i] · gauss(0, idio_vol[i])     # each asset's own noise
if instrument == "MSTR":
    idio -= (h / beta_mstr) · gauss(0, idio_vol_mstr)  # short-MSTR adds tracking noise
carry_day = (instrument == "BTC")
              ? funding_annual      · h            / 365
              : mstr_borrow_annual · (h / beta_mstr) / 365
r        = clamp( factor + idio − carry_day , −0.99 , +∞ )   # value can't go ≤ 0 (UX §6)
value   *= (1 + r)
```

Key point — **same factor offset, different side-effects:** BTC hedge is clean; MSTR hedge
hits the same `(gross_loading − h)` factor exposure but **adds** `(h/beta_mstr)²·idio_vol_mstr²`
of variance back. So the MSTR cone tightens **less** than the BTC cone at the same `h`. That gap
is the teaching point — surface it in the "Why" panel.

**Determinism (UX §6/§11):** seed a PRNG from a fixed constant (suggest `0x5EED5`) so identical
inputs → identical cone. Re-seed identically on every recompute; the cone must respond to the
user's inputs, never to RNG noise. (mulberry32 + Box–Muller is plenty.)

---

## 4. Outputs you render (and how to derive each)

Run the sim → for each path you have a value path of length `H`. Then:

| UI element (UX ref) | Derivation |
|---|---|
| **Outcome cone** (§5.1) | at each day `t`, the 5/25/50/75/95 percentiles of value across paths |
| **1-in-20 worst case** %/$ (§5.1) | 5th percentile of **final** return; × portfolio value for $ |
| **Median** (§5.1, tile) | 50th percentile of final return |
| **Typical max drawdown** (tile) | median over paths of each path's max peak-to-trough drop |
| **Chance of losing >25%** (tile) | fraction of paths with final return < −25% |
| **Effective BTC beta** (tile) | `gross_loading − h` — compute directly, updates live with the slider |
| **Hedge carry readout** (§5.4) | `carry_day · H` as a % of PV; **coral if cost (>0), teal if credit (<0)** |
| **"Why" headline** (§5.7) | top risk driver + BTC-variance share — see §5 |

---

## 5. The "Why these numbers" headline (engine gives you the formula)

Two numbers drive the sentence:

```
factor_var = (gross_loading − h)² · btc_factor_vol_daily²
idio_var   = Σ_risky_i w[i]² · idio_vol[i]²   (+ MSTR term if applicable)
btc_share  = factor_var / (factor_var + idio_var)        # "% of your risk that is BTC"
top_driver = asset i maximising w[i]² · (beta[i]²·btc_factor_vol_daily² + idio_vol[i]²)
```

Example copy: *"You hold 4 assets, but ~91% of your risk is a single bet on BTC. The 50% hedge
lifts your 1-in-20 floor from −X% to −Y%, at a ~0.4% carry over 30 days."*

---

## 6. Sanity test vector (verify your sim by hand)

Using the §2 demo `portfolio.json` + `calibration.json`:

```
weights:  BTC 0.3620 · ETH 0.2615 · SOL 0.2156 · USDT 0.1609
gross_loading = 0.3620·1.0 + 0.2615·1.15 + 0.2156·1.6 + 0      ≈ 1.008
effective beta at h=0   = 1.008
effective beta at h=0.5 = 0.508
btc_share at h=0        ≈ 0.91   → "≈91% of your risk is BTC"

carry over 30d, h=0.5:
  BTC  mode: 0.10 · 0.5        /365 · 30 ≈ 0.41% of PV  (cost, coral)
  MSTR mode: 0.05 · (0.5/1.8)  /365 · 30 ≈ 0.11% of PV  (cost, coral)
```

These are deterministic (no RNG) — if your code reproduces them, the plumbing is right. **Full
fixed-seed percentile test vectors** (exact cone numbers for a given seed) follow once the
engine's test-vector block lands; we'll align your PRNG to mine then.

---

## 7. Demo defaults (first load)

- Active portfolio: the $24,860 demo book (§2a).
- Horizon: **30d**. Hedge: **0%**. Instrument: **BTC**.
- The demo moment: drag hedge **0 → 50%** → downside tail lifts, median barely moves; then flip
  to **MSTR** at the same 50% → show the cone tighten *less* (the honest cost of an accessible hedge).

---

## 8. Contract stability

The **schemas in §2 are frozen** for v1 — build against them now with the demo values. When I
swap in Bybit/yfinance-measured numbers, only the values change, not the shape. If a schema
change is unavoidable I'll bump `model_version` and tell you. Open questions → ping me.
