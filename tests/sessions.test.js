// Sessions and time: ET (DST) / Thailand clock, session windows (clip F7.7).
// Wrapped in an IIFE: test files share one vm global scope.
(() => {
  const S = TJR.sessions;
  const utc = (y, mo, d, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h, mi) / 1000;
  // 2026 summer (EDT = UTC-4): Wed 07-01, Fri 07-03, Sat 07-04, Sun 07-05, Tue 07-07
  const HOUR = 3600;

  test('sessions: the brief anchor 2026-07-01 13:30Z -> 09:30 ET, 20:30 Thailand, ny', () => {
    const t = utc(2026, 7, 1, 13, 30);
    eq(S.fmtET(t), '09:30');
    eq(S.fmtThai(t), '20:30');
    eq(S.which(t), 'ny');
    eq(S.etOffsetHours(t), -4);
  });

  test('sessions: winter 2026-01-15 14:30Z -> 09:30 ET (offset -5), Thailand 21:30', () => {
    const t = utc(2026, 1, 15, 14, 30);
    eq(S.fmtET(t), '09:30');
    eq(S.fmtThai(t), '21:30');
    eq(S.etOffsetHours(t), -5);
    eq(S.which(t), 'ny');
  });

  test('sessions: DST starts 2026-03-08 (2nd Sunday): 06:59Z is -5, 07:00Z is -4', () => {
    const a = utc(2026, 3, 8, 6, 59), b = utc(2026, 3, 8, 7, 0);
    eq(S.etOffsetHours(a), -5);
    eq(S.etOffsetHours(b), -4);
    eq(S.fmtET(a), '01:59');
    eq(S.fmtET(b), '03:00');
    eq(S.etOffsetHours(utc(2026, 3, 1, 12)), -5, 'first Sunday of March is still standard time');
    eq(S.etOffsetHours(utc(2026, 3, 15, 12)), -4);
  });

  test('sessions: DST ends 2026-11-01 (1st Sunday): 05:59Z is -4, 06:00Z is -5', () => {
    const a = utc(2026, 11, 1, 5, 59), b = utc(2026, 11, 1, 6, 0);
    eq(S.etOffsetHours(a), -4);
    eq(S.etOffsetHours(b), -5);
    eq(S.fmtET(a), '01:59');
    eq(S.fmtET(b), '01:00', 'the 01:00 hour repeats');
    eq(S.etOffsetHours(utc(2026, 10, 31, 12)), -4);
    eq(S.etOffsetHours(utc(2026, 11, 8, 12)), -5);
  });

  test('sessions: DST switches in other years (2025: Mar 9 / Nov 2, 2027: Mar 14 / Nov 7)', () => {
    eq([S.etOffsetHours(utc(2025, 3, 9, 6, 59)), S.etOffsetHours(utc(2025, 3, 9, 7, 0))], [-5, -4]);
    eq([S.etOffsetHours(utc(2025, 11, 2, 5, 59)), S.etOffsetHours(utc(2025, 11, 2, 6, 0))], [-4, -5]);
    eq([S.etOffsetHours(utc(2027, 3, 14, 6, 59)), S.etOffsetHours(utc(2027, 3, 14, 7, 0))], [-5, -4]);
    eq([S.etOffsetHours(utc(2027, 11, 7, 5, 59)), S.etOffsetHours(utc(2027, 11, 7, 6, 0))], [-4, -5]);
  });

  test('sessions: toET agrees with Intl America/New_York every half hour of 2026', () => {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
    });
    let n = 0;
    for (let t = utc(2026, 1, 1); t < utc(2027, 1, 1); t += 1800) {
      const p = {};
      fmt.formatToParts(new Date(t * 1000)).forEach((x) => { p[x.type] = +x.value; });
      const e = S.toET(t);
      if (e.y !== p.year || e.mo !== p.month || e.d !== p.day || e.h !== p.hour || e.mi !== p.minute) {
        throw new Error('toET mismatch at ' + new Date(t * 1000).toISOString() + ': ' + JSON.stringify(e) + ' vs ' + JSON.stringify(p));
      }
      n++;
    }
    ok(n > 17000, "samples " + n);
  });

  test('sessions: toET gives y/mo/d/h/mi/dow (0 = Sunday), crossing midnight into the ET date', () => {
    eq(S.toET(utc(2026, 7, 1, 13, 30)), { y: 2026, mo: 7, d: 1, h: 9, mi: 30, dow: 3 });
    eq(S.toET(utc(2026, 7, 2, 1, 5)), { y: 2026, mo: 7, d: 1, h: 21, mi: 5, dow: 3 });
    eq(S.toET(utc(2026, 7, 5, 12, 0)).dow, 0);
  });

  test('sessions: fmtET/fmtThai zero-pad and fmtThai crosses midnight (UTC+7, no DST)', () => {
    eq(S.fmtET(utc(2026, 7, 1, 12, 5)), '08:05');
    eq(S.fmtThai(utc(2026, 7, 1, 20, 0)), '03:00');
    eq(S.fmtThai(utc(2026, 7, 1, 17, 0)), '00:00');
    eq(S.fmtThai(utc(2026, 1, 1, 17, 0)), '00:00', 'same offset in winter');
  });

  test('sessions: which() on a summer Tuesday walks every window', () => {
    // Tue 2026-07-07, ET = UTC-4
    eq(S.which(utc(2026, 7, 7, 22, 30)), 'asia', '18:30 ET');
    eq(S.which(utc(2026, 7, 7, 22, 0)), 'asia', '18:00 ET is the open');
    eq(S.which(utc(2026, 7, 7, 21, 59)), 'spread', '17:59 ET');
    eq(S.which(utc(2026, 7, 7, 21, 30)), 'spread', '17:30 ET');
    eq(S.which(utc(2026, 7, 7, 21, 0)), 'spread', '17:00 ET starts the spread hour');
    eq(S.which(utc(2026, 7, 7, 20, 59)), 'ny', '16:59 ET');
    eq(S.which(utc(2026, 7, 7, 13, 30)), 'ny', '09:30 ET');
    eq(S.which(utc(2026, 7, 7, 13, 29)), 'ny-pre', '09:29 ET');
    eq(S.which(utc(2026, 7, 7, 12, 30)), 'ny-pre', '08:30 ET');
    eq(S.which(utc(2026, 7, 7, 12, 29)), 'london', '08:29 ET');
    eq(S.which(utc(2026, 7, 7, 7, 0)), 'london', '03:00 ET');
    eq(S.which(utc(2026, 7, 7, 6, 59)), 'asia', '02:59 ET');
    eq(S.which(utc(2026, 7, 7, 4, 0)), 'asia', '00:00 ET');
  });

  test('sessions: which() reads ET, not UTC, in winter too (offset -5)', () => {
    eq(S.which(utc(2026, 1, 13, 23, 0)), 'asia', '18:00 EST Tue');
    eq(S.which(utc(2026, 1, 13, 22, 30)), 'spread', '17:30 EST');
    eq(S.which(utc(2026, 1, 13, 14, 30)), 'ny', '09:30 EST');
    eq(S.which(utc(2026, 1, 13, 8, 0)), 'london', '03:00 EST');
  });

  test('sessions: which() weekend = Fri 17:00 -> Sun 18:00 ET (market hours, not a system rule)', () => {
    eq(S.which(utc(2026, 7, 3, 20, 59)), 'ny', 'Fri 16:59 ET');
    eq(S.which(utc(2026, 7, 3, 21, 0)), 'weekend', 'Fri 17:00 ET: no spread hour, the market is shut');
    eq(S.which(utc(2026, 7, 3, 23, 0)), 'weekend', 'Fri 19:00 ET');
    eq(S.which(utc(2026, 7, 4, 15, 0)), 'weekend', 'Saturday');
    eq(S.which(utc(2026, 7, 4, 0, 0)), 'weekend', 'Fri 20:00 ET');
    eq(S.which(utc(2026, 7, 5, 1, 0)), 'weekend', 'Sat 21:00 ET');
    eq(S.which(utc(2026, 7, 5, 21, 59)), 'weekend', 'Sun 17:59 ET');
    eq(S.which(utc(2026, 7, 5, 22, 0)), 'asia', 'Sun 18:00 ET: the week opens');
    eq(S.which(utc(2026, 7, 6, 0, 0)), 'asia', 'Sun 20:00 ET');
    eq(S.which(utc(2026, 7, 6, 8, 0)), 'london', 'Mon 04:00 ET');
  });

  test('sessions: weekend edges hold on the DST switch weekends', () => {
    // Sun Mar 8 2026: clocks jump at 02:00, still weekend until 18:00 EDT = 22:00Z
    eq(S.which(utc(2026, 3, 8, 21, 59)), 'weekend');
    eq(S.which(utc(2026, 3, 8, 22, 0)), 'asia');
    // Sun Nov 1 2026: 18:00 EST = 23:00Z
    eq(S.which(utc(2026, 11, 1, 22, 59)), 'weekend');
    eq(S.which(utc(2026, 11, 1, 23, 0)), 'asia');
    // Fri Nov 6 2026: 17:00 EST = 22:00Z
    eq(S.which(utc(2026, 11, 6, 21, 59)), 'ny');
    eq(S.which(utc(2026, 11, 6, 22, 0)), 'weekend');
  });

  test('sessions: etToUtc inverts toET (summer, winter, midnight, year edge, DST edges)', () => {
    eq(S.etToUtc(2026, 7, 1, 9, 30), utc(2026, 7, 1, 13, 30));
    eq(S.etToUtc(2026, 1, 15, 9, 30), utc(2026, 1, 15, 14, 30));
    eq(S.etToUtc(2026, 7, 7, 18, 0), utc(2026, 7, 7, 22, 0));
    eq(S.etToUtc(2026, 12, 31, 20, 0), utc(2027, 1, 1, 1, 0));
    eq(S.etToUtc(2026, 3, 8, 3, 0), utc(2026, 3, 8, 7, 0), 'first wall minute after the spring jump');
    eq(S.etToUtc(2026, 3, 8, 1, 59), utc(2026, 3, 8, 6, 59));
    eq(S.etToUtc(2026, 11, 1, 0, 30), utc(2026, 11, 1, 4, 30));
    eq(S.etToUtc(2026, 11, 1, 2, 0), utc(2026, 11, 1, 7, 0));
    for (let t = utc(2026, 1, 1); t < utc(2027, 1, 1); t += HOUR * 5 + 1800) {
      const e = S.toET(t);
      const back = S.etToUtc(e.y, e.mo, e.d, e.h, e.mi);
      // only the repeated fall-back hour (01:xx on Nov 1) may resolve to the earlier of its two instants
      ok(back === t || (e.mo === 11 && e.d === 1 && e.h === 1 && t - back === HOUR), 'round trip at ' + t);
    }
  });

  test('sessions: etToUtc picks the earlier instant of the repeated hour; a wall time in the spring gap moves forward', () => {
    eq(S.etToUtc(2026, 11, 1, 1, 30), utc(2026, 11, 1, 5, 30), 'EDT reading of the repeated 01:30');
    eq(S.fmtET(S.etToUtc(2026, 3, 8, 2, 30)), '03:30', '02:30 does not exist; nudged forward one hour');
  });

  test('sessions: nextNyOpen is the next weekday 09:30 ET, strictly after the input', () => {
    // Wed 2026-07-01 before open -> same day
    eq(S.nextNyOpen(utc(2026, 7, 1, 12, 0)), utc(2026, 7, 1, 13, 30));
    // exactly at the open -> the following day
    eq(S.nextNyOpen(utc(2026, 7, 1, 13, 30)), utc(2026, 7, 2, 13, 30));
    // after the open -> next day
    eq(S.nextNyOpen(utc(2026, 7, 1, 20, 0)), utc(2026, 7, 2, 13, 30));
    // Fri after the open -> Monday
    eq(S.nextNyOpen(utc(2026, 7, 3, 15, 0)), utc(2026, 7, 6, 13, 30));
    // Saturday, Sunday -> Monday
    eq(S.nextNyOpen(utc(2026, 7, 4, 15, 0)), utc(2026, 7, 6, 13, 30));
    eq(S.nextNyOpen(utc(2026, 7, 5, 23, 0)), utc(2026, 7, 6, 13, 30));
    // Thu 22:00 ET is already Friday in UTC -> Friday open
    eq(S.nextNyOpen(utc(2026, 7, 3, 2, 0)), utc(2026, 7, 3, 13, 30));
    // winter, and across the DST switches
    eq(S.nextNyOpen(utc(2026, 1, 15, 15, 0)), utc(2026, 1, 16, 14, 30));
    eq(S.nextNyOpen(utc(2026, 3, 6, 22, 0)), utc(2026, 3, 9, 13, 30));
    eq(S.nextNyOpen(utc(2026, 10, 30, 22, 0)), utc(2026, 11, 2, 14, 30));
    eq(S.fmtET(S.nextNyOpen(utc(2026, 7, 1, 12, 0))), '09:30');
  });

  test('sessions: WINDOWS holds the clip times (F7.7) as minutes after ET midnight', () => {
    eq(S.WINDOWS.asia, { from: 18 * 60, to: 3 * 60 });
    eq(S.WINDOWS.london, { from: 3 * 60, to: 8 * 60 + 30 });
    eq(S.WINDOWS['ny-pre'], { from: 8 * 60 + 30, to: 9 * 60 + 30 });
    eq(S.WINDOWS.ny, { from: 9 * 60 + 30, to: 17 * 60 });
    eq(S.WINDOWS.spread, { from: 17 * 60, to: 18 * 60 });
    eq(Object.keys(S.WINDOWS).sort(), ['asia', 'london', 'ny', 'ny-pre', 'spread']);
  });
})();
