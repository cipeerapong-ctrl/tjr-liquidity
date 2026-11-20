/* Full-system scenarios S15-S22 (Level 2: TJR's playlist "Path to Profitability"), registered after S01-S14.

   How they are built: like v1, each scenario scripts swing waypoints and keep() bands in "long space" with the
   library kit (TJR.scenarios.kit; dir = -1 mirrors a long script into a short one). On top of v1 they script
   - a displacement: pass anchors on four consecutive closes plus one-bar bands that cap the first candle's high and
     floor the third candle's low, so a fair value gap is guaranteed to exist there (its exact edges are the wicks);
   - all-bullish / all-bearish legs (an anchor on every close) where an equilibrium range must not be redrawn by a
     stray two-candle swing;
   - a "no entry yet" band that keeps price out of the gap until the scripted pullback.
   The truth is then READ BACK from the candles with TJR.confluence (never from the script): the confirmation is the
   first BOS (or the first inversed gap) after the setup starts, the continuation is the gap that is respected first
   (or the equilibrium range price enters first), the entry is the close that respects it (P1.43, P1.44 option a),
   and check() re-derives every one of these from the candles.

   truth (v1 shape) gains truth.confluence = {dir, origin, confirm, cont, entry, targets, stack?, noTrade?};
   for a trade the v1 fields mean: confirmBar = confirm.at, entryWindow = entry.at .. the bar before the target or
   the stop, target = targets[0]. S18 / S20 are no-trade setups: side null, entry null, noTrade says why.
   S21 adds truth.smt and truth.twin {instrument:'NQ', candles, leader:'main'}; S22 adds truth.windows = true.

   Def shape: facts are playlist ids (P<clip>.<n>); clip is a list of {clip, sec} chips, rendered with
   TJR.layout.chip(sec, clip) (`▶ #<clip> MM:SS`). Notes cite playlist ids, or F ids of the main clip. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var KIT = TJR.scenarios.kit, SW = TJR.swings, SS = TJR.sessions;
  var Script = KIT.Script, TICK = KIT.TICK, END = KIT.END;

  // ---------------------------------------------------------------- scripting helpers (long space)

  // the v1 opening: liquidity high T (the target), lows L1 / L2 near-equal, a false poke A1 a few ticks under T
  function opening(sc, Tx) {
    var r = sc.r;
    sc.at(null, 0, Tx - r.range(1.2, 2.0));
    sc.at('T', r.int(4, 7), Tx, 'high');
    sc.go('L1', 0, 'low');
    sc.go('A1', sc.near('T', r.int(1, 4)), 'high');
    sc.go('L2', r.range(0.12, 0.4), 'low');
  }
  // L1 / L2 untaken until the sweep low, T untaken until `tEnd`
  function openingBands(sc, tEnd) {
    var s = sc.B('SW');
    sc.keep(sc.B('L1') + 2, s - 1, 'L1', null);
    sc.keep(sc.B('L2') + 2, s - 1, 'L2', null);
    sc.keep(0, sc.B('T') - 1, null, 'T');
    sc.keep(sc.B('T') + 2, tEnd, null, 'T');
  }
  function pass(sc, bar, x) { sc.at(null, bar, x, 'pass'); }
  // bull gap with middle candle d (long space): closes d-2..d+1 = g.c0, g.c1, g.top, g.end (null = already
  // anchored); candle d-1 stays under g.lo, candle d+1 over g.hi -> the gap contains [lo, hi]
  function bullGap(sc, d, g) {
    if (g.c0 != null) pass(sc, d - 2, g.c0);
    if (g.c1 != null) pass(sc, d - 1, g.c1);
    pass(sc, d, g.top);
    pass(sc, d + 1, g.end);
    sc.keep(d - 1, d - 1, null, g.lo);
    sc.keep(d + 1, d + 1, g.hi, null);
  }
  // consecutive anchors from `bar`, one per close, starting at x and stepping by `lo..hi` toward `stop` (never past)
  function stairs(sc, bar, x, stop, lo, hi) {
    var up = stop > x;
    pass(sc, bar, x);
    for (;;) {
      var nx = x + (up ? 1 : -1) * sc.r.range(lo, hi);
      if (up ? nx > stop : nx < stop) return bar;
      pass(sc, ++bar, x = nx);
    }
  }

  // ---------------------------------------------------------------- read-back (TJR.confluence only)

  function C() { return TJR.confluence; }
  function firstBos(cs, ref, L) {
    var ev = C().bos(cs, { trend: L ? 'down' : 'up', from: ref + 1 })[0];
    if (!ev) throw new Error('no BOS after bar ' + ref);
    return { kind: 'bos', at: ev.at, dir: ev.dir, level: { i: ev.level.i, price: ev.level.price } };
  }
  function firstIfvg(cs, ref, L) {
    var opp = L ? 'bear' : 'bull', first = null;
    C().fvgs(cs).forEach(function (g) {
      if (g.dir === opp && g.state === 'disrespected' && g.stateAt > ref &&
          (!first || g.stateAt < first.stateAt || (g.stateAt === first.stateAt && g.i < first.i))) first = g;
    });
    if (!first) throw new Error('no inversed gap after bar ' + ref);
    return { kind: 'ifvg', at: first.stateAt, i: first.i, low: first.low, high: first.high };
  }
  // the first bar after `after` at which a `want` gap formed after `ref` is respected (as known at that bar)
  function respected(cs, ref, after, want, accept) {
    for (var k = after + 1; k < cs.length; k++) {
      var seen = cs.slice(0, k + 1), pv = C().fvgs(seen), best = null, extra = null;
      for (var q = 0; q < pv.length; q++) {
        var g = pv[q];
        if (g.dir !== want || !(g.to > ref) || g.state !== 'respected' || g.stateAt !== k) continue;
        var x = accept ? accept(g, pv, seen) : true;
        if (x && (!best || g.i > best.i)) { best = g; extra = x; }
      }
      if (best) return { cont: { kind: 'fvg', i: best.i, at: best.to, low: best.low, high: best.high, dir: best.dir },
                         entry: { at: k, price: cs[k].c }, extra: extra };
    }
    throw new Error('no respected ' + want + ' gap after bar ' + after);
  }
  // S19: g is the far (bottom) gap of a stack that still holds, and an upper gap of it has been closed through
  function stackHolds(L) {
    return function (g, pv, seen) {
      var st = C().stacks(pv, seen).filter(function (s) { return s.gaps.indexOf(g) >= 0; })[0], far = null, top = null;
      if (!st || st.inversedAt != null) return null;
      st.gaps.forEach(function (x) { if (!far || (L ? x.low < far.low : x.high > far.high)) far = x; });
      if (far !== g) return null;
      st.gaps.forEach(function (x) { if (x !== g && x.state === 'disrespected' && (!top || x.i > top.i)) top = x; });
      return top ? { top: top.i, topAt: top.stateAt } : null;
    };
  }
  // equilibrium (P7.14-P7.17, P1.42): every range drawn after the confirmation is a candidate; in each, the first bar
  // into the discount (long) / premium (short) half is the touch and the first close back out of that half in the
  // trend's direction is the entry, unless a close leaves the range first. The earliest entry wins (tie: newer range).
  function eqEntry(cs, after, L) {
    var dir = L ? 'up' : 'down', seen = {}, best = null, j, n = cs.length;
    for (var a = after + 1; a < n; a++) {
      var r = C().eqRange(cs, { at: a, dir: dir });
      if (!r || !(r.knownAt > after) || seen[r.from + ':' + r.to]) continue;
      seen[r.from + ':' + r.to] = true;
      var touch = null, entry = null;
      for (j = r.knownAt + 1; j < n && entry == null; j++) {
        var k = cs[j];
        if (k.c < r.low || k.c > r.high) break;
        if (touch == null) { if (L ? k.l < r.eq : k.h > r.eq) touch = j; }
        else if (L ? k.c > k.o && k.c > r.eq : k.c < k.o && k.c < r.eq) entry = j;
      }
      if (entry != null && (!best || entry <= best.entry.at)) {
        best = { cont: { kind: 'eq', at: r.knownAt, from: r.from, to: r.to, low: r.low, high: r.high, eq: r.eq },
                 entry: { at: entry, price: cs[entry].c }, touch: touch };
      }
    }
    if (!best) throw new Error('no close out of equilibrium');
    return best;
  }
  // the setup gap that price trades into and then closes through before any respect (S18)
  function closedThrough(cs, ref, after, want) {
    var best = null;
    C().fvgs(cs).forEach(function (g) {
      if (g.dir !== want || !(g.to > ref) || g.state !== 'disrespected' || !(g.stateAt > after)) return;
      var before = C().fvgs(cs.slice(0, g.stateAt)).filter(function (x) { return x.i === g.i; })[0], entered = false;
      for (var j = g.to + 1; j < g.stateAt; j++) if (want === 'bull' ? cs[j].l < g.high : cs[j].h > g.low) entered = true;
      if (before && before.state === 'open' && entered && (!best || g.stateAt < best.stateAt)) best = g;
    });
    if (!best) throw new Error('no gap closed through');
    return best;
  }
  function target(levels, id) {
    var l = levels.filter(function (x) { return x.id === id; })[0];
    return { price: l.price, levelId: l.id };
  }

  // ---------------------------------------------------------------- assemble

  // o: {levels, sweepIds|null, structure:[names], read(cs, sweep) -> confluence, outcome, times(sweep, conf) | [],
  //     near:[a,b], poke:[name, levelId], notes(T, cs) -> [[bar, fact, text]], extra(truth)}
  function finish(d, seed, sc, o) {
    var cs = sc.cs;
    o.levels.forEach(function (l) { l.sweptAt = KIT.firstThrough(cs, l.bar + 1, l.side, l.price); });
    var sweep = null, first = null;
    if (o.sweepIds) {
      o.levels.forEach(function (l) {
        if (l.sweptAt == null) return;
        if (!first || l.sweptAt < first.sweptAt ||
            (l.sweptAt === first.sweptAt && (l.side === 'low' ? l.price < first.price : l.price > first.price))) first = l;
      });
      if (!first || o.sweepIds.indexOf(first.id) < 0) throw new Error(d.id + ': first sweep is ' + (first && first.id));
      sweep = { bar: first.sweptAt, levelId: first.id };
    }
    var pts = o.structure.map(function (nm) { var p = sc.pt(nm); return { i: p.i, price: p.price, type: p.side, k: p.k }; });
    var structure = SW.label(pts).map(function (p) { return { bar: p.i, price: p.price, tag: p.tag, known: p.k + 2 }; });
    var K = o.read(cs, sweep);
    var side = K.entry ? K.dir : null, conf = null, win = null, tgt = null;
    if (side) {
      var eo = KIT.entryOutcome(cs, side === 'long', K.origin, K.entry.at, K.targets[0].price);
      if (eo.outcome !== o.outcome) throw new Error(d.id + ': outcome reads ' + eo.outcome + ', scripted ' + o.outcome);
      conf = K.confirm.at; win = { from: K.entry.at, to: eo.to }; tgt = { price: K.targets[0].price, levelId: K.targets[0].levelId };
    }
    if (first) {
      KIT.resistanceOf(o.levels, first.side, sweep.bar, conf).forEach(function (r, i) {
        o.levels[i].resistance = r[0]; o.levels[i].resistanceAfter = r[1];
      });
    } else o.levels.forEach(function (l) { l.resistance = l.resistanceAfter = l.group ? 'low' : null; });
    var times = typeof o.times === 'function' ? o.times(sweep, K) : o.times;
    var stamped = cs.map(function (k, i) { return { t: times[i], o: k.o, h: k.h, l: k.l, c: k.c }; });
    var truth = {
      side: side, outcome: side ? o.outcome : null, levels: o.levels, sweep: sweep, structure: structure,
      confirmBar: conf, entryWindow: win, target: tgt, sessions: [], notes: [], confluence: K
    };
    if (o.extra) o.extra(truth, times);
    truth.notes = o.notes(truth, stamped).map(function (x) { return { bar: x[0], fact: x[1], text: x[2] }; });
    var mp = function (nm) { return KIT.mpt(sc, nm); };
    var poke = mp(o.poke[0]); poke.levelId = o.poke[1];
    var meta = { id: d.id, instrument: d.instrument, tf: d.tf, tick: TICK, seed: seed, vol: sc.u, chop: sc.chop, level: 2,
                 mess: { nearEqual: [mp(o.near[0]), mp(o.near[1])], poke: poke } };
    return { candles: stamped, meta: meta, truth: truth };
  }

  // ---------------------------------------------------------------- time

  // bars every tf minutes from a weekday-evening 18:00 ET open, skipping the 17:00-18:00 spread and the weekend
  function marketTimes(r, n, tf) {
    var d0 = KIT.pickDay(r, [0, 1, 2, 3]), t = KIT.et(d0, 18, 0), out = [];
    while (out.length < n) {
      var w = SS.which(t);
      if (w !== 'weekend' && w !== 'spread') out.push(t);
      t += tf * 60;
    }
    return out;
  }

  // ---------------------------------------------------------------- notes

  var FAIL = ['F9.2', 'setup ล้ม: ราคากลับไปทะลุจุดเริ่มของ setup — วิธีจัดการเมื่อ setup ล้ม: คลิปไม่ได้ระบุ'];
  var SWEEP = {
    long: ['F6.3', 'ราคาลงกวาด low แล้ว — อย่าเพิ่งกด buy ทันที ถ้าราคายังลงต่อจะติด drawdown'],
    short: ['F6.4', 'ราคาขึ้นกวาด high แล้ว — ไม่ sell เหนือ high แบบไม่คิด ต้องรอ confirmation ก่อน']
  };
  function targetNote(L) {
    return ['P1.51', L ? 'เป้าคือ draws on liquidity ฝั่งตรงข้าม: highs ด้านบน (ในคลิปเป็นเทรด short เป้าเป็น lows ด้านล่าง ที่นี่กลับด้าน)'
                       : 'เป้าคือ draws on liquidity ด้านล่าง: lows ที่ยังไม่โดนเก็บ'];
  }
  // entry / target / outcome notes shared by every trade
  function tradeTail(T, cs) {
    var K = T.confluence, L = T.side === 'long';
    var eo = KIT.entryOutcome(cs, L, K.origin, K.entry.at, K.targets[0].price);
    var out = [[K.entry.at].concat(targetNote(L))];
    if (T.outcome === 'win') out.push([eo.reach, 'P1.51', L ? 'ราคาวิ่งขึ้นถึง highs ที่เป็นเป้า' : 'ราคาลงถึง lows ที่เป็นเป้า']);
    else out.push([eo.brk].concat(FAIL));
    return out;
  }

  // ---------------------------------------------------------------- S15 / S18 / S19: BOS leg with a gap

  // x plan: sweep low SW, H1 (the high to break), M (higher low), the gap leg (BOS close above H1), X, pullback P
  function planGap(r, stacked) {
    var q = {};
    q.SW = -r.range(0.8, 1.5);
    q.M = q.SW + r.range(0.6, 1.1);
    q.H1 = q.M + r.range(2.6, 2.9);
    q.lo = q.H1 - r.range(0.7, 0.9);
    q.hi = q.H1 + r.range(0.2, 0.35);
    q.c1 = q.lo - r.range(0.4, 0.6);
    q.c0 = q.c1 + r.range(0.15, 0.3);                 // candle d-1 bearish: no bull gap one bar earlier
    if (stacked) {
      q.Bm = q.hi + r.range(0.5, 0.8);                 // close of the bottom gap's middle candle
      q.lo2 = q.Bm + r.range(0.25, 0.4);
      q.hi2 = q.lo2 + r.range(0.6, 0.9);
      q.top = q.hi2 + r.range(0.4, 0.7);
      q.end = q.top + r.range(0.2, 0.5);
      q.floor = q.Bm;                                  // no candle into the bottom gap before the pullback
    } else {
      q.top = q.hi + r.range(0.4, 0.7);
      q.end = q.top + r.range(0.2, 0.5);
      q.floor = q.top;
    }
    q.X = q.end + r.range(2.6, 3.0);
    q.P = q.lo + r.range(0.2, 0.35);
    q.V = q.P + r.range(0.3, 0.4);
    q.B2 = q.P + r.range(3.0, 3.3);
    q.T = q.X + r.range(1.0, 1.6);
    q.F = q.SW - r.range(0.5, 1.5);
    return q;
  }
  // sweep -> H1 -> M -> gap leg -> X; returns the gap's middle bar
  function gapLeg(sc, q, stacked) {
    var r = sc.r;
    sc.go('A2', sc.X('L2') + r.range(2.6, 3.0), 'high');
    sc.go('SW', q.SW, 'low', 6, 9);
    sc.go('H1', q.H1, 'high');
    sc.go('M', q.M, 'low');
    var m = sc.B('M'), d = m + r.int(4, 6);
    if (stacked) {
      bullGap(sc, d, { c0: q.c0, c1: q.c1, top: q.Bm, end: q.top, lo: q.lo, hi: q.hi });
      pass(sc, d + 2, q.end);
      sc.keep(d, d, null, q.lo2);
      sc.keep(d + 2, d + 2, q.hi2, null);
    } else bullGap(sc, d, { c0: q.c0, c1: q.c1, top: q.top, end: q.end, lo: q.lo, hi: q.hi });
    sc.keep(sc.B('H1') + 2, d - 2, null, 'H1');        // H1 stays the high to break until the gap leg
    sc.at('X', d + (stacked ? r.int(4, 6) : r.int(3, 5)), q.X, 'high');
    return d;
  }
  // pullback into the gap (V close inside, then the low P inside) -> bounce B2 -> run to T (win) or under SW (fail)
  function gapTail(sc, q, d, outcome, stacked) {
    var r = sc.r, x = sc.B('X'), p = x + r.int(3, 5);
    sc.keep(d + (stacked ? 3 : 2), p - 2, q.floor, null);
    pass(sc, p - 1, q.V);
    sc.at('P', p, q.P, 'low');
    sc.at('B2', p + 3, q.B2, 'high');
    sc.keep(sc.B('M') + 2, p + 1, 'M', null);
    tail(sc, q, outcome);
  }
  function tail(sc, q, outcome) {
    var r = sc.r, b2 = sc.B('B2'), p = sc.B('P');
    if (outcome === 'fail') {
      sc.go('F', q.F, 'low', 5, 8);
      sc.keep(sc.B('SW') + 2, sc.B('F') - 1, 'SW', null);
      openingBands(sc, END);
      sc.go(null, sc.X('F') + r.range(0.6, 1.6), 'pass', 3, 5);
    } else {
      sc.go(null, q.B2 - r.range(1.0, 1.8), 'pass', 3, 5);
      sc.go('R', q.T + r.range(0.4, 1.0), 'high', 6, 10);
      sc.keep(sc.B('SW') + 2, b2 + 1, 'SW', null);
      sc.keep(p + 2, END, 'P', null);
      openingBands(sc, sc.B('R') - 1);
      sc.go(null, sc.X('R') - r.range(1.0, 2.2), 'pass', 4, 7);
    }
  }
  function openingLevels(sc) {
    var g = { group: 'lows' };
    return [KIT.lev(sc, 'L1', 'stack', 'L1', g), KIT.lev(sc, 'L2', 'stack', 'L2', g), KIT.lev(sc, 'T', 'liq', 'T')];
  }

  // S15 (P1.19, P10.21, P11.21, P1.51): sweep lows -> BOS up -> bull FVG respected -> long -> highs
  function S15(d, seed, outcome) {
    var sc = new Script(d.id, seed, d.salt, 'NQ', 5, 1), r = sc.r, q = planGap(r, false);
    opening(sc, q.T);
    var g = gapLeg(sc, q, false);
    gapTail(sc, q, g, outcome, false);
    var n = sc.bar + 2;
    sc.run(n);
    var levels = openingLevels(sc);
    return finish(d, seed, sc, {
      levels: levels, sweepIds: ['L1', 'L2'], structure: ['SW', 'H1', 'M', 'X', 'P'], outcome: outcome,
      near: ['L1', 'L2'], poke: ['A1', 'T'], times: KIT.nyTimes(r, n, sc.B('SW')),
      read: function (cs, sw) {
        var cf = firstBos(cs, sw.bar, true), x = respected(cs, sw.bar, cf.at, 'bull');
        return { dir: 'long', origin: sw.bar, confirm: cf, cont: x.cont, entry: x.entry, targets: [target(levels, 'T')] };
      },
      notes: function (T, cs) {
        var K = T.confluence;
        return [
          [T.sweep.bar, 'P11.21', 'ราคากวาดกลุ่ม lows ที่เป็น draw on liquidity — เป็นแค่โอกาสให้ orders ถูกเติม ยังไม่ใช่จุดเข้า'],
          [K.confirm.at, 'P10.21', 'แท่งนี้ปิดเหนือ high ล่าสุด = break of structure ขึ้น: confirmation ว่า orders ถูกเติมแล้ว'],
          [K.cont.at, 'P10.21', 'ขาที่ break ทิ้ง bullish fair value gap ไว้ — ลำดับ sweep → BOS → FVG (continuation)'],
          [K.entry.at, 'P1.19', 'ราคาย่อเข้า gap แล้วแท่งปิดกลับขึ้นเหนือ gap: ครบ sweep, confirmation, continuation แล้วจึงเข้า']
        ].concat(tradeTail(T, cs));
      }
    });
  }

  // S18 (P10.25, P3.6, P3.21): short space. sweep high -> BOS down -> bear FVG; price rises into it, a red rejection
  // candle, then a close above it: the gap is disrespected, no short, the bias turns up
  function S18(d, seed) {
    var sc = new Script(d.id, seed, d.salt, 'ES', 60, -1), r = sc.r, q = planGap(r, false);
    opening(sc, q.T);
    var g = gapLeg(sc, q, false), x = sc.B('X'), e = x + r.int(3, 4), size = q.hi - q.lo;
    sc.keep(g + 2, e - 1, q.floor, null);
    var v1 = q.lo + size * r.range(0.15, 0.3), v2 = v1 + size * r.range(0.25, 0.4);
    pass(sc, e, v1);                                    // into the gap
    pass(sc, e + 1, v2);                                // the rejection candle closes inside it
    pass(sc, e + 2, q.c1 - r.range(0.3, 0.7));          // the close through the gap
    sc.keep(sc.B('SW') + 2, e + 2, 'SW', null);
    sc.keep(sc.B('M') + 2, e + 2, 'M', null);
    sc.at('F', e + 2 + r.int(3, 5), q.M - r.range(0.4, 0.9), 'low');
    sc.go(null, sc.X('F') + r.range(0.8, 1.6), 'pass', 3, 5);
    openingBands(sc, END);
    var n = sc.bar + 2;
    sc.run(n);
    var levels = openingLevels(sc);
    return finish(d, seed, sc, {
      levels: levels, sweepIds: ['L1', 'L2'], structure: ['SW', 'H1', 'M', 'X', 'F'], outcome: null,
      near: ['L1', 'L2'], poke: ['A1', 'T'], times: marketTimes(r, n, 60),
      read: function (cs, sw) {
        var cf = firstBos(cs, sw.bar, false), gp = closedThrough(cs, sw.bar, cf.at, 'bear');
        return { dir: 'short', origin: sw.bar, confirm: cf,
                 cont: { kind: 'fvg', i: gp.i, at: gp.to, low: gp.low, high: gp.high, dir: gp.dir },
                 entry: null, targets: [], noTrade: { kind: 'disrespected', at: gp.stateAt } };
      },
      notes: function (T, cs) {
        var K = T.confluence, at = K.noTrade.at;
        return [
          [T.sweep.bar].concat(SWEEP.short),
          [K.confirm.at, 'P10.25', 'ปิดใต้ low ล่าสุด: break of structure ลง แล้วขาลงทิ้ง bearish gap ไว้'],
          [K.cont.at, 'P3.6', 'ถ้าขาลงเป็นของจริง ราคาควร respect gap นี้แล้ววิ่งต่อไปหา draws ด้านล่าง'],
          [at - 1, 'P10.25', 'ราคาขึ้นมาเข้า gap และมีแท่งแดงตีกลับ — แต่แท่งลงจาก gap ยังไม่ใช่เหตุผลให้กด sell'],
          [at, 'P10.25', 'แท่งเขียวปิดเหนือ gap: gap โดน disrespect — ไม่มีเทรด short'],
          [at, 'P3.6', 'ราคาปิดทะลุ gap แปลว่าเทรนด์ขาลงไม่ยืน bias จึงเปลี่ยน'],
          [at, 'P3.21', 'gap ถูกปิดทะลุขึ้นไป bias กลายเป็นขาขึ้น เป้าคือ draw ด้านบนถัดไป']
        ];
      }
    });
  }

  // S19 (P10.29, P8.34, P8.36): two stacked bull gaps; a close under the top gap only, the bottom gap holds -> long
  function S19(d, seed) {
    var sc = new Script(d.id, seed, d.salt, 'ES', 60, 1), r = sc.r, q = planGap(r, true);
    opening(sc, q.T);
    var g = gapLeg(sc, q, true);
    gapTail(sc, q, g, 'win', true);
    var n = sc.bar + 2;
    sc.run(n);
    var levels = openingLevels(sc);
    return finish(d, seed, sc, {
      levels: levels, sweepIds: ['L1', 'L2'], structure: ['SW', 'H1', 'M', 'X', 'P'], outcome: 'win',
      near: ['L1', 'L2'], poke: ['A1', 'T'], times: marketTimes(r, n, 60),
      read: function (cs, sw) {
        var cf = firstBos(cs, sw.bar, true), x = respected(cs, sw.bar, cf.at, 'bull', stackHolds(true));
        return { dir: 'long', origin: sw.bar, confirm: cf, cont: x.cont, entry: x.entry, stack: x.extra,
                 targets: [target(levels, 'T')] };
      },
      notes: function (T, cs) {
        var K = T.confluence;
        return [
          [T.sweep.bar].concat(SWEEP.long),
          [K.confirm.at, 'P8.36', 'ปิดเหนือ high ล่าสุด: โครงสร้างขาขึ้นยืนยันแล้ว'],
          [K.cont.at, 'P8.34', 'ขาขึ้นทิ้ง gap สองอันติดกัน (stacked) — gap ล่างคือตัวสุดท้ายที่ค้ำเทรนด์ไว้'],
          [K.stack.topAt, 'P10.29', 'ปิดใต้ gap บนแล้ว — ยังไม่ได้แปลว่าเทรนด์เปลี่ยน เพราะ gap ล่างยังอยู่'],
          [K.stack.topAt, 'P8.34', 'ปิดใต้แค่ gap บนไม่นับเป็น inverse: ต้องปิดใต้ gap ล่างก่อน เทรนด์จึงจะหมด'],
          [K.entry.at, 'P10.29', 'ราคาลงไปเข้า gap ล่างแล้วแท่งปิดกลับขึ้นเหนือ gap — ยังเป็นขาขึ้น'],
          [K.entry.at, 'P8.36', 'gap ล่างยังไม่โดนปิดใต้ โครงสร้างขาขึ้นจึงยังอยู่']
        ].concat(tradeTail(T, cs));
      }
    });
  }

  // ---------------------------------------------------------------- S16 / S22: IFVG then a gap, compact

  // drop into the sweep leaves a bear gap; the turn closes above it (IFVG) with a bull gap; V / P pull back inside;
  // a close above it at s+7 at the latest (the entry): sweep to entry in 5..7 bars
  function planIfvg(r) {
    var q = {};
    q.SW = -r.range(0.8, 1.5);
    q.lo = q.SW + r.range(2.7, 2.9);
    q.hi = q.lo + r.range(0.9, 1.2);
    q.P = q.lo + r.range(0.2, 0.35);
    q.V = q.P + r.range(0.3, 0.4);
    q.gl = q.hi + r.range(0.0, 0.3);                    // bear gap: cap of its third candle
    q.gh = q.gl + r.range(0.6, 0.9);                    // floor of its first candle
    q.q1 = q.gh + r.range(0.2, 0.4);
    q.q0 = q.q1 + r.range(0.2, 0.5);
    q.q2 = q.gl - r.range(0.15, 0.3);
    q.q3 = q.q2 - r.range(0.1, 0.4);
    q.top = Math.max(q.q1, q.hi) + r.range(0.3, 0.6);  // closes above the bear gap: the IFVG
    q.end = q.top + r.range(0.2, 0.5);
    q.K7 = q.top + r.range(0.3, 0.6);
    q.A2 = q.q0 + r.range(0.8, 1.2);
    q.T = Math.max(q.A2, q.K7) + r.range(1.0, 1.6);
    q.F = q.SW - r.range(0.5, 1.5);
    return q;
  }
  function ifvgScript(sc, q, outcome) {
    var r = sc.r;
    opening(sc, q.T);
    sc.go('A2', q.A2, 'high');
    var g = sc.B('A2') + r.int(4, 5);
    pass(sc, g - 2, q.q0); pass(sc, g - 1, q.q1); pass(sc, g, q.q2); pass(sc, g + 1, q.q3);
    sc.keep(g - 1, g - 1, q.gh, null);
    sc.keep(g + 1, g + 1, null, q.gl);
    var s = g + r.int(4, 6);
    sc.at('SW', s, q.SW, 'low');
    sc.keep(g + 2, s - 2, null, q.gl);                   // no close above the bear gap before the sweep
    bullGap(sc, s + 2, { c0: null, c1: null, top: q.top, end: q.end, lo: q.lo, hi: q.hi });
    pass(sc, s + 4, q.V);
    sc.at('P', s + 5, q.P, 'low');
    pass(sc, s + 7, q.K7);
    if (outcome === 'fail') {
      sc.go('F', q.F, 'low', 5, 8);
      sc.keep(s + 2, sc.B('F') - 1, 'SW', null);
      openingBands(sc, END);
      sc.go(null, sc.X('F') + r.range(0.6, 1.6), 'pass', 3, 5);
    } else {
      sc.go('R', q.T + r.range(0.4, 1.0), 'high', 8, 14);
      sc.keep(s + 7, END, 'P', null);
      openingBands(sc, sc.B('R') - 1);
      sc.go(null, sc.X('R') - r.range(1.0, 2.2), 'pass', 4, 7);
    }
  }
  function ifvgRead(levels, L) {
    return function (cs, sw) {
      var cf = firstIfvg(cs, sw.bar, L), x = respected(cs, sw.bar, cf.at, L ? 'bull' : 'bear');
      return { dir: L ? 'long' : 'short', origin: sw.bar, confirm: cf, cont: x.cont, entry: x.entry, targets: [target(levels, 'T')] };
    };
  }

  // S16 (P8.14, P8.24, P8.25, P7.11): short. sweep high -> the bull gap of that push is closed under (IFVG) ->
  // pullback into the bear gap of the drop -> red close out of it -> short
  function S16(d, seed, outcome) {
    var sc = new Script(d.id, seed, d.salt, 'ES', 5, -1), r = sc.r, q = planIfvg(r);
    ifvgScript(sc, q, outcome);
    var n = sc.bar + 2;
    sc.run(n);
    var levels = openingLevels(sc);
    return finish(d, seed, sc, {
      levels: levels, sweepIds: ['L1', 'L2'], structure: ['A2', 'SW', 'P'], outcome: outcome,
      near: ['L1', 'L2'], poke: ['A1', 'T'], times: KIT.nyTimes(r, n, sc.B('SW')), read: ifvgRead(levels, false),
      notes: function (T, cs) {
        var K = T.confluence;
        return [
          [T.sweep.bar, 'P7.11', 'ราคาดันขึ้นเหนือ high = โอกาสให้ orders ถูกเติม (ขั้นที่ 1)'],
          [K.confirm.at, 'P8.24', 'แท่งนี้ปิดใต้ก้น bullish gap — นับที่แท่งที่ปิดใต้ ไม่ใช่แท่งแรกที่เข้า gap'],
          [K.confirm.at, 'P8.14', 'gap ที่ควรพาราคาขึ้นต่อโดนปิดทะลุ = inverse fair value gap ใช้เป็น confirmation แบบ break of structure'],
          [K.confirm.at, 'P8.25', 'IFVG มาก่อน break of structure จึงเข้าได้เร็วกว่ารอให้ปิดใต้ low'],
          [K.cont.at, 'P7.11', 'ขาลงทิ้ง bearish fair value gap ไว้ = continuation confluence (ขั้นที่ 3)'],
          [K.entry.at, 'P7.11', 'ราคาขึ้นมาเข้า gap แล้วแท่งแดงปิดกลับลงใต้ gap — เทรดตามเทรนด์ใหม่ (ขั้นที่ 4)']
        ].concat(tradeTail(T, cs));
      }
    });
  }

  // S22 (P5.13-P5.18, P5.21, P5.22): long, 5m NQ on a real ET day. The sweep falls in 09:30-09:50 (manipulation) and
  // the entry in 09:50-10:10: the clock is placed after the read-back (the candles do not depend on it)
  function S22(d, seed) {
    var sc = new Script(d.id, seed, d.salt, 'NQ', 5, 1), r = sc.r, q = planIfvg(r);
    ifvgScript(sc, q, 'win');
    var n = sc.bar + 2;
    sc.run(n);
    var levels = openingLevels(sc);
    return finish(d, seed, sc, {
      levels: levels, sweepIds: ['L1', 'L2'], structure: ['A2', 'SW', 'P'], outcome: 'win',
      near: ['L1', 'L2'], poke: ['A1', 'T'], read: ifvgRead(levels, true),
      times: function (sw, K) {
        var gap = K.entry.at - sw.bar;                    // bars from the sweep to the entry
        var lo = Math.max(0, 4 - gap), hi = Math.min(3, 7 - gap);
        if (lo > hi) throw new Error(d.id + ': sweep to entry is ' + gap + ' bars, too long for the windows');
        var D = KIT.pickDay(r, [1, 2, 3, 4, 5]);
        return KIT.span(KIT.et(D, 9, 30) + (r.int(lo, hi) - sw.bar) * 300, n, 5);
      },
      extra: function (T) { T.windows = true; },
      notes: function (T, cs) {
        var K = T.confluence, open = 0;
        while (open < T.sweep.bar && SS.fmtET(cs[open].t) !== '09:30') open++;
        return [
          [open, 'P5.16', '09:30 เปิดตลาด NY: เงินใหม่เข้ามา จึงคาดว่าจะมี manipulation'],
          [T.sweep.bar, 'P5.13', 'ช่วง manipulation 09:30–09:50: ราคาลงกวาด lows'],
          [T.sweep.bar, 'P5.17', 'manipulation ส่วนใหญ่เกิดในหน้าต่างนี้'],
          [T.sweep.bar, 'P5.22', 'เหมือนตัวอย่างวันพฤหัสในคลิป: หลังเปิดราคาลงไปกวาด lows ก่อน แล้วจึงกลับขึ้น'],
          [K.confirm.at, 'P8.14', 'bearish gap ของขาลงโดนปิดทะลุขึ้น = inverse fair value gap (confirmation)'],
          [K.entry.at, 'P5.14', 'จุดเข้าอยู่ในช่วง 09:50–10:10'],
          [K.entry.at, 'P5.18', 'ช่วง 09:50–10:10 คือ macro เวลาเข้าในอุดมคติของเขา'],
          [K.entry.at, 'P5.21', 'ตัวอย่างวันศุกร์ในคลิปเป็นฝั่ง short ที่เข้าราว 10:00 — ที่นี่เป็นภาพกลับด้าน']
        ].concat(tradeTail(T, cs));
      }
    });
  }

  // ---------------------------------------------------------------- S17 / S21: BOS then equilibrium

  // all-bullish leg from a low at bar `b` (x0) up through `brk` to X, then an all-bearish retrace to v / P under the
  // equilibrium, then B2 (the close back above it at the latest); returns the x plan used
  function eqLeg(sc, x0, brk, P) {
    var r = sc.r, b = sc.bar;
    var last = b + 2, lx = x0 + r.range(2.4, 2.6);
    pass(sc, last, lx);
    while (lx < brk + 0.3) pass(sc, ++last, lx += r.range(0.6, 1.0));
    var X = lx + r.range(2.5, 2.8);
    sc.at('X', last + 2, X, 'high');
    sc.keep(b + 2, last + 1, null, 'X');
    var x = sc.B('X'), v = P + r.range(0.3, 0.5);
    var end = stairs(sc, x + 2, X - r.range(2.4, 2.6), v + 0.5, 0.5, 0.8);
    pass(sc, end + 1, v);
    sc.at('P', end + 2, P, 'low');
    sc.keep(x + 2, end + 1, 'P', null);
    var eqx = (x0 + X) / 2;
    sc.at('B2', end + 5, Math.max(P + 2.6, eqx + 1.0) + r.range(0, 0.3), 'high');
    return { X: X, eqx: eqx };
  }
  function eqRead(levels, L, ref) {
    return function (cs, sw) {
      var start = ref(sw), cf = firstBos(cs, start.ref, L), x = eqEntry(cs, cf.at, L);
      return { dir: L ? 'long' : 'short', origin: start.origin, confirm: cf, cont: x.cont, entry: x.entry, targets: [target(levels, 'T')] };
    };
  }
  function touchBar(cs, K, L) {
    for (var j = K.cont.at + 1; j < K.entry.at; j++) if (L ? cs[j].l < K.cont.eq : cs[j].h > K.cont.eq) return j;
    return K.entry.at;
  }

  // S17 (P7.17, P7.24, P7.28): short, 15m. sweep high -> BOS down -> range from the high to the new low -> retrace up
  // past 0.5 into the premium -> red close back under equilibrium -> short
  function S17(d, seed) {
    var sc = new Script(d.id, seed, d.salt, 'ES', 15, -1), r = sc.r;
    var SWx = -r.range(0.8, 1.5), M = SWx + r.range(0.6, 1.1), H1 = M + r.range(2.6, 2.9), P = M + r.range(1.2, 1.6);
    var Tx = M + 9.5 + r.range(0, 0.6);                  // above X (M + 5.5..7.6) by 1.3+
    opening(sc, Tx);
    sc.go('A2', sc.X('L2') + r.range(2.6, 3.0), 'high');
    sc.go('SW', SWx, 'low', 6, 9);
    sc.go('H1', H1, 'high');
    sc.go('M', M, 'low');
    sc.keep(sc.B('H1') + 2, sc.B('M') + 1, null, 'H1');
    var e = eqLeg(sc, M, H1, P);
    sc.keep(sc.B('M') + 2, sc.B('P') + 1, 'M', null);
    tail(sc, { T: Tx, B2: sc.X('B2'), F: SWx - r.range(0.5, 1.5) }, 'win');
    var n = sc.bar + 2;
    sc.run(n);
    var levels = openingLevels(sc);
    return finish(d, seed, sc, {
      levels: levels, sweepIds: ['L1', 'L2'], structure: ['SW', 'H1', 'M', 'X', 'P'], outcome: 'win',
      near: ['L1', 'L2'], poke: ['A1', 'T'], times: marketTimes(r, n, 15),
      read: eqRead(levels, false, function (sw) { return { ref: sw.bar, origin: sw.bar }; }),
      notes: function (T, cs) {
        var K = T.confluence;
        return [
          [T.sweep.bar].concat(SWEEP.short),
          [K.confirm.at, 'P7.28', 'แท่งปิดใต้ low ล่าสุด = break of structure ลง: ตอนนี้รู้ว่าเทรนด์เป็นขาลง'],
          [K.cont.at, 'P7.24', 'ลาก range จาก high ล่าสุดลงถึง low ล่าสุดได้แล้ว เส้นกลาง = equilibrium'],
          [touchBar(cs, K, false), 'P7.17', 'ราคาย่อขึ้นเกินเส้น 0.5 เข้าโซน premium — โซนที่เขาอยากหา short'],
          [K.entry.at, 'P7.24', 'เข้า premium แล้วแท่งแดงปิดกลับลงใต้ equilibrium — ราคาโดน respect จึงเข้า short']
        ].concat(tradeTail(T, cs));
      }
    });
  }

  // S21 (P1.31-P1.41, P6.15-P6.21): ES (main) and NQ (twin) from the same waypoints; only the second high differs.
  // ES makes a lower high under its high, NQ a higher high through its own (bearish SMT, ES leads) -> trade ES:
  // BOS down -> range from the lower high to the new low -> retrace into the premium -> short
  function S21(d, seed) {
    var main = new Script(d.id, seed, d.salt, 'ES', 5, -1), r = main.r;
    var p2m = r.range(0.3, 0.6), p2t = -r.range(0.3, 0.6), A = p2m + r.range(2.6, 2.9), P = p2m + r.range(1.2, 1.6);
    var Tx = p2m + 9.0 + r.range(0, 0.6);
    var plan = { T: [r.int(4, 7), Tx], LA: r.range(0.8, 1.4), poke: r.int(1, 4), g: [] };
    for (var k = 0; k < 6; k++) plan.g.push(r.int(5, 8));
    function script(sc, p2) {
      // every bar and x comes from `plan`: the twin draws only its own candle noise
      sc.at(null, 0, Tx - 1.6);
      sc.at('T', plan.T[0], Tx, 'high');
      sc.at('LA', sc.B('T') + plan.g[0], plan.LA, 'low');
      sc.at('A1', sc.B('LA') + plan.g[1], sc.near('T', plan.poke), 'high');
      sc.at('p1', sc.B('A1') + plan.g[2], 0, 'low');
      sc.at('A', sc.B('p1') + plan.g[3], A, 'high');
      sc.at('p2', sc.B('A') + plan.g[4], p2, 'low');
      sc.keep(sc.B('p1') + 2, sc.B('p2') - 1, 'p1', null);
      sc.keep(sc.B('A') + 2, sc.B('p2') + 1, null, 'A');
    }
    script(main, p2m);
    var w0 = main.wps.length, c0 = main.cons.length;
    eqLeg(main, p2m, A, P);
    main.go(null, main.X('B2') - r.range(1.0, 1.8), 'pass', 3, 5);
    main.go('R', Tx + r.range(0.4, 1.0), 'high', 6, 10);
    main.go(null, main.X('R') - r.range(1.0, 2.2), 'pass', 4, 7);
    main.keep(main.B('P') + 2, END, 'P', null);
    // the twin: the same bars and long-space x after p2 (its own scale and noise); only p2 differs
    var twin = new Script(d.id + '/twin', seed, d.salt + 100, 'NQ', 5, -1);
    script(twin, p2t);
    main.wps.slice(w0).forEach(function (w) { twin.at(w.name, w.bar, w.x, w.lk); });
    main.cons.slice(c0).forEach(function (c) { twin.cons.push(rescale(c, main, twin)); });
    [main, twin].forEach(function (sc) {               // bands on the levels each series draws at its own price
      sc.keep(sc.B('p2') + 2, END, 'p2', null);
      sc.keep(0, sc.B('T') - 1, null, 'T');
      sc.keep(sc.B('T') + 2, sc.B('R') - 1, null, 'T');
    });
    var n = main.bar + 2;
    main.run(n);
    twin.run(n);
    var levels = [KIT.lev(main, 'T', 'liq', 'T'), KIT.lev(main, 'p1', 'liq', 'p1')];
    function pt(sc, nm) { var p = sc.pt(nm); return { bar: p.i, price: p.price, k: p.k }; }
    var m1 = pt(main, 'p1'), m2 = pt(main, 'p2'), t1 = pt(twin, 'p1'), t2 = pt(twin, 'p2');
    var smtAt = Math.max(m2.k, t2.k) + 2;
    var res = TJR.confluence.smt({ p1: m1.price, p2: m2.price }, { p1: t1.price, p2: t2.price }, 'high');
    var leader = res.leader === 'a' ? 'main' : res.leader === 'b' ? 'twin' : null;
    function strip(p) { return { bar: p.bar, price: p.price }; }
    var times = KIT.nyTimes(r, n, main.B('p2'));
    return finish(d, seed, main, {
      levels: levels, sweepIds: null, structure: ['p1', 'A', 'p2', 'X', 'P'], outcome: 'win',
      near: ['T', 'A1'], poke: ['A1', 'T'], times: times,
      read: eqRead(levels, false, function () { return { ref: smtAt, origin: m2.bar }; }),
      extra: function (T, ts) {
        T.smt = { kind: 'high', type: res.type, leader: leader, at: smtAt,
                  main: { p1: strip(m1), p2: strip(m2) }, twin: { p1: strip(t1), p2: strip(t2) } };
        T.twin = { instrument: 'NQ', leader: leader,
                   candles: twin.cs.map(function (k, i) { return { t: ts[i], o: k.o, h: k.h, l: k.l, c: k.c }; }) };
      },
      notes: function (T, cs) {
        var K = T.confluence, s = T.smt;
        return [
          [s.main.p2.bar, 'P1.31', 'NQ ดันทะลุ high ของมันขึ้นไป แต่ ES ทำได้แค่ lower high ใต้ high เดิม'],
          [s.at, 'P6.15', 'ตัวหนึ่งทำ lower high อีกตัวทำ higher high = bearish SMT divergence'],
          [s.at, 'P6.16', 'ES (ตัวที่ทำ lower high) คือ index ที่นำขาลง NQ เป็นตัวตาม'],
          [s.at, 'P1.35', 'มี SMT แล้วก็ยังต้องรอให้โครงสร้างเปลี่ยนก่อน — สองขาลงยังไม่พิสูจน์ว่า sell orders ถูกเติม'],
          [K.confirm.at, 'P1.36', 'แท่งปิดใต้ low ล่าสุด: structure break ลง SMT ได้รับการยืนยัน'],
          [K.cont.at, 'P1.41', 'ลาก range จาก high ลงถึง low แล้วรอให้ราคาเด้งขึ้นมาเติม equilibrium'],
          [K.entry.at, 'P1.40', 'เทรดตัวที่นำ (ES) — ตัวที่ไม่มี buy orders พอจะดันทะลุ high'],
          [K.entry.at, 'P6.21', 'short บน index ที่นำและ bearish กว่า ไม่ short ตัวที่ดันทะลุ high']
        ].concat(tradeTail(T, cs));
      }
    });
  }
  // a band in main prices -> the same long-space x in twin prices
  function rescale(c, main, twin) {
    function px(v) { return v == null ? null : KIT.rt(twin.ref + (v - main.ref) * twin.u / main.u); }
    return { from: c.from, to: c.to, lo: px(c.lo), hi: px(c.hi) };
  }

  // ---------------------------------------------------------------- S20: a wick is not a break

  // S20 (P11.13, P11.14): uptrend; equal lows L0 / Lm; an all-bull leg to Hm and an all-bear drop; the next low's
  // wick goes far under Lm but every close stays above it -> no BOS; a lower high, then the real break (a close
  // under the newest low). The wick is deepened after the run: the holder candle's low is lowered (only a low, so
  // every candle stays valid and no swing pair changes).
  function S20(d, seed) {
    var sc = new Script(d.id, seed, d.salt, 'ES', 5, 1), r = sc.r;
    sc.at(null, 0, r.range(1.0, 2.0));
    sc.at('L0', r.int(4, 7), 0, 'low');
    sc.go('H0', r.range(2.6, 3.0), 'high');
    sc.go('Lm', sc.near('L0', r.int(1, 4)), 'low');
    var lm = sc.B('Lm');
    pass(sc, lm + 2, sc.X('Lm') + r.range(2.4, 2.6));
    sc.at('Hm', lm + 4, sc.wps[sc.wps.length - 1].x + r.range(2.5, 2.8), 'high');
    var hm = sc.B('Hm'), Wpx = sc.P('Lm') - TICK, Wx = (Wpx - sc.ref) / sc.u, v = Wx + r.range(0.4, 0.6);
    var end = stairs(sc, hm + 2, sc.X('Hm') - r.range(2.4, 2.6), v + 0.5, 0.5, 0.8);
    pass(sc, end + 1, v);
    var k = end + 2;
    sc.at('W', k, { px: Wpx }, 'low');
    var depth = r.range(0.6, 1.2), deep = KIT.rt(sc.P('Lm') - depth * sc.u), deepX = (deep - sc.ref) / sc.u;
    sc.at('LH', k + r.int(3, 5), Wx + r.range(2.6, 2.9), 'high');
    var f = sc.B('LH') + r.int(4, 7);
    sc.keep(k + 2, f - 2, deepX, null);                 // no new low under the wick until the real break
    pass(sc, f - 1, deepX - r.range(0.25, 0.45));       // the close under the newest low: the BOS
    sc.at('F', f, deepX - r.range(1.0, 1.5), 'low');
    sc.go(null, sc.X('F') + r.range(0.8, 1.6), 'pass', 3, 5);
    sc.keep(sc.B('L0') + 2, k - 1, 'L0', null);
    sc.keep(lm + 2, k - 1, 'Lm', null);
    var n = sc.bar + 2;
    sc.run(n);
    var hold = sc.pt('W').i;
    sc.cs[hold].l = deep;
    sc.by.W.price = deep;
    sc.sw = SW.find(sc.cs);
    var g = { group: 'eql', label: 'equal low' };
    var levels = [KIT.lev(sc, 'L0', 'liq', 'L0', g), KIT.lev(sc, 'Lm', 'liq', 'Lm', g)];
    var watched = sc.pt('Lm');
    return finish(d, seed, sc, {
      levels: levels, sweepIds: ['L0', 'Lm'], structure: ['L0', 'H0', 'Lm', 'Hm', 'W', 'LH', 'F'], outcome: null,
      near: ['L0', 'Lm'], poke: ['Lm', 'L0'], times: KIT.nyTimes(r, n, k),
      read: function (cs, sw) {
        var cf = firstBos(cs, sw.bar, false);
        return { dir: 'short', origin: sw.bar, confirm: cf, cont: null, entry: null, targets: [],
                 noTrade: { kind: 'wick', at: hold, level: { i: watched.i, price: watched.price } } };
      },
      notes: function (T) {
        var K = T.confluence, lh = T.structure[5], ll = T.structure[4];
        return [
          [K.noTrade.at, 'P11.13', 'ไส้เทียนแทงลงใต้ low ที่เฝ้าอยู่ลึกมาก แต่แท่งปิดเหนือ low — ไม่ใช่ break of structure'],
          [ll.known, 'P11.14', 'ยังนับเป็นขาขึ้น low ที่ต้องเฝ้าตอนนี้คือ low ล่าสุดตัวใหม่ (ตัวที่มีไส้ลึก)'],
          [lh.known, 'P11.14', 'เกิด lower high แล้วก็ยังไม่ใช่ break — ต้องรอแท่งปิดใต้ low ล่าสุด'],
          [K.confirm.at, 'P11.14', 'break จริงมาทีหลัง: แท่งนี้ปิดใต้ low ล่าสุด เทรนด์จึงเปลี่ยนเป็นขาลง']
        ];
      }
    });
  }

  // ---------------------------------------------------------------- definitions

  function lab(replay) { return { replay: replay, spot: false, sessions: false, quiz: false }; }
  function chips(list) { return list.map(function (x) { return { clip: x[0], sec: x[1] }; }); }
  TJR.scenarios.register([
    { id: 'S15', title: 'Long ครบสาย: sweep lows → BOS ขึ้น → ย่อเข้า bull FVG → เข้า',
      summary: 'ราคากวาด lows แล้วปิดเหนือ high ล่าสุด (BOS) ขาขึ้นทิ้ง bullish FVG ไว้ ราคาย่อเข้า gap แล้วปิดกลับขึ้น — เข้า long เป้าคือ highs ด้านบน',
      facts: ['P1.19', 'P10.21', 'P11.21', 'P1.51'], clip: chips([[1, 2144], [10, 816], [11, 610], [1, 2113]]),
      tf: 5, instrument: 'NQ', lab: lab(true), outcomes: ['win', 'fail'], script: S15 },
    { id: 'S16', title: 'Short ด้วย IFVG: sweep high → bull FVG โดนปิดใต้ → ย่อเข้า bear FVG',
      summary: 'ราคาดันเหนือ high แล้วแท่งปิดใต้ bullish gap ของขานั้น (inverse FVG = confirmation) ขาลงทิ้ง bearish gap ราคาเด้งเข้า gap แล้วปิดกลับลง — เข้า short',
      facts: ['P8.14', 'P8.24', 'P8.25', 'P7.11'], clip: chips([[8, 356], [8, 548], [8, 569], [7, 217]]),
      tf: 5, instrument: 'ES', lab: lab(true), outcomes: ['win', 'fail'], script: S16 },
    { id: 'S17', title: 'Equilibrium: BOS ลง → ย่อขึ้นเกิน 0.5 เข้า premium → ลง',
      summary: 'หลัง break of structure ลง ลาก range จาก high ล่าสุดถึง low ล่าสุด ราคาย่อขึ้นเกิน equilibrium เข้า premium แล้วแท่งแดงปิดกลับลงใต้ 0.5 — เข้า short',
      facts: ['P7.17', 'P7.24', 'P7.28'], clip: chips([[7, 435], [7, 602], [7, 690]]),
      tf: 15, instrument: 'ES', lab: lab(false), outcomes: ['win'], script: S17 },
    { id: 'S18', title: 'FVG โดนปิดทะลุ = ห้าม short, bias เปลี่ยน',
      summary: 'BOS ลงแล้วเกิด bearish gap ราคาขึ้นมาเข้า gap มีแท่งแดงตีกลับ แต่แท่งเขียวใหญ่ปิดเหนือ gap — gap โดน disrespect จึงไม่มีเทรด short และ bias เปลี่ยน',
      facts: ['P10.25', 'P3.6', 'P3.21'], clip: chips([[10, 928], [3, 155], [3, 484]]),
      tf: 60, instrument: 'ES', lab: lab(false), outcomes: [], script: S18 },
    { id: 'S19', title: 'Stacked FVG: ปิดใต้ gap บน แต่ gap ล่างยังยืน → เทรนด์ยังขึ้น',
      summary: 'ขาขึ้นทิ้ง gap สองอันติดกัน ราคาปิดใต้ gap บน (ยังไม่ใช่ inverse) แล้วลงไปเข้า gap ล่างและปิดกลับขึ้น — เทรนด์ยังขึ้น เข้า long',
      facts: ['P10.29', 'P8.34', 'P8.36'], clip: chips([[10, 1221], [8, 922], [8, 1024]]),
      tf: 60, instrument: 'ES', lab: lab(false), outcomes: ['win'], script: S19 },
    { id: 'S20', title: 'ไส้ทะลุ low ≠ BOS: ไส้ลึกแต่ไม่ปิดใต้ → ยังขาขึ้น',
      summary: 'ในขาขึ้น ไส้เทียนแทงลงใต้ low ที่เฝ้าอยู่ลึกมากแต่ปิดเหนือ low จึงไม่ใช่ break of structure — ไม่มีเทรดตรงไส้ break จริงมาทีหลังเมื่อแท่งปิดใต้ low ล่าสุด',
      facts: ['P11.13', 'P11.14'], clip: chips([[11, 502], [11, 535]]),
      tf: 5, instrument: 'ES', lab: lab(false), outcomes: [], script: S20 },
    { id: 'S21', title: 'SMT ที่ high: NQ ทำ HH, ES ทำ LH → เทรด ES → BOS → EQ → เข้า',
      summary: 'NQ ดันทะลุ high แต่ ES ทำได้แค่ lower high (bearish SMT, ES นำ) รอ structure break ลงบน ES แล้วรอราคาเด้งเข้า premium ของ range ก่อนเข้า short ที่ ES',
      facts: ['P1.31', 'P1.35', 'P1.36', 'P1.40', 'P1.41', 'P6.15', 'P6.16', 'P6.21'],
      clip: chips([[1, 1479], [1, 1670], [1, 1714], [1, 1830], [1, 1881], [6, 316], [6, 338], [6, 629]]),
      tf: 5, instrument: 'ES', lab: lab(false), outcomes: ['win'], script: S21 },
    { id: 'S22', title: 'Time windows: manipulation 09:30–09:50 → เข้า 09:50–10:10',
      summary: 'หลัง 09:30 ราคาลงกวาด lows ในช่วง manipulation แล้วกลับตัว (inverse FVG) ย่อเข้า bullish gap และปิดกลับขึ้นในช่วง 09:50–10:10 — เข้า long',
      facts: ['P5.13', 'P5.14', 'P5.16', 'P5.17', 'P5.18', 'P5.21', 'P5.22'],
      clip: chips([[5, 200], [5, 221], [5, 276], [5, 286], [5, 317], [5, 341], [5, 426]]),
      tf: 5, instrument: 'NQ', lab: lab(true), outcomes: ['win'], script: S22 }
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
