/* Chart scale: bar index <-> x and price <-> y for one plot box, plus "nice" price ticks.
   Pure math, no DOM. Bars sit in equal slots: bar i is centred in slot (i - from), so bar(x(i)) === i
   for every i in [from, to]. bar(x) is the plain inverse (not clamped); the chart clamps to its data. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var chart = TJR.chart = TJR.chart || {};

  function make(o) {
    var w = +o.w || 0, h = +o.h || 0;
    var padL = +o.padL || 0, padR = +o.padR || 0, padT = +o.padT || 0, padB = +o.padB || 0;
    var from = Math.floor(o.from || 0), to = Math.max(from, Math.floor(o.to == null ? from : o.to));
    var min = +o.min, max = +o.max;
    if (!(max > min)) { var mid = isFinite(min) ? min : 0; min = mid - 1; max = mid + 1; }   // flat range
    var pw = Math.max(1, w - padL - padR), ph = Math.max(1, h - padT - padB);
    var count = to - from + 1, slot = pw / count, span = max - min;
    // candle body: 70% of its slot, at least 1 px, never wider than the slot
    var barW = Math.min(slot, Math.max(1, Math.floor(slot * 0.7)));

    return {
      w: w, h: h, padL: padL, padR: padR, padT: padT, padB: padB,
      from: from, to: to, min: min, max: max, slot: slot, barW: barW,
      left: padL, right: padL + pw, top: padT, bottom: padT + ph,
      x: function (i) { return padL + (i - from + 0.5) * slot; },
      bar: function (x) { return from + Math.floor((x - padL) / slot); },
      y: function (p) { return padT + (max - p) / span * ph; },
      price: function (y) { return max - (y - padT) / ph * span; }
    };
  }

  // Nice steps 0.25 / 0.5 / 1 / 2.5 / 5 / 10 / 25 / 50 / 100 ... (the 0.25 tick is the floor).
  function niceStep(range, approx) {
    var want = range / Math.max(1, approx);
    if (want <= 0.25) return 0.25;
    if (want <= 0.5) return 0.5;
    var e = Math.pow(10, Math.floor(Math.log10(want)));
    var m = [1, 2.5, 5, 10];
    for (var k = 0; k < m.length; k++) if (m[k] * e >= want - 1e-9) return m[k] * e;
    return 10 * e;
  }

  // Ascending multiples of a nice step inside [min, max], about approxCount of them.
  function ticks(min, max, approxCount) {
    if (!(max > min)) return isFinite(min) ? [min] : [];
    var step = niceStep(max - min, approxCount || 5);
    var out = [], k0 = Math.ceil(min / step - 1e-9), k1 = Math.floor(max / step + 1e-9);
    for (var k = k0; k <= k1; k++) out.push(Math.round(k * step * 1e6) / 1e6);
    return out;
  }

  chart.scale = { make: make, ticks: ticks, niceStep: niceStep };
})(typeof window !== 'undefined' ? window : globalThis);
