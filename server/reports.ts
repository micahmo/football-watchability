import fs from "node:fs";
import path from "node:path";
import type { Game, League, ScoreComponents, Snapshot } from "../shared/types.js";
import { tuningStamp } from "./scoring.js";

/** Every component plus the derived numbers, as the snapshot carries them. */
type ScoreBreakdownLike = ScoreComponents & {
  total: number;
  maxTotal: number | null;
  hasWinProb: boolean;
};

/**
 * What the viewer thought of a rating, with everything needed to re-examine it.
 *
 * A verdict on its own decays into folklore within a week: "Clemson should have
 * been higher" cannot be checked against anything, because the thing that has to
 * be checked is which term was wrong, and that is gone the moment the game moves
 * on. So a report carries the whole situation at the instant it was made.
 *
 * `shown` and `total` are both recorded and are not the same number. The board
 * runs a broadcast delay, so what was on screen describes a moment already past,
 * and the favourite bonus is applied in the browser. `shown` is what prompted the
 * verdict; `total` is what the server had. Where they disagree, the verdict is
 * about `shown`.
 */
export interface Report {
  at: string;
  league: League;
  gameId: string;
  matchup: string;
  verdict: "higher" | "lower" | "right";
  /**
   * Who gave the verdict, or null when the key it came in under has no name.
   *
   * Without this, a second person's verdict on a game that has not kicked off
   * silently overwrites the first person's, since a fixed game keeps one report.
   * It is also what keeps the corpus readable: a disagreement between two people
   * is not the same fact as one person changing their mind.
   */
  reporter: string | null;
  /** Optional, and often empty: not every reaction has a reason attached. */
  reasons: string[];
  note: string | null;
  /** The rating the browser was displaying when the verdict was given. */
  shown: number | null;
  state: string;
  period: number;
  clock: string;
  score: string;
  spread: number | null;
  winProb: number | null;
  /** The server's own rating and every component behind it. */
  total: number | null;
  anticipation: number | null;
  components: ScoreBreakdownLike | null;
  /**
   * What else was on at the time, rated.
   *
   * Most of these verdicts are really orderings: "this should be above that".
   * Without the rest of the board that judgement cannot be recovered, and it is
   * the more useful half of the report.
   */
  alongside: { matchup: string; total: number }[];
  /**
   * Which model was being judged.
   *
   * A verdict is about the numbers a particular set of constants produced. Move
   * any of them and the verdict is not wrong, it is unanswered: the change may
   * already have addressed it. Comparing this against the current stamp is how
   * that is noticed rather than assumed.
   */
  model: string;
  /**
   * When this was looked at, and what came of it. Null until then.
   *
   * Reviewing is not the same as acting. Most reports should end up reviewed with
   * an outcome saying the board was right, or that it was real but too rare to
   * chase, and only some with a change behind them.
   */
  reviewedAt: string | null;
  outcome: string | null;
}

/** Bounded so a stuck client cannot fill the disk. Oldest go first. */
const MAX_REPORTS = 2000;
const FILE = "reports.json";

export class ReportStore {
  private dir: string | null;
  private reports: Report[] = [];

  constructor(dir: string | undefined) {
    this.dir = typeof dir === "string" && dir.length > 0 ? dir : null;
    if (this.dir === null) {
      console.log("[reports] disabled: no directory configured");
      return;
    }
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      this.reports = this.load();
      console.log(`[reports] ${this.reports.length} stored in ${this.file}`);
    } catch (err) {
      console.error(`[reports] disabled: ${err instanceof Error ? err.message : err}`);
      this.dir = null;
    }
  }

  get available(): boolean {
    return this.dir !== null;
  }

  get all(): Report[] {
    return this.reports;
  }

  private get file(): string {
    return path.join(path.resolve(this.dir as string), FILE);
  }

  private load(): Report[] {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, "utf8"));
      return Array.isArray(parsed) ? (parsed as Report[]) : [];
    } catch {
      return [];
    }
  }

  /**
   * Records a verdict, taking the context from the snapshot rather than from the
   * browser, which is only trusted for what it was showing.
   *
   * A game that has kicked off collects a report every time one is given: the
   * conditions it is being judged against change every minute, so two verdicts
   * an hour apart are two observations and not a correction. A game that has not
   * started, or has finished, is a fixed thing, so a later verdict replaces the
   * earlier one.
   */
  record(
    input: { league: League; gameId: string; verdict: Report["verdict"]; reasons: string[]; note: string | null; shown: number | null; reporter: string | null },
    snapshot: Snapshot | null,
  ): Report | null {
    if (this.dir === null) return null;
    const pools = snapshot === null ? [] : [snapshot.live, snapshot.upcoming, snapshot.recent];
    const game = pools.flat().find((g: Game) => g.id === input.gameId) ?? null;
    if (game === null) return null;

    const live = game.state === "in";
    const report: Report = {
      at: new Date().toISOString(),
      league: input.league,
      gameId: input.gameId,
      matchup: `${game.away.abbrev}@${game.home.abbrev}`,
      reporter: input.reporter,
      verdict: input.verdict,
      reasons: input.reasons,
      note: input.note,
      shown: input.shown,
      state: game.state,
      period: game.period,
      clock: game.clock,
      score: `${game.away.score}-${game.home.score}`,
      spread: game.pregameSpread,
      winProb: game.homeWinProb,
      total: game.score?.total ?? null,
      anticipation: game.anticipation ?? null,
      components: game.score === null || game.score === undefined ? null : { ...game.score },
      alongside: (snapshot?.live ?? [])
        .filter((g) => g.id !== game.id && g.score)
        .map((g) => ({ matchup: `${g.away.abbrev}@${g.home.abbrev}`, total: g.score!.total }))
        .sort((a, b) => b.total - a.total),
      model: tuningStamp(),
      reviewedAt: null,
      outcome: null,
    };

    // Scoped to the reporter as well as the game: replacing is a person
    // correcting themselves, never one person overwriting another.
    this.reports = live
      ? [...this.reports, report]
      : [
          ...this.reports.filter(
            (r) => r.gameId !== report.gameId || (r.reporter ?? null) !== report.reporter,
          ),
          report,
        ];
    if (this.reports.length > MAX_REPORTS) {
      this.reports = this.reports.slice(this.reports.length - MAX_REPORTS);
    }
    this.persist();
    console.log(
      `[reports] ${report.reporter ?? "someone"}: ${report.matchup} ${report.verdict}` +
        `${report.reasons.length ? " (" + report.reasons.join(", ") + ")" : ""}` +
        ` at ${report.shown ?? "?"}, server had ${report.total ?? report.anticipation ?? "?"}`,
    );
    return report;
  }

  /**
   * This reporter's standing verdict on a game, if they have given one.
   *
   * Only meaningful for a game that is not live: a live game collects a report
   * every time one is given, because each is a different moment and none of them
   * replaces another, so there is no single thing to hand back.
   */
  mine(gameId: string, reporter: string | null): Report | null {
    const mine = this.reports.filter(
      (r) => r.gameId === gameId && (r.reporter ?? null) === reporter,
    );
    return mine.length === 0 ? null : mine[mine.length - 1];
  }

  /**
   * Marks reports as looked at. Unreviewed ones are the working set.
   */
  review(ids: string[], outcome: string): number {
    if (this.dir === null) return 0;
    const wanted = new Set(ids);
    let touched = 0;
    for (const report of this.reports) {
      if (!wanted.has(report.at)) continue;
      report.reviewedAt = new Date().toISOString();
      report.outcome = outcome;
      touched += 1;
    }
    if (touched > 0) this.persist();
    return touched;
  }

  /** The stamp the board is producing now, for comparing against a report's. */
  get model(): string {
    return tuningStamp();
  }

  private persist(): void {
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.reports, null, 2));
    } catch (err) {
      console.error(`[reports] could not save: ${err instanceof Error ? err.message : err}`);
    }
  }
}
