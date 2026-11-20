# TJR site v3: one learning path — design

Date: 2026-11-20. Status: draft for the user's approval.
Builds on: `docs/superpowers/specs/2026-11-19-tjr-v2-content-map.md` (v2, live at the same Artifact URL).

## 1. Intent

A beginner who lands on the site today meets "Liquidity อยู่เหนือ High และใต้ Low" in the first line, and terms such as
FVG, IFVG and BOS are explained only deep inside a Level 2 page. The user asked for the site to start from "what is what"
and to be reordered as a whole.

v2 is split by SOURCE (Level 1 = the main liquidity clip, Level 2 = the playlist). v3 splits it by LEARNING ORDER: one
numbered path a beginner walks from top to bottom. The source of every claim stays visible through the chips.

**Success:** someone who has never traded can open the home page, see where to start, and on every page know which step
they are on, what came before and what comes next. They meet the definition of every term before the lesson that uses it.

## 2. Goals, non-goals, anti-goals

Goals
- A new step-0 page, `start.html` ("เริ่มที่นี่"), that teaches candles, timeframes, high/low and trend, then gives a
  one- or two-line definition of every term the later steps use.
- One path of six steps, shown the same way on every path page: 0 เริ่มที่นี่ → 1 Liquidity → 2 Confluences →
  3 เซ็ตอัพเต็ม → 4 Playbook → 5 ความเสี่ยง.
- The home page rewritten around the path.
- Practice pages (สถานการณ์, แบบฝึก) tagged by the step they practise.
- No visible "Level 1 / Level 2" wording left anywhere a reader can see it.

Non-goals
- No change to the lessons' content, facts, chips or charts beyond the path framing and the wording swaps listed below.
- No merge of `learn.html` and `confluences.html` (approach C, rejected).
- No new scenarios, drills or detectors.

Anti-goals (a failure even if it works)
- A term used on the start page before it is defined there.
- A chip or older-version box lost or changed by the reorder.
- A definition on the start page that no clip says (the content rule still binds: TJR's terms come only from his clips;
  anything else is the labelled web-definition box or the `คลิปไม่ได้ระบุ` badge).

## 3. Approaches (the user picked A)

- **A. One path of six steps (chosen).** Keep every lesson page where it is; add a step-0 page, a shared step marker
  and prev/next bar, re-order the nav, rewrite the home page. Cost: medium-large, mostly framing. Lessons keep their
  internal order.
- B. Move Confluences before Liquidity, as literally asked. Rejected: FVG and BOS are defined with highs and lows, every
  trade in his system starts with a liquidity sweep, and TJR's own series order is basics → liquidity → FVG → ... (P14.2).
  The start page gives every definition up front, which is what the request needs.
- C. Merge Liquidity and Confluences into one lesson page in teaching order. Rejected: rebuilds the two largest pages and
  moves about 400 chips and many tests for little gain over A.

## 4. The path

| Step | Page | Nav label | Marker text |
|---|---|---|---|
| 0 | `start.html` (new) | เริ่มที่นี่ | ขั้น 0 · เริ่มที่นี่ |
| 1 | `learn.html` | Liquidity | ขั้น 1 จาก 5 · Liquidity |
| 2 | `confluences.html` | Confluences | ขั้น 2 จาก 5 · Confluences |
| 3 | `strategy.html` | เซ็ตอัพเต็ม | ขั้น 3 จาก 5 · เซ็ตอัพเต็ม |
| 4 | `playbook.html` | Playbook | ขั้น 4 จาก 5 · Playbook |
| 5 | `risk.html` | ความเสี่ยง | ขั้น 5 จาก 5 · ความเสี่ยง |
| practice | `scenarios.html`, `lab.html` | สถานการณ์, แบบฝึก | ฝึก · ใช้คู่กับขั้น … |

- One `PATH` list in `assets/js/core/layout.js` is the single source of the order, labels and hrefs; the nav, the step
  marker and the prev/next bar all read it. Nav order: หน้าแรก · เริ่มที่นี่ · Liquidity · Confluences · เซ็ตอัพเต็ม ·
  Playbook · ความเสี่ยง · สถานการณ์ · แบบฝึก (9 links). The header CTA becomes "เริ่มที่นี่" → `start.html`.
- Every path page: the step marker replaces its `level-tag` at the top, and a prev/next bar sits above the page close
  ("← ขั้นก่อนหน้า: …", "ขั้นถัดไป: … →"); step 0 has no prev, step 5's next is the practice pages.
- The noscript nav in every HTML file matches the new order (tests already check it per page).
- Nav must still fit in one row at 1024, 1100 and 1280; if 9 links do not fit at 1024, the menu collapses to the
  existing mobile sheet below the width where it fits (measured, not guessed).

## 5. The start page (`start.html`, step 0)

Order, top to bottom; each block uses only terms defined above it:

1. **Hero:** what this site teaches and who it is for, in plain Thai; the path as six numbered stops; one button to
   block 2.
2. **แท่งเทียน (candle):** one candle = one period; open, high, low, close; body and wicks; up candle vs down candle
   (P14.17–P14.23). Visual: a drawn up candle and down candle with the four points labelled; the labels draw in once
   (GSAP), static under reduced motion.
3. **Timeframe:** the timeframe sets how much time one candle covers; zooming in splits one candle into several, and
   the price movement is the same (P14.25–P14.28). Visual: one 4-hour candle that splits into four 1-hour candles on a
   toggle (the page's one interactive moment).
4. **High และ low:** move level and two-candle level, the level at the extreme wick (main clip F2.1–F2.2 first; P14.33–
   P14.36 add the detail; they agree). Visual: a short drawn series with each high and low marked.
5. **Trend:** HH/HL uptrend, LH/LL downtrend, sideways; a trend can change, so a trend alone is not a reason to buy or
   sell (F3.1, P14.38–P14.43). Visual: the two zigzags, labelled.
6. **ตั้งค่ากราฟตามที่เขาแนะนำ (small box):** set the chart to New York time; a free charting account is enough
   (P14.9, P14.13). His platform name may appear as his choice, never as a recommendation link.
7. **คำที่จะเจอในขั้นต่อไป (glossary):** liquidity, sweep, session, BOS, FVG, IFVG, equilibrium (premium/discount),
   SMT, draw on liquidity. Each entry: the term, one or two Thai lines paraphrasing the clip that defines it, its chip,
   and a link "เรียนเต็มในขั้น N" to the section of the lesson page that teaches it (anchors that exist today, e.g.
   `learn.html#m1`, `confluences.html#m2`). Where the main clip and the playlist differ, the line follows the main
   clip (the v2 conflicts C1–C9 still hold, e.g. BOS keeps its web-definition box note).
8. **Next:** "ขั้นถัดไป: Liquidity →" plus the shared prev/next bar.

All visuals are drawn by the site (SVG or the existing chart engine with fixed candles), never a screenshot or
footage. Candle colours follow the site's existing chart tokens.

## 6. Home page (`index.html`)

- New hero: says the site teaches TJR's trading system in Thai from zero; primary button "เริ่มที่นี่" →
  `start.html`; secondary "ดูเซ็ตอัพเต็ม" → `strategy.html`. The liquidity idea moves out of the h1.
- New "เส้นทาง 6 ขั้น" section replaces the "ระบบเต็มของ TJR มี 2 ระดับ" section: six stops, each with what you
  learn there and a link.
- The "ทุกเทรดในคลิปเดิน 3 ขั้น", 8-lesson list, practice and sources sections stay, re-labelled with steps instead of
  levels; the sources section keeps "the main clip wins on conflict".
- `<meta name="description">` rewritten without "Level".

## 7. Wording swaps on existing pages

- Page-top `level-tag` → the step marker (§4) on learn, confluences, strategy, playbook, risk.
- Inline source tags (`L1` / `L2` in playbook and risk, "Level 1 ยังอยู่" note in confluences, the "ต่อใน Level 2"
  list in learn): the text names the SOURCE instead — `คลิปหลัก` for the main clip, `เพลย์ลิสต์` for the playlist —
  or the STEP when it points to another page ("ต่อในขั้น 2"). The colour coding of the two tags stays.
- Scenarios: filter chips "Level 1 / Level 2" → "ฝึกขั้น 1 · Liquidity" (S01–S14) and "ฝึกขั้น 2–3 · ระบบเต็ม"
  (S15–S22); card and viewer tags follow.
- Lab: the four v1 modes are marked "ใช้คู่กับขั้น 0–1", the three drills "ใช้คู่กับขั้น 2–3".
- Code comments may keep "Level 1/2" as internal names; only visible text changes.

## 8. Docs and checks

- `CLAUDE.md` "Pages" section and `README.md` describe the path; `start.html` added to the pages list.
- Tests: new `tests/start.test.js` (every chip id is a real fact id of its clip; every glossary link points to an
  anchor that exists; terms appear in definition order; no visible "Level"); existing tests that check level tags,
  nav order or README wording are updated to the path.
- Before republish: the scratchpad content audit (links, anchors, banned strings) over 9 pages; nav fit at 1024 / 1100 /
  1280; no horizontal overflow at 390 on all 9 pages; the start page animations checked in Chrome at desktop and mobile
  widths; then republish to the same Artifact URL with `start.html` added (needs the user's go-ahead).

## 9. Left to the builder

- SVG vs chart engine for each start-page visual; the exact Thai copy (paraphrase, Thai text with English trading terms,
  no verbatim sentences).
- Which fact ids carry each glossary line, chosen from the facts files' definition facts.
- The exact layout of the step marker and prev/next bar, within the existing design tokens (dark terminal look, no
  violet).
