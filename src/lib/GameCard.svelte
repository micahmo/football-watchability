<script lang="ts">
  import type { Game } from "../../shared/types";
  import { clockLabel, hasRecord, kickoffWhen, scoreColor, teamColor } from "./format";
  import ChannelChip from "./ChannelChip.svelte";
  import { isHidden, isProtected, reveal, unreveal } from "./spoilers.svelte";
  import { prefs } from "./prefs.svelte";
  import { slide } from "svelte/transition";
  import FieldPosition from "./FieldPosition.svelte";
  import WinProbBar from "./WinProbBar.svelte";

  let {
    game,
    score,
    variant = "live",
    collapsible = false,
    expanded = true,
    ontoggle,
  }: {
    game: Game;
    score: number;
    variant?: "live" | "final";
    /**
     * Whether this card can be folded away.
     *
     * A busy Saturday peaks at 32 concurrent games, and at full size that is
     * nearly eight phone screens of live cards before the planning list even
     * starts. The hero is deliberately never collapsible: it is the answer to
     * "what should I put on", so hiding its detail defeats the point of it.
     */
    collapsible?: boolean;
    expanded?: boolean;
    ontoggle?: () => void;
  } = $props();

  /** Detail is shown when the card cannot fold, or when this one is open. */
  const open = $derived(!collapsible || expanded);

  /*
   * Height is animated in script rather than in CSS.
   *
   * The `grid-template-rows: 0fr -> 1fr` trick is the tidier answer and it did not
   * size the row here: measured mid-transition it sat at 8px, the padding alone,
   * while the content behind it was 97px. `slide` measures the real height and
   * animates to it, which is the thing that has to be right.
   */
  /*
   * Three hundred rather than two.
   *
   * It does not make the animation cheaper, and the cost is the point: each frame
   * relays out and repaints the cards on screen, and dropping some of them is what
   * reads as stutter. Spreading the same dropped frames across half again as many
   * makes each one a smaller fraction of the movement. Purely perceptual, and the
   * real fix is to stop animating a layout property at all.
   */
  const MOTION_MS = 300;
  /* Asked at the moment a transition starts rather than when the card is built,
     so turning the setting on takes effect without a reload. */
  const ms = () =>
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : MOTION_MS;

  /*
   * Everything that says how the game is going, withheld.
   *
   * Adding a field to this card? Read the standing note at the top of
   * `spoilers.svelte.ts` first and gate it here if it could give a game away.
   *
   * Not only the score. The rating is a measure of how close it is, the rail is
   * that rating in colour, the clock says whether it went to overtime, and the
   * dimmed side names the loser outright. Any one of them alone gives the game
   * away, so the card keeps the matchup and nothing else.
   */
  const hidden = $derived(isHidden(game));
  /* Asked every time rather than remembered. Somebody who checked at half past
     four may be starting the recording at five. */
  let asking = $state(false);
  $effect(() => {
    // A new game in the same card slot must not inherit an open prompt.
    game.id;
    asking = false;
  });
  function show(): void {
    reveal(game.id);
    asking = false;
  }
  /* Shown once a protected game has been looked at, so the curtain can be drawn
     again without reloading the page. */
  const revealedByHand = $derived(!hidden && game.state !== "pre" && isProtected(game));

  const accent = $derived(hidden ? "var(--calm)" : scoreColor(score));
  const showWp = $derived(
    !hidden && open && variant === "live" && game.score?.hasWinProb === true,
  );
  // Dimming the team that is behind reads as "this one lost", which is only true
  // once the game is over. Mid-game both teams stay at full weight.
  const leader = $derived(
    hidden || variant !== "final" || game.home.score === game.away.score
      ? null
      : game.home.score > game.away.score
        ? "home"
        : "away",
  );
  const clockText = $derived(clockLabel(game));

  /** Null until a postal code is set, so absence means unknown, not unavailable. */
  const outOfMarket = $derived(game.marketStations !== null && game.marketStations.length === 0);
  /* Only faded when the viewer asked for their own channels first. Otherwise the
     game is marked in the chip and otherwise treated like any other. */
  const unavailable = $derived(outOfMarket && prefs.inMarketFirst);
  const showPossession = $derived(
    !hidden && variant === "live" && game.possessionTeamId !== null,
  );

  /** Home-relative spread: negative means the home team was favoured. */
  const favoriteSide = $derived(
    game.pregameSpread === null || game.pregameSpread === 0
      ? null
      : game.pregameSpread < 0
        ? "home"
        : "away",
  );
  const spreadLabel = $derived(
    game.pregameSpread === null ? "" : `-${Math.abs(game.pregameSpread)}`,
  );

  /* Red is for things that are happening now. "UPSET POTENTIAL" stays blue,
     since the upset has not actually happened yet. */
  const HOT_TAGS = new Set([
    "INSTANT CLASSIC",
    "OVERTIME",
    "GAME ON THE LINE",
    "UPSET ALERT",
    "BIG UPSET",
  ]);
  /** `2OT`, `3OT` and so on are the same event as `OVERTIME` and read the same. */
  const hot = (tag: string) => HOT_TAGS.has(tag) || /^\d+OT$/.test(tag);
</script>

<!-- The card stays an <article> and takes the button role rather than becoming one:
     it holds headings, logos and a list of labels, which is article content, and a
     <button> wrapping all of that is announced as one long unreadable label. Both
     rules are suppressed deliberately; role, tabindex, aria-expanded and the
     Enter/Space handler together give the same behaviour a button would. -->
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<article
  class="card"
  class:unavailable
  class:collapsible
  class:folded={collapsible && !expanded}
  style="--accent: {accent}"
  class:hidden
  role={hidden || collapsible ? "button" : undefined}
  tabindex={hidden || collapsible ? 0 : undefined}
  aria-expanded={hidden ? undefined : collapsible ? expanded : undefined}
  onclick={hidden ? () => (asking = !asking) : collapsible ? () => ontoggle?.() : undefined}
  onkeydown={hidden || collapsible
    ? (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (hidden) asking = !asking;
          else ontoggle?.();
        }
      }
    : undefined}
>
  <div class="rail"></div>

  <div class="score-col">
    {#if hidden}
      <!-- The rating is a measure of how close the game is, so the number is as
           much of a giveaway as the score. -->
      <svg class="masked" viewBox="0 0 16 16" role="img" aria-label="Hidden">
        <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
        <circle cx="8" cy="8" r="2.1" />
        <line class="gap" x1="2.5" y1="13.5" x2="13.5" y2="2.5" />
        <line class="slash" x1="2.5" y1="13.5" x2="13.5" y2="2.5" />
      </svg>
    {:else}
      <div class="score-num mono">{Math.round(score)}</div>
    {/if}
    <!-- Folded, the clock rides here rather than on a line of its own. "Close and
         late" is the question the board answers and lateness drives the rating, so
         a folded 24-21 with no quarter on it is missing what makes it worth a look.
         This column is empty below the number, so it costs width, not height. -->
    {#if !hidden && !open && variant === "live"}
      <div class="score-clock mono">{clockText}</div>
    {/if}
    {#if collapsible && !hidden}
      <svg class="chev" class:open={expanded} viewBox="0 0 12 8" aria-hidden="true">
        <path d="M1 1.5 L6 6.5 L11 1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    {/if}
  </div>

  <div class="main">
    <div class="teams">
      {#each [game.away, game.home] as team (team.id)}
        <div class="team" class:dim={leader !== null && leader !== team.homeAway}>
          {#if team.logo}
            <img class="logo" src={team.logo} alt="" loading="lazy" />
          {:else}
            <span class="logo placeholder" style="background: {teamColor(team)}"></span>
          {/if}
          {#if team.rank}<span class="rank-badge mono">{team.rank}</span>{/if}
          <span class="team-name">{team.name}</span>
          <!-- A record is a result: once the game is final it reads 2-1 beside a
               team that was 2-0 and gives away the score sitting hidden next to it. -->
          {#if !hidden && hasRecord(team.record)}
            <span class="record mono">{team.record}</span>
          {/if}
          {#if favoriteSide === team.homeAway}
            <span class="spread mono" title="Pregame closing line, not a live line.">
              {spreadLabel}
            </span>
          {/if}
          {#if showPossession && game.possessionTeamId === team.id}
            <svg class="poss" viewBox="0 0 16 10" role="img" aria-label="has the ball">
              <ellipse cx="8" cy="5" rx="7.1" ry="4.1" fill="currentColor" />
              <line x1="5.4" y1="5" x2="10.6" y2="5" stroke="var(--bg-card)" stroke-width="1.3" />
            </svg>
          {/if}
          {#if !hidden}<span class="team-score mono">{team.score}</span>{/if}
        </div>
      {/each}
    </div>

    {#if collapsible}
      {#if open && !hidden}
        <div class="detail" transition:slide={{ duration: ms() }}>
          {#if variant === "live" && game.score?.hasWinProb === true}
            <WinProbBar home={game.home} away={game.away} homeWinProb={game.homeWinProb ?? 0.5} />
          {/if}
          {#if variant === "live"}
            <div class="meta">
              <span class="live-dot"></span>
              <span class="mono clock">{clockText}</span>
              {#if game.downDistance}
                <span class="down mono" class:redzone={game.isRedZone}>{game.downDistance}</span>
              {/if}
            </div>
            <!-- Always drawn, so the card keeps its height. The markers inside it
                 come and go with the situation; the pitch does not. -->
            <FieldPosition {game} />
          {/if}
          <!-- Above the tags rather than below them: it belongs with the clock and
               the situation it describes, and it is also where the expansion grows
               from, so the new information arrives together instead of appearing on
               both sides of the labels. -->
          {#if variant === "live" && game.lastPlay}
            <p class="last-play">{game.lastPlay}</p>
          {/if}
        </div>
      {/if}
    {:else if showWp}
      <WinProbBar home={game.home} away={game.away} homeWinProb={game.homeWinProb ?? 0.5} />
    {/if}

    <!-- Where the game is right now: clock and situation together. A finished game
         has no clock or situation, so it skips this line entirely. -->
    {#if !collapsible && !hidden && variant === "live"}
      <div class="meta">
        <span class="live-dot"></span>
        <span class="mono clock">{clockText}</span>
        {#if game.downDistance}
          <span class="down mono" class:redzone={game.isRedZone}>{game.downDistance}</span>
        {/if}
      </div>
    {/if}

    <!-- Labels: how to watch it, and what kind of game it is. -->
    <div class="chips">
      <!-- No FINAL chip: the section heading says these are finished and the chip
           sat between the kickoff time and the rest of the labels, splitting them.
           When the game was, not when it ended, since ESPN gives no end time. -->
      {#if variant === "final"}
        <span class="played mono">{kickoffWhen(game.startDate)}</span>
      {/if}
      <ChannelChip {game} />
      {#if !game.nationalBroadcast}<span class="note warn">local feed</span>{/if}
      <!-- Only shown once a postal code makes the answer real. Before that every
           1:00 game is equally "regional", which is noise rather than a signal. -->
      <!-- Not gated on being open. Every other chip in this row shows when folded,
           and the row already wraps for multiple tags, so holding this one back was
           an exception with no rule behind it. -->
      {#if game.conferenceGame}<span class="note">conference game</span>{/if}
      <!-- "INSTANT CLASSIC" and "2OT" describe how the game is going, which is the
           whole of what is being withheld. -->
      {#if !hidden}
        {#each game.tags as tag (tag)}
          <span class="tag" class:hot={hot(tag)}>{tag}</span>
        {/each}
      {:else}
        <span class="tag spoiler">no spoilers · tap to show</span>
      {/if}
      {#if revealedByHand}
        <button
          type="button"
          class="tag spoiler rehide"
          onclick={(e: MouseEvent) => {
            e.stopPropagation();
            unreveal(game.id);
          }}
        >
          hide again
        </button>
      {/if}
    </div>

    {#if !collapsible && !hidden && variant === "live" && game.lastPlay}
      <p class="last-play">{game.lastPlay}</p>
    {/if}

    <!-- Inside the card rather than over the page. A dialogue would cover the
         board, and what is being confirmed is about this one game. -->
    {#if asking}
      <div class="ask" transition:slide={{ duration: ms() }}>
        <!-- Present tense only while there is a game in progress. On the recap a
             finished game is not "going" anywhere, and asking about it in the
             present reads as a string written for one case and reused in the
             other. -->
        <p>{variant === "final" ? "Show how this game turned out?" : "Show how this game is going?"}</p>
        <div class="ask-row">
          <button
            type="button"
            class="ask-yes"
            onclick={(e: MouseEvent) => {
              e.stopPropagation();
              show();
            }}
          >
            Show me
          </button>
          <button
            type="button"
            class="ask-no"
            onclick={(e: MouseEvent) => {
              e.stopPropagation();
              asking = false;
            }}
          >
            Keep it hidden
          </button>
        </div>
      </div>
    {/if}
  </div>
</article>

<style>
  /* The eye in the score column, and the slash across it, drawn the same way as
     the channel chip's pin: a thick cut in the card colour so the line still
     reads where it crosses the shape. */
  .masked {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: var(--text-faint);
    stroke-width: 1.4;
    stroke-linecap: round;
  }
  .masked .gap {
    stroke: var(--bg-card);
    stroke-width: 3.2;
  }
  .masked .slash {
    stroke-width: 1.4;
  }
  /* Says why, not what. An absence with no explanation reads as a broken card. */
  .tag.spoiler {
    color: var(--text-faint);
    border-color: var(--border-hi);
    background: none;
    font-weight: 600;
  }
  .rehide {
    font: inherit;
    font-size: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .rehide:hover {
    color: var(--text-dim);
    border-color: var(--text-faint);
  }
  .ask {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
  }
  .ask p {
    margin: 0 0 8px;
    font-size: 13px;
    color: var(--text-dim);
  }
  .ask-row {
    display: flex;
    gap: 8px;
  }
  .ask button {
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    padding: 5px 10px;
    border-radius: 6px;
    cursor: pointer;
  }
  .ask-yes {
    border: 1px solid var(--cool);
    background: var(--cool);
    color: var(--bg);
  }
  .ask-no {
    border: 1px solid var(--border-hi);
    background: none;
    color: var(--text-dim);
  }
  .card.collapsible {
    cursor: pointer;
    /* The whole card is the target rather than a chevron: a 196px row reduced to
       one line is still a large tap area, and aiming at a 12px caret on a phone
       is the kind of precision nobody should need for "show me more". */
    -webkit-tap-highlight-color: transparent;
  }
  .card.collapsible:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  /* Folded cards sit tighter, which is most of the vertical space the fold buys.
     Animated rather than removed: the two end states are both right, it was only
     the instant jump between them that read as broken. */
  .card.folded {
    padding-top: 10px;
    padding-bottom: 10px;
  }
  /* In the rating gutter, not at the right edge, where it competed with the team
     scores. This column already carries the card's status and nothing else can
     collide with it. Its presence is also what marks a card as one that opens. */
  .chev {
    width: 12px;
    height: 8px;
    margin-top: 3px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    color: var(--text-faint);
    transition: transform 0.22s ease, color 0.15s ease;
  }
  .card.collapsible:hover .chev {
    color: var(--text-dim);
  }
  .chev.open {
    transform: rotate(180deg);
  }
  .detail {
    padding-top: 8px;
    /* Animating height forces layout every frame, so the honest wins are doing it
       once per card rather than three times and keeping the work inside the card.
       `contain` stops a card mid-animation from re-laying out its thirteen
       neighbours, which is what a list of open and closed cards would otherwise
       cost on each of those frames. */
    will-change: height;
  }
  @media (prefers-reduced-motion: reduce) {
    .chev,
    .card {
      transition: none;
    }
  }
  .played {
    font-size: 11px;
    color: var(--text-faint);
    align-self: center;
  }
  .score-clock {
    margin-top: 2px;
    /* Sized so the longest label a game can produce, "10:31 4th", still fits the
       rating column. At 10px it measured 53px against a 52px column and spilled a
       little past the rating above it, which reads as a ragged left edge down a
       list of folded cards. */
    font-size: 9px;
    letter-spacing: -0.01em;
    line-height: 1.2;
    color: var(--text-faint);
    text-align: center;
    white-space: nowrap;
  }
  .card {
    position: relative;
    contain: layout style;
    /*
     * Off-screen cards are skipped entirely rather than laid out.
     *
     * Expanding a card animates its height, and height is a layout property, so
     * every frame repositions everything below it: on a full Saturday that is
     * seventeen more live cards, the planning list and the recap, most of which
     * are nowhere near the screen. This tells the browser not to bother with the
     * ones it is not showing.
     *
     * `auto` on the intrinsic size matters: the browser then remembers each card's
     * last rendered height instead of collapsing it to the placeholder, so the
     * scrollbar does not lurch as cards enter and leave.
     */
    content-visibility: auto;
    contain-intrinsic-size: auto 110px;
    display: grid;
    grid-template-columns: 6px 68px 1fr;
    gap: 0 16px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px 18px 14px 0;
    overflow: hidden;
    transition:
      border-color 0.15s ease,
      background 0.15s ease,
      opacity 0.15s ease,
      padding 0.22s ease;
  }
  /* Gated on a real pointer. On touch, tapping latches :hover until you tap
     elsewhere, so the card would just look stuck in a highlighted state. */
  @media (hover: hover) {
    .card:hover {
      background: var(--bg-card-hi);
      border-color: var(--border-hi);
    }
  }
  .rail {
    background: var(--accent);
  }
  .score-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  .score-num {
    font-size: 30px;
    font-weight: 700;
    line-height: 1;
    color: var(--accent);
  }
  .main {
    min-width: 0;
  }
  .teams {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .team {
    display: flex;
    align-items: center;
    gap: 8px;
    transition: opacity 0.15s ease;
  }
  .team.dim {
    opacity: 0.62;
  }
  .poss {
    width: 15px;
    height: 9px;
    flex: none;
    color: var(--warm);
  }
  .logo {
    width: 22px;
    height: 22px;
    object-fit: contain;
    flex: none;
  }
  .logo.placeholder {
    border-radius: 50%;
  }
  .rank-badge {
    font-size: 11px;
    color: var(--warm);
    font-weight: 700;
    flex: none;
  }
  .team-name {
    font-weight: 600;
    font-size: 15px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .record {
    font-size: 11px;
    color: var(--text-faint);
    flex: none;
  }
  /* Team-specific, like the record, so it lives on the team row rather than in
     the game-level chip strip. */
  .spread {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-dim);
    flex: none;
  }
  .team-score {
    margin-left: auto;
    font-size: 19px;
    font-weight: 700;
    flex: none;
  }
  .meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 10px;
    font-size: 12px;
    color: var(--text-dim);
  }
  .live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--hot);
    box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.7);
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    70% {
      box-shadow: 0 0 0 7px rgba(255, 77, 79, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(255, 77, 79, 0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .live-dot {
      animation: none;
    }
  }
  .clock {
    color: var(--text);
    font-weight: 600;
  }
  /* Chip-shaped so the row lines up, but deliberately quieter than a tag: no
     fill, no uppercase, muted border. This is background info, not a signal. */
  .note {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 4px;
    border: 1px solid var(--border);
    color: var(--text-faint);
  }
  .note.warn {
    color: var(--warm);
    border-color: rgba(255, 165, 61, 0.35);
  }
  /* An absence, not a warning. The row is already sorted down and faded; a
     color here would shout about the games you are least likely to want. */
  .card.unavailable {
    opacity: 0.55;
  }
  /* Clock and situation are both mono digits, so without a rule between them
     "0:50 3rd 2nd & 10 at SMU 39" reads as one run-on string. */
  .down {
    padding-left: 12px;
    border-left: 1px solid var(--border-hi);
    color: var(--text-dim);
    font-weight: 500;
  }
  .down.redzone {
    color: var(--hot);
    font-weight: 600;
  }
  .chips {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 10px;
    margin-top: 10px;
  }
  .chips:empty {
    display: none;
  }
  .tag {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(77, 157, 255, 0.12);
    color: var(--cool);
    border: 1px solid rgba(77, 157, 255, 0.25);
  }
  .tag.hot {
    background: rgba(255, 77, 79, 0.14);
    color: var(--hot);
    border-color: rgba(255, 77, 79, 0.3);
  }
  .last-play {
    margin: 10px 0 0;
    font-size: 12px;
    color: var(--text-faint);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  @media (max-width: 560px) {
    .card {
      grid-template-columns: 5px 52px 1fr;
      gap: 0 10px;
      padding-right: 12px;
    }
    .score-num {
      font-size: 24px;
    }
  }
</style>
