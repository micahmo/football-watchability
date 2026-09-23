/**
 * The last real win probability seen for each game, for drawing the bar across a
 * gap.
 *
 * ESPN's scoreboard arrives without a probability for a poll or so after most
 * scores, and the server deliberately refuses to carry the old one across a
 * score, since for scoring that number describes a game that no longer exists.
 * That is right for the rating and wrong for the screen: the whole bar vanished
 * after every touchdown and came back a minute later. So the display holds the
 * last value, dimmed to say it is stale, and scoring never sees it.
 *
 * Deliberately unbounded. Once a bar has appeared it stays until a fresh value
 * replaces it. A time limit and then a limit of one score were both tried and
 * both rejected: the dimming already says the number is out of date, and a bar
 * that disappears is the thing this exists to prevent.
 */
const seen = new Map<string, number>();

export function rememberWinProb(gameId: string, value: number): void {
  seen.set(gameId, value);
}

export function heldWinProb(gameId: string): number | null {
  return seen.get(gameId) ?? null;
}
