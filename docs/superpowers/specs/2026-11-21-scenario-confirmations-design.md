# Scenarios S01–S14: clear confirmations (BOS+FVG or IFVG)

Approved by the user 2026-11-21 ("Yes, rebuild them").

## Why
The user found the scenarios page unclear: the S01–S14 trades confirm with the main clip's simple "H, L, HL, HH" and enter on a loose "average entry around the HL" with the badge คลิปไม่ได้ระบุ. Only S15 (BOS+FVG) and S16 (IFVG) show a clear entry. The user wants every trade scenario to show a clear pattern so a learner sees what it looks like.

## What changes
- The 8 trade scenarios keep their liquidity story (levels, the sweep, the target) and get a new post-sweep leg:
  - BOS+FVG: S01, S03 (short), S09 (1m), S10 (short, 4H highs), S12, S14. After the sweep: high H1, higher low M, a displacement that closes beyond H1 (BOS) and leaves a gap, new extreme HH, pullback into the gap, a close back out of it = entry.
  - IFVG: S02, S13. The drop into the sweep leaves a bear gap; after the sweep a candle closes above it (inverse FVG), the same push leaves a bull gap, price pulls back into it and closes back out = entry.
- One push: the confirming close (BOS or IFVG) and the gap the entry uses come from the same move (gap middle within one bar of the confirmation). A chart where a small early break comes first and the gap only many bars later is refused and the build tries the next random stream for the same seed (`define()` retry), so a seed still gives one fixed chart. S15 gets the same rule.
- Truth is read back from the candles with `TJR.confluence` exactly like S15/S16 (`truth.confluence`, `confirmBar = confirm.at`, `entryWindow.from = entry.at`); `check()` runs `confluenceCheck` on them.
- Notes: the sweep and target notes keep their main-clip facts; the confirmation, gap and entry notes cite the playlist (P10.21, P11.21, P8.14, P8.24, P1.19, P1.43). One note cites F6.7 (the main clip says his real strategy uses stricter confluences). No note says HH/HL is the confirmation and none says the entry is unspecified.
- Titles and summaries are rewritten in plain Thai naming the pattern. Def facts and chips list the main-clip and playlist facts the notes cite.
- No-trade scenarios (S04–S08, S11) are untouched. The Liquidity lesson page keeps teaching HH/HL from the main clip (its demo charts still show H, L, HL, HH: the BOS leg makes them).

## Approaches considered
1. Rebuild the post-sweep leg of the 8 trades (chosen): the liquidity lessons stay, every trade shows the pattern.
2. Strip trades from S01–S14 and leave entries to S15–S22: less work, but the user asked to replace the old confirmation, not remove the trades.

## Left to the builder
Exact price and bar ranges of the new legs (reuse S15/S16 numbers), which seeds the page opens on, and test updates.
