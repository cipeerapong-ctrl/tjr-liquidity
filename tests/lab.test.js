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
        if (m === 'gap') ok(r.gap && r.gap.from < r.gap.to && (r.gap.dir === 'bull' || r.gap.dir === 'bear'));
        if (m === 'bos') ok(r.bq);
        if (m === 'smt') ok(r.smt && typeof r.smt.swap === 'boolean');
        ids[r.def.id] = 1;
      }
      ok(Object.keys(ids).length >= Math.min(3, lab(m).length), m + ': varied scenarios across seeds');
    });
    var seeds = {};
    for (var k = 0; k < 20; k++) seeds[L.freshSeed()] = 1;
    ok(Object.keys(seeds).length > 15, 'fresh seeds differ');
  });

  test('lab.html: content rules (chips on teaching claims, gap badge, 4 tabs with roving tabindex, classic scripts only)', () => {
    var html = readText('lab.html'), js = readText('assets/js/pages/lab.js');
    eq((html.match(/role="tab"/g) || []).length, 7);
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

  // ================================================================ Level 2 in Replay (S15 / S16 / S22 carry truth.confluence)
  var L2IDS = ['S15', 'S16', 'S22'];
  function l2builds(cb) {
    L2IDS.forEach(function (id) {
      var d = TJR.scenarios.get(id);
      d.outcomes.forEach(function (o) { for (var seed = 1; seed <= 60; seed++) cb(d, TJR.scenarios.safeBuild(d, seed, { outcome: o }), seed, o); });
    });
  }

  test('lab replay on S15 / S16 / S22 (seeds 1..60, win and fail): grade.replay codes hold at the sweep, confirm, entry and after', () => {
    var seen = {};
    l2builds(function (d, b, seed, o) {
      var T = b.truth, K = T.confluence, w = T.entryWindow, side = T.side, other = side === 'long' ? 'short' : 'long', G = TJR.grade;
      var tag = d.id + ' seed ' + seed + ' ' + o + ': ';
      ok(K && T.sweep && w && (side === 'long' || side === 'short'), tag + 'a trade setup');
      ok(T.sweep.bar < K.confirm.at, tag + 'the confirmation comes after the sweep');
      ok(K.confirm.at < w.from, tag + 'the entry window opens after the confirmation (bar ' + K.confirm.at + ' / ' + w.from + ')');
      eq(w.from, K.entry.at, tag + 'the window opens on the entry close');
      ok(w.to >= w.from, tag + 'the window holds at least the entry bar');
      // at or before the sweep: blind, whatever the side
      [T.sweep.bar - 4, T.sweep.bar].forEach(function (bar) {
        [side, other].forEach(function (c) { eq(G.replay(T, bar, c).code, 'blind-sweep', tag + c + '@' + bar); });
        eq(G.replay(T, bar, 'wait').code, 'wait-ok');
      });
      // confirm bar and the bars between it and the entry: right side is early, wrong side is wrong-side
      [T.sweep.bar + 1, K.confirm.at, w.from - 1].forEach(function (bar) {
        eq(G.replay(T, bar, side).code, 'early', tag + 'early@' + bar);
        eq(G.replay(T, bar, other).code, 'wrong-side', tag + 'wrong@' + bar);
        eq(G.replay(T, bar, 'wait').code, 'wait-ok', tag + 'wait@' + bar);
      });
      // the entry window
      [w.from, w.to].forEach(function (bar) {
        var r = G.replay(T, bar, side);
        eq([r.code, r.correct], ['in-window', true], tag + 'in-window@' + bar);
        eq(G.replay(T, bar, other).code, 'wrong-side');
      });
      eq(G.replay(T, w.to, 'wait').code, 'missed', tag + 'a wait on the last window bar is a miss');
      if (w.from < w.to) eq(G.replay(T, w.from, 'wait').code, 'wait-ok');
      // after the window
      if (w.to + 1 < b.candles.length) {
        eq(G.replay(T, w.to + 1, side).code, 'late', tag + 'late');
        eq(G.replay(T, w.to + 1, 'wait').code, 'missed');
      }
      seen[d.id + o] = 1;
    });
    eq(Object.keys(seen).sort(), ['S15fail', 'S15win', 'S16fail', 'S16win', 'S22win']);
  });

  test('lab replay on a Level 2 chart: the round walk (decide / canDecide / canStep) behaves like v1, win and fail graded alike', () => {
    L2IDS.forEach(function (id) {
      var d = TJR.scenarios.get(id);
      d.outcomes.forEach(function (o) {
        for (var seed = 1; seed <= 15; seed++) {
          var b = TJR.scenarios.safeBuild(d, seed, { outcome: o }), T = b.truth, w = T.entryWindow;
          var r = L.newReplay(b);
          ok(r.bar < T.sweep.bar, id + ': starts before the sweep');
          while (L.canStep(r)) L.stepReplay(r);
          eq(r.bar, T.sweep.bar);
          var res = null, guard = 0;
          while (r.bar < w.from && guard++ < 400) { res = L.decide(r, 'wait'); eq(res.code, 'wait-ok'); ok(!res.final); }
          eq(r.bar, w.from, id + ' seed ' + seed + ' ' + o + ': waits walk to the entry bar');
          res = L.decide(r, T.side);
          eq([res.code, res.correct, res.final, res.scored], ['in-window', true, true, true], id + ' seed ' + seed + ' ' + o);
          var r2 = L.newReplay(b); while (L.canStep(r2)) L.stepReplay(r2);
          var z = null; guard = 0; while ((!z || !z.final) && guard++ < 400) z = L.decide(r2, 'wait');
          eq([z.code, r2.bar], ['missed', w.to], id + ' seed ' + seed + ' ' + o + ': the miss is called when the window closes');
        }
      });
    });
  });

  test('lab replay on a Level 2 chart: the explanation is the Level 2 chain, never the v1 HH / HL wording, and its chips are playlist chips', () => {
    ['blind-sweep', 'wrong-side', 'early', 'in-window', 'late', 'wait-ok', 'missed', 'closed'].forEach(function (c) {
      ['long', 'short'].forEach(function (side) {
        var f = L.replayFeedback(c, side, true), v1 = L.replayFeedback(c, side);
        ok(f.text && /[฀-๿]/.test(f.text), c + ' Thai text');
        ok(!/HL|HH|LH|LL|pullback|โครงสร้างใหม่/.test(f.text), c + ' Level 2 text must not use the v1 structure wording: ' + f.text);
        ok(f.secs.length >= 1, c + ' has a chip');
        f.secs.forEach(function (s) {
          if (typeof s === 'number') { ok(s > 0 && s <= 2947, c + ' main-clip chip inside the video'); return; }
          ok(Array.isArray(s) && s.length === 2, c + ' chip shape [clip, sec]');
          var src = TJR.sources.byClip(s[0]);
          ok(src && !src.main && s[0] !== 4 && s[1] > 0 && s[1] <= src.dur, c + ' playlist chip #' + s[0] + ' ' + s[1] + ' inside its video, never clip #4');
        });
        if (c !== 'closed' && c !== 'blind-sweep') ok(f.text !== v1.text, c + ' differs from the v1 text');
      });
    });
    ok(L.isLevel2(TJR.scenarios.safeBuild(TJR.scenarios.get('S15'), 1, {})));
    ok(!L.isLevel2(TJR.scenarios.safeBuild(TJR.scenarios.get('S01'), 1, {})));
    // v1 behaviour is unchanged when no Level 2 flag is passed
    eq(L.replayFeedback('in-window', 'short').secs, [1530]);
    eq(L.replayFeedback('early', 'long').text.indexOf('HL') > 0, true);
  });

  test('lab replay on a Level 2 chart: during a round nothing leaks; at the end the annotated truth carries the confluence overlays and no HH / HL labels', () => {
    l2builds(function (d, b, seed, o) {
      if (seed > 12) return;
      var n = b.candles.length, T = b.truth;
      for (var bar = L.replayStart(b); bar < n; bar += Math.max(1, Math.floor(n / 12))) {
        L.replayOverlays(b, bar, false).forEach(function (x) {
          ok(x.appearAt <= bar && ['label', 'zone', 'fvg', 'bos', 'eq', 'band'].indexOf(x.type) < 0 && x.id !== 'entry' && x.id !== 'target',
            d.id + ' seed ' + seed + ': ' + x.id + ' would give the answer away at bar ' + bar);
        });
      }
      var full = L.replayOverlays(b, n - 1, true), types = {};
      full.forEach(function (x) { types[x.type] = (types[x.type] || 0) + 1; });
      ok(!types.label, d.id + ': the v1 structure labels are gone at the end');
      ok(full.some(function (x) { return x.id === 'entry'; }) && full.some(function (x) { return x.id === 'target'; }), d.id + ': entry zone and target');
      ok(types.fvg || types.bos || types.eq, d.id + ' seed ' + seed + ': the confluence overlays are drawn: ' + JSON.stringify(types));
      full.forEach(function (x) { ['from', 'to', 'at', 'bar'].forEach(function (k) { if (typeof x[k] === 'number') ok(x[k] <= n - 1); }); });
      if (d.id === 'S22') ok(types.band, 'S22 shows its NY windows');
      else ok(!types.band, d.id + ' draws no window bands');
      var K = T.confluence;
      ok(full.some(function (x) { return (K.confirm.kind === 'bos' ? x.type === 'bos' && x.at === K.confirm.at : x.type === 'fvg' && x.stateAt === K.confirm.at); }), d.id + ' seed ' + seed + ': the confirmation is on the chart');
    });
  });

  test('lab replay on a Level 2 chart: l2Chain rows come from the candles (confirmation, continuation, entry) with a bar each', () => {
    l2builds(function (d, b, seed) {
      if (seed > 20) return;
      var rows = L.l2Chain(b), K = b.truth.confluence;
      eq(rows.map(function (r) { return r.key; }), ['confirm', 'cont', 'entry']);
      eq(rows[0].bar, K.confirm.at); eq(rows[2].bar, K.entry.at);
      ok(rows[1].bar >= K.confirm.at && rows[1].bar <= K.entry.at, d.id + ' cont row bar');
      rows.forEach(function (r) { ok(r.text && /[฀-๿]/.test(r.text) && !/HL|HH|LH|LL/.test(r.text), d.id + ' ' + r.key + ': ' + r.text); });
    });
  });

  test('lab replay: the v1 1-in-4 fail rule still holds with Level 2 scenarios in the pool; fail builds exist only where a scenario can fail', () => {
    var n = 0, fails = 0, ids = {}, fcap = {};
    for (var seed = 1; seed <= 600; seed++) {
      var r = L.makeRound('replay', rngOf(seed * 9173), null);
      n++; ids[r.def.id] = (ids[r.def.id] || 0) + 1;
      if (r.built.truth.outcome === 'fail') { fails++; fcap[r.def.id] = 1; }
      ok(r.replay.bar < r.built.truth.sweep.bar && TJR.scenarios.check(r.built).length === 0, r.def.id);
    }
    ok(fails / n > 0.18 && fails / n < 0.34, 'about 1 in 4 rounds fail: ' + fails + '/' + n);
    ok(ids.S15 > 0 && ids.S16 > 0 && ids.S22 > 0 && ids.S01 > 0, 'Level 2 and v1 scenarios are both drawn: ' + JSON.stringify(ids));
    ok(!fcap.S22, 'S22 cannot fail');
  });

  // ================================================================ the three drills
  test('lab modes: replay / spot / sessions / quiz plus gap / bos / smt; scenarios per drill match the flags; scores in lab.<drill>', () => {
    eq(L.MODES, ['replay', 'spot', 'sessions', 'quiz', 'gap', 'bos', 'smt']);
    eq(lab('gap').map(function (d) { return d.id; }), ['S15', 'S16', 'S19', 'S22']);
    eq(lab('bos').map(function (d) { return d.id; }), ['S20']);
    eq(lab('smt').map(function (d) { return d.id; }), ['S21']);
    ['gap', 'bos', 'smt'].forEach(function (m) {
      L.resetScore(m); eq(L.loadScore(m), L.blank());
      L.saveScore(m, L.record(L.blank(), true)); eq(L.loadScore(m).right, 1);
      L.resetScore(m); eq(L.loadScore(m), L.blank());
    });
  });

  test('lab gap: the window holds the setup, shows gaps, and only the exact middle of a gap of the NAMED direction passes', () => {
    ['S15', 'S16', 'S19', 'S22'].forEach(function (id) {
      for (var seed = 1; seed <= 40; seed++) {
        var b = TJR.scenarios.safeBuild(TJR.scenarios.get(id), seed, {}), w = L.gapWindow(b), n = b.candles.length;
        ok(w.from >= 0 && w.to <= n - 1 && w.from < w.to && w.to - w.from <= 26, id + ' window ' + w.from + '..' + w.to);
        var g = L.gapRound(b, rngOf(seed));
        eq([g.from, g.to], [w.from, w.to]);
        ok(g.dir === 'bull' || g.dir === 'bear', 'a named direction');
        var gaps = L.gapsIn(b, g), mine = gaps.filter(function (x) { return x.dir === g.dir; });
        ok(mine.length >= 1, id + ' seed ' + seed + ' has a ' + g.dir + ' gap in the window');
        gaps.forEach(function (x) { ok(x.from >= g.from && x.to <= g.to, 'gap inside the window and its third candle is revealed'); });
        eq(L.gapSlice(b, g).candles.length, g.to + 1);
        for (var i = g.from; i <= g.to; i++) {
          var hit = mine.some(function (x) { return x.i === i; });
          eq(L.gapGrade(b, g, i).correct, hit, id + ' seed ' + seed + ' bar ' + i);
        }
        mine.forEach(function (x) { eq(L.gapGrade(b, g, x.i).expected.bar, x.i); });
        eq(L.gapGrade(b, g, g.to + 3).correct, false, 'a click past the revealed bar is wrong');
        eq(L.gapGrade(b, g, NaN).correct, false);
      }
    });
  });

  // the drill must not be guessable: a click on a random bar of the window passes in at most ~1 in 4 rounds
  test('lab gap: a random click passes at most 30% of the time (seeds 1..60 of S15 / S16 / S19 / S22)', () => {
    var all = 0, allHit = 0;
    ['S15', 'S16', 'S19', 'S22'].forEach(function (id) {
      var t = 0, hit = 0;
      for (var seed = 1; seed <= 60; seed++) {
        var b = TJR.scenarios.safeBuild(TJR.scenarios.get(id), seed, {}), g = L.gapRound(b, rngOf(seed * 31));
        for (var i = g.from; i <= g.to; i++) { t++; if (L.gapGrade(b, g, i).correct) hit++; }
      }
      ok(hit / t > 0.02, id + ': some clicks pass (' + hit + '/' + t + ')');
      ok(hit / t <= 0.30, id + ': random click pass rate ' + (hit / t).toFixed(2) + ' must be <= 0.30');
      all += t; allHit += hit;
    });
    ok(allHit / all <= 0.30, 'overall ' + (allHit / all).toFixed(2));
  });

  test('lab gap: the rule is on the page in one Thai line and the prompt names the direction', () => {
    var js = readText('assets/js/pages/lab.js');
    ok(js.indexOf('กติกา: คลิกตรงแท่งกลางของ gap ฝั่งที่โจทย์ระบุเท่านั้น') > 0, 'the rule line');
    ok(js.indexOf('ผ่านถ้าคลิกใกล้แท่งกลางของ gap จริงไม่เกิน 1 แท่ง') < 0, 'the old +/-1 rule is gone from the page');
  });

  test('lab gap: gapWhy reads the three reasons a bar is not a gap middle (overlap of wicks, doji, edge)', () => {
    function k(o, h, l, c) { return { o: o, h: h, l: l, c: c }; }
    eq(L.gapWhy([k(1, 2, 1, 1.5), k(1.5, 3, 1.5, 2.5), k(2, 4, 2.5, 3.5)], 1), null, 'a bullish gap: first high 2 < third low 2.5');
    var w = L.gapWhy([k(1, 3, 1, 2), k(2, 4, 2, 3.5), k(3, 5, 2.5, 4)], 1);
    eq([w.reason, w.dir, w.ticks], ['overlap', 'up', 2], 'wicks overlap by 2 ticks (0.5)');
    eq(L.gapWhy([k(1, 2, 1, 1.5), k(1.5, 3, 1, 1.5), k(2, 4, 2.5, 3.5)], 1).reason, 'doji');
    eq(L.gapWhy([k(1, 2, 1, 1.5), k(1.5, 3, 1.5, 2.5)], 0).reason, 'edge');
    eq(L.gapWhy([k(5, 6, 4, 4.5), k(4.5, 4.6, 3, 3.5), k(3.5, 3.9, 2, 2.5)], 1), null, 'a bearish gap: first low 4 > third high 3.9');
  });

  test('lab bos: every question has a stated answer from the candles; both answers occur; the prompt keeps the level and the bar on the chart', () => {
    var yes = 0, no = 0, kinds = { wick: 0, on: 0, close: 0 };
    for (var seed = 1; seed <= 200; seed++) {
      var r = L.makeRound('bos', rngOf(seed * 4909), null), q = r.bq, b = r.built;
      eq(r.def.id, 'S20');
      var expected = TJR.grade.bos(b, q.bar, true).expected;
      eq(expected, q.kind === 'close', 'seed ' + seed);
      expected ? yes++ : no++; kinds[q.kind]++;
      ok(q.bar >= 1 && q.bar < b.candles.length && q.level && q.level.i < q.bar, 'the watched swing is older than the bar');
      var ov = L.bosOverlays(r, false);
      ok(ov.every(function (x) { return (x.appearAt == null || x.appearAt <= q.bar) && ['label', 'bos'].indexOf(x.type) < 0; }), 'nothing about the answer is drawn before the answer');
      ok(ov.some(function (x) { return x.type === 'level' && x.price === q.level.price; }), 'the watched level is drawn');
      ok(ov.some(function (x) { return x.type === 'marker' && x.bar === q.bar; }), 'the bar asked about is marked');
      ok(L.bosOverlays(r, true).some(function (x) { return x.type === 'bos'; }), 'after the answer the real break is on the chart');
      var f = L.bosFeedback(q);
      ok(/[฀-๿]/.test(f.text) && f.secs.length >= 1 && f.secs.every(function (s) { return Array.isArray(s) && s[0] === 11 && s[1] > 0 && s[1] <= 743; }), 'bos feedback cites clip #11 inside its length');
      ok(q.kind === 'close' ? f.text.indexOf('ใช่') === 0 : f.text.indexOf('ไม่ใช่') === 0, 'the first word says the answer: ' + f.text);
    }
    ok(yes > 20 && no > 20, 'both answers occur: ' + yes + ' yes / ' + no + ' no');
    ok(kinds.wick > 0 && kinds.close > 0, JSON.stringify(kinds));
  });

  test('lab smt: both charts are read from the candles; the answer is the lower-high index; the panel order is shuffled; chips cite clip #6', () => {
    var lefts = { main: 0, twin: 0 };
    for (var seed = 1; seed <= 60; seed++) {
      var r = L.makeRound('smt', rngOf(seed * 3203), null), b = r.built, f = L.smtFacts(b);
      eq(r.def.id, 'S21');
      eq(f.leader, TJR.grade.smtLeader(b));
      ok((f.main.p2 < f.main.p1) !== (f.twin.p2 < f.twin.p1), 'one lower high, one higher high');
      var lead = f[f.leader];
      ok(lead.p2 < lead.p1, 'the leader made the lower high');
      eq(TJR.grade.smt(b, f.leader).correct, true); eq(TJR.grade.smt(b, f.leader === 'main' ? 'twin' : 'main').correct, false);
      lefts[r.smt.swap ? 'twin' : 'main']++;
      eq(r.smt.reveal, b.truth.smt.at);
      var order = L.smtPanels(r);
      eq(order.map(function (p) { return p.which; }), r.smt.swap ? ['twin', 'main'] : ['main', 'twin']);
      order.forEach(function (p) {
        eq(p.marks.length, 2); p.marks.forEach(function (m) { eq(m.type, 'marker'); ok(m.appearAt <= r.smt.reveal); });
        ok(p.name === 'ES' || p.name === 'NQ');
      });
      var fb = L.smtFeedback(r);
      ok(fb.text.indexOf(lead.name) >= 0 && fb.secs.length >= 2 && fb.secs.every(function (s) { return s[0] === 6 && s[1] <= 964; }), 'feedback names the leader and cites clip #6');
    }
    ok(lefts.main > 10 && lefts.twin > 10, 'the answer is not always on the same side: ' + JSON.stringify(lefts));
  });

  test('lab.html: seven tabs (Replay Spot Sessions Quiz + Gap finder, Break or not, Which index leads), a second chart pane for the twin, store keys through TJR.store, no chip to clip #4', () => {
    var html = readText('lab.html'), js = readText('assets/js/pages/lab.js'), css = readText('assets/css/pages/lab.css');
    eq((html.match(/role="tab"/g) || []).length, 7);
    ['replay', 'spot', 'sessions', 'quiz', 'gap', 'bos', 'smt'].forEach(function (m) { ok(html.indexOf('data-mode="' + m + '"') > 0, m + ' tab'); });
    ['Gap finder', 'Break or not', 'Which index leads'].forEach(function (t) { ok(html.indexOf(t) > 0, t); });
    ok(html.indexOf('data-k="hostB"') > 0, 'the twin pane');
    eq((html.match(/tabindex="0"/g) || []).length, 1, 'roving tabindex: one tab stop among the tabs');
    ok((html.match(/tabindex="-1"/g) || []).length >= 7, 'the other six tabs are out of the tab order');
    ok(css.indexOf('.lab-stage') >= 0 && /@media[^{]*max-width: ?(639|767)px/.test(css), 'stage and phone layout');
    ok(/min-height: 44px/.test(css));
    ok(js.indexOf('tjr.lab') < 0, 'store keys go through TJR.store');
    ok(js.indexOf('TJR.chart.twin') > 0, 'the twin drill uses the twin chart');
    ok(!/52nxvJKM57U/.test(js + html), 'no chip to clip #4');
  });
})();
