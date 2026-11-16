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

  TJR.grade = { replay: replay, spot: spot, spotTasks: spotTasks, sessions: sessions, quiz: quiz };
})(typeof window !== 'undefined' ? window : globalThis);
