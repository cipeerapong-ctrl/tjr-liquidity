# TJR Liquidity — teaching site: design

Date: 2026-11-16 · Status: draft for the user's approval

## 1. Intent and the why

The user is an experienced trader. He watched TJR's clip "The ONLY Liquidity Guide You'll Ever Need"
(49:07, https://youtu.be/Vulini8xbB0) and wants to learn its system properly and be able to use it on
real charts. He wants a website that teaches **only what the clip teaches**, with many example charts
for every situation in the clip, the entry method, a checklist, guidance, and exercises. Real charts
are messy ("ยึกๆยือๆ", sometimes unreadable), unlike TJR's clean drawings, so the examples must look
like real markets. He wants it visually spectacular ("เวอร์ๆ สวยๆ อลัง"), but the content must be
learnable and usable for trading.

Source of truth: `docs/source/clip-facts.md` (fact ids F1.1 … F9.2, each with a clip timestamp).
`docs/source/transcript-de.txt` is the backing transcript (German auto-translation; English was rate-limited).

## 2. Goals

- G1 Teach every concept of the clip in order, each claim tagged with its clip timestamp (a small
  `▶ 23:45` chip that opens `https://youtu.be/Vulini8xbB0?t=<seconds>`).
- G2 Show each clip situation on realistic, noisy candlestick charts — several random variants per
  situation so the learner sees the same idea in messy form.
- G3 Give a step-by-step entry procedure and an interactive checklist built strictly from the clip.
- G4 Exercises: bar-by-bar replay, click-on-chart spotting, session high/low marking, liquidity
  classification quiz — graded against the clip's own definitions.
- G5 Spectacular dark trading-terminal look with heavy motion, fast on desktop and phone.
- G6 Runs by opening `index.html` from the folder (no server) and publishes as a private claude.ai link.

## 3. Non-goals

- No BOS, FVG, IFVG or any other confluence from TJR's other videos (only named as "not in this clip", F9.1).
- No stop-loss, position sizing, risk %, win rate or backtest content (F9.2).
- No live market data, accounts, backend or database.
- No screenshots or footage from TJR's video; no transcript reproduced verbatim (short paraphrase only).

## 4. Anti-goals (failure even if it "works")

- Any rule, threshold or tip the clip does not state presented as part of the system.
- Charts so clean they look like textbook drawings — the learner must practise on mess.
- Exercises graded by a rule that is not in the clip (e.g. grading a stop placement).
- A page that looks impressive but hides the content behind motion, or is slow on a phone.

## 5. Constraints

- Language: Thai text, trading terms kept in English (high, low, sweep, liquidity, HH/HL/LH/LL, session…).
- Stack: plain HTML/CSS/JS, multi-page, no build step. GSAP 3 + ScrollTrigger by CDN (exact versions).
  Fonts from Google Fonts with Thai support. ES modules allowed only if they work from `file://` —
  they do not, so scripts are classic `<script>` files sharing one global namespace (`window.TJR`).
- Gaps in the clip are shown, never filled: a visible "คลิปไม่ได้ระบุ" badge (user's choice). The
  checklist leaves those rows as user-editable fields ("กฎของคุณเอง") saved in localStorage.
- User's standing web rules: organised folders, shared partials reused, README, `git init` and a
  commit per finished step, ask before pushing; build structure + design system → home page → pause
  for the user's review → other pages. Verify animations at desktop and mobile widths.
- Persistence: localStorage only, every access wrapped in try/catch; the site works without it.

## 6. Approaches considered

| | Approach | Trade-off | Verdict |
|---|---|---|---|
| A | Static HTML + own Canvas chart engine | Full control of candles, glow/sweep animation, replay and click-grading; more engine code | **Picked by the user** |
| B | Static HTML + TradingView Lightweight Charts | Exact TradingView look; overlays, cinematic animation and click exercises fight the library | Rejected |
| C | React + Vite | Needs a build, harder to open from a folder and publish; no benefit here | Rejected |

## 7. Information architecture

```
index.html            Home: hero live chart, the one rule, course map, start
learn.html            The course: 8 modules on one long page with a sticky module rail
scenarios.html        Scenario gallery: each clip situation on messy charts, step-through + reshuffle
playbook.html         Entry procedure + interactive pre-trade checklist + session clock
lab.html              Exercises: Replay · Spot · Sessions · Liquidity quiz (tabs/modes)
assets/css/           tokens + base + components + page CSS
assets/js/core/       namespace, storage, nav, motion setup
assets/js/chart/      the chart engine (render, overlays, animation, interaction)
assets/js/scenario/   generator + scenario library + swing detection + grading truth
assets/js/pages/      one controller per page
tests/                Node test runner + tests over the same classic scripts (section 12)
docs/                 source facts, this design, the plan
```

### 7.1 Home (`index.html`)
Hero: full-width live canvas — an NQ-like 5m chart plays in real time: stacked highs glow as
"liquidity", price spikes through them, the line flashes "SWEPT", structure labels H/L/LL/LH draw in,
an entry marker appears, price falls. Loops with a new seed each cycle. Headline states the clip's one
rule: "Liquidity อยู่เหนือ High และใต้ Low" with a sub line that this site teaches only TJR's clip.
Then: the 3-step core (sweep → confirmation → entry), course map cards for the 8 modules, entry to
scenarios / playbook / lab, and the honest "what this clip does not cover" strip (F9).

### 7.2 Course (`learn.html`) — modules, each mapped to facts
1. Liquidity คืออะไร — F1 (orders, cookies, sweep, retail vs smart money, simplicity).
2. ระบุ High / Low แบบ TJR — F2 (two-candle rule, highest/lowest wick). Interactive: hover any pair of
   candles; the engine highlights pairs that form a high/low by the rule.
3. ทำไม liquidity อยู่เหนือ High / ใต้ Low — F3 (two buy groups above highs, two sell groups below
   lows) with an animated order-stack diagram on a chart.
4. ฝั่ง Smart Money — F4 (counterparty, opportunity not certainty, every timeframe).
5. ตัวอย่างทุก timeframe — F5 (monthly tariff drop, 2020, daily equal highs, 15m/5m) as described
   cases with stylised re-creations clearly labelled as simulations, plus F5.5/F5.7.
6. Confirmation และจุดเข้า — F6 (don't buy blind / drawdown demo, bullish L→H→HL→HH entry,
   bearish H→L→LL→LH entry, his homework).
7. Significant liquidity targets — F7 (HTF 1H/4H highs/lows with 5m/1m entries; sessions with an
   ET ⇄ Thailand time table that handles US daylight saving; London takes Asia, NY takes London;
   NY-open only for US indices; the three day examples; news highs/lows as "advanced").
8. Low- vs High-resistance liquidity — F8 (stacked highs/lows = trendline liquidity, targets, the
   recent sweep as high-resistance, trade toward low-resistance).
Closing block: "ที่คลิปนี้ไม่ได้สอน" — F9.

Each module: short Thai explanation (paraphrase), timestamp chips, at least one engine chart, a
"ข้อควรจำ" line quoting the clip's own caution where one exists (F4.6, F5.5, F6.3, F7.14), and a
2-question self-check at the end.

### 7.3 Scenarios (`scenarios.html`)
A grid/list of scenario cards; opening one shows a large chart with: Play/Step controls (bar by bar),
"อ่านกราฟ" toggle (annotations: liquidity lines, sweep flash, structure labels, entry zone, target),
"สุ่มกราฟใหม่" (new seed, same scenario) and the clip timestamp(s). Library (each from the clip):

| id | Scenario | Facts |
|---|---|---|
| S01 | Bullish: stacked lows swept → H,L,HL,HH → entry on the pullback after the HH (see D2) → up | F6.5 |
| S02 | Bullish deep sweep: long run down through many lows, then HH/HL → entry | F6.6, F5.4 |
| S03 | Bearish: high swept → H,L,LL,LH → entry at LH → down | F6.8, F6.9 |
| S04 | Sweep with no reversal: buying the sweep = drawdown; no confirmation, no trade | F6.3, F5.5 |
| S05 | Equal highs run (fake-out) then dump, then lows run then up (daily) | F5.3 |
| S06 | Session day A: Asia range; London takes Asia low then up; NY takes London low, then takes Asia high / previous-day high | F7.10, F7.12 |
| S07 | Session day B: NY pre-market takes London low → trends up all day | F7.13 |
| S08 | Monday: NY open spikes above London high, then below London low, then up | F7.15 |
| S09 | LTF entry after London low sweep: L,H,HL,HH,HL → entry (1m view) | F7.14 |
| S10 | 4H highs swept, seen on 5m: turn → big HTF-sized move down | F7.6 |
| S11 | 5m-only high broken, short-lived reaction (why HTF levels matter) | F7.5 |
| S12 | Stacked highs (low-resistance) as price target after a sweep below | F8.4, F8.5 |
| S13 | Trendline liquidity: rising lows not taken → price runs them → up | F8.3 |
| S14 | Low-resistance becomes high-resistance after a clean reversal; trade toward the stacked side | F8.6–F8.8 |

"Messy" means: noise on every leg, uneven wicks, inside bars, chop around levels, swing points that are
near-equal rather than equal, occasional false pokes. The noise never changes the scenario's truth.

### 7.4 Playbook (`playbook.html`)
- The procedure, strictly clip-derived: (1) before NY open mark Asia/London highs and lows, previous
  day high/low, 1H/4H highs/lows; note stacked (low-resistance) highs/lows (F7.8, F7.12, F7.4, F8);
  (2) trade a US index only at the NY open (F7.11); (3) wait for price to sweep a marked level —
  it is only an opportunity (F4.6); (4) on 5m/1m wait for the new trend: L,H,HL,HH (long) or
  H,L,LL,LH (short) (F6.5, F6.8, F7.14); (5) entry on the pullback once that structure has printed — TJR's "average
  entry"; the exact trigger is not in this clip (D2, F6.7); (6) target:
  low-resistance liquidity / opposite session levels (F8.4, F7.12); trade away from high-resistance
  (F8.7); (7) stop-loss, size, risk: "คลิปไม่ได้ระบุ" + the user's own fields.
- Interactive checklist (tick per trade, reset, the user's own rule fields saved locally).
- Session clock: now in ET and Thailand time, which session is live, countdown to NY open (handles DST).

### 7.5 Lab (`lab.html`)
Four modes, all on fresh random charts generated from the scenario library with known truth:
1. **Replay** — bar by bar (Next / Auto); at decision points the learner chooses Long / Short / รอ.
   Correct per the clip: no trade on the sweep bar itself (F6.3); enter only after the structure
   confirms (F6.5/F6.8). Feedback shows the annotated truth.
2. **Spot** — "click the swing high (two-candle rule)", "click the sweep candle", "click the higher
   low that gives the entry". Hit-test with tolerance; feedback overlay.
3. **Sessions** — a 5m/1m day with ET time axis; the learner drags four horizontal lines to Asia
   high/low and London high/low (London ends 8:30 ET per F7.7); graded by tick distance.
4. **Liquidity quiz** — highlighted levels; answer low-resistance / high-resistance / significant
   target type (HTF, session).
Score and streak per mode saved in localStorage.

## 8. The chart engine (`assets/js/chart/`)

- Canvas 2D, devicePixelRatio aware, resizes with its container, dark theme tokens.
- Model: `candles[] {t, o, h, l, c}` with time in ET minutes; viewport (first/last index, price range
  with padding); price axis and time axis labels (HH:MM ET or dates by timeframe).
- Overlays: horizontal level (label, style: liquidity/session/HTF, state: active/swept), box (session
  range), marker (arrow, dot), structure label (H, L, HH, HL, LH, LL), zone (entry), text callout,
  trendline. Each overlay has an appear animation (draw-in) and a "swept" flash.
- Playback: reveal candles one by one at a speed; step; jump to bar; events at scripted bars
  (sweep, confirm, entry) fire overlay animations.
- Interaction: crosshair with OHLC readout; click → nearest candle/price; drag horizontal lines
  (Sessions mode); hover candle-pairs (module 2).
- Performance: one requestAnimationFrame loop per visible chart, paused when off-screen
  (IntersectionObserver) and under `prefers-reduced-motion` (static final frame).

## 9. Scenario generator (`assets/js/scenario/`)

- Seeded RNG (mulberry32) — same seed, same chart; "สุ่มกราฟใหม่" = new seed.
- A scenario is a script of **legs** (direction, bar count, target price or relative size) plus
  **anchors** (named swing points: e.g. `stackLow1..3`, `sweepBar`, `hl`, `hh`, `entry`, `target`),
  and optional **sessions** (ET windows). The generator builds a path through the anchors, then adds
  noise (wick jitter, chop, inside bars) while clamping so anchors stay true (a swept level really is
  exceeded by the sweep bar's wick, stacked lows stay un-taken until the sweep, HL stays above L…).
- Output: candles + truth `{levels[], sweeps[], structure[], entry, target, sessions[]}`.
- `swings.js` implements the clip's two-candle rule (F2.1/F2.2) for detection and grading.
- Instrument flavour: NQ-like and ES-like price ranges and tick sizes (0.25), timeframes 1m/5m/15m/1H/4H/D.

## 10. Visual design and motion

- Look: dark trading terminal — graphite/near-black grounds, bull green / bear red candles with soft
  glow, liquidity levels in a bright accent (amber/cyan family, never violet), mono numerals, thin
  grid, subtle scanline/grain only in the hero. Thai-capable font pairing (e.g. a Thai sans for text
  + a mono for numbers) dealt through the design skill.
- Motion (heavy, as asked): hero live chart; module headings with line reveals; level lines that draw
  in and "explode" on sweep; GSAP ScrollTrigger pinned walkthrough for the core 3-step (sweep →
  confirm → entry) on the home page; hover micro-interactions everywhere; reduced-motion fallback.
- Lead design skill: design-taste-frontend (the user's standing default), page kind "software"
  (an interactive fintech learning tool). Its company-site rules (one section per screen, hero alone,
  dealt moments, gate) apply to the home page; course, scenario, playbook and lab pages are app
  screens with long content — gate findings that only reflect that difference are waived with a reason.

## 11. Shared pieces

Nav and footer are written once in `assets/js/core/layout.js` as template strings and injected on load
(works from `file://`, no fetch). Each page has a `<noscript>` fallback nav.

## 12. Verification

- Engine unit checks run in Node (`node tests/run.mjs`, the classic scripts loaded into a vm context): swing rule, generator truth
  invariants for every scenario across 200 seeds, grading functions.
- Design skill's checkers on the home page; screenshots at 1440, 1024, 768, 390.
- Animation verified in Claude in Chrome; if not connected, a headless-Chrome frame sampler (and say so).
- Manual pass of all four lab modes at desktop and phone width.
- Publish: claude.ai private Artifact with the multi-file site.

## 13. Decisions after the builder check

- **D1 Grading without thresholds the clip never gives** (my call). Questions about the rule itself
  ("click a swing high") accept any swing the two-candle rule (F2.1/F2.2) finds. Questions about a
  scenario ("click the sweep candle", "click the higher low") are graded against the generator's
  scripted anchors, which always satisfy the rule. No count or distance is graded for "stacked" or
  "relatively equal" levels: the generator draws them as visually clear clusters, and the page notes
  "คลิปไม่ได้กำหนดระยะ" where it matters.
- **D2 Entry timing** (my call, checked against frames and transcript at 23:30–24:45, 25:30–26:15,
  37:30–38:15). Every clip example waits until the new trend is visible — HL and HH printed after a
  swept low (long), LL and LH after a swept high (short) — then marks the entry on the pullback
  ("average entry"; F7.14 shows H… HH then another HL → entry). The clip gives no exact trigger
  (F6.7). Site wording follows exactly that. Replay grades the decision as a window: a long is correct
  from the first pullback after the HH prints until price clears that HH again; entering on or before
  the sweep, or before the HH prints, is wrong (F6.3). The short is the mirror.
- **D3 Timeframes** (my call). Each chart has one base series (1m or 5m). The engine can roll it up
  to 15m / 1H / 4H, and HTF scenarios (S09–S11, module 7, quiz HTF items) get a timeframe switch over
  the same data. Base series stays at or below ~3,000 bars for phone performance.
- **D4 Confirmed setups that fail** (the user's answer). Replay includes confirmed setups that do not
  follow through (about one in four). The score is the decision per the clip's process; profit or loss
  is shown separately with the badge "คลิปไม่ได้บอกวิธีจัดการเมื่อ confirmation ล้ม". Generator truth
  carries `outcome: "win" | "fail"`; Scenarios S04 stays the labelled "sweep without reversal" demo.

## 14. Left to the builder

Exact palette and fonts (dealt), copy wording (Thai paraphrase of the facts), module illustration
choices, scenario parameter values, lab difficulty tuning, file splitting inside the folders above.
