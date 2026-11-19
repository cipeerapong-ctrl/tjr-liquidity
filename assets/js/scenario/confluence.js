/* Confluence detectors (TJR.confluence). Pure functions on candles {t,o,h,l,c}; no DOM.
   Every rule comes from TJR's own playlist "Path to Profitability" (older than the main clip, 2026-01); the main
   clip Vulini8xbB0 only names these confluences (F9.1) and gives no definition, so nothing here conflicts with it.

   fvgs   three-candle gap. Bull at the middle candle i when it is an up candle and cs[i-1].h < cs[i+1].l
          (gap = top wick of the first .. bottom wick of the third); bear mirrored (P10.5, P10.8-P10.10, P10.14).
          Only the middle candle's colour matters (P10.8). Overlapping or merely touching wicks are no gap (P10.14).
          disrespected = first later candle whose CLOSE is strictly beyond the far side; a wick through it, or a close
          exactly on the level, is not (P10.22, P10.24, P8.19, P8.20).
          respected / deletedAt are THE SITE'S READING OF HIS EXAMPLES, not rules he names (P10.27: "read in his
          examples, not stated as a rule"; P10.28, P10.31 for the removal):
            respected  = price traded strictly into the gap, then a candle closes strictly out of the near side, in
                         the gap's direction, before any disrespect (a bull gap: close above its top).
            deletedAt  = after price first entered the gap, the first bar that pushes beyond the extreme set between
                         the first candle and the bar before the entry (bull: highest high; bear: lowest low).
          A gap that is disrespected after being respected reads `disrespected` (the later, decisive event).
   stacks consecutive same-direction gaps with no opposite-direction candle between their middles (P8.32). A stack is
          inversed only by a close beyond the FAR gap, the bottom one of bull gaps (P8.34, P8.36). He states the rule
          for the downside; the bear stack (top gap) is the mirror, not spelled out (P8.37).
   bos    break of structure used as a trend CHANGE (P11.5-P11.9): in an uptrend watch only the most recent confirmed
          swing low, a candle must CLOSE strictly beneath it (a wick, or a body ending level with it, is nothing:
          P11.10, P11.12, P11.13); a lower high alone is nothing (P11.15, P11.16). A swing is known at its pair's second
          candle (swings.js); after a break the trend flips and the most recent swing high is watched (P11.17, P11.18).
          `dir` of an event is the direction of the break (the new trend).
   eqRange equilibrium range (P7.4, P7.14-P7.16, P7.30, P7.32): uptrend = most recent swing low known at `at` up to the
          highest high after it; downtrend mirrored. He draws it live, only once the up candle that confirms the low
          has printed (P7.30), so the end swing must be confirmed by `at`; a higher, still unconfirmed bar means no
          range yet (null). eq = the 50% line snapped to the tick (P7.4, P7.5).
   smt    SMT divergence between two instruments (P6.15-P6.19): highs, one lower second high and one higher second
          high = bearish, the lower-high side leads; lows mirrored = bullish, the higher-low side leads. Either
          instrument may lead (P6.17).
   Nothing here looks ahead: a result for bar k uses candles up to k only (tests slice the series and compare). */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var TICK = 0.25;

  /* ---------- fair value gaps ---------- */

  // Fill state / stateAt / deletedAt of one gap from the candles after its third bar.
  function settle(cs, g) {
    var bull = g.dir === 'bull';
    var enteredAt = -1, refExtreme = 0, disAt = -1, respAt = -1, delAt = -1;
    for (var j = g.to + 1; j < cs.length; j++) {
      var x = cs[j];
      if (disAt < 0 && (bull ? x.c < g.low : x.c > g.high)) disAt = j;
      if (enteredAt < 0 && (bull ? x.l < g.high : x.h > g.low)) {
        enteredAt = j;
        refExtreme = bull ? cs[g.from].h : cs[g.from].l;
        for (var m = g.from + 1; m < j; m++) {       // extreme from the first candle to the bar before entry
          if (bull ? cs[m].h > refExtreme : cs[m].l < refExtreme) refExtreme = bull ? cs[m].h : cs[m].l;
        }
      }
      if (enteredAt >= 0 && respAt < 0 && disAt < 0 && (bull ? x.c > g.high : x.c < g.low)) respAt = j;
      if (enteredAt >= 0 && j > enteredAt && delAt < 0 && (bull ? x.h > refExtreme : x.l < refExtreme)) delAt = j;
    }
    if (disAt >= 0) { g.state = 'disrespected'; g.stateAt = disAt; }
    else if (respAt >= 0) { g.state = 'respected'; g.stateAt = respAt; }
    g.deletedAt = delAt >= 0 ? delAt : null;
    return g;
  }

  function fvgs(cs) {
    var out = [];
    for (var i = 1; i + 1 < cs.length; i++) {
      var a = cs[i - 1], m = cs[i], b = cs[i + 1];
      var dir = null, low = 0, high = 0;
      if (m.c > m.o && a.h < b.l) { dir = 'bull'; low = a.h; high = b.l; }
      else if (m.c < m.o && a.l > b.h) { dir = 'bear'; low = b.h; high = a.l; }
      if (!dir) continue;
      out.push(settle(cs, { i: i, from: i - 1, to: i + 1, dir: dir, low: low, high: high,
                            state: 'open', stateAt: null, deletedAt: null }));
    }
    return out;
  }

  /* ---------- stacks ---------- */

  function oppositeBetween(cs, dir, i0, i1) {
    for (var m = i0 + 1; m < i1; m++) {
      if (dir === 'bull' ? cs[m].c < cs[m].o : cs[m].c > cs[m].o) return true;
    }
    return false;
  }

  function closeStack(cs, chain) {
    var dir = chain[0].dir, bull = dir === 'bull';
    var low = chain[0].low, high = chain[0].high, far = chain[0], lastTo = chain[0].to;
    for (var k = 1; k < chain.length; k++) {
      var g = chain[k];
      if (g.low < low) low = g.low;
      if (g.high > high) high = g.high;
      if (g.to > lastTo) lastTo = g.to;
      if (bull ? g.low < far.low : g.high > far.high) far = g;
    }
    var inversedAt = null;
    for (var j = lastTo + 1; j < cs.length; j++) {
      if (bull ? cs[j].c < far.low : cs[j].c > far.high) { inversedAt = j; break; }
    }
    return { dir: dir, gaps: chain, low: low, high: high, inversedAt: inversedAt };
  }

  function stacks(fvgList, cs) {
    var gaps = fvgList.slice().sort(function (p, q) { return p.i - q.i; });
    var out = [], chain = [];
    function flush() {
      if (chain.length >= 2) out.push(closeStack(cs, chain));
      chain = [];
    }
    for (var k = 0; k < gaps.length; k++) {
      var g = gaps[k], prev = chain.length ? chain[chain.length - 1] : null;
      if (prev && prev.dir === g.dir && !oppositeBetween(cs, g.dir, prev.i, g.i)) chain.push(g);
      else { flush(); chain = [g]; }
    }
    flush();
    return out;
  }

  /* ---------- break of structure ---------- */

  function bos(cs, opts) {
    var sw = TJR.swings.find(cs);
    var trend = opts && opts.trend === 'down' ? 'down' : 'up';
    var start = Math.max(0, (opts && opts.from) || 0);
    var hi = -1, lo = -1, out = [];
    for (var j = start; j < cs.length; j++) {
      while (hi + 1 < sw.highs.length && sw.highs[hi + 1].pair[1] < j) hi++;   // known before this candle
      while (lo + 1 < sw.lows.length && sw.lows[lo + 1].pair[1] < j) lo++;
      var c = cs[j].c;
      if (trend === 'up') {
        if (lo >= 0 && c < sw.lows[lo].price) {
          out.push({ at: j, dir: 'down', level: { i: sw.lows[lo].i, price: sw.lows[lo].price } });
          trend = 'down';
        }
      } else if (hi >= 0 && c > sw.highs[hi].price) {
        out.push({ at: j, dir: 'up', level: { i: sw.highs[hi].i, price: sw.highs[hi].price } });
        trend = 'up';
      }
    }
    return out;
  }

  /* ---------- equilibrium range ---------- */

  function eqRange(cs, opts) {
    var at = opts.at, up = opts.dir !== 'down';
    var sw = TJR.swings.find(cs);
    var starts = up ? sw.lows : sw.highs, ends = up ? sw.highs : sw.lows;
    var s = null, k;
    for (k = 0; k < starts.length; k++) if (starts[k].pair[1] <= at) s = starts[k];
    if (!s) return null;
    var best = null;
    for (k = 0; k < ends.length; k++) {
      var e = ends[k];
      if (e.pair[1] > at || e.i <= s.i) continue;
      if (!best || (up ? e.price >= best.price : e.price <= best.price)) best = e;
    }
    if (!best) return null;
    var last = Math.min(at, cs.length - 1);
    for (var m = s.i + 1; m <= last; m++) {                       // a more extreme bar not yet confirmed as a swing
      if (up ? cs[m].h > best.price : cs[m].l < best.price) return null;
    }
    var low = up ? s.price : best.price, high = up ? best.price : s.price;
    return { dir: up ? 'up' : 'down', from: s.i, to: best.i, low: low, high: high,
             eq: TJR.util.roundTick((low + high) / 2, TICK), knownAt: best.pair[1] };
  }

  /* ---------- SMT divergence ---------- */

  function smt(a, b, kind) {
    var da = a.p2 - a.p1, db = b.p2 - b.p1;
    if (kind === 'high') {
      if (da < 0 && db > 0) return { type: 'bearish', leader: 'a' };   // lower high leads
      if (db < 0 && da > 0) return { type: 'bearish', leader: 'b' };
    } else if (kind === 'low') {
      if (da > 0 && db < 0) return { type: 'bullish', leader: 'a' };   // higher low leads
      if (db > 0 && da < 0) return { type: 'bullish', leader: 'b' };
    }
    return { type: null, leader: null };
  }

  TJR.confluence = { fvgs: fvgs, stacks: stacks, bos: bos, eqRange: eqRange, smt: smt };
})(typeof window !== 'undefined' ? window : globalThis);
