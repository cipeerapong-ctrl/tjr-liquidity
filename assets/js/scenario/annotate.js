/* Truth -> chart overlays (shapes from the chart engine, Task 7). Nothing is shown before it is knowable:
   every overlay carries appearAt (a level when its swing pair has closed or its session has ended, a sweep
   at the sweep bar, the entry zone at entryWindow.from), and annotate(built, {upTo}) returns only overlays
   with appearAt <= upTo, with states and right edges as they stand at bar upTo.
   annotate.confluence(built, {upTo?, show?, dir?}) adds the v2 shapes (fvg, bos, eq, band) from TJR.confluence. It
   runs the detectors on the candles up to upTo only, so a gap's state / stateAt / endAt, a break and an
   equilibrium box are exactly what was known at that bar: fvg appears at its third candle, bos at its breaking
   bar, eq at its knownAt (its end swing confirmed; null = no box yet), a window band at its first bar. */
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

  // ------------------------------------------------------------------ v2: confluence overlays

  var WINDOWS = [['manipulation', 'manipulation'], ['entry', 'entry']];
  function hhmm(t) { return TJR.sessions.fmtET(t); }

  function confluence(built, opts) {
    opts = opts || {};
    var cs = built.candles, n = cs.length, T = built.truth || {}, C = TJR.confluence;
    var upTo = opts.upTo != null ? Math.min(opts.upTo, n - 1) : n - 1;
    var show = opts.show || {};
    function on(k) { return show[k] !== false; }
    var seen = cs.slice(0, upTo + 1);                       // what is known at upTo, nothing after it
    var out = [];
    if (upTo < 0) return out;

    if (on('fvg')) {
      C.fvgs(seen).forEach(function (g) {
        var o = { id: 'fvg:' + g.i, type: 'fvg', from: g.from, to: g.to, low: g.low, high: g.high, dir: g.dir,
                  state: g.state, appearAt: g.to };
        if (g.stateAt != null) o.stateAt = g.stateAt;
        if (g.deletedAt != null) o.endAt = g.deletedAt;
        out.push(o);
      });
    }

    if (on('bos')) {
      C.bos(seen).forEach(function (e) {
        out.push({ id: 'bos:' + e.at, type: 'bos', price: e.level.price, from: e.level.i, at: e.at, dir: e.dir,
                   appearAt: e.at });
      });
    }

    if (on('eq')) {
      var dirs = opts.dir ? [opts.dir] : T.side === 'long' ? ['up'] : T.side === 'short' ? ['down'] : ['up', 'down'];
      var sw = TJR.swings.find(seen), ats = [];
      sw.highs.concat(sw.lows).forEach(function (p) { if (p.pair[1] <= upTo && ats.indexOf(p.pair[1]) < 0) ats.push(p.pair[1]); });
      ats.sort(function (a, b) { return a - b; });
      dirs.forEach(function (dir) {
        var prev = null;                                    // the box in force; the next one replaces it
        ats.forEach(function (at) {
          var r = C.eqRange(seen, { at: at, dir: dir });
          if (!r || (prev && prev.from === r.from && prev.to === r.to)) return;
          if (prev) prev.endAt = r.knownAt;
          prev = { id: 'eq:' + dir + ':' + r.from + '-' + r.to, type: 'eq', from: r.from, to: r.to, low: r.low,
                   high: r.high, dir: r.dir, appearAt: r.knownAt };
          out.push(prev);
        });
      });
    }

    if (on('windows')) {
      var tfSec = ((built.meta && built.meta.tf) || 5) * 60, days = {};
      cs.forEach(function (k) {
        var e = TJR.sessions.toET(k.t), key = e.y + '-' + e.mo + '-' + e.d;
        if (days[key]) return;
        var w = days[key] = TJR.sessions.nyWindows(k.t);
        WINDOWS.forEach(function (name) {
          var win = w[name[0]], from = -1, to = -1;
          for (var i = 0; i < n; i++) {
            if (cs[i].t + tfSec > win.from && from < 0 && cs[i].t < win.to) from = i;
            if (cs[i].t < win.to && cs[i].t + tfSec > win.from) to = i;
          }
          if (from < 0 || from > upTo) return;
          out.push({ id: 'band:' + win.from + ':' + name[0], type: 'band', from: from, to: Math.min(to, upTo),
                     label: hhmm(win.from) + '–' + hhmm(win.to) + ' ' + name[1], appearAt: from });
        });
      });
    }
    return out;
  }

  annotate.confluence = confluence;
  TJR.annotate = annotate;
})(typeof window !== 'undefined' ? window : globalThis);
