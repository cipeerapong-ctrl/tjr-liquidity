/* TJR Liquidity: the scenario gallery controller (Task 11). Classic script, after the engine, layout and motion.

   1. pure helpers on TJR.gallery (no DOM, tested in Node by tests/scenarios.test.js):
      parseHash / kindOf / filterIds        the URL hash (#S06) and the card filters
      factSec / FACT_SEC                    clip second of each fact a scenario note cites
      tfOptions / seriesIndex / baseEnd     the timeframe switch: base <-> rolled-up bar indices
      visibleNotes / playRate               notes known at a bar, playback speed
   2. page: the card grid (previews drawn on small canvases, not engine charts), the viewer (ONE engine chart,
      built with TJR.scenarios.safeBuild, annotated with TJR.annotate), hash routing (back closes the viewer).
   Notes and clip chips come from TJR.scenarios (list, truth.notes); only the no-trade reasons and the entry-window
   explanation are written here, each with its chip. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var doc = global.document;
  var G = TJR.gallery = TJR.gallery || {};

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ================================================================ 1 · pure helpers

  var IDS = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11', 'S12', 'S13', 'S14'];
  var SESSION_IDS = ['S06', 'S07', 'S08', 'S09'];       // charts built on session highs / lows
  var HTF_IDS = ['S05', 'S10', 'S11'];                   // daily, 4H highs, 4H high vs a 5m high
  var SHORT_IDS = ['S03', 'S10'];                        // the trade scenarios that go short
  var SEEDS = { S01: 1, S02: 5, S03: 4, S04: 2, S05: 3, S06: 6, S07: 7, S08: 2, S09: 3, S10: 5, S11: 4, S12: 2, S13: 3, S14: 6 };
  var TF_CHOICES = { S09: [1, 5, 15], S10: [5, 15, 60, 240], S11: [5, 15, 60, 240] };
  var TF_NAME = { 1: '1m', 5: '5m', 15: '15m', 60: '1H', 240: '4H', 1440: 'D' };
  var D4_TEXT = 'คลิปไม่ได้บอกวิธีจัดการเมื่อ confirmation ล้ม';

  // seconds in the clip where each fact a note cites begins (clip-facts.md; same seconds as the course page)
  var FACT_SEC = {
    'F5.3': 1170, 'F5.4': 1215, 'F5.5': 1230, 'F6.2': 1350, 'F6.3': 1350, 'F6.4': 1395, 'F6.5': 1410, 'F6.6': 1440,
    'F6.7': 1485, 'F6.8': 1530, 'F6.9': 1575, 'F7.4': 1710, 'F7.5': 1755, 'F7.6': 1785, 'F7.10': 2085, 'F7.12': 2160,
    'F7.13': 2205, 'F7.14': 2250, 'F7.15': 2295, 'F8.3': 2520, 'F8.4': 2565, 'F8.5': 2655, 'F8.6': 2700,
    'F8.7': 2790, 'F8.8': 2835
  };
  // F9.2 lists what the clip does NOT say: a note citing it shows the gap badge, not a chip
  function factSec(f) { return Object.prototype.hasOwnProperty.call(FACT_SEC, f) ? FACT_SEC[f] : null; }

  function parseHash(h) {
    var m = /^#?(S(?:0[1-9]|1[0-4]))$/i.exec(String(h == null ? '' : h).trim());
    return m ? m[1].toUpperCase() : null;
  }
  function kindOf(def) {
    return {
      trade: def.outcomes.length > 0, fail: def.outcomes.indexOf('fail') >= 0,
      session: SESSION_IDS.indexOf(def.id) >= 0, htf: HTF_IDS.indexOf(def.id) >= 0,
      side: def.outcomes.length ? (SHORT_IDS.indexOf(def.id) >= 0 ? 'short' : 'long') : null
    };
  }
  // ids of the scenarios a filter keeps, in library order
  function filterIds(list, key) {
    return list.filter(function (d) {
      var k = kindOf(d);
      return key === 'trade' ? k.trade : key === 'notrade' ? !k.trade : key === 'session' ? k.session : key === 'htf' ? k.htf : true;
    }).map(function (d) { return d.id; });
  }
  function tfOptions(id) { return (TF_CHOICES[id] || []).slice(); }

  // base bar b -> index of the series bar that holds it (the last series bar starting at or before b's time)
  function seriesIndex(base, series, b) {
    if (series === base) return b;
    var t = base[clamp(b, 0, base.length - 1)].t, lo = 0, hi = series.length - 1;
    while (lo < hi) { var m = (lo + hi + 1) >> 1; if (series[m].t <= t) lo = m; else hi = m - 1; }
    return lo;
  }
  // series bar j -> the last base bar inside it
  function baseEnd(base, series, j) {
    if (series === base) return j;
    if (j + 1 >= series.length) return base.length - 1;
    var t = series[j + 1].t, lo = 0, hi = base.length - 1;
    while (lo < hi) { var m = (lo + hi) >> 1; if (base[m].t >= t) hi = m; else lo = m + 1; }
    return Math.max(0, lo - 1);
  }
  // notes known once base bar b is on screen, in bar order
  function visibleNotes(notes, b) {
    return notes.filter(function (n) { return n.bar <= b; }).sort(function (x, y) { return x.bar - y.bar; });
  }
  // bars per second so a run lasts about 14 s at 1x (6..60 bars/s before the speed factor)
  function playRate(span, speed) { return clamp(span / 14, 6, 60) * (speed || 1); }
  // the first bar worth starting on: levels known, well before the sweep (same rule as the course page)
  function startBar(b) {
    var T = b.truth, n = b.candles.length, sweep = T.sweep ? T.sweep.bar : n - 1, known = 0;
    (T.levels || []).forEach(function (l) { if (l.known != null && l.known < sweep && l.known > known) known = l.known; });
    return clamp(Math.max(known + 1, Math.floor(n * 0.22)), 0, Math.max(0, sweep - 6));
  }

  // why a scenario carries no trade: authored here, every sentence a paraphrase of the cited facts
  var NOTRADE = {
    S04: { text: 'ไม่มีเทรดที่นี่ low โดนกวาดแล้วราคายังลงต่อ ไม่มีเทรนด์ขาขึ้นใหม่ จึงไม่มี confirmation ใครกด buy ทันทีจะติด drawdown และการทะลุ low เป็นแค่โอกาส ไม่ใช่สัญญาณ', secs: [1350, 1230], gap: null },
    S05: { text: 'ไม่มีเทรดที่นี่ กราฟรายวันนี้ในคลิปใช้ดู liquidity ที่ถูกวิ่งเก็บทั้งสองด้าน equal highs ก่อน แล้ว lows ตามมา เว็บนี้จึงไม่ทำเครื่องหมายจุดเข้า', secs: [1170], gap: 'ระยะที่นับว่า equal' },
    S06: { text: 'เว็บนี้ไม่ทำเครื่องหมายจุดเข้าในวันนี้ คลิปเล่าลำดับ session ว่า London เก็บ Asia low, NY เก็บ London low แล้วราคาวิ่งเก็บ Asia high กับ previous-day high และบอกว่าเทรดจบแล้ว แต่ไม่ได้บอกจุดเข้าออก', secs: [2085, 2160], gap: 'จุดเข้าและออกของวันนี้' },
    S07: { text: 'เว็บนี้ไม่ทำเครื่องหมายจุดเข้าในวันนี้ ตัวอย่างใช้ดูว่า NY pre-market เก็บ London low แล้ว NY ขึ้นทั้งวัน อยากดูจุดเข้าแบบเต็ม ให้เปิด S09', secs: [2205], gap: 'จุดเข้าของวันนี้', link: 'S09' },
    S08: { text: 'เว็บนี้ไม่ทำเครื่องหมายจุดเข้าในวันนี้ คลิปใช้วันจันทร์นี้ให้เห็นว่าตลาดวิ่งหา session highs และ lows ที่มาร์กไว้ ไม่ได้บอกจุดเข้า', secs: [2295], gap: 'จุดเข้าของวันนี้' },
    S11: { text: 'ไม่มีเทรดที่นี่ ตัวอย่างเทียบน้ำหนัก high ของ 5m แตกแล้วเกิดขาลงสั้น ๆ คลิปคาดว่าไม่น่ายืน ส่วน liquidity ของ HTF มีน้ำหนักกว่า', secs: [1755], gap: 'จุดเข้าของตัวอย่างนี้' }
  };

  G.IDS = IDS; G.FACT_SEC = FACT_SEC; G.D4 = D4_TEXT; G.NOTRADE = NOTRADE; G.SEEDS = SEEDS;
  G.parseHash = parseHash; G.kindOf = kindOf; G.filterIds = filterIds; G.factSec = factSec; G.tfOptions = tfOptions;
  G.seriesIndex = seriesIndex; G.baseEnd = baseEnd; G.visibleNotes = visibleNotes; G.playRate = playRate; G.startBar = startBar;

  if (!doc || !TJR.layout || !TJR.chart || !TJR.chart.create) return;   // Node (tests): helpers only

  // ================================================================ 2 · page
  var M = TJR.motion.init();
  TJR.layout.mount({
    page: 'scenarios',
    close: { title: 'ฝึกอ่านกราฟเอง', line: 'ตัดสินใจทีละแท่งบนกราฟสุ่ม แล้วตรวจคำตอบตามคลิป', label: 'เปิดแบบฝึก', href: 'lab.html' }
  });

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function stamp(t) { return TJR.sessions.fmtET(t) + ' ET · ' + TJR.sessions.fmtThai(t) + ' น.'; }
  function chipsHtml(secs) { return (secs || []).map(function (s) { return TJR.layout.chip(s); }).join(''); }
  function setPressed(btn, on) { btn.setAttribute('aria-pressed', String(!!on)); }
  function defOf(id) { return TJR.scenarios.get(id); }
  function buildFor(id, seed, outcome) {
    return TJR.scenarios.safeBuild(defOf(id), seed, outcome ? { outcome: outcome } : {});
  }

  var gallery = $('#gallery'), viewer = $('#viewer'), grid = $('[data-k="grid"]'), count = $('[data-k="count"]');
  var seeds = {}, outcomes = {};                          // remembered per scenario while the page lives
  var V = null;                                           // the open viewer, or null
  var filterKey = 'all';

  // ---------------------------------------------------------------- the cards
  var SIDE_TAG = { long: ['tag--long', 'Long'], short: ['tag--short', 'Short'] };
  function cardHtml(d) {
    var k = kindOf(d), tags = k.trade
      ? '<span class="tag ' + SIDE_TAG[k.side][0] + '">' + SIDE_TAG[k.side][1] + '</span>' + (k.fail ? '<span class="tag">มีแบบ confirmation ล้ม</span>' : '')
      : '<span class="tag tag--none">ไม่มีเทรด</span>';
    if (k.session) tags += '<span class="tag">Session</span>';
    if (k.htf) tags += '<span class="tag">HTF</span>';
    return '<li class="card sc" id="' + d.id + '" data-id="' + d.id + '">' +
      '<div class="sc__fig"><canvas class="sc__cv" aria-hidden="true"></canvas><span class="sc__id">' + d.id + '</span>' +
      '<span class="sc__tf">' + d.instrument + ' · ' + TF_NAME[d.tf] + '</span></div>' +
      '<h3><a class="sc__link" href="#' + d.id + '">' + d.title + '</a></h3>' +
      '<div class="sc__tags">' + tags + '</div>' +
      '<p class="sc__meta chips">' + chipsHtml(d.clip) + '</p></li>';
  }
  function buildCards() {
    grid.innerHTML = TJR.scenarios.list.map(cardHtml).join('');
  }

  // a small drawn preview: the close line of the chart each card opens, the sweep dot, the entry window.
  // Drawn once, lazily, a card at a time; the line draws in left to right unless motion is reduced.
  var thumbs = {};                                        // id -> { cv, pts, sweep, win, side }
  function themeColor(name, fb) {
    try { var v = global.getComputedStyle(doc.documentElement).getPropertyValue(name).trim(); return v || fb; } catch (e) { return fb; }
  }
  function thumbData(id) {
    var d = defOf(id), b = buildFor(id, SEEDS[id], null), T = b.truth, cs = b.candles, n = cs.length;
    var lo = Infinity, hi = -Infinity;
    cs.forEach(function (k) { if (k.l < lo) lo = k.l; if (k.h > hi) hi = k.h; });
    var step = Math.max(1, Math.floor(n / 160)), pts = [];
    for (var i = 0; i < n; i += step) pts.push([i / (n - 1), (cs[i].c - lo) / (hi - lo)]);
    pts.push([1, (cs[n - 1].c - lo) / (hi - lo)]);
    var sw = T.sweep, w = T.entryWindow, sweep = null;
    if (sw) {
      var lv = T.levels.filter(function (l) { return l.id === sw.levelId; })[0];
      var price = lv && lv.side === 'high' ? cs[sw.bar].h : cs[sw.bar].l;
      sweep = [sw.bar / (n - 1), (price - lo) / (hi - lo)];
    }
    return { n: n, pts: pts, side: T.side, sweep: sweep, win: w ? [w.from / (n - 1), w.to / (n - 1)] : null, def: d };
  }
  function drawThumb(t, p) {
    var cv = t.cv, w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    var dpr = global.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    var padX = 10, padT = 28, padB = 12, iw = w - padX * 2, ih = h - padT - padB;
    function X(f) { return padX + f * iw; }
    function Y(f) { return padT + (1 - f) * ih; }
    var d = t.data, txt = themeColor('--c-text', '#f1f1ef'), liq = themeColor('--c-liq', '#f5b544');
    var bull = themeColor('--c-bull', '#2fcf86'), bear = themeColor('--c-bear', '#f6626a');
    if (d.win) {
      c.fillStyle = (d.side === 'short' ? bear : bull); c.globalAlpha = 0.16;
      c.fillRect(X(d.win[0]), padT, Math.max(2, X(d.win[1]) - X(d.win[0])), ih);
      c.globalAlpha = 1;
    }
    c.save();
    c.beginPath(); c.rect(0, 0, padX + p * iw + 1, h); c.clip();
    c.strokeStyle = txt; c.globalAlpha = 0.9; c.lineWidth = 1.5; c.lineJoin = 'round'; c.beginPath();
    d.pts.forEach(function (q, i) { if (i) c.lineTo(X(q[0]), Y(q[1])); else c.moveTo(X(q[0]), Y(q[1])); });
    c.stroke();
    c.restore();
    if (d.sweep && p >= d.sweep[0]) {
      c.globalAlpha = 1; c.fillStyle = liq; c.beginPath(); c.arc(X(d.sweep[0]), Y(d.sweep[1]), 4, 0, 6.2832); c.fill();
      c.strokeStyle = liq; c.globalAlpha = 0.35; c.lineWidth = 1; c.beginPath(); c.arc(X(d.sweep[0]), Y(d.sweep[1]), 8, 0, 6.2832); c.stroke();
      c.globalAlpha = 1;
    }
  }
  function paintThumb(id, delay) {
    var li = $('.sc[data-id="' + id + '"]', grid);
    if (!li) return;
    var t = thumbs[id];
    if (!t) {
      var data;
      try { data = thumbData(id); } catch (e) { if (global.console) console.error(e); return; }
      t = thumbs[id] = { cv: $('.sc__cv', li), data: data, done: false };
    }
    if (M.reduced || !global.requestAnimationFrame || t.done) { t.done = true; drawThumb(t, 1); return; }
    var t0 = null, dur = 700;
    function frame(ts) {
      if (t0 == null) t0 = ts + delay;
      var p = clamp((ts - t0) / dur, 0, 1);
      var e = 1 - Math.pow(1 - p, 3);
      drawThumb(t, e);
      if (p < 1) global.requestAnimationFrame(frame); else t.done = true;
    }
    global.requestAnimationFrame(frame);
  }
  function initThumbs() {
    var seen = {}, order = 0;
    function go(id) { if (seen[id]) return; seen[id] = true; paintThumb(id, (order++ % 4) * 90); }
    if (!global.IntersectionObserver) { IDS.forEach(function (id) { go(id); }); return; }
    var io = new global.IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { go(e.target.getAttribute('data-id')); io.unobserve(e.target); } });
    }, { rootMargin: '120px 0px' });
    $$('.sc', grid).forEach(function (li) { io.observe(li); });
    var rt = 0;
    global.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { Object.keys(thumbs).forEach(function (id) { if (thumbs[id].done) drawThumb(thumbs[id], 1); }); }, 150);
    });
  }

  // ---------------------------------------------------------------- filters
  function applyFilter(key, save) {
    filterKey = key;
    var keep = filterIds(TJR.scenarios.list, key);
    $$('.sc', grid).forEach(function (li) { li.hidden = keep.indexOf(li.getAttribute('data-id')) < 0; });
    $$('[data-f]').forEach(function (b) { setPressed(b, b.getAttribute('data-f') === key); });
    if (count) count.textContent = 'แสดง ' + keep.length + ' จาก ' + IDS.length + ' สถานการณ์';
    if (save) TJR.store.set('scenarios.filter', key);
  }
  function initFilters() {
    var saved = TJR.store.get('scenarios.filter', 'all');
    $$('[data-f]').forEach(function (b) {
      var key = b.getAttribute('data-f'), n = filterIds(TJR.scenarios.list, key).length;
      b.innerHTML = b.textContent + ' <span class="ctrl__n">' + n + '</span>';
      b.addEventListener('click', function () { applyFilter(key, true); });
    });
    applyFilter(['all', 'trade', 'notrade', 'session', 'htf'].indexOf(saved) >= 0 ? saved : 'all', false);
  }

  // ---------------------------------------------------------------- the viewer
  var el = {
    vid: $('[data-k="vid"]'), title: $('[data-k="vtitle"]'), sum: $('[data-k="vsum"]'), chips: $('[data-k="vchips"]'),
    sym: $('[data-k="sym"]', viewer), tf: $('[data-k="tf"]', viewer), meta: $('[data-k="meta"]', viewer),
    phases: $('[data-k="phases"]'), play: $('[data-act="play"]', viewer), ann: $('[data-act="ann"]', viewer),
    verdict: $('[data-k="verdict"]'), notes: $('[data-k="notes"]'), nohint: $('[data-k="nohint"]'),
    tfg: $('[data-k="tfg"]'), og: $('[data-k="og"]'), seed: $('[data-k="seed"]'), prev: $('[data-k="prev"]'), next: $('[data-k="next"]'),
    host: $('.chart-frame__canvas', viewer)
  };

  function setPlay(label, on) {
    var lab = $('[data-k="lab"]', el.play);
    if (lab) lab.textContent = label;
    el.play.setAttribute('data-state', on ? 'on' : 'off');
  }
  function levelLabel(T, id) {
    var l = T.levels.filter(function (x) { return x.id === id; })[0];
    return l ? l.label : id;
  }

  // the side panel: a trade (long / short, entry window, target) or the plain statement that there is none
  function verdictHtml(b) {
    var B = V.built, T = B.truth, d = V.def, h;
    if (!T.side) {
      var nt = NOTRADE[d.id];
      h = '<div class="verdict__top"><span class="tag tag--none">ไม่มีเทรด</span></div>' +
        '<p>' + nt.text + ' <span class="chips">' + chipsHtml(nt.secs) + '</span></p>' +
        (nt.link ? '<p><a class="btn btn--secondary" href="#' + nt.link + '">เปิด ' + nt.link + '</a></p>' : '') +
        '<p class="verdict__gap">' + nt.gap + ' ' + TJR.layout.gap() + '</p>';
      return h;
    }
    var long = T.side === 'long', w = T.entryWindow, base = V.base;
    var stage = b < w.from ? 0 : b < w.to ? 1 : 2;
    var swing = long ? 'HH' : 'LL', seeSec = long ? 1410 : 1530;
    var win = stage === 0 ? '<span class="muted">ยังไม่ถึง เล่นต่อเพื่อดู</span>'
      : stage === 1 ? '<b>เปิดอยู่</b> ตั้งแต่ ' + stamp(base[w.from].t)
      : stamp(base[w.from].t) + '<br>ถึง ' + stamp(base[w.to].t);
    var tgt = stage === 0 ? '<span class="muted">ยังไม่ถึง</span>'
      : TJR.util.fmtPrice(T.target.price) + ' · ' + levelLabel(T, T.target.levelId);
    h = '<div class="verdict__top"><span class="tag ' + SIDE_TAG[T.side][0] + '">' + SIDE_TAG[T.side][1] + '</span><span class="tag">มีเทรด</span>' +
      (T.outcome === 'fail' ? '<span class="tag tag--fail">confirmation ล้ม</span>' : '') + '</div>';
    if (T.outcome === 'fail') h += '<p class="verdict__d4"><span class="badge-gap">' + D4_TEXT + '</span></p>';
    h += '<dl class="kv"><div><dt>ช่วงเข้า</dt><dd>' + win + '</dd></div><div><dt>เป้า</dt><dd>' + tgt + '</dd></div>' +
      '<div><dt>จุดเข้าเป๊ะ ๆ</dt><dd>' + TJR.layout.gap() + ' ' + TJR.layout.chip(1485) + '</dd></div></dl>';
    h += '<p class="verdict__why">ช่วงเข้านี้เป็นการอ่านของเว็บนี้จากตัวอย่างในคลิป เริ่มที่ pullback แรกหลัง ' + swing +
      ' เกิด และจบเมื่อราคาทะลุ ' + swing + ' นั้นอีกครั้ง คลิปชี้ average entry บน pullback โดยไม่ให้กฎเป๊ะ ' + TJR.layout.chip(seeSec) + '</p>';
    return h;
  }
  function verdictKey(b) {
    var T = V.built.truth;
    return T.side ? (b < T.entryWindow.from ? 0 : b < T.entryWindow.to ? 1 : 2) : 0;
  }
  function renderPhases() {
    var T = V.built.truth, items = [['sweep', 'sweep']];
    if (T.side) items.push(['confirm', 'confirm'], ['entry', 'entry']);
    el.phases.innerHTML = items.map(function (x) { return '<li data-phase="' + x[0] + '">' + x[1] + '</li>'; }).join('');
  }
  function noteHtml(n) {
    var sec = factSec(n.fact), c = sec != null ? TJR.layout.chip(sec) : TJR.layout.gap();
    return '<li class="note" data-bar="' + n.bar + '"><time class="note__t">' + TJR.sessions.fmtET(V.base[n.bar].t) + ' ET</time>' +
      '<p>' + n.text + '</p><span class="chips">' + c + '</span></li>';
  }
  function renderNotes(b, final) {
    var vis = visibleNotes(V.built.truth.notes, b);
    if (V.noteCount === vis.length) return;
    var grew = vis.length > V.noteCount;
    V.noteCount = vis.length;
    el.notes.innerHTML = vis.map(noteHtml).join('');
    el.nohint.hidden = vis.length > 0;
    if (grew && !final && !M.reduced) { var last = el.notes.lastElementChild; if (last) last.classList.add('is-new'); }
  }

  function onBar(j) {
    if (!V) return;
    var B = V.built, T = B.truth, b = baseEnd(V.base, V.series, clamp(j, 0, V.series.length - 1)), k = V.series[clamp(j, 0, V.series.length - 1)];
    V.at = b;
    el.meta.textContent = k ? stamp(k.t) : '';
    var marks = { sweep: T.sweep && T.sweep.bar, confirm: T.confirmBar, entry: T.entryWindow && T.entryWindow.from };
    $$('li', el.phases).forEach(function (li) {
      var at = marks[li.getAttribute('data-phase')];
      li.classList.toggle('is-on', at != null && b >= at);
    });
    renderNotes(b, false);
    var key = verdictKey(b);
    if (V.vkey !== key) { V.vkey = key; el.verdict.innerHTML = verdictHtml(b); }
  }

  function atStart() {
    V.run++; V.playing = false;
    var j = seriesIndex(V.base, V.series, startBar(V.built));
    V.ch.reveal(j);
    onBar(j);
    setPlay('เล่น', false);
  }
  function finalFrame() {
    V.run++; V.playing = false;
    var n = V.series.length;
    V.ch.reveal(n - 1);
    onBar(n - 1);
    setPlay('เล่นใหม่', false);
  }
  function play() {
    var v = V, my = ++v.run, at = v.ch.info(), last = at.bars - 1;
    // never let the engine pick `from`: at its end it falls back to bar 0 and regrows the chart from nothing
    if (at.revealed >= last) { var f0 = seriesIndex(v.base, v.series, startBar(v.built)); v.ch.reveal(f0); onBar(f0); at = v.ch.info(); }
    v.playing = true;
    setPlay('หยุด', true);
    var rate = playRate(last - at.revealed, v.speed);
    return v.ch.play({ from: at.revealed, to: last, barsPerSec: rate, onBar: onBar }).then(function (done) {
      if (V !== v || my !== v.run) return done;
      v.playing = false;
      setPlay(done ? 'เล่นใหม่' : 'เล่น', false);
      return done;
    });
  }
  function toggle() {
    if (V.playing) { V.run++; V.playing = false; V.ch.pause(); setPlay('เล่น', false); return; }
    play();
  }
  function stepBy(d) {
    V.run++; V.playing = false;
    var j = V.ch.step(d);
    onBar(j);
    setPlay(j >= V.series.length - 1 ? 'เล่นใหม่' : 'เล่น', false);
  }
  function setOverlays() {
    V.ch.setOverlays(V.ann ? TJR.annotate(V.built, { upTo: V.base.length - 1 }) : []);
    setPressed(el.ann, V.ann);
  }
  function renderTfGroup() {
    var opts = tfOptions(V.id);
    el.tfg.hidden = !opts.length;
    el.tfg.innerHTML = opts.map(function (t) {
      return '<button class="ctrl" type="button" data-tf="' + t + '" aria-pressed="' + (t === V.baseTf) + '">' + TF_NAME[t] + '</button>';
    }).join('');
  }
  function setTf(t) {
    V.run++; V.playing = false;
    V.ch.setTimeframe(t);
    V.tf = t;
    V.series = t === V.baseTf ? V.base : TJR.gen.rollup(V.base, V.baseTf, t);
    $$('[data-tf]', el.tfg).forEach(function (b) { setPressed(b, Number(b.getAttribute('data-tf')) === t); });
    el.tf.textContent = TF_NAME[t] || '';
    onBar(V.ch.info().revealed);
    setPlay('เล่น', false);
  }

  // build the scenario into the open viewer (same chart object, so rapid calls never stack a loop)
  function load(id) {
    var d = defOf(id), k = kindOf(d);
    var outcome = k.fail ? (outcomes[id] || 'win') : null;
    var b = buildFor(id, seeds[id] || SEEDS[id], outcome);
    seeds[id] = b.meta.seed;
    V.run++; V.playing = false;
    V.id = id; V.def = d; V.built = b; V.base = b.candles; V.series = b.candles; V.baseTf = b.meta.tf; V.tf = b.meta.tf;
    V.noteCount = -1; V.vkey = null; V.at = 0;
    V.ch.setData(b);
    setOverlays();
    el.vid.textContent = id + ' · ' + d.instrument + ' · ' + TF_NAME[d.tf];
    el.title.textContent = d.title;
    el.sum.textContent = d.summary;
    el.chips.innerHTML = chipsHtml(d.clip);
    el.sym.textContent = b.meta.instrument;
    el.tf.textContent = TF_NAME[b.meta.tf];
    el.seed.textContent = 'seed ' + b.meta.seed;
    el.og.hidden = !k.fail;
    $$('[data-outcome]', el.og).forEach(function (btn) { setPressed(btn, btn.getAttribute('data-outcome') === (outcome || 'win')); });
    renderTfGroup();
    renderPhases();
    var i = IDS.indexOf(id), pv = IDS[(i + IDS.length - 1) % IDS.length], nx = IDS[(i + 1) % IDS.length];
    el.prev.setAttribute('href', '#' + pv); $('[data-k="prev-id"]', viewer).textContent = pv;
    el.next.setAttribute('href', '#' + nx); $('[data-k="next-id"]', viewer).textContent = nx;
    doc.title = id + ' ' + d.title + ' | Liquidity';
    el.nohint.hidden = false;
    el.notes.innerHTML = '';
    V.noteCount = 0;
    if (M.reduced) finalFrame(); else { atStart(); play(); }
  }

  var lastGridY = 0, fromGrid = false;
  function openViewer(id) {
    var wasOpen = !!V;
    if (!wasOpen) {
      gallery.hidden = true; viewer.hidden = false;
      var ch = TJR.chart.create(el.host, { label: 'กราฟจำลองสถานการณ์ ' + id + ' ที่เล่นทีละแท่งได้', interactive: true });
      V = { ch: ch, run: 0, playing: false, ann: true, speed: 1, id: null };
      global.scrollTo(0, 0);
      if (M.enabled && M.gsap) M.gsap.fromTo(viewer, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', clearProps: 'all' });
    }
    try { load(id); } catch (e) { if (global.console) console.error(e); closeView(); return; }
    if (wasOpen) global.scrollTo(0, 0);
    try { el.title.focus({ preventScroll: true }); } catch (e) { /* focus not available */ }
  }
  function closeView() {
    if (V) { V.run++; V.ch.destroy(); V = null; }
    viewer.hidden = true; gallery.hidden = false;
    doc.title = '14 สถานการณ์ liquidity จากคลิป TJR | Liquidity';
  }

  // ---------------------------------------------------------------- routing: the hash is the state
  var first = true;
  function route() {
    var id = parseHash(global.location.hash);
    if (id) {
      if (!V) fromGrid = !first; else fromGrid = false;        // moved on to another scenario: close pushes the grid
      openViewer(id);
    } else if (V) {
      var focusId = V.id;
      closeView();
      global.scrollTo(0, lastGridY);
      var a = $('.sc[data-id="' + focusId + '"] .sc__link', grid);
      if (a) try { a.focus({ preventScroll: true }); } catch (e) { /* focus not available */ }
    }
    first = false;
  }
  function leave() {
    if (fromGrid) global.history.back();
    else { global.history.pushState(null, '', global.location.pathname + global.location.search); route(); }
  }

  function initViewer() {
    // the grid's scroll position, noted before the link moves the page (the browser jumps to the card id first)
    grid.addEventListener('click', function () { lastGridY = global.pageYOffset; }, true);
    viewer.addEventListener('click', function (e) {
      if (!V) return;
      var t = e.target.closest ? e.target.closest('button,a') : null;
      if (!t || !viewer.contains(t)) return;
      if (t.hasAttribute('data-tf')) { setTf(Number(t.getAttribute('data-tf'))); return; }
      if (t.hasAttribute('data-speed')) {
        V.speed = Number(t.getAttribute('data-speed'));
        $$('[data-speed]', viewer).forEach(function (b) { setPressed(b, b === t); });
        if (V.playing) play();                               // carry on from where it is, at the new speed
        return;
      }
      if (t.hasAttribute('data-outcome')) {
        outcomes[V.id] = t.getAttribute('data-outcome');
        load(V.id);
        return;
      }
      var act = t.getAttribute('data-act');
      if (act === 'close') leave();
      else if (act === 'play') toggle();
      else if (act === 'step') stepBy(1);
      else if (act === 'back') stepBy(-1);
      else if (act === 'reset') atStart();
      else if (act === 'ann') { V.ann = !V.ann; setOverlays(); }
      else if (act === 'reseed') { seeds[V.id] = 1 + Math.floor(Math.random() * 999999); load(V.id); }
    });
    global.addEventListener('hashchange', route);
    TJR.motion.onChange(function (reduced) { if (V && reduced) finalFrame(); });
  }

  // read-only handle for the console and the headless checks
  G.view = function () { return V && { id: V.id, at: V.at, tf: V.tf, run: V.run, playing: V.playing, outcome: V.built.truth.outcome, seed: V.built.meta.seed, info: V.ch.info() }; };

  // ---------------------------------------------------------------- start
  try { buildCards(); initFilters(); initThumbs(); } catch (e) { if (global.console) console.error(e); }
  initViewer();
  route();
})(typeof window !== 'undefined' ? window : globalThis);
