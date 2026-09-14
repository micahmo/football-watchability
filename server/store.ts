/**
 * Tracks recent win-probability movement per game.
 *
 * A game that has swung hard in the last few minutes is worth flipping to even
 * if it looks settled at this instant, so a short rolling history is kept and the
 * span it covers is what counts as movement.
 *
 * It measures the **range**, high-water to low-water, rather than the sum of every
 * step between samples. Summing steps makes the answer depend on how often the
 * samples are taken, which stopped being a constant the moment the push feed
 * replaced a thirty-second poll: the same two games read 0.81 and 0.97 on a server
 * that had been sampling for forty minutes and 0.06 and 0.12 on one five minutes
 * old. Both were 0-0. What the sum actually measured was a close game whose win
 * probability wanders every play, which is why a 0-13 blowout scored zero, its
 * probability pinned and still. A range cannot be inflated by looking more often.
 */

interface Sample {
  t: number;
  wp: number;
}

const WINDOW_MS = 15 * 60 * 1000;
/** Ignore sub-noise jitter so a stalled drive does not read as volatility. */
const MIN_DELTA = 0.005;
const STALE_MS = 6 * 60 * 60 * 1000;

export class SwingStore {
  private history = new Map<string, Sample[]>();
  private lastSeen = new Map<string, number>();

  record(gameId: string, winProb: number | null, now = Date.now()): void {
    this.lastSeen.set(gameId, now);
    if (winProb === null) return;

    const samples = this.history.get(gameId) ?? [];
    const previous = samples[samples.length - 1];
    if (!previous || Math.abs(previous.wp - winProb) >= MIN_DELTA) {
      samples.push({ t: now, wp: winProb });
    }

    const cutoff = now - WINDOW_MS;
    while (samples.length > 1 && samples[0].t < cutoff) samples.shift();
    this.history.set(gameId, samples);
  }

  /**
   * How far win probability has travelled, end to end, inside the window.
   *
   * The window is applied here and not only in `record`, because `record` stops
   * being called the moment a game ends. Trimming on write alone meant the samples
   * froze at the final whistle and this returned that value for the next six hours,
   * until the staleness sweep removed the game entirely: a game that finished five
   * hours ago was still wearing `RECENT SWINGS`, and the rolling window was not
   * rolling at all once there was nothing left to roll it.
   */
  movement(gameId: string, now = Date.now()): number {
    const samples = this.history.get(gameId);
    if (!samples) return 0;
    const cutoff = now - WINDOW_MS;
    let low: number | null = null;
    let high: number | null = null;
    let seen = 0;
    for (const sample of samples) {
      if (sample.t < cutoff) continue;
      seen += 1;
      if (low === null || sample.wp < low) low = sample.wp;
      if (high === null || sample.wp > high) high = sample.wp;
    }
    if (seen < 2 || low === null || high === null) return 0;
    return high - low;
  }

  prune(now = Date.now()): void {
    for (const [id, seen] of this.lastSeen) {
      if (now - seen > STALE_MS) {
        this.lastSeen.delete(id);
        this.history.delete(id);
      }
    }
  }
}
