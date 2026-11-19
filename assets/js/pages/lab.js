/* TJR Liquidity: the exercise lab (Task 13). Classic script, after the engine, layout and motion.

   1. pure helpers on TJR.lab (no DOM, tested in Node by tests/lab.test.js):
      score         blank / clean / record / loadScore / saveScore: per-mode right, total, streak, best (store key lab.<mode>)
      replay        newReplay / canDecide / canStep / stepReplay / decide: one scored decision per round (D1, D2, D4)
                    replayOverlays: what the chart may show at a bar (nothing past it until the round is over)
      spot          pickSpot / spotPrompt / spotShape
      sessions      sessionStarts / sessionTicks
      quiz          pickQuiz / quizAnswers / quizOverlay
   2. page: four modes on ONE live engine chart at a time (a round = TJR.scenarios.random(rng, mode); the chart is
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

  var MODES = ['replay', 'spot', 'sessions', 'quiz'];
  var ANSWERS = ['low', 'high', 'htf', 'session'];
  var SESSION_KEYS = ['asiaHigh', 'asiaLow', 'londonHigh', 'londonLow'];
  var TICK = 0.25;
  var D4_TEXT = 'คลิปไม่ได้บอกวิธีจัดการเมื่อ confirmation ล้ม';
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
  function replayOverlays(built, bar, over) {
    if (over) return TJR.annotate(built, { upTo: built.candles.length - 1 });
    return TJR.annotate(built, { upTo: bar }).filter(function (o) {
      return o.type !== 'label' && o.type !== 'zone' && o.id !== 'entry' && o.id !== 'target';
    });
  }
  function outcomeInfo(built) {
    var o = built.truth.outcome;
    return { outcome: o, fail: o === 'fail', d4: o === 'fail' };
  }
  function replayFeedback(code, side) {
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
    'sweep': 'คลิกแท่งที่ไส้ทะลุ level แล้วเก็บ liquidity เป็นครั้งแรกบนกราฟนี้',
    'entry-pivot-long': 'คลิก pullback ที่ให้จังหวะเข้า long คือ HL ตัวแรกหลัง HH ปรากฏ',
    'entry-pivot-short': 'คลิก pullback ที่ให้จังหวะเข้า short คือ LH ตัวแรกหลัง LL ปรากฏ'
  };
  var SPOT_SECS = { 'any-high': [315], 'any-low': [315], 'sweep': [90, 1350], 'entry-pivot-long': [1410], 'entry-pivot-short': [1530] };
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
  // four starting lines, spread over the chart's range and apart from each other
  function sessionStarts(built) {
    var lo = Infinity, hi = -Infinity;
    built.candles.forEach(function (c) { if (c.l < lo) lo = c.l; if (c.h > hi) hi = c.h; });
    function at(f) { return TJR.util.roundTick(lo + (hi - lo) * f, built.meta.tick || TICK); }
    return { asiaHigh: at(0.86), asiaLow: at(0.14), londonHigh: at(0.66), londonLow: at(0.34) };
  }
  function sessionTicks(item) { return !item || item.diff == null ? null : Math.round(item.diff / TICK); }

  // ---------------------------------------------------------------- quiz
  // answers (of htf / session / low / high) the grader accepts for a level in a state
  function quizAnswers(level, after) {
    return ANSWERS.filter(function (a) { return TJR.grade.quiz(level, a, { after: !!after }); });
  }
  // resistanceAfter is asked only on win builds that print a confirmation (never on a fail variant)
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
      if (swept && afterAllowed(built)) {
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

  // ---------------------------------------------------------------- a round (everything a page needs, DOM-free)
  function freshSeed() { return (Math.floor(Math.random() * 2147483646) + 1); }
  function makeRound(mode, rng, last) {
    for (var tries = 0; tries < 8; tries++) {
      var pk = TJR.scenarios.random(rng, mode), b = pk.built, r = { mode: mode, def: pk.def, built: b };
      if (mode === 'replay') { r.replay = newReplay(b); return r; }
      if (mode === 'spot') { r.task = pickSpot(b, rng, last && last.task); if (r.task) return r; }
      if (mode === 'sessions') { r.lines = sessionStarts(b); return r; }
      if (mode === 'quiz') { r.q = pickQuiz(b, rng); if (r.q) return r; }
    }
    throw new Error('lab.makeRound: no round for ' + mode);
  }

  L.MODES = MODES; L.ANSWERS = ANSWERS; L.SESSION_KEYS = SESSION_KEYS; L.D4 = D4_TEXT; L.TICK = TICK;
  L.blank = blank; L.clean = clean; L.record = record; L.loadScore = loadScore; L.saveScore = saveScore; L.resetScore = resetScore;
  L.replayStart = replayStart; L.newReplay = newReplay; L.canDecide = canDecide; L.canStep = canStep; L.stepReplay = stepReplay;
  L.decide = decide; L.replayOverlays = replayOverlays; L.outcomeInfo = outcomeInfo; L.replayFeedback = replayFeedback;
  L.spotPrompt = spotPrompt; L.spotShape = spotShape; L.pickSpot = pickSpot;
  L.sessionStarts = sessionStarts; L.sessionTicks = sessionTicks;
  L.quizAnswers = quizAnswers; L.quizOptions = quizOptions; L.pickQuiz = pickQuiz; L.quizOverlay = quizOverlay; L.afterAllowed = afterAllowed;
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
  function chipsHtml(secs) { return (secs || []).map(function (s) { return TJR.layout.chip(s); }).join(''); }
  function setPressed(btn, on) { btn.setAttribute('aria-pressed', String(!!on)); }
  function fmt(p) { return TJR.util.fmtPrice(p); }
  var TF_NAME = { 1: '1m', 5: '5m', 15: '15m', 60: '1H', 240: '4H', 1440: 'D' };
  var SESSION_LABEL = { asiaHigh: 'Asia high', asiaLow: 'Asia low', londonHigh: 'London high', londonLow: 'London low' };
  var SESSION_COLOR = { asiaHigh: '--c-liq', asiaLow: '--c-liq', londonHigh: '--c-session', londonLow: '--c-session' };

  var INTRO = {
    replay: ['เล่นทีละแท่งจนราคากวาด level แล้วเลือก Long, Short หรือ รอ ให้ตรงกับขั้นตอนในคลิป ห้ามกดตอนที่เพิ่งกวาด รอโครงสร้างใหม่ขึ้นก่อน แล้วเข้าตอน pullback ราว 1 ใน 4 ของเซ็ตอัพจะไปต่อไม่ได้ คะแนนยังนับที่การตัดสินใจ', [1350, 1410, 1530]],
    spot: ['โจทย์สุ่มบนกราฟใหม่ คลิกบนกราฟเพื่อตอบ ผ่านถ้าใกล้จุดจริงไม่เกิน 1 แท่ง ตรวจแล้วจะเห็นตำแหน่งที่ถูกบนกราฟ', [315, 1350]],
    sessions: ['ลากเส้นสีทองสองเส้นไป Asia high กับ low และเส้นสีฟ้าสองเส้นไป London high กับ low ผ่านถ้าห่างไม่เกิน 4 tick แกนเวลาเป็น ET ช่วง session ตามที่คลิปใช้', [1875]],
    quiz: ['เส้นสีทองบนกราฟคือ level หนึ่ง ตอบว่ามันเป็น low-resistance, high-resistance, HTF หรือ session ตามที่คลิปแบ่ง', [2385, 2700, 1635]]
  };

  var S = { mode: null, ch: null, run: 0, auto: 0, round: null, answered: false, last: null, pan: false, score: L.blank(), lastOk: null, rows: null };
  var el = {
    panel: $('#lab-panel'), tabs: $('[data-k="tabs"]'), score: $('[data-k="score"]'), intro: $('[data-k="intro"]'),
    host: $('[data-k="host"]'), sym: $('[data-k="sym"]'), tf: $('[data-k="tf"]'), meta: $('[data-k="meta"]'),
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
    S.ch = TJR.chart.create(el.host, { label: 'กราฟจำลองสำหรับโหมด ' + S.mode + ' คลิกหรือลากได้ตามโจทย์', interactive: true });
    S.ch.setData(b);
    el.sym.textContent = b.meta.instrument;
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
      el.prompt.innerHTML = open
        ? '<h2>ตัดสินใจ</h2><p>ราคากวาด level แล้ว (ลูกศรบนกราฟ) เลือก Long, Short หรือ รอ รอได้ทีละแท่ง ตัวเลือกเปิดต่อไปทุกแท่ง</p>'
        : '<h2>กดไปจนราคากวาด level</h2><p>กด Next หรือ Auto เพื่อเดินทีละแท่ง ตัวเลือก Long, Short, รอ จะเปิดเมื่อราคากวาด level ' + chipsHtml([1350]) + '</p>';
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
      var fb = L.replayFeedback(o.code, T.side);
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
        h += '<dl class="kv"><div><dt>ช่วงเข้า (อ่านจากตัวอย่าง)</dt><dd>' + stamp(b.candles[w.from].t) + '<br>ถึง ' + stamp(b.candles[w.to].t) + '</dd></div>' +
          '<div><dt>จุดเข้าเป๊ะ ๆ</dt><dd>' + TJR.layout.gap() + ' <span class="chips">' + chipsHtml([1485]) + '</span></dd></div></dl>';
      }
      showFb(o.correct, h + scenarioLine(S.round));
      var run = S.run, n = b.candles.length;
      S.ch.play({ from: r.bar, to: n - 1, barsPerSec: clamp((n - r.bar) / 6, 8, 60), onBar: function (j) { if (S.run === run) el.meta.textContent = stamp(b.candles[Math.min(j, n - 1)].t); } })
        .then(function () { if (S.run === run) Rp.outcome(); });
    },
    // the trade's result, shown apart from the score (D4)
    outcome: function () {
      var T = S.round.built.truth, info = L.outcomeInfo(S.round.built), long = T.side === 'long';
      var tag = '<span class="tag ' + (long ? 'tag--long' : 'tag--short') + '">' + (long ? 'Long' : 'Short') + '</span>';
      var h = '<h3>ผลของเทรดนี้ <span class="muted">แยกจากคะแนน</span></h3>';
      if (info.fail) {
        h += '<p>' + tag + ' <span class="tag tag--fail">confirmation ล้ม</span></p><p>ในกราฟจำลองนี้ โครงสร้างที่ยืนยันแล้วไปต่อไม่ได้</p>' +
          '<p class="lab-d4"><span class="badge-gap">' + L.D4 + '</span></p>';
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
      S.ch.setOverlays([]);
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
      showFb(res.score === 4, '<p class="lab-verdict"><b>ถูก ' + res.score + ' จาก 4 เส้น</b> ผ่านถ้าห่างจากจริงไม่เกิน 4 tick (1 tick = 0.25) ตัวเลขข้างแต่ละเส้นคือระยะที่คลาด กล่องบนกราฟคือช่วง session จริง <span class="chips">' + chipsHtml([1875]) + '</span></p>' + scenarioLine(r));
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
      var ask = q.after ? 'ราคากวาด level สีทองนี้แล้วกลับตัวออกมาแล้ว ตอนนี้มันเป็นแบบไหน'
        : l.sweptAt != null ? 'level สีทองนี้ ก่อนราคาจะไปแตะมัน เป็นแบบไหน' : 'level สีทองนี้ยังไม่ถูกเก็บ มันเป็นแบบไหน';
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

  var MODE = { replay: Rp, spot: Sp, sessions: Se, quiz: Qz };

  // ---------------------------------------------------------------- tabs, clicks
  function setMode(m, focus) {
    S.mode = m;
    $$('[data-mode]', el.tabs).forEach(function (t) {
      var on = t.getAttribute('data-mode') === m;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on) { el.panel.setAttribute('aria-labelledby', t.id); if (focus) t.focus(); }
    });
    el.intro.innerHTML = INTRO[m][0] + ' <span class="chips">' + chipsHtml(INTRO[m][1]) + '</span>';
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
