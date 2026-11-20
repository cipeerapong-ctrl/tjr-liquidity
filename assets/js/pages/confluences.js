/* TJR Liquidity: the Level 2 confluences page (Task 6). Classic script, after the engine, layout and motion.

   1. pure helpers on TJR.confluencesPage (no DOM, tested in Node by tests/confluences.test.js):
      gapAt / whyNoGap          the click-the-gap finder: the real gap near a clicked bar, or why there is none (lesson 2)
      stackSteps                formed / top closed under / bottom respected / deleted, read from the detectors (lesson 2)
      breakCandidates / breakFacts   the bars where a wick, a close on the level or a close beyond the most recent
                                     swing is in question, and their numbers in ticks ("Break or not?", lesson 1)
      race                      BOS vs IFVG entry bars and the tick difference, read from the candles (lesson 3)
      eqFromHandles / zoneOf / snapSwing / eqTarget / judgeRange   the two-handle equilibrium range (lesson 4)
      smtRead                   which index leads, from truth.smt (lesson 5)
      quizState / countDone     the 2-question self-checks and the rail's count
   2. page: layout, the chart slots (a chart exists only near the screen, at most 4 live at once), six interactives
      over TJR.scenarios S15 / S16 / S17 / S19 / S20 / S21, the self-checks (TJR.store keys conf.m1 ... conf.m5 ->
      tjr.conf.m1 ...), the rail, the heading reveal.
   Every number the charts show is read from the simulated candles and labelled ตัวเลขจากกราฟจำลอง; nothing is a
   quote from TJR. The facts, their clip chips and the rules live in confluences.html (playlist clips #11, #10,
   #8, #7, #6; the main clip only names these confluences, F9.1). */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var doc = global.document;
  var P = TJR.confluencesPage = TJR.confluencesPage || {};
  var TICK = 0.25;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rt(p) { return TJR.util.roundTick(p, TICK); }
  function ticks(x) { return Math.round(x / TICK); }
  function C() { return TJR.confluence; }

  // ================================================================ 1 · pure helpers

  // ---- lesson 2: the gap finder
  // the real FVG whose middle candle is within one bar of `bar` (the exact middle first, then the earlier gap), or null
  function gapAt(cs, bar) {
    if (!cs || cs.length < 3) return null;
    var best = null, bestD = 9;
    C().fvgs(cs).forEach(function (g) {
      var d = Math.abs(g.i - bar);
      if (d <= 1 && d < bestD) { best = g; bestD = d; }
    });
    return best;
  }
  // why bar i is NOT the middle of a gap (null when it is): { reason: 'edge' | 'doji' | 'overlap', ... }
  function whyNoGap(cs, i) {
    if (!cs || i < 1 || i + 1 >= cs.length) return { reason: 'edge' };
    var a = cs[i - 1], m = cs[i], b = cs[i + 1];
    if (m.c > m.o) {
      if (a.h < b.l) return null;
      return { reason: 'overlap', dir: 'up', first: a.h, third: b.l, ticks: ticks(a.h - b.l) };
    }
    if (m.c < m.o) {
      if (a.l > b.h) return null;
      return { reason: 'overlap', dir: 'down', first: a.l, third: b.h, ticks: ticks(b.h - a.l) };
    }
    return { reason: 'doji' };
  }

  // ---- lesson 2: a stack of gaps and what happens to it (S19). Steps are the bars the detectors say each thing
  // became true: all gaps formed, the near gap closed through, the far gap respected, the far gap deleted.
  function stackSteps(cs, K) {
    var out = { dir: null, gaps: [], near: null, far: null, steps: [] };
    if (!K || !K.cont) return out;
    var st = null;
    C().stacks(C().fvgs(cs), cs).forEach(function (s) {
      if (!st && s.gaps.some(function (g) { return g.i === K.cont.i; })) st = s;
    });
    if (!st) return out;
    var bull = st.dir === 'bull', far = st.gaps[0], near = st.gaps[0], formed = 0;
    st.gaps.forEach(function (g) {
      if (bull ? g.low < far.low : g.high > far.high) far = g;
      if (bull ? g.low > near.low : g.high < near.high) near = g;
      if (g.to > formed) formed = g.to;
    });
    var steps = [{ key: 'formed', bar: formed }];
    if (near !== far && near.state === 'disrespected' && near.stateAt != null) steps.push({ key: 'near-closed', bar: near.stateAt, gap: near.i });
    if (far.state === 'respected' && far.stateAt != null) steps.push({ key: 'far-respected', bar: far.stateAt, gap: far.i });
    if (far.deletedAt != null) steps.push({ key: 'deleted', bar: far.deletedAt, gap: far.i });
    steps.sort(function (a, b) { return a.bar - b.bar; });
    out.dir = st.dir; out.gaps = st.gaps.map(function (g) { return g.i; }); out.near = near.i; out.far = far.i; out.steps = steps;
    return out;
  }

  // ---- lesson 1: "Break or not?". Which bars put the most recent confirmed swing to the test?
  // trend 'up' watches the most recent swing low, 'down' the most recent swing high; a swing counts from the bar after
  // its pair closes (the same rule as TJR.confluence.bos). kind: 'wick' = the wick goes through but the close stays
  // on the right side, 'on' = the close sits exactly on the level, 'close' = a close beyond it (a break). The list
  // stops at the first close.
  function breakCandidates(cs, opts) {
    opts = opts || {};
    var up = opts.trend !== 'down', from = Math.max(0, opts.from || 0);
    var upTo = opts.upTo != null ? Math.min(opts.upTo, cs.length - 1) : cs.length - 1;
    var sw = TJR.swings.find(cs), list = up ? sw.lows : sw.highs, k = -1, out = [];
    for (var j = from; j <= upTo; j++) {
      while (k + 1 < list.length && list[k + 1].pair[1] < j) k++;
      if (k < 0) continue;
      var lv = list[k], x = cs[j], kind = null;
      if (up) { kind = x.c < lv.price ? 'close' : x.c === lv.price ? 'on' : x.l < lv.price ? 'wick' : null; }
      else { kind = x.c > lv.price ? 'close' : x.c === lv.price ? 'on' : x.h > lv.price ? 'wick' : null; }
      if (!kind) continue;
      out.push({ bar: j, kind: kind, trend: up ? 'up' : 'down', level: { i: lv.i, price: lv.price } });
      if (kind === 'close') break;
    }
    return out;
  }
  // the questions of S20 (an uptrend, a deep wick under the watched low, a real break later): the candidates from a few bars
  // before the scripted wick; chart noise from the run-up that already broke a minor low is left out
  function breakSteps(b) {
    var cs = b.candles, K = b.truth.confluence, o = K.origin;
    var c = breakCandidates(cs, { trend: 'up', from: Math.max(0, o - 10) });
    if (c.length && c[c.length - 1].kind === 'close' && c[c.length - 1].bar < o) c = breakCandidates(cs, { trend: 'up', from: o });
    return c;
  }
  // the numbers of a candidate in ticks: how far the extreme went past the level, and where the close is
  // (closeTicks > 0 = still on the safe side of the level, < 0 = beyond it)
  function breakFacts(cs, cand) {
    var x = cs[cand.bar], up = cand.trend !== 'down', lv = cand.level.price;
    var side = up ? 1 : -1;                                  // + = the safe side
    var closeTicks = ticks((x.c - lv) * side);
    if (cand.kind === 'on') return { kind: 'on', ticks: 0, closeTicks: 0 };
    var past = up ? lv - x.l : x.h - lv;
    return { kind: cand.kind, ticks: ticks(cand.kind === 'close' ? -(x.c - lv) * side : past), closeTicks: closeTicks };
  }

  // ---- lesson 3: BOS vs IFVG, read from the candles (S16: short). The IFVG entry is the close of the bar that
  // closes through the gap (truth.confluence.confirm); the BOS entry is the close of the first break of the most
  // recent swing after the sweep. ticks > 0 = the IFVG entry is the better price (higher for a short, lower for a long).
  function race(b) {
    var T = b.truth, K = T.confluence, cs = b.candles, short = K.dir === 'short';
    var ref = T.sweep ? T.sweep.bar : K.origin || 0;
    var at = K.confirm.at, ifvg = { at: at, price: cs[at] ? cs[at].c : null };
    var ev = C().bos(cs, { trend: short ? 'up' : 'down', from: ref + 1 })[0] || null;
    var bos = ev ? { at: ev.at, price: cs[ev.at].c, level: { i: ev.level.i, price: ev.level.price } } : null;
    var out = { side: K.dir, ifvg: ifvg, bos: bos, bars: null, ticks: null };
    if (bos && ifvg.price != null) {
      out.bars = bos.at - ifvg.at;
      out.ticks = (short ? ifvg.price - bos.price : bos.price - ifvg.price) / TICK;
    }
    return out;
  }

  // ---- lesson 4: the equilibrium range from two handles (prices)
  // dir 'up': 0 on the low, 1 on the high, the discount is the lower half; 'down': 0 on the high, 1 on the low, the
  // premium is the upper half (P7.5, P7.7, P7.17). null when the handles do not make a range.
  function eqFromHandles(a, b, dir) {
    if (!isFinite(a) || !isFinite(b)) return null;
    var lo = Math.min(a, b), hi = Math.max(a, b);
    if (!(hi > lo)) return null;
    var up = dir !== 'down', eq = rt((lo + hi) / 2);
    return { dir: up ? 'up' : 'down', low: lo, high: hi, zero: up ? lo : hi, one: up ? hi : lo, eq: eq,
             favour: up ? 'discount' : 'premium', premium: { from: eq, to: hi }, discount: { from: lo, to: eq } };
  }
  function zoneOf(range, price) { return price > range.eq ? 'premium' : price < range.eq ? 'discount' : 'eq'; }

  // the swing (high or low) nearest in price to `price`, among the swings confirmed by bar `at` (nothing later)
  function snapSwing(cs, price, at) {
    if (!cs || !cs.length) return null;
    var sw = TJR.swings.find(cs.slice(0, Math.min(at, cs.length - 1) + 1)), best = null;
    function cand(p, kind) {
      var d = Math.abs(p.price - price);
      if (!best || d < best.d || (d === best.d && p.i > best.p.i)) best = { d: d, p: p, kind: kind };
    }
    sw.highs.forEach(function (p) { cand(p, 'high'); });
    sw.lows.forEach(function (p) { cand(p, 'low'); });
    return best ? { i: best.p.i, price: best.p.price, kind: best.kind, known: best.p.pair[1] } : null;
  }
  // the first bar at which the scenario's equilibrium range (truth.confluence.cont, kind 'eq') is placeable, and the range
  function eqTarget(cs, K, dir) {
    if (!K || !K.cont || K.cont.kind !== 'eq') return null;
    for (var k = 0; k < cs.length; k++) {
      var r = C().eqRange(cs.slice(0, k + 1), { at: k, dir: dir });
      if (r && r.from === K.cont.from && r.to === K.cont.to) return { range: r, at: k };
    }
    return null;
  }
  // is the pair of snapped swings the right range at bar `at`? -> { ok, why?, want? }
  // why: incomplete | kinds (two highs or two lows) | order | none (no range placeable yet) | old-start | end | other
  function judgeRange(cs, at, dir, p, q) {
    if (!p || !q) return { ok: false, why: 'incomplete' };
    var up = dir !== 'down', sk = up ? 'low' : 'high', ek = up ? 'high' : 'low';
    var s = p.kind === sk ? p : q.kind === sk ? q : null, e = s === p ? q : p;
    if (!s || e.kind !== ek) return { ok: false, why: 'kinds' };
    if (s.i >= e.i) return { ok: false, why: 'order' };
    var want = C().eqRange(cs.slice(0, at + 1), { at: at, dir: dir });
    if (!want) return { ok: false, why: 'none' };
    if (s.i === want.from && e.i === want.to) return { ok: true, want: want, start: s, end: e };
    if (s.i < want.from) return { ok: false, why: 'old-start', want: want, start: s, end: e };
    if (e.i !== want.to) return { ok: false, why: 'end', want: want, start: s, end: e };
    return { ok: false, why: 'other', want: want, start: s, end: e };
  }

  // ---- lesson 5: which index leads (S21 with kind 'high': the traded chart is the leader, ES or NQ by seed; the twin is the other)
  function smtRead(b) {
    var T = b.truth, s = T.smt, main = b.meta.instrument, tw = T.twin.instrument, nums = {};
    nums[main] = { p1: s.main.p1.price, p2: s.main.p2.price, bar1: s.main.p1.bar, bar2: s.main.p2.bar };
    nums[tw] = { p1: s.twin.p1.price, p2: s.twin.p2.price, bar1: s.twin.p1.bar, bar2: s.twin.p2.bar };
    var mainLeads = s.leader === 'main';
    return { type: s.type, kind: s.kind, leader: mainLeads ? main : tw, lagger: mainLeads ? tw : main, nums: nums, at: s.at };
  }

  // ---- self-checks: picks = [pick|null, pick|null]; rights = [index, index]
  function quizState(picks, rights) {
    var right = rights.map(function (r, i) { return !!picks && picks[i] === r; });
    return { right: right, done: right.every(Boolean) };
  }
  function countDone(all, rights) {
    var n = 0;
    Object.keys(rights).forEach(function (m) { if (quizState(all[m] || [], rights[m]).done) n++; });
    return n;
  }

  P.gapAt = gapAt; P.whyNoGap = whyNoGap; P.stackSteps = stackSteps;
  P.breakCandidates = breakCandidates; P.breakSteps = breakSteps; P.breakFacts = breakFacts; P.race = race;
  P.eqFromHandles = eqFromHandles; P.zoneOf = zoneOf; P.snapSwing = snapSwing; P.eqTarget = eqTarget; P.judgeRange = judgeRange;
  P.smtRead = smtRead; P.quizState = quizState; P.countDone = countDone;

  if (!doc || !TJR.layout || !TJR.chart || !TJR.chart.create) return;   // Node (tests): helpers only

  // ================================================================ 2 · page
  var M = TJR.motion.init();
  TJR.layout.mount({
    page: 'confluences',
    close: { title: 'ไปขั้น 3: เซ็ตอัพเต็ม', line: 'bias, sweep, confirmation, continuation, entry และ exit เรียงตามลำดับที่เขาคิด', label: 'ไปขั้น 3', href: 'strategy.html' }
  });

  var MAX_LIVE = 4;
  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function setPressed(btn, on) { if (btn) btn.setAttribute('aria-pressed', String(!!on)); }
  function stamp(t) { return TJR.sessions.fmtET(t) + ' ET · ' + TJR.sessions.fmtThai(t) + ' น.'; }
  function build(id, seed, opts) { return TJR.scenarios.safeBuild(TJR.scenarios.get(id), seed, opts || {}); }
  function px(v) { return TJR.util.fmtPrice(v); }
  function chip(sec, clip) { return TJR.layout.chip(sec, clip); }
  function gapBadge() { return TJR.layout.gap(); }
  function randomSeed() { return 1 + Math.floor(Math.random() * 999999); }
  function sim() { return '<span class="sim-lab">ตัวเลขจากกราฟจำลอง</span>'; }
  // overlays of annotate.confluence for one kind, keeping only the ids in `ids`
  function confOv(b, show, ids) {
    var all = { fvg: false, bos: false, eq: false, windows: false };
    Object.keys(show).forEach(function (k) { all[k] = show[k]; });
    return TJR.annotate.confluence(b, { show: all }).filter(function (o) { return !ids || ids.indexOf(o.id) >= 0; });
  }
  function frameLabel(fig, text) { var e = $('[data-k="title"]', fig); if (e) e.textContent = text; }

  // fixed first seeds (all pass check(); each gives a readable chart); "สุ่มกราฟใหม่" draws a fresh one
  var SEEDS = { S20: 4, S15: 6, S19: 1, S16: 1, S17: 1, S21: 1 };

  // every make*(fig, S) returns { destroy, autoplay, remount, reduced, act }, like learn.js

  // ---------------------------------------------------------------- lesson 1: "Break or not?" on S20
  function makeBreak(fig, S) {
    var host = $('.chart-frame__canvas', fig), read = $('[data-k="read"]', fig), stepEl = $('[data-k="step"]', fig);
    var yes = $('[data-act="yes"]', fig), no = $('[data-act="no"]', fig), next = $('[data-act="next"]', fig), score = $('[data-k="bscore"]', fig);
    var b = null, cs = null, cands = [], dead = false;
    var ch = TJR.chart.create(host, { label: 'กราฟจำลอง S20: ถามทีละแท่งว่าเป็น break of structure หรือไม่', interactive: true });
    S.picks = S.picks || [];

    function load(seed, keep) {
      b = build('S20', seed); cs = b.candles;
      cands = breakSteps(b);
      ch.setData(b); ch.setOverlays([]);
      S.seed = b.meta.seed;
      if (!keep) { S.picks = []; S.idx = 0; S.fin = false; }
      frameLabel(fig, 'S20 · ' + TJR.scenarios.get('S20').title);
      go(S.idx || 0);
    }
    function tally() { var r = 0, n = 0; S.picks.forEach(function (p) { if (p != null) { n++; if (p.right) r++; } }); return { right: r, n: n }; }
    function paintScore() {
      var t = tally();
      if (score) { score.textContent = t.right + ' / ' + cands.length; score.setAttribute('data-tone', t.n === cands.length && t.right === cands.length ? 'good' : ''); }
    }
    function go(i) {
      S.idx = i = clamp(i, 0, cands.length - 1);
      var c = cands[i], pick = S.picks[i];
      ch.setOverlays([]);
      ch.addOverlay({ id: 'bk-lv', type: 'level', price: c.level.price, from: c.level.i, label: 'low ล่าสุดที่เฝ้า', kind: 'htf', state: 'active', appearAt: c.level.i });
      ch.addOverlay({ id: 'bk-q', type: 'label', bar: c.bar, price: cs[c.bar].h, text: '?', pos: 'above', appearAt: c.bar });
      ch.reveal(c.bar);
      ch.view(Math.max(0, c.bar - 34), Math.min(cs.length - 1, c.bar + 3));
      if (stepEl) stepEl.textContent = 'แท่งที่ ' + (i + 1) + ' จาก ' + cands.length + ' · ' + stamp(cs[c.bar].t);
      yes.disabled = no.disabled = pick != null;
      next.disabled = pick == null || S.fin;
      next.hidden = i >= cands.length - 1;
      if (pick == null) read.innerHTML = 'ราคาปิดแท่งที่มี ? เทียบกับเส้น low ล่าสุดที่เฝ้า (เส้นแนวนอน) นี่คือ break of structure ไหม';
      else explain(c, pick);
      paintScore();
    }
    function explain(c, pick) {
      var f = breakFacts(cs, c), lv = px(c.level.price), x = cs[c.bar], head = pick.right ? '<b class="q__ok">ถูก</b> ' : '<b class="q__no">ยังไม่ใช่</b> ', body;
      if (c.kind === 'close') {
        body = 'แท่งนี้<b>ปิด</b>ที่ ' + px(x.c) + ' ใต้ low ' + lv + ' อยู่ ' + f.ticks + ' tick = break of structure จากนี้ราคาเป็นขาลง ' + chip(294, 11);
      } else if (c.kind === 'wick') {
        body = 'ไส้ลงไปที่ ' + px(x.l) + ' ใต้ low ' + lv + ' ' + f.ticks + ' tick แต่แท่งปิดที่ ' + px(x.c) + ' ยังเหนือ low อยู่ ' + f.closeTicks + ' tick = ไม่ใช่ break (ไส้ไม่นับ) ' + chip(502, 11);
      } else {
        body = 'แท่งปิดที่ ' + px(x.c) + ' พอดีกับระดับ low ' + lv + ' ต้องปิด<b>ใต้</b>ระดับถึงจะนับ = ยังไม่ใช่ break ' + chip(263, 11);
      }
      read.innerHTML = head + body + ' ' + sim();
    }
    function answer(says) {
      var c = cands[S.idx];
      if (S.picks[S.idx] != null) return;
      S.picks[S.idx] = { says: says, right: says === (c.kind === 'close') };
      go(S.idx);
      if (S.idx >= cands.length - 1) {
        S.fin = true; next.disabled = true;
        var t = tally();
        read.innerHTML += '<br><b>ครบ ' + cands.length + ' แท่ง</b> ตอบถูก ' + t.right + ' · ดูจุดใหม่ได้ที่ปุ่มสุ่มกราฟใหม่';
      }
    }
    try { load(S.seed, S.loaded); S.loaded = true; } catch (e) { ch.destroy(); throw e; }
    return {
      destroy: function () { dead = true; ch.destroy(); },
      autoplay: function () {},
      remount: function () { go(S.idx || 0); },
      reduced: function () {},
      act: function (name) {
        if (dead) return;
        if (name === 'yes') answer(true);
        else if (name === 'no') answer(false);
        else if (name === 'next') go(S.idx + 1);
        else if (name === 'reseed') load(randomSeed());
      },
      chart: ch
    };
  }

  // ---------------------------------------------------------------- lesson 2a: click-the-gap finder on S15
  function makeFinder(fig, S) {
    var host = $('.chart-frame__canvas', fig), read = $('[data-k="read"]', fig), score = $('[data-k="fscore"]', fig), allBtn = $('[data-act="all"]', fig);
    var b = null, cs = null, gaps = [], win = null, dead = false, off = null;
    var ch = TJR.chart.create(host, { label: 'กราฟจำลอง S15: คลิกแท่งกลางของ fair value gap', interactive: true });
    S.found = S.found || {};

    function ovFor(g) {
      return { id: 'fv' + g.i, type: 'fvg', from: g.from, to: g.to, low: g.low, high: g.high, dir: g.dir, state: 'open', appearAt: g.to };
    }
    function paint() {
      var n = 0;
      gaps.forEach(function (g) { if (S.found[g.i] || S.all) { ch.addOverlay(ovFor(g)); if (S.found[g.i]) n++; } else ch.removeOverlay('fv' + g.i); });
      if (score) { score.textContent = n + ' / ' + gaps.length; score.setAttribute('data-tone', n === gaps.length ? 'good' : ''); }
      setPressed(allBtn, S.all);
    }
    function load(seed, keep) {
      b = build('S15', seed); cs = b.candles;
      var K = b.truth.confluence;
      win = { from: Math.max(0, K.origin - 6), to: Math.min(cs.length - 1, K.entry.at + 2) };      // the stretch from the sweep to the entry
      gaps = C().fvgs(cs).filter(function (g) { return g.i >= win.from && g.i <= win.to; });
      ch.setData(b); ch.setOverlays([]); ch.reveal(cs.length - 1); ch.view(Math.max(0, win.from - 1), Math.min(cs.length - 1, win.to + 1));
      S.seed = b.meta.seed;
      if (!keep) { S.found = {}; S.all = false; }
      frameLabel(fig, 'S15 · ' + TJR.scenarios.get('S15').title);
      if (keep && Object.keys(S.found).length) read.innerHTML = 'คลิกต่อได้เลย ที่เจอแล้วยังแสดงอยู่ในกราฟ';
      else read.innerHTML = 'คลิกที่แท่ง<b>กลาง</b>ของสามแท่งที่คิดว่ามี gap (แท่งใหญ่ที่พุ่งผ่าน) ผิดถูกจะบอกเหตุผลและตัวเลขจากกราฟ';
      paint();
    }
    function attempt(i) {
      ch.removeOverlay('fv-no');
      var g = gapAt(cs, i);
      if (g) {
        var again = !!S.found[g.i];
        S.found[g.i] = true; paint();
        var bull = g.dir === 'bull', w = ticks(g.high - g.low);
        read.innerHTML = (again ? '<b>เจออันนี้แล้ว</b> ' : '<b class="q__ok">ใช่ มี gap</b> ') + (bull ? 'bullish' : 'bearish') + ' · ' +
          (bull ? 'จากไส้บนของแท่งแรก ' + px(g.low) + ' ถึงไส้ล่างของแท่งที่สาม ' + px(g.high) : 'จากไส้ล่างของแท่งแรก ' + px(g.high) + ' ลงถึงไส้บนของแท่งที่สาม ' + px(g.low)) +
          ' กว้าง ' + w + ' tick ' + chip(bull ? 251 : 436, 10) + ' ' + sim();
        ch.flash('fv' + g.i);
        return;
      }
      var y = whyNoGap(cs, i), why;
      if (!y) why = 'อยู่ติดกับ gap อันหนึ่ง ลองคลิกที่แท่งกลางของมัน';
      else if (y.reason === 'edge') why = 'ต้องมีแท่งก่อนและหลังแท่งที่คลิก (gap ใช้สามแท่ง)';
      else if (y.reason === 'doji') why = 'แท่งกลางเปิดเท่าปิด คลิปไม่ได้บอกว่าจะนับเป็นสีอะไร ' + gapBadge();
      else if (y.dir === 'up') why = 'แท่งกลางเป็นแท่งขึ้น แต่ไส้บนของแท่งแรก ' + px(y.first) + ' ไม่ต่ำกว่าไส้ล่างของแท่งที่สาม ' + px(y.third) + (y.ticks ? ' (ซ้อนกัน ' + y.ticks + ' tick)' : ' (แตะกันพอดี)') + ' = ไส้ซ้อนกัน ไม่มีช่องว่างของ orders ' + chip(606, 10);
      else why = 'แท่งกลางเป็นแท่งลง แต่ไส้ล่างของแท่งแรก ' + px(y.first) + ' ไม่สูงกว่าไส้บนของแท่งที่สาม ' + px(y.third) + (y.ticks ? ' (ซ้อนกัน ' + y.ticks + ' tick)' : ' (แตะกันพอดี)') + ' = ไส้ซ้อนกัน ไม่มีช่องว่างของ orders ' + chip(606, 10);
      read.innerHTML = '<b class="q__no">ยังไม่ใช่</b> ' + why + ' ' + sim();
      if (i >= 1 && i + 1 < cs.length) {
        var lo = Math.min(cs[i - 1].l, cs[i].l, cs[i + 1].l), hi = Math.max(cs[i - 1].h, cs[i].h, cs[i + 1].h);
        ch.addOverlay({ id: 'fv-no', type: 'box', from: i - 1, to: i + 1, low: lo, high: hi, label: 'ไม่ใช่ gap', kind: 'asia', appearAt: i + 1 });
      }
    }
    try { load(S.seed, S.loaded); S.loaded = true; } catch (e) { ch.destroy(); throw e; }
    off = ch.on('click', function (p) { if (!dead && p) attempt(p.i); });
    return {
      destroy: function () { dead = true; if (off) off(); ch.destroy(); },
      autoplay: function () {},
      remount: function () { ch.reveal(cs.length - 1); ch.view(Math.max(0, win.from - 1), Math.min(cs.length - 1, win.to + 1)); },
      reduced: function () {},
      act: function (name) {
        if (dead) return;
        if (name === 'all') { S.all = !S.all; paint(); }
        else if (name === 'reseed') load(randomSeed());
      },
      chart: ch
    };
  }

  // ---------------------------------------------------------------- lesson 2b: stacked gaps and their deletion on S19
  var STACK_TEXT = {
    'formed': ['gap สองอันซ้อนกัน', 'ขาขึ้นทิ้ง gap ไว้สองอันติดกัน ไม่มีแท่งย่อคั่น ทั้งคู่ยังใช้ได้ ราคาเลือกได้ว่าจะดันขึ้นจากอันไหน', [[1097, 10], [837, 8]]],
    'near-closed': ['ปิดใต้ gap บนอันเดียว', 'มีแท่งปิดใต้ gap บน แต่ gap ล่างยังอยู่ จึงยังไม่ถือว่าเทรนด์เปลี่ยน ต้องดูต่อว่า gap ล่างรอดไหม', [[1221, 10], [922, 8]]],
    'far-respected': ['gap ล่างถูก respect', 'ราคาลงไปเข้า gap ล่าง แล้วมีแท่งปิดกลับขึ้นออกมา (อ่านจากตัวอย่างของเขา ไม่ใช่กฎที่มีชื่อ) เทรนด์ขาขึ้นไปต่อ', [[1357, 10], [1389, 10]]],
    'deleted': ['ราคาดันเหนือ high: ลบ gap', 'พอราคาดันเหนือ high เดิม gap ที่ใช้แล้วและที่อยู่ใต้มันหมดหน้าที่ กล่องจึงหยุดที่แท่งนี้ เขาบอกให้ลบออก ไม่ลากทิ้งไว้รอราคากลับมา', [[1152, 10], [1452, 10]]]
  };
  function makeStack(fig, S) {
    var host = $('.chart-frame__canvas', fig), read = $('[data-k="read"]', fig), stepEl = $('[data-k="step"]', fig);
    var prev = $('[data-act="prev"]', fig), nextB = $('[data-act="next"]', fig);
    var b = null, cs = null, st = null, ov = [], dead = false, run = 0;
    var ch = TJR.chart.create(host, { label: 'กราฟจำลอง S19: gap ซ้อนกันสองอัน ปิดใต้อันบน gap ล่างยังยืน แล้วถูกลบ', interactive: true });

    function load(seed, keep) {
      b = build('S19', seed); cs = b.candles; st = stackSteps(cs, b.truth.confluence);
      if (!st.steps.length) throw new Error('S19 has no stack');
      ov = confOv(b, { fvg: true }, st.gaps.map(function (i) { return 'fvg:' + i; }));
      ch.setData(b); ch.setOverlays(ov);
      S.seed = b.meta.seed;
      if (!keep) S.step = 0;
      var last = st.steps[st.steps.length - 1].bar;
      ch.view(Math.max(0, st.steps[0].bar - 30), Math.min(cs.length - 1, last + 6));
      frameLabel(fig, 'S19 · ' + TJR.scenarios.get('S19').title);
      show(S.step || 0);
    }
    function show(i, keep) {
      run++;
      S.step = i = clamp(i, 0, st.steps.length - 1);
      var s = st.steps[i], t = STACK_TEXT[s.key];
      if (!keep) ch.reveal(s.bar);
      if (stepEl) stepEl.textContent = 'ขั้นที่ ' + (i + 1) + ' จาก ' + st.steps.length + ' · ' + stamp(cs[s.bar].t);
      read.innerHTML = '<b>' + t[0] + '</b> ' + t[1] + ' ' + t[2].map(function (c) { return chip(c[0], c[1]); }).join(' ') + ' ' + sim();
      prev.disabled = i === 0; nextB.disabled = i === st.steps.length - 1;
    }
    try { load(S.seed, S.loaded); S.loaded = true; } catch (e) { ch.destroy(); throw e; }
    return {
      destroy: function () { dead = true; run++; ch.destroy(); },
      autoplay: function () {},
      remount: function () { show(S.step || 0); },
      reduced: function () {},
      act: function (name) {
        if (dead) return;
        if (name === 'prev') show(S.step - 1);
        else if (name === 'next') show(S.step + 1);
        else if (name === 'play') {
          var my = ++run, from = Math.max(0, st.steps[0].bar - 4), to = Math.min(cs.length - 1, st.steps[st.steps.length - 1].bar + 3);
          ch.reveal(from);
          if (stepEl) stepEl.textContent = 'กำลังเล่น…';
          ch.play({ from: from, to: to, barsPerSec: 7, onBar: function (i) {
            if (my !== run) return;
            var k = 0; st.steps.forEach(function (s, q) { if (i >= s.bar) k = q; });
            if (k !== S.step && i >= st.steps[0].bar) show(k, true);
          } }).then(function () { if (my === run) show(st.steps.length - 1, true); });
        } else if (name === 'reseed') load(randomSeed());
      },
      chart: ch
    };
  }

  // ---------------------------------------------------------------- lesson 3: BOS vs IFVG race on S16
  function makeRace(fig, S) {
    var host = $('.chart-frame__canvas', fig), read = $('[data-k="read"]', fig), playB = $('[data-act="play"]', fig);
    var b = null, cs = null, r = null, dead = false, run = 0, startAt = 0, endAt = 0;
    var ch = TJR.chart.create(host, { label: 'กราฟจำลอง S16: เทียบจุดเข้าด้วย IFVG กับด้วย BOS', interactive: true });

    function setPlay(label, on) { var l = playB && $('[data-k="lab"]', playB); if (l) l.textContent = label; if (playB) playB.setAttribute('data-state', on ? 'on' : 'off'); }
    function load(seed, wantGap) {
      b = build('S16', seed);
      for (var t = 0; wantGap && t < 24 && !(race(b).bars > 0); t++) b = build('S16', seed + 1 + t * 7919);
      cs = b.candles; r = race(b);
      var K = b.truth.confluence, list = confOv(b, { fvg: true }, ['fvg:' + K.confirm.i]);
      if (r.bos) list = list.concat(confOv(b, { bos: true }, ['bos:' + r.bos.at]));
      list.push({ id: 'rc-i', type: 'level', price: r.ifvg.price, from: r.ifvg.at, label: 'เข้าด้วย IFVG', kind: 'target', state: 'active', appearAt: r.ifvg.at });
      list.push({ id: 'rc-im', type: 'marker', bar: r.ifvg.at, price: r.ifvg.price, shape: 'dot', color: '#2fcf86', appearAt: r.ifvg.at });
      if (r.bos) {
        list.push({ id: 'rc-b', type: 'level', price: r.bos.price, from: r.bos.at, label: 'เข้าด้วย BOS', kind: 'htf', state: 'active', appearAt: r.bos.at });
        list.push({ id: 'rc-bm', type: 'marker', bar: r.bos.at, price: r.bos.price, shape: 'dot', color: '#e6b84c', appearAt: r.bos.at });
      }
      ch.setData(b); ch.setOverlays(list);
      S.seed = b.meta.seed; S.done = false;
      startAt = Math.max(0, (b.truth.sweep ? b.truth.sweep.bar : r.ifvg.at) - 8);
      endAt = Math.min(cs.length - 1, (r.bos ? r.bos.at : r.ifvg.at) + 5);
      ch.view(Math.max(0, startAt - 14), Math.min(cs.length - 1, endAt + 4));
      frameLabel(fig, 'S16 · ' + TJR.scenarios.get('S16').title);
      onBar(startAt);
      setPlay('เล่น', false);
    }
    function onBar(i) {
      var t = [];
      if (i < r.ifvg.at) t.push('รอให้ราคาปิดทะลุ gap…');
      else t.push('<b>IFVG</b> เข้าที่แท่ง ' + stamp(cs[r.ifvg.at].t) + ' ราคา ' + px(r.ifvg.price));
      if (r.bos && i >= r.bos.at) {
        t.push('<b>BOS</b> เข้าที่แท่ง ' + stamp(cs[r.bos.at].t) + ' ราคา ' + px(r.bos.price));
        if (r.ticks > 0) t.push('IFVG เข้าได้เร็วกว่า ' + r.bars + ' แท่ง และได้ราคาดีกว่า <b>' + r.ticks + ' tick</b> ' + sim());
        else if (r.ticks === 0) t.push('ในกราฟนี้สองจุดเข้าราคาเท่ากัน ห่างกัน ' + r.bars + ' แท่ง ' + sim());
        else t.push('ในกราฟนี้ BOS ให้ราคาดีกว่า ' + Math.abs(r.ticks) + ' tick ลองสุ่มกราฟใหม่ดู ' + sim());
      } else if (!r.bos && i >= r.ifvg.at) t.push('กราฟนี้ยังไม่มี BOS ให้เทียบ');
      read.innerHTML = t.join('<br>');
    }
    function play() {
      var my = ++run;
      ch.reveal(startAt); onBar(startAt);
      setPlay('หยุด', true);
      return ch.play({ from: startAt, to: endAt, barsPerSec: 4, onBar: function (i) { if (my === run) onBar(i); } }).then(function (done) {
        if (my !== run || dead) return;
        S.done = true; setPlay('เล่นใหม่', false); onBar(endAt);
      });
    }
    function finalFrame() { run++; ch.reveal(endAt); onBar(endAt); S.done = true; setPlay('เล่นใหม่', false); }
    try { var was = S.done; load(S.seed); if (was || M.reduced) finalFrame(); } catch (e) { ch.destroy(); throw e; }
    return {
      destroy: function () { dead = true; run++; ch.destroy(); },
      autoplay: function () { if (S.started || dead) return; S.started = true; if (M.reduced) finalFrame(); else play(); },
      remount: function () { if (S.done || M.reduced) finalFrame(); else { ch.reveal(startAt); onBar(startAt); setPlay('เล่น', false); } },
      reduced: function () { if (M.reduced) finalFrame(); },
      act: function (name) {
        if (dead) return;
        if (name === 'play') { if (playB && playB.getAttribute('data-state') === 'on') { run++; ch.pause(); setPlay('เล่น', false); } else { S.started = true; play(); } }
        else if (name === 'reseed') { load(randomSeed(), true); S.started = true; play(); }
      },
      chart: ch
    };
  }

  // ---------------------------------------------------------------- lesson 4: the two-handle equilibrium range on S17
  function makeRange(fig, S) {
    var host = $('.chart-frame__canvas', fig), read = $('[data-k="read"]', fig), levels = $('[data-k="levels"]', fig);
    var b = null, cs = null, K = null, tgt = null, at = 0, hands = { hA: null, hB: null }, dead = false, offs = [], run = 0;
    var ch = TJR.chart.create(host, { label: 'กราฟจำลอง S17: ลากสองเส้นไปที่ high ล่าสุดและ low ล่าสุดของขาลง', interactive: true });

    function swingsAt() {
      var sw = TJR.swings.find(cs.slice(0, at + 1));
      return { highs: sw.highs, lows: sw.lows };
    }
    function setHand(id, sw) {
      hands[id] = sw;
      ch.addLine({ id: id, price: sw.price, label: id === 'hA' ? 'เส้น A' : 'เส้น B', draggable: true });
    }
    function refresh() {
      ch.removeOverlay('rg');
      var p = hands.hA, q = hands.hB, j = judgeRange(cs, at, 'down', p, q);
      var drawn = j.ok || j.why === 'old-start' || j.why === 'end' || j.why === 'other';           // a high then a low: a box can be drawn
      var rg = drawn ? eqFromHandles(p.price, q.price, 'down') : null;
      var html;
      if (rg) {
        var s = p.i < q.i ? p : q, e = p.i < q.i ? q : p;
        ch.addOverlay({ id: 'rg', type: 'eq', from: s.i, to: e.i, low: rg.low, high: rg.high, dir: 'down', appearAt: Math.max(p.known, q.known) });
        var zone = zoneOf(rg, cs[at].c);
        html = '0 = ' + px(rg.zero) + ' (high) · 0.5 = ' + px(rg.eq) + ' · 1 = ' + px(rg.one) + ' (low) · ราคาปิดล่าสุดอยู่ใน ' + zone + ' ' + sim();
      } else html = 'เส้นสองเส้นต้องอยู่ที่ high หนึ่งตัวและ low หนึ่งตัว โดย high มาก่อน';
      if (levels) levels.innerHTML = html;
      var msg;
      if (j.ok) msg = '<b class="q__ok">ถูก</b> จาก high ล่าสุดของขาลง ลงมาถึง low ล่าสุด ไม่ได้ลากจากตัวเก่า ' + chip(842, 7);
      else if (j.why === 'old-start') msg = '<b class="q__no">ยังไม่ใช่</b> เส้นที่ high อยู่ที่ high เก่า (แท่งที่ ' + (j.start.i + 1) + ') ขาลงให้ลากจาก high <b>ล่าสุด</b> เขาเตือนว่าอย่าลากจากตัวเก่าแค่เพราะมี high ไกลออกไป ' + chip(731, 7);
      else if (j.why === 'end') msg = '<b class="q__no">ยังไม่ใช่</b> ปลายล่างยังไม่ใช่ low ล่าสุดที่ยืนยันแล้ว ลองเลื่อนเส้นอีกเส้นลงไปหา low ล่าสุด ' + chip(411, 7);
      else if (j.why === 'kinds') msg = '<b class="q__no">ยังไม่ใช่</b> เส้นทั้งสองอยู่ที่ swing ชนิดเดียวกัน ขาลงต้องใช้ high หนึ่งตัวกับ low หนึ่งตัว ' + chip(411, 7);
      else if (j.why === 'order') msg = '<b class="q__no">ยังไม่ใช่</b> ในขาลง high ต้องมาก่อน low (ลากจาก high ลงมาถึง low) ' + chip(411, 7);
      else if (j.why === 'none') msg = 'ยังลากกล่องไม่ได้ ปลายของ range ยังไม่ถูกยืนยัน เขารอแท่งขึ้นที่ยืนยัน low ก่อนค่อยวางกล่อง ' + chip(784, 7);
      else msg = '<b class="q__no">ยังไม่ใช่</b> ลองใช้ high ล่าสุดและ low ล่าสุดของขานี้ ' + chip(411, 7);
      read.innerHTML = msg + (j.ok ? '' : ' <span class="hint-inline">ลากเส้นแล้วปล่อย เส้นจะดูดไปที่ swing ที่ใกล้ที่สุด</span>');
    }
    // the mistake he warns about: the range starts at an older, higher high instead of the most recent one
    function startWrong() {
      var w = tgt.range, sw = swingsAt();
      var older = sw.highs.filter(function (x) { return x.i < w.from; }).sort(function (x, y) { return y.price - x.price; })[0] ||
                  sw.highs.slice().sort(function (x, y) { return y.price - x.price; })[0];
      var lo = sw.lows.filter(function (x) { return x.i === w.to; })[0];
      setHand('hA', { i: older.i, price: older.price, kind: 'high', known: older.pair[1] });
      setHand('hB', { i: lo.i, price: lo.price, kind: 'low', known: lo.pair[1] });
      refresh();
    }
    function load(seed) {
      b = build('S17', seed); cs = b.candles; K = b.truth.confluence;
      tgt = eqTarget(cs, K, 'down'); if (!tgt) throw new Error('S17 has no equilibrium range');
      at = tgt.at;
      ch.setData(b); ch.setOverlays(TJR.annotate(b, { upTo: at }).filter(function (o) { return o.type === 'marker' || o.type === 'level'; }));
      ch.reveal(at);
      ch.view(Math.max(0, at - 52), Math.min(cs.length - 1, at + 12));
      S.seed = b.meta.seed;
      frameLabel(fig, 'S17 · ' + TJR.scenarios.get('S17').title);
      startWrong();
    }
    function onDrag(e) {
      if (dead || !e || !e.done) return;
      var sw = snapSwing(cs, e.price, at);
      if (sw) setHand(e.id, sw);
      refresh();
    }
    // the right range: the swing high and the swing low the detector ends on
    function placeRight() {
      var w = tgt.range, sw = swingsAt();
      var hi = sw.highs.filter(function (s) { return s.i === w.from; })[0], lo = sw.lows.filter(function (s) { return s.i === w.to; })[0];
      setHand('hA', { i: hi.i, price: hi.price, kind: 'high', known: hi.pair[1] });
      setHand('hB', { i: lo.i, price: lo.price, kind: 'low', known: lo.pair[1] });
      refresh();
    }
    function playOn() {
      var my = ++run, to = Math.min(cs.length - 1, K.entry.at + 4);
      placeRight();
      ch.removeOverlay('rg-entry');
      ch.addOverlay({ id: 'rg-entry', type: 'marker', bar: K.entry.at, price: K.entry.price, shape: 'down', color: '#e6b84c', appearAt: K.entry.at });
      ch.reveal(at);
      ch.play({ from: at, to: to, barsPerSec: 4 }).then(function () {
        if (my !== run || dead) return;
        read.innerHTML = 'ราคาย่อขึ้นเข้า premium ของ range แล้วมีแท่งแดงปิดกลับลงใต้เส้น 0.5 (ลูกศรสีทอง) เขาไม่ short ทันทีที่แตะ แต่รอให้เห็นว่า equilibrium ถูก respect ก่อน ' + chip(1913, 1) + ' ' + sim();
      });
    }
    try { load(S.seed); } catch (e) { ch.destroy(); throw e; }
    offs.push(ch.on('drag', onDrag));
    return {
      destroy: function () { dead = true; run++; offs.forEach(function (f) { f(); }); ch.destroy(); },
      autoplay: function () {},
      remount: function () { ch.reveal(at); },
      reduced: function () {},
      act: function (name) {
        if (dead) return;
        if (name === 'answer') placeRight();
        else if (name === 'wrong') startWrong();
        else if (name === 'play') playOn();
        else if (name === 'reseed') load(randomSeed());
      },
      chart: ch
    };
  }

  // ---------------------------------------------------------------- lesson 5: the twin chart of S21 ("which index leads?")
  function makeTwin(fig, S) {
    var hostA = $('[data-k="hostA"]', fig), hostB = $('[data-k="hostB"]', fig), symA = $('[data-k="symA"]', fig), symB = $('[data-k="symB"]', fig);
    var read = $('[data-k="read"]', fig), asks = $('[data-pick]', fig), more = $('[data-act="more"]', fig);
    var b = null, cs = null, rd = null, tw = null, dead = false, run = 0, startAt = 0, onA = 'ES', onB = 'NQ';
    tw = TJR.chart.twin(hostA, hostB, { label: 'กราฟคู่ ES และ NQ ในช่วงเวลาเดียวกัน จุดตัดตรงกันทั้งสองกราฟ', interactive: true });

    function sideOv(inst, labels) {
      var n = rd.nums[inst], ov = [
        { id: 'sm-l-' + inst, type: 'trend', a: { bar: n.bar1, price: n.p1 }, b: { bar: n.bar2, price: n.p2 }, appearAt: rd.at }
      ];
      if (labels) {
        ov.push({ id: 'sm-1-' + inst, type: 'label', bar: n.bar1, price: n.p1, text: 'high แรก', pos: 'above', appearAt: rd.at });
        ov.push({ id: 'sm-2-' + inst, type: 'label', bar: n.bar2, price: n.p2, text: n.p2 > n.p1 ? 'higher high' : 'lower high', pos: 'above', appearAt: rd.at });
      }
      return ov;
    }
    function paintOv(labels, withBos) {
      var A = tw.a, B2 = tw.b, evs = withBos ? confOv(b, { bos: true }, ['bos:' + b.truth.confluence.confirm.at]) : [];
      A.setOverlays(sideOv(onA, labels).concat(onA === b.meta.instrument ? evs : []));
      B2.setOverlays(sideOv(onB, labels).concat(onB === b.meta.instrument ? evs : []));
    }
    function load(seed, swap) {
      b = build('S21', seed, { kind: 'high' }); cs = b.candles; rd = smtRead(b);   // this lesson teaches the bearish SMT; ES or NQ leads (P6.17)
      var twinBuilt = { candles: b.truth.twin.candles, meta: Object.assign({}, b.meta, { instrument: b.truth.twin.instrument }) };
      onA = swap ? b.truth.twin.instrument : b.meta.instrument; onB = swap ? b.meta.instrument : b.truth.twin.instrument;
      tw.setData(swap ? twinBuilt : b, swap ? b : twinBuilt);
      S.seed = b.meta.seed; S.swap = !!swap; S.answered = null;
      symA.textContent = onA; symB.textContent = onB;
      startAt = Math.max(0, Math.min(rd.nums.ES.bar1, rd.nums.NQ.bar1) - 14);
      paintOv(false, false);
      asks.forEach(function (a) { a.disabled = false; a.classList.remove('is-right', 'is-wrong'); setPressed(a, false); });
      if (more) more.hidden = true;
      read.innerHTML = 'ดูสองกราฟพร้อมกัน เส้นบางลากจาก high แรกไป high ที่สองของแต่ละ index แล้วเลือกว่า index ไหนเป็นตัวนำ';
      tw.reveal(rd.at);
    }
    function answer(inst) {
      if (S.answered) return;
      S.answered = inst;
      var right = inst === rd.leader, n = rd.nums;
      asks.forEach(function (a) {
        var v = a.getAttribute('data-pick');
        a.disabled = true; setPressed(a, v === inst);
        a.classList.toggle('is-right', v === rd.leader); a.classList.toggle('is-wrong', v === inst && !right);
      });
      paintOv(true, false);
      read.innerHTML = (right ? '<b class="q__ok">ถูก</b> ' : '<b class="q__no">ยังไม่ใช่</b> ') +
        rd.leader + ' ทำ high แล้ว lower high (' + px(n[rd.leader].p1) + ' → ' + px(n[rd.leader].p2) + ') ส่วน ' + rd.lagger +
        ' ทำ higher high (' + px(n[rd.lagger].p1) + ' → ' + px(n[rd.lagger].p2) + ') = bearish SMT ตัวที่ทำ lower high คือตัวนำ ' +
        chip(338, 6) + ' เขาเทรดตัวที่นำ ไม่ short ตัวที่ดันเหนือ high ' + chip(629, 6) + ' ' + sim();
      if (more) more.hidden = false;
    }
    function playTo(from, to, after) {
      var my = ++run;
      tw.reveal(from);
      tw.play({ from: from, to: to, barsPerSec: 8 }).then(function (done) { if (my === run && !dead && after) after(done); });
    }
    try { var was = S.answered; load(S.seed, S.swap); if (was) answer(was); } catch (e) { tw.destroy(); throw e; }
    return {
      destroy: function () { dead = true; run++; tw.destroy(); },
      autoplay: function () {
        if (S.started || dead) return;
        S.started = true;
        if (!M.reduced) playTo(startAt, rd.at);
      },
      remount: function () { tw.reveal(S.answered && S.more ? S.moreTo : rd.at); },
      reduced: function () { if (M.reduced) tw.reveal(rd.at); },
      act: function (name, arg) {
        if (dead) return;
        if (name === 'pick') answer(arg);
        else if (name === 'more') {
          var K = b.truth.confluence, to = Math.min(cs.length - 1, K.confirm.at + 2);
          paintOv(true, true);
          S.more = true; S.moreTo = to;
          read.innerHTML += '<br>เมื่อ SMT เกิดแล้ว เขายังรอให้โครงสร้างเปลี่ยนก่อน (BOS บนตัวนำ) ราคาสองขาลงยังพิสูจน์อะไรไม่ได้ ' + chip(1670, 1);
          playTo(rd.at, to);
        } else if (name === 'reseed') { load(randomSeed(), Math.random() < 0.5); S.started = true; playTo(startAt, rd.at); }
        else if (name === 'play') { S.started = true; if (S.answered) paintOv(true, false); playTo(startAt, rd.at); }
      },
      chart: tw.a
    };
  }

  // ---------------------------------------------------------------- slots: a chart lives only near the screen
  var CFG = {
    m1a: { make: makeBreak, seed: 'S20' },
    m2a: { make: makeFinder, seed: 'S15' },
    m2b: { make: makeStack, seed: 'S19' },
    m3a: { make: makeRace, seed: 'S16' },
    m4a: { make: makeRange, seed: 'S17' },
    m5a: { make: makeTwin, seed: 'S21' }
  };
  var slots = [], live = [];
  P.slots = slots;                                       // read-only handle for the console and the headless checks

  function Slot(fig, id) {
    var self = this, spec = CFG[id];
    self.fig = fig; self.id = id; self.api = null; self.near = false; self.inView = false;
    self.S = { seed: SEEDS[spec.seed] };
    self.mount = function () {
      if (self.api) return self.api;
      try { self.api = spec.make(fig, self.S); } catch (e) { self.api = null; if (global.console) console.error(e); return null; }
      live.push(self);
      trim(self);
      return self.api;
    };
    self.unmount = function () {
      if (!self.api) return;
      self.api.destroy(); self.api = null;
      var i = live.indexOf(self); if (i >= 0) live.splice(i, 1);
    };
  }
  function trim(keep) {
    while (live.length > MAX_LIVE) {
      var v = null, i;
      for (i = 0; i < live.length; i++) if (live[i] !== keep && !live[i].inView) { v = live[i]; break; }
      if (!v) for (i = 0; i < live.length; i++) if (live[i] !== keep) { v = live[i]; break; }
      if (!v) return;
      v.unmount();
    }
  }
  function initSlots() {
    $$('[data-slot]').forEach(function (fig) {
      var id = fig.getAttribute('data-slot');
      if (!CFG[id]) return;
      var s = new Slot(fig, id);
      slots.push(s);
      fig.addEventListener('click', function (e) {
        var t = e.target.closest ? e.target.closest('[data-act],[data-pick]') : null;
        if (!t || !fig.contains(t) || t.disabled) return;
        var api = s.mount();
        if (!api) return;
        if (t.hasAttribute('data-pick')) api.act('pick', t.getAttribute('data-pick'));
        else api.act(t.getAttribute('data-act'));
      });
    });
    if (!global.IntersectionObserver) { slots.forEach(function (s) { s.mount(); }); return; }
    var near = new global.IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var s = slots.filter(function (x) { return x.fig === e.target; })[0];
        if (!s) return;
        s.near = e.isIntersecting;
        if (s.near) s.mount(); else s.unmount();
      });
    }, { rootMargin: '90% 0px 90% 0px' });
    var view = new global.IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var s = slots.filter(function (x) { return x.fig === e.target; })[0];
        if (!s) return;
        s.inView = e.isIntersecting;
        if (e.isIntersecting) { var api = s.mount(); if (api) api.autoplay(); }
      });
    }, { threshold: 0.3 });
    slots.forEach(function (s) { near.observe(s.fig); view.observe(s.fig); });
    TJR.motion.onChange(function () { live.forEach(function (s) { if (s.api) s.api.reduced(); }); });
  }

  // ---------------------------------------------------------------- the self-checks
  var RIGHTS = {};
  function initChecks() {
    var all = {};
    $$('.check[data-m]').forEach(function (box) {
      var m = box.getAttribute('data-m'), qs = $$('.q', box);
      RIGHTS['m' + m] = qs.map(function (q) { return Number(q.getAttribute('data-right')); });
      var saved = TJR.store.get('conf.m' + m, null);
      all['m' + m] = saved && Array.isArray(saved.p) ? saved.p.slice(0, qs.length) : qs.map(function () { return null; });
    });
    function save(m) { TJR.store.set('conf.m' + m, { p: all['m' + m] }); }
    function paint(box) {
      var m = box.getAttribute('data-m'), picks = all['m' + m], st = quizState(picks, RIGHTS['m' + m]);
      $$('.q', box).forEach(function (q, qi) {
        var pick = picks[qi], right = Number(q.getAttribute('data-right')), fb = $('.q__fb', q);
        var sec = Number(q.getAttribute('data-sec')), clip = Number(q.getAttribute('data-clip'));
        $$('.opt', q).forEach(function (o) {
          var i = Number(o.getAttribute('data-i'));
          o.classList.toggle('is-right', pick === i && i === right);
          o.classList.toggle('is-wrong', pick === i && i !== right);
          setPressed(o, pick === i);
        });
        if (pick == null) fb.innerHTML = '';
        else if (pick === right) fb.innerHTML = '<b class="q__ok">ถูก</b> ' + q.getAttribute('data-why') + ' ' + chip(sec, clip);
        else fb.innerHTML = '<b class="q__no">ยังไม่ใช่</b> ลองเลือกใหม่ หรือดูช่วงนี้ในคลิป ' + chip(sec, clip);
      });
      var score = $('[data-k="score"]', box);
      if (score) { score.textContent = st.right.filter(Boolean).length + ' / ' + st.right.length; score.setAttribute('data-tone', st.done ? 'good' : ''); }
      box.classList.toggle('is-done', st.done);
      var link = $('.rail a[data-m="' + m + '"]');
      if (link) link.classList.toggle('is-done', st.done);
    }
    function count() {
      var n = countDone(all, RIGHTS);
      $$('[data-k="done"]').forEach(function (e) { e.textContent = String(n); });
      return n;
    }
    $$('.check[data-m]').forEach(function (box) {
      var m = box.getAttribute('data-m');
      paint(box);
      box.addEventListener('click', function (e) {
        var o = e.target.closest ? e.target.closest('.opt') : null, rs = e.target.closest ? e.target.closest('[data-act="clear"]') : null;
        if (o && box.contains(o)) {
          var q = o.closest('.q'), qi = $$('.q', box).indexOf(q);
          all['m' + m][qi] = Number(o.getAttribute('data-i'));
        } else if (rs) {
          all['m' + m] = $$('.q', box).map(function () { return null; });
        } else return;
        save(m); paint(box); count();
      });
    });
    count();
  }

  // ---------------------------------------------------------------- the rail: current lesson, progress
  function initRail() {
    var mods = $$('.module'), links = $$('.rail a[data-m]'), now = $('[data-k="now-mod"]'), bar = $('.rail__bar'), tick = false;
    if (!mods.length) return;
    function update() {
      tick = false;
      var line = global.innerHeight * 0.34, cur = mods[0];
      mods.forEach(function (m) { if (m.getBoundingClientRect().top <= line) cur = m; });
      var id = cur.getAttribute('data-m');
      links.forEach(function (a) {
        var on = a.getAttribute('data-m') === id;
        a.classList.toggle('is-current', on);
        if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
      if (now) now.textContent = 'บทที่ ' + id + ' · ' + $('h2', cur).textContent;
      var first = mods[0].getBoundingClientRect().top + global.pageYOffset, last = mods[mods.length - 1];
      var end = last.getBoundingClientRect().bottom + global.pageYOffset - global.innerHeight * 0.6;
      if (bar) bar.style.setProperty('--p', String(clamp((global.pageYOffset - first + global.innerHeight * 0.3) / Math.max(1, end - first), 0, 1)));
    }
    function req() { if (!tick) { tick = true; global.requestAnimationFrame(update); } }
    global.addEventListener('scroll', req, { passive: true });
    global.addEventListener('resize', req);
    update();
  }

  // ---------------------------------------------------------------- heading reveal (GSAP only, once)
  function headReveal() {
    var ST = M.ScrollTrigger;
    if (!M.enabled || !ST) return;
    var pending = [];
    $$('.module__head').forEach(function (head) {
      var h2 = $('h2', head), no = $('.module__no', head), rule = $('.module__rule', head);
      var tl = M.gsap.timeline({ paused: true });
      if (no) tl.from(no, { x: -14, opacity: 0, duration: 0.5, ease: 'power3.out', clearProps: 'all' }, 0);
      tl.from(h2, { clipPath: 'inset(0 100% 0 0)', y: 14, duration: 0.9, ease: 'power3.out', clearProps: 'all' }, 0.05);
      if (rule) tl.from(rule, { scaleX: 0, transformOrigin: 'left', duration: 0.9, ease: 'power3.out', clearProps: 'all' }, 0.1);
      var rec = { head: head, played: false, go: function () { if (rec.played) return; rec.played = true; tl.play(); } };
      pending.push(rec);
      ST.create({ trigger: head, start: 'top 92%', once: true, onEnter: rec.go });
    });
    // whatever stalls, a heading in view is never left hidden
    var tries = 0, iv = setInterval(function () {
      tries++;
      pending.forEach(function (r) { if (!r.played && r.head.getBoundingClientRect().top < global.innerHeight) r.go(); });
      if (tries > 8 || pending.every(function (r) { return r.played; })) clearInterval(iv);
    }, 1500);
  }

  // ---------------------------------------------------------------- start
  initChecks();
  initRail();
  initSlots();
  headReveal();
})(typeof window !== 'undefined' ? window : globalThis);
