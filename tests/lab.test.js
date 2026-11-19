/* Exercise lab (Task 13): the pure logic of assets/js/pages/lab.js (score, replay round, spot, sessions, quiz) and the
   content rules on lab.html. lab.js is evaluated into this context (no DOM here: it only attaches TJR.lab).
   Wrapped in an IIFE (one shared vm scope). */
(function () {
  'use strict';
  (0, eval)(readText('assets/js/pages/lab.js'));
  var L = TJR.lab, LIST = TJR.scenarios.list;

  function rngOf(seed) { return TJR.rng.make(seed); }
  function lab(mode) { return LIST.filter(function (d) { return d.lab[mode]; }); }

  test('lab.record: points, streak, best; blank and corrupt input are cleaned', () => {
    var s = L.blank();
    eq(s, { right: 0, total: 0, streak: 0, best: 0 });
    s = L.record(s, true); s = L.record(s, true); s = L.record(s, true);
    eq(s, { right: 3, total: 3, streak: 3, best: 3 });
    s = L.record(s, false);
    eq(s, { right: 3, total: 4, streak: 0, best: 3 });
    s = L.record(s, true, 3, 4);                          // sessions: 3 of 4 lines, streak kept only on 4/4
    eq(s.right, 6); eq(s.total, 8);
    s = L.record(s, false, 3, 4);
    eq(s.streak, 0);
    eq(L.record(L.blank(), false, 9, 4).right, 4);        // points never exceed the round's total
    eq(L.clean(null), L.blank());
    eq(L.clean({ right: 'x', total: -3, streak: 2.9, best: NaN }), { right: 0, total: 0, streak: 2, best: 2 });
    eq(L.clean({ right: 9, total: 4, streak: 1, best: 0 }).right, 4);
  });

  test('lab score store: per-mode keys tjr.lab.<mode>, survives a throwing localStorage, reset clears', () => {
    L.resetScore('quiz');
    eq(L.loadScore('quiz'), L.blank());
    L.saveScore('quiz', L.record(L.blank(), true));
    eq(L.loadScore('quiz').right, 1);
    eq(L.loadScore('spot'), L.blank());                   // another mode is untouched
    L.resetScore('quiz');
    eq(L.loadScore('quiz'), L.blank());
    var saved = globalThis.localStorage;
    globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
    try {
      L.saveScore('replay', L.record(L.blank(), true));
      eq(L.loadScore('replay').right, 1);                 // the memory copy answers
    } finally { globalThis.localStorage = saved; L.resetScore('replay'); }
  });

  test('lab replay: choices open exactly from the sweep bar (sweep bar included), stepping stops there', () => {
    lab('replay').forEach((d) => {
      var b = TJR.scenarios.safeBuild(d, 3, {}), r = L.newReplay(b), sw = b.truth.sweep.bar;
      ok(r.bar < sw, d.id + ': starts before the sweep');
      ok(!L.canDecide(r), d.id + ': closed at the start');
      var guard = 0;
      while (L.canStep(r) && guard++ < 5000) { ok(r.bar < sw, d.id + ': never steps past the sweep'); L.stepReplay(r); }
      eq(r.bar, sw, d.id + ' stops on the sweep bar');
      ok(L.canDecide(r), d.id + ': open on the sweep bar');
      ok(!L.canStep(r));
    });
  });

  test('lab replay: the D2 walk. blind-sweep on the sweep bar, waits are ok until the window closes, one scored decision', () => {
    lab('replay').forEach((d) => {
      ['win', 'fail'].filter((o) => d.outcomes.indexOf(o) >= 0).forEach((o) => {
        var b = TJR.scenarios.safeBuild(d, 5, { outcome: o }), T = b.truth, w = T.entryWindow;
        // (1) long on the sweep bar is blind
        var r1 = L.newReplay(b); while (L.canStep(r1)) L.stepReplay(r1);
        var x = L.decide(r1, T.side);
        eq(x.code, 'blind-sweep', d.id + ' ' + o); ok(x.final && x.scored && !x.correct); ok(r1.over);
        eq(L.decide(r1, 'long').scored, false, 'a finished round scores nothing more');
        // (2) wait to the window, enter inside: correct, and the round saw only wait-ok before
        var r2 = L.newReplay(b); while (L.canStep(r2)) L.stepReplay(r2);
        var waits = 0, last = null;
        while (r2.bar < w.from) { last = L.decide(r2, 'wait'); eq(last.code, 'wait-ok'); ok(!last.final && !last.scored); waits++; }
        eq(r2.bar, w.from);
        var y = L.decide(r2, T.side);
        eq(y.code, 'in-window', d.id + ' ' + o); ok(y.correct && y.final);
        // (3) the other side is wrong-side, a late entry is late, a wait at the window's end is a miss
        var r3 = L.newReplay(b); while (L.canStep(r3)) L.stepReplay(r3);
        while (r3.bar < w.from) L.decide(r3, 'wait');
        eq(L.decide(r3, T.side === 'long' ? 'short' : 'long').code, 'wrong-side');
        var r4 = L.newReplay(b); while (L.canStep(r4)) L.stepReplay(r4);
        var z = null;
        while (!z || !z.final) z = L.decide(r4, 'wait');
        eq(z.code, 'missed'); ok(!z.correct && z.scored);
        eq(r4.bar, w.to, 'the miss is called when the window closes');
      });
    });
  });

  test('lab replay: the score is the decision, never the outcome (win and fail grade the same)', () => {
    lab('replay').filter((d) => d.outcomes.indexOf('fail') >= 0).forEach((d) => {
      var codes = ['win', 'fail'].map((o) => {
        var b = TJR.scenarios.safeBuild(d, 7, { outcome: o }), r = L.newReplay(b);
        while (L.canStep(r)) L.stepReplay(r);
        while (r.bar < b.truth.entryWindow.from) L.decide(r, 'wait');
        return L.decide(r, b.truth.side).code;
      });
      eq(codes, ['in-window', 'in-window'], d.id);
    });
  });

  test('lab replay: overlays during a round never pass the revealed bar and never carry labels, the entry zone or the target', () => {
    lab('replay').forEach((d) => {
      var b = TJR.scenarios.safeBuild(d, 11, {}), n = b.candles.length;
      for (var bar = L.replayStart(b); bar < n; bar += Math.max(1, Math.floor(n / 40))) {
        var ov = L.replayOverlays(b, bar, false);
        ov.forEach((o) => {
          ok(o.appearAt <= bar, d.id + ' ' + o.id + ' appears at ' + o.appearAt + ' but the chart is at ' + bar);
          ok(o.type !== 'label' && o.type !== 'zone' && o.id !== 'entry' && o.id !== 'target', d.id + ' leaks ' + o.id);
          ['from', 'to', 'bar'].forEach((k) => { if (typeof o[k] === 'number') ok(o[k] <= bar, d.id + ' ' + o.id + '.' + k + ' ' + o[k] + ' > ' + bar); });
          if (o.state === 'swept') ok(b.truth.levels.filter((l) => l.id === o.id)[0].sweptAt <= bar, d.id + ' ' + o.id + ' shown swept early');
        });
      }
      var full = L.replayOverlays(b, n - 1, true);
      ok(full.some((o) => o.id === 'entry') && full.some((o) => o.id === 'target'), d.id + ': the end shows the annotated truth');
    });
  });

  test('lab replay: outcome info carries the D4 badge on fail only, and the text is the one the spec names', () => {
    eq(L.D4, 'คลิปไม่ได้บอกวิธีจัดการเมื่อ confirmation ล้ม');
    lab('replay').forEach((d) => d.outcomes.forEach((o) => {
      var info = L.outcomeInfo(TJR.scenarios.safeBuild(d, 2, { outcome: o }));
      eq(info.d4, o === 'fail', d.id + ' ' + o);
      eq(info.outcome, o);
    }));
    var src = readText('assets/js/pages/lab.js');
    ok(src.indexOf('L.D4') >= 0 && src.indexOf('lab-d4') >= 0, 'the page renders the D4 badge on a fail outcome');
  });

  test('lab replay: every feedback code a replay can produce has a Thai text and at least one clip chip', () => {
    ['blind-sweep', 'wrong-side', 'early', 'in-window', 'late', 'wait-ok', 'missed', 'closed'].forEach((c) => {
      ['long', 'short'].forEach((side) => {
        var f = L.replayFeedback(c, side);
        ok(f.text && /[฀-๿]/.test(f.text), c + ' text');
        ok(f.secs.length >= 1 && f.secs.every((s) => s > 0 && s <= 49 * 60 + 7), c + ' chips');
      });
    });
    eq(L.replayFeedback('in-window', 'short').secs, [1530]);
    eq(L.replayFeedback('in-window', 'long').secs, [1410]);
  });

  test('lab spot: only supported tasks, expected is graded, the arrow sits under a low and over a high', () => {
    lab('spot').forEach((d) => {
      for (var seed = 1; seed <= 6; seed++) {
        var b = TJR.scenarios.safeBuild(d, seed, {}), tasks = TJR.grade.spotTasks(b), rng = rngOf(seed);
        ok(tasks.length >= 2, d.id + ' has spot tasks');
        for (var k = 0; k < 8; k++) {
          var t = L.pickSpot(b, rng, null);
          ok(tasks.indexOf(t) >= 0, d.id + ': task ' + t + ' is not offered by the grader');
          var res = TJR.grade.spot(b, t, 0, 0);
          ok(res.expected && typeof res.expected.bar === 'number', d.id + ' ' + t + ' has an expected point');
          ok(TJR.grade.spot(b, t, res.expected.bar, res.expected.price).correct, d.id + ' ' + t + ' correct on the expected bar');
          ok(['up', 'down'].indexOf(L.spotShape(t, b)) >= 0);
          var p = L.spotPrompt(t, b);
          ok(p.text && p.secs.length >= 1, t + ' prompt');
        }
        eq(L.spotShape('any-high', b), 'down'); eq(L.spotShape('any-low', b), 'up');
      }
    });
    var b2 = TJR.scenarios.safeBuild(TJR.scenarios.get('S01'), 1, {}), rng2 = rngOf(9), seen = {};
    for (var q = 0; q < 40; q++) seen[L.pickSpot(b2, rng2, 'sweep')] = 1;
    ok(!seen.sweep, 'the next task differs from the last one when there is a choice');
  });

  test('lab sessions: four starting lines apart from each other, ticks of a diff, grading by TJR.grade.sessions', () => {
    var defs = lab('sessions');
    eq(defs.map((d) => d.id), ['S06', 'S07', 'S08', 'S09']);
    defs.forEach((d) => {
      var b = TJR.scenarios.safeBuild(d, 4, {}), st = L.sessionStarts(b), vals = L.SESSION_KEYS.map((k) => st[k]);
      vals.forEach((v) => eq(v % 0.25, 0, d.id + ' on the tick grid'));
      eq(new Set(vals).size, 4, d.id + ' four different lines');
      var res = TJR.grade.sessions(b.truth, st);
      ok(res.score >= 0 && res.score <= 4);
      L.SESSION_KEYS.forEach((k) => ok(res.items[k] && res.items[k].diff !== null, d.id + ' ' + k + ' gradeable'));
      // the true prices score 4/4; the tick reading is signed
      var truth = {}, asia = b.truth.sessions.filter((s) => s.name === 'asia').pop(), lon = b.truth.sessions.filter((s) => s.name === 'london').pop();
      truth.asiaHigh = asia.high; truth.asiaLow = asia.low; truth.londonHigh = lon.high; truth.londonLow = lon.low;
      eq(TJR.grade.sessions(b.truth, truth).score, 4, d.id);
      var off = Object.assign({}, truth, { asiaHigh: truth.asiaHigh + 1.5 });
      var r2 = TJR.grade.sessions(b.truth, off);
      eq(L.sessionTicks(r2.items.asiaHigh), 6); ok(!r2.items.asiaHigh.ok);
      eq(L.sessionTicks({ diff: -1, ok: false }), -4);
      eq(L.sessionTicks({ diff: null, ok: false }), null);
    });
  });

  test('lab quiz: every quiz scenario asks a gradeable question; resistanceAfter only on win builds with a confirmation', () => {
    lab('quiz').forEach((d) => {
      var variants = d.outcomes.length ? d.outcomes : [null];
      variants.forEach((o) => {
        for (var seed = 1; seed <= 5; seed++) {
          var b = TJR.scenarios.safeBuild(d, seed, o ? { outcome: o } : {}), opts = L.quizOptions(b);
          ok(opts.length >= 1, d.id + ' ' + o + ' has a question');
          opts.forEach((q) => {
            ok(q.valid.length >= 1, d.id + ' ' + q.level.id + ' has a right answer');
            L.ANSWERS.forEach((a) => eq(TJR.grade.quiz(q.level, a, { after: q.after }), q.valid.indexOf(a) >= 0));
            ok(q.rev >= 0 && q.rev < b.candles.length);
            ok(q.rev >= (q.level.known != null ? q.level.known : q.level.bar), d.id + ' ' + q.level.id + ': the level is known at the revealed bar');
            if (q.level.sweptAt != null && !q.after) ok(q.rev < q.level.sweptAt, d.id + ': a before-question stops before the sweep');
            if (q.after) { ok(o === 'win', d.id + ': after only on a win build'); ok(b.truth.confirmBar != null); }
            var ov = L.quizOverlay(q);
            ok(ov.label === '?' && ov.to === q.rev && ov.from <= q.rev, 'the highlight gives no label and stops at the revealed bar');
          });
          var pick = L.pickQuiz(b, rngOf(seed));
          ok(pick && L.quizOptions(b).some((q) => q.level.id === pick.level.id && q.after === pick.after));
        }
      });
    });
    var fail = TJR.scenarios.safeBuild(TJR.scenarios.get('S01'), 3, { outcome: 'fail' });
    ok(L.quizOptions(fail).every((q) => !q.after), 'no resistanceAfter question on a fail build');
    eq(L.afterAllowed(fail), false);
  });

  test('lab.makeRound: every mode yields a round on a fresh seed; rapid rounds differ; scenarios match the mode flag', () => {
    L.MODES.forEach((m) => {
      var ids = {};
      for (var i = 1; i <= 25; i++) {
        var r = L.makeRound(m, rngOf(i * 7919), null);
        ok(r.def.lab[m], m + ': ' + r.def.id + ' is flagged for this mode');
        eq(TJR.scenarios.check(r.built), [], m + ' ' + r.def.id + ' invariants');
        if (m === 'replay') ok(r.replay && r.replay.bar < r.built.truth.sweep.bar);
        if (m === 'spot') ok(r.task);
        if (m === 'sessions') eq(Object.keys(r.lines).sort(), L.SESSION_KEYS.slice().sort());
        if (m === 'quiz') ok(r.q);
        ids[r.def.id] = 1;
      }
      ok(Object.keys(ids).length >= 3, m + ': varied scenarios across seeds');
    });
    var seeds = {};
    for (var k = 0; k < 20; k++) seeds[L.freshSeed()] = 1;
    ok(Object.keys(seeds).length > 15, 'fresh seeds differ');
  });

  test('lab.html: content rules (chips on teaching claims, gap badge, 4 tabs with roving tabindex, classic scripts only)', () => {
    var html = readText('lab.html'), js = readText('assets/js/pages/lab.js');
    eq((html.match(/role="tab"/g) || []).length, 4);
    eq((html.match(/tabindex="0"/g) || []).length >= 1, true);
    ok(html.indexOf('role="tablist"') > 0 && html.indexOf('role="tabpanel"') > 0);
    ok(html.indexOf('type="module"') < 0 && js.indexOf('import ') < 0 && js.indexOf('export ') < 0, 'classic scripts only');
    ok(html.indexOf('assets/js/pages/lab.js') > html.indexOf('assets/js/core/motion.js'));
    ok(js.indexOf('tjr.') < 0 || js.indexOf("'lab.'") >= 0, 'store keys go through TJR.store');
    ok(/youtu\.be/.test(readText('assets/js/core/ns.js')));
    ok(js.indexOf('TJR.layout.gap()') >= 0, 'the exact-entry gap is the shared badge');
    ok(html.indexOf('รีเซ็ตคะแนน') >= 0, 'reset button');
    ok(!/violet|lavender|#8b5cf6|#a78bfa/i.test(readText('assets/css/pages/lab.css')), 'never violet');
  });
})();
