# TJR Liquidity — Thai teaching site

Static, multi-page Thai website that teaches only TJR's own system: his liquidity clip (YouTube `Vulini8xbB0`, 49:07, 2026-07-21, the MAIN source) plus his 16-video playlist "Path to Profitability" (2026-01, older, fills detail). v2 content map: `docs/superpowers/specs/2026-11-19-tjr-v2-content-map.md`.

## Stack
- Vanilla HTML/CSS/JS, Canvas 2D chart engine. No build, no bundler, no ES modules.
- Classic `<script>` files attach to one global namespace `window.TJR` (works from `file://`).
- GSAP 3.12.5 + ScrollTrigger 3.12.5 from cdnjs only. Google Fonts (Thai-capable).
- Design kit copied from the design-taste-frontend skill into `assets/` (do not edit kit files).

## Run / test
- Run: open `index.html` in a browser.
- Test: `node tests/run.mjs` (Node 24; loads the site's scripts into a `vm` context, then `tests/*.test.js`).
- Test globals: `test(name, fn)`, `eq`, `ok`, `near`, `readText(relPathFromRepoRoot)`, `listRootHtml()` (root `*.html` file names).

## Content rule
Content comes ONLY from `docs/source/clip-facts.md` (ids `F*`, main clip) and `docs/source/playlist/<videoId>.md` (ids `P<clip#>.<n>`). The main clip wins on conflict; the playlist's older version may be shown in a muted box labelled as the older video. Every teaching claim carries a timestamp chip linking `https://youtu.be/<videoId>?t=<seconds>` of the video the fact came from (main: `▶ MM:SS`; playlist: `▶ #<clip> MM:SS`). Anything no clip says is shown as the badge `คลิปไม่ได้ระบุ`, never filled in. Paraphrase; no verbatim transcript sentences; no TJR screenshots or footage. Excluded: prop-firm promo codes, firm rule tables, prices and income figures (playlist #4), clip #16 goal/life claims; on-screen tool readouts are labelled as readouts, never rules. Web definitions only in a box labelled `นิยามทั่วไป ไม่ใช่จากคลิป` with the source URL.

## Conventions
- Thai text; trading terms stay English (high, low, sweep, liquidity, HH, HL, LH, LL, session, stop-loss).
- Prices use tick 0.25. Candle time `t` = unix seconds UTC; display ET and Thailand time (UTC+7).
- localStorage keys prefixed `tjr.`, always inside try/catch; the site must work without it.
- Dark trading-terminal look, never violet/lavender; `prefers-reduced-motion` gives static final frames.
- Commit after each finished step; never push without asking.
