/* Scenario gallery (Task 11): the pure helpers of assets/js/pages/scenarios.js and the content rule on
   scenarios.html. scenarios.js is evaluated into this context (no DOM here: it only attaches TJR.gallery).
   Wrapped in an IIFE (one shared vm scope). */
(function () {
  'use strict';
  (0, eval)(readText('assets/js/pages/scenarios.js'));
  var G = TJR.gallery, LIST = TJR.scenarios.list;

  test('gallery.parseHash: S01..S14 in any case, with or without #, nothing else', () => {
    eq(G.parseHash('#S06'), 'S06');
    eq(G.parseHash('s14'), 'S14');
    eq(G.parseHash('#S01'), 'S01');
    eq(G.parseHash('#S00'), null);
    eq(G.parseHash('#S15'), null);
    eq(G.parseHash('#S6'), null);
    eq(G.parseHash('#S061'), null);
    eq(G.parseHash(''), null);
    eq(G.parseHash(undefined), null);
    eq(G.parseHash('#top'), null);
  });

  test('gallery.filterIds: all 14, 8 trades, 6 without, session and HTF sets', () => {
    eq(G.filterIds(LIST, 'all').length, 14);
    eq(G.filterIds(LIST, 'trade'), ['S01', 'S02', 'S03', 'S09', 'S10', 'S12', 'S13', 'S14']);
    eq(G.filterIds(LIST, 'notrade'), ['S04', 'S05', 'S06', 'S07', 'S08', 'S11']);
    eq(G.filterIds(LIST, 'session'), ['S06', 'S07', 'S08', 'S09']);
    eq(G.filterIds(LIST, 'htf'), ['S05', 'S10', 'S11']);
    eq(G.filterIds(LIST, 'nonsense').length, 14);
  });

  test('gallery.kindOf agrees with the generator: trade, side, fail variants', () => {
    LIST.forEach((d) => {
      var k = G.kindOf(d), b = TJR.scenarios.safeBuild(d, G.SEEDS[d.id], {});
      eq(k.trade, b.truth.side != null, d.id + ' trade');
      eq(k.side, b.truth.side, d.id + ' side');
      eq(k.fail, d.outcomes.indexOf('fail') >= 0, d.id + ' fail');
    });
    eq(LIST.filter((d) => G.kindOf(d).fail).map((d) => d.id), ['S01', 'S03', 'S09', 'S10']);
  });

  test('gallery: every note of every scenario (win and fail, 12 seeds) cites a fact with a clip second, or F9.2', () => {
    LIST.forEach((d) => {
      var variants = d.outcomes.length ? d.outcomes : [null];
      variants.forEach((o) => {
        for (var seed = 1; seed <= 12; seed++) {
          var b = TJR.scenarios.safeBuild(d, seed, o ? { outcome: o } : {});
          b.truth.notes.forEach((n) => {
            ok(G.factSec(n.fact) != null || n.fact === 'F9.2', d.id + ' note ' + n.fact + ' has no clip second');
          });
        }
      });
    });
  });

  test('gallery.FACT_SEC: every fact exists in clip-facts.md, its second is a multiple of 15 and inside the clip', () => {
    var txt = readText('docs/source/clip-facts.md');
    Object.keys(G.FACT_SEC).forEach((f) => {
      var line = txt.split('\n').filter((l) => l.indexOf('- ' + f + ' ') === 0)[0];
      ok(line, f + ' is in clip-facts.md');
      var secs = G.FACT_SEC[f];
      eq(secs % 15, 0, f);
      ok(secs > 0 && secs < 49 * 60 + 8, f + ' within the clip');
    });
  });

  test('gallery.tfOptions: only S09, S10, S11 switch timeframe, the base is one of the choices', () => {
    LIST.forEach((d) => {
      var o = G.tfOptions(d.id);
      if (['S09', 'S10', 'S11'].indexOf(d.id) < 0) eq(o, [], d.id);
      else { ok(o.indexOf(d.tf) >= 0, d.id + ' base tf listed'); ok(o.length >= 3); }
    });
  });

  test('gallery.seriesIndex / baseEnd: base and rolled-up indices map back and forth (S10 at 1H and 4H)', () => {
    var b = TJR.scenarios.safeBuild(TJR.scenarios.get('S10'), 5, {}), base = b.candles;
    [60, 240].forEach((tf) => {
      var s = TJR.gen.rollup(base, 5, tf), prevEnd = -1;
      for (var j = 0; j < s.length; j++) {
        var e = G.baseEnd(base, s, j);
        ok(e > prevEnd, 'bucket ends increase at ' + j);
        ok(base[e].t >= s[j].t, 'last base bar is inside bucket ' + j);
        if (j + 1 < s.length) ok(base[e].t < s[j + 1].t && base[e + 1].t >= s[j + 1].t, 'bucket ' + j + ' ends right before the next');
        eq(G.seriesIndex(base, s, e), j, 'round trip at ' + j);
        prevEnd = e;
      }
      eq(G.baseEnd(base, s, s.length - 1), base.length - 1);
    });
    eq(G.baseEnd(base, base, 17), 17);
    eq(G.seriesIndex(base, base, 17), 17);
  });

  test('gallery.panelBar: a TF switch mid-bucket never shows the panel past the known base bar (S11/S10 at 4H)', () => {
    ['S11', 'S10'].forEach((id) => {
      var b = TJR.scenarios.safeBuild(TJR.scenarios.get(id), 5, {}), base = b.candles, s = TJR.gen.rollup(base, 5, 240);
      var known = G.startBar(b), j = G.seriesIndex(base, s, known);
      ok(G.baseEnd(base, s, j) > known, id + ': the start bar sits inside a partly revealed 4H bucket');
      eq(G.panelBar(base, s, j, known), known, id + ': panel stays on the known bar');
      eq(G.panelBar(base, s, j), G.baseEnd(base, s, j), id + ': a fully revealed bucket uses its end');
      eq(G.panelBar(base, base, 17, 40), 17);
    });
  });

  test('gallery.visibleNotes: only notes at or before the bar, in bar order', () => {
    var notes = [{ bar: 30, fact: 'F6.5', text: 'c' }, { bar: 5, fact: 'F6.3', text: 'a' }, { bar: 12, fact: 'F6.5', text: 'b' }];
    eq(G.visibleNotes(notes, 4), []);
    eq(G.visibleNotes(notes, 12).map((n) => n.text), ['a', 'b']);
    eq(G.visibleNotes(notes, 99).map((n) => n.text), ['a', 'b', 'c']);
  });

  test('gallery.playRate: a run lasts about 14 s at 1x, bounded, and speed multiplies it', () => {
    eq(G.playRate(70, 1), 6);
    eq(G.playRate(14, 1), 6);
    eq(G.playRate(700, 1), 50);
    eq(G.playRate(5000, 1), 60);
    eq(G.playRate(70, 4), 24);
    eq(G.playRate(70), 6);
  });

  test('gallery.startBar: before the sweep, after the levels are known, inside the series', () => {
    LIST.forEach((d) => {
      var b = TJR.scenarios.safeBuild(d, G.SEEDS[d.id], {}), s = G.startBar(b);
      ok(s >= 0 && s < b.candles.length - 1, d.id + ' inside');
      ok(s <= Math.max(0, b.truth.sweep.bar - 6), d.id + ' start ' + s + ' is before the sweep ' + b.truth.sweep.bar);
    });
  });

  test('gallery: a no-trade reason for exactly the six scenarios without a trade, each with a clip chip', () => {
    eq(Object.keys(G.NOTRADE).sort(), G.filterIds(LIST, 'notrade'));
    Object.keys(G.NOTRADE).forEach((id) => {
      var nt = G.NOTRADE[id];
      ok(nt.secs.length > 0 && nt.secs.every((s) => s > 0 && s % 15 === 0), id + ' chips');
      ok(nt.text.length > 40, id + ' text');
      // the reason cites the same clip seconds the library gives the scenario, or the facts behind its wording
      nt.secs.forEach((s) => ok(TJR.scenarios.get(id).clip.indexOf(s) >= 0 || s === 1350 || s === 1230, id + ' second ' + s));
    });
    eq(G.D4, 'คลิปไม่ได้บอกวิธีจัดการเมื่อ confirmation ล้ม');
  });

  test('scenarios.html: head metas, one h1, the viewer and filters present, scripts in the site order', () => {
    var h = readText('scenarios.html');
    ok(/<html lang="th"[^>]*data-type="software"/.test(h));
    eq((h.match(/<h1[ >]/g) || []).length, 1);
    ok(h.indexOf('id="viewer"') > 0 && h.indexOf('data-f="all"') > 0 && h.indexOf('data-f="htf"') > 0);
    ok(h.indexOf('assets/css/pages/scenarios.css') > 0);
    var order = ['core/ns.js', 'core/store.js', 'scenario/rng.js', 'scenario/swings.js', 'scenario/gen.js', 'scenario/sessions.js',
      'scenario/library.js', 'scenario/annotate.js', 'scenario/grade.js', 'chart/scale.js', 'chart/render.js', 'chart/overlays.js',
      'chart/chart.js', 'core/layout.js', 'core/motion.js', 'pages/scenarios.js'].map((s) => h.indexOf('assets/js/' + s));
    ok(order.every((p, i) => p > 0 && (i === 0 || p > order[i - 1])), 'script order');
    ok(h.indexOf('gsap/3.12.5/gsap.min.js') > 0 && h.indexOf('ScrollTrigger.min.js') > 0);
  });
})();
