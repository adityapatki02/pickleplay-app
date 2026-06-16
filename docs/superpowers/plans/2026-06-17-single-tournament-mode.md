# Single-Tournament Mode + Cross-Pool Knockout Screen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `console.yoiden.com` present only the "Mumbai Open" league (hiding all other tournaments/leagues) and add a working 2-semis→final knockout screen for the cross_5game format.

**Architecture:** A single `SINGLE_EVENT` config object scopes the app to one league/season; screens read it to hide unrelated content and route to the league. The League Dashboard's Knockout tab is made format-aware to render the cross_5game SF/Final bracket. All changes are gated so `enabled: false` restores the full app.

**Tech Stack:** Expo / React Native (web target via `expo export`), TypeScript, deployed to Netlify (`npm run build:web` → `dist`).

**Repo:** `pickleplay-app`, branch `feature/single-tournament-mode`. Backend (`yoiden-api`) already supports cross_5game — no backend code changes here (only one SQL rename in Task 7).

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/config/single-event.ts` | The single source of truth for single-event mode | Create |
| `src/screens/yoiden/HomeScreen.tsx` | Home — hide featured/events/nearby, show one league card | Modify |
| `src/screens/yoiden/PlayScreen.tsx` | Play tab — suppress other-tournament feed | Modify |
| `src/screens/yoiden/MeScreen.tsx` | Me tab — suppress unrelated events promo | Modify |
| `src/screens/league/LeagueDashboardScreen.tsx` | Knockout tab — format-aware SF/Final render | Modify |
| `src/config/single-event.spec.ts` | Unit test for the config helper | Create |

Known prod ids (target league): leagueId `69776e9d-62b7-43a9-95a1-cecb24647b7b`, seasonId `4ad2b657-de6c-4db2-ae00-e8ab392c37ae`.

---

## Task 1: Sync branch onto latest origin/main (preserve local WIP)

**Files:** none (git hygiene). The team's `main` advanced; the local `HomeScreen.tsx` tweak (`nameCol`/`locPillStandalone`) is local-only WIP that must survive.

- [ ] **Step 1: Stash the local WIP**

Run:
```bash
cd /Users/adityapatki/Documents/pickleplay/pickleplay-app
git stash push -m "wip-homescreen-locpill" src/screens/yoiden/HomeScreen.tsx
```
Expected: "Saved working directory..." and `git status` clean.

- [ ] **Step 2: Rebase the feature branch onto latest origin/main**

Run:
```bash
git fetch origin && git rebase origin/main
```
Expected: "Successfully rebased". (Our only commits so far are the two spec docs — no code conflicts.)

- [ ] **Step 3: Restore the WIP**

Run:
```bash
git stash pop
```
Expected: `HomeScreen.tsx` shows as modified again. If a conflict appears, keep both the upstream changes and the `nameCol`/`locPillStandalone` tweak (they're in different regions).

- [ ] **Step 4: Type-check baseline**

Run: `npx tsc --noEmit`
Expected: completes (note any pre-existing errors so later tasks can distinguish new ones).

- [ ] **Step 5: Commit the preserved WIP so it's not lost**

```bash
git add src/screens/yoiden/HomeScreen.tsx
git commit -m "chore: preserve in-progress home header/location-pill tweak"
```

---

## Task 2: `SINGLE_EVENT` config module

**Files:**
- Create: `src/config/single-event.ts`
- Create: `src/config/single-event.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/config/single-event.spec.ts`:
```ts
import { SINGLE_EVENT, isSingleEvent } from './single-event';

describe('SINGLE_EVENT', () => {
  it('is enabled and points at the Mumbai Open league/season', () => {
    expect(SINGLE_EVENT.enabled).toBe(true);
    expect(SINGLE_EVENT.leagueId).toBe('69776e9d-62b7-43a9-95a1-cecb24647b7b');
    expect(SINGLE_EVENT.seasonId).toBe('4ad2b657-de6c-4db2-ae00-e8ab392c37ae');
    expect(SINGLE_EVENT.name).toBe('Mumbai Open');
  });

  it('isSingleEvent() reflects the enabled flag', () => {
    expect(isSingleEvent()).toBe(SINGLE_EVENT.enabled);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest single-event --silent`
Expected: FAIL — "Cannot find module './single-event'". (If jest isn't configured, skip jest steps in this plan and rely on `npx tsc --noEmit` + preview verification; note that in the commit.)

- [ ] **Step 3: Create the config module**

Create `src/config/single-event.ts`:
```ts
/**
 * Single-tournament mode. When enabled, the app shows ONLY this league/season
 * everywhere and hides all other tournaments/leagues. Flip `enabled` to false
 * to restore the normal multi-tournament app with no other changes.
 */
export const SINGLE_EVENT = {
  enabled: true,
  leagueId: '69776e9d-62b7-43a9-95a1-cecb24647b7b',
  seasonId: '4ad2b657-de6c-4db2-ae00-e8ab392c37ae',
  name: 'Mumbai Open',
} as const;

export function isSingleEvent(): boolean {
  return SINGLE_EVENT.enabled;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest single-event --silent`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config/single-event.ts src/config/single-event.spec.ts
git commit -m "feat: add SINGLE_EVENT config for single-tournament mode"
```

---

## Task 3: Home screen — single-event mode

**Files:**
- Modify: `src/screens/yoiden/HomeScreen.tsx`

**Context:** Today the home renders two hardcoded featured cards (1st West Zone, Demo), a "YOUR EVENTS" section, and an "UPCOMING NEARBY" section — all listing other tournaments. In single-event mode we hide those and show one league card that opens the dashboard. The existing `goSPPL` helper shows the league-nav pattern: `nav.navigate('HomeTab', { screen: 'LeagueDashboard', params: { leagueId, seasonId } })`.

- [ ] **Step 1: Import the config**

At the top of `HomeScreen.tsx`, with the other imports:
```ts
import { SINGLE_EVENT } from '../../config/single-event';
```

- [ ] **Step 2: Add a league-open helper + card (near the existing `goSPPL`)**

Add this helper alongside `goSPPL`:
```ts
  const openSingleEvent = () =>
    nav.navigate('HomeTab', {
      screen: 'LeagueDashboard',
      params: { leagueId: SINGLE_EVENT.leagueId, seasonId: SINGLE_EVENT.seasonId },
    });
```

- [ ] **Step 3: Render the single-event card and hide the featured cards**

Wrap the two featured-card blocks (the `{/* Featured 1 ... */}` and `{/* Featured 2 ... */}` `<View style={styles.featuredWrap}>` blocks) so they only render when NOT in single-event mode, and render the league card when in single-event mode. Replace the opening of the first featured block with a conditional:

```tsx
        {SINGLE_EVENT.enabled ? (
          <View style={styles.featuredWrap}>
            <Pressable
              onPress={openSingleEvent}
              style={({ pressed }) => [styles.featuredCard, pressed && { opacity: 0.92 }]}
            >
              <View style={styles.featuredBadgeRow}>
                <View style={styles.featuredBadge}>
                  <YUiText size={9} weight={900} color="#000" style={{ letterSpacing: 1.2 }}>LIVE LEAGUE</YUiText>
                </View>
              </View>
              <YDisplay size={32} color="#fff" style={{ marginTop: 18, lineHeight: 32 }}>
                {SINGLE_EVENT.name.toUpperCase()}
              </YDisplay>
              <View style={styles.featuredFooter}>
                <YUiText size={11} weight={800} color={YColors.lime} style={{ letterSpacing: 1 }}>
                  OPEN DASHBOARD  →
                </YUiText>
              </View>
            </Pressable>
          </View>
        ) : (
          <>
            {/* existing Featured 1 (West Zone) block */}
            {/* existing Featured 2 (Demo) block */}
          </>
        )}
```
Move the two original `<View style={styles.featuredWrap}>…</View>` featured blocks inside the `: (<> … </>)` else branch unchanged.

- [ ] **Step 4: Hide the other-tournament sections**

Wrap the "YOUR EVENTS" block and the "UPCOMING NEARBY" block each in `{!SINGLE_EVENT.enabled && ( … )}`. For "YOUR EVENTS", the existing block is `{(upcomingRegs.length > 0 || visibleHosted.length > 0) ? ( … ) : null}` — change the condition to `{!SINGLE_EVENT.enabled && (upcomingRegs.length > 0 || visibleHosted.length > 0) ? ( … ) : null}`. For "UPCOMING NEARBY" (the `<YSectionHead ... title="UPCOMING NEARBY" />` and its following `<View style={styles.listWrap}>`), wrap both in `{!SINGLE_EVENT.enabled && ( <> … </> )}`.

- [ ] **Step 5: Type-check + preview**

Run: `npx tsc --noEmit` (expect: no new errors).
Then verify in the running web app (see Task 6 for how to launch). Home should show only the "MUMBAI OPEN" card and the greeting — no West Zone, Demo, Your Events, or Nearby sections.

- [ ] **Step 6: Commit**

```bash
git add src/screens/yoiden/HomeScreen.tsx
git commit -m "feat: single-event home — show only the league, hide other tournaments"
```

---

## Task 4: Hide other data on Play and Me tabs

**Files:**
- Modify: `src/screens/yoiden/PlayScreen.tsx`
- Modify: `src/screens/yoiden/MeScreen.tsx`

**Context:** These tabs list tournaments/registrations beyond the single event. In single-event mode they should not surface other events. Read each screen's top-level list render before editing and reuse its existing empty-state component.

- [ ] **Step 1: PlayScreen — import config + gate the feed**

At the top of `PlayScreen.tsx`:
```ts
import { SINGLE_EVENT } from '../../config/single-event';
```
Find the screen's main list/feed of tournaments (search for `.map(` over tournaments or the `discover`/AIPA slots referenced in the file header comment). Wrap that list so that when `SINGLE_EVENT.enabled` it renders an empty state instead — reuse the file's existing empty-state markup; if none exists, render:
```tsx
{SINGLE_EVENT.enabled ? (
  <View style={{ padding: 24 }}>
    <YUiText size={12} color={YColors.ink2}>
      {SINGLE_EVENT.name} is the active event. Open it from Home.
    </YUiText>
  </View>
) : (
  /* existing tournament feed */
)}
```
Match the existing imports for `View` / `YUiText` / `YColors` already used in the file.

- [ ] **Step 2: MeScreen — import config + gate unrelated events**

At the top of `MeScreen.tsx`:
```ts
import { SINGLE_EVENT } from '../../config/single-event';
```
Find sections that list the user's other tournaments/registrations or a "next match" promo for non-league events (search for `getMyTournaments`, `getMyRegistrations`, or `NEXT MATCH`). Wrap each such section in `{!SINGLE_EVENT.enabled && ( … )}` so only league-relevant content and the profile/stats remain.

- [ ] **Step 3: Type-check + preview**

Run: `npx tsc --noEmit` (expect: no new errors). In the web app, the Play tab shows the single-event empty state; the Me tab shows the profile/stats without unrelated tournament promos.

- [ ] **Step 4: Commit**

```bash
git add src/screens/yoiden/PlayScreen.tsx src/screens/yoiden/MeScreen.tsx
git commit -m "feat: suppress other-tournament content on Play and Me in single-event mode"
```

---

## Task 5: Format-aware knockout (cross_5game SF/Final)

**Files:**
- Modify: `src/screens/league/LeagueDashboardScreen.tsx`

**Context:** `renderKnockoutTab()` is hardwired to the SPPL 8-team bracket (QF1-4 → Qualifier/Eliminator → Final). For cross_5game the backend's `getKnockoutBracket` returns `sf1`, `sf2`, `final` (qf*/q*/eliminator are null) and `generateKnockout` seeds SF1 = A1·B2, SF2 = B1·A2 with the Final auto-advancing. `season` (`store.currentSeason`) carries `format`. `knockoutData` (state) holds the bracket; `generateKnockout` is already imported; `franchiseMap[id]?.name` resolves team names; `navigation.navigate('TieDetail', { tieId, leagueId, seasonId: resolvedSeasonId })` opens scoring.

- [ ] **Step 1: Add a cross_5game branch at the top of `renderKnockoutTab`**

At the very start of `renderKnockoutTab` (right after `const renderKnockoutTab = () => {`), add:
```tsx
    if (season?.format === 'cross_5game') {
      return renderCrossPoolKnockout();
    }
```

- [ ] **Step 2: Add the `renderCrossPoolKnockout` function**

Add this function directly above `renderKnockoutTab`:
```tsx
  // ── KNOCKOUT TAB (cross_5game: 2 semis → final) ──
  const renderCrossPoolKnockout = () => {
    const sf1 = knockoutData?.sf1;
    const sf2 = knockoutData?.sf2;
    const final = knockoutData?.final;
    const seeded = !!(sf1?.homeTeamId && sf2?.homeTeamId);

    const teamName = (id?: string | null) =>
      (id ? franchiseMap[id]?.name : '') || 'TBD';

    const TieCard = ({ tie, label }: { tie?: Tie | null; label: string }) => (
      <TouchableOpacity
        disabled={!tie?.id}
        onPress={() => tie?.id && navigation.navigate('TieDetail', {
          tieId: tie.id, leagueId, seasonId: resolvedSeasonId,
        })}
        style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, marginBottom: 12 }}
      >
        <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, marginBottom: 8 }}>{label}</Text>
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>{teamName(tie?.homeTeamId)}</Text>
        <Text style={{ fontSize: 12, color: '#94A3B8', marginVertical: 2 }}>vs</Text>
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>{teamName(tie?.awayTeamId)}</Text>
        {tie?.status === 'completed' && tie?.winnerId ? (
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#06D6A0', marginTop: 8 }}>
            ✓ {teamName(tie.winnerId)} won
          </Text>
        ) : null}
      </TouchableOpacity>
    );

    return (
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 16 }}>KNOCKOUT</Text>
        {!seeded ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>
              Top 2 of each group advance. SF1 = A1 vs B2, SF2 = B1 vs A2.
            </Text>
            <TouchableOpacity
              disabled={actionLoading}
              onPress={() => xConfirm(
                'Generate Knockout',
                'Seed the semifinals from the current group standings?',
                async () => {
                  setActionLoading(true);
                  try {
                    await generateKnockout(leagueId, resolvedSeasonId);
                    await fetchAll();
                  } catch (err: any) {
                    xAlert('Error', err?.response?.data?.message || err?.message || 'Failed');
                  } finally { setActionLoading(false); }
                },
              )}
              style={{ backgroundColor: '#2196F3', borderRadius: 10, padding: 16, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
                {actionLoading ? 'WORKING…' : 'GENERATE KNOCKOUT'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <TieCard tie={sf1} label="SEMIFINAL 1" />
        <TieCard tie={sf2} label="SEMIFINAL 2" />
        <TieCard tie={final} label="FINAL" />
      </View>
    );
  };
```

- [ ] **Step 3: Verify imports exist**

Confirm `TouchableOpacity`, `Text`, and `View` are imported from `react-native` at the top of the file (they are used elsewhere in this screen — add any that are missing). `xConfirm`, `xAlert`, `actionLoading`, `setActionLoading`, `generateKnockout`, `fetchAll`, `franchiseMap`, `knockoutData`, `navigation`, `leagueId`, `resolvedSeasonId`, `season` are all already in scope in this component (used by the SPPL render).

- [ ] **Step 4: Type-check + preview**

Run: `npx tsc --noEmit` (expect: no new errors). Open the Mumbai Open league → Knockout tab: before generating it shows the GENERATE button; after, SF1 (A1·B2), SF2 (B1·A2), and Final cards. Other (SPPL) leagues still render the original bracket.

- [ ] **Step 5: Commit**

```bash
git add src/screens/league/LeagueDashboardScreen.tsx
git commit -m "feat: format-aware knockout — cross_5game 2-semis-to-final bracket"
```

---

## Task 6: Verify & fix group-phase screens

**Files:** none unless a bug is found (then modify the offending screen).

**Context:** Confirm fixtures, lineup, tie scoring (5 games), and standings work for cross_5game. Run the web app locally against the test DB so you don't touch prod while clicking around.

- [ ] **Step 1: Launch backend (test DB) + web app**

Backend (separate terminal):
```bash
cd /Users/adityapatki/Documents/pickleplay/pickleplay-api && DB_NAME=pickleplay_verify NODE_ENV=production PORT=3000 node dist/main.js
```
Point the app at it: temporarily set `API_BASE_URL` dev branch to `http://localhost:3000/api/v1` in `src/config/constants.ts` (revert before deploy), then:
```bash
cd /Users/adityapatki/Documents/pickleplay/pickleplay-app && npm run web
```

- [ ] **Step 2: Verify fixtures**

Open the league → FIXTURES. Expected: 16 group ties listed; tapping one opens TieDetail.

- [ ] **Step 3: Verify tie scoring (5 games)**

In a tie, expected: 5 games (slots 1–5), scores entered save, the tie completes and updates standings. If it shows 13 games or errors on a 14th slot, fix the screen to read the tie's actual `tieMatches` length instead of a hardcoded 13.

- [ ] **Step 4: Verify lineup**

Submit a lineup as a captain (or via dashboard). Expected: any 10 roster players accepted across the 5 games (no category rejection). If it enforces SPPL categories, fix to honor the `allowedCategories`-empty case.

- [ ] **Step 5: Verify standings**

Open STANDINGS → Group sub-tab. Expected: both groups of 4 rank correctly.

- [ ] **Step 6: Revert the local API URL change + commit any fixes**

Restore `src/config/constants.ts` to point at prod. Commit only if a screen fix was needed:
```bash
git add -A && git commit -m "fix: <screen> handles cross_5game group phase"
```
If nothing needed fixing, record that in the task notes and skip the commit.

---

## Task 7: Rename the league to "Mumbai Open"

**Files:** none (one prod DB update).

- [ ] **Step 1: Rename**

Run:
```bash
PGPASSWORD='Y01d3n_Pr0d_2026' psql -h 34.93.29.180 -U yoiden_user -d yoiden -tAc \
"UPDATE leagues SET name='Mumbai Open' WHERE id='69776e9d-62b7-43a9-95a1-cecb24647b7b' RETURNING name;"
```
Expected: `Mumbai Open`.

- [ ] **Step 2: Verify via prod API**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://yoiden-api-460478077750.asia-south1.run.app/api/v1/leagues/69776e9d-62b7-43a9-95a1-cecb24647b7b"
```
Expected: `200`.

---

## Task 8: Deploy to console.yoiden.com

**Files:** none (deploy).

- [ ] **Step 1: Confirm API URL points at prod**

Verify `src/config/constants.ts` `API_BASE_URL` both branches point at `https://yoiden-api-460478077750.asia-south1.run.app/api/v1` (the Task 6 local override is reverted).

- [ ] **Step 2: Local web build sanity check**

Run: `npm run build:web`
Expected: completes, `dist/` produced, no build errors.

- [ ] **Step 3: Merge to main + push (triggers Netlify)**

```bash
git checkout main && git merge --ff-only feature/single-tournament-mode && git push origin main
```
Expected: push succeeds; Netlify builds and deploys (it watches `main`).

- [ ] **Step 4: Verify the deployed site**

Open `https://console.yoiden.com`, log in (8149998143). Expected: Home shows only the "MUMBAI OPEN" card (no West Zone/Demo/Discover); opening it shows the dashboard; Knockout tab renders the SF/Final view.

---

## Notes / out of scope
- No in-app league/format creation (seeded via backend).
- `synchronize: true` → migrations hardening is tracked separately (backend).
- If the official tournament name arrives later: update the league name (Task 7 SQL) and `SINGLE_EVENT.name`, redeploy.
- Reversibility: set `SINGLE_EVENT.enabled = false` and redeploy to restore the full multi-tournament app.
