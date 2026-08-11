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
import { getAllPlayerStats, getTopPerformers, getLeague } from '../../api/leagues.api';
import { useAuthStore } from '../../store/authStore';
import type { PlayerStat, TopPerformer, League } from '../../types/league.types';
import { xAlert } from '../../utils/alert';
import DownloadButton from '../../components/DownloadButton';
import { downloadCSV } from '../../utils/csvExport';

import { YColors, YTopBar } from '../../components/yoiden';

// ─── Design tokens ──────────────────────────────────────────────────────────
const NAVY: string = YColors.ink;
const BLUE: string = YColors.accent;
const GREEN = '#06D6A0';
const ORANGE = '#F97316';
const PURPLE = '#8B5CF6';
const RED = '#EF4444';
const GOLD = '#F59E0B';
const SILVER = '#9CA3AF';
const BRONZE = '#D97706';
const SURFACE: string = YColors.bg;
const BORDER: string = YColors.line2;
const TEXT_COLOR: string = YColors.ink;
const TEXT_SUB: string = YColors.ink2;
const TEXT_MUTED: string = YColors.ink3;
const WHITE = '#FFFFFF';

// Maps roster categorySlug → table label and accent color. Mirrors the
// CATEGORY_FILTERS pills below but kept separate so we can tune the column
// rendering independently (shorter labels, color chip).
const CATEGORY_LABEL: Record<string, { label: string; color: string }> = {
  // SPPL
  kids:    { label: 'Kids', color: PURPLE },
  teen:    { label: 'Teen', color: ORANGE },
  women1:  { label: 'W1',   color: RED },
  women2:  { label: 'W2',   color: RED },
  men1:    { label: 'M1',   color: BLUE },
  men2:    { label: 'M2',   color: BLUE },
  men3:    { label: 'M3',   color: BLUE },
  // SBPL
  women13: { label: 'W 1-3', color: RED },
  women45: { label: 'W 4-5', color: RED },
  menA:    { label: 'Men A', color: BLUE },
  menB:    { label: 'Men B', color: BLUE },
  menC:    { label: 'Men C', color: BLUE },
};
function catLabelOf(slug: string | null | undefined): { label: string; color: string } {
  return (slug && CATEGORY_LABEL[slug]) || { label: '—', color: TEXT_MUTED };
}

type TabKey = 'overview' | 'top' | 'all';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'OVERVIEW' },
  { key: 'top', label: 'TOP PERFORMERS' },
  { key: 'all', label: 'ALL PLAYERS' },
];

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
const STAGE_FILTERS: { key: StageFilter; label: string; color: string }[] = [
  { key: 'all', label: 'ALL', color: NAVY },
  { key: 'league', label: 'LEAGUE', color: BLUE },
  { key: 'knockout', label: 'KNOCKOUT', color: ORANGE },
];

/** Derive a normalized stat shape from a PlayerStat scoped to the requested
 * stage. When stage='all', uses the row's top-level total fields (existing
 * behavior). For 'league'/'knockout', reads the matching stageBreakdown
 * bucket — falls back to zeros when the bucket is missing (older data). */
function viewStat(s: PlayerStat, stage: StageFilter): {
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  pointsScored: number;
  pointsConceded: number;
  pointDiff: number;
  bonusPointsEarned: number;
  teamPointsEarned: number;
  winRate: number;
} {
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

type MetricKey = 'wins' | 'winRate' | 'scored' | 'bonus' | 'played' | 'teamPoints';
const METRICS: { key: MetricKey; label: string; shortLabel: string; accent: string }[] = [
  { key: 'wins', label: 'Most Wins', shortLabel: 'Wins', accent: GREEN },
  { key: 'winRate', label: 'Win Rate', shortLabel: 'Win %', accent: BLUE },
  { key: 'teamPoints', label: 'Team Points', shortLabel: 'Team Pts', accent: GREEN },
  { key: 'scored', label: 'Points Scored', shortLabel: 'Points', accent: ORANGE },
  { key: 'bonus', label: 'Bonus Points', shortLabel: 'Bonus', accent: PURPLE },
  { key: 'played', label: 'Matches Played', shortLabel: 'Played', accent: NAVY },
];

type SortKey = 'matchesWon' | 'winRate' | 'pointsScored' | 'bonusPointsEarned' | 'teamPointsEarned' | 'matchesPlayed' | 'totalContribution';

// Inline style for the admin export bar — kept inline (not in StyleSheet) so
// each consuming screen can tune spacing without forking a shared component.
const statsAdminBarStyle = {
  flexDirection: 'row' as const,
  justifyContent: 'flex-end' as const,
  marginBottom: 8,
};

const StatsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { leagueId, seasonId } = route.params as { leagueId: string; seasonId: string };

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('wins');
  // Default ranking — Team Pts total (Pts + Bonus), tiebroken by Point Diff
  const [sortBy, setSortBy] = useState<SortKey>('totalContribution');

  const [allStats, setAllStats] = useState<PlayerStat[]>([]);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
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

  const fetchTop = useCallback(
    async (metric: MetricKey, cat: CategoryFilter, stage: StageFilter) => {
      try {
        const params: any = { metric, limit: 10 };
        if (cat !== 'all') params.category = cat;
        if (stage !== 'all') params.stage = stage;
        const data = await getTopPerformers(leagueId, seasonId, params).catch(() => []);
        setTopPerformers(Array.isArray(data) ? data : []);
      } catch {}
    },
    [leagueId, seasonId],
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData().finally(() => setLoading(false));
    }, [fetchData]),
  );

  // Refetch top performers when category/metric/stage changes
  React.useEffect(() => {
    if (activeTab === 'top') {
      fetchTop(selectedMetric, categoryFilter, stageFilter);
    }
  }, [activeTab, selectedMetric, categoryFilter, stageFilter, fetchTop]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    if (activeTab === 'top') await fetchTop(selectedMetric, categoryFilter, stageFilter);
    setRefreshing(false);
  }, [fetchData, fetchTop, activeTab, selectedMetric, categoryFilter, stageFilter]);

  // Category filter pills — derived from the categories that actually appear in
  // this league's stats (SPPL vs SBPL differ), so the pills always match.
  const categoryFilters = React.useMemo(() => {
    const present = new Set<string>();
    for (const s of allStats) {
      Object.keys((s as any).categoryBreakdown || {}).forEach((k) => present.add(k));
    }
    const cats = CATEGORY_ORDER.filter((k) => present.has(k));
    return [
      { key: 'all', label: 'ALL', color: NAVY },
      ...cats.map((k) => ({
        key: k,
        label: (CATEGORY_LABEL[k]?.label || k).toUpperCase(),
        color: CATEGORY_LABEL[k]?.color || NAVY,
      })),
    ];
  }, [allStats]);

  // ── Helpers ──
  // Project each row into the requested stage view BEFORE sorting/filtering so
  // the entire screen reflects the chosen stage consistently.
  const stagedStats = React.useMemo(
    () => allStats.map((s) => ({ row: s, view: viewStat(s, stageFilter) })),
    [allStats, stageFilter],
  );

  const sortedAllPlayers = React.useMemo(() => {
    return [...stagedStats]
      .filter((x) => x.view.matchesPlayed > 0)
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
  }, [stagedStats, sortBy]);

  // Overview totals — scoped to the active stage filter.
  const totals = React.useMemo(() => {
    const active = stagedStats.filter((x) => x.view.matchesPlayed > 0);
    const totalMatches = active.reduce((acc, x) => acc + x.view.matchesPlayed, 0);
    const totalPoints = active.reduce((acc, x) => acc + x.view.pointsScored, 0);
    const totalBonus = active.reduce((acc, x) => acc + x.view.bonusPointsEarned, 0);
    return { activePlayers: active.length, totalMatches, totalPoints, totalBonus };
  }, [stagedStats]);

  const medalColor = (rank: number) => (rank === 1 ? GOLD : rank === 2 ? SILVER : rank === 3 ? BRONZE : TEXT_MUTED);

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
      const catLabel = catLabelOf((p as any).categorySlug).label;
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
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={styles.loadingText}>Loading stats...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <YTopBar eyebrow="SPPL" title="PLAYER STATS" onBack={() => navigation.goBack()} />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabChip, active && styles.tabChipActive]}
              onPress={() => setActiveTab(t.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Admin-only export — uniform DownloadButton, sits at the top of the
            scroll content so it's reachable from any tab. Hidden for non-admins. */}
        {isAdmin && (
          <View style={statsAdminBarStyle}>
            <DownloadButton onPress={onDownloadStats} compact label="DOWNLOAD CSV" />
          </View>
        )}

        {/* Stage filter — applies to OVERVIEW totals/top-3 and ALL PLAYERS
            table (which read from the local stageBreakdown), and to TOP
            PERFORMERS (which forwards `stage` to the server-side endpoint
            and reads from categoryStageBreakdown). */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>STAGE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {STAGE_FILTERS.map((c) => {
              const active = stageFilter === c.key;
              return (
                <TouchableOpacity
                  key={c.key}
                  style={[
                    styles.pill,
                    { borderColor: active ? c.color : BORDER, backgroundColor: active ? c.color : WHITE },
                  ]}
                  onPress={() => setStageFilter(c.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, { color: active ? WHITE : TEXT_SUB }]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            {/* Hero grid */}
            <View style={styles.heroGrid}>
              <View style={[styles.heroCard, { backgroundColor: NAVY }]}>
                <Text style={styles.heroValue}>{totals.activePlayers}</Text>
                <Text style={styles.heroLabel}>ACTIVE PLAYERS</Text>
              </View>
              <View style={[styles.heroCard, { backgroundColor: BLUE }]}>
                <Text style={styles.heroValue}>{totals.totalMatches}</Text>
                <Text style={styles.heroLabel}>MATCHES PLAYED</Text>
              </View>
              <View style={[styles.heroCard, { backgroundColor: ORANGE }]}>
                <Text style={styles.heroValue}>{totals.totalPoints}</Text>
                <Text style={styles.heroLabel}>TOTAL POINTS</Text>
              </View>
              <View style={[styles.heroCard, { backgroundColor: PURPLE }]}>
                <Text style={styles.heroValue}>{totals.totalBonus}</Text>
                <Text style={styles.heroLabel}>BONUS POINTS</Text>
              </View>
            </View>

            {/* Quick top 3 per metric — driven by stagedStats so the cards
                respect whichever stage filter is active.
                For Team Points we use total contribution (TP + Bonus) with
                point-differential tiebreaker, matching the All Players ranking
                and the Top Performers leaderboard for consistency. */}
            {METRICS.slice(0, 3).map((m) => {
              const top3 = [...stagedStats]
                .filter((x) => x.view.matchesPlayed > 0)
                .sort((a, b) => {
                  if (m.key === 'winRate') return b.view.winRate - a.view.winRate;
                  if (m.key === 'scored') return b.view.pointsScored - a.view.pointsScored;
                  if (m.key === 'bonus') return b.view.bonusPointsEarned - a.view.bonusPointsEarned;
                  if (m.key === 'played') return b.view.matchesPlayed - a.view.matchesPlayed;
                  if (m.key === 'teamPoints') {
                    const aTotal = a.view.teamPointsEarned + a.view.bonusPointsEarned;
                    const bTotal = b.view.teamPointsEarned + b.view.bonusPointsEarned;
                    if (bTotal !== aTotal) return bTotal - aTotal;
                    return b.view.pointDiff - a.view.pointDiff;
                  }
                  return b.view.matchesWon - a.view.matchesWon;
                })
                .slice(0, 3);
              return (
                <View key={m.key} style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>{m.label.toUpperCase()}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedMetric(m.key);
                        setActiveTab('top');
                      }}
                    >
                      <Text style={[styles.viewAll, { color: m.accent }]}>VIEW ALL →</Text>
                    </TouchableOpacity>
                  </View>
                  {top3.map(({ row: p, view: v }, idx) => (
                    <TouchableOpacity
                      key={p.playerId}
                      style={styles.podiumRow}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('PlayerProfile', { playerId: p.playerId, leagueId, seasonId })}
                    >
                      <View style={[styles.medalDot, { backgroundColor: medalColor(idx + 1) }]}>
                        <Text style={styles.medalText}>{idx + 1}</Text>
                      </View>
                      <View style={[styles.teamDot, { backgroundColor: p.franchiseColor || NAVY }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.playerName} numberOfLines={1}>
                          {p.playerName}
                        </Text>
                        <Text style={styles.franchiseMini} numberOfLines={1}>
                          {p.franchiseShortName || p.franchiseName || '—'}
                        </Text>
                      </View>
                      <View style={styles.metricBadge}>
                        <Text style={[styles.metricValue, { color: m.accent }]}>
                          {m.key === 'wins' && v.matchesWon}
                          {m.key === 'winRate' && `${v.winRate}%`}
                          {m.key === 'teamPoints' && (v.teamPointsEarned + v.bonusPointsEarned)}
                          {m.key === 'scored' && v.pointsScored}
                          {m.key === 'bonus' && v.bonusPointsEarned}
                          {m.key === 'played' && v.matchesPlayed}
                        </Text>
                        <Text style={styles.metricShortLabel}>{m.shortLabel}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
          </>
        )}

        {/* TOP PERFORMERS TAB */}
        {activeTab === 'top' && (
          <>
            {/* Metric pills */}
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>METRIC</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {METRICS.map((m) => {
                  const active = selectedMetric === m.key;
                  return (
                    <TouchableOpacity
                      key={m.key}
                      style={[
                        styles.pill,
                        { borderColor: active ? m.accent : BORDER, backgroundColor: active ? m.accent : WHITE },
                      ]}
                      onPress={() => setSelectedMetric(m.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pillText, { color: active ? WHITE : TEXT_SUB }]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Category pills */}
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {categoryFilters.map((c) => {
                  const active = categoryFilter === c.key;
                  return (
                    <TouchableOpacity
                      key={c.key}
                      style={[
                        styles.pill,
                        { borderColor: active ? c.color : BORDER, backgroundColor: active ? c.color : WHITE },
                      ]}
                      onPress={() => setCategoryFilter(c.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pillText, { color: active ? WHITE : TEXT_SUB }]}>
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Leaderboard */}
            <View style={styles.section}>
              {topPerformers.length === 0 ? (
                <Text style={styles.emptyText}>No data for this filter yet</Text>
              ) : (
                topPerformers.map((p) => (
                  <TouchableOpacity
                    key={p.playerId}
                    style={styles.leaderboardRow}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('PlayerProfile', { playerId: p.playerId, leagueId, seasonId })}
                  >
                    <View style={[styles.medalDot, { backgroundColor: medalColor(p.rank) }]}>
                      <Text style={styles.medalText}>{p.rank}</Text>
                    </View>
                    <View style={[styles.teamDot, { backgroundColor: p.franchiseColor || NAVY }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.playerName} numberOfLines={1}>
                        {p.playerName}
                      </Text>
                      <Text style={styles.franchiseMini} numberOfLines={1}>
                        {p.franchiseShortName || p.franchiseName || '—'}
                      </Text>
                    </View>
                    <View style={styles.metricBadge}>
                      <Text
                        style={[
                          styles.metricValue,
                          { color: METRICS.find((m) => m.key === selectedMetric)?.accent || NAVY },
                        ]}
                      >
                        {selectedMetric === 'winRate' ? `${p.value}%` : p.value}
                      </Text>
                      <Text style={styles.metricShortLabel}>
                        {METRICS.find((m) => m.key === selectedMetric)?.shortLabel}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </>
        )}

        {/* ALL PLAYERS TAB */}
        {activeTab === 'all' && (
          <>
            {/* Sort options */}
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>SORT BY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {([
                  { key: 'matchesWon', label: 'Wins' },
                  { key: 'winRate', label: 'Win %' },
                  // "Team Pts" sorts by Total (Pts + Bonus) — matches what
                  // users mean by team-point contribution.
                  { key: 'totalContribution', label: 'Team Pts' },
                  { key: 'teamPointsEarned', label: 'Pts' },
                  { key: 'bonusPointsEarned', label: 'Bonus' },
                  { key: 'pointsScored', label: 'Points' },
                  { key: 'matchesPlayed', label: 'Played' },
                ] as { key: SortKey; label: string }[]).map((s) => {
                  const active = sortBy === s.key;
                  return (
                    <TouchableOpacity
                      key={s.key}
                      style={[
                        styles.pill,
                        { borderColor: active ? NAVY : BORDER, backgroundColor: active ? NAVY : WHITE },
                      ]}
                      onPress={() => setSortBy(s.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pillText, { color: active ? WHITE : TEXT_SUB }]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Table */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.allTable}>
                {/* Group label row — visually clusters the 3 TP sub-columns */}
                <View style={[styles.allTableHeader, { backgroundColor: '#F1F5F9', borderBottomWidth: 0 }]}>
                  <Text style={[styles.colHead, { width: 30, opacity: 0 }]}> </Text>
                  <Text style={[styles.colHead, { width: 140, opacity: 0 }]}> </Text>
                  <Text style={[styles.colHead, { width: 60, opacity: 0 }]}> </Text>
                  <Text style={[styles.colHeadCenter, { width: 50, opacity: 0 }]}> </Text>
                  <Text style={[styles.colHeadCenter, { width: 40, opacity: 0 }]}> </Text>
                  <Text style={[styles.colHeadCenter, { width: 40, opacity: 0 }]}> </Text>
                  <Text style={[styles.colHeadCenter, { width: 40, opacity: 0 }]}> </Text>
                  <Text style={[styles.colHeadCenter, { width: 50, opacity: 0 }]}> </Text>
                  <Text style={[styles.colHeadCenter, { width: 140, fontWeight: '900', color: NAVY }]}>TEAM POINTS</Text>
                  <Text style={[styles.colHeadCenter, { width: 150, fontWeight: '900', color: NAVY }]}>RALLY POINTS</Text>
                </View>
                <View style={styles.allTableHeader}>
                  <Text style={[styles.colHead, { width: 30 }]}>#</Text>
                  <Text style={[styles.colHead, { width: 140 }]}>Player</Text>
                  <Text style={[styles.colHead, { width: 60 }]}>Team</Text>
                  <Text style={[styles.colHeadCenter, { width: 50 }]}>Cat</Text>
                  <Text style={[styles.colHeadCenter, { width: 40 }]}>P</Text>
                  <Text style={[styles.colHeadCenter, { width: 40 }]}>W</Text>
                  <Text style={[styles.colHeadCenter, { width: 40 }]}>L</Text>
                  <Text style={[styles.colHeadCenter, { width: 50 }]}>Win%</Text>
                  <Text style={[styles.colHeadCenter, { width: 45 }]}>Pts</Text>
                  <Text style={[styles.colHeadCenter, { width: 45 }]}>Bonus</Text>
                  <Text style={[styles.colHeadCenter, { width: 50 }]}>Total</Text>
                  <Text style={[styles.colHeadCenter, { width: 50 }]}>PS</Text>
                  <Text style={[styles.colHeadCenter, { width: 50 }]}>PC</Text>
                  <Text style={[styles.colHeadCenter, { width: 50 }]}>PD</Text>
                </View>
                {sortedAllPlayers.length === 0 ? (
                  <Text style={styles.emptyText}>No player stats yet</Text>
                ) : (
                  sortedAllPlayers.map(({ row: p, view: v }, idx) => {
                    const totalContribution = v.teamPointsEarned + v.bonusPointsEarned;
                    const cat = catLabelOf((p as any).categorySlug);
                    return (
                    <TouchableOpacity
                      key={p.playerId}
                      style={styles.allTableRow}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('PlayerProfile', { playerId: p.playerId, leagueId, seasonId })}
                    >
                      <Text style={[styles.cell, { width: 30, fontWeight: '700' }]}>{idx + 1}</Text>
                      <Text style={[styles.cell, { width: 140, fontWeight: '600' }]} numberOfLines={1}>
                        {p.playerName}
                      </Text>
                      <Text style={[styles.cell, { width: 60, color: TEXT_SUB }]} numberOfLines={1}>
                        {p.franchiseShortName || p.franchiseName || '—'}
                      </Text>
                      <View style={{ width: 50, alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 8,
                          backgroundColor: cat.color + '22',
                        }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: cat.color, letterSpacing: 0.3 }}>
                            {cat.label}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.cellCenter, { width: 40 }]}>{v.matchesPlayed}</Text>
                      <Text style={[styles.cellCenter, { width: 40, color: GREEN, fontWeight: '700' }]}>{v.matchesWon}</Text>
                      <Text style={[styles.cellCenter, { width: 40, color: RED }]}>{v.matchesLost}</Text>
                      <Text style={[styles.cellCenter, { width: 50, fontWeight: '700' }]}>{v.winRate}%</Text>
                      <Text style={[styles.cellCenter, { width: 45, color: GREEN, fontWeight: '700' }]}>{v.teamPointsEarned}</Text>
                      <Text style={[styles.cellCenter, { width: 45, color: PURPLE }]}>{v.bonusPointsEarned}</Text>
                      <Text style={[styles.cellCenter, { width: 50, color: NAVY, fontWeight: '900' }]}>{totalContribution}</Text>
                      <Text style={[styles.cellCenter, { width: 50 }]}>{v.pointsScored}</Text>
                      <Text style={[styles.cellCenter, { width: 50 }]}>{v.pointsConceded}</Text>
                      <Text style={[styles.cellCenter, {
                        width: 50,
                        color: v.pointDiff >= 0 ? GREEN : RED,
                        fontWeight: '700',
                      }]}>
                        {v.pointDiff >= 0 ? '+' : ''}{v.pointDiff}
                      </Text>
                    </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default StatsScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: TEXT_SUB },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NAVY,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 8,
    paddingBottom: 14,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: WHITE, fontSize: 22, fontWeight: '700' },
  headerTitle: { flex: 1, color: WHITE, fontSize: 18, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 6,
  },
  tabChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: SURFACE,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  tabChipActive: { backgroundColor: NAVY, borderColor: NAVY },
  tabChipText: { fontSize: 11, fontWeight: '800', color: TEXT_SUB, letterSpacing: 0.5 },
  tabChipTextActive: { color: WHITE },
  content: { padding: 16, paddingBottom: 120 },

  // Hero grid
  heroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  heroCard: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 14,
    padding: 16,
    alignItems: 'flex-start',
  },
  heroValue: { color: WHITE, fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: 4 },

  section: {
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: TEXT_SUB, letterSpacing: 1.5 },
  viewAll: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  // Podium rows
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE,
  },
  medalDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  medalText: { color: WHITE, fontSize: 12, fontWeight: '900' },
  teamDot: { width: 8, height: 28, borderRadius: 4 },
  playerName: { fontSize: 14, fontWeight: '700', color: TEXT_COLOR },
  franchiseMini: { fontSize: 11, color: TEXT_SUB, marginTop: 1 },
  metricBadge: { alignItems: 'flex-end' },
  metricValue: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  metricShortLabel: { fontSize: 9, color: TEXT_MUTED, fontWeight: '700', letterSpacing: 0.5 },

  // Leaderboard
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE,
  },

  // Filters
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  filterLabel: { fontSize: 10, fontWeight: '800', color: TEXT_MUTED, letterSpacing: 1.2 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  pillText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },

  // All players table
  allTable: { backgroundColor: WHITE, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: BORDER },
  allTableHeader: {
    flexDirection: 'row',
    backgroundColor: NAVY,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  allTableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE,
  },
  colHead: { color: WHITE, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, paddingRight: 4 },
  colHeadCenter: { color: WHITE, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center' },
  cell: { fontSize: 13, color: TEXT_COLOR, paddingRight: 4 },
  cellCenter: { fontSize: 13, color: TEXT_COLOR, textAlign: 'center' },

  emptyText: { textAlign: 'center', padding: 20, color: TEXT_SUB, fontSize: 13 },
});
