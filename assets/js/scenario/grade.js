/* Exercise grading (spec D1, D2, D4). Pure functions the lab's four modes call; no DOM.
   Correctness never looks at truth.outcome: a fail-variant setup is graded like a win (D4). */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};

  var TICK = 0.25;          // project tick (CLAUDE.md)
  var SESSION_TOL = 4;      // sessions: ok within 4 ticks
  var SPOT_BARS = 1;        // spot: +/- 1 bar
  var EPS = 1e-9;

  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  // ---- replay (D2) -------------------------------------------------------
  // truth, bar, choice 'long'|'short'|'wait' -> { correct, code }
  function replay(truth, bar, choice) {
    var sweep = truth.sweep, win = truth.entryWindow, side = truth.side;
    var r = function (correct, code) { return { correct: correct, code: code }; };

    if (choice === 'wait') {
      // the window closed without an entry
      if (win && bar >= win.to) return r(false, 'missed');
      return r(true, 'wait-ok');
    }
    if (choice !== 'long' && choice !== 'short') return r(false, 'invalid');

    if (sweep && bar <= sweep.bar) return r(false, 'blind-sweep');
    if (side === null || side === undefined || !win) return r(false, 'early');   // no-trade scenario
    if (choice !== side) return r(false, 'wrong-side');
    if (bar < win.from) return r(false, 'early');
    if (bar <= win.to) return r(true, 'in-window');
    return r(false, 'late');
  }

  // ---- spot --------------------------------------------------------------
  function nearest(list, bar) {
    var best = null, bd = Infinity;
    for (var k = 0; k < list.length; k++) {
      var d = Math.abs(list[k].i - bar);
      if (d < bd) { bd = d; best = list[k]; }
    }
    return best ? { dist: bd, swing: best } : null;
  }

  // First HL (long) / LH (short) printed after the confirm bar, or null.
  function entryPivot(truth) {
    if (!truth.side || !isNum(truth.confirmBar) || !truth.structure) return null;
    var tag = truth.side === 'long' ? 'HL' : 'LH', pick = null;
    for (var k = 0; k < truth.structure.length; k++) {
      var s = truth.structure[k];
      if (s.tag === tag && s.bar > truth.confirmBar && (!pick || s.bar < pick.bar)) pick = s;
    }
    return pick;
  }

  function sweepTarget(truth) {
    if (!truth.sweep) return null;
    var levels = truth.levels || [], price = null;
    for (var k = 0; k < levels.length; k++) {
      if (levels[k].id === truth.sweep.levelId) { price = levels[k].price; break; }
    }
    return { bar: truth.sweep.bar, price: price };
  }

  var NONE = function () { return { correct: false, expected: null }; };

  function spot(built, task, bar, price) {   // price is accepted for the lab's API but grading is bar-based
    var truth = built.truth, exp = null;
    if (task === 'any-high' || task === 'any-low') {
      var sw = TJR.swings.find(built.candles);
      var n = nearest(task === 'any-high' ? sw.highs : sw.lows, bar);
      if (!n) return NONE();
      return { correct: n.dist <= SPOT_BARS, expected: { bar: n.swing.i, price: n.swing.price } };
    }
    if (task === 'sweep') exp = sweepTarget(truth);
    else if (task === 'entry-pivot') {
      var p = entryPivot(truth);
      exp = p ? { bar: p.bar, price: p.price } : null;
    }
    if (!exp) return NONE();
    return { correct: Math.abs(bar - exp.bar) <= SPOT_BARS, expected: exp };
  }

  // The spot tasks this built scenario can grade, in menu order.
  function spotTasks(built) {
    var tasks = [], sw = TJR.swings.find(built.candles);
    if (sw.highs.length) tasks.push('any-high');
    if (sw.lows.length) tasks.push('any-low');
    if (built.truth.sweep) tasks.push('sweep');
    if (entryPivot(built.truth)) tasks.push('entry-pivot');
    return tasks;
  }

  // ---- sessions (F7.7 boxes) ---------------------------------------------
  // Charts may start on the previous day, so the LAST asia / london entry is the one drawn today.
  function lastSession(sessions, name) {
    var hit = null;
    for (var k = 0; k < (sessions || []).length; k++) if (sessions[k].name === name) hit = sessions[k];
    return hit;
  }

  function sessions(truth, lines) {
    lines = lines || {};
    var asia = lastSession(truth.sessions, 'asia'), lon = lastSession(truth.sessions, 'london');
    var spec = {
      asiaHigh: asia && asia.high, asiaLow: asia && asia.low,
      londonHigh: lon && lon.high, londonLow: lon && lon.low
    };
    var items = {}, score = 0;
    Object.keys(spec).forEach(function (key) {
      if (!isNum(spec[key]) || !isNum(lines[key])) { items[key] = { diff: null, ok: false }; return; }
      var diff = lines[key] - spec[key];
      var ok = Math.abs(diff) <= SESSION_TOL * TICK + EPS;
      if (ok) score++;
      items[key] = { diff: diff, ok: ok };
    });
    return { items: items, score: score };
  }

  // ---- liquidity quiz ----------------------------------------------------
  // Valid answers: 'htf' (htf/pdh/pdl), 'session', 'low'/'high' from the resistance state
  // (resistanceAfter when opts.after: the level once swept and reversed away from).
  function quiz(level, answer, opts) {
    var valid = [];
    if (level.kind === 'htf' || level.kind === 'pdh' || level.kind === 'pdl') valid.push('htf');
    if (level.kind === 'session') valid.push('session');
    var res = opts && opts.after ? level.resistanceAfter : level.resistance;
    if (res === 'low' || res === 'high') valid.push(res);
    return valid.indexOf(answer) !== -1;
  }

  // ---- v2 drills (Level 2). Like the rest, correctness is read from the candles with TJR.confluence / TJR.swings,
  // never from a planned bar of the script.

  // Gap finder: any real fair value gap whose middle candle is within 1 bar of the click is right (P10.3, P10.9).
  // expected = the nearest gap { bar (its middle), dir, low, high }; call it with the candles known at that point
  // (built.candles sliced to the revealed bar) so a gap whose third candle is not on screen yet never counts.
  function fvg(built, bar) {
    if (!isNum(bar)) return { correct: false, expected: null };
    var gaps = TJR.confluence.fvgs(built.candles), best = null;
    for (var k = 0; k < gaps.length; k++) {
      if (!best || Math.abs(gaps[k].i - bar) < Math.abs(best.i - bar)) best = gaps[k];
    }
    if (!best) return { correct: false, expected: null };
    return { correct: Math.abs(best.i - bar) <= SPOT_BARS,
             expected: { bar: best.i, dir: best.dir, low: best.low, high: best.high } };
  }

  // Break or not: the trend being watched before the break. The confirmation of the scenario says which way price
  // broke (dir 'down' -> an uptrend was being watched, its most recent LOW); no confirmation: an uptrend.
  function bosTrend(built) {
    var K = built.truth && built.truth.confluence;
    return K && K.confirm && K.confirm.dir === 'up' ? 'down' : 'up';
  }
  // How bar j reads against the most recent swing known before it (P11.8-P11.10, P11.12-P11.13):
  // null (no touch), 'wick' (an extreme beyond the level, the close still on the safe side), 'on' (closed exactly on
  // it), 'close' (closed beyond it = a break of structure). -> { kind, trend, level: {i, price} } | null
  function bosRead(built, j, sw) {
    var cs = built.candles;
    if (!isNum(j) || j < 0 || j >= cs.length) return null;
    sw = sw || TJR.swings.find(cs);
    var up = bosTrend(built) === 'up', list = up ? sw.lows : sw.highs, lv = null;
    for (var k = 0; k < list.length; k++) if (list[k].pair[1] < j) lv = list[k]; else break;
    if (!lv) return null;
    var x = cs[j], kind = null;
    if (up) kind = x.c < lv.price ? 'close' : x.c === lv.price ? 'on' : x.l < lv.price ? 'wick' : null;
    else kind = x.c > lv.price ? 'close' : x.c === lv.price ? 'on' : x.h > lv.price ? 'wick' : null;
    return kind && { kind: kind, trend: up ? 'up' : 'down', level: { i: lv.i, price: lv.price } };
  }
  // The questions a chart can ask: every candle from a few bars before the setup that touches the watched level, up to and
  // including the first real break. Chart noise that already broke a minor swing before the setup is left out.
  function bosBars(built) {
    var T = built.truth || {}, K = T.confluence || {}, n = built.candles.length, sw = TJR.swings.find(built.candles);
    var ref = K.origin != null ? K.origin : T.sweep ? T.sweep.bar : 0;
    function scan(from) {
      var out = [];
      for (var j = Math.max(0, from); j < n; j++) {
        var r = bosRead(built, j, sw);
        if (!r) continue;
        out.push({ bar: j, kind: r.kind, trend: r.trend, level: r.level });
        if (r.kind === 'close') break;
      }
      return out;
    }
    var list = scan(ref - 10), last = list[list.length - 1];
    if (last && last.kind === 'close' && last.bar < ref) list = scan(ref);
    return list;
  }
  // answer: true = "this candle is a break of structure". Only a CLOSE beyond the level is one.
  function bos(built, bar, answer) {
    var r = bosRead(built, bar), expected = !!(r && r.kind === 'close');
    return { correct: answer === expected, expected: expected };
  }

  // Which index leads: SMT bearish = the index with the LOWER high leads, bullish = the one with the HIGHER low (P6.15-P6.19).
  // Both series are read from their candles at the two swing bars the scenario names. answer 'main' | 'twin'.
  function smtLeader(built) {
    var T = built.truth, s = T && T.smt;
    if (!s || !T.twin || !T.twin.candles) return null;
    function pt(cs, p) { var k = cs[p.bar]; return k ? (s.kind === 'low' ? k.l : k.h) : null; }
    var m = { p1: pt(built.candles, s.main.p1), p2: pt(built.candles, s.main.p2) };
    var t = { p1: pt(T.twin.candles, s.twin.p1), p2: pt(T.twin.candles, s.twin.p2) };
    if (!isNum(m.p1) || !isNum(m.p2) || !isNum(t.p1) || !isNum(t.p2)) return null;
    var r = TJR.confluence.smt(m, t, s.kind);
    return r.leader === 'a' ? 'main' : r.leader === 'b' ? 'twin' : null;
  }
  function smt(built, answer) {
    var expected = smtLeader(built);
    return { correct: expected !== null && answer === expected, expected: expected };
  }

  TJR.grade = { replay: replay, spot: spot, spotTasks: spotTasks, sessions: sessions, quiz: quiz,
                fvg: fvg, bos: bos, bosBars: bosBars, bosRead: bosRead, smt: smt, smtLeader: smtLeader };
})(typeof window !== 'undefined' ? window : globalThis);
