# TJR site v2 — content map (merge of the main clip and the 16-video playlist)

Status: DRAFT for the user's approval. Nothing gets built until it is approved.
Inputs: `docs/source/clip-facts.md` (main clip Vulini8xbB0, 2026-07-21, ids F*) and
`docs/source/playlist/*.md` (playlist "Path to Profitability", 2026-01-01..17, ids P<clip#>.<n>).
Precedence (user ruling 2026-11-19): the main clip is newer and wins on conflict; the playlist fills gaps and adds topics.

## 1. The big picture

The main clip teaches only **liquidity**: where orders rest, sweeps as an opportunity, a simple structure confirmation
(H, L, HL, HH), session and HTF targets, low- vs high-resistance liquidity. Three times it says the real strategy uses
more confluences it does not teach (F6.7, F7.14, F9.1: "market structure breaks, fair value gaps, inverse fair value gaps").

The playlist **is** that missing strategy. Its chain, said the same way in four clips (P1.19, P7.11, P10.21, P11.26):

| Step | His name | Tools | Main sources |
|---|---|---|---|
| 0 | Daily bias + map | HTF 4h/1h trend, draws on liquidity, retrace area | #3, P1.23–P1.30 |
| 1 | Potential for orders to fill (reversal confluence) | sweep of a significant high/low; SMT as an early clue | main F3–F8, #12, #13, #6 |
| 2 | Confirmation orders were filled | LTF **break of structure** or **inverse FVG** | #11, #8 |
| 3 | Continuation of the new trend | **FVG** or **equilibrium** (wait for respect, never enter on first touch) | #10, #7, P1.42–P1.43 |
| 4 | Entry | 5m candle close out of the confluence, or the 1m flip (his usual) | P1.44–P1.48 |
| 5 | Exit | TP at draws: session lows/highs, HTF lows/highs, stacked levels, data levels | P1.20, P1.51, P12.23–P12.25 |
| — | Timing | NY open 09:30; manipulation 09:30–09:50; entry 09:50–10:10; his 10:30 cut-off | #5 |
| — | Risk | 1–3% per trade, fixed contracts, halve size on news or a wide stop | #2 |

Design consequence: the site keeps the main clip as **Level 1 (liquidity)** and adds the playlist as **Level 2 (the full
system)**. The main clip's simple confirmation (F6.5–F6.9) stays exactly as taught, labelled "Level 1 — as shown in the
liquidity clip"; Level 2 shows the BOS/IFVG version. This is not a conflict: the main clip itself says its confirmation
is simplified ("today only liquidity", F7.14).

## 2. Conflicts and rulings (main clip wins)

| # | Topic | Main clip | Playlist | Ruling on the site |
|---|---|---|---|---|
| C1 | New York session end | 09:30–17:00, pre-market 08:30; 17:00–18:00 spread hour (F7.7) | #12 summary: NY 08:30 back to 18:00 (P12.8); #5 agrees with main (P5.8–P5.9) | Show main. P12.8 not shown (outlier, #5 confirms main). |
| C2 | London official end | 11:00 ET (F7.7) | 11:30 ET (P5.5) | Show 11:00. Small note "older video says 11:30". Practical rule identical: he cuts London at 08:30. |
| C3 | How often the session pattern happens | "almost every single day" (F7.10) | "literally every day" (P5.22); "not every day" (P12.11) | Use main wording only. |
| C4 | Confirmation | Structure pattern H, L, HL, HH / H, L, LL, LH; "average entry here" (F6.5–F6.9) | Close beyond the MOST RECENT opposite swing (BOS, P11.8–P11.14) or an IFVG close (P8.19) | Both shown, as Level 1 and Level 2 (see §1). Not a contradiction. |
| C5 | Rulebook vs discretion | "strict confluences and a rulebook" (F6.7) | no rigid step list, discretion on purpose (P1.3, P1.7) | Lead with main framing; show #1's "toolbox, not a fixed recipe" labelled as the older video. The playbook is presented as his order of thinking, not a rule engine. |
| C6 | Bias before a sweep? | every trade starts with a sweep (F6.4) | bias is set from trend + draws + gap, sweep not always first (#3 ex. A, D) | Not proven to conflict: bias ≠ entry. Show bias as "before the trade"; entries still require the sweep. Note it plainly. |
| C7 | "99%" | 99% of traders fail (F3.6, P13.12) | 99% of people dislike their lives (P16.27) | Do not merge; #16 line is not used. |
| C8 | BOS vs common web meaning | — | TJR uses BOS for a trend CHANGE (P11.5–P11.9) | Show his meaning; one labelled box "นิยามทั่วไป ไม่ใช่จากคลิป: on the web BOS often means continuation" with the source URL, so learners are not confused. |
| C9 | Prop-firm drawdown comparison | — | P2.31 vs firm pages in #4 | Moot: firm figures are excluded (§6). |

High-resistance liquidity (F8.6–F8.8) exists only in the main clip; it stays as is.

## 3. Gaps the playlist fills (main clip F9.2 "not in the clip")

| Gap (F9.2 / current "คลิปไม่ได้ระบุ") | Filled? | What the site may now say |
|---|---|---|
| Stop-loss placement | Partly | One worked example only: stop "above these highs" of the entry leg (P1.50). On-screen readout 4.50 pts is a tool readout, shown as such (P1.59). **Rule still not stated → badge stays on "rule".** |
| Position sizing | Yes | Fixed contracts per instrument chosen from your widest typical stop (P2.19–P2.24); halve on a much wider stop or news day (P2.26). |
| Risk per trade | Yes | 1–3% "usually the sweet spot", never 5–20% (P2.21); his widest-stop case ≈ 3–4% (P2.24). |
| Take-profit | Mostly | Targets = draws: session lows/highs, HTF hourly lows/highs, stacked levels one by one, data levels (P1.20, P1.51, P12.23–P12.25, P12.38). TP1/TP2/TP3 at those draws. **How much to close at each TP: not said → badge.** |
| Win rate / backtest | No numbers | Measure skill by win rate × R:R in a journal; backtest and journal (P2.16, P15.39–P15.40, P1.56). **No numbers → badge.** |
| News filter | Partly | Halve size on news days (P2.26); news candle high/low as a draw (P12.32–P12.38); Forex Factory red folder (P12.33). No "don't trade news" rule. |
| What to do when confirmation fails | Partly | Bias flips when a gap is closed through / structure breaks the other way (P3.6, P3.21, P3.34, P10.22–P10.23); "let the market prove you wrong" (P1.52). No exit rule for a running trade → badge. |
| Entry timing | Yes (new) | Time windows (#5, §1). |
| Max daily loss / max trades per day | No | Badge stays. |

## 4. New topics and where they go

| Module | Source clips | Content (fact ranges) | Interactive idea |
|---|---|---|---|
| M1 Candle and chart basics | #14 | OHLC, wick = travelled price, timeframe nesting, NY time zone, neutral colours (P14.11–P14.28) | Candle dissector; 4h → four 1h zoom |
| M2 Market structure & BOS | #11 | Most recent opposite swing, candle CLOSE beyond it, wick ≠ break, lower high alone ≠ break (P11.3–P11.24) | "Break or not?" stepper with wick/close cases |
| M3 Fair value gap | #10 | 3 candles, wick-to-wick, middle candle colour only, overlap = no gap, respected vs disrespected on close, stacked gaps, delete used gaps (P10.1–P10.36) | Click-the-3-candles gap finder; stacked-gap deletion demo |
| M4 Inverse FVG | #8 | FVG closed through = confirmation; close rule; earlier than BOS (68/123-tick examples); stack rule: bottom gap must be inversed (P8.11–P8.37) | BOS vs IFVG entry race on one chart |
| M5 Equilibrium | #7 | 50% of most-recent low→high (up) / high→low (down); premium/discount; draw after the up candle confirms the low; useless without context (P7.1–P7.32) | Draggable range box with 0 / 0.5 / 1 |
| M6 SMT divergence | #6, P1.31–P1.40 | ES vs NQ; bearish = one LH, other HH; bullish = one HL, other LL; trade the leading index; useful only at significant draws (P6.1–P6.29) | Twin synced charts, "which index leads?" |
| M7 Advanced draws | #12 | Previous-day H/L; relative equal H/L = 4× orders; data (news) H/L; stacked levels as entry and exit (P12.15–P12.40) | Extends learn ch. 7–8 and the Spot drill |
| M8 Opening gaps & BPR (advanced, rarely used) | #9 | NDOG / NWOG / NCOG, BPR; he says rarely tradable, NCOG nearly useless (P9.1–P9.35) | Short reading section, one static chart; low priority |
| M9 Daily bias | #3, P1.23–P1.30 | HTF trend → draws → retrace to FVG/EQ → respect or invalidate; bias flips intraday; external→internal flow (P3.1–P3.47) | 5-step bias worksheet on a replay chart |
| M10 Time theory | #5 | Windows 09:30–09:50 / 09:50–10:10 / 10:30 / PM 13:00, shown in ET and Thailand time; not strict (P5.12–P5.27) | Live clock strip added to the existing session table |
| M11 The full strategy | #1 | The chain in §1, the 16 Jan 2026 replay trade step by step (SMT → BOS → EQ → 1m flip → TP1–3) (P1.17–P1.53) | Replay of the full chain with a step tracker |
| M12 Risk & psychology | #2, #15 | 3 skills; psychology = following the 2 plans; sizing rules; demo first; journal; skill not money (P2.1–P2.29, P15.6–P15.41) | Contract-size calculator from stop ticks (inputs only, no advice) |

### Proposed site structure

| Page | Today | v2 |
|---|---|---|
| index.html | Liquidity landing | Landing for the whole system: Level 1 liquidity, Level 2 full system, map of the chain |
| learn.html | 8 liquidity chapters | Same 8 chapters + M7 folded into ch. 7–8 + M1 detail in ch. 2; stays "Level 1" |
| **confluences.html** (new) | — | M2–M6 + M8, one lesson each, same lesson layout as learn.html |
| playbook.html | 7 steps, checklist, session table | Rebuilt around the full chain: M9 bias → map → M10 time → sweep (+SMT) → BOS/IFVG → FVG/EQ → entry → exits; checklist and "still not said" updated |
| **risk.html** (new) | — | M12 |
| **strategy.html** (new) | — | M11 worked replay of his real trade |
| scenarios.html | 14 scenarios | 14 kept + ~8 new "full system" scenarios using FVG/IFVG/EQ/BOS and 1–2 SMT twin charts |
| lab.html | Replay, Spot, Sessions, Quiz | + drills: Gap finder, Break or not, Draw equilibrium, Which index leads, Time-window quiz |

## 5. Engine and data changes needed

- Fact ids carry the source: `F7.7` (main) and `P8.19` (playlist #8). A source table maps each to video id, title, upload date.
- Timestamp chips name the source: main clip chip as today; playlist chip shows the clip number and "ม.ค. 2026", e.g. `▶ #8 09:08`, linking `https://youtu.be/<id>?t=<s>`.
- Conflict display: main version first; the older version in a muted box labelled "คลิปเก่า (ม.ค. 2026) พูดว่า…".
- Chart engine additions: FVG boxes (bull/bear, respected/disrespected/deleted states), BOS ray at the monitored swing with close marker, equilibrium range box 0/0.5/1, IFVG flip, twin synced ES/NQ panels for SMT, time-window bands on intraday charts.
- Scenarios: keep fixed scenario definitions (the teaching shape) with seeded candle noise, as now; new scenarios follow the same pattern. (Recommendation from the earlier question on randomness.)
- S05 and S11 keep "ไม่มีเทรด": S05 is a daily illustration with no entry in any clip (add P12.27–P12.28 chips for equal highs); S11's point is that a 5m sweep is weak, which still holds.

## 6. What is excluded or limited

- **#4 Funded accounts:** no promo codes, no firm names' rule tables, prices or payout caps, no income figures. At most one line in risk.html: he talks about prop firms as a way to get capital; rules differ per firm, read your own firm's rules; size down once payout-eligible (P2.30–P2.35, P4.7–P4.10).
- **#16 One Day or Day One:** not used for teaching. Optional one-line series intro (daily videos through January). Goal-setting method and all life/income claims are left out.
- **#15 What is Trading:** used only inside M12 (skill not money, demo first, review wins and losses).
- All money claims (F1.7, P1.15, P1.53, P2.12, P11.28, P15.3…) appear only where the main clip already shows one, labelled "คำอ้างของเขา ยังไม่ยืนยัน"; no new income figures are added.
- On-screen-only readouts (position-tool numbers, P1.59, P2.27, P8.26) are shown only as "ตัวเลขจากเครื่องมือบนจอ ไม่ใช่ที่เขาพูด", never as rules.
- Web definitions: only C8 (BOS). TJR defines FVG, IFVG, SMT himself, so no web text for those.
- No transcript quotes, no footage or screenshots (unchanged rule).

## 7. Still unspecified after all 17 videos (badge `คลิปไม่ได้ระบุ` stays)

Stop-loss rule in words; share of position closed at each TP; win-rate and R:R targets; max loss per day/week; max
trades per day; managing a trade that turns against you; minimum FVG size; how "most recent swing" is chosen when swings
crowd together; IFVG timeframe rule; upside mirror of the stacked-IFVG rule; the Gann box settings he promised (P7.2);
what SMT stands for; which seven advanced draws he meant (P12.2).

## 8. Project rule changes after approval

- CLAUDE.md content rule: sources = `clip-facts.md` + `docs/source/playlist/*.md`; chips link to each video's own id;
  main clip wins on conflict; playlist-only facts labelled with their clip.
- Spec and plan: a v2 spec from this map, then a plan in phases:
  - Phase A: engine (source table, chips, FVG/BOS/EQ drawings) + confluences.html + playbook rebuild + learn additions.
  - Phase B: SMT twin chart, strategy.html, risk.html, new scenarios, new lab drills, final review, republish to the same Artifact URL.

## 9. Scope cuts agreed 2026-11-20 (to shorten the build)
- M8 opening gaps & BPR: no lesson (he calls them rarely tradable / nearly useless, P9.20); one pointer sentence with a `▶ #9` chip only.
- Lab: three new drills (Gap finder, Break or not, Which index leads); Draw-equilibrium and Time-window drills dropped (the equilibrium range stays as a lesson interactive).
- Scenarios S15–S22 stay at 8.
- Build order: Tasks 5, 6, 7 in parallel after Task 4; then Tasks 8, 9, 11, 12 in parallel; then Task 10; then Task 13.
