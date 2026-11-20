/* TJR Liquidity: the playbook page controller (v2: the full chain). Classic script, after the engine, layout and motion.

   1. pure helpers on TJR.playbook (no DOM, tested in Node by tests/playbook.test.js):
      checklist   CHECK_IDS, emptyState, parseState, setCheck, resetChecks, setRule, clearRules, cleanRule,
                  progress, serialize, asText, loadState (= load) / saveChecks / saveRules (TJR.store, keys
                  playbook.v2.*: the v1 keys playbook.checks / playbook.rules are never read)
      clock       clockParts, fmtCountdown, hms, dayShift, sessionDay, boundaries, zoneNote, makeTicker,
                  currentWindow, windowRows (the New York windows of TJR.sessions.nyWindows, ET and Thailand)
      chart       stepFrames, overlaysFor, nowText (which bar, which overlays, which words, per chain step)
      bias        biasSample, biasOverlays, biasVerdict, biasWords, biasDiff (the four-question worksheet)
   2. page: the live clock (one interval, paused while the tab is hidden), the two session tables, the checklist
      (ticks, progress ring, the user's own rules, copy as text), ONE engine chart (TJR.scenarios.safeBuild +
      TJR.annotate with upTo) that steps through a worked Level 2 trade, and the bias worksheet on a built 60m
      scenario (S19, S18).
   Every time comes from TJR.sessions (ET with US daylight saving, Thailand UTC+7); no Intl, so a browser
   without it behaves the same. The chain and the checklist are static HTML (clip chips included): this
   file never writes the user's own text as HTML, only as .value / textContent.
   Truth is read from built.truth (truth.confluence), never assumed from the script: the entry bar differs by seed. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var doc = global.document;
  var P = TJR.playbook = TJR.playbook || {};

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // ================================================================ 1a · checklist state

  var CHECK_IDS = ['c-trend', 'c-map', 'c-bias', 'c-time', 'c-sweep', 'c-confirm', 'c-cont', 'c-entry', 'c-target', 'c-risk', 'c-sl', 'c-tp', 'c-maxloss'];
  var RULE_OF = { 'c-sl': 'sl', 'c-tp': 'tp', 'c-maxloss': 'maxloss' };       // the rows that carry an own-rule field
  var RULE_KEYS = ['sl', 'tp', 'maxloss'];
  var RULE_NAME = { sl: 'stop-loss', tp: 'สัดส่วนที่ปิดที่แต่ละ TP', maxloss: 'max daily loss' };
  var MAX_RULE = 160;
  // control, zero-width and bidi characters (written as escapes in a string, so no raw line separator sits in the source)
  var CTRL = new RegExp('[\u0000-\u001f\u007f-\u009f​-‏ -‮⁦-⁩﻿]+', 'g');
  // v2 keys: a new shape under a new name; the v1 keys (playbook.checks / playbook.rules) are left alone and never parsed
  var KEY_CHECKS = 'playbook.v2.checks', KEY_RULES = 'playbook.v2.rules';

  function emptyState() { return { checks: {}, rules: { sl: '', tp: '', maxloss: '' } }; }

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
  // what is saved: the ticked ids in list order and the rules
  function serialize(s) {
    var rules = {};
    RULE_KEYS.forEach(function (k) { rules[k] = s.rules[k]; });
    return { checks: CHECK_IDS.filter(function (id) { return s.checks[id]; }), rules: rules };
  }
  var MAIN_URL = 'https://youtu.be/Vulini8xbB0';
  // the checklist as plain text for the clipboard; labels maps id -> the row's own words
  function asText(s, labels) {
    labels = labels || {};
    var p = progress(s), out = ['เช็คลิสต์ก่อนเข้าเทรด · Liquidity (คลิป TJR)', 'ติ๊กแล้ว ' + p.done + ' / ' + p.total];
    CHECK_IDS.forEach(function (id) {
      out.push((s.checks[id] ? '[x] ' : '[ ] ') + (labels[id] || id));
      var k = RULE_OF[id];
      if (k) out.push('    กฎของฉัน (' + RULE_NAME[k] + '): ' + (s.rules[k] || '(ยังไม่ได้เขียน)'));
    });
    out.push('ที่มา: ' + MAIN_URL + ' และเพลย์ลิสต์ Path to Profitability ' + (TJR.sources && TJR.sources.PLAYLIST ? TJR.sources.PLAYLIST : ''));
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
  // the New York day windows (P5.12-P5.19): open 09:30, manipulation 09:30-09:50, entry 09:50-10:10, his cut-off 10:30, PM 13:00
  var WIN_ORDER = ['open', 'manipulation', 'entry', 'cutoff', 'pm'];
  var WIN_LABEL = { manipulation: 'Manipulation window 09:30–09:50 ET', entry: 'Entry window (macro) 09:50–10:10 ET', pm: 'PM session (เริ่มราว 13:00 ET)' };
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

  // which New York window the instant is in: 'manipulation' 09:30-09:50, 'entry' 09:50-10:10, 'pm' from 13:00 to the
  // NY close, else null (10:10-13:00, any other session, the weekend). Windows come from TJR.sessions.nyWindows.
  function currentWindow(utc) {
    utc = Math.floor(utc);
    if (S().which(utc) !== 'ny') return null;
    var w = S().nyWindows(utc);
    if (utc >= w.manipulation.from && utc < w.manipulation.to) return 'manipulation';
    if (utc >= w.entry.from && utc < w.entry.to) return 'entry';
    if (utc >= w.pm) return 'pm';
    return null;
  }

  // everything the clock panel shows for one instant
  function clockParts(utc) {
    utc = Math.floor(utc);
    var off = S().etOffsetHours(utc), next = S().nextNyOpen(utc), sess = S().which(utc), nt = thaiDateObj(next), sh = dayShift(next);
    var win = currentWindow(utc);
    return {
      utc: utc, zone: zoneName(utc), offset: off,
      et: hms(utc, off), th: hms(utc, 7), etDate: dateLabel(etDateObj(utc)), thDate: dateLabel(thaiDateObj(utc)),
      session: sess, sessionLabel: SESS_LABEL[sess], nextOpen: next, toOpen: next - utc, countdown: fmtCountdown(next - utc),
      window: win, windowLabel: win ? WIN_LABEL[win] : null,
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
  function thaiAt(u) { return S().fmtThai(u) + (dayShift(u) ? ' (+1)' : ''); }
  // the five windows of that session day, ET and Thailand; "+1" = Thailand's date is one after the ET date of that instant
  function boundaries(utc) {
    var A = sessionDay(utc), prev = new Date(Date.UTC(A.y, A.mo - 1, A.d - 1));
    function at(day, min) { return S().etToUtc(day.y, day.mo, day.d, Math.floor(min / 60), min % 60); }
    return ORDER.map(function (id) {
      var w = S().WINDOWS[id];
      var fromDay = id === 'asia' ? { y: prev.getUTCFullYear(), mo: prev.getUTCMonth() + 1, d: prev.getUTCDate() } : A;
      var from = at(fromDay, w.from), to = at(A, w.to);
      return { id: id, from: from, to: to, et: hm(w.from) + '–' + hm(w.to), th: thaiAt(from) + '–' + thaiAt(to) };
    });
  }
  // the New York windows of the session day, ET and Thailand: open, manipulation, entry, his cut-off, PM
  function windowRows(utc) {
    var A = sessionDay(utc), w = S().nyWindows(S().etToUtc(A.y, A.mo, A.d, 12, 0));
    var spec = {
      open: [w.open, null], manipulation: [w.manipulation.from, w.manipulation.to], entry: [w.entry.from, w.entry.to],
      cutoff: [w.cutoff, null], pm: [w.pm, null]
    };
    return WIN_ORDER.map(function (id) {
      var a = spec[id][0], b = spec[id][1];
      return { id: id, from: a, to: b, et: S().fmtET(a) + (b ? '–' + S().fmtET(b) : ''), th: thaiAt(a) + (b ? '–' + thaiAt(b) : '') };
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

  // ================================================================ 1c · the worked chart (the chain, step by step)

  // 1 bias + map · 2 timing · 3 sweep (+SMT) · 4 confirmation · 5 continuation · 6 entry · 7 exits · 8 risk
  var STEPS = 8;
  var STEP_GAP = { 7: true, 8: true };                    // steps whose chart note carries the gap badge (SL rule, TP split, daily loss)
  var HIDE_LABELS = ['label'];                            // structure labels (Level 1) come in with the confirmation step

  // For each chain step: the last bar that may be on screen, the overlays kept (conf: which confluence shapes), the
  // ids to hide and the ids to flash. Bars are base indices. Everything is read from built.truth.confluence.
  function stepFrames(built) {
    var T = built.truth, K = T.confluence, cs = built.candles, last = cs.length - 1, lv = T.levels || [];
    var sw = T.sweep ? T.sweep.bar : null, long = T.side === 'long';
    var before = lv.filter(function (l) { return sw == null || l.known < sw; });
    var b1 = Math.min(last, before.reduce(function (m, l) { return Math.max(m, l.known); }, 0));
    var windows = !!T.windows, bt = windows && sw != null ? sw : b1;
    var tl = T.target ? lv.filter(function (l) { return l.id === T.target.levelId; })[0] : null;
    var b7 = tl && tl.sweptAt != null ? tl.sweptAt : last;
    var bEntry = K.entry.at, bCont = Math.max(K.cont.at, bEntry - 1);
    var bars = [b1, bt, sw == null ? b1 : sw, K.confirm.at, bCont, bEntry, b7, b7], prev = 0;
    bars = bars.map(function (b) { b = clamp(b, prev, last); prev = b; return b; });
    var confId = K.confirm.kind === 'bos' ? 'bos:' + K.confirm.at : 'fvg:' + K.confirm.i;
    var contId = K.cont.kind === 'fvg' ? 'fvg:' + K.cont.i : null;
    var mark = { id: 'entry-mk', type: 'label', bar: bEntry, price: long ? cs[bEntry].l : cs[bEntry].h, text: 'entry', pos: long ? 'below' : 'above', appearAt: bEntry };
    var show = function (o) { return { fvg: !!o.fvg, bos: !!o.bos, eq: !!o.eq, windows: !!o.windows }; };
    var lvIds = before.map(function (l) { return l.id; });
    var conf = [
      null,
      windows ? { show: show({ windows: true }), ids: [] } : null,
      null,
      { show: show({ bos: true, fvg: true }), ids: [confId] },
      { show: show({ bos: true, fvg: true, eq: K.cont.kind === 'eq' }), ids: [confId, contId], eq: K.cont.kind === 'eq' },
      { show: show({ bos: true, fvg: true, eq: K.cont.kind === 'eq' }), ids: [confId, contId], eq: K.cont.kind === 'eq' }
    ];
    conf.push(conf[5], conf[5]);
    var hide = ['entry', 'target'];                                           // the gap itself is the entry zone; target waits for step 7
    var focus = [
      lvIds, [], T.sweep ? ['sweep', T.sweep.levelId] : [], [confId], contId ? [contId] : [], contId ? [contId] : [],
      T.target ? ['target', T.target.levelId] : [], []
    ];
    return bars.map(function (b, i) {
      return {
        step: i + 1, bar: b, conf: conf[i] || null, mark: i >= 5 ? mark : null,
        hide: i >= 6 ? ['entry'] : i === 1 && windows ? hide.concat('sweep') : hide,       // the timing step sits on the sweep bar: show the band, not the sweep
        hideTypes: i < 3 ? HIDE_LABELS : [], focus: focus[i]
      };
    });
  }
  // the chart's overlays for one step: only what is knowable at the frame's bar, plus the confluence shapes the step names
  function overlaysFor(built, frame) {
    var T = built.truth, K = T.confluence, out = TJR.annotate(built, { upTo: frame.bar }), c = frame.conf;
    if (c) {
      TJR.annotate.confluence(built, { upTo: frame.bar, show: c.show }).forEach(function (o) {
        if (o.type === 'band' || (o.type === 'eq' && c.eq) || c.ids.indexOf(o.id) >= 0) out.push(o);
      });
      // the confirming BOS is drawn from the truth (the monitored swing and the breaking bar), whatever the full scan reports
      if (K && K.confirm.kind === 'bos' && c.ids.indexOf('bos:' + K.confirm.at) >= 0 && K.confirm.at <= frame.bar &&
          !out.some(function (o) { return o.id === 'bos:' + K.confirm.at; })) {
        out.push({ id: 'bos:' + K.confirm.at, type: 'bos', price: K.confirm.level.price, from: K.confirm.level.i, at: K.confirm.at, dir: K.confirm.dir, appearAt: K.confirm.at });
      }
    }
    if (frame.mark && frame.mark.appearAt <= frame.bar) out.push(frame.mark);
    return out.filter(function (o) { return frame.hide.indexOf(o.id) < 0 && frame.hideTypes.indexOf(o.type) < 0; });
  }
  // the words under the chart for a step; ctx = { side: 'long'|'short', stacks: n, confirm: 'bos'|'ifvg', windows: bool }
  function nowText(step, ctx) {
    ctx = ctx || {};
    var long = ctx.side !== 'short', n = ctx.stacks ? ctx.stacks : 0;
    var stack = (long ? 'stacked lows' : 'stacked highs') + (n ? ' ' + n + ' จุด' : '');
    return [
      'เส้นคือ level ที่รู้แล้วก่อน sweep: ' + stack + ' (low-resistance) กับ liquidity ' + (long ? 'ด้านบน' : 'ด้านล่าง') + ' ที่จะเป็นเป้า bias ตั้งก่อนเทรด ลองทำ worksheet ในข้อนี้',
      ctx.windows
        ? 'แถบสีคือช่วง manipulation 09:30–09:50 ET ราคากวาด liquidity ในช่วงนี้ แล้วช่วงเข้าคือ 09:50–10:10'
        : 'ข้อนี้เป็นเรื่องเวลา กราฟตัวอย่างนี้ไม่ได้ตั้งเวลาไว้ที่ NY open เลือก Long · ตามเวลา NY เพื่อดูแถบช่วงเวลา หรือดูตารางด้านล่าง',
      'ลูกศรคือแท่งที่ sweep level ยังไม่ใช่จุดเข้า ต้องรอ confirmation',
      (ctx.confirm === 'ifvg'
        ? 'gap ที่โดนแท่งปิดทะลุ (IFVG) ทำหน้าที่เป็น BOS'
        : 'เส้นประคือ swing ล่าสุดที่โดนแท่งปิดทะลุ (BOS ไม่ใช่ไส้เทียน)') +
        ' label ' + (long ? 'L, H, HL, HH' : 'H, L, LL, LH') + ' คือ confirmation แบบในคลิปหลักที่ขึ้นตามมา',
      'กรอบคือ FVG ใหม่ในทิศเทรนด์ใหม่ (continuation) ยังไม่เข้า รอให้ราคาเข้า gap แล้วปิดกลับออกมา',
      'ป้าย entry คือแท่งที่ปิดกลับออกจาก gap (แบบรอ 5m close) กรอบเส้นหนาคือ gap ที่ถูก respect ตำแหน่งเข้าบนกราฟเป็นการอ่านของเว็บนี้ ไม่ใช่กฎของ TJR',
      'เส้น target คือ draw ' + (long ? 'ด้านบน' : 'ด้านล่าง') + ' ที่ราคาวิ่งไปหา ตัวอย่างนี้มีเป้าเดียว ส่วน TP1–TP3 ของเขากระจายหลาย draw',
      'ไม่มีบนกราฟ: ขนาดต่อเทรดดูหน้าความเสี่ยง ส่วน stop-loss เป๊ะ ๆ สัดส่วนที่ปิดแต่ละ TP และ max daily loss เป็นกฎของคุณเอง'
    ][clamp(step, 1, STEPS) - 1];
  }

  // ================================================================ 1d · the bias worksheet (four yes/no questions, P3.3-P3.6, P3.41)

  // From a built 60m scenario (S19 stacked gaps hold, S18 a gap closed through): the bar where all four answers are
  // knowable (the respecting close, or the closing-through bar), the answers the site reads off the candles, the bias
  // and the target draw. Nothing here assumes a bar: it is derived from truth.confluence and the candles up to the frame.
  function biasSample(built) {
    var T = built.truth, K = T && T.confluence;
    if (!K || !K.cont || !K.confirm) return null;
    var frame = K.entry ? K.entry.at : K.noTrade ? K.noTrade.at : null;
    if (frame == null) return null;
    var up = K.dir === 'long', seen = built.candles.slice(0, frame + 1), side = up ? 'high' : 'low';
    var gap = TJR.confluence.fvgs(seen).filter(function (g) { return g.i === K.cont.i; })[0];
    var draws = (T.levels || []).filter(function (l) { return l.side === side && l.known <= frame && !(l.sweptAt != null && l.sweptAt <= frame); });
    var expected = [K.confirm.at <= frame, draws.length > 0, K.cont.at <= frame, !!gap && gap.state === 'respected'];
    var tg = K.targets && K.targets[0] ? K.targets[0] : draws[0] ? { price: draws[0].price, levelId: draws[0].id } : null;
    var flipped = !expected[3];
    return {
      trend: up ? 'up' : 'down', frame: frame, expected: expected, flipped: flipped, bias: up !== flipped ? 'up' : 'down',
      draw: flipped || !tg ? null : { id: tg.levelId, price: tg.price },
      gapId: 'fvg:' + K.cont.i, stackId: K.stack ? 'fvg:' + K.stack.top : null,
      gapState: gap ? gap.state : null, instrument: built.meta && built.meta.instrument
    };
  }
  // what the worksheet chart shows at the sample's frame: the levels, the stacks, the continuation gap and the top gap of a stack
  function biasOverlays(built, sample) {
    var out = TJR.annotate(built, { upTo: sample.frame }).filter(function (o) { return o.type === 'level' || o.type === 'trend'; });
    var keep = [sample.gapId, sample.stackId];
    TJR.annotate.confluence(built, { upTo: sample.frame, show: { bos: false, eq: false, windows: false } }).forEach(function (o) {
      if (keep.indexOf(o.id) < 0) return;
      // the top gap of a stack closed under is NOT an inverse (P8.34, P10.29): drawn as a plain gap, never with the IFVG pill
      if (o.id === sample.stackId) { o = Object.assign({}, o, { state: 'open', label: 'gap บน' }); delete o.stateAt; }
      out.push(o);
    });
    return out;
  }
  // ans = [q1, q2, q3, q4] booleans (null = not answered). Q1 a clear HTF trend, Q2 draws in its direction, Q3 a retrace
  // into a FVG or equilibrium, Q4 respected (not closed through). state: incomplete | notrend | nodraw | wait | set | flip.
  function biasVerdict(ans, sample) {
    ans = ans || [];
    for (var i = 0; i < 4; i++) if (typeof ans[i] !== 'boolean') return { state: 'incomplete', bias: null, target: null, gap: false };
    if (!ans[0]) return { state: 'notrend', bias: null, target: null, gap: true };
    if (!ans[1]) return { state: 'nodraw', bias: null, target: null, gap: true };
    if (!ans[2]) return { state: 'wait', bias: null, target: null, gap: false };
    if (ans[3]) return { state: 'set', bias: sample.trend, target: sample.draw, gap: false };
    return { state: 'flip', bias: sample.trend === 'up' ? 'down' : 'up', target: null, gap: false };
  }
  // the two sentences the worksheet shows for a verdict: bias, then the target
  function biasWords(v, sample) {
    var th = { up: 'ขึ้น', down: 'ลง' }, side = { up: 'ด้านบน', down: 'ด้านล่าง' };
    if (v.state === 'incomplete') return { bias: 'ตอบครบ 4 ข้อเพื่อดู bias และเป้า', draw: '' };
    if (v.state === 'notrend') return { bias: 'ยังตั้ง bias ไม่ได้: higher time frame ยังไม่เป็นเทรนด์ชัด', draw: 'ลำดับของเขาเริ่มที่เทรนด์ ถ้าสัญญาณ higher time frame ขัดกันจะเลือกอย่างไร คลิปไม่ได้บอก' };
    if (v.state === 'nodraw') return { bias: 'ยังตั้ง bias ไม่ได้: ไม่มี draw ในทิศเทรนด์', draw: 'ไม่มีเป้าให้ราคาวิ่งไปหา คลิปไม่ได้บอกว่าต้องทำอย่างไรต่อ' };
    if (v.state === 'wait') return { bias: 'รอก่อน: ราคายังไม่ย่อเข้า FVG หรือ equilibrium', draw: 'หลัง swing ล่าสุดราคาต้องย่อ ยังไม่ย่อก็ยังไม่รู้ว่าเทรนด์ถูก respect หรือโดนปิดทะลุ' };
    if (v.state === 'set') {
      return {
        bias: 'bias ' + th[v.bias] + ': gap ถูก respect เทรนด์ยังไปต่อ',
        draw: 'เป้าคือ draw ' + side[v.bias] + (v.target ? ' ที่ราคา ' + TJR.util.fmtPrice(v.target.price) + (sample.instrument ? ' (' + sample.instrument + ')' : '') : '')
      };
    }
    return {
      bias: 'bias เปลี่ยนเป็นขา' + th[v.bias] + ': gap โดนปิดทะลุ',
      draw: 'เทรนด์เดิมไม่ไปต่อ ไม่เทรดตามเทรนด์เดิมจาก gap นี้ เป้าย้ายไปที่ draw ถัดไป ' + side[v.bias]
    };
  }
  // the questions (1-based) where the user's answer differs from the site's reading of the chart
  function biasDiff(ans, sample) {
    var out = [];
    for (var i = 0; i < 4; i++) if (typeof ans[i] === 'boolean' && ans[i] !== sample.expected[i]) out.push(i + 1);
    return out;
  }
  var BIAS_Q1 = { up: 'บน 60m ราคาทำ higher high และ higher low อยู่ (เทรนด์ขึ้นชัด)?', down: 'บน 60m ราคาทำ lower high และ lower low อยู่ (เทรนด์ลงชัด)?' };

  P.CHECK_IDS = CHECK_IDS; P.RULE_KEYS = RULE_KEYS; P.RULE_OF = RULE_OF; P.MAX_RULE = MAX_RULE; P.STEPS = STEPS; P.STEP_GAP = STEP_GAP;
  P.KEY_CHECKS = KEY_CHECKS; P.KEY_RULES = KEY_RULES; P.ORDER = ORDER; P.SESS_LABEL = SESS_LABEL; P.WIN_ORDER = WIN_ORDER; P.WIN_LABEL = WIN_LABEL;
  P.BIAS_Q1 = BIAS_Q1;
  P.emptyState = emptyState; P.cleanRule = cleanRule; P.parseState = parseState; P.setCheck = setCheck; P.resetChecks = resetChecks;
  P.setRule = setRule; P.clearRules = clearRules; P.progress = progress; P.serialize = serialize; P.asText = asText;
  P.loadState = loadState; P.load = loadState; P.saveChecks = saveChecks; P.saveRules = saveRules;
  P.hms = hms; P.dayShift = dayShift; P.fmtCountdown = fmtCountdown; P.clockParts = clockParts; P.sessionDay = sessionDay;
  P.boundaries = boundaries; P.windowRows = windowRows; P.currentWindow = currentWindow; P.zoneNote = zoneNote; P.makeTicker = makeTicker; P.dateLabel = dateLabel;
  P.stepFrames = stepFrames; P.overlaysFor = overlaysFor; P.nowText = nowText;
  P.biasSample = biasSample; P.biasOverlays = biasOverlays; P.biasVerdict = biasVerdict; P.biasWords = biasWords; P.biasDiff = biasDiff;

  if (!doc || !TJR.layout || !TJR.chart || !TJR.chart.create) return;   // Node (tests): helpers only

  // ================================================================ 2 · page
  var M = TJR.motion.init();
  TJR.layout.mount({
    page: 'playbook',
    close: { title: 'ไปขั้น 5: ความเสี่ยง', line: 'ขนาดต่อเทรดและวินัย คือส่วนสุดท้ายของระบบ', label: 'ไปขั้น 5', href: 'risk.html' }
  });

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function setText(el, t) { if (el && el.textContent !== t) el.textContent = t; }
  function setPressed(btn, on) { btn.setAttribute('aria-pressed', String(!!on)); }
  function nowSec() { return Math.floor(Date.now() / 1000); }

  // ---------------------------------------------------------------- the clock
  var clockEl = $('#clock'), K = {};
  ['sess', 'zone', 'etdate', 'thdate', 'et', 'th', 'count', 'openat', 'win'].forEach(function (k) { K[k] = $('[data-k="' + k + '"]', clockEl); });
  var liveEl = $('.clock__live', clockEl), sesNote = $('[data-k="ses-note"]'), tableDay = '', tableLive = '', winDay = '', winLive = '';
  var sesBox = $('[data-k="ses"]'), winBox = $('[data-k="ses-win"]');

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
    if (live !== tableLive && sesBox) {
      tableLive = live;
      $$('.ses__tbl tbody tr', sesBox).forEach(function (tr) {
        var on = tr.getAttribute('data-row') === live;
        tr.classList.toggle('is-live', on);
        if (on) tr.setAttribute('aria-current', 'true'); else tr.removeAttribute('aria-current');
      });
    }
  }
  // the New York windows table: ET and Thailand per window, the current window lit
  function paintWindows(u) {
    var day = (function (a) { return a.y + '-' + a.mo + '-' + a.d + (S().etOffsetHours(u)); })(sessionDay(u));
    if (day !== winDay) {
      winDay = day;
      windowRows(u).forEach(function (r) {
        setText($('[data-k="et-w-' + r.id + '"]'), r.et);
        setText($('[data-k="th-w-' + r.id + '"]'), r.th);
      });
    }
    var live = currentWindow(u) || '';
    if (live !== winLive && winBox) {
      winLive = live;
      $$('.ses__tbl tbody tr', winBox).forEach(function (tr) {
        var on = tr.getAttribute('data-wrow') === live;
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
    setText(K.win, c.windowLabel ? 'ตอนนี้: ' + c.windowLabel : 'ตอนนี้ไม่อยู่ในช่วงเวลาหลักของ New York (09:30–10:10 ET)');
    paintTable(u); paintWindows(u);
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
  var SEED = { S15: 1, S16: 1, S22: 1 };
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
    var k = W.step, T = W.built.truth;
    var ctx = { side: T.side, stacks: T.levels.filter(function (l) { return l.kind === 'stack'; }).length, confirm: T.confluence.confirm.kind, windows: !!T.windows };
    steps.forEach(function (li) {
      var on = Number(li.getAttribute('data-step')) === k;
      li.classList.toggle('is-active', on);
      if (on) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    setText(metaEl, 'ข้อที่ ' + k + ' จาก ' + STEPS);
    setText(nowN, 'ข้อที่ ' + k);
    setText(nowT, nowText(k, ctx));
    if (nowGap) nowGap.hidden = !STEP_GAP[k];
    btnPrev.disabled = k <= 1; btnNext.disabled = k >= STEPS;
    $$('[data-act="view"]').forEach(function (b) { setPressed(b, Number(b.getAttribute('data-step')) === k); });
  }
  function flashAll(fr) { fr.focus.forEach(function (id) { W.ch.flash(id); }); }

  // Jump to a chain step. Forward moves play the bars between (one loop: every call bumps W.run and the
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
    W = { ch: TJR.chart.create(host, { label: 'กราฟจำลองที่เดินตามลำดับเทรดเต็มระบบของ playbook', interactive: true }), run: 0, step: 1, auto: false, autoRun: 0, autoTimer: null, seeds: { S15: SEED.S15, S16: SEED.S16, S22: SEED.S22 } };
    loadChart('S15', SEED.S15);
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
      // a tap on the card itself (not on a link, button or the worksheet) selects it too
      if (li && !(e.target.closest && e.target.closest('a,button,.bw'))) goStep(Number(li.getAttribute('data-step')));
    });
    TJR.motion.onChange(function (reduced) { if (reduced && W) { stopAuto(); W.run++; W.ch.reveal(W.frames[W.step - 1].bar); } });
  }

  // ---------------------------------------------------------------- the bias worksheet
  var BW_SEED = { S19: 1, S18: 1 };
  var bwRoot = $('.bw'), BW = null;                            // { ch, id, seeds, built, sample, ans }

  function bwPaint() {
    var s = BW.sample, v = biasVerdict(BW.ans, s), w = biasWords(v, s), diff = biasDiff(BW.ans, s), done = v.state !== 'incomplete';
    setText($('[data-k="bw-q1"]', bwRoot), BIAS_Q1[s.trend]);
    $$('button[data-bq]', bwRoot).forEach(function (b) {
      var i = Number(b.getAttribute('data-bq')) - 1, val = b.getAttribute('data-bv') === '1';
      setPressed(b, BW.ans[i] === val);
    });
    setText($('[data-k="bw-bias"]', bwRoot), w.bias);
    setText($('[data-k="bw-draw"]', bwRoot), w.draw);
    var chk = '';
    if (done) chk = diff.length ? 'ข้อ ' + diff.join(', ') + ' ต่างจากที่เว็บอ่านจากกราฟตัวอย่างนี้ ลองดูกราฟอีกครั้ง (เฉลยเป็นการอ่านของเว็บนี้ ไม่ใช่ของ TJR)' : 'ทุกข้อตรงกับที่เว็บอ่านจากกราฟตัวอย่างนี้ (เป็นการอ่านของเว็บนี้ ไม่ใช่ของ TJR)';
    setText($('[data-k="bw-check"]', bwRoot), chk);
    var gp = $('[data-k="bw-gap"]', bwRoot);
    if (gp) gp.hidden = !v.gap;
    bwRoot.setAttribute('data-state', v.state);
  }
  function bwLoad(id, seed) {
    var b = buildFor(id, seed), s = biasSample(b);
    if (!s) return;
    BW.id = id; BW.seeds[id] = b.meta.seed; BW.built = b; BW.sample = s; BW.ans = [null, null, null, null];
    BW.ch.setData(b);
    BW.ch.setOverlays(biasOverlays(b, s));
    BW.ch.reveal(s.frame);
    setText($('[data-k="bw-sym"]', bwRoot), b.meta.instrument);
    setText($('[data-k="bw-meta"]', bwRoot), 'seed ' + b.meta.seed + ' · เห็นถึงแท่งที่ ' + (s.frame + 1));
    $$('button[data-bw-sample]', bwRoot).forEach(function (btn) { setPressed(btn, btn.getAttribute('data-bw-sample') === id); });
    bwPaint();
  }
  function initBias() {
    if (!bwRoot) return;
    BW = { ch: TJR.chart.create($('.chart-frame__canvas', bwRoot), { label: 'กราฟ 60m จำลองสำหรับ bias worksheet', interactive: false }), id: 'S19', seeds: { S19: BW_SEED.S19, S18: BW_SEED.S18 }, built: null, sample: null, ans: [null, null, null, null] };
    bwLoad('S19', BW_SEED.S19);
    bwRoot.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('button') : null;
      if (!t) return;
      if (t.hasAttribute('data-bq')) {
        BW.ans[Number(t.getAttribute('data-bq')) - 1] = t.getAttribute('data-bv') === '1';
        bwPaint();
      } else if (t.hasAttribute('data-bw-sample')) {
        var id = t.getAttribute('data-bw-sample'); if (id !== BW.id) bwLoad(id, BW.seeds[id]);
      } else if (t.getAttribute('data-bw-act') === 'reseed') {
        BW.seeds[BW.id] = 1 + Math.floor(Math.random() * 999999); bwLoad(BW.id, BW.seeds[BW.id]);
      } else if (t.getAttribute('data-bw-act') === 'reset') {
        BW.ans = [null, null, null, null]; bwPaint();
      }
    });
  }

  // read-only handle for the console and the headless checks
  P.view = function () {
    return W && { step: W.step, id: W.id, run: W.run, auto: W.auto, seed: W.built.meta.seed, info: W.ch.info(), ticker: ticker.running(), state: serialize(state), bias: BW && { id: BW.id, ans: BW.ans.slice(), frame: BW.sample.frame } };
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
  try { initBias(); } catch (e) { if (global.console) console.error(e); }
  enter();
})(typeof window !== 'undefined' ? window : globalThis);
