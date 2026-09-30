/**
 * Captures the four README screenshots, start to finish.
 *
 *   npm run screenshots
 *
 * Builds nothing itself (the npm script builds first) and needs nothing running:
 * it starts `mock-board.mjs` once per mode, photographs both leagues, and stops
 * it. The slate is the recorded one in `screenshot-slate.json`, so the pictures
 * show the same games every time and only move when the board's look or its
 * scoring does.
 *
 * Headless Chromium comes from Playwright rather than a browser already on the
 * machine: Edge writes no file at all here, and driving Firefox kills content
 * processes belonging to whatever the user happens to have open.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const docs = path.resolve(here, "..", "docs");
const slate = JSON.parse(fs.readFileSync(path.join(here, "screenshot-slate.json"), "utf8"));

/** A tall phone: the board is read on one, and it is where the layout is tightest. */
const VIEWPORT = { width: 430, height: 1500 };

/**
 * One canvas for all four, because they sit side by side in a README table and a
 * set of mismatched heights reads as carelessness.
 *
 * A real phone viewport rather than the full scroll height. The board is read on
 * a phone, and a picture the shape of a phone says so at a glance; a 1400px
 * ribbon of every card at once does not. Content running past the fold is not a
 * defect here, it is what the screen actually looks like.
 */
const CANVAS_HEIGHT = 932;

/** Starts the mock board and resolves once it is listening. */
function startMock(mode) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(here, "mock-board.mjs"), "--mode", mode], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("board on")) resolve(child);
    });
    child.on("exit", (code) => reject(new Error(`mock board exited with ${code}`)));
  });
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  colorScheme: "dark",
});

for (const mode of ["live", "upcoming"]) {
  const mock = await startMock(mode);
  try {
    for (const league of ["nfl", "cfb"]) {
      const page = await context.newPage();
      // The slate is a past week, photographed as of the afternoon before it, so
      // the rows read as kickoff times rather than "Now" and the days are labelled
      // from where the pictures stand.
      await page.clock.setFixedTime(new Date(slate.now));
      // Set before the app boots, so it opens on the right tab with no click and no
      // transition to catch mid-flight.
      await page.addInitScript(
        ([l, zip]) => {
          localStorage.setItem(
            "football-watchability-prefs",
            // A deliberately generic market. The feature is worth showing, but a
            // README is a public page and the author's own postal code is not going
            // in it.
            JSON.stringify({ league: l, favorites: { nfl: [], cfb: [] }, zip, marketOff: false }),
          );
        },
        [league, slate.market.zip],
      );
      await page.goto("http://localhost:8799/", { waitUntil: "networkidle" });
      await page.waitForSelector(".card, .row", { timeout: 15000 });
      await page.waitForTimeout(1500);

      await page.setViewportSize({ width: VIEWPORT.width, height: CANVAS_HEIGHT });
      await page.waitForTimeout(300);

      const file = path.join(docs, `${league}-${mode}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log(`wrote ${file}`);
      await page.close();
    }
  } finally {
    mock.removeAllListeners("exit");
    mock.kill();
  }
}

await browser.close();
