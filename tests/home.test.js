/* Home page content rule (Task 9): every timestamp chip in index.html links to the second its label says.
   Arithmetic only (MM:SS x 60 === ?t=), not whether the fact fits. Wrapped in an IIFE (one shared vm scope). */
(function () {
  'use strict';

  test('index.html: every ts-chip ?t= equals its MM:SS label in seconds', () => {
    const html = readText('index.html');
    const re = /<a\b[^>]*\bclass="ts-chip"[^>]*>([^<]*)<\/a>/g;
    let m, n = 0;
    while ((m = re.exec(html))) {
      const tag = m[0], label = m[1].trim();
      const lm = /^(\d{2}):(\d{2})$/.exec(label);
      ok(lm, 'chip label is MM:SS: ' + label);
      const href = /href="([^"]*)"/.exec(tag);
      ok(href, 'chip has an href: ' + label);
      const tm = /^https:\/\/youtu\.be\/Vulini8xbB0\?t=(\d+)$/.exec(href[1]);
      ok(tm, 'chip href is the clip with ?t=: ' + label);
      eq(Number(tm[1]), Number(lm[1]) * 60 + Number(lm[2]), 'chip ' + label);
      n++;
    }
    ok(n > 0, 'index.html has ts-chips');
  });
})();

/* Home page for the full system (v2 Task 12): the map of both levels, 22 scenarios, two sources. */
(function () {
  'use strict';

  const PAGES = ['index.html', 'start.html', 'learn.html', 'confluences.html', 'strategy.html', 'scenarios.html', 'playbook.html', 'risk.html', 'lab.html'];
  const html = () => readText('index.html');
  const tagless = (s) => s.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const section = (h, id) => {
    const m = new RegExp('<section\\s[^>]*id="' + id + '"[\\s\\S]*?</section>').exec(h);
    ok(m, 'section #' + id + ' exists');
    return m[0];
  };
  const hrefs = (s) => (s.match(/href="[^"]*"/g) || []).map((x) => x.slice(6, -1));

  test('index.html: links to all 8 nav pages, and the 7 other pages from inside <main>', () => {
    const h = html();
    const all = hrefs(h);
    PAGES.forEach((p) => ok(all.some((u) => u === p || u.indexOf(p + '#') === 0), 'links to ' + p));
    const main = /<main[\s\S]*<\/main>/.exec(h)[0];
    const inMain = hrefs(main);
    PAGES.filter((p) => p !== 'index.html').forEach((p) =>
      ok(inMain.some((u) => u === p || u.indexOf(p + '#') === 0), 'main links to ' + p));
  });

  test('index.html: counts read 22 scenarios; no stale 14, 7-step or 4-mode counts', () => {
    const h = html(), txt = tagless(h), js = readText('assets/js/pages/home.js');
    ok(/22 สถานการณ์/.test(txt), 'says 22 สถานการณ์');
    ok(/22/.test(/<meta name="description"[^>]*>/.exec(h)[0]), 'meta description says 22');
    ok(!/14 สถานการณ์/.test(h) && !/14 สถานการณ์/.test(js), 'no "14 สถานการณ์"');
    ok(!/Playbook 7 ขั้น/.test(h), 'no "Playbook 7 ขั้น"');
    ok(!/แบบฝึก \d+ โหมด/.test(h), 'no drill-mode count promised');
    ok(!/8 เรื่องที่คลิปนี้ไม่ได้สอน/.test(h), 'the old "8 things not taught" block is gone');
    ok(!/คลิป liquidity ของ TJR[^<]*เฉพาะ|เฉพาะระบบในคลิป/.test(h), 'no "only the liquidity clip" claim left');
  });

  test('index.html: #path draws the six stops, the 8 chapters and the chain with links', () => {
    const s = section(html(), 'path');
    eq((s.match(/class="path-stop"/g) || []).length, 6, 'six stops');
    const stops = (s.match(/<li class="path-stop"><a href="[^"]+"/g) || []).map((x) => /href="([^"]+)"/.exec(x)[1]);
    eq(stops, ['start.html', 'learn.html', 'confluences.html', 'strategy.html', 'playbook.html', 'risk.html'], 'the stops in path order');
    ok(/class="step-tag"[^>]*data-step="1"/.test(s) && /class="step-tag"[^>]*data-step="2"/.test(s), 'step tags on the chapter list and the chain');
    for (let m = 1; m <= 8; m++) ok(s.indexOf('href="learn.html#m' + m + '"') >= 0, 'chapter ' + m + ' link');
    eq((s.match(/class="sys-step"/g) || []).length, 6, 'six chain steps 0..5');
    eq((s.match(/class="sys-side"/g) || []).length, 2, 'timing and risk beside the chain');
    ['confluences.html', 'strategy.html', 'playbook.html', 'risk.html'].forEach((p) => ok(hrefs(s).some((u) => u.indexOf(p) === 0), 'step page ' + p));
    ['confluences.html#m1', 'confluences.html#m2', 'confluences.html#m3', 'confluences.html#m4', 'confluences.html#m5'].forEach((u) => ok(hrefs(s).indexOf(u) >= 0, u));
    const txt = tagless(s);
    ['bias', 'sweep', 'BOS', 'IFVG', 'FVG', 'equilibrium', 'Entry', 'Exit'].forEach((w) => ok(txt.indexOf(w) >= 0, 'names ' + w));
    ['confirmation', 'continuation'].forEach((w) => ok(new RegExp(w, 'i').test(txt), 'names ' + w));
  });

  test('index.html: the system map keeps the one-section-per-screen rule and the order', () => {
    const h = html();
    const ids = (h.match(/<section[^>]*\bid="([^"]+)"/g) || []).map((x) => /id="([^"]+)"/.exec(x)[1]);
    eq(ids, ['path', 'core', 'course', 'practice', 'sources'], 'section order after the hero: the path first');
    ok(/id="path"[^>]*style="--h: [12]"/.test(h), '#path is one or two screens');
    ok(/id="path"[^>]*aria-labelledby="path-h"/.test(h) && /id="path-h"/.test(h), '#path has its h2');
  });

  test('index.html: source strip names the clip and the playlist and the precedence', () => {
    const s = section(html(), 'sources');
    ok(s.indexOf('href="https://youtu.be/Vulini8xbB0"') >= 0, 'main clip link');
    ok(s.indexOf('href="https://www.youtube.com/playlist?list=PLKE_22Jx497s5Q6ZX2pfDcDwCm_IyxR7e"') >= 0, 'playlist link');
    ok(s.indexOf('Path to Profitability') >= 0, 'playlist name');
    ok(tagless(s).indexOf('คลิปใหม่กว่าเป็นหลัก เพลย์ลิสต์เติมรายละเอียด') >= 0, 'precedence sentence');
    ok(/target="_blank" rel="noopener"/.test(s), 'external links open safely');
    ok((s.match(/badge-gap/g) || []).length >= 5, 'what no clip says is still badged');
  });

  test('index.html: playlist chips are the layout helper output, never clip #4', () => {
    const h = html();
    const re = /<a\b[^>]*class="ts-chip ts-chip--pl"[^>]*>[^<]*<\/a>/g;
    let m, n = 0;
    while ((m = re.exec(h))) {
      const href = /href="([^"]*)"/.exec(m[0])[1], label = /#(\d+) (\d{2}):(\d{2})</.exec(m[0]);
      ok(label, 'label is #clip MM:SS: ' + m[0]);
      const clip = Number(label[1]), sec = Number(label[2]) * 60 + Number(label[3]);
      ok(clip !== 4, 'no chip to clip #4');
      eq(m[0].replace(/ data-fact="[^"]*"/, ''), TJR.layout.chip(sec, clip), 'chip markup #' + clip + ' ' + label[2] + ':' + label[3]);
      ok(href.indexOf(TJR.sources.byClip(clip).id) >= 0, 'chip points at its own video');
      n++;
    }
    ok(n >= 6, 'the chain steps carry playlist chips (' + n + ')');
  });

  test('index.html: title and meta speak for the path, no Level wording anywhere a reader sees', () => {
    const h = html();
    ok(/<title>[^<]*(TJR)[^<]*<\/title>/.test(h), 'title names TJR');
    const d = /<meta name="description" content="([^"]*)"/.exec(h)[1];
    ok(!/Level/.test(d) && /22/.test(d), 'description: the path, 22 scenarios, no Level');
    const seen = h.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') + ' ' + (h.match(/(?:aria-label|title|alt)="[^"]*"/g) || []).join(' ');
    ok(!/Level\s?[12]|L[12]|ระดับ\s?[12]/.test(seen), 'no Level 1 / Level 2 / ระดับ 2 left on the page');
  });

  test('index.html: the hero starts a beginner at step 0 and offers the full setup', () => {
    const hero = /<section class="hero[\s\S]*?<\/section>/.exec(html())[0];
    ok(/class="btn btn--primary" href="start\.html">เริ่มที่นี่</.test(hero), 'primary button: เริ่มที่นี่');
    ok(/class="btn btn--secondary" href="strategy\.html">ดูเซ็ตอัพเต็ม</.test(hero), 'secondary button: ดูเซ็ตอัพเต็ม');
    ok(!/<h1[^>]*>[^<]*Liquidity อยู่เหนือ High/.test(hero), 'the liquidity rule is no longer the h1');
  });
})();
