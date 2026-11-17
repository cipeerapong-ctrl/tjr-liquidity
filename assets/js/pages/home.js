/* TJR Liquidity: the home page controller (Task 9). Classic script, after the engine, layout and motion.

   1. layout: nav + footer (close-word) through TJR.layout.mount
   2. entrance: the kit's hero entrance, ported for file:// (over http the kit's motion.js runs it)
   3. hero: the live chart loop. A random S01 / S03 / S12 build with a new seed each cycle, played bar
      by bar; annotate's overlays appear as the playback reaches their appearAt, the swept level flashes
      (the engine does both while revealing forward). One Pause control in the frame. Reduced motion:
      one fully annotated final frame, no loop.
   4. #core: the 3-step walkthrough on S01 (seed 1). Live (GSAP + ScrollTrigger, motion allowed): one
      chart on a sticky stage, the section's scroll progress walks it to sweep.bar, confirmBar and
      entryWindow.from. At rest (no GSAP, offline, reduced motion): three still charts, nothing hidden.
   5. the scenario door's small chart (S08), static.
   Every chart is built with TJR.scenarios.safeBuild. */
(function (global) {
  'use strict';
  var TJR = global.TJR, doc = global.document;
  if (!TJR || !doc) return;

  var M = TJR.motion.init();
  TJR.layout.mount({
    page: 'home',
    close: { title: 'เริ่มที่บทที่ 1', line: '8 บท เรียงตามคลิป ทุกข้อมีเวลาในคลิปกำกับ', label: 'เริ่มบทเรียน' }
  });

  var TF_NAME = { 1: '1m', 5: '5m', 15: '15m', 60: '1H', 240: '4H', 1440: 'D' };
  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function served() {
    try { var p = global.location.protocol; return p === 'http:' || p === 'https:'; } catch (e) { return false; }
  }
  function build(id, seed) { return TJR.scenarios.safeBuild(TJR.scenarios.get(id), seed, {}); }
  function stamp(t) { return TJR.sessions.fmtET(t) + ' ET · ' + TJR.sessions.fmtThai(t) + ' น.'; }
  // the first bar worth starting a playback on: the stacked / liquidity levels already known, well
  // before the sweep
  function startBar(b) {
    var T = b.truth, n = b.candles.length, sweep = T.sweep ? T.sweep.bar : n - 1, known = 0;
    (T.levels || []).forEach(function (l) { if (l.known != null && l.known < sweep && l.known > known) known = l.known; });
    return clamp(Math.max(known + 1, Math.floor(n * 0.22)), 0, Math.max(0, sweep - 6));
  }

  // ================================================================ 2 · entrance on file://
  // The kit's enter() (assets/motion/motion.js, an ES module Chrome runs only over http), ported: the h1
  // rises line by line out of word masks, then the pill, lead and buttons fade up 12px, 60ms apart. It
  // waits for the Geist and IBM Plex Sans Thai faces (0.9 s at most) so no line rises in a fallback face;
  // .is-holding keeps the words hidden meanwhile, past the head line's 700ms safety mark.
  function enterHero() {
    var html = doc.documentElement, hero = $('.hero[data-enter]');
    if (!hero || served() || M.reduced || !html.classList.contains('m-enter')) return;
    if (hero.classList.contains('is-entered') || hero.classList.contains('is-entering')) return;
    if (hero.getBoundingClientRect().bottom < 0 || !hero.animate) { hero.classList.add('is-entered', 'is-still'); return; }
    hero.classList.add('is-holding');
    var over = false, anims = [], restore = null;
    function finish() {
      if (over) return;
      over = true;
      anims.forEach(function (a) { try { a.cancel(); } catch (e) { /* gone */ } });
      if (restore) restore();
      hero.classList.remove('is-holding', 'is-entering');
      hero.classList.add('is-entered');
    }
    function masks(h1) {
      var own = doc.createDocumentFragment();
      while (h1.firstChild) own.appendChild(h1.firstChild);
      var copy = own.cloneNode(true), words = [];
      (function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (n) {
          if (n.nodeType === 1) return walk(n);
          if (n.nodeType !== 3) return;
          var frag = doc.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(part)); return; }
            var w = doc.createElement('span'), i = doc.createElement('span');
            w.className = 'm-w'; i.className = 'm-w__in'; i.textContent = part;
            w.setAttribute('aria-hidden', 'true');
            w.appendChild(i); frag.appendChild(w); words.push(w);
          });
          n.parentNode.replaceChild(frag, n);
        });
      })(copy);
      var labelled = h1.hasAttribute('aria-label');
      if (!labelled) h1.setAttribute('aria-label', own.textContent.replace(/\s+/g, ' ').trim());
      h1.appendChild(copy);
      var lines = [], top = null;
      words.forEach(function (w) {
        var t = w.getBoundingClientRect().top;
        if (top === null || Math.abs(t - top) > 3) { lines.push([]); top = t; }
        lines[lines.length - 1].push(w.firstChild);
      });
      restore = function () {
        while (h1.firstChild) h1.removeChild(h1.firstChild);
        h1.appendChild(own);
        if (!labelled) h1.removeAttribute('aria-label');
      };
      return lines;
    }
    function run() {
      if (over) return;
      var h1 = $('h1', hero), EASE = 'cubic-bezier(.22, 1, .36, 1)';
      var lines = h1 ? masks(h1) : [];
      hero.classList.remove('is-holding');
      hero.classList.add('is-entering');
      var step = Math.min(80, 240 / Math.max(1, lines.length - 1));
      lines.forEach(function (ws, k) {
        ws.forEach(function (w) {
          anims.push(w.animate([{ transform: 'translateY(calc(100% + .2em))' }, { transform: 'none' }],
            { duration: 700, delay: 80 + k * step, easing: EASE, fill: 'both' }));
        });
      });
      var after = 80 + Math.max(0, lines.length - 1) * step + 220, k = 0;
      var parts = [$('.pill', hero)].concat([$('.hero__lead', hero)], $$('.btn-row > *', hero));
      parts.forEach(function (el, i) {
        if (!el) return;
        var t = { duration: 520, delay: i === 0 ? 40 : after + Math.min(k++, 6) * 60, easing: EASE, fill: 'both' };
        anims.push(el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], t));
      });
      var waits = anims.map(function (a) { return a.finished; });
      waits.push(new Promise(function (r) { setTimeout(r, 1150); }));
      Promise.all(waits).then(finish, finish);
    }
    var faces = Promise.resolve();
    try {
      if (doc.fonts && doc.fonts.load) {
        faces = Promise.all([doc.fonts.load('500 64px Geist', 'Liquidity'), doc.fonts.load('500 64px "IBM Plex Sans Thai"', 'อยู่เหนือ')]);
      }
    } catch (e) { faces = Promise.resolve(); }
    Promise.race([faces, new Promise(function (r) { setTimeout(r, 900); })]).then(run, run);
    setTimeout(finish, 3200);   // whatever stalls (a hidden tab), the hero stands
  }

  // ================================================================ 3 · hero: the live chart loop
  function heroLoop() {
    var fig = $('[data-hero-chart]');
    if (!fig) return;
    var host = $('.chart-frame__canvas', fig), btn = $('[data-k="pause"]', fig);
    var sym = $('[data-k="sym"]', fig), title = $('[data-k="title"]', fig), time = $('[data-k="time"]', fig);
    var tfTag = $('.chart-frame__tf', fig), lis = $$('.phase li', fig);
    var ch = TJR.chart.create(host, { label: 'กราฟจำลอง: ราคากวาด liquidity แล้วกลับตัว', interactive: false });
    var IDS = ['S01', 'S03', 'S12'], BPS = 8, HOLD = 2600;
    var st = { last: null, built: null, paused: false, run: 0, timer: null, ended: false };

    function pick() {
      var pool = IDS.filter(function (id) { return id !== st.last; });
      st.last = pool[Math.floor(Math.random() * pool.length)];
      return st.last;
    }
    function onBar(i) {
      var b = st.built, T = b.truth, k = b.candles[clamp(i, 0, b.candles.length - 1)];
      var marks = { sweep: T.sweep && T.sweep.bar, confirm: T.confirmBar, entry: T.entryWindow && T.entryWindow.from };
      lis.forEach(function (li) {
        var at = marks[li.getAttribute('data-phase')];
        li.classList.toggle('is-on', at != null && i >= at);
      });
      if (time && k) time.textContent = stamp(k.t);
    }
    function load() {
      var id = pick(), def = TJR.scenarios.get(id);
      st.built = build(id, 1 + Math.floor(Math.random() * 999999));
      ch.setData(st.built);
      ch.setOverlays(TJR.annotate(st.built, {}));
      if (sym) sym.textContent = st.built.meta.instrument;
      if (tfTag) tfTag.textContent = TF_NAME[st.built.meta.tf] || '';
      if (title) title.textContent = id + ' · ' + def.title;
      fig.setAttribute('data-scenario', id);
      fig.setAttribute('data-seed', String(st.built.meta.seed));
    }
    function go() {
      var my = st.run, n = st.built.candles.length;
      ch.play({ to: n - 1, barsPerSec: BPS, onBar: onBar }).then(function (done) {
        if (!done || my !== st.run || st.paused) return;
        st.ended = true;
        st.timer = setTimeout(next, HOLD);
      });
    }
    function next() {
      st.timer = null;
      if (st.paused) return;
      fig.classList.add('is-swapping');
      st.timer = setTimeout(function () {
        st.timer = null;
        if (st.paused) { fig.classList.remove('is-swapping'); return; }
        cycle();
        fig.classList.remove('is-swapping');
      }, 300);
    }
    function cycle() {
      st.run++; st.ended = false;
      load();
      var from = startBar(st.built);
      ch.reveal(from);
      onBar(from);
      go();
    }
    function still() {
      st.run++;
      if (st.timer) { clearTimeout(st.timer); st.timer = null; }
      fig.classList.remove('is-swapping');
      ch.pause();
      if (!st.built) load();
      var n = st.built.candles.length;
      ch.reveal(n - 1);
      onBar(n - 1);
    }
    function setPaused(p) {
      st.paused = p;
      if (btn) btn.setAttribute('aria-pressed', String(p));
      if (btn) btn.setAttribute('aria-label', p ? 'เล่นแอนิเมชันกราฟต่อ' : 'หยุดแอนิเมชันกราฟชั่วคราว');
      if (p) {
        st.run++;
        if (st.timer) { clearTimeout(st.timer); st.timer = null; }
        fig.classList.remove('is-swapping');
        ch.pause();
      } else if (st.ended) next();
      else { st.run++; go(); }
    }
    if (btn) btn.addEventListener('click', function () { setPaused(!st.paused); });

    function start() {
      if (M.reduced) {                       // one fully annotated final frame, no loop to pause
        if (btn) btn.hidden = true;
        still();
        return;
      }
      if (btn) btn.hidden = false;
      if (!st.paused) cycle();
    }
    start();
    TJR.motion.onChange(function (reduced) { if (reduced) { if (btn) btn.hidden = true; still(); } else start(); });
    return ch;
  }

  // ================================================================ 4 · #core: sweep, confirmation, entry
  // The walk: three equal stretches of the section's scroll, one a step. In each, the first 65% reveals
  // from the previous stop to this step's stop and the rest holds it; the third step's hold goes on to
  // the last bar (the clip's "price rises", F6.5).
  function stops(b) {
    var T = b.truth;
    return [T.sweep.bar, T.confirmBar, T.entryWindow.from];
  }
  function barAt(p, start, S, last) {
    var k = Math.min(2, Math.floor(clamp(p, 0, 1) * 3)), local = clamp(p * 3 - k, 0, 1), from = k === 0 ? start : S[k - 1];
    if (local <= 0.65) return { k: k, bar: Math.round(from + (S[k] - from) * (local / 0.65)) };
    return { k: k, bar: k === 2 ? Math.round(S[2] + (last - S[2]) * ((local - 0.65) / 0.35)) : S[k] };
  }
  TJR.home = { barAt: barAt, startBar: startBar };   // pure helpers, for the console and tests

  var core = { charts: [], st: null, off: null };
  var tall = global.matchMedia ? global.matchMedia('(min-height: 620px)') : null;
  function frame(host, built, opts) {
    var f = doc.createElement('figure');
    f.className = 'chart-frame';
    f.setAttribute('data-ui', 'chart');
    f.setAttribute('aria-label', opts.label);
    f.innerHTML = '<div class="chart-frame__bar"><span class="chart-frame__sym"></span><span class="chart-frame__tf"></span>' +
      '<span class="chart-frame__title"></span><span class="chart-frame__meta"></span></div><div class="chart-frame__canvas"></div>';
    $('.chart-frame__sym', f).textContent = built.meta.instrument;
    $('.chart-frame__tf', f).textContent = TF_NAME[built.meta.tf] || '';
    $('.chart-frame__title', f).textContent = opts.title;
    $('.chart-frame__meta', f).textContent = opts.meta || '';
    host.appendChild(f);
    var ch = TJR.chart.create($('.chart-frame__canvas', f), { label: opts.label, interactive: false });
    ch.setData(built);
    ch.setOverlays(TJR.annotate(built, {}));
    return ch;
  }
  function coreTeardown() {
    if (core.st) { try { core.st.kill(); } catch (e) { /* gone */ } core.st = null; }
    core.charts.forEach(function (c) { c.destroy(); });
    core.charts = [];
    $$('[data-core-still]').forEach(function (h) { h.innerHTML = ''; });
    var sec = $('#core');
    if (sec) {
      sec.classList.remove('is-live');
      $$('.core-step', sec).forEach(function (s) { s.classList.remove('is-on'); });
    }
  }
  function coreMount() {
    var sec = $('#core');
    if (!sec) return;
    coreTeardown();
    var b = build('S01', 1), n = b.candles.length, S = stops(b), start = startBar(b), def = TJR.scenarios.get('S01');
    // the stage stands still for a screen, so it needs one tall enough to hold the heading, the chart and a
    // step together: a short window (a phone on its side, a 320px phone) gets the three still rows instead
    var ST = M.ScrollTrigger, live = !!(M.enabled && ST && M.gsap && (!tall || tall.matches));
    if (!live) {
      var names = ['ขั้น 1 · sweep', 'ขั้น 2 · confirmation', 'ขั้น 3 · entry'];
      $$('[data-core-still]', sec).forEach(function (host, k) {
        var ch = frame(host, b, { label: 'กราฟ S01 ' + names[k], title: 'S01 · ' + def.title, meta: names[k] });
        ch.reveal(k === 2 ? n - 1 : S[k]);
        core.charts.push(ch);
      });
      return;
    }
    sec.classList.add('is-live');
    var host = $('.core__canvas', sec), meta = $('[data-k="step"]', sec), rail = $$('.core__rail i', sec), steps = $$('.core-step', sec);
    var ch = TJR.chart.create(host, { label: 'กราฟ S01: กวาด stacked lows แล้วกลับตัวขึ้น', interactive: false });
    ch.setData(b);
    ch.setOverlays(TJR.annotate(b, {}));
    ch.reveal(start);
    core.charts.push(ch);
    var cur = { k: -1, bar: start };
    function apply(p) {
      var at = barAt(p, start, S, n - 1);
      if (at.bar !== cur.bar) { ch.reveal(at.bar); cur.bar = at.bar; }
      if (at.k !== cur.k) {
        cur.k = at.k;
        steps.forEach(function (s, i) { s.classList.toggle('is-on', i === at.k); });
        if (meta) meta.textContent = 'ขั้น ' + (at.k + 1) + ' / 3';
      }
      rail.forEach(function (r, i) { r.style.setProperty('--f', String(clamp(p * 3 - i, 0, 1))); });
    }
    core.st = ST.create({
      trigger: sec, start: 'top top', end: 'bottom bottom',
      onUpdate: function (self) { apply(self.progress); },
      onRefresh: function (self) { apply(self.progress); }
    });
    apply(core.st.progress || 0);
  }

  // ================================================================ 5 · the scenario door's chart
  function doorChart() {
    var host = $('.door-chart__canvas');
    if (!host) return;
    var b = build('S08', 2);
    var ch = TJR.chart.create(host, { label: 'กราฟตัวอย่าง S08', interactive: false, axes: false });
    ch.setData(b);
    ch.setOverlays(TJR.annotate(b, {}));
  }

  // ---------------------------------------------------------------- start
  try { enterHero(); } catch (e) { var h = $('.hero[data-enter]'); if (h) { h.classList.remove('is-holding'); h.classList.add('is-entered'); } }
  heroLoop();
  coreMount();
  doorChart();
  // a reduced-motion change swaps the walkthrough between its live and still forms; a phone turned on
  // its side re-measures the sticky stage (ScrollTrigger refreshes on resize by itself)
  TJR.motion.onChange(function () { coreMount(); });
  if (tall) { if (tall.addEventListener) tall.addEventListener('change', coreMount); else if (tall.addListener) tall.addListener(coreMount); }
  var wide = global.matchMedia ? global.matchMedia('(max-width: 1023px)') : null;
  if (wide && M.ScrollTrigger) {
    var refresh = function () { try { M.ScrollTrigger.refresh(); } catch (e) { /* none yet */ } };
    if (wide.addEventListener) wide.addEventListener('change', refresh); else if (wide.addListener) wide.addListener(refresh);
  }
})(typeof window !== 'undefined' ? window : globalThis);
