// Scenario library S01-S14 + annotate: every scenario x seeds 1..200 (both outcomes where supported)
// passes the invariant checker; annotate never shows the future; ids and clip facts are real.
// Wrapped in an IIFE: test files share one vm global scope.
(() => {
  const S = TJR.scenarios;
  const IDS = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11', 'S12', 'S13', 'S14'];
  const FAIL_IDS = ['S01', 'S03', 'S09', 'S10'];   // D4: replay setups with an outcome:'fail' variant
  const SEEDS = 200;
  const THAI = /[฀-๿]/;
  const factIds = new Set((readText('docs/source/clip-facts.md').match(/^- (F\d+\.\d+)/gm) || []).map((s) => s.slice(2)));
  const outcomesOf = (d) => (d.outcomes.length ? d.outcomes : [undefined]);
  const build = (id, seed, outcome) => S.get(id).build(seed, outcome ? { outcome } : {});

  test('library: S01..S14 in order; get(); Thai copy; facts exist in clip-facts.md', () => {
    ok(factIds.size > 50, 'clip-facts.md parsed (' + factIds.size + ' fact ids)');
    eq(S.list.map((d) => d.id), IDS);
    for (const d of S.list) {
      ok(S.get(d.id) === d, d.id + ' get');
      ok(THAI.test(d.title) && THAI.test(d.summary), d.id + ' Thai title and summary');
      ok(d.facts.length > 0, d.id + ' has facts');
      d.facts.forEach((f) => ok(factIds.has(f), d.id + ' fact ' + f + ' exists in clip-facts.md'));
      ok(d.clip.length > 0 && d.clip.every((s) => Number.isInteger(s) && s >= 0 && s <= 2947), d.id + ' clip seconds');
      ok([1, 5, 15, 60, 240, 1440].includes(d.tf), d.id + ' tf');
      ok(['NQ', 'ES'].includes(d.instrument), d.id + ' instrument');
      ['replay', 'spot', 'sessions', 'quiz'].forEach((m) => ok(typeof d.lab[m] === 'boolean', d.id + ' lab.' + m));
      ok(typeof d.build === 'function', d.id + ' build');
      if (d.lab.replay) ok(d.outcomes.includes('win'), d.id + ' replay scenario trades');
    }
    eq(S.list.filter((d) => d.outcomes.includes('fail')).map((d) => d.id), FAIL_IDS, 'fail variants (D4)');
    eq(S.get('S99'), null, 'unknown id');
  });

  for (const id of IDS) {
    test('library: ' + id + ' seeds 1..' + SEEDS + ' pass check(); annotate before the sweep shows no sweep and no entry', () => {
      const d = S.get(id);
      for (const outcome of outcomesOf(d)) {
        for (let s = 1; s <= SEEDS; s++) {
          const tag = id + ' seed ' + s + (outcome ? ' ' + outcome : '');
          let b;
          try { b = d.build(s, outcome ? { outcome } : {}); } catch (e) { throw new Error(tag + ': build threw: ' + e.message); }
          eq(S.check(b), [], tag);
          eq(b.meta.id, id, tag + ' meta.id');
          eq(b.meta.seed, s, tag + ' meta.seed');
          eq(b.meta.tf, d.tf, tag + ' meta.tf');
          eq(b.truth.outcome, outcome || null, tag + ' outcome');
          ok(b.truth.sweep, tag + ' has a sweep');
          const upTo = b.truth.sweep.bar - 1;
          const pre = TJR.annotate(b, { upTo });
          ok(!pre.some((o) => o.type === 'level' && o.state === 'swept'), tag + ' no swept level before the sweep');
          ok(!pre.some((o) => o.type === 'zone'), tag + ' no entry zone before the sweep');
          ok(pre.every((o) => typeof o.appearAt === 'number' && o.appearAt <= upTo), tag + ' nothing from the future');
        }
      }
    });
  }

  test('library: same seed -> same chart; different seed -> different chart', () => {
    for (const id of IDS) {
      eq(JSON.stringify(build(id, 7)), JSON.stringify(build(id, 7)), id + ' deterministic');
      ok(JSON.stringify(build(id, 7).candles) !== JSON.stringify(build(id, 8).candles), id + ' seeds differ');
    }
  });

  test('library: real ET times - weekdays only, increasing, session days start at Asia 18:00', () => {
    for (const id of IDS) {
      for (let s = 1; s <= 20; s++) {
        const b = build(id, s);
        b.candles.forEach((k, i) => {
          ok(Number.isInteger(k.t), id + ' t integer');
          if (i) ok(k.t > b.candles[i - 1].t, id + ' t increasing at ' + i);
          if (b.meta.tf < 1440) ok(TJR.sessions.which(k.t) !== 'weekend' && TJR.sessions.which(k.t) !== 'spread', id + ' seed ' + s + ' bar ' + i + ' trades in market hours');
        });
      }
    }
    for (const id of ['S07', 'S08', 'S09']) {
      const b = build(id, 3);
      eq(TJR.sessions.fmtET(b.candles[0].t), '18:00', id + ' starts at Asia open');
      eq(TJR.sessions.fmtET(b.candles[b.candles.length - 1].t), id === 'S09' ? '11:59' : '11:55', id + ' ends before NY 12:00');
      eq(b.truth.sessions.map((x) => x.name), ['asia', 'london', 'ny'], id + ' session boxes');
    }
    eq(TJR.sessions.toET(build('S08', 5).candles[0].t).dow, 0, 'S08 opens Sunday 18:00 (Monday session)');
  });

  test('library: notes cite real facts, in Thai, at bars on the chart', () => {
    for (const id of IDS) {
      const b = build(id, 11);
      ok(b.truth.notes.length > 0, id + ' has notes');
      b.truth.notes.forEach((n) => {
        ok(factIds.has(n.fact), id + ' note fact ' + n.fact);
        ok(THAI.test(n.text), id + ' note Thai');
        ok(n.bar >= 0 && n.bar < b.candles.length, id + ' note bar');
      });
    }
  });

  test('annotate: S01 full chart - swept levels, labels at known bars, sweep marker, entry zone, target', () => {
    const b = build('S01', 7);
    const T = b.truth;
    const all = TJR.annotate(b);
    const levels = all.filter((o) => o.type === 'level' && o.kind !== 'target');
    eq(levels.length, T.levels.length, 'one level overlay per truth level');
    T.levels.forEach((l) => {
      const o = levels.find((x) => x.id === l.id);
      ok(o, 'overlay for ' + l.id);
      eq(o.price, l.price);
      eq(o.state, l.sweptAt != null ? 'swept' : 'active', l.id + ' state');
      eq(o.appearAt, l.known, l.id + ' appears when knowable');
    });
    const labels = all.filter((o) => o.type === 'label');
    eq(labels.map((o) => o.text), T.structure.map((p) => p.tag), 'structure labels');
    labels.forEach((o, i) => { eq(o.bar, T.structure[i].bar); eq(o.appearAt, T.structure[i].known); });
    const mk = all.find((o) => o.type === 'marker');
    ok(mk && mk.bar === T.sweep.bar && mk.appearAt === T.sweep.bar, 'sweep marker at the sweep bar');
    const z = all.find((o) => o.type === 'zone');
    ok(z && z.kind === 'entry' && z.from === T.entryWindow.from && z.to === T.entryWindow.to && z.appearAt === T.entryWindow.from, 'entry zone = D2 window');
    ok(z.low < z.high, 'zone has a price band');
    const tg = all.find((o) => o.type === 'level' && o.kind === 'target');
    ok(tg && tg.price === T.target.price, 'target level');
    ok(all.some((o) => o.type === 'trend'), 'stacked lows get a trendline');
    // mid-way: the sweep is visible, the entry zone is not yet
    const mid = TJR.annotate(b, { upTo: T.confirmBar });
    const sw = mid.find((o) => o.id === T.sweep.levelId);
    eq(sw.state, 'swept', 'swept once upTo >= sweptAt');
    ok(!mid.some((o) => o.type === 'zone'), 'no zone at the confirm bar');
  });

  test('annotate: S06 maps pdh to htf, session boxes appear when their window ends', () => {
    const b = build('S06', 4);
    const all = TJR.annotate(b);
    const pdh = all.find((o) => o.id === 'pdh');
    eq(pdh.kind, 'htf', 'pdh -> htf');
    const boxes = all.filter((o) => o.type === 'box');
    eq(boxes.map((o) => o.kind), ['asia', 'london', 'ny']);
    boxes.forEach((o, i) => {
      const s = b.truth.sessions[i];
      eq([o.from, o.to, o.low, o.high, o.appearAt], [s.from, s.to, s.low, s.high, s.to]);
    });
    const early = TJR.annotate(b, { upTo: b.truth.sessions[0].to - 1 });
    ok(!early.some((o) => o.type === 'box'), 'no box before Asia ends');
  });

  test('check: catches tampered truth and broken candles', () => {
    const fresh = () => build('S01', 3);
    const bad = (fn, what) => { const b = fresh(); fn(b); ok(S.check(b).length > 0, what + ' should be caught'); };
    eq(S.check(fresh()), [], 'untouched is clean');
    bad((b) => { const p = b.truth.structure.find((q) => q.tag === 'HL'); p.price += 0.25; }, 'HL moved a tick');
    bad((b) => { b.truth.structure.find((q) => q.tag === 'HH').bar += 1; }, 'HH bar off by one');
    bad((b) => { const l = b.truth.levels.find((q) => q.sweptAt != null); l.sweptAt -= 1; }, 'sweptAt one bar early');
    bad((b) => { const l = b.truth.levels.find((q) => q.sweptAt != null); l.sweptAt = null; }, 'swept level marked untaken');
    bad((b) => { b.truth.entryWindow.from = b.truth.confirmBar; }, 'entry on the confirm bar');
    bad((b) => { b.truth.confirmBar -= 1; }, 'confirmBar not the HH');
    bad((b) => { b.truth.outcome = 'fail'; }, 'win relabelled as fail');
    bad((b) => { b.truth.sweep.bar += 1; }, 'sweep bar off');
    bad((b) => { const k = b.candles[10]; k.h = Math.max(k.o, k.c) - 0.25; }, 'invalid candle');
    bad((b) => { b.truth.side = null; }, 'side removed but trade fields kept');
    const f = build('S01', 3, 'fail');
    eq(S.check(f), [], 'fail variant clean');
    f.truth.outcome = 'win';
    ok(S.check(f).length > 0, 'fail relabelled as win should be caught');
    const s6 = build('S06', 3);
    s6.truth.sessions[1].high += 0.25;
    ok(S.check(s6).length > 0, 'session box off by a tick should be caught');
    const s4 = build('S04', 3);
    eq(s4.truth.side, null, 'S04 has no trade');
    eq([s4.truth.confirmBar, s4.truth.entryWindow, s4.truth.target, s4.truth.outcome], [null, null, null, null], 'S04 trade fields null');
  });

  test('random: picks a scenario allowed in the mode; replay draws include fail setups (D4)', () => {
    const rng = TJR.rng.make(99);
    for (const mode of ['replay', 'spot', 'sessions', 'quiz']) {
      for (let i = 0; i < 12; i++) {
        const r = S.random(rng, mode);
        ok(r.def.lab[mode], mode + ' -> ' + r.def.id + ' allowed');
        eq(S.check(r.built), [], mode + ' draw is valid (' + r.def.id + ' seed ' + r.built.meta.seed + ')');
      }
    }
    let fails = 0, wins = 0;
    for (let i = 0; i < 120; i++) {
      const r = S.random(rng, 'replay');
      if (r.built.truth.outcome === 'fail') fails++; else wins++;
    }
    ok(fails >= 8 && wins > fails, 'fail share ~ 1 in 4 of fail-capable draws: ' + fails + ' fail / ' + wins + ' win');
  });

  // ---- fix round 1 ----

  // levels on the swept side taken between the sweep and the confirm swing (the stack price reversed from)
  const reversedFrom = (T) => {
    const sl = T.levels.find((l) => l.id === T.sweep.levelId);
    return T.levels.filter((l) => l.side === sl.side && l.sweptAt != null && l.sweptAt >= T.sweep.bar && l.sweptAt <= T.confirmBar);
  };

  test('check: an HL / LH inside the swept stack (above its deepest level) is caught', () => {
    for (const [id, pt] of [['S01', 'HL'], ['S10', 'LH']]) {
      let seen = 0;
      for (let s = 1; s <= 40; s++) {
        const b = build(id, s), T = b.truth, long = T.side === 'long';
        const stack = reversedFrom(T), sl = T.levels.find((l) => l.id === T.sweep.levelId);
        const edge = long ? Math.max(...stack.map((l) => l.price)) : Math.min(...stack.map((l) => l.price));
        if (edge === sl.price) continue;               // the sweep level is already the stack edge
        seen++;
        const p = T.structure.find((q) => q.tag === pt && q.bar > T.sweep.bar);
        p.price = edge;                                 // inside the stack: beyond the deepest level, not beyond all
        ok(S.check(b).some((x) => x.indexOf(pt + ' at ' + p.bar + ' does not hold beyond') === 0),
          id + ' seed ' + s + ': ' + pt + ' at the stack edge must be reported');
      }
      ok(seen >= 5, id + ': found ' + seen + ' seeds whose sweep level is not the stack edge');
    }
  });

  test('notes: the generic sweep note cites F6.3 (long) / F6.4 (short); scenario facts get their own notes', () => {
    const sweepFacts = { long: 'F6.3', short: 'F6.4' };
    let generic = null;
    for (const d of S.list.filter((x) => x.outcomes.length)) {
      for (const outcome of d.outcomes) {
        const b = d.build(5, { outcome }), T = b.truth;
        const atSweep = T.notes.filter((n) => n.bar === T.sweep.bar).map((n) => n.fact);
        const want = d.id === 'S09' ? 'F7.14' : sweepFacts[T.side];
        ok(atSweep.includes(want), d.id + ' ' + outcome + ': sweep note cites ' + want + ' (has ' + atSweep.join(',') + ')');
        if (d.id === 'S01') generic = T.notes.find((n) => n.bar === T.sweep.bar && n.fact === 'F6.3').text;
      }
    }
    ok(generic, 'S01 generic sweep text');
    for (const id of IDS) {
      for (const outcome of S.get(id).outcomes.length ? S.get(id).outcomes : [undefined]) {
        build(id, 5, outcome).truth.notes.forEach((n) => {
          if (n.text === generic) eq(n.fact, 'F6.3', id + ': the generic sweep text is only ever F6.3');
        });
      }
    }
    for (const [id, f] of [['S02', 'F5.4'], ['S10', 'F7.6'], ['S13', 'F8.3'], ['S14', 'F8.8']]) {
      const ns = build(id, 5).truth.notes.filter((n) => n.fact === f);
      ok(ns.length > 0, id + ' has a note citing ' + f);
      ns.forEach((n) => ok(n.text !== generic, id + ' ' + f + ' note says what ' + f + ' says, not the generic sweep text'));
    }
    const facts = (id) => build(id, 5).truth.notes.map((n) => n.fact);
    ok(facts('S09').includes('F7.12') && !facts('S09').includes('F7.13'), 'S09 target note cites F7.12');
    ok(!facts('S10').includes('F7.5') && facts('S10').includes('F8.4'), 'S10 target note cites F8.4');
    for (const id of IDS) {
      const cited = new Set(build(id, 5).truth.notes.map((n) => n.fact));
      S.get(id).facts.forEach((f) => ok(cited.has(f), id + ': def fact ' + f + ' is cited by a note'));
    }
  });

  test('resistance: before the sweep (low = untaken stack); resistanceAfter: high once price reverses away', () => {
    const by = (b) => Object.fromEntries(b.truth.levels.map((l) => [l.id, [l.resistance, l.resistanceAfter]]));
    for (const outcome of ['win', 'fail']) {
      const r = by(build('S01', 5, outcome));
      ['L1', 'L2', 'L3'].forEach((id) => eq(r[id], ['low', 'high'], 'S01 ' + outcome + ' ' + id));
      eq(r.T, [null, null], 'S01 ' + outcome + ' liquidity high T');
    }
    const r14 = by(build('S14', 5));
    ['LA', 'LB'].forEach((id) => eq(r14[id], ['low', 'high'], 'S14 swept lows: low before, high after'));
    ['SH1', 'SH2', 'SH3'].forEach((id) => eq(r14[id], ['low', 'low'], 'S14 stacked highs'));
    eq(by(build('S12', 5)).LQ, [null, 'high'], 'S12 single swept low: high after the reversal');
    eq(by(build('S04', 5)).L1, ['low', 'low'], 'S04 no reversal: resistanceAfter = resistance');
    eq(by(build('S07', 5))['london-low'], [null, null], 'S07 no trade: null');
    for (const id of IDS) {
      build(id, 9).truth.levels.forEach((l) => {
        ok(l.resistance === (l.group ? 'low' : null), id + ' ' + l.id + ' resistance');
        ok(l.resistanceAfter === 'high' || l.resistanceAfter === l.resistance, id + ' ' + l.id + ' resistanceAfter');
      });
    }
    const bad = (id, fn, what) => { const b = build(id, 5); fn(b.truth.levels); ok(S.check(b).length > 0, what + ' should be caught'); };
    bad('S14', (ls) => { ls.find((l) => l.id === 'LA').resistance = 'high'; }, 'S14 swept low marked high before the sweep');
    bad('S01', (ls) => { ls.find((l) => l.id === 'T').resistanceAfter = 'high'; }, 'S01 untouched target marked high');
    bad('S01', (ls) => { ls.find((l) => l.id === 'L2').resistanceAfter = 'low'; }, 'S01 reversed-from low kept low');
    bad('S04', (ls) => { ls.find((l) => l.id === 'L1').resistanceAfter = 'high'; }, 'S04 no reversal marked high');
  });

  test('safeBuild / random: an unlucky seed (throws or fails check) is replaced by the next seed', () => {
    ok(typeof S.safeBuild === 'function', 'scenarios.safeBuild exists');
    const real = S.get('S01');
    const seeds = [];
    const flaky = { id: 'SX', build: (seed, opts) => { seeds.push(seed); if (seeds.length < 3) throw new Error('unlucky'); return real.build(seed, opts); } };
    const b = S.safeBuild(flaky, 7, { outcome: 'fail' });
    eq(seeds.length, 3, 'two throws, then a clean build');
    eq(new Set(seeds).size, 3, 'each retry uses a new seed');
    eq(seeds[0], 7, 'first try uses the given seed');
    eq(S.check(b), [], 'result passes check');
    eq(b.meta.seed, seeds[2], 'meta.seed is the seed that built the chart');
    eq(b.truth.outcome, 'fail', 'opts pass through');
    eq(JSON.stringify(S.safeBuild(real, 7, { outcome: 'fail' })), JSON.stringify(real.build(7, { outcome: 'fail' })), 'a clean seed is used as is');
    let calls = 0;
    const dirty = { id: 'SY', build: (seed) => { calls++; const x = real.build(seed); if (calls === 1) x.truth.confirmBar -= 1; return x; } };
    eq(S.check(S.safeBuild(dirty, 3)), [], 'a build that fails check is retried');
    eq(calls, 2, 'one retry after the failed check');
    let threw = false;
    try { S.safeBuild({ id: 'SZ', build: () => { throw new Error('always'); } }, 1); } catch (e) { threw = /SZ/.test(e.message); }
    ok(threw, 'gives up with an error after a bounded number of tries');
    // random goes through the same guard: make the first build of every def throw
    const saved = S.list.map((d) => d.build);
    try {
      S.list.forEach((d, i) => { let n = 0; d.build = (seed, opts) => { if (n++ === 0) throw new Error('unlucky first'); return saved[i](seed, opts); }; });
      const rng = TJR.rng.make(4);
      for (let i = 0; i < 6; i++) {
        const r = S.random(rng, 'replay');
        eq(S.check(r.built), [], 'random recovers (' + r.def.id + ')');
      }
    } finally {
      S.list.forEach((d, i) => { d.build = saved[i]; });
    }
  });
})();
