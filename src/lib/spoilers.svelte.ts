import type { Game } from "../../shared/types";
import { prefs } from "./prefs.svelte";

/*
 * ANYTHING NEW THAT SAYS HOW A GAME IS GOING HAS TO BE ADDED HERE.
 *
 * This is a standing obligation, not a finished job. The board earns its keep by
 * saying which game is worth watching, which makes every field it learns a
 * candidate for giving one away. A field added later and rendered unguarded
 * silently defeats the whole feature, and it defeats it for the one viewer who
 * cared enough to ask, on the one game they cared about.
 *
 * So: when adding anything to a live or finished card, ask whether somebody who
 * had not seen the game could infer the score, the closeness, the winner or the
 * drama from it. If the answer is anything but a firm no, gate it on `isHidden`.
 *
 * What is withheld today, and why each one is not merely the score:
 *   - the score, and the win probability bar
 *   - the rating, which is a measure of how close the game is
 *   - the rail colour, which is that rating again
 *   - the clock and quarter, because "4th OT" is the whole story
 *   - the drive diagram, down and distance, and possession
 *   - the last play
 *   - the tags: "INSTANT CLASSIC", "UPSET ALERT", "2OT"
 *   - both records, because a final turns 2-0 into 2-1
 *   - the dimming of the trailing side, which names the loser with no numbers
 *   - the position in the list, since sorting by quality broadcasts quality
 *   - the hero heading, which would otherwise describe the card it is hiding
 *
 * Notifications are handled separately and more strictly, in `server/alerts.ts`:
 * the board can decline to draw something it was sent, but a push shows itself,
 * so no payload is ever composed. A new alert category needs the same filter.
 */

/**
 * Games this viewer has chosen to look at anyway, for as long as the page lives.
 *
 * Deliberately not persisted and deliberately not per team. Somebody who checks
 * the score at half past four may well be pausing a recording at five, and a
 * choice made once should not quietly stay made: reloading is the reset, and the
 * next tap asks again.
 */
let revealed = $state<string[]>([]);

export function reveal(gameId: string): void {
  if (!revealed.includes(gameId)) revealed = [...revealed, gameId];
}

/**
 * Put a game back behind the curtain.
 *
 * Looking once is not a decision to keep looking. Somebody who checks a score at
 * half past four and then starts the recording wants the board back the way it
 * was, and reloading the page to get it is a workaround, not a feature.
 */
export function unreveal(gameId: string): void {
  revealed = revealed.filter((id) => id !== gameId);
}

/** Whether this game involves a team the viewer is avoiding. */
export function isProtected(game: Game): boolean {
  if (game.league !== "nfl") return false;
  const teams = prefs.noSpoilers;
  if (teams.length === 0) return false;
  return teams.includes(game.away.id) || teams.includes(game.home.id);
}

/**
 * Whether the board should be hiding how this game is going.
 *
 * Only once there is something to give away. A game that has not kicked off
 * carries nothing but the matchup and the line, which is why the planning list
 * is left exactly as it is.
 */
export function isHidden(game: Game): boolean {
  if (game.state === "pre") return false;
  return isProtected(game) && !revealed.includes(game.id);
}
