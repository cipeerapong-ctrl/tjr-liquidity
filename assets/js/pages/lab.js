/* TJR Liquidity: the exercise lab (Task 13). Classic script, after the engine, layout and motion.

   1. pure helpers on TJR.lab (no DOM, tested in Node by tests/lab.test.js):
      score         blank / clean / record / loadScore / saveScore: per-mode right, total, streak, best (store key lab.<mode>)
      replay        newReplay / canDecide / canStep / stepReplay / decide: one scored decision per round (D1, D2, D4)
                    replayOverlays: what the chart may show at a bar (nothing past it until the round is over)
      spot          pickSpot / spotPrompt / spotShape
      sessions      sessionStarts / sessionTicks
      quiz          pickQuiz / quizAnswers / quizOverlay
      Level 2       isLevel2 / l2Chain (Replay on S15 / S16 / S22), gapWindow / gapRound / gapsIn / gapGrade / gapWhy (Gap finder),
                    pickBos / bosOverlays / bosFeedback (Break or not), smtFacts / smtPanels / smtFeedback (Which index leads)
   2. page: seven modes on ONE live engine chart at a time (the SMT drill uses the twin pair) (a round = TJR.scenarios.random(rng, mode); the chart is
      destroyed and rebuilt every round, so no loop or listener is left behind; a run token drops late callbacks).
   Every sentence below is a paraphrase of clip-facts.md and carries its timestamp chip; what the clip does not say
   is the gap badge; fail outcomes carry the D4 badge. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var doc = global.document;
  var L = TJR.lab = TJR.lab || {};

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ================================================================ 1 · pure helpers

  var MODES = ['replay', 'spot', 'sessions', 'quiz', 'gap', 'bos', 'smt'];
  var ANSWERS = ['low', 'high', 'htf', 'session'];
  var SESSION_KEYS = ['asiaHigh', 'asiaLow', 'londonHigh', 'londonLow'];
  var TICK = 0.25;
  var D4_TEXT = 'คลิปไม่ได้บอกวิธีจัดการเมื่อ confirmation ล้ม';
  var D4_L2 = 'คลิปไม่ได้บอกวิธีจัดการเมื่อ setup ล้ม';
  var SIDE_SEC = { long: 1410, short: 1530 };            // F6.5 / F6.8

  // ---------------------------------------------------------------- score (per mode)
  function blank() { return { right: 0, total: 0, streak: 0, best: 0 }; }
  function nat(v) { return typeof v === 'number' && isFinite(v) && v > 0 ? Math.floor(v) : 0; }
  function clean(raw) {
    var o = blank();
    if (!raw || typeof raw !== 'object') return o;
    o.total = nat(raw.total); o.right = Math.min(nat(raw.right), o.total);
    o.streak = nat(raw.streak); o.best = Math.max(nat(raw.best), o.streak);
    return o;
  }
  // one answered round: `pts` of `out` points earned (default 1 of 1); `correct` keeps or breaks the streak
  function record(s, correct, pts, out) {
    var n = clean(s);
    out = out == null ? 1 : Math.max(1, Math.floor(out));
    pts = pts == null ? (correct ? 1 : 0) : clamp(Math.floor(pts), 0, out);
    n.total += out; n.right += pts;
    n.streak = correct ? n.streak + 1 : 0;
    if (n.streak > n.best) n.best = n.streak;
    return n;
  }
  function key(mode) { return 'lab.' + mode; }
  function loadScore(mode) { return clean(TJR.store.get(key(mode), null)); }
  function saveScore(mode, s) { var c = clean(s); TJR.store.set(key(mode), c); return c; }
  function resetScore(mode) { TJR.store.remove(key(mode)); return blank(); }

  // ---------------------------------------------------------------- replay
  // the first bar worth starting on: levels known, well before the sweep (same rule as the gallery)
  function replayStart(b) {
    var T = b.truth, n = b.candles.length, sweep = T.sweep ? T.sweep.bar : n - 1, known = 0;
    (T.levels || []).forEach(function (l) { if (l.known != null && l.known < sweep && l.known > known) known = l.known; });
    return clamp(Math.max(known + 1, Math.floor(n * 0.22)), 0, Math.max(0, sweep - 6));
  }
  function newReplay(built) { return { built: built, bar: replayStart(built), over: false, result: null }; }
  // choices are open from the sweep bar onward (sweep bar included)
  function canDecide(r) { var sw = r.built.truth.sweep; return !r.over && !!sw && r.bar >= sw.bar; }
  function canStep(r) { return !r.over && r.bar < r.built.candles.length - 1 && !canDecide(r); }
  function stepReplay(r) { if (canStep(r)) r.bar++; return r.bar; }
  // one decision at the current bar. Long / short end the round; รอ keeps it going while it is right and ends it
  // (as a miss) once the entry window has closed. -> { correct, code, final, scored }
  function decide(r, choice) {
    if (!canDecide(r)) return { correct: false, code: 'closed', final: false, scored: false };
    var g = TJR.grade.replay(r.built.truth, r.bar, choice), last = r.built.candles.length - 1;
    if (choice === 'wait' && g.correct && r.bar < last) {
      r.bar++;
      return { correct: true, code: g.code, final: false, scored: false };
    }
    r.over = true;
    r.result = { choice: choice, bar: r.bar, code: g.code, correct: g.correct };
    return { correct: g.correct, code: g.code, final: true, scored: true };
  }
  // overlays the chart may carry at `bar`. During the round: only what annotate() says is knowable by then, and no
  // structure labels, entry zone or target (they would answer the question); over: the whole annotated truth.
  // Level 2 charts (S15, S16, S22) carry truth.confluence. Their truth is the chain sweep -> confirmation (BOS or IFVG) ->
  // continuation (FVG or equilibrium) -> the close out of it, so the v1 structure labels (HH, HL, LH, LL) are not drawn
  // on them: the end of a round shows the annotated truth plus the confluence overlays of the setup stretch instead.
  function isLevel2(built) { return !!(built && built.truth && built.truth.confluence); }
  function setupFrom(built) {
    var T = built.truth, ref = T.sweep ? T.sweep.bar : T.confluence && T.confluence.origin != null ? T.confluence.origin : 0;
    return Math.max(0, Math.min(ref, built.candles.length - 1) - 6);
  }
  function confluenceOverlays(built, upTo, show) {
    var from = setupFrom(built), sh = show || { windows: !!built.truth.windows };
    return TJR.annotate.confluence(built, { upTo: upTo, show: sh }).filter(function (o) {
      return o.type === 'fvg' ? o.to >= from : o.type === 'bos' ? o.at >= from : o.type === 'eq' ? o.endAt == null || o.endAt > from : true;
    });
  }
  function replayOverlays(built, bar, over) {
    if (over) {
      var all = TJR.annotate(built, { upTo: built.candles.length - 1 });
      if (!isLevel2(built)) return all;
      return all.filter(function (o) { return o.type !== 'label'; }).concat(confluenceOverlays(built, built.candles.length - 1));
    }
    return TJR.annotate(built, { upTo: bar }).filter(function (o) {
      return o.type !== 'label' && o.type !== 'zone' && o.id !== 'entry' && o.id !== 'target';
    });
  }
  function outcomeInfo(built) {
    var o = built.truth.outcome;
    return { outcome: o, fail: o === 'fail', d4: o === 'fail', text: isLevel2(built) ? D4_L2 : D4_TEXT };
  }
  // the three confluences of a Level 2 setup, each with the bar the candles say it happened on (never a planned bar)
  function l2Chain(built) {
    var T = built.truth, K = T.confluence, long = T.side === 'long', rows = [];
    if (!K) return rows;
    var c = K.confirm, ct = K.cont;
    rows.push({ key: 'confirm', bar: c.at, label: 'confirmation',
      text: c.kind === 'ifvg' ? 'inverse FVG: แท่งปิดทะลุ gap ฝั่งตรงข้ามของขาที่กวาด ใช้เป็นตัวยืนยันแทน BOS'
        : 'BOS: แท่งปิดเลย swing ล่าสุด' + (c.dir === 'up' ? 'ขึ้นไป' : 'ลงไป') + ' ตัวยืนยันว่า order ถูกเติมแล้ว' });
    rows.push({ key: 'cont', bar: ct ? ct.at : c.at, label: 'continuation',
      text: ct && ct.kind === 'eq' ? 'equilibrium: ราคากลับเข้าครึ่ง ' + (long ? 'discount' : 'premium') + ' ของ range ' + TJR.util.fmtPrice(ct.low) + ' – ' + TJR.util.fmtPrice(ct.high)
        : 'FVG ' + (long ? 'bullish' : 'bearish') + ' ที่ราคาย่อกลับเข้ามา' + (ct ? ' ' + TJR.util.fmtPrice(ct.low) + ' – ' + TJR.util.fmtPrice(ct.high) : '') });
    rows.push({ key: 'entry', bar: K.entry.at, label: 'entry',
      text: 'แท่งที่ปิดกลับออกจาก continuation ตามทิศ ' + (long ? 'long' : 'short') + ' ที่ราคาปิด ' + TJR.util.fmtPrice(K.entry.price) });
    return rows;
  }
  // feedback texts of a Level 2 setup (chips [clip, sec] are playlist chips: P1.19 chain 35:44, P1.43 wait for the
  // confirmation out of the confluence 32:24, P1.44 option (a) the next candle's close 32:55)
  var L2_CHAIN = [1, 2144], L2_WAIT = [1, 1944], L2_ENTRY = [1, 1975];
  var FB_L2 = {
    'blind-sweep': { good: false, text: 'เข้าตั้งแต่แท่งที่ราคากวาด level ยังไม่มี confirmation (BOS หรือ inverse FVG) เลย การกวาดเป็นแค่โอกาสที่ order จะถูกเติม ยังไม่ใช่สัญญาณเข้า', secs: [1350, L2_CHAIN] },
    'wrong-side': { good: false, text: 'ทิศนี้สวนกับ confirmation ที่ควรเกิด กวาด low แล้วรอ BOS หรือ IFVG ขึ้นเพื่อ long กวาด high แล้วรอ BOS หรือ IFVG ลงเพื่อ short', secs: [L2_CHAIN] },
    'early': { good: false, text: 'ยังเร็วไป ต้องครบสามอย่างก่อน คือ confirmation (BOS หรือ inverse FVG) แล้วราคาย่อเข้า continuation (FVG หรือ equilibrium) แล้วรอแท่งที่ปิดกลับออกตามทิศ ไม่เข้าตอนราคาเพิ่งแตะ', secs: [L2_CHAIN, L2_WAIT] },
    'in-window': { good: true, text: 'ถูกตามขั้นตอน confirmation ผ่านแล้ว ราคาย่อเข้า continuation และมีแท่งปิดกลับออกตามทิศ จึงเข้าได้ ช่วงเข้านี้เป็นการอ่านของเว็บนี้จากตัวอย่าง', secs: [L2_CHAIN, L2_ENTRY] },
    'late': { good: false, text: 'ช้าไป ราคาไปถึงเป้าหรือ setup จบไปก่อนแล้ว ช่วงเข้านี้เป็นการอ่านของเว็บนี้จากตัวอย่าง', secs: [L2_CHAIN] },
    'wait-ok': { good: true, text: 'รอได้ ยังไม่ครบสามอย่าง รอบนี้ยังไม่นับคะแนนจนกว่าจะเลือก long หรือ short หรือช่วงเข้าผ่านไป', secs: [L2_WAIT] },
    'missed': { good: false, text: 'ช่วงเข้าผ่านไปแล้วโดยไม่ได้เข้า รอจนราคาไปถึงเป้าหรือ setup จบไปแล้ว', secs: [L2_CHAIN] },
    'closed': { good: false, text: 'ยังเลือกไม่ได้ กดไปทีละแท่งจนราคากวาด level ก่อน', secs: [1350] }
  };
  function replayFeedback(code, side, level2) {
    if (level2) return FB_L2[code] || FB_L2.closed;
    var s = SIDE_SEC[side] || 1410, both = [1410, 1530];
    var F = {
      'blind-sweep': { good: false, text: 'เข้าตั้งแต่แท่งที่ราคากวาด level ยังไม่มีสัญญาณยืนยันเลย คลิปเตือนว่าการกด buy หรือ sell ทันทีที่ low หรือ high โดนเก็บ อาจติด drawdown ยาว', secs: [1350] },
      'wrong-side': { good: false, text: 'ทิศนี้สวนกับโครงสร้างที่ควรเกิด กวาด low แล้วรอ uptrend เพื่อ long กวาด high แล้วรอ downtrend เพื่อ short', secs: both },
      'early': { good: false, text: 'ยังเร็วไป ต้องรอโครงสร้างใหม่ก่อน long คือ high, low, HL, HH ส่วน short คือ high, low, LL, LH แล้วค่อยเข้าตอน pullback', secs: both },
      'in-window': { good: true, text: 'ถูกตามขั้นตอนในคลิป โครงสร้างใหม่ขึ้นครบแล้ว และคุณเข้าตอน pullback ภายในช่วงเข้า', secs: [s] },
      'late': { good: false, text: 'ช้าไป ราคาออกจากจุดยืนยันไปไกลแล้ว ช่วงเข้านี้เป็นการอ่านของเว็บนี้จากตัวอย่างในคลิป', secs: [1485] },
      'wait-ok': { good: true, text: 'รอได้ ยังไม่ถึงจังหวะ รอบนี้ยังไม่นับคะแนนจนกว่าจะเลือก long หรือ short หรือช่วงเข้าผ่านไป', secs: [1350] },
      'missed': { good: false, text: 'ช่วงเข้าผ่านไปแล้วโดยไม่ได้เข้า รอนานเกินไป', secs: [1485] },
      'closed': { good: false, text: 'ยังเลือกไม่ได้ กดไปทีละแท่งจนราคากวาด level ก่อน', secs: [1350] }
    };
    return F[code] || F.closed;
  }

  // ---------------------------------------------------------------- spot
  var SPOT_TEXT = {
    'any-high': 'คลิก swing high หนึ่งจุด คือแท่งขึ้นตามด้วยแท่งลง จุดสูงสุดของสองแท่งนั้น',
    'any-low': 'คลิก swing low หนึ่งจุด คือแท่งลงตามด้วยแท่งขึ้น จุดต่ำสุดของสองแท่งนั้น',
    'sweep': 'คลิกแท่งแรกที่ไส้ทะลุ level ที่มาร์กไว้บนกราฟ แล้วเก็บ liquidity',
    'entry-pivot-long': 'คลิก pullback ที่ให้จังหวะเข้า long คือ HL ตัวแรกหลัง HH ปรากฏ (เว็บนี้อ่านจากตัวอย่างในคลิป)',
    'entry-pivot-short': 'คลิก pullback ที่ให้จังหวะเข้า short คือ LH ตัวแรกหลัง LL ปรากฏ (เว็บนี้อ่านจากตัวอย่างในคลิป)'
  };
  var SPOT_SECS = { 'any-high': [315], 'any-low': [315], 'sweep': [90, 1350], 'entry-pivot-long': [1410, 2250], 'entry-pivot-short': [1530] };
  function spotKey(task, built) { return task === 'entry-pivot' ? 'entry-pivot-' + (built.truth.side === 'short' ? 'short' : 'long') : task; }
  function spotPrompt(task, built) { var k = spotKey(task, built); return { text: SPOT_TEXT[k], secs: SPOT_SECS[k] }; }
  // arrow under a low, over a high
  function spotShape(task, built) {
    if (task === 'any-high') return 'down';
    if (task === 'any-low') return 'up';
    if (task === 'entry-pivot') return built.truth.side === 'short' ? 'down' : 'up';
    var T = built.truth, lv = (T.levels || []).filter(function (l) { return T.sweep && l.id === T.sweep.levelId; })[0];
    return lv && lv.side === 'high' ? 'down' : 'up';
  }
  function pickSpot(built, rng, lastTask) {
    var tasks = TJR.grade.spotTasks(built);
    if (!tasks.length) return null;
    var pool = tasks.length > 1 ? tasks.filter(function (t) { return t !== lastTask; }) : tasks;
    return rng.pick(pool);
  }

  // ---------------------------------------------------------------- sessions
  // four starting lines, spread over the price range of the session window (Asia start to London end, which is the
  // window the lab shows on a phone) so they start inside the visible price range, and never on a true level
  function sessionSpan(built) {
    var from = Infinity, to = -Infinity;
    (built.truth.sessions || []).forEach(function (x) { if (x.name === 'asia' || x.name === 'london') { from = Math.min(from, x.from); to = Math.max(to, x.to); } });
    return from <= to ? { from: Math.max(0, from - 2), to: Math.min(built.candles.length - 1, to + 2) } : { from: 0, to: built.candles.length - 1 };
  }
  function sessionStarts(built) {
    var lo = Infinity, hi = -Infinity, sp = sessionSpan(built), tick = built.meta.tick || TICK, T = built.truth, out = {}, truth = {};
    for (var i = sp.from; i <= sp.to; i++) { var c = built.candles[i]; if (c.l < lo) lo = c.l; if (c.h > hi) hi = c.h; }
    function at(f) { return TJR.util.roundTick(lo + (hi - lo) * f, tick); }
    ['asia', 'london'].forEach(function (nm) {
      var x = (T.sessions || []).filter(function (q) { return q.name === nm; }).pop();
      if (x) { truth[nm + 'High'] = x.high; truth[nm + 'Low'] = x.low; }
    });
    var base = { asiaHigh: 0.86, asiaLow: 0.14, londonHigh: 0.66, londonLow: 0.34 };
    Object.keys(base).forEach(function (k) {
      var v = at(base[k]);
      for (var n = 0; n < 8; n++) {                       // step away from the true level and from the lines already placed
        var near = truth[k] != null && Math.abs(v - truth[k]) <= (TJR.grade.SESSION_TOL || 4) * tick * 2;
        var clash = Object.keys(out).some(function (o) { return Math.abs(out[o] - v) < (hi - lo) * 0.05; });
        if (!near && !clash) break;
        v = at(Math.min(0.95, Math.max(0.05, base[k] + (base[k] > 0.5 ? -1 : 1) * 0.06 * (n + 1))));
      }
      out[k] = v;
    });
    return out;
  }
  // the window a phone can read: Asia start to London end, rolled up (1m -> 5m -> 15m ...) until it fits `slots` bars.
  // Grading is by price, so a roll-up never changes the answer. -> { tf, from, to } in that timeframe's indices
  function sessionView(built, slots) {
    var T = built.truth, cs = built.candles, base = built.meta.tf || 5, asia = null, lon = null, best = null;
    (T.sessions || []).forEach(function (s) { if (s.name === 'asia') asia = s; else if (s.name === 'london') lon = s; });
    if (!asia || !lon) return null;
    var t0 = cs[asia.from].t, t1 = cs[lon.to].t;
    function lastLE(series, t) {
      var lo = 0, hi = series.length - 1;
      while (lo < hi) { var m = (lo + hi + 1) >> 1; if (series[m].t <= t) lo = m; else hi = m - 1; }
      return lo;
    }
    [1, 5, 15, 60, 240].forEach(function (tf) {
      if (best && best.fits) return;
      if (tf < base || tf % base) return;
      var series = tf === base ? cs : TJR.gen.rollup(cs, base, tf);
      var from = Math.max(0, lastLE(series, t0) - 2), to = Math.min(series.length - 1, lastLE(series, t1)) + 2;
      best = { tf: tf, from: from, to: to, fits: to - from + 1 <= slots };
    });
    return best && { tf: best.tf, from: best.from, to: best.to };
  }
  // Spot: the levels the sweep task refers to (everything known before the sweep, still untaken); other tasks draw none
  function spotSetup(built, task) {
    var sw = built.truth.sweep;
    if (task !== 'sweep' || !sw) return [];
    return TJR.annotate(built, { upTo: sw.bar - 1 }).filter(function (o) { return o.type === 'level' || o.type === 'trend'; });
  }
  // Spot: a view that holds the bar to click when the default fit (a phone) has pushed it off the left edge.
  // null = keep the fit. view = the engine's current { from, to }
  function spotView(built, task, view) {
    if (task !== 'sweep' && task !== 'entry-pivot') return null;
    var exp = TJR.grade.spot(built, task, 0, 0).expected;
    if (!exp) return null;
    var n = built.candles.length, span = Math.max(10, view.to - view.from);
    if (exp.bar >= view.from + 3 && exp.bar <= Math.min(view.to, n - 1) - 3) return null;
    var to = Math.min(n + 1, exp.bar + Math.round(span * 0.3)), from = Math.max(0, to - span);
    return { from: from, to: from + span };
  }
  function sessionTicks(item) { return !item || item.diff == null ? null : Math.round(item.diff / TICK); }

  // ---------------------------------------------------------------- quiz
  // answers (of htf / session / low / high) the grader accepts for a level in a state
  function quizAnswers(level, after) {
    return ANSWERS.filter(function (a) { return TJR.grade.quiz(level, a, { after: !!after }); });
  }
  // resistanceAfter is asked only on win builds that print a confirmation (never on a fail variant), and only for a
  // level price actually reversed from (resistanceAfter 'high', F8.6). A target level that price runs into at the
  // end ('low') or one with no stated state is never asked "after": the premise would be false (F8.1)
  function afterAllowed(built) { return built.truth.outcome === 'win' && built.truth.confirmBar != null; }
  // every (level, state) the chart can ask, with the bar the chart is revealed to
  function quizOptions(built) {
    var T = built.truth, n = built.candles.length, out = [];
    (T.levels || []).forEach(function (l) {
      var known = l.known != null ? l.known : l.bar;
      var swept = l.sweptAt != null;
      var beforeRev = swept ? l.sweptAt - 1 : n - 1;
      if (beforeRev >= known) {
        var a = quizAnswers(l, false);
        if (a.length) out.push({ level: l, after: false, rev: beforeRev, valid: a });
      }
      if (swept && afterAllowed(built) && l.resistanceAfter === 'high') {
        var b = quizAnswers(l, true);
        if (b.length) out.push({ level: l, after: true, rev: n - 1, valid: b });
      }
    });
    return out;
  }
  // prefers a question with exactly one right answer; null when this chart has none
  function pickQuiz(built, rng) {
    var all = quizOptions(built);
    if (!all.length) return null;
    var one = all.filter(function (q) { return q.valid.length === 1; });
    return rng.pick(one.length ? one : all);
  }
  // the highlighted level: no label (it would answer the question), only as far as the chart is revealed
  function quizOverlay(q) {
    var l = q.level;
    return { id: 'quiz-level', type: 'level', price: l.price, from: l.bar, to: q.rev, label: '?', kind: 'liq',
             state: q.after && l.sweptAt != null && l.sweptAt <= q.rev ? 'swept' : 'active', appearAt: l.bar };
  }

  // ---------------------------------------------------------------- Gap finder (Level 2: S15, S16, S19, S22)
  // The chart stops a few bars after the setup's continuation gap forms; the student clicks the middle candle of a fair value gap. Graded by
  // TJR.grade.fvg on the candles revealed so far (a gap whose third candle is not on screen never counts).
  var GAP_BEFORE = 10, GAP_AFTER = 8;
  function gapWindow(b) {
    var T = b.truth, K = T.confluence, n = b.candles.length;
    // centred on the continuation gap (the one the setup uses), else the confirmation, else the sweep
    var ref = K && K.cont ? K.cont.at : K && K.confirm ? K.confirm.at : T.sweep ? T.sweep.bar : Math.floor(n / 2);
    return { from: Math.max(0, ref - GAP_BEFORE), to: Math.min(n - 1, ref + GAP_AFTER) };
  }
  function gapSlice(b, g) { return { candles: b.candles.slice(0, g.to + 1), meta: b.meta, truth: b.truth }; }
  // the chart starts one bar before the window (so the first bar's gap shows whole): a gap is on screen when its first candle is
  // at or after that bar and its third candle is revealed
  function gapViewFrom(g) { return Math.max(0, g.from - 1); }
  function gapsIn(b, g) { var v = gapViewFrom(g); return TJR.confluence.fvgs(b.candles.slice(0, g.to + 1)).filter(function (x) { return x.from >= v; }); }
  // The round: the window plus ONE named direction ('bull' | 'bear') that has a gap in it. The rule is the web site's own,
  // stricter than TJR.grade.fvg (any gap within 1 bar, which random clicks pass in 50-70% of the windows): the click must
  // land exactly on the middle candle of a gap OF THAT DIRECTION. A random click then passes in about 1 round in 7.
  function gapRound(b, rng) {
    var g = gapWindow(b), dirs = [];
    gapsIn(b, g).forEach(function (x) { if (dirs.indexOf(x.dir) < 0) dirs.push(x.dir); });
    g.dir = dirs.length ? rng.pick(dirs) : null;
    return g;
  }
  // expected = the nearest gap of the named direction { bar, dir, low, high }; other = a gap of the other direction whose
  // middle was clicked (for the feedback), else null
  function gapGrade(b, g, bar) {
    if (typeof bar !== 'number' || !isFinite(bar)) return { correct: false, expected: null, other: null };
    var gaps = gapsIn(b, g), mine = gaps.filter(function (x) { return !g.dir || x.dir === g.dir; }), best = null, other = null;
    mine.forEach(function (x) { if (!best || Math.abs(x.i - bar) < Math.abs(best.i - bar)) best = x; });
    gaps.forEach(function (x) { if (g.dir && x.dir !== g.dir && x.i === bar) other = x; });
    return { correct: !!best && best.i === bar,
             expected: best && { bar: best.i, dir: best.dir, low: best.low, high: best.high }, other: other };
  }
  function ticksOf(v) { return Math.round(v / TICK); }
  // why bar i is NOT the middle of a gap (null when it is): { reason: 'edge' | 'doji' | 'overlap', dir?, first?, third?, ticks? }
  function gapWhy(cs, i) {
    if (!cs || i < 1 || i + 1 >= cs.length) return { reason: 'edge' };
    var a = cs[i - 1], m = cs[i], c = cs[i + 1];
    if (m.c > m.o) return a.h < c.l ? null : { reason: 'overlap', dir: 'up', first: a.h, third: c.l, ticks: ticksOf(a.h - c.l) };
    if (m.c < m.o) return a.l > c.h ? null : { reason: 'overlap', dir: 'down', first: a.l, third: c.h, ticks: ticksOf(c.h - a.l) };
    return { reason: 'doji' };
  }
  function gapOverlays(b, g) {
    // plain boxes: a gap's later fate (respected, IFVG) is not what this drill is about
    return TJR.annotate.confluence(b, { upTo: g.to, show: { bos: false, eq: false, windows: false } }).filter(function (o) { return o.type === 'fvg' && o.from >= gapViewFrom(g); }).map(function (o) {
      return { id: o.id, type: 'fvg', from: o.from, to: o.to, low: o.low, high: o.high, dir: o.dir, state: 'open', appearAt: o.appearAt };
    });
  }
  var GAP_SECS = { up: [[10, 251], [10, 189]], down: [[10, 436], [10, 189]] };

  // ---------------------------------------------------------------- Break or not (Level 2: S20)
  // The chart stops on a candle that touches the watched swing (the most recent low in an uptrend). Is it a break of
  // structure? Only a close beyond the level is (P11.8-P11.10, P11.13). Candidates come from TJR.grade.bosBars.
  function pickBos(b, rng) {
    var c = TJR.grade.bosBars(b).filter(function (x) { return x.bar >= 1 && x.level.i < x.bar; });
    if (!c.length) return null;
    var yes = c.filter(function (x) { return x.kind === 'close'; }), no = c.filter(function (x) { return x.kind !== 'close'; });
    var pool = yes.length && (!no.length || rng.chance(0.4)) ? yes : no;
    var q = rng.pick(pool), x = b.candles[q.bar], tick = b.meta.tick || TICK, up = q.trend === 'up';
    var past = q.kind === 'close' ? (up ? q.level.price - x.c : x.c - q.level.price) : q.kind === 'wick' ? (up ? q.level.price - x.l : x.h - q.level.price) : 0;
    return { bar: q.bar, kind: q.kind, trend: q.trend, level: q.level, ticks: Math.round(past / tick) };
  }
  function bosOverlays(r, over) {
    var q = r.bq, b = r.built, x = b.candles[q.bar], up = q.trend === 'up', K = b.truth.confluence;
    var out = [
      { id: 'bos-level', type: 'level', price: q.level.price, from: q.level.i, to: q.bar, label: up ? 'low ล่าสุด' : 'high ล่าสุด', kind: 'liq', state: 'active', appearAt: q.level.i },
      { id: 'bos-bar', type: 'marker', bar: q.bar, price: up ? x.l : x.h, shape: up ? 'up' : 'down', appearAt: q.bar }
    ];
    if (over && K && K.confirm) {
      out.push({ id: 'bos-real', type: 'bos', price: K.confirm.level.price, from: K.confirm.level.i, at: K.confirm.at, dir: K.confirm.dir, appearAt: K.confirm.at });
    }
    return out;
  }
  // the verdict text starts with the answer word; chips are clip #11 (P11.8 2:33, P11.9 3:06, P11.10 4:23, P11.11 4:54,
  // P11.12 6:17, P11.13 8:22)
  function bosFeedback(q) {
    var up = q.trend === 'up', lvl = up ? 'low' : 'high', n = q.ticks;
    if (q.kind === 'wick') {
      return { good: false, secs: up ? [[11, 502], [11, 153]] : [[11, 377], [11, 186]],
        text: 'ไม่ใช่ ไส้เทียนแทง' + (up ? 'ลงใต้' : 'ขึ้นเหนือ') + ' ' + lvl + ' ล่าสุดไป ' + n + ' tick แต่แท่งปิด' + (up ? 'เหนือ' : 'ใต้') + ' level นั้น ต้องมีแท่งที่ปิด' + (up ? 'ใต้' : 'เหนือ') + ' ' + lvl + ' ถึงจะนับเป็น break ' + (up ? 'ขาขึ้นยังอยู่' : 'ขาลงยังอยู่') };
    }
    if (q.kind === 'on') {
      return { good: false, secs: [[11, 263]],
        text: 'ไม่ใช่ แท่งปิดเท่ากับ ' + lvl + ' ล่าสุดพอดี ยังไม่' + (up ? 'ต่ำกว่า' : 'สูงกว่า') + ' ต้องปิด' + (up ? 'ใต้' : 'เหนือ') + ' level ถึงจะนับเป็น break' };
    }
    return { good: true, secs: up ? [[11, 153], [11, 294]] : [[11, 186], [11, 294]],
      text: 'ใช่ แท่งนี้ปิด' + (up ? 'ใต้' : 'เหนือ') + ' ' + lvl + ' ล่าสุดไป ' + n + ' tick นี่คือ break of structure เทรนด์เปลี่ยนเป็น' + (up ? 'ขาลง' : 'ขาขึ้น') };
  }

  // ---------------------------------------------------------------- Which index leads (Level 2: S21, the twin pair)
  // Both indexes are read from their own candles at the two swing bars the scenario names. The index with the lower high
  // (bullish: the higher low) leads, whichever it is (P6.15-P6.19).
  function smtFacts(b) {
    var T = b.truth, s = T.smt, low = s.kind === 'low';
    function pt(cs, p) { return low ? cs[p.bar].l : cs[p.bar].h; }
    function side(name, cs, p) { return { name: name, p1: pt(cs, p.p1), p2: pt(cs, p.p2), bar1: p.p1.bar, bar2: p.p2.bar }; }
    return { kind: s.kind, leader: TJR.grade.smtLeader(b),
             main: side(b.meta.instrument, b.candles, s.main), twin: side(T.twin.instrument, T.twin.candles, s.twin) };
  }
  // the two charts in panel order (left, right), each with its built pair member and the two marks (swing 1, swing 2)
  function smtPanels(r) {
    var b = r.built, f = smtFacts(b), low = f.kind === 'low', order = r.smt.swap ? ['twin', 'main'] : ['main', 'twin'];
    return order.map(function (which) {
      var x = f[which], cs = which === 'main' ? b.candles : b.truth.twin.candles;
      var built = which === 'main' ? b : { candles: cs, meta: Object.assign({}, b.meta, { instrument: x.name }) };
      function mark(id, bar) { return { id: 'smt-' + which + id, type: 'marker', bar: bar, price: low ? cs[bar].l : cs[bar].h, shape: low ? 'up' : 'down', appearAt: bar }; }
      return { which: which, name: x.name, built: built, marks: [mark('1', x.bar1), mark('2', x.bar2)] };
    });
  }
  // after the answer: the line between the two swings and its two labels, on the chart of `which`
  function smtLines(b, which) {
    var s = b.truth.smt, p = s[which], f = smtFacts(b)[which], low = s.kind === 'low', tag = which === 'main' ? 'm' : 't';
    var word = low ? (f.p2 > f.p1 ? 'higher low' : 'lower low') : (f.p2 > f.p1 ? 'higher high' : 'lower high');
    return [
      { id: 'smt-l-' + tag, type: 'trend', a: { bar: p.p1.bar, price: f.p1 }, b: { bar: p.p2.bar, price: f.p2 }, appearAt: s.at },
      { id: 'smt-1-' + tag, type: 'label', bar: p.p1.bar, price: f.p1, text: low ? 'low แรก' : 'high แรก', pos: low ? 'below' : 'above', appearAt: s.at },
      { id: 'smt-2-' + tag, type: 'label', bar: p.p2.bar, price: f.p2, text: word, pos: low ? 'below' : 'above', appearAt: s.at }
    ];
  }
  // chips: P6.15 5:16, P6.16 5:38, P6.17 6:20 (either index can lead), P6.21 10:29 (trade the leader)
  function smtFeedback(r) {
    var f = smtFacts(r.built), lead = f[f.leader], lag = f[f.leader === 'main' ? 'twin' : 'main'], low = f.kind === 'low', fp = TJR.util.fmtPrice;
    var type = low ? 'bullish' : 'bearish', w1 = low ? 'higher low' : 'lower high', w2 = low ? 'lower low' : 'higher high';
    return { secs: [[6, 316], [6, 338], [6, 380], [6, 629]],
      text: 'ตัวนำคือ ' + lead.name + ' เพราะทำ ' + w1 + ' (' + fp(lead.p1) + ' → ' + fp(lead.p2) + ') ส่วน ' + lag.name + ' ยังทำ ' + w2 + ' (' + fp(lag.p1) + ' → ' + fp(lag.p2) +
        ') นี่คือ ' + type + ' SMT divergence ตัวเลขจากกราฟจำลอง ดัชนีไหนเป็นตัวนำก็ได้ ไม่ขึ้นกับว่าเป็น ES หรือ NQ และเขาเลือกเทรดตัวที่นำ' };
  }

  // ---------------------------------------------------------------- a round (everything a page needs, DOM-free)
  function freshSeed() { return (Math.floor(Math.random() * 2147483646) + 1); }
  function makeRound(mode, rng, last) {
    for (var tries = 0; tries < 8; tries++) {
      var pk = TJR.scenarios.random(rng, mode), b = pk.built, r = { mode: mode, def: pk.def, built: b };
      if (mode === 'replay') { r.replay = newReplay(b); return r; }
      if (mode === 'spot') { r.task = pickSpot(b, rng, last && last.task); if (r.task) return r; }
      if (mode === 'sessions') { r.lines = sessionStarts(b); return r; }
      if (mode === 'quiz') { r.q = pickQuiz(b, rng); if (r.q) return r; }
      if (mode === 'gap') { r.gap = gapRound(b, rng); if (r.gap.dir) return r; }
      if (mode === 'bos') { r.bq = pickBos(b, rng); if (r.bq) return r; }
      if (mode === 'smt') { r.smt = { swap: rng.chance(0.5), reveal: b.truth.smt.at }; return r; }
    }
    throw new Error('lab.makeRound: no round for ' + mode);
  }

  L.MODES = MODES; L.ANSWERS = ANSWERS; L.SESSION_KEYS = SESSION_KEYS; L.D4 = D4_TEXT; L.TICK = TICK;
  L.blank = blank; L.clean = clean; L.record = record; L.loadScore = loadScore; L.saveScore = saveScore; L.resetScore = resetScore;
  L.replayStart = replayStart; L.newReplay = newReplay; L.canDecide = canDecide; L.canStep = canStep; L.stepReplay = stepReplay;
  L.decide = decide; L.replayOverlays = replayOverlays; L.outcomeInfo = outcomeInfo; L.replayFeedback = replayFeedback;
  L.spotPrompt = spotPrompt; L.spotShape = spotShape; L.pickSpot = pickSpot;
  L.sessionStarts = sessionStarts; L.sessionSpan = sessionSpan; L.sessionTicks = sessionTicks; L.sessionView = sessionView; L.spotSetup = spotSetup; L.spotView = spotView;
  L.quizAnswers = quizAnswers; L.quizOptions = quizOptions; L.pickQuiz = pickQuiz; L.quizOverlay = quizOverlay; L.afterAllowed = afterAllowed;
  L.D4_L2 = D4_L2; L.isLevel2 = isLevel2; L.l2Chain = l2Chain; L.confluenceOverlays = confluenceOverlays;
  L.gapViewFrom = gapViewFrom; L.gapWindow = gapWindow; L.gapRound = gapRound; L.gapSlice = gapSlice; L.gapsIn = gapsIn; L.gapGrade = gapGrade; L.gapWhy = gapWhy; L.gapOverlays = gapOverlays;
  L.GAP_SECS = GAP_SECS; L.pickBos = pickBos; L.bosOverlays = bosOverlays; L.bosFeedback = bosFeedback;
  L.smtFacts = smtFacts; L.smtPanels = smtPanels; L.smtLines = smtLines; L.smtFeedback = smtFeedback;
  L.freshSeed = freshSeed; L.makeRound = makeRound;

  if (!doc || !TJR.layout || !TJR.chart || !TJR.chart.create) return;   // Node (tests): helpers only

  // ================================================================ 2 · page
  var M = TJR.motion.init();
  TJR.layout.mount({
    page: 'lab',
    close: { title: 'เอาไปใช้เป็นขั้นตอนของตัวเอง', line: 'checklist หนึ่งหน้าจากสิ่งที่คลิปสอน พร้อมช่องใส่กฎส่วนตัว', label: 'เปิด Playbook', href: 'playbook.html' }
  });

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function stamp(t) { return TJR.sessions.fmtET(t) + ' ET · ' + TJR.sessions.fmtThai(t) + ' น.'; }
  // a number is a second of the main clip, [clip, sec] or {clip, sec} (a scenario's chips) a playlist chip (`▶ #<clip> MM:SS`)
  function chipsHtml(secs) {
    return (secs || []).map(function (s) {
      if (Array.isArray(s)) return TJR.layout.chip(s[1], s[0]);
      return s && typeof s === 'object' ? TJR.layout.chip(s.sec, s.clip) : TJR.layout.chip(s);
    }).join('');
  }
  function setPressed(btn, on) { btn.setAttribute('aria-pressed', String(!!on)); }
  function fmt(p) { return TJR.util.fmtPrice(p); }
  var TF_NAME = { 1: '1m', 5: '5m', 15: '15m', 60: '1H', 240: '4H', 1440: 'D' };
  var SESSION_LABEL = { asiaHigh: 'Asia high', asiaLow: 'Asia low', londonHigh: 'London high', londonLow: 'London low' };
  var SESSION_COLOR = { asiaHigh: '--c-liq', asiaLow: '--c-liq', londonHigh: '--c-session', londonLow: '--c-session' };

  var INTRO = {
    replay: ['เล่นทีละแท่งจนราคากวาด level แล้วเลือก Long, Short หรือ รอ ให้ตรงกับขั้นตอนในคลิป ห้ามกดตอนที่เพิ่งกวาด รอโครงสร้างใหม่ขึ้นก่อน แล้วเข้าตอน pullback คะแนนนับที่การตัดสินใจ', [1350, 1410, 1530],
      ' ในแบบฝึกนี้ เว็บนี้ใส่เซ็ตอัพที่ confirmation ล้มไว้ราว 1 ใน 4 ข้อ (ตัวเลขของเว็บ ไม่ใช่สถิติจากคลิป) อัตราที่ระบบนี้ชนะจริง ' + TJR.layout.gap() +
        ' บางข้อเป็น setup เต็มระบบ ขั้น 2–3 (confirmation เป็น BOS หรือ inverse FVG แล้วราคาย่อเข้า FVG หรือ equilibrium) ' + chipsHtml([[1, 2144]])],
    spot: ['โจทย์สุ่มบนกราฟใหม่ คลิกบนกราฟเพื่อตอบ ผ่านถ้าใกล้จุดจริงไม่เกิน 1 แท่ง (เกณฑ์ของเว็บนี้) ตรวจแล้วจะเห็นตำแหน่งที่ถูกบนกราฟ', [315, 1350]],
    sessions: ['ลากเส้นสีทองสองเส้นไป Asia high กับ low และเส้นสีฟ้าสองเส้นไป London high กับ low ผ่านถ้าห่างไม่เกิน 4 tick (เกณฑ์ของเว็บนี้) แกนเวลาเป็น ET ช่วง session ตามที่คลิปใช้', [1875]],
    quiz: ['เส้นสีทองบนกราฟคือ level หนึ่ง ตอบว่ามันเป็น low-resistance, high-resistance, HTF หรือ session ตามที่คลิปแบ่ง', [2385, 2700, 1635]],
    gap: ['ขั้น 2–3: คลิกที่แท่งกลางของ fair value gap บนกราฟ gap คือช่องว่างระหว่างไส้ของแท่งแรกกับไส้ของแท่งที่สาม โดยมีแท่งใหญ่คั่นกลาง สีของแท่งแรกและแท่งที่สามไม่สำคัญ กติกา: คลิกตรงแท่งกลางของ gap ฝั่งที่โจทย์ระบุเท่านั้น (เกณฑ์ของเว็บนี้ ไม่ใช่จากคลิป) ตรวจแล้วจะเห็นกรอบของ gap ทุกอันในช่วงนี้', [[10, 251], [10, 189], [10, 606]]],
    bos: ['ขั้น 2–3: กราฟหยุดที่แท่งหนึ่ง (ลูกศร) เส้นทองคือ low หรือ high ล่าสุดที่เฝ้าอยู่ ตอบว่าแท่งนี้ทำให้เกิด break of structure หรือยัง ไส้ที่ทะลุไม่นับ ต้องมีแท่งที่ปิดเลย level', [[11, 153], [11, 263], [11, 502]]],
    smt: ['ขั้น 2–3: สองกราฟคือ ES และ NQ ในช่วงเวลาเดียวกัน ลูกศรคือ high แรกและ high ที่สอง (หรือ low แรกและ low ที่สอง) ของแต่ละดัชนี ตอบว่าดัชนีไหนเป็นตัวนำของการเคลื่อนไหว ซึ่งตำแหน่งซ้ายขวาสลับกันไปทุกข้อ', [[6, 316], [6, 338]]]
  };

  var S = { mode: null, ch: null, tw: null, run: 0, auto: 0, round: null, answered: false, last: null, pan: false, score: L.blank(), lastOk: null, rows: null };
  var el = {
    panel: $('#lab-panel'), tabs: $('[data-k="tabs"]'), score: $('[data-k="score"]'), intro: $('[data-k="intro"]'),
    host: $('[data-k="host"]'), hostB: $('[data-k="hostB"]'), paneB: $('[data-k="paneB"]'), stage: $('[data-k="stage"]'),
    lblA: $('[data-k="lblA"]'), lblB: $('[data-k="lblB"]'), sym: $('[data-k="sym"]'), tf: $('[data-k="tf"]'), meta: $('[data-k="meta"]'),
    ctrls: $('[data-k="ctrls"]'), prompt: $('[data-k="prompt"]'), choices: $('[data-k="choices"]'), fb: $('[data-k="fb"]'),
    out: $('[data-k="out"]'), next: $('[data-act="next"]'), nojs: $('[data-k="nojs"]')
  };
  if (el.nojs) el.nojs.hidden = true;
  if (el.next) el.next.hidden = false;

  function themeColor(name, fb) {
    try { var v = global.getComputedStyle(doc.documentElement).getPropertyValue(name).trim(); return v || fb; } catch (e) { return fb; }
  }
  function renderScore() {
    var s = S.score;
    function pill(label, val, tone) {
      return '<span class="score-pill"' + (tone ? ' data-tone="' + tone + '"' : '') + '><span>' + label + '</span><span class="score-pill__value">' + val + '</span></span>';
    }
    el.score.innerHTML = pill('ถูก', s.right + '/' + s.total, S.lastOk == null ? null : S.lastOk ? 'good' : 'bad') +
      pill('streak', s.streak, s.streak >= 3 ? 'good' : null) + pill('สูงสุด', s.best);
  }
  function scoreIt(correct, pts, out) {
    S.score = L.saveScore(S.mode, L.record(S.score, correct, pts, out));
    S.lastOk = correct;
    renderScore();
  }
  function showFb(good, html) {
    el.fb.hidden = false;
    el.fb.setAttribute('data-tone', good ? 'good' : 'bad');
    el.fb.innerHTML = html;
  }
  function scenarioLine(r) {
    return '<p class="lab-scn">สถานการณ์ ' + r.def.id + ' · ' + r.def.title + ' <span class="chips">' + chipsHtml(r.def.clip) + '</span></p>';
  }
  function levelLabel(T, id) {
    var l = T.levels.filter(function (x) { return x.id === id; })[0];
    return l ? l.label : id;
  }

  // ---------------------------------------------------------------- round lifecycle
  function teardown() {
    S.run++; S.auto++;
    if (S.tw) { try { S.tw.destroy(); } catch (e) { /* already gone */ } S.tw = null; S.ch = null; }   // the pair owns both charts
    if (S.ch) { try { S.ch.destroy(); } catch (e) { /* already gone */ } S.ch = null; }
    S.round = null; S.answered = false; S.rows = null;
    el.ctrls.innerHTML = ''; el.choices.innerHTML = ''; el.prompt.innerHTML = '';
    el.fb.hidden = true; el.fb.innerHTML = ''; el.out.hidden = true; el.out.innerHTML = '';
  }
  function newRound() {
    teardown();
    var round;
    try { round = L.makeRound(S.mode, TJR.rng.make(L.freshSeed()), S.last); }
    catch (e) {
      if (global.console) console.error(e);
      el.prompt.innerHTML = '<p>สร้างกราฟไม่สำเร็จ กด “ข้อใหม่” เพื่อลองอีกครั้ง</p>';
      return;
    }
    S.round = round; S.last = { task: round.task };
    var b = round.built;
    var twin = S.mode === 'smt';
    el.paneB.hidden = !twin; el.lblA.hidden = !twin; el.lblB.hidden = !twin;
    el.stage.classList.toggle('is-twin', twin);
    if (twin) {
      S.tw = TJR.chart.twin(el.host, el.hostB, { label: 'กราฟคู่ ES และ NQ ในช่วงเวลาเดียวกัน จุดตัดตรงกันทั้งสองกราฟ', interactive: true });
      S.ch = S.tw.a;
      el.sym.textContent = 'ES + NQ';
    } else {
      S.ch = TJR.chart.create(el.host, { label: 'กราฟจำลองสำหรับโหมด ' + S.mode + ' คลิกหรือลากได้ตามโจทย์', interactive: true });
      S.ch.setData(b);
      el.sym.textContent = b.meta.instrument;
    }
    el.tf.textContent = TF_NAME[b.meta.tf] || '';
    el.meta.textContent = '';
    MODE[S.mode].start(round);
  }

  // ---------------------------------------------------------------- Replay
  function setAuto(on) {
    var b = $('[data-rp="auto"]', el.ctrls);
    if (!b) return;
    setPressed(b, on); b.firstChild.nodeValue = on ? 'หยุด' : 'Auto';
  }
  var Rp = {
    start: function () {
      el.ctrls.innerHTML =
        '<button class="ctrl" type="button" data-rp="next">Next <span aria-hidden="true">▶</span></button>' +
        '<button class="ctrl" type="button" data-rp="auto" aria-pressed="false">Auto</button>';
      el.choices.innerHTML =
        '<button class="ctrl lab-choice lab-choice--long" type="button" data-choice="long">Long</button>' +
        '<button class="ctrl lab-choice lab-choice--short" type="button" data-choice="short">Short</button>' +
        '<button class="ctrl lab-choice" type="button" data-choice="wait">รอ</button>';
      Rp.show();
    },
    // draw the chart at the replay's bar and refresh the panel (overlays first, so new ones draw in)
    show: function () {
      var r = S.round.replay, b = r.built;
      S.ch.setOverlays(L.replayOverlays(b, r.bar, false));
      S.ch.reveal(r.bar);
      Rp.sync();
    },
    sync: function () {
      var r = S.round.replay, b = r.built, open = L.canDecide(r), step = L.canStep(r);
      el.meta.textContent = stamp(b.candles[r.bar].t);
      $$('[data-choice]', el.choices).forEach(function (x) { x.disabled = !open; });
      var nx = $('[data-rp="next"]', el.ctrls), au = $('[data-rp="auto"]', el.ctrls);
      if (nx) nx.disabled = !step;
      if (au) au.disabled = !step && !S.ch.info().playing;
      var l2 = L.isLevel2(b) ? '<p class="hint"><span class="tag">ขั้น 2–3</span> ข้อนี้ต้องครบสามอย่าง: confirmation (BOS หรือ inverse FVG) แล้วราคาย่อเข้า continuation (FVG หรือ equilibrium) แล้วแท่งปิดกลับออกตามทิศ <span class="chips">' + chipsHtml([[1, 2144]]) + '</span></p>' : '';
      el.prompt.innerHTML = (open
        ? '<h2>ตัดสินใจ</h2><p>ราคากวาด level แล้ว (ลูกศรบนกราฟ) เลือก Long, Short หรือ รอ รอได้ทีละแท่ง ตัวเลือกเปิดต่อไปทุกแท่ง</p>'
        : '<h2>กดไปจนราคากวาด level</h2><p>กด Next หรือ Auto เพื่อเดินทีละแท่ง ตัวเลือก Long, Short, รอ จะเปิดเมื่อราคากวาด level ' + chipsHtml([1350]) + '</p>') + l2;
    },
    next: function () {
      var r = S.round.replay;
      S.auto++; S.ch.pause();
      setAuto(false);
      L.stepReplay(r);
      Rp.show();
    },
    auto: function () {
      var r = S.round.replay, v = S.ch;
      if (v.info().playing) { S.auto++; v.pause(); setAuto(false); Rp.sync(); return; }
      if (!L.canStep(r)) return;
      var my = ++S.auto, run = S.run, b = r.built;
      setAuto(true);
      v.play({
        from: r.bar, to: b.truth.sweep.bar, barsPerSec: 6,
        onBar: function (j) {
          if (S.run !== run || my !== S.auto) return;
          r.bar = j;
          v.setOverlays(L.replayOverlays(b, j, false));
          Rp.sync();
        }
      }).then(function () {
        if (S.run !== run || my !== S.auto) return;
        setAuto(false); Rp.sync();
      });
    },
    decide: function (choice) {
      var r = S.round.replay, b = r.built, T = b.truth;
      S.auto++; S.ch.pause(); setAuto(false);
      var o = L.decide(r, choice);
      var l2 = L.isLevel2(b), fb = L.replayFeedback(o.code, T.side, l2);
      if (!o.final) {
        showFb(true, '<p><b>รอถูกแล้ว</b> ' + fb.text + ' <span class="chips">' + chipsHtml(fb.secs) + '</span></p>');
        Rp.show();
        return;
      }
      S.answered = true;
      scoreIt(o.correct);
      var ov = L.replayOverlays(b, r.bar, true);
      if (choice === 'long' || choice === 'short') {
        var k = b.candles[r.bar], lg = choice === 'long';
        ov = ov.concat([{ id: 'you', type: 'marker', bar: r.bar, price: lg ? k.l : k.h, shape: lg ? 'up' : 'down', appearAt: r.bar },
                        { id: 'you-l', type: 'label', bar: r.bar, price: lg ? k.l : k.h, text: lg ? 'คุณ Long' : 'คุณ Short', pos: lg ? 'below' : 'above', appearAt: r.bar }]);
      }
      S.ch.setOverlays(ov);
      $$('[data-choice]', el.choices).forEach(function (x) { x.disabled = true; });
      $$('button', el.ctrls).forEach(function (x) { x.disabled = true; });
      var w = T.entryWindow, h = '<p class="lab-verdict"><b>' + (o.correct ? 'ถูก' : 'ยังไม่ถูก') + '</b> ' + fb.text + ' <span class="chips">' + chipsHtml(fb.secs) + '</span></p>';
      if (w) {
        h += '<dl class="kv">';
        if (l2) {                                           // the chain, read from the candles (never the v1 HH / HL wording)
          L.l2Chain(b).forEach(function (row) { h += '<div><dt>' + row.label + '</dt><dd>' + row.text + '<br>' + stamp(b.candles[row.bar].t) + '</dd></div>'; });
        }
        h += '<div><dt>ช่วงเข้า (อ่านจากตัวอย่าง)</dt><dd>' + stamp(b.candles[w.from].t) + '<br>ถึง ' + stamp(b.candles[w.to].t) + '</dd></div>' +
          '<div><dt>จุดเข้าเป๊ะ ๆ</dt><dd>' + TJR.layout.gap() + ' <span class="chips">' + chipsHtml(l2 ? [L2_ENTRY] : [1485]) + '</span></dd></div></dl>';
      }
      showFb(o.correct, h + scenarioLine(S.round));
      var run = S.run, n = b.candles.length;
      S.ch.play({ from: r.bar, to: n - 1, barsPerSec: clamp((n - r.bar) / 6, 8, 60), onBar: function (j) { if (S.run === run) el.meta.textContent = stamp(b.candles[Math.min(j, n - 1)].t); } })
        .then(function () { if (S.run === run) Rp.outcome(); });
    },
    // the trade's result, shown apart from the score (D4)
    outcome: function () {
      var T = S.round.built.truth, info = L.outcomeInfo(S.round.built), long = T.side === 'long', l2 = L.isLevel2(S.round.built);
      var tag = '<span class="tag ' + (long ? 'tag--long' : 'tag--short') + '">' + (long ? 'Long' : 'Short') + '</span>';
      var h = '<h3>ผลของเทรดนี้ <span class="muted">แยกจากคะแนน</span></h3>';
      if (info.fail) {
        h += '<p>' + tag + ' <span class="tag tag--fail">' + (l2 ? 'setup ล้ม' : 'confirmation ล้ม') + '</span></p><p>' + (l2 ? 'ในกราฟจำลองนี้ confluence ที่ใช้เข้าไปต่อไม่ได้ ราคาไม่ถึงเป้า' : 'ในกราฟจำลองนี้ โครงสร้างที่ยืนยันแล้วไปต่อไม่ได้') + '</p>' +
          '<p class="lab-d4"><span class="badge-gap">' + info.text + '</span></p>';
      } else if (info.outcome === 'win' && T.target) {
        h += '<p>' + tag + ' <span class="tag tag--long">ถึงเป้า</span></p><p>ราคาไปถึง ' + fmt(T.target.price) + ' (' + levelLabel(T, T.target.levelId) + ')</p>';
      } else return;
      h += '<p class="hint">คะแนนนับที่การตัดสินใจตามขั้นตอนในคลิป ไม่ได้นับกำไรหรือขาดทุน</p>';
      el.out.hidden = false; el.out.innerHTML = h;
    }
  };

  // ---------------------------------------------------------------- Spot
  var Sp = {
    start: function (round) {
      var pr = L.spotPrompt(round.task, round.built);
      el.ctrls.innerHTML = '<span class="lf__hint">คลิกบนกราฟเพื่อตอบ</span>';
      el.prompt.innerHTML = '<h2>โจทย์</h2><p>' + pr.text + ' <span class="chips">' + chipsHtml(pr.secs) + '</span></p>';
      S.ch.setOverlays(L.spotSetup(round.built, round.task));
      var vw = L.spotView(round.built, round.task, S.ch.info().view);
      if (vw) S.ch.view(vw.from, vw.to);
      var run = S.run;
      S.ch.on('click', function (p) { if (S.run === run) Sp.answer(p); });
    },
    answer: function (p) {
      if (S.answered) return;
      var r = S.round, b = r.built, res = TJR.grade.spot(b, r.task, p.i, p.price);
      S.answered = true;
      scoreIt(res.correct);
      var ov = TJR.annotate(b, { upTo: b.candles.length - 1 }), exp = res.expected, shape = L.spotShape(r.task, b);
      if (exp) {
        ov.push({ id: 'spot-exp', type: 'marker', bar: exp.bar, price: exp.price, shape: shape, appearAt: 0 });
        ov.push({ id: 'spot-exp-l', type: 'label', bar: exp.bar, price: exp.price, text: 'คำตอบ', pos: shape === 'down' ? 'above' : 'below', appearAt: 0 });
      }
      if (!res.correct) ov.push({ id: 'spot-you', type: 'marker', bar: p.i, price: p.price, shape: 'x', appearAt: 0 });
      S.ch.setOverlays(ov);
      var h = '<p class="lab-verdict"><b>' + (res.correct ? 'ถูก' : 'ยังไม่ถูก') + '</b> ';
      h += exp ? 'ตำแหน่งที่ถูกอยู่ที่ ' + stamp(b.candles[exp.bar].t) + ' ราคา ' + fmt(exp.price) + ' (ลูกศร “คำตอบ” บนกราฟ)' : 'โจทย์นี้ตรวจไม่ได้';
      if (!res.correct && exp) h += ' คุณคลิกห่างไป ' + Math.abs(p.i - exp.bar) + ' แท่ง';
      showFb(res.correct, h + '</p>' + scenarioLine(r));
    }
  };

  // ---------------------------------------------------------------- Sessions
  function applyTouch() {
    var cv = $('canvas', el.host);
    if (cv) cv.style.touchAction = (S.pan || S.answered) ? 'pan-y' : 'none';
  }
  var Se = {
    start: function (round) {
      var ch = S.ch;
      S.pan = false;
      el.ctrls.innerHTML =
        '<button class="ctrl" type="button" data-se="check">ตรวจคำตอบ</button>' +
        '<button class="ctrl" type="button" data-se="pan" aria-pressed="false" title="เปิดไว้เมื่อจะเลื่อนหน้าผ่านกราฟบนมือถือ ปิดเมื่อจะลากเส้น">โหมดเลื่อนหน้า</button>' +
        '<span class="lf__hint">มือถือ: จะเลื่อนหน้าผ่านกราฟให้เปิดโหมดเลื่อนหน้า หรือแตะนอกกราฟ ปิดโหมดนี้เมื่อจะลากเส้น</span>';
      var h = '<h2>ลากเส้นให้ตรง session</h2><p>แกนเวลาเป็น ET Asia 18:00–03:00, London 03:00–08:30 <span class="chips">' + chipsHtml([1875]) + '</span></p><ul class="lab-rows">';
      L.SESSION_KEYS.forEach(function (k) {
        h += '<li class="lab-row" data-row="' + k + '"><label for="in-' + k + '"><span class="lab-dot lab-dot--' + (k.indexOf('asia') === 0 ? 'asia' : 'lon') + '"></span>' + SESSION_LABEL[k] + '</label>' +
          '<input id="in-' + k + '" class="lab-in" type="number" inputmode="decimal" step="0.25" value="' + round.lines[k].toFixed(2) + '">' +
          '<span class="lab-res" data-res></span></li>';
      });
      el.prompt.innerHTML = h + '</ul>';
      S.rows = {};
      var win = ch.info().view, sv = L.sessionView(round.built, win.to - win.from + 1);
      if (sv) {
        if (sv.tf !== round.built.meta.tf) { ch.setTimeframe(sv.tf); el.tf.textContent = TF_NAME[sv.tf] || ''; }
        ch.view(sv.from, sv.to);
      }
      L.SESSION_KEYS.forEach(function (k) { S.rows[k] = round.lines[k]; Se.line(k, round.lines[k]); });
      applyTouch();
      var run = S.run;
      ch.on('drag', function (e) {
        if (S.run !== run || S.answered || !S.rows || !(e.id in S.rows)) return;
        S.rows[e.id] = e.price;
        var inp = $('#in-' + e.id, el.prompt);
        if (inp) inp.value = e.price.toFixed(2);
      });
      ch.setOverlays([]);
    },
    line: function (k, price) {
      S.ch.addLine({ id: k, price: price, label: SESSION_LABEL[k], draggable: !S.answered, color: themeColor(SESSION_COLOR[k], null) });
    },
    check: function () {
      if (S.answered) return;
      var r = S.round, b = r.built, lines = {};
      L.SESSION_KEYS.forEach(function (k) { var p = S.ch.getLine(k); lines[k] = p == null ? S.rows[k] : p; });
      var res = TJR.grade.sessions(b.truth, lines);
      S.answered = true;
      scoreIt(res.score === 4, res.score, 4);
      L.SESSION_KEYS.forEach(function (k) {
        Se.line(k, lines[k]);
        var row = $('[data-row="' + k + '"]', el.prompt), it = res.items[k], t = L.sessionTicks(it);
        var inp = $('input', row); inp.value = lines[k].toFixed(2); inp.disabled = true;
        var out = $('[data-res]', row);
        out.setAttribute('data-ok', String(!!it.ok));
        out.textContent = t == null ? 'ตรวจไม่ได้' : (it.ok ? 'ผ่าน ' : 'ไม่ผ่าน ') + (t > 0 ? '+' : '') + t + ' tick';
      });
      applyTouch();
      S.ch.setOverlays(TJR.annotate(b, { upTo: b.candles.length - 1 }));
      $$('[data-se="check"]', el.ctrls).forEach(function (x) { x.disabled = true; });
      showFb(res.score === 4, '<p class="lab-verdict"><b>ถูก ' + res.score + ' จาก 4 เส้น</b> ผ่านถ้าห่างจากจริงไม่เกิน 4 tick (เกณฑ์ของเว็บนี้ 1 tick = 0.25) ตัวเลขข้างแต่ละเส้นคือระยะที่คลาด กล่องบนกราฟคือช่วง session จริง <span class="chips">' + chipsHtml([1875]) + '</span></p>' + scenarioLine(r));
    },
    input: function (inp) {
      var k = inp.id.replace('in-', '');
      if (S.answered || !S.rows || !(k in S.rows)) return;
      var v = parseFloat(inp.value);
      if (!isFinite(v)) { inp.value = S.rows[k].toFixed(2); return; }
      v = TJR.util.roundTick(v, 0.25);
      S.rows[k] = v; inp.value = v.toFixed(2);
      Se.line(k, v); applyTouch();
    },
    pan: function (btn) { S.pan = !S.pan; setPressed(btn, S.pan); applyTouch(); }
  };

  // ---------------------------------------------------------------- Quiz
  var QTEXT = {
    low: ['Low-resistance', 'กอง high หรือ low เรียงกันที่ยังไม่ถูกเก็บ ราคามักวิ่งไปเก็บ', [2385, 2565]],
    high: ['High-resistance', 'level ที่ราคาเพิ่งเก็บแล้วกลับตัวออกมา ราคากลับไปที่นั่นได้ยาก ให้เทรดไปทาง low-resistance แทน', [2700, 2790]],
    htf: ['HTF', 'high หรือ low ของไทม์เฟรมสูง (1H, 4H) หรือของวันก่อน น้ำหนักมากกว่า level ระดับ 5 นาที', [1710, 1755]],
    session: ['Session', 'high หรือ low ของ Asia, London หรือ NY ที่ตลาดมักวิ่งมาเก็บ', [1875, 2160]]
  };
  var Qz = {
    start: function (round) {
      var q = round.q, l = q.level;
      var ask = q.after ? 'ราคากวาด level สีทองนี้แล้วกลับตัวออกมา ตอนนี้มันเป็นแบบไหน'
        : l.sweptAt != null ? 'level สีทองนี้ ณ แท่งล่าสุดบนกราฟ เป็นแบบไหน' : 'level สีทองนี้ยังไม่ถูกเก็บ มันเป็นแบบไหน';
      el.ctrls.innerHTML = '<span class="lf__hint">ดูแกนเวลาและตำแหน่งของเส้น แล้วเลือกคำตอบ</span>';
      el.prompt.innerHTML = '<h2>โจทย์</h2><p>' + ask + '</p>';
      el.choices.innerHTML = L.ANSWERS.map(function (a) {
        return '<button class="ctrl lab-opt" type="button" data-ans="' + a + '">' + QTEXT[a][0] + '</button>';
      }).join('');
      S.ch.setOverlays([L.quizOverlay(q)]);
      S.ch.reveal(q.rev);
      el.meta.textContent = stamp(round.built.candles[q.rev].t);
    },
    answer: function (a) {
      if (S.answered) return;
      var r = S.round, q = r.q, b = r.built, ok = TJR.grade.quiz(q.level, a, { after: q.after });
      S.answered = true;
      scoreIt(ok);
      $$('[data-ans]', el.choices).forEach(function (x) {
        var v = x.getAttribute('data-ans');
        x.disabled = true;
        x.setAttribute('data-state', q.valid.indexOf(v) >= 0 ? 'right' : v === a ? 'wrong' : '');
      });
      var h = '<p class="lab-verdict"><b>' + (ok ? 'ถูก' : 'ยังไม่ใช่') + '</b> ' +
        (q.valid.length > 1 ? 'level นี้เข้าได้หลายแบบ ข้อที่นับว่าถูกคือ ' : 'คำตอบที่ถูกคือ ') + q.valid.map(function (v) { return QTEXT[v][0]; }).join(' และ ') + '</p><ul class="lab-why">';
      q.valid.forEach(function (v) { h += '<li><b>' + QTEXT[v][0] + '</b> ' + QTEXT[v][1] + ' <span class="chips">' + chipsHtml(QTEXT[v][2]) + '</span></li>'; });
      showFb(ok, h + '</ul>' + scenarioLine(r));
      var n = b.candles.length, run = S.run;
      S.ch.setOverlays(TJR.annotate(b, { upTo: n - 1 }));
      S.ch.play({ from: q.rev, to: n - 1, barsPerSec: clamp((n - q.rev) / 6, 8, 60), onBar: function (j) { if (S.run === run) el.meta.textContent = stamp(b.candles[Math.min(j, n - 1)].t); } });
    }
  };

  // ---------------------------------------------------------------- Gap finder (Level 2)
  var GAP_WORD = { up: 'bullish', down: 'bearish' };
  var GAP_WHY = {
    overlap: function (w) { return 'ไส้ของแท่งแรกกับแท่งที่สามซ้อนกัน ' + w.ticks + ' tick (ตัวเลขจากกราฟจำลอง) จึงไม่มีช่องว่าง'; },
    doji: function () { return 'แท่งกลางเป็นแท่งที่เปิดเท่าปิด ไม่ใช่แท่งใหญ่ที่พุ่งผ่านช่อง'; },
    edge: function () { return 'อยู่ขอบกราฟ ยังไม่มีแท่งแรกหรือแท่งที่สามครบ'; }
  };
  var Gp = {
    start: function (round) {
      var g = round.gap, b = round.built, bull = g.dir === 'bull';
      el.ctrls.innerHTML = '<span class="lf__hint">คลิกตรงแท่งกลางของ ' + GAP_WORD[bull ? 'up' : 'down'] + ' gap หนึ่งอัน</span>';
      el.prompt.innerHTML = '<h2>โจทย์</h2><p>คลิกที่แท่งกลางของ <b>' + GAP_WORD[bull ? 'up' : 'down'] + '</b> fair value gap บนกราฟ ' +
        (bull ? '(แท่งขึ้นใหญ่ที่คั่นระหว่างไส้บนของแท่งแรกกับไส้ล่างของแท่งที่สาม)' : '(แท่งลงใหญ่ที่คั่นระหว่างไส้ล่างของแท่งแรกกับไส้บนของแท่งที่สาม)') + ' ' +
        chipsHtml(bull ? L.GAP_SECS.up : L.GAP_SECS.down) +
        '</p><p class="hint">กติกา: คลิกตรงแท่งกลางของ gap ฝั่งที่โจทย์ระบุเท่านั้น (เกณฑ์ของเว็บนี้ ไม่ใช่จากคลิป)</p>';
      S.ch.setOverlays([]);
      S.ch.reveal(g.to);
      S.ch.view(gapViewFrom(g), g.to + 3);
      el.meta.textContent = stamp(b.candles[g.to].t);
      var run = S.run;
      S.ch.on('click', function (p) { if (S.run === run) Gp.answer(p); });
    },
    answer: function (p) {
      if (S.answered) return;
      var r = S.round, b = r.built, g = r.gap, res = L.gapGrade(b, g, p.i), exp = res.expected, all = L.gapsIn(b, g);
      var dir = g.dir === 'bull' ? 'up' : 'down';
      S.answered = true;
      scoreIt(res.correct);
      var ov = L.gapOverlays(b, g);
      if (exp) {
        var m = b.candles[exp.bar], bull = exp.dir === 'bull';
        ov.push({ id: 'gap-exp', type: 'marker', bar: exp.bar, price: bull ? m.l : m.h, shape: bull ? 'up' : 'down', appearAt: 0 });
        ov.push({ id: 'gap-exp-l', type: 'label', bar: exp.bar, price: bull ? m.l : m.h, text: 'แท่งกลาง', pos: bull ? 'below' : 'above', appearAt: 0 });
      }
      if (!res.correct) ov.push({ id: 'gap-you', type: 'marker', bar: p.i, price: p.price, shape: 'x', appearAt: 0 });
      S.ch.setOverlays(ov);
      var h = '<p class="lab-verdict"><b>' + (res.correct ? 'ถูก' : 'ยังไม่ถูก') + '</b> ', secs = GAP_SECS_FOR(dir);
      if (res.correct) {
        h += 'นี่คือ ' + GAP_WORD[dir] + ' fair value gap ช่องว่างระหว่าง ' + (dir === 'up' ? 'ไส้บนของแท่งแรกกับไส้ล่างของแท่งที่สาม' : 'ไส้ล่างของแท่งแรกกับไส้บนของแท่งที่สาม') +
          ' ราคา ' + fmt(exp.low) + ' – ' + fmt(exp.high);
      } else if (res.other) {
        h += 'แท่งที่คลิกเป็นแท่งกลางของ ' + GAP_WORD[res.other.dir === 'bull' ? 'up' : 'down'] + ' gap แต่โจทย์ถามฝั่ง ' + GAP_WORD[dir];
        if (exp) h += ' แท่งกลางของฝั่งที่ถามอยู่ที่ ' + stamp(b.candles[exp.bar].t) + ' (ลูกศร “แท่งกลาง”)';
      } else {
        var why = L.gapWhy(b.candles.slice(0, g.to + 1), p.i);
        h += why ? 'แท่งที่คลิกไม่ใช่แท่งกลางของ gap: ' + GAP_WHY[why.reason](why) : 'แท่งที่คลิกไม่ตรงแท่งกลางของ ' + GAP_WORD[dir] + ' gap ต้องคลิกตรงแท่งกลางพอดี';
        if (why && why.reason === 'overlap') secs = [[10, 606]];
        if (exp) h += ' แท่งกลางของฝั่งที่ถามที่ใกล้ที่สุดอยู่ที่ ' + stamp(b.candles[exp.bar].t) + ' (ลูกศร “แท่งกลาง”)';
      }
      h += ' <span class="chips">' + chipsHtml(secs) + '</span> ช่วงนี้มี gap ทั้งหมด ' + all.length + ' อัน กรอบสีเขียวคือ bullish สีแดงคือ bearish</p>';
      showFb(res.correct, h + scenarioLine(r));
    }
  };
  function GAP_SECS_FOR(dir) { return L.GAP_SECS[dir] || L.GAP_SECS.up; }

  // ---------------------------------------------------------------- Break or not (Level 2)
  var Bo = {
    start: function (round) {
      var q = round.bq, b = round.built, up = q.trend === 'up';
      el.ctrls.innerHTML = '<span class="lf__hint">ดูแท่งที่มีลูกศร เทียบกับเส้นทอง แล้วตอบ</span>';
      el.prompt.innerHTML = '<h2>โจทย์</h2><p>เทรนด์ตอนนี้คือ' + (up ? 'ขาขึ้น' : 'ขาลง') + ' เส้นทองคือ ' + (up ? 'low' : 'high') + ' ล่าสุดที่เฝ้าอยู่ แท่งที่มีลูกศรทำให้เกิด break of structure หรือยัง ' + chipsHtml([[11, 153], [11, 186]]) + '</p>';
      el.choices.innerHTML =
        '<button class="ctrl lab-opt" type="button" data-yn="yes">ใช่ เป็น break</button>' +
        '<button class="ctrl lab-opt" type="button" data-yn="no">ยังไม่ใช่</button>';
      S.ch.setOverlays(L.bosOverlays(round, false));
      S.ch.reveal(q.bar);
      el.meta.textContent = stamp(b.candles[q.bar].t);
    },
    answer: function (yes) {
      if (S.answered) return;
      var r = S.round, q = r.bq, b = r.built, res = TJR.grade.bos(b, q.bar, yes), right = res.expected;
      S.answered = true;
      scoreIt(res.correct);
      $$('[data-yn]', el.choices).forEach(function (x) {
        var v = x.getAttribute('data-yn') === 'yes';
        x.disabled = true;
        x.setAttribute('data-state', v === right ? 'right' : v === yes ? 'wrong' : '');
      });
      var fb = L.bosFeedback(q);
      S.ch.setOverlays(L.bosOverlays(r, true));
      showFb(res.correct, '<p class="lab-verdict"><b>' + (res.correct ? 'ถูก' : 'ยังไม่ถูก') + '</b> ' + fb.text + ' <span class="chips">' + chipsHtml(fb.secs) + '</span></p>' + scenarioLine(r));
      var n = b.candles.length, run = S.run;
      S.ch.play({ from: q.bar, to: n - 1, barsPerSec: clamp((n - q.bar) / 6, 8, 60), onBar: function (j) { if (S.run === run) el.meta.textContent = stamp(b.candles[Math.min(j, n - 1)].t); } });
    }
  };

  // ---------------------------------------------------------------- Which index leads (Level 2, twin charts)
  var Sm = {
    start: function (round) {
      var b = round.built, ps = L.smtPanels(round), at = round.smt.reveal, low = b.truth.smt.kind === 'low';
      el.ctrls.innerHTML = '<span class="lf__hint">ดูลูกศรสองจุดบนแต่ละกราฟ แล้วเลือกดัชนีที่เป็นตัวนำ</span>';
      el.prompt.innerHTML = '<h2>โจทย์</h2><p>ลูกศรบนแต่ละกราฟคือ ' + (low ? 'low แรกและ low ที่สอง' : 'high แรกและ high ที่สอง') + ' ของดัชนีนั้น ในช่วงเวลาเดียวกัน ดัชนีไหนเป็นตัวนำของการเคลื่อนไหว ' + chipsHtml([[6, 316], [6, 338]]) + '</p>';
      el.choices.innerHTML = ps.map(function (p) {
        return '<button class="ctrl lab-opt" type="button" data-sm="' + p.which + '">' + p.name + '</button>';
      }).join('');
      el.lblA.textContent = ps[0].name + ' · ซ้าย'; el.lblB.textContent = ps[1].name + ' · ขวา';
      S.tw.setData(ps[0].built, ps[1].built);
      S.tw.a.setOverlays(ps[0].marks); S.tw.b.setOverlays(ps[1].marks);
      S.tw.reveal(at);
      el.sym.textContent = ps[0].name + ' + ' + ps[1].name;
      el.meta.textContent = stamp(b.candles[at].t);
    },
    answer: function (which) {
      if (S.answered) return;
      var r = S.round, b = r.built, ps = L.smtPanels(r), res = TJR.grade.smt(b, which), right = res.expected;
      S.answered = true;
      scoreIt(res.correct);
      $$('[data-sm]', el.choices).forEach(function (x) {
        var v = x.getAttribute('data-sm');
        x.disabled = true;
        x.setAttribute('data-state', v === right ? 'right' : v === which ? 'wrong' : '');
      });
      S.tw.a.setOverlays(ps[0].marks.concat(L.smtLines(b, ps[0].which)));
      S.tw.b.setOverlays(ps[1].marks.concat(L.smtLines(b, ps[1].which)));
      var fb = L.smtFeedback(r);
      showFb(res.correct, '<p class="lab-verdict"><b>' + (res.correct ? 'ถูก' : 'ยังไม่ถูก') + '</b> ' + fb.text + ' <span class="chips">' + chipsHtml(fb.secs) + '</span></p>' + scenarioLine(r));
      var n = b.candles.length, run = S.run, at = r.smt.reveal;
      S.tw.play({ from: at, to: n - 1, barsPerSec: clamp((n - at) / 6, 8, 60), onBar: function (j) { if (S.run === run) el.meta.textContent = stamp(b.candles[Math.min(j, n - 1)].t); } });
    }
  };

  var MODE = { replay: Rp, spot: Sp, sessions: Se, quiz: Qz, gap: Gp, bos: Bo, smt: Sm };

  // ---------------------------------------------------------------- tabs, clicks
  function setMode(m, focus) {
    S.mode = m;
    $$('[data-mode]', el.tabs).forEach(function (t) {
      var on = t.getAttribute('data-mode') === m;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on) { el.panel.setAttribute('aria-labelledby', t.id); if (focus) t.focus(); }
    });
    el.intro.innerHTML = INTRO[m][0] + ' <span class="chips">' + chipsHtml(INTRO[m][1]) + '</span>' + (INTRO[m][2] || '');
    S.score = L.loadScore(m); S.lastOk = null;
    renderScore();
    TJR.store.set('lab.mode', m);
    newRound();
  }
  el.tabs.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-mode]') : null;
    if (t && t.getAttribute('data-mode') !== S.mode) setMode(t.getAttribute('data-mode'), false);
  });
  el.tabs.addEventListener('keydown', function (e) {
    var i = L.MODES.indexOf(S.mode), n = L.MODES.length, k = e.key, j = -1;
    if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % n;
    else if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i + n - 1) % n;
    else if (k === 'Home') j = 0;
    else if (k === 'End') j = n - 1;
    if (j < 0) return;
    e.preventDefault();
    setMode(L.MODES[j], true);
  });

  doc.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('button') : null;
    if (!t || t.disabled) return;
    var act = t.getAttribute('data-act'), v;
    if (act === 'reset') { S.score = L.resetScore(S.mode); S.lastOk = null; renderScore(); return; }
    if (!el.panel.contains(t)) return;
    if (act === 'next') { newRound(); return; }
    if (!S.round) return;
    if ((v = t.getAttribute('data-choice')) != null) { if (S.mode === 'replay') Rp.decide(v); }
    else if ((v = t.getAttribute('data-rp')) != null) { if (v === 'next') Rp.next(); else Rp.auto(); }
    else if ((v = t.getAttribute('data-se')) != null) { if (v === 'check') Se.check(); else Se.pan(t); }
    else if ((v = t.getAttribute('data-ans')) != null) Qz.answer(v);
    else if ((v = t.getAttribute('data-yn')) != null) Bo.answer(v === 'yes');
    else if ((v = t.getAttribute('data-sm')) != null) Sm.answer(v);
  });
  el.panel.addEventListener('change', function (e) {
    if (e.target && e.target.classList && e.target.classList.contains('lab-in') && S.mode === 'sessions') Se.input(e.target);
  });

  // read-only handle for the console and the headless checks
  L.view = function () {
    return { mode: S.mode, run: S.run, answered: S.answered, round: S.round, ch: S.ch, score: S.score, reduced: M.reduced };
  };

  // ---------------------------------------------------------------- start
  var saved = TJR.store.get('lab.mode', 'replay');
  try { setMode(L.MODES.indexOf(saved) >= 0 ? saved : 'replay', false); } catch (e) { if (global.console) console.error(e); }
})(typeof window !== 'undefined' ? window : globalThis);
