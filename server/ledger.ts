import fs from "node:fs";
import path from "node:path";
import type { RawGame } from "./espn.js";
import type { PregameLine } from "./lines.js";
import type { TeamSide } from "../shared/types.js";

/**
 * What a game is scored against once it has started, fixed and kept on disk.
 *
 * A finished game's rating should be a fact about the game. On the 2026-09-26
 * slate it was not: half the finished games changed rating after the final
 * whistle with nothing about the game changing, for four separate reasons, and
 * each one is a piece of state this ledger now holds.
 *
 * - The closing line. The line cache kept the *first* line it saw, days before
 *   kickoff, so Wake at Louisville was scored all game at -13.5 when it closed at
 *   -11.5. The line is now overwritten on every sighting while the game is still
 *   pregame, and frozen at kickoff.
 * - The teams as they came into the game. NFL standings move when the game ends,
 *   and again as the rest of the slate finishes, so Atlanta at Green Bay lost a
 *   tenth of its prominence 25 minutes after its own final. College ranks move
 *   with Sunday's poll. Rank, win percentage and seed are frozen at kickoff.
 * - Swing at the final whistle. `swing` is a rolling fifteen-minute window, so
 *   after the final it drained to zero and took up to eight points with it.
 * - All three survive a restart. The in-memory line cache did not, so every
 *   restart blanked the recap's upset term for a few minutes and then refetched a
 *   line that could differ from the one the game had been scored on.
 *
 * Best effort: without a directory it runs in memory, which is what development
 * has always had.
 */

/** The parts of a team that move between games and feed the rating. */
export interface TeamContext {
  rank: number | null;
  winPct: number | null;
  playoffSeed: number | null;
}

interface Entry {
  /** Last time anything looked at this game, for pruning. */
  touched: number;
  line: PregameLine | null;
  home: TeamContext | null;
  away: TeamContext | null;
  /** Once true, the line and the teams are fixed. */
  kickedOff: boolean;
  /** Win-probability range at the final whistle; absent until it has finished. */
  finalSwing: number | null;
}

/** Far longer than any game stays on the board. */
const KEEP_MS = 21 * 24 * 60 * 60 * 1000;
const SAVE_DELAY_MS = 5000;

function contextOf(side: TeamSide): TeamContext {
  return { rank: side.rank, winPct: side.winPct, playoffSeed: side.playoffSeed };
}

export class GameLedger {
  private entries = new Map<string, Entry>();
  /** Games already tried and found unpriced, so the summary is not asked again. */
  private unavailable = new Set<string>();
  private readonly file: string | null;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(dir: string | undefined, name: string) {
    this.file = dir ? path.join(dir, `ledger-${name}.json`) : null;
    if (this.file === null) return;
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, "utf8"));
      const cutoff = Date.now() - KEEP_MS;
      for (const [id, entry] of Object.entries<Entry>(raw)) {
        if (entry && entry.touched > cutoff) this.entries.set(id, entry);
      }
      console.log(`[ledger] ${this.entries.size} ${name} games from ${this.file}`);
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        console.error(`[ledger] could not read ${this.file}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  private entry(id: string): Entry {
    let entry = this.entries.get(id);
    if (entry === undefined) {
      entry = { touched: 0, line: null, home: null, away: null, kickedOff: false, finalSwing: null };
      this.entries.set(id, entry);
    }
    entry.touched = Date.now();
    return entry;
  }

  /**
   * Takes in a sighting of a game from any source.
   *
   * Pregame, everything is overwritten, so what is held at kickoff is the last
   * thing seen before it: the closing line and the teams as they came in. After
   * kickoff only gaps are filled, which covers a game that started before this
   * process first saw it. For an NFL game first seen already finished, that means
   * standings which include its own result: the best there is, and it is then at
   * least the same number every time.
   */
  observe(game: RawGame): void {
    const entry = this.entry(game.id);
    const before = JSON.stringify([entry.kickedOff, entry.line, entry.home, entry.away]);
    const pregame = game.state === "pre" && !entry.kickedOff;
    if (!pregame) entry.kickedOff = true;

    if (game.spread !== null && (pregame || entry.line === null)) {
      entry.line = {
        homeSpread: game.homeSpread ?? game.spread,
        overUnder: game.overUnder,
        details: game.odds,
      };
      this.unavailable.delete(game.id);
    }
    if (pregame || entry.home === null) entry.home = contextOf(game.home);
    if (pregame || entry.away === null) entry.away = contextOf(game.away);
    // Every poll and every push lands here, and almost none of them change anything.
    if (JSON.stringify([entry.kickedOff, entry.line, entry.home, entry.away]) !== before) {
      this.scheduleSave();
    }
  }

  line(id: string): PregameLine | null {
    return this.entries.get(id)?.line ?? null;
  }

  /** True once there is either a line or a settled answer that there is none. */
  isResolved(id: string): boolean {
    return this.line(id) !== null || this.unavailable.has(id);
  }

  markUnavailable(id: string): void {
    this.unavailable.add(id);
  }

  /** A line from the summary, for a game that was never seen pregame. */
  recordLine(id: string, line: PregameLine): void {
    const entry = this.entry(id);
    entry.line = line;
    this.unavailable.delete(id);
    this.scheduleSave();
  }

  /** The game with its teams as they were at kickoff. Pregame games pass through. */
  asAtKickoff<T extends RawGame>(game: T): T {
    const entry = this.entries.get(game.id);
    if (entry === undefined || !entry.kickedOff) return game;
    return {
      ...game,
      home: entry.home ? { ...game.home, ...entry.home } : game.home,
      away: entry.away ? { ...game.away, ...entry.away } : game.away,
    };
  }

  /**
   * Swing at the final whistle, fixed the first time the game is seen finished.
   *
   * `current` is the live window's reading at that moment. A game that finished
   * while this process was down has an empty window and so keeps zero, which is
   * what every finished game read before this, once the window had drained.
   */
  finalSwing(id: string, current: number): number {
    const entry = this.entry(id);
    if (entry.finalSwing === null) {
      entry.finalSwing = current;
      this.scheduleSave();
    }
    return entry.finalSwing;
  }

  private scheduleSave(): void {
    if (this.file === null || this.saveTimer !== null) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, SAVE_DELAY_MS);
    this.saveTimer.unref?.();
  }

  private save(): void {
    if (this.file === null) return;
    const cutoff = Date.now() - KEEP_MS;
    for (const [id, entry] of this.entries) {
      if (entry.touched < cutoff) this.entries.delete(id);
    }
    try {
      // Written aside and renamed, so a crash mid-write cannot leave half a file.
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.entries)));
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error(`[ledger] could not save: ${err instanceof Error ? err.message : err}`);
    }
  }
}
