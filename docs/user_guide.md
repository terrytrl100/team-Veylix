# Veylix — User Guide

**See the consequence first.** Veylix shows you the *range of ways your crypto portfolio could
play out* over the next few weeks or months — and how protecting it with a hedge changes that
range — **before** you act.

It is an **educational and transparency tool, not investment advice.** It never tells you what
to buy, sell, or hold. It shows you your risk in plain language, and explains every number.

---

## How to use it (30 seconds)

1. Pick a **portfolio** (top of the controls).
2. Watch the **chart** (the "cone") — it shows where your portfolio could land over time.
3. Drag the **Hedge amount** slider up and watch the worst-case (the bottom of the cone)
   lift — and check what that protection **costs** in the tiles below.

That's the whole idea: **see your downside, then see what it takes to cushion it.**

---

## The chart — your "outcome cone"

The big chart simulates **3,000 possible futures** for your portfolio and plots the spread:

- **Shaded bands** = how outcomes are distributed. The wider the cone, the more uncertain your
  result. The **coral (reddish) lower band** is the bad-case zone; the **teal upper band** is
  the good-case zone.
- **Amber line (middle)** = the **median** path — your most "middle-of-the-road" outcome.
- **Coral line + dot (bottom)** = the **1-in-20 worst case** — see below.
- **Faint grey band + dashed grey line** = your **unhedged** outcome, shown for comparison. As
  you add a hedge, watch the coral worst-case lift *away* from this grey line — that gap is
  exactly what the hedge buys you.
- **Dashed horizontal line** = **break-even** (where you are today). Anything below it is a loss.
- **Left axis** = return in **%**. **Bottom axis** = time, from today out to your chosen horizon.

Under the chart, a line tells you the **data source and date** — the numbers are calibrated from
real Bybit and MSTR market data, not made up.

> The cone shows **risk and dispersion, not a prediction.** It assumes no expected gain or loss
> (a "zero-drift" model) and focuses purely on *how spread out* the outcomes are. It does **not**
> forecast price.

Above the chart, two headline numbers:

- **1-in-20 worst case** — a realistic bad day. Out of 20 equally likely scenarios, one is at
  least this bad. (Statistically, the 5th-percentile outcome.)
- **Median outcome** — the middle result; half of scenarios are better, half worse.

Each shows both the **return (%)** and the **dollar value** your portfolio would land at — so
"−19.6%" also reads as "≈ $19,980," whichever you find easier to picture.

---

## The controls

### Portfolio
Switch between the sample books to compare risk profiles. (In your own account this is your
actual holdings.) The pie chart and legend show what each book holds and the dollar value of
each position.

### Hedge instrument — *Short BTC* vs *Short MSTR*
A hedge is a position that **moves opposite to your portfolio**, cushioning losses when the
market falls. You choose how to place it:

- **Short BTC** — a short Bitcoin position (on a crypto exchange). The cleanest hedge: it
  offsets your Bitcoin-driven risk directly.
- **Short MSTR** — short MicroStrategy stock in a **normal brokerage**. For people who can't or
  don't want to short crypto. MSTR tracks Bitcoin, but **loosely** — so it's a weaker hedge
  (it leaves more risk behind) and it costs a stock-borrow fee instead of funding.

### Hedge amount (the slider)
**What share of your portfolio's market risk you want to offset.** 0% = no hedge; 100% = fully
neutralise your Bitcoin exposure. As you drag it up, watch the coral worst-case lift toward
break-even — while the median barely moves. That's the point of hedging: **protect the bad
case without giving up the middle.**

### Horizon — *7d / 30d / 90d*
How far into the future to look: one week, one month, or one quarter. Longer horizons mean a
wider cone (more time for things to move).

---

## The seven tiles

*Tip: hover (or tap) any tile to see a one-line explanation of what it means.*

| Tile | What it tells you |
|---|---|
| **Median outcome** | Your middle-of-the-road result over the horizon. Half of scenarios do better, half worse. |
| **1-in-20 downside** | A realistic bad outcome — worse than this only ~5% of the time. The number to respect. |
| **Typical max drawdown** | The usual *worst dip along the way* — how far you'd typically fall from a peak before any recovery. (Even an OK final result can have a scary dip mid-way.) |
| **Chance loss >25%** | How often (out of all scenarios) you'd lose more than a quarter of your money. A blunt "how dangerous is this?" gauge. |
| **Effective BTC beta** | How strongly your portfolio still moves with Bitcoin *after* hedging. **1.0x** = moves like Bitcoin; **2.0x** = twice as much; **0** = market-neutral. Hedging pushes this toward 0. |
| **BTC funding (ann.) / MSTR borrow (ann.)** | The annual *rate* it costs to hold your chosen hedge. Switches with the instrument: Bitcoin **funding** for Short BTC, stock **borrow** for Short MSTR. This is a market rate — it doesn't change with your hedge size. |
| **Cost of insurance** | The actual **dollar cost** of holding your hedge over the horizon, at the current rate. This is what moves as you change the hedge amount and horizon. A hedge is insurance — this is the premium. |

---

## "Why these numbers"

The sentence below the tiles **explains your situation in plain English**, and rewrites itself
every time you change something. With no hedge, it names your biggest risk (e.g. *"~92% of your
risk is a single bet on BTC"*). With a hedge on, it tells you how much the downside floor lifted
and what it costs. No black box — every figure on screen is explained here.

---

## Key terms

- **Hedge** — a position that profits when your portfolio falls, softening the blow. It reduces
  downside but has an ongoing cost.
- **Beta (to BTC)** — how hard something moves relative to Bitcoin. Bitcoin is 1.0; a coin with
  beta 1.6 tends to move ~1.6× as much (up *and* down).
- **Funding / borrow** — the recurring fee for holding a short position. For crypto shorts it's
  the "funding rate"; for shorting a stock like MSTR it's a "borrow fee."
- **Drawdown** — a peak-to-trough fall. Your *max drawdown* is the worst such fall over a period.
- **Monte Carlo** — running thousands of randomised "what-if" futures to map the full range of
  outcomes, instead of guessing a single one.

---

## Important to know

- **Not advice.** Veylix never recommends a position, allocation, or hedge. It shows and
  explains risk; the decisions are yours.
- **Risk, not prediction.** It models how *spread out* your outcomes could be — not which way
  the market will go.
- **Snapshot pricing.** Market parameters (volatility, correlations, funding) are taken from a
  recent snapshot, so the numbers reflect recent conditions, not live tick-by-tick prices.
- **Same inputs → same chart.** The simulation is deterministic: identical settings always
  produce the identical cone, so any change you see reflects *your input*, not random noise.

*Simulated outcomes from a modelled-volatility engine, not forecasts. Educational use only —
not investment advice.*
