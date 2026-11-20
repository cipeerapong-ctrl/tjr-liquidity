// Full-system scenarios S15-S22 (Level 2): every scenario x seeds 1..200 x each outcome passes check(); truth is
// read back from the candles by TJR.confluence; facts are real playlist ids; annotate shows no confirm / cont
// overlay before the setup starts. Wrapped in an IIFE: test files share one vm global scope.
(() => {
  const S = TJR.scenarios, C = TJR.confluence;
  const IDS = ['S15', 'S16', 'S17', 'S18', 'S19', 'S20', 'S21', 'S22'];
  const V1 = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11', 'S12', 'S13', 'S14'];
  const SEEDS = 200;
  const THAI = /[฀-๿]/;
  const outcomesOf = (d) => (d.outcomes.length ? d.outcomes : [undefined]);
  const build = (id, seed, outcome) => S.get(id).build(seed, outcome ? { outcome } : {});
  const playlistText = {};
  function factExists(f) {
    if (/^F\d+\.\d+$/.test(f)) return new RegExp('^- ' + f.replace('.', '\\.') + ' ', 'm').test(readText('docs/source/clip-facts.md'));
    const m = /^P(\d+)\.\d+$/.exec(f);
    if (!m) return false;
    const src = TJR.sources.byClip(+m[1]);
    if (!src || src.main) return false;
    const txt = playlistText[src.id] || (playlistText[src.id] = readText('docs/source/playlist/' + src.id + '.md'));
    return new RegExp('^- ' + f.replace('.', '\\.') + ' ', 'm').test(txt);
  }
  // the bar the setup starts at: the sweep, or (S21, no sweep on the traded index) the bar the SMT is knowable
  const startBar = (T) => (T.sweep ? T.sweep.bar : T.smt.at);

  test('system: S15..S22 registered after S01..S14; get(); kit and register exposed', () => {
    eq(S.list.map((d) => d.id), V1.concat(IDS), 'library order');
    IDS.forEach((id) => ok(S.get(id) && S.get(id).id === id, id + ' get'));
    ok(S.kit && typeof S.kit.Script === 'function' && typeof S.kit.mixSeed === 'function', 'kit exposes Script and mixSeed');
    ok(S.kit.VOL.ES15 && S.kit.VOL.ES60 && S.kit.VOL.NQ5 && S.kit.VOL.ES5, 'VOL has the v2 tf / instrument entries');
    eq(S.kit.VOL.NQ5, [7, 10], 'v1 VOL numbers unchanged');
    eq(S.kit.VOL.ES5, [2, 2.75], 'v1 VOL numbers unchanged');
    ok(typeof S.register === 'function', 'register');
  });

  test('system: defs - Thai copy, playlist facts that exist, clip chips {clip, sec} inside the video, lab flags', () => {
    for (const id of IDS) {
      const d = S.get(id);
      ok(THAI.test(d.title) && THAI.test(d.summary), id + ' Thai title and summary');
      ok(d.facts.length > 0, id + ' has facts');
      d.facts.forEach((f) => { ok(/^P\d+\.\d+$/.test(f), id + ' fact ' + f + ' is a playlist id'); ok(factExists(f), id + ' fact ' + f + ' exists in its playlist file'); });
      ok(d.clip.length > 0, id + ' has clip chips');
      d.clip.forEach((c) => {
        const src = TJR.sources.byClip(c.clip);
        ok(src && !src.main, id + ' chip clip ' + c.clip + ' is a playlist video');
        ok(Number.isInteger(c.sec) && c.sec >= 0 && c.sec <= src.dur, id + ' chip second ' + c.sec + ' inside #' + c.clip);
        ok(TJR.layout.chip(c.sec, c.clip).indexOf('ts-chip--pl') >= 0, id + ' chip renders as a playlist chip');
      });
      ok([5, 15, 60].includes(d.tf), id + ' tf');
      ok(['NQ', 'ES'].includes(d.instrument), id + ' instrument');
      ['replay', 'spot', 'sessions', 'quiz'].forEach((m) => ok(typeof d.lab[m] === 'boolean', id + ' lab.' + m));
      eq(d.lab.replay, ['S15', 'S16', 'S22'].includes(id), id + ' lab.replay');
      eq([d.lab.spot, d.lab.sessions, d.lab.quiz], [false, false, false], id + ' other lab modes off');
    }
    eq(IDS.map((id) => S.get(id).outcomes), [['win', 'fail'], ['win', 'fail'], ['win'], [], ['win'], [], ['win'], ['win']], 'outcomes');
    eq(IDS.map((id) => [S.get(id).tf, S.get(id).instrument]),
      [[5, 'NQ'], [5, 'ES'], [15, 'ES'], [60, 'ES'], [60, 'ES'], [5, 'ES'], [5, 'ES'], [5, 'NQ']], 'tf / instrument');
  });

  for (const id of IDS) {
    test('system: ' + id + ' seeds 1..' + SEEDS + ' pass check(); no confirm / cont overlay before the setup starts', () => {
      const d = S.get(id);
      for (const outcome of outcomesOf(d)) {
        for (let s = 1; s <= SEEDS; s++) {
          const tag = id + ' seed ' + s + (outcome ? ' ' + outcome : '');
          let b;
          try { b = d.build(s, outcome ? { outcome } : {}); } catch (e) { throw new Error(tag + ': build threw: ' + e.message); }
          eq(S.check(b), [], tag);
          eq([b.meta.id, b.meta.seed, b.meta.tf], [id, s, d.tf], tag + ' meta');
          eq(b.truth.outcome, outcome || null, tag + ' outcome');
          const T = b.truth, K = T.confluence;
          ok(K && K.confirm, tag + ' has a confirmation');
          const upTo = startBar(T) - 1;
          const pre = TJR.annotate(b, { upTo });
          ok(!pre.some((o) => o.type === 'zone' || o.id === 'target'), tag + ' no entry zone / target before the start');
          ok(pre.every((o) => o.appearAt <= upTo), tag + ' annotate: nothing from the future');
          const pc = TJR.annotate.confluence(b, { upTo });
          ok(pc.every((o) => o.appearAt <= upTo), tag + ' annotate.confluence: nothing from the future');
          if (K.confirm.kind === 'bos') ok(!pc.some((o) => o.type === 'bos' && o.at === K.confirm.at), tag + ' no confirm BOS');
          else ok(!pc.some((o) => o.id === 'fvg:' + K.confirm.i && o.state === 'disrespected'), tag + ' no confirm IFVG');
          if (K.cont && K.cont.kind === 'fvg') ok(!pc.some((o) => o.id === 'fvg:' + K.cont.i), tag + ' no cont FVG');
          if (K.cont && K.cont.kind === 'eq') ok(!pc.some((o) => o.type === 'eq' && o.from === K.cont.from && o.to === K.cont.to), tag + ' no cont EQ');
        }
      }
    });
  }

  test('system: truth reads back from the detectors (S15 bos+fvg, S16/S22 ifvg+fvg, S17/S21 bos+eq, S19 stack)', () => {
    const b15 = build('S15', 4), K = b15.truth.confluence, cs = b15.candles;
    eq([K.confirm.kind, K.cont.kind, b15.truth.side], ['bos', 'fvg', 'long']);
    const ev = C.bos(cs, { trend: 'down', from: b15.truth.sweep.bar + 1 })[0];
    eq([ev.at, ev.dir], [K.confirm.at, 'up'], 'S15 confirm = first up BOS after the sweep');
    const g = C.fvgs(cs.slice(0, K.entry.at + 1)).find((x) => x.i === K.cont.i);
    eq([g.dir, g.state, g.stateAt, g.low, g.high], ['bull', 'respected', K.entry.at, K.cont.low, K.cont.high], 'S15 cont gap respected at the entry bar');
    eq(K.entry.price, cs[K.entry.at].c, 'entry at the close');
    eq(b15.truth.entryWindow.from, K.entry.at, 'v1 entryWindow starts at the entry');
    eq(b15.truth.confirmBar, K.confirm.at, 'v1 confirmBar = confirm');
    ok(K.targets.length && b15.truth.target.price === K.targets[0].price, 'v1 target = first target');
    for (const id of ['S16', 'S22']) {
      const k = build(id, 4).truth.confluence;
      eq([k.confirm.kind, k.cont.kind], ['ifvg', 'fvg'], id + ' kinds');
    }
    eq(build('S16', 4).truth.side, 'short');
    for (const id of ['S17', 'S21']) {
      const b = build(id, 4), k = b.truth.confluence;
      eq([k.confirm.kind, k.cont.kind, b.truth.side], ['bos', 'eq', 'short'], id + ' kinds');
      const r = C.eqRange(b.candles, { at: k.cont.at, dir: 'down' });
      eq([r.low, r.high, r.eq], [k.cont.low, k.cont.high, k.cont.eq], id + ' eq range = detector');
      ok(b.candles[k.entry.at].c < b.candles[k.entry.at].o && b.candles[k.entry.at].c < k.cont.eq, id + ' bearish close under eq');
    }
    const k19 = build('S19', 4).truth.confluence;
    ok(k19.stack && k19.stack.top !== k19.cont.i, 'S19 stack: top gap and the bottom gap (cont)');
  });

  test('system: no-trade scenarios S18 (gap closed through) and S20 (wick, not a BOS)', () => {
    for (let s = 1; s <= 5; s++) {
      const b = build('S18', s), T = b.truth, K = T.confluence;
      eq([T.side, T.entryWindow, T.target, T.outcome, K.entry], [null, null, null, null, null], 'S18 no trade');
      eq(K.noTrade.kind, 'disrespected');
      const g = C.fvgs(b.candles).find((x) => x.i === K.cont.i);
      eq([g.dir, g.state, g.stateAt], ['bear', 'disrespected', K.noTrade.at], 'S18 the bear gap is closed above');
      eq(C.fvgs(b.candles.slice(0, K.noTrade.at)).find((x) => x.i === K.cont.i).state, 'open', 'S18 never respected first');
      const w = build('S20', s), W = w.truth, KW = W.confluence, k = w.candles[KW.noTrade.at];
      eq([W.side, KW.noTrade.kind], [null, 'wick'], 'S20 no trade at the wick');
      ok(k.l < KW.noTrade.level.price && k.c >= KW.noTrade.level.price, 'S20 wick under the low, close not under it');
      ok(KW.confirm.at > KW.noTrade.at, 'S20 the real break comes later');
      ok(!C.bos(w.candles, { trend: 'up', from: KW.noTrade.at - 3 }).some((e) => e.at <= KW.noTrade.at), 'S20 no BOS at the wick');
    }
  });

  test('system: S21 twin - same times, ES lower high (main), NQ higher high (twin), leader main; S22 windows', () => {
    for (let s = 1; s <= 5; s++) {
      const b = build('S21', s), T = b.truth;
      eq(T.twin.instrument, 'NQ');
      eq(T.twin.candles.map((k) => k.t), b.candles.map((k) => k.t), 'twin shares the clock');
      eq(TJR.gen.validate(T.twin.candles, 0.25), [], 'twin candles valid');
      ok(T.smt.main.p2.price < T.smt.main.p1.price && T.smt.twin.p2.price > T.smt.twin.p1.price, 'ES LH, NQ HH');
      eq([T.smt.type, T.smt.leader, T.twin.leader], ['bearish', 'main', 'main']);
      const c = build('S22', s), N = TJR.sessions.nyWindows(c.candles[c.truth.sweep.bar].t);
      const ts = c.candles[c.truth.sweep.bar].t, te = c.candles[c.truth.confluence.entry.at].t;
      ok(ts >= N.manipulation.from && ts < N.manipulation.to, 'S22 sweep inside 09:30-09:50 ET');
      ok(te >= N.entry.from && te < N.entry.to, 'S22 entry inside 09:50-10:10 ET');
    }
  });

  test('system: check catches tampered v2 truth', () => {
    const bad = (id, fn, what, outcome) => { const b = build(id, 3, outcome); fn(b); ok(S.check(b).length > 0, what + ' should be caught'); };
    bad('S15', (b) => { b.truth.confluence.confirm.at += 1; }, 'confirm bar off');
    bad('S15', (b) => { b.truth.confluence.entry.at += 1; }, 'entry bar off');
    bad('S15', (b) => { b.truth.confluence.cont.high += 0.25; }, 'gap edge off a tick');
    bad('S15', (b) => { b.truth.outcome = 'fail'; }, 'win relabelled fail');
    bad('S15', (b) => { b.truth.outcome = 'win'; }, 'fail relabelled win', 'fail');
    bad('S16', (b) => { b.truth.confluence.confirm.at -= 1; }, 'IFVG bar off');
    bad('S17', (b) => { b.truth.confluence.cont.eq += 0.25; }, 'equilibrium off a tick');
    bad('S18', (b) => { b.truth.confluence.noTrade.at -= 1; }, 'S18 disrespect bar off');
    bad('S20', (b) => { b.truth.confluence.noTrade.at += 2; }, 'S20 wick bar off');
    bad('S21', (b) => { b.truth.smt.leader = 'twin'; }, 'SMT leader flipped');
    bad('S21', (b) => { const k = b.truth.twin.candles[5]; k.h = Math.max(k.o, k.c) - 0.25; }, 'broken twin candle');
    bad('S22', (b) => { b.candles.forEach((k) => { k.t += 3600; }); b.truth.twin = undefined; }, 'S22 shifted out of the NY windows');
    bad('S19', (b) => { b.truth.confluence.stack.top = b.truth.confluence.cont.i; }, 'S19 stack top = bottom');
  });

  test('system: notes cite real facts in Thai at bars on the chart; every def fact is cited', () => {
    for (const id of IDS) {
      for (const outcome of outcomesOf(S.get(id))) {
        const b = build(id, 11, outcome);
        ok(b.truth.notes.length > 0, id + ' has notes');
        b.truth.notes.forEach((n) => {
          ok(factExists(n.fact), id + ' note fact ' + n.fact);
          ok(THAI.test(n.text), id + ' note Thai');
          ok(n.bar >= 0 && n.bar < b.candles.length, id + ' note bar');
        });
        const cited = new Set(b.truth.notes.map((n) => n.fact));
        S.get(id).facts.forEach((f) => ok(cited.has(f), id + ' ' + (outcome || '') + ': def fact ' + f + ' is cited by a note'));
      }
    }
  });

  test('system: real ET times in market hours; deterministic; replay random draws pass check', () => {
    for (const id of IDS) {
      eq(JSON.stringify(build(id, 7)), JSON.stringify(build(id, 7)), id + ' deterministic');
      ok(JSON.stringify(build(id, 7).candles) !== JSON.stringify(build(id, 8).candles), id + ' seeds differ');
      for (let s = 1; s <= 10; s++) {
        const b = build(id, s);
        b.candles.forEach((k, i) => {
          if (i) ok(k.t > b.candles[i - 1].t, id + ' t increasing');
          const w = TJR.sessions.which(k.t);
          ok(w !== 'weekend' && w !== 'spread', id + ' seed ' + s + ' bar ' + i + ' trades in market hours (' + w + ')');
        });
      }
    }
    const rng = TJR.rng.make(17);
    const seen = new Set();
    for (let i = 0; i < 40; i++) { const r = S.random(rng, 'replay'); seen.add(r.def.id); eq(S.check(r.built), [], 'replay draw ' + r.def.id); }
    ok(['S15', 'S16', 'S22'].some((id) => seen.has(id)), 'replay draws include Level 2 setups');
  });
})();
