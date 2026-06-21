# Veylix

**Pre-trade risk visibility for retail crypto.** — *See the consequence first.*

> Retail crypto investors can buy, sell, hold, or hedge in seconds — but they can't easily see how any of it changes their portfolio's downside risk *before* they commit.

Veylix closes that gap. Connect a wallet and it shows — before you act — how your positions and hedges reshape the full range of where your portfolio could land. Institutions manage this with scenario analysis, hedge ratios, and Monte Carlo simulation; retail gets price charts, PnL, and vibes. Veylix puts that same risk lens in retail hands, in plain language.

It is an **education and transparency tool, not an advice tool** — it surfaces and explains risk, and never recommends a position or predicts a price.

## What it does

- **Live portfolio** — connect a wallet (Arbitrum) and Veylix reads your real holdings on-chain, shown as a pie chart and a per-asset risk table: each asset's beta to Bitcoin and its idiosyncratic (Bitcoin-independent) risk. Tooltips explain every metric.
- **Risk engine** — a Monte Carlo simulation of where your portfolio could land over a 1-day, 1-week, or 30-day horizon, drawn as percentile bands with the downside tail highlighted and distilled into one number: **Value at Risk (VaR)**, your realistic worst case.
- **One-move hedge** — drag a slider to choose how much risk to hedge away and watch VaR fall in real time. Veylix computes the optimal BTC short from Bybit futures data, **funding-rate cost included**, so you see the price of protection before you commit. Where shorting crypto is restricted (e.g. the UK), it hedges via MSTR as a Bitcoin proxy.
- **AI scenario agent** — powered by Claude Haiku 4.5, but not a chatbot. It has one job: reshape the simulation to match a named scenario ("FTX-style collapse," "black-swan crash," "war"). It adjusts only *visible* Monte Carlo parameters, so you see exactly what changed — with and without your hedge. No black box.
- **On-chain verification** — every run is reproducible (fixed seed) and provable: a smart contract hashes the raw inputs onto the blockchain as a timestamped, immutable record (see below).
- **Honest by design** — methodology stays on screen, hedging cost is never hidden, and the "not advice" posture is surfaced, not buried.

*Modelling note: Veylix uses a zero-drift volatility model — it models **risk and dispersion, not predicted returns**.*

## How verification works

Trust shifts from *"trust Veylix's numbers"* to *"trust the math and an immutable timestamp."*

1. You run a simulation on your inputs (fixed seed → fully reproducible).
2. A smart contract hashes those raw inputs and writes the hash to the blockchain — timestamped and unchangeable.
3. You export a report containing the exact inputs and the hash method.
4. Re-run those inputs yourself: you get the same hash. If it matches the on-chain record, the numbers are real — not made up, cherry-picked, or changed after the fact. Alter a single value, and the hashes won't match.

## Try it

- **Live demo:** https://team-veylix-r656.vercel.app
- **Local:** clone the repo and open `Veylix (standalone).html` in any modern browser — no install, no build step.

## Repo

- `Veylix (standalone).html` — the single-file app.
- `docs/UX_REQUIREMENTS.md` — UX requirements and MVP acceptance criteria.

## Track

Built for the **Encode Vibe Coding Hackathon** — *BGA AI Trading & Strategy* track (Blockchain for Good Alliance). The track rewards fairer systems over higher returns: reducing the information asymmetry between retail and institutions, and building healthier markets rather than extractive behaviour. That is exactly Veylix's thesis.

## Team

Veylix — Raj, Ashish, Jia (engineering), Patti (research, UX & design), Terry (product).

---

*Educational use only. Veylix surfaces and explains risk; it does not provide investment advice or execute trades.*
