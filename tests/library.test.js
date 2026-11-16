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
})();
