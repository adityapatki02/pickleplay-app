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
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { getStandings, getGroups, getFranchises } from '../../api/leagues.api';
import { useLeagueStore } from '../../store/leagueStore';
import { xAlert } from '../../utils/alert';
import type { LeagueStanding, LeagueGroup, Franchise } from '../../types/league.types';

// ─── Design tokens ──────────────────────────────────────────────────────────
const NAVY = '#001E40';
const BLUE = '#2196F3';
const GREEN = '#06D6A0';
const SURFACE = '#F5F7FA';
const BORDER = '#E2E8F0';
const TEXT_COLOR = '#1A1D21';
const TEXT_SUB = '#64748B';
const TEXT_MUTED = '#94A3B8';
const WHITE = '#FFFFFF';

// ─── Column definitions ─────────────────────────────────────────────────────
const COLUMNS: { key: string; label: string; flex: number; bold?: boolean }[] = [
  { key: 'rank', label: '#', flex: 0.4, bold: true },
  { key: 'team', label: 'Team', flex: 2, bold: true },
  { key: 'P', label: 'P', flex: 0.5 },
  { key: 'W', label: 'W', flex: 0.5 },
  { key: 'L', label: 'L', flex: 0.5 },
  { key: 'SP', label: 'SP', flex: 0.6, bold: true },
  { key: 'MW', label: 'MW', flex: 0.6 },
  { key: 'PD', label: 'PD', flex: 0.6 },
];

// ─── Legend ──────────────────────────────────────────────────────────────────
const LEGEND: { abbr: string; desc: string }[] = [
  { abbr: 'P', desc: 'Played' },
  { abbr: 'W', desc: 'Won' },
  { abbr: 'L', desc: 'Lost' },
  { abbr: 'MW', desc: 'Match Wins' },
  { abbr: 'ML', desc: 'Match Losses' },
  { abbr: 'MP', desc: 'Match Points' },
  { abbr: 'BP', desc: 'Bonus Points' },
  { abbr: 'SP', desc: 'Standing Points' },
  { abbr: 'PD', desc: 'Point Differential' },
];

// ═════════════════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════════════════

const StandingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { leagueId, seasonId } = route.params as { leagueId: string; seasonId: string };

  const store = useLeagueStore();
  const [standings, setStandings] = useState<LeagueStanding[]>([]);
  const [groups, setGroups] = useState<LeagueGroup[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Data fetching ──
  const fetchData = useCallback(async () => {
    try {
      const [standingsData, groupsData, franchisesData] = await Promise.all([
        getStandings(leagueId, seasonId),
        getGroups(leagueId, seasonId).catch(() => [] as LeagueGroup[]),
        getFranchises(leagueId).catch(() => [] as Franchise[]),
      ]);
      // Standings API returns { groups: [{ group, standings }] } — flatten to array
      let flatStandings: LeagueStanding[] = [];
      if (Array.isArray(standingsData)) {
        flatStandings = standingsData;
      } else if (standingsData?.groups) {
        for (const g of (standingsData as any).groups) {
          if (g.standings) flatStandings.push(...g.standings);
        }
      }
      setStandings(flatStandings);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      setFranchises(Array.isArray(franchisesData) ? franchisesData : []);
      store.setStandings(flatStandings);
    } catch (err: any) {
      xAlert('Error', err?.message || 'Failed to load standings');
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

  // ── Helpers ──
  const franchiseMap = React.useMemo(() => {
    const m: Record<string, Franchise> = {};
    franchises.forEach((f) => (m[f.id] = f));
    return m;
  }, [franchises]);

  const teamName = (id: string) => franchiseMap[id]?.shortName || franchiseMap[id]?.name || '—';
  const teamColor = (id: string) => franchiseMap[id]?.primaryColor || NAVY;
  const groupName = (groupId: string) => groups.find((g) => g.id === groupId)?.name || groupId;

  const standingsByGroup = React.useMemo(() => {
    const map = new Map<string, LeagueStanding[]>();
    standings.forEach((s) => {
      const arr = map.get(s.groupId) || [];
      arr.push(s);
      map.set(s.groupId, arr);
    });
    map.forEach((arr) => {
      arr.sort((a, b) => (a.rank || 999) - (b.rank || 999));
    });
    // Sort groups by their display order
    const entries = Array.from(map.entries());
    entries.sort((a, b) => {
      const ga = groups.find((g) => g.id === a[0]);
      const gb = groups.find((g) => g.id === b[0]);
      return (ga?.displayOrder || 0) - (gb?.displayOrder || 0);
    });
    return entries;
  }, [standings, groups]);

  const getCellValue = (row: LeagueStanding, key: string, idx: number): string => {
    switch (key) {
      case 'rank':
        return String(row.rank || idx + 1);
      case 'team':
        return teamName(row.franchiseId);
      case 'P':
        return String(row.tiesPlayed);
      case 'W':
        return String(row.tiesWon);
      case 'L':
        return String(row.tiesLost);
      case 'MW':
        return String(row.matchesWon);
      case 'ML':
        return String(row.matchesLost);
      case 'MP':
        return String(row.totalMatchPoints);
      case 'BP':
        return String(row.bonusPoints);
      case 'SP':
        return String(row.standingPoints);
      case 'PD':
        return row.pointDiff > 0 ? `+${row.pointDiff}` : String(row.pointDiff);
      default:
        return '';
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={styles.loadingText}>Loading standings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>League Standings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {standingsByGroup.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Standings Yet</Text>
            <Text style={styles.emptyText}>
              Standings will populate once the league phase begins and ties are played.
            </Text>
          </View>
        ) : (
          standingsByGroup.map(([gId, rows]) => (
            <View key={gId} style={styles.groupSection}>
              {/* Group header with colored accent */}
              <View style={styles.groupHeader}>
                <View style={styles.groupAccent} />
                <Text style={styles.groupHeaderText}>{groupName(gId)}</Text>
              </View>

              {/* Table */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.table}>
                  {/* Header row */}
                  <View style={styles.tableHeaderRow}>
                    {COLUMNS.map((col) => (
                      <View key={col.key} style={[styles.tableHeaderCell, { flex: col.flex }]}>
                        <Text style={styles.tableHeaderText}>{col.label}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Data rows */}
                  {rows.map((row, idx) => {
                    const qualified = idx < 4;
                    return (
                      <View
                        key={row.id}
                        style={[
                          styles.tableRow,
                          qualified && styles.tableRowQualified,
                          idx === rows.length - 1 && { borderBottomWidth: 0 },
                        ]}
                      >
                        {qualified && <View style={styles.qualifiedBorder} />}
                        {COLUMNS.map((col) => {
                          const val = getCellValue(row, col.key, idx);
                          const isTeam = col.key === 'team';
                          return (
                            <View key={col.key} style={[styles.tableDataCell, { flex: col.flex }]}>
                              {isTeam && (
                                <View
                                  style={[
                                    styles.teamDot,
                                    { backgroundColor: teamColor(row.franchiseId) },
                                  ]}
                                />
                              )}
                              <Text
                                style={[
                                  styles.tableCellText,
                                  col.bold && { fontWeight: '700' },
                                  col.key === 'SP' && { color: NAVY, fontWeight: '800' },
                                  isTeam && { textAlign: 'left' },
                                ]}
                                numberOfLines={1}
                              >
                                {val}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          ))
        )}

        {/* Legend */}
        {standingsByGroup.length > 0 && (
          <View style={styles.legendContainer}>
            <Text style={styles.legendTitle}>Legend</Text>
            <View style={styles.legendGrid}>
              {LEGEND.map((item) => (
                <View key={item.abbr} style={styles.legendItem}>
                  <Text style={styles.legendAbbr}>{item.abbr}</Text>
                  <Text style={styles.legendDesc}>{item.desc}</Text>
                </View>
              ))}
            </View>
            <View style={styles.qualifiedLegend}>
              <View style={styles.qualifiedLegendDot} />
              <Text style={styles.qualifiedLegendText}>Qualified for Knockout</Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default StandingsScreen;

// ═════════════════════════════════════════════════════════════════════════════
// Styles
// ═════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: TEXT_SUB },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NAVY,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: WHITE, fontSize: 22, fontWeight: '700' },
  headerTitle: { flex: 1, color: WHITE, fontSize: 18, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },

  content: { padding: 16, paddingBottom: 120 },

  // Group section
  groupSection: {
    backgroundColor: WHITE,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NAVY,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  groupAccent: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: GREEN,
    marginRight: 10,
  },
  groupHeaderText: { color: WHITE, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  // Table
  table: { minWidth: 600 },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableHeaderCell: { justifyContent: 'center', alignItems: 'center' },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    color: TEXT_SUB,
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    position: 'relative',
  },
  tableRowQualified: { backgroundColor: '#F0FDF4' },
  qualifiedBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: GREEN,
  },

  tableDataCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableCellText: {
    fontSize: 13,
    color: TEXT_COLOR,
    textAlign: 'center',
  },

  teamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },

  // Legend
  legendContainer: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 4,
  },
  legendTitle: { fontSize: 14, fontWeight: '800', color: NAVY, marginBottom: 12 },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', width: '48%', marginBottom: 6 },
  legendAbbr: {
    fontSize: 12,
    fontWeight: '800',
    color: NAVY,
    width: 28,
  },
  legendDesc: { fontSize: 12, color: TEXT_SUB },

  qualifiedLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  qualifiedLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#D1FAE5',
    borderLeftWidth: 3,
    borderLeftColor: GREEN,
    marginRight: 8,
  },
  qualifiedLegendText: { fontSize: 12, color: TEXT_SUB, fontWeight: '600' },

  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: TEXT_COLOR, marginBottom: 6 },
  emptyText: { fontSize: 13, color: TEXT_SUB, textAlign: 'center', paddingHorizontal: 32 },
});
