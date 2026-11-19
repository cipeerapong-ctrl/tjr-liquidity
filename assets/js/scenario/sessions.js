/* Sessions and time (clip F7.7). Public clock for the site: US Eastern (America/New_York DST rules,
   no Intl, so it behaves the same in every browser and in Node tests) and Thailand (UTC+7, no DST).
   Times in = unix seconds UTC. ET wall-clock in = (y, mo, d, h, mi).
   Windows are ET minutes after midnight:
     Asia 18:00-03:00, London 03:00-08:30, NY pre-market 08:30-09:30, NY 09:30-17:00, spread hour 17:00-18:00.
   Weekend = Fri 17:00 -> Sun 18:00 ET: market hours, not a system rule.
   nyWindows: the New York day windows from the playlist time clip (P5.12-P5.19), DST-aware through etToUtc. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};

  var HOUR = 3600, DAY = 86400, THAI_OFFSET = 7 * HOUR;
  var NY_OPEN_MIN = 9 * 60 + 30;

  var WINDOWS = {
    asia:     { from: 18 * 60,      to: 3 * 60 },       // wraps midnight
    london:   { from: 3 * 60,       to: 8 * 60 + 30 },
    'ny-pre': { from: 8 * 60 + 30,  to: 9 * 60 + 30 },
    ny:       { from: 9 * 60 + 30,  to: 17 * 60 },
    spread:   { from: 17 * 60,      to: 18 * 60 }
  };

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // n-th Sunday (1-based) of month m0 (0-based) in year y -> day of month
  function nthSunday(y, m0, n) {
    var dow = new Date(Date.UTC(y, m0, 1)).getUTCDay();
    return 1 + ((7 - dow) % 7) + 7 * (n - 1);
  }

  // DST: 2nd Sunday of March 02:00 local (07:00Z) to 1st Sunday of November 02:00 local (06:00Z)
  function etOffsetHours(utcSec) {
    var y = new Date(utcSec * 1000).getUTCFullYear();
    var start = Date.UTC(y, 2, nthSunday(y, 2, 2), 7) / 1000;
    var end = Date.UTC(y, 10, nthSunday(y, 10, 1), 6) / 1000;
    return utcSec >= start && utcSec < end ? -4 : -5;
  }

  function toET(utcSec) {
    var d = new Date((utcSec + etOffsetHours(utcSec) * HOUR) * 1000);
    return {
      y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(),
      h: d.getUTCHours(), mi: d.getUTCMinutes(), dow: d.getUTCDay()
    };
  }

  function fmtET(utcSec) {
    var e = toET(utcSec);
    return pad2(e.h) + ':' + pad2(e.mi);
  }

  function fmtThai(utcSec) {
    var d = new Date((utcSec + THAI_OFFSET) * 1000);
    return pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes());
  }

  // ET wall clock -> utc seconds. The repeated fall-back hour resolves to the earlier instant (EDT);
  // a wall time inside the spring-forward gap resolves one hour later (the clock after the jump).
  function etToUtc(y, mo, d, h, mi) {
    var wall = Date.UTC(y, mo - 1, d, h, mi || 0) / 1000;
    var edt = wall + 4 * HOUR, est = wall + 5 * HOUR;
    if (etOffsetHours(edt) === -4) return edt;
    if (etOffsetHours(est) === -5) return est;
    return est;
  }

  // Which window a moment falls in, read from the ET clock.
  function which(utcSec) {
    var e = toET(utcSec), m = e.h * 60 + e.mi;
    if (e.dow === 6) return 'weekend';
    if (e.dow === 0 && m < WINDOWS.asia.from) return 'weekend';       // Sunday until 18:00
    if (e.dow === 5 && m >= WINDOWS.spread.from) return 'weekend';    // Friday from 17:00
    if (m >= WINDOWS.asia.from || m < WINDOWS.asia.to) return 'asia';
    if (m < WINDOWS.london.to) return 'london';
    if (m < WINDOWS['ny-pre'].to) return 'ny-pre';
    if (m < WINDOWS.ny.to) return 'ny';
    return 'spread';
  }

  // Next Mon-Fri 09:30 ET strictly after utcSec.
  function nextNyOpen(utcSec) {
    var e = toET(utcSec);
    var day = Date.UTC(e.y, e.mo - 1, e.d) / 1000;     // ET calendar date as a UTC-midnight marker
    for (var i = 0; i < 8; i++) {
      var c = new Date((day + i * DAY) * 1000);
      var dow = c.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      var t = etToUtc(c.getUTCFullYear(), c.getUTCMonth() + 1, c.getUTCDate(), NY_OPEN_MIN / 60 | 0, NY_OPEN_MIN % 60);
      if (t > utcSec) return t;
    }
    throw new Error('sessions.nextNyOpen: no weekday open found');   // unreachable
  }

  // New York day windows (P5.12-P5.19), all ET: open 09:30, manipulation 09:30-09:50, entry 09:50-10:10,
  // his own cut-off 10:30, PM 13:00. Returns utc seconds for the ET calendar day that utcSec falls in.
  function nyWindows(utcSec) {
    var e = toET(utcSec);
    function at(h, mi) { return etToUtc(e.y, e.mo, e.d, h, mi); }
    return {
      open: at(9, 30),
      manipulation: { from: at(9, 30), to: at(9, 50) },
      entry: { from: at(9, 50), to: at(10, 10) },
      cutoff: at(10, 30),
      pm: at(13, 0)
    };
  }

  TJR.sessions = {
    WINDOWS: WINDOWS,
    etOffsetHours: etOffsetHours,
    toET: toET,
    fmtET: fmtET,
    fmtThai: fmtThai,
    which: which,
    etToUtc: etToUtc,
    nextNyOpen: nextNyOpen,
    nyWindows: nyWindows
  };
})(typeof window !== 'undefined' ? window : globalThis);
