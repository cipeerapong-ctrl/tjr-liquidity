# TJR Site v2 (Full System) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the live TJR liquidity site (v1) into TJR's full system: the liquidity clip stays Level 1, and his 16-video playlist adds Level 2. Level 2 covers the confluences (BOS, FVG, IFVG, equilibrium, SMT, opening gaps/BPR), daily bias, time windows, the full strategy chain, and risk. Every claim cites its own video and timestamp.

**Architecture:** Same stack as v1: classic scripts on `window.TJR`, Canvas 2D engine, Node `vm` tests. New pure detectors (`TJR.confluence`) read FVGs, breaks of structure, equilibrium ranges and SMT from candles. New overlay shapes draw them. New scenarios script full-system setups. Three new pages (`confluences`, `strategy`, `risk`) and rebuilt `playbook` reuse the v1 page patterns.

**Tech Stack:** HTML/CSS/vanilla JS, Canvas 2D, GSAP 3.12.5 + ScrollTrigger 3.12.5 (cdnjs), Google Fonts, Node 24 tests.

**Spec:** `docs/superpowers/specs/2026-11-19-tjr-v2-content-map.md` (approved 2026-11-19) · v1 spec `docs/superpowers/specs/2026-11-16-tjr-liquidity-site-design.md` · sources `docs/source/clip-facts.md` (ids `F*`) and `docs/source/playlist/<videoId>.md` (ids `P<clip#>.<n>`).

## Global Constraints

- Content only from `clip-facts.md` and `docs/source/playlist/*.md`. Main clip (`Vulini8xbB0`) wins on conflict; the older version may appear only in a `.older-note` box labelled `คลิปเก่า (ม.ค. 2026) พูดว่า…`. Conflict rulings C1–C9 in spec §2 are binding.
- Every teaching claim carries a chip to the video it came from: main `▶ MM:SS` → `https://youtu.be/Vulini8xbB0?t=<s>`; playlist `▶ #<clip> MM:SS` → `https://youtu.be/<videoId>?t=<s>`.
- Anything no clip says → badge `คลิปไม่ได้ระบุ` (list in spec §7), never filled. Paraphrase only; no transcript sentences; no TJR screenshots/footage.
- Excluded (spec §6): prop-firm promo codes, firm names' rule tables, prices, payout caps, income figures; clip #16 goal/life claims; web definitions except the BOS box (C8) labelled `นิยามทั่วไป ไม่ใช่จากคลิป` with its URL. On-screen tool readouts are labelled `ตัวเลขจากเครื่องมือบนจอ ไม่ใช่ที่เขาพูด`.
- Level 1 confirmation (F6.5–F6.9, H/L/HL/HH) stays exactly as v1 teaches it; Level 2 (BOS/IFVG → FVG/EQ) is added beside it, never replacing it.
- Thai text; trading terms stay English (high, low, sweep, liquidity, BOS, FVG, IFVG, equilibrium, premium, discount, SMT, session, stop-loss…).
- Classic scripts only, no ES modules, no local `fetch`. CDN: GSAP/ScrollTrigger 3.12.5 from cdnjs only.
- Prices tick `0.25`; candle `t` = unix seconds UTC; show ET and Thailand (UTC+7). Sessions per F7.7 (London ends 08:30 in practice; NY 09:30–17:00; spread hour 17:00–18:00). NY windows per P5.12–P5.19: manipulation 09:30–09:50, entry 09:50–10:10, his cut-off 10:30, PM 13:00.
- localStorage keys `tjr.` prefixed, inside try/catch; v2 keys never reuse a v1 key with a new shape.
- Dark terminal look, never violet; `prefers-reduced-motion` → static final frames. Controls ≥ 44 px.
- Do not edit design-kit files in `assets/` copied from the skill. Every task ends with a commit ending `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (or the model that did it). Never push.

## Review Focus

1. **Look-ahead** — an FVG, BOS ray, IFVG flip or equilibrium box shown before the bar where it becomes knowable (third candle closed / breaking candle closed / confirming up candle closed). Pinned in Task 3 (annotate `upTo` tests).
2. **Wick vs close edges** — a candle closing exactly ON the level, or a wick far through it, counted as a break/inversion (P11.10, P11.13, P8.20 say no). Pinned in Task 2.
3. **Unlucky seeds in new scenarios** — 200 seeds per scenario × outcome through `check`. Pinned in Task 4.
4. **A chip that points at the wrong video or past its end** — a playlist chip using the main clip URL, or `t` beyond the video's length. Pinned in Task 1 (audit test over every `*.html`).
5. **Stale v1 storage and phone widths** — a v1 `tjr.playbook.checks` array read into the new checklist; the SMT twin chart unreadable at 390/320 (must stack vertically). Pinned in Task 7 (stale-key test) and Task 3 (twin layout test) + final screenshots.

## File Map (new or changed)

```
assets/js/core/sources.js        NEW  TJR.sources: video table, fact→video, chip href
assets/js/core/ns.js             tsChip(sec, clip?)
assets/js/core/layout.js         chip(sec, clip?), olderNote(), webDef(), nav/footer with 3 new pages
assets/css/site.css              .ts-chip--pl, .older-note, .web-def, .level-tag (L1/L2)
assets/js/scenario/confluence.js NEW  TJR.confluence: fvgs, stacks, bos, eqRange, smt
assets/js/scenario/sessions.js   nyWindows(utcDaySec)
assets/js/chart/overlays.js      new shapes fvg, bos, eq, band
assets/js/chart/chart.js         TJR.chart.twin
assets/js/scenario/annotate.js   annotate.confluence(built, opts)
assets/js/scenario/library.js    exposes TJR.scenarios.kit + register()
assets/js/scenario/system.js     NEW  S15–S22
assets/js/scenario/grade.js      fvg, bos, eq, smt, window graders
confluences.html strategy.html risk.html               NEW pages (+ css/pages, js/pages)
learn.html playbook.html scenarios.html lab.html index.html   updated
tests/sources.test.js tests/confluence.test.js tests/system.test.js  NEW (+ additions to existing tests)
tests/run.mjs                    SCRIPTS gains core/sources, scenario/confluence, scenario/system
```

Script order on every page: `ns, sources, store, rng, swings, gen, sessions, confluence, library, system, annotate, grade, scale, render, overlays, chart, layout, motion, pages/<page>`.

## Shared data shapes

```js
// TJR.sources.list item
{ clip: 0, id: 'Vulini8xbB0', title: 'The ONLY Liquidity Guide…', date: '2026-07-21', dur: 2947, main: true }
{ clip: 8, id: '4sRDnVmLcMk', title: 'Inverse Fair Value Gaps Explained', date: '2026-01-09', dur: 1351, main: false }
// FVG from TJR.confluence.fvgs
{ i: 41, from: 40, to: 42, dir: 'bull'|'bear', low, high,
  state: 'open'|'respected'|'disrespected', stateAt: bar|null, deletedAt: bar|null }
// BOS event from TJR.confluence.bos
{ at: 57, dir: 'up'|'down', level: { i: 49, price: 30012.25 } }
// equilibrium range from TJR.confluence.eqRange
{ dir: 'up'|'down', from: lowOrHighBar, to: otherBar, low, high, eq, knownAt: bar }
// built scenario (v1 shape) gains, for S15–S22:
truth.confluence = { confirm: { kind: 'bos'|'ifvg', at }, cont: { kind: 'fvg'|'eq', at, low, high },
                     entry: { at, price }, targets: [{ price, levelId }] }
truth.twin = { instrument: 'ES'|'NQ', candles: Candle[], leader: 'main'|'twin' }   // S21 only
```

Video table (Task 1 data; dur in seconds from the facts headers):
0 Vulini8xbB0 2947 · 1 TEp3a-7GUds 2591 · 2 hBnD6T1M4w8 1117 · 3 ironJFzNBic 1856 · 4 52nxvJKM57U 1177 · 5 L4xz2o23aPQ 661 · 6 7dTQA0t8SH0 964 · 7 joe_XTCn5Bs 864 · 8 4sRDnVmLcMk 1351 · 9 PlsHO33j6B8 1384 · 10 xX5LTSJ5wwM 2023 · 11 Zzk864cVJek 743 · 12 AGmAVyAuBE0 3224 · 13 crMqxB_nHhk 2139 · 14 8qwEmE1DwYw 2474 · 15 R62RnJrKH3Q 1351 · 16 3GZgBBMzC_E 2396. Titles and dates: the first lines of each facts file.

---

## Phase A — engine, confluences, playbook

### Task 1: Sources, multi-clip chips, nav (model: Sonnet)

**Files:** Create `assets/js/core/sources.js`, `tests/sources.test.js`. Modify `ns.js`, `layout.js`, `site.css`, `tests/run.mjs`, the `<script>` list of all 5 existing pages.

**Interfaces — Produces:**
- `TJR.sources.list`, `TJR.sources.byClip(n) -> item|null`, `TJR.sources.forFact('P8.19'|'F7.7') -> item` (prefix `F` → clip 0; `P<n>.` → clip n), `TJR.sources.href(clip, sec) -> url`.
- `TJR.util.tsChip(sec, clip?) -> {label, href, clip}`: clip 0/undefined → label `MM:SS`; clip n → label `#n MM:SS`.
- `TJR.layout.chip(sec, clip?)` (playlist chips get class `ts-chip ts-chip--pl`, aria-label `ดูในคลิป #n <title> ที่ MM:SS`), `TJR.layout.olderNote(html, clip, sec)`, `TJR.layout.webDef(html, url)`.
- Nav PAGES: หน้าแรก, บทเรียน, Confluences (`confluences.html`), กลยุทธ์ (`strategy.html`), สถานการณ์, Playbook, ความเสี่ยง (`risk.html`), แบบฝึก. Footer source line: `เนื้อหาจากคลิปของ TJR เท่านั้น` + main clip link + "เพลย์ลิสต์ Path to Profitability" link `https://www.youtube.com/playlist?list=PLKE_22Jx497s5Q6ZX2pfDcDwCm_IyxR7e`. Pages not yet built are still linked (they land in later tasks; the final task checks no dead link remains).

- [ ] Step 1: Tests: `tsChip(548, 8)` → `{label:'#8 09:08', href:'https://youtu.be/4sRDnVmLcMk?t=548', clip:8}`; `tsChip(45)` unchanged from v1; `forFact('F7.7').clip === 0`, `forFact('P12.8').clip === 12`; **audit**: for every `*.html` in the repo root, every `a.ts-chip` href's video id is in `list` and `t ≤ dur`, and a chip with class `ts-chip--pl` never links `Vulini8xbB0`; every `P\d+\.\d+` id written in a `data-fact` attribute exists in its playlist file (read with `readText`).
- [ ] Step 2: Run → FAIL. Implement; add `.ts-chip--pl` (muted outline, same height), `.older-note`, `.web-def`, `.level-tag` to `site.css`. Run → PASS (all 202 v1 tests still pass). Commit `feat: multi-clip sources and chips`.

### Task 2: Confluence detectors and NY windows (model: Sonnet)

**Files:** Create `assets/js/scenario/confluence.js`, `tests/confluence.test.js`. Modify `sessions.js`, `tests/sessions.test.js`.

**Interfaces — Produces** `TJR.confluence`:
- `fvgs(cs) -> FVG[]` — bull at middle i when `cs[i].c > cs[i].o` and `cs[i-1].h < cs[i+1].l` (low = `cs[i-1].h`, high = `cs[i+1].l`); bear mirror with `cs[i].c < cs[i].o` and `cs[i-1].l > cs[i+1].h` (P10.8–P10.10, P10.14). Only the middle candle's direction matters. `disrespected` at the first bar after `to` whose CLOSE is strictly beyond the far side (bull: `c < low`; bear: `c > high`) (P10.22, P10.24, P8.19–P8.20). `respected` at the first bar after `to` that has traded into the gap and closes back out in the gap's direction before any disrespect (P10.27). `deletedAt`: bull = first bar after the gap was entered whose high exceeds the highest high from `from` to the bar before price first entered; bear mirror (P10.28, P10.31). Write in the file header that `respected`/`deletedAt` are the site's reading of his examples.
- `stacks(fvgList, cs) -> [{dir, gaps:[FVG…], low, high, inversedAt}]` — consecutive same-direction gaps with no opposite-direction candle between their middles (P8.32); `inversedAt` = close beyond the far gap (bull: the bottom gap) (P8.34).
- `bos(cs, {from, trend:'up'|'down'}) -> BOS[]` — uptrend watches only the most recent confirmed swing low (`TJR.swings.find`, a swing is known at its pair's second candle); break = first candle whose close is strictly below it; trend flips; then watch the most recent swing high; repeat (P11.8–P11.17).
- `eqRange(cs, {at, dir}) -> Range|null` — up: most recent swing low known at `at` → highest high after it up to `at`; down mirror; `eq = roundTick((low+high)/2)`; `knownAt` = bar where the end swing is confirmed (P7.4, P7.14–P7.16, P7.30).
- `smt(a:{p1,p2}, b:{p1,p2}, kind:'high'|'low') -> {type:'bearish'|'bullish'|null, leader:'a'|'b'|null}` — highs: one makes a lower second high while the other makes a higher one → bearish, leader = the lower-high side; lows mirror → bullish, leader = the higher-low side (P6.15–P6.19).
- `TJR.sessions.nyWindows(utcSec) -> {open, manipulation:{from,to}, entry:{from,to}, cutoff, pm}` (utc seconds of that ET day, DST-aware).

- [ ] Step 1: Tests with hand-built candles: bull and bear gap found; overlapping wicks → none; a red first candle still forms a bull gap; close equal to `low` → still `open`; long wick below `low` with close inside → not disrespected; close below → `disrespected` at that bar; respected then new high → `deletedAt` set; stack of two bull gaps closed under only the top one → `inversedAt` null, under the bottom one → set; BOS: wick under the low → no event, body close exactly on the low → no event, close under → event; after a lower high alone in an uptrend → no event; `eqRange` picks the most recent low, not an older lower one; `smt` four cases incl. role swap; `nyWindows` on 2026-01-09 (EST) and 2026-07-09 (EDT) give 14:30Z/13:30Z opens.
- [ ] Step 2: Run → FAIL. Implement. Run → PASS. Commit `feat: confluence detectors and NY windows`.

### Task 3: Overlays, annotate, twin chart (model: Sonnet)

**Files:** Modify `overlays.js`, `chart.js`, `annotate.js`, `tests/overlays.test.js`, `tests/chart.test.js`, `dev/chart-demo.html`.

**Interfaces — Consumes:** Task 2. **Produces:**
- Overlay shapes: `{type:'fvg', from, to, low, high, dir, state, stateAt?, endAt?, label?}` (box from `from` to `endAt` or the right edge; bull uses `--c-bull` at low alpha, bear `--c-bear`; once `stateAt` ≤ revealed bar: respected → solid edge, disrespected → dashed edge + pill `IFVG`); `{type:'bos', price, from, at, dir}` (ray from the swing to `at`, pill `BOS` at `at`); `{type:'eq', from, to, low, high, dir}` (box with lines and right-side labels `0`, `0.5`, `1`; the half away from the trend tinted `premium`/`discount`, labels Thai-free English); `{type:'band', from, to, label}` (full-height time band, e.g. `09:30–09:50 manipulation`).
- `TJR.annotate.confluence(built, {upTo?, show?:{fvg, bos, eq, windows}}) -> Overlay[]` built from `TJR.confluence` on `built.candles`, each with `appearAt` = knowable bar (FVG: `to`; BOS: `at`; EQ: `knownAt`; state changes take effect at `stateAt`).
- `TJR.chart.twin(elA, elB, opts) -> {a:Chart, b:Chart, setData(builtA, builtB), reveal(n), play(o), destroy()}`: shared view, reveal and crosshair bar; container class `twin` lays them side by side ≥ 768 px, stacked below.

- [ ] Step 1: Tests: for a built S01 (seed 7) `annotate.confluence(b,{upTo:k})` never returns an overlay whose `appearAt > k`, for every k; an `fvg` with `stateAt` after the revealed bar draws as open (state check via a stubbed ctx call log, as v1 overlay tests do); `twin` with fake canvases: `reveal(30)` reveals both; `destroy` removes all listeners of both; `site.css` has a `max-width: 767px` rule that stacks `.twin` vertically.
- [ ] Step 2: Run → FAIL. Implement. Run → PASS. Add an FVG/BOS/EQ panel and a twin panel to `dev/chart-demo.html`. Commit `feat: confluence overlays and twin chart`.

### Task 4: Full-system scenarios S15–S22 (model: Opus — heaviest judgment in the plan)

**Files:** Modify `library.js` (expose `TJR.scenarios.kit = {Script, keep helpers…, mixSeed, VOL}` and `register(defs)` that appends to `list` and keeps `get/random/check` working). Create `assets/js/scenario/system.js`, `tests/system.test.js`; add the script to `run.mjs` and every page after `library`.

Each scenario reads its truth back from candles with `TJR.confluence` (never hard-codes a gap). `check` gains, when `truth.confluence` exists: the confirm event is a real `bos`/`ifvg` from the detectors at that bar and after `truth.sweep.bar`; `cont` is a real FVG (respected at or before `entry.at`) or `eqRange` whose zone the price entered before `entry.at`; `entry.at` > confirm `at`; win → a target reached after entry; for S18/S20 the "no trade" truth (`side:null`) holds.

| id | title idea (Thai on the page) | tf / inst | facts | outcomes |
|---|---|---|---|---|
| S15 | Long ครบสาย: sweep session low → BOS ขึ้น → ย่อเข้า bull FVG → เข้า → TP ที่ highs | 5 NQ | P1.19, P10.21, P11.21, P1.51 | win, fail |
| S16 | Short ด้วย IFVG: sweep high → bull FVG โดนปิดใต้ → ย่อเข้า bear FVG → เข้า | 5 ES | P8.14, P8.24–P8.25, P7.11 | win, fail |
| S17 | Equilibrium: BOS ลง → ย่อขึ้นเกิน 0.5 เข้า premium → ลง | 15 ES | P7.17, P7.24, P7.28 | win |
| S18 | FVG โดนปิดทะลุ = ห้าม short, bias เปลี่ยน | 60 ES | P10.25, P3.6, P3.21 | (no trade) |
| S19 | Stacked FVG: ปิดใต้ gap บน แต่ gap ล่างยังยืน → เทรนด์ยังขึ้น | 60 ES | P10.29, P8.34, P8.36 | win |
| S20 | ไส้ทะลุ low ≠ BOS: ไส้ลึกแต่ไม่ปิดใต้ → ยังขาขึ้น, break จริงทีหลัง | 5 ES | P11.13–P11.14 | (no trade at the wick) |
| S21 | SMT ที่ London high: NQ ทำ HH, ES ทำ LH → เทรด ES → BOS → EQ → เข้า | 5 ES+NQ twin | P1.31–P1.41, P6.15–P6.21 | win |
| S22 | Time windows: manipulation 09:30–09:50 → เข้า 09:50–10:10 | 5 NQ, real ET day | P5.13–P5.18, P5.21–P5.22 | win |

S21 builds the twin from the same waypoints with only the second high differing (twin: higher high; main ES: lower high), both through `gen.guard`; `truth.twin.leader = 'main'`. S22's sweep and entry bars must fall inside `nyWindows` ranges; `check` asserts it.

- [ ] Step 1: Tests: ids S15–S22 present via `TJR.scenarios.get`; every scenario × seeds 1..200 × each outcome → `check` empty; every `facts` id exists in its playlist file; `annotate` + `annotate.confluence` with `upTo = sweep.bar - 1` show no confirm/cont overlays; v1 S01–S14 tests unchanged and passing.
- [ ] Step 2: Run → FAIL. Implement scenario by scenario. Run → PASS. Commit `feat: full-system scenarios S15-S22`.

### Task 5: learn.html Level-1 additions (model: Sonnet)

**Files:** Modify `learn.html`, `assets/js/pages/learn.js`, `assets/css/pages/learn.css`, `tests/learn.test.js`.

Add, with playlist chips: in ch. 2 a short candle-anatomy aside (OHLC, wick = travelled price, 4h = four 1h, set chart to NY time; P14.17–P14.28, P14.13); in ch. 7 previous-day high/low (P12.15–P12.18), data highs/lows with Forex Factory red folder (P12.32–P12.37, F7.3), and the C2 `.older-note` (London 11:30, P5.5); in ch. 8 relative equal highs/lows = four sets of orders (P12.27–P12.30) and stacked levels as entry and exit (P12.23–P12.25). Replace the closing "ที่คลิปนี้ไม่ได้สอน" block with: the F9.1 list + "ต่อใน Level 2" links to `confluences.html` and `playbook.html`. Mark the page `Level 1 · Liquidity` (`.level-tag`). Keep the 8 self-checks; add no new store keys.

- [ ] Step 1: Test (content): `learn.html` contains a `ts-chip--pl` to `AGmAVyAuBE0` and one to `8qwEmE1DwYw`; the C2 note text mentions 11:30 inside `.older-note`; links to both Level 2 pages exist. Run → FAIL. Edit. Run → PASS. Commit `feat: learn level-1 additions from the playlist`.

### Task 6: confluences.html (model: Sonnet)

**Files:** Create `confluences.html`, `assets/css/pages/confluences.css`, `assets/js/pages/confluences.js`, `tests/confluences.test.js`.

Same lesson layout, rail and chart-slot pattern as `learn.html` (copy its structure; at most 4 live charts). Page tag `Level 2 · Confluences`. Intro: his chain table (spec §1) with chips P1.19, P11.26, P8.39. Six lessons, each = paraphrased facts with chips + one interactive + 2-question self-check (`tjr.conf.m1`…`m6`):
1. Market structure & BOS — P11.3–P11.24; "Break or not?" stepper over S20 (wick vs close); the C8 `webDef` box (luxalgo URL from the #11 facts file).
2. FVG — P10.1–P10.36; click-the-gap finder on a built S15 (grade with `TJR.confluence.fvgs`, any real gap within 1 bar); stacked-gap deletion demo on S19.
3. IFVG — P8.11–P8.37; "BOS vs IFVG" race on S16 showing both entry bars and the tick difference computed from the chart (label: ตัวเลขจากกราฟจำลอง).
4. Equilibrium — P7.1–P7.32; draggable two-handle range on S17, snaps to swings, shows 0/0.5/1 and premium/discount; the rule "most recent low → most recent high"; Gann settings → `คลิปไม่ได้ระบุ` (P7.2).
5. SMT — P6.1–P6.29; twin chart of S21 + "which index leads?" question.
6. Opening gaps & BPR (advanced, rarely used) — P9.1–P9.35; text + one static `จำลอง` chart; his "rarely tradable / nearly useless" verdicts stated plainly.

- [ ] Step 1: Tests: pure helpers on `TJR.confluencesPage` (e.g. `gapAt(cs, bar)` returns the FVG whose middle is within 1 bar; `eqFromHandles(lo, hi, dir)`) with hand-built candles; content test: every lesson section has ≥ 3 playlist chips, the webDef box links the luxalgo URL, no `F`-only page claims about FVG definitions.
- [ ] Step 2: Run → FAIL. Build. Run → PASS. Shoot 1440 and 390 once to check layout (no screenshot review rounds; final review is Task 13). Commit `feat: confluences page`.

### Task 7: playbook rebuild (model: Sonnet)

**Files:** Modify `playbook.html`, `assets/js/pages/playbook.js`, `assets/css/pages/playbook.css`, `tests/playbook.test.js`.

Procedure becomes the chain (spec §1) in his order: 0 bias + map (P3.3–P3.9, P1.23–P1.30) → timing (P5.12–P5.19) → 1 sweep of a significant draw, SMT optional (F6.4, F7.2, P6.12) → 2 confirmation BOS or IFVG (P1.37, P11.25, P8.14) → 3 continuation FVG or EQ, wait for respect (P1.39, P1.42–P1.43) → 4 entry: 5m close or 1m flip (P1.44–P1.47) → 5 exits at draws TP1–TP3 (P1.51, P12.23–P12.25) → risk link (P2.21, P2.26 → `risk.html`). Each step shows its Level-1 equivalent where one exists (e.g. step 2: "Level 1: H, L, HL, HH" F6.5). C5 `.older-note` (no rigid recipe, P1.3/P1.7) under the heading; C6 note at step 0 (bias is set before the trade; entries still start with a sweep, F6.4). Step 0 carries a bias worksheet: four yes/no questions (HTF trend? draws in that direction? retrace into FVG/EQ? respected or closed through?) over a built S17 on 60m, answering with the bias and the target draw (P3.3–P3.6, P3.41). Step 5 shows the one stop-loss example (P1.50, "above the highs" of the entry leg) as an example, with the rule still `คลิปไม่ได้ระบุ`. Checklist rows follow the new steps; SL rule, TP split, max daily loss keep `คลิปไม่ได้ระบุ` + the "กฎของคุณเอง" fields. New keys `playbook.v2.checks`, `playbook.v2.rules`; v1 keys are ignored, never parsed. Session table + clock gain the NY windows (ET and Thailand) from `nyWindows`, highlighting the current window. "สิ่งที่คลิปไม่ได้บอก" = spec §7 list.

- [ ] Step 1: Tests: with `tjr.playbook.checks` set to a v1-shaped array, `load()` returns an all-unticked v2 state; `KEY_CHECKS === 'playbook.v2.checks'`; current-window helper returns `manipulation` at 09:40 ET and `null` at 11:00 ET on a winter and a summer day; content: each chain step has a chip to TEp3a-7GUds or the clip named above.
- [ ] Step 2: Run → FAIL. Build. Run → PASS. Commit `feat: playbook rebuilt around the full chain`.

## Phase B — strategy, risk, gallery, lab, home, release

### Task 8: strategy.html (model: Sonnet)

**Files:** Create `strategy.html`, `assets/css/pages/strategy.css`, `assets/js/pages/strategy.js`, `tests/strategy.test.js`.

The worked trade of clip #1 (16 Jan 2026) told as a step tracker over a twin `จำลอง` chart built from S21 with a fixed seed (banner: กราฟจำลองตามที่เขาเล่า ไม่ใช่ข้อมูลจริงของวันนั้น). Steps with chips: bias bullish + draws (P1.24–P1.30) → NQ above London high, ES not = bearish SMT (P1.31–P1.32) → patience until structure breaks (P1.33–P1.36) → no gap to invert, so BOS (P1.37) → trade the leader ES (P1.40) → EQ filled, do not enter on touch (P1.41–P1.43) → 1m flip entry (P1.44–P1.49) → stop above the highs (P1.50) and TP1–TP3 at London/Asia/hourly lows (P1.51) → "proven wrong on bias" (P1.52). A readout card shows P1.59's numbers under `ตัวเลขจากเครื่องมือบนจอ ไม่ใช่ที่เขาพูด`. His money claim P1.53 appears only as `คำอ้างของเขา ยังไม่ยืนยัน`. Close with the four-part summary (P1.19) and his "toolbox, not recipe" framing next to C5.

- [ ] Step 1: Tests: step list length 9, each step has ≥ 1 chip to `TEp3a-7GUds`; `stepState(i)` reveals bars monotonically (no step reveals fewer bars than the previous). Run → FAIL. Build. Run → PASS. Commit `feat: strategy walkthrough page`.

### Task 9: risk.html (model: Sonnet)

**Files:** Create `risk.html`, `assets/css/pages/risk.css`, `assets/js/pages/risk.js`, `tests/risk.test.js`.

Sections: three skills, psychology = following the two plans (P2.1–P2.10); skill not money, demo first, review wins and losses, measure win rate × R:R (P15.12–P15.39, P2.16); his sizing method (P2.18–P2.26) and the "1–3% sweet spot"; a contract calculator: inputs account size, risk %, typical tightest and widest stop in ticks, tick value (badge `คลิปไม่ได้ระบุ` beside tick value: the viewer enters their contract's own) → contracts so the widest stop ≤ risk %, plus the loss at the tightest stop; a halve-size toggle labelled with P2.26's two cases; funded accounts in one paragraph only (spec §6); still-unspecified list (max daily loss, trades per day, TP split). No store keys beyond `tjr.risk.inputs`.

- [ ] Step 1: Tests: `contracts({account:50000, riskPct:1, widestTicks:35, tickValue:5})` → `2` (floor of 500 / 175); riskPct outside 0.1–10 clamps; halving floors and never returns below 1 when the base is ≥ 1; content: no `TJR40`, `Alpha`, `Tradeify`, `$` income figure on the page. Run → FAIL. Build. Run → PASS. Commit `feat: risk and discipline page`.

### Task 10: Grading for new drills + lab (model: Sonnet)

**Files:** Modify `grade.js`, `tests/grade.test.js`, `lab.html`, `assets/js/pages/lab.js`, `assets/css/pages/lab.css`, `tests/lab.test.js`, scenario `lab` flags in `system.js`.

**Produces:** `TJR.grade.fvg(built, bar) -> {correct, expected}` (any real FVG middle within 1 bar), `grade.bos(built, bar, answer:boolean)`, `grade.eq(range, price) -> {correct, diffTicks}` (≤ 4 ticks of `eq`), `grade.smt(built, answer:'main'|'twin')`, `grade.window(utcSec, answer:'manipulation'|'entry'|'after'|'pre')`. Lab tabs gain five drills: Gap finder, Break or not, Draw equilibrium, Which index leads, Time-window quiz; scores in `tjr.lab.<drill>`. Replay mode now also draws from S15/S16/S22 (their `lab.replay` true), keeping the v1 1-in-4 fail rule.

- [ ] Step 1: Grade tests on fixed seeds per drill (right/wrong cases, the 4-tick edge). Run → FAIL. Implement grading, then the lab tabs. Run → PASS. Commit `feat: lab drills for the full system`.

### Task 11: Scenario gallery (model: Sonnet)

**Files:** Modify `scenarios.html`, `assets/js/pages/scenarios.js`, `assets/css/pages/scenarios.css`, `tests/scenarios.test.js`.

Filter chips `ทั้งหมด / Level 1 / Level 2`; cards for S15–S22 with playlist chips; detail view adds an `อ่าน confluence` toggle (`annotate.confluence`), and S21 opens in `TJR.chart.twin`. S05 card gains chips P12.27–P12.28; S05 and S11 keep `ไม่มีเทรด`. Title count becomes 22 (`<title>` and h1).

- [ ] Step 1: Tests: 22 cards; filter Level 2 → 8; hash `#S21` opens the twin view helper path. Run → FAIL. Build. Run → PASS. Commit `feat: gallery with full-system scenarios`.

### Task 12: Home page update (model: Sonnet)

**Files:** Modify `index.html`, `assets/js/pages/home.js`, `assets/css/pages/home.css`, `tests/home.test.js`.

Keep the hero chart. Add the system map section: Level 1 (liquidity, 8 chapters) and Level 2 (confluences, strategy, playbook, risk) as the chain diagram from spec §1 with links, and update counts (22 scenarios, lab drills). Source strip names both the clip and the playlist, with the precedence sentence (คลิปใหม่กว่าเป็นหลัก เพลย์ลิสต์เติมรายละเอียด). Respect the kit's one-section-per-screen rule.

- [ ] Step 1: Test: links to all 8 pages present; counts read `22`. Run → FAIL. Build. Run → PASS. Commit `feat: home page for the full system`.

### Task 13: Verification, content audit, final review, release (controller; final review on Opus)

- [ ] Step 1: `node tests/run.mjs` → all pass. Dead-link check over all pages (every local `href` exists).
- [ ] Step 2: Content audit script over all pages: every chip's video id/time valid (Task 1 test); grep for excluded terms (`TJR40`, `Alpha Futures`, `Tradeify`, `prop firm` price figures, `$100,000`); every `.older-note` names its clip; every C1–C9 ruling visible as specified.
- [ ] Step 3: Screenshots, once, final stage only: every page at 1440 and 390 (plus 320 for confluences and lab); read each image. Walk the new lab drills and the twin chart in Claude in Chrome at desktop and phone width (built-in pane freezes timelines).
- [ ] Step 4: One whole-branch review (Opus subagent) against spec + Global Constraints; one fix wave.
- [ ] Step 5: README (pages, sources, tests count). Commit `docs: v2 readme and verification`. Republish to the SAME Artifact URL `https://claude.ai/artifact/7TXef9ojVgxxhLCqpCF3Md` with all referenced files. Ask before any `git push`.
