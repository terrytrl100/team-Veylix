/*
 * veylix-sim.js — Veylix Monte Carlo (browser engine)
 *
 * Faithful JS implementation of the model in assets/veylix_engine_handoff.md (§3).
 * Runs client-side on every slider/toggle change — no backend, no network round-trip.
 *
 * Usage (browser, <script src="veylix-sim.js">):
 *     const pf  = VeylixSim.parsePortfolio(walletBalanceJson);
 *     const out = VeylixSim.simulate(pf, calibrationJson, { h: 0.5, instrument: "BTC", horizonDays: 30 });
 *
 * Cross-check (Node):  node web/veylix-sim.js   → prints stats for the demo data.
 *
 * Determinism (UX §6/§11): fixed seed ⇒ identical inputs produce an identical cone.
 */
(function (root) {
  "use strict";

  var DEFAULT_SEED = 0x5eed5;
  var DEFAULT_PATHS = 3000;

  // --- deterministic PRNG: mulberry32 → uniform [0,1) ---------------------- //
  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // standard-normal generator (Marsaglia polar), caches the spare draw
  function gaussianFactory(rng) {
    var spare = null;
    return function (mean, std) {
      mean = mean || 0;
      std = std == null ? 1 : std;
      if (spare !== null) {
        var s0 = spare;
        spare = null;
        return mean + std * s0;
      }
      var u, v, s;
      do {
        u = rng() * 2 - 1;
        v = rng() * 2 - 1;
        s = u * u + v * v;
      } while (s === 0 || s >= 1);
      var mul = Math.sqrt((-2 * Math.log(s)) / s);
      spare = v * mul;
      return mean + std * (u * mul);
    };
  }

  // linear-interpolation percentile (matches numpy default) on an ascending array
  function percentile(sortedAsc, p) {
    var n = sortedAsc.length;
    if (n === 0) return NaN;
    var idx = (p / 100) * (n - 1);
    var lo = Math.floor(idx);
    var hi = Math.ceil(idx);
    if (lo === hi) return sortedAsc[lo];
    return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
  }

  // --- inputs -------------------------------------------------------------- //
  function parsePortfolio(raw) {
    var acct = raw.result.list[0];
    var holdings = {};
    acct.coin.forEach(function (c) {
      holdings[c.coin] = parseFloat(c.usdValue);
    });
    return { totalEquity: parseFloat(acct.totalEquity), holdings: holdings };
  }

  // --- portfolio statistics (deterministic, no RNG) ------------------------ //
  function portfolioStats(portfolio, calibration) {
    var sym = calibration.symbols;
    var sigmaBtc = calibration.btc_factor_vol_daily;
    var total = portfolio.totalEquity;
    var gross = 0,
      idioVar = 0,
      weights = {},
      drivers = {};
    Object.keys(portfolio.holdings).forEach(function (coin) {
      if (!(coin in sym)) throw new Error(coin + " missing from calibration.symbols");
      var w = portfolio.holdings[coin] / total;
      var beta = sym[coin].beta;
      var idio = sym[coin].idio_vol_daily;
      weights[coin] = w;
      gross += w * beta;
      idioVar += (w * idio) * (w * idio);
      drivers[coin] = w * w * (beta * beta * sigmaBtc * sigmaBtc + idio * idio);
    });
    var top = null,
      best = -Infinity;
    Object.keys(drivers).forEach(function (c) {
      if (drivers[c] > best) {
        best = drivers[c];
        top = c;
      }
    });
    return { grossLoading: gross, portIdioVar: idioVar, weights: weights, topDriver: top };
  }

  // --- hedge economics ----------------------------------------------------- //
  function carryPerDay(calibration, h, instrument) {
    if (instrument === "BTC") return (calibration.funding_annual * h) / 365;
    if (instrument === "MSTR") {
      var bM = calibration.hedge_instruments.MSTR.beta;
      return (calibration.mstr_borrow_annual * (h / bM)) / 365;
    }
    throw new Error("unknown instrument " + instrument);
  }

  function hedgeIdioVar(calibration, h, instrument) {
    if (instrument === "MSTR") {
      var m = calibration.hedge_instruments.MSTR;
      var k = h / m.beta;
      return k * k * m.idio_vol_daily * m.idio_vol_daily;
    }
    return 0;
  }

  // --- simulation ---------------------------------------------------------- //
  function simulate(portfolio, calibration, opts) {
    opts = opts || {};
    var h = opts.h || 0;
    var instrument = opts.instrument || "BTC";
    var H = opts.horizonDays || 30;
    var nPaths = opts.nPaths || DEFAULT_PATHS;
    var seed = opts.seed == null ? DEFAULT_SEED : opts.seed;

    var st = portfolioStats(portfolio, calibration);
    var sigmaBtc = calibration.btc_factor_vol_daily;
    var net = st.grossLoading - h;
    var carryDay = carryPerDay(calibration, h, instrument);
    var idioStd = Math.sqrt(st.portIdioVar + hedgeIdioVar(calibration, h, instrument));

    var normal = gaussianFactory(mulberry32(seed));

    // value paths, normalised to 1.0 at t=0
    var paths = new Array(nPaths);
    for (var i = 0; i < nPaths; i++) {
      var arr = new Float64Array(H + 1);
      arr[0] = 1.0;
      var v = 1.0;
      for (var d = 1; d <= H; d++) {
        var r = net * normal(0, sigmaBtc) + normal(0, idioStd) - carryDay;
        if (r < -0.99) r = -0.99;
        v *= 1 + r;
        arr[d] = v;
      }
      paths[i] = arr;
    }

    // cone: return percentiles per day
    var pcts = [5, 25, 50, 75, 95];
    var cone = { p5: [], p25: [], p50: [], p75: [], p95: [] };
    var col = new Float64Array(nPaths);
    for (var day = 0; day <= H; day++) {
      for (var j = 0; j < nPaths; j++) col[j] = paths[j][day];
      var sorted = col.slice().sort();
      for (var pi = 0; pi < pcts.length; pi++) {
        cone["p" + pcts[pi]].push(percentile(sorted, pcts[pi]) - 1.0);
      }
    }

    // final returns + per-path max drawdown
    var finals = new Float64Array(nPaths);
    var maxdd = new Float64Array(nPaths);
    var lossCount = 0;
    for (var k = 0; k < nPaths; k++) {
      var p = paths[k];
      finals[k] = p[H] - 1.0;
      if (finals[k] < -0.25) lossCount++;
      var rmax = p[0],
        dd = 0;
      for (var t = 0; t <= H; t++) {
        if (p[t] > rmax) rmax = p[t];
        var cur = p[t] / rmax - 1;
        if (cur < dd) dd = cur;
      }
      maxdd[k] = dd;
    }
    var fSorted = finals.slice().sort();
    var ddSorted = maxdd.slice().sort();

    var factorVar = net * net * sigmaBtc * sigmaBtc;
    var denom = factorVar + st.portIdioVar;

    return {
      inputs: { h: h, instrument: instrument, horizonDays: H, nPaths: nPaths, seed: seed },
      grossLoading: st.grossLoading,
      effectiveBeta: net,
      btcVarShare: denom > 0 ? factorVar / denom : 0,
      topDriver: st.topDriver,
      carryOverHorizonPct: carryDay * H, // + = cost
      cone: cone, // daily return percentiles, length H+1
      final: {
        medianReturn: percentile(fSorted, 50),
        worstCase5pctReturn: percentile(fSorted, 5), // 1-in-20
        p95Return: percentile(fSorted, 95),
        probLossGt25pct: lossCount / nPaths,
        typicalMaxDrawdown: percentile(ddSorted, 50),
      },
    };
  }

  var api = {
    simulate: simulate,
    parsePortfolio: parsePortfolio,
    portfolioStats: portfolioStats,
    carryPerDay: carryPerDay,
    DEFAULT_SEED: DEFAULT_SEED,
  };

  // browser global
  root.VeylixSim = api;
  // Node / CommonJS (for cross-checking against montecarlo.py)
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  // --- Node self-test: node web/veylix-sim.js ------------------------------ //
  if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
    var fs = require("fs");
    var path = require("path");
    var dataDir = path.join(__dirname, "..", "data");
    var cal = JSON.parse(fs.readFileSync(path.join(dataDir, "calibration.json")));
    var pct = function (x) {
      return (x >= 0 ? "+" : "") + (x * 100).toFixed(2) + "%";
    };
    console.log(
      "calibration model_version=" + cal.model_version + "  funding=" + cal.funding_annual +
        "  mstr_borrow=" + cal.mstr_borrow_annual + "\n"
    );
    fs.readdirSync(path.join(dataDir, "portfolios"))
      .filter(function (f) {
        return f.endsWith(".json");
      })
      .sort()
      .forEach(function (f) {
        var pf = parsePortfolio(JSON.parse(fs.readFileSync(path.join(dataDir, "portfolios", f))));
        var base = simulate(pf, cal, { h: 0 });
        console.log(
          "=== " + f.replace(".json", "") + "  ($" + pf.totalEquity.toLocaleString() + ") ==="
        );
        console.log(
          "  gross_loading=" + base.grossLoading.toFixed(3) + "  top_driver=" + base.topDriver +
            "  btc_var_share@h0=" + (base.btcVarShare * 100).toFixed(1) + "%"
        );
        ["BTC", "MSTR"].forEach(function (inst) {
          var r = simulate(pf, cal, { h: 0.5, instrument: inst, horizonDays: 30 });
          console.log(
            "  [" + inst + " h=0.5/30d] eff_beta=" + r.effectiveBeta.toFixed(3) +
              "  carry=" + pct(r.carryOverHorizonPct) +
              "  median=" + pct(r.final.medianReturn) +
              "  1-in-20=" + pct(r.final.worstCase5pctReturn) +
              "  P(<-25%)=" + (r.final.probLossGt25pct * 100).toFixed(1) + "%" +
              "  typ_maxDD=" + pct(r.final.typicalMaxDrawdown)
          );
        });
        console.log("");
      });
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
