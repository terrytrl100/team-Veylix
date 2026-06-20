"""
Veylix calibration engine.

Offline build-time job: pulls real market data and writes data/calibration.json
(the parameters veylix-sim.js consumes). Not in the live path.

  - Crypto betas / idio-vols / BTC factor vol : public Bybit /v5/market/kline (no key)
  - BTC funding (the BTC-hedge carry)          : public Bybit /v5/market/funding/history
  - MSTR beta / idio-vol (the TradFi hedge)     : yfinance (Stooq fallback)
  - MSTR borrow cost                            : documented constant (MVP decision)

Run:  python engine/calibrate.py            # writes data/calibration.json
      python engine/calibrate.py --dry-run  # print only, don't write
"""

from __future__ import annotations

import argparse
import datetime as dt
import io
import json
import sys
from pathlib import Path

import numpy as np
import requests

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "data" / "calibration.json"

BYBIT = "https://api.bybit.com"
LOOKBACK_DAYS = 365
MODEL_VERSION = "v1"
MSTR_BORROW_ANNUAL = 0.05  # MVP constant (see §9 decisions)

# calibration-key -> Bybit linear-perp symbol  (USDT handled separately as 0/0)
COINS = {
    "BTC": "BTCUSDT",
    "ETH": "ETHUSDT",
    "SOL": "SOLUSDT",
    "LINK": "LINKUSDT",
    "DOGE": "DOGEUSDT",
    # low-quality / high-idiosyncratic memes & microcaps (the "bad book" demo)
    "PEPE": "1000PEPEUSDT",
    "FLOKI": "1000FLOKIUSDT",
    "BONK": "1000BONKUSDT",
    "WIF": "WIFUSDT",
}

session = requests.Session()
session.headers.update({"User-Agent": "veylix-calibrate/1.0"})


# --------------------------------------------------------------------------- #
# Bybit market data (public)
# --------------------------------------------------------------------------- #
def bybit_daily_closes(symbol: str, days: int = LOOKBACK_DAYS) -> dict[dt.date, float]:
    """Daily close by UTC date from Bybit linear klines."""
    r = session.get(
        f"{BYBIT}/v5/market/kline",
        params={"category": "linear", "symbol": symbol, "interval": "D", "limit": days + 1},
        timeout=20,
    )
    r.raise_for_status()
    payload = r.json()
    if payload.get("retCode") != 0:
        raise RuntimeError(f"Bybit kline {symbol}: {payload.get('retMsg')}")
    out: dict[dt.date, float] = {}
    for row in payload["result"]["list"]:  # [start_ms, o, h, l, c, vol, turnover]
        d = dt.datetime.fromtimestamp(int(row[0]) / 1000, dt.timezone.utc).date()
        out[d] = float(row[4])
    return out


def bybit_funding_annual(symbol: str = "BTCUSDT", limit: int = 200) -> float:
    """Annualised BTC funding = mean(8h funding rate) * 3 * 365."""
    r = session.get(
        f"{BYBIT}/v5/market/funding/history",
        params={"category": "linear", "symbol": symbol, "limit": limit},
        timeout=20,
    )
    r.raise_for_status()
    payload = r.json()
    if payload.get("retCode") != 0:
        raise RuntimeError(f"Bybit funding {symbol}: {payload.get('retMsg')}")
    rates = [float(x["fundingRate"]) for x in payload["result"]["list"]]
    if not rates:
        raise RuntimeError("no funding history returned")
    return float(np.mean(rates) * 3 * 365)


# --------------------------------------------------------------------------- #
# MSTR equity data (yfinance, Stooq fallback)
# --------------------------------------------------------------------------- #
def mstr_daily_closes(days: int = LOOKBACK_DAYS) -> dict[dt.date, float]:
    try:
        import yfinance as yf  # noqa: PLC0415

        hist = yf.Ticker("MSTR").history(period="1y", interval="1d")
        if not hist.empty:
            return {ts.date(): float(c) for ts, c in hist["Close"].items()}
        print("  [warn] yfinance returned empty; trying Stooq", file=sys.stderr)
    except Exception as e:  # noqa: BLE001
        print(f"  [warn] yfinance unavailable ({e}); trying Stooq", file=sys.stderr)

    # Stooq fallback — plain CSV, no key
    r = session.get("https://stooq.com/q/d/l/", params={"s": "mstr.us", "i": "d"}, timeout=20)
    r.raise_for_status()
    out: dict[dt.date, float] = {}
    rows = list(io.StringIO(r.text))
    if not rows or not rows[0].startswith("Date"):
        raise RuntimeError("Stooq returned no usable data for MSTR")
    for line in rows[1:]:
        parts = line.strip().split(",")
        if len(parts) < 5 or parts[4] in ("", "N/D"):
            continue
        out[dt.date.fromisoformat(parts[0])] = float(parts[4])
    cutoff = dt.date.today() - dt.timedelta(days=days)
    return {d: c for d, c in out.items() if d >= cutoff}


# --------------------------------------------------------------------------- #
# Stats
# --------------------------------------------------------------------------- #
def daily_returns(closes: dict[dt.date, float]) -> dict[dt.date, float]:
    days = sorted(closes)
    return {days[i]: closes[days[i]] / closes[days[i - 1]] - 1.0 for i in range(1, len(days))}


def beta_and_idio(asset_ret: dict, btc_ret: dict) -> tuple[float, float]:
    """OLS beta of asset on BTC + stdev of residuals, over common dates."""
    common = sorted(set(asset_ret) & set(btc_ret))
    if len(common) < 30:
        raise RuntimeError(f"too few overlapping days ({len(common)})")
    a = np.array([asset_ret[d] for d in common])
    b = np.array([btc_ret[d] for d in common])
    beta = float(np.cov(a, b, ddof=1)[0, 1] / np.var(b, ddof=1))
    resid = a - beta * b
    return round(beta, 4), round(float(np.std(resid, ddof=1)), 4)


# --------------------------------------------------------------------------- #
# Build
# --------------------------------------------------------------------------- #
def build_calibration() -> dict:
    print("Fetching Bybit klines...")
    rets = {}
    for coin, sym in COINS.items():
        try:
            rets[coin] = daily_returns(bybit_daily_closes(sym))
        except Exception as e:  # noqa: BLE001 — skip a symbol, don't kill the run
            print(f"  [warn] skip {coin} ({sym}): {e}", file=sys.stderr)
    if "BTC" not in rets:
        raise RuntimeError("BTC klines required for the factor model")
    btc_ret = rets["BTC"]

    btc_factor_vol = round(float(np.std(list(btc_ret.values()), ddof=1)), 4)

    symbols = {"BTC": {"beta": 1.0, "idio_vol_daily": 0.0}}
    for coin in COINS:
        if coin == "BTC" or coin not in rets:
            continue
        try:
            beta, idio = beta_and_idio(rets[coin], btc_ret)
            symbols[coin] = {"beta": beta, "idio_vol_daily": idio}
        except Exception as e:  # noqa: BLE001
            print(f"  [warn] skip {coin}: {e}", file=sys.stderr)
    symbols["USDT"] = {"beta": 0.0, "idio_vol_daily": 0.0}

    print("Fetching BTC funding...")
    funding = round(bybit_funding_annual(), 4)

    print("Fetching MSTR (equity)...")
    mstr_ret = daily_returns(mstr_daily_closes())
    mstr_beta, mstr_idio = beta_and_idio(mstr_ret, btc_ret)

    return {
        "as_of": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "bybit /v5/market/kline + /v5/market/funding/history (crypto); yfinance/Stooq (MSTR)",
        "lookback_days": LOOKBACK_DAYS,
        "btc_factor_vol_daily": btc_factor_vol,
        "funding_annual": funding,
        "mstr_borrow_annual": MSTR_BORROW_ANNUAL,
        "symbols": symbols,
        "hedge_instruments": {"MSTR": {"beta": mstr_beta, "idio_vol_daily": mstr_idio}},
        "model_version": MODEL_VERSION,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="print, don't write")
    args = ap.parse_args()

    cal = build_calibration()
    print("\n" + json.dumps(cal, indent=2))

    if args.dry_run:
        print("\n[dry-run] not written")
        return
    OUT.write_text(json.dumps(cal, indent=2) + "\n")
    print(f"\nWrote {OUT.relative_to(REPO)}")


if __name__ == "__main__":
    main()
