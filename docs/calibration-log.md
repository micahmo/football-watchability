# Calibration log

What Micah thought a game was worth, against what the board said.

The board's own numbers can only be checked for internal consistency. Whether a
rating is *right* is a question about watching football, and he is the only one
who can answer it. This file is where those answers accumulate so a proposed
change can be tested against every past judgement at once, rather than against
whichever one prompted it.

## How to use it

Add a row when a rating feels wrong, or notably right. The most useful form is a
direction and a rough number: "felt like an 80, board said 61". A bare "too low"
still works; a number makes the error measurable and lets a later change be
checked for whether it actually fixed anything.

`board` is what was on screen at the time. `felt` is his estimate, or a direction
when there is no number. Leave `outcome` blank until it has been looked at.

## Reading it back

Three cautions, all learned the hard way and all easy to forget:

- **Every row is n=1.** A row is a hypothesis to check against the history log,
  not an instruction to apply. Sometimes the answer is that the board was right.
- **The set is biased upward.** He notices the game he had on, so games rated too
  *high* never generate a row: nobody reports a dull 72 they did not watch. Acting
  only on "too low" inflates the scale over a season. When a row says too low, go
  looking for the inverse as well.
- **Check the whole file, not the newest row.** The point of keeping it is that a
  change can be regression-tested against every earlier judgement.

## Entries

| date | league | game | state | board | felt | outcome |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09-14 | nfl | whole slate | live | ~28 top | too low vs college | Not a defect. Over a fuller sample the NFL peaks *higher* than college, median 64.5 against 34.2. Week 1 prominence was arithmetically pinned because records were 0-0. |
| 2026-09-18 | cfb | Houston at Texas Tech | live, 4th, one score | 26 | too low | Real. Two causes: a dying two-score game was outranking it, fixed by the clutch two-possession gate; and `tension` leans on win probability and undersells close games, still open. |
| 2026-09-19 | cfb | LSU at Ole Miss | pregame | 100 | too high, "a 100 should be one of the most anticipated games of the year" | Real but not the model. The favorites bonus was +13 for two matching conferences and hit the clamp. Reduced to +2. Raw rating was 87. |
| 2026-09-19 | both | ratings generally | live | - | "only the red games look like barn burners; yellow games can be very good" | Real, and a presentation problem rather than a scoring one. Colors banded at 78/58/35 while the heading banded at 75/55, so the two disagreed. Both replaced with a continuum. |
