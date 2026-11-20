/* The learning path across the five lesson pages (v3): every one carries its step marker, and no visible text talks
   about "Level 1 / Level 2" any more (the source tags say คลิปหลัก / เพลย์ลิสต์, the pointers say ขั้น N).
   Wrapped in an IIFE (one shared vm scope). */
(function () {
  'use strict';

  function visible(html) {
    return html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') +
      ' ' + (html.replace(/<!--[\s\S]*?-->/g, ' ').match(/(?:aria-label|title|alt)="[^"]*"/g) || []).join(' ');
  }
  var LEVEL = /Level\s?[12]|\bL[12]\b/;
  var PAGES = ['learn', 'confluences', 'strategy', 'playbook', 'risk'];

  PAGES.forEach(function (id) {
    var html = readText(id + '.html');

    test(id + '.html: carries the step marker of the path, once, first in <main>', () => {
      var marker = TJR.layout.stepMarkerHTML(id);
      ok(marker.length > 0, 'the page is on the path');
      eq(html.split(marker).length - 1, 1, 'the marker appears once');
      var main = html.slice(html.indexOf('<main'));
      ok(main.indexOf(marker) > 0 && main.indexOf(marker) < main.indexOf('<h1'), 'the marker comes before the h1');
    });

    test(id + '.html: no Level 1 / Level 2 / L1 / L2 in anything a reader sees', () => {
      var seen = visible(html), m = LEVEL.exec(seen);
      ok(!m, 'found "' + (m ? seen.slice(Math.max(0, m.index - 40), m.index + 40) : '') + '"');
    });
  });

  test('each lesson page footer button goes where the path next link goes', () => {
    PAGES.forEach(function (id) {
      var js = readText('assets/js/pages/' + id + '.js');
      var close = /close:\s*\{[\s\S]*?href:\s*'([^']+)'/.exec(js);
      ok(close, id + ' has a close row');
      var next = /path-nav__next" href="([^"]+)"/.exec(TJR.layout.pathNavHTML(id, ''));
      ok(next, id + ' has a next link');
      eq(close[1], next[1], id + ': the footer button and the path next link agree');
    });
  });

  // ---------------------------------------------------------------- the practice pages (not on the path: tagged by the steps they practise)
  var PRACTICE = { scenarios: 'ฝึก · ใช้คู่กับขั้น 1–3', lab: 'ฝึก · ใช้คู่กับขั้น 0–3' };
  var LEVEL_TH = /ระดับ\s?[12]/;

  Object.keys(PRACTICE).forEach(function (id) {
    var html = readText(id + '.html');

    test(id + '.html: tagged as practice with the steps it goes with, first in <main>', () => {
      var tag = '<p class="step-tag step-tag--practice">' + PRACTICE[id] + '</p>';
      eq(html.split(tag).length - 1, 1, 'the practice tag appears once');
      var main = html.slice(html.indexOf('<main'));
      ok(main.indexOf(tag) > 0 && main.indexOf(tag) < main.indexOf('<h1'), 'the tag comes before the h1');
    });

    test(id + '.html and its script: no Level 1 / Level 2 / L1 / L2 / ระดับ 1-2 a reader sees', () => {
      var seen = visible(html), m = LEVEL.exec(seen) || LEVEL_TH.exec(seen);
      ok(!m, 'page text: ' + (m ? seen.slice(Math.max(0, m.index - 40), m.index + 40) : ''));
      // string literals of the script that reach the DOM (comments stripped first)
      var js = readText('assets/js/pages/' + id + '.js').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      var lit = (js.match(/'(?:[^'\\\n]|\\.)*'/g) || []).filter(function (x) { return LEVEL.test(x) || LEVEL_TH.test(x); });
      eq(lit, [], 'string literals that say Level / ระดับ');
    });
  });

  test('scenarios.html: the filter chips name the step, and the card and viewer tags say ขั้น', () => {
    var h = readText('scenarios.html'), js = readText('assets/js/pages/scenarios.js');
    ok(/data-f="l1"[^>]*>ฝึกขั้น 1 · Liquidity</.test(h) && /data-f="l2"[^>]*>ฝึกขั้น 2–3 · ระบบเต็ม</.test(h), 'filter chips');
    ok(/<meta name="description" content="[^"]*"/.test(h) && !/Level/.test(/<meta name="description" content="([^"]*)"/.exec(h)[1]), 'meta description');
    ok(js.indexOf("'ขั้น 2–3'") > 0 && js.indexOf("'ขั้น 1'") > 0, 'tag text for both groups');
  });

  test('lab.html: says which steps each group of modes goes with', () => {
    var h = readText('lab.html');
    ok(h.indexOf('ใช้คู่กับขั้น 0–1') > 0 && h.indexOf('ใช้คู่กับขั้น 2–3') > 0, 'both groups named');
  });

  test('playbook.html: the source tags name the source in words', () => {
    var pb = readText('playbook.html');
    ok(/<span class="level-tag" data-level="1">คลิปหลัก<\/span>/.test(pb) && /<span class="level-tag" data-level="2">เพลย์ลิสต์<\/span>/.test(pb), 'playbook tags');
  });
})();
