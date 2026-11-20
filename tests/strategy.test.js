/* Strategy page (Task 8): the pure helpers of assets/js/pages/strategy.js (TJR.strategyPage: the nine steps of the
   worked trade of playlist clip #1, the bar each step reveals, the chart overlays read from the S21 candles) and the
   content rules of strategy.html. strategy.js is evaluated into this context (no DOM here, so it only attaches the
   helpers). Wrapped in an IIFE (one shared vm scope). */
(function () {
  'use strict';
  (0, eval)(readText('assets/js/pages/strategy.js'));
  var P = TJR.strategyPage, S = TJR.scenarios, C = TJR.confluence;

  function build(seed) { return S.safeBuild(S.get('S21'), seed, {}); }
  var SEEDS = [];
  for (var s = 1; s <= 30; s++) SEEDS.push(s);

  // ---------------------------------------------------------------- the steps

  test('strategy.META: nine steps, every one with at least one chip to the strategy clip (TEp3a-7GUds) and fact ids', () => {
    eq(P.META.length, 9);
    eq(P.META.map(function (m) { return m.n; }), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    eq(P.META.map(function (m) { return m.key; }), ['bias', 'smt', 'patience', 'bos', 'leader', 'eq', 'entry', 'exit', 'wrong']);
    P.META.forEach(function (m) {
      var own = m.chips.filter(function (c) { return c[1] === 1; });
      ok(own.length >= 1, 'step ' + m.n + ' has a chip to clip #1');
      ok(m.facts.length >= 1 && m.facts.every(function (f) { return /^P\d+\.\d+$/.test(f); }), 'step ' + m.n + ' fact ids');
      m.chips.forEach(function (c) {
        var src = TJR.sources.byClip(c[1]);
        ok(src && src.clip !== 4, 'a known clip, never #4');
        ok(c[0] >= 0 && c[0] <= src.dur, 'inside the video: ' + c);
      });
    });
  });

  test('strategy.META: the brief\'s fact ranges are the ones each step cites', () => {
    var want = { bias: ['P1.24', 'P1.30'], smt: ['P1.31', 'P1.32'], patience: ['P1.33', 'P1.36'], bos: ['P1.37', 'P1.37'],
                 leader: ['P1.40', 'P1.40'], eq: ['P1.41', 'P1.43'], entry: ['P1.44', 'P1.49'], exit: ['P1.50', 'P1.51'], wrong: ['P1.52', 'P1.52'] };
    P.META.forEach(function (m) {
      var w = want[m.key], num = function (f) { return Number(f.split('.')[1]); };
      var own = m.facts.filter(function (f) { return /^P1\./.test(f); }).map(num);
      ok(own.indexOf(num(w[0])) >= 0 && own.indexOf(num(w[1])) >= 0, m.key + ' cites ' + w);
    });
  });

  test('strategy.steps: nine steps whose reveal bars never go backwards, in every seed', () => {
    SEEDS.forEach(function (seed) {
      var b = build(seed), st = P.steps(b), n = b.candles.length;
      eq(st.length, 9, 'seed ' + seed);
      st.forEach(function (x, i) {
        ok(x.bar >= 0 && x.bar <= n - 1, 'seed ' + seed + ' step ' + (i + 1) + ' bar inside the chart');
        if (i) ok(x.bar >= st[i - 1].bar, 'seed ' + seed + ': step ' + (i + 1) + ' reveals ' + x.bar + ' < previous ' + st[i - 1].bar);
      });
      eq(st[8].bar, n - 1, 'the last step shows the whole move');
    });
  });

  test('strategy.stepState: revealed bar count never shrinks from one step to the next; clamps the index', () => {
    var b = build(1), prev = -1;
    for (var i = 0; i < 9; i++) {
      var s = P.stepState(i, b);
      eq(s.i, i);
      eq(s.n, i + 1);
      eq(s.bars, s.bar + 1);
      ok(s.bars >= prev, 'step ' + (i + 1) + ' reveals ' + s.bars + ' >= ' + prev);
      prev = s.bars;
    }
    eq(P.stepState(-3, b).i, 0);
    eq(P.stepState(99, b).i, 8);
    eq(P.stepState(8, b).last, true);
    eq(P.stepState(0, b).last, false);
    ok(P.stepState(3).bars > 0, 'default build of the fixed seed when no chart is passed');
  });

  test('strategy.steps: each step\'s bar is the bar the detectors say it became true (no look-ahead, no planned bars)', () => {
    SEEDS.forEach(function (seed) {
      var b = build(seed), K = b.truth.confluence, T = b.truth, st = P.steps(b), cs = b.candles;
      var who = 'seed ' + seed;
      ok(st[0].bar < T.smt.at, who + ': the map is set before the SMT is known');
      eq(st[1].bar, T.smt.at, who + ': SMT step');
      ok(st[2].bar < K.confirm.at || st[2].bar === T.smt.at, who + ': patience is before the break');
      ok(st[2].bar >= T.smt.at, who + ': after the SMT');
      eq(st[3].bar, K.confirm.at, who + ': the BOS step');
      eq(st[4].bar, K.confirm.at, who + ': the leader step');
      ok(st[5].bar >= K.cont.at && st[5].bar < K.entry.at, who + ': equilibrium filled, entry not yet');
      eq(st[6].bar, K.entry.at, who + ': entry step');
      ok(st[7].bar > K.entry.at, who + ': the target is reached after the entry');
      ok(cs[st[7].bar].l <= K.targets[0].price, who + ': a candle reaches the target on that bar');
      for (var j = K.entry.at + 1; j < st[7].bar; j++) ok(cs[j].l > K.targets[0].price, who + ': the first bar to reach it');
    });
  });

  test('strategy.stopLevel: above the highs of the setup, over the entry; the target is below it', () => {
    SEEDS.forEach(function (seed) {
      var b = build(seed), K = b.truth.confluence, cs = b.candles, sl = P.stopLevel(b);
      ok(sl.price > K.entry.price, 'seed ' + seed + ': the stop is above a short entry');
      ok(K.targets[0].price < K.entry.price, 'seed ' + seed + ': the target is below it');
      var m = -Infinity;
      for (var j = b.truth.smt.main.p1.bar; j <= K.entry.at; j++) m = Math.max(m, cs[j].h);
      eq(sl.price, m, 'seed ' + seed + ': the highest high from the first high to the entry');
      for (var k = K.entry.at + 1; k <= P.reachBar(b); k++) ok(cs[k].h < sl.price, 'seed ' + seed + ': the stop is not hit before the target');
    });
  });

  // ---------------------------------------------------------------- overlays

  test('strategy.overlays: nothing is anchored after the bar it appears at; ids are unique', () => {
    SEEDS.forEach(function (seed) {
      var b = build(seed), ov = P.overlays(b);
      ['main', 'twin'].forEach(function (side) {
        var seen = {};
        ov[side].forEach(function (o) {
          ok(o.appearAt != null, 'seed ' + seed + ' ' + o.id + ' has appearAt');
          ok(!seen[o.id], 'unique id ' + o.id); seen[o.id] = true;
          [o.bar, o.from, o.to, o.at, o.a && o.a.bar, o.b && o.b.bar].forEach(function (v) {
            if (v != null) ok(v <= o.appearAt, 'seed ' + seed + ' ' + side + ' ' + o.id + ' anchors ' + v + ' <= appears at ' + o.appearAt);
          });
          if (o.type === 'level' && /^(stop|tp)/.test(o.id)) ok(o.from <= o.appearAt, 'a level starts before it shows');
        });
      });
    });
  });

  test('strategy.overlays: the SMT lines are on both charts, the break and the range only on the traded chart', () => {
    var b = build(1), K = b.truth.confluence, T = b.truth, ov = P.overlays(b);
    var smtM = ov.main.filter(function (o) { return o.type === 'trend'; }), smtT = ov.twin.filter(function (o) { return o.type === 'trend'; });
    eq(smtM.length, 1); eq(smtT.length, 1);
    eq(smtM[0].a.price, T.smt.main.p1.price); eq(smtM[0].b.price, T.smt.main.p2.price);
    eq(smtT[0].a.price, T.smt.twin.p1.price); eq(smtT[0].b.price, T.smt.twin.p2.price);
    eq(smtM[0].appearAt, T.smt.at); eq(smtT[0].appearAt, T.smt.at);
    var bos = ov.main.filter(function (o) { return o.type === 'bos'; });
    eq(bos.length, 1); eq(bos[0].appearAt, K.confirm.at); eq(bos[0].at, K.confirm.at);
    eq(ov.twin.filter(function (o) { return o.type === 'bos' || o.type === 'eq'; }).length, 0);
    var eqs = ov.main.filter(function (o) { return o.type === 'eq'; });
    eq(eqs.length, 1); eq(eqs[0].from, K.cont.from); eq(eqs[0].to, K.cont.to); eq(eqs[0].dir, 'down');
    ok(eqs[0].appearAt >= K.cont.at, 'the range is placeable only once its end swing is confirmed');
    var mk = ov.main.filter(function (o) { return o.type === 'marker'; });
    eq(mk.length, 1); eq(mk[0].bar, K.entry.at); eq(mk[0].price, K.entry.price);
    var stop = ov.main.filter(function (o) { return o.id === 'stop'; })[0], tp = ov.main.filter(function (o) { return o.id === 'tp'; })[0];
    eq(stop.price, P.stopLevel(b).price); eq(tp.price, K.targets[0].price);
    eq(stop.appearAt, P.reachBar(b)); eq(tp.appearAt, P.reachBar(b));
  });

  test('strategy.overlays: the higher high is drawn on the chart that made it, the lower high on the leader', () => {
    SEEDS.forEach(function (seed) {
      var b = build(seed), T = b.truth, ov = P.overlays(b);
      ok(T.smt.leader === 'main' && T.smt.type === 'bearish', 'S21 is a bearish SMT led by the traded chart');
      var lblM = ov.main.filter(function (o) { return o.type === 'label' && /lower high/.test(o.text); });
      var lblT = ov.twin.filter(function (o) { return o.type === 'label' && /higher high/.test(o.text); });
      eq(lblM.length, 1, 'seed ' + seed); eq(lblT.length, 1, 'seed ' + seed);
      eq(lblM[0].bar, T.smt.main.p2.bar); eq(lblT[0].bar, T.smt.twin.p2.bar);
    });
  });

  // ---------------------------------------------------------------- the on-screen readout (P1.59)

  test('strategy.READOUT: the numbers of the position drawing are consistent with each other, and labelled as readouts', () => {
    var R = P.READOUT;
    eq(R.entry, 6993.5); eq(R.stop.price, 6998); eq(R.stop.points, 4.5); eq(R.stop.ticks, 18); eq(R.stop.pct, 0.064);
    eq(R.tp1.price, 6982.5); eq(R.tp1.points, 11); eq(R.tp1.ticks, 44); eq(R.tp1.rr, 2.44);
    eq(R.tp2.price, 6974.75); eq(R.tp2.points, 18.75); eq(R.tp2.ticks, 75); eq(R.tp2.rr, 4.17);
    eq(R.entry + R.stop.points, R.stop.price);
    eq(R.entry - R.tp1.points, R.tp1.price);
    eq(R.entry - R.tp2.points, R.tp2.price);
    eq(R.stop.points / 0.25, R.stop.ticks); eq(R.tp1.points / 0.25, R.tp1.ticks); eq(R.tp2.points / 0.25, R.tp2.ticks);
    eq(Math.round(R.tp1.points / R.stop.points * 100) / 100, R.tp1.rr);
    eq(Math.round(R.tp2.points / R.stop.points * 100) / 100, R.tp2.rr);
    eq(R.label, 'ตัวเลขจากเครื่องมือบนจอ ไม่ใช่ที่เขาพูด');
  });

  // ---------------------------------------------------------------- strategy.html

  var html = readText('strategy.html');
  function stepBlock(n) {
    var a = html.indexOf('<li class="step" data-step="' + n + '"'), z = n < 9 ? html.indexOf('<li class="step" data-step="' + (n + 1) + '"') : html.indexOf('</ol>', a);
    return html.slice(a, z);
  }
  function anchors(s) { return s.match(/<a\b[^>]*\bclass="ts-chip[^"]*"[^>]*>[^<]*<\/a>/g) || []; }
  function between(a, b) { var i = html.indexOf(a), j = html.indexOf(b, i + 1); return html.slice(i, j < 0 ? html.length : j); }

  test('strategy.html: the simulation banner, the Level tag, the nine steps and the script order of the plan', () => {
    ok(html.indexOf('กราฟจำลองตามที่เขาเล่า ไม่ใช่ข้อมูลจริงของวันนั้น') > 0, 'the banner says the chart is a simulation');
    ok(/<p class="level-tag" data-level="2">Level 2 · กลยุทธ์<\/p>/.test(html), 'level tag');
    eq((html.match(/<li class="step" data-step="/g) || []).length, 9);
    var order = ['core/ns', 'core/sources', 'core/store', 'scenario/rng', 'scenario/swings', 'scenario/gen', 'scenario/sessions',
      'scenario/confluence', 'scenario/library', 'scenario/system', 'scenario/annotate', 'scenario/grade', 'chart/scale',
      'chart/render', 'chart/overlays', 'chart/chart', 'core/layout', 'core/motion', 'pages/strategy'];
    var at = -1;
    order.forEach(function (x) { var p = html.indexOf('src="assets/js/' + x + '.js"'); ok(p > at, 'script ' + x + ' in order'); at = p; });
    ok(html.indexOf('assets/css/pages/strategy.css') > 0, 'page css');
    ok(/<a class="nav__link" href="strategy\.html" aria-current="page">/.test(html), 'noscript nav marks this page');
    ok(html.indexOf('class="twin"') > 0, 'the twin chart sits in a .twin container');
    ok(html.indexOf('data-slot="strat"') > 0, 'a slot for the chart');
  });

  test('strategy.html: each step has a chip to the strategy clip, generated by TJR.layout.chip; ids and times come from META', () => {
    for (var n = 1; n <= 9; n++) {
      var b = stepBlock(n), meta = P.META[n - 1], as = anchors(b);
      ok(b.indexOf('data-key="' + meta.key + '"') > 0, 'step ' + n + ' key');
      var own = as.filter(function (a) { return a.indexOf('youtu.be/TEp3a-7GUds?t=') > 0; });
      ok(own.length >= 1, 'step ' + n + ' links the strategy clip');
      meta.chips.forEach(function (c) { ok(b.indexOf(TJR.layout.chip(c[0], c[1])) > 0, 'step ' + n + ' shows chip ' + c); });
      as.forEach(function (a) {
        var href = /href="https:\/\/youtu\.be\/([\w-]+)\?t=(\d+)"/.exec(a), src = TJR.sources.list.filter(function (x) { return x.id === href[1]; })[0];
        ok(src && src.clip !== 4, 'a known clip that is not #4');
        eq(a, TJR.layout.chip(Number(href[2]), src.main ? 0 : src.clip), 'chip markup');
        ok(Number(href[2]) <= src.dur, 'inside the video');
      });
      var f = /data-fact="([^"]*)"/.exec(b);
      ok(f, 'step ' + n + ' carries data-fact');
      meta.facts.forEach(function (id) { ok(b.indexOf(id) > 0, 'step ' + n + ' names ' + id); });
    }
  });

  test('strategy.html: the readout card shows the P1.59 numbers under the on-screen label, never as his rules', () => {
    var card = between('id="readout"', '</section>');
    ok(card.length > 100, 'a readout card');
    ok(card.indexOf('ตัวเลขจากเครื่องมือบนจอ ไม่ใช่ที่เขาพูด') > 0, 'labelled');
    ['6993.50', '6998.00', '4.50', '18', '0.064', '6982.50', '11.00', '44', '2.44', '6974.75', '18.75', '75', '4.17'].forEach(function (v) {
      ok(card.indexOf(v) > 0, 'shows ' + v);
    });
    ok(card.indexOf('youtu.be/TEp3a-7GUds?t=2125') > 0, 'chip 35:25');
    ok(card.indexOf('youtu.be/TEp3a-7GUds?t=2180') > 0, 'chip 36:20');
    ok(card.indexOf('คลิปไม่ได้ระบุ') > 0, 'size / which levels are his real ones: not said');
  });

  test('strategy.html: his money claim appears only as คำอ้างของเขา ยังไม่ยืนยัน, with its chip, and no figure', () => {
    var n = (html.match(/คำอ้างของเขา ยังไม่ยืนยัน/g) || []).length;
    ok(n >= 1, 'the claim badge is on the page');
    var i = html.indexOf('คำอ้างของเขา ยังไม่ยืนยัน');
    ok(html.slice(i - 900, i + 900).indexOf('youtu.be/TEp3a-7GUds?t=2431') > 0, 'chip 40:31 next to it');
    ok(!/\$\s?\d|฿\s?\d|\d\s?(บาท|ดอลลาร์)/.test(html), 'no money figures');
    ok(!/promo|apex|topstep|funded|ล้านบาท/i.test(html), 'no prop-firm talk, no income figure');
  });

  test('strategy.html: the four-part summary (P1.19) and the toolbox framing beside the C5 main-clip wording', () => {
    var sum = between('id="summary"', '</section>');
    eq((sum.match(/<li data-part="/g) || []).length, 4, 'four parts');
    ok(sum.indexOf('data-fact="P1.19"') > 0 || sum.indexOf('P1.19') > 0, 'P1.19');
    ['youtu.be/TEp3a-7GUds?t=2144'].forEach(function (u) { ok(sum.indexOf(u) > 0, 'chip ' + u); });
    var box = between('id="toolbox"', '</section>');
    ok(box.indexOf('class="older-note"') > 0, 'the toolbox framing sits in an older-note box');
    ok(box.indexOf(TJR.layout.OLDER_LABEL) > 0, 'labelled as the older video');
    ok(box.indexOf('youtu.be/Vulini8xbB0?t=1485') > 0, 'the main clip\'s own wording (F6.7, 24:45) is shown first');
    ok(box.indexOf('youtu.be/TEp3a-7GUds?t=62') > 0 || box.indexOf('youtu.be/TEp3a-7GUds?t=791') > 0, 'chip into the older clip');
    ok(box.indexOf('data-fact="F6.7"') > 0 && box.indexOf('P1.3') > 0, 'F6.7 and P1.3 cited');
    ok(box.indexOf('Vulini8xbB0') < box.indexOf('class="older-note"'), 'main framing comes first');
  });

  test('strategy.html: what the clip does not say is badged, not filled; every P id is a real fact id of clip #1 or #6', () => {
    var g = between('id="gaps"', '</section>');
    ok((g.match(/คลิปไม่ได้ระบุ/g) || []).length >= 5, 'at least five gap badges');
    ['ขนาดสถานะ', 'ระยะ stop-loss', 'ช่วงเวลา', 'เมื่อ confirmation ล้มเหลว'].forEach(function (w) { ok(g.indexOf(w) > 0, 'gap: ' + w); });
    (html.match(/P\d+\.\d+/g) || []).forEach(function (id) {
      var clip = Number(/^P(\d+)\./.exec(id)[1]);
      ok(clip === 1 || clip === 6, 'only clips #1 and #6 are cited: ' + id);
    });
  });

  test('strategy.html: simulated numbers are labelled, the chart is not his day, and no TJR footage is used', () => {
    ok(html.indexOf('ตัวเลขจากกราฟจำลอง') > 0, 'the simulated-numbers label');
    ok(/จำลอง/.test(between('class="strat-banner"', '</div>')), 'the banner');
    ok(!/<img\b/i.test(html) && !/<video\b/i.test(html) && !/<iframe\b/i.test(html), 'no images, videos or embeds');
    ok(html.indexOf('ไม่มีกราฟ 1 นาที') > 0, 'says the 1-minute flip is not simulated');
  });
})();
