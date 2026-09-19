import type { ScoreComponents } from "./types.js";

export interface Weights {
  primary: number;
  /**
   * What makes a game worth anyone's attention: how big it is, or how wrong it is
   * going. Prominence and upset share one budget rather than holding separate
   * ones, because they are close to mutually exclusive. A marquee game is not an
   * upset by definition, so under separate weights it forfeited the upset share
   * outright and could never approach the top of the scale.
   */
  draw: number;
  swing: number;
  pace: number;
}

/**
 * Sums to 1, so a total is always 0..100.
 *
 * One fixed weighting. Three selectable profiles shipped for a while, trading
 * closeness against prominence, and were removed: measured against a full
 * Saturday of finished games the top-ranked game was identical under all three,
 * nothing moved more than two positions, and a control that cannot change the
 * answer is not a control.
 *
 * Reweighted after measuring 58 live games. The old split could not reach the top
 * of its own scale: the best thing ever recorded earned 86.1, because seven points
 * sat in an `upset` term a marquee game cannot earn and five more sat in `stakes`,
 * which averaged 0.13 at the moment games peaked. `stakes` is gone and its weight
 * is on `primary`. The ordering barely moved: across every minute with more than
 * one live game, the top game is the same one 92.4% of the time.
 */
export const WEIGHTS: Weights = {
  primary: 0.63,
  draw: 0.25,
  swing: 0.08,
  pace: 0.04,
};

/**
 * Weighted sum, floored by what the game was billed as.
 *
 * The floor lives here rather than in `scoreGame` because the browser recombines
 * the components itself, so that favorites can reorder the board without a round
 * trip. Applying it on the server only meant the two disagreed: the board showed
 * a 28 for a game the server had at 36, and every marquee kickoff read lower in
 * the app than in the feed it came from. Anything that shapes the number has to
 * be in the function both sides call.
 */
export function combine(c: ScoreComponents, w: Weights, maxTotal: number | null = null): number {
  // Whichever of the two the game has a claim to, not the sum: a game is not
  // asked to be both a marquee fixture and an upset of one.
  const draw = Math.max(c.prominence, c.upset);
  const raw = 100 * (w.primary * c.primary + w.draw * draw + w.swing * c.swing + w.pace * c.pace);
  // Before a game has said anything, its rating is what it was expected to be.
  // `billing` already carries the clock and the scoreboard, and is zero by halftime.
  const floored = Math.max(raw, c.billing * 100);
  const capped = maxTotal === null ? floored : Math.min(floored, maxTotal);
  return Math.round(Math.max(0, Math.min(100, capped)) * 10) / 10;
}
