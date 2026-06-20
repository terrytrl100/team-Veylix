"""
Veylix risk engine — Monte Carlo simulation (reference implementation).

Implements the single-factor, zero-drift dispersion model specified in
assets/veylix_engine_handoff.md (§3). This is the authoritative engine: it can be
used to generate fixed-seed test vectors for the front-end JS port, or wrapped in an
API to serve the cone/tiles directly.

Run as a script to validate against the demo data:
    python engine/montecarlo.py
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np

# Fixed seed — identical inputs must produce an identical cone (UX §6/§11).
DEFAULT_SEED = 0x5EED5
DEFAULT_PATHS = 3000

REPO = Path(__file__).resolve().parent.parent
CALIBRATION = REPO / "data" / "calibration.json"
PORTFOLIOS = REPO / "data" / "portfolios"


# --------------------------------------------------------------------------- #
# Inputs
# --------------------------------------------------------------------------- #
def load_calibration(path: Path = CALIBRATION) -> dict:
    return json.loads(Path(path).read_text())


def load_portfolio(path: Path) -> dict:
    """Parse a Bybit wallet-balance file into {coin: usd_value} + total."""
    raw = json.loads(Path(path).read_text())
    acct = raw["result"]["list"][0]
    total = float(acct["totalEquity"])
    holdings = {c["coin"]: float(c["usdValue"]) for c in acct["coin"]}
    return {"total_equity": total, "holdings": holdings}


# --------------------------------------------------------------------------- #
# Portfolio statistics (deterministic — no RNG)
# --------------------------------------------------------------------------- #
@dataclass
class PortfolioStats:
    gross_loading: float          # Σ w_i · beta_i  (BTC-factor exposure)
    port_idio_var: float          # Σ (w_i · idio_i)^2  (daily idiosyncratic variance)
    weights: dict[str, float]
    top_driver: str               # asset contributing the most variance


def portfolio_stats(portfolio: dict, calibration: dict) -> PortfolioStats:
    sym = calibration["symbols"]
    sigma_btc = calibration["btc_factor_vol_daily"]
    total = portfolio["total_equity"]

    gross = 0.0
    idio_var = 0.0
    weights: dict[str, float] = {}
    drivers: dict[str, float] = {}
    for coin, usd in portfolio["holdings"].items():
        if coin not in sym:
            raise KeyError(f"{coin} missing from calibration.symbols")
        w = usd / total
        beta = sym[coin]["beta"]
        idio = sym[coin]["idio_vol_daily"]
        weights[coin] = w
        gross += w * beta
        idio_var += (w * idio) ** 2
        # variance contribution of this asset (factor + own noise)
        drivers[coin] = (w ** 2) * (beta ** 2 * sigma_btc ** 2 + idio ** 2)

    top = max(drivers, key=drivers.get)
    return PortfolioStats(gross, idio_var, weights, top)


# --------------------------------------------------------------------------- #
# Hedge economics
# --------------------------------------------------------------------------- #
def carry_per_day(calibration: dict, h: float, instrument: str) -> float:
    """Daily carry cost (fraction of PV) of holding the hedge. Positive = cost."""
    if instrument == "BTC":
        return calibration["funding_annual"] * h / 365.0
    if instrument == "MSTR":
        beta_mstr = calibration["hedge_instruments"]["MSTR"]["beta"]
        return calibration["mstr_borrow_annual"] * (h / beta_mstr) / 365.0
    raise ValueError(f"unknown instrument {instrument!r}")


def hedge_idio_var(calibration: dict, h: float, instrument: str) -> float:
    """Extra daily variance the hedge instrument adds back (MSTR only)."""
    if instrument == "MSTR":
        m = calibration["hedge_instruments"]["MSTR"]
        return (h / m["beta"]) ** 2 * m["idio_vol_daily"] ** 2
    return 0.0


# --------------------------------------------------------------------------- #
# Simulation
# --------------------------------------------------------------------------- #
def simulate(
    portfolio: dict,
    calibration: dict,
    h: float = 0.0,
    instrument: str = "BTC",
    horizon_days: int = 30,
    n_paths: int = DEFAULT_PATHS,
    seed: int = DEFAULT_SEED,
) -> dict:
    """
    Run the Monte Carlo and return the cone + summary stats.

    Daily portfolio return (per path, per day), per handoff §3:
        factor = (gross_loading - h) * N(0, sigma_btc)
        idio   = N(0, sqrt(port_idio_var + hedge_idio_var))   # sum of independent normals
        r      = clamp(factor + idio - carry_day, -0.99, +inf)
    """
    st = portfolio_stats(portfolio, calibration)
    sigma_btc = calibration["btc_factor_vol_daily"]
    net_loading = st.gross_loading - h

    carry_day = carry_per_day(calibration, h, instrument)
    idio_std = math.sqrt(st.port_idio_var + hedge_idio_var(calibration, h, instrument))

    rng = np.random.default_rng(seed)
    F = rng.normal(0.0, sigma_btc, size=(n_paths, horizon_days))
    idio = rng.normal(0.0, idio_std, size=(n_paths, horizon_days))
    daily = np.maximum(net_loading * F + idio - carry_day, -0.99)

    # value paths normalised to 1.0 at t=0
    value = np.cumprod(1.0 + daily, axis=1)
    value = np.hstack([np.ones((n_paths, 1)), value])  # prepend day 0

    pct = [5, 25, 50, 75, 95]
    cone = {f"p{p}": (np.percentile(value, p, axis=0) - 1.0).tolist() for p in pct}

    final = value[:, -1] - 1.0
    running_max = np.maximum.accumulate(value, axis=1)
    max_dd = (value / running_max - 1.0).min(axis=1)  # most negative per path

    # BTC-variance share at the *current* hedge (the "% of your risk that is BTC" headline)
    factor_var = net_loading ** 2 * sigma_btc ** 2
    btc_share = factor_var / (factor_var + st.port_idio_var) if (factor_var + st.port_idio_var) else 0.0

    return {
        "inputs": {
            "h": h, "instrument": instrument, "horizon_days": horizon_days,
            "n_paths": n_paths, "seed": seed,
        },
        "gross_loading": st.gross_loading,
        "effective_beta": net_loading,
        "btc_var_share": btc_share,
        "top_driver": st.top_driver,
        "carry_over_horizon_pct": carry_day * horizon_days,  # + = cost
        "cone": cone,                                        # daily return percentiles, len H+1
        "final": {
            "median_return": float(np.percentile(final, 50)),
            "worst_case_5pct_return": float(np.percentile(final, 5)),   # 1-in-20
            "p95_return": float(np.percentile(final, 95)),
            "prob_loss_gt_25pct": float((final < -0.25).mean()),
            "typical_max_drawdown": float(np.median(max_dd)),
        },
    }


# --------------------------------------------------------------------------- #
# Harness — validate against handoff §6
# --------------------------------------------------------------------------- #
def _fmt_pct(x: float) -> str:
    return f"{x * 100:+.2f}%"


def main() -> None:
    cal = load_calibration()
    print(f"calibration model_version={cal['model_version']}  "
          f"funding={cal['funding_annual']}  mstr_borrow={cal['mstr_borrow_annual']}\n")

    for pf_path in sorted(PORTFOLIOS.glob("*.json")):
        pf = load_portfolio(pf_path)
        name = pf_path.stem
        # deterministic checks (no RNG)
        st = portfolio_stats(pf, cal)
        print(f"=== {name}  (${pf['total_equity']:,.0f}) ===")
        print(f"  gross_loading={st.gross_loading:.3f}  top_driver={st.top_driver}  "
              f"btc_var_share@h0={simulate(pf, cal, h=0.0)['btc_var_share']*100:.1f}%")

        for instrument in ("BTC", "MSTR"):
            r = simulate(pf, cal, h=0.5, instrument=instrument, horizon_days=30)
            f = r["final"]
            print(f"  [{instrument:<4} h=0.5/30d] eff_beta={r['effective_beta']:.3f}  "
                  f"carry={_fmt_pct(r['carry_over_horizon_pct'])}  "
                  f"median={_fmt_pct(f['median_return'])}  "
                  f"1-in-20={_fmt_pct(f['worst_case_5pct_return'])}  "
                  f"P(<-25%)={f['prob_loss_gt_25pct']*100:.1f}%  "
                  f"typ_maxDD={_fmt_pct(f['typical_max_drawdown'])}")
        print()


if __name__ == "__main__":
    main()
