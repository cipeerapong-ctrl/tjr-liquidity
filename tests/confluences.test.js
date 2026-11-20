/* Confluences page (Task 6): the pure helpers of assets/js/pages/confluences.js (TJR.confluencesPage) and the
   content rules of confluences.html. confluences.js is evaluated into this context (no DOM here, so it only
   attaches the helpers). Wrapped in an IIFE (one shared vm scope). */
(function () {
  'use strict';
  (0, eval)(readText('assets/js/pages/confluences.js'));
  var P = TJR.confluencesPage, C = TJR.confluence, S = TJR.scenarios;

  function k(o, h, l, c) { return { t: 0, o: o, h: h, l: l, c: c }; }
  function build(id, seed, opts) { return S.safeBuild(S.get(id), seed, opts || {}); }

  // ---------------------------------------------------------------- gapAt

  // bar 1 is an expansionary up candle; bar 0's top wick 101 < bar 2's bottom wick 104 -> one bull gap, middle 1
  var GAP = [k(100, 101, 99, 100), k(100, 108, 100, 107), k(107, 110, 104, 109), k(109, 111, 108, 110),
             k(110, 112, 109, 111), k(111, 112, 110, 111.5)];

  test('confluences.gapAt: the gap whose middle candle is within one bar of the clicked bar', () => {
    var g = P.gapAt(GAP, 1);
    ok(g && g.i === 1 && g.dir === 'bull' && g.low === 101 && g.high === 104, 'the gap, middle bar 1');
    eq(P.gapAt(GAP, 0).i, 1, 'the first candle of the gap');
    eq(P.gapAt(GAP, 2).i, 1, 'the third candle of the gap');
    eq(P.gapAt(GAP, 3), null, 'two bars away is a miss');
    eq(P.gapAt(GAP, 5), null);
    eq(P.gapAt(GAP, -4), null);
    eq(P.gapAt([], 0), null);
  });

  test('confluences.gapAt: the exact middle wins over a neighbouring gap; ties go to the earlier gap', () => {
    // two bull gaps with middles 1 and 3 (bars 1 and 3 are big up candles; bar 2 is a small down candle, so it is no middle)
    var cs = [k(10, 11, 9, 10), k(10, 16, 10, 15), k(15, 18, 13, 14), k(17, 23, 17, 22), k(22, 25, 20, 24)];
    var gaps = C.fvgs(cs);
    eq(gaps.map(function (g) { return g.i; }), [1, 3], 'precondition: two gaps');
    eq(P.gapAt(cs, 1).i, 1);
    eq(P.gapAt(cs, 3).i, 3);
    eq(P.gapAt(cs, 2).i, 1, 'bar 2 is one bar from both: the earlier gap');
  });

  test('confluences.gapAt: on a built S15 every real gap answers to its three candles and nothing two bars away', () => {
    for (var seed = 1; seed <= 12; seed++) {
      var cs = build('S15', seed).candles, gaps = C.fvgs(cs);
      ok(gaps.length > 0, 'S15 seed ' + seed + ' has gaps');
      for (var b = 0; b < cs.length; b++) {
        var g = P.gapAt(cs, b), near = gaps.filter(function (x) { return Math.abs(x.i - b) <= 1; });
        if (!near.length) eq(g, null, 'seed ' + seed + ' bar ' + b);
        else ok(g && Math.abs(g.i - b) <= 1, 'seed ' + seed + ' bar ' + b);
      }
    }
  });

  test('confluences.whyNoGap: wicks that overlap, a doji middle, the edges', () => {
    // up middle candle, but the first candle's top wick (105) reaches past the third's bottom wick (103)
    var o = [k(100, 105, 99, 101), k(101, 110, 101, 109), k(109, 111, 103, 110)];
    eq(P.whyNoGap(o, 1), { reason: 'overlap', dir: 'up', first: 105, third: 103, ticks: 8 });
    // down middle candle, the first's bottom wick (100) is at or under the third's top wick (101)
    var d = [k(110, 111, 100, 105), k(105, 105, 95, 96), k(96, 101, 94, 95)];
    eq(P.whyNoGap(d, 1), { reason: 'overlap', dir: 'down', first: 100, third: 101, ticks: 4 });
    // touching wicks are no gap either (P10.14)
    eq(P.whyNoGap([k(1, 5, 1, 4), k(4, 9, 4, 8), k(8, 10, 5, 9)], 1).ticks, 0);
    eq(P.whyNoGap([k(100, 101, 99, 100), k(100, 104, 96, 100), k(100, 102, 99, 100)], 1), { reason: 'doji' });
    eq(P.whyNoGap(GAP, 0), { reason: 'edge' });
    eq(P.whyNoGap(GAP, 5), { reason: 'edge' });
    eq(P.whyNoGap(GAP, 1), null, 'a real gap needs no excuse');
  });

  // ---------------------------------------------------------------- equilibrium handles

  test('confluences.eqFromHandles: uptrend 0 on the low, 1 on the high; the discount is the lower half', () => {
    var r = P.eqFromHandles(7612.5, 7650, 'up');
    eq(r, { dir: 'up', low: 7612.5, high: 7650, zero: 7612.5, one: 7650, eq: 7631.25, favour: 'discount',
            premium: { from: 7631.25, to: 7650 }, discount: { from: 7612.5, to: 7631.25 } });
  });

  test('confluences.eqFromHandles: downtrend 0 on the high, 1 on the low; the premium is the upper half; order of the handles is free', () => {
    var r = P.eqFromHandles(7600, 7650, 'down');
    eq(r.zero, 7650); eq(r.one, 7600); eq(r.eq, 7625); eq(r.favour, 'premium');
    eq(P.eqFromHandles(7650, 7600, 'down'), r, 'swapped handles');
    eq(P.eqFromHandles(7650, 7600, 'up').zero, 7600);
  });

  test('confluences.eqFromHandles: eq snaps to the 0.25 tick; no range when the handles meet', () => {
    eq(P.eqFromHandles(100, 101.25, 'up').eq, 100.75);                // 100.625 sits half way: rounds up to the tick
    eq(P.eqFromHandles(10, 10.75, 'up').eq, 10.5);                    // 10.375 -> 10.5
    near(P.eqFromHandles(7612.5, 7640.25, 'up').eq % 0.25, 0, 1e-9);
    eq(P.eqFromHandles(100, 100, 'up'), null);
    eq(P.eqFromHandles(NaN, 100, 'up'), null);
  });

  test('confluences.zoneOf: premium above 0.5, discount below, eq on the line', () => {
    var r = P.eqFromHandles(100, 110, 'up');
    eq(P.zoneOf(r, 107), 'premium'); eq(P.zoneOf(r, 103), 'discount'); eq(P.zoneOf(r, 105), 'eq');
  });

  // ---------------------------------------------------------------- swing snapping and judging the range

  test('confluences.snapSwing: the nearest swing known at the bar, never one that is still unconfirmed', () => {
    // high 12 at bar 1 (up, down pair 1-2), low 8 at bar 3 (down, up pair 3-4), later high 14 at bar 5 (pair 5-6)
    var cs = [k(10, 11, 9, 10.5), k(10.5, 12, 10, 11), k(11, 11.5, 9, 9.5), k(9.5, 9.8, 8, 8.5), k(8.5, 10, 8.5, 9.8),
              k(9.8, 14, 9.8, 13), k(13, 13.5, 10, 11), k(11, 12, 10.5, 11.5)];
    var a = P.snapSwing(cs, 12.3, 4);
    ok(a && a.kind === 'high' && a.i === 1 && a.price === 12, 'the high at bar 1');
    var b = P.snapSwing(cs, 7, 4);
    ok(b && b.kind === 'low' && b.i === 3 && b.price === 8, 'the low at bar 3');
    var c = P.snapSwing(cs, 14, 4);
    eq(c.price, 12, 'the high of 14 is not known at bar 4');
    var d = P.snapSwing(cs, 14, 6);
    ok(d.price === 14 && d.i === 5, 'known at bar 6');
    eq(P.snapSwing([k(1, 2, 1, 1.5)], 5, 0), null, 'no swing yet');
  });

  test('confluences.judgeRange on S17: the most recent high to the most recent low is right, an older swing is not', () => {
    for (var seed = 1; seed <= 30; seed++) {
      var b = build('S17', seed), cs = b.candles, K = b.truth.confluence;
      var t = P.eqTarget(cs, K, 'down');
      ok(t && t.range && t.at >= K.confirm.at && t.at <= K.entry.at, 'S17 seed ' + seed + ': the range is placeable before the entry');
      eq(t.range.from, K.cont.from); eq(t.range.to, K.cont.to);
      var sw = TJR.swings.find(cs.slice(0, t.at + 1));
      var hi = sw.highs.filter(function (s) { return s.i === t.range.from; })[0];
      var lo = sw.lows.filter(function (s) { return s.i === t.range.to; })[0];
      ok(hi && lo, 'the range ends are swings known at ' + t.at);
      var good = P.judgeRange(cs, t.at, 'down', P.snapSwing(cs, hi.price, t.at), P.snapSwing(cs, lo.price, t.at));
      ok(good.ok, 'S17 seed ' + seed + ' right range: ' + good.why);
      eq(P.judgeRange(cs, t.at, 'down', P.snapSwing(cs, lo.price, t.at), P.snapSwing(cs, hi.price, t.at)).ok, true, 'handle order is free');
      // an older high (higher than the range's high, earlier) as the start
      var older = sw.highs.filter(function (s) { return s.i < hi.i; }).sort(function (x, y) { return y.price - x.price; })[0];
      if (older) {
        var bad = P.judgeRange(cs, t.at, 'down', { i: older.i, price: older.price, kind: 'high' }, { i: lo.i, price: lo.price, kind: 'low' });
        eq(bad.ok, false); eq(bad.why, 'old-start');
      }
      eq(P.judgeRange(cs, t.at, 'down', { i: hi.i, price: hi.price, kind: 'high' }, { i: hi.i, price: hi.price, kind: 'high' }).why, 'kinds');
      eq(P.judgeRange(cs, t.at, 'down', null, { i: lo.i, price: lo.price, kind: 'low' }).why, 'incomplete');
    }
  });

  // ---------------------------------------------------------------- break candidates ("Break or not?")

  // an uptrend with a confirmed swing low 8 (bar 3, pair 3-4); then: wick under it, close exactly on it, close under it
  var BR = [k(10, 11, 9, 10.5), k(10.5, 12, 10, 11), k(11, 11.5, 9, 9.5), k(9.5, 9.8, 8, 8.5), k(8.5, 10, 8.5, 9.8),
            k(9.8, 11, 9.5, 10.5), k(10.5, 10.8, 7.5, 9), k(9, 9.5, 8.25, 8), k(8, 8.2, 6, 7), k(7, 9, 6.5, 8.5)];

  test('confluences.breakCandidates: wick-only, close exactly on the level and a real close, up to the first close', () => {
    var c = P.breakCandidates(BR, {});
    eq(c.map(function (x) { return [x.bar, x.kind]; }), [[6, 'wick'], [7, 'on'], [8, 'close']]);
    eq(c[0].level, { i: 3, price: 8 });
    eq(c.length, 3, 'stops at the first close');
  });

  test('confluences.breakCandidates: upTo cuts the list, a wick is never a close, a swing unknown yet is not watched', () => {
    eq(P.breakCandidates(BR, { upTo: 7 }).map(function (x) { return x.kind; }), ['wick', 'on']);
    eq(P.breakCandidates(BR, { upTo: 4 }), [], 'the low at bar 3 is only known from bar 4');
  });

  test('confluences.breakCandidates: the downtrend mirror watches the most recent high', () => {
    // swing high 20 at bar 3 (up candle then down candle), then a wick over it, a close on it, a close over it
    var cs = [k(15, 16, 14, 15.5), k(15.5, 17, 15, 16), k(16, 19, 15.5, 18), k(18, 20, 17, 17.5), k(17.5, 18, 15, 16),
              k(16, 17, 15, 16.5), k(16.5, 21, 16, 19), k(19, 20.5, 18, 20), k(20, 23, 19, 22)];
    var c = P.breakCandidates(cs, { trend: 'down' });
    eq(c.map(function (x) { return [x.bar, x.kind]; }), [[6, 'wick'], [7, 'on'], [8, 'close']]);
  });

  test('confluences.breakCandidates: the first close is the first event TJR.confluence.bos finds (up trend)', () => {
    for (var seed = 1; seed <= 40; seed++) {
      var cs = build('S20', seed).candles, c = P.breakCandidates(cs, { trend: 'up' }), ev = C.bos(cs, { trend: 'up' })[0];
      var close = c.filter(function (x) { return x.kind === 'close'; })[0];
      eq(close ? close.bar : null, ev ? ev.at : null, 'S20 seed ' + seed);
      if (close) eq(close.level, { i: ev.level.i, price: ev.level.price });
    }
  });

  test('confluences.breakSteps on S20: the scripted deep wick is a wick candidate, the list ends in the real break', () => {
    for (var seed = 1; seed <= 60; seed++) {
      var b = build('S20', seed), K = b.truth.confluence, c = P.breakSteps(b);
      var hit = c.filter(function (x) { return x.bar === K.noTrade.at; })[0];
      ok(hit, 'S20 seed ' + seed + ': candidate at the wick bar');
      eq(hit.kind, 'wick');
      eq(hit.level, K.noTrade.level, 'S20 seed ' + seed + ': the watched low is the one the scenario scripts');
      ok(c.length >= 2 && c.length <= 8, 'S20 seed ' + seed + ' has a short list: ' + c.length);
      eq(c[c.length - 1].kind, 'close', 'ends in a break');
      eq(c[c.length - 1].bar, K.confirm.at, 'at the confirmation bar of the scenario');
      c.slice(0, -1).forEach(function (x) { ok(x.kind !== 'close', 'no earlier close'); });
    }
  });

  test('confluences.breakFacts: the numbers of a candidate, in ticks', () => {
    var c = P.breakCandidates(BR, {});
    eq(P.breakFacts(BR, c[0]), { kind: 'wick', ticks: 2, closeTicks: 4 });        // wick 7.5 under 8: 2 ticks; close 9 is 4 over
    eq(P.breakFacts(BR, c[1]), { kind: 'on', ticks: 0, closeTicks: 0 });
    eq(P.breakFacts(BR, c[2]), { kind: 'close', ticks: 4, closeTicks: -4 });       // close 7 is 4 ticks under
  });

  // ---------------------------------------------------------------- BOS vs IFVG race

  test('confluences.race on S16: the IFVG entry is the confirm bar close; the BOS entry the first break after the sweep', () => {
    var ticks = [];
    for (var seed = 1; seed <= 60; seed++) {
      var b = build('S16', seed), r = P.race(b), K = b.truth.confluence, cs = b.candles;
      eq(r.side, 'short');
      eq(r.ifvg.at, K.confirm.at); eq(r.ifvg.price, cs[K.confirm.at].c);
      ok(r.bos, 'S16 seed ' + seed + ' has a break of structure after the IFVG');
      ok(r.bos.at >= r.ifvg.at, 'S16 seed ' + seed + ': the break is not before the IFVG');
      eq(r.bos.price, cs[r.bos.at].c);
      eq(r.bars, r.bos.at - r.ifvg.at);
      eq(r.ticks, (r.ifvg.price - r.bos.price) / 0.25, 'short: a higher entry is better');
      ticks.push(r.ticks);
    }
    ok(ticks.some(function (t) { return t > 0; }), 'the IFVG entry is better in some charts: ' + ticks.slice(0, 12));
  });

  test('confluences.race: no break of structure in the series is reported as null, not guessed', () => {
    var b = build('S16', 1), cs = b.candles.slice(0, b.truth.confluence.confirm.at + 1);
    var r = P.race({ candles: cs, truth: b.truth, meta: b.meta });
    eq(r.bos, null); eq(r.ticks, null); eq(r.bars, null);
    ok(r.ifvg && r.ifvg.at === b.truth.confluence.confirm.at);
  });

  // ---------------------------------------------------------------- stacked gaps on S19

  test('confluences.stackSteps on S19: formed, top gap closed under, bottom gap respected, then the deletion', () => {
    var seen = {};
    for (var seed = 1; seed <= 60; seed++) {
      var b = build('S19', seed), st = P.stackSteps(b.candles, b.truth.confluence);
      ok(st.steps.length >= 3, 'S19 seed ' + seed + ' steps: ' + st.steps.length);
      eq(st.steps[0].key, 'formed'); eq(st.steps[1].key, 'near-closed'); eq(st.steps[2].key, 'far-respected');
      st.steps.forEach(function (x, i) { if (i) ok(x.bar > st.steps[i - 1].bar, 'S19 seed ' + seed + ' increasing bars'); seen[x.key] = true; });
      ok(st.gaps.length >= 2 && st.gaps.indexOf(b.truth.confluence.cont.i) >= 0, 'the cont gap is in the stack');
      eq(st.dir, 'bull');
    }
    ok(seen.deleted, 'the deletion step exists in some charts');
  });

  // ---------------------------------------------------------------- SMT read on S21

  test('confluences.smtRead on S21 (kind high, the lesson): bearish, the leader (ES or NQ, either can lead) has the lower high, the other the higher high', () => {
    var leaders = {};
    for (var seed = 1; seed <= 24; seed++) {
      var b = build('S21', seed, { kind: 'high' }), r = P.smtRead(b);
      eq(r.type, 'bearish'); eq(r.kind, 'high');
      leaders[r.leader] = (leaders[r.leader] || 0) + 1;
      eq([r.leader, r.lagger].sort(), ['ES', 'NQ']);
      ok(r.nums[r.leader].p2 < r.nums[r.leader].p1, r.leader + ' lower high');
      ok(r.nums[r.lagger].p2 > r.nums[r.lagger].p1, r.lagger + ' higher high');
      ok(r.at > r.nums.ES.bar2 || r.at > r.nums.NQ.bar2, 'known after the second highs');
      eq(b.truth.twin.candles.length, b.candles.length, 'the twin has the same bars');
    }
    ok(leaders.ES > 3 && leaders.NQ > 3, 'both indexes lead across seeds: ' + JSON.stringify(leaders));
  });
  test('confluences.smtRead on S21 (kind low): bullish, the leader has the higher low', () => {
    for (var seed = 1; seed <= 12; seed++) {
      var b = build('S21', seed, { kind: 'low' }), r = P.smtRead(b);
      eq([r.type, r.kind], ['bullish', 'low']);
      ok(r.nums[r.leader].p2 > r.nums[r.leader].p1 && r.nums[r.lagger].p2 < r.nums[r.lagger].p1, 'higher low leads, lower low lags');
    }
  });

  // ---------------------------------------------------------------- the self-checks

  test('confluences.quizState / countDone: a lesson is done when both answers are right', () => {
    eq(P.quizState([1, 0], [1, 0]).done, true);
    eq(P.quizState([1, 2], [1, 0]).right, [true, false]);
    eq(P.quizState([null, null], [0, 0]).done, false);
    eq(P.quizState(undefined, [0, 0]).done, false);
    eq(P.countDone({ m1: [0, 1], m2: [0, 0] }, { m1: [0, 1], m2: [0, 1], m3: [2, 2] }), 1);
  });

  // ---------------------------------------------------------------- confluences.html

  var html = readText('confluences.html');
  var MODS = { 1: 'Zzk864cVJek', 2: 'xX5LTSJ5wwM', 3: '4sRDnVmLcMk', 4: 'joe_XTCn5Bs', 5: '7dTQA0t8SH0' };
  function sec(n) {
    var a = html.indexOf('<section class="module" id="m' + n + '"');
    var b = n < 5 ? html.indexOf('<section class="module" id="m' + (n + 1) + '"') : html.indexOf('id="next"');
    return html.slice(a, b);
  }
  function anchors(s) { return s.match(/<a\b[^>]*\bclass="ts-chip[^"]*"[^>]*>[^<]*<\/a>/g) || []; }

  test('confluences.html: the step marker, five lessons with rail links, and the script order of the plan', () => {
    ok(html.indexOf(TJR.layout.stepMarkerHTML('confluences')) > 0, 'step marker');
    for (var i = 1; i <= 5; i++) {
      ok(html.indexOf('<section class="module" id="m' + i + '"') > 0, 'section m' + i);
      ok(html.indexOf('href="#m' + i + '" data-m="' + i + '"') > 0, 'rail link m' + i);
    }
    eq((html.match(/<section class="module"/g) || []).length, 5, 'five lessons (opening gaps / BPR has no lesson)');
    var order = ['core/ns', 'core/sources', 'core/store', 'scenario/rng', 'scenario/swings', 'scenario/gen', 'scenario/sessions',
      'scenario/confluence', 'scenario/library', 'scenario/system', 'scenario/annotate', 'scenario/grade', 'chart/scale',
      'chart/render', 'chart/overlays', 'chart/chart', 'core/layout', 'core/motion', 'pages/confluences'];
    var at = -1;
    order.forEach(function (s) {
      var p = html.indexOf('src="assets/js/' + s + '.js"');
      ok(p > at, 'script ' + s + ' in order');
      at = p;
    });
    ok(html.indexOf('assets/css/pages/confluences.css') > 0, 'page css');
    ok(/<a class="nav__link" href="confluences\.html" aria-current="page">/.test(html), 'noscript nav marks this page');
  });

  test('confluences.html: every lesson has 5 or more chips to ITS OWN playlist clip; facts cite ids of that clip; never clip #4', () => {
    for (var n = 1; n <= 5; n++) {
      var s = sec(n), pl = anchors(s).filter(function (a) { return a.indexOf('ts-chip--pl') > 0; });
      ok(pl.length >= 5, 'lesson ' + n + ' playlist chips: ' + pl.length);
      var own = pl.filter(function (a) { return a.indexOf('youtu.be/' + MODS[n] + '?t=') > 0; });
      ok(own.length >= 3, 'lesson ' + n + ' has at least 3 chips to its clip ' + MODS[n]);
      ok(s.indexOf('52nxvJKM57U') < 0, 'no clip #4');
      pl.forEach(function (a) {
        var href = /href="https:\/\/youtu\.be\/([\w-]+)\?t=(\d+)"/.exec(a), src = TJR.sources.list.filter(function (x) { return x.id === href[1]; })[0];
        ok(src && !src.main, 'a playlist chip: ' + a);
        eq(a, TJR.layout.chip(Number(href[2]), src.clip), 'chip markup');
      });
      var facts = s.match(/data-fact="[^"]*"/g) || [];
      ok(facts.length >= 6, 'lesson ' + n + ' facts carry their ids: ' + facts.length);
      facts.forEach(function (f) {
        (f.match(/P(\d+)\.\d+/g) || []).forEach(function (id) {
          var clip = Number(/^P(\d+)\./.exec(id)[1]);
          ok(clip === { 1: 11, 2: 10, 3: 8, 4: 7, 5: 6 }[n] || clip === 1, 'lesson ' + n + ' fact ' + id + ' is from its own clip (or the strategy clip #1)');
        });
      });
    }
  });

  test('confluences.html: FVG lesson is all playlist (the main clip only names fair value gaps, F9.1, and gives no definition)', () => {
    var s = sec(2);
    ok(s.indexOf('Vulini8xbB0') < 0, 'no main-clip chip in the FVG lesson');
    ok(/ไส้/.test(s) && s.indexOf('ซ้อนกัน') > 0, 'the overlapping-wicks rule');
    ok(s.indexOf('คลิปไม่ได้ระบุ') > 0, 'the size / entry gap badges');
  });

  test('confluences.html: C8 box labelled นิยามทั่วไป ไม่ใช่จากคลิป with the luxalgo URL; his meaning is the trend change', () => {
    var s = sec(1), m = /<aside class="web-def">[\s\S]*?<\/aside>/.exec(s);
    ok(m, 'a .web-def box in lesson 1');
    ok(m[0].indexOf('นิยามทั่วไป ไม่ใช่จากคลิป') > 0, 'label');
    ok(m[0].indexOf('href="https://www.luxalgo.com/library/concept/break-of-structure/"') > 0, 'the source URL');
    ok(m[0].indexOf('ต่อเนื่อง') > 0, 'the web meaning (continuation)');
    eq(html.split('class="web-def"').length - 1, 1, 'the only web definition on the page');
    ok(m[0].indexOf('ts-chip') < 0, 'a web definition carries no clip chip');
    ok(s.indexOf('เปลี่ยน') > 0 && s.indexOf('ปิด') > 0, 'his meaning: a CLOSE, a trend change');
  });

  test('confluences.html: Gann box settings are a gap (P7.2); equilibrium rules cite #7', () => {
    var s = sec(4), i = s.indexOf('Gann');
    ok(i > 0, 'Gann box named');
    ok(s.slice(i - 400, i + 400).indexOf('คลิปไม่ได้ระบุ') > 0, 'with the gap badge next to it');
    ok(s.indexOf('data-fact="P7.2"') > 0, 'P7.2 cited');
    ok(s.indexOf('ล่าสุด') > 0, 'most recent low / high rule');
  });

  test('confluences.html: the chain table cites P1.19, P11.26 and P8.39; the next strip points at clip #9 (opening gaps / BPR) with a chip', () => {
    var chain = html.slice(html.indexOf('id="chain"'), html.indexOf('class="conf-shell"'));
    ok(chain.length > 200, 'a chain block before the lessons');
    ok(chain.indexOf('data-fact="P1.19"') > 0 || chain.indexOf('P1.19') > 0, 'P1.19');
    ok(chain.indexOf('youtu.be/TEp3a-7GUds?t=2144') > 0, 'chip #1 35:44');
    ok(chain.indexOf('youtu.be/Zzk864cVJek?t=706') > 0, 'chip #11 11:46 (P11.26)');
    ok(chain.indexOf('youtu.be/4sRDnVmLcMk?t=1321') > 0, 'chip #8 22:01 (P8.39)');
    var next = html.slice(html.indexOf('id="next"'));
    ok(next.indexOf('youtu.be/PlsHO33j6B8?t=') > 0 && /#9 \d\d:\d\d/.test(next), '▶ #9 chip');
    ok(next.indexOf('opening gaps') > 0 && next.indexOf('BPR') > 0, 'the sentence names them');
    ok(html.indexOf('บทที่ 6') < 0, 'no lesson 6');
    ok(next.indexOf('strategy.html') > 0, 'on to the strategy page');
  });

  test('confluences.html: five self-checks with two questions each, the right answer inside the options, chips per question', () => {
    var boxes = html.split('class="check"').slice(1);
    eq(boxes.length, 5);
    boxes.forEach(function (b, i) {
      ok(b.indexOf('data-m="' + (i + 1) + '"') >= 0 || html.indexOf('class="check" data-m="' + (i + 1) + '"') > 0, 'check ' + (i + 1));
      var qs = b.split('class="q"').slice(1, 3);
      eq(qs.length, 2);
      qs.forEach(function (q) {
        var r = /data-right="(\d+)"/.exec(q), opts = q.split('class="opt"').length - 1;
        ok(r && Number(r[1]) < opts && opts === 3, 'right answer is one of three options');
        var clip = /data-clip="(\d+)"/.exec(q), s = /data-sec="(\d+)"/.exec(q);
        ok(clip && s, 'the question names its clip and second');
        var src = TJR.sources.byClip(Number(clip[1]));
        ok(src && src.clip !== 4 && Number(s[1]) <= src.dur, 'inside the video');
      });
    });
    eq((html.match(/class="q" data-right/g) || []).length, 10);
    ok(readText('assets/js/pages/confluences.js').indexOf("'conf.m'") > 0, 'self-check keys tjr.conf.m1..m5');
  });

  test('confluences.html: each interactive slot has a figure or wrapper the page script can find, at most 4 live at once', () => {
    ['m1a', 'm2a', 'm2b', 'm3a', 'm4a', 'm5a'].forEach(function (id) { ok(html.indexOf('data-slot="' + id + '"') > 0, 'slot ' + id); });
    ok(readText('assets/js/pages/confluences.js').indexOf('MAX_LIVE = 4') > 0, 'MAX_LIVE = 4');
    ok(html.indexOf('class="twin"') > 0, 'the SMT twin sits in a .twin container (stacks on a phone)');
  });

  test('confluences.html: nothing excluded - no prices, money amounts, promo codes or prop-firm names; chart numbers are labelled as simulated', () => {
    ok(!/\$\s?\d/.test(html), 'no dollar amounts');
    ok(!/promo|apex|topstep|funded/i.test(html), 'no prop-firm talk');
    ok(html.indexOf('ตัวเลขจากกราฟจำลอง') > 0, 'the simulated-numbers label is on the page');
    ok(html.indexOf('ตัวเลขจากเครื่องมือบนจอ ไม่ใช่ที่เขาพูด') > 0, 'on-screen readouts are labelled');
  });
})();
