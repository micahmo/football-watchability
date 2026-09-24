import type { RawGame } from "./espn.js";

/**
 * NFL team strength, from nfelo's weekly power ratings.
 *
 * The planning list judges a game by how close the line is and by how good the
 * teams are, and for the NFL "how good" was each team's record. Two weeks into a
 * season a record has three possible values, so every 1-1 against 1-1 game scored
 * identically and the order among them came down to the television slot. The
 * closing line cannot help: it says how far apart two teams are, not whether they
 * are both good or both bad. nfelo gives the level. On 2026-09-24 it reordered
 * that week's slate the way Micah read it, every one of ten calls, and agreed with
 * a rating fitted from our own closing lines at 0.90.
 *
 * Used with the maintainer's permission for this personal, non-commercial board:
 * https://github.com/greerreNFL/nfelo/issues/9. If they ever ask us to stop, we
 * stop.
 *
 * Stored per team as a percentile of the league, 0 for the weakest and 1 for the
 * strongest, which is the shape the planning score's record term already had.
 */
const SNAPSHOT =
  "https://raw.githubusercontent.com/greerreNFL/nfelo/main/output_data/elo_snapshot.csv";
/** nfelo publishes weekly; checking a few times a day catches a new week promptly. */
const TTL_MS = 6 * 60 * 60 * 1000;
/** After a failure, wait this long before trying again rather than on every poll. */
const RETRY_MS = 15 * 60 * 1000;

/** nflverse abbreviations where they differ from ESPN's. */
const ALIASES: Record<string, string> = { LA: "LAR", WAS: "WSH", JAC: "JAX", OAK: "LV", SD: "LAC" };

export class StrengthStore {
  private byAbbrev = new Map<string, number>();
  private fetchedAt = 0;
  private failedAt = 0;
  private inFlight: Promise<void> | null = null;

  get size(): number {
    return this.byAbbrev.size;
  }

  private async refresh(): Promise<void> {
    const res = await fetch(SNAPSHOT, {
      headers: { "user-agent": "football-watchability/0.1 (personal dashboard)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`nfelo returned ${res.status}`);
    const [header, ...lines] = (await res.text()).trim().split(/\r?\n/);
    const cols = header.split(",");
    const at = (name: string) => cols.indexOf(name);
    const [iTeam, iSeason, iWeek, iPts] = [at("team"), at("season"), at("week"), at("pts_vs_avg")];
    if ([iTeam, iSeason, iPts].some((i) => i < 0)) throw new Error("nfelo columns changed");

    const rows = lines
      .map((line) => line.split(","))
      .map((f) => ({ team: f[iTeam], season: Number(f[iSeason]), week: Number(f[iWeek]), pts: Number(f[iPts]) }))
      .filter((r) => r.team && Number.isFinite(r.pts));

    // Last season's ratings are worse than none: they would override records that
    // describe this season. January and February still belong to the previous one.
    const now = new Date();
    const season = now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
    const current = rows.filter((r) => r.season === season);
    if (current.length < 30) throw new Error(`nfelo has ${current.length} teams for ${season}`);

    const ordered = [...current].sort((a, b) => b.pts - a.pts);
    const next = new Map<string, number>();
    ordered.forEach((r, i) => next.set(ALIASES[r.team] ?? r.team, 1 - i / (ordered.length - 1)));
    this.byAbbrev = next;
    this.fetchedAt = Date.now();
    console.log(`[strength] nfelo ${season} week ${current[0].week}, ${next.size} teams`);
  }

  /** Refreshes at most once per TTL, backs off after a failure, never twice at once. */
  private async ensureFresh(): Promise<void> {
    const now = Date.now();
    if (now - this.fetchedAt < TTL_MS && this.byAbbrev.size > 0) return;
    if (now - this.failedAt < RETRY_MS) return;
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.refresh()
      .catch((err) => {
        // Records stand in whenever this is missing, so a failure costs precision
        // rather than the board.
        this.failedAt = Date.now();
        console.error(`[strength] nfelo failed: ${err instanceof Error ? err.message : err}`);
      })
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }

  /** Stamps each side's strength percentile onto games in place. */
  async enrich(games: RawGame[]): Promise<void> {
    if (games.length === 0) return;
    await this.ensureFresh();
    for (const game of games) {
      for (const side of [game.home, game.away]) {
        side.strength = this.byAbbrev.get(side.abbrev) ?? null;
      }
    }
  }
}
