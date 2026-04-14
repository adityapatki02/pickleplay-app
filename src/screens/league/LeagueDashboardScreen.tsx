import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import {
  getSeasons,
  getSeason,
  getTies,
  getStandings,
  getGroups,
  getFranchises,
  startLeaguePhase,
  importMasterCSV,
  generateCaptainTokens,
} from '../../api/leagues.api';
import { useLeagueStore } from '../../store/leagueStore';
import { xAlert, xConfirm } from '../../utils/alert';
import type {
  Tie,
  LeagueStanding,
  LeagueGroup,
  SeasonStatus,
  TieStatus,
  Franchise,
} from '../../types/league.types';

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
const WARN = '#FFB300';
const RED = '#EF4444';
const PURPLE = '#8B5CF6';
const ORANGE = '#F97316';
const PINK = '#EC4899';

// ─── Tab definitions ────────────────────────────────────────────────────────
const TABS = ['OVERVIEW', 'FIXTURES', 'STANDINGS'] as const;
type Tab = (typeof TABS)[number];

// ─── Phase colors ───────────────────────────────────────────────────────────
const PHASE_CONFIG: Record<SeasonStatus, { label: string; color: string; bg: string }> = {
  setup: { label: 'SETUP', color: TEXT_SUB, bg: '#E2E8F0' },
  registration: { label: 'REGISTRATION', color: BLUE, bg: '#DBEAFE' },
  league_phase: { label: 'LEAGUE PHASE', color: GREEN, bg: '#D1FAE5' },
  knockout_phase: { label: 'KNOCKOUT', color: WARN, bg: '#FEF3C7' },
  completed: { label: 'COMPLETED', color: NAVY, bg: '#E0E7FF' },
};

// ─── Status chip colors ─────────────────────────────────────────────────────
const STATUS_CHIP: Record<TieStatus, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', color: TEXT_SUB, bg: '#F1F5F9' },
  lineup_submitted: { label: 'Lineup In', color: BLUE, bg: '#DBEAFE' },
  lineup_locked: { label: 'Locked', color: PURPLE, bg: '#EDE9FE' },
  in_progress: { label: 'Live', color: ORANGE, bg: '#FFF7ED' },
  completed: { label: 'Completed', color: GREEN, bg: '#D1FAE5' },
  postponed: { label: 'Postponed', color: RED, bg: '#FEE2E2' },
};

// ═════════════════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════════════════

const LeagueDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { leagueId, seasonId: routeSeasonId } = route.params as { leagueId: string; seasonId?: string };

  const store = useLeagueStore();
  const [activeTab, setActiveTab] = useState<Tab>('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [showLinksModal, setShowLinksModal] = useState(false);
  const [captainLinks, setCaptainLinks] = useState<{ name: string; token: string; url: string }[]>([]);
  const [resolvedSeasonId, setResolvedSeasonId] = useState(routeSeasonId || '');

  // Local state
  const [ties, setTies] = useState<Tie[]>([]);
  const [standings, setStandings] = useState<LeagueStanding[]>([]);
  const [groups, setGroups] = useState<LeagueGroup[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const season = store.currentSeason;

  // ── Data fetching ──
  const fetchAll = useCallback(async () => {
    try {
      // If no seasonId, fetch the latest season for this league
      let seasonId = resolvedSeasonId;
      if (!seasonId) {
        const seasons = await getSeasons(leagueId);
        const seasonList = Array.isArray(seasons) ? seasons : [];
        if (seasonList.length > 0) {
          seasonId = seasonList[0].id;
          setResolvedSeasonId(seasonId);
        } else {
          // No seasons yet — just show franchises
          const franchisesData = await getFranchises(leagueId).catch(() => [] as Franchise[]);
          setFranchises(franchisesData);
          return;
        }
      }

      const [seasonData, tiesData, standingsData, groupsData, franchisesData] = await Promise.all([
        getSeason(leagueId, seasonId),
        getTies(leagueId, seasonId).catch(() => [] as Tie[]),
        getStandings(leagueId, seasonId).catch(() => ({ groups: [] })),
        getGroups(leagueId, seasonId).catch(() => [] as LeagueGroup[]),
        getFranchises(leagueId).catch(() => [] as Franchise[]),
      ]);
      store.setCurrentSeason(seasonData);
      const tieList = Array.isArray(tiesData) ? tiesData : [];
      const groupList = Array.isArray(groupsData) ? groupsData : [];
      // Standings API returns { groups: [{ group, standings }] } — flatten
      let standingList: any[] = [];
      if (Array.isArray(standingsData)) {
        standingList = standingsData;
      } else if ((standingsData as any)?.groups) {
        for (const g of (standingsData as any).groups) {
          if (g.standings) standingList.push(...g.standings);
        }
      }
      setTies(tieList);
      setStandings(standingList);
      setGroups(groupList);
      setFranchises(Array.isArray(franchisesData) ? franchisesData : []);
      store.setTies(tieList);
      store.setGroups(groupList);
    } catch (err: any) {
      console.warn('League dashboard fetch error:', err?.message);
    }
  }, [leagueId, resolvedSeasonId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchAll().finally(() => setLoading(false));
    }, [fetchAll]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  // ── Helpers ──
  const franchiseMap = React.useMemo(() => {
    const m: Record<string, Franchise> = {};
    franchises.forEach((f) => (m[f.id] = f));
    return m;
  }, [franchises]);

  // Build pool tag map: franchiseId → "A1", "B2", "C3", "D4" etc.
  const poolTagMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    const poolLetters: Record<string, string> = {
      'Pool A': 'A', 'Pool B': 'B', 'Pool C': 'C', 'Pool D': 'D',
    };
    // Try building from groups data (each group has franchises array)
    const rawGroups = Array.isArray(groups) ? groups : [];
    rawGroups.forEach((g: any) => {
      const letter = poolLetters[g.name] || g.name?.replace('Pool ', '') || '?';
      const members = g.franchises || [];
      members.forEach((gf: any, idx: number) => {
        const fId = gf.franchiseId || gf.franchise?.id || gf.id;
        if (fId) m[fId] = `${letter}${idx + 1}`;
      });
    });

    // Fallback: if groups didn't populate, build from tie patterns
    // Pool A teams play Pool B teams (in group 1), Pool C play Pool D (group 2)
    if (Object.keys(m).length === 0 && ties.length > 0) {
      // Group ties by groupId, collect unique home/away teams per group
      const groupTeams = new Map<string, { home: Set<string>; away: Set<string> }>();
      ties.forEach((t: any) => {
        const gId = t.groupId || 'default';
        if (!groupTeams.has(gId)) groupTeams.set(gId, { home: new Set(), away: new Set() });
        const gt = groupTeams.get(gId)!;
        // In cross-pool ties, all homeTeams are from one pool, awayTeams from the other
        gt.home.add(t.homeTeamId);
        gt.away.add(t.awayTeamId);
      });

      const groupEntries = Array.from(groupTeams.entries());
      const letters = ['A', 'B', 'C', 'D'];
      groupEntries.forEach(([, gt], gi) => {
        const homeArr = Array.from(gt.home);
        const awayArr = Array.from(gt.away);
        const l1 = letters[gi * 2] || '?';
        const l2 = letters[gi * 2 + 1] || '?';
        homeArr.forEach((fId, idx) => { m[fId] = `${l1}${idx + 1}`; });
        awayArr.forEach((fId, idx) => { m[fId] = `${l2}${idx + 1}`; });
      });
    }
    return m;
  }, [groups, ties]);

  const teamNamePlain = (id: string) => franchiseMap[id]?.shortName || franchiseMap[id]?.name || '—';
  const teamName = (id: string) => teamNamePlain(id); // plain for non-JSX usage
  const teamPoolTag = (id: string) => poolTagMap[id] || '';

  const completedTies = ties.filter((t) => t.status === 'completed');
  const upcomingTies = ties.filter((t) => t.status !== 'completed' && t.status !== 'postponed');

  const tiesByRound = React.useMemo(() => {
    const map = new Map<string, Tie[]>();
    ties.forEach((t) => {
      const arr = map.get(t.round) || [];
      arr.push(t);
      map.set(t.round, arr);
    });
    return Array.from(map.entries()).sort((a, b) => {
      const numA = parseInt(a[0].replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b[0].replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });
  }, [ties]);

  const standingsByGroup = React.useMemo(() => {
    const map = new Map<string, LeagueStanding[]>();
    standings.forEach((s) => {
      const arr = map.get(s.groupId) || [];
      arr.push(s);
      map.set(s.groupId, arr);
    });
    // Sort each group by rank/standing points
    map.forEach((arr) => {
      arr.sort((a, b) => (a.rank || 999) - (b.rank || 999));
    });
    return map;
  }, [standings]);

  const groupName = (groupId: string) => groups.find((g) => g.id === groupId)?.name || groupId;

  // ── Actions ──
  const handleStartLeague = () => {
    xConfirm(
      'Start League Phase',
      'This will generate fixtures for all groups. Continue?',
      async () => {
        setActionLoading(true);
        try {
          await startLeaguePhase(leagueId, resolvedSeasonId);
          xAlert('Success', 'League phase started! Fixtures have been generated.');
          await fetchAll();
        } catch (err: any) {
          xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to start league');
        } finally {
          setActionLoading(false);
        }
      },
    );
  };

  // ─── RENDERS ──────────────────────────────────────────────────────────────

  const renderPhaseBar = () => {
    if (!season) return null;
    const phase = PHASE_CONFIG[season.status] || PHASE_CONFIG.setup;
    return (
      <View style={[styles.phaseBanner, { backgroundColor: phase.bg }]}>
        <Text style={[styles.phaseLabel, { color: phase.color }]}>{phase.label}</Text>
        <Text style={[styles.phaseSubtext, { color: phase.color }]}>
          {season.name}
        </Text>
      </View>
    );
  };

  const renderQuickStats = () => {
    const totalTies = ties.length;
    const played = completedTies.length;
    const remaining = totalTies - played;
    // Find top team
    const sorted = [...standings].sort((a, b) => b.standingPoints - a.standingPoints);
    const topTeam = sorted[0] ? teamName(sorted[0].franchiseId) : '—';

    const stats = [
      { label: 'Franchises', value: String(franchises.length) },
      { label: 'Ties Played', value: String(played) },
      { label: 'Remaining', value: String(remaining) },
      { label: 'Top Team', value: topTeam },
    ];

    return (
      <View style={styles.statsRow}>
        {stats.map((s, i) => (
          <View key={i} style={styles.statPill}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderTieCard = (tie: Tie, compact = false) => {
    const chipCfg = STATUS_CHIP[tie.status] || STATUS_CHIP.scheduled;
    return (
      <TouchableOpacity
        key={tie.id}
        style={styles.tieCard}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('TieDetail', { tieId: tie.id })}
      >
        <View style={styles.tieCardHeader}>
          <View style={styles.roundBadge}>
            <Text style={styles.roundBadgeText}>{tie.round}</Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: chipCfg.bg }]}>
            <Text style={[styles.statusChipText, { color: chipCfg.color }]}>{chipCfg.label}</Text>
          </View>
        </View>

        <View style={styles.tieMatchup}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            {teamPoolTag(tie.homeTeamId) ? (
              <Text style={{ fontSize: 11, fontWeight: '800', color: BLUE, marginBottom: 2 }}>({teamPoolTag(tie.homeTeamId)})</Text>
            ) : null}
            <Text style={styles.tieTeamName}>{teamNamePlain(tie.homeTeamId)}</Text>
          </View>
          {tie.status === 'completed' ? (
            <View style={styles.tieScoreBox}>
              <Text style={styles.tieScoreText}>
                {tie.homeScore} - {tie.awayScore}
              </Text>
            </View>
          ) : (
            <Text style={styles.tieVsText}>vs</Text>
          )}
          <View style={{ flex: 1, alignItems: 'center' }}>
            {teamPoolTag(tie.awayTeamId) ? (
              <Text style={{ fontSize: 11, fontWeight: '800', color: BLUE, marginBottom: 2 }}>({teamPoolTag(tie.awayTeamId)})</Text>
            ) : null}
            <Text style={styles.tieTeamName}>{teamNamePlain(tie.awayTeamId)}</Text>
          </View>
        </View>

        {tie.status === 'completed' && (tie.homeBonusPoints > 0 || tie.awayBonusPoints > 0) && (
          <View style={styles.tieBonusRow}>
            <Text style={styles.tieBonusText}>+{tie.homeBonusPoints} bonus</Text>
            <Text style={styles.tieBonusText}>+{tie.awayBonusPoints} bonus</Text>
          </View>
        )}

        {tie.matchDay && (
          <Text style={styles.tieDateText}>
            {new Date(tie.matchDay).toLocaleDateString('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  // ── OVERVIEW TAB ──
  // ── Setup action cards ──
  const renderSetupActions = () => {
    const actions = [
      {
        icon: '🏢',
        title: 'Manage Franchises',
        sub: `${franchises.length} franchise${franchises.length !== 1 ? 's' : ''} added`,
        onPress: () => navigation.navigate('FranchiseManagement', { leagueId }),
        color: '#3B82F6',
        bg: '#DBEAFE',
      },
      {
        icon: '📋',
        title: 'Import CSV (All Franchises)',
        sub: 'Bulk import franchises + players from CSV',
        onPress: () => setShowCSVModal(true),
        color: '#059669',
        bg: '#D1FAE5',
      },
      {
        icon: '👥',
        title: 'Manage Groups',
        sub: `${groups.length} group${groups.length !== 1 ? 's' : ''} set up`,
        onPress: () => navigation.navigate('GroupManagement', { leagueId, seasonId: resolvedSeasonId }),
        color: '#8B5CF6',
        bg: '#EDE9FE',
      },
      {
        icon: '🔗',
        title: 'Captain Portal Links',
        sub: 'Generate & share links for team captains',
        onPress: async () => {
          setActionLoading(true);
          try {
            const links = await generateCaptainTokens(leagueId);
            setCaptainLinks(Array.isArray(links) ? links : []);
            setShowLinksModal(true);
          } catch (err: any) {
            xAlert('Error', err?.message || 'Failed to generate links');
          } finally {
            setActionLoading(false);
          }
        },
        color: '#0891B2',
        bg: '#CFFAFE',
      },
    ];

    return (
      <View style={{ marginBottom: 16 }}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Setup</Text>
        </View>
        {actions.map((a, i) => (
          <TouchableOpacity
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: WHITE,
              borderRadius: 12,
              padding: 14,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: BORDER,
            }}
            onPress={a.onPress}
            activeOpacity={0.7}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: a.bg,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Text style={{ fontSize: 18 }}>{a.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT_COLOR }}>{a.title}</Text>
              <Text style={{ fontSize: 12, color: TEXT_SUB, marginTop: 2 }}>{a.sub}</Text>
            </View>
            <Text style={{ fontSize: 18, color: TEXT_MUTED }}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderOverview = () => (
    <ScrollView
      contentContainerStyle={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {renderPhaseBar()}
      {renderSetupActions()}
      {renderQuickStats()}

      {/* Upcoming Ties */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Upcoming Ties</Text>
      </View>
      {upcomingTies.length === 0 ? (
        <Text style={styles.emptyText}>No upcoming ties</Text>
      ) : (
        upcomingTies.slice(0, 3).map((t) => renderTieCard(t))
      )}

      {/* Recent Results */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Results</Text>
      </View>
      {completedTies.length === 0 ? (
        <Text style={styles.emptyText}>No results yet</Text>
      ) : (
        completedTies.slice(-3).reverse().map((t) => renderTieCard(t))
      )}

      {/* Action: Start League */}
      {(season?.status === 'setup' || season?.status === 'registration') && (
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleStartLeague}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <ActivityIndicator color={WHITE} />
          ) : (
            <Text style={styles.primaryBtnText}>GENERATE FIXTURES & START LEAGUE</Text>
          )}
        </TouchableOpacity>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  // ── FIXTURES TAB ──
  const renderFixtures = () => (
    <ScrollView
      contentContainerStyle={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {(season?.status === 'setup' || season?.status === 'registration') && (
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleStartLeague}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <ActivityIndicator color={WHITE} />
          ) : (
            <Text style={styles.primaryBtnText}>GENERATE FIXTURES</Text>
          )}
        </TouchableOpacity>
      )}

      {ties.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Fixtures Yet</Text>
          <Text style={styles.emptyText}>
            Start the league phase to generate fixtures for all groups.
          </Text>
        </View>
      ) : (
        tiesByRound.map(([round, roundTies]) => (
          <View key={round}>
            <View style={styles.roundHeader}>
              <View style={styles.roundDot} />
              <Text style={styles.roundHeaderText}>{round}</Text>
              <View style={styles.roundLine} />
            </View>
            {roundTies.map((t, idx) => (
              <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                {/* Reorder arrows */}
                <View style={{ width: 28, alignItems: 'center', marginRight: 4 }}>
                  {idx > 0 && (
                    <TouchableOpacity
                      style={{ paddingVertical: 4 }}
                      onPress={() => {
                        // Swap this tie with the one above in the round
                        const newTies = [...ties];
                        const globalIdx = newTies.findIndex((x) => x.id === t.id);
                        const prevInRound = newTies.findIndex((x) => x.id === roundTies[idx - 1].id);
                        if (globalIdx !== -1 && prevInRound !== -1) {
                          // Swap matchDay/round to reorder
                          const tmpDay = newTies[globalIdx].matchDay;
                          newTies[globalIdx].matchDay = newTies[prevInRound].matchDay;
                          newTies[prevInRound].matchDay = tmpDay;
                          [newTies[globalIdx], newTies[prevInRound]] = [newTies[prevInRound], newTies[globalIdx]];
                          setTies(newTies);
                        }
                      }}
                    >
                      <Text style={{ fontSize: 16, color: BLUE, fontWeight: '800' }}>▲</Text>
                    </TouchableOpacity>
                  )}
                  {idx < roundTies.length - 1 && (
                    <TouchableOpacity
                      style={{ paddingVertical: 4 }}
                      onPress={() => {
                        const newTies = [...ties];
                        const globalIdx = newTies.findIndex((x) => x.id === t.id);
                        const nextInRound = newTies.findIndex((x) => x.id === roundTies[idx + 1].id);
                        if (globalIdx !== -1 && nextInRound !== -1) {
                          const tmpDay = newTies[globalIdx].matchDay;
                          newTies[globalIdx].matchDay = newTies[nextInRound].matchDay;
                          newTies[nextInRound].matchDay = tmpDay;
                          [newTies[globalIdx], newTies[nextInRound]] = [newTies[nextInRound], newTies[globalIdx]];
                          setTies(newTies);
                        }
                      }}
                    >
                      <Text style={{ fontSize: 16, color: BLUE, fontWeight: '800' }}>▼</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  {renderTieCard(t)}
                </View>
              </View>
            ))}
          </View>
        ))
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );

  // ── STANDINGS TAB ──
  const renderStandingsTab = () => {
    const groupEntries = Array.from(standingsByGroup.entries());
    return (
      <ScrollView
        contentContainerStyle={styles.tabContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {groupEntries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Standings</Text>
            <Text style={styles.emptyText}>Standings will appear once matches are played.</Text>
          </View>
        ) : (
          groupEntries.map(([gId, rows]) => (
            <View key={gId} style={styles.groupSection}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupHeaderText}>{groupName(gId)}</Text>
              </View>
              {/* Table header */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { flex: 0.4 }]}>#</Text>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Team</Text>
                <Text style={styles.tableHeaderCell}>P</Text>
                <Text style={styles.tableHeaderCell}>W</Text>
                <Text style={styles.tableHeaderCell}>L</Text>
                <Text style={styles.tableHeaderCell}>MW</Text>
                <Text style={styles.tableHeaderCell}>SP</Text>
                <Text style={styles.tableHeaderCell}>PD</Text>
              </View>
              {/* Table rows */}
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
                    <Text style={[styles.tableCell, { flex: 0.4, fontWeight: '700' }]}>
                      {row.rank || idx + 1}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 2, fontWeight: '600' }]} numberOfLines={1}>
                      {teamName(row.franchiseId)}
                    </Text>
                    <Text style={styles.tableCell}>{row.tiesPlayed}</Text>
                    <Text style={styles.tableCell}>{row.tiesWon}</Text>
                    <Text style={styles.tableCell}>{row.tiesLost}</Text>
                    <Text style={styles.tableCell}>{row.matchesWon}</Text>
                    <Text style={[styles.tableCell, { fontWeight: '700', color: NAVY }]}>
                      {row.standingPoints}
                    </Text>
                    <Text style={styles.tableCell}>
                      {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))
        )}

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('Standings', { leagueId, seasonId: resolvedSeasonId })}
        >
          <Text style={styles.secondaryBtnText}>VIEW FULL STANDINGS</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  // ─── MAIN RENDER ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={styles.loadingText}>Loading league data...</Text>
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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {store.currentLeague?.name || 'League'}
          </Text>
          <Text style={styles.headerSubtitle}>{season?.name || 'Season'}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarInner}>
          {TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabChip, active && styles.tabChipActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Tab Content */}
      {activeTab === 'OVERVIEW' && renderOverview()}
      {activeTab === 'FIXTURES' && renderFixtures()}
      {activeTab === 'STANDINGS' && renderStandingsTab()}

      {/* Captain Links Modal */}
      <Modal visible={showLinksModal} transparent animationType="slide">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setShowLinksModal(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: NAVY, marginBottom: 4 }}>Captain Portal Links</Text>
              <Text style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 12 }}>Share each link with the respective team captain</Text>
              <ScrollView style={{ maxHeight: 400 }}>
                {captainLinks.map((link, i) => {
                  const fullUrl = `https://yoiden-api-460478077750.asia-south1.run.app${link.url}`;
                  return (
                    <View key={i} style={{ backgroundColor: SURFACE, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: NAVY }}>{link.name}</Text>
                      <Text
                        style={{ fontSize: 11, color: BLUE, marginTop: 4 }}
                        selectable
                        numberOfLines={2}
                      >
                        {fullUrl}
                      </Text>
                      <TouchableOpacity
                        style={{ marginTop: 6, backgroundColor: BLUE, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, alignSelf: 'flex-start' }}
                        onPress={() => {
                          if (typeof navigator !== 'undefined' && navigator.clipboard) {
                            navigator.clipboard.writeText(fullUrl);
                            xAlert('Copied', `Link for ${link.name} copied to clipboard`);
                          }
                        }}
                      >
                        <Text style={{ color: WHITE, fontSize: 12, fontWeight: '700' }}>COPY LINK</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                style={{ marginTop: 12, paddingVertical: 14, borderRadius: 10, backgroundColor: SURFACE, alignItems: 'center' }}
                onPress={() => setShowLinksModal(false)}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: TEXT_SUB }}>CLOSE</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* CSV Import Modal */}
      <Modal visible={showCSVModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
            activeOpacity={1}
            onPress={() => setShowCSVModal(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={{ backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: NAVY, marginBottom: 4 }}>
                  Import Master CSV
                </Text>
                <Text style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 12 }}>
                  Format: franchise_name,slot_number,category,player1_name,player1_phone,player2_name,player2_phone
                </Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: BORDER,
                    borderRadius: 10,
                    padding: 12,
                    minHeight: 200,
                    fontSize: 13,
                    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                    backgroundColor: SURFACE,
                    textAlignVertical: 'top',
                  }}
                  multiline
                  value={csvText}
                  onChangeText={setCsvText}
                  placeholder={`franchise_name,slot_number,category,player1_name,player1_phone,player2_name,player2_phone\nAces,1,Kids & Kids,Rahul Kumar,9876543210,Amit Singh,9876543211\nAces,2,Kid & Teen (M),Rohan P,9876543212,Vijay S,9876543213`}
                  placeholderTextColor={TEXT_MUTED}
                />
                <View style={{ flexDirection: 'row', marginTop: 16, gap: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: SURFACE, alignItems: 'center' }}
                    onPress={() => { setShowCSVModal(false); setCsvText(''); }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: TEXT_SUB }}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: GREEN, alignItems: 'center' }}
                    onPress={async () => {
                      if (!csvText.trim() || !resolvedSeasonId) return;
                      setActionLoading(true);
                      try {
                        const result = await importMasterCSV(leagueId, resolvedSeasonId, csvText);
                        setShowCSVModal(false);
                        setCsvText('');
                        const msg = `Created ${result.franchisesCreated ?? 0} franchises, imported ${result.playersImported ?? 0} players.${result.errors?.length ? `\n${result.errors.length} errors.` : ''}`;
                        xAlert('Import Complete', msg);
                        await fetchAll();
                      } catch (err: any) {
                        xAlert('Import Error', err?.response?.data?.message || err?.message || 'Failed');
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    disabled={actionLoading || !csvText.trim()}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color={WHITE} />
                    ) : (
                      <Text style={{ fontSize: 14, fontWeight: '700', color: WHITE }}>IMPORT</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default LeagueDashboardScreen;

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
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: WHITE, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  headerSubtitle: { color: TEXT_MUTED, fontSize: 12, marginTop: 2 },

  // Tab bar
  tabBar: { backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER },
  tabBarInner: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tabChip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: SURFACE,
  },
  tabChipActive: { backgroundColor: NAVY },
  tabChipText: { fontSize: 13, fontWeight: '700', color: TEXT_SUB, letterSpacing: 0.5 },
  tabChipTextActive: { color: WHITE },

  // Tab content
  tabContent: { padding: 16, paddingBottom: 120 },

  // Phase banner
  phaseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  phaseLabel: { fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  phaseSubtext: { fontSize: 13, fontWeight: '500' },

  // Quick stats
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  statPill: {
    flex: 1,
    backgroundColor: WHITE,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: NAVY },
  statLabel: { fontSize: 10, fontWeight: '600', color: TEXT_SUB, marginTop: 4, letterSpacing: 0.3 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: NAVY, letterSpacing: -0.2 },

  // Tie card
  tieCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tieCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  roundBadge: {
    backgroundColor: SURFACE,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roundBadgeText: { fontSize: 11, fontWeight: '700', color: TEXT_SUB, letterSpacing: 0.5 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusChipText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  tieMatchup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tieTeamName: { flex: 1, fontSize: 15, fontWeight: '700', color: TEXT_COLOR, textAlign: 'center' },
  tieVsText: { fontSize: 12, fontWeight: '600', color: TEXT_MUTED, marginHorizontal: 8 },
  tieScoreBox: {
    backgroundColor: NAVY,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  tieScoreText: { fontSize: 16, fontWeight: '800', color: WHITE },

  tieBonusRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  tieBonusText: { fontSize: 11, fontWeight: '600', color: GREEN },
  tieDateText: { fontSize: 11, color: TEXT_SUB, marginTop: 8, textAlign: 'center' },

  // Round header (fixtures)
  roundHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 12 },
  roundDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE, marginRight: 8 },
  roundHeaderText: { fontSize: 14, fontWeight: '800', color: NAVY, letterSpacing: 0.3 },
  roundLine: { flex: 1, height: 1, backgroundColor: BORDER, marginLeft: 12 },

  // Standings table
  groupSection: {
    backgroundColor: WHITE,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  groupHeader: {
    backgroundColor: NAVY,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  groupHeaderText: { color: WHITE, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_SUB,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRowQualified: { backgroundColor: '#F0FDF4' },
  tableCell: {
    flex: 1,
    fontSize: 13,
    color: TEXT_COLOR,
    textAlign: 'center',
  },

  // Buttons
  primaryBtn: {
    backgroundColor: GREEN,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  primaryBtnText: { color: NAVY, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  secondaryBtn: {
    backgroundColor: WHITE,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: NAVY,
  },
  secondaryBtnText: { color: NAVY, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: TEXT_COLOR, marginBottom: 6 },
  emptyText: { fontSize: 13, color: TEXT_SUB, textAlign: 'center' },
});
