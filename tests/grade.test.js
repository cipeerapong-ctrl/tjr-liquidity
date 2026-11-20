// Exercise grading (D1, D2, D4): replay / spot / sessions / quiz against the scenario library.
// Wrapped in an IIFE: test files share one vm global scope.
(() => {
  const G = TJR.grade;
  const S = TJR.scenarios;
  const win = S.get('S01').build(7, { outcome: 'win' });
  const fail = S.get('S01').build(7, { outcome: 'fail' });
  const short = S.get('S03').build(7, { outcome: 'win' });
  const none = S.get('S04').build(7, {});
  const day = S.get('S06').build(7, {});
  const code = (r) => r.code;
  const without = (b, patch) => ({ candles: b.candles, meta: b.meta, truth: Object.assign({}, b.truth, patch) });

  test('grade: replay codes on S01 seed 7 (long setup)', () => {
    const t = win.truth;
    ok(t.sweep && t.confirmBar != null && t.entryWindow, 'S01 has a full setup');
    eq(code(G.replay(t, t.sweep.bar, 'long')), 'blind-sweep');
    eq(G.replay(t, t.sweep.bar, 'long').correct, false);
    eq(code(G.replay(t, t.sweep.bar - 5, 'long')), 'blind-sweep');
    eq(code(G.replay(t, t.confirmBar - 1, 'long')), 'early');
    eq(G.replay(t, t.confirmBar - 1, 'long').correct, false);
    const r = G.replay(t, t.entryWindow.from, 'long');
    eq(code(r), 'in-window');
    eq(r.correct, true);
    eq(code(G.replay(t, t.entryWindow.to, 'long')), 'in-window');
    eq(code(G.replay(t, t.entryWindow.to + 1, 'long')), 'late');
    eq(G.replay(t, t.entryWindow.to + 1, 'long').correct, false);
  });

  test('grade: replay early covers the confirm bar itself (pair not yet complete)', () => {
    const t = win.truth;
    eq(code(G.replay(t, t.confirmBar, 'long')), 'early');
    eq(code(G.replay(t, t.entryWindow.from - 1, 'long')), 'early');
  });

  test('grade: replay wrong side after the sweep; blind-sweep still wins at/before the sweep', () => {
    const t = win.truth;
    const r = G.replay(t, t.entryWindow.from, 'short');
    eq(code(r), 'wrong-side');
    eq(r.correct, false);
    eq(code(G.replay(t, t.sweep.bar + 1, 'short')), 'wrong-side');
    eq(code(G.replay(t, t.sweep.bar, 'short')), 'blind-sweep');
  });

  test('grade: replay wait is correct, except once the window has closed (missed)', () => {
    const t = win.truth;
    for (const b of [t.sweep.bar - 3, t.sweep.bar, t.confirmBar, t.entryWindow.from, t.entryWindow.to - 1]) {
      const r = G.replay(t, b, 'wait');
      eq(code(r), 'wait-ok', 'bar ' + b);
      eq(r.correct, true);
    }
    const m = G.replay(t, t.entryWindow.to, 'wait');
    eq(code(m), 'missed');
    eq(m.correct, false);
    eq(code(G.replay(t, t.entryWindow.to + 4, 'wait')), 'missed');
  });

  test('grade: replay correctness ignores outcome (D4): fail build grades the same way', () => {
    const t = fail.truth;
    eq(t.outcome, 'fail');
    const r = G.replay(t, t.entryWindow.from, 'long');
    eq(code(r), 'in-window');
    eq(r.correct, true);
    eq(code(G.replay(t, t.entryWindow.from, 'short')), 'wrong-side');
    eq(code(G.replay(t, t.confirmBar - 1, 'long')), 'early');
    eq(code(G.replay(t, t.sweep.bar, 'long')), 'blind-sweep');
    eq(code(G.replay(t, t.entryWindow.to + 1, 'long')), 'late');
    // same verdict when only the outcome field differs
    const flipped = Object.assign({}, win.truth, { outcome: 'fail' });
    eq(G.replay(flipped, win.truth.entryWindow.from, 'long'), G.replay(win.truth, win.truth.entryWindow.from, 'long'));
  });

  test('grade: replay on a short setup (S03) mirrors the long one', () => {
    const t = short.truth;
    eq(t.side, 'short');
    eq(code(G.replay(t, t.entryWindow.from, 'short')), 'in-window');
    eq(code(G.replay(t, t.entryWindow.from, 'long')), 'wrong-side');
    eq(code(G.replay(t, t.confirmBar - 1, 'short')), 'early');
  });

  test('grade: replay on a no-trade scenario (S04): entries are early/blind, waiting is right', () => {
    const t = none.truth;
    eq(t.side, null);
    eq(code(G.replay(t, t.sweep.bar, 'long')), 'blind-sweep');
    eq(code(G.replay(t, t.sweep.bar + 2, 'long')), 'early');
    eq(code(G.replay(t, t.sweep.bar + 2, 'short')), 'early');
    eq(G.replay(t, t.sweep.bar + 2, 'long').correct, false);
    for (const b of [t.sweep.bar - 1, t.sweep.bar + 2, none.candles.length - 1]) {
      const r = G.replay(t, b, 'wait');
      eq(code(r), 'wait-ok');
      eq(r.correct, true);
    }
  });

  test('grade: spot sweep is sweep.bar +/- 1 and reports the swept level price', () => {
    const t = win.truth;
    const lvl = t.levels.find((l) => l.id === t.sweep.levelId);
    const hit = G.spot(win, 'sweep', t.sweep.bar + 1, 0);
    eq(hit.correct, true);
    eq(hit.expected, { bar: t.sweep.bar, price: lvl.price });
    eq(G.spot(win, 'sweep', t.sweep.bar - 1, 0).correct, true);
    eq(G.spot(win, 'sweep', t.sweep.bar, 0).correct, true);
    eq(G.spot(win, 'sweep', t.sweep.bar + 2, 0).correct, false);
    eq(G.spot(win, 'sweep', t.sweep.bar + 3, 0).correct, false);
  });

  test('grade: spot any-high / any-low accept any rule swing within 1 bar, price ignored', () => {
    const sw = TJR.swings.find(win.candles);
    const h = sw.highs[5], l = sw.lows[5];
    let r = G.spot(win, 'any-high', h.i + 1, -1);
    eq(r.correct, true);
    eq(r.expected.price !== undefined, true);
    r = G.spot(win, 'any-high', h.i, 1e9);
    eq(r.correct, true);
    eq(r.expected, { bar: h.i, price: h.price });
    r = G.spot(win, 'any-low', l.i, 0);
    eq(r.correct, true);
    eq(r.expected, { bar: l.i, price: l.price });
    // a spot farther than 1 bar from every swing of that type is wrong and still names the nearest one
    const far = Array.from({ length: win.candles.length }, (_, b) => b)
      .find((b) => sw.highs.every((x) => Math.abs(x.i - b) > 1));
    if (far != null) {
      r = G.spot(win, 'any-high', far, 0);
      eq(r.correct, false);
      const best = sw.highs.reduce((a, x) => (Math.abs(x.i - far) < Math.abs(a.i - far) ? x : a));
      eq(r.expected, { bar: best.i, price: best.price });
    }
  });

  test('grade: spot entry-pivot is the first HL (long) / LH (short) after confirmBar, +/- 1', () => {
    let t = win.truth;
    let piv = t.structure.find((s) => s.tag === 'HL' && s.bar > t.confirmBar);
    ok(piv, 'S01 has an HL after the HH');
    let r = G.spot(win, 'entry-pivot', piv.bar - 1, 0);
    eq(r.correct, true);
    eq(r.expected, { bar: piv.bar, price: piv.price });
    eq(G.spot(win, 'entry-pivot', piv.bar + 2, 0).correct, false);
    // the earlier HL (before the HH) is not the entry pivot
    const early = t.structure.find((s) => s.tag === 'HL' && s.bar < t.confirmBar);
    if (early) eq(G.spot(win, 'entry-pivot', early.bar, 0).correct, false);

    t = short.truth;
    piv = t.structure.find((s) => s.tag === 'LH' && s.bar > t.confirmBar);
    ok(piv, 'S03 has an LH after the LL');
    r = G.spot(short, 'entry-pivot', piv.bar, 0);
    eq(r.correct, true);
    eq(r.expected, { bar: piv.bar, price: piv.price });
  });

  test('grade: spot on an unsupported task returns {correct:false, expected:null}, never throws', () => {
    // S04 has a sweep but no trade, so no entry pivot
    eq(G.spot(none, 'entry-pivot', 10, 0), { correct: false, expected: null });
    eq(G.spot(without(none, { sweep: null }), 'sweep', 10, 0), { correct: false, expected: null });
    eq(G.spot(win, 'nonsense', 10, 0), { correct: false, expected: null });
  });

  test('grade: spotTasks lists exactly the supported tasks', () => {
    eq(G.spotTasks(win), ['any-high', 'any-low', 'sweep', 'entry-pivot']);
    eq(G.spotTasks(short), ['any-high', 'any-low', 'sweep', 'entry-pivot']);
    eq(G.spotTasks(none), ['any-high', 'any-low', 'sweep']);
    eq(G.spotTasks(without(none, { sweep: null })), ['any-high', 'any-low']);
    // every listed task is gradable (expected non-null) on every library scenario
    for (const d of S.list) {
      const b = d.build(3, d.outcomes.length ? { outcome: d.outcomes[0] } : {});
      for (const task of G.spotTasks(b)) ok(G.spot(b, task, 0, 0).expected, d.id + ' ' + task);
    }
  });

  test('grade: sessions tick tolerance is 4 ticks (1.00); 5 ticks is wrong', () => {
    const asia = day.truth.sessions.filter((s) => s.name === 'asia').pop();
    const lon = day.truth.sessions.filter((s) => s.name === 'london').pop();
    let r = G.sessions(day.truth, { asiaHigh: asia.high, asiaLow: asia.low, londonHigh: lon.high, londonLow: lon.low });
    eq(r.score, 4);
    near(r.items.asiaHigh.diff, 0);
    eq(r.items.asiaHigh.ok, true);
    r = G.sessions(day.truth, {
      asiaHigh: asia.high + 1, asiaLow: asia.low - 1.25, londonHigh: lon.high + 0.25 * 4, londonLow: lon.low - 0.25 * 5
    });
    eq(r.items.asiaHigh.ok, true);
    near(r.items.asiaHigh.diff, 1);
    eq(r.items.asiaLow.ok, false);
    near(r.items.asiaLow.diff, -1.25);
    eq(r.items.londonHigh.ok, true);
    eq(r.items.londonLow.ok, false);
    eq(r.score, 2);
  });

  test('grade: sessions grades the LAST asia / london entry; missing session or line -> not ok', () => {
    const t = { sessions: [
      { name: 'asia', from: 0, to: 5, high: 100, low: 90 },
      { name: 'london', from: 6, to: 9, high: 101, low: 95 },
      { name: 'asia', from: 10, to: 15, high: 200, low: 190 },
      { name: 'london', from: 16, to: 19, high: 201, low: 195 },
      { name: 'ny', from: 20, to: 29, high: 300, low: 10 }
    ] };
    let r = G.sessions(t, { asiaHigh: 200, asiaLow: 190, londonHigh: 201, londonLow: 195 });
    eq(r.score, 4);
    r = G.sessions(t, { asiaHigh: 100, asiaLow: 90, londonHigh: 101, londonLow: 95 });
    eq(r.score, 0);
    r = G.sessions({ sessions: [{ name: 'asia', from: 0, to: 5, high: 10, low: 9 }] },
                   { asiaHigh: 10, asiaLow: 9, londonHigh: 10, londonLow: 9 });
    eq(r.items.londonHigh, { diff: null, ok: false });
    eq(r.items.londonLow, { diff: null, ok: false });
    eq(r.score, 2);
    r = G.sessions(t, { asiaHigh: 200 });
    eq(r.items.asiaLow, { diff: null, ok: false });
    eq(r.score, 1);
    eq(G.sessions({ sessions: [] }, {}).score, 0);
  });

  test('grade: quiz answers come from kind and resistance; unknown answer is false', () => {
    const stack = { kind: 'stack', resistance: 'low', resistanceAfter: 'high' };
    eq(G.quiz(stack, 'low'), true);
    eq(G.quiz(stack, 'high'), false);
    eq(G.quiz(stack, 'htf'), false);
    eq(G.quiz(stack, 'session'), false);
    eq(G.quiz(stack, 'high', { after: true }), true);
    eq(G.quiz(stack, 'low', { after: true }), false);
    eq(G.quiz(stack, 'low', {}), true);
    for (const kind of ['htf', 'pdh', 'pdl']) {
      eq(G.quiz({ kind, resistance: null, resistanceAfter: null }, 'htf'), true, kind);
      eq(G.quiz({ kind, resistance: null, resistanceAfter: null }, 'low'), false, kind);
    }
    eq(G.quiz({ kind: 'session', resistance: null }, 'session'), true);
    eq(G.quiz({ kind: 'session', resistance: null }, 'htf'), false);
    eq(G.quiz({ kind: 'liq', resistance: null, resistanceAfter: null }, 'low'), false);
    eq(G.quiz(stack, 'banana'), false);
    eq(G.quiz(stack, undefined), false);
  });

  test('grade: quiz on real levels: S01 stack low before the sweep, high after it', () => {
    const l1 = win.truth.levels.find((l) => l.id === 'L1');
    eq(G.quiz(l1, 'low'), true);
    eq(G.quiz(l1, 'high', { after: true }), true);
    const lon = day.truth.levels.find((l) => l.id === 'london-low');
    eq(G.quiz(lon, 'session'), true);
    const pdh = day.truth.levels.find((l) => l.kind === 'pdh');
    eq(G.quiz(pdh, 'htf'), true);
  });
  // ---- v2 drills: Gap finder, Break or not, Which index leads (Level 2 scenarios; truth read from the candles)
  const C = TJR.confluence;
  const nearestGap = (cs, bar) => C.fvgs(cs).reduce((a, g) => (!a || Math.abs(g.i - bar) < Math.abs(a.i - bar) ? g : a), null);

  test('grade.fvg: any real gap middle within 1 bar is right; the expected gap is the nearest; seeds 1..30 of S15 / S16 / S19 / S22', () => {
    for (const id of ['S15', 'S16', 'S19', 'S22']) {
      for (let seed = 1; seed <= 30; seed++) {
        const b = S.safeBuild(S.get(id), seed, {}), gaps = C.fvgs(b.candles), n = b.candles.length;
        ok(gaps.length >= 1, id + ' has gaps');
        gaps.forEach((g) => {
          [g.i - 1, g.i, g.i + 1].forEach((bar) => {
            const r = G.fvg(b, bar);
            eq(r.correct, true, id + ' seed ' + seed + ' bar ' + bar);
            ok(r.expected && typeof r.expected.bar === 'number' && Math.abs(r.expected.bar - bar) <= 1);
          });
        });
        for (let bar = 0; bar < n; bar++) {
          const near = gaps.some((g) => Math.abs(g.i - bar) <= 1), r = G.fvg(b, bar);
          eq(r.correct, near, id + ' seed ' + seed + ' bar ' + bar);
          const e = nearestGap(b.candles, bar);
          eq(r.expected.bar, e.i); eq(r.expected.dir, e.dir); eq(r.expected.low, e.low); eq(r.expected.high, e.high);
        }
      }
    }
  });

  test('grade.fvg: out of range, non-numbers and a chart with no gap never throw', () => {
    const b = S.safeBuild(S.get('S15'), 3, {});
    eq(G.fvg(b, -50).correct, false); eq(G.fvg(b, 1e6).correct, false);
    eq(G.fvg(b, NaN), { correct: false, expected: null });
    eq(G.fvg(b, undefined), { correct: false, expected: null });
    const flat = { candles: [0, 1, 2, 3].map((i) => ({ t: 1700000000 + i * 300, o: 100, h: 101, l: 99, c: 100.25 })), meta: b.meta, truth: {} };
    eq(G.fvg(flat, 1), { correct: false, expected: null });
  });

  test('grade.bos: a candle CLOSING beyond the most recent opposite swing is a break; a wick or a close on the level is not (S20 seeds 1..60)', () => {
    let kinds = { wick: 0, on: 0, close: 0 };
    for (let seed = 1; seed <= 60; seed++) {
      const b = S.safeBuild(S.get('S20'), seed, {}), cands = G.bosBars(b);
      ok(cands.length >= 2, 'seed ' + seed + ' has candidates');
      eq(cands[cands.length - 1].kind, 'close', 'seed ' + seed + ' ends on the real break');
      eq(cands[cands.length - 1].bar, b.truth.confluence.confirm.at, 'seed ' + seed + ': that break is the scripted confirmation');
      cands.forEach((c) => {
        kinds[c.kind]++;
        const x = b.candles[c.bar], up = c.trend === 'up';
        if (c.kind === 'close') ok(up ? x.c < c.level.price : x.c > c.level.price);
        if (c.kind === 'on') eq(x.c, c.level.price);
        if (c.kind === 'wick') ok(up ? x.l < c.level.price && x.c > c.level.price : x.h > c.level.price && x.c < c.level.price);
        const isBreak = c.kind === 'close';
        eq(G.bos(b, c.bar, isBreak), { correct: true, expected: isBreak }, 'seed ' + seed + ' bar ' + c.bar);
        eq(G.bos(b, c.bar, !isBreak), { correct: false, expected: isBreak });
      });
    }
    ok(kinds.wick > 0 && kinds.close > 0, 'both a wick and a close are exercised: ' + JSON.stringify(kinds));
  });

  test('grade.bos: edges. the first bar, a bar with no swing known yet, and non-numbers answer false without throwing', () => {
    const b = S.safeBuild(S.get('S20'), 2, {});
    eq(G.bos(b, 0, false), { correct: true, expected: false });
    eq(G.bos(b, 0, true), { correct: false, expected: false });
    eq(G.bos(b, -3, true).expected, false); eq(G.bos(b, 1e6, true).expected, false);
    eq(G.bos(b, NaN, false).expected, false);
  });

  test('grade.smt: the leader is the index with the lower high, read from both candle series (S21 seeds 1..60)', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const b = S.safeBuild(S.get('S21'), seed, {}), s = b.truth.smt, tw = b.truth.twin.candles;
      const mHigher = b.candles[s.main.p2.bar].h > b.candles[s.main.p1.bar].h;
      const tHigher = tw[s.twin.p2.bar].h > tw[s.twin.p1.bar].h;
      ok(mHigher !== tHigher, 'seed ' + seed + ': one index makes a higher high, the other a lower high');
      const lead = mHigher ? 'twin' : 'main';
      eq(G.smt(b, lead), { correct: true, expected: lead });
      eq(G.smt(b, lead === 'main' ? 'twin' : 'main'), { correct: false, expected: lead });
      eq(lead, s.leader, 'truth agrees with the candles');
    }
    const b = S.safeBuild(S.get('S21'), 1, {});
    eq(G.smt(b, 'x'), { correct: false, expected: 'main' });
    eq(G.smt(b, undefined).correct, false);
    eq(G.smt({ candles: b.candles, meta: b.meta, truth: {} }, 'main'), { correct: false, expected: null });
  });
})();
