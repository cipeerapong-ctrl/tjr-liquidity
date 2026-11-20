/* TJR Liquidity: step 0, the beginner page (v3). Classic script, after layout and motion.

   1. pure helpers on TJR.startPage (no DOM, tested in Node by tests/start.test.js):
      split(open, close, high, low, n, seed)   one candle cut into n smaller ones (the timeframe toggle): the first opens at
                                               `open`, the last closes at `close`, the highest high is `high`, the lowest low is
                                               `low`, each candle opens where the one before closed, every price on the 0.25 tick
      marks(candles)                           the highs and lows of a series ([o,h,l,c] rows): a high is an up candle then a down
                                               candle (at the higher wick of the two), a low is a down candle then an up candle
                                               (at the lower wick); [{type, i, price}] in series order
   2. page: the path stops, the candle labels drawing in once, the timeframe split toggle, the highs and lows of the sample
      series, the two trend zigzags. Everything is static HTML first; script only adds the motion and the toggle.
   The facts, chips and gap badges live in start.html. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var doc = global.document;
  var P = TJR.startPage = TJR.startPage || {};
  var TICK = 0.25;

  function snap(v) { return Math.round(v / TICK) * TICK; }
  // small seeded generator (mulberry32): the same seed always draws the same candles
  function rng(seed) {
    var a = (seed == null ? 1 : seed) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ================================================================ 1 · pure helpers
  function split(open, close, high, low, n, seed) {
    var rand = rng(seed), range = high - low, out = [], k;
    var iH = Math.floor(rand() * n), iL = Math.floor(rand() * n);
    if (n > 1 && iL === iH) iL = (iH + 1 + Math.floor(rand() * (n - 1))) % n;   // the high and the low sit in different candles
    var prev = open;
    for (k = 0; k < n; k++) {
      var c = k === n - 1 ? close : snap(low + range * (0.15 + 0.7 * rand()));
      c = Math.min(high, Math.max(low, c));
      var top = Math.max(prev, c), bot = Math.min(prev, c);
      var h = Math.min(high, snap(top + range * 0.12 * rand()));
      var l = Math.max(low, snap(bot - range * 0.12 * rand()));
      if (k === iH) h = high;
      if (k === iL) l = low;
      out.push({ o: prev, h: Math.max(h, top), l: Math.min(l, bot), c: c });
      prev = c;
    }
    return out;
  }

  function marks(candles) {
    var out = [];
    for (var i = 0; i + 1 < candles.length; i++) {
      var a = candles[i], b = candles[i + 1];
      var aUp = a[3] > a[0], aDown = a[3] < a[0], bUp = b[3] > b[0], bDown = b[3] < b[0];
      if (aUp && bDown) out.push(a[1] >= b[1] ? { type: 'high', i: i, price: a[1] } : { type: 'high', i: i + 1, price: b[1] });
      else if (aDown && bUp) out.push(a[2] <= b[2] ? { type: 'low', i: i, price: a[2] } : { type: 'low', i: i + 1, price: b[2] });
    }
    return out;
  }

  // the sample series drawn in "high และ low" ([o, h, l, c] on a 0..100 scale; the marks on the page are marks(SAMPLE))
  var SAMPLE = [[40, 48, 38, 46], [46, 57, 44, 55], [55, 60, 48, 50], [50, 51, 40, 42], [42, 43, 34, 38], [38, 49, 36, 47],
    [47, 58, 46, 56], [56, 66, 55, 64], [64, 70, 56, 58], [58, 60, 50, 52], [52, 62, 49, 60], [60, 64, 55, 57]];
  // the two trend zigzags: swing points in order, the label says what each is (HH higher high, HL higher low, LL, LH likewise)
  var ZIG = {
    up: [{ v: 40, t: 'high' }, { v: 25, t: 'low' }, { v: 55, t: 'HH' }, { v: 40, t: 'HL' }, { v: 70, t: 'HH' }, { v: 52, t: 'HL' }],
    down: [{ v: 60, t: 'low' }, { v: 75, t: 'high' }, { v: 45, t: 'LL' }, { v: 62, t: 'LH' }, { v: 30, t: 'LL' }, { v: 48, t: 'LH' }]
  };

  P.split = split; P.marks = marks; P.SAMPLE = SAMPLE; P.ZIG = ZIG;

  if (!doc || !TJR.layout || !TJR.layout.mount) return;   // Node (tests): helpers only

  // ================================================================ 2 · page
  var M = TJR.motion.init();
  TJR.layout.mount({
    page: 'start',
    close: { title: 'พร้อมแล้ว ไปเรียน liquidity', line: 'ขั้นถัดไปคือความคิดหลักของระบบ TJR', label: 'ไปขั้น 1', href: 'learn.html' }
  });

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }

  // each picture's labels come in once when it scrolls into view (GSAP); whatever stalls, a label in view is never left hidden
  function revealLabels() {
    var ST = M.ScrollTrigger;
    if (!M.enabled || !ST) return;
    var pending = [];
    $$('.st-svg').forEach(function (svg) {
      var els = $$('.reveal', svg);
      if (!els.length) return;
      var tl = M.gsap.timeline({ paused: true });
      tl.from(els, { opacity: 0, y: 6, duration: 0.45, stagger: 0.06, ease: 'power2.out', clearProps: 'all' }, 0);
      var rec = { el: svg, played: false, go: function () { if (rec.played) return; rec.played = true; tl.play(); } };
      pending.push(rec);
      ST.create({ trigger: svg, start: 'top 88%', once: true, onEnter: rec.go });
    });
    var tries = 0, iv = setInterval(function () {
      tries++;
      pending.forEach(function (r) { if (!r.played && r.el.getBoundingClientRect().top < global.innerHeight) r.go(); });
      if (tries > 8 || pending.every(function (r) { return r.played; })) clearInterval(iv);
    }, 1500);
  }

  // the timeframe toggle: one 4-hour candle <-> the same movement as four 1-hour candles (split() keeps the high, the low, the open and the close)
  function initToggle() {
    var host = $('[data-k="tfcands"]'), btn = $('[data-k="tftoggle"]'), cap = $('[data-k="tfcap"]');
    if (!host || !btn || !cap) return;
    var LOW = 98, HIGH = 110, OPEN = 100, CLOSE = 107;       // the one candle drawn in start.html
    var big = host.innerHTML, on = false;
    function y(p) { return 230 - (p - LOW) / (HIGH - LOW) * 200; }
    function candleG(cx, w, c) {
      var up = c.c >= c.o, top = Math.min(y(c.o), y(c.c)), h = Math.max(Math.abs(y(c.o) - y(c.c)), 2);
      return '<g class="cd ' + (up ? 'cd--up' : 'cd--down') + '"><line x1="' + cx + '" x2="' + cx + '" y1="' + y(c.h) + '" y2="' + y(c.l) +
        '"/><rect x="' + (cx - w / 2) + '" y="' + top + '" width="' + w + '" height="' + h + '" rx="2"/></g>';
    }
    function render() {
      host.innerHTML = on ? P.split(OPEN, CLOSE, HIGH, LOW, 4, 5).map(function (c, k) { return candleG(110 + k * 110, 56, c); }).join('') : big;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.textContent = on ? 'รวมเป็นแท่ง 4 ชั่วโมง' : 'แยกเป็นแท่ง 1 ชั่วโมง';
      cap.textContent = on ? 'แท่ง 1 ชั่วโมง 4 แท่ง · ราคาที่วิ่งเหมือนเดิม' : 'แท่ง 4 ชั่วโมง 1 แท่ง';
      if (M.enabled && M.gsap) M.gsap.from(host.children, { opacity: 0, scaleY: 0.4, transformOrigin: '50% 50%', duration: 0.45, stagger: 0.08, ease: 'power2.out', clearProps: 'all' });
    }
    btn.hidden = false;                                      // without script the picture is the one candle and there is no dead button
    btn.addEventListener('click', function () { on = !on; render(); });
  }

  initToggle();
  revealLabels();
})(typeof window !== 'undefined' ? window : globalThis);
