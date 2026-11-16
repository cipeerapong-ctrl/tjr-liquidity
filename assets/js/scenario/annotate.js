/* Truth -> chart overlays (shapes from the chart engine, Task 7). Nothing is shown before it is knowable:
   every overlay carries appearAt (a level when its swing pair has closed or its session has ended, a sweep
   at the sweep bar, the entry zone at entryWindow.from), and annotate(built, {upTo}) returns only overlays
   with appearAt <= upTo, with states and right edges as they stand at bar upTo. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};

  var KIND = { liq: 'liq', stack: 'stack', session: 'session', htf: 'htf', pdh: 'htf', pdl: 'htf' };
  var SESSION = { asia: 'Asia', london: 'London', ny: 'New York' };
  function isHighTag(t) { return t === 'H' || t === 'HH' || t === 'LH'; }

  function annotate(built, opts) {
    var T = built.truth, cs = built.candles, n = cs.length;
    var upTo = opts && opts.upTo != null ? Math.min(opts.upTo, n - 1) : n - 1;
    var out = [];
    function add(o) { if (o.appearAt <= upTo) out.push(o); }
    function edge(sweptAt) { return sweptAt != null && sweptAt <= upTo ? sweptAt : upTo; }

    (T.sessions || []).forEach(function (s) {
      add({ id: 'box:' + s.name, type: 'box', from: s.from, to: s.to, low: s.low, high: s.high,
            label: SESSION[s.name] || s.name, kind: s.name, appearAt: s.to });
    });

    var levels = T.levels || [];
    levels.forEach(function (l) {
      add({ id: l.id, type: 'level', price: l.price, from: l.bar, to: edge(l.sweptAt), label: l.label,
            kind: KIND[l.kind] || 'liq', state: l.sweptAt != null && l.sweptAt <= upTo ? 'swept' : 'active',
            appearAt: l.known });
    });

    // stacked levels read as a trendline (F8.1/F8.3): first to last level of each stack group
    var groups = {};
    levels.forEach(function (l) { if (l.kind === 'stack' && l.group) (groups[l.group] = groups[l.group] || []).push(l); });
    Object.keys(groups).forEach(function (g) {
      var ls = groups[g].slice().sort(function (a, b) { return a.bar - b.bar; });
      if (ls.length < 2) return;
      var a = ls[0], b = ls[ls.length - 1];
      add({ id: 'trend:' + g, type: 'trend', a: { bar: a.bar, price: a.price }, b: { bar: b.bar, price: b.price },
            appearAt: Math.max.apply(null, ls.map(function (l) { return l.known; })) });
    });

    if (T.sweep) {
      var sl = levels.filter(function (l) { return l.id === T.sweep.levelId; })[0];
      var low = sl && sl.side === 'low', k = cs[T.sweep.bar];
      add({ id: 'sweep', type: 'marker', bar: T.sweep.bar, price: low ? k.l : k.h, shape: low ? 'up' : 'down',
            appearAt: T.sweep.bar });
    }

    if (T.entryWindow && T.target) {
      var w = T.entryWindow, long = T.side === 'long';
      var c = (T.structure || []).filter(function (p) { return p.bar === T.confirmBar; })[0];
      // price band: from the last rule swing on the other side before the confirm swing to the confirm swing
      var sw = TJR.swings.find(cs), opp = long ? sw.lows : sw.highs, far = null;
      opp.forEach(function (p) { if (p.i >= T.sweep.bar && p.pair[1] < T.confirmBar) far = p.price; });
      if (far == null) far = long ? cs[T.sweep.bar].l : cs[T.sweep.bar].h;
      add({ id: 'entry', type: 'zone', from: w.from, to: Math.min(w.to, upTo), low: long ? far : c.price,
            high: long ? c.price : far, kind: 'entry', appearAt: w.from });
      var tl = levels.filter(function (l) { return l.id === T.target.levelId; })[0];
      add({ id: 'target', type: 'level', price: T.target.price, from: w.from, to: edge(tl && tl.sweptAt), label: 'target',
            kind: 'target', state: tl && tl.sweptAt != null && tl.sweptAt <= upTo ? 'swept' : 'active', appearAt: w.from });
    }

    (T.structure || []).forEach(function (p) {
      add({ id: 'lbl:' + p.bar, type: 'label', bar: p.bar, price: p.price, text: p.tag,
            pos: isHighTag(p.tag) ? 'above' : 'below', appearAt: p.known });
    });
    return out;
  }

  TJR.annotate = annotate;
})(typeof window !== 'undefined' ? window : globalThis);
