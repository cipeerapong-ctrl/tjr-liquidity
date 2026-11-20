/* Scenario gallery (Task 11): the pure helpers of assets/js/pages/scenarios.js and the content rule on
   scenarios.html. scenarios.js is evaluated into this context (no DOM here: it only attaches TJR.gallery).
   Wrapped in an IIFE (one shared vm scope). */
(function () {
  'use strict';
  (0, eval)(readText('assets/js/pages/scenarios.js'));
  var G = TJR.gallery, LIST = TJR.scenarios.list;   // the whole gallery: S01-S14 (Level 1) and S15-S22 (Level 2)
  var L2 = ['S15', 'S16', 'S17', 'S18', 'S19', 'S20', 'S21', 'S22'];

  test('gallery.parseHash: S01..S22 in any case, with or without #, nothing else', () => {
    eq(G.parseHash('#S06'), 'S06');
    eq(G.parseHash('s14'), 'S14');
    eq(G.parseHash('#S01'), 'S01');
    eq(G.parseHash('#S00'), null);
    L2.forEach((id) => eq(G.parseHash('#' + id), id, id));
    eq(G.parseHash('s21'), 'S21');
    eq(G.parseHash('#S23'), null);
    eq(G.parseHash('#S30'), null);
    eq(G.parseHash('#S6'), null);
    eq(G.parseHash('#S061'), null);
    eq(G.parseHash(''), null);
    eq(G.parseHash(undefined), null);
    eq(G.parseHash('#top'), null);
  });

  test('gallery.filterIds: all 22, Level 1 = 14, Level 2 = 8, trades, no-trade, session and HTF sets', () => {
    eq(G.IDS.length, 22);
    eq(G.IDS, LIST.map((d) => d.id));
    eq(G.filterIds(LIST, 'all').length, 22);
    eq(G.filterIds(LIST, 'l1').length, 14);
    eq(G.filterIds(LIST, 'l1')[13], 'S14');
    eq(G.filterIds(LIST, 'l2'), L2);
    eq(G.filterIds(LIST, 'trade'), ['S01', 'S02', 'S03', 'S09', 'S10', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17', 'S19', 'S21', 'S22']);
    eq(G.filterIds(LIST, 'notrade'), ['S04', 'S05', 'S06', 'S07', 'S08', 'S11', 'S18', 'S20']);
    eq(G.filterIds(LIST, 'session'), ['S06', 'S07', 'S08', 'S09']);
    eq(G.filterIds(LIST, 'htf'), ['S05', 'S10', 'S11']);
    eq(G.filterIds(LIST, 'nonsense').length, 22);
  });

  test('gallery.levelOf: S01-S14 are Level 1, S15-S22 Level 2', () => {
    LIST.forEach((d) => eq(G.levelOf(d.id), L2.indexOf(d.id) >= 0 ? 2 : 1, d.id));
  });

  test('gallery.kindOf agrees with the generator: trade, side, fail variants', () => {
    LIST.forEach((d) => {
      var k = G.kindOf(d), b = TJR.scenarios.safeBuild(d, G.SEEDS[d.id], {});
      eq(k.trade, b.truth.side != null, d.id + ' trade');
      if (d.id === 'S21') ok(k.side === 'either' && ['long', 'short'].includes(b.truth.side), 'S21 side depends on the seed');
      else eq(k.side, b.truth.side, d.id + ' side');
      eq(k.fail, d.outcomes.indexOf('fail') >= 0, d.id + ' fail');
    });
    eq(LIST.filter((d) => G.kindOf(d).fail).map((d) => d.id), ['S01', 'S03', 'S09', 'S10', 'S15', 'S16']);
  });

  test('gallery: every note of every scenario (win and fail, 12 seeds) cites a fact with a clip second, or F9.2', () => {
    LIST.forEach((d) => {
      var variants = d.outcomes.length ? d.outcomes : [null];
      variants.forEach((o) => {
        for (var seed = 1; seed <= 12; seed++) {
          var b = TJR.scenarios.safeBuild(d, seed, o ? { outcome: o } : {});
          b.truth.notes.forEach((n) => {
            ok(G.noteChip(n.fact) != null || n.fact === 'F9.2', d.id + ' note ' + n.fact + ' has no clip second');
          });
        }
      });
    });
  });

  test('gallery.noteChip: F ids -> main clip second, P ids -> the playlist video of the same clip number, never clip #4', () => {
    eq(G.noteChip('F6.3'), { sec: 1350 });
    eq(G.noteChip('F9.2'), null);
    eq(G.noteChip('P1.19'), { clip: 1, sec: 2144 });
    eq(G.noteChip('P1.51'), { clip: 1, sec: 2113 });           // cited by S16-S22 notes, listed in S15's facts
    eq(G.noteChip('P8.14'), { clip: 8, sec: 356 });            // cited by S22's notes, listed in S16's facts
    eq(G.noteChip('P99.1'), null);
    LIST.filter((d) => L2.indexOf(d.id) >= 0).forEach((d) => {
      eq(d.facts.length, d.clip.length, d.id + ' facts and clips are parallel');
      d.facts.forEach((f, i) => {
        var c = G.noteChip(f);
        eq(c, { clip: d.clip[i].clip, sec: d.clip[i].sec }, d.id + ' ' + f);
        eq(f.indexOf('P' + c.clip + '.'), 0, d.id + ' ' + f + ' chip clip number');
        ok(c.clip !== 4, d.id + ' no chip to clip #4');
      });
    });
  });

  test('gallery.clipsOf: Level 1 cards keep their main-clip chips, S05 gains P12.27 and P12.28 (clip #12) from the caption starts', () => {
    eq(G.clipsOf(TJR.scenarios.get('S01')), TJR.scenarios.get('S01').clip);
    var s05 = TJR.scenarios.get('S05'), c = G.clipsOf(s05);
    eq(c.slice(0, s05.clip.length), s05.clip);
    eq(c.slice(s05.clip.length), [{ clip: 12, sec: 2280 }, { clip: 12, sec: 2301 }]);
    var txt = readText('docs/source/playlist/AGmAVyAuBE0.md');
    ['P12.27', 'P12.28'].forEach((id, i) => {
      var line = txt.split('\n').filter((l) => l.indexOf('- ' + id + ' ') === 0)[0], at = i ? '38:21' : '38:00';
      ok(line && line.indexOf('(' + at + '–') > 0, id + ' caption starts at ' + at);
    });
    eq(G.clipsOf(TJR.scenarios.get('S11')), TJR.scenarios.get('S11').clip, 'S11 unchanged');
    L2.forEach((id) => eq(G.clipsOf(TJR.scenarios.get(id)), TJR.scenarios.get(id).clip, id));
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
      var ref = b.truth.sweep ? b.truth.sweep.bar : b.truth.confluence.origin;
      ok(s <= Math.max(0, ref - 6), d.id + ' start ' + s + ' is before the setup ' + ref);
    });
  });

  test('gallery: a no-trade reason for exactly the eight scenarios without a trade, each with a clip chip', () => {
    eq(Object.keys(G.NOTRADE).sort(), G.filterIds(LIST, 'notrade'));
    Object.keys(G.NOTRADE).forEach((id) => {
      var nt = G.NOTRADE[id], d = TJR.scenarios.get(id);
      ok(nt.text.length > 40, id + ' text');
      if (G.levelOf(id) === 1) {
        ok(nt.secs.length > 0 && nt.secs.every((s) => s > 0 && s % 15 === 0), id + ' chips');
        // the reason cites the same clip seconds the library gives the scenario, or the facts behind its wording
        nt.secs.forEach((s) => ok(d.clip.indexOf(s) >= 0 || s === 1350 || s === 1230, id + ' second ' + s));
      } else {
        eq(nt.secs, [], id + ' has no main-clip chips');
        eq(nt.pl, d.clip.map((c) => [c.clip, c.sec]), id + ' playlist chips are the scenario clips');
        ok(nt.pl.every((c) => c[0] !== 4), id + ' no clip #4');
      }
    });
    eq(G.NOTRADE.S05.pl, [[12, 2280], [12, 2301]], 'S05 reason cites P12.27-P12.28');
    eq(G.D4, 'คลิปไม่ได้บอกวิธีจัดการเมื่อ confirmation ล้ม');
    eq(G.D4_L2, 'คลิปไม่ได้บอกวิธีจัดการเมื่อ setup ล้ม');
  });

  test('gallery.milestones: Level 2 phases come from the truth, in bar order, inside the series', () => {
    L2.forEach((id) => {
      var d = TJR.scenarios.get(id);
      for (var seed = 1; seed <= 12; seed++) {
        var b = TJR.scenarios.safeBuild(d, seed, {}), m = G.milestones(b.truth), n = b.candles.length;
        ok(m.length >= 2, id + ' has phases');
        m.forEach((x, i) => {
          ok(x.bar >= 0 && x.bar < n, id + ' bar in the series');
          ok(i === 0 || x.bar >= m[i - 1].bar, id + ' seed ' + seed + ' phases in order');
        });
        var keys = m.map((x) => x.key);
        if (b.truth.side) ['confirm', 'cont', 'entry'].forEach((k) => ok(keys.indexOf(k) >= 0, id + ' has ' + k));
        else ok(keys.indexOf('entry') < 0 && keys.indexOf('nt') >= 0, id + ' no entry phase, but the no-trade moment');
        eq(m.filter((x) => x.key === 'confirm')[0].label, b.truth.confluence.confirm.kind.toUpperCase(), id + ' confirm label');
      }
    });
    eq(G.milestones(TJR.scenarios.safeBuild(TJR.scenarios.get('S21'), 1, {}).truth)[0].key, 'smt');
    eq(G.milestones(TJR.scenarios.safeBuild(TJR.scenarios.get('S01'), 1, {}).truth).map((x) => x.key), ['sweep', 'confirm', 'entry'], 'Level 1 keeps sweep / confirm / entry');
    eq(G.milestones(TJR.scenarios.safeBuild(TJR.scenarios.get('S05'), 1, {}).truth).map((x) => x.key), ['sweep']);
  });

  test('gallery.modeOf: only S21 opens in the twin chart, and its twin has the main chart\'s bars', () => {
    eq(LIST.filter((d) => G.modeOf(d.id) === 'twin').map((d) => d.id), ['S21']);
    LIST.forEach((d) => {
      var b = TJR.scenarios.safeBuild(d, G.SEEDS[d.id], {});
      eq(G.modeOf(d.id), b.truth.twin ? 'twin' : 'single', d.id);
    });
    var b = TJR.scenarios.safeBuild(TJR.scenarios.get('S21'), G.SEEDS.S21, {}), tw = G.twinBuilt(b);
    eq(tw.candles.length, b.candles.length);
    eq(tw.meta.instrument, 'NQ');
    eq(b.meta.instrument, 'ES', 'the main chart is untouched');
    var ov = G.twinOverlays(b, 'main'), ow = G.twinOverlays(b, 'twin');
    ok(ov.length > 0 && ow.length > 0, 'both charts get the SMT line');
    ov.concat(ow).forEach((o) => ok(o.appearAt === b.truth.smt.at && o.appearAt <= b.candles.length - 1, 'SMT overlays appear at smt.at'));
  });

  test('gallery.confluenceOverlays: the setup stretch only, never past the bar, windows only for S22', () => {
    L2.concat(['S01', 'S05']).forEach((id) => {
      var b = TJR.scenarios.safeBuild(TJR.scenarios.get(id), G.SEEDS[id], {}), n = b.candles.length, from = G.setupStart(b);
      ok(from >= 0 && from < n, id + ' setup start');
      var all = G.confluenceOverlays(b, n - 1), ids = {};
      ok(all.length > 0 || id === 'S05', id + ' has confluence overlays');
      all.forEach((o) => {
        ok(o.appearAt <= n - 1, id + ' appears inside the series');
        ok(!ids[o.id], id + ' ' + o.id + ' unique'); ids[o.id] = 1;
        if (o.type === 'fvg') ok(o.to >= from, id + ' fvg ' + o.id + ' belongs to the setup stretch');
        if (o.type === 'bos') ok(o.at >= from, id + ' bos ' + o.id + ' belongs to the setup stretch');
        if (o.type === 'eq') ok(o.endAt == null || o.endAt > from, id + ' eq ' + o.id + ' is not already replaced when the setup starts');
        if (o.type === 'band') eq(id, 'S22', 'bands only on the time-window scenario');
      });
      var mid = Math.floor(n / 2);
      G.confluenceOverlays(b, mid).forEach((o) => ok(o.appearAt <= mid, id + ' no overlay known after bar ' + mid));
    });
    var s22 = G.confluenceOverlays(TJR.scenarios.safeBuild(TJR.scenarios.get('S22'), G.SEEDS.S22, {}), 9999);
    ok(s22.some((o) => o.type === 'band'), 'S22 draws its two NY window bands');
  });

  test('gallery.l2Rows: the Level 2 side panel reads the chain from the candles and shows nothing before it is known', () => {
    L2.filter((id) => G.kindOf(TJR.scenarios.get(id)).trade).forEach((id) => {
      for (var seed = 1; seed <= 8; seed++) {
        var b = TJR.scenarios.safeBuild(TJR.scenarios.get(id), seed, {}), K = b.truth.confluence;
        ok(G.l2Rows(b, -1).every((r) => r.text == null), id + ' nothing known at bar -1');
        ok(G.l2Rows(b, b.candles.length - 1).every((r) => r.text != null && r.text.length > 0), id + ' everything known at the end');
        var row = (at, key) => G.l2Rows(b, at).filter((r) => r.key === key)[0];
        eq(row(K.entry.at - 1, 'entry').text, null, id + ' entry unknown one bar before it');
        ok(row(K.entry.at, 'entry').text, id + ' entry known at its bar');
        eq(row(K.confirm.at - 1, 'confirm').text, null, id + ' confirmation unknown one bar before it');
        ok(row(K.cont.at, 'cont').text, id + ' continuation known at its bar');
      }
    });
    var rows = G.l2Rows(TJR.scenarios.safeBuild(TJR.scenarios.get('S22'), 1, {}), 9999);
    ok(rows.some((r) => / ET/.test(r.text)), 'times are shown in ET and Thailand');
    eq(G.L2_CHIPS.chain, [1, 2144]);
    eq(G.L2_CHIPS.entry, [1, 1975]);
    var txt = readText('docs/source/playlist/TEp3a-7GUds.md');
    ok(/- P1\.19 [^\n]*\(35:44–/.test(txt) && /- P1\.44 [^\n]*\(32:55–/.test(txt), 'the two verdict chips are the caption starts of P1.19 and P1.44');
  });

  test('scenarios.html: head metas, one h1, the viewer and filters present, scripts in the site order', () => {
    var h = readText('scenarios.html');
    ok(/<html lang="th"[^>]*data-type="software"/.test(h));
    eq((h.match(/<h1[ >]/g) || []).length, 1);
    ok(h.indexOf('id="viewer"') > 0 && h.indexOf('data-f="all"') > 0 && h.indexOf('data-f="htf"') > 0);
    ok(/data-f="l1"[^>]*>Level 1</.test(h) && /data-f="l2"[^>]*>Level 2</.test(h), 'Level 1 / Level 2 filters');
    ok(/data-act="conf"[^>]*>อ่าน confluence</.test(h), 'the confluence toggle');
    ok(h.indexOf('data-k="hostA"') > 0 && h.indexOf('data-k="hostB"') > 0, 'two chart hosts for the twin view');
    ok(h.indexOf('assets/css/pages/scenarios.css') > 0);
    var order = ['core/ns.js', 'core/sources.js', 'core/store.js', 'scenario/rng.js', 'scenario/swings.js', 'scenario/gen.js', 'scenario/sessions.js',
      'scenario/confluence.js', 'scenario/library.js', 'scenario/system.js', 'scenario/annotate.js', 'scenario/grade.js', 'chart/scale.js', 'chart/render.js', 'chart/overlays.js',
      'chart/chart.js', 'core/layout.js', 'core/motion.js', 'pages/scenarios.js'].map((s) => h.indexOf('assets/js/' + s));
    ok(order.every((p, i) => p > 0 && (i === 0 || p > order[i - 1])), 'script order');
    ok(h.indexOf('gsap/3.12.5/gsap.min.js') > 0 && h.indexOf('ScrollTrigger.min.js') > 0);
  });

  // T11: S06 / S07 / S08 are days the clip narrates without an entry (S06 even says "trade done"): never the "no trade" tag
  test('gallery.noTradeTag: "ไม่มีเทรด" only where the clip says so; the day-story scenarios get the gap wording', () => {
    ['S04', 'S05', 'S11', 'S18', 'S20'].forEach((id) => eq(G.noTradeTag(id), 'ไม่มีเทรด', id));
    ['S06', 'S07', 'S08'].forEach((id) => eq(G.noTradeTag(id), 'คลิปไม่ได้ระบุจุดเข้า', id));
    var src = readText('assets/js/pages/scenarios.js');
    ok(src.indexOf('tag--none">ไม่มีเทรด<') < 0, 'no hard-coded "no trade" tag is left');
    eq(readText('scenarios.html').indexOf('aria-label="timeframe"'), -1, 'the timeframe group label is Thai');
  });

  test('scenarios.html / scenarios.js: the count is 22 everywhere, nothing left of the Level 1 restriction', () => {
    var h = readText('scenarios.html'), js = readText('assets/js/pages/scenarios.js');
    ok(/<title>22 สถานการณ์ liquidity จากคลิป TJR \| Liquidity<\/title>/.test(h), 'title');
    ok(/<h1>22 สถานการณ์ liquidity จากคลิป TJR<\/h1>/.test(h), 'h1');
    ok(h.indexOf('14 สถานการณ์') < 0 && js.indexOf('14 สถานการณ์') < 0, 'no 14-scenario copy');
    ok(js.indexOf('v1List') < 0, 'the v1 restriction is gone');
    ok(js.indexOf("doc.title = '22 สถานการณ์") > 0, 'closing the viewer restores the 22 title');
  });
})();
