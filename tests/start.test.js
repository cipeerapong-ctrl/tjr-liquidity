/* Step 0, the beginner page (v3 learning path): the pure helpers of assets/js/pages/start.js (TJR.startPage) and the
   content rules of start.html. start.js is evaluated into this context (no DOM here, so it only attaches the helpers).
   Wrapped in an IIFE (one shared vm scope). */
(function () {
  'use strict';
  (0, eval)(readText('assets/js/pages/start.js'));
  var P = TJR.startPage;
  var html = readText('start.html');
  var main = (/<main[\s\S]*<\/main>/.exec(html) || [''])[0];

  function tagless(s) { return s.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); }
  function section(id) {
    var m = new RegExp('<section\\b[^>]*\\bid="' + id + '"[\\s\\S]*?</section>').exec(html);
    ok(m, 'section #' + id + ' exists');
    return m ? m[0] : '';
  }
  // the clips this page may cite: the main clip (0) and the playlist clips listed (Task 3 adds the glossary's)
  var CLIPS = [0, 14];

  // ---------------------------------------------------------------- pure helpers

  test('start.split: n candles that open at open, close at close, keep high and low, on the 0.25 tick', () => {
    [2, 3, 4, 6].forEach(function (n) {
      for (var seed = 1; seed <= 50; seed++) {
        var r = P.split(100, 106, 109.25, 98.5, n, seed);
        eq(r.length, n, 'n=' + n);
        eq(r[0].o, 100, 'opens at open');
        eq(r[n - 1].c, 106, 'closes at close');
        eq(Math.max.apply(null, r.map(function (c) { return c.h; })), 109.25, 'keeps the high');
        eq(Math.min.apply(null, r.map(function (c) { return c.l; })), 98.5, 'keeps the low');
        r.forEach(function (c, k) {
          ['o', 'h', 'l', 'c'].forEach(function (key) { eq(c[key] % 0.25, 0, 'tick ' + key); });
          ok(c.l <= Math.min(c.o, c.c) && c.h >= Math.max(c.o, c.c), 'wicks hold the body');
          if (k) eq(c.o, r[k - 1].c, 'each candle opens where the last closed');
        });
      }
    });
  });

  test('start.split: same seed gives the same candles; a down candle splits too', () => {
    eq(P.split(100, 106, 109, 98, 4, 7), P.split(100, 106, 109, 98, 4, 7));
    var r = P.split(106, 100, 109, 98, 4, 3);
    eq(r[0].o, 106); eq(r[3].c, 100);
  });

  test('start.marks: a high is an up candle then a down candle (at the higher wick), a low is the reverse', () => {
    // [o, h, l, c]
    var cs = [[10, 12, 9, 11], [11, 14, 10, 12], [12, 13, 8, 9], [9, 10, 7, 8], [8, 12, 7.5, 11]];
    var m = P.marks(cs);
    eq(m.map(function (x) { return x.type; }), ['high', 'low']);
    eq(m[0].i, 1); eq(m[0].price, 14);                       // up, up, down: the up-down pair is candles 1 and 2; the higher wick is candle 1's
    eq(m[1].i, 3); eq(m[1].price, 7);                        // down, down, up: the down-up pair is candles 3 and 4; the lower wick is candle 3's
    eq(P.marks([[1, 2, 0, 1]]), [], 'one candle marks nothing');
  });

  test('start.ZIG: the labels are true to the numbers (HH above the last high, HL above the last low, LL and LH likewise)', () => {
    ['up', 'down'].forEach(function (dir) {
      var lastHigh = null, lastLow = null;
      P.ZIG[dir].forEach(function (p) {
        if (p.t === 'HH') ok(p.v > lastHigh, dir + ' HH above the last high');
        if (p.t === 'HL') ok(p.v > lastLow, dir + ' HL above the last low');
        if (p.t === 'LL') ok(p.v < lastLow, dir + ' LL under the last low');
        if (p.t === 'LH') ok(p.v < lastHigh, dir + ' LH under the last high');
        if (p.t === 'high' || p.t === 'HH' || p.t === 'LH') lastHigh = p.v;
        if (p.t === 'low' || p.t === 'HL' || p.t === 'LL') lastLow = p.v;
      });
    });
    eq(P.ZIG.up.map(function (p) { return p.t; }), ['high', 'low', 'HH', 'HL', 'HH', 'HL'], 'the order P14.39 gives');
    eq(P.ZIG.down.map(function (p) { return p.t; }), ['low', 'high', 'LL', 'LH', 'LL', 'LH'], 'the order P14.41 gives');
  });

  // ---------------------------------------------------------------- the page

  test('start.html: the head loads the shared stylesheets and its own, and every script it ends with exists', () => {
    var head = (/<head>[\s\S]*?<\/head>/.exec(html) || [''])[0];
    ok(head.length > 0, 'a closed <head>');
    ['assets/system.css', 'assets/ui/cards.css', 'assets/motion/motion.css', 'assets/layout/layout.css', 'assets/css/tokens.css', 'assets/css/site.css', 'assets/css/pages/start.css'].forEach(function (f) {
      ok(head.indexOf('href="' + f + '"') >= 0, 'links ' + f);
    });
    ok(head.indexOf('m-enter') >= 0, 'the m-enter line of the kit');
    (html.match(/<(?:link|script)\b[^>]*(?:href|src)="(assets\/[^"]+)"/g) || []).forEach(function (t) {
      var f = /="(assets\/[^"]+)"/.exec(t)[1];
      ok(readText(f).length > 0, f + ' exists');
    });
  });

  test('start.html: the five blocks come in teaching order', () => {
    var at = -1;
    ['path', 'candle', 'timeframe', 'highlow', 'trend'].forEach(function (id) {
      var i = html.search(new RegExp('<section\\b[^>]*\\bid="' + id + '"'));
      ok(i > at, '#' + id + ' after the one before it');
      at = i;
    });
  });

  test('start.html: each block cites the facts it teaches', () => {
    var need = {
      candle: ['P14.17', 'P14.18', 'P14.19', 'P14.20', 'P14.22', 'P14.23'],
      timeframe: ['P14.25', 'P14.26', 'P14.27', 'P14.28'],
      highlow: ['F2.1', 'F2.2', 'P14.33', 'P14.35', 'P14.36'],
      trend: ['F3.1', 'P14.38', 'P14.39', 'P14.41', 'P14.43']
    };
    Object.keys(need).forEach(function (id) {
      var s = section(id);
      need[id].forEach(function (f) { ok(s.indexOf('data-fact="' + f + '"') >= 0, '#' + id + ' cites ' + f); });
    });
  });

  test('start.html: the sample series and the zigzags on the page are the ones the helpers describe', () => {
    var s = section('highlow'), drawn = [];
    (s.match(/data-mark="(?:high|low)" data-i="\d+" data-price="[\d.]+"/g) || []).forEach(function (x) {
      var m = /data-mark="(\w+)" data-i="(\d+)" data-price="([\d.]+)"/.exec(x);
      drawn.push(m[1] + ':' + m[2] + ':' + m[3]);
    });
    eq(drawn, P.marks(P.SAMPLE).map(function (m) { return m.type + ':' + m.i + ':' + m.price; }), 'marks');
    eq((s.match(/data-candle="\d+"/g) || []).length, P.SAMPLE.length, 'every sample candle is drawn');
    var t = section('trend');
    ['up', 'down'].forEach(function (dir) {
      var re = new RegExp('data-zig="' + dir + '"[\\s\\S]*?</svg>'), svg = (re.exec(t) || [''])[0];
      var labels = (svg.match(/data-zig-label="[^"]+"/g) || []).map(function (x) { return /="([^"]+)"/.exec(x)[1]; });
      eq(labels, P.ZIG[dir].map(function (p) { return p.t; }), dir + ' zigzag labels');
    });
  });

  test('start.html: every chip names its fact and links the start of that fact in its own video', () => {
    var anchors = main.match(/<a\b[^>]*\bts-chip\b[^>]*>[^<]*<\/a>/g) || [];
    ok(anchors.length >= 20, 'chips present: ' + anchors.length);
    var starts = function (id) {
      var src = TJR.sources.forFact(id), file = id.charAt(0) === 'F' ? 'docs/source/clip-facts.md' : 'docs/source/playlist/' + src.id + '.md';
      var lines = readText(file).split('\n'), at = -1;
      lines.forEach(function (l, i) { if (at < 0 && l.indexOf('- ' + id + ' ') === 0) at = i; });
      ok(at >= 0, id + ' is a fact');
      var groups = lines[at].match(/\(\d{1,2}:\d\d[^)]*\)/g);
      if (!groups) {                                         // no time on the line: the section heading's start
        for (var k = at; k >= 0 && !groups; k--) if (lines[k].indexOf('## ') === 0) groups = lines[k].match(/\(\d{1,2}:\d\d[^)]*\)/g);
      }
      var m = /\((\d{1,2}):(\d\d)/.exec(groups[groups.length - 1]);
      return Number(m[1]) * 60 + Number(m[2]);
    };
    anchors.forEach(function (a) {
      var href = /href="https:\/\/youtu\.be\/([\w-]+)\?t=(\d+)"/.exec(a), id = (/data-fact="([FP]\d+\.\d+)"/.exec(a) || [])[1];
      ok(href, 'chip has a youtu.be link: ' + a);
      ok(id, 'chip names its fact: ' + a);
      var src = TJR.sources.forFact(id);
      ok(CLIPS.indexOf(src.clip) >= 0, id + ' is from an allowed clip');
      eq(href[1], src.id, id + ' links its own video');
      eq(Number(href[2]), starts(id), id + ' links the start of its range');
      ok(/\bts-chip--pl\b/.test(a) === !src.main, id + ' playlist chips are the outline kind');
      if (!src.main) ok(new RegExp('>#' + src.clip + ' \\d\\d:\\d\\d<').test(a), id + ' label is "#n MM:SS"');
    });
  });

  test('start.html: no footage or screenshots, and no Level wording a reader can see', () => {
    ok(!/<img\b/i.test(html) && !/<video\b/i.test(html) && !/<iframe\b/i.test(html), 'no images, videos or embeds');
    var seen = tagless(html) + ' ' + (html.match(/aria-label="[^"]*"/g) || []).join(' ');
    ok(!/Level\s?[12]|\bL[12]\b/.test(seen), 'no Level 1 / Level 2 / L1 / L2');
  });

  test('start.html: the step marker is the layout builder\'s, and the one nav copy lists the path pages', () => {
    ok(html.indexOf(TJR.layout.stepMarkerHTML('start')) >= 0, 'step marker');
    ok(/<noscript><header class="nav[^>]*>[\s\S]*?href="start\.html" aria-current="page"/.test(html), 'noscript nav marks start');
  });
})();
