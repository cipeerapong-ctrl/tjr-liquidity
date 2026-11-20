# TJR Liquidity — เว็บสอนระบบของ TJR จากคลิป (v3)

Static Thai website that teaches only TJR's own system as one learning path from zero (Step 0 to Step 5, plus practice):

- **Source A, the main clip (liquidity):** his clip "The ONLY Liquidity Guide You'll Ever Need" (https://youtu.be/Vulini8xbB0, 49:07, 2026-07-21), the MAIN source. Where liquidity sits, sweeps as an opportunity, a simple structure confirmation (H, L, HL, HH), session and higher-time-frame targets, low- vs high-resistance liquidity.
- **Source B, the playlist (the full system, and the basics):** his 16-video playlist "Path to Profitability" (2026-01, older). It fills in what the main clip says it does not teach: daily bias, time windows, break of structure, fair value gaps, inverse FVGs, equilibrium, SMT divergence, the exits, and risk. The worked trade of clip #1 is told step by step. Clip #14 (candlestick basics) is the base of Step 0.

The learning path: Step 0 `start.html` (candle, timeframe, high / low, trend, a glossary) → Step 1 Liquidity → Step 2 Confluences → Step 3 the full setup (strategy) → Step 4 Playbook → Step 5 Risk. Every path page shows its step and a previous / next bar; the scenarios and the lab are practice pages tagged with the steps they go with. `TJR.layout.PATH` in `assets/js/core/layout.js` is the one list of the order.

Charts are synthetic (a seeded generator plus a custom Canvas 2D engine), not footage or real prices.

## Sources and precedence
Content comes ONLY from `docs/source/clip-facts.md` (fact ids `F*`, the main clip) and `docs/source/playlist/<videoId>.md` (ids `P<clip#>.<n>`). Rules:

- The main clip wins on any conflict (it is newer); the playlist fills detail, and an older version may appear in a muted box labelled as the older video. The content map `docs/superpowers/specs/2026-11-19-tjr-v2-content-map.md` lists every conflict and its ruling.
- Every teaching claim carries a timestamp chip linking `https://youtu.be/<videoId>?t=<seconds>` of the video the fact came from (main clip: `▶ MM:SS`; playlist: `▶ #<clip> MM:SS`).
- Anything no clip says (stop-loss rule, how much to close at each take-profit, win rate, max loss, what to do when a setup fails) shows the badge `คลิปไม่ได้ระบุ`, never a filled-in guess. On the playbook those are the user's own editable fields, stored only in their browser.
- Paraphrase only: no verbatim transcript sentences, no TJR screenshots or footage. Excluded: prop-firm promo codes, firm rule tables, prices and income figures (clip #4), clip #16's goal and life claims. On-screen tool readouts are labelled as readouts, never as rules; web definitions sit in a box labelled `นิยามทั่วไป ไม่ใช่จากคลิป` with the source URL.

## Run
Open `index.html` in a browser. No server or build needed (classic `<script>` files on one `window.TJR` namespace work from `file://`). Any static server also works, e.g. `python -m http.server 5871`.

Needs JavaScript, and internet for GSAP 3.12.5 + ScrollTrigger 3.12.5 (cdnjs) and Google Fonts. Without GSAP the pages still work, just without animation. `prefers-reduced-motion` gives static final frames.

## Test
```
node tests/run.mjs
```
Node 24. Loads the site's scripts into a `vm` context, then runs `tests/*.test.js`: 523 tests, about 40 seconds. They cover the generators (every scenario S01-S22 x seeds 1..200 against `TJR.scenarios.check`), the swing rule, sessions and DST days, the detectors (FVG, BOS, equilibrium, SMT), grading, chart scale math and overlays, the store with blocked localStorage, rapid Play clicks, the page controllers with a stub DOM, and content rules on every page (chips point at the right video and second, nothing from the excluded list).

## Pages
| Page | Step | What it does |
|---|---|---|
| `start.html` | Step 0 | Step 0, the beginner page: candle, timeframe, high / low, trend, then a short glossary that links into the lessons |
| `index.html` | home | Home: hero chart, the six-step path with the chain of one trade, the 3-step trade of the clip, lesson timeline, the tools, the two sources |
| `learn.html` | Step 1 | 8 lessons in main-clip order, each with a playable chart, a short quiz and timestamp chips; session table in ET and Thai time; extra detail from playlist clips #12 and #14 |
| `confluences.html` | Step 2 | Five lessons with an interactive each: break of structure, fair value gap, inverse FVG (BOS vs IFVG race), equilibrium (draggable range), SMT (twin ES / NQ charts) |
| `strategy.html` | Step 3 | Two tabs. BOS: his worked trade of 16 Jan 2026 as a 9-step tracker over a simulated twin chart (bearish SMT, ES leads). IFVG: a 6-step simulated short on S16 (sweep, close under the gap, pullback into the bear gap) from clips #7 and #8. Plus the facts the clip does not state |
| `risk.html` | Step 5 | Risk and discipline: the three skills, his sizing logic, a contract-size calculator (inputs only, no advice), win rate x R:R, the funded-account paragraph |
| `playbook.html` | Step 4 | His order of thinking in 8 steps (bias, time, sweep, confirmation, continuation, entry, exit, risk) with "show on chart" demos, a bias worksheet, a 13-item checklist (progress saved locally), live NY clock (ET and Thailand), session table, own-rules fields |
| `scenarios.html` | practice (Steps 1-3) | 22 scenarios: S01-S14 from the main clip, S15-S22 full-system setups (BOS + FVG, IFVG, equilibrium, stacked gaps, wick-is-not-a-break, SMT twin, time windows). Step or play bar by bar, notes appear when price reaches them, random new chart, timeframe and outcome switches |
| `lab.html` | practice (Steps 0-3) | 7 graded drills on random charts: Replay, Spot, Sessions, Quiz (Steps 0-1) and Gap finder, Break or not, Which index leads (Steps 2-3). Scores measure following the steps, not profit |

## Folder map
```
index.html start.html learn.html confluences.html strategy.html risk.html playbook.html scenarios.html lab.html   pages
assets/css/         tokens.css (palette, type), site.css (shared components), pages/*.css
assets/js/core/     ns.js (TJR.util), sources.js (video table, fact id -> video), store.js, layout.js (nav/footer/chips), motion.js
assets/js/scenario/ rng, swings, gen, sessions, confluence (FVG / BOS / EQ / SMT detectors), library (S01-S14, check),
                    system (S15-S22), annotate, grade
assets/js/chart/    scale, render, overlays, chart (canvas engine, twin chart)
assets/js/pages/    one controller per page
assets/             design-skill kit (layout, motion, components...) - do not edit
docs/               superpowers/specs (design, v2 content map), superpowers/plans, source/clip-facts.md, source/playlist/*.md
dev/                chart-demo.html (engine visual check)
tests/              run.mjs + *.test.js
```
Script order on every page: `ns, sources, store, rng, swings, gen, sessions, confluence, library, system, annotate, grade, scale, render, overlays, chart, layout, motion, pages/<page>`.

## Conventions
Thai text, trading terms in English. Prices use tick 0.25 (NQ-like ~30000, ES-like ~7500). Candle `t` is unix seconds UTC; the UI shows ET (US DST rules) and Thailand (UTC+7). localStorage keys start with `tjr.` and are always in try/catch; the site works without it (scores and checklist fall back to memory). Dark trading-terminal look, never violet.

## Known engine limits
- Charts are simulated: shapes mimic what the clips describe; they are not the clips' charts or real prices. The 16 Jan 2026 replay on the strategy page is a simulation that follows the order of events he tells, not his data.
- Generator: a few seeds can yield a build that fails an invariant. Pages use `TJR.scenarios.safeBuild` (retries up to 12 seeds) and the seed shown is the one actually used. S21 also redraws internally until the break comes after the SMT.
- S21 (SMT) picks from the seed which index leads (ES or NQ) and whether the SMT is bearish at a high or bullish at a low (both are in the clips); the strategy page pins his bearish ES-leading trade.
- Scenarios with no trade (S04, S05, S11, S18, S20, and the session-day examples S06-S08) have no entry, target or outcome.
- Not every scenario supports every Spot task (`TJR.grade.spotTasks` lists what applies). Replay needs a sweep, so only scenarios that have one are offered.
- Switching timeframe in a scenario shows only what was knowable up to the current bar (no look-ahead); higher timeframes are rolled up from the base bars.
- S10/S11 ("5m base over 3 sessions") are three futures days (828 5m bars), the heaviest charts.
- Session clock and ET labels follow US DST rules computed in code (2nd Sunday of March, 1st Sunday of November); Thai time has no DST.
- Pages that draw charts need JavaScript (a `noscript` note says so).

## Known deviations
- The design checker's structural FAILs on long app pages (hero-fill, no-visual, text-only, card-visual, section-tile, one-section, container-edges, section-gaps) are accepted by ruling: these are tool pages, not marketing sections.
- The design kit's ES modules do not run from `file://`; the site does not use them (classic scripts only).
- typeui fundamentals were not installed (the install command is blocked in this environment); the design-taste-frontend kit and its references were used instead.
- Inline timestamp chips inside running text are 26 px tall; chips in a row (`.chips`) are 44 px on phones and tablets. Cards that are one big link use a stretched `::after` as the target.

## Deploy
Static files only: no server code, no secrets, no build. Upload the folder to any static host, or publish as a claude.ai Artifact (private link: `index.html` plus every referenced file). Never push to a remote without asking.
