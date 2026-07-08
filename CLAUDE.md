# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`chuiyi.github.com` is a personal GitHub Pages site (served statically at deploy time, no build step). It is a collection of independent static sub-apps living side by side in one repo, plus a Node/Express server used only for local development. There is no bundler, transpiler, framework, lint config, or test suite — everything is plain HTML/CSS/ES6 JS loaded directly by `<script>` tags, or small Node CLI scripts under `ptcg/scraper/`.

Content (UI copy, markdown posts) is primarily in Traditional Chinese; match that when editing user-facing text.

## Commands

```bash
npm install        # install deps (express, axios, cheerio; nodemon for dev)
npm start           # node server.js -> http://localhost:13145 (static file server, mirrors prod routing)
npm run dev          # nodemon server.js, restarts on change
```

There is no configured lint/test command (`npm test` is a placeholder that exits 1). Verify changes by loading the relevant `.html` page in a browser via the dev server and checking the console — there is no automated check to run instead.

### PTCG data scrapers (`ptcg/scraper/*.js`, run from repo root)

```bash
npm run scrape:ptcg:menu           # interactive menu wrapping the scripts below
npm run scrape:ptcg:ranking        # rebuild ranking draft -> result CSVs in ptcg/data
npm run build:ptcg:trends          # regenerate ptcg/data/ranking_trends.json from ranking CSVs
npm run scrape:ptcg:gbl            # GBL (超級球) tournament list + details + Top128
npm run scrape:ptcg:ubl            # UBL (高級球) tournament list + details + Top128
npm run scrape:ptcg:masterball     # MasterBall (大師球) tournament list + details + Top128
npm run scrape:ptcg:players        # player profile JSON (flags: --all / --only-missing / --level <master|senior|junior>)
npm run scrape:ptcg:top128         # official Top 128 results
npm run scrape:ptcg:pairings       # tournament pairings
npm run check:ptcg:stage-change    # diff current tournament stage info vs ptcg/data/tournament_stage_snapshot.json
```

`scraper.js` at the repo root is a manual orchestrator: flip booleans in its `CONFIG` block to choose which of the above to run in sequence, then `node scraper.js`. This is what the `cron-job.yml` GitHub Action invokes daily.

Most scraper scripts are plain Node CLIs with `--flag` args (see header comments in each file, e.g. `check_tournament_stage_changes.js`); there's no shared CLI framework, each script parses `process.argv` itself.

## Architecture

### Top-level layout

Each top-level directory other than `assets/`, `posts/`, and `docs/` is a **self-contained mini-app**: its own `index.html`, `css/`, `js/`, and sometimes its own `README.md` and `data/`. They do not share JS modules with each other or with the root site — cross-app code reuse is effectively zero, so when fixing a bug, look only inside that app's folder (plus `assets/` if it's a shared/global concern).

- **Root site** (`index.html`, `movie.html`, `travel.html`, `assets/`, `posts/`) — the main blog/portfolio: travel notes, movie reviews, photography. Content-driven via markdown files, not hardcoded HTML.
- **`ptcg/`** — Pokémon TCG (Taiwan) competitive info site. Static frontend (`ptcg/js/ptcg.js`, ~3500 lines) reads JSON files in `ptcg/data/` (tournaments, decks, rankings, teams) produced by the Node scrapers in `ptcg/scraper/`. See `ptcg/README.md` for the JSON schema of each data file.
- **`lottery/`** — standalone bingo-lottery game, pure client-side, state in `localStorage` (`lottery_room_{roomId}`), no backend, no cross-device sync.
- **`swiss/`** — Swiss-tournament pairing/scoring manager (Buchholz tiebreaks), pure client-side, state in `localStorage`, JSON import/export for sharing results.
- **`bbx_vs/`** — Beyblade tournament tracker (`bbx_vs/js/bbx-vs.js`, single `BeybladeTournamentApp` class), client-side with optional Google Drive (`drive.appdata` scope) sync for cross-device persistence.
- **`av_library/`** — media library/catalog app (`av_library/js/av-library.js`), same `localStorage` + optional Google Drive sync pattern as `bbx_vs`. Also contains standalone `test-*.html` tools for experimenting with stream-link extraction (see `STREAM_EXTRACTION_GUIDE.md`); these are dev/debug utilities, not production pages.

`bbx_vs` and `av_library` both embed the same Google OAuth client ID and use Drive's `appdata` scope purely as a personal sync mechanism (their own JSON blob in the user's hidden app-data folder) — this is not a shared backend, just a repeated pattern.

### Root site content model

Travel/movie content is **not** hardcoded in HTML — it's markdown files rendered client-side:

1. Write a `.md` file in `posts/travel/` or `posts/movies/` (images go in the sibling `imgs/` folder, referenced with relative paths like `imgs/foo.jpg`).
2. Register it in `assets/config/content-config.js` (`TRAVEL_FILES` / `MOVIE_FILES` arrays) — file path, `id`, `featured`, display metadata, and optional `images` override. Nothing shows up on the site until it's added here.
3. `assets/js/main.js` fetches and parses the markdown (via Marked.js) at runtime, extracts structured fields from a `**Key**: value` convention inside a `## 旅行資訊` / `## 電影資訊` section (date, location, rating, etc. — see `docs/content-management.md` for the exact field table), and renders cards/detail pages from it.
4. `travel.html?file=<id>` and `movie.html?file=<id>` are the per-post detail-page routes (deep-linkable); `server.js` and GitHub Pages both just serve these as static files with a query string, no server-side routing involved.

Site-wide copy (hero text, section headings, footer, social links) lives in `assets/config/site-config.js`, separate from post content config. Light/dark theme is CSS-variable based (toggle button, no JS theme framework).

### `server.js`

Only used for local development/preview — GitHub Pages serves the static files directly in production, so `server.js` intentionally mirrors that behavior (e.g., falls back to `index.html` for unknown non-file routes, explicit MIME types, `no-cache` headers on `.json` so scraper output is visible without a hard refresh). Don't add server-side logic here that wouldn't also work as static files, since it won't run in production.

### Automation (`.github/workflows/`)

Three scheduled GitHub Actions run scrapers and auto-commit the resulting data straight to `master`, authenticated as `github-actions[bot]`:

- `cron-job.yml` — daily, runs `node scraper.js` (whatever tasks are enabled in its `CONFIG`), commits with `git-auto-commit-action`.
- `weekly-players-update.yml` — daily, force re-scrapes all PTCG player profiles, commits manually with `[skip ci]`.
- `ptcg-check-tournament-stage.yml` — manual (`workflow_dispatch`), diffs tournament stage info, optionally updates the snapshot and/or fails the run on detected changes.

When changing scraper output paths/filenames, update the corresponding workflow's `file_pattern`/paths too, or the auto-commit will silently miss new files.

## Conventions

- Commit messages for content/feature changes typically use a `/<section>/ <change in Chinese>` style (e.g. `/travel/ 調整介面`, `/ptcg/ 更新組別清單`); automated data-update commits use `chore: ... [skip ci]`.
- No build step: don't introduce one (bundlers, TS, JSX) without discussing it first — every `.html`/`.js`/`.css` file here is shipped byte-for-byte to GitHub Pages.
- Each mini-app's `localStorage` keys are namespaced by app (`lottery_room_*`, `bbx_vs_*`, `avLibrary*`) — keep new keys within that app's prefix.
