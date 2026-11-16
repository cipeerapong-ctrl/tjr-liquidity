// Generator core: path / guard / stamp / rollup / validate.
// Wrapped in an IIFE: test files share one vm global scope, so top-level const names would collide.
(() => {
  const G = TJR.gen;
  const WP = [
    { bar: 0, price: 30000 },
    { bar: 20, price: 30050, kind: 'high' },
    { bar: 40, price: 29980, kind: 'low' },
  ];
  const OPTS = { vol: 8, wick: 4, chop: 0.5, tick: 0.25 };
  const build = (seed, wp = WP, opts = OPTS) => G.path(TJR.rng.make(seed), wp, opts);
  const utc = (y, mo, d, h, mi = 0) => Date.UTC(y, mo - 1, d, h, mi) / 1000;
  const K = (o, h, l, c, t) => (t === undefined ? { o, h, l, c } : { t, o, h, l, c });
  const has = (list, price, k) => list.some((p) => p.price === price && p.pair[0] === k && p.pair[1] === k + 1);
  const throws = (fn, re, msg) => {
    let err = null;
    try { fn(); } catch (e) { err = e; }
    ok(err, (msg || 'expected a throw') + ' (nothing thrown)');
    ok(re.test(err.message), (msg || 'throw message') + ': got "' + err.message + '"');
  };

  // ---------- path ----------

  test('gen.path: brief waypoints, seeds 1..50 -> valid; high 30050 at pair [20,21], low 29980 at pair [40,41]', () => {
    for (let s = 1; s <= 50; s++) {
      const cs = build(s);
      eq(cs.length, 42, 'seed ' + s + ' length = last waypoint bar + 2');
      eq(G.validate(cs, 0.25), [], 'seed ' + s + ' validate');
      ok(!('t' in cs[0]), 'path candles carry no t');
      const sw = TJR.swings.find(cs);
      ok(has(sw.highs, 30050, 20), 'seed ' + s + ': find() has a high 30050 with pair [20,21]');
      ok(TJR.swings.isHigh(cs, 20), 'seed ' + s + ': isHigh(20)');
      ok(has(sw.lows, 29980, 40), 'seed ' + s + ': find() has a low 29980 with pair [40,41]');
      ok(TJR.swings.isLow(cs, 40), 'seed ' + s + ': isLow(40)');
    }
  });

  test('gen.path: scripted extremes are strict and unbeaten within two bars either side of the pair', () => {
    for (let s = 1; s <= 50; s++) {
      const cs = build(s);
      const hs = cs.slice(18, 24).map((k) => k.h);   // bars 18..23
      eq(Math.max(...hs), 30050, 'seed ' + s + ' max high 18..23');
      eq(hs.filter((h) => h === 30050).length, 1, 'seed ' + s + ' exactly one candle holds 30050');
      const ls = cs.slice(38, 42).map((k) => k.l);   // bars 38..41 (series ends at 41)
      eq(Math.min(...ls), 29980, 'seed ' + s + ' min low 38..41');
      eq(ls.filter((l) => l === 29980).length, 1, 'seed ' + s + ' exactly one candle holds 29980');
    }
  });

  test('gen.path: pass waypoints are hit exactly by the close; open = previous close', () => {
    const wp = [{ bar: 0, price: 30000 }, { bar: 15, price: 30030.25, kind: 'pass' }, { bar: 30, price: 29990 }];
    for (let s = 1; s <= 20; s++) {
      const cs = build(s, wp);
      eq(cs.length, 32);
      eq(cs[0].c, 30000, 'seed ' + s + ' bar 0 close');
      eq(cs[15].c, 30030.25, 'seed ' + s + ' bar 15 close');
      eq(cs[30].c, 29990, 'seed ' + s + ' bar 30 close');
      eq(G.validate(cs, 0.25), [], 'seed ' + s);
    }
  });

  test('gen.path: deterministic for equal seeds, different for different seeds', () => {
    eq(build(7), build(7));
    ok(JSON.stringify(build(7)) !== JSON.stringify(build(8)), 'seed 7 vs 8 differ');
  });

  test('gen.path: opts.bars sets the length; defaults work without opts', () => {
    const cs = build(3, WP, { vol: 8, wick: 4, chop: 0.5, tick: 0.25, bars: 60 });
    eq(cs.length, 60);
    eq(G.validate(cs, 0.25), []);
    ok(TJR.swings.isLow(cs, 40) && TJR.swings.isHigh(cs, 20));
    const d = G.path(TJR.rng.make(3), WP);
    eq(d.length, 42);
    eq(G.validate(d, 0.25), []);
    ok(has(TJR.swings.find(d).highs, 30050, 20));
  });

  test('gen.path: swings two bars apart, a pass right before a high, and a high at bar 0', () => {
    const wp = [
      { bar: 0, price: 30000, kind: 'high' },
      { bar: 9, price: 30025, kind: 'pass' },
      { bar: 10, price: 30040, kind: 'high' },
      { bar: 12, price: 30020, kind: 'low' },
      { bar: 18, price: 30060, kind: 'high' },
    ];
    for (let s = 1; s <= 50; s++) {
      const cs = build(s, wp);
      eq(G.validate(cs, 0.25), [], 'seed ' + s);
      const sw = TJR.swings.find(cs);
      ok(has(sw.highs, 30000, 0), 'seed ' + s + ' high at 0');
      ok(has(sw.highs, 30040, 10), 'seed ' + s + ' high at 10');
      ok(has(sw.lows, 30020, 12), 'seed ' + s + ' low at 12');
      ok(has(sw.highs, 30060, 18), 'seed ' + s + ' high at 18');
      eq(cs[9].c, 30025, 'seed ' + s + ' pass at 9');
      const near = cs.slice(10, 16).map((k) => k.l);   // two bars either side of the low pair [12,13]
      ok(Math.min(...near) === 30020 && near.filter((l) => l === 30020).length === 1, 'seed ' + s + ' low 30020 strict in 10..15');
    }
  });

  test('gen.path: a script whose own waypoint would take out a neighbouring swing throws', () => {
    // pass close 29990 opens candle 10, two bars before a low at 30020: that low could never read as a low
    const wp = [
      { bar: 0, price: 30000 },
      { bar: 9, price: 29990, kind: 'pass' },
      { bar: 10, price: 30040, kind: 'high' },
      { bar: 12, price: 30020, kind: 'low' },
    ];
    throws(() => G.path(TJR.rng.make(1), wp, OPTS), /conflict/i, 'contradictory script');
  });

  test('gen.path: vol / wick set average body and wick size', () => {
    const wp = [{ bar: 0, price: 30000 }, { bar: 300, price: 30000 }];
    let body = 0, wick = 0, n = 0;
    for (let s = 1; s <= 5; s++) {
      const cs = build(s, wp, { vol: 10, wick: 5, chop: 0.3, tick: 0.25 });
      for (const k of cs) {
        body += Math.abs(k.c - k.o);
        wick += (k.h - Math.max(k.o, k.c) + Math.min(k.o, k.c) - k.l) / 2;
        n++;
      }
    }
    body /= n; wick /= n;
    ok(body > 6 && body < 15, 'avg body ~ vol 10, got ' + body.toFixed(2));
    ok(wick > 3 && wick < 7.5, 'avg wick ~ wick 5, got ' + wick.toFixed(2));
  });

  test('gen.path: higher chop flips candle direction more often', () => {
    const wp = [{ bar: 0, price: 30000 }, { bar: 300, price: 30000 }];
    const flipRate = (chop) => {
      let flips = 0, pairs = 0;
      for (let s = 1; s <= 10; s++) {
        const cs = build(s, wp, { vol: 8, wick: 4, chop, tick: 0.25 });
        for (let i = 1; i < cs.length; i++) {
          const a = Math.sign(cs[i - 1].c - cs[i - 1].o), b = Math.sign(cs[i].c - cs[i].o);
          if (a && b) { pairs++; if (a !== b) flips++; }
        }
      }
      return flips / pairs;
    };
    const calm = flipRate(0), choppy = flipRate(0.9);
    ok(choppy > calm + 0.08, 'flip rate chop 0.9 (' + choppy.toFixed(3) + ') should exceed chop 0 (' + calm.toFixed(3) + ')');
  });

  test('gen.path: bad waypoint scripts throw clear errors', () => {
    const r = () => TJR.rng.make(1);
    throws(() => G.path(r(), [], OPTS), /waypoint/i, 'empty');
    throws(() => G.path(r(), [{ bar: 2, price: 30000 }], OPTS), /bar 0/, 'first not at bar 0');
    throws(() => G.path(r(), [{ bar: 0, price: 1 }, { bar: 9, price: 2 }, { bar: 5, price: 3 }], OPTS), /sorted|order/i, 'unsorted');
    throws(() => G.path(r(), [{ bar: 0, price: 30000 }, { bar: 20, price: 30050, kind: 'high' }, { bar: 21, price: 30000 }], OPTS),
      /too close|collide/i, 'pass on the second candle of a high pair');
    throws(() => G.path(r(), [{ bar: 0, price: 30000 }, { bar: 20, price: 30050, kind: 'high' }], { bars: 21 }),
      /bar\+1|needs bar/i, 'high on the last bar has no second candle');
    throws(() => G.path(r(), [{ bar: 0, price: 30000 }, { bar: 5, price: 30010, kind: 'top' }], OPTS), /kind/i, 'unknown kind');
  });

  // ---------- guard ----------

  test('gen.guard: maxHigh 30049 over 21..39 -> no high >= 30049 there, still valid, outside untouched', () => {
    for (let s = 1; s <= 50; s++) {
      const cs = build(s);
      const before = JSON.stringify(cs);
      const g = G.guard(cs, [{ from: 21, to: 39, maxHigh: 30049 }]);
      eq(JSON.stringify(cs), before, 'seed ' + s + ' input not mutated');
      eq(g.length, cs.length);
      eq(G.validate(g, 0.25), [], 'seed ' + s + ' validate after guard');
      for (let i = 21; i <= 39; i++) {
        ok(g[i].h < 30049, 'seed ' + s + ' bar ' + i + ' high ' + g[i].h);
        ok(g[i].o < 30049 && g[i].c < 30049, 'seed ' + s + ' bar ' + i + ' body below the cap');
      }
      for (let i = 0; i < 20; i++) eq(g[i], cs[i], 'seed ' + s + ' bar ' + i + ' untouched');
      ok(TJR.swings.isLow(g, 40) && has(TJR.swings.find(g).lows, 29980, 40), 'seed ' + s + ' low pair kept');
    }
  });

  test('gen.guard: minLow keeps lows strictly above; untouched candles stay identical', () => {
    for (let s = 1; s <= 30; s++) {
      const cs = build(s);
      const ref = Math.min(...cs.slice(5, 16).map((k) => k.l)) + 6;   // force real clipping
      const g = G.guard(cs, [{ from: 5, to: 15, minLow: ref }]);
      eq(G.validate(g, 0.25), [], 'seed ' + s);
      for (let i = 5; i <= 15; i++) ok(g[i].l > ref, 'seed ' + s + ' bar ' + i + ' low ' + g[i].l + ' > ' + ref);
      for (let i = 17; i < cs.length; i++) eq(g[i], cs[i], 'seed ' + s + ' bar ' + i + ' untouched');
    }
  });

  test('gen.guard: a hand-built poke through the level is folded back under it', () => {
    const cs = [
      K(100, 101, 99, 100.5),
      K(100.5, 104, 100, 103.5),   // pokes above 102
      K(103.5, 106, 103, 105),     // entirely above 102
      K(105, 105.5, 100.75, 101),
      K(101, 101.5, 99.5, 100),
    ];
    const g = G.guard(cs, [{ from: 1, to: 3, maxHigh: 102 }]);
    eq(G.validate(g, 0.25), []);
    for (let i = 1; i <= 3; i++) ok(g[i].h < 102 && g[i].l <= Math.min(g[i].o, g[i].c), 'bar ' + i + ' ' + JSON.stringify(g[i]));
    eq(g[0], cs[0], 'bar 0 close already under the cap: untouched');
    eq(g[4].c, 100, 'bar 4 keeps its close');
    eq(g[4].o, g[3].c, 'bar 4 open follows the guarded close');
  });

  test('gen.guard: repairs the chain into the range (candle from-1 close) when it sits above the cap', () => {
    const cs = [K(100, 106, 99.5, 105), K(105, 105.5, 101, 101.5), K(101.5, 102, 100, 100.5)];
    const g = G.guard(cs, [{ from: 1, to: 2, maxHigh: 103 }]);
    eq(G.validate(g, 0.25), []);
    ok(g[1].o < 103 && g[1].h < 103, 'bar 1 open/high under the cap');
    eq(g[0].c, g[1].o, 'chain repaired');
    eq(g[0].h, 106, 'bar 0 high is outside the rule and keeps its wick');
  });

  // ---------- stamp ----------

  test('gen.stamp: adds t = start + i * tf minutes, does not mutate', () => {
    const cs = [K(1, 2, 0.5, 1.5), K(1.5, 2, 1, 1.25), K(1.25, 1.5, 1, 1)];
    const st = utc(2026, 7, 1, 13, 30);
    const out = G.stamp(cs, st, 5);
    eq(out.map((k) => k.t), [st, st + 300, st + 600]);
    eq(out[1], { t: st + 300, o: 1.5, h: 2, l: 1, c: 1.25 });
    ok(!('t' in cs[0]), 'input untouched');
  });

  // ---------- rollup ----------

  const series = (startUtc, tf, count, startPrice) => {
    const out = [];
    let p = startPrice;
    for (let i = 0; i < count; i++) {
      const c = p + ((i * 7) % 5) - 2;
      out.push({ t: startUtc + i * tf * 60, o: p, h: Math.max(p, c) + 1 + (i % 3), l: Math.min(p, c) - 1 - (i % 2), c });
      p = c;
    }
    return out;
  };

  test('gen.rollup: 12 x 5m -> one 60m candle with first.o / max h / min l / last.c / bucket t', () => {
    const st = utc(2026, 7, 1, 13, 0);   // 09:00 ET (EDT)
    const cs = series(st, 5, 12, 30000);
    const r = G.rollup(cs, 5, 60);
    eq(r.length, 1);
    eq(r[0], {
      t: st, o: cs[0].o,
      h: Math.max(...cs.map((k) => k.h)), l: Math.min(...cs.map((k) => k.l)),
      c: cs[11].c,
    });
  });

  test('gen.rollup: 4H buckets align to the 18:00 ET futures day (summer)', () => {
    const st = utc(2026, 7, 1, 20, 0);   // 16:00 EDT
    const cs = series(st, 5, 48, 30000); // 16:00 .. 19:55 ET
    const r = G.rollup(cs, 5, 240);
    eq(r.map((k) => k.t), [utc(2026, 7, 1, 18, 0), utc(2026, 7, 1, 22, 0)], '14:00 ET and 18:00 ET buckets');
    eq(r[0].o, cs[0].o);
    eq(r[0].c, cs[23].c);
    eq(r[1].o, cs[24].o);
    eq(r[1].c, cs[47].c);
    eq(G.validate(r, 0.25), []);
  });

  test('gen.rollup: daily buckets start 18:00 ET, winter and both DST switch days', () => {
    const day = (t) => G.rollup([{ t, o: 1, h: 2, l: 0, c: 1 }], 5, 1440)[0].t;
    eq(day(utc(2026, 1, 15, 15, 0)), utc(2026, 1, 14, 23, 0), 'Thu 10:00 EST -> Wed 18:00 EST');
    eq(day(utc(2026, 1, 15, 22, 55)), utc(2026, 1, 14, 23, 0), '17:55 EST still the same day');
    eq(day(utc(2026, 1, 15, 23, 0)), utc(2026, 1, 15, 23, 0), '18:00 EST opens a new day');
    eq(day(utc(2026, 7, 1, 14, 0)), utc(2026, 6, 30, 22, 0), 'summer: 18:00 EDT = 22:00Z');
    eq(day(utc(2026, 3, 9, 13, 30)), utc(2026, 3, 8, 22, 0), 'Mon after spring-forward: Sun 18:00 EDT');
    eq(day(utc(2026, 11, 2, 14, 30)), utc(2026, 11, 1, 23, 0), 'Mon after fall-back: Sun 18:00 EST');
    const cs = [
      { t: utc(2026, 1, 15, 22, 50), o: 10, h: 12, l: 9, c: 11 },
      { t: utc(2026, 1, 15, 22, 55), o: 11, h: 14, l: 10, c: 13 },
      { t: utc(2026, 1, 15, 23, 0), o: 13, h: 13.5, l: 8, c: 9 },
    ];
    eq(G.rollup(cs, 5, 1440), [
      { t: utc(2026, 1, 14, 23, 0), o: 10, h: 14, l: 9, c: 13 },
      { t: utc(2026, 1, 15, 23, 0), o: 13, h: 13.5, l: 8, c: 9 },
    ]);
  });

  test('gen.rollup: rejects targets that are not whole multiples, or unstamped candles', () => {
    const cs = series(utc(2026, 7, 1, 13, 0), 5, 6, 100);
    throws(() => G.rollup(cs, 5, 7), /multiple/i, 'target 7 from 5');
    throws(() => G.rollup(cs, 5, 2880), /1440|day/i, 'beyond a day');
    throws(() => G.rollup([K(1, 2, 0, 1)], 5, 60), /\bt\b|stamp/i, 'no t');
    eq(G.rollup(cs, 5, 5), cs, 'same tf returns equal copies');
  });

  test('gen.rollup + path + stamp: a generated day rolls up into valid candles', () => {
    const cs = G.stamp(build(11, WP, Object.assign({ bars: 288 }, OPTS)), utc(2026, 7, 1, 22, 0), 5);
    for (const tf of [15, 60, 240, 1440]) {
      const r = G.rollup(cs, 5, tf);
      eq(G.validate(r, 0.25), [], 'tf ' + tf);
      eq(r.length, 1440 / tf, 'one futures day of ' + tf + 'm buckets');
    }
  });

  // ---------- validate ----------

  test('gen.validate: flags wick, tick and chain errors; empty for a clean series', () => {
    eq(G.validate([K(1, 2, 0.5, 1.5), K(1.5, 2, 1, 1.25)], 0.25), []);
    const errs = G.validate([
      K(1, 2, 0.5, 1.5),
      K(1.5, 1.25, 1, 1.25),     // h < max(o,c)
      K(1.25, 2, 1.5, 1.75),     // l > min(o,c)
      K(1.75, 2.1, 1, 1.5),      // h off tick
      K(1.25, 2, 1, 1.5),        // o !== previous c
    ], 0.25);
    eq(errs.length, 4, 'four errors: ' + JSON.stringify(errs));
    ok(/bar 1/.test(errs[0]) && /\bh\b/.test(errs[0]), errs[0]);
    ok(/bar 2/.test(errs[1]) && /\bl\b/.test(errs[1]), errs[1]);
    ok(/bar 3/.test(errs[2]) && /tick/.test(errs[2]), errs[2]);
    ok(/bar 4/.test(errs[3]) && /open|\bo\b/.test(errs[3]), errs[3]);
    ok(G.validate([K(1, NaN, 0, 1)], 0.25).length > 0, 'NaN is invalid');
  });
})();
