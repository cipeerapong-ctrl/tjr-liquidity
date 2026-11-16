/* Seeded RNG (mulberry32). Same seed -> same sequence, so scenarios replay exactly. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};

  function make(seed) {
    var a = (seed >>> 0) || 0;

    function next() {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    function range(lo, hi) { return lo + next() * (hi - lo); }
    // inclusive on both ends
    function int(lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); }
    function pick(arr) { return arr[Math.floor(next() * arr.length)]; }
    function chance(p) { return next() < p; }
    // standard normal via Box-Muller; 1 - next() keeps the log argument in (0,1]
    function gauss() {
      var u = 1 - next();
      var v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    return { next: next, range: range, int: int, pick: pick, chance: chance, gauss: gauss };
  }

  TJR.rng = { make: make };
})(typeof window !== 'undefined' ? window : globalThis);
