# Veylix

**Pre-trade risk visibility for retail crypto.**

> Risk-tolerant retail crypto investors can take positions instantly, but they cannot easily see how buying, selling, holding, or hedging changes their portfolio's downside risk.

Veylix closes that gap. It shows — *before you act* — how adjusting your positions or adding a hedge reshapes the full distribution of where your portfolio could land. Institutions use scenario analysis, hedge ratios, and Monte Carlo to manage uncertainty; retail is left with price charts, PnL, and vibes. Veylix puts that risk lens in the hands of the retail investor, in terms they can actually read.

It is an **education and transparency tool, not an advice tool** — it surfaces and explains risk in plain language and never recommends a position.

## What it does

- **Outcome cone** — a Monte Carlo simulation of where your portfolio could land over a chosen horizon, drawn as percentile bands with the downside tail highlighted.
- **Live scenarios** — adjust allocations, add a BTC hedge, set the hedge funding rate, and change the time horizon; the distribution and every risk metric recompute in real time.
- **Plain-language explanations** — every number is explained in user terms, including what a hedge does to your downside *and what it costs*.
- **Honest by design** — methodology is always on screen, trade-offs (including hedging cost) are never hidden, and the "not advice" posture is surfaced, not buried.

Modelling note: Veylix uses a zero-drift volatility model — it models **risk and dispersion, not predicted returns**.

## Run it

This is a self-contained build — no install, no build step.

1. Clone or download the repo.
2. Open `Veylix (standalone).html` in any modern browser.

## Repo

- `Veylix (standalone).html` — the working single-file app.
- `docs/UX_REQUIREMENTS.md` — UX requirements and acceptance criteria for the MVP.

## Track

Built for the Encode Vibe Coding Hackathon — **BGA AI Trading & Strategy** track (Blockchain for Good Alliance). The goal of the track is better, fairer systems, not the highest returns: reducing the information asymmetry between retail investors and institutions, and contributing to healthier markets rather than extractive behaviour.

## Team

Veylix — Raj, Ashish, Jia (engineering), Patti (research, UX & design), Terry (product).

---

*Educational use only. Veylix surfaces and explains risk; it does not provide investment advice or execute trades.*
