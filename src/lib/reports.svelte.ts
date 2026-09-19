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

export function setReportKey(value: string): void {
  key = value.trim().length > 0 ? value.trim() : null;
  try {
    if (key === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, key);
  } catch {
    // A private window can still report; it just has to be asked again.
  }
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
    if (res.status === 401) return { ok: false, error: "that key was not accepted" };
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: body?.error ?? `failed (${res.status})` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "could not reach the server" };
  }
}
