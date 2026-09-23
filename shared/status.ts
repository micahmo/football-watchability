/**
 * Whether a game in progress has stopped, so that nothing can be watched.
 *
 * The board answers "what should I put on right now", and a game at halftime or
 * in a weather delay cannot be put on right now. Tampa Bay led the board for two
 * hours on 2026-09-20 during a lightning delay, with its card saying "Delayed"
 * the whole time, and games at halftime kept taking the top slot while something
 * else was being played. A paused game keeps its rating and its card, but sorts
 * below every game actually in play and does not send a "switch to this" alert.
 *
 * Breaks between quarters are deliberately not included. They are two minutes of
 * advertising, and demoting for them would reshuffle the board four times a game.
 */
export function isPaused(game: {
  state: string;
  statusName: string;
  period: number;
  clockSeconds: number;
}): boolean {
  if (game.state !== "in") return false;
  if (game.statusName === "STATUS_DELAYED" || game.statusName === "STATUS_HALFTIME") return true;
  // ESPN reports the end of the second quarter as 0:00 of period 2 for a poll or
  // two before the status flips, and the card already calls that halftime.
  return game.period === 2 && game.clockSeconds === 0;
}
