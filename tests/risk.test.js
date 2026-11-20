/* Risk page (v2 Task 9): the pure logic of assets/js/pages/risk.js (the contract-size calculator, the halving rule,
   the win rate x R:R arithmetic, the stored inputs) and the content rule on risk.html: chips only to the clips
   that say the thing (#2 and #15, plus the one main-clip line that says the strategy is not detailed), nothing from
   the excluded list, no clip #4. risk.js is evaluated into this context (no DOM here: it only attaches TJR.riskPage).
   Wrapped in an IIFE (one shared vm scope). */
(function () {
  'use strict';
  (0, eval)(readText('assets/js/pages/risk.js'));
  var R = TJR.riskPage;

  // ---------------------------------------------------------------- contracts
  test('risk.contracts: floor of (account x risk%) / (widest stop x tick value)', () => {
    eq(R.contracts({ account: 50000, riskPct: 1, widestTicks: 35, tickValue: 5 }), 2, '500 / 175 = 2.86 -> 2');
    eq(R.contracts({ account: 100000, riskPct: 1, widestTicks: 20, tickValue: 5 }), 10, 'exact division');
    eq(R.contracts({ account: 50000, riskPct: 1, widestTicks: 35, tickValue: 5 }) * 35 * 5 <= 500, true, 'the widest stop never costs more than the risk');
    eq(R.contracts({ account: 3000, riskPct: 2.3, widestTicks: 1, tickValue: 0.5 }), 138, 'a float result of 137.99999999999997 is still 138');
    eq(R.contracts({ account: 50000, riskPct: 3, widestTicks: 35, tickValue: 5 }), 8);
  });

  test('risk.contracts: risk % outside 0.1-10 clamps', () => {
    eq(R.contracts({ account: 50000, riskPct: 50, widestTicks: 35, tickValue: 5 }), R.contracts({ account: 50000, riskPct: 10, widestTicks: 35, tickValue: 5 }));
    eq(R.contracts({ account: 50000, riskPct: 50, widestTicks: 35, tickValue: 5 }), 28, '5000 / 175');
    eq(R.contracts({ account: 50000, riskPct: 0, widestTicks: 35, tickValue: 5 }), R.contracts({ account: 50000, riskPct: 0.1, widestTicks: 35, tickValue: 5 }));
    eq(R.contracts({ account: 50000, riskPct: -3, widestTicks: 35, tickValue: 5 }), 0, '0.1% of 50000 = 50, under one contract at 175');
    eq(R.RISK_MIN, 0.1); eq(R.RISK_MAX, 10);
    eq(R.clampRisk(0.05), 0.1); eq(R.clampRisk(11), 10); eq(R.clampRisk(2.5), 2.5);
    eq(R.clampRisk(NaN), R.DEFAULTS.riskPct, 'not a number falls back to the default');
    eq(R.clampRisk('abc'), R.DEFAULTS.riskPct);
  });

  test('risk.contracts: missing or impossible inputs give 0, never NaN or Infinity', () => {
    [{}, null, undefined, { account: 50000, riskPct: 1, widestTicks: 0, tickValue: 5 }, { account: 50000, riskPct: 1, widestTicks: 35, tickValue: 0 },
      { account: 0, riskPct: 1, widestTicks: 35, tickValue: 5 }, { account: -5, riskPct: 1, widestTicks: 35, tickValue: 5 },
      { account: 'x', riskPct: 1, widestTicks: 35, tickValue: 5 }, { account: 50000, riskPct: 1, widestTicks: 35, tickValue: null },
      { account: Infinity, riskPct: 1, widestTicks: 35, tickValue: 5 }, { account: 50000, riskPct: 1, widestTicks: -1, tickValue: 5 }
    ].forEach((x) => eq(R.contracts(x), 0, JSON.stringify(x)));
    eq(R.contracts({ account: 100, riskPct: 1, widestTicks: 35, tickValue: 5 }), 0, 'one contract already costs more than the risk');
  });

  // ---------------------------------------------------------------- halving
  test('risk.halve: floors, and never goes below 1 while the base size is 1 or more', () => {
    eq([0, 1, 2, 3, 4, 5, 7, 8, 28].map(R.halve), [0, 1, 1, 1, 2, 2, 3, 4, 14]);
    eq(R.halve(1), 1, 'one contract stays one');
    eq(R.halve(0), 0, 'no base size, nothing to halve');
    eq(R.halve(NaN), 0); eq(R.halve(-3), 0); eq(R.halve(2.9), 1, 'a whole number of contracts only');
    for (var n = 1; n <= 200; n++) ok(R.halve(n) >= 1 && R.halve(n) <= n, 'n=' + n);
  });

  // ---------------------------------------------------------------- calc: the whole answer
  test('risk.calc: contracts, the loss at the widest stop (<= risk) and at the tightest stop', () => {
    var c = R.calc({ account: 50000, riskPct: 1, tightest: 16, widest: 35, tickValue: 5, halve: false });
    eq(c.status, 'ok');
    eq(c.riskPct, 1); eq(c.riskAmount, 500);
    eq(c.base, 2); eq(c.size, 2);
    eq(c.widest.loss, 350); near(c.widest.pct, 0.7, 1e-9); ok(c.widest.loss <= c.riskAmount, 'widest loss within the risk');
    eq(c.tightest.loss, 160); near(c.tightest.pct, 0.32, 1e-9);
    eq(c.tooSmall, false); eq(c.sweet, true);
  });

  test('risk.calc: halving uses the halved size for both losses and keeps the base size visible', () => {
    var c = R.calc({ account: 100000, riskPct: 1, tightest: 16, widest: 20, tickValue: 5, halve: true });
    eq(c.base, 10); eq(c.size, 5); eq(c.halved, true);
    eq(c.widest.loss, 500); eq(c.tightest.loss, 400);
    var one = R.calc({ account: 50000, riskPct: 1, tightest: 16, widest: 175, tickValue: 1, halve: true });
    eq(one.base, 2); eq(one.size, 1);
    var single = R.calc({ account: 100, riskPct: 1, tightest: 4, widest: 10, tickValue: 5, halve: true });
    eq(single.base, 0); eq(single.size, 0); eq(single.status, 'ok');
  });

  test('risk.calc: when even one contract is too much it says so and shows the one-contract loss', () => {
    var c = R.calc({ account: 5000, riskPct: 1, tightest: 16, widest: 35, tickValue: 5, halve: false });
    eq(c.base, 0); eq(c.tooSmall, true);
    eq(c.oneContract.loss, 175); near(c.oneContract.pct, 3.5, 1e-9);
    ok(c.oneContract.loss > c.riskAmount);
  });

  test('risk.calc: the tightest stop is optional; a tightest wider than the widest is flagged', () => {
    var a = R.calc({ account: 50000, riskPct: 1, tightest: null, widest: 35, tickValue: 5, halve: false });
    eq(a.status, 'ok'); eq(a.tightest, null);
    var b = R.calc({ account: 50000, riskPct: 1, tightest: 50, widest: 35, tickValue: 5, halve: false });
    eq(b.status, 'ok'); eq(b.order, false, 'tightest 50 > widest 35');
    eq(R.calc({ account: 50000, riskPct: 1, tightest: 16, widest: 35, tickValue: 5, halve: false }).order, true);
  });

  test('risk.calc: more than 3% is flagged as outside the 1-3% he calls the sweet spot; status names what is missing', () => {
    eq(R.calc({ account: 50000, riskPct: 3, tightest: 16, widest: 35, tickValue: 5 }).sweet, true);
    eq(R.calc({ account: 50000, riskPct: 3.5, tightest: 16, widest: 35, tickValue: 5 }).sweet, false);
    eq(R.calc({ account: 50000, riskPct: 0.5, tightest: 16, widest: 35, tickValue: 5 }).sweet, false, 'below 1% is outside his 1-3% too');
    eq(R.calc({ account: 50000, riskPct: 12, tightest: 16, widest: 35, tickValue: 5 }).riskPct, 10, 'risk % shown is the clamped one');
    eq(R.calc({ account: null, riskPct: 1, widest: 35, tickValue: 5 }).status, 'need-account');
    eq(R.calc({ account: 50000, riskPct: 1, widest: null, tickValue: 5 }).status, 'need-widest');
    eq(R.calc({ account: 50000, riskPct: 1, widest: 35, tickValue: null }).status, 'need-tick');
    eq(R.calc({}).status, 'need-account');
    eq(R.calc(null).status, 'need-account');
  });

  // ---------------------------------------------------------------- the bars
  test('risk.meter: bar widths are fractions of one scale that always contains the risk limit', () => {
    var m = R.meter(1, 0.7, 0.32);
    eq(m.limit > 0 && m.limit <= 1, true);
    near(m.widest, 0.7 / m.max, 1e-9); near(m.tightest, 0.32 / m.max, 1e-9); near(m.limit, 1 / m.max, 1e-9);
    ok(m.max >= 1);
    var big = R.meter(1, 3.5, 1.2);
    near(big.widest, 1, 1e-9, 'the longest bar fills the scale'); ok(big.limit < 1);
    eq(R.meter(1, 0, 0).widest, 0);
    eq(R.meter(1, NaN, null).widest, 0);
  });

  // ---------------------------------------------------------------- win rate x R:R
  test('risk.expectancy: win rate and risk-to-reward -> expectancy in R and the break-even win rate', () => {
    var e = R.expectancy({ winPct: 50, rr: 2 });
    near(e.expR, 0.5, 1e-9); near(e.breakEven, 100 / 3, 1e-9); eq(e.positive, true);
    var f = R.expectancy({ winPct: 40, rr: 1 });
    near(f.expR, -0.2, 1e-9); eq(f.positive, false);
    var g = R.expectancy({ winPct: 25, rr: 3 });
    near(g.expR, 0, 1e-9); eq(g.positive, false, 'exactly break-even is not positive');
    eq(R.expectancy({ winPct: 101, rr: 2 }), null);
    eq(R.expectancy({ winPct: 50, rr: -1 }), null);
    eq(R.expectancy({ winPct: null, rr: 2 }), null);
    eq(R.expectancy({ winPct: 50, rr: 0 }).expR, -0.5, 'an R:R of 0 is allowed arithmetic: every win pays nothing');
    eq(R.expectancy(null), null);
  });

  // ---------------------------------------------------------------- stored inputs
  test('risk.parseInputs: damaged or foreign values fall back; only the known keys survive', () => {
    var d = R.parseInputs(null);
    eq(d, R.DEFAULTS);
    eq(R.parseInputs('x'), R.DEFAULTS); eq(R.parseInputs([1, 2]), R.DEFAULTS); eq(R.parseInputs(7), R.DEFAULTS);
    var p = R.parseInputs({ account: 50000, riskPct: 2, tightest: 16.4, widest: '35', tickValue: 5, halve: true, wr: 55, rr: 1.5, extra: 'x', __proto__: { y: 1 } });
    eq(p, { account: 50000, riskPct: 2, tightest: 16, widest: null, tickValue: 5, halve: true, wr: 55, rr: 1.5 }, 'a numeric string is not a number; ticks are whole numbers');
    var q = R.parseInputs({ account: -1, riskPct: 99, tightest: 0, widest: 1e9, tickValue: 0, halve: 'yes', wr: 120, rr: -2 });
    eq(q.account, null); eq(q.riskPct, 10); eq(q.tightest, null); eq(q.widest, null); eq(q.tickValue, null); eq(q.halve, false); eq(q.wr, null); eq(q.rr, null);
    eq(Object.keys(p).sort(), Object.keys(R.DEFAULTS).sort());
  });

  test('risk.parseNumber: what a person types into a field', () => {
    eq(R.parseNumber('50000'), 50000);
    eq(R.parseNumber(' 50,000 '), 50000);
    eq(R.parseNumber('12.5'), 12.5);
    eq(R.parseNumber('1 000'), 1000);
    eq(R.parseNumber(''), null); eq(R.parseNumber('abc'), null); eq(R.parseNumber('1e3x'), null); eq(R.parseNumber(null), null);
    eq(R.parseNumber('-5'), -5, 'sign kept: the caller decides what is valid');
    eq(R.parseNumber('Infinity'), null);
  });

  test('risk.load / save: one store key (risk.inputs), saved text survives a round trip, no other key is touched', () => {
    eq(R.KEY, 'risk.inputs');
    var seen = {};
    var fake = { getItem: (k) => (k in seen ? seen[k] : null), setItem: (k, v) => { seen[k] = String(v); }, removeItem: (k) => { delete seen[k]; } };
    var saved = globalThis.localStorage;
    globalThis.localStorage = fake;
    try {
      eq(R.loadInputs(), R.DEFAULTS, 'nothing stored yet');
      R.saveInputs({ account: 25000, riskPct: 2, tightest: 12, widest: 30, tickValue: 5, halve: true, wr: null, rr: null, junk: 1 });
      eq(Object.keys(seen), ['tjr.risk.inputs'], 'only the one key');
      eq(JSON.parse(seen['tjr.risk.inputs']).junk, undefined, 'junk is not stored');
      eq(R.loadInputs().account, 25000);
      eq(R.loadInputs().halve, true);
      TJR.store.remove(R.KEY);
      seen['tjr.risk.inputs'] = '{not json';
      eq(R.loadInputs(), R.DEFAULTS, 'corrupt storage falls back');
      TJR.store.remove(R.KEY);
      seen['tjr.risk.inputs'] = JSON.stringify({ account: 'DROP', riskPct: 'x' });
      eq(R.loadInputs(), R.DEFAULTS);
    } finally { TJR.store.remove(R.KEY); globalThis.localStorage = saved; }
  });

  test('risk.fmt: numbers for the page, no currency symbol, tidy decimals', () => {
    eq(R.fmtNum(350), '350'); eq(R.fmtNum(1234567), '1,234,567'); eq(R.fmtNum(12.5), '12.5'); eq(R.fmtNum(0.1 + 0.2), '0.3');
    eq(R.fmtNum(2.345), '2.35', 'two decimals at most'); eq(R.fmtNum(NaN), '-');
    eq(R.fmtPct(0.7), '0.7%'); eq(R.fmtPct(3), '3%'); eq(R.fmtPct(0.3199999), '0.32%');
    eq(R.fmtR(0.5), '+0.50 R'); eq(R.fmtR(-0.2), '-0.20 R'); eq(R.fmtR(0), '0.00 R');
  });

  // ---------------------------------------------------------------- risk.html: the content rule and the hooks
  var html = readText('risk.html');
  var section = (id) => { var a = html.indexOf('id="' + id + '"'); ok(a >= 0, '#' + id + ' exists'); var b = html.indexOf('</section>', a); return html.slice(a, b); };

  test('risk.html: nothing from the excluded list, no clip #4, no clip #16, no images, no money symbol', () => {
    ['TJR40', 'Alpha', 'Tradeify', 'TradeZella', 'promo', 'โค้ดส่วนลด', 'payout', 'Payout'].forEach((w) => ok(html.indexOf(w) < 0, 'excluded: ' + w));
    ok(html.indexOf('$') < 0, 'no dollar sign: no income figure, no price');
    ok(html.indexOf('52nxvJKM57U') < 0 && !/data-fact="P4\./.test(html), 'funded accounts (#4) is context only: no chip');
    ok(html.indexOf('3GZgBBMzC_E') < 0, 'clip #16 is not used');
    ok(!/<img\b/i.test(html), 'no images: no TJR footage or screenshots');
    ok(!/\b\d{2,3},\d{3}\b/.test(html), 'no figures such as 150,000 / 3,000 (firm rule numbers)');
  });

  test('risk.html: every chip names its fact and links the start second of that fact in its own video; only #2, #15 and F9.1', () => {
    var anchors = (html.match(/<a\b[^>]*\bts-chip\b[^>]*>[^<]*<\/a>/g) || []);
    ok(anchors.length >= 50, 'chips present: ' + anchors.length);
    var starts = (id) => {
      var src = TJR.sources.forFact(id), file = id.charAt(0) === 'F' ? 'docs/source/clip-facts.md' : 'docs/source/playlist/' + src.id + '.md';
      var line = readText(file).split('\n').filter((l) => l.indexOf('- ' + id + ' ') === 0)[0];
      ok(line, id + ' is a fact');
      var all = line.match(/\(\d{1,2}:\d\d[^)]*\)/g), m = /\((\d{1,2}):(\d\d)/.exec(all[all.length - 1]);
      return Number(m[1]) * 60 + Number(m[2]);
    };
    var facts = {}, named = 0;
    anchors.forEach((a) => {
      var href = /href="https:\/\/youtu\.be\/([\w-]+)\?t=(\d+)"/.exec(a), id = (/data-fact="([FP]\d+\.\d+)"/.exec(a) || [])[1];
      ok(href, 'chip has a youtu.be link: ' + a);
      if (!id) return;
      named++; facts[id] = true;
      var src = TJR.sources.forFact(id);
      eq(href[1], src.id, id + ' links its own video');
      eq(Number(href[2]), starts(id), id + ' links the start of its range');
      ok(/\bts-chip--pl\b/.test(a) === !src.main, id + ' playlist chips are the outline kind');
      ok(src.clip === 2 || src.clip === 15 || id === 'F9.1', id + ' is from clip #2, clip #15, or F9.1');
      if (src.clip === 2 || src.clip === 15) ok(new RegExp('>#' + src.clip + ' \\d\\d:\\d\\d<').test(a), id + ' label is "#n MM:SS"');
    });
    eq(named, anchors.length, 'every chip names its fact');
    ['P2.1', 'P2.2', 'P2.3', 'P2.4', 'P2.5', 'P2.6', 'P2.7', 'P2.8', 'P2.9', 'P2.10'].forEach((id) => ok(facts[id], 'psychology fact ' + id));
    ['P15.12', 'P15.14', 'P15.16', 'P15.22', 'P15.33', 'P15.34', 'P15.35', 'P15.36', 'P15.37', 'P15.39', 'P2.16'].forEach((id) => ok(facts[id], 'mindset fact ' + id));
    ['P2.15', 'P2.17', 'P2.18', 'P2.19', 'P2.20', 'P2.21', 'P2.22', 'P2.23', 'P2.24', 'P2.25', 'P2.26', 'P2.29'].forEach((id) => ok(facts[id], 'sizing fact ' + id));
    ['P2.30', 'P2.33', 'P2.34', 'P2.35'].forEach((id) => ok(facts[id], 'funded fact ' + id));
  });

  test('risk.html: the six sections in order, each with an h2', () => {
    var ids = ['plans', 'skill', 'sizing', 'calc', 'funded', 'gaps'], last = -1;
    ids.forEach((id) => { var at = html.indexOf('<section class="rk-sec" id="' + id + '"'); ok(at > last, id + ' in order'); last = at; ok(section(id).indexOf('<h2') >= 0, id + ' has an h2'); });
    ok(html.indexOf('<h1') >= 0);
  });

  test('risk.html: his sizing method keeps the 1-3% sweet spot, the 1% earlier habit, and the not-5/10/20 line', () => {
    var s = section('sizing');
    ok(s.indexOf('1–3%') >= 0, 'the 1-3% sweet spot');
    ok(s.indexOf('data-fact="P2.21"') >= 0);
    ok(s.indexOf('3–4%') >= 0 && s.indexOf('data-fact="P2.24"') >= 0, 'his 3-4% at the widest stop');
    ok(/5%.*10%.*20%/.test(s), 'not 5, 10 or 20%');
    ok(s.indexOf('ตัวเลขจากเครื่องมือบนจอ ไม่ใช่ที่เขาพูด') >= 0, 'the on-screen readouts are labelled');
    ok(s.indexOf('คลิปไม่ได้ระบุ') >= 0, 'the contract count per instrument / account size is a gap');
    ok(s.indexOf('class="readout"') >= 0);
  });

  test('risk.html: his money claims carry "คำอ้างของเขา ยังไม่ยืนยัน", with no figure', () => {
    var s = section('plans');
    ok(s.indexOf('คำอ้างของเขา ยังไม่ยืนยัน') >= 0, 'claim label in the psychology section');
    ok(s.indexOf('data-fact="P2.12"') >= 0, 'P2.12 is the claim');
    var claim = s.slice(s.indexOf('class="claim"'), s.indexOf('</aside>', s.indexOf('class="claim"')));
    ok(claim.length > 40 && !/\d/.test(claim.replace(/<[^>]+>/g, '').replace(/#\d+ \d\d:\d\d/g, '')), 'no number in the claim box text');
  });

  test('risk.html: the calculator has the five inputs, the gap badge beside tick value, the halve toggle with both cases, and the notice', () => {
    var c = section('calc');
    ['account', 'risk', 'tight', 'wide', 'tick'].forEach((k) => {
      ok(c.indexOf('id="rk-' + k + '"') >= 0 && c.indexOf('for="rk-' + k + '"') >= 0, 'field ' + k + ' with a visible label');
    });
    var tick = c.slice(c.indexOf('for="rk-tick"') - 120, c.indexOf('id="rk-tick"') + 400);
    ok(tick.indexOf('badge-gap') >= 0 && tick.indexOf('คลิปไม่ได้ระบุ') >= 0, 'the gap badge sits beside tick value');
    ok(c.indexOf('ไม่ใช่คำแนะนำการลงทุน') >= 0, 'the not-advice notice sits in the calculator section');
    var tog = c.slice(c.indexOf('data-k="halve"') - 60, c.indexOf('data-k="halve"') + 700);
    ok(tog.indexOf('aria-pressed') >= 0, 'the halve toggle is a pressed button');
    ok(c.indexOf('stop-loss กว้างกว่าปกติมาก') >= 0 && c.indexOf('วันที่มีข่าว') >= 0, 'both of his cases name the toggle');
    ok(c.indexOf('data-fact="P2.26"') >= 0 && c.indexOf('data-fact="P2.19"') >= 0, 'chips: P2.26 for the halving, P2.19 for "he uses no calculator"');
    ok(c.indexOf('ไม่ใช่ของเขา') >= 0 || c.indexOf('ไม่ใช่เครื่องมือของเขา') >= 0, 'the calculator is the site\'s, not his');
    ['data-k="contracts"', 'data-k="loss-wide"', 'data-k="loss-tight"', 'role="status"'].forEach((k) => ok(c.indexOf(k) >= 0, k));
    // controls are real <input>s the page can read: number fields use inputmode, not type=number spinners
    eq((c.match(/<input[^>]*\binputmode="decimal"/g) || []).length >= 5, true, 'five decimal inputs');
  });

  test('risk.html: the funded accounts part is ONE paragraph, chips only to clip #2, no firm names or rule numbers', () => {
    var f = section('funded');
    eq((f.match(/<p\b/g) || []).length, 1, 'one paragraph');
    ['P2.30', 'P2.33', 'P2.34', 'P2.35'].forEach((id) => ok(f.indexOf('data-fact="' + id + '"') >= 0, id));
    (f.match(/youtu\.be\/([\w-]+)\?t=/g) || []).forEach((u) => ok(u.indexOf('hBnD6T1M4w8') >= 0, 'funded chips link clip #2: ' + u));
    ok(f.length < 2600, 'short');
    ok(!/\d/.test(f.replace(/<[^>]+>/g, '').replace(/#2 \d\d:\d\d/g, '')), 'no figures in the paragraph text');
  });

  test('risk.html: what no clip says is listed with the badge: max daily loss, trades per day, TP split, stop placement', () => {
    var g = section('gaps');
    ['ขาดทุนสูงสุดต่อวัน', 'จำนวนเทรดสูงสุดต่อวัน', 'สัดส่วน', 'stop-loss', 'tick value', 'win rate'].forEach((w) => ok(g.indexOf(w) >= 0, 'gap: ' + w));
    ok((g.match(/class="badge-gap"/g) || []).length >= 7, 'badge on every line');
  });

  test('risk.html: head, scripts in the plan\'s order, the page script last, one stylesheet for the page', () => {
    ok(html.indexOf('assets/css/pages/risk.css') >= 0);
    var order = ['core/ns', 'core/sources', 'core/store', 'scenario/rng', 'scenario/swings', 'scenario/gen', 'scenario/sessions', 'scenario/confluence',
      'scenario/library', 'scenario/system', 'scenario/annotate', 'scenario/grade', 'chart/scale', 'chart/render', 'chart/overlays', 'chart/chart', 'core/layout', 'core/motion', 'pages/risk'];
    var last = -1;
    order.forEach((p) => { var at = html.indexOf('assets/js/' + p + '.js'); ok(at > last, p + ' in order'); last = at; });
    ok(html.indexOf('<title>') >= 0 && html.indexOf('lang="th"') >= 0);
    ok(html.indexOf('data-tjr-layout="nav"') >= 0 && html.indexOf('aria-current="page"') >= 0, 'noscript nav marks the page');
    ok(/<noscript><header class="nav[^>]*>.*?href="risk\.html" aria-current="page"/.test(html), 'risk is the current page in the noscript nav');
    ok(html.indexOf('id="top"') >= 0, 'skip link target');
  });

  test('risk.js: the only store key is risk.inputs, and risk.css keeps every control at 44px', () => {
    var js = readText('assets/js/pages/risk.js'), css = readText('assets/css/pages/risk.css');
    var keys = (js.match(/store\.(?:get|set|remove)\(\s*([A-Za-z_.'"]+)/g) || []).map((m) => m.replace(/.*\(\s*/, ''));
    keys.forEach((k) => ok(k === 'KEY' || k === "'risk.inputs'", 'store key: ' + k));
    ok(/var KEY = 'risk\.inputs'/.test(js));
    ok(/min-height:\s*44px/.test(css), '44px controls');
    ok(/prefers-reduced-motion/.test(css) || /data-motion/.test(css), 'motion is guarded');
  });
})();
