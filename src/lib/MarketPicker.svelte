<script lang="ts">
  import { clearMarket, prefs, redetectMarket, setInMarketFirst, setZip } from "./prefs.svelte";

  let {
    stations,
    detected = null,
    city = null,
    marketName = null,
    nudge = false,
    open = false,
    ontoggle,
    onclose,
  }: {
    stations: string[];
    /** Postal code Cloudflare reported, when the network knew it. */
    detected?: string | null;
    /** The town the network placed them in. Shown only in the panel, as context. */
    city?: string | null;
    /** The television market that postal code is served by. This is the label. */
    marketName?: string | null;
    /** The slate splits by market and nothing has resolved one. */
    nudge?: boolean;
    open?: boolean;
    ontoggle?: () => void;
    onclose?: () => void;
  } = $props();

  /** What the board is actually using, whoever supplied it. */
  const active = $derived(prefs.marketOff ? null : (prefs.zip ?? detected));

  let draft = $state(prefs.zip ?? "");

  const valid = $derived(/^\d{5}$/.test(draft));
  /* A place, not a list of transmitters. The call signs mean nothing to someone
     who just wants to know the board is pointed at the right city. */
  /*
   * The market, and only the market.
   *
   * Showing both read as a contradiction: the postal code is the viewer's own
   * town and the name is the television market it belongs to, so "Boston 01420"
   * pairs a city with a code from somewhere else and looks like a mistake. The
   * chip answers "which market is the board pointed at", which is the only
   * question it has room for. The code is in the panel, where it is changed.
   */
  const label = $derived(
    active === null ? (prefs.marketOff ? "Market off" : "Set market") : (marketName ?? active),
  );

  function save(): void {
    setZip(draft);
    onclose?.();
  }

  function clear(): void {
    draft = "";
    clearMarket();
    onclose?.();
  }

  function redetect(): void {
    draft = "";
    redetectMarket();
    onclose?.();
  }
</script>

<button type="button" class="dd-toggle" onclick={() => ontoggle?.()}>
  <!-- The whole explanation lives inside the panel. Out here a dot is enough to say
       there is something to set, and unlike a banner it costs no vertical space. -->
  {#if nudge && !open}<span class="dot" aria-hidden="true"></span>{/if}
  {label}
  <span class="dd-caret" class:open>▾</span>
</button>

{#if open}
  <div class="dd-panel">
    <p class="dd-hint">
      {#if prefs.marketOff}
        Market filtering is off, so nothing is flagged as unavailable.
      {:else if prefs.zip === null && detected !== null}
        <!-- All three, because any one on its own raises a question the other two
             answer: the code is unfamiliar, the town is not where the channels come
             from, and the market alone looks like somewhere the viewer does not live. -->
        Worked out <strong>{detected}</strong>{city ? ` (${city})` : ""} from your connection{marketName
          ? `, which is served by the ${marketName} market`
          : ""}. Enter a postal code to override it.
      {:else}
        On Sunday afternoons the networks split the slate by market, so only one CBS
        and one FOX game reaches any given city. Your postal code is what turns
        "regional" into which game is actually on your channels.
      {/if}
    </p>
    <div class="row">
      <input
        type="text"
        inputmode="numeric"
        maxlength="5"
        placeholder={active ?? "02134"}
        bind:value={draft}
        onkeydown={(e) => e.key === "Enter" && valid && save()}
      />
      <button type="button" class="save" disabled={!valid} onclick={save}>Save</button>
      {#if active !== null}
        <button type="button" class="clear" onclick={clear}>Clear</button>
      {/if}
      <!-- So opting out, or overriding once, is not a one-way door back to typing. -->
      {#if prefs.marketOff || prefs.zip !== null}
        <button type="button" class="clear" onclick={redetect}>Redetect</button>
      {/if}
    </div>
    <!-- Only once a market is resolved. With nothing to compare against there are
         no out-of-market games to sort, so the toggle would do nothing and still
         ask to be understood. -->
    {#if active !== null}
      <label class="item" class:on={prefs.inMarketFirst}>
        <input
          type="checkbox"
          checked={prefs.inMarketFirst}
          onchange={() => setInMarketFirst(!prefs.inMarketFirst)}
        />
        <span>
          <span class="name">My channels first</span>
          <span class="blurb">
            Sort games your channels are not carrying to the bottom, fade them, and
            leave them out of notifications. Off, every game ranks on merit and the
            channel chip is what tells you it is out of market.
          </span>
        </span>
      </label>
    {/if}
    {#if active !== null && stations.length}
      <p class="stations">Reading {stations.join(", ")}.</p>
    {/if}
  </div>
{/if}

<style>
  .item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 10px;
    font-size: 12px;
    color: var(--text-dim);
    cursor: pointer;
  }
  .item input {
    margin-top: 2px;
    flex: none;
  }
  .item .name {
    display: block;
    font-weight: 600;
  }
  .item.on .name {
    color: var(--text);
  }
  .item .blurb {
    display: block;
    margin-top: 2px;
    color: var(--text-faint);
    line-height: 1.4;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--warm);
    flex: none;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  input {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 7px;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    padding: 6px 9px;
    width: 86px;
    letter-spacing: 0.06em;
  }
  input:focus {
    outline: none;
    border-color: var(--border-hi);
  }
  .save,
  .clear {
    background: none;
    border: 1px solid var(--border);
    border-radius: 7px;
    color: var(--text-dim);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 11px;
    cursor: pointer;
  }
  .save:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .stations {
    margin: 8px 0 0;
    font-size: 11px;
    color: var(--text-faint);
  }
</style>
