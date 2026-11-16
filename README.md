# TJR Liquidity — เว็บสอนระบบ liquidity จากคลิป

Static Thai website: lessons, a messy-chart scenario generator, a playbook/checklist and four graded exercise modes. Content is taken only from the clip (https://youtu.be/Vulini8xbB0).

## Run
Open `index.html` in a browser (no server or build needed).

## Test
```
node tests/run.mjs
```

## Folder map
```
index.html learn.html scenarios.html playbook.html lab.html   pages
assets/css/        tokens.css, site.css, pages/*.css
assets/js/core/    ns.js (TJR.util), store.js (TJR.store), layout.js, motion.js
assets/js/scenario/ rng, swings, gen, sessions, library, annotate, grade
assets/js/chart/   scale, render, overlays, chart (canvas engine)
assets/js/pages/   one controller per page
assets/            design-skill kit (layout, motion, components, ...)
docs/              spec, plan, source/clip-facts.md
dev/               chart-demo.html (engine visual check)
tests/             run.mjs + *.test.js
```

## Deploy
Published as a claude.ai Artifact (private link). No server code, no secrets.

## Notes
- typeui fundamentals: not installed (install step handled outside the build).
