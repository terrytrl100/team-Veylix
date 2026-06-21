# Veylix

**Pre-trade risk visibility for retail crypto.**  
*See the consequence first.* 🛡️

> Retail traders can open, close, or hedge positions in seconds. They cannot easily see how those moves reshape their portfolio's realistic downside **before** they commit.

Veylix puts institutional-grade risk tools (Monte Carlo simulation, VaR, dynamic hedging) into a single clean interface that runs in any browser. It is an **education and transparency tool only** — it never recommends positions or predicts prices.

**[🚀 Try the live demo](https://team-veylix-r656.vercel.app)**

![Veylix main interface](screenshots/hero.png)

## What it actually does

- **Live portfolio view** — Connect Arbitrum wallet. See real holdings as a pie chart + per-asset risk table (beta to BTC + idiosyncratic risk). Every metric has clear tooltips.
- **Monte Carlo risk engine** — 1-day / 1-week / 30-day simulations with percentile bands. Downside tail is highlighted. One number: **Value at Risk (VaR)** — your realistic worst case.
- **One-move hedge** — Drag a slider to choose how much risk to remove. Watch VaR drop in real time. Veylix calculates the exact BTC short (Bybit futures data, funding rate cost included). In restricted regions it proxies via MSTR.
- **AI scenario agent** — Powered by Claude. Select a named scenario ("FTX-style collapse", "black-swan crash"). It only adjusts visible simulation parameters so you can see exactly what changed — with and without your hedge.
- **On-chain verification** — Every simulation is reproducible (fixed seed) and provably unchanged. A smart contract hashes the raw inputs on-chain as a timestamped record. Export the report and re-run it yourself.

*Modelling note: Zero-drift volatility model. Focuses on risk and dispersion, not predicted returns.*

![Hedge slider in action — watch VaR and cost update live](screenshots/hedge-demo.gif)

## How the verification actually works

Trust moves from "trust Veylix" to "trust the math + immutable record."

1. Run a simulation (fixed seed = fully reproducible).
2. Smart contract hashes the exact inputs and writes it on-chain with timestamp.
3. Export the report containing inputs + hash method.
4. Re-run the same inputs locally → identical hash. If it matches the on-chain record, nothing was altered.

This is the part institutions take for granted. Retail almost never gets it.

## Quick start

**Live:** [team-veylix-r656.vercel.app](https://team-veylix-r656.vercel.app)

**Local (zero install):**  
Clone the repo and open `veylix.html` (rename the current "Veylix (standalone).html" — the current filename is ugly) in any modern browser.

## Built for

Encode Vibe Coding Hackathon — BGA AI Trading & Strategy track (Blockchain for Good Alliance). The track rewards systems that reduce information asymmetry between retail and institutions rather than extractive behaviour. That is Veylix's thesis.

## Team

- Raj, Ashish, Jia — Engineering  
- **Patti** — Research, UX & Design  
- Terry — Product

## Important

Educational use only. Veylix surfaces and explains risk. It does not provide investment advice or execute trades.
