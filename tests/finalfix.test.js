/* Final-review fixes (whole-branch review of v2): behaviours that were wrong and are now pinned. The S21 / S16 / lab
   drill fixes have their tests in system.test.js and lab.test.js; this file holds the rest (annotate, risk, page text).
   Wrapped in an IIFE (one shared vm scope). */
(function () {
  'use strict';
  var S = TJR.scenarios;
  var LEVEL2 = ['S15', 'S16', 'S17', 'S18', 'S19', 'S20', 'S21', 'S22'];

  // minor 6: annotate.confluence runs the BOS detector from the setup with the trend the setup implies
  test('annotate.confluence: the BOS markers start at the setup, and the confirmation is always marked (Level 2 seeds 1..60)', () => {
    LEVEL2.forEach(function (id) {
      var d = S.get(id), outs = d.outcomes.length ? d.outcomes : [undefined];
      outs.forEach(function (o) {
        for (var seed = 1; seed <= 60; seed++) {
          var b = d.build(seed, o ? { outcome: o } : {}), K = b.truth.confluence, tag = id + ' seed ' + seed;
          var bos = TJR.annotate.confluence(b, { show: { fvg: false, eq: false, windows: false } }).filter(function (x) { return x.type === 'bos'; });
          bos.forEach(function (x) { if (!(x.at > K.origin)) throw new Error(tag + ': a BOS marker at ' + x.at + ' before the setup (origin ' + K.origin + ')'); });
          if (K.confirm.kind === 'bos') {
            var m = bos.filter(function (x) { return x.at === K.confirm.at; })[0];
            if (!m) throw new Error(tag + ': the confirming break at ' + K.confirm.at + ' has no marker');
            eq(m.price, K.confirm.level.price, tag + ' marker price');
          }
        }
      });
    });
  });

  // minor 7: halving one contract changes nothing, and the answer says so
  test('risk.calc: halve with a 1-contract base reports cannotHalve; with 2+ contracts it does not', () => {
    (0, eval)(readText('assets/js/pages/risk.js'));
    var R = TJR.riskPage;
    var one = R.calc({ account: 50000, riskPct: 1, tightest: 16, widest: 100, tickValue: 5, halve: true });
    eq([one.base, one.size, one.cannotHalve], [1, 1, true]);
    var two = R.calc({ account: 50000, riskPct: 1, tightest: 16, widest: 50, tickValue: 5, halve: true });
    eq([two.base, two.size, two.cannotHalve], [2, 1, false]);
    eq(R.calc({ account: 50000, riskPct: 1, tightest: 16, widest: 100, tickValue: 5, halve: false }).cannotHalve, false, 'toggle off');
    eq(R.calc({ account: 100, riskPct: 1, tightest: 4, widest: 10, tickValue: 5, halve: true }).cannotHalve, false, 'no base size, nothing to say');
    var js = readText('assets/js/pages/risk.js');
    ok(js.indexOf('cannotHalve') > 0 && js.indexOf('หารครึ่งไม่ได้') > 0, 'the page writes the one-line note');
  });

  // minor 5: a gap whose middle candle is the window's first bar is fully on screen (the chart starts one bar earlier)
  test('lab gap: a gap that starts one bar before the window is on screen, counts, and its middle click is right', () => {
    (0, eval)(readText('assets/js/pages/lab.js'));
    var L = TJR.lab, edge = 0;
    ['S15', 'S16', 'S19', 'S22'].forEach(function (id) {
      for (var seed = 1; seed <= 120; seed++) {
        var b = S.safeBuild(S.get(id), seed, {}), w = L.gapWindow(b), v = L.gapViewFrom(w);
        eq(v, Math.max(0, w.from - 1), 'the view starts one bar before the window');
        var all = TJR.confluence.fvgs(b.candles.slice(0, w.to + 1)).filter(function (x) { return x.from >= v; });
        eq(L.gapsIn(b, w).map(function (x) { return x.i; }), all.map(function (x) { return x.i; }), id + ' seed ' + seed + ' every fully visible gap counts');
        all.filter(function (x) { return x.from === v && w.from > 0; }).forEach(function (x) {
          edge++;
          var g = Object.assign({}, w, { dir: x.dir });
          eq(L.gapGrade(b, g, x.i).correct, true, id + ' seed ' + seed + ' the edge gap middle ' + x.i);
        });
      }
    });
    ok(edge > 0, 'the edge case occurs in the sample: ' + edge);
  });

  var ROOT = listRootHtml();

  // minors 8 / 9: stale v1 copy and the verbatim idiom
  test('copy: no typed "14 สถานการณ์" in learn.js, no "live to trade another day" on any page', () => {
    var js = readText('assets/js/pages/learn.js');
    ok(!/14 สถานการณ์/.test(js), 'learn.js counts the scenarios from the library');
    ok(js.indexOf('TJR.scenarios.list.length') > 0, 'learn.js uses the real count');
    ROOT.forEach(function (f) { ok(!/live to trade another day/i.test(readText(f)), f + ' quotes the idiom'); });
    ok(/ให้บัญชียังอยู่เทรด/.test(readText('risk.html')), 'risk.html says it in Thai');
  });

  // minor 10: one chip row never links the same place twice
  test('chips: no row (.chips) links the same video second twice, on any page', () => {
    ROOT.forEach(function (f) {
      var html = readText(f), re = /<p class="chips">(.*?)<\/p>/g, m;
      while ((m = re.exec(html))) {
        var hrefs = m[1].match(/href="https:\/\/youtu\.be\/[^"]+"/g) || [];
        eq(new Set(hrefs).size, hrefs.length, f + ': duplicate chip in one row: ' + hrefs.join(' '));
      }
    });
  });

  // minors 1 / 2 / 4: the playbook exit step and the strategy "not in this clip" list
  test('playbook exit step: no one-to-one TP pairing, the news-candle exit has its chips; strategy gap list points to #5 / #7', () => {
    var pb = readText('playbook.html'), a = pb.indexOf('data-step="7"'), step = pb.slice(a, pb.indexOf('</li>', a));
    ok(!/TP1, TP2 และ TP3 อยู่ที่/.test(step), 'TP1-TP3 are not paired with the draws one by one');
    ok(step.indexOf('TP ไหนตรงกับ draw ไหน คลิปไม่ได้ระบุ') > 0, 'the pairing is a gap badge');
    ok(/youtu\.be\/AGmAVyAuBE0\?t=2891"[^>]*data-fact="P12\.38"/.test(step), 'news candle chip #12 48:11');
    ok(/youtu\.be\/AGmAVyAuBE0\?t=3061"[^>]*data-fact="P12\.40"/.test(step), 'data highs / lows chip #12 51:01');
    var st = readText('strategy.html'), g = st.slice(st.indexOf('id="gaps-h"'), st.indexOf('id="next"'));
    ok(/คลิป #5/.test(g) && /คลิป #7/.test(g) && /คลิป #2/.test(g), 'the gap list points at the clips that do say it');
  });

  // minor 3: S17's entry trigger is the site's reading, not his rule
  test('S17: the entry note labels the close-back-under-0.5 trigger as the reading of the site', () => {
    for (var s = 1; s <= 20; s++) {
      var n = S.get('S17').build(s, {}).truth.notes.filter(function (x) { return x.fact === 'P7.24' && /เว็บนี้/.test(x.text); });
      eq(n.length, 1, 'seed ' + s);
      ok(!/ราคาโดน respect จึงเข้า short/.test(n[0].text), 'no invented rule');
    }
  });

  // minor 8: README is v2
  test('README: the learning path and its pages, sources and precedence, run / test / deploy; nothing from v1', () => {
    var md = readText('README.md');
    ROOT.forEach(function (f) { ok(md.indexOf('`' + f + '`') >= 0, 'README lists ' + f); });
    ['learning path', 'Step 0', 'start.html', 'precedence', 'node tests/run.mjs', 'Deploy', 'Folder map', 'clip-facts.md', 'playlist'].forEach(function (w) { ok(md.indexOf(w) >= 0, 'README mentions ' + w); });
    ok(!/14 messy|202 tests|four graded|7-step|11-item/.test(md), 'no v1 numbers');
    ok(!/__TESTS__/.test(md), 'the test count is filled in');
    ok(/system, annotate/.test(md) && /confluence/.test(md), 'script order and folder map include the v2 scripts');
  });

  // 390 px: the icon control (pause) is at least 44px even while the hero scales to .98
  test('home.css: the pause icon control is 48px', () => {
    ok(/\.ctrl--icon\s*\{[^}]*width:\s*48px/.test(readText('assets/css/pages/home.css')));
  });
})();
