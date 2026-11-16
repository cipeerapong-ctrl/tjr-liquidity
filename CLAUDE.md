# TJR Liquidity — Thai teaching site

Static, multi-page Thai website that teaches only the system in TJR's liquidity clip (YouTube `Vulini8xbB0`, 49:07).

## Stack
- Vanilla HTML/CSS/JS, Canvas 2D chart engine. No build, no bundler, no ES modules.
- Classic `<script>` files attach to one global namespace `window.TJR` (works from `file://`).
- GSAP 3.12.5 + ScrollTrigger 3.12.5 from cdnjs only. Google Fonts (Thai-capable).
- Design kit copied from the design-taste-frontend skill into `assets/` (do not edit kit files).

## Run / test
- Run: open `index.html` in a browser.
- Test: `node tests/run.mjs` (Node 24; loads the site's scripts into a `vm` context, then `tests/*.test.js`).
- Test globals: `test(name, fn)`, `eq`, `ok`, `near`, `readText(relPathFromRepoRoot)`.

## Content rule
Content comes ONLY from `docs/source/clip-facts.md`. Every teaching claim carries a timestamp chip `▶ MM:SS` linking `https://youtu.be/Vulini8xbB0?t=<seconds>`. Anything the clip does not say is shown as the badge `คลิปไม่ได้ระบุ`, never filled in. Paraphrase; no verbatim transcript sentences; no TJR screenshots or footage.

## Conventions
- Thai text; trading terms stay English (high, low, sweep, liquidity, HH, HL, LH, LL, session, stop-loss).
- Prices use tick 0.25. Candle time `t` = unix seconds UTC; display ET and Thailand time (UTC+7).
- localStorage keys prefixed `tjr.`, always inside try/catch; the site must work without it.
- Dark trading-terminal look, never violet/lavender; `prefers-reduced-motion` gives static final frames.
- Commit after each finished step; never push without asking.
