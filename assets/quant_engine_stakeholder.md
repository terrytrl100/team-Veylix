# Veylix — Quant Engine Lane: Stakeholder Documentation

**Branch:** `quant_engine` · **PR:** [#1](https://github.com/terrytrl100/team-Veylix/pull/1)
**Status:** static input contract delivered (demo placeholders) · calibration engine pending
**Audience:** team, reviewers, judges, product stakeholders

---

## 1. Executive summary

Veylix is a **pre-trade risk-visibility tool for retail crypto** (Encode / BGA "AI Trading &
Strategy" track). It shows an investor how their portfolio's downside is *distributed* — and
how **hedging** reshapes that downside — before they act. It is an **education and transparency
tool, not advice**.

This branch is the **quant engine lane**: the risk-modelling backbone behind Veylix. It does
**not** run as a live service. Instead it (a) **defines the risk model** the app uses and
(b) **produces the data** the app consumes. The user-facing app (a separate front-end lane)
runs the simulation in the browser.

In one line: **this lane owns the math and the numbers; the front-end owns the screen.**

---

## 2. Where this lane sits (architecture)

```
   ┌─────────────────────────────────────┐
   │  QUANT ENGINE LANE  (this branch)    │
   │                                      │
   │  • owns the risk model spec          │
   │  • computes calibration from market  │
   │    data (Bybit klines + yfinance)    │      static JSON files
   │  • emits portfolio + calibration JSON│ ───────────────────────┐
   └─────────────────────────────────────┘                        │
                                                                   ▼
   ┌─────────────────────────────────────┐        ┌──────────────────────────────┐
   │  ON-CHAIN / VERIFIABILITY  (Lane C)  │◀───────│  FRONT-END LANE (browser app)│
   │  commits a hash of each sim run      │  run   │  • loads the static JSON     │
   │  (owned by another teammate)         │  hash  │  • runs Monte Carlo (~3,000  │
   └─────────────────────────────────────┘        │    paths, fixed seed)        │
                                                   │  • renders cone, tiles, hedge│
                                                   └──────────────────────────────┘
```

**Critical design fact:** there is **no backend**. Veylix runs entirely client-side and offline
for speed and demo-safety. The engine's Python is a **build-time** step that writes static JSON;
once written it is not in the request path.

---

## 3. What this lane is responsible for

| Owns | Does **not** own |
|---|---|
| The risk model specification (formulas, assumptions) | Running the Monte Carlo (front-end does it) |
| Calibration: per-asset statistics from market data | The UI / chart / sliders (front-end) |
| The seeded demo portfolios | On-chain commitment of run hashes (Lane C) |
| The cross-team handoff contract | Live serving / any backend |
| A deterministic, hashable record of a sim run | |

---

## 4. What is delivered in this branch

Tracked artifacts (committed in PR #1):

| File | What it is |
|---|---|
| **`assets/veylix_engine_handoff.md`** | The engine→front-end **contract**: model spec, JSON schemas, per-day pseudocode (both hedge modes), output derivations, and a hand-checkable test vector. The single source of truth the front-end builds against. |
| **`data/calibration.json`** | The **market model**: per-coin `beta` + idiosyncratic volatility, BTC factor volatility, funding rate, and the MSTR hedge instrument. Shared across all portfolios. |
| **`data/portfolios/*.json`** | Three **seeded demo books** in Bybit `wallet-balance` shape (`client_alpha`, `client_beta`, `client_gamma`). |
| **`data/README.md`** | Describes the data files and the validated demo books. |
| **`.gitignore`** | Keeps internal planning docs, the front-end UX spec, and OS artifacts out of this lane. |

> **Values are realistic demo placeholders.** The schema is **frozen** (`model_version: v1`);
> the calibration engine will overwrite the *values* with market-measured numbers without
> changing the *shape*.

---

## 5. The risk model (plain-language + technical)

### Plain language
Most retail crypto portfolios *look* diversified but are really one big bet on Bitcoin. Veylix
simulates thousands of possible futures for the portfolio over a chosen horizon, shows the
**range of outcomes** (especially the bad ones), and lets the user **hedge** — and see exactly
what that hedge costs and how much downside it actually removes.

### Technical
A **single-factor, zero-drift dispersion model** (models risk, not predicted returns):

```
asset_return_i = beta_i · F_btc + eps_i
  F_btc ~ N(0, btc_factor_vol²)      common BTC market factor
  eps_i ~ N(0, idio_vol_i²)          each asset's own noise
  portfolio weight w_i = usdValue_i / totalEquity
  gross_loading = Σ w_i · beta_i     (the portfolio's BTC exposure)
```

**Hedging** — one slider `h` = the fraction of BTC-factor exposure to offset:

- **BTC short** (clean): `net_loading = gross_loading − h`; carry = BTC perp funding.
- **MSTR short** (TradFi-accessible alternative, for users who can't short crypto): same factor
  offset, but MSTR is a *leveraged BTC-proxy equity* so it adds back its own idiosyncratic
  noise — a **looser hedge** — and its carry is a stock-borrow cost, not funding.

The honest tradeoff (MSTR's cone tightens *less* than BTC's at the same `h`) is shown to the
user — central to the transparency story.

### What it deliberately does **not** do
- No price prediction (zero drift — dispersion only).
- No leverage / liquidation modelling (the portfolios are spot).
- No "advice" — it surfaces and explains risk; it never recommends a position.

---

## 6. The demo portfolios (validated)

| Book | Value | Effective BTC beta (h=0 → h=0.5) | % of risk that is BTC | Story |
|---|---|---|---|---|
| `client_alpha` | $24,860 | 1.01 → 0.51 | **91%** | Looks diversified across 4 assets; 91% of the risk is one BTC bet. **Hero demo.** |
| `client_beta` | $12,000 | 1.45 → 0.95 | 78% | High-beta "degen" book; DOGE is the single biggest risk driver. |
| `client_gamma` | $50,000 | 0.58 → 0.08 | **97%** | 44% cash — yet the *risky* half is almost pure BTC. |

Example carry (cost of holding the hedge), `client_alpha`, 50% hedge, 30 days:
**BTC mode ≈ 0.41% of portfolio · MSTR mode ≈ 0.11%.**

---

## 7. Key decisions (log)

| Decision | Outcome |
|---|---|
| Product identity | "GlassBox" concept → shipped as **Veylix** |
| Portfolio input | **No allocation sliders.** Portfolio is a *given* book loaded from JSON (local flat-file "DB"). |
| Interaction | **One hedge slider** ("% of portfolio value to hedge") + a horizon toggle (7/30/90d). |
| Hedge instruments | **BTC short** and **MSTR short** (TradFi proxy). QQQ was evaluated and rejected — too weak a BTC hedge (β≈0.15). |
| Funding | **Calibrated (real, fixed)**, not a user slider. Carry still shown. |
| Dropped features | Markov regime signal; liquidation/distance-to-liquidation stress (poor fit for a spot model). |
| Verifiability | **Kept** — a deterministic, hashable sim-run record for the on-chain lane. |
| Market data | Crypto from **public Bybit** klines/tickers (no key); MSTR from **yfinance**. |
| Architecture | **No backend.** Static JSON + client-side Monte Carlo. |

---

## 8. Current status

| Component | Lane | Status |
|---|---|---|
| Model specification | Engine | ✅ Done (handoff §3) |
| Static input contract + schemas | Engine | ✅ Done, committed |
| Seeded demo portfolios | Engine | ✅ Done (placeholders, validated) |
| **Calibration engine** (real Bybit/yfinance values) | Engine | ⏳ **Next up** — values-only, schema frozen |
| Deterministic run hash for verifiability | Engine | ⏳ Pending |
| Monte Carlo + UI (cone, tiles, slider) | Front-end | ⏳ In their lane, unblocked by the handoff |
| On-chain commitment | Lane C | ⏳ Owned by another teammate |

**"Snapshot demo" (the MVP path) is enabled but not yet live:** the static inputs exist as
placeholders; the values become real once the calibration engine runs, and the behaviour
appears once the front-end MC is built.

---

## 9. Market data: revaluation & refresh (roadmap)

Three things change at different speeds: **quantities** (rare, on trades), **prices**
(continuous → portfolio revaluation → hedge recompute), and **statistics** (slow drift →
recalibration). Today everything is a **snapshot**.

- The data model is **revaluation-ready**: `walletBalance` (quantity) is the durable truth;
  `usdValue` is a snapshot = `walletBalance × price`. Live revaluation just recomputes `usdValue`
  → weights → hedge, then re-runs the (seeded, deterministic) simulation.
- **MVP:** snapshot prices — deterministic, offline, demo-safe.
- **Post-MVP options:** client-side live price fetch, or a periodic rebuild of the static files
  (preferred — avoids browser cross-origin issues). Recalibration always runs as a slow
  scheduled job emitting a new `calibration.json` (`as_of` / `model_version`).

---

## 10. Risks & limitations (transparency)

- **Demo values are placeholders** until the calibration engine runs; numbers shown are
  illustrative, not market-measured (yet). Schema is stable.
- **Single-factor model:** captures BTC-driven risk well; cross-asset effects not from BTC are
  approximated as independent noise.
- **Spot only:** no leverage/liquidation — effective-beta headlines are concentration-based
  (e.g. "91% of your risk is BTC"), **not** leverage claims.
- **Offline-first:** real-time market moves are not reflected until a refresh mechanism is added
  (§9).
- **MSTR hedge is intentionally imperfect** — that imperfection is a feature we *show*, not hide.

---

## 11. Roadmap / next steps

1. **Calibration engine** — pull Bybit klines (BTC + alts) + yfinance MSTR → compute real betas,
   idio-vols, factor vol, funding → overwrite `calibration.json` (values only).
2. **Deterministic run-hash** helper for the verifiability lane.
3. Support **front-end integration** as their Monte Carlo comes online (align PRNG/seed to the
   test vectors).
4. (Post-MVP) revaluation/refresh per §9.

---

## 12. Glossary

| Term | Meaning |
|---|---|
| **Beta (to BTC)** | How hard an asset moves per 1% BTC move. BTC = 1.0; higher = more BTC-sensitive. |
| **Idiosyncratic volatility** | An asset's own day-to-day noise, independent of BTC. |
| **Factor loading** | The portfolio's overall sensitivity to BTC (weighted average beta). |
| **Hedge (h)** | Fraction of BTC exposure offset by a short position; the one user control. |
| **Carry** | The ongoing cost (or credit) of holding the hedge — funding for BTC, borrow for MSTR. |
| **Monte Carlo** | Simulating thousands of random futures to estimate the *range* of outcomes. |
| **Outcome cone** | The chart of where the portfolio could land over time (5th–95th percentiles). |
| **Calibration** | The market-measured parameters that drive the simulation. |
| **Determinism / seed** | Same inputs always produce the same chart — changes reflect data, not randomness. |

---

## 13. References (in this branch)

- Engine→front-end contract: [`assets/veylix_engine_handoff.md`](../assets/veylix_engine_handoff.md)
- Data: [`data/calibration.json`](../data/calibration.json), [`data/portfolios/`](../data/portfolios/), [`data/README.md`](../data/README.md)

*(Internal planning docs and the front-end UX spec are intentionally kept out of this branch.)*
