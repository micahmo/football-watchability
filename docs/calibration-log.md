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
| 2026-09-26 | cfb | Texas at Tennessee, Iowa at Michigan, Ole Miss at Florida, Texas A&M at LSU, Oregon at USC, Missouri at Mississippi State | live, one score, Q1 to Q3 | 37 to 69 | higher, 23 times across both leagues | **Real, the main finding of the second review.** The billing faded to nothing by halftime while these were still close. It now fades over the whole game, with the scoreboard's blowout veto unchanged. Oregon at USC at 3-6 early in the second goes from 52 to 71. |
| 2026-09-27 | both | Oregon at USC 34-27 at 7:10, Rams at Broncos 19-23, Chargers at Bills 13-17, Seahawks at Commanders 17-24, Panthers at Browns 18-21 | live, one score, Q4 | 39 to 68 | higher, "still a one score game" | **Real.** Win probability and the late margin curve wrote these off. A one-score game in the fourth now counts as at least 0.7 of a coin flip: Oregon at USC goes from 39 to 66. Seahawks down nine at 3:57, two scores, deliberately unchanged. |
| 2026-09-26 | cfb | Gardner-Webb at Marshall, Robert Morris at Buffalo, USF at Bowling Green, Southern Miss at Tulane, Colorado at Baylor | live and final | 42 to 97 | lower, "who?", ten reports | **Real, and closes the upset-versus-prominence pattern deferred on 2026-09-20.** An upset now counts from half to in full as the matchup gets more prominent. Gardner-Webb at Marshall's final goes from 91 to 82. Against: New Orleans at Baltimore, a final called low at 59, goes to 54. |
| 2026-09-27 | nfl | Houston at Indianapolis, Minnesota at Tampa Bay | live, 0-0, Q1 | 65, 75 | lower, "better than all the close games at the end?" | Partly. Nothing lowers a 0-0 billing, but the close games it beat now rate higher. A first-half game leads over a one-score game in its last five minutes 9% of the time, against 8% before, so the billing change did not make this worse. |
| 2026-09-27 | cfb | Rice at Fresno State, USF at Bowling Green | live | 19, 72 to 81 | "is this stuck?" | **Bug, root cause found.** A touchdown taken off the board, and a push stuck at Q4 0:00, both made every later poll look like a rewind. Rice was frozen twelve hours, USF fifty minutes while the fourth quarter was played. Fixed in 9eda611. |
| 2026-09-27 | cfb | Oregon at USC | live, 27-27, Q4 12:41 | 87 then 76 | right, then "why the big jump down??" | **Bug.** ESPN pushed the clock to 1:27 and back; the 87 and its "getting good" alert came from the phantom clock. Clocks that run faster than time are now held (9eda611). The real rating, 76, was the one reported low; the new tuning leaves a tie there unchanged. |
| 2026-09-28 | nfl | Rams at Broncos | live, 26-30, 0:47 | 58 | "why the precipitous dropoff?" | **Bug.** Denver lining up to kick off was scored as Denver holding the ball. Fixed in 9eda611. |
| 2026-09-26 | cfb | Texas at Tennessee, Gardner-Webb at Marshall, Rams at Broncos | alerts | - | "getting good" with 26 seconds left; a second alert for the same game | **Bugs.** The classic alert had no clock gate and was independent of the hero alert. It now needs a minute left and a game gets one of the two (9eda611). |
| 2026-09-27 | cfb | Oregon at USC | kickoff alert | 83 expected | "very late", and no alert for Texas A&M at LSU | **Bug.** The daily cap held it behind a 93.3 live alert until the UTC day rolled over at 8 pm Eastern. Kickoffs no longer compete with live alerts, and the day is local (9eda611). Texas A&M at LSU shared the window as the second pick, so it would not have had its own alert either way. |
| 2026-09-28 | nfl | Ravens at Cowboys | final | 75.6 | right, "wait the final scores changed" | **Bug.** Swing drained after the whistle, and 36 of 72 finals changed rating with nothing about the game changing. Finals now keep their closing line, kickoff context and final swing (837cd85). |
| 2026-09-27 | both | Seahawks at Commanders, Wisconsin at Penn State, Bengals at Steelers | live and final | 76 to 91 | right, "great call as the best game of the day", "wouldn't have put it on without this" | **Notably right, no change.** |
| 2026-09-27 | nfl | Bengals at Steelers | kickoff alert | 75 expected | "shouldn't highlight just one" when games are similar | No change. It led the visible window by eight points and became one of the day's best games. Co-picks for a genuinely close window remain an idea. |
| 2026-09-29 | nfl | planning list after nfelo | pregame | - | "the upcoming slate order looks much better already" | **Right.** Recorded as the first verdict on 96ba8b5, which rates NFL matchups by nfelo strength. |
| 2026-09-26 | both | every live report this week | live | - | - | **Context for the rows above.** 50 of the week's 87 live games were scored on a line other than the closing one, by half a point to four, because the cache kept the first line it saw. Fixed in 837cd85. Small against the patterns above, but the upset numbers in these reports are slightly off. |
| 2026-10-04 | nfl | whole week | live, pre, final | - | 18 of 24 right | **First read of the second review's tuning, and a good one.** 75% right against 43% the week before. Thin for college, with two college reports. |
| 2026-10-04 | nfl | Lions at Panthers, Chiefs at Raiders | live, one score, halftime and Q3 | 52 to 61 | higher, three times | Watching, no change. Standalone games, so the order was right; keeping more billing past halftime would undo last week's measured balance. |
| 2026-10-02 | cfb | North Texas at Tulsa | final after overtime, and a 1 am alert | 83 | lower; "notification for this at 0:00 in OT lmao" | **Alerts now need prominence 0.55**, which also stops last week's Gardner-Webb and Southern Miss alerts; the rating itself stands. "0:00 in OT" is now "in overtime". |
| 2026-10-03 | cfb | Kentucky at South Carolina | live, overtime | 92 | right; "0:00 OF hmm" | Rating right. Overtime wording fixed. |
| 2026-10-04 | nfl | Dolphins at Vikings | primetime alert | 46 expected | "why kickoff notif for this one?" | **Bug.** Alone in the 4:05 slot but not the only game on. Primetime now needs nothing else live or kicking off within 45 minutes. |
| 2026-10-04 | nfl | Colts at Commanders, London | primetime alert | 57 expected | "good notification for only game on" | **Notably right.** The case the rule is for. |
| 2026-10-04 | nfl | Rams at Eagles | hero alert at 2:20 | 85 | "a little late?" | No change. It was 10-20 until 3:59 and first qualified at 2:20, when the alert went. |
| 2026-10-01 | nfl | Chiefs at Raiders; Texans at Titans | pregame | 75; 45 | higher, "undefeateds, divisional game"; lower, "worst game of the week" | No change. Third of seventeen and fourteenth of fifteen: both already where the verdicts put them. |
