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
