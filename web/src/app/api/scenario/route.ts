// POST /api/scenario — server-side only. Translates a plain-language market
// scenario into stress MULTIPLIERS on the risk model's parameters via Claude.
// The API key never reaches the browser. The model returns JSON only; it never
// gives financial advice and never touches weights or the random seed.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_SCENARIO_CHARS = 500;

// ── simple in-memory per-IP rate limit (resets on redeploy; fine for a demo) ──
const RATE_MAX = 10;          // requests
const RATE_WINDOW_MS = 60_000; // per minute
const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > RATE_MAX;
}

const SYSTEM_PROMPT = `You are Veylix's scenario translator. Your ONLY job is to convert a user's plain-language market scenario into numeric STRESS MULTIPLIERS on an existing risk model's parameters. You do not give financial advice. You never recommend buying, selling, holding, or hedging. You never mention specific trades. You only describe how a hypothetical market condition would change volatility and correlation parameters.

You will receive: a list of coins in the user's portfolio, baseline parameters (btc_factor_vol_daily, funding_annual, mstr_borrow_annual, and per-coin beta + idio_vol_daily), and a scenario in plain English.

Return ONLY a JSON object, no prose, no markdown fences, with this exact shape:
{
  "rationale": "<1-3 sentences explaining the market condition you modelled and why these parameters move, in plain language, NON-advisory>",
  "overrides": {
    "btc_factor_vol_mult": <number, optional>,
    "funding_mult": <number, optional>,
    "mstr_borrow_mult": <number, optional>,
    "symbols": { "<COIN>": { "beta_mult": <number, optional>, "idio_vol_mult": <number, optional> } }
  }
}

Rules:
- Multipliers are relative to baseline (1.0 = unchanged).
- Realistic stress: market vol 1.5x-3x in a serious crash, rarely above 4x. Correlation crashes push altcoin betas up toward 1.2-1.6. Funding spikes 2x-5x in a squeeze. Idiosyncratic vol rises most for the assets the scenario targets.
- Only reference coins from the provided list.
- If the scenario is calm/neutral, return multipliers at or near 1.0 — do not manufacture drama.
- If the scenario is unclear or not market-related, return all 1.0 and say so in the rationale.
- Output JSON only.`;

interface Body {
  scenarioText?: string;
  portfolioSummary?: { coins?: string[] };
  baseline?: unknown;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "Server is missing ANTHROPIC_API_KEY." }, { status: 500 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: "Too many requests — wait a minute." }, { status: 429 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const scenarioText = (body.scenarioText ?? "").toString().trim();
  const coins = Array.isArray(body.portfolioSummary?.coins) ? body.portfolioSummary!.coins! : [];
  if (!scenarioText) return NextResponse.json({ ok: false, error: "Empty scenario." }, { status: 400 });
  if (scenarioText.length > MAX_SCENARIO_CHARS)
    return NextResponse.json({ ok: false, error: "Scenario too long." }, { status: 400 });

  const userContent = JSON.stringify({ coins, baseline: body.baseline ?? {}, scenario: scenarioText });

  let raw: string;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ ok: false, error: `Model error (${res.status}).`, detail }, { status: 502 });
    }
    const data = await res.json();
    raw = (data?.content ?? [])
      .map((b: { type: string; text?: string }) => (b.type === "text" ? b.text ?? "" : ""))
      .join("")
      .trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Could not reach the model." }, { status: 502 });
  }

  // strip accidental ```json fences, then parse
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  let parsed: { rationale?: string; overrides?: Record<string, unknown> };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ ok: false, error: "Scenario could not be applied (unparseable model output)." }, { status: 200 });
  }

  // shape-validate + drop coins not in the portfolio (defense in depth;
  // applyOverrides on the client clamps the final numeric values)
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const rawOv = (parsed.overrides ?? {}) as Record<string, unknown>;
  const overrides: Record<string, unknown> = {};
  if (num(rawOv.btc_factor_vol_mult) != null) overrides.btc_factor_vol_mult = rawOv.btc_factor_vol_mult;
  if (num(rawOv.funding_mult) != null) overrides.funding_mult = rawOv.funding_mult;
  if (num(rawOv.mstr_borrow_mult) != null) overrides.mstr_borrow_mult = rawOv.mstr_borrow_mult;

  const rawSyms = (rawOv.symbols ?? {}) as Record<string, { beta_mult?: unknown; idio_vol_mult?: unknown }>;
  const symbols: Record<string, { beta_mult?: number; idio_vol_mult?: number }> = {};
  for (const [coin, m] of Object.entries(rawSyms)) {
    if (!coins.includes(coin)) continue;
    const entry: { beta_mult?: number; idio_vol_mult?: number } = {};
    if (num(m?.beta_mult) != null) entry.beta_mult = m.beta_mult as number;
    if (num(m?.idio_vol_mult) != null) entry.idio_vol_mult = m.idio_vol_mult as number;
    if (Object.keys(entry).length) symbols[coin] = entry;
  }
  if (Object.keys(symbols).length) overrides.symbols = symbols;

  return NextResponse.json({
    ok: true,
    rationale: (parsed.rationale ?? "").toString().slice(0, 600),
    overrides,
  });
}