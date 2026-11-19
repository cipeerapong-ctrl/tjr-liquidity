/* Chart engine tests (Task 7). The Node vm has no DOM: every browser API the engine touches inside
   TJR.chart.create is stubbed here, installed per test and restored afterwards, so the other test files
   see an untouched global scope. Wrapped in an IIFE (all test files share one vm global scope). */
(function () {
  'use strict';

  var STUB_KEYS = ['document', 'requestAnimationFrame', 'cancelAnimationFrame', 'ResizeObserver',
    'IntersectionObserver', 'matchMedia', 'getComputedStyle', 'devicePixelRatio', 'performance',
    'addEventListener', 'removeEventListener'];

  // A fake 2D context: every method is a no-op, measureText is 6 px per character.
  function fakeCtx() {
    var t = {
      measureText: function (s) { return { width: String(s).length * 6 }; },
      createLinearGradient: function () { return { addColorStop: function () {} }; },
      getLineDash: function () { return []; }
    };
    return new Proxy(t, {
      get: function (o, k) { return k in o ? o[k] : function () {}; },
      set: function (o, k, v) { o[k] = v; return true; }
    });
  }

  // Install the fake browser, run fn(env), restore the globals whatever happens.
  function withEnv(opts, fn) {
    opts = opts || {};
    var W = opts.w || 800, H = opts.h || 400;
    var saved = {};
    STUB_KEYS.forEach(function (k) { saved[k] = { has: k in window, v: window[k] }; });

    var regs = [];                       // live listener registrations {t, type, fn}
    var raf = new Map(), rafSeq = 0;
    var ros = [], ios = [];
    var clock = { now: 1000 };

    function target(name, extra) {
      var o = {
        _name: name,
        addEventListener: function (type, f) { regs.push({ t: o, type: type, fn: f }); },
        removeEventListener: function (type, f) {
          for (var i = regs.length - 1; i >= 0; i--) {
            if (regs[i].t === o && regs[i].type === type && regs[i].fn === f) { regs.splice(i, 1); return; }
          }
        }
      };
      Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; });
      return o;
    }

    var ctx = fakeCtx();
    function makeCanvas(name) {
      return target(name, {
        style: {}, width: 300, height: 150, parentNode: null,
        getContext: function () { return ctx; },
        getBoundingClientRect: function () { return { left: 0, top: 0, width: W, height: H }; },
        setPointerCapture: function () {}, releasePointerCapture: function () {}
      });
    }
    function makeEl(name) {
      var e = target(name, {
        style: {}, children: [], clientWidth: W, clientHeight: H,
        appendChild: function (c) { e.children.push(c); c.parentNode = e; return c; },
        removeChild: function (c) { e.children.splice(e.children.indexOf(c), 1); c.parentNode = null; return c; },
        getBoundingClientRect: function () { return { left: 0, top: 0, width: W, height: H }; }
      });
      return e;
    }
    var canvases = [makeCanvas('canvas'), makeCanvas('canvas2')], made = 0;     // one per chart created, in order
    var canvas = canvases[0], el = makeEl('el'), el2 = makeEl('el2');
    var mqls = [];

    function Observer(list) {
      return function (cb) {
        var me = { cb: cb, targets: [], live: true };
        this.observe = function (t) { me.targets.push(t); };
        this.unobserve = function (t) { me.targets.splice(me.targets.indexOf(t), 1); };
        this.disconnect = function () { me.targets = []; me.live = false; };
        list.push(me);
      };
    }

    window.document = { createElement: function (tag) { ok(tag === 'canvas', 'only canvases are created'); return canvases[made++ % canvases.length]; } };
    window.requestAnimationFrame = function (cb) { var id = ++rafSeq; raf.set(id, cb); return id; };
    window.cancelAnimationFrame = function (id) { raf.delete(id); };
    window.ResizeObserver = Observer(ros);
    window.IntersectionObserver = Observer(ios);
    window.matchMedia = function (q) {
      var m = target('mql', { matches: !!opts.reduced && /reduce/.test(q), media: q });
      mqls.push(m);
      return m;
    };
    window.getComputedStyle = function () {
      return { position: 'relative', getPropertyValue: function (k) { return (opts.vars || {})[k] || ''; } };
    };
    window.devicePixelRatio = 2;
    window.performance = { now: function () { return clock.now; } };
    var win = target('window');
    window.addEventListener = win.addEventListener;
    window.removeEventListener = win.removeEventListener;

    var env = {
      el: el, el2: el2, canvas: canvas, canvas2: canvases[1], ctx: ctx, regs: regs, ros: ros, ios: ios, clock: clock, mqls: mqls,
      pending: function () { return raf.size; },
      // run every scheduled frame once, at clock + dt
      frame: function (dt) {
        clock.now += dt == null ? 16 : dt;
        var cbs = Array.from(raf.values());
        raf.clear();
        cbs.forEach(function (cb) { cb(clock.now); });
      },
      fire: function (type, ev, which) {
        var e = Object.assign({ pointerId: 1, pointerType: 'mouse', button: 0, preventDefault: function () {} }, ev);
        var on = which || canvas;
        regs.filter(function (r) { return r.t === on && r.type === type; }).forEach(function (r) { r.fn(e); });
      },
      setVisible: function (v) {
        ios.forEach(function (o) { if (o.live) o.cb(o.targets.map(function (t) { return { target: t, isIntersecting: v }; })); });
      }
    };
    try { fn(env); }
    finally {
      STUB_KEYS.forEach(function (k) { if (saved[k].has) window[k] = saved[k].v; else delete window[k]; });
    }
  }

  function build(id, seed) { return TJR.scenarios.safeBuild(TJR.scenarios.get(id), seed || 3, {}); }

  var NICE = [0.25, 0.5, 1, 2.5, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

  // ------------------------------------------------------------------ scale

  test('chart.scale.make round-trips bar(x(i)) and price(y(p)) at w=1200 and w=320', () => {
    var S = TJR.chart.scale;
    [1200, 320].forEach(function (w) {
      [[0, 305], [120, 200]].forEach(function (span) {
        var sc = S.make({ w: w, h: 400, padL: 0, padR: 62, padT: 26, padB: 40, from: span[0], to: span[1], min: 29950, max: 30060 });
        for (var i = span[0]; i <= span[1]; i++) eq(sc.bar(sc.x(i)), i, 'w=' + w + ' bar(x(' + i + '))');
        for (var p = 29950; p <= 30060; p += 0.25) near(sc.price(sc.y(p)), p, 1e-6, 'w=' + w + ' price(y(' + p + '))');
        var slot = (w - 62) / (span[1] - span[0] + 1);
        ok(sc.barW >= Math.min(1, slot) - 1e-9, 'w=' + w + ' barW >= 1 px when the slot allows, got ' + sc.barW);
        ok(sc.barW <= slot + 1e-9, 'w=' + w + ' body fits its slot');
        ok(sc.y(30060) < sc.y(29950), 'higher price is higher on screen');
        ok(sc.x(span[0]) >= 0 && sc.x(span[1]) <= w - 62, 'bars stay inside the plot');
      });
    });
  });

  test('chart.scale.make survives a flat price range', () => {
    var sc = TJR.chart.scale.make({ w: 320, h: 200, padL: 0, padR: 0, padT: 0, padB: 0, from: 0, to: 0, min: 7500, max: 7500 });
    ok(isFinite(sc.y(7500)) && isFinite(sc.price(100)), 'finite coordinates');
    eq(sc.bar(sc.x(0)), 0);
  });

  test('chart.scale.ticks(29950, 30060, 6) gives ascending nice values inside the range', () => {
    var t = TJR.chart.scale.ticks(29950, 30060, 6);
    ok(t.length >= 2 && t.length <= 7, 'about 6 ticks, got ' + t.length);
    for (var i = 0; i < t.length; i++) {
      ok(t[i] >= 29950 && t[i] <= 30060, 'tick ' + t[i] + ' inside the range');
      if (i) ok(t[i] > t[i - 1], 'ascending');
    }
    var step = t[1] - t[0];
    ok(NICE.indexOf(step) >= 0, 'nice step, got ' + step);
    t.forEach(function (v, k) { if (k) near(v - t[k - 1], step, 1e-9, 'even spacing'); near(v / step, Math.round(v / step), 1e-9, 'multiple of step'); });
    var small = TJR.chart.scale.ticks(7500, 7502, 5);
    ok(small.length >= 2, 'small range still ticks');
    small.forEach(function (v) { near(v * 4, Math.round(v * 4), 1e-9, 'on 0.25 tick: ' + v); });
  });

  // ------------------------------------------------------------------ axis labels at phone widths

  test('chart.render axis labels never overlap at 390 and 320 px', () => {
    var R = TJR.chart.render, S = TJR.chart.scale;
    var measure = function (s) { return String(s).length * 6; };
    ['S06', 'S10'].forEach(function (id) {
      var b = build(id), cs = b.candles;
      [390, 320].forEach(function (w) {
        var padR = 62, sc = S.make({ w: w, h: 260, padL: 0, padR: padR, padT: 26, padB: 40, from: 0, to: cs.length - 1, min: 29000, max: 31000 });
        var labs = R.timeLabels(cs, 0, cs.length - 1, sc, b.meta.tf, measure, 0, w - padR);
        ok(labs.length >= 2, id + ' w=' + w + ': at least 2 time labels, got ' + labs.length);
        labs.forEach(function (l, k) {
          ok(l.x - l.w / 2 >= 0 && l.x + l.w / 2 <= w - padR, id + ' w=' + w + ': label ' + l.text + ' inside the plot');
          if (k) ok(l.x - l.w / 2 >= labs[k - 1].x + labs[k - 1].w / 2 + 6, id + ' w=' + w + ': ' + labs[k - 1].text + ' / ' + l.text + ' overlap');
        });
        var pl = R.priceLabels(sc, 29000, 31000, 10, 220);
        ok(pl.length >= 2, 'at least 2 price labels');
        pl.forEach(function (l, k) { if (k) ok(Math.abs(l.y - pl[k - 1].y) >= 18, 'price labels ' + pl[k - 1].text + ' / ' + l.text + ' too close'); });
      });
    });
  });

  test('chart.render daily labels name the trading day (a bar opening 18:00 ET belongs to the next date)', () => {
    var b = build('S05'), cs = b.candles, R = TJR.chart.render;
    var sc = TJR.chart.scale.make({ w: 1200, h: 300, padL: 0, padR: 62, padT: 26, padB: 40, from: 0, to: cs.length - 1, min: 0, max: 1 });
    var labs = R.timeLabels(cs, 0, cs.length - 1, sc, 1440, function (s) { return String(s).length * 6; }, 0, 1200 - 62);
    ok(labs.length >= 2, 'daily labels drawn');
    labs.forEach(function (l) {
      var e = TJR.sessions.toET(cs[l.i].t + 6 * 3600);
      eq(l.text, e.d + '/' + e.mo, 'bar ' + l.i);
    });
  });

  // ------------------------------------------------------------------ overlays

  test('chart.overlays: appearAt hides an overlay until its bar is revealed', () => {
    var O = TJR.chart.overlays;
    ok(O.isVisible({ type: 'level', price: 1, appearAt: 50 }, 50), 'visible at its bar');
    ok(!O.isVisible({ type: 'level', price: 1, appearAt: 50 }, 49), 'hidden before');
    ok(O.isVisible({ type: 'box', from: 0, to: 3, low: 1, high: 2 }, 0), 'no appearAt = always');
    ok(!O.isVisible({ type: 'label', bar: 30, price: 1, text: 'H', pos: 'above' }, 20), 'a label on a future bar is hidden');
  });

  test('chart.overlays.mapBars moves every bar field onto the rolled-up series by candle time', () => {
    var b = build('S10'), base = b.candles, ov = TJR.annotate(b, {});
    var rolled = TJR.gen.rollup(base, 5, 240);
    var mapped = TJR.chart.overlays.mapBars(ov, base, rolled);
    eq(mapped.length, ov.length);
    function holds(j, baseBar) {
      return rolled[j].t <= base[baseBar].t && (j === rolled.length - 1 || base[baseBar].t < rolled[j + 1].t);
    }
    ov.forEach(function (o, k) {
      var m = mapped[k];
      eq(m.id, o.id);
      ['from', 'to', 'bar', 'appearAt'].forEach(function (f) {
        if (o[f] != null) ok(holds(m[f], o[f]), o.id + '.' + f + ' ' + o[f] + ' -> ' + m[f]);
      });
      if (o.type === 'trend') { ok(holds(m.a.bar, o.a.bar), 'trend a'); ok(holds(m.b.bar, o.b.bar), 'trend b'); }
      if (o.price != null) eq(m.price, o.price);
    });
    ok(ov[0].from !== mapped[0].from || ov[0].to !== mapped[0].to, 'originals untouched, copies mapped');
  });

  // ------------------------------------------------------------------ chart: loop, listeners, playback

  test('chart.play() called twice keeps one rAF loop; pause lets it stop', () => {
    withEnv({}, function (env) {
      var ch = TJR.chart.create(env.el, {});
      var b = build('S01');
      ch.setData(b);
      ch.play({ from: 10, to: 60, barsPerSec: 6 });
      ch.play({ from: 10, to: 60, barsPerSec: 6 });
      eq(env.pending(), 1, 'one scheduled frame after two play() calls');
      env.frame(16); env.frame(100); env.frame(100);
      eq(env.pending(), 1, 'still exactly one loop while playing');
      ok(ch.info().revealed > 10 && ch.info().playing, 'bars advance');
      ch.pause();
      for (var i = 0; i < 40; i++) env.frame(50);
      eq(env.pending(), 0, 'loop stops once idle');
      ch.destroy();
    });
  });

  test('chart.play() reveals one bar per 1/barsPerSec and calls onBar in order', () => {
    withEnv({}, function (env) {
      var ch = TJR.chart.create(env.el, {}), seen = [];
      ch.setData(build('S01'));
      ch.play({ from: 20, to: 25, barsPerSec: 10, onBar: function (i) { seen.push(i); } });
      eq(ch.info().revealed, 20);
      for (var i = 0; i < 12; i++) env.frame(50);
      eq(seen, [20, 21, 22, 23, 24, 25]);
      eq(ch.info().revealed, 25);
      ok(!ch.info().playing, 'stopped at to');
      ch.destroy();
    });
  });

  test('chart: overlays with appearAt after the revealed bar are not drawn, then draw in during play', () => {
    withEnv({}, function (env) {
      var ch = TJR.chart.create(env.el, {});
      ch.setData(build('S01'));
      ch.setOverlays([{ id: 'a', type: 'level', price: 29150, from: 5, label: 'x', kind: 'liq', state: 'active', appearAt: 30 },
                      { id: 'b', type: 'marker', bar: 12, price: 29150, shape: 'dot' }]);
      ch.reveal(20);
      eq(ch.info().visible, ['b']);
      ch.play({ from: 20, to: 40, barsPerSec: 20 });
      for (var i = 0; i < 12; i++) env.frame(50);
      eq(ch.info().visible, ['a', 'b']);
      ok(ch.info().animating.indexOf('a') >= 0, 'a draws in');
      for (var j = 0; j < 30; j++) env.frame(50);
      eq(ch.info().animating, [], 'draw-in done after 400 ms');
      ch.destroy();
    });
  });

  test('chart: prefers-reduced-motion jumps play() to the final state with no tweens', () => {
    withEnv({ reduced: true }, function (env) {
      var ch = TJR.chart.create(env.el, {}), seen = [];
      ch.setData(build('S01'));
      ch.setOverlays(TJR.annotate(build('S01'), {}));
      ch.reveal(5);
      ch.play({ from: 5, to: 80, onBar: function (i) { seen.push(i); } });
      eq(ch.info().revealed, 80, 'final bar at once');
      ok(!ch.info().playing, 'nothing left playing');
      eq(seen[seen.length - 1], 80);
      ch.flash('T');
      eq(ch.info().animating, [], 'no tweens');
      for (var i = 0; i < 3; i++) env.frame(16);
      eq(env.pending(), 0, 'no loop left running');
      ch.destroy();
    });
  });

  test('chart.destroy() removes every listener, observer, frame and the canvas', () => {
    withEnv({}, function (env) {
      var ch = TJR.chart.create(env.el, { interactive: true, crosshair: true });
      ch.setData(build('S06'));
      ch.on('click', function () {}); ch.on('hover', function () {}); ch.on('drag', function () {});
      ch.addLine({ id: 'L', price: 29120, label: 'Asia high', draggable: true });
      ch.play({ to: 200 });
      ok(env.regs.length > 0, 'listeners were added');
      ch.destroy();
      eq(env.regs.map(function (r) { return r.t._name + ':' + r.type; }), [], 'listeners left after destroy');
      eq(env.pending(), 0, 'no frame scheduled');
      ok(env.ros.every(function (o) { return !o.live; }) && env.ios.every(function (o) { return !o.live; }), 'observers disconnected');
      eq(env.el.children.length, 0, 'canvas removed');
      ch.destroy();   // twice is harmless
    });
  });

  test('chart: off-screen pauses the loop, back on screen resumes it', () => {
    withEnv({}, function (env) {
      var ch = TJR.chart.create(env.el, {});
      ch.setData(build('S01'));
      ch.play({ from: 10, to: 80, barsPerSec: 6 });
      env.setVisible(false);
      eq(env.pending(), 0, 'no frame while off-screen');
      var r = ch.info().revealed;
      env.setVisible(true);
      eq(env.pending(), 1, 'one frame on return');
      env.frame(16);
      ok(ch.info().playing && ch.info().revealed >= r, 'playback resumed');
      ch.destroy();
    });
  });

  test('chart: the revealed bar stays on screen at phone width (replay from an early bar)', () => {
    withEnv({ w: 390, h: 280 }, function (env) {
      var ch = TJR.chart.create(env.el, {});
      ch.setData(build('S06'));
      ok(ch.info().view.from > 45, 'phone fit starts after bar 45 (precondition)');
      ch.reveal(45);
      var v = ch.info().view;
      ok(v.from <= 45 && 45 <= v.to - 2, 'bar 45 inside view ' + v.from + '..' + v.to);
      ch.play({ from: 10, to: 300, barsPerSec: 60 });
      for (var i = 0; i < 80; i++) {
        env.frame(100);
        var w = ch.info().view, r = ch.info().revealed;
        if (!(w.from <= r && r <= w.to)) throw new Error('revealed ' + r + ' outside view ' + w.from + '..' + w.to);
      }
      ch.destroy();
    });
  });

  test('chart fit: the right margin is 4% of the bars on screen, not of all bars (phone, 1080-bar chart)', () => {
    withEnv({ w: 358, h: 280 }, function (env) {
      var ch = TJR.chart.create(env.el, {});
      var b = build('S09');
      ch.setData(b);
      var v = ch.info().view, slots = Math.floor((358 - 70) / 1.5), n = b.candles.length;
      eq(v.to - v.from + 1, slots, 'the view holds every slot the phone has');
      ok(v.to - (n - 1) <= Math.round(slots * 0.04), 'margin ' + (v.to - (n - 1)) + ' bars');
      ch.destroy();
    });
  });

  test('chart created in a hidden host waits for a real size and never pins its height', () => {
    withEnv({ w: 800, h: 400 }, function (env) {
      env.el.clientWidth = 0; env.el.clientHeight = 0;          // display:none parent
      var ch = TJR.chart.create(env.el, {});
      ch.setData(build('S01'));
      eq(env.el.style.height, undefined, 'no inline height while hidden');
      env.el.clientWidth = 800; env.el.clientHeight = 400;      // shown: ResizeObserver -> resize()
      ch.resize();
      eq([ch.info().width, ch.info().height], [800, 400]);
      eq(env.el.style.height, undefined, 'host keeps its own CSS height');
      env.el.clientWidth = 390; env.el.clientHeight = 0;        // a host with no height of its own
      ch.resize();
      ok(ch.info().height >= 220 && env.el.style.height === ch.info().height + 'px', 'auto height from width');
      ch.destroy();
      eq(env.el.style.height, '', 'auto height removed on destroy');
    });
  });

  test('chart.setTimeframe rolls up and maps overlays by time; back to base restores them', () => {
    withEnv({}, function (env) {
      var b = build('S10'), ov = TJR.annotate(b, {});
      var ch = TJR.chart.create(env.el, {});
      ch.setData(b);
      ch.setOverlays(ov);
      ch.setTimeframe(240);
      var info = ch.info();
      eq(info.tf, 240);
      eq(info.bars, TJR.gen.rollup(b.candles, 5, 240).length);
      eq(info.revealed, info.bars - 1);
      var sweep = info.overlays.filter(function (o) { return o.id === 'sweep'; })[0];
      var rolled = TJR.gen.rollup(b.candles, 5, 240);
      ok(rolled[sweep.bar].t <= b.candles[ov.filter(function (o) { return o.id === 'sweep'; })[0].bar].t, 'sweep bucket starts at or before the sweep');
      ch.setTimeframe(15);
      eq(ch.info().bars, TJR.gen.rollup(b.candles, 5, 15).length);
      ch.setTimeframe(5);
      eq(ch.info().bars, b.candles.length);
      eq(ch.info().overlays, ov, 'base timeframe = overlays as given');
      ch.destroy();
    });
  });

  // A rolled-up bar that is only partly revealed (TF switched mid-replay) must not show anything its
  // unrevealed base bars hold: overlays, swept states and the price range are judged by base bar.
  function s10At742(tf, overlays) {
    var b = build('S10'), out = {};
    withEnv({}, function (env) {
      var ch = TJR.chart.create(env.el, {});
      ch.setData(b);
      ch.setOverlays(overlays || TJR.annotate(b, {}));
      ch.reveal(742);
      out.base = ch.info();
      ch.setTimeframe(tf);
      out.rolled = ch.info();
      ch.step(1);
      out.stepped = ch.info();
      ch.destroy();
    });
    return out;
  }

  test('chart.setTimeframe mid-bucket shows no overlay or sweep the revealed base bars do not hold', () => {
    var b = build('S10'), ov = TJR.annotate(b, {});
    var sweepBar = ov.filter(function (o) { return o.id === 'sweep'; })[0].bar;
    eq(sweepBar, 743, 'S10 seed 3 sweeps at base bar 743');
    var at = TJR.chart.overlays.indexer(b.candles, TJR.gen.rollup(b.candles, 5, 15));
    eq(at(743), at(742), 'precondition: 742 and 743 share one 15m bar');
    var r = s10At742(15);
    ok(r.base.visible.indexOf('sweep') < 0 && r.base.swept.length === 0, '5m at 742: no sweep yet');
    eq(r.rolled.visible.slice().sort(), r.base.visible.slice().sort(), '15m shows exactly what 5m showed at bar 742');
    eq(r.rolled.swept, [], 'no level drawn swept before its sweep bar');
  });

  test('chart: the price range of a partly revealed rolled-up bar ignores overlays still in the future', () => {
    // S10's sweep high equals an earlier high, so add a marker in the unrevealed part of the same 15m bar,
    // priced far outside everything known at bar 742
    var b = build('S10');
    var all = TJR.annotate(b, {}).concat([{ id: 'future', type: 'marker', bar: 743, price: 30800, shape: 'dot', appearAt: 743 }]);
    var known = all.filter(function (o) { return TJR.chart.overlays.isVisible(o, 742); });
    var withAll = s10At742(15, all).rolled.priceRange, withKnown = s10At742(15, known).rolled.priceRange;
    ok(withAll && isFinite(withAll.lo) && isFinite(withAll.hi), 'info().priceRange is reported');
    eq(withAll, withKnown, 'future overlays must not widen the range');
  });

  test('chart: stepping past the sweep at 15m still draws the sweep in and flashes the swept levels', () => {
    var r = s10At742(15);
    ['Q1', 'Q2', 'Q3'].forEach(function (id) {
      ok(r.stepped.swept.indexOf(id) >= 0, id + ' swept after the step');
      ok(r.stepped.animating.indexOf(id) >= 0, id + ' flashes (it was already on screen, so this is the flash)');
    });
    ok(r.stepped.visible.indexOf('sweep') >= 0 && r.stepped.animating.indexOf('sweep') >= 0, 'sweep marker draws in');
  });

  test('chart: a draggable line moves with the pointer and reports drag; a tap reports click', () => {
    withEnv({ w: 390, h: 300 }, function (env) {
      var ch = TJR.chart.create(env.el, {}), drags = [], clicks = [], b = build('S06');
      ch.setData(b);
      ch.on('drag', function (e) { drags.push(e); });
      ch.on('click', function (e) { clicks.push(e); });
      ch.addLine({ id: 'asia-high', price: 29130, label: 'Asia high', draggable: true });
      env.frame(16);
      var v = ch.info().view, b0 = v.from + 40, b1 = v.from + 90;
      ok(b1 < b.candles.length, 'test bars inside the data');
      var p0 = ch.coords(b0, 29130);
      env.fire('pointerdown', { clientX: p0.x, clientY: p0.y });
      env.fire('pointermove', { clientX: p0.x, clientY: p0.y - 30 });
      env.fire('pointerup', { clientX: p0.x, clientY: p0.y - 30 });
      ok(ch.getLine('asia-high') > 29130, 'line moved up, got ' + ch.getLine('asia-high'));
      near(ch.getLine('asia-high') * 4, Math.round(ch.getLine('asia-high') * 4), 1e-9, 'on tick');
      ok(drags.length >= 2 && drags[drags.length - 1].done && drags[0].id === 'asia-high', 'drag events');
      eq(clicks.length, 0, 'a drag is not a click');
      var q = ch.coords(b1, 29100);
      env.fire('pointerdown', { clientX: q.x, clientY: q.y });
      env.fire('pointerup', { clientX: q.x, clientY: q.y + 1 });     // a tap may wobble a pixel
      eq(clicks.length, 1);
      eq(clicks[0].i, b1);
      near(clicks[0].price, 29100, 1, 'click price');
      eq(clicks[0].candle, b.candles[b1], 'click carries its candle');
      ch.destroy();
    });
  });

  // ------------------------------------------------------------------ twin chart

  function twinOf(env, opts) {
    var tw = TJR.chart.twin(env.el, env.el2, opts || {});
    tw.setData(build('S01'), build('S01', 5));
    return tw;
  }

  test('chart.twin: reveal(30) reveals both charts and they share one view', () => {
    withEnv({}, function (env) {
      var tw = twinOf(env);
      tw.reveal(30);
      eq([tw.a.info().revealed, tw.b.info().revealed], [30, 30]);
      eq(tw.b.info().view, tw.a.info().view, 'same bars on screen');
      tw.reveal(60);
      eq([tw.a.info().revealed, tw.b.info().revealed], [60, 60]);
      eq(tw.b.info().view, tw.a.info().view);
      tw.destroy();
    });
  });

  test('chart.twin: play() walks both charts together, onBar is called once per bar, the promise resolves', () => {
    withEnv({}, function (env) {
      var tw = twinOf(env), seen = [], done = false;
      tw.play({ from: 20, to: 25, barsPerSec: 10, onBar: function (i) { seen.push(i); } }).then(function () { done = true; });
      eq([tw.a.info().revealed, tw.b.info().revealed], [20, 20]);
      for (var i = 0; i < 12; i++) {
        env.frame(50);
        eq(tw.b.info().revealed, tw.a.info().revealed, 'twin follows bar for bar');
      }
      eq(seen, [20, 21, 22, 23, 24, 25]);
      eq([tw.a.info().revealed, tw.b.info().revealed], [25, 25]);
      tw.destroy();
    });
  });

  test('chart.twin: prefers-reduced-motion jumps both to the last bar', () => {
    withEnv({ reduced: true }, function (env) {
      var tw = twinOf(env);
      tw.reveal(5);
      tw.play({ from: 5, to: 80 });
      eq([tw.a.info().revealed, tw.b.info().revealed], [80, 80]);
      tw.destroy();
    });
  });

  test('chart.twin: the crosshair bar is shared in both directions and clears on leave', () => {
    withEnv({ w: 800, h: 400 }, function (env) {
      var PX = build('S01').candles[40].c;
      var tw = twinOf(env);
      env.frame(16);
      var p = tw.a.coords(tw.a.info().view.from + 30, PX);
      env.fire('pointermove', { clientX: p.x, clientY: p.y });
      var i = tw.b.info().crosshair;
      ok(Number.isInteger(i) && i >= 0, 'b shows the crosshair bar, got ' + i);
      eq(i, tw.a.at(p.x, p.y).i, 'the bar under the pointer on a');
      env.fire('pointerleave', {});
      eq(tw.b.info().crosshair, null, 'cleared when the pointer leaves');
      var q = tw.b.coords(tw.b.info().view.from + 12, build('S01', 5).candles[40].c);
      env.fire('pointermove', { clientX: q.x, clientY: q.y }, env.canvas2);
      eq(tw.a.info().crosshair, tw.b.at(q.x, q.y).i, 'and from b to a');
      tw.destroy();
    });
  });

  test('chart.twin.destroy() removes every listener and observer of both charts, twice is harmless', () => {
    withEnv({}, function (env) {
      var tw = twinOf(env, { interactive: true, crosshair: true });
      tw.a.on('click', function () {}); tw.b.on('hover', function () {});
      tw.play({ to: 200 });
      ok(env.regs.length > 0, 'listeners were added');
      tw.destroy();
      eq(env.regs.map(function (r) { return r.t._name + ':' + r.type; }), [], 'listeners left after destroy');
      eq(env.pending(), 0, 'no frame scheduled');
      ok(env.ros.every(function (o) { return !o.live; }) && env.ios.every(function (o) { return !o.live; }), 'observers disconnected');
      eq([env.el.children.length, env.el2.children.length], [0, 0], 'both canvases removed');
      tw.destroy();
    });
  });

  test('chart.twin.destroy() also cleans up without ResizeObserver (window resize listener path)', () => {
    withEnv({}, function (env) {
      window.ResizeObserver = undefined;
      var tw = twinOf(env);
      ok(env.regs.some(function (r) { return r.t._name === 'window' && r.type === 'resize'; }), 'a window resize listener is in use');
      tw.destroy();
      eq(env.regs.map(function (r) { return r.t._name + ':' + r.type; }), [], 'listeners left after destroy');
    });
  });

  test('site.css stacks .twin vertically below 768px and lays it out in two columns above', () => {
    var css = readText('assets/css/site.css');
    ok(/\.twin\s*\{[^}]*grid-template-columns:\s*repeat\(2/.test(css), 'two columns by default');
    var m = /@media\s*\(max-width:\s*767px\)\s*\{(?:[^{}]|\{[^}]*\})*\.twin\s*\{[^}]*grid-template-columns:\s*1fr[;\s}]/.exec(css);
    ok(m, 'a max-width: 767px rule gives .twin one column');
  });
})();
