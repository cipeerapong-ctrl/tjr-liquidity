/* Chart drawing primitives: theme, grid, candles, price/time axes, axis tags, crosshair readout.
   Classic script on TJR.chart.render. Nothing here touches the DOM at load time; readTheme() reads
   CSS custom properties from the chart element when the chart asks (setData / resize).
   Transparency always goes through ctx.globalAlpha, never colour parsing, so any CSS colour a token
   holds (hex, rgb, hsl, oklch) works. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var chart = TJR.chart = TJR.chart || {};

  // Built-in dark defaults (Task 8 tokens override them). Bull green, bear red, liquidity amber,
  // sessions cyan, HTF silver, entry blue, target lime: never violet or lavender.
  var DEFAULTS = {
    bull: '#26d07c', bear: '#f2495c', grid: 'rgba(148, 163, 184, 0.09)', axis: '#8794a3',
    liq: '#fbbf24', session: '#22d3ee', htf: '#e2e8f0', entry: '#60a5fa', target: '#a3e635',
    text: '#e6edf3', bg: '#0a0e13',
    mono: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    sans: "'IBM Plex Sans Thai', 'Noto Sans Thai', 'Sarabun', system-ui, -apple-system, 'Segoe UI', sans-serif"
  };
  var VARS = {
    bull: '--c-bull', bear: '--c-bear', grid: '--c-grid', axis: '--c-axis', liq: '--c-liq',
    session: '--c-session', htf: '--c-htf', entry: '--c-entry', target: '--c-target', text: '--c-text',
    bg: '--c-bg', mono: '--font-mono', sans: '--font-text'
  };

  // defaults <- CSS custom properties on el <- opts.theme
  function readTheme(el, over) {
    var th = {}, cs = null, k;
    try { cs = el && global.getComputedStyle ? global.getComputedStyle(el) : null; } catch (e) { cs = null; }
    for (k in DEFAULTS) {
      var v = cs ? String(cs.getPropertyValue(VARS[k]) || '').trim() : '';
      th[k] = v || DEFAULTS[k];
    }
    if (over) for (k in over) if (over[k]) th[k] = over[k];
    return th;
  }

  function font(th, px, weight, family) {
    return (weight ? weight + ' ' : '') + px + 'px ' + (family === 'sans' ? th.sans : th.mono);
  }

  // ------------------------------------------------------------------ number / time text

  function fmtAxis(p, step) {
    var s = TJR.util.fmtPrice(p);
    return step >= 1 ? s.slice(0, -3) : s;
  }

  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // A daily bar is stamped at its 18:00 ET open, the evening before the date it trades as: daily dates
  // are read 6 h later (00:00 ET of the trading day).
  var DAY_SHIFT = 6 * 3600;
  function etLocal(t) { return t + TJR.sessions.etOffsetHours(t) * 3600; }   // ET wall clock as epoch-like seconds
  function fmtDate(t) { var e = TJR.sessions.toET(t); return e.d + '/' + e.mo; }
  function fmtDay(t) { return fmtDate(t + DAY_SHIFT); }                        // trading date of a daily bar
  function fmtStamp(t, tf) {                                                   // crosshair: day + ET + Thailand
    var e = TJR.sessions.toET(tf >= 1440 ? t + DAY_SHIFT : t), d = DAYS[e.dow] + ' ' + e.d + '/' + e.mo;
    if (tf >= 1440) return d;
    return d + ' ' + TJR.sessions.fmtET(t) + ' ET · ' + TJR.sessions.fmtThai(t) + ' TH';
  }

  // ------------------------------------------------------------------ label layout (pure)

  // Price labels for the visible band [lo, hi] drawn between pixel rows top..bottom: one per >= 48 px.
  function priceLabels(sc, lo, hi, top, bottom) {
    var approx = Math.max(2, Math.floor((bottom - top) / 48));
    var ts = chart.scale.ticks(lo, hi, approx), step = ts.length > 1 ? ts[1] - ts[0] : chart.scale.niceStep(hi - lo, approx);
    var out = [];
    ts.forEach(function (p) {
      var y = sc.y(p);
      if (y >= top + 6 && y <= bottom - 6) out.push({ p: p, y: y, text: fmtAxis(p, step) });
    });
    return out;
  }

  var STEPS = [1, 5, 15, 30, 60, 120, 180, 240, 360, 720, 1440, 2880, 10080, 20160, 40320];

  // Time labels for bars from..to: the first bar of each round ET interval (HH:MM, or D/M at a new ET day),
  // the interval chosen so labels clear each other, then a greedy pass that drops any that would still
  // touch (day labels win over clock labels) or leave [left, right]. measure(text) -> px width.
  function timeLabels(candles, from, to, sc, tf, measure, left, right) {
    var a = Math.max(0, from), b = Math.min(to, candles.length - 1), GAP = 12;
    if (b < a) return [];
    tf = tf || 5;
    var need = measure(tf >= 1440 ? '30/12' : '00:00') + GAP, interval = STEPS[STEPS.length - 1];
    for (var s = 0; s < STEPS.length; s++) {
      if (STEPS[s] < tf || STEPS[s] % tf) continue;
      if (STEPS[s] / tf * sc.slot >= need) { interval = STEPS[s]; break; }
    }
    var daily = interval >= 1440 || tf >= 1440, shift = tf >= 1440 ? DAY_SHIFT : 0;
    function mins(i) { return Math.floor((etLocal(candles[i].t) + shift) / 60); }
    function day(i) { return Math.floor((etLocal(candles[i].t) + shift) / 86400); }
    var cand = [];
    for (var i = a; i <= b; i++) {
      var m = mins(i), key = Math.floor(m / interval);
      var edge = i === 0 ? m % interval === 0 : key !== Math.floor(mins(i - 1) / interval);
      if (!edge) continue;
      var newDay = i === 0 ? m % 1440 === 0 : day(i) !== day(i - 1);
      var text = daily || newDay ? fmtDate(candles[i].t + shift) : TJR.sessions.fmtET(candles[i].t);
      var w = measure(text), x = sc.x(i);
      if (x - w / 2 < left || x + w / 2 > right) continue;
      cand.push({ i: i, x: x, w: w, text: text, pri: daily || newDay ? 2 : 1 });
    }
    var out = [];
    function clear(p, q) { return q.x - q.w / 2 >= p.x + p.w / 2 + GAP; }
    cand.forEach(function (c) {
      var last = out[out.length - 1];
      if (!last || clear(last, c)) { out.push(c); return; }
      if (c.pri > last.pri) {
        var prev = out[out.length - 2];
        if (!prev || clear(prev, c)) out[out.length - 1] = c;
      }
    });
    return out;
  }

  // ------------------------------------------------------------------ drawing

  function grid(ctx, th, plabs, tlabs, box) {
    ctx.save();
    ctx.strokeStyle = th.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    plabs.forEach(function (l) { var y = Math.round(l.y) + 0.5; ctx.moveTo(box.left, y); ctx.lineTo(box.right, y); });
    tlabs.forEach(function (l) { var x = Math.round(l.x) + 0.5; ctx.moveTo(x, box.top); ctx.lineTo(x, box.bottom); });
    ctx.stroke();
    ctx.restore();
  }

  // get(i) -> candle; bars i0..i1. Wicks and bodies batched per colour; soft glow when bodies are wide.
  function candles(ctx, sc, get, i0, i1, th) {
    if (i1 < i0) return;
    var bw = Math.max(1, Math.round(sc.barW));
    if (bw > 2 && bw % 2 === 0) bw -= 1;                  // odd widths keep the wick centred on a pixel
    var groups = [[], []];                                // [bull, bear]
    for (var i = i0; i <= i1; i++) {
      var k = get(i);
      if (k) groups[k.c >= k.o ? 0 : 1].push(i);
    }
    ctx.save();
    ctx.lineWidth = 1;
    [th.bull, th.bear].forEach(function (col, g) {
      var list = groups[g];
      if (!list.length) return;
      function bodies() {
        ctx.beginPath();
        list.forEach(function (i) {
          var k = get(i), left = Math.round(sc.x(i) - bw / 2);
          var y0 = Math.round(sc.y(Math.max(k.o, k.c))), y1 = Math.round(sc.y(Math.min(k.o, k.c)));
          ctx.rect(left, y0, bw, Math.max(1, y1 - y0));
        });
      }
      ctx.strokeStyle = col;
      ctx.beginPath();
      list.forEach(function (i) {
        var k = get(i), x = Math.round(sc.x(i) - bw / 2) + (bw - 1) / 2 + 0.5;
        ctx.moveTo(x, Math.round(sc.y(k.h))); ctx.lineTo(x, Math.round(sc.y(k.l)));
      });
      ctx.stroke();
      ctx.fillStyle = col;
      if (bw >= 3) {                                      // glow pass under the bodies
        ctx.save();
        ctx.globalAlpha = 0.35; ctx.shadowColor = col; ctx.shadowBlur = 8;
        bodies(); ctx.fill();
        ctx.restore();
      }
      bodies(); ctx.fill();
    });
    ctx.restore();
  }

  // avoid: y rows already taken by axis tags (last price, user lines); labels under them are skipped.
  function priceAxis(ctx, th, plabs, box, fs, avoid) {
    ctx.save();
    ctx.fillStyle = th.axis;
    ctx.font = font(th, fs);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    plabs.forEach(function (l) {
      for (var k = 0; avoid && k < avoid.length; k++) if (Math.abs(avoid[k] - l.y) < fs + 12) return;   // tag fs+8 tall + label
      ctx.fillText(l.text, box.right + 8, l.y);
    });
    ctx.restore();
  }

  function timeAxis(ctx, th, tlabs, box, fs) {
    ctx.save();
    ctx.fillStyle = th.axis;
    ctx.font = font(th, fs);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    tlabs.forEach(function (l) { ctx.fillText(l.text, l.x, box.bottom + 6); });
    ctx.restore();
  }

  // Filled tag on the price axis (last price, crosshair price, user lines).
  function axisTag(ctx, th, y, text, bg, fg, box, fs) {
    ctx.save();
    ctx.font = font(th, fs, 600);
    var h = fs + 8, w = ctx.measureText(text).width + 10, x = box.right + 2;
    y = Math.max(box.top + h / 2, Math.min(box.bottom - h / 2, y));
    ctx.fillStyle = bg;
    ctx.fillRect(x, Math.round(y - h / 2), Math.min(w, box.w - x), h);
    ctx.fillStyle = fg;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 5, y + 0.5);
    ctx.restore();
  }

  // Bottom tag on the time axis (crosshair time).
  function timeTag(ctx, th, x, text, box, fs) {
    ctx.save();
    ctx.font = font(th, fs, 600);
    var w = ctx.measureText(text).width + 10, h = fs + 8;
    var left = Math.max(box.left, Math.min(box.right - w, x - w / 2));
    ctx.fillStyle = th.axis;
    ctx.fillRect(left, box.bottom + 1, w, h);
    ctx.fillStyle = th.bg;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, left + 5, box.bottom + 1 + h / 2 + 0.5);
    ctx.restore();
  }

  // Dashed last-price line + its axis tag, coloured by the last revealed candle.
  function lastPrice(ctx, sc, th, k, box, fs, axes) {
    if (!k) return;
    var y = Math.round(sc.y(k.c)) + 0.5, col = k.c >= k.o ? th.bull : th.bear;
    ctx.save();
    ctx.strokeStyle = col; ctx.globalAlpha = 0.55; ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(box.left, y); ctx.lineTo(box.right, y); ctx.stroke();
    ctx.restore();
    if (axes) axisTag(ctx, th, y, TJR.util.fmtPrice(k.c), col, th.bg, box, fs);
  }

  // Crosshair lines, axis tags and an OHLC + time readout in the top-left corner.
  function crosshair(ctx, sc, th, hv, k, tf, box, fs, axes, readout) {
    var x = Math.round(sc.x(hv.i)) + 0.5, y = Math.round(hv.y) + 0.5;
    ctx.save();
    ctx.strokeStyle = th.axis; ctx.globalAlpha = 0.6; ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, box.top); ctx.lineTo(x, box.bottom);
    if (y >= box.top && y <= box.bottom) { ctx.moveTo(box.left, y); ctx.lineTo(box.right, y); }
    ctx.stroke();
    ctx.restore();
    if (axes) {
      if (y >= box.top && y <= box.bottom) axisTag(ctx, th, y, TJR.util.fmtPrice(TJR.util.roundTick(sc.price(y))), th.axis, th.bg, box, fs);
      if (k) timeTag(ctx, th, x, tf >= 1440 ? fmtDay(k.t) : TJR.sessions.fmtET(k.t), box, fs);
    }
    if (readout && k) ohlc(ctx, th, k, tf, box, fs);
  }

  function ohlc(ctx, th, k, tf, box, fs) {
    var col = k.c >= k.o ? th.bull : th.bear, P = TJR.util.fmtPrice;
    var parts = [['O', P(k.o)], ['H', P(k.h)], ['L', P(k.l)], ['C', P(k.c)]];
    ctx.save();
    ctx.font = font(th, fs);
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    var lh = fs + 5, x = box.left + 8, y = box.top + 6, maxW = box.right - box.left - 16;
    var wide = ctx.measureText('O ' + parts.map(function (p) { return p[1]; }).join('  H ')).width + 30 <= maxW;
    var rows = wide ? [parts] : [parts.slice(0, 2), parts.slice(2)];
    var stamp = fmtStamp(k.t, tf);
    var w = Math.max(ctx.measureText(stamp).width, rows.reduce(function (m, r) {
      return Math.max(m, r.reduce(function (s, p) { return s + ctx.measureText(p[0] + ' ' + p[1] + '  ').width; }, 0));
    }, 0));
    ctx.globalAlpha = 0.82; ctx.fillStyle = th.bg;
    ctx.fillRect(x - 5, y - 4, Math.min(w + 10, maxW + 10), lh * (rows.length + 1) + 6);
    ctx.globalAlpha = 1;
    rows.forEach(function (r, ri) {
      var cx = x;
      r.forEach(function (p) {
        ctx.fillStyle = th.axis; ctx.fillText(p[0], cx, y + ri * lh);
        cx += ctx.measureText(p[0] + ' ').width;
        ctx.fillStyle = col; ctx.fillText(p[1], cx, y + ri * lh);
        cx += ctx.measureText(p[1] + '  ').width;
      });
    });
    ctx.fillStyle = th.axis;
    ctx.fillText(stamp, x, y + rows.length * lh);
    ctx.restore();
  }

  chart.render = {
    DEFAULTS: DEFAULTS, VARS: VARS, readTheme: readTheme, font: font, fmtAxis: fmtAxis, fmtStamp: fmtStamp,
    priceLabels: priceLabels, timeLabels: timeLabels,
    grid: grid, candles: candles, priceAxis: priceAxis, timeAxis: timeAxis, axisTag: axisTag,
    lastPrice: lastPrice, crosshair: crosshair
  };
})(typeof window !== 'undefined' ? window : globalThis);
