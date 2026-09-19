<script lang="ts">
  /*
   * Where a verdict on a rating is given.
   *
   * Three buttons and nothing required beyond them. The reasons are optional
   * because not every reaction has one: "it was just exciting" is a real and
   * complete thought, and a form that insists on a category would either get a
   * wrong one or get nothing.
   *
   * Deliberately no field for what the rating should have been. Asked for, and
   * rejected: "it's not a calculator so i can't determine what I think it should
   * be, just that it should be higher or lower". Quite right, and a number
   * invented to satisfy a form is worse than no number.
   */
  import type { Game } from "../../shared/types";
  import { relativeTime } from "./format";
  import {
    forgetReportKey,
    REASONS,
    reportKey,
    sendReport,
    setReportKey,
    standingReport,
    type StandingReport,
    type Verdict,
  } from "./reports.svelte";

  let {
    game,
    shown,
    onclose,
  }: { game: Game; shown: number; onclose?: () => void } = $props();

  let verdict = $state<Verdict | null>(null);
  let chosen = $state<string[]>([]);
  let note = $state("");
  let keyDraft = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);
  let done = $state(false);

  const needsKey = $derived(reportKey() === null);
  /* A game that is not live holds one verdict per person, so opening the sheet on
     one already reported should show what was said, not a blank form that will
     quietly overwrite it. A live game accumulates instead: every report is a
     different moment, nothing is replaced, so there is nothing to fetch. */
  const fixed = $derived(game.state !== "in");
  let prior = $state<StandingReport | null>(null);
  let priorLoaded = $state(false);

  $effect(() => {
    if (needsKey || !fixed || priorLoaded) return;
    priorLoaded = true;
    void standingReport(game.id).then((found) => {
      if (found === null) return;
      prior = found;
      verdict = found.verdict;
      chosen = [...found.reasons];
      note = found.note ?? "";
    });
  });

  async function saveKey(): Promise<void> {
    busy = true;
    error = null;
    const result = await setReportKey(keyDraft);
    busy = false;
    if (result.ok) keyDraft = "";
    else error = result.error ?? "that did not work";
  }
  const matchup = $derived(`${game.away.name} at ${game.home.name}`);

  /*
   * Whether there is anything to lose by closing.
   *
   * Not simply "is anything filled in": a game already reported opens with the
   * standing verdict in place, and being asked to confirm closing something you
   * have not touched is noise. The test is whether the sheet now says something
   * different from what is already stored.
   */
  const dirty = $derived.by(() => {
    const typed = note.trim();
    const was = prior;
    if (was === null) return verdict !== null || chosen.length > 0 || typed.length > 0;
    return (
      verdict !== was.verdict ||
      typed !== (was.note ?? "").trim() ||
      chosen.length !== was.reasons.length ||
      chosen.some((reason) => !was.reasons.includes(reason))
    );
  });
  let confirming = $state(false);

  /*
   * Tapping the scrim is easy to do by accident: tapping a chip dismisses the
   * keyboard, the sheet changes height under the thumb, and the next tap lands
   * outside it. Losing typed feedback to that is worse than one extra tap.
   */
  function dismiss(): void {
    if (dirty && !done) confirming = true;
    else onclose?.();
  }

  function toggle(reason: string): void {
    chosen = chosen.includes(reason)
      ? chosen.filter((r) => r !== reason)
      : [...chosen, reason];
  }

  async function submit(): Promise<void> {
    if (verdict === null) return;
    busy = true;
    error = null;
    const result = await sendReport(game, verdict, chosen, note, shown);
    busy = false;
    if (result.ok) {
      done = true;
      setTimeout(() => onclose?.(), 700);
    } else {
      error = result.error;
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="scrim"
  role="presentation"
  onclick={(e) => e.target === e.currentTarget && dismiss()}
>
  <div class="sheet" role="dialog" aria-modal="true" aria-label="Report this rating">
    <p class="head">
      <span class="what">{matchup}</span>
      <span class="rated">rated {Math.round(shown)}</span>
    </p>

    {#if needsKey}
      <p class="hint">This needs the reporting key.</p>
      <div class="keyrow">
        <input
          type="password"
          placeholder="key"
          disabled={busy}
          bind:value={keyDraft}
          onkeydown={(e) => e.key === "Enter" && void saveKey()}
        />
        <button type="button" class="save" disabled={busy} onclick={() => void saveKey()}>
          {busy ? "Checking" : "Save"}
        </button>
      </div>
      {#if error}<p class="hint err">{error}</p>{/if}
    {:else if done}
      <p class="hint ok">Recorded.</p>
    {:else}
      {#if prior !== null}
        <p class="hint prior">
          You said {prior.verdict === "right" ? "just right" : `should be ${prior.verdict}`}
          {relativeTime(prior.at)}{prior.shown === null ? "" : `, at ${Math.round(prior.shown)}`}.
          Sending replaces it.
        </p>
      {/if}

      <!-- The verdict is picked, not sent. Tapping one used to submit and close,
           which meant the optional fields below it were never reached. -->
      <div class="verdicts">
        <button
          type="button"
          class="v up"
          class:on={verdict === "higher"}
          onclick={() => (verdict = "higher")}
        >
          Should be higher
        </button>
        <button
          type="button"
          class="v ok"
          class:on={verdict === "right"}
          onclick={() => (verdict = "right")}
        >
          Just right
        </button>
        <button
          type="button"
          class="v down"
          class:on={verdict === "lower"}
          onclick={() => (verdict = "lower")}
        >
          Should be lower
        </button>
      </div>

      <p class="hint">Why, if you can say. Optional.</p>
      <div class="reasons">
        {#each REASONS as reason (reason)}
          <button
            type="button"
            class="chip"
            class:on={chosen.includes(reason)}
            onclick={() => toggle(reason)}
          >
            {reason}
          </button>
        {/each}
      </div>
      <input class="note" type="text" placeholder="anything else" bind:value={note} />

      {#if confirming}
        <p class="hint">Close without sending? What you have entered is lost.</p>
        <div class="confirm">
          <button type="button" class="v keep" onclick={() => (confirming = false)}>
            Keep editing
          </button>
          <button type="button" class="v discard" onclick={() => onclose?.()}>Discard</button>
        </div>
      {:else}
        <button
          type="button"
          class="send"
          disabled={busy || verdict === null}
          onclick={() => void submit()}
        >
          {busy ? "Sending" : prior === null ? "Send" : "Replace"}
        </button>
      {/if}
      {#if error}<p class="hint err">{error}</p>{/if}
      <!-- Always reachable. A stored key that has stopped working, or was never
           right, otherwise leaves the sheet with no way out of itself. -->
      <button type="button" class="forget" onclick={() => forgetReportKey()}>Use a different key</button>
    {/if}
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(5, 7, 11, 0.6);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    /* Clears the home indicator, and keeps the sheet off the display's own curved
       corners. */
    padding: 10px calc(10px + env(safe-area-inset-left)) calc(10px + env(safe-area-inset-bottom))
      calc(10px + env(safe-area-inset-right));
  }
  /*
   * Floating near the bottom rather than welded to it.
   *
   * Anchored flush, its square bottom corners sat inside the phone's own rounded
   * ones, and the two radii disagreeing reads as a mistake. Rounded on all four
   * and inset from every edge sidesteps the question: there is no shared edge for
   * the radii to disagree about, and the home indicator gets its strip back. It
   * still sits low, because this is reached by pressing a card with a thumb and
   * the thumb is already down there.
   */
  .sheet {
    width: 100%;
    max-width: 520px;
    background: var(--bg-card);
    border: 1px solid var(--border-hi);
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 12px 34px rgba(0, 0, 0, 0.45);
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin: 0 0 12px;
  }
  .what {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
  }
  .rated {
    font-size: 12px;
    color: var(--text-faint);
    flex: none;
  }
  .verdicts {
    display: grid;
    gap: 8px;
  }
  .v {
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    padding: 11px;
    border-radius: 9px;
    border: 1px solid var(--border-hi);
    background: var(--bg-raised);
    color: var(--text);
    cursor: pointer;
  }
  .v.up:hover, .v.up.on { border-color: var(--hot); color: var(--hot); }
  .v.ok:hover, .v.ok.on { border-color: var(--good); color: var(--good); }
  .v.down:hover, .v.down.on { border-color: var(--cool); color: var(--cool); }
  .v.on { background: var(--bg-raised); box-shadow: inset 0 0 0 1px currentColor; }
  .send {
    width: 100%;
    margin-top: 16px;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    padding: 11px;
    border-radius: 9px;
    border: none;
    background: var(--text);
    color: var(--bg);
    cursor: pointer;
  }
  .send:disabled { opacity: 0.35; cursor: default; }
  .confirm {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .v.discard:hover { border-color: var(--hot); color: var(--hot); }
  .hint {
    margin: 14px 0 6px;
    font-size: 12px;
    color: var(--text-faint);
  }
  .hint.ok { color: var(--good); }
  .hint.prior { margin-top: 0; color: var(--text-dim); }
  .hint.err { color: var(--hot); }
  .reasons {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    font: inherit;
    font-size: 12px;
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid var(--border-hi);
    background: none;
    color: var(--text-dim);
    cursor: pointer;
  }
  .chip.on {
    color: var(--bg);
    background: var(--text-dim);
    border-color: var(--text-dim);
  }
  .note,
  .keyrow input {
    width: 100%;
    margin-top: 10px;
    font: inherit;
    font-size: 13px;
    padding: 9px 11px;
    border-radius: 8px;
    border: 1px solid var(--border-hi);
    background: var(--bg);
    color: var(--text);
  }
  .keyrow {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .keyrow input { margin-top: 0; }
  .forget {
    margin-top: 12px;
    font: inherit;
    font-size: 11px;
    padding: 0;
    border: none;
    background: none;
    color: var(--text-faint);
    text-decoration: underline;
    cursor: pointer;
  }
  .save {
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 9px 14px;
    border-radius: 8px;
    border: 1px solid var(--border-hi);
    background: var(--bg-raised);
    color: var(--text);
    cursor: pointer;
    flex: none;
  }
</style>
