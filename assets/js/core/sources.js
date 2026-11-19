/* TJR.sources: the video table (the main clip is clip 0, the 16 playlist clips are 1..16), the fact id ->
   video lookup, and the deep link for a second mark. Classic script, loads right after ns.js (TJR.util.tsChip
   and TJR.layout.chip read it when a clip number is given).

   Titles, dates and durations are the headers of docs/source/clip-facts.md and docs/source/playlist/<id>.md
   (tests/sources.test.js re-reads those headers and fails if this table drifts from them).

   TJR.sources.list              [{ clip, id, title, date, dur (seconds), main }]
   TJR.sources.byClip(n)         the row of clip n, or null
   TJR.sources.forFact(id)       'F7.7' -> clip 0; 'P8.19' -> clip 8; anything else (or an unknown clip) -> null
   TJR.sources.href(clip, sec)   https://youtu.be/<id>?t=<whole seconds>; clip 0/undefined = the main clip;
                                 an unknown clip number throws, so a chip can never point at the wrong video */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};

  var PREFIX = 'https://youtu.be/';
  var PLAYLIST = 'https://www.youtube.com/playlist?list=PLKE_22Jx497s5Q6ZX2pfDcDwCm_IyxR7e';

  var list = [
    { clip: 0, id: 'Vulini8xbB0', title: "The ONLY Liquidity Guide You'll Ever Need", date: '2026-07-21', dur: 2947, main: true },
    { clip: 1, id: 'TEp3a-7GUds', title: "TJR's Strategy Explained", date: '2026-01-17', dur: 2591, main: false },
    { clip: 2, id: 'hBnD6T1M4w8', title: 'Risk Management & Psychology', date: '2026-01-16', dur: 1117, main: false },
    { clip: 3, id: 'ironJFzNBic', title: 'How To Find Daily Bias', date: '2026-01-14', dur: 1856, main: false },
    { clip: 4, id: '52nxvJKM57U', title: 'Funded Accounts Explained', date: '2026-01-13', dur: 1177, main: false },
    { clip: 5, id: 'L4xz2o23aPQ', title: 'Time Theory Explained', date: '2026-01-12', dur: 661, main: false },
    { clip: 6, id: '7dTQA0t8SH0', title: 'SMT Divergence Explained', date: '2026-01-11', dur: 964, main: false },
    { clip: 7, id: 'joe_XTCn5Bs', title: 'Equilibrium Explained', date: '2026-01-10', dur: 864, main: false },
    { clip: 8, id: '4sRDnVmLcMk', title: 'Inverse Fair Value Gaps Explained', date: '2026-01-09', dur: 1351, main: false },
    { clip: 9, id: 'PlsHO33j6B8', title: 'Advanced Imbalance Concepts', date: '2026-01-08', dur: 1384, main: false },
    { clip: 10, id: 'xX5LTSJ5wwM', title: 'Fair Value Gaps Explained', date: '2026-01-07', dur: 2023, main: false },
    { clip: 11, id: 'Zzk864cVJek', title: 'Break of Structure Explained', date: '2026-01-06', dur: 743, main: false },
    { clip: 12, id: 'AGmAVyAuBE0', title: 'Advanced Liquidity Concepts', date: '2026-01-05', dur: 3224, main: false },
    { clip: 13, id: 'crMqxB_nHhk', title: 'Liquidity Explained', date: '2026-01-04', dur: 2139, main: false },
    { clip: 14, id: '8qwEmE1DwYw', title: 'How to Read a Candlestick Chart', date: '2026-01-03', dur: 2474, main: false },
    { clip: 15, id: 'R62RnJrKH3Q', title: 'What is Trading', date: '2026-01-02', dur: 1351, main: false },
    { clip: 16, id: '3GZgBBMzC_E', title: 'One Day or Day One', date: '2026-01-01', dur: 2396, main: false }
  ];

  function byClip(n) {
    return typeof n === 'number' && n % 1 === 0 && n >= 0 && n < list.length ? list[n] : null;
  }

  // 'F7.7' -> the main clip; 'P8.19' -> clip 8; anything else -> null
  function forFact(id) {
    var s = String(id == null ? '' : id), m;
    if (/^F\d+\.\d+$/.test(s)) return list[0];
    m = /^P(\d+)\.\d+$/.exec(s);
    return m ? byClip(Number(m[1])) : null;
  }

  function href(clip, sec) {
    var src = byClip(clip == null ? 0 : clip);
    if (!src) throw new RangeError('TJR.sources.href: unknown clip ' + clip);
    return PREFIX + src.id + '?t=' + Math.max(0, Math.floor(sec));
  }

  TJR.sources = { list: list, byClip: byClip, forFact: forFact, href: href, PLAYLIST: PLAYLIST, PREFIX: PREFIX };
})(typeof window !== 'undefined' ? window : globalThis);
