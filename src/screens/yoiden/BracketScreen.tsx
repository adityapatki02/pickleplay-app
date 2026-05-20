import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';
import { matchesApi } from '../../api/matches.api';
import { tournamentsApi } from '../../api/tournaments.api';
import { xAlert, xConfirm } from '../../utils/alert';
import { BracketData, TournamentCategory } from '../../types/tournament.types';


import { OrgTournamentsStackParamList } from '../../navigation/types';
import { YColors, YTopBar } from '../../components/yoiden';

// ─── Constants ────────────────────────────────────────────────────────────────

const NAVY = YColors.ink;
const BLUE = YColors.accent;
const GREEN = '#06D6A0';
const ORANGE = '#FFB703';
const BG = YColors.bg;
const WHITE = '#FFFFFF';
const GRAY = '#737780';
const BORDER = YColors.line;

const GROUP_LETTERS = 'ABCDEFGHIJKLMNOP';

type NavProp = NativeStackNavigationProp<OrgTournamentsStackParamList, 'BracketManage'>;
type RouteType = RouteProp<OrgTournamentsStackParamList, 'BracketManage'>;
type TabKey = 'pools' | 'bracket';

// ─── Icons ────────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M19 12H5M5 12L12 19M5 12L12 5" stroke={WHITE} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function allPoolMatchesComplete(data: BracketData): boolean {
  if (!data.pools || data.pools.length === 0) return false;
  return data.pools.every((pool) =>
    pool.matches.every((m) => m.status === 'completed' || m.status === 'walkover')
  );
}

function matchStatusColor(status: string): string {
  if (status === 'completed' || status === 'walkover') return GREEN;
  if (status === 'in_progress') return BLUE;
  return GRAY;
}

function TeamNameDisplay({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const parts = name.split(' / ');
  const fontSize = size === 'sm' ? 12 : 13;
  const subSize = size === 'sm' ? 10 : 11;
  if (parts.length > 1) {
    return (
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#1A1D21', fontSize, fontWeight: '700' }} numberOfLines={1}>{parts[0]}</Text>
        <Text style={{ color: '#64748B', fontSize: subSize, fontWeight: '600' }} numberOfLines={1}>{parts[1]}</Text>
      </View>
    );
  }
  return <Text style={{ color: '#1A1D21', fontSize, fontWeight: '700', flex: 1 }} numberOfLines={1}>{name}</Text>;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OrganizerBracketScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const { categoryId } = route.params;
  const tournamentId = (route.params as any).tournamentId as string | undefined;

  const [activeTab, setActiveTab] = useState<TabKey>('pools');
  const [bracketData, setBracketData] = useState<BracketData | null>(null);
  const [categories, setCategories] = useState<TournamentCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(categoryId);
  const [loading, setLoading] = useState(true);
  const [generatingDraw, setGeneratingDraw] = useState(false);

  const fetchBracket = useCallback(async (catId: string) => {
    if (!tournamentId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await matchesApi.getBracket(tournamentId, catId);
      setBracketData(res.data?.data ?? res.data);
    } catch {
      setBracketData(null);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  const fetchCategories = useCallback(async () => {
    if (!tournamentId) return;
    try {
      const res = await tournamentsApi.listCategories(tournamentId);
      const data = res.data?.data ?? res.data ?? [];
      setCategories(Array.isArray(data) ? data : []);
    } catch {}
  }, [tournamentId]);

  useEffect(() => {
    fetchCategories();
    fetchBracket(activeCategoryId);
  }, [fetchCategories, fetchBracket, activeCategoryId]);

  const handleGenerateDraw = () => {
    if (!tournamentId) return;
    xConfirm(
      'Generate Draw',
      'This will create pools and matches from confirmed registrations.',
      async () => {
        setGeneratingDraw(true);
        try {
          await matchesApi.generateDraw(tournamentId, activeCategoryId);
          await fetchBracket(activeCategoryId);
          xAlert('Draw Generated', 'Pools and matches have been created.');
        } catch (err: any) {
          xAlert('Error', err?.response?.data?.message ?? 'Failed to generate draw');
        } finally {
          setGeneratingDraw(false);
        }
      },
      'Generate',
    );
  };

  const handleMatchPress = (matchId: string) => {
    (navigation as any).navigate('ScoreEntry', { matchId });
  };

  // Derived
  const teamNames: Record<string, string> = {};
  if (bracketData?.teams) {
    for (const t of bracketData.teams) teamNames[t.id] = t.name;
  }

  const pools = bracketData?.pools ?? [];
  const knockout = bracketData?.knockout ?? [];
  const hasPools = pools.length > 0;
  const hasKnockout = knockout.length > 0;
  const noDraw = !bracketData || (!hasPools && !hasKnockout);
  const poolsComplete = bracketData ? allPoolMatchesComplete(bracketData) : false;

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: YColors.bg }]}>
      <YTopBar
        eyebrow="ORGANIZER · DRAW & MATCHES"
        title="BRACKETS"
        onBack={() => navigation.goBack()}
      />
      <View style={s.header}>
        {/* Category selector continues below */}

        {/* Category selector inside header */}
        {categories.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.catRow}
          >
            {categories.map((cat) => {
              const active = cat.id === activeCategoryId;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[s.catChip, active && s.catChipActive]}
                  onPress={() => setActiveCategoryId(cat.id)}
                >
                  <Text style={[s.catChipText, active && s.catChipTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Tab bar */}
      {!noDraw && (
        <View style={s.tabBar}>
          {(['pools', 'bracket'] as TabKey[]).map((tab) => {
            const active = activeTab === tab;
            const disabled = tab === 'bracket' && !hasKnockout;
            return (
              <TouchableOpacity
                key={tab}
                style={[s.tabBtn, active && s.tabBtnActive, disabled && { opacity: 0.35 }]}
                onPress={() => !disabled && setActiveTab(tab)}
              >
                <Text style={[s.tabText, active && s.tabTextActive]}>
                  {tab === 'pools' ? 'POOLS' : 'BRACKET'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={BLUE} />
        </View>
      ) : noDraw ? (
        <View style={s.center}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🏆</Text>
          <Text style={s.emptyTitle}>NO DRAW YET</Text>
          <Text style={s.emptySub}>Generate the draw to create pools and matches.</Text>
          <TouchableOpacity
            style={[s.generateBtn, generatingDraw && { opacity: 0.5 }]}
            onPress={handleGenerateDraw}
            disabled={generatingDraw}
          >
            {generatingDraw
              ? <ActivityIndicator color={WHITE} size="small" />
              : <Text style={s.generateBtnText}>GENERATE DRAW</Text>
            }
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {activeTab === 'pools' && (
            <>
              {pools.map((pool, idx) => (
                <View key={`pool-${idx}`} style={s.poolCard}>
                  {/* Pool header */}
                  <View style={s.poolHeader}>
                    <View style={s.poolBadge}>
                      <Text style={s.poolBadgeText}>{GROUP_LETTERS[idx] ?? idx + 1}</Text>
                    </View>
                    <Text style={s.poolTitle}>GROUP {GROUP_LETTERS[idx] ?? idx + 1}</Text>
                    <Text style={s.poolCount}>{pool.teams.length} teams</Text>
                  </View>

                  {/* Standings table */}
                  <View style={s.table}>
                    <View style={s.tableHeader}>
                      <Text style={[s.th, { flex: 2 }]}>TEAM</Text>
                      <Text style={s.th}>W</Text>
                      <Text style={s.th}>L</Text>
                      <Text style={s.th}>PF</Text>
                      <Text style={s.th}>PA</Text>
                    </View>
                    {pool.teams.map((team, tIdx) => (
                      <View key={team.id} style={[s.tableRow, tIdx % 2 === 0 && s.tableRowAlt]}>
                        <View style={[{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                          <Text style={s.rankNum}>{tIdx + 1}</Text>
                          <TeamNameDisplay name={team.name} size="sm" />
                        </View>
                        <Text style={s.td}>{team.wins}</Text>
                        <Text style={s.td}>{team.losses}</Text>
                        <Text style={s.td}>{team.pointsFor}</Text>
                        <Text style={s.td}>{team.pointsAgainst}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Pool matches */}
                  <View style={s.matchesSection}>
                    <Text style={s.matchesLabel}>MATCHES</Text>
                    {pool.matches.map((match) => {
                      const teamA = teamNames[match.teamAId ?? ''] ?? 'TBD';
                      const teamB = teamNames[match.teamBId ?? ''] ?? 'TBD';
                      const isDone = match.status === 'completed' || match.status === 'walkover';
                      const scoreText = match.scores?.length > 0
                        ? match.scores.map((sc: any) => `${sc.teamAScore ?? 0}-${sc.teamBScore ?? 0}`).join(', ')
                        : null;

                      return (
                        <TouchableOpacity
                          key={match.id}
                          style={s.matchCard}
                          onPress={() => handleMatchPress(match.id)}
                          activeOpacity={0.75}
                        >
                          <View style={[s.matchStatusDot, { backgroundColor: matchStatusColor(match.status) }]} />
                          <View style={s.matchContent}>
                            <View style={s.matchTeams}>
                              <View style={[{ flex: 1 }, isDone && match.winnerId === match.teamAId && { opacity: 1 }, isDone && match.winnerId !== match.teamAId && { opacity: 0.5 }]}>
                                <TeamNameDisplay name={teamA} size="sm" />
                              </View>
                              <Text style={s.matchVs}>vs</Text>
                              <View style={[{ flex: 1 }, isDone && match.winnerId === match.teamBId && { opacity: 1 }, isDone && match.winnerId !== match.teamBId && { opacity: 0.5 }]}>
                                <TeamNameDisplay name={teamB} size="sm" />
                              </View>
                            </View>
                            {scoreText && <Text style={s.matchScoreText}>{scoreText}</Text>}
                          </View>
                          <TouchableOpacity
                            style={[s.scoreBtn, isDone && s.scoreBtnDone]}
                            onPress={() => handleMatchPress(match.id)}
                          >
                            <Text style={[s.scoreBtnText, isDone && s.scoreBtnTextDone]}>
                              {isDone ? '✓' : 'SCORE'}
                            </Text>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}

              {/* Generate knockout when pools complete */}
              {poolsComplete && !hasKnockout && (
                <TouchableOpacity
                  style={s.generateBtn}
                  onPress={() => {
                    xConfirm('Generate Knockout', 'Pool play is complete. Generate knockout bracket?', async () => {
                      try {
                        await matchesApi.generateDraw(tournamentId!, activeCategoryId);
                        await fetchBracket(activeCategoryId);
                        xAlert('Success', 'Knockout bracket generated!');
                      } catch (err: any) {
                        xAlert('Error', err?.response?.data?.message ?? 'Failed');
                      }
                    }, 'Generate');
                  }}
                >
                  <Text style={s.generateBtnText}>GENERATE KNOCKOUT BRACKET</Text>
                </TouchableOpacity>
              )}

              {hasKnockout && (
                <TouchableOpacity
                  style={{ alignSelf: 'center', paddingVertical: 10, marginTop: 8 }}
                  onPress={() => {
                    xConfirm('Reset Knockout', 'This will delete all knockout matches and let you re-select advancing teams. Pool matches will be kept. Continue?', async () => {
                      try {
                        await matchesApi.resetKnockout(tournamentId!, activeCategoryId);
                        await fetchBracket(activeCategoryId);
                        xAlert('Success', 'Knockout bracket reset. Go to Live Management to re-generate.');
                      } catch (err: any) {
                        xAlert('Error', err?.response?.data?.message ?? 'Failed to reset');
                      }
                    }, 'Reset');
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#EF4444', letterSpacing: 0.5 }}>Reset Knockout Bracket</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {activeTab === 'bracket' && (
            <>
              {knockout.length === 0 ? (
                <View style={s.center}>
                  <Text style={s.emptySub}>Knockout bracket not yet available.</Text>
                </View>
              ) : (
                <>
                  {(() => {
                    // Group knockout matches by round
                    const roundOrder: Record<string, number> = {
                      'round_of_32': 0, 'round_of_16': 1, 'quarterfinal': 2,
                      'semifinal': 3, 'final': 4, 'third_place': 5,
                    };
                    const roundLabels: Record<string, string> = {
                      'round_of_32': 'ROUND OF 32', 'round_of_16': 'ROUND OF 16',
                      'quarterfinal': 'QUARTERFINALS', 'semifinal': 'SEMIFINALS',
                      'final': 'FINAL', 'third_place': '3RD PLACE',
                    };
                    const grouped: Record<string, typeof knockout> = {};
                    for (const m of knockout) {
                      const r = m.round ?? 'other';
                      if (!grouped[r]) grouped[r] = [];
                      grouped[r].push(m);
                    }
                    const sortedRounds = Object.keys(grouped).sort(
                      (a, b) => (roundOrder[a] ?? 99) - (roundOrder[b] ?? 99)
                    );

                    // Build a map of matchNumber -> match for "Winner of Match X" references
                    const matchById: Record<string, typeof knockout[0]> = {};
                    for (const m of knockout) matchById[m.id] = m;

                    return sortedRounds.map((round) => (
                      <View key={round} style={s.koRoundSection}>
                        <View style={s.koRoundHeader}>
                          <Text style={s.koRoundHeaderText}>
                            {roundLabels[round] ?? round.toUpperCase().replace(/_/g, ' ')}
                          </Text>
                          <Text style={s.koRoundCount}>{grouped[round].length} match{grouped[round].length !== 1 ? 'es' : ''}</Text>
                        </View>
                        {grouped[round].map((match) => {
                          const teamA = match.teamAId
                            ? (teamNames[match.teamAId] ?? 'TBD')
                            : (match.dependsOnMatchA ? `Winner of M${matchById[match.dependsOnMatchA]?.matchNumber ?? '?'}` : 'TBD');
                          const teamB = match.teamBId
                            ? (teamNames[match.teamBId] ?? 'TBD')
                            : (match.dependsOnMatchB ? `Winner of M${matchById[match.dependsOnMatchB]?.matchNumber ?? '?'}` : 'TBD');
                          const isDone = match.status === 'completed' || match.status === 'walkover';
                          const scoreText = match.scores?.length > 0
                            ? match.scores.map((sc: any) => `${sc.teamAScore ?? 0}-${sc.teamBScore ?? 0}`).join(', ')
                            : null;

                          return (
                            <TouchableOpacity
                              key={match.id}
                              style={s.koMatchCard}
                              onPress={() => handleMatchPress(match.id)}
                              activeOpacity={0.75}
                            >
                              <View style={s.koMatchNumber}>
                                <Text style={s.koMatchNumberText}>M{match.matchNumber}</Text>
                              </View>
                              <View style={s.koMatchContent}>
                                <View style={s.koMatchTeams}>
                                  <View style={[
                                    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
                                    isDone && match.winnerId === match.teamAId && { backgroundColor: 'rgba(6,214,160,0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4 },
                                    isDone && match.winnerId && match.winnerId !== match.teamAId && { opacity: 0.4 },
                                  ]}>
                                    {isDone && match.winnerId === match.teamAId && (
                                      <Text style={{ fontSize: 12 }}>{'\uD83C\uDFC6'}</Text>
                                    )}
                                    <View style={{ flex: 1 }}>
                                      <TeamNameDisplay name={teamA} size="sm" />
                                    </View>
                                  </View>
                                  <Text style={s.koVs}>vs</Text>
                                  <View style={[
                                    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
                                    isDone && match.winnerId === match.teamBId && { backgroundColor: 'rgba(6,214,160,0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4 },
                                    isDone && match.winnerId && match.winnerId !== match.teamBId && { opacity: 0.4 },
                                  ]}>
                                    <View style={{ flex: 1 }}>
                                      <TeamNameDisplay name={teamB} size="sm" />
                                    </View>
                                    {isDone && match.winnerId === match.teamBId && (
                                      <Text style={{ fontSize: 12 }}>{'\uD83C\uDFC6'}</Text>
                                    )}
                                  </View>
                                </View>
                                {scoreText && <Text style={s.koScoreText}>{scoreText}</Text>}
                              </View>
                              <View style={[s.koStatusDot, { backgroundColor: isDone ? GREEN : match.status === 'in_progress' ? BLUE : GRAY }]} />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ));
                  })()}
                </>
              )}
            </>
          )}

          <View style={{ height: 140 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },

  // Header
  header: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 8,
    paddingBottom: 14,
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, marginHorizontal: 12 },
  headerTitle: { fontSize: 15, fontWeight: '800', color: WHITE, letterSpacing: 0.5 },
  headerSub: { fontSize: 11, fontWeight: '500', color: '#64748B', marginTop: 1 },

  // Category chips (inside navy header)
  catRow: { paddingTop: 10, gap: 8, flexDirection: 'row' as const },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#E2E8F0', borderWidth: 1, borderColor: '#E2E8F0',
  },
  catChipActive: { backgroundColor: WHITE, borderColor: WHITE },
  catChipText: { fontSize: 12, fontWeight: '700', color: '#475569', letterSpacing: 0.3 },
  catChipTextActive: { color: NAVY },

  // Tab bar
  tabBar: {
    flexDirection: 'row', backgroundColor: 'transparent', paddingHorizontal: 16,
    paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: '#F5F7FA',
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  tabBtnActive: { backgroundColor: BLUE },
  tabText: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 1.5 },
  tabTextActive: { color: WHITE },

  // Center / empty
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#1A1D21', letterSpacing: 1.5, marginBottom: 8 },
  emptySub: { fontSize: 13, fontWeight: '500', color: '#64748B', textAlign: 'center', lineHeight: 20 },

  // Generate button
  generateBtn: {
    backgroundColor: '#E2E8F0', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 16, marginHorizontal: 4,
    borderWidth: 1, borderColor: '#CBD5E1',
  },
  generateBtnText: { fontSize: 12, fontWeight: '800', color: WHITE, letterSpacing: 1.5 },

  // Scroll
  scroll: { padding: 16 },

  // Pool card
  poolCard: {
    backgroundColor: '#F5F7FA', borderRadius: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#F5F7FA',
    overflow: 'hidden',
  },
  poolHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: NAVY, paddingHorizontal: 16, paddingVertical: 12,
  },
  poolBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  poolBadgeText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  poolTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1.5 },
  poolCount: { fontSize: 11, fontWeight: '600', color: '#64748B' },

  // Table
  table: { paddingHorizontal: 12, paddingTop: 8 },
  tableHeader: {
    flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#F5F7FA',
  },
  th: {
    width: 36, textAlign: 'center', fontSize: 9, fontWeight: '800',
    color: '#64748B', letterSpacing: 1,
  },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  tableRowAlt: { backgroundColor: '#F9FAFB' },
  rankNum: { fontSize: 12, fontWeight: '800', color: '#64748B', width: 18, textAlign: 'center' },
  teamName: { fontSize: 13, fontWeight: '700', color: '#1A1D21', flex: 1 },
  td: { width: 36, textAlign: 'center', fontSize: 13, fontWeight: '600', color: '#1A1D21' },

  // Matches
  matchesSection: { padding: 12, borderTopWidth: 1, borderTopColor: '#F5F7FA' },
  matchesLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 2, marginBottom: 8 },

  matchCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F7FA', borderRadius: 10, padding: 12, marginBottom: 6,
  },
  matchStatusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  matchContent: { flex: 1 },
  matchTeams: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  matchTeamName: { fontSize: 13, fontWeight: '600', color: '#1A1D21', flex: 1 },
  matchWinner: { fontWeight: '900', color: GREEN },
  matchVs: { fontSize: 10, fontWeight: '700', color: '#64748B', marginHorizontal: 4 },
  matchScoreText: { fontSize: 11, fontWeight: '700', color: BLUE, marginTop: 4 },

  scoreBtn: {
    backgroundColor: BLUE, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 7, marginLeft: 8,
  },
  scoreBtnDone: { backgroundColor: GREEN + '22' },
  scoreBtnText: { fontSize: 10, fontWeight: '800', color: WHITE, letterSpacing: 1 },
  scoreBtnTextDone: { color: GREEN },

  // Knockout bracket styles
  koRoundSection: { marginBottom: 20 },
  koRoundHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: NAVY, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8,
  },
  koRoundHeaderText: {
    color: WHITE, fontSize: 12, fontWeight: '800', letterSpacing: 1.5,
  },
  koRoundCount: {
    color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600',
  },
  koMatchCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F7FA', borderRadius: 10,
    padding: 12, marginBottom: 6,
  },
  koMatchNumber: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  koMatchNumberText: {
    color: '#64748B', fontSize: 10, fontWeight: '800',
  },
  koMatchContent: { flex: 1 },
  koMatchTeams: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  koVs: { fontSize: 10, fontWeight: '700', color: '#64748B', marginHorizontal: 4 },
  koScoreText: { fontSize: 11, fontWeight: '700', color: BLUE, marginTop: 4 },
  koStatusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
});
