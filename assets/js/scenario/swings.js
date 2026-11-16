/* TJR two-candle swing rule (clip F2.1/F2.2).
   High at pair (k,k+1): candle k bullish (c>o) and k+1 bearish (c<o); price = max of the two highs.
   Low at pair (k,k+1): k bearish, k+1 bullish; price = min of the two lows.
   `i` is the candle holding that wick (k on a tie). A doji (c===o) is neither (our call, not in the clip). */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};

  function bull(c) { return c.c > c.o; }
  function bear(c) { return c.c < c.o; }

  // k = first candle of the pair (k, k+1)
  function isHigh(candles, k) {
    var a = candles[k], b = candles[k + 1];
    return !!(a && b && bull(a) && bear(b));
  }
  function isLow(candles, k) {
    var a = candles[k], b = candles[k + 1];
    return !!(a && b && bear(a) && bull(b));
  }

  function find(candles) {
    var highs = [], lows = [];
    for (var k = 0; k + 1 < candles.length; k++) {
      var a = candles[k], b = candles[k + 1];
      if (isHigh(candles, k)) {
        highs.push(b.h > a.h ? { i: k + 1, price: b.h, pair: [k, k + 1] }
                             : { i: k, price: a.h, pair: [k, k + 1] });
      } else if (isLow(candles, k)) {
        lows.push(b.l < a.l ? { i: k + 1, price: b.l, pair: [k, k + 1] }
                            : { i: k, price: a.l, pair: [k, k + 1] });
      }
    }
    return { highs: highs, lows: lows };
  }

  // points: [{i, price, type:'high'|'low'}] in time order -> same points plus `tag`.
  // Highs compare to the previous high (HH if higher, else LH); lows to the previous low
  // (HL if higher, else LL). First of each side is plain H / L.
  function label(points) {
    var prev = { high: null, low: null };
    return points.map(function (p) {
      var before = prev[p.type];
      var tag;
      if (p.type === 'high') tag = before === null ? 'H' : (p.price > before ? 'HH' : 'LH');
      else tag = before === null ? 'L' : (p.price > before ? 'HL' : 'LL');
      prev[p.type] = p.price;
      var out = {};
      for (var key in p) if (Object.prototype.hasOwnProperty.call(p, key)) out[key] = p[key];
      out.tag = tag;
      return out;
    });
  }

  TJR.swings = { find: find, isHigh: isHigh, isLow: isLow, label: label };
})(typeof window !== 'undefined' ? window : globalThis);
