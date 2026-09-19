import type { TeamSide } from "../../shared/types";

/** Perceived brightness, used to keep near-black team colors readable on a dark card. */
function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 0.5;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function teamColor(team: TeamSide): string {
  const primary = `#${team.color.replace("#", "")}`;
  if (luminance(primary) > 0.12) return primary;
  const alt = `#${team.altColor.replace("#", "")}`;
  return luminance(alt) > 0.12 ? alt : "#7c8aa5";
}

export function scoreColor(total: number): string {
  if (total >= 78) return "var(--hot)";
  if (total >= 58) return "var(--warm)";
  if (total >= 35) return "var(--cool)";
  return "var(--calm)";
}

export function kickoffTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function kickoffDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? "Today" : d.toLocaleDateString([], { weekday: "short" });
}

/**
 * When a game was played, for the recap.
 *
 * ESPN publishes no end time, only a start and a `Final` status, so a finished
 * card says when the game kicked off rather than when it ended. The day is only
 * shown when it is not today, since the recap reaches back eighteen hours and
 * most of what it holds is from this afternoon.
 */
export function kickoffWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? kickoffTime(iso) : `${kickoffDay(iso)} ${kickoffTime(iso)}`;
}

export function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "never";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export function ordinalPeriod(period: number): string {
  if (period > 4) return period === 5 ? "OT" : `${period - 4}OT`;
  return ["", "1st", "2nd", "3rd", "4th"][period] ?? "";
}

/**
 * Perceptual-ish distance between two hex colors, 0..1.
 *
 * Plenty of matchups are dark red against dark red (SMU at Florida State being
 * the one that prompted this), and a two-tone bar is useless when the two tones
 * are the same tone.
 */
export function colorDistance(a: string, b: string): number {
  const parse = (hex: string) => {
    const c = hex.replace("#", "");
    return [
      parseInt(c.slice(0, 2), 16) || 0,
      parseInt(c.slice(2, 4), 16) || 0,
      parseInt(c.slice(4, 6), 16) || 0,
    ];
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const rMean = (r1 + r2) / 2;
  // Low-cost approximation of CIE94 that weights channels by eye sensitivity.
  const weighted =
    (2 + rMean / 256) * (r1 - r2) ** 2 +
    4 * (g1 - g2) ** 2 +
    (2 + (255 - rMean) / 256) * (b1 - b2) ** 2;
  return Math.min(1, Math.sqrt(weighted) / 764);
}

const SIMILAR_THRESHOLD = 0.22;

export function colorsTooSimilar(a: string, b: string): boolean {
  return colorDistance(a, b) < SIMILAR_THRESHOLD;
}

/** Local calendar day key, so grouping matches the viewer's timezone. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "long" });
}

export function dayDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/**
 * Human clock label for a live game.
 *
 * "0:00 2nd" is technically accurate and reads as a stopped clock rather than as
 * halftime, so the break states get named explicitly. ESPN's status name is the
 * reliable signal; the clock check is a fallback for feeds that do not set it.
 */
export function clockLabel(game: {
  period: number;
  clock: string;
  clockSeconds: number;
  statusName: string;
}): string {
  const atBreak = game.clockSeconds === 0;

  if (game.statusName === "STATUS_HALFTIME" || (atBreak && game.period === 2)) {
    return "Halftime";
  }
  if (game.statusName === "STATUS_DELAYED") return "Delayed";
  if (atBreak && game.period > 0 && game.period <= 4) {
    return `End of ${ordinalPeriod(game.period)}`;
  }
  // College overtime has no game clock, so ESPN reports 0:00 throughout it.
  if (game.period > 4) return ordinalPeriod(game.period);
  return `${game.clock} ${ordinalPeriod(game.period)}`;
}

/**
 * Whether a record says anything yet.
 *
 * "0-0" is not a standing, it is the absence of one, and in week one it is every
 * team in the league. Printing it puts a column of noise beside thirty-two names
 * and teaches the eye to skip the place a real record will appear next week.
 */
export function hasRecord(record: string | null | undefined): boolean {
  if (!record) return false;
  return /[1-9]/.test(record);
}


/**
 * The kickoff window a game belongs to, as an Eastern-time hour.
 *
 * Eastern because that is the calendar the NFL windows are actually set on, and
 * an hour because 4:05 and 4:25 are one window to everybody who watches them.
 * The same bucketing the server uses to spot a regional split.
 */
export function easternHour(startDate: string): string | null {
  const at = Date.parse(startDate);
  if (!Number.isFinite(at)) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date(at));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}`;
}

/**
 * Whether a day's kickoffs form windows worth grouping by, measured rather than
 * assumed about a league.
 *
 * A Sunday NFL slate falls into three: 1:00 with eight games, 4:00 with five and
 * one at 8:20. A Saturday in college is not windowed at all, it is a continuous
 * smear of eleven distinct kickoff hours between 11:00 and 23:00, and grouping it
 * would produce eleven headings, several of them over a single game.
 *
 * So the test is on the shape of the day: a handful of windows, each holding
 * several games. College fails it on its own data rather than on its name, which
 * means a college day that ever does look like this gets the grouping too.
 */
const MAX_WINDOWS = 4;
const MIN_PER_WINDOW = 2;

export function windowsOf<T extends { startDate: string }>(games: T[]): Map<string, T[]> | null {
  const by = new Map<string, T[]>();
  for (const game of games) {
    const hour = easternHour(game.startDate);
    if (hour === null) return null;
    const bucket = by.get(hour);
    if (bucket) bucket.push(game);
    else by.set(hour, [game]);
  }
  if (by.size < 2 || by.size > MAX_WINDOWS) return null;
  if (games.length / by.size < MIN_PER_WINDOW) return null;
  return by;
}

/**
 * What to call each kickoff window.
 *
 * The broadcast names, where broadcast names exist. A Sunday slate is the early
 * window and the late window, which is what the networks, the listings and
 * everybody watching call them, and the 8:20 game is primetime.
 *
 * Deliberately not "early afternoon" or "evening". Those are claims about a clock
 * and they are false outside Eastern: the early window kicks off at ten in the
 * morning in Los Angeles. "Early" and "late" describe position within the day's
 * slate rather than time of day, so they survive the translation, and every row
 * states its own local kickoff underneath anyway.
 *
 * Any day that does not fall into this shape keeps plain times, so nothing is
 * given a name that does not fit it. Two windows that would take the same name
 * means the guess was wrong about the whole day, and it falls back wholesale.
 */
export function windowLabels(hours: string[]): string[] {
  const at = hours.map((hour) => Number(hour.slice(-2)));
  if (at.some((hour) => !Number.isFinite(hour))) return [];
  // A London kickoff is half past nine in New York and half past six in Los
  // Angeles, so it is morning wherever it is watched. Without it a week with an
  // international game had two afternoon windows called "Late" and gave up.
  const firstAfternoon = at.findIndex((hour) => hour >= 12 && hour < 19);
  const named = at.map((hour, index) => {
    if (hour < 12) return "Morning";
    if (hour >= 19) return "Primetime";
    return index === firstAfternoon ? "Early" : "Late";
  });
  return new Set(named).size === named.length ? named : [];
}

/**
 * A time heading for a window that has no name, covering every game under it.
 *
 * A single time only when every kickoff in the window really is that time. The
 * alternative was the window's earliest, which put "4:05 PM" above a 4:25 game
 * and made the heading look like it belonged to the row below it. Where they
 * differ the heading says so, and the shared meridiem is not repeated.
 */
export function windowTimeLabel(startDates: string[]): string {
  const times = [...startDates]
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .map((date) => kickoffTime(date));
  const first = times[0] ?? "";
  const last = times[times.length - 1] ?? "";
  if (first === last) return first;
  const [open, openSuffix] = first.split(" ");
  const [, closeSuffix] = last.split(" ");
  return openSuffix === closeSuffix ? `${open} - ${last}` : `${first} - ${last}`;
}

/**
 * A break where the next play starts a fresh possession, so the situation still
 * on screen is no longer true.
 *
 * ESPN clears `possessionTeamId` at halftime but leaves `yardLine`, `down`,
 * `distance` and `driveStart` frozen on the last play of the half. Houston at
 * Texas Tech sat through the interval showing a ball on the goal line and
 * "2nd & 10 at HOU 2", which had been true twenty minutes earlier.
 *
 * The end of the first and third quarters is deliberately not a break. That is a
 * change of ends, the same drive continues, and the down and distance carry over
 * and stay true, so blanking there would throw away something the viewer wants.
 */
export function betweenPossessions(game: {
  period: number;
  clockSeconds: number;
  statusName: string;
}): boolean {
  if (game.statusName === "STATUS_HALFTIME") return true;
  if (game.clockSeconds !== 0) return false;
  return game.period === 2 || game.period === 4;
}
