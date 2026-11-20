/* TJR Liquidity: the risk and discipline page controller (v2 Task 9). Classic script, after the engine, layout and motion.

   1. pure helpers on TJR.riskPage (no DOM, tested in Node by tests/risk.test.js):
      calculator  contracts({account, riskPct, widestTicks, tickValue}), halve, calc(inputs), meter, clampRisk
      arithmetic  expectancy({winPct, rr}) (win rate x risk-to-reward, the site's own arithmetic)
      inputs      DEFAULTS, parseInputs, parseNumber, loadInputs, saveInputs (TJR.store, the one key risk.inputs)
      format      fmtNum, fmtPct, fmtR (no currency symbol: the tick value's unit is the viewer's own)
   2. page: the contract-size calculator (five inputs, the halve toggle, the result bars) and the win rate x R:R
      check. Everything the viewer types is kept in this browser only and is read back as numbers; the page never
      writes it as HTML, only as .value / textContent.
   The method follows what he describes (the same count at every trade, checked against the widest stop he
   meets often); the calculator itself is the site's tool, not his: he says he uses no calculator. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var doc = global.document;
  var R = TJR.riskPage = TJR.riskPage || {};

  var KEY = 'risk.inputs';
  var RISK_MIN = 0.1, RISK_MAX = 10, SWEET_LO = 1, SWEET_HI = 3;       // 1-3%: what he calls usually the sweet spot
  var DEFAULTS = { account: null, riskPct: 1, tightest: 16, widest: 35, tickValue: null, halve: false, wr: null, rr: null };
  var EPS = 1e-9;

  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function posNum(v) { return isNum(v) && v > 0 ? v : null; }
  function nonNeg(v) { return isNum(v) && v > 0 ? v : 0; }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  // ================================================================ 1a · the calculator

  function clampRisk(v) {
    if (!isNum(v)) return DEFAULTS.riskPct;
    return v < RISK_MIN ? RISK_MIN : v > RISK_MAX ? RISK_MAX : v;
  }

  // whole contracts so that the loss at the widest stop is at most risk% of the account
  function contracts(i) {
    if (!i || typeof i !== 'object') return 0;
    var account = posNum(i.account), widest = posNum(i.widestTicks), tick = posNum(i.tickValue);
    if (account == null || widest == null || tick == null) return 0;
    var amount = account * clampRisk(i.riskPct) / 100;
    var n = Math.floor(amount / (widest * tick) + EPS);         // EPS: 137.99999999999997 is 138
    return isFinite(n) && n > 0 ? n : 0;
  }

  // his two exceptions halve the count; never below one contract while the base count is one or more
  function halve(n) {
    if (!isNum(n) || n < 1) return 0;
    return Math.max(1, Math.floor(n / 2));
  }

  function lossPart(size, ticks, tick, account) {
    var loss = size * ticks * tick;
    return { ticks: ticks, loss: loss, pct: loss / account * 100 };
  }

  // the whole answer for the page: status 'need-account' | 'need-widest' | 'need-tick' | 'ok'
  function calc(inp) {
    inp = inp && typeof inp === 'object' ? inp : {};
    var account = posNum(inp.account), widest = posNum(inp.widest), tick = posNum(inp.tickValue), tight = posNum(inp.tightest);
    if (account == null) return { status: 'need-account' };
    if (widest == null) return { status: 'need-widest' };
    if (tick == null) return { status: 'need-tick' };
    var risk = clampRisk(inp.riskPct), amount = account * risk / 100;
    var base = contracts({ account: account, riskPct: risk, widestTicks: widest, tickValue: tick });
    var size = inp.halve ? halve(base) : base;
    return {
      status: 'ok',
      riskPct: risk,
      riskAmount: amount,
      base: base,
      size: size,
      halved: !!inp.halve,
      cannotHalve: !!inp.halve && base === 1,            // one contract halves to one: the toggle changes nothing
      widest: lossPart(size, widest, tick, account),
      tightest: tight == null ? null : lossPart(size, tight, tick, account),
      oneContract: lossPart(1, widest, tick, account),
      order: tight == null ? true : tight <= widest,
      sweet: risk >= SWEET_LO - EPS && risk <= SWEET_HI + EPS,
      tooSmall: base === 0
    };
  }

  // bar lengths as fractions of ONE scale that always has room for the risk limit
  function meter(limitPct, widestPct, tightestPct) {
    var L = nonNeg(limitPct), W = nonNeg(widestPct), T = nonNeg(tightestPct);
    var max = Math.max(L * 1.2, W, T);
    if (!(max > 0)) max = 1;
    return { max: max, limit: L / max, widest: W / max, tightest: T / max };
  }

  // ================================================================ 1b · win rate x risk-to-reward

  // expectancy in R per trade, and the win rate that breaks even at this risk-to-reward
  function expectancy(i) {
    if (!i || typeof i !== 'object') return null;
    var wp = i.winPct, rr = i.rr;
    if (!isNum(wp) || wp < 0 || wp > 100 || !isNum(rr) || rr < 0) return null;
    var w = wp / 100, e = w * rr - (1 - w);
    return { expR: e, breakEven: 100 / (1 + rr), positive: e > EPS };
  }

  // ================================================================ 1c · what is typed, what is kept

  // text -> number, or null when it is not a plain number ("50,000" and "1 000" are fine)
  function parseNumber(s) {
    if (typeof s === 'number') return isNum(s) ? s : null;
    if (typeof s !== 'string') return null;
    var t = s.replace(/[,\s ]+/g, '');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
    var n = Number(t);
    return isNum(n) ? n : null;
  }

  function ticksOf(v) { return isNum(v) && v >= 0.5 && v <= 100000 ? Math.round(v) : null; }

  // a stored or typed object -> a clean one: known keys only; an absent key takes the default, a damaged one is empty
  function parseInputs(raw) {
    var out = {};
    var src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    function pick(k, fn) { out[k] = has(src, k) ? fn(src[k]) : DEFAULTS[k]; }
    pick('account', function (v) { return isNum(v) && v > 0 && v <= 1e12 ? v : null; });
    pick('riskPct', clampRisk);
    pick('tightest', ticksOf);
    pick('widest', ticksOf);
    pick('tickValue', function (v) { return isNum(v) && v > 0 && v <= 1e6 ? v : null; });
    pick('halve', function (v) { return v === true; });
    pick('wr', function (v) { return isNum(v) && v >= 0 && v <= 100 ? v : null; });
    pick('rr', function (v) { return isNum(v) && v >= 0 && v <= 100 ? v : null; });
    return out;
  }

  function loadInputs() {
    var raw = null;
    try { raw = TJR.store ? TJR.store.get(KEY, null) : null; } catch (e) { raw = null; }
    return parseInputs(raw);
  }
  function saveInputs(i) {
    try { if (TJR.store) TJR.store.set(KEY, parseInputs(i)); } catch (e) { /* the page works without storage */ }
  }

  // ================================================================ 1d · numbers for the page

  function fmtNum(n) {
    if (!isNum(n)) return '-';
    var r = Math.round(n * 100) / 100, s = Math.abs(r).toFixed(2).replace(/\.?0+$/, '');
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (r < 0 ? '-' : '') + parts.join('.');
  }
  function fmtPct(n) { return isNum(n) ? fmtNum(n) + '%' : '-'; }
  function fmtR(n) {
    if (!isNum(n)) return '-';
    var a = Math.abs(n).toFixed(2), sign = n > 0.005 ? '+' : n < -0.005 ? '-' : '';
    return sign + a + ' R';
  }

  R.KEY = KEY; R.RISK_MIN = RISK_MIN; R.RISK_MAX = RISK_MAX; R.DEFAULTS = DEFAULTS;
  R.clampRisk = clampRisk; R.contracts = contracts; R.halve = halve; R.calc = calc; R.meter = meter;
  R.expectancy = expectancy; R.parseNumber = parseNumber; R.parseInputs = parseInputs;
  R.loadInputs = loadInputs; R.saveInputs = saveInputs;
  R.fmtNum = fmtNum; R.fmtPct = fmtPct; R.fmtR = fmtR;

  if (!doc || !TJR.layout || !TJR.motion) return;   // Node (tests): helpers only

  // ================================================================ 2 · page
  var M = TJR.motion.init();
  TJR.layout.mount({
    page: 'risk',
    close: {
      title: 'เรียนครบแล้ว ไปฝึกต่อ',
      line: 'ลองอ่านกราฟจริงในหน้าสถานการณ์ หรือซ้อมในหน้าแบบฝึก ส่วน stop-loss และสัดส่วน TP ที่คลิปไม่ได้บอก เขียนเป็นกฎของคุณเอง',
      label: 'ไปฝึกต่อ',
      href: 'scenarios.html'
    }
  });

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function setText(el, t) { if (el && el.textContent !== t) el.textContent = t; }

  var state = loadInputs();
  var box = $('#calc');
  if (!box) return;
  var F = { account: $('#rk-account'), riskPct: $('#rk-risk'), tightest: $('#rk-tight'), widest: $('#rk-wide'), tickValue: $('#rk-tick'), wr: $('#rk-wr'), rr: $('#rk-rr') };
  var K = {};
  ['contracts', 'contracts-sub', 'loss-wide', 'pct-wide', 'loss-tight', 'pct-tight', 'bar-wide', 'bar-tight', 'limit', 'limit-lab', 'msg', 'halve', 'meter',
    'exp', 'be', 'exp-msg'].forEach(function (k) { K[k] = $('[data-k="' + k + '"]'); });
  var timer = null;

  function plain(n) { return n == null ? '' : String(n); }
  function paintFields(skip) {
    Object.keys(F).forEach(function (k) {
      var el = F[k];
      if (!el || el === skip) return;
      var want = plain(state[k]);
      if (el.value !== want) el.value = want;
    });
  }
  function setBar(el, frac) { if (el) el.style.setProperty('--w', String(Math.max(0, Math.min(1, frac)))); }

  var MSG = {
    'need-account': 'กรอกขนาดบัญชีของคุณ',
    'need-widest': 'กรอก stop ที่กว้างที่สุดที่คุณเจอบ่อย (หน่วย tick)',
    'need-tick': 'กรอก tick value ของสัญญาที่คุณเทรด คลิปไม่ได้ระบุค่านี้ ใช้ค่าของคุณเอง'
  };

  function paintCalc() {
    var c = calc(state);
    if (c.status !== 'ok') {
      setText(K.contracts, '–'); setText(K['contracts-sub'], '');
      ['loss-wide', 'pct-wide', 'loss-tight', 'pct-tight'].forEach(function (k) { setText(K[k], '–'); });
      setBar(K['bar-wide'], 0); setBar(K['bar-tight'], 0);
      if (K.meter) K.meter.setAttribute('data-state', 'empty');
      setText(K.msg, MSG[c.status]);
      return;
    }
    if (K.meter) K.meter.setAttribute('data-state', c.tooSmall ? 'small' : 'ok');
    var m = meter(c.riskPct, c.tooSmall ? c.oneContract.pct : c.widest.pct, c.tightest && !c.tooSmall ? c.tightest.pct : 0);
    setText(K.contracts, String(c.size));
    setText(K['contracts-sub'], c.cannotHalve ? 'ขนาดปกติคือ 1 contract หารครึ่งไม่ได้ จึงยังเป็น 1 contract' : c.halved && c.base >= 1 ? 'ลดครึ่งจาก ' + c.base + ' contract ปกติ' : c.tooSmall ? 'ต่อให้ 1 contract ก็เกินที่ตั้งไว้' : 'contract ต่อเทรด');
    if (c.tooSmall) {
      setText(K['loss-wide'], fmtNum(c.oneContract.loss)); setText(K['pct-wide'], fmtPct(c.oneContract.pct));
      setText(K['loss-tight'], '–'); setText(K['pct-tight'], '–');
    } else {
      setText(K['loss-wide'], fmtNum(c.widest.loss)); setText(K['pct-wide'], fmtPct(c.widest.pct));
      setText(K['loss-tight'], c.tightest ? fmtNum(c.tightest.loss) : '–'); setText(K['pct-tight'], c.tightest ? fmtPct(c.tightest.pct) : '–');
    }
    setBar(K['bar-wide'], m.widest); setBar(K['bar-tight'], m.tightest);
    if (K.limit) K.limit.style.setProperty('--l', String(m.limit));
    setText(K['limit-lab'], 'risk ' + fmtPct(c.riskPct));
    var parts = [];
    if (c.tooSmall) parts.push('ที่ ' + fmtPct(c.riskPct) + ' ของบัญชี ยังซื้อได้ไม่ถึง 1 contract เมื่อ stop กว้าง ' + c.widest.ticks + ' tick: 1 contract ขาดทุน ' + fmtNum(c.oneContract.loss) + ' (' + fmtPct(c.oneContract.pct) + ') ซึ่งเกินที่ตั้งไว้ ลด stop ที่ใช้ หรือเพิ่ม risk % ด้วยตัวเอง หรือใช้สัญญาที่ tick value ต่ำกว่า');
    else parts.push('ที่ stop กว้างสุด ' + c.widest.ticks + ' tick ขาดทุน ' + fmtNum(c.widest.loss) + ' (' + fmtPct(c.widest.pct) + ') ไม่เกิน ' + fmtPct(c.riskPct) + ' ที่ตั้งไว้');
    if (!c.order) parts.push('stop แคบสุดที่กรอกกว้างกว่า stop กว้างสุด ตรวจสองช่องนี้อีกครั้ง');
    if (!c.sweet) parts.push('risk ' + fmtPct(c.riskPct) + ' อยู่นอกช่วง 1–3% ที่เขาเรียกว่ามักจะพอดี (เขาบอกว่าไม่ใช่ 5%, 10% หรือ 20%)');
    setText(K.msg, parts.join(' · '));
  }

  function paintStats() {
    var e = expectancy({ winPct: state.wr, rr: state.rr });
    if (!e) {
      setText(K.exp, '–'); setText(K.be, '–');
      setText(K['exp-msg'], 'กรอก win rate (0–100) และ R:R จากสมุดบันทึกของคุณ');
      return;
    }
    setText(K.exp, fmtR(e.expR));
    setText(K.be, fmtPct(e.breakEven));
    setText(K['exp-msg'], e.positive ? 'ตามตัวเลขที่กรอก ผลเฉลี่ยต่อเทรดเป็นบวก' : 'ตามตัวเลขที่กรอก ผลเฉลี่ยต่อเทรดไม่เป็นบวก');
  }

  function paintHalve() {
    if (K.halve) K.halve.setAttribute('aria-pressed', String(!!state.halve));
  }

  function paintAll(skip) { paintFields(skip); paintHalve(); paintCalc(); paintStats(); }

  function persist(now) {
    if (timer != null) { clearTimeout(timer); timer = null; }
    if (now) saveInputs(state); else timer = setTimeout(function () { timer = null; saveInputs(state); }, 300);
  }

  // a typed field is read as a number; an empty or damaged one is blank (risk % falls back to its default)
  Object.keys(F).forEach(function (k) {
    var el = F[k];
    if (!el) return;
    el.addEventListener('input', function () {
      var n = parseNumber(el.value);
      state[k] = k === 'riskPct' ? (n == null ? DEFAULTS.riskPct : n) : n;
      paintCalc(); paintStats(); persist(false);
    });
    el.addEventListener('blur', function () {
      var clean = parseInputs(state);
      state[k] = clean[k];
      persist(true); paintAll(null);
    });
  });
  global.addEventListener('pagehide', function () { persist(true); });

  box.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!b) return;
    var act = b.getAttribute('data-act');
    if (b.hasAttribute('data-risk')) { state.riskPct = Number(b.getAttribute('data-risk')); paintAll(null); persist(true); }
    else if (act === 'halve') { state.halve = !state.halve; paintAll(null); persist(true); }
    else if (act === 'sample') { state = parseInputs({ account: 50000, riskPct: 1, tightest: 16, widest: 35, tickValue: 5, halve: false, wr: state.wr, rr: state.rr }); paintAll(null); persist(true); }
    else if (act === 'reset') { state = parseInputs(null); paintAll(null); persist(true); }
  });
  var statBox = $('#rk-stats');
  if (statBox) statBox.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('button[data-act="clear-stats"]') : null;
    if (!b) return;
    state.wr = null; state.rr = null; paintAll(null); persist(true);
  });

  paintAll(null);

  // ---------------------------------------------------------------- motion: section heads settle in once
  // only heads below the first screen are hidden, and only when GSAP and motion are both there; under reduced motion
  // everything is already in its final place
  function settle() {
    var g = M.gsap, ST = M.ScrollTrigger;
    if (!M.enabled || !g || !ST) return;
    var vh = global.innerHeight || 800, heads = $$('.rk-sec__head').filter(function (h) { return h.getBoundingClientRect().top > vh * 0.92; });
    heads.forEach(function (h) {
      g.set(h, { opacity: 0, y: 18 });
      ST.create({
        trigger: h, start: 'top 90%', once: true,
        onEnter: function () { g.to(h, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', clearProps: 'opacity,transform' }); }
      });
    });
    // failsafe: a head that is on screen but never entered (restored scroll, hidden tab) is shown
    setTimeout(function () {
      heads.forEach(function (h) {
        if (h.getBoundingClientRect().top < (global.innerHeight || 800) && (h.style.opacity === '0' || Number(h.style.opacity) < 1)) g.set(h, { clearProps: 'opacity,transform' });
      });
    }, 2500);
  }
  settle();
  TJR.motion.onChange(function (reduced) { if (reduced) $$('.rk-sec__head').forEach(function (h) { h.style.opacity = ''; h.style.transform = ''; }); });
})(typeof window !== 'undefined' ? window : globalThis);
