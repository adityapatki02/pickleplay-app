import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { getAllPlayerStats, getLeague } from '../../api/leagues.api';
import { useAuthStore } from '../../store/authStore';
import type { PlayerStat, League } from '../../types/league.types';
import { xAlert } from '../../utils/alert';
import DownloadButton from '../../components/DownloadButton';
import { downloadCSV } from '../../utils/csvExport';

import { Colors, Fonts, Radius, Shadow } from '../../theme';

// ─── Category metadata ──────────────────────────────────────────────────────
// Maps roster categorySlug → table label and a small accent color used for the
// category dot / badge. Colors stay within the light design palette.
const CATEGORY_LABEL: Record<string, { label: string; color: string }> = {
  // SPPL
  kids:    { label: 'Kids', color: Colors.amber },
  teen:    { label: 'Teen', color: Colors.amber },
  women1:  { label: 'W1',   color: Colors.danger },
  women2:  { label: 'W2',   color: Colors.danger },
  men1:    { label: 'M1',   color: Colors.blue },
  men2:    { label: 'M2',   color: Colors.blue },
  men3:    { label: 'M3',   color: Colors.blue },
  // SBPL
  women13: { label: 'W 1-3', color: Colors.danger },
  women45: { label: 'W 4-5', color: Colors.danger },
  menA:    { label: 'Men A', color: Colors.blue },
  menB:    { label: 'Men B', color: Colors.blue },
  menC:    { label: 'Men C', color: Colors.blue },
};
function catLabelOf(slug: string | null | undefined): { label: string; color: string } {
  return (slug && CATEGORY_LABEL[slug]) || { label: '—', color: Colors.muted };
}
/** A player stat has no single `categorySlug` — the category comes from the
 *  game categories they actually played (the keys of `categoryBreakdown`).
 *  Almost always one key (a player plays a single SBPL category); join if more. */
function playerCategoryLabel(p: any): { label: string; color: string } {
  const keys = Object.keys(p?.categoryBreakdown || {});
  if (keys.length === 0) return { label: '—', color: Colors.muted };
  if (keys.length === 1) return catLabelOf(keys[0]);
  return { label: keys.map((k) => catLabelOf(k).label).join(', '), color: catLabelOf(keys[0]).color };
}

// Category is league-defined (SPPL vs SBPL differ), so the filter pills are
// derived at runtime from the categories actually present in the stats data
// (see `categoryFilters` in the component). `CategoryFilter` is just the slug.
type CategoryFilter = string;
// Fixed display order so pills read consistently regardless of data order.
const CATEGORY_ORDER = [
  'kids', 'teen', 'women1', 'women2', 'women13', 'women45',
  'men1', 'men2', 'men3', 'menA', 'menB', 'menC',
];

// Stage filter — slices the same PlayerStat row to show league-only or
// knockout-only numbers using `stageBreakdown` populated by the API.
// 'all' uses the row's top-level total fields (league + knockout combined).
type StageFilter = 'all' | 'league' | 'knockout';
const STAGE_FILTERS: { key: StageFilter; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'league', label: 'LEAGUE' },
  { key: 'knockout', label: 'KNOCKOUT' },
];

type StatView = {
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  pointsScored: number;
  pointsConceded: number;
  pointDiff: number;
  bonusPointsEarned: number;
  teamPointsEarned: number;
  winRate: number;
};

/** Derive a normalized stat shape from a PlayerStat scoped to the requested
 * stage. When stage='all', uses the row's top-level total fields (existing
 * behavior). For 'league'/'knockout', reads the matching stageBreakdown
 * bucket — falls back to zeros when the bucket is missing (older data). */
function viewStat(s: PlayerStat, stage: StageFilter): StatView {
  if (stage === 'all') {
    return {
      matchesPlayed: s.matchesPlayed,
      matchesWon: s.matchesWon,
      matchesLost: s.matchesLost,
      pointsScored: s.pointsScored,
      pointsConceded: (s as any).pointsConceded || 0,
      pointDiff: (s as any).pointDiff ?? (s.pointsScored - ((s as any).pointsConceded || 0)),
      bonusPointsEarned: s.bonusPointsEarned,
      teamPointsEarned: s.teamPointsEarned || 0,
      winRate: s.winRate,
    };
  }
  const b = s.stageBreakdown?.[stage];
  const played = b?.played || 0;
  const won = b?.won || 0;
  const scored = b?.scored || 0;
  const conceded = b?.conceded || 0;
  return {
    matchesPlayed: played,
    matchesWon: won,
    matchesLost: b?.lost || 0,
    pointsScored: scored,
    pointsConceded: conceded,
    pointDiff: scored - conceded,
    bonusPointsEarned: b?.bonus || 0,
    teamPointsEarned: b?.teamPoints || 0,
    winRate: played > 0 ? Math.round((won / played) * 100) : 0,
  };
}

/** Resolve the stat view for a row honouring BOTH the stage filter and the
 * category filter. When a specific category is selected we read that category's
 * per-category numbers from `categoryBreakdown` (which is stage-agnostic),
 * falling back to the stage-scoped overall view for any field the breakdown
 * does not carry. When category='all' this is just the stage view. */
function resolveView(s: PlayerStat, stage: StageFilter, category: CategoryFilter): StatView {
  const base = viewStat(s, stage);
  if (category === 'all') return base;
  const c = (s as any).categoryBreakdown?.[category];
  if (!c) return base;
  const played = c.played ?? base.matchesPlayed;
  const won = c.won ?? base.matchesWon;
  const scored = c.scored ?? base.pointsScored;
  const conceded = c.conceded ?? base.pointsConceded;
  return {
    matchesPlayed: played,
    matchesWon: won,
    matchesLost: c.lost ?? base.matchesLost,
    pointsScored: scored,
    pointsConceded: conceded,
    pointDiff: scored - conceded,
    bonusPointsEarned: c.bonus ?? base.bonusPointsEarned,
    teamPointsEarned: c.teamPoints ?? base.teamPointsEarned,
    winRate: played > 0 ? Math.round((won / played) * 100) : 0,
  };
}

type SortKey = 'matchesWon' | 'winRate' | 'pointsScored' | 'bonusPointsEarned' | 'teamPointsEarned' | 'matchesPlayed' | 'totalContribution';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'matchesWon', label: 'Wins' },
  { key: 'winRate', label: 'Win %' },
  // "Team Pts" sorts by Total (Pts + Bonus) — matches what users mean by
  // team-point contribution.
  { key: 'totalContribution', label: 'Team Pts' },
  { key: 'teamPointsEarned', label: 'Pts' },
  { key: 'bonusPointsEarned', label: 'Bonus' },
  { key: 'pointsScored', label: 'Points' },
  { key: 'matchesPlayed', label: 'Played' },
];

// Big per-row headline value, driven by the active sort, so the sort choice has
// a clear visual anchor on each player card.
function primaryFor(sortBy: SortKey, v: StatView): { value: string; label: string } {
  const total = v.teamPointsEarned + v.bonusPointsEarned;
  switch (sortBy) {
    case 'matchesWon': return { value: String(v.matchesWon), label: 'WINS' };
    case 'winRate': return { value: `${v.winRate}%`, label: 'WIN %' };
    case 'teamPointsEarned': return { value: String(v.teamPointsEarned), label: 'PTS' };
    case 'bonusPointsEarned': return { value: String(v.bonusPointsEarned), label: 'BONUS' };
    case 'pointsScored': return { value: String(v.pointsScored), label: 'POINTS' };
    case 'matchesPlayed': return { value: String(v.matchesPlayed), label: 'PLAYED' };
    case 'totalContribution':
    default: return { value: String(total), label: 'TEAM PTS' };
  }
}

const StatsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { leagueId, seasonId } = route.params as { leagueId: string; seasonId: string };

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');
  // Default ranking — Team Pts total (Pts + Bonus), tiebroken by Point Diff
  const [sortBy, setSortBy] = useState<SortKey>('totalContribution');

  const [allStats, setAllStats] = useState<PlayerStat[]>([]);
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const authUser = useAuthStore((s) => s.user);
  // Admin gate — only the league organizer sees the download CSV button.
  const isAdmin = !!authUser?.id && league?.organizerId === authUser.id;

  const fetchData = useCallback(async () => {
    try {
      const [all, leagueData] = await Promise.all([
        getAllPlayerStats(leagueId, seasonId).catch(() => []),
        getLeague(leagueId).catch(() => null),
      ]);
      setAllStats(Array.isArray(all) ? all : []);
      setLeague(leagueData);
    } catch (err: any) {
      xAlert('Error', err?.message || 'Failed to load stats');
    }
  }, [leagueId, seasonId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData().finally(() => setLoading(false));
    }, [fetchData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // Category filter pills — derived from the categories that actually appear in
  // this league's stats (SPPL vs SBPL differ), so the pills always match.
  const categoryFilters = React.useMemo(() => {
    const present = new Set<string>();
    for (const s of allStats) {
      Object.keys((s as any).categoryBreakdown || {}).forEach((k) => present.add(k));
    }
    const cats = CATEGORY_ORDER.filter((k) => present.has(k));
    return [
      { key: 'all', label: 'ALL', color: Colors.ink },
      ...cats.map((k) => ({
        key: k,
        label: (CATEGORY_LABEL[k]?.label || k).toUpperCase(),
        color: CATEGORY_LABEL[k]?.color || Colors.ink,
      })),
    ];
  }, [allStats]);

  // Guard: if a previously-selected category disappears from the data, fall
  // back to ALL so the list never renders empty for a stale filter.
  React.useEffect(() => {
    if (categoryFilter !== 'all' && !categoryFilters.some((c) => c.key === categoryFilter)) {
      setCategoryFilter('all');
    }
  }, [categoryFilters, categoryFilter]);

  // ── Helpers ──
  // Project each row into the requested stage + category view BEFORE
  // sorting/filtering so the entire list reflects the chosen filters.
  const stagedStats = React.useMemo(
    () => allStats.map((s) => ({ row: s, view: resolveView(s, stageFilter, categoryFilter) })),
    [allStats, stageFilter, categoryFilter],
  );

  const sortedAllPlayers = React.useMemo(() => {
    return [...stagedStats]
      .filter((x) => {
        // When a specific category is selected, only include players who
        // actually played in that category (have a categoryBreakdown entry).
        if (categoryFilter !== 'all') {
          return !!(x.row as any).categoryBreakdown?.[categoryFilter] && x.view.matchesPlayed > 0;
        }
        return x.view.matchesPlayed > 0;
      })
      .sort((a, b) => {
        if (sortBy === 'winRate') {
          if (b.view.winRate !== a.view.winRate) return b.view.winRate - a.view.winRate;
          return b.view.matchesWon - a.view.matchesWon;
        }
        // Map SortKey → viewStat field
        const field: keyof typeof a.view =
          sortBy === 'matchesWon' ? 'matchesWon' :
          sortBy === 'pointsScored' ? 'pointsScored' :
          sortBy === 'bonusPointsEarned' ? 'bonusPointsEarned' :
          sortBy === 'teamPointsEarned' ? 'teamPointsEarned' :
          sortBy === 'totalContribution' ? null :
          'matchesPlayed';
        if (sortBy === 'totalContribution') {
          const aTotal = a.view.teamPointsEarned + a.view.bonusPointsEarned;
          const bTotal = b.view.teamPointsEarned + b.view.bonusPointsEarned;
          if (bTotal !== aTotal) return bTotal - aTotal;
          // Tiebreaker — point difference (PS - PC). Higher PD wins.
          return b.view.pointDiff - a.view.pointDiff;
        }
        return (b.view[field as 'matchesWon' | 'pointsScored' | 'bonusPointsEarned' | 'teamPointsEarned' | 'matchesPlayed'] as number) - (a.view[field as 'matchesWon' | 'pointsScored' | 'bonusPointsEarned' | 'teamPointsEarned' | 'matchesPlayed'] as number);
      });
  }, [stagedStats, sortBy, categoryFilter]);

  // Build a CSV of every player's stats. Honours both the active stage
  // filter (ALL / LEAGUE / KNOCKOUT) and current sort order so the export
  // matches what's on screen. Always includes both league + knockout
  // breakdown columns so the admin gets everything in one file.
  const onDownloadStats = useCallback(() => {
    const headers = [
      'Rank', 'Player', 'Franchise', 'Category',
      // Active-view columns (whatever stage filter is selected)
      'Played', 'Won', 'Lost', 'Win %', 'Team Pts', 'Bonus', 'Total', 'Points Scored', 'Points Conceded', 'Point Diff',
      // Always include explicit league + knockout sub-columns for full detail
      'League P', 'League W', 'League L', 'League Pts', 'League Bonus', 'League TP',
      'KO P', 'KO W', 'KO L', 'KO Pts', 'KO Bonus', 'KO TP',
    ];
    const rows: unknown[][] = sortedAllPlayers.map(({ row: p, view: v }, idx) => {
      const lg = p.stageBreakdown?.league;
      const ko = p.stageBreakdown?.knockout;
      const catLabel = playerCategoryLabel(p).label;
      return [
        idx + 1,
        p.playerName,
        p.franchiseShortName || p.franchiseName || '',
        catLabel,
        v.matchesPlayed, v.matchesWon, v.matchesLost, `${v.winRate}%`, v.teamPointsEarned, v.bonusPointsEarned, v.teamPointsEarned + v.bonusPointsEarned, v.pointsScored, v.pointsConceded, v.pointDiff,
        lg?.played || 0, lg?.won || 0, lg?.lost || 0, lg?.scored || 0, lg?.bonus || 0, lg?.teamPoints || 0,
        ko?.played || 0, ko?.won || 0, ko?.lost || 0, ko?.scored || 0, ko?.bonus || 0, ko?.teamPoints || 0,
      ];
    });
    const stageTag = stageFilter === 'all' ? 'overall' : stageFilter;
    const filename = `player-stats-${stageTag}-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCSV(filename, headers, rows);
  }, [sortedAllPlayers, stageFilter]);

  // ── RENDER ──
  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.blue} />
          <Text style={styles.loadingText}>Loading stats…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const leagueName = league?.name || 'Player Stats';

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Light header — back button + league name title */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          accessibilityLabel="Go back"
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          {league?.name ? <Text style={styles.headerEyebrow}>PLAYER STATS</Text> : null}
          <Text style={styles.headerTitle} numberOfLines={1}>{leagueName}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.blue} />}
      >
        {/* Admin-only export */}
        {isAdmin && (
          <View style={styles.adminBar}>
            <DownloadButton onPress={onDownloadStats} compact label="DOWNLOAD CSV" />
          </View>
        )}

        {/* Category filter */}
        <View style={styles.filterBlock}>
          <Text style={styles.filterLabel}>CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {categoryFilters.map((c) => {
              const active = categoryFilter === c.key;
              const isAll = c.key === 'all';
              return (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => setCategoryFilter(c.key)}
                  activeOpacity={0.7}
                >
                  {!isAll && (
                    <View style={[styles.pillDot, { backgroundColor: active ? Colors.white : c.color }]} />
                  )}
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Stage filter */}
        <View style={styles.filterBlock}>
          <Text style={styles.filterLabel}>STAGE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {STAGE_FILTERS.map((c) => {
              const active = stageFilter === c.key;
              return (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => setStageFilter(c.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Sort filter */}
        <View style={styles.filterBlock}>
          <Text style={styles.filterLabel}>SORT BY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {SORT_OPTIONS.map((s) => {
              const active = sortBy === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => setSortBy(s.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Player list */}
        {sortedAllPlayers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No player stats yet</Text>
          </View>
        ) : (
          sortedAllPlayers.map(({ row: p, view: v }, idx) => {
            const total = v.teamPointsEarned + v.bonusPointsEarned;
            const cat = playerCategoryLabel(p);
            const primary = primaryFor(sortBy, v);
            const rank = idx + 1;
            return (
              <TouchableOpacity
                key={p.playerId}
                style={styles.playerCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('PlayerProfile', { playerId: p.playerId, leagueId, seasonId })}
              >
                {/* Header row */}
                <View style={styles.cardHeader}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>{rank}</Text>
                  </View>
                  <View style={[styles.teamBar, { backgroundColor: p.franchiseColor || Colors.navy }]} />
                  <View style={styles.nameWrap}>
                    <Text style={styles.playerName} numberOfLines={1}>{p.playerName}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.franchiseText} numberOfLines={1}>
                        {p.franchiseShortName || p.franchiseName || '—'}
                      </Text>
                      <View style={[styles.catBadge, { backgroundColor: cat.color + '1A' }]}>
                        <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                        <Text style={[styles.catText, { color: cat.color }]}>{cat.label}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.primaryWrap}>
                    <Text style={styles.primaryValue}>{primary.value}</Text>
                    <Text style={styles.primaryLabel}>{primary.label}</Text>
                  </View>
                </View>

                {/* Stat grid — 2 rows × 5 columns */}
                <View style={styles.statGrid}>
                  <StatCell label="P" value={v.matchesPlayed} />
                  <StatCell label="W" value={v.matchesWon} valueStyle={styles.valueStrong} />
                  <StatCell label="L" value={v.matchesLost} valueStyle={styles.valueMuted} />
                  <StatCell label="WIN%" value={`${v.winRate}%`} valueStyle={styles.valueStrong} />
                  <StatCell
                    label="PD"
                    value={`${v.pointDiff >= 0 ? '+' : ''}${v.pointDiff}`}
                    valueStyle={{ color: v.pointDiff >= 0 ? Colors.blue : Colors.danger }}
                  />
                  <StatCell label="PTS" value={v.teamPointsEarned} />
                  <StatCell label="BONUS" value={v.bonusPointsEarned} valueStyle={{ color: Colors.amber }} />
                  <StatCell label="TOTAL" value={total} valueStyle={styles.valueAccent} />
                  <StatCell label="PS" value={v.pointsScored} />
                  <StatCell label="PC" value={v.pointsConceded} valueStyle={styles.valueMuted} />
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// Small stat cell — value over a tiny caption, 5 per row via 20% flex basis.
const StatCell: React.FC<{ label: string; value: React.ReactNode; valueStyle?: any }> = ({
  label,
  value,
  valueStyle,
}) => (
  <View style={styles.statCell}>
    <Text style={[styles.statValue, valueStyle]} numberOfLines={1}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export default StatsScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: Colors.muted, fontFamily: Fonts.body },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 10 : 12,
    paddingBottom: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: { color: Colors.ink, fontSize: 26, lineHeight: 28, marginTop: -2, fontWeight: '600' },
  headerTitleWrap: { flex: 1, minWidth: 0 },
  headerEyebrow: {
    fontSize: 10,
    letterSpacing: 1.4,
    color: Colors.muted,
    fontFamily: Fonts.bodySemibold,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 24,
    color: Colors.ink,
    fontFamily: Fonts.displayBold,
    letterSpacing: -0.4,
  },

  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },

  adminBar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },

  // Filters
  filterBlock: { marginBottom: 12 },
  filterLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.muted,
    fontFamily: Fonts.bodySemibold,
    marginBottom: 8,
  },
  pillRow: { gap: 8, paddingRight: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  pillActive: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 12, color: Colors.muted, fontFamily: Fonts.bodySemibold, letterSpacing: 0.2 },
  pillTextActive: { color: Colors.white },

  // Player card
  playerCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
    ...Shadow.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: { fontSize: 12, color: Colors.ink, fontFamily: Fonts.monoBold },
  teamBar: { width: 4, height: 34, borderRadius: 2 },
  nameWrap: { flex: 1, minWidth: 0 },
  playerName: { fontSize: 15, color: Colors.ink, fontFamily: Fonts.bodyBold, letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  franchiseText: { fontSize: 12, color: Colors.muted, fontFamily: Fonts.body, flexShrink: 1 },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  catDot: { width: 6, height: 6, borderRadius: 3 },
  catText: { fontSize: 10, fontFamily: Fonts.bodyBold, letterSpacing: 0.3 },
  primaryWrap: { alignItems: 'flex-end', minWidth: 46 },
  primaryValue: { fontSize: 20, color: Colors.ink, fontFamily: Fonts.monoBold, letterSpacing: -0.5 },
  primaryLabel: { fontSize: 9, color: Colors.muted, fontFamily: Fonts.bodySemibold, letterSpacing: 0.5, marginTop: 1 },

  // Stat grid
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    rowGap: 10,
  },
  statCell: { width: '20%', alignItems: 'center' },
  statValue: { fontSize: 14, color: Colors.ink, fontFamily: Fonts.mono },
  statLabel: { fontSize: 9, color: Colors.muted, fontFamily: Fonts.bodySemibold, letterSpacing: 0.4, marginTop: 2 },
  valueStrong: { fontFamily: Fonts.monoBold },
  valueMuted: { color: Colors.muted },
  valueAccent: { color: Colors.blue, fontFamily: Fonts.monoBold },

  // Empty
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 28,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: Colors.muted, fontFamily: Fonts.body },
});
