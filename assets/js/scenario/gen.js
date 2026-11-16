/* Scenario generator core.
   path     — a seeded, messy close path through scripted waypoints (Brownian bridge between anchors),
              with 'high'/'low' waypoints forced into TJR two-candle swings (clip F2.1/F2.2).
   guard    — keeps a stretch of candles strictly under / over a level (stacked levels stay untaken).
   stamp    — adds t (unix seconds UTC).
   rollup   — merges into a higher timeframe, buckets aligned to the 18:00 ET futures day.
   validate — OHLC sanity: wicks cover bodies, prices on tick, open = previous close. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};

  var DEFAULTS = { vol: 8, wick: 4, chop: 0.4, tick: 0.25 };

  function rt(p, tick) { return TJR.util.roundTick(p, tick); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function copy(k) {
    var out = {};
    for (var key in k) if (Object.prototype.hasOwnProperty.call(k, key)) out[key] = k[key];
    return out;
  }
  function fail(msg) { throw new Error('gen.path: ' + msg); }

  // ---------------------------------------------------------------- path

  // Swing "side": up = +1 for a high (closes sit below the wick), -1 for a low (closes sit above).
  // Interval helper: v must sit `by` points on the inside (toward the closes) of x.
  function inside(B, up, x, by) {
    if (up > 0) B.hi = Math.min(B.hi, x - by); else B.lo = Math.max(B.lo, x + by);
  }

  function path(rng, waypoints, opts) {
    opts = opts || {};
    var tick = opts.tick > 0 ? opts.tick : DEFAULTS.tick;
    var vol = opts.vol > 0 ? opts.vol : DEFAULTS.vol;
    var wick = opts.wick >= 0 ? opts.wick : DEFAULTS.wick;
    var chop = clamp(opts.chop == null ? DEFAULTS.chop : +opts.chop, 0, 1);

    // ---- check the script
    if (!Array.isArray(waypoints) || !waypoints.length) fail('waypoints must be a non-empty array');
    var wps = waypoints.map(function (w) {
      var kind = w.kind || 'pass';
      if (kind !== 'pass' && kind !== 'high' && kind !== 'low') fail('unknown waypoint kind "' + kind + '" at bar ' + w.bar);
      if (!isFinite(w.price) || w.bar !== Math.floor(w.bar)) fail('waypoint needs an integer bar and a finite price');
      return { bar: w.bar, price: rt(w.price, tick), kind: kind };
    });
    if (wps[0].bar !== 0) fail('first waypoint must be at bar 0');
    for (var q = 1; q < wps.length; q++) {
      if (wps[q].bar <= wps[q - 1].bar) fail('waypoints must be sorted by bar (strictly increasing order)');
    }
    // length: opts.bars, else last waypoint + 2 so a final high/low still gets its bar+1 candle
    var n = opts.bars != null ? opts.bars : wps[wps.length - 1].bar + 2;
    wps.forEach(function (w) {
      if (w.bar >= n) fail('waypoint at bar ' + w.bar + ' is outside the series (bars ' + n + ')');
      if (w.kind !== 'pass' && w.bar + 1 >= n) {
        fail(w.kind + ' waypoint at bar ' + w.bar + ' needs bar+1 (' + (w.bar + 1) + ') inside the series (bars ' + n + ')');
      }
    });

    // Close index j runs -1..n-1 (close -1 = open of candle 0); arrays are offset by one.
    var cl = new Array(n + 1), fixed = new Array(n + 1);
    var cLo = [], cHi = [];
    for (var j = 0; j <= n; j++) { cLo[j] = -Infinity; cHi[j] = Infinity; fixed[j] = false; }
    function inRange(jj) { return jj >= -1 && jj <= n - 1; }

    // ---- protection windows: each scripted swing stays the extreme of the two candles before
    // and after its pair, so every close feeding those candles stays strictly inside its price.
    var sw = [];
    wps.forEach(function (w) {
      if (w.kind === 'pass') return;
      var s = { k: w.bar, up: w.kind === 'high' ? 1 : -1, P: w.price, holder: -1 };
      sw.push(s);
      for (var jj = s.k - 3; jj <= s.k + 3; jj++) {
        if (!inRange(jj)) continue;
        if (s.up > 0) cHi[jj + 1] = Math.min(cHi[jj + 1], s.P - tick);
        else cLo[jj + 1] = Math.max(cLo[jj + 1], s.P + tick);
      }
    });
    for (j = 0; j <= n; j++) {
      if (cLo[j] > cHi[j]) fail('conflict: swing waypoints around bar ' + (j - 1) + ' squeeze price from both sides');
    }
    // Wick limits on candle i from every swing whose window (two candles either side of its pair)
    // covers it, skipping `self` and any swing whose wick candle i holds.
    function candleCaps(i, self) {
      var lim = { lo: -Infinity, hi: Infinity };
      sw.forEach(function (s) {
        if (i < s.k - 2 || i > s.k + 3) return;
        if (s === self || s.holder === i) return;
        if (s.up > 0) lim.hi = Math.min(lim.hi, s.P - tick); else lim.lo = Math.max(lim.lo, s.P + tick);
      });
      return lim;
    }

    // Place an anchor close: default value clamped into its interval and the window caps.
    function put(jj, v, B, why) {
      var lo = Math.max(B.lo, cLo[jj + 1]), hi = Math.min(B.hi, cHi[jj + 1]);
      if (lo > hi) fail('conflict at bar ' + jj + ': ' + why);
      cl[jj + 1] = rt(clamp(v, lo, hi), tick);
      fixed[jj + 1] = true;
      return cl[jj + 1];
    }
    function taken(jj) { return fixed[jj + 1]; }
    function closeAt(jj) { return cl[jj + 1]; }
    // the window limit on the side away from a swing's extreme (below a high's closes / above a low's)
    function farCap(jj, up) { return up > 0 ? cLo[jj + 1] : cHi[jj + 1]; }
    function body() { return rt(Math.max(tick, vol * rng.range(0.45, 1.5)), tick); }
    var OPEN = { lo: -Infinity, hi: Infinity };

    // ---- anchors
    var swi = 0;
    wps.forEach(function (w, idx) {
      var b = w.bar;
      if (w.kind === 'pass') {
        if (taken(b)) fail('waypoint at bar ' + b + ' is too close to the previous one (anchor collides at bar ' + b + ')');
        if (w.price < cLo[b + 1] || w.price > cHi[b + 1]) {
          fail('conflict: pass waypoint at bar ' + b + ' (' + w.price + ') would take out a neighbouring swing');
        }
        put(b, w.price, OPEN, 'pass');
        return;
      }
      var s = sw[swi++], up = s.up, P = s.P;
      if (taken(b) || taken(b + 1)) {
        fail(w.kind + ' waypoint at bar ' + b + ' is too close to the previous one (anchor collides at bar ' + (taken(b) ? b : b + 1) + ')');
      }
      // Candle b closes `d1` inside the extreme; candle b+1 opens there (shared body edge).
      // Closes b-1 and b+1 must sit at least a tick further inside than cb, so cb also keeps a tick
      // of room from their far-side limits (window caps, an existing close, the next swing's needs).
      var d1 = rt(Math.max(tick, wick * rng.range(0.4, 1.6)), tick);
      var nx = wps[idx + 1];
      var Bn = { lo: -Infinity, hi: Infinity };
      if (nx && nx.kind !== 'pass' && nx.bar === b + 2) {
        // close b+1 is also the next swing's pre-close: leave it room to move toward that extreme
        inside(Bn, nx.kind === 'high' ? 1 : -1, nx.price, 2 * tick);
      }
      var preFar = taken(b - 1) ? closeAt(b - 1) : farCap(b - 1, up);
      var postFar = up > 0 ? Math.max(farCap(b + 1, up), Bn.lo) : Math.min(farCap(b + 1, up), Bn.hi);
      var Bc = { lo: -Infinity, hi: Infinity };
      inside(Bc, up, P, tick);
      if (isFinite(preFar)) inside(Bc, -up, preFar, tick);
      if (isFinite(postFar)) inside(Bc, -up, postFar, tick);
      var cb = put(b, P - up * d1, Bc, w.kind + ' close');
      if (!taken(b - 1)) {
        var Bp = { lo: -Infinity, hi: Infinity };
        inside(Bp, up, cb, tick);
        put(b - 1, cb - up * body(), Bp, w.kind + ' first candle');
      }
      inside(Bn, up, cb, tick);
      put(b + 1, cb - up * body(), Bn, w.kind + ' second candle');
      // which candle of the pair holds the wick: either, unless a neighbour's window caps one of them
      var holders = [b, b + 1].filter(function (i) {
        var lim = candleCaps(i, s);
        return up > 0 ? lim.hi >= P : lim.lo <= P;
      });
      if (!holders.length) fail('conflict: the ' + w.kind + ' at bar ' + b + ' is capped by a neighbouring swing');
      s.holder = holders.length === 2 ? (rng.chance(0.5) ? b : b + 1) : holders[0];
    });

    // ---- noise: volatility regime (AR(1) on log scale) + MA(1) anti-correlation for chop + rare spikes
    var theta = 0.85 * chop;
    var baseSig = vol / (0.8 * Math.sqrt(1 + theta * theta));   // E|step| ~ vol
    var reg = 0, zPrev = 0;
    function regime() { return Math.exp(0.35 * reg); }
    function step() {
      reg = 0.9 * reg + 0.3 * rng.gauss();
      var z = rng.gauss();
      var e = baseSig * regime() * (z - theta * zPrev);
      zPrev = z;
      return rng.chance(0.03) ? e * 2.2 : e;
    }

    // ---- fill free closes: walk back before the first anchor, Brownian bridge between anchors,
    // free walk after the last one
    var keys = [];
    for (j = 0; j <= n; j++) if (fixed[j]) keys.push(j);
    for (j = keys[0] - 1; j >= 0; j--) cl[j] = rt(cl[j + 1] - step(), tick);
    for (var a = 0; a + 1 < keys.length; a++) {
      var j0 = keys[a], j1 = keys[a + 1], m = j1 - j0;
      if (m < 2) continue;
      var W = [0];
      for (var k = 1; k <= m; k++) W[k] = W[k - 1] + step();
      var miss = W[m] - (cl[j1] - cl[j0]);
      for (k = 1; k < m; k++) cl[j0 + k] = rt(cl[j0] + W[k] - (k / m) * miss, tick);
    }
    for (j = keys[keys.length - 1] + 1; j <= n; j++) cl[j] = rt(cl[j - 1] + step(), tick);

    // free closes inside a protection window: fold the excursion back inside (reads as a rejection)
    for (j = 0; j <= n; j++) {
      if (fixed[j]) continue;
      var v = cl[j];
      if (v > cHi[j]) v = cHi[j] - (v - cHi[j]) * 0.3 - rng.range(0, Math.max(wick, tick));
      if (v < cLo[j]) v = cLo[j] + (cLo[j] - v) * 0.3 + rng.range(0, Math.max(wick, tick));
      cl[j] = rt(clamp(v, cLo[j], cHi[j]), tick);
    }

    // ---- candles: open = previous close; exponential wicks with occasional long ones
    function wickLen() {
      var w = wick * 0.92 * regime() * -Math.log(1 - rng.next());
      return rt(rng.chance(0.06) ? w * 2.5 : w, tick);
    }
    var out = [];
    for (var i = 0; i < n; i++) {
      var o = cl[i], c = cl[i + 1];
      var top = Math.max(o, c), bot = Math.min(o, c);
      var cd = { o: o, h: rt(top + wickLen(), tick), l: rt(bot - wickLen(), tick), c: c };
      var prev = out[i - 1];
      // chop: some candles become inside bars when their body already fits the previous range
      if (prev && rng.chance(0.05 + 0.25 * chop) && top <= prev.h && bot >= prev.l) {
        cd.h = Math.min(cd.h, prev.h);
        cd.l = Math.max(cd.l, prev.l);
      }
      out.push(cd);
    }

    // ---- scripted extremes exact, then every window candle capped strictly inside them
    sw.forEach(function (s) {
      if (s.up > 0) out[s.holder].h = s.P; else out[s.holder].l = s.P;
    });
    out.forEach(function (cd, ci) {
      var lim = candleCaps(ci, null);
      cd.h = Math.max(Math.min(cd.h, lim.hi), cd.o, cd.c);
      cd.l = Math.min(Math.max(cd.l, lim.lo), cd.o, cd.c);
    });
    return out;
  }

  // ---------------------------------------------------------------- guard

  // Largest tick multiple strictly below x / smallest strictly above.
  function below(x, tick) { return rt((Math.ceil(x / tick - 1e-9) - 1) * tick, tick); }
  function above(x, tick) { return rt((Math.floor(x / tick + 1e-9) + 1) * tick, tick); }

  // Deterministic 0..3 tick jitter from a price, so guarded wicks don't all line up on the cap.
  function jitter(x, tick) { return ((Math.round(x / tick) % 4) + 4) % 4; }

  function median(xs) {
    var s = xs.slice().sort(function (p, q) { return p - q; });
    return s.length ? s[(s.length - 1) >> 1] : 0;
  }

  // Triangle wave: 0 at u = 0, 2D, 4D…, D at u = D, 3D…  (D = 0 -> always 0: hard clamp)
  function tri(u, D) { return D > 0 ? D - Math.abs((u % (2 * D)) - D) : 0; }

  // One fold (side = +1 caps from above, -1 from below). A price `over` points beyond the cap lands
  // tri(over/2) points inside it: pokes read as rejections, long excursions bounce inside a band of
  // depth D under the level (chop), and no candle collapses flat. f is continuous, so a candle's new
  // range is f over its [l,h]: the endpoints, plus the cap / band floor whenever a bounce point falls
  // inside — o and c always stay within it.
  function makeFold(cap, side, D, tick) {
    function f(x) {
      var over = side * (x - cap);
      return over <= 0 ? x : rt(cap - side * tri(over / 2, D), tick);
    }
    f.span = function (l, h) {
      var fl = f(l), fh = f(h);
      var a = side * (l - cap) / 2, b = side * (h - cap) / 2;
      var uMin = Math.min(a, b), uMax = Math.max(a, b);
      var outer = side > 0 ? Math.max(fl, fh) : Math.min(fl, fh);
      var inner = side > 0 ? Math.min(fl, fh) : Math.max(fl, fh);
      var touches = uMin <= 0 || D === 0 || Math.floor(uMax / (2 * D)) >= Math.ceil(uMin / (2 * D));
      if (touches) outer = cap;
      if (D > 0 && uMax >= D &&
          Math.floor((uMax / D - 1) / 2) >= Math.max(0, Math.ceil((Math.max(uMin, 0) / D - 1) / 2))) {
        var floor = rt(cap - side * D, tick);
        inner = side > 0 ? Math.min(inner, floor) : Math.max(inner, floor);
      }
      return { outer: outer, inner: inner, touches: touches };
    };
    return f;
  }

  function coverBody(k) { k.h = Math.max(k.h, k.o, k.c); k.l = Math.min(k.l, k.o, k.c); }

  // The price where candle a closes and candle a+1 opens: clamp v into `lim` and write it to both.
  function joint(cs, a, v, lim, ruleNo) {
    if (lim.lo > lim.hi) {
      throw new Error('gen.guard: rule ' + ruleNo + ' meets an earlier rule at bar ' + a + '/' + (a + 1) +
        ' and no price there is allowed by both');
    }
    v = clamp(v, lim.lo, lim.hi);
    cs[a].c = v;
    cs[a + 1].o = v;
    coverBody(cs[a]);
    coverBody(cs[a + 1]);
  }

  // Fold candles from..to against one cap. The two chain joints (from-1|from, to|to+1) are then
  // clamped into this rule's band and the band of the latest earlier rule covering the outside
  // bar (`outside(i)`), so a guard never drags a neighbouring guarded bar out of its own rule.
  function applyFold(cs, from, to, cap, side, depth, tick, band, outside, ruleNo) {
    var f = makeFold(cap, side, depth, tick);
    function both(i) {
      var o = outside(i);
      return { lo: Math.max(band.lo, o.lo), hi: Math.min(band.hi, o.hi) };
    }
    for (var i = from; i <= to; i++) {
      var k = cs[i];
      if (side * (k.h - cap) <= 0 && side * (k.l - cap) <= 0) continue;   // fully inside: untouched
      var o = f(k.o), c = f(k.c), sp = f.span(k.l, k.h);
      // a wick that reaches the cap is pulled back 0..3 ticks so guarded wicks don't line up on it
      var outer = sp.touches ? cap - side * jitter(side > 0 ? k.h : k.l, tick) * tick : sp.outer;
      if (side > 0) {
        k.h = Math.max(outer, o, c);
        k.l = Math.min(sp.inner, o, c);
      } else {
        k.l = Math.min(outer, o, c);
        k.h = Math.max(sp.inner, o, c);
      }
      k.o = o;
      k.c = c;
    }
    // chain in: candle `from` opened at f(old close of from-1); candle from-1 must close there too
    if (from > 0) joint(cs, from - 1, cs[from].o, both(from - 1), ruleNo);
    // chain out: candle to+1 opens where candle `to` now closes
    if (to + 1 < cs.length) joint(cs, to, cs[to].c, both(to + 1), ruleNo);
  }

  // rules: [{from, to, maxHigh?, minLow?, tick?}] applied in order; later rules win on overlap.
  // Touches candles from..to, plus the close of from-1 and the open of to+1 to keep the chain;
  // those two stay inside the latest earlier rule that covers them (adjacent guards = stacked
  // levels), and a joint no price can satisfy throws.
  function guard(candles, rules) {
    var cs = candles.map(copy);
    var done = [];   // processed rules as {from, to, lo, hi}
    function outside(i) {
      for (var d = done.length - 1; d >= 0; d--) {
        if (i >= done[d].from && i <= done[d].to) return done[d];
      }
      return { lo: -Infinity, hi: Infinity };
    }
    (rules || []).forEach(function (r, ruleNo) {
      var tick = r.tick > 0 ? r.tick : DEFAULTS.tick;
      var from = Math.max(0, r.from), to = Math.min(cs.length - 1, r.to);
      if (from > to) return;
      var capHi = r.maxHigh != null ? below(r.maxHigh, tick) : Infinity;
      var capLo = r.minLow != null ? above(r.minLow, tick) : -Infinity;
      if (capLo > capHi) throw new Error('gen.guard: minLow ' + r.minLow + ' leaves no room under maxHigh ' + r.maxHigh);
      var band = { lo: capLo, hi: capHi };
      var ranges = [];
      for (var i = from; i <= to; i++) ranges.push(cs[i].h - cs[i].l);
      var depth = Math.max(4 * tick, median(ranges));
      // a band (both caps): each fold stays in its half; under two ticks wide it is a hard clamp
      if (isFinite(capHi) && isFinite(capLo)) depth = Math.min(depth, (capHi - capLo) / 2);
      if (depth < tick) depth = 0;
      if (isFinite(capHi)) applyFold(cs, from, to, capHi, 1, depth, tick, band, outside, ruleNo);
      if (isFinite(capLo)) applyFold(cs, from, to, capLo, -1, depth, tick, band, outside, ruleNo);
      done.push({ from: from, to: to, lo: capLo, hi: capHi });
    });
    return cs;
  }

  // ---------------------------------------------------------------- stamp

  function stamp(candles, startUtcSec, tfMin) {
    var stepSec = tfMin * 60;
    return candles.map(function (k, i) {
      return { t: startUtcSec + i * stepSec, o: k.o, h: k.h, l: k.l, c: k.c };
    });
  }

  // ---------------------------------------------------------------- rollup

  // US Eastern offset in seconds for a UTC instant: EDT (-4h) from the 2nd Sunday of March 02:00 EST
  // (07:00Z) to the 1st Sunday of November 02:00 EDT (06:00Z), else EST (-5h).
  // Local helper limited to rollup's needs; TJR.sessions (Task 4) owns the full ET clock.
  function nthSunday(y, month, nth) {
    var dow = new Date(Date.UTC(y, month, 1)).getUTCDay();
    return 1 + ((7 - dow) % 7) + 7 * (nth - 1);
  }
  function etOffsetSec(utcSec) {
    var y = new Date(utcSec * 1000).getUTCFullYear();
    var start = Date.UTC(y, 2, nthSunday(y, 2, 2), 7) / 1000;
    var end = Date.UTC(y, 10, nthSunday(y, 10, 1), 6) / 1000;
    return (utcSec >= start && utcSec < end ? -4 : -5) * 3600;
  }

  var DAY = 86400, DAY_START = 18 * 3600;   // futures day opens 18:00 ET

  // Bucket start (UTC) for a candle at t: work in ET wall-clock seconds, snap to the 18:00 day open,
  // then to whole buckets. The offset is the candle's own; DST switches at 02:00 Sunday, while the
  // futures market is closed, so no trading bucket straddles one.
  function bucketStart(t, sizeSec) {
    var off = etOffsetSec(t);
    var local = t + off;
    var dayStart = Math.floor((local - DAY_START) / DAY) * DAY + DAY_START;
    return dayStart + Math.floor((local - dayStart) / sizeSec) * sizeSec - off;
  }

  function rollup(candles, tfMin, targetTfMin) {
    if (!(targetTfMin >= tfMin) || targetTfMin % tfMin !== 0) {
      throw new Error('gen.rollup: target ' + targetTfMin + 'm must be a whole multiple of ' + tfMin + 'm');
    }
    if (1440 % targetTfMin !== 0) throw new Error('gen.rollup: target ' + targetTfMin + 'm must divide the 1440m futures day');
    var out = [], cur = null, curT = null, size = targetTfMin * 60;
    candles.forEach(function (k) {
      if (typeof k.t !== 'number') throw new Error('gen.rollup: candles need t (use gen.stamp first)');
      var b = targetTfMin === tfMin ? k.t : bucketStart(k.t, size);
      if (cur && b === curT) {
        if (k.h > cur.h) cur.h = k.h;
        if (k.l < cur.l) cur.l = k.l;
        cur.c = k.c;
      } else {
        cur = { t: b, o: k.o, h: k.h, l: k.l, c: k.c };
        curT = b;
        out.push(cur);
      }
    });
    return out;
  }

  // ---------------------------------------------------------------- validate

  function validate(candles, tick) {
    var tk = tick > 0 ? tick : DEFAULTS.tick;
    if (!Array.isArray(candles)) return ['candles is not an array'];
    var errs = [];
    candles.forEach(function (k, i) {
      var bad = false;
      ['o', 'h', 'l', 'c'].forEach(function (f) {
        var v = k[f];
        if (typeof v !== 'number' || !isFinite(v)) { errs.push('bar ' + i + ': ' + f + ' is not a finite number'); bad = true; return; }
        var q = v / tk;
        if (Math.abs(q - Math.round(q)) > 1e-6) errs.push('bar ' + i + ': ' + f + ' ' + v + ' not on tick ' + tk);
      });
      if (bad) return;
      if (k.h < Math.max(k.o, k.c)) errs.push('bar ' + i + ': h ' + k.h + ' < max(o,c) ' + Math.max(k.o, k.c));
      if (k.l > Math.min(k.o, k.c)) errs.push('bar ' + i + ': l ' + k.l + ' > min(o,c) ' + Math.min(k.o, k.c));
      if (i > 0 && k.o !== candles[i - 1].c) errs.push('bar ' + i + ': open ' + k.o + ' !== previous close ' + candles[i - 1].c);
    });
    return errs;
  }

  TJR.gen = { path: path, guard: guard, stamp: stamp, rollup: rollup, validate: validate };
})(typeof window !== 'undefined' ? window : globalThis);
