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

    <h3>Your settings change it</h3>
    <ul>
      <li>
        <strong>Favourites.</strong> Games involving a conference you follow get a boost up the board.
      </li>
      <li>
        <strong>Market.</strong> Games your channels are not carrying keep their real rating but stop
        being offered first, because recommending something you cannot watch is no recommendation.
      </li>
      <li>
        <strong>Delay.</strong> Television runs behind live, so the board can spoil the game it is
        meant to help you watch. Hold it back by however many seconds your feed is behind. Nudge it
        until the score changes on screen at the same moment you see it. Notifications wait too.
      </li>
    </ul>

    <h3>Notifications</h3>
    <p>
      Only when something is worth leaving what you are watching for: a game becoming the best thing
      on, one turning into a classic, an underdog doing something it should not be, or the pick of a
      kickoff window starting. A handful a day at most, and never for a game your channels are not
      carrying.
    </p>

    <h3>The other two lists</h3>
    <p>
      <strong>Worth planning around</strong> rates games that have not kicked off, on the matchup
      rather than on anything that has happened.
      <strong>Just finished</strong> is the recap, and asks whether a game mattered rather than
      whether it stayed close, so a big upset ranks alongside a thriller.
    </p>

    <p class="foot">
      Ratings are worth comparing within a tab, not across them. College and the NFL produce
      different spreads of numbers, and a game that has not started is on its own scale again.
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
