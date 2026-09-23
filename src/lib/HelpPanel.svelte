<script lang="ts">
  /*
   * What the board is doing, in the words somebody using it would use.
   *
   * Deliberately not the design notes and deliberately not the README. Those
   * explain the reasoning to whoever maintains this; a reader here wants to know
   * why the number on the left is 78 and why a game they can watch is above one
   * they cannot. No thresholds, no component names, no arithmetic.
   *
   * This has to be edited whenever a feature changes what the board *appears* to
   * do. It is the only explanation anybody actually reads, so a stale line here
   * is worse than a stale line anywhere else in the repository.
   */
  let { open = false, onclose }: { open?: boolean; onclose?: () => void } = $props();
</script>

{#if open}
  <div class="help">
    <div class="head">
      <h2>How this works</h2>
      <button type="button" class="close" onclick={() => onclose?.()} aria-label="Close">×</button>
    </div>

    <p class="lede">
      Every game on now gets a rating out of 100, and the board sorts by it. The point is to answer
      one question: of everything on television right now, what should be on yours.
    </p>

    <h3>What the rating is</h3>
    <p>
      Mostly how close the game is, weighted by how late it is. A tie in the first quarter is not the
      same event as a tie with ninety seconds left, so the same scoreline is worth more the later it
      happens.
    </p>
    <p>Four things can take over when closeness alone misses the point:</p>
    <ul>
      <li>A one-score game in the last few minutes, with the team behind holding the ball.</li>
      <li>An underdog well ahead of what the bookmakers expected, whether or not it is close.</li>
      <li>A finished game a real underdog won, because the recap is asking what mattered.</li>
      <li>
        A game that has only just kicked off keeps what it was billed as until it shows you
        otherwise. That fades away by halftime, and faster if it turns into a blowout.
      </li>
    </ul>

    <h3>What else moves it</h3>
    <ul>
      <li>How much of the country cares: rankings, records, the broadcast slot.</li>
      <li>How fast points are going up.</li>
      <li>What the game decides, like a conference or division fixture.</li>
      <li>How far the odds have swung in the last fifteen minutes.</li>
    </ul>
    <p>
      A game at halftime or in a weather delay keeps its rating but waits below the games being
      played, and climbs back when play resumes.
    </p>

    <h3>Your settings change it</h3>
    <ul>
      <li>
        <strong>Favorites.</strong> Breaks a tie toward a conference you follow. Deliberately tiny,
        so it separates two games that were already level rather than deciding what you watch.
      </li>
      <li>
        <strong>Market.</strong> Your postal code works out which of your own channels is showing
        each game, in both leagues. The chip then names the station, or marks the game as one your
        channels are not carrying. Nothing is pushed down for it unless you ask.
      </li>
      <li>
        <strong>My channels first.</strong> Sorts games your channels are not carrying to the bottom,
        fades them, and leaves them out of notifications. Off by default, since a good game is worth
        following whether or not you can watch it, and a league subscription makes all of them
        watchable anyway.
      </li>
      <li>
        <strong>No spoilers.</strong> Pick any NFL teams whose games you watch in full, later. While
        one of those games is on, the board hides the score, the clock, the rating and everything
        else that says how it is going, drops it to the bottom of the list, and sends you no
        notifications about it. Tap the card to look anyway; it asks first, and it forgets you
        looked as soon as you reload. Games that have not kicked off are left alone.
      </li>
      <li>
        <strong>Delay.</strong> Television runs behind live, so the board can spoil the game it is
        meant to help you watch. Hold it back by however many seconds your feed is behind. Nudge it
        until the score changes on screen at the same moment you see it. Notifications wait too.
        Opening the app always shows the latest: the hold is for while you are watching.
      </li>
    </ul>

    <h3>Notifications</h3>
    <p>
      Two kinds, and a handful a day at most. Something already on is worth switching to: it has
      become the best thing available, it is turning into a classic, or an underdog is doing
      something it should not be. Or something is about to start: the best game of a busy kickoff
      window, or the only game in its slot. Each one names the channel, and says when a game is out
      of market. Turn on My channels first and those stop arriving altogether, and a team on your no
      spoilers list is never the subject of one. Nor is a game at halftime or in a delay, since you
      could not switch to it.
    </p>

    <h3>The other two lists</h3>
    <p>
      <strong>Worth planning around</strong> rates games that have not kicked off, on the matchup
      rather than on anything that has happened. Sort it by rating, by time, or, on a day whose
      kickoffs fall into proper windows, by window: an NFL Sunday reads as early, late and
      primetime, which is how everybody talks about it anyway.
      <strong>Recently finished</strong> is the recap, and asks whether a game mattered rather than
      whether it stayed close, so a big upset ranks alongside a thriller.
    </p>

    <p class="foot">
      Ratings are worth comparing within a tab, not across them. College and the NFL produce
      different spreads of numbers, and a game that has not started is on its own scale again.
      There is no number at which a game becomes worth watching: the colour runs as a continuum,
      and a good game in amber is a good game.
    </p>
  </div>
{/if}

<style>
  .help {
    margin-top: 14px;
    padding: 14px 16px 16px;
    border: 1px solid var(--border-hi);
    border-radius: 10px;
    background: var(--bg-card);
    font-size: 13px;
    line-height: 1.5;
    color: var(--text);
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  h2 {
    margin: 0;
    font-size: 15px;
  }
  h3 {
    margin: 16px 0 4px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
  }
  p {
    margin: 0 0 8px;
  }
  .lede {
    margin-top: 6px;
    color: var(--text);
  }
  ul {
    margin: 0 0 8px;
    padding-left: 18px;
  }
  li {
    margin-bottom: 4px;
  }
  .foot {
    margin: 16px 0 0;
    padding-top: 10px;
    border-top: 1px solid var(--border);
    color: var(--text-faint);
  }
  .close {
    flex: none;
    border: none;
    background: none;
    color: var(--text-faint);
    font-size: 20px;
    line-height: 1;
    padding: 0 2px;
    cursor: pointer;
  }
</style>
