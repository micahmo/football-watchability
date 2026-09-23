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
| 2026-09-19 | cfb | North Carolina at Clemson | kickoff alert, then live | 61 | right | **Notably right, no change.** The kickoff alert picked it out of a ten-game window and it held up live at 61, above nine others ranging 18 to 55. Anticipation and the live score agreed with each other and with him. |
| 2026-09-19 | both | rating colors | live | - | "so much better" | The continuum shipped in `1952053`. Recorded so a later change to `scoreColor` knows this was liked, not merely tolerated. |
| 2026-09-19 | cfb | North Carolina at Clemson | live, late, 17-15 | 60.9 shown | right | **Reads as "higher" once corrected.** First in-app report. The 60.9 on screen came from a frame the FastCast merge bug had inflated: the complete-data rating at that moment was ~54, the gap being a win probability of 0.458 against the poll's 0.376. He judged the number, and the number he endorsed was 61, so against the fixed pipeline this is a disagreement, not an agreement. Same direction as his "I like it at 62" an hour earlier and as the Houston/Texas Tech row above: close, late, still a contest reads low. Bug fixed in `444dc79`; verdict left as given in the store. |
| 2026-09-19 | cfb | North Carolina at Clemson | live, 20-21, 1:54 | 45 | about 73 | **Real.** ESPN at 92% for the leader collapsed tension on a one-point game. From the third quarter the score margin now sets a floor under it (40d2def): 68. First of the weekly reviews, 2026-09-23. |
| 2026-09-19 | cfb | SMU at Louisville | live, close, Q2 and Q3 | 46 to 57 | higher, three times | Partly. Third-quarter moments rise a few points under the floor; the tied second-quarter one does not, since the floor starts at halftime. Watching for more close mid-game reports. |
| 2026-09-20 | nfl | Cincinnati at Houston | live, 20-6, 2:00 | 92 | too high | Bug. The two-minute warning carries a placeholder win probability, 0.4775 against 0.001 either side. Ignored since 1c57a26. |
| 2026-09-20 | nfl | Cleveland at Tampa Bay | live, 23-19, 2:00, lightning delay | 74 to 86 | too high, "stinky teams", stuck on top | Two bugs fixed: the same placeholder (1c57a26), and a paused game taking the headline (fcd32e5). "Stinky teams" is the upset-versus-prominence pattern, deferred for more reports. |
| 2026-09-19 | cfb | LSU at Ole Miss | live, 0-0, Q1 | 88 | right, but "instant classic at 0-0?" | Rating right. The tag and the classic alert fired on pregame hype; both need the second half now (1c57a26). |
| 2026-09-19 | cfb | Kentucky at Texas A&M, Duquesne at Washington State | live, 0-0 and 7-7, Q2 | 36, 33 | right, but "upset alert?" | Ratings right. A first-half UPSET ALERT now needs the underdog ahead, not level (1c57a26). |
| 2026-09-19 | cfb | Florida State at Alabama | live, 21-6, Q2 | 47 | higher; the alert "wasn't the top game" | Rating: upset-versus-prominence pattern, deferred. Alert: an upset alert now names the best game on when that is a different one (4136bc7). |
| 2026-09-20 | nfl | Minnesota at Chicago, New Orleans at Baltimore | final, underdogs won | 62, 60 | higher | The board takes the larger of prominence and upset rather than combining them. Deferred until more reports: New Orleans at Baltimore cuts against the obvious fix. |
| 2026-09-21 | nfl | Indianapolis at Kansas City | live, 20-27, 6:23, Indy driving | 56 | higher | Not fixed. The margin reads a seven-point game at 6:23 as less tense than ESPN does, and the clutch term starts at 5:00. One report; mechanism in the design notes. |
| 2026-09-21 | nfl | Indianapolis at Kansas City | live, into overtime | 76 to 100 | right, four times | **Notably right, no change.** The climb from one score down to a tied overtime tracked every verdict. |
| 2026-09-20 | nfl | Carolina at Atlanta, Cincinnati at Houston, Giants at Rams | live blowouts | 6 to 27 | right | The low end of the scale confirmed. |
| 2026-09-20 | nfl | Green Bay at New York Jets | final | 86 | lower | **Invalid, excluded.** The verdict and note were carried over from a live report by the prefill bug, which also deleted that report (fixed 94ce6f8). |
