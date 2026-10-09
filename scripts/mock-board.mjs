/**
 * Serves the built board against a fixed slate, for capturing the README
 * screenshots.
 *
 * Screenshots need a busy live board, and a live board only exists while games
 * are being played. Waiting for a Sunday to photograph a UI change is not a
 * workflow, and the alternative of shipping stale images is worse: the pair in
 * docs/ went three features out of date before anyone noticed.
 *
 * Everything but the scoring comes from `scripts/screenshot-slate.json`, recorded
 * once from ESPN: teams, pregame records, ranks, closing lines, networks, nfelo
 * strength, which games make the live board and in what order, and the listings
 * for the postal code in the pictures. So serving needs no network, and the same
 * games appear every time. Micah, on why: "there should be practically nothing to
 * re-build/re-discover when we do these screenshots. it should just be as simple
 * as: run the app and take them". The ratings are still produced by importing the
 * actual scoring model rather than being stored, so the pictures follow tuning and
 * a screenshot cannot show a number the board would never produce. The live
 * scores, clocks and situations are invented, and fixed below.
 *
 *   npm run screenshots                          # everything, start to finish
 *   node scripts/mock-board.mjs --mode live      # or: --mode upcoming, to look by hand
 *   node scripts/mock-board.mjs --record         # only to replace the slate itself
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreGame, buildTags, anticipationScore } from "../dist-server/server/scoring.js";

const PORT = 8799;
const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, "..", "dist");
const SLATE_FILE = path.join(here, "screenshot-slate.json");
const mode = process.argv.includes("--mode")
  ? process.argv[process.argv.indexOf("--mode") + 1]
  : "live";

/**
 * Records, five games into a season.
 *
 * Not arbitrary, and this matters more than it looks. The first version handed
 * out records by position in the list, which produced a 4-1 Titans and pushed
 * Bills at Texans down the board. A reader does not know the records are props:
 * they see the app rating a bad matchup over a good one and conclude it cannot
 * judge football. Fabricated inputs have to be plausible ones or the screenshot
 * argues against the thing it is advertising.
 *
 * Full-season win totals are Conor Orr's 2026 predictions for SI, scaled to five
 * games. College is derived from the AP rank on the card instead, so a number one
 * seed does not appear at 3-2.
 */
const NFL_WINS_2026 = {
  BUF: 10, NE: 9, MIA: 5, NYJ: 4, BAL: 11, CIN: 9, PIT: 6, CLE: 5,
  HOU: 13, JAX: 9, TEN: 6, IND: 6, LAC: 11, DEN: 10, KC: 9, LV: 5,
  DAL: 12, PHI: 9, WSH: 9, WAS: 9, NYG: 6, DET: 14, GB: 10, CHI: 10,
  MIN: 9, CAR: 10, TB: 7, ATL: 6, NO: 6, LAR: 13, SEA: 11, SF: 10, ARI: 2,
};

const GAMES_IN = 5;

function recordFor(league, team) {
  let wins;
  if (league === "nfl") {
    const season = NFL_WINS_2026[team.abbrev];
    wins = season === undefined ? 2 : Math.round((season / 17) * GAMES_IN);
  } else if (team.rank !== null) {
    // Top of the poll is undefeated or close; the tail of it has a loss or two.
    wins = team.rank <= 5 ? GAMES_IN : team.rank <= 12 ? 4 : 4;
  } else {
    wins = 2;
  }
  wins = Math.max(0, Math.min(GAMES_IN, wins));
  return [`${wins}-${GAMES_IN - wins}`, wins / GAMES_IN];
}

/*
 * Each situation carries real field coordinates, not only the text.
 *
 * The diagram needs `yardLine`, `distance` and possession to draw anything beyond
 * the empty field, and without them the screenshots showed a blank field while
 * the card above it read "3rd & 4". Possession alternates by index, home first,
 * so the yard lines below are chosen to put the ball somewhere sensible for the
 * side that has it: home attacks 100 and away attacks zero.
 */
const SITUATIONS = [
  // Home, driving, a long way from where the drive began.
  { period: 4, clock: 96, home: 27, away: 24, wp: 0.52, down: "3rd & 4 at 38", red: false,
    yardLine: 62, downNo: 3, distance: 4, driveStart: 25 },
  // Away, moving the other way, so the arrow points left.
  { period: 4, clock: 214, home: 31, away: 28, wp: 0.44, down: "2nd & 7 at 45", red: false,
    yardLine: 45, downNo: 2, distance: 7, driveStart: 78 },
  // Home inside the twenty, so one screenshot shows the red zone shading.
  { period: 4, clock: 42, home: 20, away: 17, wp: 0.61, down: "1st & 10 at 12", red: true,
    yardLine: 88, downNo: 1, distance: 10, driveStart: 44 },
  { period: 3, clock: 508, home: 21, away: 21, wp: 0.5, down: "2nd & 3 at 41", red: false,
    yardLine: 41, downNo: 2, distance: 3, driveStart: 62 },
  { period: 4, clock: 631, home: 17, away: 14, wp: 0.55, down: "3rd & 8 at 33", red: false,
    yardLine: 33, downNo: 3, distance: 8, driveStart: 8 },
  { period: 3, clock: 122, home: 24, away: 23, wp: 0.47, down: "1st & 10 at 50", red: false,
    yardLine: 50, downNo: 1, distance: 10, driveStart: 72 },
];

/**
 * Best matchup first, so the most dramatic situation lands on it.
 *
 * The situations are assigned in order, and the first is a one-score game inside
 * two minutes, which will top the board whatever it is attached to. Attached to
 * the tightest line on the slate it produced a hero card of 1-4 Jets at 2-3
 * Titans: correct by the model, and a poor advertisement for it. A reader
 * judging a screenshot is judging the app's taste, so the drama goes to a game
 * they would agree deserves it.
 */
function quality(league, game) {
  if (league === "nfl") {
    return (NFL_WINS_2026[game.home.abbrev] ?? 6) + (NFL_WINS_2026[game.away.abbrev] ?? 6);
  }
  const rank = (side) => (side.rank === null ? 0 : 26 - side.rank);
  return rank(game.home) + rank(game.away);
}

function clockLabel(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}


/**
 * Recording the slate. Run once, when the pictures should show different games.
 *
 * The week of 2026-09-17, which the pictures have shown since they were first
 * taken on the afternoon of the 16th, and which Micah wanted kept: "we ended up
 * liking those particular games". Played since, so each game's closing line comes
 * from its summary (the scoreboard drops odds at kickoff) and each record has that
 * game's own result backed out (the scoreboard carries records as they stand now).
 * AP ranks survive as they were at game time. nfelo strength is as of recording,
 * the one input that cannot be rewound.
 */
const RECORD = {
  dates: "20260917-20260921",
  now: "2026-09-16T15:00:00-04:00",
  zip: "10001",
  marketName: "New York",
  /**
   * The live board, in the order the situations below are dealt out. These are
   * the games the pictures have always shown; a slot left null is filled by
   * matchup quality from what remains.
   */
  live: {
    nfl: ["DET@BUF", "CIN@HOU", "WSH@DAL", "JAX@DEN", "MIN@CHI", "NYG@LAR"],
    cfb: ["LSU@MISS", "UGA@ARK", "MIA@WAKE", null, "UK@TA&M", "FSU@ALA"],
  },
  /**
   * What the listings grid said for the postal code, which cannot be asked of a
   * past week. The two out-of-market games are the ones the first pictures showed
   * under "not on your channels"; the stations are the New York affiliates.
   */
  outOfMarket: ["MIN@CHI", "SEA@ARI"],
  stations: { CBS: "WCBS", FOX: "WNYW", NBC: "WNBC", ABC: "WABC" },
};

const key = (g) => `${g.away.abbrev}@${g.home.abbrev}`;

async function record() {
  const { fetchScoreboard, fetchPregameLine } = await import("../dist-server/server/espn.js");
  const { StandingsStore } = await import("../dist-server/server/standings.js");
  const { StrengthStore } = await import("../dist-server/server/strength.js");

  const withLine = async (league, g) => {
    if (g.homeSpread !== null) return g;
    const line = await fetchPregameLine(league, g.id).catch(() => null);
    if (line === null) return g;
    return { ...g, homeSpread: line.homeSpread, spread: Math.abs(line.homeSpread), overUnder: line.overUnder, odds: line.details };
  };
  const pregame = (side, other, played) => {
    const parts = String(side.record ?? "").split("-").map(Number);
    if (!played || parts.length < 2 || parts.some((n) => !Number.isFinite(n))) return side;
    let [w, l, t = 0] = parts;
    if (side.score > other.score) w -= 1;
    else if (side.score < other.score) l -= 1;
    else t -= 1;
    [w, l, t] = [Math.max(0, w), Math.max(0, l), Math.max(0, t)];
    const n = w + l + t;
    return {
      ...side,
      score: 0,
      record: t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`,
      winPct: n > 0 ? (w + t / 2) / n : null,
      playoffSeed: null,
    };
  };
  const market = (g) => {
    if (RECORD.outOfMarket.includes(key(g))) return [];
    const station = RECORD.stations[g.broadcast];
    return station ? [station] : null;
  };

  const slate = { now: RECORD.now, dates: RECORD.dates, market: { zip: RECORD.zip, stations: Object.values(RECORD.stations), detected: false, city: null, marketName: RECORD.marketName }, leagues: {} };
  for (const league of ["nfl", "cfb"]) {
    const { games, season, week } = await fetchScoreboard({ league, limit: 300, dates: RECORD.dates });
    if (league === "nfl") {
      await new StandingsStore().enrich(games);
      await new StrengthStore().enrich(games);
    }
    const days = [...new Set(games.map((g) => new Date(g.startDate).toDateString()))].slice(0, 4);
    const rows = [];
    for (const raw of games) {
      if (!days.includes(new Date(raw.startDate).toDateString())) continue;
      const g = await withLine(league, raw);
      const played = g.state !== "pre";
      rows.push({
        ...g,
        state: "pre",
        period: 0,
        clock: "0:00",
        clockSeconds: 0,
        home: pregame(g.home, g.away, played),
        away: pregame(g.away, g.home, played),
        homeWinProb: null,
        possessionTeamId: null,
        lastPlay: null,
        marketStations: market(g),
      });
    }
    // Only games the invented scores could belong to: close enough lines that a
    // one-score fourth quarter is not an absurd upset, best matchups first.
    const fits = rows
      .filter((g) => g.homeSpread !== null && Math.abs(g.homeSpread) <= 25)
      .sort((a, b) => quality(league, b) - quality(league, a) || Math.abs(a.homeSpread) - Math.abs(b.homeSpread));
    const chosen = RECORD.live[league].map((k) => (k === null ? null : fits.find((g) => key(g) === k) ?? null));
    const spare = fits.filter((g) => !chosen.includes(g));
    const live = chosen.map((g) => g ?? spare.shift()).map((g) => g.id);
    for (const [i, k] of RECORD.live[league].entries()) {
      if (k !== null && !rows.some((g) => g.id === live[i] && key(g) === k)) console.warn(`[record] ${league}: ${k} not found`);
    }
    slate.leagues[league] = { season, week, live, games: rows };
    console.log(`[record] ${league}: ${rows.length} games, live ${live.map((id) => key(rows.find((g) => g.id === id))).join(", ")}`);
  }
  fs.writeFileSync(SLATE_FILE, JSON.stringify(slate, null, 1) + "\n");
  console.log(`[record] wrote ${SLATE_FILE}`);
}

if (process.argv.includes("--record")) {
  await record();
  process.exit(0);
}

const slate = JSON.parse(fs.readFileSync(SLATE_FILE, "utf8"));
const NOW = Date.parse(slate.now);

/** The live board: the recorded games with invented scores, scored by the real model. */
function liveBoard(league) {
  const { games, live } = slate.leagues[league];
  return live.map((id, i) => {
    const raw = games.find((g) => g.id === id);
    const s = SITUATIONS[i % SITUATIONS.length];
    const [homeRecord, homeWinPct] = recordFor(league, raw.home);
    const [awayRecord, awayWinPct] = recordFor(league, raw.away);
    const game = {
      ...raw,
      state: "in",
      period: s.period,
      clock: clockLabel(s.clock),
      clockSeconds: s.clock,
      statusDetail: `${clockLabel(s.clock)} - ${s.period}${s.period === 3 ? "rd" : "th"}`,
      statusName: "STATUS_IN_PROGRESS",
      home: { ...raw.home, score: s.home, record: homeRecord, winPct: homeWinPct },
      away: { ...raw.away, score: s.away, record: awayRecord, winPct: awayWinPct },
      homeWinProb: s.wp,
      margin: Math.abs(s.home - s.away),
      totalPoints: s.home + s.away,
      possessionTeamId: i % 2 === 0 ? raw.home.id : raw.away.id,
      downDistance: s.down,
      isRedZone: s.red,
      yardLine: s.yardLine,
      down: s.downNo,
      distance: s.distance,
      driveStart: s.driveStart,
      lastPlay: null,
    };
    // The real model, so the ratings are ones the board could actually produce.
    const score = scoreGame({
      league,
      period: game.period,
      clockSeconds: game.clockSeconds,
      home: game.home,
      away: game.away,
      homeWinProb: game.homeWinProb,
      conferenceGame: game.conferenceGame,
      divisionGame: game.divisionGame,
      startDate: game.startDate,
      swingMovement: 0.18,
      possessionTeamId: game.possessionTeamId,
      network: game.broadcast,
      homeSpread: game.homeSpread,
      overUnder: game.overUnder,
    });
    const favoredAbbrev = game.homeSpread <= 0 ? game.home.abbrev : game.away.abbrev;
    const odds = game.odds ?? `${favoredAbbrev} ${(-Math.abs(game.homeSpread)).toFixed(1)}`;
    const full = { ...game, score, anticipation: null, pregameSpread: game.homeSpread, pregameOdds: odds, tags: [] };
    full.tags = buildTags(full, score);
    return full;
  });
}

/** The planning list: every recorded game, rated by the real model. */
function planningList(league) {
  return slate.leagues[league].games
    .map((g) => ({
      ...g,
      week: weekOf(league),
      round: null,
      score: null,
      tags: [],
      pregameSpread: g.homeSpread,
      pregameOdds: g.odds,
      anticipation: anticipationScore({
        league,
        spread: g.spread,
        overUnder: g.overUnder,
        home: g.home,
        away: g.away,
        network: g.broadcast,
        conferenceGame: g.conferenceGame,
        divisionGame: g.divisionGame,
        startDate: g.startDate,
      }),
    }))
    .sort((a, b) => b.anticipation - a.anticipation);
}

/*
 * Which week of the season the slate is, which the recording predates. College's
 * is not in it, so it is ESPN's for the same dates. No byes, truthfully: every
 * NFL team played that week.
 */
const SLATE_WEEK = { nfl: 2, cfb: 3 };

function weekOf(league) {
  return `2:${SLATE_WEEK[league]}`;
}

function snapshot(league) {
  const { season, week } = slate.leagues[league];
  return {
    league,
    updatedAt: new Date(NOW).toISOString(),
    season,
    week,
    weeks: {
      [weekOf(league)]: { label: `Week ${SLATE_WEEK[league]}`, byes: [], byeLabel: "bye" },
    },
    live: mode === "live" ? liveBoard(league).sort((a, b) => b.score.total - a.score.total) : [],
    upcoming: mode === "upcoming" ? planningList(league) : [],
    recent: [],
    market: slate.market,
    build: null,
    error: null,
  };
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };

http
  .createServer((req, res) => {
    const url = (req.url ?? "/").split("?")[0];
    if (url === "/api/snapshot") {
      const league = new URL(req.url, "http://x").searchParams.get("league") === "cfb" ? "cfb" : "nfl";
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(snapshot(league)));
      return;
    }
    const candidate = path.resolve(distDir, "." + decodeURIComponent(url));
    const target = candidate.startsWith(distDir) && fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : path.join(distDir, "index.html");
    res.writeHead(200, { "content-type": MIME[path.extname(target)] ?? "application/octet-stream" });
    fs.createReadStream(target).pipe(res);
  })
  .listen(PORT, () => console.log(`[mock] ${mode} board on http://localhost:${PORT}`));
