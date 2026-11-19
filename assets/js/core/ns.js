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

  // Timestamp chip data for a second mark in a video. clip 0/undefined = the main clip: label MM:SS.
  // clip n (1..16, a playlist video, see TJR.sources) gives label "#n MM:SS" and that video's own link.
  function tsChip(sec, clip) {
    var s = Math.max(0, Math.floor(sec));
    var mmss = pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
    var n = clip == null ? 0 : clip;
    if (!n) return { label: mmss, href: VIDEO + '?t=' + s, clip: 0 };
    return { label: '#' + n + ' ' + mmss, href: TJR.sources.href(n, s), clip: n };
  }

  TJR.util = { clamp: clamp, lerp: lerp, roundTick: roundTick, fmtPrice: fmtPrice, tsChip: tsChip };
})(typeof window !== 'undefined' ? window : globalThis);
