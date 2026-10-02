<script lang="ts">
  import type { League } from "../../shared/types";
  import { prefs, setLeague } from "./prefs.svelte";

  /** Which leagues have games on right now, for the dot. */
  let { live }: { live: Record<League, boolean> } = $props();

  /* Order here is the tab order. */
  const LABELS: Record<League, string> = { nfl: "NFL", cfb: "College" };
</script>

<nav class="tabs" aria-label="League">
  {#each Object.keys(LABELS) as league (league)}
    <button
      type="button"
      class:active={prefs.league === league}
      aria-current={prefs.league === league ? "page" : undefined}
      onclick={() => setLeague(league as League)}
    >
      {LABELS[league as League]}{#if live[league as League]}<span
          class="live"
          title="Games on now"
          aria-label="games on now"
        ></span>{/if}
    </button>
  {/each}
</nav>

<style>
  .tabs {
    display: flex;
    gap: 4px;
    /* No bottom margin: it inflated the top bar past the tabs' own height, which
       left the status text centered 7px below the tab labels it sits beside. The
       spacing below now comes from the controls row. */
  }
  .tabs button {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-faint);
    font: inherit;
    font-size: 15px;
    font-weight: 650;
    letter-spacing: -0.01em;
    padding: 4px 12px 7px;
    cursor: pointer;
  }
  @media (hover: hover) {
    .tabs button:hover {
      color: var(--text-dim);
    }
  }
  .tabs button.active {
    color: var(--text);
    border-bottom-color: var(--hot);
  }
  /* The cards' live dot, smaller and still: it marks where the football is, and
     a second pulse in the header would compete with the one on the hero card. */
  .live {
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-left: 5px;
    border-radius: 50%;
    background: var(--hot);
    vertical-align: 3px;
  }
</style>
