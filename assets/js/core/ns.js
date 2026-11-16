/* TJR root namespace + shared helpers. Classic script: attaches to window.TJR. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var VIDEO = 'https://youtu.be/Vulini8xbB0';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // Snap a price to the instrument tick (default 0.25), avoiding float dust.
  function roundTick(p, tick) {
    var t = tick || 0.25;
    return Math.round(Math.round(p / t) * t * 1e6) / 1e6;
  }

  // 30012.25 -> '30,012.25' (always 2 decimals, en-US grouping, no Intl dependency).
  function fmtPrice(p) {
    var neg = p < 0;
    var parts = Math.abs(p).toFixed(2).split('.');
    var int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + int + '.' + parts[1];
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // Timestamp chip data for a clip second mark: label MM:SS + deep link.
  function tsChip(sec) {
    var s = Math.max(0, Math.floor(sec));
    return {
      label: pad2(Math.floor(s / 60)) + ':' + pad2(s % 60),
      href: VIDEO + '?t=' + s
    };
  }

  TJR.util = { clamp: clamp, lerp: lerp, roundTick: roundTick, fmtPrice: fmtPrice, tsChip: tsChip };
})(typeof window !== 'undefined' ? window : globalThis);
