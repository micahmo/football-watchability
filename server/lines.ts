/**
 * A game's pregame closing line. Held by `GameLedger`.
 *
 * Deliberately the *pregame* number, never a live one. A live line moves with the
 * game, so by the time an underdog has drawn level the line has already caught up
 * and the surprise has been priced away. The closing line is the frozen record of
 * what was expected before kickoff, which is exactly what "is this an upset"
 * needs. It never changes once a game starts.
 */
export interface PregameLine {
  /** Spread relative to the home team. Negative means the home team was favored. */
  homeSpread: number;
  overUnder: number | null;
  details: string | null;
}
