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

  test('playbook.parseState: unknown ids and damaged values are dropped', () => {
    var s = P.parseState(['c-ny', 'c-sl', 'nope', 7, null, '__proto__', 'c-ny'], { sl: ' 1R ', size: 5, risk: 'x'.repeat(500), extra: 'y' });
    eq(Object.keys(s.checks).sort(), ['c-ny', 'c-sl']);
    eq(s.rules.sl, '1R');
    eq(s.rules.size, '');
    eq(s.rules.risk.length, 160);
    eq(Object.keys(s.rules).sort(), ['risk', 'size', 'sl']);
    eq(P.parseState('x', 'y'), P.emptyState());
    eq(P.parseState(undefined, [1, 2]), P.emptyState());
    eq(P.parseState({ 0: 'c-ny' }, null), P.emptyState());
  });

  test('playbook.setCheck / resetChecks / clearRules / setRule: immutable, reset keeps the rules', () => {
    var s0 = P.emptyState(), s1 = P.setCheck(s0, 'c-ny', true), s2 = P.setRule(s1, 'sl', '  ใต้ low ของ sweep \n');
    eq(P.progress(s0).done, 0, 'the first state is untouched');
    eq(s1.checks['c-ny'], true);
    eq(s2.rules.sl, 'ใต้ low ของ sweep');
    eq(P.setCheck(s2, 'bogus', true), s2, 'unknown id ignored');
    eq(P.setRule(s2, 'bogus', 'x'), s2, 'unknown rule key ignored');
    var s3 = P.resetChecks(P.setCheck(s2, 'c-asia-london', true));
    eq(P.progress(s3).done, 0);
    eq(s3.rules.sl, 'ใต้ low ของ sweep', 'a new trade keeps the user\'s rules');
    eq(P.clearRules(s2).rules, { sl: '', size: '', risk: '' });
    eq(P.setCheck(s2, 'c-ny', false).checks, {});
  });

  test('playbook.progress / serialize: ticked ids come out in list order', () => {
    var s = P.emptyState();
    ['c-risk', 'c-asia-london', 'c-sweep'].forEach((id) => { s = P.setCheck(s, id, true); });
    eq(P.serialize(s).checks, ['c-asia-london', 'c-sweep', 'c-risk']);
    eq(P.progress(s), { done: 3, total: 11, pct: 27 });
    P.CHECK_IDS.forEach((id) => { s = P.setCheck(s, id, true); });
    eq(P.progress(s), { done: 11, total: 11, pct: 100 });
    eq(P.progress(P.emptyState()).pct, 0);
  });

  test('playbook.asText: ticked rows, the user\'s own rules, the source line', () => {
    var s = P.setRule(P.setCheck(P.emptyState(), 'c-ny', true), 'sl', 'ใต้ low');
    var labels = { 'c-ny': 'ช่วง NY open', 'c-sl': 'กำหนด stop-loss แล้ว' };
    var t = P.asText(s, labels).split('\n');
    eq(t[1], 'ติ๊กแล้ว 1 / 11');
    ok(t.indexOf('[x] ช่วง NY open') >= 0);
    ok(t.indexOf('[ ] กำหนด stop-loss แล้ว') >= 0);
    ok(t.indexOf('    กฎของฉัน (stop-loss): ใต้ low') >= 0);
    ok(t.indexOf('    กฎของฉัน (ขนาดสถานะ): (ยังไม่ได้เขียน)') >= 0);
    eq(t[t.length - 1], 'ที่มา: https://youtu.be/Vulini8xbB0');
    eq(t.length, 2 + 11 + 3 + 1);
  });

  test('playbook storage: keys tjr.playbook.*, round trip, and a blocked localStorage falls back to memory', () => {
    var s = P.setRule(P.setCheck(P.setCheck(P.emptyState(), 'c-htf', true), 'c-target', true), 'risk', 'ตามแผนของฉัน');
    P.saveChecks(s); P.saveRules(s);
    eq(TJR.store.get('playbook.checks'), ['c-htf', 'c-target']);
    eq(TJR.store.get('playbook.rules'), { sl: '', size: '', risk: 'ตามแผนของฉัน' });
    eq(P.KEY_CHECKS, 'playbook.checks');
    eq(P.loadState(), s);
    var mem = {};
    var fake = { get: (k, d) => (k in mem ? mem[k] : d), set: (k, v) => { mem[k] = v; } };
    P.saveChecks(s, fake); P.saveRules(s, fake);
    eq(P.loadState(fake), s);
    // storage that throws on every access (private window, sandboxed frame)
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
    try {
      var s2 = P.setCheck(P.emptyState(), 'c-ny', true);
      P.saveChecks(s2); P.saveRules(P.setRule(s2, 'sl', 'x'));
      eq(P.loadState().checks['c-ny'], true, 'memory copy answers');
      eq(P.loadState().rules.sl, 'x');
    } finally { delete globalThis.localStorage; }
    TJR.store.remove('playbook.checks'); TJR.store.remove('playbook.rules');
    eq(P.loadState(), P.emptyState());
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

  // ---------------------------------------------------------------- the chart's step frames
  [['S01', 'long'], ['S03', 'short']].forEach((pair) => {
    test('playbook.stepFrames ' + pair[0] + ': 7 frames, knowable-only overlays, 12 seeds', () => {
      for (var seed = 1; seed <= 12; seed++) {
        var b = TJR.scenarios.safeBuild(TJR.scenarios.get(pair[0]), seed, {}), T = b.truth, last = b.candles.length - 1;
        eq(T.side, pair[1]);
        var f = P.stepFrames(b);
        eq(f.length, 7);
        f.forEach((fr, i) => {
          eq(fr.step, i + 1);
          ok(fr.bar >= 0 && fr.bar <= last, 'bar in range');
          if (i) ok(fr.bar >= f[i - 1].bar, 'frames never go back in time');
          P.overlaysFor(b, fr).forEach((o) => ok(o.appearAt <= fr.bar, pair[0] + ' seed ' + seed + ' step ' + (i + 1) + ': ' + o.id + ' knowable'));
        });
        ok(f[0].bar < T.sweep.bar, 'levels are marked before the sweep');
        eq(f[1].bar, f[0].bar, 'step 2 is about time: same frame as step 1');
        eq(f[2].bar, T.sweep.bar);
        ok(f[3].bar >= T.confirmBar, 'structure step reaches the confirming swing');
        ok(f[4].bar >= T.entryWindow.from && f[4].bar <= T.entryWindow.to + 1, 'entry step sits in the window');
        var ids = (k) => P.overlaysFor(b, f[k - 1]).map((o) => o.id);
        ok(ids(1).indexOf('sweep') < 0 && ids(2).indexOf('sweep') < 0, 'no sweep marker before step 3');
        ok(ids(3).indexOf('sweep') >= 0);
        ok(ids(3).indexOf('entry') < 0 && ids(4).indexOf('entry') < 0, 'no entry zone before step 5');
        ok(ids(5).indexOf('entry') >= 0);
        ok(ids(5).indexOf('target') < 0, 'target overlay waits for step 6');
        ok(ids(6).indexOf('target') >= 0 && ids(7).indexOf('target') >= 0);
        ok(ids(4).some((x) => x.indexOf('lbl:') === 0), 'structure labels by step 4');
        var conf = 'lbl:' + T.confirmBar;
        ok(ids(4).indexOf(conf) >= 0, 'the HH / LL label is up at step 4');
        f[0].focus.forEach((id) => ok(T.levels.some((l) => l.id === id), 'step 1 focus names a level'));
      }
    });
  });

  test('playbook.nowText: seven different lines, the side changes what step 1 and 4 say, gap steps are 5 and 7', () => {
    var long = [1, 2, 3, 4, 5, 6, 7].map((k) => P.nowText(k, { side: 'long', stacks: 3 }));
    var short = [1, 2, 3, 4, 5, 6, 7].map((k) => P.nowText(k, { side: 'short', stacks: 2 }));
    eq(new Set(long).size, 7);
    ok(long[0].indexOf('stacked lows 3 จุด') >= 0); ok(short[0].indexOf('stacked highs 2 จุด') >= 0);
    ok(long[3].indexOf('HH') >= 0); ok(short[3].indexOf('LL') >= 0);
    eq(long[1], short[1]);
    eq(Object.keys(P.STEP_GAP).map(Number), [5, 7]);
    ok(P.nowText(99, null).length > 0 && P.nowText(-3, null).length > 0, 'out-of-range steps clamp');
  });

  // ---------------------------------------------------------------- playbook.html: the content rule and the hooks
  var html = readText('playbook.html');

  test('playbook.html: every checklist id has one checkbox, the three own-rule fields and the gap badge', () => {
    P.CHECK_IDS.forEach((id) => eq(html.split('data-id="' + id + '"').length - 1, 1, id));
    eq(html.split('class="m-check"').length - 1, P.CHECK_IDS.length);
    P.RULE_KEYS.forEach((k) => {
      eq(html.split('data-rule="' + k + '"').length - 1, 1, k);
      ok(html.indexOf('id="rule-' + k + '"') >= 0 && html.indexOf('for="rule-' + k + '"') >= 0, 'field ' + k + ' has a visible label');
    });
    eq((html.match(/maxlength="160"/g) || []).length, 3);
    // the SL / size / risk rows each carry the badge before the field
    ['c-sl', 'c-size', 'c-risk'].forEach((id) => {
      var row = html.slice(html.indexOf('data-id="' + id + '"'));
      row = row.slice(0, row.indexOf('</li>'));
      ok(row.indexOf('badge-gap') >= 0 && row.indexOf('คลิปไม่ได้ระบุ') >= 0, id + ' shows the gap badge');
      ok(row.indexOf('กฎ') >= 0 && row.indexOf('ของคุณเอง') >= 0, id + ' has the user\'s own rule field');
    });
  });

  test('playbook.html: 7 steps in order, each with a view button and a module or scenario link', () => {
    for (var k = 1; k <= 7; k++) {
      ok(html.indexOf('data-step="' + k + '" id="step-' + k + '"') >= 0, 'step ' + k);
      eq(html.split('data-act="view" data-step="' + k + '"').length - 1, 1);
    }
    ok(/learn\.html#m7/.test(html) && /learn\.html#m8/.test(html) && /learn\.html#m6/.test(html) && /scenarios\.html#S01/.test(html) && /scenarios\.html#S03/.test(html));
    var ids = (html.match(/(?:learn\.html#m|scenarios\.html#S)\d+/g) || []);
    ids.forEach((h) => { var n = Number(h.replace(/\D/g, '')); ok(h.indexOf('learn') === 0 ? n >= 1 && n <= 8 : n >= 1 && n <= 14, h); });
    var learn = readText('learn.html');
    for (var m = 1; m <= 8; m++) ok(learn.indexOf('id="m' + m + '"') >= 0);
  });

  test('playbook.html: every clip chip is the start second of a fact in clip-facts.md, and chips link the clip', () => {
    var starts = {};
    readText('docs/source/clip-facts.md').split('\n').forEach((l) => {
      var m = /^- F\d+\.\d+ .*\((\d\d):(\d\d)[^)]*\)\s*$/.exec(l);
      if (m) starts[Number(m[1]) * 60 + Number(m[2])] = true;
    });
    var chips = html.match(/href="https:\/\/youtu\.be\/Vulini8xbB0\?t=\d+"/g) || [];
    ok(chips.length >= 30, 'chips present: ' + chips.length);
    chips.forEach((c) => { var s = Number(/t=(\d+)/.exec(c)[1]); ok(starts[s], 'second ' + s + ' starts a fact'); });
    ok(html.indexOf('คลิปไม่ได้ระบุ') >= 0);
  });

  test('playbook.html: head, script order, GSAP tags and one live chart slot', () => {
    ok(html.indexOf('<html lang="th"') >= 0 && html.indexOf('data-tone="dark"') >= 0);
    eq((html.match(/<h1[ >]/g) || []).length, 1);
    var order = ['ns', 'store', 'rng', 'swings', 'gen', 'sessions', 'library', 'annotate', 'grade', 'scale', 'render', 'overlays', 'chart', 'layout', 'motion', 'pages/playbook'];
    var at = order.map((n) => html.indexOf('/' + n + '.js"'));
    at.forEach((i, j) => ok(i > 0, order[j] + ' loaded'));
    for (var i = 1; i < at.length; i++) ok(at[i] > at[i - 1], order[i] + ' after ' + order[i - 1]);
    ok(html.indexOf('gsap/3.12.5/gsap.min.js') > 0 && html.indexOf('gsap/3.12.5/ScrollTrigger.min.js') > 0);
    eq(html.split('class="chart-frame pf"').length - 1, 1, 'one chart on the page');
    ok(/id="clock"/.test(html) && /id="checklist"/.test(html) && /id="sessions"/.test(html) && /id="procedure"/.test(html));
  });
})();
