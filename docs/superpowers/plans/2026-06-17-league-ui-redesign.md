# League UI Redesign — Implementation Plan (Phase 1: Dashboard)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Recompose the League Dashboard (Overview, Standings, Fixtures, Knockout) onto the Yoiden design system so it matches the rest of the app — presentation only, no logic changes.

**Architecture:** Replace bespoke local-styled UI in `LeagueDashboardScreen.tsx` with Yoiden components (`YChip`, `YStatTile`, `YBadge`, `YSectionHead`, `YDisplay`/`YUiText`/`YEyebrow`, `YTeamLogo`) + tokens (`YColors`/`YSpacing`/`YRadius`/`YShadow`). Extract a shared presentational `LeagueTieCard` (used by Fixtures + Knockout + Overview) into `src/components/league/`. Each render function is reskinned in place; data/handlers untouched.

**Tech Stack:** Expo / React Native (web), TypeScript. No jest configured → verification is `npm run build:web` (must succeed) + live visual check after a `dist` drop. Deploy: manual Netlify Drop of `dist/` to `console.yoiden.com` (project `thunderous-alpaca-b43021`).

**Branch:** `feature/league-ui-redesign` (already created).

**Note on `YTabBar`:** it is the app's *bottom* nav (hardcoded home/play/book/fantasy/me) — NOT a generic segmented control. Use `YChip` for the dashboard's in-content tabs.

---

## Component API reference (verified)
- `YChip`: `{ children, active?: boolean, onPress?, style? }`
- `YStatTile`: `{ label: string, value: number|string, icon?, accent?: string, onPress?, style? }`
- `YBadge`: `{ children, color?: string, bg?: string, style? }` (with `bg`: `color` is fg; without: `color` is bg, fg white)
- `YSectionHead`: `{ eyebrow?, title?, action?: string, onActionPress? }`
- `YDisplay`: `{ size?, color?, italic?, style?, children }` · `YEyebrow`: `{ size?, color? }` · `YUiText`: `{ size?, weight?, color?, numberOfLines?, style? }`
- `YTeamLogo`: from `YAvatar` (team crest)
- Tokens: `YColors` (ink/ink2/ink3/accent/lime/bg/line2), `YSpacing`, `YRadius`, `YShadow`
- Import: `import { YChip, YStatTile, YBadge, YSectionHead, YDisplay, YUiText, YEyebrow, YTeamLogo, YColors } from '../../components/yoiden';`

---

## Task 1: Extract `LeagueTieCard` shared component

**Files:**
- Create: `src/components/league/LeagueTieCard.tsx`

**Context:** A presentational card for a tie — two teams, time/court, status badge, optional point pills — reused by Fixtures, Knockout, and the Overview live/upcoming lists. Props in, no data fetching.

- [ ] **Step 1: Create the component**

```tsx
import React from 'react';
import { Pressable, View } from 'react-native';
import { YUiText, YEyebrow, YBadge, YColors, YRadius } from '../yoiden';

export type LeagueTieCardProps = {
  homeName: string;
  awayName: string;
  homeWon?: boolean;
  awayWon?: boolean;
  meta?: string;          // e.g. "21 Jun · Court 1" or "SEMIFINAL 1"
  statusLabel?: string;   // e.g. "Scheduled" / "Live" / "Completed"
  statusColor?: string;   // YColors token
  statusBg?: string;
  onPress?: () => void;
  disabled?: boolean;
};

export const LeagueTieCard: React.FC<LeagueTieCardProps> = ({
  homeName, awayName, homeWon, awayWon, meta, statusLabel, statusColor, statusBg, onPress, disabled,
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled || !onPress}
    style={({ pressed }) => [{
      backgroundColor: '#fff',
      borderRadius: YRadius?.lg ?? 14,
      borderWidth: 1,
      borderColor: YColors.line2,
      padding: 16,
      marginBottom: 10,
      opacity: pressed ? 0.92 : 1,
    }]}
  >
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      {meta ? <YEyebrow size={10} color={YColors.ink3}>{meta}</YEyebrow> : <View />}
      {statusLabel ? (
        <YBadge color={statusColor ?? YColors.ink2} bg={statusBg ?? '#F1F5F9'}>{statusLabel}</YBadge>
      ) : null}
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <YUiText size={15} weight={homeWon ? 900 : 700} color={YColors.ink} numberOfLines={1} style={{ flex: 1 }}>
        {homeName}
      </YUiText>
      <YUiText size={11} weight={700} color={YColors.ink3} style={{ marginHorizontal: 10 }}>vs</YUiText>
      <YUiText size={15} weight={awayWon ? 900 : 700} color={YColors.ink} numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>
        {awayName}
      </YUiText>
    </View>
  </Pressable>
);
```

- [ ] **Step 2: Build to confirm it compiles**

Run: `npm run build:web` (from `pickleplay-app`)
Expected: build succeeds, `Exported: dist`. (If `YRadius.lg` is undefined the `?? 14` fallback covers it; confirm `YRadius` shape in `src/config/yoiden` and adjust the key if needed.)

- [ ] **Step 3: Commit**

```bash
git add src/components/league/LeagueTieCard.tsx
git commit -m "feat(league-ui): add shared LeagueTieCard presentational component"
```

---

## Task 2: Dashboard tab bar → `YChip` segmented

**Files:**
- Modify: `src/screens/league/LeagueDashboardScreen.tsx` — the tab bar block (the `<View style={[styles.tabBar...]}>` rendering `TABS.filter(...).map(...)` with `styles.tabChip`).

- [ ] **Step 1: Add the import**

Add `YChip` to the existing yoiden import at the top of the file:
```tsx
import { YColors, YTopBar, YChip } from '../../components/yoiden';
```

- [ ] **Step 2: Replace the tab chips with `YChip`**

Replace the inner `TABS.filter((tab) => tab !== 'KNOCKOUT' || isAdmin).map((tab) => { ... <TouchableOpacity style={styles.tabChip ...}> ... </TouchableOpacity> })` with:
```tsx
{TABS.filter((tab) => tab !== 'KNOCKOUT' || isAdmin).map((tab) => (
  <YChip
    key={tab}
    active={activeTab === tab}
    onPress={() => setActiveTab(tab)}
    style={{ flexGrow: 1, flexBasis: '31%', marginBottom: 6 }}
  >
    {tab}
  </YChip>
))}
```
Keep the surrounding `<View style={[styles.tabBar, { paddingHorizontal: 12, paddingVertical: 10 }]}>` wrapper and its inner flex-wrap `<View>`.

- [ ] **Step 3: Build + visual check**

Run: `npm run build:web` → succeeds. (Visual verify happens at Task 8 after the drop.)

- [ ] **Step 4: Commit**

```bash
git add src/screens/league/LeagueDashboardScreen.tsx
git commit -m "feat(league-ui): dashboard tabs use YChip segmented control"
```

---

## Task 3: Overview quick stats → `YStatTile`

**Files:**
- Modify: `LeagueDashboardScreen.tsx` — `renderQuickStats()`.

- [ ] **Step 1: Add `YStatTile` to the import**

```tsx
import { YColors, YTopBar, YChip, YStatTile } from '../../components/yoiden';
```

- [ ] **Step 2: Recompose `renderQuickStats` to a YStatTile row**

Replace the body of `renderQuickStats` with (keeping its computed `stats` values — Franchises / Ties Played / Remaining):
```tsx
  const renderQuickStats = () => {
    const totalTies = ties.length;
    const played = completedTies.length;
    const remaining = totalTies - played;
    return (
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 14, marginTop: 12 }}>
        <YStatTile label="Franchises" value={franchises.length} accent={YColors.ink} style={{ flex: 1 }} />
        <YStatTile label="Ties Played" value={played} accent={YColors.accent} style={{ flex: 1 }} />
        <YStatTile label="Remaining" value={remaining} accent={YColors.ink} style={{ flex: 1 }} />
      </View>
    );
  };
```

- [ ] **Step 3: Build**

Run: `npm run build:web` → succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/screens/league/LeagueDashboardScreen.tsx
git commit -m "feat(league-ui): overview quick stats use YStatTile"
```

---

## Task 4: Overview Standings Snapshot → `YSectionHead` + rows + `YBadge`

**Files:**
- Modify: `LeagueDashboardScreen.tsx` — the league-phase fallback block of `renderHeroStandings()` (the "Standings Snapshot" table; leave the `inQfMode` QF branch alone for now).

- [ ] **Step 1: Recompose the snapshot block**

Replace the league-phase return (the `<View style={styles.heroStandings}>` … "Standings Snapshot" header + `styles.heroTable`) with a Yoiden version (keeps `sorted`/`top` logic):
```tsx
    const sorted = [...standings].sort((a, b) => b.standingPoints - a.standingPoints);
    const top = sorted.slice(0, 5);
    if (top.length === 0) return null;
    return (
      <View style={{ marginHorizontal: 14, marginTop: 8 }}>
        <YSectionHead eyebrow="LEAGUE" title="Standings Snapshot" action="View All" onActionPress={() => setActiveTab('STANDINGS')} />
        <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: YColors.line2, overflow: 'hidden' }}>
          {top.map((s, idx) => (
            <View key={s.franchiseId} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: YColors.line2 }}>
              <YUiText size={13} weight={900} color={idx < 4 ? YColors.accent : YColors.ink3} style={{ width: 26 }}>{idx + 1}</YUiText>
              <YUiText size={14} weight={700} color={YColors.ink} numberOfLines={1} style={{ flex: 1 }}>{teamName(s.franchiseId)}</YUiText>
              <YUiText size={13} weight={900} color={YColors.ink}>{s.standingPoints}</YUiText>
              <YEyebrow size={9} color={YColors.ink3} style={{ marginLeft: 4 }}>SP</YEyebrow>
            </View>
          ))}
        </View>
      </View>
    );
```

- [ ] **Step 2: Ensure imports** — add `YSectionHead`, `YUiText`, `YEyebrow` to the yoiden import line.

- [ ] **Step 3: Build** → `npm run build:web` succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/screens/league/LeagueDashboardScreen.tsx
git commit -m "feat(league-ui): overview standings snapshot uses Yoiden card + YSectionHead"
```

---

## Task 5: Fixtures tab → `LeagueTieCard`

**Files:**
- Modify: `LeagueDashboardScreen.tsx` — `renderFixtures()` (and/or its `renderTieCard` helper used in the fixtures list).

- [ ] **Step 1: Import the shared card**

```tsx
import { LeagueTieCard } from '../../components/league/LeagueTieCard';
```

- [ ] **Step 2: Render fixtures with `LeagueTieCard`**

In `renderFixtures`, map each tie through `LeagueTieCard`, deriving the props from the existing tie data (reuse `teamNamePlain`, `STATUS_CHIP`, and the existing `scheduledStart`/`courtNumber` formatting already in the file):
```tsx
{fixturesList.map((tie) => {
  const chip = STATUS_CHIP[tie.status] || STATUS_CHIP.scheduled;
  return (
    <LeagueTieCard
      key={tie.id}
      homeName={tie.homeTeamId ? teamNamePlain(tie.homeTeamId) : 'TBD'}
      awayName={tie.awayTeamId ? teamNamePlain(tie.awayTeamId) : 'TBD'}
      homeWon={!!tie.winnerId && tie.winnerId === tie.homeTeamId}
      awayWon={!!tie.winnerId && tie.winnerId === tie.awayTeamId}
      meta={formatTieMeta(tie) /* reuse existing date/court formatter; if none, pass `tie.matchDay || ''` */}
      statusLabel={chip.label}
      statusColor={chip.color}
      statusBg={chip.bg}
      onPress={() => navigation.navigate('TieDetail', { tieId: tie.id, leagueId })}
    />
  );
})}
```
Read `renderFixtures` first to use its actual list variable name and existing meta/date formatting; do not invent a `formatTieMeta` if one isn't there — pass the already-formatted string the current code uses.

- [ ] **Step 3: Build** → `npm run build:web` succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/screens/league/LeagueDashboardScreen.tsx src/components/league/LeagueTieCard.tsx
git commit -m "feat(league-ui): fixtures use shared LeagueTieCard"
```

---

## Task 6: Knockout (cross_5game) cards → `LeagueTieCard`

**Files:**
- Modify: `LeagueDashboardScreen.tsx` — `renderCrossPoolKnockout()` (added earlier).

- [ ] **Step 1: Replace the inline `Card` with `LeagueTieCard`**

In `renderCrossPoolKnockout`, swap the locally-defined `Card` for `LeagueTieCard`, passing `meta={label}` (e.g. "SEMIFINAL 1"), names via `nm()`, and a completed status:
```tsx
<LeagueTieCard
  meta="SEMIFINAL 1"
  homeName={nm(sf1?.homeTeamId)}
  awayName={nm(sf1?.awayTeamId)}
  homeWon={sf1?.status === 'completed' && sf1?.winnerId === sf1?.homeTeamId}
  awayWon={sf1?.status === 'completed' && sf1?.winnerId === sf1?.awayTeamId}
  statusLabel={sf1?.status === 'completed' ? 'Completed' : 'Scheduled'}
  statusColor={sf1?.status === 'completed' ? GREEN : YColors.ink2}
  statusBg={sf1?.status === 'completed' ? '#ECFDF5' : '#F1F5F9'}
  onPress={() => sf1?.id && navigation.navigate('TieDetail', { tieId: sf1.id, leagueId, seasonId: resolvedSeasonId })}
/>
```
Repeat for `sf2` ("SEMIFINAL 2") and `final` ("FINAL"). Keep the "GENERATE KNOCKOUT" button (restyle to `YButton variant="accent"` if desired). Remove the now-unused inline `Card`.

- [ ] **Step 2: Build** → `npm run build:web` succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/screens/league/LeagueDashboardScreen.tsx
git commit -m "feat(league-ui): knockout SF/Final use shared LeagueTieCard"
```

---

## Task 7: Standings tab → Yoiden table/cards

**Files:**
- Modify: `LeagueDashboardScreen.tsx` — `renderStandingsTab()` and its `SUB_TABS` row.

- [ ] **Step 1: Sub-tabs → `YChip`**

Replace the `SUB_TABS.map(...)` chip row with `YChip` (active = `standingsSubTab === t.key`, `onPress={() => setStandingsSubTab(t.key)}`), same as Task 2's pattern.

- [ ] **Step 2: Standings rows → Yoiden card rows**

Recompose the standings table rows to the same card/row style as Task 4 (white card, `YColors.line2` dividers, `YUiText` cells, rank in `YColors.accent` for the qualification zone, a `YBadge` "Q" for qualified teams). Keep the existing sort/group-filter logic and column values (P / W / SP / PD).

- [ ] **Step 3: Build** → `npm run build:web` succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/screens/league/LeagueDashboardScreen.tsx
git commit -m "feat(league-ui): standings tab uses Yoiden cards + YChip sub-tabs"
```

---

## Task 8: Build, ship, verify

**Files:** none (deploy + verification).

- [ ] **Step 1: Full build**

Run: `npm run build:web`
Expected: `Exported: dist`, no errors. Confirm the bundle still has the cross_5game gate + deep link: `B=$(ls dist/_expo/static/js/web/index-*.js|head -1); grep -c cross_5game "$B"; grep -c 'event/:leagueId' "$B"` → both ≥ 1.

- [ ] **Step 2: Deploy (manual)**

Reveal `dist`: `open .` — drag the `dist` folder onto the Netlify Drop box for project `thunderous-alpaca-b43021` (console.yoiden.com). Wait for publish.

- [ ] **Step 3: Verify on the live deploy (user, logged in)**

Open `https://console.yoiden.com/event/69776e9d-62b7-43a9-95a1-cecb24647b7b`, hard-refresh. Confirm: tabs are the new pill style; Overview stats/standings/fixtures look like the Yoiden app; Knockout cards branded; **scoring/standings numbers unchanged**.

- [ ] **Step 4: Merge to main**

```bash
git checkout main && git merge --ff-only feature/league-ui-redesign && git push origin main
```

---

## Phase 2 (separate plan, after Dashboard ships & verifies): TieDetail
Recompose `TieDetailScreen` (scoreboard, the 5 games, lineup picker modal) onto the same Yoiden components + `LeagueTieCard`/badges. Written as its own plan once the Dashboard look is confirmed, per the incremental approach.

## Notes
- Presentation-only; never edit data fetches/handlers in these render functions.
- Read each render function before editing to use its real variable names and existing formatters (don't invent helpers).
- Dead local styles (`styles.tabChip`, `styles.heroTable`, `styles.statPill`, etc.) can be removed once unused, but that's optional cleanup — leaving them is harmless.
