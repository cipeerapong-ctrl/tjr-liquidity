/* Chart overlays: visibility by revealed bar, mapping onto a rolled-up series, and drawing.
   Classic script on TJR.chart.overlays. Shapes (every type also takes id and appearAt):
     level  {price, from?, to?, label, kind:'liq'|'stack'|'session'|'htf'|'target', state:'active'|'swept'}
     box    {from, to, low, high, label, kind:'asia'|'london'|'ny'}
     label  {bar, price, text, pos:'above'|'below'}
     marker {bar, price, shape:'up'|'down'|'dot'|'x'}
     zone   {from, to, low, high, kind:'entry', label?}
     trend  {a:{bar, price}, b:{bar, price}}
   Bars are indices into the series on screen. Nothing anchored after the revealed bar is drawn: a level
   marked 'swept' draws as active (a ray to the right edge) until the revealed bar reaches its `to`. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var chart = TJR.chart = TJR.chart || {};

  var DRAW_IN = 400, FLASH = 900;

  // ------------------------------------------------------------------ visibility

  function isVisible(o, rev) {
    if (!o) return false;
    if (o.appearAt != null && o.appearAt > rev) return false;
    switch (o.type) {
      case 'label': case 'marker': return o.bar == null || o.bar <= rev;
      case 'trend': return !o.a || o.a.bar <= rev;
      case 'box': case 'zone': case 'level': return o.from == null || o.from <= rev;
      default: return true;
    }
  }

  function isSwept(o, rev) { return o.state === 'swept' && (o.to == null || o.to <= rev); }

  // ------------------------------------------------------------------ timeframe mapping

  // base bar index -> index of the series bar whose time bucket holds that base candle
  function indexer(base, series) {
    if (base === series) return function (b) { return b; };
    var n = base.length, m = series.length;
    return function (b) {
      if (!m) return 0;
      var t = base[Math.max(0, Math.min(n - 1, Math.round(b)))].t;
      var lo = 0, hi = m - 1;
      while (lo < hi) {                                   // last j with series[j].t <= t
        var mid = (lo + hi + 1) >> 1;
        if (series[mid].t <= t) lo = mid; else hi = mid - 1;
      }
      return lo;
    };
  }

  // Deep copy of plain overlay data (objects, arrays, primitives).
  function copy(o) {
    if (Array.isArray(o)) return o.map(copy);
    if (!o || typeof o !== 'object') return o;
    var c = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) c[k] = copy(o[k]);
    return c;
  }

  // Copies of the overlays with every bar field (from, to, bar, appearAt, a.bar, b.bar) moved by time.
  function mapBars(list, base, series) {
    var at = indexer(base, series);
    return (list || []).map(function (o) {
      var c = copy(o);
      ['from', 'to', 'bar', 'appearAt'].forEach(function (f) { if (c[f] != null) c[f] = at(c[f]); });
      if (c.a && c.a.bar != null) c.a.bar = at(c.a.bar);
      if (c.b && c.b.bar != null) c.b.bar = at(c.b.bar);
      return c;
    });
  }

  // ------------------------------------------------------------------ drawing helpers

  function ease(p) { p = p < 0 ? 0 : p > 1 ? 1 : p; return 1 - Math.pow(1 - p, 3); }

  function kindColor(th, kind) {
    switch (kind) {
      case 'session': case 'asia': case 'london': case 'ny': return th.session;
      case 'htf': return th.htf;
      case 'target': return th.target;
      case 'entry': return th.entry;
      default: return th.liq;                              // liq, stack
    }
  }

  // Keeps movable labels (levels, boxes, zones) off each other and off the fixed structure tags:
  // a rect that hits a placed one moves above it (or below, once it would leave the plot).
  // place.add(rect) registers a fixed obstacle.
  function placer(box) {
    var placed = [];
    function hit(r) {
      for (var i = 0; i < placed.length; i++) {
        var q = placed[i];
        if (r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h) return q;
      }
      return null;
    }
    function place(r) {
      var start = r.y, q, n = 0;
      while ((q = hit(r)) && n++ < 10) r.y = q.y - r.h - 2;
      if (r.y < box.top) {
        r.y = start; n = 0;
        while ((q = hit(r)) && n++ < 10) r.y = q.y + q.h + 2;
      }
      placed.push(r);
      return r;
    }
    place.add = function (r) { placed.push(r); };
    return place;
  }

  function pill(ctx, th, text, x, y, align, col, fs, opts) {
    opts = opts || {};
    ctx.font = chart.render.font(th, fs, 600, opts.mono ? 'mono' : 'sans');
    var w = ctx.measureText(text).width + 8, h = fs + 6;
    var left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    var r = { x: left, y: y - h, w: w, h: h };
    if (opts.place) r = opts.place(r);
    ctx.save();
    ctx.globalAlpha *= 0.85;                               // background stays solid enough over candles
    ctx.fillStyle = th.bg;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha *= opts.dim || 1;                      // dim (swept) applies to the text only
    ctx.fillStyle = col;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, r.x + 4, r.y + h / 2 + 0.5);
    if (opts.strike) {
      ctx.fillRect(r.x + 4, Math.round(r.y + h / 2), w - 8, 1);
    }
    ctx.restore();
    return r;
  }

  function sweptTag(ctx, th, x, y, col, fs, p, box) {
    var a = 1 - p * p, s = 1 + 0.25 * (1 - ease(Math.min(1, p * 3)));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = chart.render.font(th, Math.round(fs * s), 700, 'mono');
    var w = ctx.measureText('SWEPT').width + 10, h = Math.round(fs * s) + 8;
    var left = Math.max(box.left + 2, Math.min(box.right - w - 2, x - w / 2));
    var top = Math.max(box.top + 2, y - h - 8 - 10 * ease(p));
    ctx.shadowColor = col; ctx.shadowBlur = 14;
    ctx.fillStyle = col;
    ctx.fillRect(left, top, w, h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = th.bg;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('SWEPT', left + w / 2, top + h / 2 + 0.5);
    ctx.restore();
  }

  function glow(ctx, col, fp) {
    if (fp == null) return;
    var pulse = Math.sin(Math.PI * Math.min(1, fp * 1.6));
    ctx.shadowColor = col; ctx.shadowBlur = 4 + 18 * pulse;
  }

  // ------------------------------------------------------------------ per type

  function drawLevel(ctx, sc, th, o, st, pr, place) {
    var box = st.box, col = kindColor(th, o.kind), swept = st.swept ? st.swept(o) : isSwept(o, st.rev);
    var x0 = Math.max(box.left, o.from != null ? sc.x(o.from) : box.left);
    var x1 = swept ? sc.x(o.to) : (o.to == null || o.to >= st.rev ? box.right : sc.x(o.to));
    x1 = Math.min(box.right, x1);
    if (x1 < box.left || x0 > box.right) return;
    var y = Math.round(sc.y(o.price)) + 0.5;
    if (y < box.top - 2 || y > box.bottom + 2) return;
    var p = ease(pr.inP), xe = x0 + (x1 - x0) * p;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = (o.kind === 'htf' ? 2 : 1.5) + (pr.flashP != null ? 1 : 0);
    ctx.globalAlpha = swept ? 0.6 : 0.95;
    if (swept) ctx.setLineDash([5, 4]);
    glow(ctx, col, pr.flashP);
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(xe, y); ctx.stroke();
    ctx.restore();
    if (o.label && p > 0.6) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (p - 0.6) / 0.4);
      pill(ctx, th, o.label, Math.max(box.left + 60, xe - 4), y - 3, 'right', col, st.fs, { place: place, strike: swept, dim: swept ? 0.7 : 1 });
      ctx.restore();
    }
    if (pr.flashP != null) sweptTag(ctx, th, xe, y, col, st.fs, pr.flashP, box);
  }

  // Box / zone geometry as it stands at the revealed bar, grown by the draw-in progress.
  function rectGeom(sc, o, st, pr) {
    var box = st.box, to = Math.min(o.to == null ? st.rev : o.to, st.rev);
    var x0 = Math.max(box.left, sc.x(o.from) - sc.slot / 2), x1 = Math.min(box.right, sc.x(to) + sc.slot / 2);
    if (x1 <= x0) return null;
    var p = ease(pr.inP);
    return { x0: x0, x1: x0 + (x1 - x0) * p, y0: sc.y(o.high), y1: sc.y(o.low), p: p };
  }

  // The shaded rect: drawn beneath the candles.
  function drawRect(ctx, sc, th, o, st, pr, fill, stroke, dash) {
    var g = rectGeom(sc, o, st, pr), col = kindColor(th, o.kind);
    if (!g) return;
    ctx.save();
    ctx.globalAlpha = fill * g.p;
    ctx.fillStyle = col;
    ctx.fillRect(g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0);
    ctx.globalAlpha = stroke * g.p;
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    if (dash) ctx.setLineDash(dash);
    glow(ctx, col, pr.flashP);
    ctx.strokeRect(Math.round(g.x0) + 0.5, Math.round(g.y0) + 0.5, Math.round(g.x1 - g.x0), Math.round(g.y1 - g.y0));
    ctx.restore();
  }

  // Its label: drawn above the candles. Box: inside the top-left corner. Zone: under the zone (over it
  // when there is no room below).
  function drawRectLabel(ctx, sc, th, o, st, pr, place) {
    var g = rectGeom(sc, o, st, pr), text = o.label || (o.type === 'zone' ? 'entry' : '');
    if (!g || !text || g.x1 - g.x0 < 24) return;
    var h = st.fs + 6, bottom = o.type === 'zone' ? g.y1 + 3 + h : g.y0 + 2 + h;
    if (o.type === 'zone' && bottom > st.box.bottom) bottom = g.y0 - 3;
    ctx.save();
    ctx.globalAlpha = g.p;
    pill(ctx, th, text, g.x0 + 2, bottom, 'left', kindColor(th, o.kind), st.fs, { place: place });
    ctx.restore();
  }

  // Final rect of a structure tag (fixed: other labels steer around it).
  function labelRect(ctx, sc, th, o, st) {
    ctx.font = chart.render.font(th, st.fs, 600, 'mono');
    var w = ctx.measureText(String(o.text)).width + 8, h = st.fs + 6, y = sc.y(o.price);
    return { x: sc.x(o.bar) - w / 2, y: o.pos === 'below' ? y + 5 : y - 5 - h, w: w, h: h };
  }

  function drawTrend(ctx, sc, th, o, st, pr) {
    var a = o.a, b = o.b, col = th.liq;
    var bb = b.bar <= st.rev ? b : { bar: st.rev, price: a.price + (b.price - a.price) * (st.rev - a.bar) / Math.max(1, b.bar - a.bar) };
    var p = ease(pr.inP);
    var xa = sc.x(a.bar), ya = sc.y(a.price), xb = sc.x(bb.bar), yb = sc.y(bb.price);
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.85;
    ctx.setLineDash([6, 4]);
    glow(ctx, col, pr.flashP);
    ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xa + (xb - xa) * p, ya + (yb - ya) * p); ctx.stroke();
    ctx.restore();
  }

  function drawMarker(ctx, sc, th, o, st, pr) {
    var col = o.color || th.liq, p = ease(pr.inP), x = sc.x(o.bar), y = sc.y(o.price), s = Math.max(5, Math.min(8, sc.slot * 1.2));
    var drop = (1 - p) * 10;
    ctx.save();
    ctx.globalAlpha = p;
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 2;
    glow(ctx, col, pr.flashP == null ? (p < 1 ? 1 - p : null) : pr.flashP);
    ctx.beginPath();
    if (o.shape === 'up') {                              // under a swept low, pointing up at it
      var t = y + 5 + drop;
      ctx.moveTo(x, t); ctx.lineTo(x - s, t + s * 1.5); ctx.lineTo(x + s, t + s * 1.5); ctx.closePath(); ctx.fill();
    } else if (o.shape === 'down') {                     // over a swept high, pointing down at it
      var u = y - 5 - drop;
      ctx.moveTo(x, u); ctx.lineTo(x - s, u - s * 1.5); ctx.lineTo(x + s, u - s * 1.5); ctx.closePath(); ctx.fill();
    } else if (o.shape === 'x') {
      ctx.moveTo(x - s * 0.7, y - s * 0.7); ctx.lineTo(x + s * 0.7, y + s * 0.7);
      ctx.moveTo(x + s * 0.7, y - s * 0.7); ctx.lineTo(x - s * 0.7, y + s * 0.7); ctx.stroke();
    } else {
      ctx.arc(x, y, Math.max(3, s * 0.6), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function tagColor(th, text) {
    if (text === 'HH' || text === 'HL') return th.bull;
    if (text === 'LL' || text === 'LH') return th.bear;
    return th.text;
  }

  function drawLabel(ctx, sc, th, o, st, pr) {
    var p = ease(pr.inP), x = sc.x(o.bar), y = sc.y(o.price), off = (1 - p) * 6;
    ctx.save();
    ctx.globalAlpha = p;
    var fs = st.fs, h = fs + 6;
    var top = o.pos === 'below' ? y + 5 + off + h : y - 5 - off;
    pill(ctx, th, String(o.text), x, top, 'center', o.color || tagColor(th, o.text), fs, { mono: true });
    ctx.restore();
  }

  // ------------------------------------------------------------------ public draw

  var ORDER = { box: 0, zone: 1, trend: 2, level: 3, marker: 4, label: 5 };

  // st: {rev, box, fs, prog(id) -> {inP 0..1, flashP 0..1|null}, vis?(o), swept?(o)}. vis/swept replace
  // isVisible/isSwept against st.rev (the chart passes judges that know a partly revealed roll-up).
  // layer 'under' = box and zone shading (drawn beneath the candles), 'over' = their labels and everything
  // else; omitted = both.
  function draw(ctx, sc, th, list, st, layer) {
    var vis = list.filter(function (o) { return st.vis ? st.vis(o) : isVisible(o, st.rev); });
    vis.sort(function (a, b) { return (ORDER[a.type] || 0) - (ORDER[b.type] || 0); });
    ctx.save();
    ctx.beginPath();
    ctx.rect(st.box.left, st.box.top - 2, st.box.right - st.box.left, st.box.bottom - st.box.top + 4);
    ctx.clip();
    if (layer !== 'over') {
      vis.forEach(function (o) {
        if (o.type === 'box') drawRect(ctx, sc, th, o, st, st.prog(o.id), 0.07, 0.5, [3, 3]);
        else if (o.type === 'zone') drawRect(ctx, sc, th, o, st, st.prog(o.id), 0.16, 0.75, null);
      });
    }
    if (layer !== 'under') {
      var place = placer(st.box);
      vis.forEach(function (o) { if (o.type === 'label') place.add(labelRect(ctx, sc, th, o, st)); });
      vis.forEach(function (o) {
        var pr = st.prog(o.id);
        switch (o.type) {
          case 'box': case 'zone': drawRectLabel(ctx, sc, th, o, st, pr, place); break;
          case 'level': drawLevel(ctx, sc, th, o, st, pr, place); break;
          case 'trend': drawTrend(ctx, sc, th, o, st, pr); break;
          case 'marker': drawMarker(ctx, sc, th, o, st, pr); break;
          case 'label': drawLabel(ctx, sc, th, o, st, pr); break;
        }
      });
    }
    ctx.restore();
  }

  // User lines ({id, price, label, draggable, color?}): full width, label on the left, price tag on the axis.
  function drawLines(ctx, sc, th, lines, st) {
    var box = st.box;
    lines.forEach(function (l) {
      var col = l.color || th.session, y = Math.round(sc.y(l.price)) + 0.5, pr = st.prog(l.id);
      if (y < box.top || y > box.bottom) return;
      var active = st.dragId === l.id;
      ctx.save();
      ctx.strokeStyle = col; ctx.lineWidth = active ? 2.5 : 1.5;
      glow(ctx, col, pr.flashP != null ? pr.flashP : active ? 0.3 : null);
      ctx.beginPath(); ctx.moveTo(box.left, y); ctx.lineTo(box.right, y); ctx.stroke();
      if (l.draggable !== false) {                         // grab handle
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(box.right - 14, y, active ? 6 : 4.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      if (l.label) { ctx.save(); pill(ctx, th, l.label, box.left + 4, y - 3, 'left', col, st.fs); ctx.restore(); }
      if (st.axes) chart.render.axisTag(ctx, th, y, TJR.util.fmtPrice(l.price), col, th.bg, box, st.fs);
      if (pr.flashP != null) sweptTag(ctx, th, box.right - 40, y, col, st.fs, pr.flashP, box);
    });
  }

  // The draggable line nearest to y within tol px, or null.
  function hitLine(sc, lines, y, tol) {
    var best = null, bd = tol;
    lines.forEach(function (l) {
      if (l.draggable === false) return;
      var d = Math.abs(sc.y(l.price) - y);
      if (d <= bd) { bd = d; best = l; }
    });
    return best;
  }

  chart.overlays = {
    DRAW_IN: DRAW_IN, FLASH: FLASH,
    isVisible: isVisible, isSwept: isSwept, indexer: indexer, mapBars: mapBars, copy: copy,
    kindColor: kindColor, draw: draw, drawLines: drawLines, hitLine: hitLine
  };
})(typeof window !== 'undefined' ? window : globalThis);
