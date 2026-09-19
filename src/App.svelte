<script lang="ts">
  import type { Game, League, Snapshot } from "../shared/types";
  import { WEIGHTS, combine } from "../shared/weights";
  import { fetchSnapshot, openBoardStream } from "./lib/api";
  import { dayDate, dayKey, dayLabel, relativeTime, scoreColor } from "./lib/format";
  import { isFavorite, prefs, setUpcomingOrder } from "./lib/prefs.svelte";
  import LeagueTabs from "./lib/LeagueTabs.svelte";
  import FavoriteConferences from "./lib/FavoriteConferences.svelte";
  import MarketPicker from "./lib/MarketPicker.svelte";
  import NoSpoilers from "./lib/NoSpoilers.svelte";
  import AlertsPicker from "./lib/AlertsPicker.svelte";
  import DelayPicker from "./lib/DelayPicker.svelte";
  import HelpPanel from "./lib/HelpPanel.svelte";
  import { setLeague, tabChoice } from "./lib/prefs.svelte";
  import { updateBoardSettings } from "./lib/push";
  import UpdatePrompt from "./lib/UpdatePrompt.svelte";

  import GameCard from "./lib/GameCard.svelte";
  import { isHidden } from "./lib/spoilers.svelte";
  import { windowLabels, windowTimeLabel, windowsOf } from "./lib/format";
  import UpcomingRow from "./lib/UpcomingRow.svelte";

  const REFRESH_MS = 20_000;
  /** Planning horizon. Beyond a few days out, lines move and this stops being useful. */
  const MAX_DAYS = 3;
  const MAX_PER_DAY = 6;
  /**
   * How many live and finished cards to show before an expander.
   *
   * The same number as a day of the planning list, for the same reason. A busy
   * Saturday peaks at 32 concurrent games, which at full card size is nearly
   * eight phone screens before the planning list even begins, and the list is
   * ranked, so the tail is the part nobody would switch to anyway.
   */
  const MAX_CARDS = 6;

  /**
   * Cards the viewer has explicitly opened or closed, by game id. Survives a poll,
   * since only the list around it re-renders.
   *
   * Absent means "whatever this card's default is", which is why both helpers take
   * that default. The hero starts open and everything else starts folded, but
   * starting open is a default rather than a restriction: a card that looks like
   * every other card and ignores a tap is just a dead target.
   */
  let openCards = $state<Record<string, boolean>>({});
  /**
   * The game the viewer folded away *while it was the hero*, if any.
   *
   * Held apart from `openCards` because the hero slot and the list below default
   * the opposite ways, open and closed, while both key off the game id. Sharing
   * one map meant folding a game down in the list and then watching it climb to
   * the top produced a folded hero: the old explicit "closed" traveled with the
   * game into a slot whose whole point is that it starts open. Keyed by id rather
   * than a bare flag so that when a different game takes the top slot it opens,
   * which is the useful behavior when the board has just changed its mind about
   * what you should be watching.
   */
  let heroFolded = $state<string | null>(null);
  let showAllLive = $state(false);
  let showAllRecent = $state(false);
  const cardOpen = (id: string, fallback: boolean) => openCards[id] ?? fallback;
  const toggleCard = (id: string, fallback: boolean) =>
    (openCards[id] = !cardOpen(id, fallback));

  /** Day keys the user has expanded past MAX_PER_DAY. */
  let expanded = $state<Record<string, boolean>>({});

  /**
   * Which control has its panel down. Owned here rather than by each control,
   * because they share a row: two panels open at once would overlap, and a panel
   * that is a flex sibling of its own button wedges the row apart when it opens.
   */
  let openPanel = $state<"favorites" | "market" | "spoilers" | "alerts" | "delay" | null>(null);

  /**
   * The last market the board resolved, kept across tab switches.
   *
   * `snapshot.market` is null on the college tab, because splitting a slate by
   * market is an NFL-only problem. Reading it directly meant a subscription made
   * from the college tab registered no market at all, which silently disabled the
   * one gate that stops alerts for games you cannot watch.
   */
  let lastMarketZip = $state<string | null>(null);
  $effect(() => {
    const zip = snapshot?.market?.zip;
    if (zip) lastMarketZip = zip;
  });

  function togglePanel(which: "favorites" | "market" | "spoilers" | "alerts" | "delay"): void {
    openPanel = openPanel === which ? null : which;
  }

  /*
   * The settings collapse, and a summary line stands in for them.
   *
   * Four controls already wrap on a phone once a couple of conferences are
   * picked, and every new setting makes that worse. Hiding them behind a button
   * would cost the thing the row was actually good at, which is saying what the
   * board is currently set to without opening anything, so the summary keeps that
   * in a fraction of the width: one small line that truncates rather than wraps,
   * however much is added to it later.
   *
   * A "something is non-default" marker was the first idea and is useless here,
   * because everything is non-default. Saying *what* is set costs barely more
   * room and is worth incomparably more.
   */
  let settingsOpen = $state(false);
  let helpOpen = $state(false);

  function toggleSettings(): void {
    settingsOpen = !settingsOpen;
    // A panel left open underneath would otherwise reappear on the next expand.
    if (!settingsOpen) openPanel = null;
  }

  const settingsSummary = $derived.by(() => {
    const parts: string[] = [];
    const favorites = prefs.favorites[prefs.league] ?? [];
    /* Listed while the list is short enough to be worth reading, counted after.
       Naming six conferences pushes the market and the alert count off the end,
       which lets the least important setting crowd out the rest. */
    if (favorites.length > 3) parts.push(`${favorites.length} conferences`);
    else if (favorites.length > 0) parts.push(favorites.join(", "));
    if (prefs.league === "nfl") {
      /* The viewer's own setting first: the resolved market is null until a
         snapshot carries one, which on a quiet morning may be never, and the
         summary would then omit a postal code the chip beside it is displaying. */
      if (prefs.marketOff) parts.push("no market");
      else if (prefs.zip) parts.push(prefs.zip);
      else if (snapshot?.market?.marketName) parts.push(snapshot.market.marketName);
      else if (snapshot?.market?.city) parts.push(snapshot.market.city);
      else if (snapshot?.market?.zip) parts.push(`${snapshot.market.zip} (detected)`);
    }
    const alerts = prefs.alerts[prefs.league] ?? [];
    if (alerts.length > 0) parts.push(`${alerts.length} alert${alerts.length === 1 ? "" : "s"}`);
    /* The delay is deliberately absent: the status indicator already says "35s
       behind" a few pixels away, and the same fact twice in adjacent rows is
       noise rather than reassurance. */
    return parts.join(" · ");
  });

  /*
   * Both leagues run at once, and each keeps two snapshots.
   *
   * `latest` is the truth as received, `boards` is what a viewer would see, which
   * may be several seconds older. They have to be separate: a stream message
   * carries a delta applied to the *previous* snapshot, so applying it to the
   * delayed copy would build every update on stale state. `latest` is deliberately
   * not reactive, since nothing renders from it.
   *
   * Per league rather than per tab, because tearing this down on a tab switch was
   * itself a spoiler: the freshly fetched board arrived with nothing older to hold
   * it against and went straight to screen undelayed. Keeping the other league
   * streaming in the background costs one connection and a few dozen kilobytes,
   * and means switching tabs shows a board that has been quietly running behind
   * all along rather than one that jumps to live.
   */
  const LEAGUES: League[] = ["nfl", "cfb"];
  let latest: Record<League, Snapshot | null> = { nfl: null, cfb: null };
  let held = $state<Record<League, Array<{ at: number; snap: Snapshot }>>>({ nfl: [], cfb: [] });
  let boards = $state<Record<League, Snapshot | null>>({ nfl: null, cfb: null });
  let errors = $state<Record<League, string | null>>({ nfl: null, cfb: null });
  /**
   * Leagues whose next snapshot must go straight to the screen.
   *
   * Changing the market re-asks the server for a differently annotated board, and
   * the answer was going into the delay queue behind fifteen seconds of football.
   * The board kept its old blackouts and the chip kept naming the old market, so
   * clearing or redetecting looked like it had done nothing until the page was
   * reloaded, which bypasses the queue by starting empty.
   *
   * The delay exists so the board does not spoil a broadcast. It was never meant
   * to decide when the viewer's own settings take effect.
   */
  let showNext: Record<League, boolean> = { nfl: false, cfb: false };
  /**
   * The build being served, taken from the feed rather than from the board.
   *
   * Everything else here is allowed to run behind so it does not spoil a
   * broadcast. This is not about the game: holding it back would mean a deploy
   * went unannounced for up to two minutes, and at that point the delay control
   * is deciding when somebody hears about a new version of the app, which is none
   * of its business. Server-wide rather than per league, and carried by both the
   * poll and the stream.
   */
  let latestBuild = $state<string | null>(null);
  /**
   * When the feed last spoke, as opposed to what the board is showing.
   *
   * The status line is a health indicator, so it has to read the feed. Taken from
   * the delayed board it reports the delay instead: at 35 seconds it said "35s
   * ago" while updates were arriving every two, which looks exactly like a stalled
   * connection. The delay is a separate fact and gets its own, quieter label.
   */
  let feedUpdatedAt = $state<Record<League, string | null>>({ nfl: null, cfb: null });

  const snapshot = $derived(boards[prefs.league]);
  const loadError = $derived(errors[prefs.league]);
  const loading = $derived(boards[prefs.league] === null && errors[prefs.league] === null);

  /**
   * Takes a freshly received snapshot and decides when it is allowed on screen.
   *
   * With no delay this is the old behavior exactly, assignment and nothing else.
   * With one, the snapshot waits its turn in a queue and `release` promotes it.
   */
  function receive(next: Snapshot): void {
    const league = next.league;
    latest[league] = next;
    errors[league] = null;
    if (next.build) latestBuild = next.build;
    feedUpdatedAt[league] = next.updatedAt;
    /*
     * Straight to screen when the delay is off, when this league has never been
     * shown, or when a setting has just changed and is waiting to be obeyed. The
     * second is the one remaining way to be spoiled, and only ever once: a blank
     * board for the length of the delay would be worse than starting level.
     */
    if (prefs.delaySeconds <= 0 || boards[league] === null || showNext[league]) {
      showNext[league] = false;
      held[league] = [];
      boards[league] = next;
      now = Date.now();
      return;
    }
    held[league] = [...held[league], { at: Date.now(), snap: next }];
  }

  /**
   * Promotes whatever has waited long enough, skipping anything it overtook.
   *
   * Only the newest eligible snapshot is shown: the ones behind it describe
   * moments that have already passed, and rendering each in turn would replay the
   * game in fast-forward rather than delay it.
   */
  function release(at: number): void {
    const cutoff = at - prefs.delaySeconds * 1000;
    for (const league of LEAGUES) {
      const queue = held[league];
      if (queue.length === 0) continue;
      let promoted: Snapshot | null = null;
      let i = 0;
      while (i < queue.length && queue[i].at <= cutoff) {
        promoted = queue[i].snap;
        i += 1;
      }
      if (i > 0) held[league] = queue.slice(i);
      if (promoted !== null) {
        boards[league] = promoted;
        now = Date.now();
      }
    }
  }
  /**
   * The league with football on, when exactly one of them has any.
   *
   * `undefined` until both boards have loaded, which matters: deciding from the
   * first to arrive would sometimes pick a league because the other had not
   * answered yet rather than because it had nothing on.
   */
  const onlyLive = $derived.by(() => {
    const nfl = boards.nfl;
    const cfb = boards.cfb;
    if (nfl === null || cfb === null) return undefined;
    const nflLive = nfl.live.length > 0;
    const cfbLive = cfb.live.length > 0;
    if (nflLive === cfbLive) return null;
    return nflLive ? "nfl" : "cfb";
  });

  /*
   * Opening the app on a Sunday should not show a college tab with nothing on it
   * because that is where the tab was left in September.
   *
   * So when one league has games and the other does not, the board picks that one
   * and persists it, which makes it a real selection rather than a hint. Two
   * things stop it being annoying. A tap always wins, and holds until the
   * situation itself changes, so the board never argues with somebody who has just
   * told it where they want to be. And the pick only ever fires on a *transition*:
   * re-evaluating continuously would drag the tab away mid-glance every time the
   * last game of an afternoon ended.
   */
  let settledOn: League | null | undefined = undefined;

  $effect(() => {
    const only = onlyLive;
    /*
     * Nothing on anywhere is not an answer, so it neither moves the tab nor
     * clears a tap. Treating it as a change was the first attempt and it fell
     * over: the count dips through zero whenever an afternoon's last game ends,
     * and every dip revoked the viewer's own choice and re-picked for them. Only
     * a change in *which* league has the football is a change in the answer.
     */
    if (only === undefined || only === null) return;
    if (only !== settledOn) {
      settledOn = only;
      // A different league has the games now, so an earlier tap does not speak
      // to the situation the viewer is actually in.
      tabChoice.manual = false;
    }
    if (tabChoice.manual) return;
    setLeague(only, false);
  });

  // Ticks once a second purely so the "updated Ns ago" label stays honest.
  let now = $state(Date.now());

  async function refresh(league: League) {
    try {
      receive(await fetchSnapshot(league, prefs.zip, prefs.marketOff));
    } catch (err) {
      errors[league] = err instanceof Error ? err.message : String(err);
      now = Date.now();
    }
  }

  /*
   * Deliberately does not read `prefs.league`.
   *
   * Both leagues stay connected whichever tab is showing, so switching tabs tears
   * nothing down and rebuilds nothing. The market settings do belong here, since
   * availability is resolved server side and changing them has to reopen both.
   */
  $effect(() => {
    const zip = prefs.zip;
    const marketOff = prefs.marketOff;
    // Whatever is queued describes the market that was just abandoned.
    showNext = { nfl: true, cfb: true };

    const stops = LEAGUES.map((league) => {
      void refresh(league);
      /* The stream is the fast path and the poll is the floor. Keeping both means a
         proxy that buffers event streams, or a browser without EventSource, costs
         freshness rather than the board, and the poll is also what repairs a stream
         that reconnected having missed something. */
      // Applied to `latest`, never to what is on screen, so a delayed board still
      // builds each delta on the state the server actually sent it against.
      const stop = openBoardStream(league, zip, marketOff, (apply) => {
        receive(apply(latest[league]));
      });
      const poll = setInterval(() => void refresh(league), REFRESH_MS);
      return () => {
        stop();
        clearInterval(poll);
      };
    });
    return () => stops.forEach((stop) => stop());
  });

  $effect(() => {
    const tick = setInterval(() => {
      now = Date.now();
      // Same timer as the "updated Ns ago" label, so the delay costs no extra one.
      release(now);
    }, 1000);
    return () => clearInterval(tick);
  });

  /* Lowering the delay has to take effect at once rather than at the next tick,
     since the whole control is built to be nudged while watching. */
  $effect(() => {
    prefs.delaySeconds;
    release(Date.now());
  });

  /* Debounced, because one of these controls is a slider: telling the server on
     every intermediate value would be a request per pixel dragged. The channel
     preference rides along rather than opening a second path to say one thing. */
  $effect(() => {
    const seconds = prefs.delaySeconds;
    const inMarketFirst = prefs.inMarketFirst;
    const noSpoilers = [...prefs.noSpoilers];
    const timer = setTimeout(() => {
      void updateBoardSettings({
        wants: prefs.alerts,
        zip: lastMarketZip,
        favorites: prefs.favorites,
        delaySeconds: seconds,
        inMarketFirst,
        noSpoilers,
      });
    }, 1500);
    return () => clearTimeout(timer);
  });

  /**
   * A nudge, not an override. A favored conference should float a game up past
   * its neighbours without letting a dull one outrank a genuinely great game.
   */
  /**
   * Graded, not binary. An all-AFC game is more of an AFC game than a
   * cross-conference one, so it should outrank it, but the second team adds less
   * than the first did: one team you care about is already most of the reason to
   * watch. So the order is both teams, then one, then neither.
   */
  /*
   * A tiebreaker, not a thumb on the scale.
   *
   * This was [0, 8, 13]. Measured over every minute with more than one game live,
   * a 13-point bonus could change which game the board put top in 71% of them,
   * reached a median of three games down the list, and was 31% of a p90 rating. It
   * was not breaking ties, it was deciding the answer, which is the opposite of
   * what a board that tells you what to watch is for. It also meant two people
   * looking at the same slate were shown different games.
   *
   * At [0, 1, 2] it only matters between games already within two points of each
   * other, which on this scale is a coin flip.
   */
  const FAVORITE_BONUS = [0, 1, 2];

  function favoriteBoost(game: Game): number {
    const matches =
      Number(isFavorite(prefs.league, game.home.conferenceName)) +
      Number(isFavorite(prefs.league, game.away.conferenceName));
    return FAVORITE_BONUS[matches];
  }

  // The server ships every score component and the browser recombines them, so
  // favorites reorder the board without a round trip.
  function scoreOf(game: Game): number {
    if (!game.score) return 0;
    // One fixed weighting. Three selectable profiles shipped for a while and
    // measurably did nothing: across a full Saturday the top game was identical
    // under all three, nothing moved more than two places, and what movement
    // there was landed at positions nine through twelve. Tune these numbers
    // instead of asking the reader to.
    const base = combine(game.score, WEIGHTS, game.score.maxTotal);
    return Math.min(100, base + favoriteBoost(game));
  }

  function anticipationOf(game: Game): number {
    return Math.min(100, (game.anticipation ?? 0) + favoriteBoost(game));
  }

  /**
   * A game the viewer's own channels are not carrying still gets its real score,
   * because the score says how good the game is. Whether it also stops being
   * offered first is the viewer's call: sorting it down assumes they only care
   * about a game they can watch on an aerial, and a Sunday Ticket subscriber can
   * watch every one of them. Off, everything ranks on merit alone and the channel
   * chip is what says a game is out of market.
   */
  function watchable(game: Game): boolean {
    if (!prefs.inMarketFirst) return true;
    return game.marketStations === null || game.marketStations.length > 0;
  }

  function byWatchableThen(
    rank: (game: Game) => number,
  ): (a: Game, b: Game) => number {
    return (a, b) =>
      Number(watchable(b)) - Number(watchable(a)) || rank(b) - rank(a);
  }

  /**
   * Whether the slate actually contains market-split games, so the nudge only
   * appears when it would change something. A Thursday night slate is one
   * national game with nothing to resolve.
   */
  const marketMatters = $derived(
    snapshot?.market == null &&
      !prefs.marketOff &&
      [...(snapshot?.live ?? []), ...(snapshot?.upcoming ?? [])].some(
        (g) => (g.regionalPeers ?? 0) > 1,
      ),
  );



  /** Conferences present in the current league's slate, for the preference list. */
  const conferences = $derived.by(() => {
    const all = [
      ...(snapshot?.live ?? []),
      ...(snapshot?.upcoming ?? []),
      ...(snapshot?.recent ?? []),
    ];
    const names = new Set<string>();
    for (const g of all) {
      if (g.home.conferenceName) names.add(g.home.conferenceName);
      if (g.away.conferenceName) names.add(g.away.conferenceName);
    }
    return [...names].sort();
  });

  /*
   * Hidden games sink, before anything else is considered.
   *
   * Position is itself a spoiler: a board that sorts by how good a game is says
   * how good the game is, and a card sitting second on a busy Sunday has already
   * told you it is close. The bottom is the only place that says nothing.
   */
  const spoilerLast = (rank: (game: Game) => number) => (a: Game, b: Game) =>
    Number(isHidden(a)) - Number(isHidden(b)) || rank(b) - rank(a);

  const live = $derived.by(() =>
    [...(snapshot?.live ?? [])].sort(
      (a, b) =>
        Number(isHidden(a)) - Number(isHidden(b)) ||
        Number(watchable(b)) - Number(watchable(a)) ||
        scoreOf(b) - scoreOf(a),
    ),
  );

  const top = $derived(live[0] ?? null);
  const topScore = $derived(top ? scoreOf(top) : 0);
  /* The label has to match what is actually on. Shouting "turn this on" at a
     mediocre 30 on a quiet weeknight is the same overpromise as calling a
     15-minute window a trend.

     Both superlatives need a field to be superlative over. On a Thursday there is
     one game, and "best of what is on" ranks it against nothing: it reads as a
     sentence assembled without looking at the board it describes. "Turn this on"
     survives because it is an instruction rather than a comparison. */
  /* The bars come from what the board actually shows. Measured over every minute
     of live football on record, the old 75 and 55 left the apologetic label up
     81% of the time in college and 84% in the NFL, because a one-score game only
     medians 40 in the fourth quarter and 64 inside the last two minutes. At 55
     and 35 the three labels split roughly evenly, which is what a board that
     recommends things should sound like. */
  const heroLabel = $derived(
    top !== null && isHidden(top)
      ? // Every live game is one being kept quiet, so the hero slot is holding a
        // card with nothing on it. Any of the labels below would describe it.
        "NO SPOILERS"
      : topScore >= 55
        ? "TURN THIS ON"
        : live.length === 1
        ? "THE ONLY GAME ON"
        : topScore >= 35
          ? "BEST GAME ON"
          : "BEST OF WHAT IS ON",
  );
  const rest = $derived(live.slice(1));

  // No slice here any more: folding made the list cheap, so MAX_CARDS decides how
  // many show and the expander reaches the rest. Cutting at five before the
  // expander existed meant the server sent twelve and seven were unreachable.
  const recent = $derived([...(snapshot?.recent ?? [])].sort(spoilerLast(scoreOf)));
  // Grouped by day, days in chronological order, ranked within each day. You plan
  // Friday before you plan Saturday, so a better Saturday game must not outrank
  // an earlier day's games in the list.
  const upcomingByDay = $derived.by(() => {
    const groups = new Map<string, Game[]>();
    for (const game of snapshot?.upcoming ?? []) {
      const key = dayKey(game.startDate);
      const bucket = groups.get(key);
      if (bucket) bucket.push(game);
      else groups.set(key, [game]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, MAX_DAYS)
      .map(([key, games]) => {
        // Games the market is not carrying stay at the bottom either way: the
        // question "what is on next" only means the ones you could actually put
        // on. Sorting by time alone is enough to keep the best game first within
        // a kickoff slot, because the list arrives ranked and sort is stable.
        const ranked =
          prefs.upcomingOrder === "time"
            ? [...games].sort(
                (a, b) =>
                  Number(watchable(b)) - Number(watchable(a)) ||
                  Date.parse(a.startDate) - Date.parse(b.startDate),
              )
            : [...games].sort(byWatchableThen(anticipationOf));
        /*
         * Built from the whole day, not from the capped list, and shown without a
         * cap of its own.
         *
         * The point of the view is the shape of the day, and a cap defeats it: the
         * best six games on a Sunday can all be in the one o'clock window, which
         * would leave the afternoon and the night game missing entirely from a
         * grouping whose whole job is to show they exist. The grouping rule bounds
         * the size anyway, since a day only qualifies with four windows or fewer.
         */
        const grouped = windowsOf(games);
        const ordered =
          grouped === null ? [] : [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
        const names = windowLabels(ordered.map(([hour]) => hour));
        const windows =
          grouped === null
            ? null
            : ordered.map(([hour, inWindow], index) => {
                  const byRank = [...inWindow].sort(byWatchableThen(anticipationOf));
                  return {
                    key: hour,
                    // The broadcast name where there is one, and a time that covers
                    // every game in the window where there is not.
                    label: names[index] ?? windowTimeLabel(inWindow.map((g) => g.startDate)),
                    available: byRank.filter((g) => watchable(g)),
                    unavailable: byRank.filter((g) => !watchable(g)),
                  };
                });
        const showAll = expanded[key] === true;
        const shown = showAll ? ranked : ranked.slice(0, MAX_PER_DAY);
        return {
          key,
          /* Split rather than marked with a divider. A label above a row reads as
             belonging to that row, so with one game below it there was no way to
             tell whether it covered one or all of them. */
          available: shown.filter((g) => watchable(g)),
          unavailable: shown.filter((g) => !watchable(g)),
          windows,
          label: dayLabel(games[0].startDate),
          date: dayDate(games[0].startDate),
          total: ranked.length,
          hidden: Math.max(0, ranked.length - MAX_PER_DAY),
          showAll,
          games: shown,
        };
      });
  });

  /*
   * Whether grouping by window is worth offering at all.
   *
   * Only when some day on the board actually has windows. On a Sunday evening
   * with the night game left there is one window and nothing to group, and a
   * control that reorders nothing is a control that has to be explained.
   */
  const windowsOffered = $derived(upcomingByDay.some((day) => day.windows !== null));
  /* Chosen once and then the slate moved on. The preference is kept, so it comes
     back on its own next Sunday, but the list has to render as something today. */
  const groupByWindow = $derived(prefs.upcomingOrder === "window" && windowsOffered);

  const updatedLabel = $derived.by(() => {
    void now;
    const at = feedUpdatedAt[prefs.league];
    return at === null ? "never" : relativeTime(at);
  });
</script>

<header>
  <!-- One compact bar. The title and strapline used to cost ~110px of a phone
       screen to say something the user already knows, and an installed PWA
       already shows the app name in the task switcher. -->
  <div class="topbar">
    <LeagueTabs />
    <div class="status">
      {#if loadError}
        <span class="err">offline</span>
      {:else if snapshot?.error}
        <span class="err">ESPN error</span>
      {:else}
        <span class="ok"></span>
      {/if}
      <span class="mono updated">{updatedLabel}</span>
      {#if prefs.delaySeconds > 0}
        <!-- Deliberately quiet and deliberately separate. The dot and the time say
             the feed is alive; this says the board is standing back from it. -->
        <span class="mono behind" title="Board held {prefs.delaySeconds}s behind live"
          >−{prefs.delaySeconds}s</span
        >
      {/if}
      <!-- Last, not between the two. The time and the offset are one statement
           about the same thing, and a control wedged between them splits it. -->
      <button
        type="button"
        class="help-toggle"
        aria-expanded={helpOpen}
        aria-label="How this works"
        title="How this works"
        onclick={() => (helpOpen = !helpOpen)}>?</button
      >
    </div>
  </div>
  <div class="settings-bar">
    <button
      type="button"
      class="dd-toggle"
      aria-expanded={settingsOpen}
      onclick={toggleSettings}
    >
      Settings
      <span class="dd-caret" class:open={settingsOpen}>▾</span>
    </button>
    {#if !settingsOpen && settingsSummary}
      <span class="settings-summary">{settingsSummary}</span>
    {/if}
  </div>
  <HelpPanel open={helpOpen} onclose={() => (helpOpen = false)} />
  <div class="controls-row" hidden={!settingsOpen}>
    <FavoriteConferences
      {conferences}
      league={prefs.league}
      open={openPanel === "favorites"}
      ontoggle={() => togglePanel("favorites")}
    />
    {#if prefs.league === "nfl"}
      <MarketPicker
        stations={snapshot?.market?.stations ?? []}
        detected={snapshot?.market?.detected === true ? snapshot.market.zip : null}
        city={snapshot?.market?.city ?? null}
        marketName={snapshot?.market?.marketName ?? null}
        nudge={marketMatters}
        open={openPanel === "market"}
        ontoggle={() => togglePanel("market")}
        onclose={() => (openPanel = null)}
      />
      <!-- NFL only. The use case is a team somebody watches every week, recorded
           when they cannot watch it live, and a college team plays too few games
           to be followed that way. -->
      <NoSpoilers
        open={openPanel === "spoilers"}
        ontoggle={() => togglePanel("spoilers")}
      />
    {/if}
    <AlertsPicker
      league={prefs.league}
      marketZip={lastMarketZip}
      open={openPanel === "alerts"}
      ontoggle={() => togglePanel("alerts")}
    />
    <DelayPicker
      queued={held[prefs.league].length}
      open={openPanel === "delay"}
      ontoggle={() => togglePanel("delay")}
    />
  </div>
</header>

{#if loading}
  <p class="empty">Loading the slate...</p>
{/if}

{#if top}
  <section class="hero">
    <div class="hero-label">
      <span class="pill" class:hot={topScore >= 75} style="--pill: {scoreColor(topScore)}">
        {heroLabel}
      </span>
    </div>
    <GameCard
      game={top}
      score={scoreOf(top)}
      collapsible
      expanded={heroFolded !== top.id}
      ontoggle={() => (heroFolded = heroFolded === top.id ? null : top.id)}
    />
  </section>
{/if}

{#if rest.length}
  <section>
    <h2 class="section-head">Also live <span class="count">{rest.length}</span></h2>
    <div class="stack">
      <!-- Folded by default. The hero above is the answer to "what should I put
           on" and stays open; these are the alternatives, and a glance down a list
           of them is the question being asked here. -->
      {#each showAllLive ? rest : rest.slice(0, MAX_CARDS) as game (game.id)}
        <GameCard
          {game}
          score={scoreOf(game)}
          collapsible
          expanded={cardOpen(game.id, false)}
          ontoggle={() => toggleCard(game.id, false)}
        />
      {/each}
    </div>
    {#if rest.length > MAX_CARDS}
      <button type="button" class="show-all" onclick={() => (showAllLive = !showAllLive)}>
        {showAllLive ? "Show fewer" : `Show all ${rest.length}`}
      </button>
    {/if}
  </section>
{:else if !loading && !loadError && live.length === 0}
  <div class="panel">
    <strong>Nothing is live right now.</strong>
    <p class="hint">The board fills in once games kick off. What is coming up is below.</p>
  </div>
{/if}

<div class="two-col">
  {#if upcomingByDay.length}
    <section>
      <h2 class="section-head">
        Worth planning around
        <span class="order">
          <button
            type="button"
            class:on={prefs.upcomingOrder === "rank"}
            onclick={() => setUpcomingOrder("rank")}>Best</button
          ><button
            type="button"
            class:on={prefs.upcomingOrder === "time"}
            onclick={() => setUpcomingOrder("time")}>Time</button
          >{#if windowsOffered}<button
              type="button"
              class:on={prefs.upcomingOrder === "window"}
              onclick={() => setUpcomingOrder("window")}>Window</button
            >{/if}
        </span>
      </h2>
      {#each upcomingByDay as day (day.key)}
        <div class="day-group">
          <h3 class="day-head">
            {day.label}
            <span class="day-date">{day.date}</span>
          </h3>
          <div class="panel tight">
            {#if groupByWindow && day.windows}
              {#each day.windows as slot (slot.key)}
                <p class="window-head">{slot.label}</p>
                <div class="tier">
                  {#each slot.available as game (game.id)}
                    <UpcomingRow {game} score={anticipationOf(game)} {now} />
                  {/each}
                </div>
                {#if slot.unavailable.length > 0}
                  <div class="blocked">
                    <p class="cutoff">
                      not on your channels
                      <svg class="down" viewBox="0 0 10 12" aria-hidden="true">
                        <path d="M5 1 V9 M1.5 6 L5 9.5 L8.5 6" />
                      </svg>
                    </p>
                    {#each slot.unavailable as game (game.id)}
                      <UpcomingRow {game} score={anticipationOf(game)} {now} />
                    {/each}
                  </div>
                {/if}
              {/each}
            {:else}
            <!-- Wrapped so the last available row is a :last-child and drops its
                 bottom border. That border drew a line directly above the header
                 below, which together with the first unavailable row's own border
                 boxed the two into what looked like a single entry. A section
                 header should sit in whitespace, not inside a cell. -->
            <div class="tier">
              {#each day.available as game (game.id)}
                <UpcomingRow {game} score={anticipationOf(game)} {now} />
              {/each}
            </div>
            {#if day.unavailable.length > 0}
              <div class="blocked">
                <p class="cutoff">
                  not on your channels
                  <svg class="down" viewBox="0 0 10 12" aria-hidden="true">
                    <path d="M5 1 V9 M1.5 6 L5 9.5 L8.5 6" />
                  </svg>
                </p>
                {#each day.unavailable as game (game.id)}
                  <UpcomingRow {game} score={anticipationOf(game)} {now} />
                {/each}
              </div>
            {/if}
            {/if}
            {#if (day.hidden > 0 || day.showAll) && !groupByWindow}
              <button
                type="button"
                class="show-all"
                onclick={() => (expanded[day.key] = !day.showAll)}
              >
                {day.showAll ? "Show fewer" : `Show all ${day.total}`}
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </section>
  {/if}

  {#if recent.length}
    <section>
      <!-- "Recently", not "just": the window is eighteen hours from kickoff, so a
           Thursday night game is still here on Friday afternoon and a 1:00 Sunday
           game is still here at bedtime. -->
      <h2 class="section-head">Recently finished, best first</h2>
      <div class="stack">
        {#each showAllRecent ? recent : recent.slice(0, MAX_CARDS) as game (game.id)}
          <!-- Not collapsible. Everything a folded card hides is live-only: the win
               probability, the clock line and the last play are all gated on the
               game being in progress, so folding a final toggled the network chip
               and nothing else. The list still caps at MAX_CARDS, which is where
               the vertical space actually was. -->
          <GameCard {game} score={scoreOf(game)} variant="final" />
        {/each}
      </div>
      {#if recent.length > MAX_CARDS}
        <button type="button" class="show-all" onclick={() => (showAllRecent = !showAllRecent)}>
          {showAllRecent ? "Show fewer" : `Show all ${recent.length}`}
        </button>
      {/if}
    </section>
  {/if}
</div>

<UpdatePrompt serverBuild={latestBuild} />

<style>
  header {
    margin-bottom: 16px;
  }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  /* Scoped under .panel to outrank ".panel p", which sets the day cards' body
     text to 13px and was silently winning against a bare .cutoff.
     No rule of its own: the rows above and below already carry full-width
     borders, and a second half-width line butting into them read as a mistake. */
  /* Styled as a section header, because that is what it is. Earlier attempts
     dressed it as a caption and then as a banded block, and both read as
     belonging to the row directly beneath rather than to everything below.
     Matching the idiom this page already uses for "Worth planning around",
     smaller since this one sits inside a card, settles what it refers to. The
     space above does the work: it separates the label from the rows it is not
     about. Scoped under .panel to outrank ".panel p", which sets card body text
     to 13px and was silently winning against a bare .cutoff. */
  .panel .cutoff {
    /* Centered as a flex row rather than by vertical-align. The marker is a
       replaced element aligned on the baseline, which left it four pixels above
       the text's optical center; these are uppercase with no descenders, so
       centering on the line box lands within half a pixel of the ink. */
    display: flex;
    align-items: center;
    /* Bounded top and bottom, so it is an entry in the list rather than the top
       of the entry below it. A single rule above was not enough: it left the
       header and the first unavailable row sharing one cell, which is the thing
       that kept reading wrong. Every other row here is delimited by lines, so a
       header has to be too. The available rows are wrapped so the last one drops
       its own bottom border, which keeps this to one line rather than two. */
    margin: 0;
    padding: 9px 4px;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-faint);
  }
  /* Drawn rather than set in a glyph. The arrow characters render tall and thin
     at this size, and a solid triangle is the dropdown caret used everywhere else
     on this page. This is short, thick, and unambiguously an arrow, and it does
     not vary with whatever font happens to be resolved. */
  .panel .cutoff .down {
    width: 9px;
    height: 11px;
    margin-left: 5px;
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.7;
  }
  .settings-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
    /* The row must never be the thing that makes the header taller, so the
       summary is given a single line and told to give up rather than wrap. */
    min-width: 0;
  }
  .settings-summary {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 12px;
    color: var(--text-faint);
  }
  /* `display: flex` beats the `hidden` attribute on its own, so the row stays on
     screen unless this says otherwise. Hidden rather than removed from the DOM so
     the pickers keep their own state, a half-typed postal code included. */
  .controls-row[hidden] {
    display: none;
  }
  .controls-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
  }
  /* An open panel takes a whole row of its own and is ordered after both buttons,
     so it pushes the board down rather than covering it, and never wedges itself
     between the two controls the way a plain flex sibling did. */
  .controls-row :global(.dd-panel) {
    order: 1;
    flex-basis: 100%;
  }
  .status {
    display: flex;
    /*
     * Baseline, not center. These are two pieces of text at different sizes, and
     * centring aligns their boxes while the eye reads their baselines, so the
     * smaller one sits high however its padding is tuned. Getting the two to line
     * up by adjusting padding worked only for one pair of font sizes and was
     * luck rather than a rule.
     */
    align-items: baseline;
    gap: 8px;
    font-size: 12px;
    color: var(--text-faint);
  }
  /* The dot has no text, so it has no baseline worth aligning to. */
  .status > .ok,
  .status > .err {
    align-self: center;
  }
  .help-toggle {
    /* Sits in a row of read-only readings, so it has to say it is a control. It
       borrows the dimmer text and border of the settings buttons rather than the
       faint gray of the status beside it, which made it read as another value. */
    width: 17px;
    height: 17px;
    padding: 0;
    border: 1px solid var(--border-hi);
    border-radius: 50%;
    background: none;
    color: var(--text-dim);
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    align-self: center;
    flex: none;
    transition: color 120ms ease, border-color 120ms ease;
  }
  .help-toggle:hover {
    color: var(--text);
  }
  /*
   * Open is filled, not merely brighter.
   *
   * Sharing one style with `:hover` made closing the panel look like it had not
   * worked: the pointer is still on the button afterwards, so the highlight stays
   * and reads as state rather than as hover. They have to be different marks.
   */
  .help-toggle[aria-expanded="true"] {
    color: var(--bg);
    background: var(--text-dim);
    border-color: var(--text-dim);
  }
  .behind {
    /* Symmetric padding, because the row aligns on the baseline now and the box
       can simply sit around its own text. Tuning padding to fake that was the
       first attempt and only held for one pair of font sizes. */
    padding: 1px 6px;
    border: 1px solid var(--border-hi);
    border-radius: 999px;
    font-size: 11px;
    line-height: 1.35;
    opacity: 0.75;
  }
  .ok {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--good);
  }
  .err {
    color: var(--hot);
    font-weight: 600;
  }
  .hero {
    margin-bottom: 28px;
  }
  .hero-label {
    margin-bottom: 8px;
  }
  .pill {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.14em;
    color: var(--pill);
    border: 1px solid var(--pill);
    padding: 3px 9px;
    border-radius: 999px;
    opacity: 0.9;
  }
  .pill.hot {
    background: rgba(255, 77, 79, 0.1);
    opacity: 1;
  }
  /* Sits in the heading rather than the top controls row: it changes this list
     only, and putting it here keeps it next to what it affects. */
  .order {
    margin-left: auto;
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 7px;
    overflow: hidden;
  }
  .order button {
    background: none;
    border: none;
    color: var(--text-faint);
    font: inherit;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 4px 9px;
    cursor: pointer;
  }
  .order button.on {
    background: var(--bg-card-hi, var(--bg-raised));
    color: var(--text);
  }
  .section-head {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-faint);
    margin: 26px 0 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .count {
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0 7px;
    font-size: 11px;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .panel {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 18px;
    /* So a full-bleed child cannot square off the card's rounded corners. */
    overflow: hidden;
  }
  .panel.tight {
    padding: 4px 14px;
  }
  @media (max-width: 520px) {
    .panel {
      padding: 14px 12px;
    }
    .panel.tight {
      padding: 4px 10px;
    }
  }
  .show-all {
    display: block;
    width: 100%;
    background: none;
    border: none;
    color: var(--text-dim);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    padding: 9px 0;
    cursor: pointer;
  }
  /*
   * The rule belongs only inside the planning panel, where the button sits
   * directly beneath the rows and the line divides them. Under a stack of live or
   * finished cards there is a gap either side of it, so a full-width border floats
   * in empty space and reads as a stray horizontal rule rather than a divider.
   */
  .day-group .show-all {
    border-top: 1px solid var(--border);
  }
  @media (hover: hover) {
    .show-all:hover {
      color: var(--text);
    }
  }
  .day-group + .day-group {
    margin-top: 14px;
  }
  /* The same mark as the "not on your channels" divider, because it does the same
     job: an entry in the list that labels the rows under it rather than a title
     floating above them. Scoped under .panel for the same reason, to outrank
     ".panel p". No arrow, though: that one points down because it is a demotion
     and the rows below are the ones being pushed away, where a window heading is
     simply the name of what follows. */
  .panel .window-head {
    display: flex;
    align-items: center;
    margin: 0;
    padding: 9px 4px;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-faint);
  }
  /* The card's own edge is already a line. A second one directly under it reads
     as an empty row. */
  .panel .window-head:first-child {
    border-top: none;
    padding-top: 4px;
  }
  .day-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 13px;
    font-weight: 650;
    margin: 0 0 6px 2px;
  }
  .day-date {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-faint);
  }
  .panel p {
    margin: 6px 0 0;
    color: var(--text-dim);
    font-size: 13px;
  }
  .hint {
    color: var(--text-faint) !important;
  }
  .empty {
    color: var(--text-faint);
  }
  /* Full width, stacked. Side by side starved the matchup column and truncated
     team names on anything but a very wide window. */
  .two-col {
    display: block;
  }
</style>
