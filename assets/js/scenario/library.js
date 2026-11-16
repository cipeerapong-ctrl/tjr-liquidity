/* Scenario library S01-S14 (spec 7.3): seeded messy charts with known truth.
   Each scenario scripts swing waypoints for gen.path and "keep" bands for gen.guard, then reads its
   truth back from the candles (levels, sweeps, structure, D2 entry window, D4 outcome, session boxes).
   Scripts are written in "long space": dir = -1 mirrors prices, swing kinds, bands and tags, so a short
   setup reuses the long script. Prices are in units of the scenario's volatility `u`.
   Private helpers first; the scenarios; then check() and the public TJR.scenarios. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var G = TJR.gen, SW = TJR.swings, SS = TJR.sessions;
  var TICK = 0.25;
  // A scripted swing keeps every kept band on its body side at least MARGIN*u away. gen.path puts a
  // pair's bodies within 1.5*vol + 1.6*wick (= 2.3u) of its extreme, so a guard fold can never flip
  // the pair's candle directions; on the extreme side a band may only trim wicks.
  var MARGIN = 2.5;
  var END = 1e9;   // "to the last bar" for keep()
  var MIRROR = { H: 'L', L: 'H', HH: 'LL', LL: 'HH', HL: 'LH', LH: 'HL' };
  var VOL = { NQ5: [7, 10], ES5: [2, 2.75], NQ1: [3, 4], NQ1440: [120, 160] };

  function rt(p) { return TJR.util.roundTick(p, TICK); }
  function mixSeed(seed, salt) {
    var h = ((seed >>> 0) ^ Math.imul(salt + 0x9E37, 0x85EBCA6B)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function highTag(tag) { return tag === 'H' || tag === 'HH' || tag === 'LH'; }
  function through(k, side, price) { return side === 'high' ? k.h > price : k.l < price; }
  function firstThrough(cs, from, side, price) {
    for (var j = Math.max(0, from); j < cs.length; j++) if (through(cs[j], side, price)) return j;
    return null;
  }

  // ---------------------------------------------------------------- script

  function Script(id, seed, salt, inst, tf, dir) {
    this.id = id;
    var r = this.r = TJR.rng.make(mixSeed(seed, salt));
    this.chop = r.range(0.38, 0.62);
    var v = VOL[inst + tf];
    this.u = r.range(v[0], v[1]);
    this.ref = rt((inst === 'ES' ? 7500 : 30000) * (1 + r.range(-0.03, 0.03)));
    this.dir = dir || 1;
    this.wps = []; this.by = {}; this.cons = []; this.bar = 0;
  }
  var SP = Script.prototype;

  SP.p = function (x) { return rt(this.ref + this.dir * x * this.u); };
  SP.kind = function (k) { return this.dir > 0 || k === 'pass' ? k : (k === 'high' ? 'low' : 'high'); };
  // x: long-space units, or {px} for an exact real price
  SP.at = function (name, bar, x, kind) {
    if (name && this.by[name]) throw new Error(this.id + ': duplicate waypoint ' + name);
    var price = typeof x === 'object' ? rt(x.px) : this.p(x);
    var w = { name: name, bar: bar, price: price, x: (price - this.ref) / (this.dir * this.u),
              lk: kind || 'pass', kind: this.kind(kind || 'pass') };
    this.wps.push(w);
    if (name) this.by[name] = w;
    if (bar > this.bar) this.bar = bar;
    return w;
  };
  // next waypoint lo..hi bars after the latest one
  SP.go = function (name, x, kind, lo, hi) { return this.at(name, this.bar + this.r.int(lo || 5, hi || 8), x, kind); };
  SP.X = function (name) { return this.by[name].x; };
  SP.P = function (name) { return this.by[name].price; };
  SP.B = function (name) { return this.by[name].bar; };
  // a price k ticks inside a named swing (below a long-space high, above a long-space low): near-equal, never equal
  SP.near = function (name, k) {
    var w = this.by[name];
    return { px: w.price + (w.lk === 'high' ? -1 : 1) * this.dir * k * TICK };
  };
  // keep candles from..to strictly above `lo` and below `hi` (long space: names or x; null = open)
  SP.keep = function (from, to, lo, hi) {
    if (to < from) return;
    var self = this;
    function px(v) { return v == null ? null : typeof v === 'string' ? self.P(v) : self.p(v); }
    var a = px(lo), b = px(hi);
    this.cons.push(this.dir > 0 ? { from: from, to: to, lo: a, hi: b } : { from: from, to: to, lo: b, hi: a });
  };
  // calm pass waypoints every 18..30 bars inside (lo, hi) (long-space x), away from scripted waypoints
  SP.fill = function (from, to, lo, hi) {
    var taken = this.wps.map(function (w) { return w.bar; });
    for (var b = from + this.r.int(4, 18); b <= to; b += this.r.int(18, 30)) {
      if (taken.some(function (t) { return Math.abs(t - b) <= 4; })) continue;
      this.at(null, b, lo + (hi - lo) * this.r.range(0.25, 0.75), 'pass');
    }
  };

  // Script bugs are seed-independent in kind: fail loudly instead of drawing a broken chart.
  SP.lint = function (n) {
    var id = this.id, M = MARGIN * this.u, cons = this.cons;
    this.wps.forEach(function (w) {
      var nm = w.name || ('pass@' + w.bar);
      if (w.bar < 0 || w.bar >= n) throw new Error(id + ': ' + nm + ' outside the series');
      cons.forEach(function (c) {
        function cov(a, b) { return c.from <= b && c.to >= a; }
        if (w.kind === 'pass') {
          if (cov(w.bar, w.bar) && ((c.lo != null && w.price < c.lo + TICK) || (c.hi != null && w.price > c.hi - TICK))) {
            throw new Error(id + ': ' + nm + ' sits outside a kept band');
          }
          return;
        }
        var up = w.kind === 'high', k = w.bar;
        var body = up ? c.lo : c.hi, ext = up ? c.hi : c.lo;
        if (body != null && cov(k - 1, k + 2) && (up ? body > w.price - M : body < w.price + M)) {
          throw new Error(id + ': ' + nm + ' is closer than ' + MARGIN + 'u to a kept band on its body side');
        }
        if (ext != null && cov(k, k + 1) && (up ? !(w.price < ext) : !(w.price > ext))) {
          throw new Error(id + ': ' + nm + ' reaches past a kept band');
        }
      });
    });
  };

  // overlapping keep() bands -> disjoint gen.guard rules, each the intersection of what covers it
  function segments(cons, n) {
    var cuts = [0, n];
    cons.forEach(function (c) { cuts.push(Math.max(0, c.from), Math.min(n, c.to + 1)); });
    cuts = cuts.filter(function (x, i) { return cuts.indexOf(x) === i; }).sort(function (a, b) { return a - b; });
    var out = [];
    for (var q = 0; q + 1 < cuts.length; q++) {
      var a = cuts[q], b = cuts[q + 1] - 1, lo = -Infinity, hi = Infinity, any = false;
      cons.forEach(function (c) {
        if (c.from > a || c.to < b) return;
        any = true;
        if (c.lo != null && c.lo > lo) lo = c.lo;
        if (c.hi != null && c.hi < hi) hi = c.hi;
      });
      if (!any) continue;
      var prev = out[out.length - 1];
      if (prev && prev.to === a - 1 && prev.lo === lo && prev.hi === hi) { prev.to = b; continue; }
      out.push({ from: a, to: b, lo: lo, hi: hi });
    }
    return out.map(function (s) {
      var r = { from: s.from, to: s.to };
      if (isFinite(s.lo)) r.minLow = s.lo;
      if (isFinite(s.hi)) r.maxHigh = s.hi;
      return r;
    });
  }

  SP.run = function (n) {
    var cons = this.cons;
    this.wps.sort(function (a, b) { return a.bar - b.bar; });
    // Each swing also caps its own window (pair +-2 bars) at its extreme. A fold from the body side can
    // land a long wick up to the fold depth past the cap; inside a band that depth is at most half the
    // band, so the folded wick can never rise over the swing (seen as S10 seed 752 without this cap).
    this.wps.forEach(function (w) {
      if (w.kind === 'high') cons.push({ from: w.bar - 2, to: w.bar + 3, lo: null, hi: rt(w.price + TICK) });
      if (w.kind === 'low') cons.push({ from: w.bar - 2, to: w.bar + 3, lo: rt(w.price - TICK), hi: null });
    });
    this.lint(n);
    var cs = G.path(this.r, this.wps.map(function (w) { return { bar: w.bar, price: w.price, kind: w.kind }; }),
      { bars: n, vol: this.u, wick: 0.5 * this.u, chop: this.chop, tick: TICK });
    this.cs = G.guard(cs, segments(this.cons, n));
    this.sw = SW.find(this.cs);
    return this.cs;
  };
  // the rule swing a scripted high/low became: {i (wick bar), price, k (pair start), side}
  SP.pt = function (name) {
    var w = this.by[name];
    var list = w.kind === 'high' ? this.sw.highs : this.sw.lows;
    for (var q = 0; q < list.length; q++) {
      if (list[q].pair[0] === w.bar && list[q].price === w.price) return { i: list[q].i, price: w.price, k: w.bar, side: w.kind };
    }
    throw new Error(this.id + ': scripted ' + w.kind + ' ' + name + ' at bar ' + w.bar + ' was lost');
  };

  // ---------------------------------------------------------------- shared scripting

  // Post-sweep reversal prices (long space). top = x of the highest level the sweep takes (the HL holds
  // above it), sw = x of the sweep extreme. Shape A: a pre-sweep high H0 is the H the HH must clear and
  // H1 is a minor lower high; shapes B/C: H1 is that H. M = first low after H1 (HL in C), P = pullback low
  // after the HH = the D2 entry pivot, T = default liquidity target above.
  function plan(sc, o) {
    var r = sc.r, q = {};
    q.M = o.top + r.range(0.3, 0.7);
    q.P = q.M + r.range(0.25, 0.6);
    if (o.shape === 'A') { q.H0 = q.M + r.range(2.6, 3.0); q.H1 = q.H0 - r.range(0.5, 0.8); }
    else q.H1 = Math.max(o.sw + 2.6, q.M + 2.6) + r.range(0, 0.4);
    q.HH = Math.max(q.P + 2.6, (o.shape === 'A' ? q.H0 : q.H1) + r.range(0.4, 1.0), o.minHH || -Infinity) + r.range(0, 0.5);
    q.T = q.HH + r.range(1.0, 1.6);
    return q;
  }

  // Place H1, M, HH, P after the sweep low 'SW', then the outcome leg (D4), with the bands that keep the
  // truth: the sweep low holds to the HH, the HH is the first break of the H, the pullback stays between
  // P and the HH, the target (a named long-space high) stays untaken until the run (win) or for good (fail).
  // o: {shape, outcome, target, gap:[lo,hi], run:[lo,hi]}
  function reverse(sc, q, o) {
    var r = sc.r, g = o.gap || [5, 8], run = o.run || [8, 14];
    var s = sc.B('SW');
    sc.go('H1', q.H1, 'high', g[0], g[1]);
    sc.go('M', q.M, 'low', g[0], g[1]);
    sc.go('HH', q.HH, 'high', g[0], g[1]);
    sc.go('P', q.P, 'low', g[0], g[1]);
    var hh = sc.B('HH'), p = sc.B('P');
    sc.keep(s + 2, hh + 1, 'SW', null);                                // through the HH pair: its wicks too
    if (o.shape === 'A') sc.keep(sc.B('H0') + 2, hh - 1, null, 'H0');
    else sc.keep(sc.B('H1') + 2, hh - 1, null, 'H1');
    sc.keep(sc.B('M') + 2, hh + 1, 'M', null);
    sc.keep(hh + 2, p - 1, 'P', null);
    sc.keep(hh + 2, p + 1, null, 'HH');                                 // the pivot pair stays under the HH too
    if (o.outcome === 'fail') {
      sc.go('B2', q.P + r.range(1.6, 2.1), 'high', g[0], g[1]);          // weak bounce under the HH
      sc.go('F', sc.X('SW') - r.range(0.5, 1.5), 'low', g[0], g[1] + 2);  // back through the sweep extreme
      sc.keep(p + 2, sc.B('F') - 1, 'SW', null);
      sc.keep(hh + 2, END, null, 'HH');
      sc.keep(sc.B(o.target) + 2, END, null, o.target);
      sc.go(null, sc.X('F') + r.range(0.6, 1.6), 'pass', 3, 5);
    } else {
      sc.go('R', sc.X(o.target) + r.range(0.4, 1.0), 'high', run[0], run[1]);
      var R = sc.B('R');
      sc.keep(p + 2, R - 1, 'P', null);
      sc.keep(sc.B(o.target) + 2, R - 1, null, o.target);
      sc.go(null, sc.X('R') - r.range(1.0, 2.2), 'pass', 4, 7);
    }
  }

  // ---------------------------------------------------------------- time

  var DAY_MS = 86400000;
  function ymd(ms) { var d = new Date(ms); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), dow: d.getUTCDay(), ms: ms }; }
  function pickDay(r, dows) {
    var ms = Date.UTC(2026, 0, 5) + r.int(0, 290) * DAY_MS;
    while (dows.indexOf(new Date(ms).getUTCDay()) < 0) ms += DAY_MS;
    return ymd(ms);
  }
  function addDays(d, k) { return ymd(d.ms + k * DAY_MS); }
  function et(d, h, mi) { return SS.etToUtc(d.y, d.mo, d.d, h, mi || 0); }
  function span(t0, count, tf) { var out = []; for (var i = 0; i < count; i++) out.push(t0 + i * tf * 60); return out; }

  // One 5m chart around a NY open: the sweep lands near 09:30 ET, all inside one futures day.
  function nyTimes(r, n, sweepBar) {
    var D = pickDay(r, [1, 2, 3, 4, 5]);
    var start = et(D, 9, 30) - (sweepBar + r.int(-6, 6)) * 300;
    start = Math.max(start, et(addDays(D, -1), 18, 0));
    start = Math.min(start, et(D, 16, 55) - (n - 1) * 300);
    return span(start, n, 5);
  }
  // Session day: Asia 18:00 ET on calendar day d0 -> NY 12:00 ET the next day. Window bars inclusive.
  function sessionDay(d0, tf, offset) {
    var per = 60 / tf, o = offset || 0;
    return {
      times: span(et(d0, 18, 0), 18 * per, tf),
      asia: [o, o + 9 * per - 1], london: [o + 9 * per, o + 14.5 * per - 1],
      pre: [o + 14.5 * per, o + 15.5 * per - 1], ny: [o + 15.5 * per, o + 18 * per - 1]
    };
  }
  // three futures days 18:00 -> 16:55 ET at 5m (276 bars each), starting on calendar day d0
  function threeDays(d0) {
    var t = [];
    for (var k = 0; k < 3; k++) t = t.concat(span(et(addDays(d0, k), 18, 0), 276, 5));
    return t;
  }
  // 4H bucket j (0..5) of futures day d in a threeDays series -> [first bar, last bar]
  function bucket(d, j) { var a = d * 276 + j * 48; return [a, Math.min(a + 47, d * 276 + 275)]; }
  // trading days (Mon-Fri) as daily candles stamped at the 18:00 ET open of each futures day
  function dailyTimes(r, n) {
    var ms = Date.UTC(2025, 5, 2) + r.int(0, 364) * DAY_MS, out = [];
    while (new Date(ms).getUTCDay() !== 1) ms += DAY_MS;
    while (out.length < n) {
      var d = ymd(ms);
      if (d.dow >= 1 && d.dow <= 5) out.push(et(addDays(d, -1), 18, 0));
      ms += DAY_MS;
    }
    return out;
  }

  // A 4H swing scripted on the 5m series (long space): bucket A then B form the two-candle pair
  // (F2.1/F2.2 on the 4H rollup). Pass closes fix each bucket's open/close; one 5m swing holds the extreme
  // and bands keep every other 5m candle of both buckets inside it. kind 'low' = long-space low.
  function htf4(sc, name, A, B, x, kind) {
    var r = sc.r, s = kind === 'low' ? 1 : -1;   // +1: closes sit above a low
    sc.at(null, A[0] - 1, x + s * r.range(2.5, 4.0), 'pass');
    var a1 = x + s * r.range(0.8, 1.6);
    sc.at(null, A[1], a1, 'pass');
    sc.at(null, B[1], a1 + s * r.range(1.0, 2.5), 'pass');
    var k = r.chance(0.5) ? r.int(A[0] + 6, A[1] - 5) : r.int(B[0] + 4, B[1] - 6);
    sc.at(name, k, x, kind);
    if (kind === 'low') sc.keep(A[0], k - 1, name, null); else sc.keep(A[0], k - 1, null, name);
    return k;
  }

  // ---------------------------------------------------------------- truth

  var LABEL = {
    liq: { high: 'liquidity high', low: 'liquidity low' }, stack: { high: 'stacked high', low: 'stacked low' },
    htf: { high: '4H high', low: '4H low' }
  };
  function lev(sc, id, kind, name, extra) {
    var p = sc.pt(name), e = extra || {};
    var l = { id: id, kind: kind, label: e.label || (LABEL[kind] ? LABEL[kind][p.side] : id), price: p.price, bar: p.i,
              side: p.side, known: e.known != null ? e.known : p.k + 2, sweptAt: null,
              resistance: null, resistanceAfter: null };      // set by finish (resistanceOf)
    if (e.group) l.group = e.group;
    if (e.session) l.session = e.session;
    return l;
  }
  function box(cs, name, w) {
    var hi = -Infinity, lo = Infinity;
    for (var j = w[0]; j <= w[1]; j++) { if (cs[j].h > hi) hi = cs[j].h; if (cs[j].l < lo) lo = cs[j].l; }
    return { name: name, from: w[0], to: w[1], high: hi, low: lo };
  }
  function mpt(sc, name) { var p = sc.pt(name); return { bar: p.i, price: p.price, type: p.side }; }

  // The levels price reversed away from: on the swept level's side, taken between the sweep and the confirm swing.
  function reversedFrom(levels, side, from, to) {
    return levels.filter(function (l) { return l.side === side && l.sweptAt != null && l.sweptAt >= from && l.sweptAt <= to; });
  }
  // Controller ruling (fix round 1): resistance = the state before the level is swept: 'low' for a level of a
  // stacked group (untaken stack, F8.1), else null. resistanceAfter = 'high' for a level price reversed away from
  // with a confirmed reversal (F8.6: the trade has a confirmBar), else = resistance.
  function resistanceOf(levels, sweepSide, sweepBar, confirmBar) {
    var away = confirmBar != null ? reversedFrom(levels, sweepSide, sweepBar, confirmBar) : [];
    return levels.map(function (l) {
      var before = l.group ? 'low' : null;
      return [before, away.indexOf(l) >= 0 ? 'high' : before];
    });
  }

  // Assemble the built scenario. o: {levels, sweepIds, structure:[[name, longTag]], side, target (level id),
  // outcome, sessions, times, near:[a,b], poke:[name, levelId], htf, notes(truth) -> [[bar, fact, text]]}
  function finish(d, seed, sc, o) {
    var cs = sc.cs, n = cs.length;
    o.levels.forEach(function (l) { l.sweptAt = firstThrough(cs, l.bar + 1, l.side, l.price); });
    var first = null;
    o.levels.forEach(function (l) {
      if (l.sweptAt == null) return;
      if (!first || l.sweptAt < first.sweptAt ||
          (l.sweptAt === first.sweptAt && (l.side === 'low' ? l.price < first.price : l.price > first.price))) first = l;
    });
    if (!first || o.sweepIds.indexOf(first.id) < 0) {
      throw new Error(d.id + ': first sweep is ' + (first && first.id) + ', expected one of ' + o.sweepIds.join(','));
    }
    var sweep = { bar: first.sweptAt, levelId: first.id };
    var structure = (o.structure || []).map(function (s) {
      var p = sc.pt(s[0]);
      return { bar: p.i, price: p.price, tag: sc.dir > 0 ? s[1] : MIRROR[s[1]], known: p.k + 2 };
    });
    var confirmBar = null, win = null, target = null;
    if (o.side) {
      var long = o.side === 'long', ct = long ? 'HH' : 'LL';
      var c = structure.filter(function (p) { return p.tag === ct && p.bar > sweep.bar; })[0];
      confirmBar = c.bar;
      var ext = long ? Infinity : -Infinity;
      for (var j = sweep.bar; j <= confirmBar; j++) ext = long ? Math.min(ext, cs[j].l) : Math.max(ext, cs[j].h);
      var from = c.known, to = n - 1;
      for (j = from; j < n; j++) {
        if (long ? cs[j].h > c.price : cs[j].l < c.price) { to = j - 1; break; }
      }
      if (to === n - 1) {
        for (j = from; j < n; j++) if (long ? cs[j].l < ext : cs[j].h > ext) { to = j - 1; break; }
      }
      win = { from: from, to: to };
      var tl = o.levels.filter(function (l) { return l.id === o.target; })[0];
      target = { price: tl.price, levelId: tl.id };
    }
    resistanceOf(o.levels, first.side, sweep.bar, confirmBar).forEach(function (r, i) {
      o.levels[i].resistance = r[0]; o.levels[i].resistanceAfter = r[1];
    });
    var stamped = cs.map(function (k, i) { return { t: o.times[i], o: k.o, h: k.h, l: k.l, c: k.c }; });
    var truth = {
      side: o.side || null, outcome: o.side ? o.outcome : null, levels: o.levels, sweep: sweep,
      structure: structure, confirmBar: confirmBar, entryWindow: win, target: target,
      sessions: (o.sessions || []).map(function (s) { return box(cs, s[0], s[1]); }), notes: []
    };
    truth.notes = o.notes(truth, cs).map(function (x) { return { bar: x[0], fact: x[1], text: x[2] }; });
    var meta = { id: d.id, instrument: d.instrument, tf: d.tf, tick: TICK, seed: seed, vol: sc.u, chop: sc.chop,
                 mess: { nearEqual: [mpt(sc, o.near[0]), mpt(sc, o.near[1])],
                         poke: (function () { var p = mpt(sc, o.poke[0]); p.levelId = o.poke[1]; return p; })() } };
    if (o.htf) meta.htf = o.htf;
    return { candles: stamped, meta: meta, truth: truth };
  }

  // ---------------------------------------------------------------- notes

  function reachBar(cs, T) {
    var L = T.side === 'long';
    for (var j = T.entryWindow.from; j < cs.length; j++) if (L ? cs[j].h >= T.target.price : cs[j].l <= T.target.price) return j;
    return cs.length - 1;
  }
  function failBar(cs, T) {
    var L = T.side === 'long', ext = L ? Infinity : -Infinity, j;
    for (j = T.sweep.bar; j <= T.confirmBar; j++) ext = L ? Math.min(ext, cs[j].l) : Math.max(ext, cs[j].h);
    for (j = T.entryWindow.from; j < cs.length; j++) if (L ? cs[j].l < ext : cs[j].h > ext) return j;
    return cs.length - 1;
  }
  function swept(T, id) { return T.levels.filter(function (l) { return l.id === id; })[0].sweptAt; }
  // Generic trade-note texts. Each one paraphrases every fact it may be cited with:
  //   sweep  - long: F6.3 (do not blindly buy when a low is taken, drawdown); short: F6.4 (no blind sell above a
  //            high, wait for confirmation; F6.3 only speaks of buying)
  //   confirm - F6.5 / F6.6 / F7.14 (long), F6.8 / F6.9 (short): the new trend's structure forms
  //   entry  - F6.5 / F6.6 / F6.8 / F6.9 / F7.14: entry on the pullback after the structure
  //   target - F8.4: liquidity acts as the price target (where positions are closed)
  var NOTE = {
    sweep: { long: ['F6.3', 'ราคาลงกวาด low แล้ว — อย่าเพิ่งกด buy ทันที ถ้าราคายังลงต่อจะติด drawdown'],
             short: ['F6.4', 'ราคาขึ้นกวาด high แล้ว — ไม่ sell เหนือ high แบบไม่คิด ต้องรอ confirmation ก่อน'] },
    confirm: { long: 'HH เกิดแล้ว: เทรนด์ขาขึ้นใหม่เริ่มก่อตัว (confirmation)', short: 'LL เกิดแล้ว: เทรนด์ขาลงใหม่เริ่มก่อตัว (confirmation)' },
    entry: 'ช่วง pullback หลังโครงสร้างยืนยัน = จุดเข้า (entry) ตามคลิป — จุดเข้าแบบเป๊ะ ๆ: คลิปไม่ได้ระบุ',
    target: { long: 'ราคาวิ่งขึ้นถึง liquidity ด้านบน — liquidity เป็นเป้าราคา (ที่ปิดกำไร) ได้',
              short: 'ราคาลงถึง liquidity ด้านล่าง — liquidity เป็นเป้าราคา (ที่ปิดกำไร) ได้' },
    fail: ['F9.2', 'setup ล้ม: ราคากลับไปทะลุจุด sweep — วิธีจัดการเมื่อ confirmation ล้ม: คลิปไม่ได้ระบุ']
  };
  // f: {sweep, confirm, entry, target, more(T, cs) -> extra notes}. A slot is a fact id (that fact with the
  // slot's generic text) or [fact, text] for a scenario-specific paraphrase (sweep: [fact, text] only, since its
  // generic text belongs to F6.3 / F6.4). sweep defaults to F6.3 / F6.4,
  // entry to the confirm fact, target to F8.4; confirm is required.
  function tradeNotes(f) {
    return function (T, cs) {
      var side = T.side;
      function slot(v, text) { return typeof v === 'string' ? [v, text] : v; }
      var c = slot(f.confirm, NOTE.confirm[side]);
      var out = [
        [T.sweep.bar].concat(f.sweep || NOTE.sweep[side]),
        [T.confirmBar].concat(c),
        [T.entryWindow.from].concat(slot(f.entry || c[0], NOTE.entry))
      ];
      if (T.outcome === 'win') out.push([reachBar(cs, T)].concat(slot(f.target || 'F8.4', NOTE.target[side])));
      else out.push([failBar(cs, T)].concat(NOTE.fail));
      return out.concat(f.more ? f.more(T, cs) : []);
    };
  }

  // ---------------------------------------------------------------- scenarios S01-S07

  // S01 bullish (F6.5): rising near-equal lows swept -> H, L, HL, HH -> entry on the pullback -> up.
  function S01(d, seed, outcome) {
    var sc = new Script(d.id, seed, d.salt, 'NQ', 5, 1), r = sc.r;
    var L2 = r.range(0.12, 0.4), L3 = L2 + r.range(0.12, 0.4), SWx = -r.range(0.8, 1.5);
    var q = plan(sc, { shape: 'A', top: L3, sw: SWx });
    sc.at(null, 0, q.T - r.range(1.2, 2.0));
    sc.at('T', r.int(4, 7), q.T, 'high');                       // liquidity high above = target
    sc.go('L1', 0, 'low');
    sc.go('A1', sc.near('T', r.int(1, 4)), 'high');              // false poke a few ticks under T
    sc.go('L2', L2, 'low');
    sc.go('A2', q.T - r.range(0.5, 1.0), 'high');
    sc.go('L3', L3, 'low');
    sc.go('H0', q.H0, 'high');                                  // the H the HH must clear
    sc.go('SW', SWx, 'low', 6, 9);
    ['L1', 'L2', 'L3'].forEach(function (nm) { sc.keep(sc.B(nm) + 2, sc.B('SW') - 1, nm, null); });
    sc.keep(0, sc.B('T') - 1, null, 'T');
    reverse(sc, q, { shape: 'A', outcome: outcome, target: 'T' });
    var n = sc.bar + 2;
    sc.run(n);
    var g = { group: 'lows' };
    return finish(d, seed, sc, {
      levels: [lev(sc, 'L1', 'stack', 'L1', g), lev(sc, 'L2', 'stack', 'L2', g), lev(sc, 'L3', 'stack', 'L3', g), lev(sc, 'T', 'liq', 'T')],
      sweepIds: ['L1', 'L2', 'L3'], structure: [['H0', 'H'], ['SW', 'L'], ['M', 'HL'], ['HH', 'HH'], ['P', 'HL']],
      side: 'long', target: 'T', outcome: outcome, times: nyTimes(r, n, sc.B('SW')),
      near: ['L1', 'L2'], poke: ['A1', 'T'], notes: tradeNotes({ confirm: 'F6.5', target: 'F8.4' })
    });
  }

  // S02 bullish deep sweep (F6.6, F5.4): a long drop takes low after low, then above a high, HH, HL.
  function S02(d, seed, outcome) {
    var sc = new Script(d.id, seed, d.salt, 'NQ', 5, 1), r = sc.r;
    var L2 = r.range(0.8, 1.4), L3 = L2 + r.range(0.8, 1.4), SWx = -r.range(2.0, 3.0);
    var q = plan(sc, { shape: 'B', top: L3 + 4 * TICK / sc.u, sw: SWx });
    sc.at(null, 0, q.T - r.range(1.0, 1.8));
    sc.at('T', r.int(4, 7), q.T, 'high');
    sc.go('L1', 0, 'low');
    sc.go('a1', r.range(2.6, 3.0), 'high');
    sc.go('L2', L2, 'low');
    sc.go('a2', L2 + r.range(2.6, 3.0), 'high');
    sc.go('L3', L3, 'low');
    sc.go('a3', L3 + r.range(2.6, 3.0), 'high');
    sc.go('L4', sc.near('L3', r.int(1, 4)), 'low');             // false poke: a hair above L3
    sc.go('a4', sc.X('L4') + r.range(2.6, 3.0), 'high');
    sc.go('SW', SWx, 'low', 10, 14);                            // the deep low after the run
    var a4 = sc.B('a4');
    ['L1', 'L2', 'L3', 'L4'].forEach(function (nm) { sc.keep(sc.B(nm) + 2, a4 + 1, nm, null); });
    sc.keep(a4 + 2, sc.B('SW') - 1, 'SW', 'a4');
    sc.keep(0, sc.B('T') - 1, null, 'T');
    reverse(sc, q, { shape: 'B', outcome: outcome, target: 'T' });
    var n = sc.bar + 2;
    sc.run(n);
    var g = { group: 'lows' };
    return finish(d, seed, sc, {
      levels: ['L1', 'L2', 'L3', 'L4'].map(function (nm) { return lev(sc, nm, 'stack', nm, g); }).concat([lev(sc, 'T', 'liq', 'T')]),
      sweepIds: ['L1', 'L2', 'L3', 'L4'], structure: [['SW', 'L'], ['H1', 'H'], ['HH', 'HH'], ['P', 'HL']],
      side: 'long', target: 'T', outcome: outcome, times: nyTimes(r, n, sc.B('a4') + 4),
      near: ['L3', 'L4'], poke: ['L4', 'L3'],
      notes: tradeNotes({ confirm: 'F6.6', more: function (T) {
        return [[T.sweep.bar + 1, 'F6.6', 'ราคาลงลึกจนน่ากลัว ไม่ต้องกด buy — เรายังไม่รู้ว่า buy orders จะถูกเติมไหม'],
                [T.confirmBar, 'F5.4', 'ย้อนดู: การทิ้งตัวแรงที่กิน low ทีละตัว ก็เพื่อดันราคาขึ้นต่อ']];
      } })
    });
  }

  // S03 bearish (F6.8, F6.9): the S01-style script mirrored: highs swept -> H, L, LL, LH -> entry -> down.
  function S03(d, seed, outcome) {
    var sc = new Script(d.id, seed, d.salt, 'ES', 5, -1), r = sc.r;
    var L2 = r.range(0.12, 0.4), SWx = -r.range(0.6, 1.3);
    var q = plan(sc, { shape: 'B', top: L2, sw: SWx });
    sc.at(null, 0, q.T - r.range(1.2, 2.0));
    sc.at('T', r.int(4, 7), q.T, 'high');
    sc.go('L1', 0, 'low');
    sc.go('A1', sc.near('T', r.int(1, 4)), 'high');
    sc.go('L2', L2, 'low');
    sc.go('A2', L2 + r.range(2.6, 3.0), 'high');
    sc.go('SW', SWx, 'low', 6, 9);
    ['L1', 'L2'].forEach(function (nm) { sc.keep(sc.B(nm) + 2, sc.B('SW') - 1, nm, null); });
    sc.keep(0, sc.B('T') - 1, null, 'T');
    reverse(sc, q, { shape: 'B', outcome: outcome, target: 'T' });
    var n = sc.bar + 2;
    sc.run(n);
    var g = { group: 'highs' };
    return finish(d, seed, sc, {
      levels: [lev(sc, 'SH1', 'stack', 'L1', g), lev(sc, 'SH2', 'stack', 'L2', g), lev(sc, 'T', 'liq', 'T')],
      sweepIds: ['SH1', 'SH2'], structure: [['SW', 'L'], ['H1', 'H'], ['HH', 'HH'], ['P', 'HL']],
      side: 'short', target: 'T', outcome: outcome, times: nyTimes(r, n, sc.B('SW')),
      near: ['L1', 'L2'], poke: ['A1', 'T'],
      notes: tradeNotes({ confirm: 'F6.8', entry: 'F6.9' })
    });
  }

  // S04 sweep with no reversal (F6.3, F5.5): lows taken, a dead-cat bounce, then lower lows. No trade.
  function S04(d, seed) {
    var sc = new Script(d.id, seed, d.salt, 'NQ', 5, 1), r = sc.r;
    sc.at(null, 0, r.range(2.0, 3.0));
    sc.at('L1', r.int(4, 7), 0, 'low');
    sc.go('a1', r.range(2.6, 3.0), 'high');
    sc.go('L2', sc.near('L1', r.int(1, 4)), 'low');
    sc.go('a2', sc.X('L2') + r.range(2.6, 3.0), 'high');
    sc.go('L3', sc.X('L2') + r.range(0.2, 0.5), 'low');
    sc.go('a3', sc.X('L3') + r.range(2.6, 3.0), 'high');
    sc.go('SW', -r.range(0.8, 1.4), 'low', 6, 9);
    sc.go('h', sc.X('SW') + r.range(2.6, 3.0), 'high');         // bounce that never makes a HH
    sc.go('LL', sc.X('SW') - r.range(1.0, 2.0), 'low');
    sc.go('lh', sc.X('LL') + r.range(2.6, 3.0), 'high');
    sc.go('LL2', sc.X('LL') - r.range(1.0, 2.0), 'low');
    sc.go(null, sc.X('LL2') + r.range(0.8, 1.6), 'pass', 3, 5);
    var s = sc.B('SW');
    ['L1', 'L2', 'L3'].forEach(function (nm) { sc.keep(sc.B(nm) + 2, s - 1, nm, null); });
    sc.keep(s + 2, sc.B('LL') - 1, 'SW', 'a3');
    sc.keep(sc.B('h') + 2, END, null, 'h');
    sc.keep(sc.B('LL') + 2, sc.B('LL2') - 1, 'LL', null);
    sc.keep(sc.B('lh') + 2, END, null, 'lh');
    var n = sc.bar + 2;
    sc.run(n);
    var g = { group: 'lows' };
    return finish(d, seed, sc, {
      levels: ['L1', 'L2', 'L3'].map(function (nm) { return lev(sc, nm, 'stack', nm, g); }),
      sweepIds: ['L1', 'L2', 'L3'], structure: [['SW', 'L'], ['h', 'H'], ['LL', 'LL'], ['lh', 'LH'], ['LL2', 'LL']],
      side: null, times: nyTimes(r, n, s), near: ['L1', 'L2'], poke: ['L2', 'L1'],
      notes: function (T) {
        var ll = T.structure[2].bar;
        return [
          [T.sweep.bar, 'F6.3', 'ถ้ากด buy ทันทีที่ low โดนกวาด ราคายังลงต่อ — ติด drawdown'],
          [ll, 'F6.2', 'ไม่มีเทรนด์ขาขึ้นใหม่ก่อตัว = ไม่มี confirmation จึงไม่มีเทรด'],
          [T.structure[4].bar, 'F5.5', 'ทะลุ low ไม่ได้แปลว่าจะกลับตัวเสมอ — มันเป็นแค่โอกาส']
        ];
      }
    });
  }

  // S05 daily (F5.3): relatively equal highs run (fake-out) and dumped, then the equal lows run, then up.
  function S05(d, seed) {
    var sc = new Script(d.id, seed, d.salt, 'NQ', 1440, 1), r = sc.r;
    var E1 = r.range(3.8, 4.4);
    sc.at(null, 0, r.range(1.2, 2.0));
    sc.at('D1', r.int(5, 8), 0, 'low');
    sc.go('E1', E1, 'high');
    sc.go('D2', r.range(0.06, 0.2), 'low');
    sc.go('E2', E1 - r.range(0.06, 0.2), 'high');
    sc.go('m1', sc.X('D2') + r.range(0.4, 0.8), 'low');
    sc.go('X', E1 + r.range(0.4, 1.0), 'high');
    sc.go('m2', sc.X('X') - r.range(2.6, 3.0), 'low');
    sc.go('n2', Math.max(sc.X('D2') + 2.6, sc.X('m2') + 0.8) + r.range(0, 0.2), 'high');
    sc.go('Z', -r.range(0.4, 1.0), 'low');
    sc.go(null, E1 - r.range(0.3, 1.0), 'pass', 8, 12);
    var sX = sc.B('X'), sZ = sc.B('Z');
    sc.keep(sc.B('D1') + 2, sZ - 1, 'D1', null);
    sc.keep(sc.B('D2') + 2, sZ - 1, 'D2', null);
    sc.keep(sc.B('E1') + 2, sX - 1, null, 'E1');
    sc.keep(sc.B('E2') + 2, sX - 1, null, 'E2');
    sc.keep(sX + 2, END, null, 'X');
    sc.keep(sZ + 2, END, 'Z', null);
    var n = sc.bar + 2;
    sc.run(n);
    var eh = { group: 'eqh', label: 'equal high' }, el = { group: 'eql', label: 'equal low' };
    return finish(d, seed, sc, {
      levels: [lev(sc, 'E1', 'liq', 'E1', eh), lev(sc, 'E2', 'liq', 'E2', eh), lev(sc, 'D1', 'liq', 'D1', el), lev(sc, 'D2', 'liq', 'D2', el)],
      sweepIds: ['E1', 'E2'], structure: [], side: null, times: dailyTimes(r, n),
      near: ['E1', 'E2'], poke: ['E2', 'E1'],
      notes: function (T) {
        return [
          [T.sweep.bar, 'F5.3', 'ราคาวิ่งทะลุ equal highs (fake-out) คนแห่กด buy แล้วราคาทิ้งตัว'],
          [Math.min(swept(T, 'D1'), swept(T, 'D2')), 'F5.3', 'แบบเดียวกันด้านล่าง: กวาด equal lows ก่อนราคาจะขึ้น']
        ];
      }
    });
  }

  // S06 session day A (F7.10, F7.12): previous NY session, then Asia range; London takes the Asia low and
  // rises; NY takes the London low, then the Asia high and the previous-day high.
  function S06(d, seed) {
    var sc = new Script(d.id, seed, d.salt, 'NQ', 5, 1), r = sc.r;
    var d0 = pickDay(r, [1, 2, 3, 4]), day = sessionDay(d0, 5, 90);
    var times = span(et(d0, 9, 30), 90, 5).concat(day.times), n = times.length;
    var A = day.asia, Lw = day.london, N = day.ny;
    var AH = r.range(2.8, 3.6), PDH = AH + r.range(1.2, 2.0), LoL = -r.range(0.5, 1.0);
    var LoH = LoL + 2.6 + r.range(0.05, 0.95) * (AH - 0.3 - LoL - 2.6);
    sc.at(null, 0, PDH - r.range(1.5, 2.5));
    sc.at('PDH', r.int(20, 50), PDH, 'high');
    sc.go('pl', PDH - r.range(2.6, 3.2), 'low');
    sc.at(null, 75, r.range(1.0, 2.0), 'pass');
    sc.at('AL', A[0] + r.int(10, 25), 0, 'low');
    sc.at('AH', sc.B('AL') + r.int(12, 30), AH, 'high');
    sc.at('AL2', sc.B('AH') + r.int(8, 20), sc.near('AL', r.int(1, 4)), 'low');   // Asia low retested, holds
    sc.at('SW1', Lw[0] + r.int(6, 20), LoL, 'low');                               // London takes the Asia low
    sc.at('LoH', sc.B('SW1') + r.int(15, 35), LoH, 'high');
    sc.at(null, day.pre[0] + r.int(3, 8), LoL + r.range(0.8, 1.6), 'pass');
    sc.at('SW2', N[0] + r.int(1, 5), LoL - r.range(0.5, 1.2), 'low');            // NY takes the London low
    sc.at('R', N[0] + r.int(23, 27), PDH + r.range(0.3, 0.8), 'high');            // through Asia high and PDH
    var b = function (nm) { return sc.B(nm); };
    sc.keep(0, b('PDH') - 1, null, 'PDH');
    sc.keep(b('PDH') + 2, b('R') - 1, null, 'PDH');
    sc.keep(A[0], b('AL') - 1, 'AL', null);
    sc.keep(b('AL') + 2, b('SW1') - 1, 'AL', null);
    sc.keep(A[0], b('AH') - 1, null, 'AH');
    sc.keep(b('AH') + 2, b('SW2') + 1, null, 'AH');
    sc.keep(Lw[0], b('LoH') - 1, null, 'LoH');
    sc.keep(b('LoH') + 2, Lw[1], null, 'LoH');
    sc.keep(b('SW1') + 2, b('SW2') - 1, 'SW1', null);
    sc.keep(b('SW2') + 2, b('R') - 1, 'SW2', null);
    sc.fill(A[0], A[1], 0, AH);
    sc.fill(Lw[0], Lw[1], 0, LoH);
    sc.run(n);
    var ny = [N[0], n - 1];
    return finish(d, seed, sc, {
      levels: [
        lev(sc, 'pdh', 'pdh', 'PDH', { label: 'PDH', known: 89 }),
        lev(sc, 'asia-high', 'session', 'AH', { label: 'Asia high', session: 'asia', known: A[1] }),
        lev(sc, 'asia-low', 'session', 'AL', { label: 'Asia low', session: 'asia', known: A[1] }),
        lev(sc, 'london-high', 'session', 'LoH', { label: 'London high', session: 'london', known: Lw[1] }),
        lev(sc, 'london-low', 'session', 'SW1', { label: 'London low', session: 'london', known: Lw[1] })
      ],
      sweepIds: ['asia-low'], structure: [], side: null, times: times,
      sessions: [['asia', A], ['london', Lw], ['ny', ny]], near: ['AL', 'AL2'], poke: ['AL2', 'asia-low'],
      notes: function (T) {
        return [
          [T.sweep.bar, 'F7.10', 'London เปิดแล้วกวาด Asia low ก่อนจะขยับขึ้น'],
          [swept(T, 'london-low'), 'F7.10', 'NY เปิด ราคาลงกวาด London low'],
          [swept(T, 'pdh'), 'F7.12', 'จากนั้นวิ่งขึ้นเก็บ Asia high และ previous-day high']
        ];
      }
    });
  }

  // S07 session day B (F7.13): London high/low marked; NY pre-market takes the London low; up all day.
  function S07(d, seed) {
    var sc = new Script(d.id, seed, d.salt, 'NQ', 5, 1), r = sc.r;
    var d0 = pickDay(r, [1, 2, 3, 4]), day = sessionDay(d0, 5, 0), A = day.asia, Lw = day.london;
    var n = day.times.length, LoH = r.range(3.0, 3.6);
    sc.at(null, 0, r.range(0.5, 2.5));
    sc.at('LoH', Lw[0] + r.int(6, 18), LoH, 'high');
    sc.at('LoL', sc.B('LoH') + r.int(10, 22), 0, 'low');
    sc.at('LoH2', sc.B('LoL') + r.int(8, 16), sc.near('LoH', r.int(1, 4)), 'high');
    sc.at('SW', day.pre[0] + r.int(0, 2), -r.range(0.5, 1.2), 'low');
    sc.go('h1', Math.min(sc.X('SW') + r.range(2.6, 3.0), LoH - 0.3), 'high', 6, 9);
    sc.go('hl', r.range(0.0, 0.3), 'low');
    sc.go('R', LoH + r.range(0.5, 1.5), 'high', 10, 14);
    sc.go(null, sc.X('R') - r.range(1.0, 2.0), 'pass', 4, 7);
    var b = function (nm) { return sc.B(nm); };
    sc.keep(Lw[0], b('LoH') - 1, null, 'LoH');
    sc.keep(b('LoH') + 2, b('R') - 1, null, 'LoH');
    sc.keep(Lw[0], b('LoL') - 1, 'LoL', null);
    sc.keep(b('LoL') + 2, b('SW') - 1, 'LoL', null);
    sc.keep(b('SW') + 2, END, 'SW', null);
    sc.keep(b('hl') + 2, END, 'hl', null);
    sc.fill(A[0], A[1] - 6, -0.8, LoH + 0.8);
    sc.fill(Lw[0], Lw[1], 0, LoH);
    sc.run(n);
    return finish(d, seed, sc, {
      levels: [
        lev(sc, 'london-high', 'session', 'LoH', { label: 'London high', session: 'london', known: Lw[1] }),
        lev(sc, 'london-low', 'session', 'LoL', { label: 'London low', session: 'london', known: Lw[1] })
      ],
      sweepIds: ['london-low'], structure: [['SW', 'L'], ['h1', 'H'], ['hl', 'HL'], ['R', 'HH']], side: null,
      times: day.times, sessions: [['asia', A], ['london', Lw], ['ny', day.ny]],
      near: ['LoH', 'LoH2'], poke: ['LoH2', 'london-high'],
      notes: function (T) {
        return [
          [T.sweep.bar, 'F7.13', 'NY pre-market เปิดปุ๊บ ราคากวาด London low'],
          [swept(T, 'london-high'), 'F7.13', 'จากนั้น NY เป็นขาขึ้นไปทั้งวัน']
        ];
      }
    });
  }

  // ---------------------------------------------------------------- scenarios S08-S14

  // S08 Monday (F7.15): Sunday 18:00 open; at the NY open a spike over the London high, then straight
  // under the London low, then up.
  function S08(d, seed) {
    var sc = new Script(d.id, seed, d.salt, 'NQ', 5, 1), r = sc.r;
    var d0 = pickDay(r, [0]), day = sessionDay(d0, 5, 0), A = day.asia, Lw = day.london;
    var n = day.times.length, LoH = r.range(2.8, 3.6);
    sc.at(null, 0, r.range(0.5, 2.5));
    sc.at('LoL', Lw[0] + r.int(6, 18), 0, 'low');
    sc.at('LoH', sc.B('LoL') + r.int(10, 22), LoH, 'high');
    sc.at('LoL2', sc.B('LoH') + r.int(8, 16), sc.near('LoL', r.int(1, 4)), 'low');
    sc.at('X1', day.ny[0] + r.int(0, 3), LoH + r.range(0.4, 1.0), 'high');
    sc.go('X2', -r.range(0.4, 1.0), 'low', 6, 10);
    sc.go(null, r.range(1.5, 2.5), 'pass', 10, 16);
    var b = function (nm) { return sc.B(nm); };
    sc.keep(Lw[0], b('LoL') - 1, 'LoL', null);
    sc.keep(b('LoL') + 2, b('X2') - 1, 'LoL', null);
    sc.keep(Lw[0], b('LoH') - 1, null, 'LoH');
    sc.keep(b('LoH') + 2, b('X1') - 1, null, 'LoH');
    sc.keep(b('X1') + 2, END, null, 'X1');
    sc.keep(b('X2') + 2, END, 'X2', null);
    sc.fill(A[0], A[1] - 6, -0.8, LoH + 0.8);
    sc.fill(Lw[0], day.pre[1], 0, LoH);
    sc.run(n);
    return finish(d, seed, sc, {
      levels: [
        lev(sc, 'london-high', 'session', 'LoH', { label: 'London high', session: 'london', known: Lw[1] }),
        lev(sc, 'london-low', 'session', 'LoL', { label: 'London low', session: 'london', known: Lw[1] })
      ],
      sweepIds: ['london-high'], structure: [['X1', 'H'], ['X2', 'L']], side: null,
      times: day.times, sessions: [['asia', A], ['london', Lw], ['ny', day.ny]],
      near: ['LoL', 'LoL2'], poke: ['LoL2', 'london-low'],
      notes: function (T) {
        return [
          [T.sweep.bar, 'F7.15', 'NY เปิด ราคาพุ่งขึ้นเหนือ London high ทันที'],
          [swept(T, 'london-low'), 'F7.15', 'แล้วทิ่มลงใต้ London low ก่อนตลาดจะขึ้น — ตลาดวิ่งหาเป้า session highs/lows']
        ];
      }
    });
  }

  // S09 LTF entry (F7.14), 1m: NY pre-market takes the London low -> L, H, HL, HH, HL -> entry -> London high.
  function S09(d, seed, outcome) {
    var sc = new Script(d.id, seed, d.salt, 'NQ', 1, 1), r = sc.r;
    var d0 = pickDay(r, [1, 2, 3, 4]), day = sessionDay(d0, 1, 0), A = day.asia, Lw = day.london;
    var n = day.times.length, SWx = -r.range(0.6, 1.3);
    var q = plan(sc, { shape: 'C', top: 0, sw: SWx });
    sc.at(null, 0, r.range(0.5, 3.0));
    sc.at('LoH', Lw[0] + r.int(20, 100), q.T, 'high');
    sc.at('LoL', sc.B('LoH') + r.int(40, 120), 0, 'low');
    sc.at('LoL2', sc.B('LoL') + r.int(30, 80), sc.near('LoL', r.int(1, 4)), 'low');
    sc.at('SW', day.pre[0] + r.int(0, 3), SWx, 'low');
    sc.keep(Lw[0], sc.B('LoH') - 1, null, 'LoH');
    sc.keep(Lw[0], sc.B('LoL') - 1, 'LoL', null);
    sc.keep(sc.B('LoL') + 2, sc.B('SW') - 1, 'LoL', null);
    reverse(sc, q, { shape: 'C', outcome: outcome, target: 'LoH', gap: [6, 12], run: [15, 40] });
    sc.fill(A[0], A[1] - 6, -1.0, q.T + 1.0);
    sc.fill(Lw[0], Lw[1], 0, q.T);
    sc.run(n);
    return finish(d, seed, sc, {
      levels: [
        lev(sc, 'london-high', 'session', 'LoH', { label: 'London high', session: 'london', known: Lw[1] }),
        lev(sc, 'london-low', 'session', 'LoL', { label: 'London low', session: 'london', known: Lw[1] })
      ],
      sweepIds: ['london-low'], structure: [['SW', 'L'], ['H1', 'H'], ['M', 'HL'], ['HH', 'HH'], ['P', 'HL']],
      side: 'long', target: 'london-high', outcome: outcome, times: day.times,
      sessions: [['asia', A], ['london', Lw], ['ny', day.ny]], near: ['LoL', 'LoL2'], poke: ['LoL2', 'london-low'],
      notes: tradeNotes({ sweep: ['F7.14', 'London low โดนกวาด — ไม่ได้แปลว่าให้กด buy ทันที ต้องรอสัญญาณว่าขาขึ้นกำลังก่อตัว'],
                             confirm: 'F7.14',
                             target: ['F7.12', 'ราคาขึ้นไปเก็บ London high — high/low ของ session ก่อนหน้าเป็นแม่เหล็ก liquidity'] })
    });
  }

  // S10 (F7.6): three 4H highs (stacked, from the 4H rollup) swept on day 3, seen on 5m; turn -> HTF move down.
  function S10(d, seed, outcome) {
    var sc = new Script(d.id, seed, d.salt, 'NQ', 5, -1), r = sc.r;
    var d0 = pickDay(r, [0, 1, 2]), times = threeDays(d0), n = times.length;
    var Q2 = r.range(0.3, 0.9), Q3 = Q2 + r.range(0.3, 0.9), SWx = -r.range(0.6, 1.4);
    var q = plan(sc, { shape: 'B', top: Q3, sw: SWx });
    var T = Math.max(q.T, Q3 + 5.5) + r.range(0, 1.5);
    sc.at(null, 0, T - r.range(2.0, 3.0));
    var kT = htf4(sc, 'T', bucket(0, 1), bucket(0, 2), T, 'high');
    var Q = [['Q1', bucket(0, 4), bucket(0, 5), 0], ['Q2', bucket(1, 1), bucket(1, 2), Q2], ['Q3', bucket(1, 4), bucket(1, 5), Q3]];
    Q.forEach(function (x) { htf4(sc, x[0], x[1], x[2], x[3], 'low'); });
    sc.at('PK', 552 + r.int(30, 120), sc.near('Q3', r.int(1, 4)), 'low');
    sc.at('A', sc.B('PK') + r.int(8, 30), Q3 + r.range(2.6, 3.2), 'high');
    sc.at('SW', 552 + 186 + r.int(0, 6), SWx, 'low');                  // day 3, NY open
    sc.keep(0, kT - 1, null, 'T');
    Q.forEach(function (x) { sc.keep(sc.B(x[0]) + 2, sc.B('SW') - 1, x[0], null); });
    reverse(sc, q, { shape: 'B', outcome: outcome, target: 'T', run: [20, 40] });
    sc.fill(1, sc.B('SW') - 8, Q3 + 0.8, T - 0.8);
    sc.run(n);
    var g = function (x) { return { group: 'htf4', known: x[2][1] + 1 }; };
    return finish(d, seed, sc, {
      levels: Q.map(function (x) { return lev(sc, x[0], 'htf', x[0], g(x)); })
        .concat([lev(sc, 'T', 'htf', 'T', { known: bucket(0, 2)[1] + 1 })]),
      sweepIds: ['Q1', 'Q2', 'Q3'], structure: [['SW', 'L'], ['H1', 'H'], ['HH', 'HH'], ['P', 'HL']],
      side: 'short', target: 'T', outcome: outcome, times: times, htf: 240,
      near: ['Q3', 'PK'], poke: ['PK', 'Q3'],
      notes: tradeNotes({ confirm: 'F6.8',
        entry: ['F7.6', 'ทะลุ 4H highs หลายตัวแล้วเริ่มกลับตัวบน 5m — เข้าบน LTF เพื่อขี่ move ใหญ่ของ HTF ได้ทั้งขา'],
        more: function (T) {
        return [[T.sweep.bar, 'F7.4', 'HTF liquidity ของ TJR = high/low ของ 1H หรือ 4H; หาจุดเข้าบน 5m หรือ 1m']];
      } })
    });
  }

  // S11 (F7.5): a 5m-only high is swept, a short downtrend starts but fades; price runs to the 4H high.
  function S11(d, seed) {
    var sc = new Script(d.id, seed, d.salt, 'NQ', 5, 1), r = sc.r;
    var d0 = pickDay(r, [0, 1, 2]), times = threeDays(d0), n = times.length;
    var Qx = r.range(5.0, 6.0), F = Qx - r.range(2.0, 3.0);
    sc.at(null, 0, Qx - r.range(2.5, 4.0));
    var kQ = htf4(sc, 'Q', bucket(1, 1), bucket(1, 2), Qx, 'high');
    var b4 = bucket(2, 4);                                             // day 3, 10:00-14:00 ET: F and X share it
    sc.at('F', b4[0] + r.int(1, 4), F, 'high');
    sc.go('lf', F - r.range(2.6, 3.0), 'low', 5, 6);
    sc.go('PK', sc.near('F', r.int(1, 4)), 'high', 5, 6);
    sc.go('lg', sc.X('PK') - r.range(2.6, 3.0), 'low', 5, 6);
    sc.go('X', F + r.range(0.4, 1.0), 'high', 5, 6);
    sc.go('L1', sc.X('X') - r.range(3.0, 3.4), 'low', 5, 6);
    sc.go('hm', sc.X('L1') + r.range(2.6, 2.8), 'high', 5, 6);
    sc.go('LL', sc.X('L1') - r.range(0.3, 0.8), 'low', 5, 6);
    sc.go('R', Qx + r.range(0.3, 0.8), 'high', 10, 16);
    sc.go(null, sc.X('R') - r.range(3.0, 5.0), 'pass', 6, 10);
    var b = function (nm) { return sc.B(nm); };
    sc.keep(0, kQ - 1, null, 'Q');
    sc.keep(kQ + 2, b('R') - 1, null, 'Q');
    sc.keep(b('F') + 2, b('X') - 1, null, 'F');
    sc.keep(b('X') + 2, b('LL') + 1, null, 'X');
    sc.keep(b('L1') + 2, b('LL') - 1, 'LL', null);
    sc.keep(b('LL') + 2, b('R') - 1, 'LL', null);
    sc.fill(1, b('F') - 6, Qx - 4.5, Qx - 0.8);
    sc.run(n);
    return finish(d, seed, sc, {
      levels: [lev(sc, 'F', 'liq', 'F', { label: '5m high' }), lev(sc, 'Q', 'htf', 'Q', { known: bucket(1, 2)[1] + 1 })],
      sweepIds: ['F'], structure: [['X', 'H'], ['L1', 'L'], ['LL', 'LL'], ['R', 'HH']], side: null,
      times: times, htf: 240, near: ['F', 'PK'], poke: ['PK', 'F'],
      notes: function (T) {
        return [
          [T.sweep.bar, 'F7.5', 'high ที่มีแค่บน 5m แตก ราคาย่อลงเป็นขาลงสั้น ๆ'],
          [T.structure[2].bar, 'F7.5', 'ขาลงจาก sweep ของ 5m มักไม่ยืนนาน'],
          [swept(T, 'Q'), 'F7.5', 'ราคากลับขึ้นไปเก็บ 4H high — liquidity ของ HTF มีน้ำหนักกว่า']
        ];
      }
    });
  }

  // S12 (F8.4, F8.5): stacked highs (low-resistance) above; a low below is swept, the uptrend confirms,
  // price runs the stacked highs as its target, then is pushed down.
  function S12(d, seed, outcome) {
    var sc = new Script(d.id, seed, d.salt, 'ES', 5, 1), r = sc.r;
    var SWx = -r.range(0.6, 1.3), C = r.range(2.6, 2.9);
    var q = plan(sc, { shape: 'C', top: 0, sw: SWx, minHH: C + 0.4 });
    var SH3 = q.HH + r.range(0.6, 1.0), SH1 = SH3 + r.range(0.25, 0.6) + 4 * TICK / sc.u;   // SH2 = SH1 - 1..4 ticks stays above SH3
    sc.at(null, 0, SH1 - r.range(1.2, 2.0));
    sc.at('SH1', r.int(4, 7), SH1, 'high');
    sc.go('la', r.range(0.6, 1.1), 'low');
    sc.go('SH2', sc.near('SH1', r.int(1, 4)), 'high');
    sc.go('lb', r.range(0.3, 0.6), 'low');
    sc.go('SH3', SH3, 'high');
    sc.go('LQ', 0, 'low');
    sc.go('C', C, 'high');
    sc.go('SW', SWx, 'low', 6, 9);
    sc.keep(0, sc.B('SH1') - 1, null, 'SH1');
    sc.keep(sc.B('LQ') + 2, sc.B('SW') - 1, 'LQ', null);
    reverse(sc, q, { shape: 'C', outcome: outcome, target: 'SH1' });
    sc.keep(sc.B('SH2') + 2, sc.B('P') + 1, null, 'SH2');
    sc.keep(sc.B('SH3') + 2, sc.B('P') + 1, null, 'SH3');
    var n = sc.bar + 2;
    sc.run(n);
    var g = { group: 'highs' };
    return finish(d, seed, sc, {
      levels: ['SH1', 'SH2', 'SH3'].map(function (nm) { return lev(sc, nm, 'stack', nm, g); }).concat([lev(sc, 'LQ', 'liq', 'LQ')]),
      sweepIds: ['LQ'], structure: [['SW', 'L'], ['H1', 'H'], ['M', 'HL'], ['HH', 'HH'], ['P', 'HL']],
      side: 'long', target: 'SH1', outcome: outcome, times: nyTimes(r, n, sc.B('SW')),
      near: ['SH1', 'SH2'], poke: ['SH2', 'SH1'],
      notes: tradeNotes({ confirm: 'F6.5', target: 'F8.4', more: function (T, cs) {
        return [[Math.min(cs.length - 1, reachBar(cs, T) + 2), 'F8.5', 'เก็บ low-resistance liquidity (stacked highs) แล้วราคาถูกกดลง']];
      } })
    });
  }

  // S13 (F8.3): trendline liquidity - rising lows never taken; price runs them all, then goes higher.
  function S13(d, seed, outcome) {
    var sc = new Script(d.id, seed, d.salt, 'NQ', 5, 1), r = sc.r;
    var L2 = r.range(0.6, 1.2), L3 = L2 + r.range(0.6, 1.2), SWx = -r.range(0.4, 1.0);
    var q = plan(sc, { shape: 'C', top: L3, sw: SWx });
    sc.at(null, 0, r.range(1.0, 2.0));
    sc.at('L1', r.int(4, 7), 0, 'low');
    sc.go('a1', r.range(2.6, 3.0), 'high');
    sc.go('L2', L2, 'low');
    sc.go('a2', L2 + r.range(2.6, 3.0), 'high');
    sc.go('L3', L3, 'low');
    sc.go('T', q.T, 'high');
    sc.go('L3b', sc.near('L3', r.int(1, 4)), 'low');
    sc.go('a4', L3 + r.range(2.6, 3.0), 'high');
    sc.go('SW', SWx, 'low', 6, 9);
    var s = sc.B('SW');
    sc.keep(sc.B('L1') + 2, s - 1, 'L1', null);                     // the run takes L3, then L2, then L1
    sc.keep(sc.B('L2') + 2, s - 2, 'L2', null);
    sc.keep(sc.B('L3') + 2, s - 3, 'L3', null);
    sc.keep(0, sc.B('T') - 1, null, 'T');
    reverse(sc, q, { shape: 'C', outcome: outcome, target: 'T' });
    var n = sc.bar + 2;
    sc.run(n);
    var g = { group: 'trend', label: 'trendline low' };
    return finish(d, seed, sc, {
      levels: ['L1', 'L2', 'L3'].map(function (nm) { return lev(sc, nm, 'stack', nm, g); }).concat([lev(sc, 'T', 'liq', 'T')]),
      sweepIds: ['L1', 'L2', 'L3'], structure: [['SW', 'L'], ['H1', 'H'], ['M', 'HL'], ['HH', 'HH'], ['P', 'HL']],
      side: 'long', target: 'T', outcome: outcome, times: nyTimes(r, n, s),
      near: ['L3', 'L3b'], poke: ['L3b', 'L3'],
      notes: tradeNotes({ confirm: 'F6.5', more: function (T) {
        var last = Math.max(swept(T, 'L1'), swept(T, 'L2'), swept(T, 'L3'));
        return [[last, 'F8.3', 'trendline liquidity: lows ที่ยกตัวและยังไม่เคยโดนเก็บ — ราคาวิ่งเก็บทั้งแถวเพื่อเติม buy orders']];
      } })
    });
  }

  // S14 (F8.6-F8.8): stacked highs above; price takes the lows below and reverses cleanly - those lows are
  // now high-resistance; trade toward the stacked (low-resistance) highs.
  function S14(d, seed, outcome) {
    var sc = new Script(d.id, seed, d.salt, 'NQ', 5, 1), r = sc.r;
    var SWx = -r.range(0.6, 1.3);
    var q = plan(sc, { shape: 'C', top: 4 * TICK / sc.u, sw: SWx });
    var SH3 = q.HH + r.range(0.6, 1.0), SH2 = SH3 + r.range(0.25, 0.6), SH1 = SH2 + r.range(0.25, 0.6);
    sc.at(null, 0, SH1 - r.range(1.2, 2.0));
    sc.at('SH1', r.int(4, 7), SH1, 'high');
    sc.go('LA', 0, 'low');
    sc.go('SH2', SH2, 'high');
    sc.go('LB', sc.near('LA', r.int(1, 4)), 'low');
    sc.go('SH3', SH3, 'high');
    sc.go('SW', SWx, 'low', 6, 9);
    var s = sc.B('SW');
    sc.keep(0, sc.B('SH1') - 1, null, 'SH1');
    sc.keep(sc.B('LA') + 2, s - 1, 'LA', null);
    sc.keep(sc.B('LB') + 2, s - 1, 'LB', null);
    reverse(sc, q, { shape: 'C', outcome: outcome, target: 'SH1' });
    sc.keep(sc.B('SH2') + 2, sc.B('P') + 1, null, 'SH2');
    sc.keep(sc.B('SH3') + 2, sc.B('P') + 1, null, 'SH3');
    var n = sc.bar + 2;
    sc.run(n);
    var gh = { group: 'highs' }, gl = { group: 'lows' };
    return finish(d, seed, sc, {
      levels: ['SH1', 'SH2', 'SH3'].map(function (nm) { return lev(sc, nm, 'stack', nm, gh); })
        .concat([lev(sc, 'LA', 'liq', 'LA', gl), lev(sc, 'LB', 'liq', 'LB', gl)]),
      sweepIds: ['LA', 'LB'], structure: [['SW', 'L'], ['H1', 'H'], ['M', 'HL'], ['HH', 'HH'], ['P', 'HL']],
      side: 'long', target: 'SH1', outcome: outcome, times: nyTimes(r, n, s),
      near: ['LA', 'LB'], poke: ['LB', 'LA'],
      notes: tradeNotes({ confirm: ['F8.8', 'HH ยืนยันขาขึ้นหลังเก็บ lows — มองไปที่ stacked highs (low-resistance) ด้านบน'],
        entry: ['F8.7', 'เทรดไปทาง low-resistance (stacked highs) และออกห่างจาก high-resistance (low ที่เพิ่งโดนกวาด)'],
        more: function (T) {
        return [[T.confirmBar, 'F8.6', 'กลับตัวแรงจากจุด sweep → low ที่โดนกวาดกลายเป็น high-resistance']];
      } })
    });
  }

  // ---------------------------------------------------------------- definitions

  var LAB = function (replay, spot, sessions, quiz) { return { replay: replay, spot: spot, sessions: sessions, quiz: quiz }; };
  var DEFS = [
    ['S01', 'Bullish: กวาด stacked lows แล้วกลับตัวขึ้น',
      'ราคาลงกวาด low ที่เรียงซ้อนกัน จากนั้นเกิด H, L, HL, HH — เข้าที่ pullback หลัง HH แล้วราคาขึ้น',
      ['F6.5'], [1410], 5, 'NQ', LAB(true, true, false, true), ['win', 'fail'], S01],
    ['S02', 'Bullish deep sweep: ลงลึกกิน low ทีละตัว',
      'ราคาทิ้งตัวกวาด low หลายชั้นจนลึกน่ากลัว ไม่ต้องรีบกด buy — รอให้ขึ้นเหนือ high เกิด HH แล้ว HL ก่อนเข้า',
      ['F6.6', 'F5.4'], [1440, 1215], 5, 'NQ', LAB(true, true, false, true), ['win'], S02],
    ['S03', 'Bearish: กวาด high แล้วกลับตัวลง',
      'ราคาขึ้นเหนือ high (buy orders ถูกเติม) แล้วเกิด H, L, LL, LH — เข้าที่ pullback หลัง LL แล้วราคาลง',
      ['F6.8', 'F6.9'], [1530, 1575], 5, 'ES', LAB(true, true, false, true), ['win', 'fail'], S03],
    ['S04', 'Sweep แต่ไม่กลับตัว: ซื้อทันที = ติด drawdown',
      'low โดนกวาดแล้วราคายังลงต่อ ไม่มีเทรนด์ขาขึ้นใหม่จึงไม่มี confirmation และไม่มีเทรด — sweep เป็นแค่โอกาส',
      ['F6.3', 'F5.5'], [1350, 1230], 5, 'NQ', LAB(false, true, false, true), [], S04],
    ['S05', 'Daily: equal highs โดนวิ่งแล้วทิ้ง ตามด้วย lows โดนวิ่งแล้วขึ้น',
      'high ที่สูงพอ ๆ กันโดนทะลุ (fake-out) แล้วราคาร่วง จากนั้นราคาวิ่งใต้ lows ก่อนกลับขึ้น',
      ['F5.3'], [1170], 1440, 'NQ', LAB(false, true, false, false), [], S05],
    ['S06', 'วัน A: London เก็บ Asia low, NY เก็บ London low แล้วขึ้น',
      'Asia แกว่งแคบ, London กวาด Asia low แล้วขึ้น, NY ลงกวาด London low แล้ววิ่งเก็บ Asia high และ previous-day high',
      ['F7.10', 'F7.12'], [2085, 2160], 5, 'NQ', LAB(false, true, true, true), [], S06],
    ['S07', 'วัน B: NY pre-market เก็บ London low แล้วขึ้นทั้งวัน',
      'มาร์ก London high/low ไว้ พอ NY pre-market เปิดราคากวาด London low แล้ว NY เป็นขาขึ้นทั้งวัน',
      ['F7.13'], [2205], 5, 'NQ', LAB(false, true, true, true), [], S07],
    ['S08', 'วันจันทร์: NY open พุ่งเหนือ London high แล้วทิ่มใต้ London low',
      'NY เปิดราคาพุ่งเหนือ London high ทันที แล้วลงใต้ London low ก่อนตลาดจะขึ้น',
      ['F7.15'], [2295], 5, 'NQ', LAB(false, true, true, true), [], S08],
    ['S09', 'เข้าใน 1m หลังกวาด London low',
      'London low โดนกวาดตอน NY pre-market แล้วบน 1m เกิด L, H, HL, HH, HL → จุดเข้า → ราคาขึ้น',
      ['F7.14'], [2250], 1, 'NQ', LAB(true, true, true, true), ['win', 'fail'], S09],
    ['S10', 'กวาด 4H highs ดูบน 5m: กลับตัวเป็นขาลงขนาด HTF',
      'ราคาทะลุ 4H highs หลายตัว แล้วบน 5m เริ่มกลับตัว (H, L, LL, LH) — เข้าบน LTF เพื่อขี่ move ของ HTF',
      ['F7.6'], [1785], 5, 'NQ', LAB(true, true, false, true), ['win', 'fail'], S10],
    ['S11', 'High ของ 5m แตก: reaction สั้น ๆ (ทำไม HTF สำคัญ)',
      'high ที่มีแค่บน 5m โดนกวาด ขาลงเริ่มก่อตัวแต่ไม่ยืน ราคากลับขึ้นไปเก็บ 4H high ที่มีน้ำหนักกว่า',
      ['F7.5'], [1755], 5, 'NQ', LAB(false, true, false, true), [], S11],
    ['S12', 'Stacked highs (low-resistance) เป็นเป้าราคาหลังกวาดด้านล่าง',
      'กวาด low ด้านล่าง เทรนด์ขาขึ้นยืนยัน แล้วราคาวิ่งเก็บ stacked highs เป็นเป้า ก่อนถูกกดลง',
      ['F8.4', 'F8.5'], [2565, 2655], 5, 'ES', LAB(true, true, false, true), ['win'], S12],
    ['S13', 'Trendline liquidity: lows ที่ยกตัวโดนวิ่งเก็บแล้วขึ้น',
      'lows ที่ยกตัวขึ้นไม่เคยโดนเก็บ (ลาก trendline ได้) ราคาวิ่งเก็บทั้งแถว เติม buy orders แล้วขึ้นต่อ',
      ['F8.3'], [2520], 5, 'NQ', LAB(true, true, false, true), ['win'], S13],
    ['S14', 'Low-resistance กลายเป็น high-resistance: เทรดไปทาง stacked highs',
      'ราคาลงเก็บ lows แล้วกลับตัวแรง low นั้นกลายเป็น high-resistance — เทรดไปหา stacked highs ที่ยังไม่โดนเก็บ',
      ['F8.6', 'F8.7', 'F8.8'], [2700, 2790, 2835], 5, 'NQ', LAB(true, true, false, true), ['win'], S14]
  ];

  var LIST = DEFS.map(function (x, i) {
    var d = { id: x[0], salt: i + 1, title: x[1], summary: x[2], facts: x[3], clip: x[4], tf: x[5],
              instrument: x[6], lab: x[7], outcomes: x[8] };
    var script = x[9];
    d.build = function (seed, opts) {
      var outcome = opts && opts.outcome != null ? opts.outcome : null;
      if (outcome != null && d.outcomes.indexOf(outcome) < 0) throw new Error(d.id + ': outcome "' + outcome + '" not supported');
      if (outcome == null && d.outcomes.length) outcome = 'win';
      return script(d, seed, outcome);
    };
    return d;
  });

  function get(id) {
    for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i];
    return null;
  }

  // Build that never hands a page a broken chart: an unlucky seed (build throws, or check() is non-empty) is
  // replaced by the next seed of a fixed Lehmer sequence, up to SAFE_TRIES seeds. Deterministic for (def, seed,
  // opts); the result's meta.seed is the seed actually used, so def.build(meta.seed, opts) rebuilds it. Throws
  // only if every try fails. Lab pages (and the "สุ่มกราฟใหม่" button) build through this or random().
  var SAFE_TRIES = 12;
  function nextSeed(s) { var x = (s * 48271) % 2147483647; return x > 0 ? x : 1; }
  function safeBuild(def, seed, opts) {
    var s = seed, last = '';
    for (var a = 0; a < SAFE_TRIES; a++, s = nextSeed(s)) {
      try {
        var b = def.build(s, opts), errs = check(b);
        if (!errs.length) return b;
        last = errs[0];
      } catch (x) { last = x && x.message; }
    }
    throw new Error('scenarios.safeBuild: ' + def.id + ' has no clean chart in ' + SAFE_TRIES + ' seeds from ' + seed + ': ' + last);
  }

  // A fresh chart for a lab mode. Replay: about one setup in four fails (D4), drawn from the fail-capable ones.
  function random(rng, mode) {
    var defs = LIST.filter(function (d) { return d.lab[mode]; });
    if (!defs.length) throw new Error('scenarios.random: no scenario for mode ' + mode);
    var def = rng.pick(defs), seed = rng.int(1, 2147483646), opts = {};
    if (mode === 'replay' && def.outcomes.indexOf('fail') >= 0) {
      var nf = defs.filter(function (d) { return d.outcomes.indexOf('fail') >= 0; }).length;
      if (rng.chance(Math.min(1, 0.25 * defs.length / nf))) opts.outcome = 'fail';
    }
    return { def: def, built: safeBuild(def, seed, opts) };
  }

  // ---------------------------------------------------------------- check

  // Invariant checker: [] when the built chart's truth holds on its candles.
  function check(b) {
    var e = [], cs = b && b.candles, T = b && b.truth, m = b && b.meta;
    if (!cs || !T || !m) return ['built needs candles, truth and meta'];
    var n = cs.length;
    G.validate(cs, m.tick || TICK).forEach(function (x) { e.push('candles: ' + x); });
    if (e.length) return e;
    function inBar(x) { return typeof x === 'number' && x === Math.floor(x) && x >= 0 && x < n; }
    var sw = SW.find(cs);
    function swing(type, bar, price) {
      var L = type === 'high' ? sw.highs : sw.lows;
      for (var q = 0; q < L.length; q++) if (L[q].i === bar && L[q].price === price) return L[q];
      return null;
    }
    var levels = T.levels || [], byId = {};
    levels.forEach(function (l) {
      var tag = 'level ' + l.id;
      if (byId[l.id]) e.push(tag + ': duplicate id');
      byId[l.id] = l;
      if (!inBar(l.bar) || (l.side !== 'high' && l.side !== 'low')) { e.push(tag + ': bad bar or side'); return; }
      if ((l.side === 'high' ? cs[l.bar].h : cs[l.bar].l) !== l.price) e.push(tag + ': candle ' + l.bar + ' does not hold ' + l.price);
      if (!inBar(l.known) || l.known < l.bar) e.push(tag + ': known bar ' + l.known);
      var end = l.sweptAt == null ? n : l.sweptAt;
      for (var j = l.bar + 1; j < end; j++) {
        if (through(cs[j], l.side, l.price)) { e.push(tag + ': traded through at bar ' + j + ' before sweptAt ' + l.sweptAt); break; }
      }
      if (l.sweptAt != null) {
        if (!inBar(l.sweptAt) || l.sweptAt <= l.bar) e.push(tag + ': sweptAt out of range');
        else {
          if (!through(cs[l.sweptAt], l.side, l.price)) e.push(tag + ': candle ' + l.sweptAt + ' does not trade through');
          if (l.sweptAt < l.known) e.push(tag + ': swept before it is knowable');
        }
      }
      if (l.kind === 'htf' && m.htf) {
        var hs = SW.find(G.rollup(cs, m.tf, m.htf));
        if (!(l.side === 'high' ? hs.highs : hs.lows).some(function (p) { return p.price === l.price; })) {
          e.push(tag + ': not a ' + m.htf + 'm swing');
        }
      }
    });
    // stacked groups: nothing in a group is swept before the whole group has formed
    levels.forEach(function (l) {
      if (!l.group || l.sweptAt == null) return;
      levels.forEach(function (o) {
        if (o.group === l.group && l.sweptAt < o.known) e.push('level ' + l.id + ': swept before ' + o.id + ' of its group formed');
      });
    });
    // session boxes = the real extremes of their windows; session levels sit on them
    var boxes = {};
    (T.sessions || []).forEach(function (s) {
      boxes[s.name] = s;
      if (!inBar(s.from) || !inBar(s.to) || s.to < s.from) { e.push('session ' + s.name + ': bad window'); return; }
      var hi = -Infinity, lo = Infinity;
      for (var j = s.from; j <= s.to; j++) {
        hi = Math.max(hi, cs[j].h); lo = Math.min(lo, cs[j].l);
        if (cs[j].t != null && SS.which(cs[j].t) !== s.name) { e.push('session ' + s.name + ': bar ' + j + ' is ' + SS.which(cs[j].t)); break; }
      }
      if (hi !== s.high || lo !== s.low) e.push('session ' + s.name + ': box ' + s.low + '-' + s.high + ' != candles ' + lo + '-' + hi);
    });
    levels.forEach(function (l) {
      if (!l.session) return;
      var s = boxes[l.session];
      if (!s) { e.push('level ' + l.id + ': no ' + l.session + ' box'); return; }
      if (l.price !== (l.side === 'high' ? s.high : s.low) || l.bar < s.from || l.bar > s.to || l.known !== s.to) {
        e.push('level ' + l.id + ': not the ' + l.session + ' ' + l.side);
      }
    });
    // structure: real two-candle swings, in order, tagged as swings.label tags them
    var pts = T.structure || [], typed = [];
    pts.forEach(function (p, i) {
      var type = highTag(p.tag) ? 'high' : 'low', s = MIRROR[p.tag] && swing(type, p.bar, p.price);
      if (!s) e.push('structure ' + i + ' ' + p.tag + ': no ' + type + ' swing at bar ' + p.bar + ' price ' + p.price);
      else if (p.known !== s.pair[1] + 1) e.push('structure ' + i + ': known ' + p.known + ' != ' + (s.pair[1] + 1));
      if (i && p.bar <= pts[i - 1].bar) e.push('structure ' + i + ': out of order');
      typed.push({ i: p.bar, price: p.price, type: type, pair: s ? s.pair : null });
    });
    SW.label(typed).forEach(function (q, i) { if (q.tag !== pts[i].tag) e.push('structure ' + i + ': tag ' + pts[i].tag + ' but the rule says ' + q.tag); });
    // the sweep = the first level taken
    var sweep = T.sweep, sl = sweep && byId[sweep.levelId];
    if (sweep) {
      if (!sl) e.push('sweep: unknown level ' + sweep.levelId);
      else if (sl.sweptAt !== sweep.bar) e.push('sweep: bar ' + sweep.bar + ' != sweptAt of ' + sl.id);
      levels.forEach(function (l) { if (l.sweptAt != null && l.sweptAt < sweep.bar) e.push('level ' + l.id + ': swept before the sweep'); });
    }
    // the trade (D2, D4)
    var side = T.side;
    if (side == null) {
      ['confirmBar', 'entryWindow', 'target', 'outcome'].forEach(function (k) { if (T[k] != null) e.push(k + ' must be null without a side'); });
    } else if (side !== 'long' && side !== 'short') e.push('side ' + side);
    else if (!sl) e.push('a trade needs a sweep');
    else tradeCheck(e, cs, T, sl, typed, side === 'long');
    // resistance (controller ruling): a stacked group is >= 2 levels on one side; resistance is 'low' for its
    // levels (untaken stack) and null otherwise; resistanceAfter is 'high' for the levels the confirmed reversal
    // moved away from, else equal to resistance
    var gs = {};
    levels.forEach(function (l) { if (l.group) (gs[l.group] = gs[l.group] || []).push(l); });
    Object.keys(gs).forEach(function (g) {
      if (gs[g].length < 2 || gs[g].some(function (l) { return l.side !== gs[g][0].side; })) e.push('group ' + g + ': not a stack of same-side levels');
    });
    if (sl) {
      resistanceOf(levels, sl.side, sweep.bar, side != null ? T.confirmBar : null).forEach(function (r, i) {
        var l = levels[i];
        if (l.resistance !== r[0]) e.push('level ' + l.id + ': resistance ' + l.resistance + ' != ' + r[0]);
        if (l.resistanceAfter !== r[1]) e.push('level ' + l.id + ': resistanceAfter ' + l.resistanceAfter + ' != ' + r[1]);
      });
    }
    (T.notes || []).forEach(function (x, i) {
      if (!inBar(x.bar) || !/^F\d+\.\d+$/.test(x.fact) || typeof x.text !== 'string') e.push('note ' + i + ': bad');
    });
    messCheck(e, m, byId, swing);
    return e;
  }

  function tradeCheck(e, cs, T, sl, typed, L) {
    var n = cs.length, pts = T.structure, sb = T.sweep.bar;
    var ct = L ? 'HH' : 'LL', pt = L ? 'HL' : 'LH';
    var ci = -1;
    for (var i = 0; i < pts.length; i++) if (pts[i].tag === ct && pts[i].bar > sb) { ci = i; break; }
    if (ci < 0) { e.push('no ' + ct + ' after the sweep'); return; }
    var c = pts[ci];
    if (T.confirmBar !== c.bar) e.push('confirmBar ' + T.confirmBar + ' != ' + ct + ' bar ' + c.bar);
    // every HL (long) / LH (short) after the sweep holds beyond the whole swept stack: the highest (long) / lowest
    // (short) same-side level taken between the sweep and the confirm swing, not just the deepest one
    var edge = sl.price;
    reversedFrom(T.levels, sl.side, sb, c.bar).forEach(function (l) { edge = L ? Math.max(edge, l.price) : Math.min(edge, l.price); });
    pts.forEach(function (p) {
      if (p.tag === pt && p.bar > sb && (L ? !(p.price > edge) : !(p.price < edge))) {
        e.push(pt + ' at ' + p.bar + ' does not hold beyond the swept levels (' + edge + ')');
      }
    });
    // the confirm swing is the first break of the H (L) before it
    var ref = null;
    for (i = ci - 1; i >= 0; i--) if (highTag(pts[i].tag) === L) { ref = pts[i]; break; }
    var pair = typed[ci].pair;
    if (!ref) e.push(ct + ' has no ' + (L ? 'H' : 'L') + ' before it');
    else if (pair) {
      for (var j = ref.bar + 1; j < pair[0]; j++) {
        if (L ? cs[j].h > ref.price : cs[j].l < ref.price) { e.push(ct + ' is not the first break: bar ' + j + ' already broke ' + ref.price); break; }
      }
    }
    var w = T.entryWindow;
    if (!w || !pair) { e.push('entryWindow missing'); return; }
    if (w.from !== pair[1] + 1 || !(w.from > T.confirmBar)) e.push('entryWindow.from ' + w.from + ' != first bar after the ' + ct + ' pair');
    // D2: the window runs until price clears the confirm swing again (or, failing that, takes the sweep extreme)
    var ext = L ? Infinity : -Infinity;
    for (j = sb; j <= c.bar; j++) ext = L ? Math.min(ext, cs[j].l) : Math.max(ext, cs[j].h);
    var to = null;
    for (j = w.from; j < n && to == null; j++) if (L ? cs[j].h > c.price : cs[j].l < c.price) to = j - 1;
    for (j = w.from; j < n && to == null; j++) if (L ? cs[j].l < ext : cs[j].h > ext) to = j - 1;
    if (to == null) to = n - 1;
    if (w.to !== to || w.to < w.from) e.push('entryWindow.to ' + w.to + ' != ' + to);
    if (!pts.some(function (p) { return p.tag === pt && p.bar >= w.from && p.bar <= w.to; })) e.push('no entry pivot ' + pt + ' inside the entry window');
    // target and outcome (D4)
    var tg = T.target, tl = tg && T.levels.filter(function (l) { return l.id === tg.levelId; })[0];
    if (!tl || tl.price !== tg.price) { e.push('target must name a level at its price'); return; }
    if (L ? !(tg.price > c.price) : !(tg.price < c.price)) e.push('target is not beyond the ' + ct);
    function reach(k) { return L ? k.h >= tg.price : k.l <= tg.price; }
    for (j = sb; j < w.from; j++) if (reach(cs[j])) { e.push('target reached before the entry window, bar ' + j); break; }
    var hit = false, broke = false;
    for (j = w.from; j < n; j++) { if (reach(cs[j])) hit = true; if (L ? cs[j].l < ext : cs[j].h > ext) broke = true; }
    if (T.outcome === 'win' && !hit) e.push('outcome win but the target is never reached');
    else if (T.outcome === 'fail' && (hit || !broke)) e.push('outcome fail needs no target and a break of the sweep extreme');
    else if (T.outcome !== 'win' && T.outcome !== 'fail') e.push('outcome ' + T.outcome);
  }

  // messiness the spec asks for: chop, a near-equal (not equal) neighbour swing, a false poke at a level
  function messCheck(e, m, byId, swing) {
    var u = m.vol, ms = m.mess;
    if (!(m.chop >= 0.35)) e.push('meta.chop ' + m.chop + ' < 0.35');
    if (!ms || !ms.nearEqual || !ms.poke) { e.push('meta.mess missing'); return; }
    var a = ms.nearEqual[0], c = ms.nearEqual[1], dd = Math.abs(a.price - c.price);
    if (a.type !== c.type || !swing(a.type, a.bar, a.price) || !swing(c.type, c.bar, c.price) || !(dd > 0 && dd <= 0.5 * u)) {
      e.push('meta.mess.nearEqual is not a near-equal swing pair');
    }
    var p = ms.poke, l = byId[p.levelId];
    var gap = l && (l.side === 'high' ? l.price - p.price : p.price - l.price);
    if (!l || p.type !== l.side || !swing(p.type, p.bar, p.price) || !(gap > 0 && gap <= Math.max(0.25 * u, 4 * (m.tick || TICK))) ||
        p.bar <= l.bar || (l.sweptAt != null && p.bar >= l.sweptAt)) {
      e.push('meta.mess.poke is not a false poke at ' + p.levelId);
    }
  }

  TJR.scenarios = { list: LIST, get: get, random: random, safeBuild: safeBuild, check: check };
})(typeof window !== 'undefined' ? window : globalThis);
