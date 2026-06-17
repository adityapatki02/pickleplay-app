# League Screens UI Redesign (Yoiden design system) — Design

**Date:** 2026-06-17
**Repo:** pickleplay-app (Expo / React Native web → console.yoiden.com, deployed via Netlify Drop of `dist/`)
**Status:** Draft for review

## 1. Goal

Reskin the league screens — currently the "old SPPL" look (raw `View`/`Text` + a hand-written `StyleSheet`, plain tables and chip rows) — onto the **Yoiden design system** already used by the Home/Book screens, so the tournament experience matches the rest of the app. **Presentation only**: scoring, standings, knockout, and lineup logic stay exactly as-is.

**In scope (this project):**
- League Dashboard: **Overview**, **Standings**, **Fixtures**, **Knockout** tabs.
- **Tie scoring screen** (TieDetailScreen).

**Out of scope:** Admin/setup screens (Franchise/Roster/Group management, setup panel); a data-driven Best Performers (separate enhancement).

**Sequencing:** Incremental — redesign + ship + verify **one screen at a time, Dashboard first**, then TieDetail. Each ships via a fresh `dist` drop and is verified on the live deploy before the next.

## 2. Approach

**Recompose with the Yoiden component library, extracting shared league pieces as they recur.** Replace the bespoke local-styled UI with the existing Yoiden components; where a piece repeats across screens (a tie card, a standings row), extract it into a small `src/components/league/` layer so the screens stay consistent and DRY.

Rejected: a token-only reskin (swap colors/fonts but keep the old table structure) — it leaves the "old SPPL with new colors" feel and doesn't meet the goal.

### Design-system inventory (already in `src/components/yoiden`)
- Typography: `YDisplay`, `YEyebrow`, `YUiText`, `YMono`
- Tabs: `YTabBar` · Headers: `YTopBar`, `YSectionHead`
- Status/labels: `YBadge`, `YLive` · Controls: `YChip`, `YButton`
- Stats: `YStatTile` · Rows/cards: `YTournamentRow`, `YVenueRow`/`YVenueEditorial` (patterns to mirror)
- Team identity: `YTeamLogo`, `YAvatar` · Branded accents: `YStripes`, `YStripeFill`
- Tokens: `YColors`, `YType`, `YSpacing`, `YRadius`, `YShadow`

## 3. Design — Dashboard (first to ship)

The branded hero added earlier (`renderBrandedHero`, gated to cross_5game) stays as the top of the page.

- **Tab bar** — replace the bespoke chip grid with `YTabBar` (segmented/pill style matching the app). Same tab set: Overview / Fixtures / Standings / Knockout (Knockout admin-only).
- **Overview**
  - Quick stats (Franchises / Ties Played / Remaining) → a `YStatTile` trio.
  - Standings Snapshot → an editorial card: `YSectionHead` ("Standings Snapshot" + "View All"), rows using `YUiText`/`YDisplay` + `YTeamLogo`, qualified/zone markers as `YBadge`.
  - Champion banner / live tie / upcoming ties → restyled to Yoiden cards (logic unchanged).
- **Standings tab** — full standings as a clean Yoiden table/cards; group sub-tabs as `YTabBar` (or `YChip` row); qualification highlighting via `YBadge` + token colors.
- **Fixtures tab** — each tie as a shared `LeagueTieCard` (see §5): team names + `YTeamLogo`, court/time, status `YBadge`, tap → TieDetail.
- **Knockout tab** — the cross_5game SF/Final renderer restyled into branded bracket cards (reusing `LeagueTieCard`); the SPPL bracket gets the same card styling without changing its structure.

## 4. Design — Tie scoring screen (TieDetail, second to ship)
- Header/scoreboard → branded, using `YDisplay` for scores + `YColors`.
- The 5 games (data-driven `tieSlots`) → Yoiden cards with `YBadge` for status and `YUiText` typography.
- Lineup picker modal → Yoiden-styled rows/chips.
- Logic (scoring entry, save, lineup submit, player swap) untouched.

## 5. Shared components to extract (`src/components/league/`)
Created as they first recur, then reused:
- `LeagueTieCard` — a tie row/card (teams, time, court, status badge) used by Fixtures + Knockout (+ Overview live/upcoming).
- `LeagueStandingsTable` / `LeagueStandingsRow` — used by the Overview snapshot + Standings tab.
- `LeagueSectionHeader` (thin wrapper over `YSectionHead`) if the dashboard needs a consistent variant.

Each is presentational (props in, no data fetching), so it's testable and reusable.

## 6. Constraints
- **Presentation only** — no change to data fetching, scoring, standings, knockout, or lineup logic. The redesign swaps the visual layer of existing render functions.
- Follow the established Yoiden usage from `HomeScreen`/`YVenue*` (spacing, radii, shadows via tokens — no new ad-hoc color constants).
- The local `NAVY`/`BLUE`/`GREEN` constants are already aliases of `YColors`; migrate usages to the tokens/components rather than adding new hardcoded hex.

## 7. Sequencing & shipping
1. **Dashboard** — recompose tabs + Overview + Standings + Fixtures + Knockout; build `dist`; you drop it; verify on `console.yoiden.com/event/<id>`.
2. **TieDetail** — recompose; build; drop; verify.
Each step is its own commit set and live verification before moving on.

## 8. Risks
- Large files (`LeagueDashboardScreen` ~4,400 lines, `TieDetailScreen` ~2,000) — recompose in place carefully; extracting shared components reduces churn.
- Presentation/logic entanglement — keep edits to the JSX/styles of render functions; do not touch the data/handlers.
- Verification needs a logged-in session (OTP) — final visual check is the user's, per the established flow.

## 9. Out of scope / later
- Admin/setup screens redesign.
- Data-driven Best Performers (currently hidden for non-SPPL).
- Any backend change.
