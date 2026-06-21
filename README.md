<div align="center">

# ⚡ Veylix

### *See the consequence first.*

**Institutional-grade risk visibility for retail crypto — free, in your browser, with the math on screen.**

[![Live Demo](https://img.shields.io/badge/▶_LIVE_DEMO-team--veylix.vercel.app-3FB8A0?style=for-the-badge)](https://team-veylix-r656.vercel.app/)
[![License](https://img.shields.io/badge/LICENSE-MIT-7E8AF5?style=for-the-badge)](#-license)
[![Hackathon](https://img.shields.io/badge/ENCODE_×_BGA-AI_Trading_&_Strategy-FF6F6F?style=for-the-badge)](#-built-for)
[![Status](https://img.shields.io/badge/STATUS-Live_MVP-E6A23C?style=for-the-badge)](#)

</div>

---

> ### The crypto market isn't a fair fight.
> The big funds run risk simulations on supercomputers — they know exactly what they could lose before they place a single trade. **You get a candle chart and a prayer.**
>
> Around **75–80% of retail traders lose money** — not because they picked the wrong coin, but because nothing ever showed them their downside *before* they clicked buy.
>
> **Veylix closes that gap.** See — before you act — how your positions and hedges reshape the full range of where your portfolio could land. Institutional risk math, in plain language, for free.

<!-- 💡 Drop a hero screenshot or demo GIF right here for maximum impact:  ![Veylix in action](docs/demo.gif) -->

---

## ✨ What it does

|     |     |
| --- | --- |
| 🔮 **See your real downside** | A live Monte Carlo simulation of where your portfolio could land over the next day, week, or month — distilled into the one number that matters: your realistic worst case (**Value at Risk**). |
| 🎚️ **Hedge in one move** | Drag a slider to choose how much risk to hedge away and watch your worst case shrink in real time — with the cost priced **live from Bybit funding rates**, so you see what protection actually costs. |
| 🌍 **Hedge anywhere** | Can't legally short crypto where you live (e.g. the UK)? Veylix hedges via **MSTR** as a Bitcoin proxy — protection isn't gated by geography. |
| 🤖 **Stress-test with AI** | An AI agent reshapes the simulation to any scenario you name — *"FTX-style collapse," "black-swan crash," "war"* — and shows how you'd hold up, **with and without** your hedge. |
| 🔍 **No black box** | Every number explained in plain English, methodology on screen. **No advice. No price predictions.** We model risk and dispersion, not returns. |
| 🆓 **Free & private** | Runs entirely client-side in your browser. No signup. Your portfolio never leaves your machine. |

---

## 🔬 Reproducible by design

The trust model is simple: **don't trust us — re-run the math.**

- 🎯 **Fixed seed** (`0x5EED5`) — the same inputs always produce the same numbers.
- 📉 **Zero-drift model** — we model *dispersion, not predicted returns*. Nothing to overfit, nothing to cherry-pick.
- 🧩 **100% client-side** — no backend, no server to trust. Open the file, read the code, run it yourself.

> Prediction is what burns retail. **Clarity is what protects it.**

---

## 🚀 Try it

**▶ Live demo:** **https://team-veylix-r656.vercel.app/**

**Run locally** — no install, no build step:

```bash
git clone https://github.com/terrytrl100/team-Veylix.git
cd team-Veylix
# open "Veylix (standalone).html" in any modern browser
```

---

## 🧠 Under the hood

- **Single-file, client-side app** — `Veylix (standalone).html`, no backend.
- **Risk engine** — ~3,000-path Monte Carlo + Value-at-Risk across multiple horizons; single-factor (BTC) + idiosyncratic noise; zero-drift.
- **Live market data** — Bybit API for historical prices and futures funding rates (the *real, current* cost of a hedge — not a guess).
- **Explainable AI layer** — turns every metric and scenario into plain language.

---

## 🛣️ Roadmap

- 🔗 **On-chain verification** — hash each run's raw inputs to the blockchain for trustless, timestamped proof anyone can independently re-verify.
- 👛 **WalletConnect + on-chain wallets** — read live holdings straight from the chain.
- 🌐 **Multi-exchange coverage** — beyond a single connection.
- 🚨 **Risk alerts** — liquidity, concentration, and rug-pull flags.
- 🏢 **White-label engine** — an embeddable risk layer exchanges can license.

---

## 🏆 Built for

**Encode × Blockchain for Good Alliance** — *AI Trading & Strategy* track.
The brief rewards **fairer systems over higher returns** — reducing the information gap between retail and institutions, and building healthier markets rather than extractive ones. That's Veylix's entire thesis: *we never profit from you trading more, and we never tell you what to do.*

---

## 👥 Team

| Member | Role |
| --- | --- |
| **Terry** | Product & vision |
| **Ashish** | Tech lead — architecture & build |
| **Raj** | Engineering & core contributor |
| **Jia** | Engineering |
| **Lilian** | Engineering |
| **Patti** | UX, design & research |

---

## 📄 License

**MIT** — open source. Use it, fork it, learn from it.

---

<div align="center">

### Veylix — *see the consequence first.*

<sub>Educational use only. Veylix surfaces and explains risk; it does not provide investment advice or execute trades.</sub>

</div>
