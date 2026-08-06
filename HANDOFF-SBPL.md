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
