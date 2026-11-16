# TJR Liquidity Teaching Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, multi-page Thai website that teaches only the system in TJR's liquidity clip, with a custom canvas chart engine, a seeded messy-chart scenario generator, a playbook/checklist and four graded exercise modes.

**Architecture:** Classic `<script>` files sharing one global namespace `window.TJR` (works from `file://`, no build). Pure logic (rng, swing rule, generator, sessions, grading, scale math) is tested in Node by loading the same files into a `vm` context. The canvas engine renders whatever the generator returns; pages are thin controllers over engine + library.

**Tech Stack:** HTML/CSS/vanilla JS, Canvas 2D, GSAP 3.12.5 + ScrollTrigger 3.12.5 (cdnjs), Google Fonts (Thai-capable), Node 24 for tests and the design skill's checkers.

**Spec:** `docs/superpowers/specs/2026-11-16-tjr-liquidity-site-design.md` · content source `docs/source/clip-facts.md`

## Global Constraints

- Content comes only from `docs/source/clip-facts.md`. Each teaching claim carries a timestamp chip `▶ MM:SS` linking `https://youtu.be/Vulini8xbB0?t=<seconds>`. Anything the clip does not say is shown as the badge `คลิปไม่ได้ระบุ`, never filled.
- Thai text; trading terms stay English (high, low, sweep, liquidity, HH, HL, LH, LL, session, stop-loss…).
- No TJR screenshots or footage; no transcript sentences copied verbatim — paraphrase.
- Scripts are classic files attaching to `window.TJR`; no ES modules, no `fetch` of local files, no bundler.
- CDN: `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js` and `.../3.12.5/ScrollTrigger.min.js` only.
- Prices: tick `0.25`; NQ-like around `30000`, ES-like around `7500` (the clip's 2026 levels).
- Time: candles carry `t` = unix seconds UTC; display in ET (`America/New_York` rules, DST) and Thailand time (UTC+7).
- Sessions (F7.7): Asia 18:00–03:00 ET, London 03:00–08:30 ET, NY pre-market 08:30, NY 09:30–17:00 ET, spread hour 17:00–18:00 ET.
- localStorage keys prefixed `tjr.`; every access wrapped in try/catch; the site works without it.
- Dark trading-terminal look; never violet/lavender; `prefers-reduced-motion` → static final frames, nothing hidden.
- Every task ends with a commit; message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push.

## Review Focus

1. **Phone widths (390, 320) and rotation** — charts must re-measure and stay readable; controls ≥ 44 px. Pinned in Task 7 (`scale.make` with w=320) and Task 14 (screenshots at 390/320).
2. **Unlucky seeds** — a seed that yields an invalid candle or breaks an anchor (a "stacked" low taken early). Pinned in Task 5: every scenario × 200 seeds through the invariant checker.
3. **localStorage blocked** (private window, sandboxed artifact) — scores/checklist must fall back to memory. Pinned in Task 1 (`store` test with a throwing storage).
4. **DST boundary days** — session clock and ET labels around 2nd Sunday of March / 1st Sunday of November. Pinned in Task 4 tests.
5. **Rapid clicks** — "สุ่มกราฟใหม่" / Play pressed repeatedly must not stack animation loops or leak listeners. Pinned in Task 7 (`chart.play` called twice keeps one loop; `destroy` removes listeners) with a fake `requestAnimationFrame`.

## File Map

```
index.html learn.html scenarios.html playbook.html lab.html
README.md  CLAUDE.md  .gitignore
assets/css/tokens.css          dealt palette + type (Task 8)
assets/css/site.css            shared components: chart frame, controls, badges, ts-chip, cards (Task 8)
assets/css/pages/{home,learn,scenarios,playbook,lab}.css
assets/js/core/ns.js           window.TJR root + TJR.util (clamp, lerp, fmtPrice, tsChip)
assets/js/core/store.js        TJR.store
assets/js/core/layout.js       TJR.layout (nav/footer injection)
assets/js/core/motion.js       TJR.motion (GSAP setup, reduced-motion)
assets/js/scenario/rng.js      TJR.rng
assets/js/scenario/swings.js   TJR.swings
assets/js/scenario/gen.js      TJR.gen
assets/js/scenario/sessions.js TJR.sessions
assets/js/scenario/library.js  TJR.scenarios (S01–S14)
assets/js/scenario/annotate.js TJR.annotate
assets/js/scenario/grade.js    TJR.grade
assets/js/chart/scale.js       TJR.chart.scale
assets/js/chart/render.js      TJR.chart.render
assets/js/chart/overlays.js    TJR.chart.overlays
assets/js/chart/chart.js       TJR.chart.create
assets/js/pages/{home,learn,scenarios,playbook,lab}.js
assets/{layout,motion,…}       design-skill kit, copied (Task 1)
dev/chart-demo.html            engine visual check page
tests/run.mjs tests/*.test.js
```

Script order on every page: `ns, store, rng, swings, gen, sessions, library, annotate, grade, scale, render, overlays, chart, layout, motion, pages/<page>`.

## Shared data shapes (every task uses these names)

```js
// candle
{ t: 1782720000, o: 30012.25, h: 30020.5, l: 30008, c: 30018.75 }
// built scenario = TJR.scenarios.get(id).build(seed, opts)
{ candles: Candle[], meta: { id, instrument: 'NQ'|'ES', tf: 1|5|15|60|240|1440, tick: 0.25, seed },
  truth: {
    side: 'long'|'short'|null, outcome: 'win'|'fail'|null,
    levels: [{ id, kind: 'liq'|'stack'|'session'|'htf'|'pdh'|'pdl', label, price, bar, sweptAt: number|null,
               resistance: 'low'|'high'|null }],
    sweep: { bar, levelId } | null,
    structure: [{ bar, price, tag: 'H'|'L'|'HH'|'HL'|'LH'|'LL' }],
    confirmBar: number|null,          // bar where the HH (long) / LL (short) prints
    entryWindow: { from, to } | null, // D2
    target: { price, levelId } | null,
    sessions: [{ name: 'asia'|'london'|'ny', from, to, high, low }],
    notes: [{ bar, fact: 'F6.5', text }]
  } }
```

---

### Task 1: Project skeleton, kit, test runner

**Files:** Create `.gitignore`, `README.md`, `CLAUDE.md`, `tests/run.mjs`, `tests/store.test.js`, `assets/js/core/ns.js`, `assets/js/core/store.js`; copy `C:/Users/cipee/.claude/skills/design-taste-frontend/assets/*` → `assets/`.

**Interfaces — Produces:** `TJR.util.{clamp(v,a,b), lerp(a,b,t), roundTick(p, tick=0.25), fmtPrice(p) -> '30,012.25', tsChip(sec) -> {label:'23:45', href}}`; `TJR.store.{get(key, fallback), set(key, value), remove(key)}` (JSON, prefix `tjr.`, in-memory fallback). Test runner: `node tests/run.mjs` loads `SCRIPTS` (the order above, files that exist) into one `vm` context whose `window` is the context itself, then every `tests/*.test.js`; globals `test(name, fn)`, `eq(a,b,msg)`, `ok(v,msg)`, `near(a,b,eps,msg)`; prints `N passed, M failed`, exit 1 on failure.

- [ ] Step 1: `git init`; `.gitignore` = `.taste-skill/`, `shots/`, `node_modules/`, `.env`, `*.log`. Copy the kit. Run `npx skills add https://github.com/bergside/typeui --skill typeui-fundamentals` from the project root; if blocked or failing, record that in README "Notes" and continue.
- [ ] Step 2: Write `tests/store.test.js`: `set('x',{a:1})` then `get('x')` deep-equals `{a:1}`; with `window.localStorage` replaced by an object whose methods throw, `set`/`get` still round-trip in memory and never throw; `util.roundTick(30012.13)` → `30012.25`; `util.tsChip(1425).label` → `'23:45'`, href ends `?t=1425`.
- [ ] Step 3: Run `node tests/run.mjs` → FAIL (missing TJR). Implement `ns.js`, `store.js`, `run.mjs`. Run → PASS.
- [ ] Step 4: `CLAUDE.md` (stack, run: open `index.html`; test: `node tests/run.mjs`; content rule: clip-facts only), README skeleton (run, folder map, deploy = claude.ai artifact). Commit `chore: project skeleton, kit and test runner`.

### Task 2: Seeded RNG and the two-candle swing rule

**Files:** Create `assets/js/scenario/rng.js`, `assets/js/scenario/swings.js`, `tests/swings.test.js`.

**Interfaces — Produces:** `TJR.rng.make(seed:number) -> { next():[0,1), range(a,b), int(a,b) /*inclusive*/, pick(arr), chance(p), gauss() }` (mulberry32). `TJR.swings.find(candles) -> { highs:[{i, price, pair:[k,k+1]}], lows:[…] }`; `TJR.swings.isHigh(candles,i)`, `isLow(candles,i)`; `TJR.swings.label(points:[{i,price,type:'high'|'low'}]) -> [{…, tag}]` (high vs previous high → `HH`/`LH`, first → `H`; lows → `HL`/`LL`, first → `L`).

Rule (F2.1/F2.2): a high exists at pair (k,k+1) when candle k is bullish (`c>o`) and k+1 bearish (`c<o`); its price is `max(h_k, h_k+1)` and `i` the candle holding that wick. Low: k bearish, k+1 bullish, `min(l)`. A doji (`c===o`) is neither (my call, not in the clip).

- [ ] Step 1: Tests: same seed → identical first 10 `next()`; hand-built 4-candle series `[bull, bear, bear, bull]` → one high at the larger of candles 0/1 highs and one low at the smaller of candles 2/3 lows; a doji pair yields nothing; `label` on highs `100, 105, 103` → `H, HH, LH`.
- [ ] Step 2: Run → FAIL. Implement. Run → PASS. Commit `feat: seeded rng and TJR two-candle swing rule`.

### Task 3: Generator core and timeframe rollup

**Files:** Create `assets/js/scenario/gen.js`, `tests/gen.test.js`.

**Interfaces — Consumes:** `TJR.rng`, `TJR.swings`, `TJR.util.roundTick`. **Produces:**
- `TJR.gen.path(rng, waypoints, opts) -> Candle[]` (no `t`). `waypoints: [{bar, price, kind?: 'high'|'low'|'pass'}]` sorted by bar, first at bar 0; `opts: {vol /*avg body in points*/, wick /*avg wick in points*/, chop /*0..1*/, tick}`. Between waypoints: Brownian bridge so the close path hits each waypoint; per-bar open = previous close. `kind:'high'` forces candle[bar] bullish and candle[bar+1] bearish with `max(h)` = `price` exactly (a two-candle high per Task 2); `'low'` mirrors.
- `TJR.gen.guard(candles, rules) -> Candle[]` where `rules: [{from, to, maxHigh?, minLow?}]` clips wicks/bodies inside `[from,to]` so they stay strictly below `maxHigh` / above `minLow` (used to keep stacked levels untaken until the sweep).
- `TJR.gen.stamp(candles, startUtcSec, tfMin) -> Candle[]` adds `t`.
- `TJR.gen.rollup(candles, tfMin, targetTfMin) -> Candle[]`, buckets aligned to ET 18:00 day start (futures day), o=first.o, h=max, l=min, c=last.c, t=bucket start.
- `TJR.gen.validate(candles, tick) -> string[]` (empty = valid): `l ≤ min(o,c)`, `h ≥ max(o,c)`, prices on tick, `o[i] === c[i-1]`.

- [ ] Step 1: Tests: `path` with waypoints `[{bar:0,price:30000},{bar:20,price:30050,kind:'high'},{bar:40,price:29980,kind:'low'}]` for seeds 1..50 → `validate` empty, `swings.isHigh` true at the high pair with price `30050`, low likewise; `guard` with `maxHigh:30049` over 21..39 → no high ≥ 30049 there; `rollup` of 12 × 5m → one 60m candle with correct o/h/l/c; deterministic for equal seeds.
- [ ] Step 2: Run → FAIL. Implement. Run → PASS. Commit `feat: scenario generator core and rollup`.

### Task 4: Sessions and time

**Files:** Create `assets/js/scenario/sessions.js`, `tests/sessions.test.js`.

**Interfaces — Produces:** `TJR.sessions.etOffsetHours(utcSec) -> -4|-5` (DST from 2nd Sunday March 02:00 to 1st Sunday November 02:00 local); `toET(utcSec) -> {y,mo,d,h,mi,dow}`; `fmtET(utcSec) -> '09:30'`; `fmtThai(utcSec) -> '20:30'`; `which(utcSec) -> 'asia'|'london'|'ny-pre'|'ny'|'spread'|'weekend'` (weekend = Fri 17:00 → Sun 18:00 ET; market hours, not a system rule); `etToUtc(y,mo,d,h,mi) -> utcSec`; `nextNyOpen(utcSec) -> utcSec`; `WINDOWS` constant with the Global Constraints times.

- [ ] Step 1: Tests: 2026-07-01 13:30Z → `fmtET` `09:30`, `fmtThai` `20:30`, `which` `ny`; 2026-01-15 14:30Z → `09:30` ET; 2026-03-08 06:59Z vs 07:00Z cross the DST switch (offset -5 → -4); 2026-11-01 05:59Z vs 06:00Z (-4 → -5); 22:30Z on a summer Tuesday → `asia`; 21:30Z summer → `spread`; Saturday → `weekend`; `which` at 08:30 ET → `ny-pre`, 03:00 ET → `london`.
- [ ] Step 2: Run → FAIL. Implement. Run → PASS. Commit `feat: ET/Thailand session clock`.

### Task 5: Scenario library S01–S14 and annotate

**Files:** Create `assets/js/scenario/library.js`, `assets/js/scenario/annotate.js`, `tests/library.test.js`.

**Interfaces — Consumes:** Tasks 2–4. **Produces:**
- `TJR.scenarios.list -> [{ id:'S01', title /*Thai*/, summary, facts:['F6.5'], clip:[1410], tf, instrument, lab: {replay:boolean, spot:boolean, sessions:boolean, quiz:boolean}, build(seed, {outcome?:'win'|'fail'}) -> Built }]`, `get(id)`, `random(rng, mode:'replay'|'spot'|'sessions'|'quiz') -> {def, built}`.
- `TJR.scenarios.check(built) -> string[]` — the invariant checker (empty = ok): `gen.validate` empty; each `levels[k]` with `sweptAt` → no candle between `bar+1` and `sweptAt-1` trades through `price`, and candle `sweptAt` does; each `structure` point is a two-candle swing (`swings.isHigh/isLow`) at its price; long: `HL > swept level price`, `HH > the H before it`; short mirror; `confirmBar` = bar of the HH/LL; `entryWindow.from > confirmBar`; `outcome:'win'` → price reaches `target.price` after `entryWindow.from`; `outcome:'fail'` → it does not and trades back through the sweep extreme; session boxes equal the actual max/min of candles in their windows.
- `TJR.annotate(built, {upTo?:bar}) -> Overlay[]` (overlay shapes in Task 7; truth kinds `pdh`/`pdl` map to overlay kind `'htf'`, `target` to `'target'`) — levels (swept ones get `state:'swept'`), session boxes, structure labels, sweep marker, entry zone, target level; each overlay `appearAt` = the bar where it becomes knowable (no look-ahead).

Scenario table (spec 7.3) — each `build` scripts waypoints/guards and fills truth. Messiness: `chop ≥ 0.35`, at least one near-equal (not equal) neighbour swing and one false poke per chart that does not break a guard. S06–S09 use real ET days: 5m (S09 1m), Asia 18:00 → NY 12:00. S10/S11: 5m base over 3 sessions, with `htf` levels from the 4H rollup. Replay `outcome:'fail'` variants exist for S01, S03, S09, S10 (D4).

- [ ] Step 1: Tests: for every scenario and seeds 1..200 (and both outcomes where supported) `check(built)` is empty; `annotate(built,{upTo:built.truth.sweep.bar-1})` contains no `swept` level and no entry zone; ids S01–S14 present, each `facts` id exists in `clip-facts.md` (test reads the file with `fs`).
- [ ] Step 2: Run → FAIL. Implement scenario by scenario until PASS. Commit `feat: scenario library S01-S14 with invariants`.

### Task 6: Grading

**Files:** Create `assets/js/scenario/grade.js`, `tests/grade.test.js`.

**Interfaces — Produces:**
- `TJR.grade.replay(truth, bar, choice:'long'|'short'|'wait') -> {correct, code}`; codes: `'blind-sweep'` (enter at/before `sweep.bar` — F6.3), `'early'` (enter before `confirmBar`), `'in-window'`, `'late'`, `'wrong-side'`, `'wait-ok'`, `'missed'` (wait inside the window). Correctness ignores `outcome` (D4).
- `TJR.grade.spot(built, task, bar, price) -> {correct, expected:{bar, price}}`; tasks `'any-high'`, `'any-low'` (accept any rule swing within 1 bar), `'sweep'` (= `truth.sweep.bar` ± 1), `'entry-pivot'` (the HL/LH after confirm ± 1 bar).
- `TJR.grade.sessions(truth, lines:{asiaHigh,asiaLow,londonHigh,londonLow}) -> {items:{asiaHigh:{diff, ok}, …}, score:0..4}`; ok when `|diff| ≤ 4 ticks`.
- `TJR.grade.quiz(level, answer:'low'|'high'|'htf'|'session') -> boolean`.

- [ ] Step 1: Tests on a fixed built S01 (seed 7): long at `sweep.bar` → `blind-sweep`; long at `confirmBar-1` → `early`; long at `entryWindow.from` → `in-window` correct; short in window → `wrong-side`; same with an `outcome:'fail'` build → still correct; spot `'sweep'` at sweep.bar+1 correct, +3 wrong; sessions diff of 5 ticks → not ok.
- [ ] Step 2: Run → FAIL. Implement. Run → PASS. Commit `feat: exercise grading`.

### Task 7: Canvas chart engine

**Files:** Create `assets/js/chart/scale.js`, `render.js`, `overlays.js`, `chart.js`, `dev/chart-demo.html`, `tests/chart.test.js`.

**Interfaces — Produces:**
- `TJR.chart.scale.make({w, h, padL, padR, padT, padB, from, to, min, max}) -> {x(i), y(p), bar(x), price(y), barW}`; `TJR.chart.scale.ticks(min, max, approxCount) -> number[]` (nice steps 0.25/0.5/1/2.5/5/10/25/50/100…).
- Overlay objects: `{id?, type:'level', price, from?, to?, label, kind:'liq'|'stack'|'session'|'htf'|'target', state:'active'|'swept', appearAt?}`, `{type:'box', from, to, low, high, label, kind:'asia'|'london'|'ny'}`, `{type:'label', bar, price, text, pos:'above'|'below'}`, `{type:'marker', bar, price, shape:'up'|'down'|'dot'|'x'}`, `{type:'zone', from, to, low, high, kind:'entry'}`, `{type:'trend', a:{bar,price}, b:{bar,price}}`.
- `TJR.chart.create(el:HTMLElement, opts:{theme?, interactive?:true, crosshair?:true, axes?:true}) -> Chart` with `setData(built|{candles, meta})`, `setTimeframe(tf)` (rollup, overlays mapped by time), `view(from,to)`, `fit()`, `reveal(n)`, `play({from, to, barsPerSec=6, onBar(i)}) -> Promise`, `pause()`, `step(+1|-1)`, `setOverlays(Overlay[])`, `addOverlay(o)->id`, `removeOverlay(id)`, `flash(id)`, `addLine({id, price, label, draggable:true})`, `getLine(id)->price`, `on('click'|'hover'|'drag', fn)`, `resize()`, `destroy()`.
- Theme from CSS custom properties on `el` (`--c-bull`, `--c-bear`, `--c-grid`, `--c-axis`, `--c-liq`, `--c-session`, `--c-htf`, `--c-entry`, `--c-target`, `--c-text`), read once per `setData`/`resize`.
- Rendering: DPR-aware; ResizeObserver → `resize()`; one rAF loop per chart, started only while playing/animating, paused when off-screen (IntersectionObserver); overlay appear = draw-in 400 ms; `flash` = glow pulse + "SWEPT" tag 900 ms; reduced motion → no tweens, final state.

- [ ] Step 1: Tests (Node, fake canvas/rAF): `scale.make` round-trips `bar(x(i)) === i` and `price(y(p))≈p` at w=1200 and w=320; `ticks(29950,30060,6)` returns ascending nice values within range; with a stubbed `requestAnimationFrame`, calling `play()` twice leaves one scheduled loop; `destroy()` removes all listeners added (count via stubbed `addEventListener`/`removeEventListener`).
- [ ] Step 2: Run → FAIL. Implement. Run → PASS.
- [ ] Step 3: `dev/chart-demo.html` renders S01, S06 (with sessions) and S10 (TF switch) with annotate overlays and Play/Step/TF buttons. Screenshot it at 1440 and 390 with `node C:/Users/cipee/.claude/skills/design-taste-frontend/scripts/shoot.mjs --url dev/chart-demo.html --w 1440 --out shots/demo-1440.png` (and `--w 390`); read both images: candles drawn, labels legible, nothing clipped. Commit `feat: canvas chart engine`.

### Task 8: Design system and shared layout

**Files:** Create `assets/css/tokens.css`, `assets/css/site.css`, `assets/js/core/layout.js`, `assets/js/core/motion.js`.

Follow design-taste-frontend sections 1, 4.4 and `references/system.md`, `motion.md`: kind **software** (`data-type="software"`, `site-kind` `software`), radius `sharp`, run `start.mjs deal --page software --trade "trading education fintech"` and `start.mjs css` with the first palette/pairing that has a Thai-capable text face (else the next, said in the commit body); dark ground; never violet. Map the dealt tokens to the chart variables of Task 7 (bull green, bear red, liquidity amber/cyan family).

**Interfaces — Produces:** `TJR.layout.mount({page:'home'|'learn'|'scenarios'|'playbook'|'lab'})` injects the kit's dealt nav (links: หน้าแรก, บทเรียน, สถานการณ์, Playbook, แบบฝึก) and footer (source line: TJR clip link + "เนื้อหาจากคลิปนี้เท่านั้น"); `TJR.motion.init()` registers ScrollTrigger, wires the kit's `motion.js` hover layer, exposes `TJR.motion.reduced:boolean`. Site components in `site.css`: `.chart-frame` (terminal chrome: symbol, TF, OHLC readout row), `.ctrl` buttons, `.badge-gap` (`คลิปไม่ได้ระบุ`), `.ts-chip`, `.fact-card`, `.check-row`, `.score-pill`.

- [ ] Step 1: Deal, write tokens/site CSS, layout, motion. Verify on `dev/chart-demo.html` (now with nav/footer) via shoot at 1440/390. Commit `feat: design system and shared layout`.

### Task 9: Home page — then PAUSE for the user's review

**Files:** Create `index.html`, `assets/css/pages/home.css`, `assets/js/pages/home.js`.

Run design-taste-frontend's step 1–6 for this page: arm `gate.mjs --start index.html --kind software --category "TJR liquidity system course" --primary "เริ่มบทเรียน"`; read `copy.md`, `copy-voice.md`, `system.md`, `layout-v4.md`, `sections.md`; deal the hero (`deal.mjs --type software --has ui`) and 1–2 moments; build from `assets/starter.html`. Content (spec 7.1): hero = live chart (`TJR.chart` + random S01/S03/S12 build, loops a new seed each cycle, annotate overlays revealed with playback) with h1 "Liquidity อยู่เหนือ High และใต้ Low" and the main action เริ่มบทเรียน → `learn.html`; pinned 3-step walkthrough (sweep → confirmation → entry) driven by ScrollTrigger on one chart; course map (8 modules → anchors in `learn.html`); doors to scenarios / playbook / lab; the "สิ่งที่คลิปนี้ไม่ได้สอน" strip (F9).

- [ ] Step 1: Build. Run copy-lint, consistency, check.mjs, shoot (1440, 1024, 820x1180, 768x1024, 390), perf, then `gate.mjs index.html` until `GATE: PASS|OPEN` (≤ 3 rounds); app-page waivers go in `.taste-skill/waivers.json` with reasons.
- [ ] Step 2: Verify the hero and pinned walkthrough animate: Claude in Chrome at desktop and 390 wide; if not connected, a headless-Chrome frame sampler (frames at 350/800/1300/1900/3200 ms + scroll stops) and say so.
- [ ] Step 3: Commit `feat: home page`. **STOP — show the user screenshots and wait for their review before Task 10.**

### Tasks 10–13: The other pages (independent; may run in parallel, one agent each, no shared-file edits — a needed shared change goes back to the controller)

Each page: `<page>.html` from the home page's head/nav pattern, its own `assets/css/pages/<page>.css` and `assets/js/pages/<page>.js`; Thai copy paraphrasing the cited facts with `ts-chip`s; charts only through `TJR.chart` + `TJR.scenarios` + `TJR.annotate`; gaps as `.badge-gap`. Verify each with shoot at 1440 and 390 and read the screenshots; commit per page.

**Task 10 — `learn.html`** (spec 7.2): 8 modules with sticky module rail; module 2 hover-pair demo using `TJR.swings.find`; module 3 order-stack animation over a chart (two buy groups above highs / two sell groups below lows, F3.3/F3.4); module 5 stylised re-creations labelled `จำลอง` (F5.1–F5.4); module 6 drawdown demo (S04) and long/short confirmation (S01/S03); module 7 sessions table ET ⇄ Thai (`TJR.sessions`) and S06–S10; module 8 S12–S14; each module ends with a 2-question self-check (answers stored via `TJR.store`); closing F9 block. Commit `feat: course page`.

**Task 11 — `scenarios.html`** (spec 7.3): card grid of S01–S14 (title, TF, facts, clip chips); detail view with chart, Play/Step/Reset, `อ่านกราฟ` toggle (annotate on/off), `สุ่มกราฟใหม่` (new seed), TF switch where the scenario has HTF levels, fact notes. URL hash `#S06` opens a scenario. Commit `feat: scenario gallery`.

**Task 12 — `playbook.html`** (spec 7.4): the 7-step procedure with fact chips; interactive checklist (tick, reset; steps for SL/size/risk show `คลิปไม่ได้ระบุ` + editable "กฎของคุณเอง" fields) persisted with `TJR.store`; live session clock (ET, Thailand, current session, countdown to NY open via `TJR.sessions`), updating every second, paused when hidden. Commit `feat: playbook and checklist`.

**Task 13 — `lab.html`** (spec 7.5, D1–D4): mode tabs Replay / Spot / Sessions / Quiz; each round = `TJR.scenarios.random(rng, mode)` with a fresh seed; Replay: Next/Auto, choices Long/Short/รอ at every bar after the sweep, graded by `TJR.grade.replay`, then shows the annotated truth and the outcome separately with the D4 badge on fails; Spot: prompt + click on chart → `TJR.grade.spot` + overlay feedback; Sessions: four draggable lines → `TJR.grade.sessions`; Quiz: a highlighted level + 4 answers → `TJR.grade.quiz`; per-mode score/streak in `TJR.store` (`tjr.lab.<mode>`). Commit `feat: exercise lab`.

### Task 14: Verification, README, publish

- [ ] Step 1: `node tests/run.mjs` → all pass. Shoot every page at 1440, 768x1024, 390, and 320 (`--w 320`); read every image (Review Focus 1). Walk every lab mode and the scenario controls by hand in Claude in Chrome (or the headless sampler) at desktop and phone width, including rapid "สุ่มกราฟใหม่"/Play clicks (Review Focus 5) and a private window (Review Focus 3).
- [ ] Step 2: Content audit: every `ts-chip` maps to a fact id in `clip-facts.md`; grep the pages for claims without a chip; no SL/size/risk advice anywhere.
- [ ] Step 3: README final (run, folder map, test, deploy). Commit `docs: readme and verification`.
- [ ] Step 4: Publish as a private claude.ai Artifact (Artifact tool, `index.html` + every referenced file via `files`, kit files only those referenced); give the user the link. Ask before any `git push`.
