import type { League } from "../../shared/types";

/** Enough of a team to title its sheet before the schedule arrives. */
export interface TeamRef {
  league: League;
  id: string;
  name: string;
  logo: string | null;
}

/*
 * Which team's sheet is open, if any.
 *
 * A module rather than a prop, because a team can be tapped on a live card, a
 * finished one or a planning row, each rendered several layers below the app, and
 * the sheet is drawn once at the top.
 */
let open = $state<TeamRef | null>(null);

export function openTeam(team: TeamRef): void {
  open = team;
}

export function closeTeam(): void {
  open = null;
}

export function openedTeam(): TeamRef | null {
  return open;
}
