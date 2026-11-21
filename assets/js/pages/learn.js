/* TJR Liquidity: the course page controller (Task 10). Classic script, after the engine, layout and motion.

   1. pure helpers on TJR.learn (no DOM, tested in Node by tests/learn.test.js):
      pairFor / pairList / stepPair   the two-candle rule for any pair of candles (module 2)
      drawdown                        the adverse move after a buy (module 6)
      quizState / countDone           the 2-question self-checks and the rail's count
      dstDates / sessionTable         the sessions table, from TJR.sessions only (module 7)
      simBuild                        the two stylised "จำลอง" charts of module 5
   2. page: layout, the chart slots (a chart exists only near the screen, at most 4 at once), the module
      charts (players over TJR.scenarios, the pair explorer, the order stack), the sessions table, the
      self-checks (TJR.store keys learn.m1 ... learn.m8 -> tjr.learn.m1 ...), the rail, the heading reveal.
   Every chart is built with TJR.scenarios.safeBuild (or simBuild) and annotated with TJR.annotate. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var doc = global.document;
  var L = TJR.learn = TJR.learn || {};

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function rt(p) { return TJR.util.roundTick(p, 0.25); }

  // ================================================================ 1 · pure helpers

  function dir(c) { return c.c > c.o ? 'up' : c.c < c.o ? 'down' : 'flat'; }

  // The pair the pointer is on. i = the bar under the pointer, side < 0 = the pointer is left of its centre
  // (pair i-1, i), else right of it (pair i, i+1). Returns { k, dirs, kind: 'high'|'low'|null, at, price, lo, hi }
  // where `at` is the candle holding the extreme wick (the first one on a tie, as TJR.swings.find has it).
  function pairFor(cs, i, side) {
    var n = cs.length;
    if (n < 2) return null;
    var k = clamp(side < 0 ? i - 1 : i, 0, n - 2), a = cs[k], b = cs[k + 1];
    var kind = TJR.swings.isHigh(cs, k) ? 'high' : TJR.swings.isLow(cs, k) ? 'low' : null;
    var out = { k: k, dirs: [dir(a), dir(b)], kind: kind, at: null, price: null,
                lo: Math.min(a.l, b.l), hi: Math.max(a.h, b.h) };
    if (kind === 'high') { out.at = b.h > a.h ? k + 1 : k; out.price = cs[out.at].h; }
    if (kind === 'low') { out.at = b.l < a.l ? k + 1 : k; out.price = cs[out.at].l; }
    return out;
  }
  // every pair that forms a high or a low by the rule: [{ k, kind, at, price }] in time order
  function pairList(cs) {
    var f = TJR.swings.find(cs), out = [];
    f.highs.forEach(function (p) { out.push({ k: p.pair[0], kind: 'high', at: p.i, price: p.price }); });
    f.lows.forEach(function (p) { out.push({ k: p.pair[0], kind: 'low', at: p.i, price: p.price }); });
    return out.sort(function (x, y) { return x.k - y.k; });
  }
  // the next (d > 0) or previous (d < 0) pair of the list from pair start k, or null
  function stepPair(list, k, d) {
    var best = null;
    list.forEach(function (p) {
      if (d > 0 ? p.k > k : p.k < k) { if (!best || (d > 0 ? p.k < best.k : p.k > best.k)) best = p; }
    });
    return best;
  }

  // The deepest the price goes under the close of the entry bar, on the bars after it up to bar upTo (points, never negative).
  function drawdown(cs, entryBar, upTo) {
    var e = cs[entryBar].c, lo = e;
    for (var j = entryBar + 1; j <= Math.min(upTo, cs.length - 1); j++) if (cs[j].l < lo) lo = cs[j].l;
    return rt(e - lo);
  }

  // ---- self-checks: picks = [pick|null, pick|null]; rights = [index, index]
  function quizState(picks, rights) {
    var right = rights.map(function (r, i) { return picks && picks[i] === r; });
    return { right: right, done: right.every(Boolean) };
  }
  function countDone(all, rights) {      // all: { m1: [p, p], ... }, rights: { m1: [r, r], ... }
    var n = 0;
    Object.keys(rights).forEach(function (m) { if (quizState(all[m] || [], rights[m]).done) n++; });
    return n;
  }

  // ---- sessions (module 7): everything from TJR.sessions
  var MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function thaiDate(d) { return d.d + ' ' + MON[d.mo - 1] + ' ' + d.y; }
  // the day US clocks go forward and back in a year, found by walking the year with sessions.etOffsetHours
  function dstDates(S, year) {
    var start = null, end = null, prev = S.etOffsetHours(Date.UTC(year, 0, 1, 12) / 1000);
    for (var d = 1; d < 366; d++) {
      var ms = Date.UTC(year, 0, 1 + d, 12), o = S.etOffsetHours(ms / 1000);
      if (o === prev) continue;
      var dt = new Date(ms), day = { y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
      if (o > prev) start = day; else end = day;
      prev = o;
    }
    return { start: start, end: end };
  }
  function hm(min) { return pad2(Math.floor(min / 60) % 24) + ':' + pad2(min % 60); }
  var ROWS = [
    { id: 'asia', name: 'Asia' }, { id: 'london', name: 'London' }, { id: 'ny-pre', name: 'NY pre-market' },
    { id: 'ny', name: 'New York' }, { id: 'spread', name: 'Spread hour' }
  ];
  // Thai clock text of an ET window that starts on ET date (y, mo, d); "+1" when it falls on a later Thai day
  function thaiWindow(S, y, mo, d, w) {
    var dur = (w.to - w.from + 1440) % 1440;
    var t0 = S.etToUtc(y, mo, d, Math.floor(w.from / 60), w.from % 60), t1 = t0 + dur * 60;
    var base = Math.floor(Date.UTC(y, mo - 1, d) / 86400000);
    function one(t) {
      var day = Math.floor((t + 7 * 3600) / 86400) - base;
      return S.fmtThai(t) + (day > 0 ? ' +' + day : '');
    }
    return one(t0) + ' – ' + one(t1);
  }
  // rows for the table: ET window, Thai text with US daylight time (July) and with US standard time (January)
  function sessionTable(S, year) {
    var sum = { y: year, mo: 7, d: 15 }, win = { y: year, mo: 1, d: 15 };
    function off(day) { return S.etOffsetHours(S.etToUtc(day.y, day.mo, day.d, 12, 0)); }
    return {
      summerOffset: off(sum), winterOffset: off(win), dst: dstDates(S, year),
      rows: ROWS.map(function (r) {
        var w = S.WINDOWS[r.id];
        return { id: r.id, name: r.name, et: hm(w.from) + '–' + hm(w.to),
                 summer: thaiWindow(S, sum.y, sum.mo, sum.d, w), winter: thaiWindow(S, win.y, win.mo, win.d, w) };
      })
    };
  }

  // ---- module 5: two stylised charts (a monthly drop, a 2020-style crash). Not the clip's charts: a few
  // scripted swing lows (a stack), a plunge under them, then a rally. Prices are in units of the volatility.
  var SIMS = {
    tariff: { n: 78, u: 14, wps: [[0, 12, 'pass'], [8, 3, 'low'], [19, 12, 'high'], [30, 3.4, 'low'], [42, 14, 'high'],
      [50, 9.5, 'pass'], [56, -7, 'low'], [66, 6, 'high'], [74, 18, 'pass']], stack: [8, 30] },
    crash: { n: 94, u: 14, wps: [[0, 6, 'pass'], [10, 3, 'low'], [21, 11, 'high'], [31, 5, 'low'], [42, 16, 'high'],
      [52, 8.5, 'low'], [60, 22, 'high'], [66, -4, 'low'], [76, 10, 'high'], [90, 28, 'pass']], stack: [10, 31, 52] }
  };
  function simOnce(kind, seed) {
    var D = SIMS[kind], r = TJR.rng.make(seed), ref = 12000;
    var wps = D.wps.map(function (w) { return { bar: w[0], price: rt(ref + w[1] * D.u), kind: w[2] }; });
    var cs = TJR.gen.path(r, wps, { bars: D.n, vol: D.u, wick: 0.5 * D.u, chop: 0.5, tick: 0.25 });
    var bad = TJR.gen.validate(cs, 0.25);
    if (bad.length) throw new Error(bad[0]);
    var t0 = TJR.sessions.etToUtc(2025, 1, 6, 18, 0);
    cs = TJR.gen.stamp(cs, t0, 1440);
    var lows = TJR.swings.find(cs).lows, ov = [], first = null, topStack = -Infinity;
    D.stack.forEach(function (bar) {
      var price = rt(ref + D.wps.filter(function (w) { return w[0] === bar; })[0][1] * D.u), hit = null;
      lows.forEach(function (p) { if (p.pair[0] === bar && p.price === price) hit = p; });
      if (!hit) throw new Error('stack low at bar ' + bar + ' lost');
      var swept = null;
      for (var j = hit.i + 1; j < cs.length; j++) if (cs[j].l < price) { swept = j; break; }
      if (swept == null) throw new Error('stack low at bar ' + bar + ' never taken');
      if (first == null || swept < first) first = swept;
      topStack = Math.max(topStack, price);
      ov.push({ id: 'sl' + bar, type: 'level', price: price, from: hit.i, to: swept, label: 'low ที่ซ้อนกัน', kind: 'stack',
                state: 'swept', appearAt: hit.pair[1] + 1 });
    });
    if (!(cs[cs.length - 1].c > topStack)) throw new Error('no rally above the stack');
    ov.push({ id: 'sweep', type: 'marker', bar: first, price: cs[first].l, shape: 'up', appearAt: first });
    return { candles: cs, meta: { id: 'SIM-' + kind, instrument: 'NQ', tf: 1440, tick: 0.25, seed: seed, vol: D.u },
             truth: { levels: [], sessions: [], structure: [], sweep: { bar: first, levelId: null } },
             sim: { overlays: ov, sweep: first } };
  }
  // retries the next seeds when a script is unlucky (gen.path throws on rare contradictions)
  function simBuild(kind, seed) {
    var s = seed, last = '';
    for (var a = 0; a < 12; a++, s = (s * 48271) % 2147483647 || 1) {
      try { return simOnce(kind, s); } catch (e) { last = e && e.message; }
    }
    throw new Error('simBuild ' + kind + ': ' + last);
  }

  L.pairFor = pairFor; L.pairList = pairList; L.stepPair = stepPair; L.drawdown = drawdown;
  L.quizState = quizState; L.countDone = countDone; L.dstDates = dstDates; L.sessionTable = sessionTable;
  L.thaiDate = thaiDate; L.simBuild = simBuild;

  if (!doc || !TJR.layout || !TJR.chart || !TJR.chart.create) return;   // Node (tests): helpers only

  // ================================================================ 2 · page
  var M = TJR.motion.init();
  var N_SC = TJR.scenarios.list.length;                    // every scenario (Level 1 and Level 2), never a typed count
  TJR.layout.mount({
    page: 'learn',
    close: { title: 'ไปขั้น 2: Confluences', line: 'liquidity ให้แค่โอกาส ตัวยืนยันอยู่ในขั้นถัดไป ฝึกอ่านกราฟจริงได้ที่หน้าสถานการณ์', label: 'ไปขั้น 2', href: 'confluences.html' }
  });

  var TF_NAME = { 1: '1m', 5: '5m', 15: '15m', 60: '1H', 240: '4H', 1440: 'D' };
  var MAX_LIVE = 4;
  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function stamp(t) { return TJR.sessions.fmtET(t) + ' ET · ' + TJR.sessions.fmtThai(t) + ' น.'; }
  function build(id, seed, opts) { return TJR.scenarios.safeBuild(TJR.scenarios.get(id), seed, opts || {}); }
  // the first bar worth starting a playback on: stacked / liquidity levels known, well before the sweep
  function startBar(b) {
    var T = b.truth, n = b.candles.length, sweep = T.sweep ? T.sweep.bar : n - 1, known = 0;
    (T.levels || []).forEach(function (l) { if (l.known != null && l.known < sweep && l.known > known) known = l.known; });
    return clamp(Math.max(known + 1, Math.floor(n * 0.22)), 0, Math.max(0, sweep - 6));
  }
  function setPressed(btn, on) { btn.setAttribute('aria-pressed', String(!!on)); }

  // ---------------------------------------------------------------- scenario player (modules 1, 4, 5, 6, 7, 8)
  var SEEDS = { S01: 1, S02: 5, S03: 4, S04: 2, S05: 3, S06: 6, S07: 7, S08: 2, S09: 3, S10: 5, S11: 4, S12: 2, S13: 3, S14: 6, tariff: 3, crash: 5 };
  var PHASES = ['sweep', 'confirm', 'entry'];

  // cfg: { label, bps, interactive, axes, phases, buy, build(id, state) -> { built, overlays, title, chips, tf } }
  function makePlayer(fig, cfg, S) {
    var host = $('.chart-frame__canvas', fig);
    var ch = TJR.chart.create(host, { label: cfg.label, interactive: cfg.interactive !== false, axes: cfg.axes !== false });
    var el = {
      sym: $('[data-k="sym"]', fig), tf: $('[data-k="tf"]', fig), title: $('[data-k="title"]', fig), meta: $('[data-k="meta"]', fig),
      chips: $('[data-k="chips"]', fig), play: $('[data-act="play"]', fig), ann: $('[data-act="ann"]', fig),
      dd: $('[data-k="dd"]', fig), phases: $$('.phase li', fig)
    };
    var cur = null, run = 0, playing = false, dead = false;

    function defaultBuild(id) {
      var def = TJR.scenarios.get(id), b = build(id, S.seeds[id] || SEEDS[id] || 1);
      return { built: b, overlays: TJR.annotate(b, {}), title: id + ' · ' + def.title, chips: def.clip, tf: TF_NAME[b.meta.tf] };
    }
    function setPlay(label, on) {
      if (!el.play) return;
      var lab = $('[data-k="lab"]', el.play);
      if (lab) lab.textContent = label;
      el.play.setAttribute('data-state', on ? 'on' : 'off');
    }
    function onBar(i) {
      var b = cur.built, T = b.truth, k = b.candles[clamp(i, 0, b.candles.length - 1)];
      if (el.meta) el.meta.textContent = cfg.axes === false ? '' : (k ? stamp(k.t) : '');
      if (el.phases.length) {
        var marks = { sweep: T.sweep && T.sweep.bar, confirm: T.confirmBar, entry: T.entryWindow && T.entryWindow.from };
        el.phases.forEach(function (li) {
          var at = marks[li.getAttribute('data-phase')];
          li.classList.toggle('is-on', at != null && i >= at);
        });
      }
      if (el.dd && S.buy) {
        var d = i >= S.buy.bar ? drawdown(b.candles, S.buy.bar, i) : 0;
        el.dd.textContent = d > 0 ? '−' + TJR.util.fmtPrice(d) + ' pts' : '0';
        var pill = el.dd.closest('.score-pill');
        if (pill) pill.setAttribute('data-tone', d > 0 ? 'bad' : '');
      }
    }
    function chipsHtml(secs) {
      // a trade scenario's def.clip mixes main-clip seconds and playlist chips {clip, sec}
      return (secs || []).map(function (s) { return s && typeof s === 'object' ? TJR.layout.chip(s.sec, s.clip) : TJR.layout.chip(s); }).join('');
    }
    function load(id) {
      S.id = id;
      cur = (cfg.build || defaultBuild)(id, S);
      var b = cur.built;
      ch.setData(b);
      ch.setOverlays(S.ann === false ? [] : cur.overlays);
      if (el.sym) el.sym.textContent = b.meta.instrument;
      if (el.tf) { el.tf.textContent = cur.tf || ''; el.tf.hidden = !cur.tf; }
      if (el.title) el.title.textContent = cur.title;
      if (el.chips) el.chips.innerHTML = chipsHtml(cur.chips);
      $$('[data-sc]', fig).forEach(function (btn) { setPressed(btn, btn.getAttribute('data-sc') === id); });
      $$('[data-tf]', fig).forEach(function (btn) { setPressed(btn, Number(btn.getAttribute('data-tf')) === b.meta.tf); });
      if (cfg.onLoad) cfg.onLoad(id);
      if (S.buy) S.buy = null;
      if (el.dd) { el.dd.textContent = '0'; var p = el.dd.closest('.score-pill'); if (p) p.setAttribute('data-tone', ''); }
      if (el.ann) setPressed(el.ann, S.ann !== false);
    }
    function toBase() {                                  // a rolled-up series has other bar indices: start from the base series
      var i = ch.info();
      if (i.tf === i.baseTf) return;
      ch.setTimeframe(i.baseTf);
      $$('[data-tf]', fig).forEach(function (btn) { setPressed(btn, Number(btn.getAttribute('data-tf')) === i.baseTf); });
      if (el.tf) el.tf.textContent = TF_NAME[i.baseTf] || '';
    }
    function atStart() {
      run++; playing = false;
      toBase();
      var from = startBar(cur.built);
      ch.reveal(from);
      onBar(from);
      setPlay('เล่น', false);
    }
    function finalFrame() {
      run++; playing = false;
      var n = cur.built.candles.length;
      ch.reveal(n - 1);
      onBar(n - 1);
      S.done = true;
      setPlay('เล่นใหม่', false);
    }
    function play(to) {
      var my = ++run, n = cur.built.candles.length;
      // never let the engine pick `from`: at its end it falls back to bar 0 and regrows the chart from nothing
      var at = ch.info(), last = Math.min(to == null ? n - 1 : to, at.bars - 1);
      if (at.revealed >= last) { toBase(); var f0 = startBar(cur.built); ch.reveal(f0); onBar(f0); at = ch.info(); last = Math.min(to == null ? n - 1 : to, at.bars - 1); }
      playing = true;
      setPlay('หยุด', true);
      return ch.play({ from: at.revealed, to: last, barsPerSec: cfg.bps || 8, onBar: onBar }).then(function (done) {
        if (my !== run || dead) return done;
        playing = false;
        if (done && (to == null || to >= n - 1)) { S.done = true; setPlay('เล่นใหม่', false); } else setPlay('เล่น', false);
        return done;
      });
    }
    function toggle() {
      if (playing) { run++; playing = false; ch.pause(); setPlay('เล่น', false); return; }
      var info = ch.info();
      if (info.revealed >= info.bars - 1) atStart();
      S.started = true;
      play();
    }
    function buy() {                                     // module 6: press buy at the sweep, watch what follows
      var b = cur.built, bar = b.truth.sweep.bar, price = b.candles[bar].c;
      S.buy = { bar: bar, price: price };
      ch.removeOverlay('buy'); ch.removeOverlay('buy-dot');
      ch.addOverlay({ id: 'buy', type: 'level', price: price, from: bar, label: 'ซื้อตรงนี้', kind: 'htf', state: 'active', appearAt: bar });
      ch.addOverlay({ id: 'buy-dot', type: 'marker', bar: bar, price: price, shape: 'dot', color: '#2fcf86', appearAt: bar });
      var from = Math.max(0, bar - 24);
      ch.reveal(from);
      onBar(from);
      S.started = true;
      play();
    }

    try { load(S.id); } catch (e) { ch.destroy(); throw e; }
    var api = {
      destroy: function () { dead = true; run++; ch.destroy(); },
      autoplay: function () {
        if (S.started || dead) return;
        S.started = true;
        if (M.reduced) finalFrame(); else { atStart(); play(); }
      },
      remount: function () {
        if (S.done || M.reduced) finalFrame(); else atStart();
      },
      reduced: function () { if (M.reduced) finalFrame(); },
      act: function (name, arg) {
        if (name === 'play') toggle();
        else if (name === 'ann') {
          S.ann = S.ann === false;
          ch.setOverlays(S.ann ? cur.overlays : []);
          if (el.ann) setPressed(el.ann, S.ann);
        } else if (name === 'reseed') {
          S.seeds[S.id] = 1 + Math.floor(Math.random() * 999999);
          load(S.id); S.started = true; S.done = false; atStart(); play();
        } else if (name === 'buy') buy();
        else if (name === 'pick') {
          if (arg === S.id) { atStart(); S.started = true; play(); return; }
          load(arg); S.started = true; S.done = false; atStart(); play();
        } else if (name === 'tf') {
          ch.setTimeframe(Number(arg));
          $$('[data-tf]', fig).forEach(function (btn) { setPressed(btn, btn.getAttribute('data-tf') === String(arg)); });
          if (el.tf) el.tf.textContent = TF_NAME[Number(arg)] || '';
        }
      },
      chart: ch
    };
    api.remount();
    return api;
  }

  // ---------------------------------------------------------------- module 2: the pair explorer
  function makePairs(fig, S) {
    var host = $('.chart-frame__canvas', fig), read = $('[data-k="read"]', fig);
    var src = build('S01', 11), sw = src.truth.sweep.bar;      // built first: a throw here leaves no chart behind
    var ch = TJR.chart.create(host, { label: 'กราฟให้ลองชี้คู่แท่งเทียน: คู่ที่เข้ากฎ high และ low ของคลิปจะถูกไฮไลต์', interactive: true });
    var a0 = Math.max(0, sw - 26), a1 = Math.min(src.candles.length, sw + 10);
    var data = { candles: src.candles.slice(a0, a1), meta: src.meta };
    var cs = data.candles, list = pairList(cs), showAll = !!S.all, shown = null, dead = false;
    ch.setData(data);
    ch.setOverlays([]);
    ch.reveal(cs.length - 1);
    var KIND = { high: 'target', low: 'session' };
    var WHY = { up: 'แท่งขึ้น', down: 'แท่งลง', flat: 'แท่ง doji' };

    function clear() { ch.removeOverlay('pair'); ch.removeOverlay('pair-at'); }
    function describe(p) {
      var d = WHY[p.dirs[0]] + ' ตามด้วย' + WHY[p.dirs[1]], pairTxt = 'คู่แท่งที่ ' + (p.k + 1) + '–' + (p.k + 2) + ' : ';
      if (p.kind === 'high') return pairTxt + d + ' = High ที่ ' + TJR.util.fmtPrice(p.price) + ' (ปลายไส้บนสุดของสองแท่ง)';
      if (p.kind === 'low') return pairTxt + d + ' = Low ที่ ' + TJR.util.fmtPrice(p.price) + ' (ปลายไส้ล่างสุดของสองแท่ง)';
      return pairTxt + d + ' = ไม่ใช่ High หรือ Low ตามกฎ';
    }
    function select(p) {
      if (dead || !p) return;
      var key = p.k + ':' + p.kind;
      if (shown === key) return;
      shown = key;
      clear();
      ch.addOverlay({ id: 'pair', type: 'box', from: p.k, to: p.k + 1, low: p.lo, high: p.hi,
        label: p.kind === 'high' ? 'High' : p.kind === 'low' ? 'Low' : 'ไม่เข้ากฎ', kind: KIND[p.kind] || 'htf' });
      if (p.kind) ch.addOverlay({ id: 'pair-at', type: 'marker', bar: p.at, price: p.price, shape: p.kind === 'high' ? 'down' : 'up' });
      if (read) read.textContent = describe(p);
      S.k = p.k;
    }
    function paintAll() {
      list.forEach(function (p) {
        ch.removeOverlay('all-' + p.k);
        if (showAll) ch.addOverlay({ id: 'all-' + p.k, type: 'label', bar: p.at, price: p.price, text: p.kind === 'high' ? 'H' : 'L', pos: p.kind === 'high' ? 'above' : 'below' });
      });
    }
    function fromPointer(p) {
      if (!p) return null;
      var mid = ch.coords(p.i, p.candle.c).x;
      return pairFor(cs, p.i, p.x < mid ? -1 : 1);
    }
    var offs = [
      ch.on('hover', function (p) { var q = fromPointer(p); if (q) select(q); }),
      ch.on('click', function (p) { var q = fromPointer(p); if (q) select(q); })
    ];
    if (showAll) paintAll();
    select(pairFor(cs, list.length ? list[Math.min(2, list.length - 1)].k : 3, 1));
    return {
      destroy: function () { dead = true; offs.forEach(function (f) { f(); }); ch.destroy(); },
      autoplay: function () {},
      remount: function () {},
      reduced: function () {},
      act: function (name) {
        if (name === 'prev' || name === 'next') {
          var q = name === 'next' ? S.k + 1 : S.k - 1;
          select(pairFor(cs, clamp(q, 0, cs.length - 2), 1));
        } else if (name === 'jump') {
          var nx = stepPair(list, S.k == null ? -1 : S.k, 1) || list[0];
          if (nx) select(pairFor(cs, nx.k, 1));
        } else if (name === 'all') {
          showAll = !showAll; S.all = showAll;
          var b = $('[data-act="all"]', fig);
          if (b) setPressed(b, showAll);
          paintAll();
        }
      },
      chart: ch
    };
  }

  // ---------------------------------------------------------------- module 3: the order stack on a chart
  function makeOrders(fig, S) {
    var host = $('.chart-frame__canvas', fig);
    var b = build('S01', 1), T = b.truth, u = b.meta.vol, rev = T.sweep.bar - 1;      // built first: a throw leaves no chart behind
    function lv(id) { return T.levels.filter(function (l) { return l.id === id; })[0]; }
    var hi = lv('T'), lo = lv('L1');
    var ch = TJR.chart.create(host, { label: 'กราฟ S01: กลุ่ม buy orders เหนือ high และกลุ่ม sell orders ใต้ low', interactive: false });
    ch.setData(b);
    ch.setOverlays(TJR.annotate(b, { upTo: rev }));
    ch.reveal(rev);
    ch.view(Math.max(0, rev - 66), rev + 8);
    var ZONES = [
      { id: 'ord-b1', side: 1, k: 0, base: hi, label: 'Buy 1 · ทะลุ high แล้วกด buy' },
      { id: 'ord-b2', side: 1, k: 1, base: hi, label: 'Buy 2 · stop-loss ของ short' },
      { id: 'ord-s1', side: -1, k: 0, base: lo, label: 'Sell 1 · short ตอนหลุด low' },
      { id: 'ord-s2', side: -1, k: 1, base: lo, label: 'Sell 2 · stop-loss ของ long' }
    ];
    var timers = [], dead = false;
    function zone(z) {
      var a = z.base.price + z.side * (0.12 + z.k * 1.05) * u, c = z.base.price + z.side * (0.12 + z.k * 1.05 + 0.9) * u;
      ch.addOverlay({ id: z.id, type: 'zone', from: z.base.bar, low: Math.min(a, c), high: Math.max(a, c), kind: 'liq', label: z.label });
    }
    function stack() {
      timers.forEach(clearTimeout); timers = [];
      ZONES.forEach(function (z) { ch.removeOverlay(z.id); });
      ch.reveal(rev);
      ZONES.forEach(function (z, i) {
        if (M.reduced) zone(z); else timers.push(setTimeout(function () { if (!dead) zone(z); }, 250 + i * 700));
      });
      S.started = true;
    }
    return {
      destroy: function () { dead = true; timers.forEach(clearTimeout); ch.destroy(); },
      autoplay: function () { if (!S.started) stack(); },
      remount: function () { stack(); },
      reduced: function () { if (M.reduced) stack(); },
      act: function (name) {
        if (name === 'replay') stack();
        else if (name === 'sweep') {
          if (!S.started) stack();
          ch.reveal(rev);                                // every run starts at the same frame, never bar 0
          ch.play({ from: rev, to: Math.min(b.candles.length - 1, T.sweep.bar + 8), barsPerSec: 5 });
        }
      },
      chart: ch
    };
  }

  // ---------------------------------------------------------------- module 5: the four cases
  function casesBuild(id, S) {
    if (id === 'tariff' || id === 'crash') {
      var b = simBuild(id, S.seeds[id] || SEEDS[id]);
      return { built: b, overlays: b.sim.overlays, title: id === 'tariff' ? 'จำลอง: ร่วงแรงใต้ low แล้วดีดกลับ' : 'จำลอง: ขาขึ้นถูกกวาด low แล้วขึ้นต่อ', chips: id === 'tariff' ? [1050] : [1125], tf: '' };
    }
    var def = TJR.scenarios.get(id), s = build(id, S.seeds[id] || SEEDS[id]);
    return { built: s, overlays: TJR.annotate(s, {}), title: 'จำลอง: ' + def.title, chips: def.clip, tf: '' };
  }

  // ---------------------------------------------------------------- slots: a chart lives only near the screen
  var CFG = {
    m1a: { make: 'player', ids: 'S01', cfg: { label: 'กราฟจำลอง S01: liquidity อยู่เหนือ high และใต้ low ราคากวาดแล้ว SWEPT' } },
    m2a: { make: 'pairs' },
    m3a: { make: 'orders' },
    m4a: { make: 'player', ids: 'S03', cfg: { label: 'กราฟจำลอง S03: ราคาขึ้นเหนือ high ที่ซ้อนกัน เปิดโอกาสให้ฝั่งตรงข้ามเติม order', phases: true } },
    m5a: { make: 'player', ids: 'tariff', cfg: { label: 'กราฟจำลอง: ตัวอย่างหลาย timeframe ไม่ใช่กราฟในคลิป', axes: false, interactive: false, build: casesBuild,
             onLoad: function (id) { $$('[data-case]').forEach(function (r) { r.classList.toggle('is-on', r.getAttribute('data-case') === id); setPressed($('button', r), r.getAttribute('data-case') === id); }); } } },
    m6a: { make: 'player', ids: 'S04', cfg: { label: 'กราฟจำลอง S04: sweep แล้วราคาไม่กลับตัว ซื้อทันทีจะติด drawdown', bps: 9 } },
    m6b: { make: 'player', ids: 'S01', cfg: { label: 'กราฟจำลอง: confirmation ฝั่ง long และ short', phases: true } },
    m7a: { make: 'player', ids: 'S10', cfg: { label: 'กราฟจำลอง: liquidity บน timeframe สูงเทียบกับ 5 นาที' } },
    m7b: { make: 'player', ids: 'S06', cfg: { label: 'กราฟจำลองวัน session: Asia, London และ New York' } },
    m8a: { make: 'player', ids: 'S12', cfg: { label: 'กราฟจำลอง: low-resistance และ high-resistance liquidity' } }
  };
  var slots = [], live = [];
  L.slots = slots;                                       // read-only handle for the console and the headless checks

  function Slot(fig, id) {
    var self = this, spec = CFG[id];
    self.fig = fig; self.id = id; self.api = null; self.near = false; self.inView = false;
    self.S = { id: spec.ids, seeds: {}, ann: true };
    self.mount = function () {
      if (self.api) return self.api;
      try {
        self.api = spec.make === 'pairs' ? makePairs(fig, self.S)
          : spec.make === 'orders' ? makeOrders(fig, self.S)
          : makePlayer(fig, spec.cfg, self.S);
      } catch (e) { self.api = null; if (global.console) console.error(e); return null; }
      live.push(self);
      trim(self);
      return self.api;
    };
    self.unmount = function () {
      if (!self.api) return;
      self.api.destroy(); self.api = null;
      var i = live.indexOf(self); if (i >= 0) live.splice(i, 1);
    };
  }
  function trim(keep) {
    while (live.length > MAX_LIVE) {
      var v = null;
      for (var i = 0; i < live.length; i++) if (live[i] !== keep && !live[i].inView) { v = live[i]; break; }
      if (!v) for (i = 0; i < live.length; i++) if (live[i] !== keep) { v = live[i]; break; }
      if (!v) return;
      v.unmount();
    }
  }
  function initSlots() {
    $$('[data-slot]').forEach(function (fig) {
      var id = fig.getAttribute('data-slot');
      if (!CFG[id]) return;
      var s = new Slot(fig, id);
      slots.push(s);
      fig.addEventListener('click', function (e) {
        var t = e.target.closest ? e.target.closest('[data-act],[data-sc],[data-tf]') : null;
        if (!t || !fig.contains(t)) return;
        var api = s.mount();
        if (!api) return;
        if (t.hasAttribute('data-sc')) api.act('pick', t.getAttribute('data-sc'));
        else if (t.hasAttribute('data-tf')) api.act('tf', t.getAttribute('data-tf'));
        else api.act(t.getAttribute('data-act'));
      });
    });
    // the cases of module 5 drive its one chart
    $$('[data-case] button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = slots.filter(function (x) { return x.id === 'm5a'; })[0], api = s && s.mount();
        if (api) api.act('pick', btn.closest('[data-case]').getAttribute('data-case'));
      });
    });
    if (!global.IntersectionObserver) { slots.forEach(function (s) { s.mount(); }); return; }
    var near = new global.IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var s = slots.filter(function (x) { return x.fig === e.target; })[0];
        if (!s) return;
        s.near = e.isIntersecting;
        if (s.near) s.mount(); else s.unmount();
      });
    }, { rootMargin: '90% 0px 90% 0px' });
    var view = new global.IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var s = slots.filter(function (x) { return x.fig === e.target; })[0];
        if (!s) return;
        s.inView = e.isIntersecting;
        if (e.isIntersecting) { var api = s.mount(); if (api) api.autoplay(); }
      });
    }, { threshold: 0.3 });
    slots.forEach(function (s) { near.observe(s.fig); view.observe(s.fig); });
    TJR.motion.onChange(function () { live.forEach(function (s) { if (s.api) s.api.reduced(); }); });
  }

  // ---------------------------------------------------------------- module 7: the sessions table
  var NOW_NAME = { asia: 'Asia', london: 'London', 'ny-pre': 'NY pre-market', ny: 'New York', spread: 'spread hour (คลิปว่าเทรดไม่ได้)', weekend: 'สุดสัปดาห์' };
  function sessionsTable() {
    var body = $('[data-k="sess-body"]'), note = $('[data-k="dst-note"]');
    if (!body) return;
    var year = new Date().getFullYear(), T = L.sessionTable(TJR.sessions, year);
    body.innerHTML = T.rows.map(function (r) {
      return '<tr data-s="' + r.id + '"><th scope="row" data-th="Session">' + r.name + '</th><td data-th="เวลา ET">' + r.et +
        '</td><td data-th="เวลาไทย (US ออมแสง)">' + r.summer + '</td><td data-th="เวลาไทย (US มาตรฐาน)">' + r.winter + '</td></tr>';
    }).join('');
    var hs = $('[data-k="h-summer"]'), hw = $('[data-k="h-winter"]');
    function utc(o) { return 'UTC' + (o < 0 ? '−' : '+') + Math.abs(o); }
    if (hs) hs.textContent = 'เวลาไทย · US ออมแสง (ET = ' + utc(T.summerOffset) + ')';
    if (hw) hw.textContent = 'เวลาไทย · US มาตรฐาน (ET = ' + utc(T.winterOffset) + ')';
    if (note) {
      note.textContent = 'US เลื่อนนาฬิกาเป็นเวลาออมแสงวันที่ ' + thaiDate(T.dst.start) + ' และกลับเวลามาตรฐานวันที่ ' + thaiDate(T.dst.end) +
        ' เวลาไทยคงที่ที่ UTC+7 ช่วงเปลี่ยนนี้จึงเลื่อนทุก session ไป 1 ชั่วโมงในเวลาไทย เครื่องหมาย +1 คือวันถัดไปของไทย';
    }
    function tick() {
      var now = Math.floor(Date.now() / 1000), el = $('[data-k="now"]'), w = TJR.sessions.which(now);
      if (el) el.textContent = 'ตอนนี้ ' + TJR.sessions.fmtET(now) + ' ET · ' + TJR.sessions.fmtThai(now) + ' น. · ' + (NOW_NAME[w] || w);
      $$('tr[data-s]', body).forEach(function (tr) { tr.classList.toggle('is-live', tr.getAttribute('data-s') === w); });
    }
    tick();
    setInterval(tick, 20000);
  }

  // ---------------------------------------------------------------- the self-checks
  var RIGHTS = {};
  function initChecks() {
    var all = {};
    $$('.check[data-m]').forEach(function (box) {
      var m = box.getAttribute('data-m'), qs = $$('.q', box);
      RIGHTS['m' + m] = qs.map(function (q) { return Number(q.getAttribute('data-right')); });
      var saved = TJR.store.get('learn.m' + m, null);
      all['m' + m] = saved && Array.isArray(saved.p) ? saved.p.slice(0, qs.length) : qs.map(function () { return null; });
    });
    function save(m) { TJR.store.set('learn.m' + m, { p: all['m' + m] }); }
    function paint(box) {
      var m = box.getAttribute('data-m'), picks = all['m' + m], st = quizState(picks, RIGHTS['m' + m]);
      $$('.q', box).forEach(function (q, qi) {
        var pick = picks[qi], right = Number(q.getAttribute('data-right')), fb = $('.q__fb', q);
        $$('.opt', q).forEach(function (o) {
          var i = Number(o.getAttribute('data-i'));
          o.classList.toggle('is-right', pick === i && i === right);
          o.classList.toggle('is-wrong', pick === i && i !== right);
          setPressed(o, pick === i);
        });
        if (pick == null) fb.innerHTML = '';
        else if (pick === right) fb.innerHTML = '<b class="q__ok">ถูก</b> ' + q.getAttribute('data-why') + ' ' + TJR.layout.chip(Number(q.getAttribute('data-sec')));
        else fb.innerHTML = '<b class="q__no">ยังไม่ใช่</b> ลองเลือกใหม่ หรือดูช่วงนี้ในคลิป ' + TJR.layout.chip(Number(q.getAttribute('data-sec')));
      });
      var score = $('[data-k="score"]', box);
      if (score) { score.textContent = st.right.filter(Boolean).length + ' / ' + st.right.length; score.setAttribute('data-tone', st.done ? 'good' : ''); }
      box.classList.toggle('is-done', st.done);
      var link = $('.rail a[data-m="' + m + '"]');
      if (link) link.classList.toggle('is-done', st.done);
    }
    function count() {
      var n = countDone(all, RIGHTS);
      $$('[data-k="done"]').forEach(function (e) { e.textContent = String(n); });
      return n;
    }
    $$('.check[data-m]').forEach(function (box) {
      var m = box.getAttribute('data-m');
      paint(box);
      box.addEventListener('click', function (e) {
        var o = e.target.closest ? e.target.closest('.opt') : null, rs = e.target.closest ? e.target.closest('[data-act="clear"]') : null;
        if (o && box.contains(o)) {
          var q = o.closest('.q'), qi = $$('.q', box).indexOf(q);
          all['m' + m][qi] = Number(o.getAttribute('data-i'));
        } else if (rs) {
          all['m' + m] = $$('.q', box).map(function () { return null; });
        } else return;
        save(m); paint(box); count();
      });
    });
    count();
  }

  // ---------------------------------------------------------------- the rail: current module, progress
  function initRail() {
    var mods = $$('.module'), links = $$('.rail a[data-m]'), now = $('[data-k="now-mod"]'), bar = $('.rail__bar'), tick = false;
    if (!mods.length) return;
    function update() {
      tick = false;
      var line = global.innerHeight * 0.34, cur = mods[0];
      mods.forEach(function (m) { if (m.getBoundingClientRect().top <= line) cur = m; });
      var id = cur.getAttribute('data-m');
      links.forEach(function (a) {
        var on = a.getAttribute('data-m') === id;
        a.classList.toggle('is-current', on);
        if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
      if (now) now.textContent = 'บทที่ ' + id + ' · ' + $('h2', cur).textContent;
      var first = mods[0].getBoundingClientRect().top + global.pageYOffset, last = mods[mods.length - 1];
      var end = last.getBoundingClientRect().bottom + global.pageYOffset - global.innerHeight * 0.6;
      if (bar) bar.style.setProperty('--p', String(clamp((global.pageYOffset - first + global.innerHeight * 0.3) / Math.max(1, end - first), 0, 1)));
    }
    function req() { if (!tick) { tick = true; global.requestAnimationFrame(update); } }
    global.addEventListener('scroll', req, { passive: true });
    global.addEventListener('resize', req);
    update();
  }

  // ---------------------------------------------------------------- heading reveal (GSAP only, once)
  function headReveal() {
    var ST = M.ScrollTrigger;
    if (!M.enabled || !ST) return;
    var pending = [];
    $$('.module__head').forEach(function (head) {
      var h2 = $('h2', head), no = $('.module__no', head), rule = $('.module__rule', head);
      var tl = M.gsap.timeline({ paused: true });
      if (no) tl.from(no, { x: -14, opacity: 0, duration: 0.5, ease: 'power3.out', clearProps: 'all' }, 0);
      tl.from(h2, { clipPath: 'inset(0 100% 0 0)', y: 14, duration: 0.9, ease: 'power3.out', clearProps: 'all' }, 0.05);
      if (rule) tl.from(rule, { scaleX: 0, transformOrigin: 'left', duration: 0.9, ease: 'power3.out', clearProps: 'all' }, 0.1);
      var rec = { head: head, played: false, go: function () { if (rec.played) return; rec.played = true; tl.play(); } };
      pending.push(rec);
      ST.create({ trigger: head, start: 'top 92%', once: true, onEnter: rec.go });
    });
    // whatever stalls, a heading in view is never left hidden
    var tries = 0, iv = setInterval(function () {
      tries++;
      pending.forEach(function (r) { if (!r.played && r.head.getBoundingClientRect().top < global.innerHeight) r.go(); });
      if (tries > 8 || pending.every(function (r) { return r.played; })) clearInterval(iv);
    }, 1500);
  }

  // ---------------------------------------------------------------- start
  try { sessionsTable(); } catch (e) { if (global.console) console.error(e); }
  initChecks();
  initRail();
  initSlots();
  headReveal();
})(typeof window !== 'undefined' ? window : globalThis);
