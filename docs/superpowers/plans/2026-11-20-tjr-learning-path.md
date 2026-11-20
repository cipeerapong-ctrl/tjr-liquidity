# TJR v3 Learning Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (chosen: inline, see the end) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the site from "Level 1 / Level 2 by source" into one six-step learning path that starts with a beginner page.

**Architecture:** One `PATH` list in `assets/js/core/layout.js` drives the nav, a static step marker on every path page and an injected prev/next bar. A new `start.html` (step 0) teaches candles, timeframes, high/low and trend from clip #14 and the main clip, then gives a short glossary that links into the existing lessons. Lesson content is not rewritten; only framing text changes.

**Tech Stack:** Vanilla HTML/CSS/JS, classic scripts on `window.TJR`, GSAP 3.12.5 + ScrollTrigger from cdnjs, Node 24 tests (`node tests/run.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-20-tjr-learning-path-design.md` (and, for content rules, `docs/superpowers/specs/2026-11-19-tjr-v2-content-map.md`).

## Global Constraints

- Content rule (CLAUDE.md): claims come only from `docs/source/clip-facts.md` (F*) and `docs/source/playlist/<id>.md` (P<clip>.<n>); every teaching claim carries a chip made by `TJR.layout.chip(sec)` (main) or `TJR.layout.chip(sec, clip)` (playlist); main clip wins on conflict; gaps show `คลิปไม่ได้ระบุ`; paraphrase, no verbatim sentences; no TJR screenshots or footage.
- Chip seconds = the start of the LAST time range on the fact's line; a fact line with no time uses its section heading's start time (F2.1, F2.2 → 05:15 = 315 s). Every chip anchor carries `data-fact="<id>"`.
- **Copy voice (the user's words: easy to understand, not formal, not longer than needed):** plain spoken Thai, one idea per sentence, no academic register, no filler. Glossary entries at most two short lines. Trading terms stay English (high, low, sweep, liquidity, HH, HL, LH, LL, BOS, FVG, IFVG, SMT, session, stop-loss).
- No visible "Level 1", "Level 2", "L1", "L2" anywhere a reader sees (HTML text, aria-labels, injected text). Code comments may keep them.
- Dark terminal look, never violet; `prefers-reduced-motion` gives static final frames; GSAP only from cdnjs 3.12.5.
- localStorage keys `tjr.` inside try/catch (no new keys expected).
- Commit after each task; never push.

## Review Focus

1. Nav with 9 links at 1024–1100 px: must fit one row or collapse to the sheet; the sheet's JS breakpoint (`wireSheet`, `(min-width: 1024px)`) must equal the CSS one — Task 1 measures and pins both.
2. A start-page term used before it is defined (e.g. "sweep" in the high/low block) — Task 3 test checks definition order.
3. A chip whose second does not match its fact — Task 2/3 tests run the risk.test chip rule over start.html.
4. Leftover "Level" text in injected JS strings (scenarios.js viewer tag `'Level ' + lv`, card tags `'L' + lv`) that HTML greps miss — Task 5 test greps the JS string literals.
5. A glossary link to an anchor that does not exist — Task 3 test resolves every `href="page.html#id"` against that page's ids.

---

### Task 1: The path in layout.js, the nav, and a start.html shell

**Files:**
- Modify: `assets/js/core/layout.js` (PAGES, CTA, COLUMNS, new PATH, stepMarkerHTML, pathNavHTML, mount)
- Modify: `assets/css/site.css` (`.step-tag`, `.path-nav`; nav breakpoint if needed)
- Create: `start.html` (shell: head, noscript nav, hero placeholder `<h1>เริ่มที่นี่</h1>`, marker, scripts), `assets/css/pages/start.css` (empty header comment), `assets/js/pages/start.js` (mount only)
- Modify: the `<noscript>` nav copy in all 8 existing root pages
- Test: `tests/layout.test.js`, `tests/sources.test.js`, `tests/home.test.js` (PAGES lists)

**Interfaces:**
- Produces:
  - `TJR.layout.PATH` → `[{step:0,id:'start',label:'เริ่มที่นี่',href:'start.html'}, {step:1,id:'learn',label:'Liquidity',href:'learn.html'}, {step:2,id:'confluences',label:'Confluences',href:'confluences.html'}, {step:3,id:'strategy',label:'เซ็ตอัพเต็ม',href:'strategy.html'}, {step:4,id:'playbook',label:'Playbook',href:'playbook.html'}, {step:5,id:'risk',label:'ความเสี่ยง',href:'risk.html'}]`
  - `TJR.layout.PAGES` ids in order `home, start, learn, confluences, strategy, playbook, risk, scenarios, lab`; labels `หน้าแรก, เริ่มที่นี่, Liquidity, Confluences, เซ็ตอัพเต็ม, Playbook, ความเสี่ยง, สถานการณ์, แบบฝึก`.
  - CTA `{ label: 'เริ่มที่นี่', page: 'start' }`.
  - `TJR.layout.stepMarkerHTML(id) -> string`: step 0 → `<p class="step-tag" data-step="0">ขั้น 0 · เริ่มที่นี่</p>`; step n≥1 → `<p class="step-tag" data-step="n">ขั้น n จาก 5 · <label></p>`; not in PATH → `''`.
  - `TJR.layout.pathNavHTML(id, base?) -> string`: `<nav class="path-nav" aria-label="เส้นทางเรียน">` with a prev link `← ขั้นก่อนหน้า: <label>` (absent on step 0) and a next link `ขั้นถัดไป: <label> →`; on step 5 the next link is `ไปฝึกต่อ: สถานการณ์ →` to `scenarios.html`; not in PATH → `''`.
  - `mount(opts)`: when `opts.page` is in PATH, injects `pathNavHTML` as the last child of `<main>` (replacing an existing `[data-tjr-layout="path"]` on re-mount).
- Footer columns: `เส้นทาง` = home, start, learn, confluences, strategy; `ฝึกและใช้จริง` = playbook, risk, scenarios, lab (every PAGES entry appears once).

- [ ] **Step 1: Update the failing tests.** In `tests/layout.test.js` replace the PAGES label/id/href expectations with the lists above; the main-action check becomes `href="../start.html">เริ่มที่นี่</a>`; add:
  ```js
  test('layout.PATH: six steps 0..5 and the marker / prev-next builders', () => {
    eq(TJR.layout.PATH.map((p) => p.id), ['start', 'learn', 'confluences', 'strategy', 'playbook', 'risk']);
    eq(TJR.layout.stepMarkerHTML('start'), '<p class="step-tag" data-step="0">ขั้น 0 · เริ่มที่นี่</p>');
    eq(TJR.layout.stepMarkerHTML('strategy'), '<p class="step-tag" data-step="3">ขั้น 3 จาก 5 · เซ็ตอัพเต็ม</p>');
    eq(TJR.layout.stepMarkerHTML('lab'), '');
    const s = TJR.layout.pathNavHTML('start', ''), r = TJR.layout.pathNavHTML('risk', ''), c = TJR.layout.pathNavHTML('confluences', '');
    ok(s.indexOf('ขั้นก่อนหน้า') < 0 && s.indexOf('href="learn.html"') > 0, 'start: next only');
    ok(c.indexOf('href="learn.html"') > 0 && c.indexOf('href="strategy.html"') > 0, 'confluences: prev learn, next strategy');
    ok(r.indexOf('href="playbook.html"') > 0 && r.indexOf('href="scenarios.html"') > 0, 'risk: prev playbook, next practice');
    eq(TJR.layout.pathNavHTML('lab', ''), '');
  });
  ```
  In `tests/sources.test.js` update the PAGES lists and `count(html, 'class="nav__link"')` to 9. In `tests/home.test.js` add `'start.html'` to its `PAGES` list.
- [ ] **Step 2:** Run `node tests/run.mjs` → the new and changed tests FAIL.
- [ ] **Step 3: Implement** the layout.js changes above; `.step-tag` (same pill shape as `.level-tag`, accent colour from tokens) and `.path-nav` (two links, prev left, next right, 44 px min tap height, wraps to two rows under 600 px) in site.css; create the `start.html` shell with the same head/script order as `confluences.html` minus the chart and scenario scripts it does not need (it needs ns, sources, store, layout, motion, start.js; add the chart scripts only if Task 2 uses the engine), the marker `stepMarkerHTML('start')` as static HTML at the top of `<main>`, and `TJR.layout.mount({ page: 'start' })` in start.js; regenerate the `<noscript>` nav copy in all 9 root pages from `navHTML({ page, base: '' })` (the audit test compares hrefs to PAGES).
- [ ] **Step 4:** Run `node tests/run.mjs` → all pass.
- [ ] **Step 5: Nav fit.** Serve the folder (`python -m http.server 5391 --bind 127.0.0.1`), open `index.html` in Claude in Chrome, and measure at widths 1024, 1100, 1280: `nav__links` scrollWidth ≤ clientWidth and no link wraps. If 1024 fails, move the CSS breakpoint where the bar switches to the sheet to the smallest width that fits (e.g. 1180) AND change the `wide` media query in `wireSheet` to the same value; re-measure. Record the widths in the commit message.
- [ ] **Step 6: Commit** `feat: learning path in the shared layout, nine-link nav, start page shell`.

### Task 2: Start page blocks 1–5 (hero, candle, timeframe, high/low, trend)

**Files:**
- Modify: `start.html`, `assets/css/pages/start.css`, `assets/js/pages/start.js`
- Create: `tests/start.test.js`

**Interfaces:**
- Consumes: `TJR.layout.chip(sec, clip)`, `TJR.layout.PATH`, `TJR.motion` (as the other pages use it).
- Produces: section ids `#path` (hero path), `#candle`, `#timeframe`, `#highlow`, `#trend`; `TJR.startPage.split(open, close, high, low, n, seed?) -> [{o,h,l,c}]` — n sub-candles whose first open = open, last close = close, max high = high, min low = low, every price on tick 0.25 (pure, tested).

Content per block (paraphrase; facts and their chips — playlist clip #14 = `8qwEmE1DwYw`):
- **Hero (#path):** h1 in plain words, e.g. "เริ่มจากศูนย์: อ่านกราฟให้เป็นก่อน แล้วค่อยเรียนระบบของ TJR"; one line on who it is for; the six stops from `PATH` as a numbered row (step 0 marked "คุณอยู่ตรงนี้"); button "เริ่มอ่าน" → `#candle`.
- **#candle:** P14.17, P14.18, P14.19, P14.20, P14.22, P14.23. Visual: an inline SVG up candle and down candle, labels open / high / low / close / body / wick; labels draw in once with GSAP when the block enters; static with every label shown under reduced motion.
- **#timeframe:** P14.25, P14.26, P14.27, P14.28. Visual: one candle (a "4 ชั่วโมง" label) and a toggle button "แยกเป็น 1 ชั่วโมง" that animates it into four candles from `split(...)` and back ("รวมเป็น 4 ชั่วโมง"); `aria-pressed` on the toggle; reduced motion swaps instantly.
- **#highlow:** F2.1 and F2.2 first (main chips, 315 s), then P14.33, P14.35, P14.36 as "รายละเอียดจากคลิป #14" (they agree with the main clip, so no older-note box). Visual: a short drawn series (SVG, about 12 candles) with each high and low marked.
- **#trend:** F3.1 first (main chip 06:15), then P14.38, P14.39, P14.41, P14.43 (a trend can change; a trend alone is not a reason to press buy or sell). Visual: two labelled zigzags (HH/HL up, LH/LL down).

- [ ] **Step 1: Write the failing tests** in `tests/start.test.js`:
  - `start.split: n candles, opens at open, closes at close, keeps high and low, on tick 0.25` — for n in [2,4,6] and 50 seeds: `r.length === n`, `r[0].o === open`, `r[n-1].c === close`, `max(h) === high`, `min(l) === low`, each value % 0.25 === 0, each candle `l <= min(o,c)` and `h >= max(o,c)`, and `r[k].o === r[k-1].c`.
  - `start.html: every chip names its fact and links the start of its range` — copy the `starts(id)` and anchor loop of `tests/risk.test.js` lines 186–211, extended: a fact line without a time uses the start time of its `## ` heading; allowed clips: 0 (main) and the playlist clips the page cites.
  - `start.html: blocks in order and each block cites its facts` — section order `path, candle, timeframe, highlow, trend`; required `data-fact` ids per block as listed above.
  - `start.html: no TJR footage, no Level wording` — no `<img`, `<video`, `<iframe`; `!/Level\s?[12]|\bL[12]\b/.test(visibleText)`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** the blocks, `split`, the SVGs and the two motions. Copy follows the voice constraint.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat: start page basics: candle, timeframe, high/low, trend`.

### Task 3: Start page blocks 6–8 (chart settings, glossary, next)

**Files:**
- Modify: `start.html`, `assets/css/pages/start.css`, `tests/start.test.js`

**Interfaces:**
- Produces: `#settings`, `#terms` (each entry `<div class="term" id="t-<key>">` with `<dt>`/`<dd>`), the path-nav from mount.

Content:
- **#settings** (small box, "ตั้งค่ากราฟตามที่เขาแนะนำ"): New York time (P14.13), a free account is enough (P14.9). He names TradingView as his own choice (P14.8): the name may appear as text, no link to it.
- **#terms**, in this order, keys in brackets: liquidity [liquidity], sweep [sweep], draw on liquidity [draw], session [session], BOS [bos], FVG [fvg], IFVG [ifvg], equilibrium / premium / discount [eq], SMT [smt]. Each: one or two short lines, its chip (`data-fact`), and a link "เรียนเต็มในขั้น N →" to the section that teaches it: liquidity, sweep, session → `learn.html#m1`…`#m7` (the module that teaches it); draw → the module or confluences section that names it; bos → `confluences.html#m1`; fvg → `#m2`; ifvg → `#m3`; eq → `#m4`; smt → `#m5`. Pick each definition fact from the clip that teaches the term (main clip first where it defines it; else its playlist episode: #13 liquidity, #11 BOS, #10 FVG, #8 IFVG, #7 equilibrium, #6 SMT, #5 sessions). Session times follow the main clip (F7.7; v2 conflict C1). BOS line notes, in one short clause, that TJR uses BOS for a change of trend (v2 conflict C8; the web-definition box stays on the playbook page, not repeated here).
- **Next:** a short line and the injected path-nav (next: Liquidity).

- [ ] **Step 1: Add failing tests:**
  - `start.html #terms: nine terms in order, each with a chip and a link to an existing anchor` — keys in the order above; for each link `page.html#id`, `readText(page)` contains `id="<id>"`.
  - `start.html: a term is defined before it is used` — for each glossary term, its first occurrence in the visible text of blocks `#path`…`#trend` is none (those blocks use only candle, open, high, low, close, body, wick, timeframe, trend, HH, HL, LH, LL); the hero may name the six stops' labels.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat: start page settings tip and glossary into the lessons`.

### Task 4: Path framing on the five lesson pages

**Files:**
- Modify: `learn.html`, `confluences.html`, `strategy.html`, `playbook.html`, `risk.html` and their `assets/js/pages/*.js` only where they emit visible Level text (`playbook.js` line ~303 "confirmation แบบ Level 1")
- Test: `tests/learn.test.js`, `tests/confluences.test.js`, `tests/strategy.test.js`, `tests/playbook.test.js`, `tests/risk.test.js`, `tests/finalfix.test.js` (only its page-level tag checks)

Changes:
- The page-top `<p class="level-tag" data-level="…">Level n · …</p>` → `stepMarkerHTML(id)` output (static HTML); risk.html's `L2` span near line 54 is removed (the marker carries the step).
- Inline source tags keep class `level-tag` and `data-level`, text `L1` → `คลิปหลัก`, `L2` → `เพลย์ลิสต์`.
- confluences "Level 1 ยังอยู่" note title → "ในคลิปหลัก (ขั้น 1) ยังใช้ได้"; learn "ต่อใน Level 2" → "ต่อในขั้น 2", its three `Level 2` dd tags → `ขั้น 2`.
- The pages' `close` (footer close row) and the injected path-nav must not point two different "next" places: keep each page's close row but make its button the same target as the path-nav's next.

- [ ] **Step 1:** Update the tests that assert the old tags (e.g. `learn.test.js:176` → `stepMarkerHTML('learn')` string; `strategy.test.js:179` likewise) and add, in a shared loop over the five pages, `no visible Level wording` (same regex as Task 2) and `the marker is the one stepMarkerHTML(id) returns`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat: step markers and path wording on the lesson pages`.

### Task 5: Practice pages tagged by step

**Files:**
- Modify: `scenarios.html`, `assets/js/pages/scenarios.js`, `lab.html`, `assets/js/pages/lab.js` (visible strings only)
- Test: `tests/scenarios.test.js`, `tests/lab.test.js`

Changes:
- Both pages get a static `<p class="step-tag step-tag--practice">ฝึก · ใช้คู่กับขั้น 1–3</p>` at the top (no path-nav: they are not in PATH).
- Scenarios filter chips: `Level 1` → `ฝึกขั้น 1 · Liquidity` (S01–S14), `Level 2` → `ฝึกขั้น 2–3 · ระบบเต็ม` (S15–S22); keep `data-f="l1"/"l2"` values. Card tag text `L1/L2` → `ขั้น 1` / `ขั้น 2–3`; viewer tag `Level n` → the same; meta description without "Level".
- Lab: the four v1 modes labelled "ใช้คู่กับขั้น 0–1", the three drills "ใช้คู่กับขั้น 2–3" (on the tab or its intro line).

- [ ] **Step 1:** Update the tests that pin the old chip/tag text; add `no visible Level wording` for both HTML files AND for the string literals of scenarios.js and lab.js that reach the DOM: `!/['"][^'"]*(Level ?[12]|\bL[12]\b)[^'"]*['"]/.test(code without comments)`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat: practice pages tagged by step`.

### Task 6: Home page around the path

**Files:**
- Modify: `index.html`, `assets/css/pages/home.css`, `assets/js/pages/home.js` (only if it reads the removed section)
- Test: `tests/home.test.js`

Changes:
- Hero: h1 says the site teaches TJR's system in Thai from zero (no "Liquidity อยู่เหนือ High" in the h1); primary button `เริ่มที่นี่` → `start.html`; secondary `ดูเซ็ตอัพเต็ม` → `strategy.html`.
- `#system` ("ระบบเต็มของ TJR มี 2 ระดับ") → `#path` "เส้นทาง 6 ขั้น": six stops from step 0 to 5, each a link with one plain line of what you learn there; keep the 8 chapter links to `learn.html#m1..m8` under stop 1 and the five links `confluences.html#m1..m5` under stop 2 (the existing tests' link sets move to `#path`).
- `#core`, `#course`, `#practice`, `#sources` stay; re-label "Level" text to steps; `#sources` keeps "main clip wins on conflict".
- Meta description: no "Level", still says 22 สถานการณ์.

- [ ] **Step 1:** Rewrite the `#system` tests for `#path` (six `class="path-stop"` items, links above, names bias/sweep/BOS/IFVG/FVG/equilibrium) and add: hero primary href `start.html`; no visible Level wording; one-section-per-screen order test updated to `hero, core, path, course, practice, sources`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat: home page built around the learning path`.

### Task 7: Docs, audits and the browser check

**Files:**
- Modify: `CLAUDE.md` (Pages section), `README.md`, `tests/finalfix.test.js` (README words: `Level 1`/`Level 2` → `start.html`, `ขั้น`, `path`)

- [ ] **Step 1:** Update the README test, then README (pages as the path, folder map with `start.*`) and CLAUDE.md "Pages (v3)" (path order; practice pages; Level naming retired from visible text).
- [ ] **Step 2:** `node tests/run.mjs` → all pass.
- [ ] **Step 3:** Run the content audit `node "<scratchpad>/audit.mjs"` over the 9 pages (add `start.html` to its list if it is hard-coded): local links and anchors resolve, no banned strings, no clip #4 id → "AUDIT CLEAN".
- [ ] **Step 4:** In Claude in Chrome over the local server: no horizontal overflow at 390 on all 9 pages; nav fit at 1024/1100/1280 (Task 1 values); start page: candle labels draw in, the timeframe toggle splits and joins, reduced motion shows the final frames; path-nav prev/next on all six path pages; no console errors.
- [ ] **Step 5: Commit** `docs: pages map and readme for the learning path`.

### After Task 7

One whole-branch review on the most capable model (Opus subagent, the user approved one end review in v2), its single fix wave, then ask the user before republishing to `https://claude.ai/artifact/7TXef9ojVgxxhLCqpCF3Md` with `start.html` and `assets/css/pages/start.css`, `assets/js/pages/start.js` added to `files`.

## Execution

Inline (superpowers:executing-plans) on Sonnet: the tasks lean on each other's layout API, the copy voice needs one hand, and this harness spawns subagents only when the user asks (observation 0012), so per-task subagent reviews are not used; the one end review is the user-approved exception.
