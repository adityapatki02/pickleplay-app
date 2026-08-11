# SBPL Season 2 — Live Event Handoff

**Event:** SkyCity Badminton Premier League Season 2 · **31 Jul – 2 Aug 2026** · 16 teams, 2 groups (AB / CD).
**Written:** 2026-07-29. Use this to continue on another machine.

---

## 1. Where everything runs

| Piece | What | How it deploys |
|---|---|---|
| **Prod API** | `yoiden-api` (Cloud Run, GCP project `yoiden`, region `asia-south1`) | **Auto-deploys on push to `origin/main`** (Cloud Build trigger `^main$`, `cloudbuild.yaml`). |
| **Prod DB** | Postgres `yoiden`, public IP `34.93.29.180:5432`, user `yoiden_user`, `sslmode=require` | N/A. **`synchronize` is OFF in prod** — new entity columns need a manual `ALTER` *before* deploy or the app 500s. |
| **SBPL site** | `sbpl.yoiden.com` (Netlify site `nimble-vacherin`) | **Manual drag-drop of `pickleplay-app/dist-sbpl`.** No git auto-deploy. Build with `npm run build:sbpl`. |
| **Main app** | Netlify, `netlify.toml` builds `dist` via `npm run build:web` | Separate site; not the SBPL kiosk. |

### DB password (never stored in git)
Pull it from the Cloud Run service env at need:
```bash
gcloud run services describe yoiden-api --project=yoiden --region=asia-south1 --format=export > /tmp/svc.json
export PGPASSWORD=$(python3 -c "import json;d=json.load(open('/tmp/svc.json'));c=d['spec']['template']['spec']['containers'][0];print(next(e.get('value','') for e in c['env'] if e['name']=='DB_PASSWORD'))")
psql "host=34.93.29.180 port=5432 user=yoiden_user dbname=yoiden sslmode=require"
```

---

## 2. Git layout

| Repo | Remote | Branch with this work | Notes |
|---|---|---|---|
| `pickleplay-api` | `github.com/adityapatki02/pickleplay-api-` | **`auction-aoe-s2`** (local dev) + **`main`** (deployed) | Deployed SBPL features live on `origin/main` as clean commits. `auction-aoe-s2` = full working snapshot (SBPL + AOE auction WIP). |
| `pickleplay-app` | `github.com/adityapatki02/pickleplay-app` | **`sbpl-live-event`** (pushed for handoff) / local `main` | Frontend was never git-deployed; the live site is the drag-dropped `dist-sbpl`. |

### Deploy recipe (backend)
Work happens on `auction-aoe-s2`; deploys are patched onto `main` so untested WIP never ships:
```bash
# from pickleplay-api, with edits in the working tree
git worktree add /tmp/wt origin/main
git diff origin/main -- <file> > /tmp/p.patch
cd /tmp/wt && git apply /tmp/p.patch && git add -A && git commit -m "..." && git push origin HEAD:main
# monitor: gcloud builds list --project=yoiden --limit=1
git worktree remove /tmp/wt --force
```
> ⚠️ **A push to `origin/main` redeploys the live API.** Only push code you've verified. For an untracked-on-branch file, copy the whole file into the worktree (a `git diff` of an untracked file is all-deletions and will delete it from main).

### Deploy recipe (frontend)
```bash
cd pickleplay-app && npm run build:sbpl      # → dist-sbpl/
# then drag-drop dist-sbpl to Netlify site nimble-vacherin (sbpl.yoiden.com)
# captains must hard-refresh / clear service worker to pick up a new bundle (PWA caches the shell)
```

---

## 3. Key IDs

- **SBPL season id:** `90bc945f-3907-4c72-85b8-8b2eb3f38dc5`
- **SBPL league id:** `5fc20913-c637-4ebd-8a11-398c68173334`
- **Format:** `sbpl_15game` (15 matches/tie: slots 1–2 kids, 3–7 women, 8–15 men A/B/C).
- **Court split:** slots 1–7 (kids+women / "KW") → `tie.courtNumber`; slots 8–15 (men / "ABC") → `tie.courtNumber2` (`SBPL_COURT_SPLIT_SLOT = 7`).
- **Captain portal:** served by API at `/api/v1/captain-portal/<captainToken>`; per-franchise token in `franchises.captainToken`.

---

## 4. What was done this session (all applied to prod)

1. **Roster reconciliation** vs `SBPL Final Squad.xlsx` — 20 swaps, 2 re-grades (Pooja→w4, Rakhi→w5), 1 release (Aditya Patki), 2 spelling fixes, 14 new users. Verified 478/478 active tuple-match (team+category+player). Gotchas: `users.gender` enum is `male/female/other`; `users.phone` is UNIQUE, so new family members on a shared phone insert with `phone=NULL`.
2. **Full league reset** — all ties/matches back to `scheduled`, scores/lineups/standings/fantasy cleared. Rosters + fixtures preserved. (Backups in scratchpad.)
3. **Schedule loaded from the rulebook** — all 32 league ties + 7 knockout ties now carry exact `matchDay`, `scheduledStart` (IST), and both courts. Verified 32/32 match the rulebook. Fri 6 / Sat 22 / Sun 4 league ties; QF 10:00 & 11:15, SF 13:30, Final 16:00 on 2 Aug.
4. **16 captains set** (`franchises.captainId`), matched to existing roster accounts, phones on file. WhatsApp template `captainsportal_sbpl` (Twilio ContentSid `HX8e9f63b22d17e1ca065ee28e18b994e6`) approved + wired into `CAPTAIN_PORTAL_LINK` and `TIE_SHEET_REMINDER`.
5. **"Open Captain's Portal" tile** — authed `GET /captain-portal/my-teams` (phone last-10 match), blue tile on the SBPL dashboard, opens portal in browser, **scoped to the current league** (won't show a Mini Pickleball captaincy on SBPL). Backend deployed; frontend in `dist-sbpl` (redeploy needed — see Pending).
6. **Dashboard live-match tiles** now tap through to the fixture; **Fixtures / Scorer list** split into Upcoming/Completed; **Fantasy** button + SBPL format-aware Dream Team; **master + court displays** for OBS.

---

### 4a. Post-handoff corrections — 2026-07-30 (applied to prod)

- **Roster swap (linked, one move):** transferred **Sagar Desai** GBD Realty Aces → Video Velocity.
  - `GBD Realty Aces` **b2**: Sagar Desai → **Naman Mehta** (row repointed; Naman Mehta `gender` set to `male` for men's-slot logic).
  - `Video Velocity` **b5**: **Naman Goel** set `status='released'` (row kept, reversible); **Sagar Desai** added `active` at b5.
  - Net: Sagar single-rostered on Velocity; GBD b2 = Naman Mehta; Naman Goel released.
  - Backups: `~/yoiden/sbpl-ops/backups/rosters-GBD-Velocity-<ts>.csv`, `user-naman-mehta-<ts>.csv`.
- **"Kaavya Tawde instead of Alisha Goradia"** — no action needed: Kaavya Amogh Tawde already rostered (Homeozone Griffins, k3); Alisha Goradia not rostered anywhere.
- **Starchtech Strikers c1:** **Anup Agarwal** (phone 7039051331, "Agarwal" spelling — distinct from "Anup Agrawal" on Homeozone) set `status='released'`; created new user **Kanti Shah** (male, phone 9820059832) and rostered him `active` at c1. Backup: `starchtech-c1-and-anup-<ts>.csv`.
- **League owner identity fix:** the SBPL S2 organizer account `2f541f37` was named "Dinesh Mutha" but carries Aditya Patki's number (+918149998143) and is the account Aditya actually signs in with (confirmed: its SBPL roster spot is the "Aditya Patki" release on Mantri's Phoenix c1). Renamed the account to **Aditya Patki** (Option A — kept number + organizer role). Also relabels the Mini Pickleball owner/captain (same record). Real Dinesh Mutha accounts (`d1117f99` +919322016501 etc.) left as-is; no admins added. Backup: `user-organizer-2f541f37-<ts>.csv`.
- **Default-lineup close deadline corrected to noon IST 31 Jul** (was 30 Jul in §5/§6 below). Runner staged at `~/yoiden/sbpl-ops/fire-close-submissions.sh`.

- **Scoreboard/OBS ticker fix (deployed to `origin/main` → live API):** two fixes in `scoreboard.controller.ts`, commit `17c0f604`:
  1. Player names no longer truncate on the ticker when team names are long (e.g. Homeozone Griffins / Kamakhya Knockout) at display-scaled/narrower viewports — team-name column capped + player column prioritised + `clamp()` fonts (1920 look unchanged). Root cause was 150% Windows scaling → effective 1280px viewport.
  2. "Substitute" placeholder is suppressed until a scorer/admin clicks **Start Tie** (`tie.status='in_progress'`); before start the court route only previews the upcoming scheduled tie, so empty lineups render blank. On-court `display-data` already behaved correctly (unchanged).

- **OBS ticker made court-specific (deployed `origin/main` `37586593`):** `getCourtData` used the court only to resolve the tie, then returned `getData()`'s tie-wide featured game — so both per-court OBS overlays of a two-court tie showed the same (latest-scored-anywhere) game. Now overrides `currentMatch` with the court-filtered game, matching `getCourtDisplayData`. **Verified live** via a controlled rehearsal (scored games on a throwaway Sun-2-Aug tie, confirmed each court shows only its own game, latest-scored-wins, then restored clean): 5/5 checks passed. Court-side `/display` was already court-specific. Both overlays follow most-recently-scored activity and linger the last completed final.

### 4b. Event-day fixes — 2026-07-31

- **Load test + scorer-logic review** (3 agents) run pre-event. Read path healthy (900 req/30-conc, 100% 200s, p99 231ms). Findings: see §6 "Known issues".
- **Forfeit path removed (deployed `origin/main` `789b65fe`):** scorer "Declare Winner" no longer prompts for forfeit/injury and the backend always marks the game `completed` (never `walkover`). The `walkover` status was uncounted by the league pipeline and blocked tie completion the instant a player retired. App's `adminDeclareWinner` already used `completed`; the only other `walkover` producer (`PATCH /matches/:id/status`) is the separate bracket module, unused by SBPL.
- **Substitutes excluded from fantasy (same deploy `789b65fe`):** `fantasy.service` now skips `isSub` appearances, mirroring `player-stats.service`, so a drafted player subbed into an extra slot isn't double-counted. (Player-stats already excluded subs — that was correct.)
- **Fantasy deadline set → 17:30 IST 31 Jul** (`league_seasons.fantasyDeadline`, was NULL = never locked). Backed up. Entries now lock at first serve.

- **Fantasy Trends share card fix (frontend — `pickleplay-app`, needs `dist-sbpl` drag-drop):** `FantasyTrendsShareCard.tsx` only knew SPPL dream-team buckets (teenBoys/m1/w1/…), so for SBPL every "Top Pick Per Category" row except Kids showed "—" (backend `/trends` returns SBPL buckets kids/women13/women45/menA/menB/menC). Fix: category map now covers both formats and is driven by the buckets in the payload; also fixed the fan-favorite showing raw "menA". Branding made configurable (`seasonLabel`/`footerLabel` props) — `FantasyScreen` passes **SBPL 2026** + **SBPL · JUL 31 – AUG 2, 2026** when `config.form2Shape` is SBPL, so the SPPL build is unaffected. Rebuilt `dist-sbpl` (verified in bundle). Source changes are local/uncommitted in `pickleplay-app`.

- **Rich OBS overlays no longer fake a live match (deployed `origin/main` `73a3deb2`):** `rich-a`/`rich-b` painted hardcoded DEMO data (fake "LIVE 11-8" with mock players Arham Vora/etc.) whenever a court had no live game — an idle court would broadcast a match that wasn't happening. Now DEMO renders only under `?demo`; live operation keeps the REAL teams and shows "UP NEXT" (or "WAITING FOR NEXT MATCH" when no tie on the court). Court-side `/display` and master board already gated demo on `?demo` — unaffected.
- **All 16 team colours set to gold `#C9A227`** (`franchises.primaryColor`, `leagueId=5fc20913…`). Real franchise colours unknown; several were near-black (RR Comets `#1A1A1A` etc.) and looked colourless on the ticker. Backed up (`franchise-colors-<ts>.csv`). Takes effect live (scoreboard reads colour from DB).

- **RR Comets w3:** Khyati Thacker released; **Amruta Bhoite** (existing user `48ade68a`, phone +919869513350, gender set female) added active. Backup `rrcomets-w3-swap-<ts>.csv`.
- **Fantasy deadline corrected 17:30 → 17:00 IST** (organizer says 5:00 PM Fri 31 Jul).
- **Per-tie sheet deadlines set (organizer-provided):** `kidsDeadline`=31 Jul 16:00 on the 6 Friday ties (kids games); `tieSheetDeadline`=31 Jul 22:00 on the 2 Sat-07:00 ties and =1 Aug 22:00 on the 2 Sun-07:00 ties (7 AM matches → 10 PM prior). All other ties use the 30-min-before default. `tie.tieSheetDeadline` (main) + `tie.kidsDeadline` (kids slots 1-2) are the override fields; null → default. Backup `tie-deadlines-<ts>.csv`.

- **Dashboard "Watch Live" YouTube links (frontend — needs `dist-sbpl` drag-drop):** backend already had `league_seasons.streamLinks` (jsonb, keyed by court) + organiser endpoint `PATCH /leagues/:id/seasons/:sid/stream-links`. Added a collapsible "WATCH LIVE" banner to `LeagueDashboardScreen` overview reading `season.streamLinks` — one compact row that expands a dropdown of per-court ▶ links on tap (kept compact so it doesn't crowd the sponsor slider). Set 4 links (courts 1-4) in the season. **Daily swap needs NO rebuild** — run `bash ~/yoiden/sbpl-ops/set-stream-links.sh "<c1>" "<c2>" "<c3>" "<c4>"` (updates the jsonb; app reads live). Rebuilt `dist-sbpl` (also carries the fantasy-trends fix). Source changes local/uncommitted in `pickleplay-app`.

- **Netlify CLI deploys now set up** (no more drag-drop). `netlify-cli` installed + authenticated as aditya.patki. SBPL site id `a0ddbd2e-9a04-499e-ab19-b1de6cc9374a` (`nimble-vacherin-9d8c65`, also serves `inquiry`/`ajantapharma.yoiden.com` aliases — a prod deploy updates all three). Deploy: `netlify deploy --prod --dir dist-sbpl --site a0ddbd2e-...`. Draft (safe preview): drop the `--prod`.
- **Frontend shipped to prod (bundle `b2777e49`):** collapsed Watch Live banner; fantasy-trends category fix; per-court stream links; new **Default Tie Sheets** admin tracker (Setup & Admin → bottom card, per-team SUBMITTED/PENDING, `getAllDefaultLineups`); removed the "Default Lineups" CSV-upload button from Setup. Source local/uncommitted in `pickleplay-app`.

- **Player Stats page redesigned (live, bundle `b466a923`):** `StatsScreen.tsx` rewritten to a single light-themed "All Players" view — removed Overview + Top Performers tabs; clean header (league name, no black "SPPL" block); category filter pills (ALL + the league's real categories — for SBPL: Kids/W1-3/W4-5/Men A/B/C — **derived from played-match data, so they appear once scoring starts**, empty→ALL only pre-event); kept sort/stage pills, CSV, tap-to-profile. Light design per `src/theme` tokens.

- **Hidden 3rd-place playoff tie created (2026-07-31):** `round='knockout_third_place'`, 2 Aug 14:45 IST, full 15-game structure (cloned from `knockout_sf1`), **teams TBD, no court**. Hidden from: bracket (unrecognized round), scoreboards (no court), Fixtures (frontend guard hides `knockout_third_place` while `homeTeamId` is null — bundle `5f83f029`). Reusable creator: `~/yoiden/sbpl-ops/create-third-place.sql`. **To OPEN:** set `homeTeamId`/`awayTeamId` (SF losers) + a court on the tie → appears in Fixtures + scoreable. Known cosmetic gap: the "3rd Place Playoff" ROUND_LABELS entry got minified out of the bundle, so when opened it shows the raw round until a 1-line re-patch. tie_matches has no `updatedAt` column (only `createdAt`) — noted for future clones.

- **Default-lineup window CLOSED 2026-07-31 12:09 IST** — all 16 teams submitted. `defaultLineupClosedAt` set (direct psql, cached pw). No more default edits.
- **4 new sponsors added (app + court-side display):** D Nine (Performance Gear), Om Jewellers (Toss Ka Boss & Umpire), Shutter Sandwich (Media), Xenon (Emergency Health). **App** (`assets/sbpl/*` + `SBPL_SPONSORS_RIGHT`, per-sponsor `bg` for white logos) live prod bundle `e82a56d8`. **Court display** carousel (`assets/sponsors/*.png` + `SPONSORS`/`SBPL_SPONSOR_SLUGS`) deployed `origin/main` `da61f454`. All 8 sponsor logos downscaled to ≤700px + optimized to fix display lag (Shutter Sandwich 813KB→54KB etc.). Sponsor source files came from a shared Drive folder via `gdown`.

- **Master venue board → COURT-CENTRIC (deployed `origin/main` `25784856`):** was tie-centric (max 2 live ties, `data.ties`, `slice(0,2)`); reshaped `getMasterData` + `getMasterHTML` to a 2×2 grid of the **4 courts**, each showing the game scored latest on it (`currentTieMatchOnCourt`, from ANY tie) + its tie context + AB/CD tag; standings kept below. Handles the normal 2-tie days AND running kids matches across 7-8 ties at once. Data shape now `data.courts` (4 cards) + `groups`. Per-court + standings try/catch (one bad row won't blank the board). Verified the render offline via extracted HTML + `?demo` (4 cards, no overflow, no console errors) before deploy.

## 5. Current state (as of handoff)

- **League:** clean/scheduled. 0 completed ties, standings zero.
- **Default-team submission window:** `season.defaultLineupClosedAt = NULL` → **OPEN**. It's a manual switch (any non-null value = closed). Plan: **close it manually at 12:00 noon IST, 30 Jul** (`UPDATE league_seasons SET "defaultLineupClosedAt"=now() WHERE id='<season>'`). Submissions so far: **0 teams**.
- **Per-tie deadlines:** now live (start times loaded) → default 30-min-before-start applies. Earliest = Fri 31 Jul 17:30 IST.
- **Fantasy:** live; a few real entries in.
- **Captains:** 14/16 clean for the tile via last-10 phone. 2 edge cases have a divergent 2nd number: **Mohnish Vanjara** (Arun's Avengers — `captainId` on non-roster `+919967050340`; roster/Excel `9769138090`) and **Samir Shah** (Leonard Mavericks — `9699910099` vs a 2nd acct `8369510090`). Left as-is per instruction.

---

## 6. Pending / TODO

- [ ] **Drag-drop latest `dist-sbpl`** to Netlify (carries the captain tile + league scoping + all app changes). Then captains hard-refresh.
- [ ] **Close default-team submissions at noon 30 Jul** (manual `UPDATE` above).
- [ ] (Optional) Resolve the 2 edge-case captains' duplicate accounts if they can't see the tile.
- [ ] **After the event:** scale Cloud Run `min-instances → 0` and DB → `db-custom-2` (was scaled up for the event).

---

## 7. Safety rules (carry these over)

- **CSV-backup live event data before any prod schema/data change** (see scratchpad backups pattern: `\copy (…) to 'file.csv' csv header`).
- **Preview UI changes locally / on a copy before deploying.**
- **Never push unverified code to backend `main`** — it redeploys the live API.
- Prod `synchronize` OFF → **manual `ALTER` for any new column before deploy.**

---

## 8. Scratchpad artifacts (local `/tmp`, will NOT travel)

These were safety backups/scripts on the origin machine — the authoritative state is the **prod DB + git**, so they're not required to continue, but noted for recovery:
`rosters-backup-2026-07-29.csv`, `sbpl-reset-backup-2026-07-29/` (ties/matches/scores/sheets/standings/fantasy), `ties-schedule-backup-2026-07-29.csv`, `franchises-captain-backup-2026-07-29.csv`, `apply-roster.sql`, `reset-league.sql`, `load-schedule.sql`.
