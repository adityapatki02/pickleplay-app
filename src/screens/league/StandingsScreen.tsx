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
import { getStandings, getGroups, getFranchises, getLeague } from '../../api/leagues.api';
import { useLeagueStore } from '../../store/leagueStore';
import { useAuthStore } from '../../store/authStore';
import { xAlert } from '../../utils/alert';
import type { LeagueStanding, LeagueGroup, Franchise, League } from '../../types/league.types';
import DownloadButton from '../../components/DownloadButton';
import { downloadCSV } from '../../utils/csvExport';
import { API_BASE_URL } from '../../config/constants';

import { YColors, YTopBar } from '../../components/yoiden';

// ─── Design tokens ──────────────────────────────────────────────────────────
const NAVY: string = YColors.ink;
const BLUE: string = YColors.accent;
const GREEN = '#06D6A0';
const SURFACE: string = YColors.bg;
const BORDER: string = YColors.line2;
const TEXT_COLOR: string = YColors.ink;
const TEXT_SUB: string = YColors.ink2;
const TEXT_MUTED: string = YColors.ink3;
const WHITE = '#FFFFFF';

// ─── Column definitions ─────────────────────────────────────────────────────
const COLUMNS: { key: string; label: string; flex: number; bold?: boolean }[] = [
  { key: 'rank', label: '#', flex: 0.4, bold: true },
  { key: 'team', label: 'Team', flex: 2, bold: true },
  { key: 'P', label: 'P', flex: 0.5 },
  { key: 'W', label: 'W', flex: 0.5 },
  { key: 'L', label: 'L', flex: 0.5 },
  { key: 'MW', label: 'MW', flex: 0.6 },
  { key: 'BP', label: 'BP', flex: 0.6 },
  { key: 'SP', label: 'SP', flex: 0.6, bold: true },
  { key: 'PF', label: 'PF', flex: 0.7 },
  { key: 'PA', label: 'PA', flex: 0.7 },
  { key: 'PD', label: 'PD', flex: 0.7 },
];

// ─── Tiebreaker rules ────────────────────────────────────────────────────────
// Order matches the backend comparator (see league-standings.service.ts).
// "Tie Points" is the primary metric — only when teams are tied on TP do the
// later rules come into play.
const TIEBREAKER_RULES: { num: number; title: string; desc: string }[] = [
  { num: 1, title: 'Tie Points',          desc: 'Higher Tie Points (TP = match points + bonus) ranks higher.' },
  { num: 2, title: 'Head-to-Head',        desc: 'If still tied, the team that won the league tie between them ranks higher.' },
  { num: 3, title: 'Matches Won',         desc: 'If still tied, more individual match (pair-game) wins ranks higher.' },
  { num: 4, title: 'Rally Point Diff',    desc: 'If still tied, higher rally point difference (PF − PA) ranks higher.' },
  { num: 5, title: 'Rally Points Scored', desc: 'If still tied, more total rally points scored ranks higher.' },
];

/** Map a tiebreakerType code to a short pill label shown next to the row. */
function tiebreakerBadgeLabel(type?: string): string {
  switch (type) {
    case 'h2h': return 'H2H';
    case 'matchesWon': return 'MW';
    case 'rallyPointDiff': return 'PD';
    case 'ralliesFor': return 'PF';
    default: return 'TIE';
  }
}

// ─── Legend ──────────────────────────────────────────────────────────────────
const LEGEND: { abbr: string; desc: string }[] = [
  { abbr: 'P', desc: 'Played' },
  { abbr: 'W', desc: 'Won' },
  { abbr: 'L', desc: 'Lost' },
  { abbr: 'MW', desc: 'Match Wins' },
  { abbr: 'BP', desc: 'Bonus Points' },
  { abbr: 'SP', desc: 'Standing Points' },
  { abbr: 'PF', desc: 'Points For' },
  { abbr: 'PA', desc: 'Points Against' },
  { abbr: 'PD', desc: 'Point Difference' },
];

type TabKey = 'pool' | 'group' | 'overall';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'pool', label: 'POOL' },
  { key: 'group', label: 'GROUP' },
  { key: 'overall', label: 'OVERALL' },
];

// ═════════════════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════════════════

const StandingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { leagueId, seasonId } = route.params as { leagueId: string; seasonId: string };

  const store = useLeagueStore();
  const authUser = useAuthStore((s) => s.user);
  const [standings, setStandings] = useState<LeagueStanding[]>([]);
  const [groups, setGroups] = useState<LeagueGroup[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Head-to-head winner map shipped from backend. Key: "<lex-min teamId>:
  // <lex-max teamId>". Value: winner franchiseId. Used to apply the H2H
  // tiebreaker when re-sorting cross-pool views (Group + Overall) on the
  // client and when rendering the "Beat <X> head-to-head" reason text.
  const [h2h, setH2h] = useState<Record<string, string>>({});
  // GROUP is the most useful default — that's what stakeholders watch during
  // knockout qualification week. POOL view is still one click away.
  const [activeTab, setActiveTab] = useState<TabKey>('group');

  // Admin gate — only league organizers see the download CSV button.
  const isAdmin = !!authUser?.id && league?.organizerId === authUser.id;

  // ── Data fetching ──
  const fetchData = useCallback(async () => {
    try {
      const [standingsData, groupsData, franchisesData, leagueData] = await Promise.all([
        getStandings(leagueId, seasonId),
        getGroups(leagueId, seasonId).catch(() => [] as LeagueGroup[]),
        getFranchises(leagueId).catch(() => [] as Franchise[]),
        getLeague(leagueId).catch(() => null),
      ]);
      setLeague(leagueData);
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
      // Capture the head-to-head map shipped alongside the standings so the
      // client-side rankCompare and reason-builder can use it.
      const h2hData = (standingsData && (standingsData as any).h2h) || {};
      setH2h(typeof h2hData === 'object' ? h2hData : {});
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

  // Head-to-head lookup: returns the winner franchiseId of the league tie
  // between A and B, or null if they haven't played a clean (non-draw) tie.
  // Pair key is sorted lexicographically so direction doesn't matter.
  const headToHead = React.useCallback(
    (a: string, b: string): string | null => {
      if (!a || !b || a === b) return null;
      const [x, y] = [a, b].sort();
      return h2h[`${x}:${y}`] || null;
    },
    [h2h],
  );

  // Ranking comparator — must match backend chain exactly:
  //   1) Tie Points (standingPoints)
  //   2) Head-to-head winner
  //   3) Matches won
  //   4) Rally point differential (PF − PA)
  //   5) Rally points scored (PF)
  //   6) Total match points (deterministic fallback)
  const rankCompare = React.useCallback(
    (a: LeagueStanding, b: LeagueStanding) => {
      if (b.standingPoints !== a.standingPoints) return b.standingPoints - a.standingPoints;
      const w = headToHead(a.franchiseId, b.franchiseId);
      if (w === a.franchiseId) return -1;
      if (w === b.franchiseId) return 1;
      if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
      const aPD = a.rallyPointDiff || 0;
      const bPD = b.rallyPointDiff || 0;
      if (bPD !== aPD) return bPD - aPD;
      const aPF = a.ralliesFor || 0;
      const bPF = b.ralliesFor || 0;
      if (bPF !== aPF) return bPF - aPF;
      return b.totalMatchPoints - a.totalMatchPoints;
    },
    [headToHead],
  );

  // Compute the tiebreaker reason for a row that sits above `nxt` in the
  // visible sort. Returns null when the rows aren't tied on TP. Mirrors the
  // backend `annotateTiebreakers` logic so POOL/GROUP/OVERALL views all show
  // the same reason text.
  const computeTiebreakerReason = React.useCallback(
    (cur: LeagueStanding, nxt: LeagueStanding):
      | { reason: string; type: 'h2h' | 'matchesWon' | 'rallyPointDiff' | 'ralliesFor' }
      | null => {
      if (cur.standingPoints !== nxt.standingPoints) return null;
      const otherName = teamName(nxt.franchiseId);
      const w = headToHead(cur.franchiseId, nxt.franchiseId);
      if (w === cur.franchiseId) {
        return { reason: `Beat ${otherName} head-to-head`, type: 'h2h' };
      }
      if (cur.matchesWon !== nxt.matchesWon) {
        return {
          reason: `More matches won (${cur.matchesWon} vs ${nxt.matchesWon})`,
          type: 'matchesWon',
        };
      }
      const cPD = cur.rallyPointDiff || 0;
      const nPD = nxt.rallyPointDiff || 0;
      if (cPD !== nPD) {
        const sgn = (n: number) => (n > 0 ? `+${n}` : `${n}`);
        return {
          reason: `Better rally point diff (${sgn(cPD)} vs ${sgn(nPD)})`,
          type: 'rallyPointDiff',
        };
      }
      const cPF = cur.ralliesFor || 0;
      const nPF = nxt.ralliesFor || 0;
      if (cPF !== nPF) {
        return {
          reason: `More rally points scored (${cPF} vs ${nPF})`,
          type: 'ralliesFor',
        };
      }
      return null;
    },
    [headToHead, teamName],
  );

  // POOL view: group by pool (4×4), use backend ranks
  const standingsByPool = React.useMemo(() => {
    const map = new Map<string, LeagueStanding[]>();
    standings.forEach((s) => {
      const arr = map.get(s.groupId) || [];
      arr.push(s);
      map.set(s.groupId, arr);
    });
    map.forEach((arr) => arr.sort((a, b) => (a.rank || 999) - (b.rank || 999)));
    const entries = Array.from(map.entries());
    entries.sort((a, b) => {
      const ga = groups.find((g) => g.id === a[0]);
      const gb = groups.find((g) => g.id === b[0]);
      return (ga?.displayOrder || 0) - (gb?.displayOrder || 0);
    });
    return entries.map(([gId, rows]) => ({ label: groupName(gId), rows }));
  }, [standings, groups]);

  // GROUP view: merge pools into AB and CD (pairs of 2 pools each)
  const standingsByGroupPair = React.useMemo(() => {
    const sortedGroups = [...groups].sort((a, b) => a.displayOrder - b.displayOrder);
    const pairs: { label: string; rows: LeagueStanding[] }[] = [];
    for (let i = 0; i + 1 < sortedGroups.length; i += 2) {
      const g1 = sortedGroups[i];
      const g2 = sortedGroups[i + 1];
      // Combine pool names: "Pool A" + "Pool B" → "Group AB"
      const g1Letter = g1.name.replace(/pool\s*/i, '').trim();
      const g2Letter = g2.name.replace(/pool\s*/i, '').trim();
      const label = `Group ${g1Letter}${g2Letter}`;
      const pairStandings = standings
        .filter((s) => s.groupId === g1.id || s.groupId === g2.id)
        .sort(rankCompare);
      pairs.push({ label, rows: pairStandings });
    }
    return pairs;
  }, [standings, groups]);

  // OVERALL view: all teams combined
  const standingsOverall = React.useMemo(() => {
    return [...standings].sort(rankCompare);
  }, [standings]);

  // Keep old name for backward compatibility in the render
  const standingsByGroup = standingsByPool.map((s) => [s.label, s.rows] as [string, LeagueStanding[]]);

  // Defers to the backend xlsx exporter so the file ships with proper
  // formatting (navy headers, green-highlighted top-4 qualifiers, sequential
  // 1-N rank within each group, rules legend). Replaces the older flat CSV
  // which surfaced confusing per-pool ranks alongside group totals.
  const onDownloadStandings = useCallback(() => {
    const url =
      API_BASE_URL.replace(/\/$/, '') +
      `/scoreboard/standings-export/${seasonId}.xlsx`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }, [seasonId]);

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
      case 'PF':
        return String(row.ralliesFor ?? row.totalMatchPoints ?? 0);
      case 'PA':
        return String(row.ralliesAgainst ?? row.totalMatchPointsAgainst ?? 0);
      case 'PD': {
        const pf = row.ralliesFor ?? row.totalMatchPoints ?? 0;
        const pa = row.ralliesAgainst ?? row.totalMatchPointsAgainst ?? 0;
        const diff = pf - pa;
        return diff > 0 ? `+${diff}` : String(diff);
      }
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

      <YTopBar eyebrow="SPPL" title="STANDINGS" onBack={() => navigation.goBack()} />

      {/* CSV export bar — open to all viewers (organizer asked for the
          standings download to be public). Sits between header and tabs so
          it's accessible from any sub-tab without crowding the table. */}
      <View style={styles.adminBar}>
        <DownloadButton onPress={onDownloadStandings} compact label="DOWNLOAD XLSX" />
      </View>

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
              <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {(() => {
          // Build sections based on active tab
          let sections: { label: string; rows: LeagueStanding[]; qualifyTop: number }[] = [];
          if (activeTab === 'pool') {
            sections = standingsByPool.map((s) => ({ label: s.label, rows: s.rows, qualifyTop: 0 }));
          } else if (activeTab === 'group') {
            sections = standingsByGroupPair.map((s) => ({ label: s.label, rows: s.rows, qualifyTop: 4 }));
          } else {
            sections = [{ label: 'All Teams', rows: standingsOverall, qualifyTop: 0 }];
          }

          if (sections.length === 0 || sections.every((s) => s.rows.length === 0)) {
            return (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No Standings Yet</Text>
                <Text style={styles.emptyText}>
                  Standings will populate once the league phase begins and ties are played.
                </Text>
              </View>
            );
          }

          return sections.map(({ label, rows, qualifyTop }) => (
            <View key={label} style={styles.groupSection}>
              {/* Group header with colored accent */}
              <View style={styles.groupHeader}>
                <View style={styles.groupAccent} />
                <Text style={styles.groupHeaderText}>{label}</Text>
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
                    const qualified = qualifyTop > 0 && idx < qualifyTop;
                    // Compute the tiebreaker reason against the row directly
                    // below in the CURRENT view's sort. This is the only way
                    // GROUP / OVERALL views can show meaningful reasons, since
                    // those re-sort across pools and the row's adjacency differs
                    // from the per-pool annotation the backend ships.
                    const next = rows[idx + 1];
                    const tb = next ? computeTiebreakerReason(row, next) : null;
                    const showReason = !!tb;
                    return (
                      <View
                        key={row.id}
                        style={[
                          styles.tableRowWrap,
                          qualified && styles.tableRowQualified,
                          idx === rows.length - 1 && { borderBottomWidth: 0 },
                        ]}
                      >
                        <View style={styles.tableRow}>
                          {qualified && <View style={styles.qualifiedBorder} />}
                          {COLUMNS.map((col) => {
                            // In group/overall views, show computed rank (1-based idx)
                            const val = col.key === 'rank' ? String(idx + 1) : getCellValue(row, col.key, idx);
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
                                  numberOfLines={isTeam ? 2 : 1}
                                >
                                  {val}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                        {showReason && tb && (
                          <View style={styles.tiebreakerRow}>
                            <View style={styles.tiebreakerBadge}>
                              <Text style={styles.tiebreakerBadgeText}>
                                {tiebreakerBadgeLabel(tb.type)}
                              </Text>
                            </View>
                            <Text style={styles.tiebreakerText} numberOfLines={1}>
                              {tb.reason}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          ));
        })()}

        {/* Tiebreaker rules — shown only when there's actual data on screen.
            Uses the same card style as Legend so they read as a pair. */}
        {standingsByGroup.length > 0 && (
          <View style={[styles.legendContainer, { marginTop: 12 }]}>
            <View style={styles.tbHeader}>
              <Text style={styles.legendTitle}>How tiebreakers work</Text>
              <Text style={styles.tbHint}>Applied in order until one rule decides</Text>
            </View>
            <View style={styles.tbList}>
              {TIEBREAKER_RULES.map((r) => (
                <View key={r.num} style={styles.tbRow}>
                  <View style={styles.tbNum}>
                    <Text style={styles.tbNumText}>{r.num}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tbRuleTitle}>{r.title}</Text>
                    <Text style={styles.tbRuleDesc}>{r.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Legend */}
        {standingsByGroup.length > 0 && (
          <View style={[styles.legendContainer, { marginTop: 12 }]}>
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

  // Admin-only export bar (between header and tabs)
  adminBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: SURFACE,
  },

  // Header
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

  content: { padding: 16, paddingBottom: 120 },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 8,
  },
  tabChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: SURFACE,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  tabChipActive: {
    backgroundColor: NAVY,
    borderColor: NAVY,
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: TEXT_SUB,
    letterSpacing: 0.8,
  },
  tabChipTextActive: {
    color: WHITE,
  },

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

  // Wraps a single team entry — the cell row plus an optional tiebreaker
  // subtitle row beneath it. Background color (qualified highlight) and the
  // bottom border live here so the subtitle inherits both naturally.
  tableRowWrap: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    position: 'relative',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  tableRowQualified: { backgroundColor: '#F0FDF4' },
  qualifiedBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: GREEN,
    zIndex: 1,
  },

  // Tiebreaker subtitle — small pill + reason text. Sits right under the
  // row that benefited from the tiebreaker. Padded so it aligns with the
  // Team column instead of starting under the rank cell, which would feel
  // visually disconnected.
  tiebreakerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingLeft: 56,
    paddingBottom: 9,
    paddingTop: 0,
    marginTop: -4,
    gap: 8,
  },
  tiebreakerBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  tiebreakerBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#0369A1',
    letterSpacing: 0.6,
  },
  tiebreakerText: {
    fontSize: 11,
    color: TEXT_SUB,
    fontStyle: 'italic',
    flex: 1,
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

  // Tiebreaker rules card — same chrome as Legend so the two cards read as a
  // pair, but with numbered chips so it scans as an ordered list.
  tbHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 4,
  },
  tbHint: { fontSize: 10, color: TEXT_MUTED, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  tbList: { gap: 10 },
  tbRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tbNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: NAVY,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  tbNumText: { color: WHITE, fontSize: 11, fontWeight: '900' },
  tbRuleTitle: { fontSize: 13, fontWeight: '800', color: TEXT_COLOR, letterSpacing: 0.2 },
  tbRuleDesc: { fontSize: 12, color: TEXT_SUB, marginTop: 2, lineHeight: 17 },

  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: TEXT_COLOR, marginBottom: 6 },
  emptyText: { fontSize: 13, color: TEXT_SUB, textAlign: 'center', paddingHorizontal: 32 },
});
