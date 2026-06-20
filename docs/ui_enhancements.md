# Veylix — Suggested UI Enhancements

Proposed front-end mods for `index.html`, prioritised by bang-for-buck. Each notes **what**,
**why** (incl. BGA rubric tie), **where**, and an **implementation sketch**. Ranked: 1 → 2 → 4 → 3 → 5.

> Note: these are reviewed from the code, not a visual pass. The engine/data are unchanged for
> all but #1–#2 (which want a couple of calibration fields). Nothing here needs a backend.

---

## 1. Show the worst case in dollars, not just % — *quick win*

**What:** Next to the hero `1-in-20 worst case` (and median), show the dollar landing, e.g.
*"A bad month — your portfolio could fall to ~$19,980."* Optionally a right-hand **$ axis** on
the cone (UX spec §5.1 wanted the dual axis).

**Why:** Dollars land far harder than a percentage for non-quant users → **accessibility /
UX** rubric points. It was in the original UX spec and is currently missing.

**Where:** `index.html` → `update()` (hero render), and `renderCone()` for the optional $ axis.

**How:** Portfolio value (`res.equity`) is already available — no new data.
```js
const dollarAt = pct => res.equity * (1 + pct/100);
// hero sub-line:
`could fall to ~$${Math.round(dollarAt(res.fP5)).toLocaleString()}`
// horizon → phrase: 7d "a bad week", 30d "a bad month", 90d "a bad quarter"
```
**Effort:** Low.

---

## 2. Surface data provenance / transparency — *quick win*

**What:** A small line (header or under the cone caption): *"Calibrated from live Bybit + MSTR
data · as of 20 Jun 2026."* Optionally a short run-fingerprint for reproducibility.

**Why:** The app never tells the user the numbers are **real** or where they're from — yet that
is the BGA **transparency / verifiability** differentiator. Currently invisible. Tiny effort,
direct rubric hit.

**Where:** `index.html` → near the `cone-caption`, or a header pill.

**How:** `CALIB.as_of` is already inlined (the build step writes it from `calibration.json`).
```js
const d = new Date(CALIB.as_of).toLocaleDateString();
capEl.textContent = `Calibrated from live Bybit + MSTR data · as of ${d}`;
```
**Effort:** Low.

---

## 3. Per-tile "explain" tooltips — *quick win*

**What:** A small `ⓘ` on each of the 7 tiles; hover/tap shows a one-line plain-language
explanation of that metric.

**Why:** The "Why these numbers" panel is global; per-tile explanations nail **"every number is
explained"** (transparency). Copy can be lifted verbatim from `docs/user_guide.md`.

**Where:** `index.html` → tile markup (lines ~178–184) + a tiny CSS tooltip; text from the
user-guide tile table.

**How:** Add `title="…"` (cheapest) or a styled `.tooltip` span per tile. Suggested strings:
- Median outcome → "Your middle result; half of scenarios do better, half worse."
- 1-in-20 downside → "A realistic bad outcome — worse than this only ~5% of the time."
- Typical max drawdown → "The usual worst dip from a peak along the way."
- Chance loss >25% → "How often you'd lose more than a quarter of your money."
- Effective BTC beta → "How hard you still move with BTC after hedging (0 = neutral)."
- Funding / borrow → "Annual rate to hold the hedge; a market rate, not advice."
- Cost of insurance → "Dollar cost of holding the hedge over the horizon — the premium."

**Effort:** Low–medium.

---

## 4. Ghost baseline cone — *the demo-maker*

**What:** Draw the **unhedged** (h=0) cone faintly behind the live (hedged) cone. As the user
drags the hedge slider, the coral floor visibly lifts **away from the ghost**.

**Why:** Makes the core demo moment — "hedging lifts the downside, barely touches the median" —
**undeniable on screen** instead of something you have to narrate. Biggest visual upgrade for
the pitch.

**Where:** `index.html` → `update()` already computes a `base` (h=0) result and caches it;
pass it into `renderCone()` and draw its `p5`/`p95` band first at low opacity.

**How:** In `renderCone(cone, H, baseCone)`, before the live bands:
```js
if (baseCone) g += `<path d="${band2(baseCone,'p5','p95')}" fill="#6b7a99" opacity="0.06"/>`;
```
`base` is already available in `update()` — just thread it through.

**Effort:** Medium.

---

## 5. Accessibility pass — *quality-floor box-tick (UX §10)*

**What:** Keyboard operability + visible focus rings on slider/toggles/presets;
`prefers-reduced-motion` honoured; and a **text equivalent of the cone** (key figures as
readable text near the chart, not canvas/SVG-only).

**Why:** Named in the UX spec as an **open gap (§10)** and an explicit scoring criterion
(accessibility / quality). Currently likely unmet.

**Where:** `index.html` → CSS (`:focus-visible`, `@media (prefers-reduced-motion)`), button/slider
markup (`aria-label`), and an off-screen/visible text summary node updated in `update()`.

**How:**
```css
:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
```
Plus an `aria-live="polite"` text node mirroring hero figures so screen readers get them.

**Effort:** Medium.

---

## Explicitly out (not rubric-movers for 24h)
- Shareable snapshot / image export.
- A second benchmark (ETH) or live price-refresh.
- Showing exact hedge size in coins/shares — deliberately omitted to stay on the
  education / no-advice side.

## Suggested order
**1 → 2** (quick, sharpen the demo) → **4** (the visual money-shot) → **3** (transparency polish)
→ **5** (quality floor). Items 1–3 touch only display logic; 4 reuses an existing cached value;
5 is CSS + a small aria node.
