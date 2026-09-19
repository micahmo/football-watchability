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
  import { REASONS, reportKey, sendReport, setReportKey, type Verdict } from "./reports.svelte";

  let {
    game,
    shown,
    onclose,
  }: { game: Game; shown: number; onclose?: () => void } = $props();

  let chosen = $state<string[]>([]);
  let note = $state("");
  let keyDraft = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);
  let done = $state(false);

  const needsKey = $derived(reportKey() === null);
  const matchup = $derived(`${game.away.name} at ${game.home.name}`);

  function toggle(reason: string): void {
    chosen = chosen.includes(reason)
      ? chosen.filter((r) => r !== reason)
      : [...chosen, reason];
  }

  async function submit(verdict: Verdict): Promise<void> {
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
  onclick={(e) => e.target === e.currentTarget && onclose?.()}
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
          bind:value={keyDraft}
          onkeydown={(e) => e.key === "Enter" && setReportKey(keyDraft)}
        />
        <button type="button" class="save" onclick={() => setReportKey(keyDraft)}>Save</button>
      </div>
    {:else if done}
      <p class="hint ok">Recorded.</p>
    {:else}
      <div class="verdicts">
        <button type="button" class="v up" disabled={busy} onclick={() => submit("higher")}>
          Should be higher
        </button>
        <button type="button" class="v ok" disabled={busy} onclick={() => submit("right")}>
          Just right
        </button>
        <button type="button" class="v down" disabled={busy} onclick={() => submit("lower")}>
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
      {#if error}<p class="hint err">{error}</p>{/if}
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
  }
  /* A sheet from the bottom rather than a centred box: this is reached by
     pressing a card with a thumb, and the thumb is already down there. */
  .sheet {
    width: 100%;
    max-width: 520px;
    background: var(--bg-card);
    border: 1px solid var(--border-hi);
    border-radius: 14px 14px 0 0;
    padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
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
  .v.up:hover { border-color: var(--hot); color: var(--hot); }
  .v.ok:hover { border-color: var(--good); color: var(--good); }
  .v.down:hover { border-color: var(--cool); color: var(--cool); }
  .v:disabled { opacity: 0.5; cursor: default; }
  .hint {
    margin: 14px 0 6px;
    font-size: 12px;
    color: var(--text-faint);
  }
  .hint.ok { color: var(--good); }
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
