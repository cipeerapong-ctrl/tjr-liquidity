// Confluence detectors (TJR.confluence): FVG, stacks, BOS, equilibrium range, SMT.
// Hand-built candles. Wrapped in an IIFE: test files share one vm global scope.
(() => {
  const C = TJR.confluence;
  // candle from [o, h, l, c]; t = bar * 60 so t is distinct and ordered
  const mk = (rows) => rows.map(([o, h, l, c], k) => ({ t: k * 60, o, h, l, c }));
  // price mirror: highs become lows, bull becomes bear (equal and opposite scenario)
  const mirror = (cs) => cs.map((x) => ({ t: x.t, o: 200 - x.o, h: 200 - x.l, l: 200 - x.h, c: 200 - x.c }));

  // ---- fair value gaps (P10.8-P10.10, P10.14, P10.22, P10.24, P10.27, P10.28, P10.31) ----

  // bars 0-2 form a bull gap: first.h 101 < third.l 102 -> low 101, high 102
  const bullBase = [
    [100, 101, 99, 100.5],       // 0 first
    [101, 106, 100.5, 105.5],    // 1 up expansion (middle)
    [105, 108, 102, 107],        // 2 third
  ];

  test('confluence.fvgs: a bull gap is found with its exact shape', () => {
    const cs = mk([...bullBase, [107, 109, 105, 108]]);
    eq(C.fvgs(cs), [{ i: 1, from: 0, to: 2, dir: 'bull', low: 101, high: 102, state: 'open', stateAt: null, deletedAt: null }]);
  });

  test('confluence.fvgs: a bear gap is found (low = third.h, high = first.l)', () => {
    const cs = mk([
      [100, 101, 99, 99.5],      // 0 first, bottom wick 99
      [99, 99.2, 94, 94.5],      // 1 down expansion
      [94.5, 98, 93, 94],        // 2 third, top wick 98
      [94, 95, 92, 93],
    ]);
    eq(C.fvgs(cs), [{ i: 1, from: 0, to: 2, dir: 'bear', low: 98, high: 99, state: 'open', stateAt: null, deletedAt: null }]);
  });

  test('confluence.fvgs: overlapping or touching wicks are not a gap (P10.14)', () => {
    const overlap = mk([[100, 101, 99, 100.5], [101, 106, 100.5, 105.5], [105, 108, 100.8, 107]]);
    eq(C.fvgs(overlap), [], 'third.l below first.h overlaps');
    const touch = mk([[100, 101, 99, 100.5], [101, 106, 100.5, 105.5], [105, 108, 101, 107]]);
    eq(C.fvgs(touch), [], 'third.l equal to first.h leaves no space');
    const bearTouch = mk([[100, 101, 99, 99.5], [99, 99.2, 94, 94.5], [94.5, 99, 93, 94]]);
    eq(C.fvgs(bearTouch), [], 'bear: third.h equal to first.l');
  });

  test('confluence.fvgs: only the middle candle direction matters (P10.8)', () => {
    const redFirst = mk([[101, 101, 99.5, 100], [101, 106, 100.5, 105.5], [105, 108, 102, 107]]);
    const g = C.fvgs(redFirst);
    eq(g.length, 1, 'a red first candle still forms a bull gap');
    eq([g[0].dir, g[0].low, g[0].high], ['bull', 101, 102]);
    const redThird = mk([[100, 101, 99, 100.5], [101, 106, 100.5, 105.5], [107, 108, 102, 103]]);
    eq(C.fvgs(redThird).length, 1, 'a red third candle still forms it');
    // middle candle is down, but the numbers leave an upward space: neither a bull nor a bear gap
    const wrongMiddle = mk([[100, 101, 99, 100.5], [105.5, 106, 100.5, 101], [105, 108, 102, 107]]);
    eq(C.fvgs(wrongMiddle), []);
  });

  test('confluence.fvgs: needs three candles; fewer gives none', () => {
    eq(C.fvgs([]), []);
    eq(C.fvgs(mk(bullBase.slice(0, 2))), []);
  });

  test('confluence.fvgs: a close equal to low stays open; a long wick below with a close inside is not disrespected (P10.24, P8.19)', () => {
    const onLow = mk([...bullBase, [103, 103.5, 100.5, 101]]);   // closes exactly on low 101
    eq(C.fvgs(onLow)[0].state, 'open');
    eq(C.fvgs(onLow)[0].stateAt, null);
    const wick = mk([...bullBase, [103, 103.5, 95, 101.5]]);     // wick far below, close inside the gap
    eq(C.fvgs(wick)[0].state, 'open');
  });

  test('confluence.fvgs: the first close strictly below low disrespects a bull gap at that bar (P10.22)', () => {
    const cs = mk([...bullBase, [103, 103.5, 100.5, 101.5], [101.5, 102, 99.5, 100.8], [100.8, 101, 90, 91]]);
    const g = C.fvgs(cs)[0];
    eq([g.state, g.stateAt], ['disrespected', 4], 'bar 4 closes at 100.8 < 101, the later bar changes nothing');
  });

  test('confluence.fvgs: a close above high disrespects a bear gap, a close on high does not (P10.22, P8.20)', () => {
    const base = [[100, 101, 99, 99.5], [99, 99.2, 94, 94.5], [94.5, 98, 93, 94]];   // bear gap 98..99
    const onHigh = mk([...base, [94, 99.5, 93, 99]]);
    eq(C.fvgs(onHigh)[0].state, 'open', 'close exactly on high');
    const above = mk([...base, [94, 99.5, 93, 98.5], [98.5, 101, 98, 99.4]]);
    const g = C.fvgs(above)[0];
    eq([g.state, g.stateAt], ['disrespected', 4]);
  });

  test('confluence.fvgs: respected = traded into the gap, then a close back out (P10.27); price that never entered stays open', () => {
    const entered = mk([...bullBase, [102.5, 103.5, 101.5, 103]]);   // wick to 101.5 inside the gap, close 103 above high 102
    const g = C.fvgs(entered)[0];
    eq([g.state, g.stateAt], ['respected', 3]);
    const never = mk([...bullBase, [107, 110, 103, 105]]);           // low 103 never reaches 102
    eq(C.fvgs(never)[0].state, 'open');
    const onEdge = mk([...bullBase, [103, 104, 102, 103.5]]);        // low exactly on the top edge: not inside
    eq(C.fvgs(onEdge)[0].state, 'open');
    const closeOnHigh = mk([...bullBase, [103, 103.5, 101.5, 102]]); // came in, close exactly on high: not out yet
    eq(C.fvgs(closeOnHigh)[0].state, 'open');
    const slow = mk([...bullBase, [103, 103.5, 101.5, 101.8], [101.8, 104, 101.7, 103.5]]);
    const s = C.fvgs(slow)[0];
    eq([s.state, s.stateAt], ['respected', 4], 'a bar inside, then a later bar closing out');
  });

  test('confluence.fvgs: respected bull gap then a new high deletes it, and not before (P10.28, P10.31)', () => {
    // highest high from bar 0 to the bar before entry is 108 (bar 2)
    const deleted = mk([...bullBase, [102.5, 109, 101.5, 103], [103, 110, 102.5, 109.5]]);
    const g = C.fvgs(deleted)[0];
    eq(g.state, 'respected');
    eq(g.deletedAt, 4, 'bar 4 high 110 exceeds 108; the entering bar 3 (high 109) is not counted');
    const notYet = mk([...bullBase, [102.5, 109, 101.5, 103], [103, 107.9, 102.5, 107.5]]);
    eq(C.fvgs(notYet)[0].deletedAt, null, 'no bar after entry beat 108');
    const noEntry = mk([...bullBase, [107, 112, 106, 111]]);
    eq(C.fvgs(noEntry)[0].deletedAt, null, 'a push to a new high without ever entering deletes nothing');
  });

  test('confluence.fvgs: bear mirror: respected then a new low deletes it', () => {
    const cs = mk([
      [100, 101, 99, 99.5], [99, 99.2, 94, 94.5], [94.5, 98, 93, 94],   // bear gap 98..99, lowest low 93
      [97, 98.5, 95, 95.5],    // enters at 98.5 > 98, closes 95.5 below low 98 -> respected
      [95.5, 96, 92, 92.5],    // low 92 < 93
    ]);
    const g = C.fvgs(cs)[0];
    eq([g.dir, g.state, g.stateAt, g.deletedAt], ['bear', 'respected', 3, 4]);
  });

  test('confluence.fvgs: a gap disrespected after it was respected reads disrespected; deletedAt is independent', () => {
    const cs = mk([...bullBase, [102.5, 103.5, 101.5, 103], [103, 103.2, 99, 100.5]]);
    const g = C.fvgs(cs)[0];
    eq([g.state, g.stateAt], ['disrespected', 4]);
  });

  test('confluence.fvgs: does not mutate frozen input', () => {
    const cs = mk([...bullBase, [102.5, 109, 101.5, 103]]);
    cs.forEach((x) => Object.freeze(x));
    Object.freeze(cs);
    eq(C.fvgs(cs).length, 1);
  });

  // deterministic noisy series for no-look-ahead properties
  function walk(seed, n) {
    const r = TJR.rng.make(seed);
    const out = [];
    let p = 100;
    for (let k = 0; k < n; k++) {
      const o = p, c = p + r.gauss() * 1.4;
      out.push({ t: k * 60, o, c, h: Math.max(o, c) + r.range(0, 0.9), l: Math.min(o, c) - r.range(0, 0.9) });
      p = c;
    }
    return out;
  }

  test('confluence.fvgs: no look-ahead, a prefix shows exactly what the full series knew by then', () => {
    for (const seed of [3, 11, 29]) {
      const cs = walk(seed, 90);
      const full = C.fvgs(cs);
      ok(full.length > 5, 'seed ' + seed + ' should produce gaps');
      for (let k = 3; k <= cs.length; k++) {
        const pre = C.fvgs(cs.slice(0, k));
        eq(pre.map((g) => g.i), full.filter((g) => g.to < k).map((g) => g.i), 'gaps known at ' + k);
        for (const g of pre) {
          const f = full.find((x) => x.i === g.i);
          if (g.state === 'disrespected') eq([f.state, f.stateAt], ['disrespected', g.stateAt], 'seed ' + seed + ' bar ' + k);
          if (f.state === 'disrespected' && f.stateAt < k) eq(g.stateAt, f.stateAt);
          if (f.deletedAt !== null && f.deletedAt < k) eq(g.deletedAt, f.deletedAt);
          else eq(g.deletedAt, null, 'deletedAt cannot show before its bar');
        }
      }
    }
  });

  // ---- stacks (P8.32, P8.34) ----

  // two bull gaps (bars 0-2 and 2-4) with no bear candle between their middles (bars 1 and 3)
  const stackRows = [
    [100, 101, 99.5, 100.5],     // 0
    [101, 104, 100.8, 103.8],    // 1 middle of gap A: 101..102
    [103.5, 106, 102, 105.5],    // 2
    [105.8, 109, 104, 108.8],    // 3 middle of gap B: 106..107
    [108.5, 111, 107, 110.5],    // 4
  ];

  test('confluence.stacks: consecutive same-direction gaps with no opposite candle between middles form one stack (P8.32)', () => {
    const cs = mk(stackRows);
    const gaps = C.fvgs(cs);
    eq(gaps.map((g) => [g.i, g.dir, g.low, g.high]), [[1, 'bull', 101, 102], [3, 'bull', 106, 107]]);
    const st = C.stacks(gaps, cs);
    eq(st.length, 1);
    eq([st[0].dir, st[0].gaps.length, st[0].low, st[0].high, st[0].inversedAt], ['bull', 2, 101, 107, null]);
    eq(st[0].gaps.map((g) => g.i), [1, 3]);
  });

  test('confluence.stacks: a lone gap is not a stack; a retrace candle between the middles splits the pair', () => {
    const cs = mk(stackRows);
    eq(C.stacks(C.fvgs(cs).slice(0, 1), cs), []);
    // a bearish candle at bar 2 sits between the middles (1 and 3)
    const split = mk(stackRows);
    split[2] = { t: 120, o: 105.5, h: 106, l: 102, c: 103 };
    const g = [
      { i: 1, from: 0, to: 2, dir: 'bull', low: 101, high: 102, state: 'open', stateAt: null, deletedAt: null },
      { i: 3, from: 2, to: 4, dir: 'bull', low: 106, high: 107, state: 'open', stateAt: null, deletedAt: null },
    ];
    eq(C.stacks(g, split), []);
  });

  test('confluence.stacks: a close under only the top gap does not invert the stack; under the bottom gap does (P8.34)', () => {
    const topOnly = mk([...stackRows, [110.2, 110.5, 104.5, 105]]);        // 105 < 106 (top gap low), above 101
    const a = C.stacks(C.fvgs(topOnly), topOnly);
    eq(a[0].inversedAt, null);
    const wickBottom = mk([...stackRows, [110.2, 110.5, 104.5, 105], [105, 105.2, 99, 101]]);   // wick below 101 but close ON 101
    eq(C.stacks(C.fvgs(wickBottom), wickBottom)[0].inversedAt, null, 'close exactly on the bottom gap low');
    const bottom = mk([...stackRows, [110.2, 110.5, 104.5, 105], [105, 105.2, 100, 100.5]]);
    const b = C.stacks(C.fvgs(bottom), bottom);
    eq(b[0].inversedAt, 6, 'the close at 100.5 is under 101');
  });

  test('confluence.stacks: bear stack mirrors, inverted by a close above the top gap', () => {
    const cs = mirror(mk([...stackRows, [110.2, 110.5, 104.5, 105], [105, 105.2, 100, 100.5]]));
    const st = C.stacks(C.fvgs(cs), cs).filter((s) => s.dir === 'bear');
    eq(st.length, 1);
    eq([st[0].low, st[0].high, st[0].inversedAt], [93, 99, 6]);
    const high = mirror(mk([...stackRows, [110.2, 110.5, 104.5, 105]]));
    eq(C.stacks(C.fvgs(high), high).filter((s) => s.dir === 'bear')[0].inversedAt, null);
  });

  // ---- break of structure (P11.8-P11.17) ----

  // uptrend; swing low 100.2 (pair 3,4, known at bar 4), swing high 107.5 (pair 5,6, known at 6)
  const bosBase = [
    [100, 103, 99.5, 102],       // 0 bull
    [102, 106, 101.5, 105],      // 1 bull
    [105, 105.5, 102.8, 103],    // 2 bear -> high 106 at bar 1
    [103, 103.2, 100.5, 101],    // 3 bear
    [101, 104.5, 100.2, 104],    // 4 bull -> low 100.2 at bar 4
    [104, 107.5, 103.8, 107],    // 5 bull
    [107, 107.2, 104.9, 105],    // 6 bear -> high 107.5 at bar 5
  ];

  test('confluence.bos: a wick under the low is not a break (P11.13)', () => {
    const cs = mk([...bosBase, [105, 105.5, 99, 104.5]]);
    eq(C.bos(cs, { from: 0, trend: 'up' }), []);
  });

  test('confluence.bos: a body closing exactly on the low is not a break (P11.10)', () => {
    const cs = mk([...bosBase, [105, 105.2, 100, 100.2]]);
    eq(C.bos(cs, { from: 0, trend: 'up' }), []);
  });

  test('confluence.bos: a close under the low is the break, and the trend flips', () => {
    const cs = mk([...bosBase, [105, 105, 99.5, 100]]);
    eq(C.bos(cs, { from: 0, trend: 'up' }), [{ at: 7, dir: 'down', level: { i: 4, price: 100.2 } }]);
  });

  test('confluence.bos: after the flip it watches the most recent high; a wick over it is nothing, a close over it breaks (P11.9, P11.12)', () => {
    const cs = mk([
      ...bosBase,
      [105, 105, 99.5, 100],        // 7 breaks down
      [100, 108, 99.8, 106.9],      // 8 wick above 107.5, closes under
      [107, 108.5, 106.8, 108.2],   // 9 closes above 107.5
    ]);
    const ev = C.bos(cs, { from: 0, trend: 'up' });
    eq(ev, [
      { at: 7, dir: 'down', level: { i: 4, price: 100.2 } },
      { at: 9, dir: 'up', level: { i: 5, price: 107.5 } },
    ]);
    eq(C.bos(cs, { from: 8, trend: 'down' }), [{ at: 9, dir: 'up', level: { i: 5, price: 107.5 } }], 'from skips earlier bars');
  });

  test('confluence.bos: a lower high alone does not break an uptrend (P11.16); only lows are watched', () => {
    const cs = mk([
      ...bosBase,
      [105, 106.3, 104.8, 106],     // 7 bull: low 104.8 at bar 7 (pair 6,7)
      [106, 106.1, 105.4, 105.5],   // 8 bear: high 106.3, lower than 107.5
      [105.5, 105.6, 105, 105.2],   // 9 bear, still above 104.8
    ]);
    eq(C.bos(cs, { from: 0, trend: 'up' }), []);
  });

  test('confluence.bos: the most recent low is monitored, not an older one (P11.9, P11.14)', () => {
    // after bar 7 the monitored low is 104.8 (not 100.2): a close at 104.5 breaks it
    const cs = mk([
      ...bosBase,
      [105, 106.3, 104.8, 106],
      [106, 106.1, 105.4, 105.5],
      [105.5, 105.6, 104, 104.5],
    ]);
    eq(C.bos(cs, { from: 0, trend: 'up' }), [{ at: 9, dir: 'down', level: { i: 7, price: 104.8 } }]);
  });

  test('confluence.bos: downtrend watches only highs, a lower-low wick or higher low alone is nothing (P11.15)', () => {
    const cs = mirror(mk([...bosBase, [105, 105.5, 99, 104.5]]));
    eq(C.bos(cs, { from: 0, trend: 'down' }), []);
    const brk = mirror(mk([...bosBase, [105, 105, 99.5, 100]]));
    eq(C.bos(brk, { from: 0, trend: 'down' }), [{ at: 7, dir: 'up', level: { i: 4, price: 99.8 } }]);
  });

  test('confluence.bos: no event until a swing is confirmed, and none off the swing\'s own pair', () => {
    eq(C.bos([], { from: 0, trend: 'up' }), []);
    const cs = mk(bosBase.slice(0, 4));      // no swing low yet
    eq(C.bos(cs, { from: 0, trend: 'up' }), []);
  });

  test('confluence.bos: no look-ahead, a prefix returns exactly the events the full series had by then', () => {
    for (const seed of [5, 17, 41]) {
      const cs = walk(seed, 160);
      for (const trend of ['up', 'down']) {
        const full = C.bos(cs, { from: 0, trend });
        ok(full.length >= 2, 'seed ' + seed + ' ' + trend + ' has events: ' + full.length);
        for (let k = 1; k <= cs.length; k += 7) {
          eq(C.bos(cs.slice(0, k), { from: 0, trend }), full.filter((e) => e.at < k), 'seed ' + seed + ' ' + trend + ' prefix ' + k);
        }
      }
    }
  });

  // ---- equilibrium range (P7.4, P7.14-P7.16, P7.30) ----

  // older, lower low 107.5 (bar 0), most recent low 110.5 (bar 5); high 116 (bar 2), high 119 (bar 6)
  const eqRows = [
    [110, 110.5, 107.5, 108],    // 0 bear
    [108, 112.5, 107.8, 112],    // 1 bull -> low 107.5 at bar 0, known 1
    [112, 116, 111.8, 115],      // 2 bull
    [115, 115.5, 112.5, 113],    // 3 bear -> high 116 at bar 2, known 3
    [113, 113.2, 110.8, 111],    // 4 bear
    [111, 114.5, 110.5, 114],    // 5 bull -> low 110.5 at bar 5, known 5
    [114, 119, 113.8, 118],      // 6 bull
    [118, 118.5, 115.5, 116],    // 7 bear -> high 119 at bar 6, known 7
  ];

  test('confluence.eqRange: uptrend uses the most recent low, not an older lower one, up to the highest high after it', () => {
    const cs = mk(eqRows);
    eq(C.eqRange(cs, { at: 7, dir: 'up' }), { dir: 'up', from: 5, to: 6, low: 110.5, high: 119, eq: 114.75, knownAt: 7 });
  });

  test('confluence.eqRange: eq is snapped to the 0.25 tick', () => {
    const rows = eqRows.map((r) => r.slice());
    rows[6] = [114, 119.1, 113.8, 118];
    const r = C.eqRange(mk(rows), { at: 7, dir: 'up' });
    eq([r.high, r.eq], [119.1, 114.75]);
  });

  test('confluence.eqRange: the end swing must be confirmed; before that, the range is not known (P7.30)', () => {
    const cs = mk(eqRows);
    eq(C.eqRange(cs, { at: 6, dir: 'up' }), null, 'bar 6 is still the unconfirmed top');
    eq(C.eqRange(cs, { at: 5, dir: 'up' }), null, 'no high after the new low yet');
  });

  test('confluence.eqRange: at an earlier bar it uses the swings known then, never a later one', () => {
    const cs = mk(eqRows);
    eq(C.eqRange(cs, { at: 4, dir: 'up' }), { dir: 'up', from: 0, to: 2, low: 107.5, high: 116, eq: 111.75, knownAt: 3 });
  });

  test('confluence.eqRange: downtrend mirrors, most recent high down to the lowest low after it', () => {
    const cs = mirror(mk(eqRows));
    eq(C.eqRange(cs, { at: 7, dir: 'down' }), { dir: 'down', from: 5, to: 6, low: 81, high: 89.5, eq: 85.25, knownAt: 7 });
    eq(C.eqRange(cs, { at: 6, dir: 'down' }), null);
  });

  test('confluence.eqRange: no swing, no range', () => {
    eq(C.eqRange([], { at: 0, dir: 'up' }), null);
    eq(C.eqRange(mk(eqRows.slice(0, 3)), { at: 2, dir: 'down' }), null);
  });

  test('confluence.eqRange: no look-ahead, slicing the candles at `at` changes nothing', () => {
    for (const seed of [2, 8, 23]) {
      const cs = walk(seed, 120);
      let found = 0;
      for (let at = 0; at < cs.length; at++) {
        for (const dir of ['up', 'down']) {
          const a = C.eqRange(cs, { at, dir });
          eq(C.eqRange(cs.slice(0, at + 1), { at, dir }), a, 'seed ' + seed + ' at ' + at + ' ' + dir);
          if (a) { found++; ok(a.knownAt <= at && a.low <= a.eq && a.eq <= a.high, 'sane range'); }
        }
      }
      ok(found > 20, 'seed ' + seed + ' found ' + found);
    }
  });

  // ---- SMT divergence (P6.15-P6.19) ----

  test('confluence.smt: bearish, the side with the lower second high leads (P6.15, P6.16)', () => {
    eq(C.smt({ p1: 100, p2: 99 }, { p1: 100, p2: 101 }, 'high'), { type: 'bearish', leader: 'a' });
  });

  test('confluence.smt: role swap, either index can lead (P6.17)', () => {
    eq(C.smt({ p1: 100, p2: 101 }, { p1: 100, p2: 99 }, 'high'), { type: 'bearish', leader: 'b' });
  });

  test('confluence.smt: bullish lows, the side with the higher second low leads (P6.18, P6.19)', () => {
    eq(C.smt({ p1: 50, p2: 51 }, { p1: 50, p2: 49 }, 'low'), { type: 'bullish', leader: 'a' });
    eq(C.smt({ p1: 50, p2: 49 }, { p1: 50, p2: 51 }, 'low'), { type: 'bullish', leader: 'b' });
  });

  test('confluence.smt: no divergence when both agree or one is flat', () => {
    const none = { type: null, leader: null };
    eq(C.smt({ p1: 100, p2: 101 }, { p1: 200, p2: 203 }, 'high'), none, 'both higher highs');
    eq(C.smt({ p1: 100, p2: 99 }, { p1: 200, p2: 198 }, 'high'), none, 'both lower highs');
    eq(C.smt({ p1: 100, p2: 100 }, { p1: 200, p2: 203 }, 'high'), none, 'equal high is neither lower nor higher');
    eq(C.smt({ p1: 50, p2: 49 }, { p1: 80, p2: 78 }, 'low'), none, 'both lower lows');
    eq(C.smt({ p1: 50, p2: 51 }, { p1: 80, p2: 82 }, 'low'), none, 'both higher lows');
    eq(C.smt({ p1: 50, p2: 51 }, { p1: 80, p2: 82 }, 'nope'), none, 'unknown kind');
  });

  test('confluence.smt: the two instruments keep their own price scales (ES vs NQ)', () => {
    eq(C.smt({ p1: 6961.5, p2: 6950 }, { p1: 25794, p2: 25800.25 }, 'high'), { type: 'bearish', leader: 'a' });
  });
})();
