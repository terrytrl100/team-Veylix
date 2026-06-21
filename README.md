<div align="center">

# ⚡ Veylix

### *See the consequence first.*

**Institutional-grade risk visibility for retail crypto — free, in your browser, with the math on screen.**

[![Live Demo](https://img.shields.io/badge/▶_Live_Demo-team--veylix.vercel.app-3FB8A0?style=for-the-badge&logo=vercel&logoColor=white&labelColor=0A0C11)](https://team-veylix-r656.vercel.app/)
[![Built with JavaScript](https://img.shields.io/badge/Built_with-JavaScript-E6A23C?style=for-the-badge&logo=javascript&logoColor=black&labelColor=0A0C11)](#-under-the-hood)
[![Powered by Claude](https://img.shields.io/badge/AI-Claude-7E8AF5?style=for-the-badge&logo=anthropic&logoColor=white&labelColor=0A0C11)](#-what-it-does)
[![License: MIT](https://img.shields.io/badge/License-MIT-FF6F6F?style=for-the-badge&labelColor=0A0C11)](#-license)
[![Stars](https://img.shields.io/github/stars/terrytrl100/team-Veylix?style=for-the-badge&color=E6A23C&labelColor=0A0C11)](https://github.com/terrytrl100/team-Veylix/stargazers)

</div>

---

> ### The crypto market isn't a fair fight.
> The big funds run risk simulations on supercomputers — they know exactly what they could lose before they place a single trade. **You get a candle chart and a prayer.**
>
> Around **75–80% of retail traders lose money** — not because they picked the wrong coin, but because nothing ever showed them their downside *before* they clicked buy.
>
> **Veylix closes that gap.** See — before you act — how your positions and hedges reshape the full range of where your portfolio could land. Institutional risk math, in plain language, for free.

<div align="center">

<a href="https://www.youtube.com/watch?v=4ARYLbXzF6Q">
  <img src="https://img.youtube.com/vi/4ARYLbXzF6Q/hqdefault.jpg" width="640" alt="Watch the Veylix demo">
</a>

**▶ Watch the 2-minute demo**

</div>

> [!TIP]
> **See it in 10 seconds** — the live demo runs on your own portfolio, no signup, nothing to install: **https://team-veylix-r656.vercel.app/**

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

## ⚔️ Why Veylix is different

|  | Exchange dashboards | Pro risk terminals | **Veylix** |
| --- | :---: | :---: | :---: |
| Shows your downside **before** you trade | ❌ | ⚠️ | ✅ |
| Plain language, no jargon wall | ❌ | ❌ | ✅ |
| Free for retail | ✅ | ❌ | ✅ |
| No incentive to make you trade more | ❌ | ✅ | ✅ |
| Reproducible & inspectable | ❌ | ❌ | ✅ |

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
- **Risk engine** — ~3,000-path Monte Carlo + Value-at-Risk across multiple horizons.
- **Live market data** — Bybit API for historical prices and futures funding rates (the *real, current* cost of a hedge — not a guess).
- **Explainable AI layer** — turns every metric and scenario into plain language.

<details>
<summary><b>📐 The math, in full</b></summary>

<br>

- **Model** — single common factor (BTC) plus per-asset idiosyncratic noise, **zero drift**. We deliberately don't predict direction; we model how widely outcomes can spread.
- **Simulation** — ~3,000 Monte Carlo paths per run, across multiple time horizons.
- **Value at Risk** — the loss at the Nth percentile of simulated outcomes: *"in the worst X% of cases, you lose at least this much."*
- **Hedge** — reduces exposure to the common factor; its cost is priced live from Bybit perpetual funding rates, with MSTR available as a proxy where shorting crypto is restricted.
- **Determinism** — seed `0x5EED5` fixes the RNG, so any reviewer re-running the same inputs gets byte-identical numbers.

</details>

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

> [!WARNING]
> **Educational use only.** Veylix surfaces and explains risk — it does not provide investment advice, recommendations, or execute trades.

---

<div align="center">

### Veylix — *see the consequence first.*

</div>
