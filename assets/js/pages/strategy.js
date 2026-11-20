/* TJR Liquidity: the Level 2 strategy page (Task 8). Classic script, after the engine, layout and motion.

   The worked trade of playlist clip #1 (TEp3a-7GUds, replay day Fri 16 Jan 2026, P1.64) told as a step tracker over a twin
   chart of S21 (ES traded, NQ beside it, fixed seed). The chart is a SIMULATION that follows the order of events he
   describes; it is not that day's data and the page says so. Nothing on it is a quote of his prices.

   1. pure helpers on TJR.strategyPage (no DOM, tested in Node by tests/strategy.test.js):
      META          the nine steps: key, the fact ids behind them and the chips (clip #1, plus #6 for the SMT rules)
      build(seed)   the S21 chart; steps(b) the bar each step reveals, read from the candles and truth (never a planned bar);
      stepState     one step as { i, n, key, bar, bars, last, facts, chips }; bars never shrink from step to step
      overlays(b)   the chart overlays for both panels, each with appearAt (nothing anchored after the bar it shows at)
      stopLevel / reachBar / touchBar   the stop of the simulated trade, the bar the target is reached, the first bar in the premium
      READOUT       the position-drawing numbers of P1.59 (an on-screen tool readout, not something he says)
   2. page: layout, the twin chart (created near the screen, destroyed when far), the tracker, prev / next / play,
      the step cards (a card on the reading line moves the chart on a wide screen, and prev / next / the track / play
      bring the current card into view there), one entrance per card (GSAP, once).
   The facts, chips and gap badges live in strategy.html. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var doc = global.document;
  var P = TJR.strategyPage = TJR.strategyPage || {};
  var TICK = 0.25;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ================================================================ 1 · pure helpers

  // the nine steps (clip #1 unless the clip number says otherwise). Ids are the facts files' ids; chips are [second, clip].
  var META = [
    { n: 1, key: 'bias', facts: ['P1.24', 'P1.25', 'P1.26', 'P1.27', 'P1.28', 'P1.29', 'P1.30'],
      chips: [[1265, 1], [1076, 1], [1101, 1], [1163, 1], [1330, 1], [1448, 1], [1417, 1]],
      cap: 'bias ขึ้น และ draw อยู่เหนือราคา' },
    { n: 2, key: 'smt', facts: ['P1.31', 'P1.32', 'P6.15', 'P6.16'],
      chips: [[1479, 1], [1515, 1], [316, 6], [338, 6]],
      cap: 'NQ ทะลุ high ES ไม่ทะลุ: bearish SMT' },
    { n: 3, key: 'patience', facts: ['P1.33', 'P1.34', 'P1.35', 'P1.36'],
      chips: [[1570, 1], [1628, 1], [1670, 1], [1714, 1]],
      cap: 'รอก่อน: SMT ยังไม่พอ ต้องให้ structure เปลี่ยน' },
    { n: 4, key: 'bos', facts: ['P1.37', 'P1.38'],
      chips: [[1767, 1], [1747, 1]],
      cap: 'ไม่มี gap ให้ inverse จึงรอ BOS' },
    { n: 5, key: 'leader', facts: ['P1.40', 'P6.21'],
      chips: [[1830, 1], [629, 6]],
      cap: 'เทรดตัวที่นำ: ES' },
    { n: 6, key: 'eq', facts: ['P1.39', 'P1.41', 'P1.42', 'P1.43'],
      chips: [[1798, 1], [1881, 1], [1913, 1], [1944, 1]],
      cap: 'equilibrium ถูกเติมแล้ว แต่ยังไม่เข้าตอนแตะ' },
    { n: 7, key: 'entry', facts: ['P1.44', 'P1.45', 'P1.46', 'P1.47', 'P1.49'],
      chips: [[1975, 1], [1996, 1], [2060, 1], [2206, 1], [2103, 1]],
      cap: 'เข้าหลังการยืนยันที่ออกมาจาก confluence' },
    { n: 8, key: 'exit', facts: ['P1.50', 'P1.51', 'P1.20'],
      chips: [[2113, 1], [2431, 1], [2474, 1]],
      cap: 'stop เหนือ high, TP1-TP3 ที่ low ด้านล่าง' },
    { n: 9, key: 'wrong', facts: ['P1.52', 'P1.53'],
      chips: [[2341, 1], [2431, 1]],
      cap: 'bias ผิด แต่เทรดนี้ยังไปถึงเป้า' }
  ];

  // P1.59: the position drawing on the ES 1-minute chart. A readout of the on-screen tool, not words of his:
  // he does not say whether these are his real stop, size or targets, and no contract quantity is legible.
  var READOUT = {
    label: 'ตัวเลขจากเครื่องมือบนจอ ไม่ใช่ที่เขาพูด',
    entry: 6993.5,
    stop: { price: 6998, points: 4.5, ticks: 18, pct: 0.064 },
    tp1: { price: 6982.5, points: 11, ticks: 44, rr: 2.44 },
    tp2: { price: 6974.75, points: 18.75, ticks: 75, rr: 4.17 }
  };

  var SEED = 1;                                           // fixed: the chart every visitor sees first (checked readable)
  // his trade is the bearish SMT at a high with ES leading: S21 draws kind and leader from the seed, so both are pinned here
  var STORY = { kind: 'high', lead: 'ES' };
  function build(seed) { return TJR.scenarios.safeBuild(TJR.scenarios.get('S21'), seed == null ? SEED : seed, STORY); }
  var memo = null;
  function defaultBuild() { if (!memo) memo = build(SEED); return memo; }

  // the bar at which a swing high at `bar` is known (its pair has closed)
  function knownOf(cs, bar) {
    var h = TJR.swings.find(cs).highs.filter(function (x) { return x.i === bar; })[0];
    return h ? h.pair[1] : bar + 2;
  }
  // first bar whose low reaches the target of the simulated trade (a short), after the entry
  function reachBar(b) {
    var K = b.truth.confluence, cs = b.candles, t = K.targets[0].price;
    for (var j = K.entry.at + 1; j < cs.length; j++) if (cs[j].l <= t) return j;
    return cs.length - 1;
  }
  // the first bar after the range is placeable whose high goes into the premium (above 0.5); the bar before the entry
  // when none does
  function touchBar(b) {
    var K = b.truth.confluence, cs = b.candles;
    for (var j = K.cont.at + 1; j < K.entry.at; j++) if (cs[j].h > K.cont.eq) return j;
    return Math.max(K.cont.at, K.entry.at - 1);
  }
  // the stop of the simulated short: above the highest high from the first high to the entry. The clip says only
  // "above these highs", so this is the site's choice for the simulation.
  function stopLevel(b) {
    var K = b.truth.confluence, cs = b.candles, from = b.truth.smt.main.p1.bar, m = -Infinity;
    for (var j = from; j <= K.entry.at; j++) if (cs[j].h > m) m = cs[j].h;
    return { price: m, bar: K.entry.at };
  }

  // the bar each step reveals; never goes backwards
  function steps(b) {
    var T = b.truth, K = T.confluence, n = b.candles.length;
    var known1 = Math.max(knownOf(b.candles, T.smt.main.p1.bar), knownOf(T.twin.candles, T.smt.twin.p1.bar));
    var raw = [
      known1,                                             // 1 bias: both first highs are known, no SMT yet
      T.smt.at,                                           // 2 SMT: both second highs are known
      Math.max(T.smt.at, K.confirm.at - 1),               // 3 patience: the last bar before the break
      K.confirm.at,                                       // 4 BOS: the first close beyond the most recent low
      K.confirm.at,                                       // 5 trade the leader (the break is on it)
      touchBar(b),                                        // 6 equilibrium filled (price is in the premium)
      K.entry.at,                                         // 7 entry
      reachBar(b),                                        // 8 target reached
      n - 1                                               // 9 the whole move
    ];
    var prev = 0;
    return META.map(function (m, i) {
      var bar = clamp(Math.max(raw[i], prev), 0, n - 1);
      prev = bar;
      return { n: m.n, key: m.key, bar: bar, facts: m.facts.slice(), chips: m.chips.map(function (c) { return c.slice(); }), cap: m.cap };
    });
  }

  function stepState(i, b) {
    b = b || defaultBuild();
    var st = steps(b);
    i = clamp(Math.round(Number(i) || 0), 0, st.length - 1);
    var s = st[i];
    return { i: i, n: s.n, key: s.key, bar: s.bar, bars: s.bar + 1, last: i === st.length - 1, facts: s.facts, chips: s.chips, cap: s.cap };
  }

  // chart overlays for both panels. Every overlay carries appearAt = the bar of the step it belongs to (or, for
  // detector output, the bar the detector says it is known), so revealing bar by bar never shows anything early.
  function overlays(b) {
    var T = b.truth, K = T.confluence, S = T.smt, st = steps(b);
    var step = {}; st.forEach(function (s) { step[s.key] = s.bar; });
    var main = [], twin = [];

    function side(list, p) {
      var up = p.p2.price > p.p1.price;
      list.push({ id: 'draw', type: 'level', price: p.p1.price, from: p.p1.bar, label: 'draw ด้านบน', kind: 'liq', state: 'active', appearAt: step.bias });
      list.push({ id: 'smt-line', type: 'trend', a: { bar: p.p1.bar, price: p.p1.price }, b: { bar: p.p2.bar, price: p.p2.price }, appearAt: S.at });
      list.push({ id: 'smt-1', type: 'label', bar: p.p1.bar, price: p.p1.price, text: 'high 1', pos: 'above', appearAt: S.at });
      list.push({ id: 'smt-2', type: 'label', bar: p.p2.bar, price: p.p2.price, text: up ? 'higher high' : 'lower high', pos: 'above', appearAt: S.at });
    }
    side(main, S.main);
    side(twin, S.twin);

    // the low he waits for a close under, until the break; the break itself (BOS) on the traded chart
    var lv = K.confirm.level;
    main.push({ id: 'watch', type: 'level', price: lv.price, from: lv.i, to: K.confirm.at - 1, label: 'low ล่าสุดที่เฝ้า', kind: 'htf', state: 'active', appearAt: step.patience });
    main.push({ id: 'bos:' + K.confirm.at, type: 'bos', price: lv.price, from: lv.i, at: K.confirm.at, dir: K.confirm.dir, appearAt: K.confirm.at });
    // the range in force at the entry (from the high to the new low): the premium half is where he looks for the short
    TJR.annotate.confluence(b, { show: { fvg: false, bos: false, eq: true, windows: false } }).forEach(function (o) {
      if (o.type === 'eq' && o.from === K.cont.from && o.to === K.cont.to) { var c = {}; for (var k in o) c[k] = o[k]; delete c.endAt; main.push(c); }
    });
    main.push({ id: 'entry', type: 'marker', bar: K.entry.at, price: K.entry.price, shape: 'down', color: '#e6b84c', appearAt: step.entry });
    var sl = stopLevel(b), reach = step.exit;
    main.push({ id: 'stop', type: 'level', price: sl.price, from: K.entry.at, label: 'stop จำลอง', kind: 'liq', state: 'active', appearAt: reach });
    main.push({ id: 'tp', type: 'level', price: K.targets[0].price, from: K.entry.at, label: 'เป้า จำลอง', kind: 'target', state: 'active', appearAt: reach });
    return { main: main, twin: twin };
  }

  // the card of the current step leaves the visible band (below the nav, above the screen bottom): bring it back
  function needsFollow(top, bottom, viewH, topInset) {
    if (bottom - top > viewH - topInset) return !(top <= viewH / 2 && bottom >= viewH / 2);   // taller than the band: it covers the middle
    return top < topInset || bottom > viewH;
  }

  P.META = META; P.READOUT = READOUT; P.SEED = SEED; P.needsFollow = needsFollow;
  P.build = build; P.steps = steps; P.stepState = stepState; P.overlays = overlays;
  P.stopLevel = stopLevel; P.reachBar = reachBar; P.touchBar = touchBar;

  if (!doc || !TJR.layout || !TJR.chart || !TJR.chart.create) return;   // Node (tests): helpers only

  // ================================================================ 2 · page
  var M = TJR.motion.init();
  TJR.layout.mount({
    page: 'strategy',
    close: { title: 'ไปขั้น 4: Playbook', line: 'เอาทั้งสายมาเรียงเป็นขั้นตอนที่ใช้ตอนเทรดจริง', label: 'ไปขั้น 4', href: 'playbook.html' }
  });

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function stamp(t) { return TJR.sessions.fmtET(t) + ' ET · ' + TJR.sessions.fmtThai(t) + ' น.'; }

  var fig = $('[data-slot="strat"]');
  var cards = $$('.step'), goBtns = $$('[data-go]');
  var S = { step: 0, seed: SEED };
  var api = null, timer = null, dead = false, following = 0;
  var sticky = global.matchMedia ? global.matchMedia('(min-width: 1024px) and (min-height: 800px)') : null;

  // prev / next / the track / play: on a wide screen (the chart sticks beside the cards) the current card scrolls into view.
  // While that scroll runs, cards crossing the reading line do not move the chart (initScrollLink).
  function follow(i) {
    var c = cards[i];
    if (!c || !sticky || !sticky.matches || !c.getBoundingClientRect) return;
    var r = c.getBoundingClientRect(), nav = parseFloat(global.getComputedStyle(doc.documentElement).getPropertyValue('--nav')) || 64;
    if (!needsFollow(r.top, r.bottom, global.innerHeight, nav)) return;
    var mine = ++following;
    var done = function () { if (mine === following) following = 0; };
    if ('onscrollend' in global) global.addEventListener('scrollend', function () { setTimeout(done, 200); }, { once: true });   // late observer entries
    setTimeout(done, 1800);
    c.scrollIntoView({ block: 'center', behavior: M.reduced ? 'auto' : 'smooth' });
  }

  function setCurrent(i) {
    cards.forEach(function (c, k) {
      c.classList.toggle('is-current', k === i);
      c.classList.toggle('is-past', k < i);
      if (k === i) c.setAttribute('aria-current', 'step'); else c.removeAttribute('aria-current');
    });
    goBtns.forEach(function (g) {
      var k = Number(g.getAttribute('data-go')) - 1;
      g.classList.toggle('is-current', k === i);
      g.classList.toggle('is-past', k < i);
      if (k === i) g.setAttribute('aria-current', 'step'); else g.removeAttribute('aria-current');
    });
    var bar = $('.track__bar'); if (bar) bar.style.setProperty('--p', String(i / (META.length - 1)));
    var cap = $('[data-k="cap"]', fig), no = $('[data-k="stepno"]', fig);
    if (cap) cap.textContent = META[i].cap;
    if (no) no.textContent = 'ข้อที่ ' + (i + 1) + ' จาก ' + META.length;
    var prev = $('[data-act="prev"]', fig), next = $('[data-act="next"]', fig);
    if (prev) prev.disabled = i === 0;
    if (next) next.disabled = i === META.length - 1;
  }

  function stopTimer() { if (timer) { clearTimeout(timer); timer = null; } setPlayLabel(false); }
  function setPlayLabel(on) {
    var b = $('[data-act="play"]', fig), l = b && $('[data-k="lab"]', b);
    if (l) l.textContent = on ? 'หยุด' : (S.step >= META.length - 1 ? 'เล่นใหม่' : 'เล่นต่อเนื่อง');
    if (b) b.setAttribute('data-state', on ? 'on' : 'off');
  }

  // ---------------------------------------------------------------- the twin chart
  function mountChart() {
    if (api || dead || !fig) return api;
    var hostA = $('[data-k="hostA"]', fig), hostB = $('[data-k="hostB"]', fig);
    var b = build(S.seed), st = steps(b), ov = overlays(b), cs = b.candles;
    var twinBuilt = { candles: b.truth.twin.candles, meta: Object.assign({}, b.meta, { instrument: b.truth.twin.instrument }) };
    var tw = TJR.chart.twin(hostA, hostB, { label: 'กราฟจำลองคู่ ES และ NQ ตามลำดับเหตุการณ์ที่ TJR เล่า ไม่ใช่ข้อมูลจริงของวันนั้น', interactive: true });
    try {
      tw.setData(b, twinBuilt);
      tw.a.setOverlays(ov.main); tw.b.setOverlays(ov.twin);
    } catch (e) { tw.destroy(); if (global.console) console.error(e); return null; }
    var run = 0;
    api = {
      b: b, tw: tw, st: st,
      show: function (i, animate) {
        run++;
        var to = st[i].bar, from = tw.a.info().revealed;
        if (animate && !M.reduced && to > from) {
          var my = run;
          tw.play({ from: from, to: to, barsPerSec: 9 }).then(function (done) { if (my === run && done) tw.reveal(to); });
        } else tw.reveal(to);
      },
      destroy: function () { run++; tw.destroy(); }
    };
    return api;
  }
  function unmountChart() { if (!api) return; stopTimer(); api.destroy(); api = null; }

  function readBox(i) {
    var box = $('[data-k="read"]', fig);
    if (!box || !api) return;
    var s = api.st[i], b = api.b, cs = b.candles, K = b.truth.confluence, T = b.truth;
    var when = stamp(cs[s.bar].t), sim = ' <span class="sim-lab">ตัวเลขจากกราฟจำลอง</span>';
    var px = TJR.util.fmtPrice, t = '';
    switch (META[i].key) {
      case 'bias': t = 'ราคาไต่ขึ้นสู่ high แรกของทั้งสอง index เส้นที่ high คือ draw ด้านบน'; break;
      case 'smt': t = 'ES ' + px(T.smt.main.p1.price) + ' → ' + px(T.smt.main.p2.price) + ' (lower high) · NQ ' + px(T.smt.twin.p1.price) + ' → ' + px(T.smt.twin.p2.price) + ' (higher high)'; break;
      case 'patience': t = 'ราคาปิดยังไม่ต่ำกว่า low ล่าสุด ' + px(K.confirm.level.price) + ' (เส้นแนวนอน) จึงยังไม่มี break'; break;
      case 'bos': t = 'แท่งที่ปิดใต้ ' + px(K.confirm.level.price) + ' ที่แท่ง ' + stamp(cs[K.confirm.at].t) + ' = BOS ลง (แสดงเฉพาะ ES)'; break;
      case 'leader': t = 'ES ที่ทำ lower high คือตัวนำ จึงเทรดที่ ES ส่วน NQ ที่ดันเหนือ high ไม่ใช่ตัวที่ short'; break;
      case 'eq': t = 'range จาก high ' + px(K.cont.high) + ' ลงถึง low ' + px(K.cont.low) + ' · 0.5 = ' + px(K.cont.eq) + ' · ราคากลับขึ้นมาในโซน premium'; break;
      case 'entry': t = 'หมุดทอง = แท่ง 5 นาทีที่ปิดกลับลงใต้เส้น 0.5 ราคา ' + px(K.entry.price) + ' (ทางเลือก a) ไม่มีกราฟ 1 นาทีในกราฟจำลอง'; break;
      case 'exit': t = 'stop จำลอง ' + px(stopLevel(b).price) + ' · เป้า จำลอง ' + px(K.targets[0].price) + ' ราคาไปถึงเป้าที่แท่ง ' + stamp(cs[reachBar(b)].t); break;
      default: t = 'ราคาลงถึงเป้าทั้งที่ bias เมื่อเช้าเป็นขาขึ้น';
    }
    box.innerHTML = t + sim + ' <span class="conf-when">' + when + '</span>';
  }

  // ---------------------------------------------------------------- stepping
  function go(i, animate) {
    i = clamp(i, 0, META.length - 1);
    S.step = i;
    setCurrent(i);
    var a = mountChart();
    if (a) { a.show(i, animate); readBox(i); }
    var es = $('[data-k="esframe"]', fig);
    if (es) es.classList.toggle('is-leader', i >= 4);
    var tag = $('[data-k="lead"]', fig); if (tag) tag.hidden = i < 4;
    if (!timer) setPlayLabel(false);
  }
  function play() {
    if (timer) { stopTimer(); return; }
    if (M.reduced) return;
    var i = S.step >= META.length - 1 ? 0 : S.step;
    if (S.step >= META.length - 1) go(0, false);
    setPlayLabel(true);
    (function tick(k) {
      go(k, true); follow(k);
      if (k >= META.length - 1) { timer = null; setPlayLabel(false); return; }
      var a = api, gap = a ? Math.max(1800, ((a.st[k + 1].bar - a.st[k].bar) / 9) * 1000 + 2200) : 2600;
      timer = setTimeout(function () { tick(k + 1); }, gap);
      setPlayLabel(true);
    })(i);
  }
  function applyReduced() {
    var pb = $('[data-act="play"]', fig);
    if (pb) pb.hidden = !!M.reduced;
    if (M.reduced) stopTimer();
  }

  function initControls() {
    if (!fig) return;
    fig.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!t || !fig.contains(t) || t.disabled) return;
      var act = t.getAttribute('data-act');
      if (act === 'play') { play(); return; }              // play toggles: a second press stops
      stopTimer();
      if (act === 'prev') go(S.step - 1, false);
      else if (act === 'next') go(S.step + 1, true);
      else return;
      follow(S.step);
    });
    goBtns.forEach(function (g) {
      g.addEventListener('click', function () { stopTimer(); go(Number(g.getAttribute('data-go')) - 1, true); follow(S.step); });
    });
    cards.forEach(function (c, k) {
      var see = $('[data-see]', c);
      if (see) see.addEventListener('click', function () {
        stopTimer(); go(k, true);
        if (fig && fig.scrollIntoView && global.innerWidth < 1024) fig.scrollIntoView({ block: 'start', behavior: M.reduced ? 'auto' : 'smooth' });
      });
    });
    applyReduced();
    TJR.motion.onChange(applyReduced);
  }

  // a card on the reading line moves the chart (a wide screen only: there the chart stays in view beside the cards)
  function initScrollLink() {
    if (!global.IntersectionObserver || !global.matchMedia) return;
    var wide = global.matchMedia('(min-width: 1024px)');
    var io = new global.IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting || !wide.matches || following) return;
        var k = cards.indexOf(e.target);
        if (k >= 0 && k !== S.step) { stopTimer(); go(k, true); }
      });
    }, { rootMargin: '-42% 0px -52% 0px' });
    cards.forEach(function (c) { io.observe(c); });
  }

  // the chart exists only near the screen
  function initSlot() {
    if (!fig) return;
    if (!global.IntersectionObserver) { go(0, false); return; }
    var near = new global.IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { var a = mountChart(); if (a) { a.show(S.step, false); readBox(S.step); } }
        else unmountChart();
      });
    }, { rootMargin: '90% 0px 90% 0px' });
    near.observe(fig);
  }

  // one entrance per card and heading (GSAP, once); whatever stalls, a card in view is never left hidden
  function reveal() {
    var ST = M.ScrollTrigger;
    if (!M.enabled || !ST) return;
    var pending = [];
    $$('.step, .strat-sec__head').forEach(function (el) {
      var tl = M.gsap.timeline({ paused: true });
      tl.from(el, { y: 22, opacity: 0, duration: 0.7, ease: 'power3.out', clearProps: 'all' }, 0);
      var rec = { el: el, played: false, go: function () { if (rec.played) return; rec.played = true; tl.play(); } };
      pending.push(rec);
      ST.create({ trigger: el, start: 'top 94%', once: true, onEnter: rec.go });
    });
    var tries = 0, iv = setInterval(function () {
      tries++;
      pending.forEach(function (r) { if (!r.played && r.el.getBoundingClientRect().top < global.innerHeight) r.go(); });
      if (tries > 8 || pending.every(function (r) { return r.played; })) clearInterval(iv);
    }, 1500);
  }

  P.go = go; P.state = S;                                // read-only handles for the console and the headless checks
  P.chart = function () { return api; };
  setCurrent(0);
  initControls();
  initSlot();
  initScrollLink();
  reveal();
})(typeof window !== 'undefined' ? window : globalThis);
