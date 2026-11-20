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

  test('playbook.html: the source tags name the source in words', () => {
    var pb = readText('playbook.html');
    ok(/<span class="level-tag" data-level="1">คลิปหลัก<\/span>/.test(pb) && /<span class="level-tag" data-level="2">เพลย์ลิสต์<\/span>/.test(pb), 'playbook tags');
  });
})();
