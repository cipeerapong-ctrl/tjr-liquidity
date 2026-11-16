/* TJR.chart.create(el, opts) -> Chart. One canvas per chart, DPR-aware, sized to el (ResizeObserver).
   One requestAnimationFrame loop per chart: scheduled only when something changed or is moving
   (playback, draw-in, flash, price-range easing), never while the chart is off-screen
   (IntersectionObserver). prefers-reduced-motion: no tweens, play() jumps to its last bar, nothing hidden.
   Nothing here touches the DOM until create() is called, so the file loads in Node.

   Bars: the series on screen may be a roll-up of the base candles (setTimeframe). Overlays and every
   index a page passes in setOverlays/addOverlay are BASE bar indices (as TJR.annotate emits them); the
   engine maps them by candle time. reveal/step/play/view/coords and event payloads use indices of the
   series on screen (identical to base indices while tf is the base timeframe); click/hover payloads also
   carry baseFrom/baseTo, the base bars inside the clicked bar. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var chart = TJR.chart = TJR.chart || {};

  var MIN_SLOT = 1.5;               // fit() never squeezes bars below this many px per bar
  var EVENTS = ['click', 'hover', 'drag'];

  function now() { var p = global.performance; return p && p.now ? p.now() : Date.now(); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function create(el, opts) {
    opts = opts || {};
    var R = chart.render, O = chart.overlays, S = chart.scale, U = TJR.util, copy = O.copy;
    var interactive = opts.interactive !== false, crosshairOn = opts.crosshair !== false;
    var axes = opts.axes !== false, readoutOn = opts.readout !== false;

    var canvas = global.document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var regs = [], seq = 0;
    function listen(t, type, fn, o) { t.addEventListener(type, fn, o); regs.push([t, type, fn, o]); }

    var st = {
      base: [], series: [], meta: {}, baseTf: 5, tf: 5, tick: 0.25, at: function (b) { return b; },
      rev: -1, partial: null, partialEnd: -1,
      view: { from: 0, to: 0 }, viewSet: false,
      src: [], ov: [], lines: [], shown: {}, sweptSeen: {}, anims: {},
      range: null, w: 0, h: 0, dpr: 1, fs: 11, th: R.readTheme(el, opts.theme),
      hover: null, drag: null, down: null, play: null,
      raf: null, lastTs: null, visible: true, reduced: false, dead: false,
      handlers: { click: [], hover: [], drag: [] }
    };

    // ---------------------------------------------------------------- host element + canvas
    var restore = { position: null, height: null }, autoH = false;
    try {
      if (global.getComputedStyle && global.getComputedStyle(el).position === 'static') {
        restore.position = el.style.position || '';
        el.style.position = 'relative';
      }
    } catch (e) { /* no computed style: leave el alone */ }
    var cs = canvas.style;
    cs.position = 'absolute'; cs.left = '0'; cs.top = '0'; cs.display = 'block';
    cs.touchAction = 'pan-y'; cs.userSelect = 'none'; cs.webkitTapHighlightColor = 'transparent';
    if (opts.label) canvas.setAttribute && canvas.setAttribute('aria-label', opts.label);
    canvas.setAttribute && canvas.setAttribute('role', 'img');
    el.appendChild(canvas);

    // ---------------------------------------------------------------- reduced motion
    var mql = null, mqlLegacy = null;
    function onMotionPref() {
      st.reduced = !!(mql && mql.matches);
      if (st.reduced) { st.anims = {}; if (st.play) finishNow(st.play); invalidate(); }
    }
    if (global.matchMedia) {
      mql = global.matchMedia('(prefers-reduced-motion: reduce)');
      st.reduced = !!(mql && mql.matches);
      if (mql && mql.addEventListener) listen(mql, 'change', onMotionPref);
      else if (mql && mql.addListener) { mql.addListener(onMotionPref); mqlLegacy = onMotionPref; }
    }

    // ---------------------------------------------------------------- observers
    var ro = null, io = null;
    if (global.ResizeObserver) { ro = new global.ResizeObserver(function () { resize(); }); ro.observe(el); }
    else listen(global, 'resize', function () { resize(); });
    if (global.IntersectionObserver) {
      io = new global.IntersectionObserver(function (entries) {
        var e = entries[entries.length - 1];
        if (!e) return;
        st.visible = !!e.isIntersecting;
        if (st.visible) schedule();
        else { if (st.raf != null && global.cancelAnimationFrame) global.cancelAnimationFrame(st.raf); st.raf = null; st.lastTs = null; }
      });
      io.observe(el);
    }

    // ---------------------------------------------------------------- frame loop
    function schedule() {
      if (st.dead || st.raf != null || !st.visible) return;
      if (global.requestAnimationFrame) st.raf = global.requestAnimationFrame(frame);
      else draw(now());
    }
    function invalidate() { schedule(); }

    function frame(ts) {
      st.raf = null;
      if (st.dead) return;
      var dt = st.lastTs == null ? 16 : clamp(ts - st.lastTs, 0, 100);
      st.lastTs = ts;
      if (st.play) advance(dt);
      easeRange(dt);
      for (var id in st.anims) {
        var a = st.anims[id];
        if (a.inT0 != null && ts - a.inT0 >= O.DRAW_IN) a.inT0 = null;
        if (a.flT0 != null && ts - a.flT0 >= O.FLASH) a.flT0 = null;
        if (a.inT0 == null && a.flT0 == null) delete st.anims[id];
      }
      draw(ts);
      if (st.play || Object.keys(st.anims).length || !rangeSettled()) schedule();
      else st.lastTs = null;
    }

    // ---------------------------------------------------------------- data helpers
    function n() { return st.series.length; }
    function get(i) { return i === st.rev && st.partial ? st.partial : st.series[i]; }
    function firstBase(j) {                                // first base index inside series bar j
      if (st.series === st.base) return j;
      var t = st.series[j].t, lo = 0, hi = st.base.length - 1;
      while (lo < hi) { var m = (lo + hi) >> 1; if (st.base[m].t >= t) hi = m; else lo = m + 1; }
      return lo;
    }
    function lastBase(j) { return st.series === st.base ? j : j + 1 < n() ? firstBase(j + 1) - 1 : st.base.length - 1; }
    function baseRevealed() { return st.partial ? st.partialEnd : lastBase(Math.max(0, st.rev)); }

    // Visibility and swept state of a mapped overlay. While the last bar on screen is a partly revealed
    // roll-up (TF switched mid-replay), the mapped indices cannot tell the known part of that bar from the
    // rest, so the overlay is judged by its source (base) indices against the last revealed base bar.
    var srcOf = new Map();                                 // mapped overlay -> source overlay (base indices)
    function visible(m) {
      if (!O.isVisible(m, st.rev)) return false;
      return !st.partial || O.isVisible(srcOf.get(m) || m, st.partialEnd);
    }
    function swept(m) {
      return st.partial ? O.isSwept(srcOf.get(m) || m, st.partialEnd) : O.isSwept(m, st.rev);
    }

    // ---------------------------------------------------------------- price range + layout
    function targetRange() {
      var lo = Infinity, hi = -Infinity, a = Math.max(0, st.view.from), b = Math.min(st.view.to, st.rev);
      for (var i = a; i <= b; i++) { var k = get(i); if (k.l < lo) lo = k.l; if (k.h > hi) hi = k.h; }
      st.ov.forEach(function (o) {
        if (!visible(o)) return;
        [o.price, o.low, o.high, o.a && o.a.price, o.b && o.b.price].forEach(function (p) {
          if (typeof p === 'number' && isFinite(p)) { if (p < lo) lo = p; if (p > hi) hi = p; }
        });
      });
      if (!(hi >= lo)) return { lo: 0, hi: 1 };
      var mid = (lo + hi) / 2, span = Math.max(hi - lo, Math.abs(mid) * 0.0012, 8 * st.tick);
      return { lo: mid - span / 2 - span * 0.03, hi: mid + span / 2 + span * 0.03 };
    }
    function easeRange(dt) {
      var t = targetRange();
      if (!st.range || st.reduced) { st.range = t; return; }
      var k = 1 - Math.exp(-dt / 90);
      st.range = { lo: st.range.lo + (t.lo - st.range.lo) * k, hi: st.range.hi + (t.hi - st.range.hi) * k };
      if (rangeSettled(t)) st.range = t;
    }
    function rangeSettled(t) {
      t = t || targetRange();
      return !st.range || (Math.abs(st.range.lo - t.lo) < 0.01 && Math.abs(st.range.hi - t.hi) < 0.01);
    }

    function layout() {
      var w = st.w, h = st.h, fs = st.fs, rg = st.range || targetRange();
      ctx.font = R.font(st.th, fs, 600);
      var padR = axes ? Math.ceil(ctx.measureText(U.fmtPrice(Math.max(Math.abs(rg.hi), Math.abs(rg.lo)))).width) + 16 : 0;
      var padB = axes ? fs + 14 : 0;
      var box = { left: 0, right: w - padR, top: 4, bottom: h - padB, w: w, h: h };
      var room = fs + 14;                                // structure labels above highs / below lows
      var sc = S.make({ w: w, h: h, padL: 0, padR: padR, padT: box.top + room, padB: padB + room,
        from: st.view.from, to: st.view.to, min: rg.lo, max: rg.hi });
      return { sc: sc, box: box };
    }

    function fitView() {
      var count = n(), margin = Math.max(2, Math.round(count * 0.04));
      var plotW = Math.max(40, st.w - (axes ? 70 : 0));
      var maxBars = Math.max(10, Math.floor(plotW / MIN_SLOT));
      var to = count - 1 + margin;
      st.view = { from: Math.max(0, to + 1 - maxBars), to: to };
    }

    // Keep the revealed bar on screen, two bars in from the right edge when the view has to move
    // (playing forward, or replaying from a bar left of a phone-width fit). The view keeps its width.
    function follow() {
      var v = st.view, span = v.to - v.from;
      if (st.rev > v.to - 2 || st.rev < v.from) {
        var to = Math.max(span, st.rev + 2);
        st.view = { from: to - span, to: to };
      }
    }

    // ---------------------------------------------------------------- draw
    function draw(t) {
      var w = st.w, h = st.h;
      ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!n() || w < 2 || h < 2) return;
      var L = layout(), sc = L.sc, box = L.box, th = st.th, fs = st.fs;
      var plabs = R.priceLabels(sc, sc.price(box.bottom), sc.price(box.top), box.top, box.bottom);
      ctx.font = R.font(th, fs);
      var tlabs = axes ? R.timeLabels(st.series, st.view.from, Math.min(st.view.to, n() - 1), sc, st.tf,
        function (s) { return ctx.measureText(s).width; }, box.left, box.right) : [];
      R.grid(ctx, th, plabs, tlabs, box);

      var ovs = { rev: st.rev, box: box, fs: fs, axes: axes, dragId: st.drag && st.drag.id, vis: visible, swept: swept, prog: function (id) {
        var a = st.anims[id];
        if (!a) return { inP: 1, flashP: null };
        return { inP: a.inT0 == null ? 1 : clamp((t - a.inT0) / O.DRAW_IN, 0, 1),
                 flashP: a.flT0 == null || t - a.flT0 >= O.FLASH ? null : clamp((t - a.flT0) / O.FLASH, 0, 1) };
      } };
      O.draw(ctx, sc, th, st.ov, ovs, 'under');

      ctx.save();
      ctx.beginPath(); ctx.rect(box.left, box.top, box.right - box.left, box.bottom - box.top); ctx.clip();
      R.candles(ctx, sc, get, Math.max(0, st.view.from), Math.min(st.view.to, st.rev), th);
      ctx.restore();

      O.draw(ctx, sc, th, st.ov, ovs, 'over');
      if (axes) {
        var tags = st.lines.map(function (l) { return sc.y(l.price); });
        if (st.rev >= 0) tags.push(sc.y(get(st.rev).c));
        R.priceAxis(ctx, th, plabs, box, fs, tags);
        R.timeAxis(ctx, th, tlabs, box, fs);
      }
      if (st.rev >= 0) R.lastPrice(ctx, sc, th, get(st.rev), box, fs, axes);
      O.drawLines(ctx, sc, th, st.lines, ovs);
      if (st.hover && crosshairOn && !st.drag) R.crosshair(ctx, sc, th, st.hover, get(st.hover.i), st.tf, box, fs, axes, readoutOn);
    }

    // ---------------------------------------------------------------- reveal + animation bookkeeping
    function anim(id, key, t) { (st.anims[id] = st.anims[id] || {})[key] = t; }

    // Recompute which overlays are on screen and which levels read as swept. When moving forward with
    // motion allowed, newly visible overlays draw in and newly swept levels flash.
    function refreshShown(animate) {
      var t = now(), go = animate && !st.reduced;
      var shown = {}, gone = {};
      st.ov.forEach(function (o) {
        var v = visible(o), s = v && o.type === 'level' && swept(o);
        if (v && go && !st.shown[o.id]) anim(o.id, 'inT0', t);
        if (s && go && !st.sweptSeen[o.id]) anim(o.id, 'flT0', t);
        if (!v && st.anims[o.id]) delete st.anims[o.id];
        shown[o.id] = v; gone[o.id] = s;
      });
      st.shown = shown; st.sweptSeen = gone;
    }

    // Forward = more base bars known than before (also true when a partly revealed roll-up completes).
    function setRev(i, animate) {
      if (!n()) return;
      var before = baseRevealed();
      st.rev = clamp(Math.round(i), 0, n() - 1);
      st.partial = null;
      follow();
      refreshShown(animate && baseRevealed() > before);
      invalidate();
    }

    // ---------------------------------------------------------------- playback
    function stopPlay(result) {
      var P = st.play;
      if (!P) return;
      st.play = null;
      P.resolve(result);
    }
    function finishNow(P) {                              // reduced motion: walk to the end at once
      for (var i = st.rev + 1; i <= P.to && st.play === P; i++) { setRev(i, false); if (P.onBar) P.onBar(i); }
      if (st.play === P) stopPlay(true);
    }
    function advance(dt) {
      var P = st.play, per = 1000 / P.bps;
      P.acc += dt;
      while (P.acc >= per && st.rev < P.to && st.play === P) {
        P.acc -= per;
        setRev(st.rev + 1, true);
        if (P.onBar) P.onBar(st.rev);
      }
      if (st.play === P && st.rev >= P.to) stopPlay(true);
    }

    // ---------------------------------------------------------------- pointer
    function local(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function inPlot(L, p) { return p.x >= L.box.left && p.x <= L.box.right && p.y >= L.box.top && p.y <= L.box.bottom; }
    function pick(L, x, y) {
      var hiI = Math.min(st.view.to, st.rev, n() - 1), loI = Math.min(Math.max(0, st.view.from), hiI);
      var i = clamp(L.sc.bar(x), loI, hiI);
      return { i: i, t: st.series[i].t, price: U.roundTick(L.sc.price(y), st.tick), x: x, y: y,
               candle: get(i), tf: st.tf, baseFrom: firstBase(i), baseTo: i === st.rev && st.partial ? st.partialEnd : lastBase(i) };
    }
    function emit(type, payload) { st.handlers[type].slice().forEach(function (fn) { fn(payload); }); }
    function lineById(id) { for (var i = 0; i < st.lines.length; i++) if (st.lines[i].id === id) return st.lines[i]; return null; }

    function onDown(e) {
      if (!n() || (e.button != null && e.button > 0)) return;
      var p = local(e), L = layout();
      var line = O.hitLine(L.sc, st.lines, p.y, e.pointerType === 'touch' ? 18 : 8);
      if (line && inPlot(L, p)) {
        st.drag = { id: line.id, pointerId: e.pointerId };
        try { if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId); } catch (x) { /* not capturable */ }
        if (e.preventDefault) e.preventDefault();
        invalidate();
        return;
      }
      st.down = { x: p.x, y: p.y, moved: false };
    }
    function onMove(e) {
      if (!n()) return;
      var p = local(e), L = layout();
      if (st.drag) {
        var line = lineById(st.drag.id);
        if (line) {
          var y = clamp(p.y, L.box.top, L.box.bottom);
          line.price = U.roundTick(L.sc.price(y), st.tick);
          emit('drag', { id: line.id, price: line.price, done: false });
        }
        if (e.preventDefault) e.preventDefault();
        invalidate();
        return;
      }
      if (st.down && Math.abs(p.x - st.down.x) + Math.abs(p.y - st.down.y) > 6) st.down.moved = true;
      if (inPlot(L, p)) {
        var hp = pick(L, p.x, p.y);
        st.hover = { i: hp.i, y: p.y };
        canvas.style.cursor = O.hitLine(L.sc, st.lines, p.y, 8) ? 'ns-resize' : crosshairOn ? 'crosshair' : 'default';
        emit('hover', hp);
        if (crosshairOn) invalidate();
      } else if (st.hover) { clearHover(); }
    }
    function endDrag() {
      var line = lineById(st.drag.id);
      try { if (canvas.releasePointerCapture) canvas.releasePointerCapture(st.drag.pointerId); } catch (x) { /* already released */ }
      st.drag = null;
      if (line) emit('drag', { id: line.id, price: line.price, done: true });
      invalidate();
    }
    function onUp(e) {
      if (st.drag) { endDrag(); st.down = null; return; }
      var d = st.down;
      st.down = null;
      if (!d || d.moved || !n()) return;
      var p = local(e), L = layout();
      if (inPlot(L, p)) emit('click', pick(L, p.x, p.y));
    }
    function onCancel() { if (st.drag) endDrag(); st.down = null; clearHover(); }
    function clearHover() {
      if (!st.hover) return;
      st.hover = null;
      emit('hover', null);
      invalidate();
    }
    if (interactive) {
      listen(canvas, 'pointerdown', onDown);
      listen(canvas, 'pointermove', onMove);
      listen(canvas, 'pointerup', onUp);
      listen(canvas, 'pointercancel', onCancel);
      listen(canvas, 'pointerleave', function () { if (!st.drag) clearHover(); });
    }

    // ---------------------------------------------------------------- size
    function resize() {
      if (st.dead) return api;
      var w = Math.round(el.clientWidth || 0);
      if (!w) return api;                                // host not laid out (display:none): ResizeObserver calls again
      var h = Math.round(el.clientHeight || 0);
      if (autoH || h < 60) {                             // host has no height of its own: size from width
        if (!autoH) { restore.height = el.style.height || ''; autoH = true; }
        h = Math.round(clamp(w * 0.56, 220, 520));
        el.style.height = h + 'px';
      }
      var dpr = global.devicePixelRatio || 1;
      st.th = R.readTheme(el, opts.theme);
      if (w !== st.w || h !== st.h || dpr !== st.dpr) {
        st.w = w; st.h = h; st.dpr = dpr; st.fs = w < 480 ? 10 : 11;
        canvas.width = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
        cs.width = w + 'px'; cs.height = h + 'px';
        if (!st.viewSet && n()) { fitView(); follow(); }
      }
      invalidate();
      return api;
    }

    // ---------------------------------------------------------------- public API
    function withId(o) {
      var c = copy(o);
      if (c.id == null) c.id = 'ov' + (++seq);
      return c;
    }
    function remap() {
      st.ov = O.mapBars(st.src, st.base, st.series);
      srcOf = new Map();
      st.ov.forEach(function (m, k) { srcOf.set(m, st.src[k]); });
    }

    var api = {
      setData: function (d) {
        if (st.dead) return api;
        stopPlay(false);
        var cs0 = (d && d.candles) || [], meta = (d && d.meta) || {};
        st.base = cs0; st.series = cs0; st.meta = meta;
        st.baseTf = meta.tf || 5; st.tf = st.baseTf; st.tick = meta.tick || 0.25;
        st.src = []; st.ov = []; st.lines = []; st.shown = {}; st.sweptSeen = {}; st.anims = {};
        st.rev = cs0.length - 1; st.partial = null; st.range = null;
        st.hover = null; st.drag = null; st.down = null; st.viewSet = false;
        st.th = R.readTheme(el, opts.theme);
        canvas.style.touchAction = 'pan-y';
        fitView();
        invalidate();
        return api;
      },

      setTimeframe: function (tf) {
        if (st.dead || !st.base.length || tf === st.tf) return api;
        var bRev = baseRevealed();
        var series = tf === st.baseTf ? st.base : TJR.gen.rollup(st.base, st.baseTf, tf);
        stopPlay(false);
        st.series = series; st.tf = tf;
        st.at = O.indexer(st.base, series);
        remap();
        var j = st.at(bRev);
        st.rev = j; st.partial = null;
        var end = lastBase(j);
        if (end > bRev) {                                // bucket only partly revealed: draw what is known
          var s = firstBase(j), k = { t: series[j].t, o: st.base[s].o, h: -Infinity, l: Infinity, c: st.base[bRev].c };
          for (var i = s; i <= bRev; i++) { k.h = Math.max(k.h, st.base[i].h); k.l = Math.min(k.l, st.base[i].l); }
          st.partial = k; st.partialEnd = bRev;
        }
        st.hover = null; st.range = null; st.anims = {}; st.viewSet = false;
        fitView(); follow();
        refreshShown(false);
        invalidate();
        return api;
      },

      view: function (from, to) {
        if (st.dead) return api;
        from = Math.floor(from); to = Math.floor(to);
        st.view = { from: from, to: Math.max(from + 1, to) };
        st.viewSet = true;
        invalidate();
        return api;
      },
      fit: function () { if (st.dead) return api; st.viewSet = false; fitView(); follow(); invalidate(); return api; },

      reveal: function (i) { if (st.dead) return -1; stopPlay(false); setRev(i, true); return st.rev; },
      step: function (d) { if (st.dead) return -1; stopPlay(false); setRev(st.rev + (d < 0 ? -1 : 1), true); return st.rev; },

      play: function (o) {
        o = o || {};
        if (st.dead || !n()) return Promise.resolve(false);
        stopPlay(false);
        var to = clamp(o.to == null ? n() - 1 : Math.round(o.to), 0, n() - 1);
        var from = o.from != null ? clamp(Math.round(o.from), 0, to) : st.rev < to ? Math.max(0, st.rev) : 0;
        var bps = o.barsPerSec > 0 ? o.barsPerSec : 6, onBar = typeof o.onBar === 'function' ? o.onBar : null;
        return new Promise(function (resolve) {
          var P = { to: to, bps: bps, onBar: onBar, acc: 0, resolve: resolve };
          st.play = P;
          setRev(from, from > st.rev);
          if (onBar) onBar(st.rev);
          if (st.play !== P) return;                     // onBar paused or restarted playback
          if (st.reduced || st.rev >= to) { finishNow(P); return; }
          schedule();
        });
      },
      pause: function () { stopPlay(false); invalidate(); return api; },

      setOverlays: function (list) {
        if (st.dead) return api;
        st.src = (list || []).map(withId);
        remap();
        st.anims = {};
        refreshShown(false);
        invalidate();
        return api;
      },
      addOverlay: function (o) {
        if (st.dead) return null;
        var c = withId(o);
        st.src = st.src.filter(function (x) { return x.id !== c.id; }).concat([c]);
        remap();
        var m = st.ov[st.ov.length - 1];
        if (visible(m) && !st.reduced) anim(c.id, 'inT0', now());
        st.shown[c.id] = visible(m);
        st.sweptSeen[c.id] = st.shown[c.id] && m.type === 'level' && swept(m);
        invalidate();
        return c.id;
      },
      removeOverlay: function (id) {
        if (st.dead) return api;
        st.src = st.src.filter(function (x) { return x.id !== id; });
        st.lines = st.lines.filter(function (x) { return x.id !== id; });
        remap();
        delete st.shown[id]; delete st.anims[id];
        invalidate();
        return api;
      },
      flash: function (id) {
        if (st.dead || st.reduced) return false;
        var known = lineById(id) || st.ov.some(function (o) { return o.id === id; });
        if (!known) return false;
        anim(id, 'flT0', now());
        invalidate();
        return true;
      },

      addLine: function (l) {
        if (st.dead) return null;
        var c = { id: l.id != null ? l.id : 'line' + (++seq), price: U.roundTick(+l.price, st.tick), label: l.label || '',
                  draggable: l.draggable !== false, color: l.color || null };
        st.lines = st.lines.filter(function (x) { return x.id !== c.id; }).concat([c]);
        if (c.draggable) canvas.style.touchAction = 'none';   // vertical drags must not scroll the page
        invalidate();
        return c.id;
      },
      getLine: function (id) { var l = lineById(id); return l ? l.price : null; },

      on: function (type, fn) {
        if (EVENTS.indexOf(type) < 0) throw new Error('chart.on: unknown event ' + type);
        st.handlers[type].push(fn);
        return function off() { var a = st.handlers[type], k = a.indexOf(fn); if (k >= 0) a.splice(k, 1); };
      },

      coords: function (bar, price) { var L = layout(); return { x: L.sc.x(bar), y: L.sc.y(price) }; },
      at: function (x, y) { return n() ? pick(layout(), x, y) : null; },

      info: function () {
        var t = now();
        return {
          tf: st.tf, baseTf: st.baseTf, bars: n(), revealed: st.rev, playing: !!st.play, reduced: st.reduced,
          view: { from: st.view.from, to: st.view.to }, width: st.w, height: st.h,
          overlays: st.ov.map(copy), lines: st.lines.map(copy),
          visible: st.ov.filter(function (o) { return visible(o); }).map(function (o) { return o.id; }),
          swept: st.ov.filter(function (o) { return o.type === 'level' && visible(o) && swept(o); })
            .map(function (o) { return o.id; }),
          priceRange: targetRange(),
          animating: Object.keys(st.anims).filter(function (id) {
            var a = st.anims[id];
            return (a.inT0 != null && t - a.inT0 < O.DRAW_IN) || (a.flT0 != null && t - a.flT0 < O.FLASH);
          })
        };
      },

      resize: resize,

      destroy: function () {
        if (st.dead) return;
        stopPlay(false);
        st.dead = true;
        if (st.raf != null && global.cancelAnimationFrame) global.cancelAnimationFrame(st.raf);
        st.raf = null;
        regs.forEach(function (r) { r[0].removeEventListener(r[1], r[2], r[3]); });
        regs = [];
        if (mqlLegacy && mql.removeListener) mql.removeListener(mqlLegacy);
        if (ro) ro.disconnect();
        if (io) io.disconnect();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        if (restore.position != null) el.style.position = restore.position;
        if (autoH) el.style.height = restore.height;
        st.handlers = { click: [], hover: [], drag: [] };
        st.base = st.series = []; st.src = st.ov = st.lines = [];
      }
    };

    resize();
    // canvas text drawn before web fonts arrive uses fallbacks: draw again once they are ready
    var fonts = global.document.fonts;
    if (fonts && fonts.ready && fonts.ready.then) fonts.ready.then(function () { if (!st.dead) invalidate(); });
    return api;
  }

  chart.create = create;
})(typeof window !== 'undefined' ? window : globalThis);
