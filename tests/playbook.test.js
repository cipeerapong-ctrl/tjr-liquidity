/* Playbook page (Task 12): the pure logic of assets/js/pages/playbook.js (checklist state, the clock and the
   session table from TJR.sessions, the single-interval ticker, the chart's per-step frames) and the content rule
   on playbook.html. playbook.js is evaluated into this context (no DOM here: it only attaches TJR.playbook).
   Wrapped in an IIFE (one shared vm scope). */
(function () {
  'use strict';
  (0, eval)(readText('assets/js/pages/playbook.js'));
  var P = TJR.playbook;
  var utc = function (y, mo, d, h, mi, s) { return Date.UTC(y, mo - 1, d, h, mi || 0, s || 0) / 1000; };

  // ---------------------------------------------------------------- checklist
  test('playbook.cleanRule: text only, one line, 160 characters at most', () => {
    eq(P.cleanRule('  ใช้ 1R  '), 'ใช้ 1R');
    eq(P.cleanRule('a\nb\t\u0000c‮d'), 'a b c d');
    eq(P.cleanRule(null), '');
    eq(P.cleanRule(42), '');
    eq(P.cleanRule({ x: 1 }), '');
    eq(P.cleanRule('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>', 'kept as literal text, shown with .value / textContent');
    eq(Array.from(P.cleanRule(new Array(400).join('ก'))).length, P.MAX_RULE);
    eq(Array.from(P.cleanRule(new Array(400).join('😀'))).length, P.MAX_RULE, 'never splits a surrogate pair');
    eq(P.MAX_RULE, 160);
  });

  test('playbook checklist ids follow the chain; the rule fields are stop-loss, TP split and max daily loss', () => {
    eq(P.CHECK_IDS, ['c-trend', 'c-map', 'c-bias', 'c-time', 'c-sweep', 'c-confirm', 'c-cont', 'c-entry', 'c-target', 'c-risk', 'c-sl', 'c-tp', 'c-maxloss']);
    eq(P.RULE_KEYS, ['sl', 'tp', 'maxloss']);
    eq(P.RULE_OF, { 'c-sl': 'sl', 'c-tp': 'tp', 'c-maxloss': 'maxloss' });
    eq(P.emptyState(), { checks: {}, rules: { sl: '', tp: '', maxloss: '' } });
  });

  test('playbook.parseState: unknown ids and damaged values are dropped', () => {
    var s = P.parseState(['c-time', 'c-sl', 'nope', 7, null, '__proto__', 'c-time', 'c-ny'], { sl: ' 1R ', tp: 5, maxloss: 'x'.repeat(500), size: 'old', extra: 'y' });
    eq(Object.keys(s.checks).sort(), ['c-sl', 'c-time']);
    eq(s.rules.sl, '1R');
    eq(s.rules.tp, '');
    eq(s.rules.maxloss.length, 160);
    eq(Object.keys(s.rules).sort(), ['maxloss', 'sl', 'tp']);
    eq(P.parseState('x', 'y'), P.emptyState());
    eq(P.parseState(undefined, [1, 2]), P.emptyState());
    eq(P.parseState({ 0: 'c-time' }, null), P.emptyState());
  });

  test('playbook.setCheck / resetChecks / clearRules / setRule: immutable, reset keeps the rules', () => {
    var s0 = P.emptyState(), s1 = P.setCheck(s0, 'c-time', true), s2 = P.setRule(s1, 'sl', '  เหนือ high ของขาเข้า \n');
    eq(P.progress(s0).done, 0, 'the first state is untouched');
    eq(s1.checks['c-time'], true);
    eq(s2.rules.sl, 'เหนือ high ของขาเข้า');
    eq(P.setCheck(s2, 'bogus', true), s2, 'unknown id ignored');
    eq(P.setRule(s2, 'bogus', 'x'), s2, 'unknown rule key ignored');
    eq(P.setRule(s2, 'size', 'x'), s2, 'the v1 key "size" is not a rule any more');
    var s3 = P.resetChecks(P.setCheck(s2, 'c-trend', true));
    eq(P.progress(s3).done, 0);
    eq(s3.rules.sl, 'เหนือ high ของขาเข้า', 'a new trade keeps the user\'s rules');
    eq(P.clearRules(s2).rules, { sl: '', tp: '', maxloss: '' });
    eq(P.setCheck(s2, 'c-time', false).checks, {});
  });

  test('playbook.progress / serialize: ticked ids come out in list order', () => {
    var s = P.emptyState();
    ['c-maxloss', 'c-trend', 'c-sweep'].forEach((id) => { s = P.setCheck(s, id, true); });
    eq(P.serialize(s).checks, ['c-trend', 'c-sweep', 'c-maxloss']);
    eq(P.progress(s), { done: 3, total: 13, pct: 23 });
    P.CHECK_IDS.forEach((id) => { s = P.setCheck(s, id, true); });
    eq(P.progress(s), { done: 13, total: 13, pct: 100 });
    eq(P.progress(P.emptyState()).pct, 0);
  });

  test('playbook.asText: ticked rows, the user\'s own rules, both sources', () => {
    var s = P.setRule(P.setCheck(P.emptyState(), 'c-time', true), 'sl', 'เหนือ high');
    var labels = { 'c-time': 'ช่วง NY', 'c-sl': 'กำหนด stop-loss แล้ว' };
    var t = P.asText(s, labels).split('\n');
    eq(t[1], 'ติ๊กแล้ว 1 / 13');
    ok(t.indexOf('[x] ช่วง NY') >= 0);
    ok(t.indexOf('[ ] กำหนด stop-loss แล้ว') >= 0);
    ok(t.indexOf('    กฎของฉัน (stop-loss): เหนือ high') >= 0);
    ok(t.indexOf('    กฎของฉัน (สัดส่วนที่ปิดที่แต่ละ TP): (ยังไม่ได้เขียน)') >= 0);
    ok(t.indexOf('    กฎของฉัน (max daily loss): (ยังไม่ได้เขียน)') >= 0);
    var src = t[t.length - 1];
    ok(src.indexOf('https://youtu.be/Vulini8xbB0') >= 0 && src.indexOf(TJR.sources.PLAYLIST) >= 0, 'main clip and playlist');
    eq(t.length, 2 + 13 + 3 + 1);
  });

  test('playbook storage: keys tjr.playbook.v2.*, round trip, and a blocked localStorage falls back to memory', () => {
    var s = P.setRule(P.setCheck(P.setCheck(P.emptyState(), 'c-map', true), 'c-target', true), 'maxloss', 'ตามแผนของฉัน');
    P.saveChecks(s); P.saveRules(s);
    eq(TJR.store.get('playbook.v2.checks'), ['c-map', 'c-target']);
    eq(TJR.store.get('playbook.v2.rules'), { sl: '', tp: '', maxloss: 'ตามแผนของฉัน' });
    eq(P.KEY_CHECKS, 'playbook.v2.checks'); eq(P.KEY_RULES, 'playbook.v2.rules');
    eq(P.loadState(), s);
    eq(P.load(), s, 'load is loadState');
    var mem = {};
    var fake = { get: (k, d) => (k in mem ? mem[k] : d), set: (k, v) => { mem[k] = v; } };
    P.saveChecks(s, fake); P.saveRules(s, fake);
    eq(P.loadState(fake), s);
    // storage that throws on every access (private window, sandboxed frame)
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
    try {
      var s2 = P.setCheck(P.emptyState(), 'c-time', true);
      P.saveChecks(s2); P.saveRules(P.setRule(s2, 'sl', 'x'));
      eq(P.loadState().checks['c-time'], true, 'memory copy answers');
      eq(P.loadState().rules.sl, 'x');
    } finally { delete globalThis.localStorage; }
    TJR.store.remove('playbook.v2.checks'); TJR.store.remove('playbook.v2.rules');
    eq(P.loadState(), P.emptyState());
  });

  test('playbook: a v1-shaped tjr.playbook.checks / rules in localStorage is ignored, never parsed, never overwritten', () => {
    var disk = {
      'tjr.playbook.checks': JSON.stringify(['c-sl', 'c-ny', 'c-htf', 'c-risk']),         // the v1 shape (some ids are also v2 ids)
      'tjr.playbook.rules': JSON.stringify({ sl: 'กฎเก่า', size: 'เก่า', risk: 'เก่า' })
    };
    globalThis.localStorage = { getItem: (k) => (k in disk ? disk[k] : null), setItem: (k, v) => { disk[k] = String(v); }, removeItem: (k) => { delete disk[k]; } };
    try {
      var s = P.load();
      eq(P.progress(s).done, 0, 'all-unticked v2 state');
      eq(s, P.emptyState());
      P.saveChecks(P.setCheck(s, 'c-trend', true));
      eq(JSON.parse(disk['tjr.playbook.checks']), ['c-sl', 'c-ny', 'c-htf', 'c-risk'], 'the v1 key is left as it was');
      eq(JSON.parse(disk['tjr.playbook.v2.checks']), ['c-trend']);
      eq(P.load().checks, { 'c-trend': true });
    } finally { delete globalThis.localStorage; TJR.store.remove('playbook.v2.checks'); TJR.store.remove('playbook.v2.rules'); }
  });

  test('playbook.js never writes the user\'s text as HTML', () => {
    var src = readText('assets/js/pages/playbook.js');
    ok(src.indexOf('innerHTML') < 0, 'no innerHTML anywhere in the controller');
    ok(src.indexOf('insertAdjacentHTML') < 0);
  });

  // ---------------------------------------------------------------- the clock
  test('playbook.fmtCountdown: HH:MM:SS, days before it, never negative or NaN', () => {
    eq(P.fmtCountdown(0), '00:00:00');
    eq(P.fmtCountdown(59), '00:00:59');
    eq(P.fmtCountdown(3661), '01:01:01');
    eq(P.fmtCountdown(86399), '23:59:59');
    eq(P.fmtCountdown(86400), '1 วัน 00:00:00');
    eq(P.fmtCountdown(217800), '2 วัน 12:30:00');
    eq(P.fmtCountdown(-5), '00:00:00');
    eq(P.fmtCountdown(NaN), '00:00:00');
    eq(P.fmtCountdown(12.9), '00:00:12');
  });

  test('playbook.clockParts: a weekday morning in EST (NY open exactly one day away)', () => {
    var c = P.clockParts(utc(2026, 11, 18, 14, 30, 15));          // Wed 09:30:15 EST
    eq(c.zone, 'EST'); eq(c.offset, -5);
    eq(c.et, '09:30:15'); eq(c.th, '21:30:15');
    eq(c.session, 'ny'); eq(c.sessionLabel, 'New York session');
    eq(c.toOpen, 86400 - 15); eq(c.countdown, '23:59:45');
    eq(c.etDate, 'พ. 18 พ.ย.'); eq(c.thDate, 'พ. 18 พ.ย.');
    eq(c.openAt, 'พฤ. 19 พ.ย. 09:30 ET · 21:30 น. เวลาไทย');
  });

  test('playbook.clockParts: summer time (EDT) and the Thai date running ahead', () => {
    var c = P.clockParts(utc(2026, 7, 15, 22, 0, 0));             // Wed 18:00 EDT = Thu 05:00 Thai
    eq(c.zone, 'EDT'); eq(c.et, '18:00:00'); eq(c.th, '05:00:00');
    eq(c.session, 'asia');
    eq(c.etDate, 'พ. 15 ก.ค.'); eq(c.thDate, 'พฤ. 16 ก.ค.');
    eq(P.dayShift(utc(2026, 7, 15, 22, 0)), 1);
    eq(P.dayShift(utc(2026, 7, 15, 14, 0)), 0);
    eq(P.dayShift(utc(2026, 11, 18, 23, 0)), 1);
    eq(P.dayShift(utc(2026, 11, 18, 16, 59)), 0);
    eq(P.dayShift(utc(2026, 11, 18, 17, 0)), 1, '00:00 Thai is the next calendar day');
  });

  test('playbook DST switch 2026-03-08 (2nd Sunday of March): zone flips at 07:00Z, Thai time does not move', () => {
    var before = P.clockParts(utc(2026, 3, 8, 6, 59, 59)), after = P.clockParts(utc(2026, 3, 8, 7, 0, 0));
    eq(before.zone, 'EST'); eq(before.et, '01:59:59'); eq(before.th, '13:59:59');
    eq(after.zone, 'EDT'); eq(after.et, '03:00:00'); eq(after.th, '14:00:00');
    // Friday 20:00 EST: market closed, the open is Monday 09:30 EDT = 13:30Z, 60.5 h away across the switch
    var fri = P.clockParts(utc(2026, 3, 7, 1, 0, 0));              // Fri 20:00 EST
    eq(fri.session, 'weekend');
    eq(fri.nextOpen, utc(2026, 3, 9, 13, 30));
    eq(fri.toOpen, 217800); eq(fri.countdown, '2 วัน 12:30:00');
    eq(fri.openAt, 'จ. 9 มี.ค. 09:30 ET · 20:30 น. เวลาไทย');
  });

  test('playbook DST switch 2026-11-01 (1st Sunday of November): zone flips at 06:00Z; a Sunday NY open falls on Monday', () => {
    var before = P.clockParts(utc(2026, 11, 1, 5, 59, 59)), after = P.clockParts(utc(2026, 11, 1, 6, 0, 0));
    eq(before.zone, 'EDT'); eq(before.et, '01:59:59'); eq(before.th, '12:59:59');
    eq(after.zone, 'EST'); eq(after.et, '01:00:00'); eq(after.th, '13:00:00');
    var sun = P.clockParts(utc(2026, 11, 1, 17, 0, 0));            // Sun 12:00 EST, closed
    eq(sun.session, 'weekend');
    eq(sun.nextOpen, utc(2026, 11, 2, 14, 30));
    eq(sun.toOpen, 77400); eq(sun.countdown, '21:30:00');
    var sat = P.clockParts(utc(2026, 11, 21, 12, 0, 0));           // Saturday: the next NY open is Monday
    eq(sat.session, 'weekend'); eq(sat.sessionLabel, 'ตลาดปิดสุดสัปดาห์');
    eq(sat.nextOpen, utc(2026, 11, 23, 14, 30));
    eq(sat.countdown, '2 วัน 02:30:00');
  });

  test('playbook.clockParts: every session label, and the countdown counts down second by second', () => {
    var seen = {};
    for (var h = 0; h < 24 * 7; h++) seen[P.clockParts(utc(2026, 11, 16, 5, 0) + h * 3600).session] = true;   // Mon 00:00 EST onward
    eq(Object.keys(seen).sort(), ['asia', 'london', 'ny', 'ny-pre', 'spread', 'weekend']);
    var a = P.clockParts(utc(2026, 11, 17, 12, 0, 0)), b = P.clockParts(utc(2026, 11, 17, 12, 0, 1));
    eq(a.toOpen - b.toOpen, 1);
    P.ORDER.concat(['weekend']).forEach((s) => ok(P.SESS_LABEL[s], s + ' has a label'));
  });

  test('playbook.boundaries: the five windows of Wed 2026-11-18 in ET and Thailand time (EST)', () => {
    var b = P.boundaries(utc(2026, 11, 18, 14, 30));
    eq(b.map((r) => r.id), ['asia', 'london', 'ny-pre', 'ny', 'spread']);
    eq(b.map((r) => r.et), ['18:00–03:00', '03:00–08:30', '08:30–09:30', '09:30–17:00', '17:00–18:00']);
    eq(b.map((r) => r.th), ['06:00 (+1)–15:00', '15:00–20:30', '20:30–21:30', '21:30–05:00 (+1)', '05:00 (+1)–06:00 (+1)']);
    eq(b[0].from, utc(2026, 11, 17, 23, 0), 'Asia opened the evening before');
    eq(b[4].to, utc(2026, 11, 18, 23, 0));
    for (var i = 1; i < b.length; i++) eq(b[i].from, b[i - 1].to, 'windows run back to back');
    eq(b[4].to - b[0].from, 86400);
  });

  test('playbook.boundaries: the same windows in EDT are one hour earlier in Thai time', () => {
    var b = P.boundaries(utc(2026, 7, 15, 14, 0));
    eq(b.map((r) => r.th), ['05:00 (+1)–14:00', '14:00–19:30', '19:30–20:30', '20:30–04:00 (+1)', '04:00 (+1)–05:00 (+1)']);
    eq(b[4].to - b[0].from, 86400);
  });

  test('playbook.sessionDay: after 18:00 ET it is the next day\'s Asia, a weekend shows Monday', () => {
    eq(P.sessionDay(utc(2026, 11, 18, 14, 30)), { y: 2026, mo: 11, d: 18 });
    eq(P.sessionDay(utc(2026, 11, 18, 23, 30)), { y: 2026, mo: 11, d: 19 });         // Wed 18:30 EST
    eq(P.sessionDay(utc(2026, 11, 18, 22, 59)), { y: 2026, mo: 11, d: 18 });         // Wed 17:59 EST
    eq(P.sessionDay(utc(2026, 11, 21, 12, 0)), { y: 2026, mo: 11, d: 23 });          // Saturday
    eq(P.sessionDay(utc(2026, 11, 22, 23, 30)), { y: 2026, mo: 11, d: 23 });         // Sunday 18:30 EST: Monday's Asia
    var fri = P.boundaries(utc(2026, 11, 20, 23, 30));                               // Fri 18:30 EST, weekend
    eq(fri[0].from, utc(2026, 11, 22, 23, 0), 'Monday\'s Asia opens Sunday 18:00 EST');
  });

  test('playbook.boundaries: sessions on both DST switch weeks', () => {
    var mar = P.boundaries(utc(2026, 3, 7, 12, 0));                                  // Saturday: Monday 2026-03-09 (EDT)
    eq(mar[0].from, utc(2026, 3, 8, 22, 0), 'Sunday 18:00 EDT');
    eq(mar[3].from, utc(2026, 3, 9, 13, 30));
    eq(mar[0].th, '05:00 (+1)–14:00');
    var nov = P.boundaries(utc(2026, 11, 1, 17, 0));                                 // Sunday: Monday 2026-11-02 (EST)
    eq(nov[0].from, utc(2026, 11, 1, 23, 0), 'Sunday 18:00 EST, after the fall-back');
    eq(nov[3].from, utc(2026, 11, 2, 14, 30));
    eq(nov[0].th, '06:00 (+1)–15:00');
    var mon = P.boundaries(utc(2026, 3, 9, 12, 0));                                  // the Monday itself
    eq(mon[0].from, utc(2026, 3, 8, 22, 0));
    eq(mon[4].to - mon[0].from, 86400, 'Sunday 18:00 EDT to Monday 18:00 EDT: the switch is behind it');
  });

  test('playbook.zoneNote: names the zone and the gap to Thailand', () => {
    ok(P.zoneNote(utc(2026, 11, 18, 12, 0)).indexOf('EST (UTC−5)') >= 0);
    ok(P.zoneNote(utc(2026, 11, 18, 12, 0)).indexOf('เร็วกว่า 12 ชั่วโมง') >= 0);
    ok(P.zoneNote(utc(2026, 7, 15, 12, 0)).indexOf('EDT (UTC−4)') >= 0);
    ok(P.zoneNote(utc(2026, 7, 15, 12, 0)).indexOf('เร็วกว่า 11 ชั่วโมง') >= 0);
  });

  test('playbook.makeTicker: one interval at most, paused while hidden, redrawn when shown', () => {
    var handles = {}, next = 1, calls = 0, created = 0, cleared = 0;
    var t = P.makeTicker(() => { calls++; }, {
      setInterval: (f) => { var id = next++; handles[id] = f; created++; return id; },
      clearInterval: (id) => { if (handles[id]) { delete handles[id]; cleared++; } }
    });
    var active = () => Object.keys(handles).length;
    eq(active(), 0);
    t.start(); t.start(); t.start();
    eq(active(), 1, 'start x3 = one interval');
    eq(calls, 1, 'drew once at start');
    for (var i = 0; i < 50; i++) { t.setHidden(true); t.setHidden(true); t.setHidden(false); t.setHidden(false); }
    eq(active(), 1, 'fifty hide / show cycles never stack');
    t.setHidden(true);
    eq(active(), 0, 'hidden: no timer'); eq(t.running(), false);
    var before = calls; t.start();
    eq(active(), 0, 'start while hidden stays quiet'); eq(calls, before);
    t.setHidden(false);
    eq(active(), 1); eq(calls, before + 1, 'drew at once when shown');
    t.stop(); t.stop();
    eq(active(), 0); t.setHidden(true); t.setHidden(false);
    eq(active(), 0, 'stopped stays stopped');
    ok(created - cleared <= 1);
    // a draw that throws is swallowed
    var th = P.makeTicker(() => { throw new Error('boom'); }, { setInterval: () => 1, clearInterval: () => {} });
    th.start(); th.setHidden(true); th.setHidden(false);
  });

  // ---------------------------------------------------------------- the New York windows (P5.12-P5.19)
  test('playbook.currentWindow: manipulation at 09:40 ET, null at 11:00 ET, on a winter and a summer day', () => {
    eq(P.currentWindow(utc(2026, 11, 18, 14, 40)), 'manipulation', 'Wed 09:40 EST');
    eq(P.currentWindow(utc(2026, 11, 18, 16, 0)), null, 'Wed 11:00 EST');
    eq(P.currentWindow(utc(2026, 7, 15, 13, 40)), 'manipulation', 'Wed 09:40 EDT');
    eq(P.currentWindow(utc(2026, 7, 15, 15, 0)), null, 'Wed 11:00 EDT');
  });

  test('playbook.currentWindow: the edges, the entry window, PM, and nothing outside New York or on a weekend', () => {
    eq(P.currentWindow(utc(2026, 11, 18, 14, 29, 59)), null, '09:29:59 is pre-market');
    eq(P.currentWindow(utc(2026, 11, 18, 14, 30)), 'manipulation', '09:30:00');
    eq(P.currentWindow(utc(2026, 11, 18, 14, 49, 59)), 'manipulation');
    eq(P.currentWindow(utc(2026, 11, 18, 14, 50)), 'entry', '09:50:00');
    eq(P.currentWindow(utc(2026, 11, 18, 15, 9, 59)), 'entry');
    eq(P.currentWindow(utc(2026, 11, 18, 15, 10)), null, '10:10 ends the entry window');
    eq(P.currentWindow(utc(2026, 11, 18, 15, 30)), null, '10:30 is a cut-off, not a window');
    eq(P.currentWindow(utc(2026, 11, 18, 17, 59)), null, '12:59');
    eq(P.currentWindow(utc(2026, 11, 18, 18, 0)), 'pm', '13:00 EST');
    eq(P.currentWindow(utc(2026, 11, 18, 21, 59)), 'pm', '16:59');
    eq(P.currentWindow(utc(2026, 11, 18, 22, 0)), null, '17:00 spread hour');
    eq(P.currentWindow(utc(2026, 11, 18, 5, 0)), null, 'Asia / London');
    eq(P.currentWindow(utc(2026, 11, 21, 14, 40)), null, 'Saturday 09:40 ET');
    eq(P.currentWindow(utc(2026, 11, 22, 14, 40)), null, 'Sunday 09:40 ET');
  });

  test('playbook.clockParts carries the window and its label', () => {
    var c = P.clockParts(utc(2026, 11, 18, 14, 40));
    eq(c.window, 'manipulation');
    ok(c.windowLabel.indexOf('09:30–09:50') >= 0);
    eq(P.clockParts(utc(2026, 11, 18, 16, 0)).window, null);
    eq(P.clockParts(utc(2026, 11, 18, 16, 0)).windowLabel, null);
    P.WIN_ORDER.filter((w) => w !== 'open' && w !== 'cutoff').forEach((w) => ok(P.WIN_LABEL[w], w + ' has a label'));
  });

  test('playbook.windowRows: the five New York windows on a winter day (EST), ET and Thailand time', () => {
    var r = P.windowRows(utc(2026, 11, 18, 14, 30));
    eq(r.map((x) => x.id), ['open', 'manipulation', 'entry', 'cutoff', 'pm']);
    eq(r.map((x) => x.et), ['09:30', '09:30–09:50', '09:50–10:10', '10:30', '13:00']);
    eq(r.map((x) => x.th), ['21:30', '21:30–21:50', '21:50–22:10', '22:30', '01:00 (+1)']);
    eq(r[1].from, utc(2026, 11, 18, 14, 30)); eq(r[1].to, utc(2026, 11, 18, 14, 50));
    eq(r[0].to, null); eq(r[3].to, null);
  });

  test('playbook.windowRows: summer time (EDT) is one hour earlier in Thailand; a weekend shows Monday', () => {
    var r = P.windowRows(utc(2026, 7, 15, 14, 0));
    eq(r.map((x) => x.et), ['09:30', '09:30–09:50', '09:50–10:10', '10:30', '13:00']);
    eq(r.map((x) => x.th), ['20:30', '20:30–20:50', '20:50–21:10', '21:30', '00:00 (+1)']);
    var sat = P.windowRows(utc(2026, 11, 21, 12, 0));                 // Saturday: Monday 2026-11-23
    eq(sat[1].from, utc(2026, 11, 23, 14, 30));
    var evening = P.windowRows(utc(2026, 11, 18, 23, 30));            // Wed 18:30 EST: Thursday's windows
    eq(evening[1].from, utc(2026, 11, 19, 14, 30));
  });

  // ---------------------------------------------------------------- the chain's step frames (S15 long BOS, S16 short IFVG, S22 long with the NY windows)
  [['S15', 'long', 'bos'], ['S16', 'short', 'ifvg'], ['S22', 'long', 'ifvg']].forEach((trio) => {
    test('playbook.stepFrames ' + trio[0] + ': 8 frames, knowable-only overlays, read from truth, 12 seeds', () => {
      for (var seed = 1; seed <= 12; seed++) {
        var b = TJR.scenarios.safeBuild(TJR.scenarios.get(trio[0]), seed, {}), T = b.truth, K = T.confluence, last = b.candles.length - 1;
        var tag = trio[0] + ' seed ' + seed;
        eq(T.side, trio[1]); eq(K.confirm.kind, trio[2]);
        var f = P.stepFrames(b);
        eq(f.length, 8);
        f.forEach((fr, i) => {
          eq(fr.step, i + 1);
          ok(fr.bar >= 0 && fr.bar <= last, 'bar in range');
          if (i) ok(fr.bar >= f[i - 1].bar, tag + ': frames never go back in time');
          P.overlaysFor(b, fr).forEach((o) => ok(o.appearAt <= fr.bar, tag + ' step ' + (i + 1) + ': ' + o.id + ' knowable at ' + fr.bar + ' (appears ' + o.appearAt + ')'));
        });
        ok(f[0].bar < T.sweep.bar, tag + ': levels are marked before the sweep');
        eq(f[2].bar, T.sweep.bar);
        eq(f[3].bar, K.confirm.at);
        ok(f[4].bar >= K.cont.at && f[4].bar <= K.entry.at, tag + ': continuation step sits between the gap and the entry');
        eq(f[5].bar, K.entry.at);
        ok(f[6].bar >= K.entry.at, tag + ': exits come after the entry');
        eq(f[7].bar, f[6].bar, 'risk is not on the chart: same frame as the exits');
        var ids = (k) => P.overlaysFor(b, f[k - 1]).map((o) => o.id);
        var types = (k) => P.overlaysFor(b, f[k - 1]).map((o) => o.type);
        ok(ids(1).indexOf('sweep') < 0 && ids(2).indexOf('sweep') < 0, tag + ': no sweep marker before step 3');
        ok(ids(3).indexOf('sweep') >= 0);
        var conf = K.confirm.kind === 'bos' ? 'bos:' + K.confirm.at : 'fvg:' + K.confirm.i, cont = 'fvg:' + K.cont.i;
        ok(ids(3).indexOf(conf) < 0 && ids(3).indexOf(cont) < 0, 'no confirmation or gap before step 4');
        ok(ids(4).indexOf(conf) >= 0, tag + ': the confirming ' + conf + ' is up at step 4');
        ok(ids(4).indexOf(cont) < 0, 'the continuation gap waits for step 5');
        ok(ids(5).indexOf(cont) >= 0 && ids(5).indexOf(conf) >= 0, 'step 5 keeps the confirmation and adds the gap');
        ok(ids(5).indexOf('entry-mk') < 0 && ids(6).indexOf('entry-mk') >= 0, 'the entry mark comes at step 6');
        ok(ids(8).indexOf('entry-mk') >= 0, 'and stays');
        [1, 2, 3, 4, 5, 6, 7, 8].forEach((k) => ok(ids(k).indexOf('entry') < 0, 'the gap is the entry zone: no separate zone shape'));
        ok(ids(6).indexOf('target') < 0 && ids(7).indexOf('target') >= 0 && ids(8).indexOf('target') >= 0, 'target overlay waits for step 7');
        ok(ids(4).some((x) => x.indexOf('lbl:') === 0), tag + ': Level 1 structure labels by step 4');
        [1, 2, 3].forEach((k) => ok(types(k).indexOf('label') < 0, 'no structure labels before the confirmation step'));
        ok(ids(4).filter((x) => x.indexOf('fvg:') === 0 || x.indexOf('bos:') === 0).length === 1 || trio[2] === 'ifvg', 'one confirmation shape only');
        f[0].focus.forEach((id) => ok(T.levels.some((l) => l.id === id), 'step 1 focus names a level'));
        if (trio[0] === 'S22') {
          ok(types(2).indexOf('band') >= 0, tag + ': the manipulation band is up at the timing step');
          eq(types(1).indexOf('band'), -1, 'no band before the timing step');
        } else {
          eq(types(2).indexOf('band'), -1, 'a scenario without a clock has no bands');
        }
      }
    });
  });

  test('playbook.stepFrames: BOS confirmation is drawn from the truth even when the full scan has no event there', () => {
    var b = TJR.scenarios.safeBuild(TJR.scenarios.get('S15'), 1, {}), K = b.truth.confluence;
    var fr = P.stepFrames(b)[3], o = P.overlaysFor(b, fr).filter((x) => x.type === 'bos');
    eq(o.length, 1);
    eq(o[0].at, K.confirm.at); eq(o[0].price, K.confirm.level.price); eq(o[0].from, K.confirm.level.i);
  });

  test('playbook.nowText: eight different lines; confirm kind and the clock change what steps 2 and 4 say; gap steps are 7 and 8', () => {
    var a = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => P.nowText(k, { side: 'long', stacks: 3, confirm: 'bos', windows: false }));
    eq(new Set(a).size, 8);
    var s = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => P.nowText(k, { side: 'short', stacks: 2, confirm: 'ifvg', windows: true }));
    ok(a[0].indexOf('stacked lows 3 จุด') >= 0); ok(s[0].indexOf('stacked highs 2 จุด') >= 0);
    ok(a[3].indexOf('BOS') >= 0 && a[3].indexOf('HH') >= 0); ok(s[3].indexOf('IFVG') >= 0 && s[3].indexOf('LH') >= 0);
    ok(a[1] !== s[1] && s[1].indexOf('09:30–09:50') >= 0, 'with a clock the timing step names the band');
    ok(a[1].indexOf('Long · ตามเวลา NY') >= 0, 'without one it points at the sample that has it');
    eq(Object.keys(P.STEP_GAP).map(Number), [7, 8]);
    ok(P.nowText(99, null).length > 0 && P.nowText(-3, null).length > 0, 'out-of-range steps clamp');
  });

  // ---------------------------------------------------------------- the bias worksheet (60m, S19 stacked gaps / S18 closed through)
  test('playbook.biasSample S19: all four answers yes, bias up, the target is the draw above, over 30 seeds', () => {
    for (var seed = 1; seed <= 30; seed++) {
      var b = TJR.scenarios.safeBuild(TJR.scenarios.get('S19'), seed, {}), K = b.truth.confluence, s = P.biasSample(b);
      eq(b.meta.tf, 60, 'the worksheet sample is a 60m chart');
      ok(s, 'sample S19 seed ' + seed);
      eq(s.expected, [true, true, true, true], 'S19 seed ' + seed);
      eq(s.trend, 'up'); eq(s.bias, 'up'); eq(s.flipped, false);
      eq(s.frame, K.entry.at);
      eq(s.draw, { id: K.targets[0].levelId, price: K.targets[0].price });
      eq(s.gapState, 'respected');
      var ov = P.biasOverlays(b, s);
      ov.forEach((o) => ok(o.appearAt <= s.frame, 'S19 seed ' + seed + ': ' + o.id + ' knowable at the frame'));
      ok(ov.some((o) => o.id === s.gapId), 'the continuation gap is drawn');
      ok(ov.some((o) => o.id === s.stackId && o.type === 'fvg'), 'the top gap of the stack is drawn');
      ok(ov.some((o) => o.type === 'level'), 'levels are drawn');
      ok(ov.every((o) => o.type === 'level' || o.type === 'trend' || o.type === 'fvg'), 'nothing else is drawn');
      eq(ov.filter((o) => o.id === s.gapId)[0].state, 'respected');
      var top = ov.filter((o) => o.id === s.stackId)[0];
      eq(top.state, 'open', 'a close under the top gap of a stack is not an inverse: no IFVG pill (P8.34)');
      ok(top.stateAt === undefined, 'and no state change is drawn');
    }
  });

  test('playbook.biasSample S18: gap closed through, bias flips, no draw, over 30 seeds', () => {
    for (var seed = 1; seed <= 30; seed++) {
      var b = TJR.scenarios.safeBuild(TJR.scenarios.get('S18'), seed, {}), K = b.truth.confluence, s = P.biasSample(b);
      eq(b.meta.tf, 60);
      ok(s, 'sample S18 seed ' + seed);
      eq(s.expected, [true, true, true, false], 'S18 seed ' + seed);
      eq(s.trend, 'down'); eq(s.flipped, true); eq(s.bias, 'up'); eq(s.draw, null);
      eq(s.frame, K.noTrade.at);
      eq(s.gapState, 'disrespected');
      P.biasOverlays(b, s).forEach((o) => ok(o.appearAt <= s.frame, 'S18 seed ' + seed + ': ' + o.id + ' knowable'));
    }
  });

  test('playbook.biasSample: nothing for a scenario without a Level 2 truth', () => {
    eq(P.biasSample(TJR.scenarios.safeBuild(TJR.scenarios.get('S04'), 1, {})), null);
  });

  test('playbook.biasVerdict: the four-question decision tree', () => {
    var up = { trend: 'up', draw: { id: 'T', price: 7576.5 }, instrument: 'ES' }, down = { trend: 'down', draw: null, instrument: 'ES' };
    eq(P.biasVerdict([true, true, true, null], up).state, 'incomplete');
    eq(P.biasVerdict([], up).state, 'incomplete');
    eq(P.biasVerdict(null, up).state, 'incomplete');
    eq(P.biasVerdict([false, true, true, true], up), { state: 'notrend', bias: null, target: null, gap: true });
    eq(P.biasVerdict([true, false, true, true], up), { state: 'nodraw', bias: null, target: null, gap: true });
    eq(P.biasVerdict([true, true, false, true], up), { state: 'wait', bias: null, target: null, gap: false });
    eq(P.biasVerdict([true, true, true, true], up), { state: 'set', bias: 'up', target: { id: 'T', price: 7576.5 }, gap: false });
    eq(P.biasVerdict([true, true, true, false], up), { state: 'flip', bias: 'down', target: null, gap: false }, 'an up trend whose gap is closed through flips down');
    eq(P.biasVerdict([true, true, true, false], down), { state: 'flip', bias: 'up', target: null, gap: false }, 'a down trend whose gap is closed through flips up');
    eq(P.biasVerdict([true, true, true, true], down).bias, 'down');
  });

  test('playbook.biasWords / biasDiff: words for every state, the gap states say so, differences listed by question number', () => {
    var up = { trend: 'up', draw: { id: 'T', price: 7576.5 }, instrument: 'ES', expected: [true, true, true, true] };
    var states = { incomplete: [null, null, null, null], notrend: [false, true, true, true], nodraw: [true, false, true, true], wait: [true, true, false, true], set: [true, true, true, true], flip: [true, true, true, false] };
    var seen = {};
    Object.keys(states).forEach((k) => {
      var v = P.biasVerdict(states[k], up), w = P.biasWords(v, up);
      eq(v.state, k); ok(w.bias.length > 0, k + ' has a bias line'); seen[w.bias] = true;
    });
    eq(Object.keys(seen).length, 6, 'six different lines');
    var set = P.biasWords(P.biasVerdict(states.set, up), up);
    ok(set.bias.indexOf('ขึ้น') >= 0 && set.draw.indexOf('7,576.50') >= 0 && set.draw.indexOf('ES') >= 0, 'bias up, the draw price and the instrument');
    ok(P.biasWords(P.biasVerdict(states.flip, up), up).bias.indexOf('ลง') >= 0, 'flipped to down');
    eq(P.biasDiff([true, true, true, true], up), []);
    eq(P.biasDiff([true, false, true, false], up), [2, 4]);
    eq(P.biasDiff([null, null, true, null], up), [], 'unanswered questions are not differences');
    eq(Object.keys(P.BIAS_Q1).sort(), ['down', 'up']);
  });

  // ---------------------------------------------------------------- playbook.html: the content rule and the hooks
  var html = readText('playbook.html');
  var stepBlock = (k) => { var a = html.indexOf('data-step="' + k + '" id="step-' + k + '"'), b = html.indexOf('</li>', a); return html.slice(a, b); };

  test('playbook.html: every checklist id has one checkbox, the three own-rule fields and the gap badge', () => {
    P.CHECK_IDS.forEach((id) => eq(html.split('data-id="' + id + '"').length - 1, 1, id));
    eq(html.split('class="m-check"').length - 1, P.CHECK_IDS.length);
    P.RULE_KEYS.forEach((k) => {
      eq(html.split('data-rule="' + k + '"').length - 1, 1, k);
      ok(html.indexOf('id="rule-' + k + '"') >= 0 && html.indexOf('for="rule-' + k + '"') >= 0, 'field ' + k + ' has a visible label');
    });
    eq((html.match(/maxlength="160"/g) || []).length, 3);
    // the SL / TP split / max daily loss rows each carry the badge before the field
    ['c-sl', 'c-tp', 'c-maxloss'].forEach((id) => {
      var row = html.slice(html.indexOf('data-id="' + id + '"'));
      row = row.slice(0, row.indexOf('</li>'));
      ok(row.indexOf('badge-gap') >= 0 && row.indexOf('คลิปไม่ได้ระบุ') >= 0, id + ' shows the gap badge');
      ok(row.indexOf('กฎ') >= 0 && row.indexOf('ของคุณเอง') >= 0, id + ' has the user\'s own rule field');
    });
    ['c-risk', 'c-target', 'c-entry'].forEach((id) => {
      var row = html.slice(html.indexOf('data-id="' + id + '"')); row = row.slice(0, row.indexOf('</li>'));
      ok(row.indexOf('data-rule=') < 0, id + ' has no own-rule field: clip #2 and #1 say it');
    });
  });

  test('playbook.html: 8 chain steps in order, each with a view button; links point at real modules, scenarios and pages', () => {
    for (var k = 1; k <= 8; k++) {
      ok(html.indexOf('data-step="' + k + '" id="step-' + k + '"') >= 0, 'step ' + k);
      eq(html.split('data-act="view" data-step="' + k + '"').length - 1, 1);
    }
    eq(html.split('class="step').length - 1, 8 + (html.split('class="step__').length - 1) + 1 + (html.split('class="step-tag').length - 1), 'exactly eight .step cards (+ the <ol class="steps"> and the path step marker)');
    var ids = (html.match(/(?:learn\.html#m|scenarios\.html#S)\d+/g) || []);
    ok(ids.length >= 10, 'module and scenario links present');
    ids.forEach((h) => { var n = Number(h.replace(/\D/g, '')); ok(h.indexOf('learn') === 0 ? n >= 1 && n <= 8 : n >= 1 && n <= 22, h); });
    var learn = readText('learn.html');
    for (var m = 1; m <= 8; m++) ok(learn.indexOf('id="m' + m + '"') >= 0);
    ['risk.html', 'strategy.html', 'confluences.html'].forEach((f) => ok(html.indexOf('href="' + f + '"') >= 0, 'links ' + f));
    ok(stepBlock(8).indexOf('href="risk.html"') >= 0, 'the last step links the risk page');
  });

  test('playbook.html: each chain step carries a chip to clip #1 (TEp3a-7GUds) or to the clip that teaches it', () => {
    var want = {
      1: ['ironJFzNBic', 'TEp3a-7GUds', 'xX5LTSJ5wwM', '4sRDnVmLcMk'],   // bias + map: #3, #1 P1.23-P1.30; the worksheet's stacked-gap note P10.29 (#10), P8.34 (#8)
      2: ['L4xz2o23aPQ'],                             // timing: #5
      3: ['7dTQA0t8SH0', 'TEp3a-7GUds'],              // sweep + SMT: #6, #1 P1.19 (main F6.4 / F7.2)
      4: ['Zzk864cVJek', '4sRDnVmLcMk', 'TEp3a-7GUds'],   // confirmation: #11 BOS, #8 IFVG, #1 P1.37
      5: ['xX5LTSJ5wwM', 'joe_XTCn5Bs', 'TEp3a-7GUds'],   // continuation: #10 FVG, #7 EQ, #1 P1.39
      6: ['TEp3a-7GUds'],                             // entry: #1 P1.44-P1.47
      7: ['AGmAVyAuBE0', 'TEp3a-7GUds'],              // exits: #12 draws, #1 P1.51
      8: ['hBnD6T1M4w8']                              // risk: #2
    };
    Object.keys(want).forEach((k) => {
      var vids = (stepBlock(k).match(/youtu\.be\/([\w-]+)\?t=/g) || []).map((x) => /youtu\.be\/([\w-]+)/.exec(x)[1]);
      ok(vids.length >= 1, 'step ' + k + ' has chips');
      want[k].forEach((v) => ok(vids.indexOf(v) >= 0, 'step ' + k + ' has a chip to ' + v));
      vids.forEach((v) => ok(v === 'Vulini8xbB0' || want[k].indexOf(v) >= 0 || (k === '1' && v === 'Vulini8xbB0'), 'step ' + k + ' chip to ' + v + ' is expected'));
    });
    ok(stepBlock(6).indexOf('data-fact="P1.44"') >= 0 && stepBlock(7).indexOf('data-fact="P1.51"') >= 0 && stepBlock(4).indexOf('data-fact="P1.37"') >= 0 && stepBlock(5).indexOf('data-fact="P1.39"') >= 0, 'the facts the brief names');
    ['P1.37', 'P11.25', 'P8.14'].forEach((id) => ok(stepBlock(4).indexOf('data-fact="' + id + '"') >= 0, 'step 4 ' + id));
    ['P1.39', 'P1.42', 'P1.43'].forEach((id) => ok(stepBlock(5).indexOf('data-fact="' + id + '"') >= 0, 'step 5 ' + id));
    ['P1.44', 'P1.45', 'P1.46', 'P1.47'].forEach((id) => ok(stepBlock(6).indexOf('data-fact="' + id + '"') >= 0, 'step 6 ' + id));
    ['P1.51', 'P12.23', 'P12.24', 'P12.25', 'P1.50'].forEach((id) => ok(stepBlock(7).indexOf('data-fact="' + id + '"') >= 0, 'step 7 ' + id));
    ['P2.21', 'P2.26'].forEach((id) => ok(stepBlock(8).indexOf('data-fact="' + id + '"') >= 0, 'step 8 ' + id));
    ['P5.12', 'P5.13', 'P5.14', 'P5.18', 'P5.19'].forEach((id) => ok(stepBlock(2).indexOf('data-fact="' + id + '"') >= 0, 'step 2 ' + id));
    ['F6.4', 'F7.2', 'P6.12'].forEach((id) => ok(stepBlock(3).indexOf('data-fact="' + id + '"') >= 0, 'step 3 ' + id));
    ['P3.3', 'P3.4', 'P3.5', 'P3.6', 'P1.23', 'P1.30'].forEach((id) => ok(stepBlock(1).indexOf('data-fact="' + id + '"') >= 0, 'step 1 ' + id));
  });

  test('playbook.html: every chip names its fact and links the start second of that fact in that fact\'s own video', () => {
    var anchors = (html.match(/<a\b[^>]*\bts-chip\b[^>]*>[^<]*<\/a>/g) || []);
    ok(anchors.length >= 100, 'chips present: ' + anchors.length);
    var starts = (id) => {
      var src = TJR.sources.forFact(id), file = id.charAt(0) === 'F' ? 'docs/source/clip-facts.md' : 'docs/source/playlist/' + src.id + '.md';
      var line = readText(file).split('\n').filter((l) => l.indexOf('- ' + id + ' ') === 0)[0];
      ok(line, id + ' is a fact');
      var all = line.match(/\(\d{1,2}:\d\d[^)]*\)/g), m = /\((\d{1,2}):(\d\d)/.exec(all[all.length - 1]);
      return Number(m[1]) * 60 + Number(m[2]);
    };
    var named = 0;
    anchors.forEach((a) => {
      var href = /href="https:\/\/youtu\.be\/([\w-]+)\?t=(\d+)"/.exec(a), id = (/data-fact="([FP]\d+\.\d+)"/.exec(a) || [])[1];
      ok(href, 'chip has a youtu.be link: ' + a);
      if (!id) return;
      named++;
      var src = TJR.sources.forFact(id);
      eq(href[1], src.id, id + ' links its own video');
      eq(Number(href[2]), starts(id), id + ' links the start of its range');
      ok(/\bts-chip--pl\b/.test(a) === !src.main, id + ' playlist chips are the outline kind, main chips are not');
    });
    eq(named, anchors.length, 'every chip names its fact');
    ok(html.indexOf('คลิปไม่ได้ระบุ') >= 0);
  });

  test('playbook.html: the traps section holds the 7 clip-backed traps, each with its facts and a real lesson link', () => {
    var a = html.indexOf('id="traps"'), sec = html.slice(a, html.indexOf('</section>', a));
    ok(a > html.indexOf('id="checklist"') && a < html.indexOf('id="sessions"'), 'between the checklist and the sessions');
    var want = {
      sweep: [['F4.6'], 'learn.html#m4'],
      wick: [['P11.13', 'P8.20'], 'confluences.html#m1'],
      stack: [['P8.34'], 'confluences.html#m3'],
      'old-gap': [['P10.31', 'P10.35'], 'confluences.html#m2'],
      eq: [['P7.14', 'P7.16'], 'confluences.html#m4'],
      smt: [['P1.35', 'P1.36'], 'confluences.html#m5'],
      time: [['P5.13', 'P5.17', 'P5.26'], '#sessions']
    };
    var items = sec.split('<li class="trap"').slice(1);
    eq(items.length, 7, 'seven traps');
    items.forEach((li) => {
      var k = /^ data-trap="([\w-]+)"/.exec(li)[1], w = want[k];
      ok(w, 'trap ' + k + ' is one of the seven');
      var facts = (li.match(/data-fact="([FP]\d+\.\d+)"/g) || []).map((x) => x.slice(11, -1));
      eq(facts, w[0], k + ' cites exactly its facts');
      ok(li.indexOf('class="trap__go" href="' + w[1] + '"') >= 0, k + ' links ' + w[1]);
      ok(li.indexOf('<h3 class="trap__t">') >= 0, k + ' has a heading');
    });
    var learn = readText('learn.html'), conf = readText('confluences.html');
    ok(learn.indexOf('id="m4"') >= 0 && learn.indexOf('t=945') > learn.indexOf('id="m4"') && learn.indexOf('t=945') < learn.indexOf('id="m5"'), 'learn #m4 teaches F4.6');
    [1, 2, 3, 4, 5].forEach((m) => ok(conf.indexOf('id="m' + m + '"') >= 0, 'confluences #m' + m));
    // the two traps no clip says stay out (the user chose clip-backed only)
    ['Major High', 'shallow', 'กวาดตื้น', 'SL แคบ'].forEach((w) => ok(sec.indexOf(w) < 0, 'not in the clips: ' + w));
    ok(sec.indexOf('ขั้น 1') >= 0 && sec.indexOf('ขั้น 2') >= 0, 'pointers name path steps');
  });

  test('playbook.html: every main-clip chip is the start second of a fact in clip-facts.md', () => {
    var starts = {};
    readText('docs/source/clip-facts.md').split('\n').forEach((l) => {
      var m = /^- F\d+\.\d+ .*\((\d\d):(\d\d)[^)]*\)\s*$/.exec(l);
      if (m) starts[Number(m[1]) * 60 + Number(m[2])] = true;
    });
    var chips = html.match(/href="https:\/\/youtu\.be\/Vulini8xbB0\?t=\d+"/g) || [];
    ok(chips.length >= 20, 'main-clip chips present: ' + chips.length);
    chips.forEach((c) => { var s = Number(/t=(\d+)/.exec(c)[1]); ok(starts[s], 'second ' + s + ' starts a fact'); });
  });

  test('playbook.html: no clip #4 chip, nothing from the excluded list, no TJR screenshots', () => {
    ok(html.indexOf('52nxvJKM57U') < 0 && html.indexOf('P4.') < 0, 'funded accounts (#4) is context only');
    ok(html.indexOf('3GZgBBMzC_E') < 0, 'clip #16 is not used');
    ['promo', 'โค้ดส่วนลด', 'Alpha Futures', 'Tradeify', 'payout', 'funded', 'prop firm'].forEach((w) => ok(html.toLowerCase().indexOf(w.toLowerCase()) < 0, 'excluded: ' + w));
    ok(!/<img\b/i.test(html), 'no images: no TJR footage or screenshots');
  });

  test('playbook.html: the older-video note (C5) under the heading, the bias-before-sweep note (C6) at step 0, the BOS web box (C8)', () => {
    var head = html.slice(html.indexOf('id="procedure"'), html.indexOf('class="proc"'));
    ok(head.indexOf('class="older-note"') >= 0 && head.indexOf('คลิปเก่า (ม.ค. 2026) พูดว่า…') >= 0, 'older-note with its label');
    ok(head.indexOf('data-fact="P1.3"') >= 0 && head.indexOf('data-fact="P1.7"') >= 0, 'chips to P1.3 and P1.7');
    ok(head.indexOf('ts-chip--pl') >= 0 && head.indexOf('?t=62"') >= 0 && head.indexOf('?t=791"') >= 0, 'clip #1 links at 01:02 and 13:11');
    var s1 = stepBlock(1);
    ok(s1.indexOf('class="step__note"') >= 0 && s1.indexOf('bias ยังไม่ใช่ entry') >= 0, 'C6 note');
    ok(s1.indexOf('data-fact="F6.4"') >= 0, 'the C6 note chips the sweep rule F6.4');
    var s4 = stepBlock(4);
    ok(s4.indexOf('class="web-def"') >= 0 && s4.indexOf('นิยามทั่วไป ไม่ใช่จากคลิป') >= 0 && s4.indexOf('https://www.luxalgo.com/library/concept/break-of-structure/') >= 0, 'web definition with its URL');
    eq(html.split('class="web-def"').length - 1, 1, 'one web definition');
  });

  test('playbook.html: each step shows its Level 1 equivalent where one exists; stop-loss is an example, the rule stays a gap', () => {
    [1, 2, 3, 4, 5, 6, 7].forEach((k) => ok(stepBlock(k).indexOf('class="step__l1"') >= 0, 'step ' + k + ' has a Level 1 line'));
    ok(stepBlock(4).indexOf('H, L, HL, HH') >= 0 && stepBlock(4).indexOf('data-fact="F6.5"') >= 0, 'step 4: Level 1 H, L, HL, HH (F6.5)');
    var s7 = stepBlock(7);
    ok(s7.indexOf('data-fact="P1.50"') >= 0 && s7.indexOf('ตัวอย่าง stop-loss เดียวในคลิป') >= 0, 'the one stop-loss example (P1.50)');
    ok(s7.indexOf('กฎ stop-loss คลิปไม่ได้ระบุ') >= 0, 'the rule keeps its badge');
    ok(s7.indexOf('ตัวเลขจากเครื่องมือบนจอ ไม่ใช่ที่เขาพูด') >= 0, 'the 4.50 readout is labelled a readout');
    ok(stepBlock(8).indexOf('คลิปไม่ได้ระบุ') >= 0, 'max daily loss badge');
  });

  test('playbook.html: the bias worksheet: four yes/no questions over a 60m scenario, the answer, the sources', () => {
    var bw = html.slice(html.indexOf('class="bw"'), html.indexOf('</section>', html.indexOf('class="bw"')));
    eq((bw.match(/<fieldset class="bw__q"/g) || []).length, 4, 'four questions');
    for (var q = 1; q <= 4; q++) {
      ok(bw.indexOf('data-bq="' + q + '" data-bv="1"') >= 0 && bw.indexOf('data-bq="' + q + '" data-bv="0"') >= 0, 'question ' + q + ' has yes and no');
    }
    ['P3.3', 'P3.4', 'P3.5', 'P3.6', 'P3.21', 'P3.41', 'P10.29', 'P8.34'].forEach((id) => ok(bw.indexOf('data-fact="' + id + '"') >= 0, 'worksheet chip ' + id));
    ok(bw.indexOf('data-bw-sample="S19"') >= 0 && bw.indexOf('data-bw-sample="S18"') >= 0, 'S19 and a second sample S18');
    ok(bw.indexOf('S17') < 0, 'not S17 (15m)');
    ok(bw.indexOf('60m') >= 0 && bw.indexOf('data-k="bw-bias"') >= 0 && bw.indexOf('data-k="bw-draw"') >= 0 && bw.indexOf('aria-live="polite"') >= 0);
    ok(bw.indexOf('data-k="bw-gap"') >= 0 && bw.indexOf('คลิปไม่ได้ระบุ') >= 0, 'the verdicts the clip does not cover carry the badge');
    ok(P.BIAS_Q1.up.indexOf('60m') >= 0 && P.BIAS_Q1.down.indexOf('60m') >= 0);
    eq(TJR.scenarios.get('S19').tf, 60); eq(TJR.scenarios.get('S18').tf, 60);
  });

  test('playbook.html: the session tables, the New York windows (ET and Thailand), the live hooks', () => {
    P.ORDER.forEach((id) => ok(html.indexOf('data-row="' + id + '"') >= 0 && html.indexOf('data-k="et-' + id + '"') >= 0 && html.indexOf('data-k="th-' + id + '"') >= 0, 'session row ' + id));
    P.WIN_ORDER.forEach((id) => ok(html.indexOf('data-wrow="' + id + '"') >= 0 && html.indexOf('data-k="et-w-' + id + '"') >= 0 && html.indexOf('data-k="th-w-' + id + '"') >= 0, 'window row ' + id));
    ok(html.indexOf('data-k="ses-win"') >= 0 && html.indexOf('data-k="win"') >= 0, 'window table and the clock line');
    ['09:30–09:50', '09:50–10:10', '10:30', '13:00'].forEach((t) => ok(html.indexOf('>' + t + '<') >= 0, 'static fallback ' + t));
    ['P5.12', 'P5.13', 'P5.14', 'P5.15', 'P5.19'].forEach((id) => ok(html.indexOf('data-fact="' + id + '"') >= 0, id));
    ok(html.indexOf('data-fact="P5.5"') >= 0, 'C2: the older video says London ends 11:30');
  });

  test('playbook.html: "สิ่งที่คลิปไม่ได้บอก" is the spec section 7 list', () => {
    var g = html.slice(html.indexOf('class="gaps"'), html.indexOf('</ul>', html.indexOf('class="gaps"')));
    eq((g.match(/<li><span class="badge-gap">คลิปไม่ได้ระบุ<\/span>/g) || []).length, 13);
    ['กฎ stop-loss', 'สัดส่วนของสถานะที่ปิดที่แต่ละ TP', 'win rate และ R:R', 'ขาดทุนสูงสุดต่อวัน', 'จำนวนเทรดสูงสุดต่อวัน', 'จัดการเทรดที่ราคากลับตัวสวน',
      'ขนาดขั้นต่ำของ FVG', 'เลือก swing ล่าสุด', 'time frame ของ IFVG', 'stacked IFVG ฝั่งกลับด้าน', 'Gann box', 'SMT ย่อมาจากอะไร', 'advanced draws'
    ].forEach((t) => ok(g.indexOf(t) >= 0, 'gap: ' + t));
  });

  test('playbook.html: head, script order, GSAP tags, one stepping chart plus the worksheet chart', () => {
    ok(html.indexOf('<html lang="th"') >= 0 && html.indexOf('data-tone="dark"') >= 0);
    eq((html.match(/<h1[ >]/g) || []).length, 1);
    var order = ['ns', 'sources', 'store', 'rng', 'swings', 'gen', 'sessions', 'confluence', 'library', 'system', 'annotate', 'grade', 'scale', 'render', 'overlays', 'chart', 'layout', 'motion', 'pages/playbook'];
    var at = order.map((n) => html.indexOf('/' + n + '.js"'));
    at.forEach((i, j) => ok(i > 0, order[j] + ' loaded'));
    for (var i = 1; i < at.length; i++) ok(at[i] > at[i - 1], order[i] + ' after ' + order[i - 1]);
    ok(html.indexOf('gsap/3.12.5/gsap.min.js') > 0 && html.indexOf('gsap/3.12.5/ScrollTrigger.min.js') > 0);
    eq(html.split('class="chart-frame pf"').length - 1, 1, 'one chain chart on the page');
    eq(html.split('class="chart-frame bw__chart"').length - 1, 1, 'and the worksheet chart');
    ok(/id="clock"/.test(html) && /id="checklist"/.test(html) && /id="sessions"/.test(html) && /id="procedure"/.test(html) && /id="bias"/.test(html));
    ['S15', 'S16', 'S22'].forEach((id) => ok(html.indexOf('data-side="' + id + '"') >= 0, 'sample button ' + id));
  });
})();
