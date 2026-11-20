/* TJR Liquidity: the scenario gallery controller (Task 11). Classic script, after the engine, layout and motion.
   Shows all 22 scenarios: S01-S14 (Level 1, the liquidity clip) and S15-S22 (Level 2, the playlist; system.js).

   1. pure helpers on TJR.gallery (no DOM, tested in Node by tests/scenarios.test.js):
      parseHash / kindOf / levelOf / filterIds   the URL hash (#S06 ... #S22) and the card filters (Level 1 / Level 2 too)
      factSec / FACT_SEC / noteChip              clip second of each fact a scenario note cites (F ids: main clip,
                                                 P ids: the playlist video, read from the scenario's facts / clip lists)
      clipsOf                                    the chips on a card: the library's plus the page's extras (S05: P12.27-P12.28)
      milestones / l2Rows                        Level 2 phase pills and the side panel's chain, read from truth
      modeOf / twinBuilt / twinOverlays          S21 opens in TJR.chart.twin (ES and NQ side by side)
      setupStart / confluenceOverlays            the "อ่าน confluence" overlays (TJR.annotate.confluence), setup stretch only
      tfOptions / seriesIndex / baseEnd          the timeframe switch: base <-> rolled-up bar indices
      visibleNotes / playRate                    notes known at a bar, playback speed
   2. page: the card grid (previews drawn on small canvases, not engine charts), the viewer (ONE engine chart, or the
      twin pair for S21, built with TJR.scenarios.safeBuild, annotated with TJR.annotate), hash routing (back closes it).
   Notes and clip chips come from TJR.scenarios (list, truth.notes); only the no-trade reasons and the verdict wording
   are written here, each with its chip. Nothing here assumes a planned entry bar: Level 2 truth is read from candles. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var doc = global.document;
  var G = TJR.gallery = TJR.gallery || {};

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ================================================================ 1 · pure helpers

  // every registered scenario in library order: S01-S14 (library.js) then S15-S22 (system.js)
  var IDS = TJR.scenarios.list.map(function (d) { return d.id; });
  function levelOf(id) { return Number(String(id).slice(1)) >= 15 ? 2 : 1; }
  var SESSION_IDS = ['S06', 'S07', 'S08', 'S09'];       // charts built on session highs / lows
  var HTF_IDS = ['S05', 'S10', 'S11'];                   // daily, 4H highs, 4H high vs a 5m high
  var SHORT_IDS = ['S03', 'S10', 'S16', 'S17'];         // the trade scenarios that go short
  var EITHER_IDS = ['S21'];                              // the seed decides: bearish SMT at a high (short) or bullish at a low (long)
  var TWIN_IDS = ['S21'];                                // opens as an ES / NQ pair (truth.twin)
  var SEEDS = { S01: 1, S02: 5, S03: 4, S04: 2, S05: 3, S06: 6, S07: 7, S08: 2, S09: 3, S10: 5, S11: 4, S12: 2, S13: 3, S14: 6,
                S15: 1, S16: 1, S17: 1, S18: 1, S19: 1, S20: 1, S21: 1, S22: 1 };
  var TF_CHOICES = { S09: [1, 5, 15], S10: [5, 15, 60, 240], S11: [5, 15, 60, 240] };
  var TF_NAME = { 1: '1m', 5: '5m', 15: '15m', 60: '1H', 240: '4H', 1440: 'D' };
  var D4_TEXT = 'คลิปไม่ได้บอกวิธีจัดการเมื่อ confirmation ล้ม';
  var D4_L2 = 'คลิปไม่ได้บอกวิธีจัดการเมื่อ setup ล้ม';
  // the Level 2 verdict cites two caption starts of clip #1: the four-part chain (P1.19 at 35:44) and how he confirms
  // the entry out of a gap or equilibrium (P1.44 at 32:55)
  var L2_CHIPS = { chain: [1, 2144], entry: [1, 1975] };
  // chips a card gains on top of the library's: S05's equal highs / lows are P12.27-P12.28 (clip #12, 38:00 and 38:21)
  var EXTRA_CLIPS = { S05: [{ clip: 12, sec: 2280 }, { clip: 12, sec: 2301 }] };
  function clipsOf(d) { return EXTRA_CLIPS[d.id] ? d.clip.concat(EXTRA_CLIPS[d.id]) : d.clip; }

  // seconds in the clip where each fact a note cites begins (clip-facts.md; same seconds as the course page)
  var FACT_SEC = {
    'F5.3': 1170, 'F5.4': 1215, 'F5.5': 1230, 'F6.2': 1350, 'F6.3': 1350, 'F6.4': 1395, 'F6.5': 1410, 'F6.6': 1440,
    'F6.7': 1485, 'F6.8': 1530, 'F6.9': 1575, 'F7.4': 1710, 'F7.5': 1755, 'F7.6': 1785, 'F7.10': 2085, 'F7.12': 2160,
    'F7.13': 2205, 'F7.14': 2250, 'F7.15': 2295, 'F8.3': 2520, 'F8.4': 2565, 'F8.5': 2655, 'F8.6': 2700,
    'F8.7': 2790, 'F8.8': 2835
  };
  // F9.2 lists what the clip does NOT say: a note citing it shows the gap badge, not a chip
  function factSec(f) { return Object.prototype.hasOwnProperty.call(FACT_SEC, f) ? FACT_SEC[f] : null; }
  // playlist facts: every Level 2 scenario lists its facts and clip chips side by side (same order), which gives the
  // second of each P id (a scenario's notes may cite a P id another scenario lists, e.g. P1.51)
  var plMap = null;
  function plChip(f) {
    if (!plMap) {
      plMap = {};
      TJR.scenarios.list.forEach(function (d) {
        (d.facts || []).forEach(function (id, i) {
          var c = d.clip && d.clip[i];
          if (c && typeof c === 'object' && !plMap[id]) plMap[id] = { clip: c.clip, sec: c.sec };
        });
      });
    }
    return Object.prototype.hasOwnProperty.call(plMap, f) ? { clip: plMap[f].clip, sec: plMap[f].sec } : null;
  }
  // the chip a note's fact gets: {sec} (main clip), {clip, sec} (playlist) or null (F9.2 and anything unknown: the gap badge)
  function noteChip(f) {
    if (/^P\d/.test(f)) return plChip(f);
    var s = factSec(f);
    return s == null ? null : { sec: s };
  }

  function parseHash(h) {
    var m = /^#?(S(?:0[1-9]|1[0-9]|2[0-2]))$/i.exec(String(h == null ? '' : h).trim());
    return m ? m[1].toUpperCase() : null;
  }
  function kindOf(def) {
    return {
      trade: def.outcomes.length > 0, fail: def.outcomes.indexOf('fail') >= 0,
      session: SESSION_IDS.indexOf(def.id) >= 0, htf: HTF_IDS.indexOf(def.id) >= 0,
      side: def.outcomes.length ? (EITHER_IDS.indexOf(def.id) >= 0 ? 'either' : SHORT_IDS.indexOf(def.id) >= 0 ? 'short' : 'long') : null
    };
  }
  // ids of the scenarios a filter keeps, in library order
  function filterIds(list, key) {
    return list.filter(function (d) {
      var k = kindOf(d);
      return key === 'l1' ? levelOf(d.id) === 1 : key === 'l2' ? levelOf(d.id) === 2
        : key === 'trade' ? k.trade : key === 'notrade' ? !k.trade : key === 'session' ? k.session : key === 'htf' ? k.htf : true;
    }).map(function (d) { return d.id; });
  }
  function tfOptions(id) { return (TF_CHOICES[id] || []).slice(); }

  // base bar b -> index of the series bar that holds it (the last series bar starting at or before b's time)
  function seriesIndex(base, series, b) {
    if (series === base) return b;
    var t = base[clamp(b, 0, base.length - 1)].t, lo = 0, hi = series.length - 1;
    while (lo < hi) { var m = (lo + hi + 1) >> 1; if (series[m].t <= t) lo = m; else hi = m - 1; }
    return lo;
  }
  // series bar j -> the last base bar inside it
  function baseEnd(base, series, j) {
    if (series === base) return j;
    if (j + 1 >= series.length) return base.length - 1;
    var t = series[j + 1].t, lo = 0, hi = base.length - 1;
    while (lo < hi) { var m = (lo + hi) >> 1; if (base[m].t >= t) hi = m; else lo = m + 1; }
    return Math.max(0, lo - 1);
  }
  // the base bar the side panel may show: the end of series bar j, but never past `known`
  // (after a TF switch mid-bucket the chart draws a partial candle only up to the known base bar)
  function panelBar(base, series, j, known) {
    var e = baseEnd(base, series, j);
    return known == null ? e : Math.min(e, known);
  }
  // notes known once base bar b is on screen, in bar order
  function visibleNotes(notes, b) {
    return notes.filter(function (n) { return n.bar <= b; }).sort(function (x, y) { return x.bar - y.bar; });
  }
  // bars per second so a run lasts about 14 s at 1x (6..60 bars/s before the speed factor)
  function playRate(span, speed) { return clamp(span / 14, 6, 60) * (speed || 1); }
  // the first bar worth starting on: levels known, well before the sweep (same rule as the course page)
  function startBar(b) {
    var T = b.truth, n = b.candles.length, known = 0;
    var sweep = T.sweep ? T.sweep.bar : T.confluence && T.confluence.origin != null ? T.confluence.origin : n - 1;   // S21 has no sweep: its SMT is the start
    (T.levels || []).forEach(function (l) { if (l.known != null && l.known < sweep && l.known > known) known = l.known; });
    return clamp(Math.max(known + 1, Math.floor(n * 0.22)), 0, Math.max(0, sweep - 6));
  }

  // why a scenario carries no trade: authored here, every sentence a paraphrase of the cited facts
  var NOTRADE = {
    S04: { text: 'ไม่มีเทรดที่นี่ low โดนกวาดแล้วราคายังลงต่อ ไม่มีเทรนด์ขาขึ้นใหม่ จึงไม่มี confirmation ใครกด buy ทันทีจะติด drawdown และการทะลุ low เป็นแค่โอกาส ไม่ใช่สัญญาณ', secs: [1350, 1230], gap: null },
    S05: { text: 'ไม่มีเทรดที่นี่ กราฟรายวันนี้ในคลิปใช้ดู liquidity ที่ถูกวิ่งเก็บทั้งสองด้าน equal highs ก่อน แล้ว lows ตามมา เว็บนี้จึงไม่ทำเครื่องหมายจุดเข้า ส่วนคลิป #12 ในเพลย์ลิสต์อธิบายเรื่อง equal highs / lows ว่า high สองตัวที่ราคาเท่ากันหรือเกือบเท่ากันมีน้ำหนักมากกว่า high ตัวเดียว', secs: [1170], pl: [[12, 2280], [12, 2301]], gap: 'ระยะที่นับว่า equal' },
    S06: { text: 'เว็บนี้ไม่ทำเครื่องหมายจุดเข้าในวันนี้ คลิปเล่าลำดับ session ว่า London เก็บ Asia low, NY เก็บ London low แล้วราคาวิ่งเก็บ Asia high กับ previous-day high และบอกว่าเทรดจบแล้ว แต่ไม่ได้บอกจุดเข้าออก', secs: [2085, 2160], gap: 'จุดเข้าและออกของวันนี้' },
    S07: { text: 'เว็บนี้ไม่ทำเครื่องหมายจุดเข้าในวันนี้ ตัวอย่างใช้ดูว่า NY pre-market เก็บ London low แล้ว NY ขึ้นทั้งวัน อยากดูจุดเข้าแบบเต็ม ให้เปิด S09', secs: [2205], gap: 'จุดเข้าของวันนี้', link: 'S09' },
    S08: { text: 'เว็บนี้ไม่ทำเครื่องหมายจุดเข้าในวันนี้ คลิปใช้วันจันทร์นี้ให้เห็นว่าตลาดวิ่งหา session highs และ lows ที่มาร์กไว้ ไม่ได้บอกจุดเข้า', secs: [2295], gap: 'จุดเข้าของวันนี้' },
    S11: { text: 'ไม่มีเทรดที่นี่ ตัวอย่างเทียบน้ำหนัก high ของ 5m แตกแล้วเกิดขาลงสั้น ๆ คลิปคาดว่าไม่น่ายืน ส่วน liquidity ของ HTF มีน้ำหนักกว่า', secs: [1755], gap: 'จุดเข้าของตัวอย่างนี้' },
    // Level 2 (system.js): the reasons are the scenario summaries, chipped with the scenario's own playlist clips
    S18: { text: 'ไม่มีเทรด short ที่นี่ หลัง BOS ลงเกิด bearish gap ราคาขึ้นมาเข้า gap มีแท่งแดงตีกลับ แต่แท่งเขียวใหญ่ปิดเหนือ gap gap จึงโดน disrespect จะ short ต่อไม่ได้ และ bias เปลี่ยน', secs: [], pl: [[10, 928], [3, 155], [3, 484]], gap: null },
    S20: { text: 'ไม่มีเทรดตรงไส้ ในขาขึ้น ไส้เทียนแทงลงใต้ low ที่เฝ้าอยู่ลึกมากแต่แท่งปิดเหนือ low ไม่ใช่ break of structure ยังเป็นขาขึ้น break จริงมาทีหลังเมื่อแท่งปิดใต้ low ล่าสุด', secs: [], pl: [[11, 502], [11, 535]], gap: null }
  };

  // the tag a no-trade scenario carries: where the clip itself says there is no trade, "ไม่มีเทรด"; where it only gives
  // the day's story and no entry (S06 even says the trade is done, F7.12), the gap wording instead
  var NO_ENTRY_IDS = ['S06', 'S07', 'S08'];
  function noTradeTag(id) { return NO_ENTRY_IDS.indexOf(id) >= 0 ? 'คลิปไม่ได้ระบุจุดเข้า' : 'ไม่มีเทรด'; }

  // ---- Level 2 (S15-S22): phases, side-panel rows, twin view, confluence overlays. All of it is read from truth / candles.

  // the pills over the chart, in bar order: [{key, label, bar}]. Level 1: sweep / confirm / entry as in v1.
  function milestones(T) {
    var K = T.confluence, out;
    if (!K) {
      out = [{ key: 'sweep', label: 'sweep', bar: T.sweep ? T.sweep.bar : null }];
      if (T.side) out.push({ key: 'confirm', label: 'confirm', bar: T.confirmBar }, { key: 'entry', label: 'entry', bar: T.entryWindow.from });
      return out;
    }
    out = [];
    if (T.smt) out.push({ key: 'smt', label: 'SMT', bar: T.smt.at });
    if (T.sweep) out.push({ key: 'sweep', label: 'sweep', bar: T.sweep.bar });
    if (K.noTrade) out.push({ key: 'nt', label: K.noTrade.kind === 'wick' ? 'ไส้ทะลุ' : 'gap โดนปิด', bar: K.noTrade.at });
    if (K.confirm) out.push({ key: 'confirm', label: K.confirm.kind.toUpperCase(), bar: K.confirm.at });
    if (K.cont) out.push({ key: 'cont', label: K.cont.kind === 'eq' ? 'EQ' : 'FVG', bar: K.cont.at });
    if (K.entry) out.push({ key: 'entry', label: 'entry', bar: K.entry.at });
    return out.map(function (x, i) { x.o = i; return x; })
      .sort(function (a, b) { return a.bar - b.bar || a.o - b.o; })
      .map(function (x) { return { key: x.key, label: x.label, bar: x.bar }; });
  }

  function stampOf(t) { return TJR.sessions.fmtET(t) + ' ET · ' + TJR.sessions.fmtThai(t) + ' น.'; }
  function levelName(T, id) {
    var l = (T.levels || []).filter(function (x) { return x.id === id; })[0];
    return l ? l.label : id;
  }
  function px(v) { return TJR.util.fmtPrice(v); }
  // the chain of a Level 2 trade as known at base bar `at`: a row's text is null until its bar (nothing shown early)
  function l2Rows(b, at) {
    var T = b.truth, K = T.confluence, cs = b.candles, rows = [], long = T.side === 'long';
    function add(key, label, bar, fn) { rows.push({ key: key, label: label, bar: bar, text: bar <= at ? fn() : null }); }
    if (T.smt) add('smt', 'SMT', T.smt.at, function () {
      var lead = T.smt.leader === 'main' ? b.meta.instrument : T.twin.instrument;
      var low = T.smt.kind === 'low';
      return (low ? 'bullish SMT ที่ low: ' + lead + ' ทำ higher low นำ' : 'bearish SMT ที่ high: ' + lead + ' ทำ lower high นำ') + ' · ' + stampOf(cs[T.smt.at].t);
    });
    if (T.sweep) add('sweep', 'sweep', T.sweep.bar, function () { return levelName(T, T.sweep.levelId) + ' · ' + stampOf(cs[T.sweep.bar].t); });
    var c = K.confirm;
    add('confirm', 'confirmation', c.at, function () {
      return (c.kind === 'bos' ? 'BOS ' + (c.dir === 'up' ? 'ขึ้น ปิดเหนือ ' : 'ลง ปิดใต้ ') + px(c.level.price)
        : 'inverse FVG ' + px(c.low) + '–' + px(c.high) + ' โดนปิดทะลุ') + ' · ' + stampOf(cs[c.at].t);
    });
    var k = K.cont;
    add('cont', 'continuation', k.at, function () {
      return (k.kind === 'fvg' ? (k.dir === 'bull' ? 'bull' : 'bear') + ' FVG ' + px(k.low) + '–' + px(k.high)
        : 'equilibrium 0.5 = ' + px(k.eq) + ' (' + px(k.low) + '–' + px(k.high) + ')') + ' · ' + stampOf(cs[k.at].t);
    });
    add('entry', 'เข้า ' + (long ? 'long' : 'short'), K.entry.at, function () {
      return 'แท่งปิดกลับตามเทรนด์ที่ ' + px(K.entry.price) + ' · ' + stampOf(cs[K.entry.at].t);
    });
    add('target', 'เป้า', K.entry.at, function () { return px(K.targets[0].price) + ' · ' + levelName(T, K.targets[0].levelId); });
    return rows;
  }

  function modeOf(id) { return TWIN_IDS.indexOf(id) >= 0 ? 'twin' : 'single'; }
  // the second chart of S21 as a built scenario (candles + meta; no truth: the main chart carries it)
  function twinBuilt(b) { return { candles: b.truth.twin.candles, meta: Object.assign({}, b.meta, { instrument: b.truth.twin.instrument }) }; }
  // the SMT line (high 1 -> high 2) of one chart of the pair, with its two labels; both appear when the second high is known
  function twinOverlays(b, which) {
    var s = b.truth.smt, p = s[which], tag = which === 'main' ? 'm' : 't', low = s.kind === 'low', up = p.p2.price > p.p1.price;
    return [
      { id: 'smt-l-' + tag, type: 'trend', a: { bar: p.p1.bar, price: p.p1.price }, b: { bar: p.p2.bar, price: p.p2.price }, appearAt: s.at },
      { id: 'smt-1-' + tag, type: 'label', bar: p.p1.bar, price: p.p1.price, text: low ? 'low แรก' : 'high แรก', pos: low ? 'below' : 'above', appearAt: s.at },
      { id: 'smt-2-' + tag, type: 'label', bar: p.p2.bar, price: p.p2.price, text: low ? (up ? 'higher low' : 'lower low') : (up ? 'higher high' : 'lower high'), pos: low ? 'below' : 'above', appearAt: s.at }
    ];
  }

  // where the confluence overlays start: a few bars before the sweep (S21: before the SMT highs). Detectors on random
  // candles are dense (13-29 gaps in 80 bars), so only the setup's stretch is drawn.
  function setupStart(b) {
    var T = b.truth, ref = T.sweep ? T.sweep.bar : T.confluence && T.confluence.origin != null ? T.confluence.origin : 0;
    return Math.max(0, Math.min(ref, b.candles.length - 1) - 6);
  }
  function confluenceOverlays(b, upTo) {
    var from = setupStart(b);
    return TJR.annotate.confluence(b, { upTo: upTo, show: { windows: !!b.truth.windows } }).filter(function (o) {
      return o.type === 'fvg' ? o.to >= from : o.type === 'bos' ? o.at >= from : o.type === 'eq' ? o.endAt == null || o.endAt > from : true;
    });
  }

  G.IDS = IDS; G.FACT_SEC = FACT_SEC; G.D4 = D4_TEXT; G.D4_L2 = D4_L2; G.L2_CHIPS = L2_CHIPS; G.NOTRADE = NOTRADE; G.noTradeTag = noTradeTag; G.SEEDS = SEEDS;
  G.parseHash = parseHash; G.kindOf = kindOf; G.levelOf = levelOf; G.filterIds = filterIds; G.factSec = factSec; G.noteChip = noteChip; G.clipsOf = clipsOf;
  G.tfOptions = tfOptions; G.milestones = milestones; G.l2Rows = l2Rows; G.modeOf = modeOf; G.twinBuilt = twinBuilt; G.twinOverlays = twinOverlays;
  G.setupStart = setupStart; G.confluenceOverlays = confluenceOverlays;
  G.seriesIndex = seriesIndex; G.baseEnd = baseEnd; G.panelBar = panelBar; G.visibleNotes = visibleNotes; G.playRate = playRate; G.startBar = startBar;

  if (!doc || !TJR.layout || !TJR.chart || !TJR.chart.create) return;   // Node (tests): helpers only

  // ================================================================ 2 · page
  var M = TJR.motion.init();
  TJR.layout.mount({
    page: 'scenarios',
    close: { title: 'ฝึกอ่านกราฟเอง', line: 'ตัดสินใจทีละแท่งบนกราฟสุ่ม แล้วตรวจคำตอบตามคลิป', label: 'เปิดแบบฝึก', href: 'lab.html' }
  });

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function stamp(t) { return TJR.sessions.fmtET(t) + ' ET · ' + TJR.sessions.fmtThai(t) + ' น.'; }
  // a list of chips: a number is a second of the main clip, {clip, sec} a playlist chip (▶ #<clip> MM:SS)
  function chipsHtml(list) {
    return (list || []).map(function (s) { return typeof s === 'object' ? TJR.layout.chip(s.sec, s.clip) : TJR.layout.chip(s); }).join('');
  }
  function plChips(pairs) { return chipsHtml((pairs || []).map(function (p) { return { clip: p[0], sec: p[1] }; })); }
  function setPressed(btn, on) { btn.setAttribute('aria-pressed', String(!!on)); }
  function defOf(id) { return TJR.scenarios.get(id); }
  function buildFor(id, seed, outcome) {
    return TJR.scenarios.safeBuild(defOf(id), seed, outcome ? { outcome: outcome } : {});
  }

  var gallery = $('#gallery'), viewer = $('#viewer'), grid = $('[data-k="grid"]'), count = $('[data-k="count"]');
  var seeds = {}, outcomes = {};                          // remembered per scenario while the page lives
  var V = null;                                           // the open viewer, or null
  var filterKey = 'all';

  // ---------------------------------------------------------------- the cards
  var SIDE_TAG = { long: ['tag--long', 'Long'], short: ['tag--short', 'Short'], either: ['tag--none', 'Long / Short'] };
  function cardHtml(d) {
    var lv = levelOf(d.id), k = kindOf(d), tags = '<span class="level-tag" data-level="' + lv + '">L' + lv + '</span>';
    tags += k.trade
      ? '<span class="tag ' + SIDE_TAG[k.side][0] + '">' + SIDE_TAG[k.side][1] + '</span>' + (k.fail ? '<span class="tag">มีแบบ ' + (lv === 2 ? 'setup' : 'confirmation') + ' ล้ม</span>' : '')
      : '<span class="tag tag--none">' + noTradeTag(d.id) + '</span>';
    if (k.session) tags += '<span class="tag">Session</span>';
    if (k.htf) tags += '<span class="tag">HTF</span>';
    return '<li class="card sc" id="' + d.id + '" data-id="' + d.id + '">' +
      '<div class="sc__fig"><canvas class="sc__cv" aria-hidden="true"></canvas><span class="sc__id">' + d.id + '</span>' +
      '<span class="sc__tf">' + d.instrument + ' · ' + TF_NAME[d.tf] + '</span></div>' +
      '<h3><a class="sc__link" href="#' + d.id + '">' + d.title + '</a></h3>' +
      '<div class="sc__tags">' + tags + '</div>' +
      '<p class="sc__meta chips">' + chipsHtml(clipsOf(d)) + '</p></li>';
  }
  function buildCards() {
    grid.innerHTML = TJR.scenarios.list.map(cardHtml).join('');
  }

  // a small drawn preview: the close line of the chart each card opens, the sweep dot, the entry window.
  // Drawn once, lazily, a card at a time; the line draws in left to right unless motion is reduced.
  var thumbs = {};                                        // id -> { cv, pts, sweep, win, side }
  function themeColor(name, fb) {
    try { var v = global.getComputedStyle(doc.documentElement).getPropertyValue(name).trim(); return v || fb; } catch (e) { return fb; }
  }
  function thumbData(id) {
    var d = defOf(id), b = buildFor(id, SEEDS[id], null), T = b.truth, cs = b.candles, n = cs.length;
    var lo = Infinity, hi = -Infinity;
    cs.forEach(function (k) { if (k.l < lo) lo = k.l; if (k.h > hi) hi = k.h; });
    var step = Math.max(1, Math.floor(n / 160)), pts = [];
    for (var i = 0; i < n; i += step) pts.push([i / (n - 1), (cs[i].c - lo) / (hi - lo)]);
    pts.push([1, (cs[n - 1].c - lo) / (hi - lo)]);
    var sw = T.sweep, w = T.entryWindow, sweep = null;
    if (sw) {
      var lv = T.levels.filter(function (l) { return l.id === sw.levelId; })[0];
      var price = lv && lv.side === 'high' ? cs[sw.bar].h : cs[sw.bar].l;
      sweep = [sw.bar / (n - 1), (price - lo) / (hi - lo)];
    }
    return { n: n, pts: pts, side: T.side, sweep: sweep, win: w ? [w.from / (n - 1), w.to / (n - 1)] : null, def: d };
  }
  function drawThumb(t, p) {
    var cv = t.cv, w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    var dpr = global.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    var padX = 10, padT = 28, padB = 12, iw = w - padX * 2, ih = h - padT - padB;
    function X(f) { return padX + f * iw; }
    function Y(f) { return padT + (1 - f) * ih; }
    var d = t.data, txt = themeColor('--c-text', '#f1f1ef'), liq = themeColor('--c-liq', '#f5b544');
    var bull = themeColor('--c-bull', '#2fcf86'), bear = themeColor('--c-bear', '#f6626a');
    if (d.win) {
      c.fillStyle = (d.side === 'short' ? bear : bull); c.globalAlpha = 0.16;
      c.fillRect(X(d.win[0]), padT, Math.max(2, X(d.win[1]) - X(d.win[0])), ih);
      c.globalAlpha = 1;
    }
    c.save();
    c.beginPath(); c.rect(0, 0, padX + p * iw + 1, h); c.clip();
    c.strokeStyle = txt; c.globalAlpha = 0.9; c.lineWidth = 1.5; c.lineJoin = 'round'; c.beginPath();
    d.pts.forEach(function (q, i) { if (i) c.lineTo(X(q[0]), Y(q[1])); else c.moveTo(X(q[0]), Y(q[1])); });
    c.stroke();
    c.restore();
    if (d.sweep && p >= d.sweep[0]) {
      c.globalAlpha = 1; c.fillStyle = liq; c.beginPath(); c.arc(X(d.sweep[0]), Y(d.sweep[1]), 4, 0, 6.2832); c.fill();
      c.strokeStyle = liq; c.globalAlpha = 0.35; c.lineWidth = 1; c.beginPath(); c.arc(X(d.sweep[0]), Y(d.sweep[1]), 8, 0, 6.2832); c.stroke();
      c.globalAlpha = 1;
    }
  }
  function paintThumb(id, delay) {
    var li = $('.sc[data-id="' + id + '"]', grid);
    if (!li) return;
    var t = thumbs[id];
    if (!t) {
      var data;
      try { data = thumbData(id); } catch (e) { if (global.console) console.error(e); return; }
      t = thumbs[id] = { cv: $('.sc__cv', li), data: data, done: false };
    }
    if (M.reduced || !global.requestAnimationFrame || t.done) { t.done = true; drawThumb(t, 1); return; }
    var t0 = null, dur = 700;
    function frame(ts) {
      if (t0 == null) t0 = ts + delay;
      var p = clamp((ts - t0) / dur, 0, 1);
      var e = 1 - Math.pow(1 - p, 3);
      drawThumb(t, e);
      if (p < 1) global.requestAnimationFrame(frame); else t.done = true;
    }
    global.requestAnimationFrame(frame);
  }
  function initThumbs() {
    var seen = {}, order = 0;
    function go(id) { if (seen[id]) return; seen[id] = true; paintThumb(id, (order++ % 4) * 90); }
    if (!global.IntersectionObserver) { IDS.forEach(function (id) { go(id); }); return; }
    var io = new global.IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { go(e.target.getAttribute('data-id')); io.unobserve(e.target); } });
    }, { rootMargin: '120px 0px' });
    $$('.sc', grid).forEach(function (li) { io.observe(li); });
    var rt = 0;
    global.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { Object.keys(thumbs).forEach(function (id) { if (thumbs[id].done) drawThumb(thumbs[id], 1); }); }, 150);
    });
  }

  // ---------------------------------------------------------------- filters
  function applyFilter(key, save) {
    filterKey = key;
    var keep = filterIds(TJR.scenarios.list, key);
    $$('.sc', grid).forEach(function (li) { li.hidden = keep.indexOf(li.getAttribute('data-id')) < 0; });
    $$('[data-f]').forEach(function (b) { setPressed(b, b.getAttribute('data-f') === key); });
    if (count) count.textContent = 'แสดง ' + keep.length + ' จาก ' + IDS.length + ' สถานการณ์';
    if (save) TJR.store.set('scenarios.filter', key);
  }
  function initFilters() {
    var saved = TJR.store.get('scenarios.filter', 'all');
    $$('[data-f]').forEach(function (b) {
      var key = b.getAttribute('data-f'), n = filterIds(TJR.scenarios.list, key).length;
      b.innerHTML = b.textContent + ' <span class="ctrl__n">' + n + '</span>';
      b.addEventListener('click', function () { applyFilter(key, true); });
    });
    applyFilter(['all', 'l1', 'l2', 'trade', 'notrade', 'session', 'htf'].indexOf(saved) >= 0 ? saved : 'all', false);
  }

  // ---------------------------------------------------------------- the viewer
  var el = {
    vid: $('[data-k="vid"]'), title: $('[data-k="vtitle"]'), sum: $('[data-k="vsum"]'), chips: $('[data-k="vchips"]'),
    sym: $('[data-k="sym"]', viewer), tf: $('[data-k="tf"]', viewer), meta: $('[data-k="meta"]', viewer),
    phases: $('[data-k="phases"]'), play: $('[data-act="play"]', viewer), ann: $('[data-act="ann"]', viewer),
    verdict: $('[data-k="verdict"]'), notes: $('[data-k="notes"]'), nohint: $('[data-k="nohint"]'),
    tfg: $('[data-k="tfg"]'), og: $('[data-k="og"]'), seed: $('[data-k="seed"]'), prev: $('[data-k="prev"]'), next: $('[data-k="next"]'),
    conf: $('[data-act="conf"]', viewer), failbtn: $('[data-k="failbtn"]', viewer), stage: $('[data-k="stage"]', viewer),
    hostA: $('[data-k="hostA"]', viewer), hostB: $('[data-k="hostB"]', viewer), paneB: $('[data-k="paneB"]', viewer),
    lblA: $('[data-k="lblA"]', viewer), lblB: $('[data-k="lblB"]', viewer)
  };

  function setPlay(label, on) {
    var lab = $('[data-k="lab"]', el.play);
    if (lab) lab.textContent = label;
    el.play.setAttribute('data-state', on ? 'on' : 'off');
  }
  function levelLabel(T, id) { return levelName(T, id); }

  // the side panel: a trade (long / short, entry window, target) or the plain statement that there is none
  function verdictHtml(b) {
    var B = V.built, T = B.truth, d = V.def, h;
    if (!T.side) {
      var nt = NOTRADE[d.id];
      h = '<div class="verdict__top"><span class="tag tag--none">' + noTradeTag(d.id) + '</span></div>' +
        '<p>' + nt.text + ' <span class="chips">' + chipsHtml(nt.secs) + plChips(nt.pl) + '</span></p>' +
        (nt.link ? '<p><a class="btn btn--secondary" href="#' + nt.link + '">เปิด ' + nt.link + '</a></p>' : '') +
        (nt.gap ? '<p class="verdict__gap">' + nt.gap + ' ' + TJR.layout.gap() + '</p>' : '');
      return h;
    }
    if (T.confluence) return verdictL2(b);
    var long = T.side === 'long', w = T.entryWindow, base = V.base;
    var stage = b < w.from ? 0 : b < w.to ? 1 : 2;
    var swing = long ? 'HH' : 'LL', seeSec = long ? 1410 : 1530;
    var win = stage === 0 ? '<span class="muted">ยังไม่ถึง เล่นต่อเพื่อดู</span>'
      : stage === 1 ? '<b>เปิดอยู่</b> ตั้งแต่ ' + stamp(base[w.from].t)
      : stamp(base[w.from].t) + '<br>ถึง ' + stamp(base[w.to].t);
    var tgt = stage === 0 ? '<span class="muted">ยังไม่ถึง</span>'
      : TJR.util.fmtPrice(T.target.price) + ' · ' + levelLabel(T, T.target.levelId);
    h = '<div class="verdict__top"><span class="tag ' + SIDE_TAG[T.side][0] + '">' + SIDE_TAG[T.side][1] + '</span><span class="tag">มีเทรด</span>' +
      (T.outcome === 'fail' ? '<span class="tag tag--fail">confirmation ล้ม</span>' : '') + '</div>';
    if (T.outcome === 'fail') h += '<p class="verdict__d4"><span class="badge-gap">' + D4_TEXT + '</span></p>';
    h += '<dl class="kv"><div><dt>ช่วงเข้า</dt><dd>' + win + '</dd></div><div><dt>เป้า</dt><dd>' + tgt + '</dd></div>' +
      '<div><dt>จุดเข้าเป๊ะ ๆ</dt><dd>' + TJR.layout.gap() + ' ' + TJR.layout.chip(1485) + '</dd></div></dl>';
    h += '<p class="verdict__why">ช่วงเข้านี้เป็นการอ่านของเว็บนี้จากตัวอย่างในคลิป เริ่มที่ pullback แรกหลัง ' + swing +
      ' เกิด และจบเมื่อราคาทะลุ ' + swing + ' นั้นอีกครั้ง คลิปชี้ average entry บน pullback โดยไม่ให้กฎเป๊ะ ' + TJR.layout.chip(seeSec) + '</p>';
    return h;
  }
  // Level 2 trade: the chain as far as it is known (rows from l2Rows), the entry rule with its chips, the one thing the clips leave out
  function verdictL2(b) {
    var B = V.built, T = B.truth, rows = l2Rows(B, b), fail = T.outcome === 'fail';
    var h = '<div class="verdict__top"><span class="tag ' + SIDE_TAG[T.side][0] + '">' + SIDE_TAG[T.side][1] + '</span><span class="tag">มีเทรด</span>' +
      (fail ? '<span class="tag tag--fail">setup ล้ม</span>' : '') + '</div>';
    if (fail) h += '<p class="verdict__d4"><span class="badge-gap">' + D4_L2 + '</span></p>';
    h += '<dl class="kv">' + rows.map(function (r) {
      return '<div><dt>' + r.label + '</dt><dd>' + (r.text != null ? r.text : '<span class="muted">ยังไม่ถึง เล่นต่อเพื่อดู</span>') + '</dd></div>';
    }).join('') + '<div><dt>จุดเข้าเป๊ะ ๆ</dt><dd>' + TJR.layout.gap() + ' ' + plChips([L2_CHIPS.entry]) + '</dd></div></dl>';
    h += '<p class="verdict__why">ลำดับนี้ตามสี่ส่วนที่เขาสรุปไว้: sweep ของ high หรือ low สำคัญ → confirmation (BOS หรือ inverse FVG) → continuation (FVG หรือ equilibrium) → ออกที่ liquidity ฝั่งตรงข้าม ' +
      plChips([L2_CHIPS.chain]) + ' เขารอให้ราคาเข้า confluence แล้วเข้าหลังแท่งยืนยันที่ออกมาจากมัน ไม่เข้าทันทีที่ราคาแตะ ' + plChips([L2_CHIPS.entry]) +
      ' ราคาและเวลาในตารางอ่านจากกราฟจำลองนี้ ไม่ใช่ตัวเลขที่เขาพูด</p>';
    return h;
  }
  function verdictKey(b) {
    var T = V.built.truth;
    if (T.confluence) return milestones(T).filter(function (m) { return m.bar <= b; }).length;
    return T.side ? (b < T.entryWindow.from ? 0 : b < T.entryWindow.to ? 1 : 2) : 0;
  }
  function renderPhases() {
    var items = milestones(V.built.truth);
    el.phases.innerHTML = items.map(function (x) { return '<li data-phase="' + x.key + '">' + x.label + '</li>'; }).join('');
  }
  function noteHtml(n) {
    var cd = noteChip(n.fact), c = cd ? TJR.layout.chip(cd.sec, cd.clip) : TJR.layout.gap();
    return '<li class="note" data-bar="' + n.bar + '"><time class="note__t">' + TJR.sessions.fmtET(V.base[n.bar].t) + ' ET</time>' +
      '<p>' + n.text + '</p><span class="chips">' + c + '</span></li>';
  }
  function renderNotes(b, final) {
    var vis = visibleNotes(V.built.truth.notes, b);
    if (V.noteCount === vis.length) return;
    var grew = vis.length > V.noteCount;
    V.noteCount = vis.length;
    el.notes.innerHTML = vis.map(noteHtml).join('');
    el.nohint.hidden = vis.length > 0;
    if (grew && !final && !M.reduced) { var last = el.notes.lastElementChild; if (last) last.classList.add('is-new'); }
  }

  function onBar(j, known) {
    if (!V) return;
    var B = V.built, T = B.truth, b = panelBar(V.base, V.series, clamp(j, 0, V.series.length - 1), known), k = V.series[clamp(j, 0, V.series.length - 1)];
    V.at = b;
    el.meta.textContent = k ? stamp(k.t) : '';
    var marks = {};
    milestones(T).forEach(function (m) { marks[m.key] = m.bar; });
    $$('li', el.phases).forEach(function (li) {
      var at = marks[li.getAttribute('data-phase')];
      li.classList.toggle('is-on', at != null && b >= at);
    });
    renderNotes(b, false);
    var key = verdictKey(b);
    if (V.vkey !== key) { V.vkey = key; el.verdict.innerHTML = verdictHtml(b); }
  }

  function atStart() {
    V.run++; V.playing = false;
    var j = seriesIndex(V.base, V.series, startBar(V.built));
    V.ch.reveal(j);
    onBar(j);
    setPlay('เล่น', false);
  }
  function finalFrame() {
    V.run++; V.playing = false;
    var n = V.series.length;
    V.ch.reveal(n - 1);
    onBar(n - 1);
    setPlay('เล่นใหม่', false);
  }
  function play() {
    var v = V, my = ++v.run, at = v.ch.info(), last = at.bars - 1;
    // never let the engine pick `from`: at its end it falls back to bar 0 and regrows the chart from nothing
    if (at.revealed >= last) { var f0 = seriesIndex(v.base, v.series, startBar(v.built)); v.ch.reveal(f0); onBar(f0); at = v.ch.info(); }
    v.playing = true;
    setPlay('หยุด', true);
    var rate = playRate(last - at.revealed, v.speed);
    return v.ch.play({ from: at.revealed, to: last, barsPerSec: rate, onBar: onBar }).then(function (done) {
      if (V !== v || my !== v.run) return done;
      v.playing = false;
      setPlay(done ? 'เล่นใหม่' : 'เล่น', false);
      return done;
    });
  }
  function toggle() {
    if (V.playing) { V.run++; V.playing = false; V.ch.pause(); setPlay('เล่น', false); return; }
    play();
  }
  function stepBy(d) {
    V.run++; V.playing = false;
    var j = V.ch.step(d);
    onBar(j);
    setPlay(j >= V.series.length - 1 ? 'เล่นใหม่' : 'เล่น', false);
  }
  // "อ่านกราฟ" = the v1 overlays (levels, sweep, entry zone; S21: the SMT lines on both charts);
  // "อ่าน confluence" = FVG / BOS / equilibrium (and the NY windows of S22) from the setup on, as known at each bar
  function setOverlays() {
    var B = V.built, last = V.base.length - 1, ov = V.ann ? TJR.annotate(B, { upTo: last }) : [];
    if (V.conf) ov = ov.concat(confluenceOverlays(B, last));
    if (V.mode === 'twin') {
      V.ch.setOverlays(ov.concat(V.ann ? twinOverlays(B, 'main') : []));
      V.ch.setOverlaysB(V.ann ? twinOverlays(B, 'twin') : []);
    } else V.ch.setOverlays(ov);
    setPressed(el.ann, V.ann);
    setPressed(el.conf, V.conf);
  }

  // one chart, or for S21 the ES / NQ pair behind the same few methods (reveal / play / step / pause / info / setData /
  // setOverlays / destroy): the pair moves together, the controls and the side panel follow the first chart
  function makeChart(mode, id) {
    var label = 'กราฟจำลองสถานการณ์ ' + id + ' ที่เล่นทีละแท่งได้';
    if (mode !== 'twin') return TJR.chart.create(el.hostA, { label: label, interactive: true });
    var tw = TJR.chart.twin(el.hostA, el.hostB, { label: 'กราฟคู่ ES และ NQ ของสถานการณ์ ' + id + ' ในช่วงเวลาเดียวกัน จุดตัดตรงกันทั้งสองกราฟ', interactive: true });
    return {
      reveal: function (i) { return tw.reveal(i); },
      play: function (o) { return tw.play(o); },
      step: function (d) { var j = tw.a.step(d); tw.reveal(j); return j; },
      pause: function () { tw.a.pause(); },
      info: function () { return tw.a.info(); },
      setData: function (b) { tw.setData(b, twinBuilt(b)); },
      setOverlays: function (ov) { tw.a.setOverlays(ov); },
      setOverlaysB: function (ov) { tw.b.setOverlays(ov); },
      destroy: function () { tw.destroy(); }
    };
  }
  // the host layout and the chart follow the scenario: S21 shows two panes (ES left, NQ right; stacked on a phone)
  function setMode(mode, id) {
    if (V.ch && V.mode === mode) return;
    if (V.ch) { V.ch.destroy(); V.ch = null; }
    var twin = mode === 'twin';
    el.paneB.hidden = !twin; el.lblA.hidden = !twin; el.lblB.hidden = !twin;
    el.stage.classList.toggle('is-twin', twin);
    V.ch = makeChart(mode, id);
    V.mode = mode;
  }
  function renderTfGroup() {
    var opts = tfOptions(V.id);
    el.tfg.hidden = !opts.length;
    el.tfg.innerHTML = opts.map(function (t) {
      return '<button class="ctrl" type="button" data-tf="' + t + '" aria-pressed="' + (t === V.baseTf) + '">' + TF_NAME[t] + '</button>';
    }).join('');
  }
  function setTf(t) {
    V.run++; V.playing = false;
    var b0 = V.at;                                         // the last base bar the panel showed
    V.ch.setTimeframe(t);
    V.tf = t;
    V.series = t === V.baseTf ? V.base : TJR.gen.rollup(V.base, V.baseTf, t);
    $$('[data-tf]', el.tfg).forEach(function (b) { setPressed(b, Number(b.getAttribute('data-tf')) === t); });
    el.tf.textContent = TF_NAME[t] || '';
    onBar(V.ch.info().revealed, b0);
    setPlay('เล่น', false);
  }

  // build the scenario into the open viewer (same chart object, so rapid calls never stack a loop)
  function load(id) {
    var d = defOf(id), k = kindOf(d), lv = levelOf(id);
    var outcome = k.fail ? (outcomes[id] || 'win') : null;
    var b = buildFor(id, seeds[id] || SEEDS[id], outcome);
    seeds[id] = b.meta.seed;
    V.run++; V.playing = false;
    setMode(modeOf(id), id);
    if (V.id !== id) V.conf = lv === 2;                      // Level 2 opens with its confluences drawn; a reseed keeps the choice
    V.id = id; V.def = d; V.built = b; V.base = b.candles; V.series = b.candles; V.baseTf = b.meta.tf; V.tf = b.meta.tf;
    V.noteCount = -1; V.vkey = null; V.at = 0;
    V.ch.setData(b);
    setOverlays();
    el.vid.innerHTML = id + ' · ' + d.instrument + ' · ' + TF_NAME[d.tf] + ' <span class="level-tag" data-level="' + lv + '">Level ' + lv + '</span>';
    el.title.textContent = d.title;
    el.sum.textContent = d.summary;
    el.chips.innerHTML = chipsHtml(clipsOf(d));
    if (V.mode === 'twin') {
      el.lblA.textContent = b.meta.instrument + ' · กราฟที่เทรด';
      el.lblB.textContent = b.truth.twin.instrument + ' · กราฟคู่';
      el.sym.textContent = b.meta.instrument + ' + ' + b.truth.twin.instrument;
    } else el.sym.textContent = b.meta.instrument;
    el.tf.textContent = TF_NAME[b.meta.tf];
    el.seed.textContent = 'seed ' + b.meta.seed;
    el.og.hidden = !k.fail;
    el.failbtn.textContent = lv === 2 ? 'setup ล้ม' : 'confirmation ล้ม';
    $$('[data-outcome]', el.og).forEach(function (btn) { setPressed(btn, btn.getAttribute('data-outcome') === (outcome || 'win')); });
    renderTfGroup();
    renderPhases();
    var i = IDS.indexOf(id), pv = IDS[(i + IDS.length - 1) % IDS.length], nx = IDS[(i + 1) % IDS.length];
    el.prev.setAttribute('href', '#' + pv); $('[data-k="prev-id"]', viewer).textContent = pv;
    el.next.setAttribute('href', '#' + nx); $('[data-k="next-id"]', viewer).textContent = nx;
    doc.title = id + ' ' + d.title + ' | Liquidity';
    el.nohint.hidden = false;
    el.notes.innerHTML = '';
    V.noteCount = 0;
    if (M.reduced) finalFrame(); else { atStart(); play(); }
  }

  var lastGridY = 0, fromGrid = false;
  function openViewer(id) {
    var wasOpen = !!V;
    if (!wasOpen) {
      gallery.hidden = true; viewer.hidden = false;
      V = { ch: null, mode: null, run: 0, playing: false, ann: true, conf: false, speed: 1, id: null };
      global.scrollTo(0, 0);
      if (M.enabled && M.gsap) M.gsap.fromTo(viewer, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', clearProps: 'all' });
    }
    try { load(id); } catch (e) { if (global.console) console.error(e); closeView(); return; }
    if (wasOpen) global.scrollTo(0, 0);
    try { el.title.focus({ preventScroll: true }); } catch (e) { /* focus not available */ }
  }
  function closeView() {
    if (V) { V.run++; if (V.ch) V.ch.destroy(); V = null; }
    viewer.hidden = true; gallery.hidden = false;
    Object.keys(thumbs).forEach(function (id) { if (thumbs[id].done) drawThumb(thumbs[id], 1); });   // a thumb painted while hidden drew nothing
    doc.title = '22 สถานการณ์ liquidity จากคลิป TJR | Liquidity';
  }

  // ---------------------------------------------------------------- routing: the hash is the state
  var first = true;
  function route() {
    var id = parseHash(global.location.hash);
    if (id) {
      if (!V) fromGrid = !first; else fromGrid = false;        // moved on to another scenario: close pushes the grid
      openViewer(id);
    } else if (V && !(global.location.hash || '').replace('#', '')) {   // an in-page anchor (#top) leaves the viewer open
      var focusId = V.id;
      closeView();
      global.scrollTo(0, lastGridY);
      var a = $('.sc[data-id="' + focusId + '"] .sc__link', grid);
      if (a) try { a.focus({ preventScroll: true }); } catch (e) { /* focus not available */ }
    }
    first = false;
  }
  function leave() {
    if (fromGrid) global.history.back();
    else { global.history.pushState(null, '', global.location.pathname + global.location.search); route(); }
  }

  function initViewer() {
    // the grid's scroll position, noted before the link moves the page (the browser jumps to the card id first)
    grid.addEventListener('click', function () { lastGridY = global.pageYOffset; }, true);
    viewer.addEventListener('click', function (e) {
      if (!V) return;
      var t = e.target.closest ? e.target.closest('button,a') : null;
      if (!t || !viewer.contains(t)) return;
      if (t.hasAttribute('data-tf')) { setTf(Number(t.getAttribute('data-tf'))); return; }
      if (t.hasAttribute('data-speed')) {
        V.speed = Number(t.getAttribute('data-speed'));
        $$('[data-speed]', viewer).forEach(function (b) { setPressed(b, b === t); });
        if (V.playing) play();                               // carry on from where it is, at the new speed
        return;
      }
      if (t.hasAttribute('data-outcome')) {
        outcomes[V.id] = t.getAttribute('data-outcome');
        load(V.id);
        return;
      }
      var act = t.getAttribute('data-act');
      if (act === 'close') leave();
      else if (act === 'play') toggle();
      else if (act === 'step') stepBy(1);
      else if (act === 'back') stepBy(-1);
      else if (act === 'reset') atStart();
      else if (act === 'ann') { V.ann = !V.ann; setOverlays(); }
      else if (act === 'conf') { V.conf = !V.conf; setOverlays(); }
      else if (act === 'reseed') { seeds[V.id] = 1 + Math.floor(Math.random() * 999999); load(V.id); }
    });
    global.addEventListener('hashchange', route);
    TJR.motion.onChange(function (reduced) { if (V && reduced) finalFrame(); });
  }

  // read-only handle for the console and the headless checks
  G.view = function () { return V && { id: V.id, at: V.at, tf: V.tf, run: V.run, playing: V.playing, outcome: V.built.truth.outcome, seed: V.built.meta.seed, info: V.ch.info() }; };

  // ---------------------------------------------------------------- start
  try { buildCards(); initFilters(); initThumbs(); } catch (e) { if (global.console) console.error(e); }
  initViewer();
  route();
})(typeof window !== 'undefined' ? window : globalThis);
