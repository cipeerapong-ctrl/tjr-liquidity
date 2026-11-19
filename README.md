# TJR Liquidity — เว็บสอนระบบ liquidity จากคลิป

Static Thai website that teaches only the system in one clip (TJR, "The ONLY Liquidity Guide You'll Ever Need", https://youtu.be/Vulini8xbB0, 49:07): lessons, 14 messy-chart scenarios, a playbook/checklist and four graded exercise modes. Charts are synthetic (a seeded generator plus a custom Canvas 2D engine), not footage or real prices.

## Content rule
All teaching content comes from `docs/source/clip-facts.md`. Every claim carries a timestamp chip (`▶ MM:SS`, a `youtu.be/Vulini8xbB0?t=<seconds>` link). Anything the clip does not say (stop-loss, position size, risk, exact take-profit rules, win rate, backtests, what to do when a confirmation fails) shows the badge `คลิปไม่ได้ระบุ`; on the playbook those are the user's own editable fields, stored only in their browser.

## Run
Open `index.html` in a browser. No server or build needed (classic `<script>` files on one `window.TJR` namespace work from `file://`). Any static server also works, e.g. `python -m http.server 5871`.

Needs JavaScript, and internet for GSAP 3.12.5 + ScrollTrigger 3.12.5 (cdnjs) and Google Fonts. Without GSAP the pages still work, just without animation. `prefers-reduced-motion` gives static final frames.

## Test
```
node tests/run.mjs
```
Node 24. Loads the site's scripts into a `vm` context, then runs `tests/*.test.js` (202 tests: generator invariants over every scenario x 200 seeds, swing rule, sessions and DST days, grading, chart scale math, store with blocked localStorage, rapid Play clicks, page controllers with a stub DOM).

## Pages
| Page | What it does |
|---|---|
| `index.html` | Home: hero chart, the 3-step trade (sweep, confirmation, entry), 8-lesson timeline, the three tools, what the clip does not teach |
| `learn.html` | 8 lessons in clip order, each with a playable chart, a short quiz and timestamp chips; session table in ET and Thai time |
| `scenarios.html` | 14 scenarios (S01-S14) from the clip; step or play bar by bar, notes appear when price reaches them, random new chart each time, timeframe switch |
| `playbook.html` | 7-step playbook with "show on chart" demos, an 11-item checklist (progress saved locally), live session clock (ET and Thailand), session table, own-rules fields for stop-loss / size / risk |
| `lab.html` | 4 graded modes on random charts: Replay (enter or wait at each bar from the sweep onward), Spot (mark a pivot), Sessions (draw session lines), Quiz (level resistance). Scores measure following the clip's steps, not profit |

## Folder map
```
index.html learn.html scenarios.html playbook.html lab.html   pages
assets/css/         tokens.css (palette, type), site.css (shared components), pages/*.css
assets/js/core/     ns.js (TJR.util), store.js, layout.js (nav/footer/chips), motion.js
assets/js/scenario/ rng, swings, gen, sessions, library (S01-S14), annotate, grade
assets/js/chart/    scale, render, overlays, chart (canvas engine)
assets/js/pages/    one controller per page
assets/             design-skill kit (layout, motion, components...) - do not edit
docs/               spec, plan, source/clip-facts.md
dev/                chart-demo.html (engine visual check)
tests/              run.mjs + *.test.js
```
Script order on every page: `ns, store, rng, swings, gen, sessions, library, annotate, grade, scale, render, overlays, chart, layout, motion, pages/<page>`.

## Conventions
Thai text, trading terms in English. Prices use tick 0.25 (NQ-like ~30000, ES-like ~7500). Candle `t` is unix seconds UTC; the UI shows ET (US DST rules) and Thailand (UTC+7). localStorage keys start with `tjr.` and are always in try/catch; the site works without it (scores and checklist fall back to memory).

## Known engine limits
- Charts are simulated: shapes mimic what the clip describes; they are not the clip's charts or real prices.
- Generator: about 1 in 1000 seeds can yield a build that fails an invariant. Pages use `TJR.scenarios.safeBuild` (retries up to 12 seeds) and the seed shown is the one actually used.
- Scenarios with no trade in the clip (S04, S05, S11 and the session-day examples S06-S08) have no entry window, target or outcome.
- Not every scenario supports every Spot task (`TJR.grade.spotTasks` lists what applies). Replay needs a sweep, so only scenarios that have one are offered.
- Replay offers choices from the sweep bar onward; entering at or before the sweep is graded as a blind entry.
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
