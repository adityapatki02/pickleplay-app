# MCA BKC 2026 — Live Event Handoff

**Event:** MCA BKC Members Only Badminton Tournament 2026 · **29–30 Aug 2026** ·
Sharad Pawar Indoor Cricket Academy & Recreation Centre, BKC · 5 teams, one pool.
**Written:** 2026-08-27. Use this to continue on another machine.

---

## 1. Where everything runs

| Piece | What | How it deploys |
|---|---|---|
| **Prod API** | `yoiden-api` (Cloud Run, GCP project `yoiden`, region `asia-south1`) | **Auto-deploys on push to `origin/main`** (Cloud Build trigger `^main$`, `cloudbuild.yaml`). |
| **Prod DB** | Postgres `yoiden`, public IP `34.93.29.180:5432`, user `yoiden_user`, `sslmode=require` | N/A. **`synchronize` is OFF in prod** — the `rally_30` enum value needs a manual `ALTER` *before* deploy or fixture generation 500s. |
| **MCA site** | `mca.yoiden.com` (Netlify site — **to be created**) | **Manual drag-drop of `pickleplay-app/dist-mca`.** No git auto-deploy. Build with `MCA_LEAGUE_ID=<id> npm run build:mca`. |
| **Main app** | Netlify, `netlify.toml` builds `dist` via `npm run build:web` | Separate site; not the MCA kiosk. |

### DB password (never stored in git)
```bash
gcloud run services describe yoiden-api --project=yoiden --region=asia-south1 --format=export > /tmp/svc.json
export PGPASSWORD=$(python3 -c "import json;d=json.load(open('/tmp/svc.json'));c=d['spec']['template']['spec']['containers'][0];print(next(e.get('value','') for e in c['env'] if e['name']=='DB_PASSWORD'))")
psql "host=34.93.29.180 port=5432 user=yoiden_user dbname=yoiden sslmode=require"
```

---

## 2. Git layout

| Repo | Branch with this work | Notes |
|---|---|---|
| `pickleplay-api` | **`mca-badminton`** (local, unpushed) | The `mca_5doubles` format, `rally_30` scoring, importer, runbook. Deploys by pushing to `main`. |
| `pickleplay-app` | **`integrate-owner-dashboard`** (local) | MCA-aware standings + knockout on `LeagueDashboardScreen` / `StandingsScreen`, and the `build:mca` script. |

Backend deploy recipe (patch onto `main` so untested WIP never ships) — same as SBPL:
```bash
git worktree add /tmp/wt origin/main
git diff origin/main -- <file> > /tmp/p.patch
cd /tmp/wt && git apply /tmp/p.patch && git add -A && git commit -m "..." && git push origin HEAD:main
gcloud builds list --project=yoiden --limit=1
git worktree remove /tmp/wt --force
```
> ⚠️ For an untracked-on-branch file, copy the whole file into the worktree — a
> `git diff` of an untracked file is all-deletions and will delete it from main.
> MCA adds **9 new files** to the API, so this matters here.

---

## 3. Key facts

- **Format:** `mca_5doubles` — 5 games/tie (slots: 1/3/4 = `aa`, 2 = `aplus`, 5 = `ab`).
- **Scoring:** `rally_30` — single game to 30, golden point at 29–29, change ends at 15,
  **no bonus points**.
- **Standings rank on cumulative POINTS SCORED** (`ralliesFor`), max 600 — *not* tie
  points, *not* games won. Tiebreak: head-to-head points, then head-to-head games.
- **No repeat pairings** in the league stage; knockouts are unrestricted (§4).
- **Knockout:** top 4 → SF1 = Rank 1 v Rank 4, SF2 = Rank 2 v Rank 3, Final.
- **Captain portal:** `/api/v1/captain-portal/<captainToken>`, token per franchise.
- **Rules reference:** `pickleplay-api/docs/mca-config.md`.
- **Go-live steps:** `pickleplay-api/DEPLOY-MCA-LEAGUE.md`.
- **League id / season id:** *not yet created* — produced by step 7 of the runbook.

---

## 4. What was done this session

1. **New `mca_5doubles` format** end to end: slot template, single-pool circle-method
   round robin (10 ties), `rally_30` scoring mode + migration, no-bonus rule,
   points-scored standings chain, 1v4 / 2v3 knockout seeding.
2. **No-repeat-pairings rule** enforced on both write paths, exempt on knockouts.
3. **App made format-aware** — dashboard standings show a `PTS` column and a single
   sub-tab; knockout renders the SF/Final bracket; `getStandings` now ships `format`
   so clients stop assuming the SPPL chain.
4. **`import-mca-league.js`** — CSV-driven, dry-run/`--apply`, aborts on a squad that
   breaks the rulebook shape, sets captain ids, prints captain tokens.
5. **`build:mca`** kiosk build (verified: `/` → `/event/<baked id>` → MCA dashboard).
6. **Fixed two pre-existing bugs** found while testing: the scorer portal rejected every
   winner pick (client sends franchise id, endpoint only took per-slot Team ids —
   would have blocked every score at this event), and its tie list hardcoded `/13` games.

---

## 5. Current state

- **Nothing deployed. Nothing committed.** Both repos have the work in the working tree.
- **No league exists** in prod — the importer has only been run against isolated local DBs.
- **No squad CSV yet** from MCA. This is the blocker for step 3 of the runbook.
- Verified locally: 37 e2e assertions, 424 API unit tests, 21 roster-lib tests, plus
  browser checks of the captain portal, scorer portal, app dashboard and kiosk build.

---

## 6. Pending / TODO

- [ ] **Squad CSV from MCA** (5 × 10, 1 A+ / 8 A / 1 B, captain flagged).
- [ ] **Apply the `rally_30` enum migration on prod** — before the API deploy.
- [ ] Push `mca-badminton` → `main`; confirm the revision is serving.
- [ ] Run the importer (dry-run, then `--apply`); save LEAGUE_ID / SEASON_ID / tokens.
- [ ] Start League; retime the 13 ties once MCA confirms courts and slots.
- [ ] Create the Netlify site + `mca.yoiden.com` DNS; build and drag-drop `dist-mca`.
- [ ] Share the 5 captain-portal links; brief captains on the no-repeat-pairings rule.
- [ ] (Optional) WhatsApp captain template, as SBPL has (`captainsportal_sbpl`).

---

## 7. Safety rules (carry these over)

- **CSV-backup live event data before any prod schema/data change** (runbook §5).
- **Preview UI changes locally / on a copy before deploying.**
- **Never push unverified code to backend `main`** — it redeploys the live API.
- Prod `synchronize` OFF → **manual `ALTER` for any new column or enum value before deploy.**
- The importer is **dry-run by default**. Always read the dry-run output before `--apply`.

---

## 8. Local rehearsal

The whole flow can be re-run offline against a throwaway DB:

```bash
cd pickleplay-api
createdb pickleplay_mca && DB_NAME=pickleplay_mca SEED_ONLY=1 npx ts-node scripts/seed-mca-badminton.ts
# or exercise the real import path:
MCA_SQUAD_CSV=scripts/data/mca-squads.example.csv \
DST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/pickleplay_mca \
MCA_ORGANIZER_ID=<uuid> node scripts/import-mca-league.js
```

`scripts/mca-generate-fixtures.ts` runs the Start League step headlessly;
`scripts/open-mca-tie.ts` locks and starts one tie so the scorer portal has live games.
