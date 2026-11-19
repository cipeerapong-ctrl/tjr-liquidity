/* v2 Task 1: TJR.sources (video table, fact id -> video, chip href), multi-clip chips, the olderNote and
   webDef boxes, and an audit over every root *.html: a chip never points at a missing video, past the
   end of a video, or (a playlist chip) at the main clip. Wrapped in an IIFE (one shared vm scope). */
(function () {
  'use strict';

  const MAIN = 'Vulini8xbB0';
  const TABLE = [
    [0, 'Vulini8xbB0', 2947], [1, 'TEp3a-7GUds', 2591], [2, 'hBnD6T1M4w8', 1117], [3, 'ironJFzNBic', 1856],
    [4, '52nxvJKM57U', 1177], [5, 'L4xz2o23aPQ', 661], [6, '7dTQA0t8SH0', 964], [7, 'joe_XTCn5Bs', 864],
    [8, '4sRDnVmLcMk', 1351], [9, 'PlsHO33j6B8', 1384], [10, 'xX5LTSJ5wwM', 2023], [11, 'Zzk864cVJek', 743],
    [12, 'AGmAVyAuBE0', 3224], [13, 'crMqxB_nHhk', 2139], [14, '8qwEmE1DwYw', 2474], [15, 'R62RnJrKH3Q', 1351],
    [16, '3GZgBBMzC_E', 2396],
  ];
  const PLAYLIST_URL = 'https://www.youtube.com/playlist?list=PLKE_22Jx497s5Q6ZX2pfDcDwCm_IyxR7e';

  function count(hay, needle) { return hay.split(needle).length - 1; }
  function mmss(n) { return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); }

  // ---------------------------------------------------------------- the video table

  test('sources: the table lists the main clip and the 16 playlist clips, in order, with the plan\'s durations', () => {
    eq(TJR.sources.list.length, 17);
    eq(TJR.sources.list.map((s) => [s.clip, s.id, s.dur]), TABLE);
    ok(TJR.sources.list[0].main === true, 'clip 0 is the main clip');
    ok(TJR.sources.list.slice(1).every((s) => s.main === false), 'the playlist clips are not main');
    eq(TJR.sources.list[0].date, '2026-07-21');
    eq(TJR.sources.list[8].title, 'Inverse Fair Value Gaps Explained');
    eq(TJR.sources.list[8].date, '2026-01-09');
  });

  test('sources: every row matches the header of its facts file (clip number, video id, duration, date, title)', () => {
    TJR.sources.list.forEach((s) => {
      const text = readText(s.main ? 'docs/source/clip-facts.md' : 'docs/source/playlist/' + s.id + '.md');
      const head = text.split('\n').slice(0, 6).join('\n');
      ok(head.indexOf('https://youtu.be/' + s.id) >= 0, s.id + ': id in the header');
      const m = /youtu\.be\/[\w-]+, (\d+):(\d{2})/.exec(head) || /"[^"]+", (\d+):(\d{2}), https/.exec(head);
      ok(m, s.id + ': duration in the header');
      eq(Number(m[1]) * 60 + Number(m[2]), s.dur, s.id + ' dur');
      ok(head.indexOf('"' + (s.main ? '' : 'Path to Profitability: ') + s.title + '"') >= 0, s.id + ': title ' + s.title);
      if (!s.main) {
        ok(head.indexOf('#' + s.clip + ' ') >= 0, s.id + ': clip number #' + s.clip);
        ok(head.indexOf('uploaded ' + s.date) >= 0, s.id + ': date ' + s.date);
      }
    });
  });

  test('sources: byClip, forFact and href', () => {
    eq(TJR.sources.byClip(8).id, '4sRDnVmLcMk');
    eq(TJR.sources.byClip(0).id, MAIN);
    eq(TJR.sources.byClip(17), null);
    eq(TJR.sources.byClip(-1), null);
    eq(TJR.sources.byClip('x'), null);
    eq(TJR.sources.forFact('F7.7').clip, 0);
    eq(TJR.sources.forFact('F12.1').id, MAIN);
    eq(TJR.sources.forFact('P8.19').id, '4sRDnVmLcMk');
    eq(TJR.sources.forFact('P12.8').clip, 12);
    eq(TJR.sources.forFact('P16.2').clip, 16);
    eq(TJR.sources.forFact('P99.1'), null);
    eq(TJR.sources.forFact('nope'), null);
    eq(TJR.sources.href(0, 45), 'https://youtu.be/Vulini8xbB0?t=45');
    eq(TJR.sources.href(8, 548), 'https://youtu.be/4sRDnVmLcMk?t=548');
    eq(TJR.sources.href(8, 548.9), 'https://youtu.be/4sRDnVmLcMk?t=548');
    eq(TJR.sources.href(undefined, 12), 'https://youtu.be/Vulini8xbB0?t=12', 'no clip means the main clip');
  });

  // ---------------------------------------------------------------- chips

  test('util.tsChip: a playlist clip gives "#n MM:SS" and its own video link; clip 0/undefined is v1', () => {
    eq(TJR.util.tsChip(548, 8), { label: '#8 09:08', href: 'https://youtu.be/4sRDnVmLcMk?t=548', clip: 8 });
    eq(TJR.util.tsChip(45), { label: '00:45', href: 'https://youtu.be/Vulini8xbB0?t=45', clip: 0 });
    eq(TJR.util.tsChip(45, 0), TJR.util.tsChip(45));
    eq(TJR.util.tsChip(1425).label, '23:45');
    eq(TJR.util.tsChip(2947).label, '49:07');
    eq(TJR.util.tsChip(3000, 12), { label: '#12 50:00', href: 'https://youtu.be/AGmAVyAuBE0?t=3000', clip: 12 });
  });

  test('util.tsChip: an unknown clip number fails loudly instead of linking the wrong video', () => {
    let threw = false;
    try { TJR.util.tsChip(10, 99); } catch (e) { threw = true; }
    ok(threw, 'clip 99 does not exist');
  });

  test('layout.chip: the v1 chip is unchanged', () => {
    eq(TJR.layout.chip(1425),
      '<a class="ts-chip" href="https://youtu.be/Vulini8xbB0?t=1425" target="_blank" rel="noopener" aria-label="ดูในคลิปที่ 23:45">23:45</a>');
    eq(TJR.layout.chip(45, 0), TJR.layout.chip(45));
  });

  test('layout.chip: a playlist chip is ts-chip--pl, labelled "#n MM:SS", with the clip title in its aria-label', () => {
    const c = TJR.layout.chip(548, 8);
    ok(c.indexOf('class="ts-chip ts-chip--pl"') >= 0, 'class');
    ok(c.indexOf('href="https://youtu.be/4sRDnVmLcMk?t=548"') >= 0, 'its own video');
    ok(c.indexOf('>#8 09:08</a>') >= 0, 'label');
    ok(c.indexOf('aria-label="ดูในคลิป #8 Inverse Fair Value Gaps Explained ที่ 09:08"') >= 0, 'aria-label');
    ok(c.indexOf('rel="noopener"') >= 0 && c.indexOf('target="_blank"') >= 0, 'opens safely');
    ok(c.indexOf(MAIN) < 0, 'never the main clip');
  });

  // ---------------------------------------------------------------- olderNote / webDef

  test('layout.olderNote: a muted box labelled as the older video, with its own playlist chip', () => {
    const h = TJR.layout.olderNote('<p>ข้อความเก่า</p>', 8, 548);
    ok(h.indexOf('class="older-note"') >= 0, 'class');
    ok(h.indexOf('คลิปเก่า (ม.ค. 2026) พูดว่า…') >= 0, 'label');
    ok(h.indexOf('<p>ข้อความเก่า</p>') >= 0, 'body html kept');
    ok(h.indexOf('ts-chip--pl') >= 0 && h.indexOf('https://youtu.be/4sRDnVmLcMk?t=548') >= 0, 'chip to the older video');
    ok(h.indexOf(MAIN) < 0, 'no main-clip link');
  });

  test('layout.webDef: the labelled general-definition box with its source link, url escaped', () => {
    const h = TJR.layout.webDef('<p>นิยาม</p>', 'https://example.com/a?x=1&y="2"');
    ok(h.indexOf('class="web-def"') >= 0, 'class');
    ok(h.indexOf('นิยามทั่วไป ไม่ใช่จากคลิป') >= 0, 'label');
    ok(h.indexOf('<p>นิยาม</p>') >= 0, 'body html kept');
    ok(h.indexOf('href="https://example.com/a?x=1&amp;y=&quot;2&quot;"') >= 0, 'escaped url');
    ok(h.indexOf('ที่มา: https://example.com/a?x=1&amp;y=&quot;2&quot;</a>') >= 0, 'the url is shown');
    ok(h.indexOf('rel="noopener"') >= 0, 'opens safely');
    ok(TJR.layout.webDef('x', 'javascript:alert(1)').indexOf('href=') < 0, 'only http(s) links');
  });

  // ---------------------------------------------------------------- nav and footer

  test('layout: the nav lists the eight pages in order, with the plan\'s labels and files', () => {
    eq(TJR.layout.PAGES.map((p) => p.label),
      ['หน้าแรก', 'บทเรียน', 'Confluences', 'กลยุทธ์', 'สถานการณ์', 'Playbook', 'ความเสี่ยง', 'แบบฝึก']);
    eq(TJR.layout.PAGES.map((p) => p.href),
      ['index.html', 'learn.html', 'confluences.html', 'strategy.html', 'scenarios.html', 'playbook.html', 'risk.html', 'lab.html']);
    const html = TJR.layout.navHTML({ page: 'strategy', base: '' });
    eq(count(html, 'class="nav__link"'), 8);
    ok(html.indexOf('href="strategy.html" aria-current="page">กลยุทธ์<') >= 0, 'strategy is current');
  });

  test('layout: the footer names the TJR-only rule and links the main clip and the playlist', () => {
    const html = TJR.layout.footerHTML({ base: '' });
    ok(html.indexOf('เนื้อหาจากคลิปของ TJR เท่านั้น') >= 0, 'source line');
    eq(TJR.layout.SOURCE_TEXT, 'เนื้อหาจากคลิปของ TJR เท่านั้น');
    ok(html.indexOf('href="https://youtu.be/Vulini8xbB0"') >= 0, 'main clip link');
    ok(html.indexOf('href="' + PLAYLIST_URL + '"') >= 0, 'playlist link');
    ok(html.indexOf('เพลย์ลิสต์ Path to Profitability') >= 0, 'playlist label');
    ['confluences.html', 'strategy.html', 'risk.html'].forEach((f) => ok(html.indexOf('href="' + f + '"') >= 0, 'footer links ' + f));
  });

  // ---------------------------------------------------------------- audit over every root page

  const PAGES = listRootHtml();

  test('audit: the site has its root pages to audit', () => {
    ['index.html', 'learn.html', 'scenarios.html', 'playbook.html', 'lab.html'].forEach((f) => ok(PAGES.indexOf(f) >= 0, f));
  });

  PAGES.forEach((file) => {
    const html = readText(file);
    const anchors = html.match(/<a\b[^>]*>/g) || [];
    const chips = anchors.filter((a) => /\bclass="[^"]*\bts-chip\b/.test(a));

    test('audit ' + file + ': its <noscript> nav copy lists the same pages as TJR.layout.PAGES', () => {
      const m = /<noscript><header class="nav[^>]*>.*?<\/header><\/noscript>/.exec(html);
      if (!m) return;
      const hrefs = (m[0].match(/class="nav__link" href="[^"]+"/g) || []).map((x) => /href="([^"]+)"/.exec(x)[1]);
      eq(hrefs, TJR.layout.PAGES.map((p) => p.href));
    });

    test('audit ' + file + ': every ts-chip links a known video at or before its end', () => {
      chips.forEach((a) => {
        const m = /\bhref="https:\/\/youtu\.be\/([\w-]+)\?t=(\d+)"/.exec(a);
        ok(m, 'chip has a youtu.be ?t= link: ' + a);
        const src = TJR.sources.list.filter((s) => s.id === m[1])[0];
        ok(src, 'known video id ' + m[1]);
        ok(Number(m[2]) <= src.dur, m[1] + ' t=' + m[2] + ' is past the end (' + src.dur + ')');
      });
    });

    test('audit ' + file + ': a ts-chip--pl chip never links the main clip, and its label is "#n MM:SS" of its own clip', () => {
      anchors.filter((a) => /\bclass="[^"]*\bts-chip--pl\b/.test(a)).forEach((a) => {
        ok(a.indexOf(MAIN) < 0, 'playlist chip links the main clip: ' + a);
      });
      // a static chip's label text, when the markup is on one line, must match its link
      const tags = html.match(/<a\b[^>]*\bts-chip--pl\b[^>]*>[^<]*<\/a>/g) || [];
      tags.forEach((t) => {
        const href = /href="https:\/\/youtu\.be\/([\w-]+)\?t=(\d+)"/.exec(t);
        const src = TJR.sources.list.filter((s) => s.id === href[1])[0];
        const label = />([^<]*)<\/a>$/.exec(t)[1];
        eq(label, '#' + src.clip + ' ' + mmss(Number(href[2])), 'label of ' + t);
      });
    });

    test('audit ' + file + ': every P<clip>.<n> id in a data-fact attribute exists in its playlist file', () => {
      const attrs = html.match(/\bdata-fact="[^"]*"/g) || [];
      attrs.forEach((a) => {
        (a.match(/P\d+\.\d+/g) || []).forEach((id) => {
          const src = TJR.sources.forFact(id);
          ok(src && !src.main, id + ' belongs to a playlist clip');
          const text = readText('docs/source/playlist/' + src.id + '.md');
          ok(new RegExp('(^|\\n)- ' + id.replace('.', '\\.') + '\\s').test(text), id + ' is a fact in ' + src.id + '.md');
        });
      });
    });
  });
})();
