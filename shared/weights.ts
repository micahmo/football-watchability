import type { ScoreComponents } from "./types.js";

export interface Weights {
  primary: number;
  prominence: number;
  swing: number;
  upset: number;
  stakes: number;
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
 */
export const WEIGHTS: Weights = {
  primary: 0.58,
  prominence: 0.18,
  swing: 0.08,
  upset: 0.07,
  stakes: 0.05,
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
  const raw =
    100 *
    (w.primary * c.primary +
      w.prominence * c.prominence +
      w.swing * c.swing +
      w.upset * c.upset +
      w.stakes * c.stakes +
      w.pace * c.pace);
  // Before a game has said anything, its rating is what it was expected to be.
  // `billing` already carries the clock and the scoreboard, and is zero by halftime.
  const floored = Math.max(raw, c.billing * 100);
  const capped = maxTotal === null ? floored : Math.min(floored, maxTotal);
  return Math.round(Math.max(0, Math.min(100, capped)) * 10) / 10;
}
