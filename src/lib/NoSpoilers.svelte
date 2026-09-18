<script lang="ts">
  /*
   * Teams whose games the board must not give away.
   *
   * The list comes from the standings rather than from the slate, so a team on a
   * bye is still there to pick: the week somebody sets this up is quite likely to
   * be a week their team is not playing.
   */
  import { prefs, setNoSpoilers } from "./prefs.svelte";

  let { open = false, ontoggle }: { open?: boolean; ontoggle?: () => void } = $props();

  interface Team {
    id: string;
    name: string;
    abbrev: string;
    logo: string | null;
    divisionName: string;
    conferenceName: string;
  }

  let teams = $state<Team[]>([]);
  let failed = $state(false);

  /* Fetched when the panel is first opened rather than on load. Nobody who never
     opens this needs thirty-two logos. */
  $effect(() => {
    if (!open || teams.length > 0) return;
    void fetch("/api/teams")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { teams?: Team[] }) => {
        teams = body.teams ?? [];
        failed = teams.length === 0;
      })
      .catch(() => (failed = true));
  });

  const chosen = $derived(prefs.noSpoilers);

  const groups = $derived.by(() => {
    const by = new Map<string, Team[]>();
    for (const team of teams) {
      // `divisionName` already reads "AFC East", so pairing it with the conference
      // gives "AFC AFC East".
      const key = team.divisionName || team.conferenceName;
      const bucket = by.get(key);
      if (bucket) bucket.push(team);
      else by.set(key, [team]);
    }
    return [...by]
      .map(([label, list]) => ({ label, list: [...list].sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  function toggle(id: string): void {
    setNoSpoilers(chosen.includes(id) ? chosen.filter((t) => t !== id) : [...chosen, id]);
  }
</script>

<button type="button" class="dd-toggle" onclick={() => ontoggle?.()}>
  {chosen.length ? `No spoilers (${chosen.length})` : "No spoilers"}
  <span class="dd-caret" class:open>▾</span>
</button>

{#if open}
  <div class="dd-panel">
    <p class="dd-hint">
      While one of these is playing, the board hides the score, the rating and everything else that
      says how it is going, and sends no notifications about it. Tap the card to look anyway.
      Upcoming games are left alone.
    </p>
    {#if failed}
      <p class="dd-hint">The team list is not available right now.</p>
    {:else if teams.length === 0}
      <p class="dd-hint">Loading teams.</p>
    {:else}
      {#each groups as group (group.label)}
        <p class="group">{group.label}</p>
        <div class="grid">
          {#each group.list as team (team.id)}
            <label class="item" class:on={chosen.includes(team.id)}>
              <input
                type="checkbox"
                checked={chosen.includes(team.id)}
                onchange={() => toggle(team.id)}
              />
              {#if team.logo}<img src={team.logo} alt="" loading="lazy" />{/if}
              <span class="nm">{team.name}</span>
            </label>
          {/each}
        </div>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .group {
    margin: 12px 0 5px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
  }
  .group:first-of-type {
    margin-top: 6px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 6px 12px;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    font-size: 12px;
    color: var(--text-dim);
    cursor: pointer;
  }
  .item.on {
    color: var(--text);
  }
  .item input {
    flex: none;
  }
  .item img {
    width: 16px;
    height: 16px;
    object-fit: contain;
    flex: none;
  }
  .nm {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
