<script lang="ts">
  /*
   * A team's season: every result so far, then what is left, in order.
   *
   * Opened by tapping a team anywhere on the board. One list rather than a
   * next-game card above the results, because a card pulled out of the order
   * read as a separate thing and made the list harder to follow (Micah: "I
   * don't think the next game up card is necessary, and especially confusing
   * since it doesn't slot chronologically").
   *
   * Spoilers, which a list of results is made of. A game hidden on the board is
   * live or just finished for a team the viewer is avoiding, and its result is
   * exactly what is being kept back:
   *   - The avoided team itself asks first. Seeing its season means seeing that
   *     result, so saying yes reveals the game on the board as well, and "keep
   *     it hidden" leaves everything as it was.
   *   - Anybody else's schedule that contains a hidden game, which is to say the
   *     opponent's, shows that one game without its result, and holds back the
   *     record and the standing, both of which that result changes.
   * The prompt depends on the team having a hidden game, not on where it was
   * tapped. A planning row is usually safe, but not always: a team playing on
   * Sunday and again on Thursday night has its Thursday game in the planning
   * list while Sunday's is still hidden in the recap.
   */
  import type { Game, ScheduleGame, TeamSchedule } from "../../shared/types";
  import { scoreColor } from "./format";
  import { prefs } from "./prefs.svelte";
  import { isHidden, reveal } from "./spoilers.svelte";
  import type { TeamRef } from "./team.svelte";

  let {
    team,
    board,
    ratingFor,
    onclose,
  }: {
    team: TeamRef;
    /** Every game on the board, live, finished and upcoming, for spoilers and ratings. */
    board: Game[];
    /** The board's own number for a game it is showing, or null. */
    ratingFor: (game: Game) => number | null;
    onclose: () => void;
  } = $props();

  let schedule = $state<TeamSchedule | null>(null);
  let failed = $state(false);

  $effect(() => {
    const { league, id } = team;
    schedule = null;
    failed = false;
    let cancelled = false;
    fetch(`/api/team?league=${league}&id=${encodeURIComponent(id)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: TeamSchedule) => {
        if (!cancelled) schedule = data;
      })
      .catch(() => {
        if (!cancelled) failed = true;
      });
    return () => {
      cancelled = true;
    };
  });

  /** Games on the board that are hidden right now. */
  const hiddenOnBoard = $derived(board.filter((g) => isHidden(g)));
  const hiddenIds = $derived(new Set(hiddenOnBoard.map((g) => g.id)));
  /** This team's own games still hidden on the board. */
  const ownHidden = $derived(
    hiddenOnBoard.filter(
      (g) => g.league === team.league && (g.home.id === team.id || g.away.id === team.id),
    ),
  );
  /** The team itself is on the viewer's list, not merely playing somebody who is. */
  const avoided = $derived(team.league === "nfl" && prefs.noSpoilers.includes(team.id));
  let confirmed = $state(false);
  const asking = $derived(avoided && ownHidden.length > 0 && !confirmed);

  function showAnyway(): void {
    for (const g of ownHidden) reveal(g.id);
    confirmed = true;
  }

  /* Anything in this schedule still hidden on the board, which holds back the
     record and the standing as well as that game's line. */
  const withheld = $derived(schedule?.games.some((g) => hiddenIds.has(g.id)) ?? false);
  const byId = $derived(new Map(board.map((g) => [g.id, g])));

  /* Teams with a hidden game, whose record now already counts that result. */
  const hiddenTeams = $derived(new Set(hiddenOnBoard.flatMap((g) => [g.home.id, g.away.id])));

  /* `beforeNext` drops the row's own bottom rule, which otherwise sat directly on
     top of the Next rule and drew two lines a few pixels apart. */
  type Row =
    | { kind: "game"; game: ScheduleGame; next: boolean; beforeNext: boolean }
    | { kind: "bye"; week: number; beforeNext: boolean };

  const rows = $derived.by((): Row[] => {
    if (!schedule) return [];
    const out: Row[] = [];
    let byePlaced = schedule.byeWeek === null;
    let nextPlaced = false;
    for (const game of schedule.games) {
      if (!byePlaced && game.week !== null && game.week > (schedule.byeWeek as number)) {
        out.push({ kind: "bye", week: schedule.byeWeek as number, beforeNext: false });
        byePlaced = true;
      }
      const next = !nextPlaced && game.state !== "post";
      if (next) {
        nextPlaced = true;
        if (out.length > 0) out[out.length - 1].beforeNext = true;
      }
      out.push({ kind: "game", game, next, beforeNext: false });
    }
    if (!byePlaced) out.push({ kind: "bye", week: schedule.byeWeek as number, beforeNext: false });
    return out;
  });

  /** "Standing" without the position, which the hidden result can change. */
  const standing = $derived.by(() => {
    const s = schedule?.standing ?? null;
    if (s === null || !withheld) return s;
    return s.replace(/^\S+\s+in\s+/i, "");
  });

  /** "Sun Oct 18", above the kickoff time. Built in two parts to leave out the comma. */
  function day(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const weekday = d.toLocaleDateString([], { weekday: "short" });
    return `${weekday} ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`;
  }

  /**
   * Kickoff time under the date, for every game still to come rather than only
   * the coming week's. With AM and PM, since a London kickoff is a morning one,
   * and "TBD" where ESPN has no time yet, as for college games a few weeks out.
   */
  function time(g: ScheduleGame): string {
    const d = new Date(g.startDate);
    if (g.state === "in") return "live";
    if (!g.timeValid || Number.isNaN(d.getTime())) return "TBD";
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  /** The opponent's record, unless it already counts a result being kept back. */
  function recordOf(g: ScheduleGame, onBoard: Game | undefined): string | null {
    if (g.state !== "post" && hiddenTeams.has(g.opponent.id)) return null;
    if (g.state !== "post" && onBoard) {
      const side = onBoard.home.id === g.opponent.id ? onBoard.home : onBoard.away;
      if (side.id === g.opponent.id && side.record) return side.record;
    }
    return g.opponent.record;
  }

  function onkey(event: KeyboardEvent): void {
    if (event.key === "Escape") onclose();
  }
</script>

<svelte:window onkeydown={onkey} />

<!-- Nothing to type here, so unlike the report sheet a tap outside closes it. -->
<div class="scrim" role="presentation" onclick={(e) => e.target === e.currentTarget && onclose()}>
  {#if asking}
    <div class="sheet ask" role="dialog" aria-modal="true" aria-label="Show this team's schedule?">
      <p class="title">Show the {team.name} schedule?</p>
      <p class="why">
        It includes the result of the game you are avoiding, so this also reveals that game on the
        board.
      </p>
      <div class="buttons">
        <button type="button" class="primary" onclick={showAnyway}>Show it</button>
        <button type="button" onclick={onclose}>Keep it hidden</button>
      </div>
    </div>
  {:else}
    <div
      class="sheet"
      class:loading={!schedule && !failed}
      role="dialog"
      aria-modal="true"
      aria-label="{team.name} schedule"
    >
      <div class="head">
        {#if schedule?.logo ?? team.logo}
          <img class="logo" src={schedule?.logo ?? team.logo} alt="" />
        {/if}
        <div class="who">
          <p class="name">
            {#if schedule?.rank}<span class="rk mono">{schedule.rank}</span>{/if}{schedule?.name ?? team.name}
          </p>
          {#if schedule}
            <p class="sub">
              {#if withheld}record hidden{:else if schedule.record}{schedule.record}{/if}{#if standing}{withheld || schedule.record ? " · " : ""}{standing}{/if}
            </p>
          {/if}
        </div>
        <button type="button" class="close" aria-label="Close" onclick={onclose}>×</button>
      </div>

      {#if failed}
        <p class="note">Could not load the schedule.</p>
      {:else if !schedule}
        <p class="note">Loading…</p>
      {:else}
        <div class="list">
          {#each rows as row (row.kind === "game" ? row.game.id : `bye-${row.week}`)}
            {#if row.kind === "bye"}
              <div class="game bye" class:before-next={row.beforeNext}>
                <div class="line1"><span class="wk mono">W{row.week}</span><span>bye</span></div>
              </div>
            {:else}
              {@const g = row.game}
              {@const hidden = hiddenIds.has(g.id)}
              {@const onBoard = byId.get(g.id)}
              {@const rating = onBoard && !hidden ? ratingFor(onBoard) : null}
              {@const record = hidden ? null : recordOf(g, onBoard)}
              {#if row.next}<div class="next">Next</div>{/if}
              <div class="game" class:before-next={row.beforeNext}>
                <div class="line1">
                  <span class="wk mono">{g.week !== null ? `W${g.week}` : ""}</span>
                  <span class="res mono">
                    {#if hidden}
                      <span class="faint">hidden</span>
                    {:else if g.state === "post" && g.result}
                      <span class={g.result === "W" ? "win" : g.result === "L" ? "loss" : ""}
                        >{g.result} {g.score}-{g.opponentScore}</span
                      >
                    {:else if g.state === "in"}
                      <span class="live">{g.score ?? 0}-{g.opponentScore ?? 0}</span>
                    {:else}
                      <span class="date">{day(g.startDate)}</span>
                    {/if}
                    {#if g.state !== "post" && !hidden}<span class="time">{time(g)}</span>{/if}
                  </span>
                  <span class="at">{g.home ? "vs" : "at"}</span>
                  {#if g.opponent.logo}
                    <img class="opp-logo" src={g.opponent.logo} alt="" loading="lazy" />
                  {:else}
                    <span class="opp-logo"></span>
                  {/if}
                  <span class="opp"
                    >{#if g.opponent.rank}<span class="rk mono">{g.opponent.rank}</span>{/if}{g.opponent.name}{#if record}<span
                        class="orec mono">{record}</span
                      >{/if}</span
                  >
                  {#if rating !== null}
                    <span class="rating mono" style="color: {scoreColor(rating)}">{Math.round(rating)}</span>
                  {/if}
                  {#if g.state !== "post" && g.broadcast}<span class="tv mono">{g.broadcast}</span>{/if}
                </div>
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(5, 7, 11, 0.6);
    display: flex;
    /* Low, like the report sheet, because the thumb that tapped the team is
       already down there; centred on a wide screen. */
    align-items: flex-end;
    justify-content: center;
    padding: calc(10px + env(safe-area-inset-top)) calc(10px + env(safe-area-inset-left))
      calc(10px + env(safe-area-inset-bottom)) calc(10px + env(safe-area-inset-right));
  }
  .sheet {
    width: 100%;
    max-width: 520px;
    max-height: 82vh;
    overflow-y: auto;
    background: var(--bg-card);
    border: 1px solid var(--border-hi);
    border-radius: 16px;
    padding: 14px 16px 10px;
    box-shadow: 0 12px 34px rgba(0, 0, 0, 0.45);
  }
  /* Opened at the height a season fills, rather than as a header and a loading
     line that then jumped up the screen when the games arrived: a season of 12
     to 17 games fills the sheet's maximum on a phone anyway. */
  .sheet.loading {
    height: 82vh;
  }
  .sheet.ask {
    align-self: center;
    padding: 18px 16px 16px;
  }
  .title {
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 650;
  }
  .why {
    margin: 0 0 16px;
    font-size: 13px;
    color: var(--text-dim);
    line-height: 1.5;
  }
  .buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .buttons button {
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    padding: 10px;
    border-radius: 9px;
    border: 1px solid var(--border-hi);
    background: var(--bg-raised);
    color: var(--text);
    cursor: pointer;
  }
  .buttons .primary {
    background: var(--text);
    border-color: var(--text);
    color: var(--bg);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .logo {
    width: 34px;
    height: 34px;
    object-fit: contain;
    flex: none;
  }
  .who {
    min-width: 0;
  }
  .name {
    margin: 0;
    font-size: 16px;
    font-weight: 650;
  }
  .sub {
    margin: 1px 0 0;
    font-size: 12px;
    color: var(--text-dim);
  }
  .close {
    margin-left: auto;
    align-self: flex-start;
    font: inherit;
    font-size: 22px;
    line-height: 1;
    padding: 2px 6px;
    background: none;
    border: none;
    color: var(--text-faint);
    cursor: pointer;
  }
  .note {
    margin: 14px 0;
    color: var(--text-faint);
    font-size: 13px;
  }
  .game {
    padding: 7px 0;
    border-bottom: 1px solid var(--border);
  }
  .game:last-child,
  .game.before-next {
    border-bottom: none;
  }
  .line1 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .game.bye {
    color: var(--text-faint);
    font-size: 12px;
  }
  .tv {
    flex: none;
    font-size: 11px;
    color: var(--text-dim);
  }
  .orec {
    margin-left: 6px;
    font-size: 11px;
    color: var(--text-faint);
  }
  .wk {
    width: 28px;
    flex: none;
    font-size: 11px;
    color: var(--text-faint);
  }
  /* Date and kickoff stacked, the one cell on two lines, so the rest of the row
     keeps to one. A played game's result is a single line in the same place. */
  .res {
    width: 80px;
    flex: none;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    line-height: 1.25;
  }
  .time {
    font-size: 10.5px;
    color: var(--text-faint);
  }
  .win {
    color: var(--good);
  }
  .loss {
    color: var(--hot);
  }
  .live {
    color: var(--warm);
  }
  .faint {
    color: var(--text-faint);
  }
  .at {
    width: 16px;
    flex: none;
    font-size: 11px;
    color: var(--text-faint);
  }
  .opp-logo {
    width: 18px;
    height: 18px;
    object-fit: contain;
    flex: none;
  }
  .opp {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rk {
    font-size: 11px;
    color: var(--warm);
    margin-right: 4px;
  }
  .rating {
    flex: none;
    font-weight: 700;
    font-size: 13px;
  }
  .next {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 0 2px;
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--hot);
  }
  .next::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--hot);
    opacity: 0.5;
  }
</style>
