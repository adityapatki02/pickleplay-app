# Single-Tournament Mode + Cross-Pool Knockout Screen — Design

**Date:** 2026-06-17
**Repo:** pickleplay-app (frontend / Expo + React Native web, deployed to console.yoiden.com via Netlify)
**Status:** Draft for review

## 1. Goal

Make the live app present **one** league cleanly for organizers, hiding everything else, and add the missing screens so the cross_5game tournament can be run end-to-end from the app. Specifically:

1. **Single-tournament mode** — app-wide, the app shows only the target league/season. AIPA West Zone, the Demo sandbox, and all other tournaments/leagues are hidden everywhere (home, discover/play, events lists).
2. **Cross-pool knockout screen** — the League Dashboard's Knockout tab must support the cross_5game bracket (2 semis → final), since today it's hardwired to the old SPPL 8-team bracket (Quarterfinals → Qualifier/Eliminator/Final).
3. **Group-phase screens verified** — fixtures, lineup, tie scoring (5 games), and standings confirmed working for the cross_5game format, with any 13-game/SPPL assumptions fixed.

The organizer does **not** create the format in-app — leagues are seeded via the backend. The app only displays and runs an already-created league.

**Target league:** the already-seeded one (currently "21st June Mumbai League [TEST]"), renamed to its real name. It already has 16 group ties + SF1/SF2/Final shells.

## 2. Approach (chosen)

**Config flag + conditional rendering.** A single frontend config object scopes the app to one event; screens read it and suppress unrelated content. Small, in one codebase, and reversible (flip the flag off → full app returns). Deploys through the existing Netlify pipeline.

Rejected: a separate dedicated build/domain (more work, second deploy target) and backend feature flags (over-engineered for one event). Accepted implication: because console.yoiden.com is the shared app, single-tournament mode hides other events **for all users** — confirmed acceptable since AIPA West Zone and the Demo are finished.

## 3. Design

### 3.1 `SINGLE_EVENT` config
New module `src/config/single-event.ts`:
```ts
export const SINGLE_EVENT = {
  enabled: true,
  leagueId: '69776e9d-62b7-43a9-95a1-cecb24647b7b',   // prod: the Mumbai league
  seasonId: '4ad2b657-de6c-4db2-ae00-e8ab392c37ae',   // prod: its season
  name: 'TBD — real tournament name (see Open item 1)',
};
```
One source of truth. `enabled: false` restores the normal multi-tournament app with zero other changes.

### 3.2 Home screen (`src/screens/yoiden/HomeScreen.tsx`)
When `SINGLE_EVENT.enabled`:
- Hide the two hardcoded featured cards (1st West Zone, Demo) and the DISCOVER block.
- Hide the "my events / hosting" tournament tiles that pull other data.
- Show **one** prominent card for the league → taps through to `LeagueDashboard` with the configured ids.
- Keep the greeting header (preserving the team's in-progress location-pill tweak already in the working tree).

### 3.3 Hide other data on the remaining screens
Scope or suppress tournament/league lists where they appear:
- **Play / Discover** (`yoiden/PlayScreen.tsx`, `DiscoverScreen.tsx`) — in single-event mode, hide the tournament feed (or replace with a single entry to the league). No other tournaments listed.
- **Me / My Events** (`yoiden/MeScreen.tsx`, `MyEventsScreen.tsx`) — hide other hosted/registered tournaments; the league is reachable from Home and the dashboard. The personal "next match" promo for unrelated events is suppressed.

The league screens themselves (`LeagueDashboard`, `Standings`, `TieDetail`, `StatsScreen`, franchise/roster/group management) are already scoped by league/season id, so they need no hiding changes.

### 3.4 Cross-pool knockout screen (`src/screens/league/LeagueDashboardScreen.tsx`)
Make the KNOCKOUT tab **format-aware**:
- Detect cross_5game (season `format === 'cross_5game'`, or knockout rounds are `knockout_sf1` / `knockout_sf2` / `knockout_final`).
- Render a clean **2 semis → final** bracket: SF1, SF2 side by side, Final below.
- Wire actions to the existing backend: a "Generate Knockout" action (calls the existing `generateKnockout` endpoint, which returns SF1/SF2/Final and seeds A1·B2 / B1·A2), and tap-through to each tie's `TieDetail` for scoring. The Final auto-fills from SF winners (backend `advanceKnockoutWinner` via `dependsOnTieA/B`).
- The existing SPPL bracket UI (QF/Qualifier/Eliminator) stays untouched and renders for non-cross_5game leagues.

### 3.5 Group-phase verification + fixes
Click-test against the live league and fix any cross_5game breakage:
- **Fixtures** tab lists the 16 ties.
- **TieDetail** shows 5 games (slots 1–5), scores save, rolls into standings.
- **Lineup** submission accepts any 10 players (generic games, no category gate).
- **Standings** (Group sub-tab) ranks both groups of 4.
Fix anything that assumes 13 slots or SPPL categories.

### 3.6 Rename the league (backend)
Update the league name from "21st June Mumbai League [TEST]" to the real name (single SQL/API update on prod). Set `SINGLE_EVENT.name` to match.

### 3.7 Deploy
Merge the frontend branch and let Netlify build/deploy `console.yoiden.com` (`npm run build:web` → `dist`). Confirm the deployed site shows single-event mode.

## 4. Out of scope
- In-app league/format creation (done via backend).
- A separate build/domain (using the shared app, per decision).
- The `synchronize: true` → migrations backend hardening (tracked separately).

## 5. Risks
- **Affects all console.yoiden.com users** (single-event mode is global) — accepted.
- The team's uncommitted `HomeScreen.tsx` tweak must be preserved, not reverted, when editing that file.
- Frontend `main` advanced (team's venue/booking work) — the branch must be synced onto latest `origin/main` before deploy so we don't ship stale code.

## 6. Open items
1. The **real tournament name** to rename to + set in `SINGLE_EVENT.name`.
2. Whether the **Play/Discover tab** should be hidden entirely or just emptied (minor UX — default: keep the tab, show only the league / an empty state).
