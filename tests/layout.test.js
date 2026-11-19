/* Shared layout and motion setup (Task 8): only what runs without a DOM. The pure builders of
   TJR.layout (nav, footer, chip, gap) and TJR.motion.init with and without GSAP / matchMedia.
   Globals a test installs are restored afterwards. Wrapped in an IIFE (one shared vm scope). */
(function () {
  'use strict';

  function count(hay, needle) { return hay.split(needle).length - 1; }
  function swap(name, value) {
    var had = Object.prototype.hasOwnProperty.call(window, name), old = window[name];
    if (value === undefined) delete window[name]; else window[name] = value;
    return function () { if (had) window[name] = old; else delete window[name]; };
  }

  test('layout: the nav lists the pages in order, with the plan\'s labels (the full list is also pinned in sources.test.js)', () => {
    eq(TJR.layout.PAGES.map((p) => p.label), ['หน้าแรก', 'บทเรียน', 'Confluences', 'กลยุทธ์', 'สถานการณ์', 'Playbook', 'ความเสี่ยง', 'แบบฝึก']);
    eq(TJR.layout.PAGES.map((p) => p.id), ['home', 'learn', 'confluences', 'strategy', 'scenarios', 'playbook', 'risk', 'lab']);
    eq(TJR.layout.PAGES.map((p) => p.href), ['index.html', 'learn.html', 'confluences.html', 'strategy.html', 'scenarios.html', 'playbook.html', 'risk.html', 'lab.html']);
    const html = TJR.layout.navHTML({ page: 'home', base: '' });
    let at = -1;
    TJR.layout.PAGES.forEach((p) => {
      const i = html.indexOf('>' + p.label + '</a>');
      ok(i > at, p.label + ' in order in the nav');
      at = i;
    });
  });

  test('layout: aria-current marks exactly the page mounted, none for an unknown page', () => {
    TJR.layout.PAGES.forEach((p) => {
      const html = TJR.layout.navHTML({ page: p.id, base: '' });
      eq(count(html, 'aria-current="page"'), 1, p.id);
      ok(html.indexOf('href="' + p.href + '" aria-current="page">' + p.label + '<') >= 0, p.id + ' is the current word');
    });
    eq(count(TJR.layout.navHTML({ page: 'nope', base: '' }), 'aria-current'), 0);
    eq(count(TJR.layout.navHTML({ base: '' }), 'aria-current'), 0);
  });

  test('layout: the nav is the dealt nav-centre bar with a skip link, one button and a menu toggle', () => {
    const html = TJR.layout.navHTML({ page: 'lab', base: '../' });
    ok(html.indexOf('class="nav nav--centre"') >= 0, 'nav-centre');
    ok(html.indexOf('<a class="skip-link" href="#top">') >= 0, 'skip link to #top first');
    ok(html.indexOf('data-mark="ring"') >= 0, 'the dealt ring mark');
    ok(html.indexOf('<a class="btn btn--primary" href="../learn.html">เริ่มบทเรียน</a>') >= 0, 'main action');
    eq(count(html, 'btn--primary'), 1, 'one filled button');
    ok(/<button class="nav__toggle" type="button" aria-expanded="false" aria-controls="tjr-nav-links" aria-label="[^"]+">/.test(html), 'toggle states itself');
    ok(html.indexOf('id="tjr-nav-links"') >= 0, 'the toggle controls the links');
    ok(html.indexOf('href="../index.html"') >= 0 && html.indexOf('href="../lab.html"') >= 0, 'base prefixes every page link');
  });

  test('layout: the footer carries the clip link and the source line', () => {
    const html = TJR.layout.footerHTML({ base: '' });
    ok(html.indexOf('href="https://youtu.be/Vulini8xbB0"') >= 0, 'clip link');
    ok(html.indexOf('เนื้อหาจากคลิปของ TJR เท่านั้น') >= 0, 'source line');
    eq(TJR.layout.SOURCE_TEXT, 'เนื้อหาจากคลิปของ TJR เท่านั้น');
    ok(html.indexOf('<footer class="footer footer--dark ground-inverse"') === 0, 'footer-dark at its own height');
    ok(html.indexOf('footer closing') < 0 && html.indexOf('close--word') < 0, 'no close: not the one-screen footer.closing');
    ok(html.indexOf('class="footer__mark"') >= 0, 'footer-dark sets the name large');
    TJR.layout.PAGES.forEach((p) => ok(html.indexOf('href="' + p.href + '">' + p.label + '<') >= 0, 'footer links ' + p.label));
  });

  test('layout: a close makes footer.closing with the dealt close-word row, its text escaped', () => {
    const html = TJR.layout.footerHTML({ base: '', close: { title: 'ฝึก <b>&</b>', line: 'บรรทัด', label: 'เริ่มบทเรียน', href: 'learn.html' } });
    ok(html.indexOf('class="footer closing footer--dark ground-inverse"') >= 0, 'closing footer');
    ok(html.indexOf('aria-labelledby="close-h"') >= 0, 'labelled by its h2');
    ok(html.indexOf('close--word') >= 0 && html.indexOf('<p class="close__word" aria-hidden="true">' + TJR.layout.NAME + '</p>') >= 0, 'the name across the wrap');
    ok(html.indexOf('<h2 id="close-h">ฝึก &lt;b&gt;&amp;&lt;/b&gt;</h2>') >= 0, 'title escaped');
    ok(html.indexOf('class="footer__mark"') < 0, 'no second large name under close-word');
    ok(html.indexOf('href="learn.html">เริ่มบทเรียน<svg class="m-arrow"') >= 0, 'the close button');
  });

  test('layout: chip and gap builders', () => {
    const c = TJR.layout.chip(1425);
    ok(c.indexOf('class="ts-chip"') >= 0, 'chip class');
    ok(c.indexOf('href="https://youtu.be/Vulini8xbB0?t=1425"') >= 0, 'deep link');
    ok(c.indexOf('>23:45</a>') >= 0, 'MM:SS label');
    ok(c.indexOf('rel="noopener"') >= 0, 'opens safely in a new tab');
    eq(TJR.layout.gap(), '<span class="badge-gap">คลิปไม่ได้ระบุ</span>');
  });

  test('layout: mount without a DOM does nothing and does not throw', () => {
    const r = TJR.layout.mount({ page: 'home' });
    eq(r, { nav: null, footer: null });
  });

  test('motion: init with no GSAP and no matchMedia does not throw; motion off', () => {
    const undo = [swap('gsap', undefined), swap('ScrollTrigger', undefined), swap('matchMedia', undefined)];
    try {
      const m = TJR.motion.init();
      ok(m === TJR.motion, 'returns TJR.motion');
      eq(TJR.motion.reduced, false);
      eq(TJR.motion.enabled, false);
      eq(TJR.motion.gsap, null);
      eq(TJR.motion.ScrollTrigger, null);
      TJR.motion.init();                                   // idempotent
    } finally { undo.forEach((f) => f()); }
  });

  test('motion: init registers ScrollTrigger once and follows prefers-reduced-motion', () => {
    const calls = [];
    const ST = { refresh: function () {} };
    const gsap = { to: function () {}, registerPlugin: function (p) { calls.push(p); } };
    const mql = { matches: true, fn: null, addEventListener: function (t, fn) { if (t === 'change') this.fn = fn; } };
    const undo = [swap('gsap', gsap), swap('ScrollTrigger', ST), swap('matchMedia', function () { return mql; })];
    try {
      TJR.motion.init();
      TJR.motion.init();
      eq(calls.length, 1, 'registered once');
      ok(calls[0] === ST, 'ScrollTrigger registered');
      ok(TJR.motion.gsap === gsap && TJR.motion.ScrollTrigger === ST, 'libraries exposed');
      eq(TJR.motion.reduced, true);
      eq(TJR.motion.enabled, false, 'reduced: pages draw final frames');
      const seen = [];
      const off = TJR.motion.onChange((r) => seen.push(r));
      mql.matches = false;
      ok(typeof mql.fn === 'function', 'listens for changes');
      mql.fn({ matches: false });
      eq(TJR.motion.reduced, false);
      eq(TJR.motion.enabled, true);
      eq(seen, [false]);
      off();
      mql.fn({ matches: false });
      eq(seen, [false], 'unsubscribed');
    } finally { undo.forEach((f) => f()); }
  });
})();
