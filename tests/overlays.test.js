/* Label de-collision (Task 9): TJR.chart.overlays.placer. Close levels (a stack of lows a few ticks
   apart) get their tags side by side on their own lines, then under the line, and only then the old
   climb above the label they hit. Wrapped in an IIFE (all test files share one vm global scope). */
(function () {
  'use strict';
  var P = TJR.chart.overlays.placer;
  var BOX = { left: 0, right: 600, top: 0, bottom: 400 };
  function rect(x, y) { return { x: x, y: y, w: 80, h: 17 }; }
  function overlap(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }

  test('placer: a free label stays where it is', function () {
    var place = P(BOX), r = place(rect(300, 100), { minX: 0 });
    eq(r.x, 300); eq(r.y, 100);
  });

  test('placer: a taken spot slides the label left along its own row, never left of minX', function () {
    var place = P(BOX);
    var a = place(rect(300, 100), { minX: 0 });
    var b = place(rect(300, 106), { minX: 100 });
    var c = place(rect(300, 110), { minX: 100 });
    eq(b.y, 106, 'b keeps its row');
    eq(c.y, 110, 'c keeps its row');
    ok(b.x + b.w <= a.x, 'b ends left of a');
    ok(c.x + c.w <= b.x, 'c ends left of b');
    ok(c.x >= 100, 'c stays right of its minX');
    ok(!overlap(a, b) && !overlap(b, c) && !overlap(a, c), 'no two labels overlap');
  });

  test('placer: with no room to slide, the label takes its alternative (under the line)', function () {
    var place = P(BOX);
    var a = place(rect(300, 100), { minX: 0 });
    var b = place(rect(300, 106), { minX: 290, alts: [rect(300, 140)] });
    eq(b.x, 300); eq(b.y, 140);
    ok(!overlap(a, b));
  });

  test('placer: without minX or alts it climbs above the label it hits (the old rule)', function () {
    var place = P(BOX);
    var a = place(rect(300, 100));
    var b = place(rect(300, 106));
    eq(b.x, 300);
    ok(b.y + b.h <= a.y, 'b sits above a');
  });

  test('placer: an alternative outside the plot is skipped; fixed tags are steered around', function () {
    var place = P(BOX);
    place.add({ x: 280, y: 95, w: 40, h: 17 });                // a structure tag
    var b = place(rect(300, 100), { minX: 250, alts: [rect(300, 395)] });
    ok(b.y + b.h <= 95, 'climbed above the tag: no slide room, the alternative is off the plot');
    var c = place(rect(400, 100), { minX: 0 });
    eq(c.y, 100); eq(c.x, 400, 'clear spot untouched');
  });

  // ------------------------------------------------------------------ v2 shapes: fvg, bos, eq, band

  var O = TJR.chart.overlays;
  var TH = TJR.chart.render.readTheme(null);
  var GBOX = { left: 0, right: 600, top: 4, bottom: 300, w: 640, h: 340 };
  function mkScale() {
    return TJR.chart.scale.make({ w: 640, h: 340, padL: 0, padR: 40, padT: 30, padB: 40, from: 0, to: 59, min: 90, max: 130 });
  }
  // A ctx that logs every method call with the alpha and line dash in force; save/restore keep a stack.
  function recCtx(hooks) {
    var log = [], props = { globalAlpha: 1, lineDash: [] }, stack = [];
    return new Proxy({}, {
      get: function (o, k) {
        if (k === 'log') return log;
        if (k === 'measureText') return function (s) { return { width: String(s).length * 6 }; };
        if (k === 'save') return function () { stack.push(Object.assign({}, props)); };
        if (k === 'restore') return function () { props = stack.pop() || props; };
        if (k === 'setLineDash') return function (a) { props.lineDash = a; log.push({ fn: k, args: [a], alpha: props.globalAlpha }); };
        if (k in props) return props[k];
        return function () {
          log.push({ fn: k, args: Array.prototype.slice.call(arguments), alpha: props.globalAlpha, fill: props.fillStyle, stroke: props.strokeStyle });
        };
      },
      set: function (o, k, v) { props[k] = v; return true; }
    });
  }
  function paint(list, rev, layer) {
    var ctx = recCtx(), sc = mkScale();
    O.draw(ctx, sc, TH, list, { rev: rev, box: GBOX, fs: 11, prog: function () { return { inP: 1, flashP: null }; } }, layer);
    return { log: ctx.log, sc: sc };
  }
  function calls(log, fn) { return log.filter(function (c) { return c.fn === fn; }); }
  function texts(log) { return calls(log, 'fillText').map(function (c) { return c.args[0]; }); }
  function dashed(log) { return calls(log, 'setLineDash').some(function (c) { return c.args[0] && c.args[0].length > 0; }); }

  var FVG = { id: 'g', type: 'fvg', from: 10, to: 12, low: 100, high: 104, dir: 'bull', state: 'open', appearAt: 12 };

  test('overlays doc comment lists fvg, bos, eq and band', () => {
    var src = readText('assets/js/chart/overlays.js'), head = src.slice(0, src.indexOf('(function'));
    ['fvg', 'bos', 'eq', 'band'].forEach(function (t) {
      ok(new RegExp('^\\s+' + t + '\\s+\\{', 'm').test(head), t + ' shape missing from the header');
    });
  });

  test('overlays: fvg, bos, eq and band stay hidden until the bar where they become knowable', () => {
    var bos = { type: 'bos', price: 110, from: 20, at: 30, dir: 'up' };
    var eqo = { type: 'eq', from: 20, to: 40, low: 100, high: 120, dir: 'up' };
    var band = { type: 'band', from: 20, to: 30, label: 'x' };
    ok(!O.isVisible(FVG, 11) && O.isVisible(FVG, 12), 'fvg shows with its third candle');
    ok(!O.isVisible({ type: 'fvg', from: 10, to: 12, low: 1, high: 2, dir: 'bull', state: 'open' }, 11), 'fvg without appearAt: by its third candle');
    ok(!O.isVisible(bos, 29) && O.isVisible(bos, 30), 'bos shows at its breaking bar');
    ok(!O.isVisible(eqo, 39) && O.isVisible(eqo, 40), 'eq by its end swing');
    ok(!O.isVisible({ type: 'eq', from: 20, to: 40, low: 1, high: 2, dir: 'up', appearAt: 43 }, 42), 'eq waits for appearAt');
    var replaced = { type: 'eq', from: 20, to: 40, low: 1, high: 2, dir: 'up', appearAt: 43, endAt: 60 };
    ok(O.isVisible(replaced, 59) && !O.isVisible(replaced, 60), 'eq is gone once the next range replaces it');
    ok(!O.isVisible(band, 19) && O.isVisible(band, 20), 'band from its first bar');
  });

  test('overlays: a fvg with stateAt after the revealed bar draws as open; at stateAt it turns dashed with the IFVG pill', () => {
    var dis = Object.assign({}, FVG, { state: 'disrespected', stateAt: 30 });
    var before = paint([dis], 20), after = paint([dis], 30);
    ok(!dashed(before.log), 'no dashed edge before stateAt');
    ok(texts(before.log).indexOf('IFVG') < 0, 'no IFVG pill before stateAt');
    ok(dashed(after.log), 'dashed edge from stateAt');
    ok(texts(after.log).indexOf('IFVG') >= 0, 'IFVG pill from stateAt');
    var asOpen = paint([Object.assign({}, FVG, { state: 'open' })], 20);
    var alphas = function (r) { return calls(r.log, 'strokeRect').map(function (c) { return c.alpha; }); };
    eq(alphas(before), alphas(asOpen), 'drawn exactly as an open gap');
  });

  test('overlays: a respected fvg gets a solid, stronger edge only once its stateAt is revealed', () => {
    var res = Object.assign({}, FVG, { state: 'respected', stateAt: 30 });
    var before = paint([res], 20), after = paint([res], 30);
    var a0 = calls(before.log, 'strokeRect')[0].alpha, a1 = calls(after.log, 'strokeRect')[0].alpha;
    ok(a1 > a0, 'edge stronger once respected: ' + a0 + ' -> ' + a1);
    ok(!dashed(after.log) && texts(after.log).indexOf('IFVG') < 0, 'solid, no IFVG');
  });

  test('overlays: a fvg without stateAt takes its state at once', () => {
    var r = paint([Object.assign({}, FVG, { state: 'disrespected' })], 20);
    ok(dashed(r.log) && texts(r.log).indexOf('IFVG') >= 0);
  });

  test('overlays: the fvg box runs to the right edge until endAt is revealed, then stops at endAt', () => {
    var g = Object.assign({}, FVG, { endAt: 40 });
    var right = function (r) { var f = calls(r.log, 'fillRect')[0].args; return f[0] + f[2]; };
    var open = paint([g], 30, 'under'), done = paint([g], 40, 'under');
    near(right(open), GBOX.right, 1e-6, 'to the plot edge before endAt');
    near(right(done), open.sc.x(40) + open.sc.slot / 2, 1e-6, 'to endAt once revealed');
    var f = calls(open.log, 'fillRect')[0].args;
    near(f[0], open.sc.x(10) - open.sc.slot / 2, 1e-6, 'starts at the first candle');
    near(f[1], open.sc.y(104), 1e-6); near(f[1] + f[3], open.sc.y(100), 1e-6);
  });

  test('overlays: bull fvg uses the bull colour, bear the bear colour', () => {
    var fill = function (dir) {
      return calls(paint([Object.assign({}, FVG, { dir: dir })], 20, 'under').log, 'fillRect')[0].fill;
    };
    eq(fill('bull'), TH.bull); eq(fill('bear'), TH.bear);
  });

  test('overlays: bos draws its ray from the swing to the break and the BOS pill, never before the break', () => {
    var bos = { id: 'b', type: 'bos', price: 110, from: 20, at: 30, dir: 'up', appearAt: 30 };
    var none = paint([bos], 29), r = paint([bos], 30);
    eq(none.log.filter(function (c) { return c.fn === 'fillText' || c.fn === 'lineTo'; }).length, 0, 'nothing before the break');
    ok(texts(r.log).indexOf('BOS') >= 0, 'BOS pill');
    var line = calls(r.log, 'lineTo')[0].args;
    near(line[0], r.sc.x(30), 1e-6, 'ray ends at the breaking bar');
    near(line[1], Math.round(r.sc.y(110)) + 0.5, 1e-6, 'ray at the swing price');
    near(calls(r.log, 'moveTo')[0].args[0], r.sc.x(20), 1e-6, 'ray starts at the swing');
  });

  test('overlays: eq draws lines with 0, 0.5 and 1 labels; the half away from the trend is tinted premium or discount', () => {
    var up = { id: 'e', type: 'eq', from: 20, to: 40, low: 100, high: 120, dir: 'up', appearAt: 43 };
    var r = paint([up], 50);
    ['0', '0.5', '1'].forEach(function (t) { ok(texts(r.log).indexOf(t) >= 0, 'label ' + t); });
    ok(texts(r.log).indexOf('discount') >= 0 && texts(r.log).indexOf('premium') < 0, 'uptrend: lower half = discount');
    var under = paint([up], 50, 'under');
    var tint = calls(under.log, 'fillRect')[0].args;
    near(tint[1], under.sc.y(110), 1e-6); near(tint[1] + tint[3], under.sc.y(100), 1e-6);
    var dn = paint([Object.assign({}, up, { dir: 'down' })], 50);
    ok(texts(dn.log).indexOf('premium') >= 0 && texts(dn.log).indexOf('discount') < 0, 'downtrend: upper half = premium');
    eq(texts(paint([up], 41).log), [], 'nothing before it is knowable');
  });

  test('overlays: band is a full-height time band with its label, clipped at the revealed bar', () => {
    var band = { id: 'w', type: 'band', from: 20, to: 40, label: '09:30–09:50 manipulation', appearAt: 20 };
    var r = paint([band], 30), under = paint([band], 30, 'under');
    var f = calls(under.log, 'fillRect')[0].args;
    near(f[1], GBOX.top, 1e-6); near(f[1] + f[3], GBOX.bottom, 1e-6);
    near(f[0], r.sc.x(20) - r.sc.slot / 2, 1e-6);
    near(f[0] + f[2], r.sc.x(30) + r.sc.slot / 2, 1e-6, 'clipped at the revealed bar');
    ok(texts(r.log).indexOf('09:30–09:50 manipulation') >= 0, 'label drawn');
    eq(paint([band], 19).log.filter(function (c) { return c.fn === 'fillRect' || c.fn === 'fillText'; }).length, 0, 'hidden before its first bar');
  });

  test('overlays.mapBars also moves stateAt, endAt and at by candle time', () => {
    var b = TJR.scenarios.safeBuild(TJR.scenarios.get('S10'), 3, {}), base = b.candles, rolled = TJR.gen.rollup(base, 5, 240);
    var m = O.mapBars([{ id: 'g', type: 'fvg', from: 400, to: 402, low: 1, high: 2, dir: 'bull', state: 'respected', stateAt: 500, endAt: 600, appearAt: 402 },
                       { id: 'b', type: 'bos', price: 1, from: 410, at: 700, dir: 'up', appearAt: 700 }], base, rolled);
    var at = O.indexer(base, rolled);
    eq([m[0].stateAt, m[0].endAt, m[1].at], [at(500), at(600), at(700)]);
  });

  // ------------------------------------------------------------------ annotate.confluence

  function s01(seed) { return TJR.scenarios.safeBuild(TJR.scenarios.get('S01'), seed || 7, {}); }

  test('annotate.confluence: no overlay is returned before the bar where it becomes knowable (S01 seed 7, every k)', () => {
    var b = s01(7), n = b.candles.length, total = 0, types = {};
    for (var k = 0; k < n; k++) {
      var list = TJR.annotate.confluence(b, { upTo: k });
      list.forEach(function (o) {
        total++; types[o.type] = true;
        ok(typeof o.appearAt === 'number', o.id + ' carries appearAt');
        ok(o.appearAt <= k, k + ': ' + o.id + ' appears at ' + o.appearAt);
        ['to', 'from', 'at', 'stateAt', 'endAt'].forEach(function (f) {
          if (o[f] != null) ok(o[f] <= k, k + ': ' + o.id + '.' + f + '=' + o[f] + ' is in the future');
        });
      });
    }
    ok(total > 0 && types.fvg && types.bos && types.eq && types.band, 'every kind shows up somewhere: ' + Object.keys(types));
  });

  test('annotate.confluence: gap states are as known at upTo (open until their stateAt, never a later one)', () => {
    [7, 11].forEach(function (seed) {
      var b = s01(seed), n = b.candles.length;
      for (var k = 0; k < n; k++) {
        var asOf = {};
        TJR.confluence.fvgs(b.candles.slice(0, k + 1)).forEach(function (g) { asOf['fvg:' + g.i] = g; });
        var got = TJR.annotate.confluence(b, { upTo: k }).filter(function (o) { return o.type === 'fvg'; });
        eq(got.map(function (o) { return o.id; }), Object.keys(asOf), 'seed ' + seed + ' k ' + k + ': the gaps known at k');
        got.forEach(function (o) {
          var g = asOf[o.id];
          eq([o.state, o.stateAt == null ? null : o.stateAt, o.endAt == null ? null : o.endAt], [g.state, g.stateAt, g.deletedAt],
             'seed ' + seed + ' k ' + k + ': ' + o.id);
          if (o.stateAt == null) eq(o.state, 'open', 'open until it has a stateAt');
        });
      }
    });
  });

  test('annotate.confluence: shapes carry the detector fields (fvg, bos, eq, band)', () => {
    var b = s01(7), cs = b.candles, C = TJR.confluence, list = TJR.annotate.confluence(b, {});
    var g = C.fvgs(cs)[0], o = list.filter(function (x) { return x.id === 'fvg:' + g.i; })[0];
    eq([o.type, o.from, o.to, o.low, o.high, o.dir, o.appearAt], ['fvg', g.from, g.to, g.low, g.high, g.dir, g.to]);
    var e = C.bos(cs)[0], bo = list.filter(function (x) { return x.type === 'bos'; })[0];
    eq([bo.price, bo.from, bo.at, bo.dir, bo.appearAt], [e.level.price, e.level.i, e.at, e.dir, e.at]);
    var eqs = list.filter(function (x) { return x.type === 'eq'; });
    ok(eqs.length > 0, 'an equilibrium box exists');
    eqs.forEach(function (x) {
      var r = C.eqRange(cs, { at: x.appearAt, dir: x.dir });
      ok(r && r.knownAt === x.appearAt && r.from === x.from && r.to === x.to && r.low === x.low && r.high === x.high, 'eq ' + x.id + ' matches eqRange at its knownAt');
    });
    var bands = list.filter(function (x) { return x.type === 'band'; });
    ok(bands.length >= 2 && bands.some(function (x) { return /09:30.09:50 manipulation/.test(x.label); }), 'manipulation window band');
    bands.forEach(function (x) { ok(x.from <= x.to && x.to < cs.length, x.id); });
  });

  test('annotate.confluence: show flags switch each kind off', () => {
    var b = s01(7), all = TJR.annotate.confluence(b, {});
    ['fvg', 'bos', 'eq', 'windows'].forEach(function (k) {
      var show = { fvg: true, bos: true, eq: true, windows: true }; show[k] = false;
      var kind = k === 'windows' ? 'band' : k;
      var got = TJR.annotate.confluence(b, { show: show });
      ok(all.some(function (o) { return o.type === kind; }), kind + ' present by default');
      ok(!got.some(function (o) { return o.type === kind; }), kind + ' gone with show.' + k + '=false');
      eq(got.length, all.filter(function (o) { return o.type !== kind; }).length, 'the other kinds are untouched');
    });
  });

  test('annotate.confluence: overlay ids are unique and the input is not mutated', () => {
    var b = s01(7), before = JSON.stringify(b.candles);
    var list = TJR.annotate.confluence(b, {});
    eq(new Set(list.map(function (o) { return o.id; })).size, list.length);
    eq(JSON.stringify(b.candles), before);
  });
})();
