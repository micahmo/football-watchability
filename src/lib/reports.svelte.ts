import type { Game } from "../../shared/types";

const KEY = "football-watchability-report-key";

/**
 * The key that lets a verdict be recorded, kept per browser.
 *
 * The board is a public URL and this is the one dataset that decides whether the
 * model is any good, so it is not open to whoever finds the page. Asked for once,
 * then remembered.
 */
let key = $state<string | null>(read());

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function reportKey(): string | null {
  return key;
}

function store(value: string | null): void {
  key = value;
  try {
    if (key === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, key);
  } catch {
    // A private window can still report; it just has to be asked again.
  }
}

/**
 * Takes a key only if the server accepts it. Storing first and finding out at
 * submit time left a wrong key wedged in the browser with nothing to clear it.
 */
export async function setReportKey(
  value: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const candidate = value.trim();
  if (candidate.length === 0) return { ok: false, error: "enter a key" };
  try {
    const res = await fetch("/api/reports?check=1", {
      headers: { "x-report-key": candidate },
    });
    if (res.status === 401) return { ok: false, error: "that key was not accepted" };
    if (res.status === 503) {
      return { ok: false, error: "reporting is not enabled on the server" };
    }
    if (!res.ok) return { ok: false, error: `could not check (${res.status})` };
  } catch {
    return { ok: false, error: "could not reach the server" };
  }
  store(candidate);
  return { ok: true };
}

export function forgetReportKey(): void {
  store(null);
}

export const REASONS = [
  "close",
  "exciting",
  "late drama",
  "comeback",
  "big teams",
  "my team",
  "blowout",
  "dull",
] as const;

export type Verdict = "higher" | "lower" | "right";

/**
 * Sends a verdict. `shown` is the number that was actually on screen, which the
 * server cannot work out for itself: the board runs a broadcast delay and adds
 * the favourite bonus in the browser.
 */
export async function sendReport(
  game: Game,
  verdict: Verdict,
  reasons: string[],
  note: string,
  shown: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (key === null) return { ok: false, error: "no key" };
  try {
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json", "x-report-key": key },
      body: JSON.stringify({
        league: game.league,
        gameId: game.id,
        verdict,
        reasons,
        note,
        shown,
      }),
    });
    /* A key that has stopped working is worse than none, because the sheet would
       go on offering buttons that cannot do anything. Drop it and ask again. */
    if (res.status === 401) {
      store(null);
      return { ok: false, error: "that key was not accepted" };
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: body?.error ?? `failed (${res.status})` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "could not reach the server" };
  }
}
