/* TJR Liquidity: the playbook page controller (Task 12). Classic script, after the engine, layout and motion.

   1. pure helpers on TJR.playbook (no DOM, tested in Node by tests/playbook.test.js):
      checklist   CHECK_IDS, emptyState, parseState, setCheck, resetChecks, setRule, clearRules, cleanRule,
                  progress, serialize, asText, loadState / saveChecks / saveRules (TJR.store, keys playbook.*)
      clock       clockParts, fmtCountdown, hms, dayShift, sessionDay, boundaries, zoneNote, makeTicker
      chart       stepFrames, overlaysFor, nowText (which bar, which overlays, which words, per procedure step)
   2. page: the live clock (one interval, paused while the tab is hidden), the session table, the checklist
      (ticks, progress ring, the user's own rules, copy as text) and ONE engine chart (TJR.scenarios.safeBuild +
      TJR.annotate with upTo) that steps through a worked trade.
   Every time comes from TJR.sessions (ET with US daylight saving, Thailand UTC+7); no Intl, so a browser
   without it behaves the same. The procedure and the checklist are static HTML (clip chips included): this
   file never writes the user's own text as HTML, only as .value / textContent. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var doc = global.document;
  var P = TJR.playbook = TJR.playbook || {};

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // ================================================================ 1a · checklist state

  var CHECK_IDS = ['c-asia-london', 'c-htf', 'c-stack', 'c-ny', 'c-sweep', 'c-structure', 'c-entry', 'c-target', 'c-sl', 'c-size', 'c-risk'];
  var RULE_OF = { 'c-sl': 'sl', 'c-size': 'size', 'c-risk': 'risk' };         // the rows that carry an own-rule field
  var RULE_KEYS = ['sl', 'size', 'risk'];
  var RULE_NAME = { sl: 'stop-loss', size: 'ขนาดสถานะ', risk: 'ความเสี่ยงต่อเทรด' };
  var MAX_RULE = 160;
  // control, zero-width and bidi characters (written as escapes in a string, so no raw line separator sits in the source)
  var CTRL = new RegExp('[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]+', 'g');
  var KEY_CHECKS = 'playbook.checks', KEY_RULES = 'playbook.rules';

  function emptyState() { return { checks: {}, rules: { sl: '', size: '', risk: '' } }; }

  // one line of plain text, at most MAX_RULE characters: control and bidi characters become spaces, runs of
  // white space collapse; anything that is not a string is ''. Output is always shown as text, never as HTML.
  function cleanRule(v) {
    if (typeof v !== 'string') return '';
    var s = v.replace(CTRL, ' ').replace(/\s+/g, ' ').replace(/^ | $/g, '');
    var a = Array.from ? Array.from(s) : s.split('');
    if (a.length > MAX_RULE) s = a.slice(0, MAX_RULE).join('').replace(/ $/, '');
    return s;
  }

  function copyState(s) {
    var c = emptyState();
    CHECK_IDS.forEach(function (id) { if (s.checks[id]) c.checks[id] = true; });
    RULE_KEYS.forEach(function (k) { c.rules[k] = s.rules[k]; });
    return c;
  }
  // stored values may be missing, from an older page or damaged: unknown ids are dropped, rules are cleaned
  function parseState(rawChecks, rawRules) {
    var s = emptyState();
    if (Array.isArray(rawChecks)) rawChecks.forEach(function (id) { if (typeof id === 'string' && CHECK_IDS.indexOf(id) >= 0) s.checks[id] = true; });
    if (rawRules && typeof rawRules === 'object' && !Array.isArray(rawRules)) RULE_KEYS.forEach(function (k) { s.rules[k] = cleanRule(rawRules[k]); });
    return s;
  }
  function setCheck(s, id, on) {
    var c = copyState(s);
    if (CHECK_IDS.indexOf(id) < 0) return c;
    if (on) c.checks[id] = true; else delete c.checks[id];
    return c;
  }
  function resetChecks(s) { var c = copyState(s); c.checks = {}; return c; }          // a new trade: ticks go, rules stay
  function setRule(s, key, value) {
    var c = copyState(s);
    if (RULE_KEYS.indexOf(key) >= 0) c.rules[key] = cleanRule(value);
    return c;
  }
  function clearRules(s) { var c = copyState(s); c.rules = emptyState().rules; return c; }
  function progress(s) {
    var done = CHECK_IDS.filter(function (id) { return s.checks[id]; }).length, total = CHECK_IDS.length;
    return { done: done, total: total, pct: Math.round(done / total * 100) };
  }
  // what is saved: the ticked ids in list order and the three rules
  function serialize(s) {
    return { checks: CHECK_IDS.filter(function (id) { return s.checks[id]; }), rules: { sl: s.rules.sl, size: s.rules.size, risk: s.rules.risk } };
  }
  // the checklist as plain text for the clipboard; labels maps id -> the row's own words
  function asText(s, labels) {
    labels = labels || {};
    var p = progress(s), out = ['เช็คลิสต์ก่อนเข้าเทรด · Liquidity (คลิป TJR)', 'ติ๊กแล้ว ' + p.done + ' / ' + p.total];
    CHECK_IDS.forEach(function (id) {
      out.push((s.checks[id] ? '[x] ' : '[ ] ') + (labels[id] || id));
      var k = RULE_OF[id];
      if (k) out.push('    กฎของฉัน (' + RULE_NAME[k] + '): ' + (s.rules[k] || '(ยังไม่ได้เขียน)'));
    });
    out.push('ที่มา: https://youtu.be/Vulini8xbB0');
    return out.join('\n');
  }
  function loadState(store) {
    store = store || TJR.store;
    return parseState(store.get(KEY_CHECKS, []), store.get(KEY_RULES, {}));
  }
  function saveChecks(s, store) { (store || TJR.store).set(KEY_CHECKS, serialize(s).checks); }
  function saveRules(s, store) { (store || TJR.store).set(KEY_RULES, serialize(s).rules); }

  // ================================================================ 1b · the clock (all times from TJR.sessions)

  var TH_DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  var TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var SESS_LABEL = { asia: 'Asia session', london: 'London session', 'ny-pre': 'NY pre-market', ny: 'New York session', spread: 'Spread hour · เทรดไม่ได้', weekend: 'ตลาดปิดสุดสัปดาห์' };
  var ORDER = ['asia', 'london', 'ny-pre', 'ny', 'spread'];
  var HOUR = 3600, DAY_MS = 86400000;

  function S() { return TJR.sessions; }
  // HH:MM:SS of a unix second at a whole-hour offset from UTC (ET and Thailand both are)
  function hms(utc, offH) {
    var d = new Date((Math.floor(utc) + offH * HOUR) * 1000);
    return pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':' + pad2(d.getUTCSeconds());
  }
  function thaiDateObj(utc) {
    var d = new Date((Math.floor(utc) + 7 * HOUR) * 1000);
    return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), dow: d.getUTCDay() };
  }
  function etDateObj(utc) { var e = S().toET(Math.floor(utc)); return { y: e.y, mo: e.mo, d: e.d, dow: e.dow }; }
  function dateLabel(o) { return TH_DOW[o.dow] + ' ' + o.d + ' ' + TH_MON[o.mo - 1]; }
  // Thailand's calendar day minus the ET calendar day of the same instant (0 or 1 in practice)
  function dayShift(utc) {
    var a = etDateObj(utc), b = thaiDateObj(utc);
    return Math.round((Date.UTC(b.y, b.mo - 1, b.d) - Date.UTC(a.y, a.mo - 1, a.d)) / DAY_MS);
  }
  function fmtCountdown(sec) {
    sec = Math.max(0, Math.floor(+sec || 0));
    var d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    var t = pad2(h) + ':' + pad2(m) + ':' + pad2(s);
    return d > 0 ? d + ' วัน ' + t : t;
  }
  function zoneName(utc) { return S().etOffsetHours(Math.floor(utc)) === -4 ? 'EDT' : 'EST'; }

  // everything the clock panel shows for one instant
  function clockParts(utc) {
    utc = Math.floor(utc);
    var off = S().etOffsetHours(utc), next = S().nextNyOpen(utc), sess = S().which(utc), nt = thaiDateObj(next), sh = dayShift(next);
    return {
      utc: utc, zone: zoneName(utc), offset: off,
      et: hms(utc, off), th: hms(utc, 7), etDate: dateLabel(etDateObj(utc)), thDate: dateLabel(thaiDateObj(utc)),
      session: sess, sessionLabel: SESS_LABEL[sess], nextOpen: next, toOpen: next - utc, countdown: fmtCountdown(next - utc),
      openAt: dateLabel(etDateObj(next)) + ' 09:30 ET · ' + S().fmtThai(next) + ' น. เวลาไทย' + (sh ? ' (' + dateLabel(nt) + ')' : '')
    };
  }
  // the session day the table shows: the one whose NY open is next to come or under way (a weekend shows Monday)
  function sessionDay(utc) {
    var e = S().toET(Math.floor(utc)), day;
    if (S().which(utc) === 'weekend') { var n = S().toET(S().nextNyOpen(utc)); return { y: n.y, mo: n.mo, d: n.d }; }
    day = Date.UTC(e.y, e.mo - 1, e.d);
    if (e.h * 60 + e.mi >= S().WINDOWS.asia.from) day += DAY_MS;                 // from 18:00 ET the next day's Asia has begun
    var c = new Date(day);
    return { y: c.getUTCFullYear(), mo: c.getUTCMonth() + 1, d: c.getUTCDate() };
  }
  function hm(min) { return pad2(Math.floor(min / 60)) + ':' + pad2(min % 60); }
  // the five windows of that session day, ET and Thailand; "+1" = Thailand's date is one after the ET date of that instant
  function boundaries(utc) {
    var A = sessionDay(utc), prev = new Date(Date.UTC(A.y, A.mo - 1, A.d - 1));
    function at(day, min) { return S().etToUtc(day.y, day.mo, day.d, Math.floor(min / 60), min % 60); }
    function thai(u) { return S().fmtThai(u) + (dayShift(u) ? ' (+1)' : ''); }
    return ORDER.map(function (id) {
      var w = S().WINDOWS[id];
      var fromDay = id === 'asia' ? { y: prev.getUTCFullYear(), mo: prev.getUTCMonth() + 1, d: prev.getUTCDate() } : A;
      var from = at(fromDay, w.from), to = at(A, w.to);
      return { id: id, from: from, to: to, et: hm(w.from) + '–' + hm(w.to), th: thai(from) + '–' + thai(to) };
    });
  }
  function zoneNote(utc) {
    var off = S().etOffsetHours(Math.floor(utc)), gap = 7 - off;
    return 'ตอนนี้ ET เป็น ' + zoneName(utc) + ' (UTC' + (off < 0 ? '−' : '+') + Math.abs(off) + ') เวลาไทยจึงเร็วกว่า ' + gap + ' ชั่วโมง เวลาไทยของแต่ละ session ขยับตามเวลาออมแสงของสหรัฐ และนาฬิกาคำนวณให้เองทุกวัน';
  }

  // One interval at most, whatever order start / stop / setHidden come in. While hidden nothing runs; showing
  // the tab again draws at once and re-arms. fn never throws out of the timer.
  function makeTicker(fn, o) {
    o = o || {};
    var setI = o.setInterval || function (f, m) { return global.setInterval(f, m); };
    var clearI = o.clearInterval || function (h) { return global.clearInterval(h); };
    var ms = o.ms || 1000, id = null, wanted = false, hidden = false;
    function run() { try { fn(); } catch (e) { /* a failing draw must not kill the clock */ } }
    function arm() { if (id == null && wanted && !hidden) { run(); id = setI(run, ms); } }
    function disarm() { if (id != null) { clearI(id); id = null; } }
    return {
      start: function () { wanted = true; arm(); },
      stop: function () { wanted = false; disarm(); },
      setHidden: function (h) { hidden = !!h; if (hidden) disarm(); else arm(); },
      running: function () { return id != null; }
    };
  }

  // ================================================================ 1c · the worked chart

  var STEPS = 7;
  var STEP_GAP = { 5: true, 7: true };                    // steps whose chart note carries the gap badge

  // For each procedure step the last bar that may be on screen, the overlay ids to keep back until a later step
  // (only where one bar knows two things at once), and the ids to flash. Bars are base indices.
  function stepFrames(built) {
    var T = built.truth, last = built.candles.length - 1, lv = T.levels || [], st = T.structure || [];
    var sw = T.sweep ? T.sweep.bar : null;
    var before = lv.filter(function (l) { return sw == null || l.known < sw; });
    var b1 = Math.min(last, before.reduce(function (m, l) { return Math.max(m, l.known); }, 0));
    var conf = st.filter(function (p) { return p.bar === T.confirmBar; })[0];
    var w = T.entryWindow;
    var b3 = sw == null ? b1 : sw;
    var b4 = conf ? conf.known : (T.confirmBar != null ? T.confirmBar + 2 : b3);
    var b5 = w ? w.to : b4;
    var tl = T.target ? lv.filter(function (l) { return l.id === T.target.levelId; })[0] : null;
    var b6 = tl && tl.sweptAt != null ? tl.sweptAt : last;
    var bars = [b1, b1, b3, b4, b5, b6, b6], prev = 0;
    bars = bars.map(function (b) { b = clamp(b, prev, last); prev = b; return b; });
    var structIds = st.filter(function (p) { return sw != null && p.bar >= sw && p.known <= bars[3]; }).map(function (p) { return 'lbl:' + p.bar; });
    var hide = [[], [], [], ['entry', 'target'], ['target'], [], []];
    var focus = [
      before.map(function (l) { return l.id; }), [],
      T.sweep ? ['sweep', T.sweep.levelId] : [],
      structIds, w ? ['entry'] : [], T.target ? ['target', T.target.levelId] : [], []
    ];
    return bars.map(function (b, i) { return { step: i + 1, bar: b, hide: hide[i], focus: focus[i] }; });
  }
  // the chart's overlays for one step: only what is knowable at the frame's bar, minus what a later step introduces
  function overlaysFor(built, frame) {
    return TJR.annotate(built, { upTo: frame.bar }).filter(function (o) { return frame.hide.indexOf(o.id) < 0; });
  }
  // the words under the chart for a step; ctx = { side: 'long'|'short', stacks: n }
  function nowText(step, ctx) {
    var long = !ctx || ctx.side !== 'short', n = ctx && ctx.stacks ? ctx.stacks : 0;
    var stack = (long ? 'stacked lows' : 'stacked highs') + (n ? ' ' + n + ' จุด' : '');
    return [
      'เส้นคือ level ที่รู้แล้วก่อน sweep: ' + stack + ' (low-resistance) กับ liquidity ' + (long ? 'ด้านบน' : 'ด้านล่าง') + ' ที่จะเป็นเป้า',
      'ขั้นนี้เป็นเรื่องเวลา ไม่มีบนกราฟจำลอง ดูนาฬิกาด้านบน',
      'ลูกศรคือแท่งที่ sweep level ยังไม่ใช่จุดเข้า ต้องรอ confirmation',
      'label โครงสร้างขึ้นทีละจุด จนถึง ' + (long ? 'HH' : 'LL') + ' ซึ่งเป็นตัวที่ยืนยันเทรนด์ใหม่',
      'กรอบสีฟ้าคือช่วง pullback ที่เว็บนี้อ่านว่าเป็นช่วงเข้า ไม่ใช่กฎของ TJR',
      'เส้น target คือ liquidity ' + (long ? 'ด้านบน' : 'ด้านล่าง') + ' ที่ราคาวิ่งไปหา เมื่อถึง level จะถูกเก็บ',
      'ไม่มีบนกราฟ: stop-loss ขนาดสถานะ และความเสี่ยงเป็นกฎของคุณเอง'
    ][clamp(step, 1, STEPS) - 1];
  }

  P.CHECK_IDS = CHECK_IDS; P.RULE_KEYS = RULE_KEYS; P.RULE_OF = RULE_OF; P.MAX_RULE = MAX_RULE; P.STEPS = STEPS; P.STEP_GAP = STEP_GAP;
  P.KEY_CHECKS = KEY_CHECKS; P.KEY_RULES = KEY_RULES; P.ORDER = ORDER; P.SESS_LABEL = SESS_LABEL;
  P.emptyState = emptyState; P.cleanRule = cleanRule; P.parseState = parseState; P.setCheck = setCheck; P.resetChecks = resetChecks;
  P.setRule = setRule; P.clearRules = clearRules; P.progress = progress; P.serialize = serialize; P.asText = asText;
  P.loadState = loadState; P.saveChecks = saveChecks; P.saveRules = saveRules;
  P.hms = hms; P.dayShift = dayShift; P.fmtCountdown = fmtCountdown; P.clockParts = clockParts; P.sessionDay = sessionDay;
  P.boundaries = boundaries; P.zoneNote = zoneNote; P.makeTicker = makeTicker; P.dateLabel = dateLabel;
  P.stepFrames = stepFrames; P.overlaysFor = overlaysFor; P.nowText = nowText;

  if (!doc || !TJR.layout || !TJR.chart || !TJR.chart.create) return;   // Node (tests): helpers only

  // ================================================================ 2 · page
  var M = TJR.motion.init();
  TJR.layout.mount({
    page: 'playbook',
    close: { title: 'ซ้อมขั้นตอนบนกราฟสุ่ม', line: 'ตัดสินใจทีละแท่ง แล้วตรวจคำตอบตามคลิป', label: 'เปิดแบบฝึก', href: 'lab.html' }
  });

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function setText(el, t) { if (el && el.textContent !== t) el.textContent = t; }
  function setPressed(btn, on) { btn.setAttribute('aria-pressed', String(!!on)); }
  function nowSec() { return Math.floor(Date.now() / 1000); }

  // ---------------------------------------------------------------- the clock
  var clockEl = $('#clock'), K = {};
  ['sess', 'zone', 'etdate', 'thdate', 'et', 'th', 'count', 'openat'].forEach(function (k) { K[k] = $('[data-k="' + k + '"]', clockEl); });
  var liveEl = $('.clock__live', clockEl), sesNote = $('[data-k="ses-note"]'), tableDay = '', tableLive = '';

  function paintTable(u) {
    var day = (function (a) { return a.y + '-' + a.mo + '-' + a.d + (S().etOffsetHours(u)); })(sessionDay(u));
    if (day !== tableDay) {
      tableDay = day;
      boundaries(u).forEach(function (b) {
        setText($('[data-k="et-' + b.id + '"]'), b.et);
        setText($('[data-k="th-' + b.id + '"]'), b.th);
      });
      setText(sesNote, zoneNote(u));
    }
    var live = S().which(u);
    if (live !== tableLive) {
      tableLive = live;
      $$('.ses__tbl tbody tr').forEach(function (tr) {
        var on = tr.getAttribute('data-row') === live;
        tr.classList.toggle('is-live', on);
        if (on) tr.setAttribute('aria-current', 'true'); else tr.removeAttribute('aria-current');
      });
    }
  }
  function renderClock() {
    var u = nowSec(), c = clockParts(u);
    setText(K.sess, c.sessionLabel);
    if (liveEl) liveEl.setAttribute('data-s', c.session);
    setText(K.zone, c.zone); setText(K.etdate, c.etDate); setText(K.thdate, c.thDate);
    setText(K.et, c.et); setText(K.th, c.th);
    setText(K.count, c.countdown); setText(K.openat, c.openAt);
    paintTable(u);
  }
  var ticker = makeTicker(renderClock);
  ticker.start();
  doc.addEventListener('visibilitychange', function () { ticker.setHidden(doc.hidden); if (doc.hidden && W) stopAuto(); });
  ticker.setHidden(!!doc.hidden);

  // ---------------------------------------------------------------- the checklist
  var state = loadState(), list = $('[data-k="list"]'), ring = $('[data-k="ring"]');
  var elDone = $('[data-k="done"]'), elTotal = $('[data-k="total"]'), elState = $('[data-k="state"]'), elCopy = $('[data-k="copy-state"]'), txt = $('[data-k="txt"]');
  var ruleTimer = null;
  if (elTotal) elTotal.textContent = String(CHECK_IDS.length);

  function labelOf(id) {
    var input = $('input[data-id="' + id + '"]', list), row = input && input.closest('.check-row'), t = row && $('.check-row__text', row);
    return t ? t.textContent.replace(/\s+/g, ' ').trim() : id;
  }
  function paintProgress() {
    var p = progress(state);
    setText(elDone, String(p.done));
    if (ring) ring.style.setProperty('--p', String(p.pct));
    setText(elState, p.done === 0 ? 'ยังไม่ได้ติ๊กข้อไหน' : p.done === p.total ? 'ติ๊กครบทุกข้อแล้ว' : 'เหลืออีก ' + (p.total - p.done) + ' ข้อ');
    if (ring) ring.setAttribute('data-full', p.done === p.total ? '1' : '0');
  }
  function paintChecks() {
    $$('input[data-id]', list).forEach(function (cb) {
      var on = !!state.checks[cb.getAttribute('data-id')];
      cb.checked = on;
      var li = cb.closest('.ck__item');
      if (li) li.classList.toggle('is-done', on);
    });
    paintProgress();
  }
  function paintRules() {
    $$('[data-rule]', list).forEach(function (inp) {
      var v = state.rules[inp.getAttribute('data-rule')] || '';
      if (doc.activeElement !== inp && inp.value !== v) inp.value = v;
    });
  }
  function flushRules() { if (ruleTimer != null) { clearTimeout(ruleTimer); ruleTimer = null; saveRules(state); } }

  function initChecklist() {
    paintChecks(); paintRules();
    list.addEventListener('change', function (e) {
      var cb = e.target;
      if (!cb || !cb.getAttribute || !cb.hasAttribute('data-id')) return;
      state = setCheck(state, cb.getAttribute('data-id'), cb.checked);
      saveChecks(state);
      paintChecks();
    });
    list.addEventListener('input', function (e) {
      var inp = e.target;
      if (!inp || !inp.getAttribute || !inp.hasAttribute('data-rule')) return;
      state = setRule(state, inp.getAttribute('data-rule'), inp.value);
      if (ruleTimer != null) clearTimeout(ruleTimer);
      ruleTimer = setTimeout(function () { ruleTimer = null; saveRules(state); }, 300);
    });
    list.addEventListener('focusout', function (e) {
      var inp = e.target;
      if (inp && inp.hasAttribute && inp.hasAttribute('data-rule')) { flushRules(); var v = state.rules[inp.getAttribute('data-rule')]; if (inp.value !== v) inp.value = v; }
    });
    global.addEventListener('pagehide', flushRules);
    var sec = $('#checklist');
    sec.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-act]') : null;
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'reset') {
        state = resetChecks(state); saveChecks(state); paintChecks();
        setText(elCopy, 'เริ่มเทรดใหม่แล้ว ติ๊กทุกข้อถูกล้าง กฎของคุณยังอยู่');
        if (txt) txt.hidden = true;
      } else if (act === 'clear-rules') {
        state = clearRules(state); saveRules(state); paintRules();
        $$('[data-rule]', list).forEach(function (i) { i.value = ''; });
        setText(elCopy, 'ล้างกฎของคุณแล้ว');
      } else if (act === 'copy') {
        flushRules();
        var labels = {};
        CHECK_IDS.forEach(function (id) { labels[id] = labelOf(id); });
        copyText(asText(state, labels));
      }
    });
  }

  function copyText(text) {
    function fail() {
      if (txt) { txt.value = text; txt.hidden = false; try { txt.focus(); txt.select(); } catch (e) { /* no selection */ } }
      setText(elCopy, 'คัดลอกอัตโนมัติไม่ได้ ข้อความถูกเลือกไว้ให้แล้ว กดคัดลอกเอง');
    }
    function done() { if (txt) txt.hidden = true; setText(elCopy, 'คัดลอกเช็คลิสต์แล้ว'); }
    try {
      if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
        global.navigator.clipboard.writeText(text).then(done, function () { legacy(); });
        return;
      }
    } catch (e) { /* fall through */ }
    legacy();
    function legacy() {
      try {
        var ta = doc.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        doc.body.appendChild(ta); ta.select();
        var ok = doc.execCommand && doc.execCommand('copy');
        doc.body.removeChild(ta);
        if (ok) done(); else fail();
      } catch (e) { fail(); }
    }
  }

  // ---------------------------------------------------------------- the worked chart
  var SEED = { S01: 1, S03: 4 };
  var steps = $$('.step', $('[data-k="steps"]'));
  var host = $('.pf .chart-frame__canvas'), nowN = $('[data-k="now-n"]'), nowT = $('[data-k="now-t"]'), nowGap = $('[data-k="now-gap"]');
  var metaEl = $('.pf [data-k="meta"]'), symEl = $('.pf [data-k="sym"]'), tfEl = $('.pf [data-k="tf"]'), seedEl = $('.pf [data-k="seed"]');
  var btnPrev = $('.pf [data-act="prev"]'), btnNext = $('.pf [data-act="next"]'), btnAuto = $('.pf [data-act="auto"]'), autoLab = $('.pf [data-k="auto-lab"]');
  var W = null;                                                // the one chart's state

  function buildFor(id, seed) { return TJR.scenarios.safeBuild(TJR.scenarios.get(id), seed, {}); }
  function rate(span) { return clamp(span / 1.6, 8, 60); }
  // the engine pauses an off-screen chart, so a play started out of sight would hang: reveal at once instead
  function chartInView() {
    var r = host.getBoundingClientRect(), vh = global.innerHeight || (doc.documentElement && doc.documentElement.clientHeight) || 0;
    return r.bottom > 0 && r.top < vh;
  }

  function paintStep() {
    var k = W.step, ctx = { side: W.built.truth.side, stacks: W.built.truth.levels.filter(function (l) { return l.kind === 'stack'; }).length };
    steps.forEach(function (li) {
      var on = Number(li.getAttribute('data-step')) === k;
      li.classList.toggle('is-active', on);
      if (on) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    setText(metaEl, 'ขั้นที่ ' + k + ' จาก ' + STEPS);
    setText(nowN, 'ขั้นที่ ' + k);
    setText(nowT, nowText(k, ctx));
    if (nowGap) nowGap.hidden = !STEP_GAP[k];
    btnPrev.disabled = k <= 1; btnNext.disabled = k >= STEPS;
    $$('[data-act="view"]').forEach(function (b) { setPressed(b, Number(b.getAttribute('data-step')) === k); });
  }
  function flashAll(fr) { fr.focus.forEach(function (id) { W.ch.flash(id); }); }

  // Jump to a procedure step. Forward moves play the bars between (one loop: every call bumps W.run and the
  // engine stops the previous play), backward moves and reduced motion reveal the frame at once.
  function goStep(k, o) {
    o = o || {};
    k = clamp(Math.round(k), 1, STEPS);
    if (!o.auto) stopAuto();
    var my = ++W.run, fr = W.frames[k - 1], ch = W.ch, cur = ch.info().revealed;
    W.step = k;
    paintStep();
    ch.setOverlays(overlaysFor(W.built, fr));
    if (M.reduced || o.animate === false || fr.bar <= cur || !chartInView()) { ch.reveal(fr.bar); flashAll(fr); return Promise.resolve(false); }
    return ch.play({ from: cur, to: fr.bar, barsPerSec: rate(fr.bar - cur) }).then(function (done) {
      if (!W || my !== W.run) return false;
      if (done) flashAll(fr);
      return done;
    });
  }

  function setAutoLabel(on) {
    if (autoLab) autoLab.textContent = on ? 'หยุด' : 'เล่นต่อเนื่อง';
    btnAuto.setAttribute('data-state', on ? 'on' : 'off');
  }
  function stopAuto() {
    if (!W) return;
    W.auto = false; W.autoRun++;
    if (W.autoTimer != null) { clearTimeout(W.autoTimer); W.autoTimer = null; }
    setAutoLabel(false);
  }
  function autoNext(my) {
    if (!W || !W.auto || my !== W.autoRun) return;
    if (W.step >= STEPS) { stopAuto(); return; }
    goStep(W.step + 1, { auto: true }).then(function () {
      if (!W || !W.auto || my !== W.autoRun) return;
      W.autoTimer = setTimeout(function () { W.autoTimer = null; autoNext(my); }, 1500);
    });
  }
  function startAuto() {
    stopAuto();
    W.auto = true; var my = ++W.autoRun;
    setAutoLabel(true);
    if (W.step >= STEPS) goStep(1, { auto: true, animate: false });
    W.autoTimer = setTimeout(function () { W.autoTimer = null; autoNext(my); }, 900);
  }

  function loadChart(id, seed) {
    var b = buildFor(id, seed);
    stopAuto();
    W.run++;
    W.id = id; W.seeds[id] = b.meta.seed; W.built = b; W.frames = stepFrames(b);
    W.ch.setData(b);
    setText(symEl, b.meta.instrument); setText(tfEl, b.meta.tf === 5 ? '5m' : b.meta.tf + 'm'); setText(seedEl, 'seed ' + b.meta.seed);
    $$('[data-side]').forEach(function (btn) { setPressed(btn, btn.getAttribute('data-side') === id); });
    goStep(W.step, { animate: false });
  }

  function initChart() {
    W = { ch: TJR.chart.create(host, { label: 'กราฟจำลองที่เดินตามขั้นตอนเทรดของ playbook', interactive: true }), run: 0, step: 1, auto: false, autoRun: 0, autoTimer: null, seeds: { S01: SEED.S01, S03: SEED.S03 } };
    loadChart('S01', SEED.S01);
    $('.pf').addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('button') : null;
      if (!t) return;
      if (t.hasAttribute('data-side')) { var id = t.getAttribute('data-side'); if (id !== W.id) loadChart(id, W.seeds[id]); return; }
      var act = t.getAttribute('data-act');
      if (act === 'prev') goStep(W.step - 1);
      else if (act === 'next') goStep(W.step + 1);
      else if (act === 'auto') { if (W.auto) stopAuto(); else startAuto(); }
      else if (act === 'reseed') { W.seeds[W.id] = 1 + Math.floor(Math.random() * 999999); loadChart(W.id, W.seeds[W.id]); }
    });
    var rail = $('[data-k="steps"]');
    rail.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-act="view"]') : null;
      var li = e.target.closest ? e.target.closest('.step') : null;
      if (b) {
        goStep(Number(b.getAttribute('data-step')));
        // stacked layout (the chart sits above the steps): bring the chart back into view
        var fig = $('.pf'), r = fig.getBoundingClientRect();
        if (global.innerWidth < 1100 && (r.top < 56 || r.bottom > global.innerHeight)) {
          try { fig.scrollIntoView({ block: 'start', behavior: M.reduced ? 'auto' : 'smooth' }); } catch (e) { /* old browser */ }
        }
        return;
      }
      // a tap on the card itself (not on a link or button) selects it too
      if (li && !(e.target.closest && e.target.closest('a,button'))) goStep(Number(li.getAttribute('data-step')));
    });
    TJR.motion.onChange(function (reduced) { if (reduced && W) { stopAuto(); W.run++; W.ch.reveal(W.frames[W.step - 1].bar); } });
  }

  // read-only handle for the console and the headless checks
  P.view = function () {
    return W && { step: W.step, id: W.id, run: W.run, auto: W.auto, seed: W.built.meta.seed, info: W.ch.info(), ticker: ticker.running(), state: serialize(state) };
  };

  // ---------------------------------------------------------------- entrance (once, GSAP only when it is there)
  function enter() {
    if (!(M.enabled && M.gsap)) return;
    var g = M.gsap;
    g.from('.pb-head__text > *', { opacity: 0, y: 18, duration: 0.6, stagger: 0.08, ease: 'power3.out', clearProps: 'all' });
    g.from('.clock', { opacity: 0, y: 24, duration: 0.7, delay: 0.15, ease: 'power3.out', clearProps: 'all' });
  }

  // ---------------------------------------------------------------- start
  try { renderClock(); } catch (e) { if (global.console) console.error(e); }
  try { initChecklist(); } catch (e) { if (global.console) console.error(e); }
  try { initChart(); } catch (e) { if (global.console) console.error(e); }
  enter();
})(typeof window !== 'undefined' ? window : globalThis);
