/* Course page (Task 10): the pure helpers of assets/js/pages/learn.js and the content rule on learn.html.
   learn.js is evaluated into this context (it has no DOM here, so it only attaches TJR.learn).
   Wrapped in an IIFE (one shared vm scope). */
(function () {
  'use strict';
  (0, eval)(readText('assets/js/pages/learn.js'));
  var L = TJR.learn;

  function c(o, h, l, cl) { return { t: 0, o: o, h: h, l: l, c: cl }; }

  test('learn.pairFor: bullish then bearish is a high at the highest wick of the pair', () => {
    var cs = [c(10, 12, 9, 11), c(11, 15, 10, 10.5), c(10.5, 11, 8, 9)];
    var p = L.pairFor(cs, 1, -1);                   // pair (0,1)
    eq(p.k, 0); eq(p.kind, 'high'); eq(p.at, 1); eq(p.price, 15); eq(p.dirs, ['up', 'down']);
    var q = L.pairFor(cs, 1, 1);                    // pair (1,2): bearish, bearish
    eq(q.k, 1); eq(q.kind, null); eq(q.price, null);
  });

  test('learn.pairFor: bearish then bullish is a low at the lowest wick; a doji pairs with nothing', () => {
    var cs = [c(11, 12, 7, 9), c(9, 13, 8, 12), c(12, 13, 11, 12)];
    var p = L.pairFor(cs, 0, 1);
    eq(p.kind, 'low'); eq(p.at, 0); eq(p.price, 7);
    var d = L.pairFor(cs, 2, -1);                   // (1,2): bullish then doji
    eq(d.kind, null); eq(d.dirs, ['up', 'flat']);
  });

  test('learn.pairFor: clamps to the series and agrees with TJR.swings.find on a built chart', () => {
    var b = TJR.scenarios.safeBuild(TJR.scenarios.get('S01'), 11, {}), cs = b.candles;
    eq(L.pairFor(cs, 0, -1).k, 0);
    eq(L.pairFor(cs, cs.length - 1, 1).k, cs.length - 2);
    var f = TJR.swings.find(cs), n = 0;
    f.highs.concat(f.lows).forEach(function (s) {
      var p = L.pairFor(cs, s.pair[0], 1);
      eq(p.price, s.price); eq(p.at, s.i); n++;
    });
    ok(n > 10, 'the chart has swings');
    var rule = 0;
    for (var k = 0; k + 1 < cs.length; k++) if (L.pairFor(cs, k, 1).kind) rule++;
    eq(rule, n, 'every pair the helper calls a swing is one find() reports');
    eq(L.pairList(cs).length, n);
  });

  test('learn.stepPair: next and previous pair of the list', () => {
    var list = [{ k: 2, kind: 'high' }, { k: 5, kind: 'low' }, { k: 9, kind: 'high' }];
    eq(L.stepPair(list, 2, 1).k, 5);
    eq(L.stepPair(list, 5, -1).k, 2);
    eq(L.stepPair(list, 9, 1), null);
    eq(L.stepPair(list, 0, -1), null);
    eq(L.stepPair(list, 3, 1).k, 5);
  });

  test('learn.drawdown: deepest low under the entry close up to a bar, in points', () => {
    var cs = [c(10, 11, 9, 10), c(10, 10.5, 8, 9), c(9, 9.5, 6.25, 7), c(7, 14, 7, 13)];
    eq(L.drawdown(cs, 0, 0), 0);                    // nothing after the entry bar yet
    eq(L.drawdown(cs, 0, 1), 2);                    // entry 10, low 8
    eq(L.drawdown(cs, 0, 2), 3.75);
    eq(L.drawdown(cs, 0, 3), 3.75);                 // the rally does not undo the depth
    eq(L.drawdown(cs, 3, 3), 0);
  });

  test('learn.quizState / countDone: a module is done when both answers are right', () => {
    eq(L.quizState([1, 2], [1, 2]).done, true);
    eq(L.quizState([1, 0], [1, 2]).right, [true, false]);
    eq(L.quizState([null, null], [0, 0]).done, false);
    eq(L.quizState(undefined, [0, 0]).done, false);
    eq(L.countDone({ m1: [0, 1], m2: [0, 0] }, { m1: [0, 1], m2: [0, 1], m3: [2, 2] }), 1);
  });

  test('learn.dstDates: US clocks move on the 2nd Sunday of March and the 1st Sunday of November', () => {
    var d = L.dstDates(TJR.sessions, 2026);
    eq(d.start, { y: 2026, mo: 3, d: 8 });
    eq(d.end, { y: 2026, mo: 11, d: 1 });
    var e = L.dstDates(TJR.sessions, 2027);
    eq(e.start, { y: 2027, mo: 3, d: 14 });
    eq(e.end, { y: 2027, mo: 11, d: 7 });
  });

  test('learn.sessionTable: ET windows from TJR.sessions, Thai text one hour apart across DST', () => {
    var T = L.sessionTable(TJR.sessions, 2026), by = {};
    T.rows.forEach(function (r) { by[r.id] = r; });
    eq(T.summerOffset, -4); eq(T.winterOffset, -5);
    eq(by.asia.et, '18:00–03:00');
    eq(by.london.et, '03:00–08:30');
    eq(by.ny.et, '09:30–17:00');
    eq(by.spread.et, '17:00–18:00');
    eq(by.ny.summer, '20:30 – 04:00 +1');             // 09:30 EDT = 13:30Z = 20:30 in Thailand
    eq(by.ny.winter, '21:30 – 05:00 +1');             // 09:30 EST = 14:30Z = 21:30
    eq(by.london.summer, '14:00 – 19:30');
    eq(by.london.winter, '15:00 – 20:30');
    eq(by.asia.summer, '05:00 +1 – 14:00 +1');
    eq(by.asia.winter, '06:00 +1 – 15:00 +1');
    T.rows.forEach(function (r) { ok(r.summer !== r.winter, r.id + ' differs between DST and standard time'); });
  });

  test('learn.simBuild: the two module-5 simulations take their stacked lows, then rally above them', () => {
    ['tariff', 'crash'].forEach(function (kind) {
      for (var seed = 1; seed <= 40; seed++) {
        var b = L.simBuild(kind, seed), cs = b.candles, ov = b.sim.overlays;
        eq(TJR.gen.validate(cs, 0.25), []);
        var levels = ov.filter(function (o) { return o.type === 'level'; });
        ok(levels.length >= 2, kind + ' has a stack');
        levels.forEach(function (l) {
          ok(l.to > l.from, kind + ' ' + seed + ': level taken after it formed');
          ok(cs[l.to].l < l.price, kind + ' ' + seed + ': taken by a wick');
        });
        var top = Math.max.apply(null, levels.map(function (l) { return l.price; }));
        ok(cs[cs.length - 1].c > top, kind + ' ' + seed + ': ends above the stack');
        eq(b.sim.sweep, Math.min.apply(null, levels.map(function (l) { return l.to; })));
      }
    });
  });

  test('learn.html: every ts-chip ?t= equals its MM:SS label in seconds, and the 8 module ids exist', () => {
    var html = readText('learn.html');
    var re = /<a\b[^>]*\bclass="ts-chip"[^>]*>([^<]*)<\/a>/g, m, n = 0;
    while ((m = re.exec(html))) {
      var label = m[1].trim(), lm = /^(\d{2}):(\d{2})$/.exec(label);
      ok(lm, 'chip label is MM:SS: ' + label);
      var href = /href="([^"]*)"/.exec(m[0]);
      ok(href, 'chip has an href: ' + label);
      var tm = /^https:\/\/youtu\.be\/Vulini8xbB0\?t=(\d+)$/.exec(href[1]);
      ok(tm, 'chip href is the clip with ?t=: ' + label);
      eq(Number(tm[1]), Number(lm[1]) * 60 + Number(lm[2]), 'chip ' + label);
      n++;
    }
    ok(n > 40, 'learn.html has its chips');
    for (var i = 1; i <= 8; i++) ok(html.indexOf('id="m' + i + '"') > 0, 'section m' + i);
    // every self-check has two questions with a right answer inside its options
    var boxes = html.split('class="check"').slice(1);
    eq(boxes.length, 8);
    boxes.forEach(function (b) {
      var qs = b.split('class="q"').slice(1, 3);
      eq(qs.length, 2);
      qs.forEach(function (q) {
        var r = /data-right="(\d+)"/.exec(q), opts = q.split('class="opt"').length - 1;
        ok(r && Number(r[1]) < opts, 'right answer is one of the options');
      });
    });
  });

  // v2 Task 5: Level-1 additions from the playlist (candle anatomy, previous-day / data / equal / stacked draws)
  test('learn.html: v2 additions carry playlist chips of the right videos (#12, #14, #5), never clip #4', () => {
    var html = readText('learn.html');
    var pl = html.match(/<a\b[^>]*\bclass="ts-chip ts-chip--pl"[^>]*>[^<]*<\/a>/g) || [];
    ok(pl.length >= 14, 'playlist chips present: ' + pl.length);
    var by = {};
    pl.forEach(function (a) {
      var href = /href="https:\/\/youtu\.be\/([\w-]+)\?t=(\d+)"/.exec(a);
      ok(href, 'playlist chip links a video: ' + a);
      by[href[1]] = (by[href[1]] || 0) + 1;
      var src = TJR.sources.list.filter(function (s) { return s.id === href[1]; })[0];
      ok(src && !src.main, 'a playlist chip, not the main clip: ' + href[1]);
      ok(src.clip !== 4, 'clip #4 is never chipped');
      // the static markup is exactly what TJR.layout.chip emits for that clip and second
      eq(a, TJR.layout.chip(Number(href[2]), src.clip), 'chip markup ' + href[1] + ' t=' + href[2]);
    });
    ['AGmAVyAuBE0', '8qwEmE1DwYw', 'L4xz2o23aPQ'].forEach(function (id) { ok(by[id] >= 1, 'a chip to ' + id); });
    ok(by.AGmAVyAuBE0 >= 8, 'ch. 7 and 8 draws cite #12');
    ok(by['8qwEmE1DwYw'] >= 5, 'ch. 2 candle anatomy cites #14');
    ok(!/52nxvJKM57U/.test(html), 'no link to clip #4');
  });

  test('learn.html: the C2 older note says London to 11:30 (clip #5) inside .older-note; main keeps 11:00', () => {
    var html = readText('learn.html');
    var m = /<aside class="older-note">[\s\S]*?<\/aside>/.exec(html);
    ok(m, 'an .older-note box');
    ok(m[0].indexOf('11:30') > 0, 'the note mentions 11:30');
    ok(m[0].indexOf('คลิปเก่า (ม.ค. 2026) พูดว่า…') > 0, 'the older-video label');
    ok(m[0].indexOf('youtu.be/L4xz2o23aPQ?t=69') > 0 && m[0].indexOf('#5 01:09') > 0, 'chip #5 01:09');
    eq(html.split('class="older-note"').length - 1, 1, 'one older note');
    ok(html.indexOf('ปิดทางการ 11:00') > 0, 'main clip 11:00 stays');
  });

  test('learn.html: marked step 1 and points on to the next steps; the 8 modules and 8 self-checks stay', () => {
    var html = readText('learn.html');
    ok(html.indexOf(TJR.layout.stepMarkerHTML('learn')) > 0, 'step marker');
    ok(html.indexOf('ต่อในขั้น 2') > 0, 'the next-steps heading');
    var tail = html.slice(html.indexOf('id="limits"'));
    ok(tail.indexOf('href="confluences.html"') > 0 && tail.indexOf('href="playbook.html"') > 0, 'links to both next-step pages');
    ok(tail.indexOf('market structure break') > 0 && tail.indexOf('fair value gap') > 0 && tail.indexOf('inverse fair value gap') > 0, 'F9.1 list');
    ok(tail.indexOf('youtu.be/Vulini8xbB0?t=2880') > 0, 'F9.1 chip 48:00');
    ok(html.indexOf('ที่คลิปนี้ไม่ได้สอน') < 0, 'the old closing block is gone');
    eq(html.split('class="check"').length - 1, 8);
    eq((html.match(/class="q" data-right/g) || []).length, 16);
  });

  test('learn.html: the new draws are in their chapters (ch. 2 anatomy, ch. 7 previous-day/data/older, ch. 8 equal/stacked)', () => {
    var html = readText('learn.html');
    function sec(n) { var a = html.indexOf('id="m' + n + '" data-m'); var b = html.indexOf('id="m' + (n + 1) + '" data-m'); return html.slice(a, b > 0 ? b : html.indexOf('id="limits"')); }
    var m2 = sec(2), m7 = sec(7), m8 = sec(8);
    ok(m2.indexOf('OHLC') > 0 && m2.indexOf('wick') > 0, 'm2 candle anatomy');
    ok(m2.indexOf('4 ชั่วโมง') > 0 || m2.indexOf('4h') > 0, 'm2 4h = four 1h');
    ok(m2.indexOf('เวลา New York') > 0 || m2.indexOf('New York (ET)') > 0, 'm2 chart in NY time');
    ok(m7.indexOf('previous-day') > 0, 'm7 previous-day high/low');
    ok(m7.indexOf('Forex Factory') > 0 && m7.indexOf('red folder') > 0, 'm7 data highs/lows with Forex Factory');
    ok(m7.indexOf('older-note') > 0, 'm7 holds the C2 note');
    ok(m8.indexOf('equal') > 0 && m8.indexOf('สี่') > 0, 'm8 relative equal = four sets');
    ok(m8.indexOf('จุดเข้าและจุดออก') > 0, 'm8 stacked levels as entry and exit');
    ok(m8.indexOf('คลิปไม่ได้ระบุ') > 0, 'm8 keeps its gap badge');
  });

  // T10: the right answer is not parked on one index (a guessable pattern in a self-check)
  test('learn.html: the right answers are spread over the options (no index above half, no run of three)', () => {
    var rights = (readText('learn.html').match(/class="q" data-right="([0-9])"/g) || []).map((m) => Number(m.slice(-2, -1)));
    eq(rights.length, 16);
    [0, 1, 2].forEach((i) => ok(rights.filter((r) => r === i).length <= 8, 'index ' + i + ' used ' + rights.filter((r) => r === i).length + ' times'));
    [0, 1, 2].forEach((i) => ok(rights.filter((r) => r === i).length >= 3, 'index ' + i + ' is used at least 3 times'));
    for (var k = 2; k < rights.length; k++) ok(!(rights[k] === rights[k - 1] && rights[k] === rights[k - 2]), 'three equal in a row at ' + k);
  });
})();
