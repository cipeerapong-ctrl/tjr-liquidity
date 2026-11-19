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

  // C1: the quiz never grades the opposite of the clip (F8.1: an untaken stack is low-resistance; F8.6: a level price
  // reversed from is high-resistance)
  test('lab quiz: no round grades the opposite of the clip, over many seeds (after only for levels price reversed from)', () => {
    var after = 0, before = 0, seen = {};
    for (var seed = 1; seed <= 400; seed++) {
      var r = L.makeRound('quiz', rngOf(seed * 104729), null), q = r.q, l = q.level, b = r.built;
      seen[r.def.id] = 1;
      if (q.after) {
        after++;
        eq(l.resistanceAfter, 'high', r.def.id + ' ' + l.id + ': an after-question only on a level price reversed from');
        ok(q.valid.indexOf('low') < 0, r.def.id + ' ' + l.id + ': never accepts low-resistance after the sweep');
        ok(l.sweptAt != null && l.sweptAt <= q.rev, 'the level is swept at the revealed bar');
        eq(b.truth.outcome, 'win'); ok(b.truth.confirmBar != null);
      } else {
        before++;
        ok(q.valid.indexOf('high') < 0, r.def.id + ' ' + l.id + ': high-resistance is never a before-answer');
        if (q.valid.indexOf('low') >= 0) ok(l.sweptAt == null || l.sweptAt > q.rev, 'low-resistance only while the level is untaken');
      }
      // every option the grader can ask, not only the picked one
      L.quizOptions(b).forEach(function (o) {
        if (o.after) eq(o.level.resistanceAfter, 'high', r.def.id + ': ' + o.level.id);
        if (o.valid.indexOf('low') >= 0) ok(!o.after, r.def.id + ': low-resistance is never an after-answer');
      });
    }
    ok(after > 0 && before > 0, 'both kinds of question still occur: ' + after + ' after / ' + before + ' before');
    ok(Object.keys(seen).length >= 3, 'varied scenarios');
  });

  // I1: the sweep task draws what its prompt names, and nothing drawn is taken before the answer
  test('lab spot: the sweep task draws the levels it refers to, untaken until the sweep bar', () => {
    var checked = 0;
    for (var seed = 1; seed <= 120; seed++) {
      var r = L.makeRound('spot', rngOf(seed * 7907), null);
      var b = r.built, T = b.truth;
      if (r.task !== 'sweep') {
        eq(L.spotSetup(b, r.task), [], 'only the sweep task draws setup levels');
        continue;
      }
      var ov = L.spotSetup(b, 'sweep'), lv = ov.filter(function (o) { return o.type === 'level'; });
      ok(lv.some(function (o) { return o.id === T.sweep.levelId; }), r.def.id + ': the level that gets swept is drawn');
      ov.forEach(function (o) {
        ok(o.appearAt < T.sweep.bar, 'known before the sweep');
        if (o.type === 'level') {
          eq(o.state, 'active', 'no swept state before the answer');
          ok(o.to <= T.sweep.bar - 1);
          var tl = T.levels.filter(function (x) { return x.id === o.id; })[0];
          for (var i = tl.known; i < T.sweep.bar; i++) {
            var c = b.candles[i], hit = tl.side === 'high' ? c.h >= tl.price : c.l <= tl.price;
            ok(!hit, r.def.id + ' ' + o.id + ': bar ' + i + ' takes a drawn level before the sweep bar');
          }
        }
      });
      checked++;
    }
    ok(checked >= 10, 'sweep tasks were exercised: ' + checked);
    ok(L.spotPrompt('sweep', TJR.scenarios.safeBuild(TJR.scenarios.get('S01'), 1, {})).text.indexOf('ที่มาร์กไว้บนกราฟ') > 0, 'the prompt names the marked level');
  });

  // I2: at a 358 px phone (192 bar slots) the bars the round grades are inside the view the lab sets
  test('lab views: Sessions and Spot show the graded bars on 358 / 320 px phones and on desktop', () => {
    function lastLE(series, t) { var j = 0; for (var i = 0; i < series.length; i++) if (series[i].t <= t) j = i; return j; }
    [358, 320, 850].forEach(function (w) {
      var slots = Math.floor((w - 70) / 1.5), sessions = 0, spots = 0;
      for (var seed = 1; seed <= 60; seed++) {
        var rs = L.makeRound('sessions', rngOf(seed * 6151), null), b = rs.built, base = b.meta.tf;
        var v = L.sessionView(b, slots), series = v.tf === base ? b.candles : TJR.gen.rollup(b.candles, base, v.tf);
        ok(v.tf >= base && v.tf % base === 0, 'a whole roll-up of the base timeframe');
        ok(v.to - v.from + 1 <= slots, rs.def.id + ' @' + w + ': window ' + (v.to - v.from + 1) + ' > ' + slots + ' slots at ' + v.tf + 'm');
        ['asia', 'london'].forEach(function (nm) {
          var s = b.truth.sessions.filter(function (x) { return x.name === nm; }).pop(), hi = s.from, lo = s.from;
          for (var i = s.from; i <= s.to; i++) { if (b.candles[i].h > b.candles[hi].h) hi = i; if (b.candles[i].l < b.candles[lo].l) lo = i; }
          [hi, lo].forEach(function (i) {
            var j = lastLE(series, b.candles[i].t);
            ok(j >= v.from && j <= v.to, rs.def.id + ' @' + w + ': the ' + nm + ' extreme (bar ' + i + ' -> ' + j + ') is inside ' + v.from + '..' + v.to);
          });
        });
        sessions++;
        var rp = L.makeRound('spot', rngOf(seed * 3571), null), pb = rp.built, n = pb.candles.length;
        var margin = Math.max(2, Math.round(Math.min(n, slots) * 0.04)), toFit = n - 1 + margin;
        var fit = { from: Math.max(0, toFit + 1 - slots), to: toFit };
        var sv = L.spotView(pb, rp.task, fit), exp = TJR.grade.spot(pb, rp.task, 0, 0).expected;
        if (rp.task === 'sweep' || rp.task === 'entry-pivot') {
          var view = sv || fit;
          ok(exp.bar >= view.from && exp.bar <= Math.min(view.to, n - 1), rp.def.id + ' ' + rp.task + ' @' + w + ': bar ' + exp.bar + ' is clickable in ' + view.from + '..' + view.to);
          if (sv) ok(sv.to - sv.from <= fit.to - fit.from, 'the window keeps the slot count');
          spots++;
        } else eq(sv, null, 'any-high / any-low keep the fit');
      }
      ok(sessions === 60 && spots > 0, 'both views were exercised @' + w);
    });
  });

  // I3: the 1-in-4 is the site own mix, never a clip statistic
  test('lab replay intro: the 1-in-4 fail mix is labelled as the site number, and the win rate stays a gap', () => {
    var js = readText('assets/js/pages/lab.js');
    ok(js.indexOf('ราว 1 ใน 4 ของเซ็ตอัพจะไปต่อไม่ได้') < 0, 'the old wording is gone');
    ok(js.indexOf('ตัวเลขของเว็บ ไม่ใช่สถิติจากคลิป') > 0, 'labelled as the site number');
    ok(js.indexOf("อัตราที่ระบบนี้ชนะจริง ' + TJR.layout.gap()") > 0, 'win rate is the gap badge');
  });

  // I2 (vertical): the engine fits the price range to the visible bars, so the draggable lines must start inside the session window's range
  test('lab sessions: the four starting lines sit inside the price range of the session window, off the true levels, apart', () => {
    for (var seed = 1; seed <= 80; seed++) {
      var r = L.makeRound('sessions', rngOf(seed * 2713), null), b = r.built, st = r.lines, v = L.SESSION_KEYS.map((k) => st[k]);
      var lo = Infinity, hi = -Infinity;
      var sp = L.sessionSpan(b);
      for (var i = sp.from; i <= sp.to; i++) { lo = Math.min(lo, b.candles[i].l); hi = Math.max(hi, b.candles[i].h); }
      v.forEach((p, i) => ok(p >= lo && p <= hi, r.def.id + ' ' + L.SESSION_KEYS[i] + ' ' + p + ' inside ' + lo + '..' + hi));
      eq(new Set(v).size, 4, 'four different lines');
      eq(TJR.grade.sessions(b.truth, st).score, 0, r.def.id + ' no line starts on a true level');
    }
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
