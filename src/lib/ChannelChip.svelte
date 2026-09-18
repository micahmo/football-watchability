<script lang="ts">
  import type { Game } from "../../shared/types";
  import { channelParts } from "../../shared/channel";

  let { game }: { game: Game } = $props();

  const parts = $derived(channelParts(game));
</script>

{#if parts}
  <span
    class="channel-chip"
    title={parts.outOfMarket ? "Not on your channels" : undefined}
  >
    {parts.network}{#if parts.stations.length}
      <span class="stations">{parts.stations.join(", ")}</span>
    {/if}{#if parts.outOfMarket}
      <!-- A struck-through pin rather than "out of market". Three words was the
           longest thing in the row and the only place the interface said "market"
           at all, when everything else calls them your channels. -->
      <svg class="pin" viewBox="0 0 12 12" role="img" aria-label="Not on your channels">
        <path d="M6 10.6S9.1 6.9 9.1 4.6A3.1 3.1 0 0 0 2.9 4.6c0 2.3 3.1 6 3.1 6z" />
        <circle cx="6" cy="4.6" r="1.15" />
        <line class="gap" x1="1.9" y1="10.1" x2="10.1" y2="1.9" />
        <line class="slash" x1="1.9" y1="10.1" x2="10.1" y2="1.9" />
      </svg>
    {/if}
  </span>
{/if}

<style>
  /* A divider, not a separator character: "·" is a glyph wide enough to matter in
     a row this tight, and a rule reads as one label in two parts. */
  .stations {
    margin-left: 5px;
    padding-left: 5px;
    border-left: 1px solid var(--border-hi);
  }
  .pin {
    width: 10px;
    height: 10px;
    margin-left: 5px;
    vertical-align: -1px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.3;
    stroke-linecap: round;
  }
  /* Two strokes: a thick one in the card colour that cuts a gap through the pin,
     then the slash itself inside that gap. One line alone merges into the pin
     outline wherever the two cross and stops reading as a strike. */
  .gap {
    stroke: var(--bg-card);
    stroke-width: 2.2;
  }
  .slash {
    stroke-width: 1.3;
  }
</style>
