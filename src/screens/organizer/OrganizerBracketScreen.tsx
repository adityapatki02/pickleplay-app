import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { matchesApi } from '../../api/matches.api';
import { tournamentsApi } from '../../api/tournaments.api';
import { BracketTree, MatchData as BracketMatchData } from '../../components/tournament/BracketTree';
import { PoolTable, PoolTeam } from '../../components/tournament/PoolTable';
import { BracketData, TournamentCategory } from '../../types/tournament.types';
import { colors, spacing, typography, borderRadius, shadows } from '../../config/theme';
import { OrgTournamentsStackParamList } from '../../navigation/types';

const NAVY = '#001E40';
const BLUE_ACCENT = '#2196F3';

type NavProp = NativeStackNavigationProp<OrgTournamentsStackParamList, 'BracketManage'>;
type RouteType = RouteProp<OrgTournamentsStackParamList, 'BracketManage'>;

type TabKey = 'pools' | 'bracket';

function normaliseBracketMatch(m: any): BracketMatchData {
  return {
    id: m.id,
    round: typeof m.round === 'string' ? parseInt(m.round, 10) || 1 : (m.round ?? 1),
    matchNumber: m.matchNumber ?? 0,
    status: m.status ?? 'scheduled',
    teamAId: m.teamAId ?? null,
    teamBId: m.teamBId ?? null,
    winnerId: m.winnerId ?? null,
    scores: (m.scores ?? []).map((s: any) => ({
      teamA: s.teamAScore ?? s.teamA ?? 0,
      teamB: s.teamBScore ?? s.teamB ?? 0,
    })),
  };
}

function allPoolMatchesComplete(bracketData: BracketData): boolean {
  if (!bracketData.pools || bracketData.pools.length === 0) return false;
  return bracketData.pools.every((pool) =>
    pool.matches.every((m) => m.status === 'completed' || m.status === 'walkover')
  );
}

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
  const [generatingKnockout, setGeneratingKnockout] = useState(false);

  const fetchBracket = useCallback(async (catId: string) => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await matchesApi.getBracket(tournamentId, catId);
      const data: BracketData = res.data?.data ?? res.data;
      setBracketData(data);
    } catch (err: any) {
      if (err?.response?.status !== 404) {
        Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to load bracket');
      }
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
    } catch {
      // Non-critical
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchCategories();
    fetchBracket(activeCategoryId);
  }, [fetchCategories, fetchBracket, activeCategoryId]);

  const handleGenerateDraw = () => {
    if (!tournamentId) return;
    Alert.alert(
      'Generate Draw',
      'This will generate pools and matches for confirmed registrations. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'GENERATE',
          onPress: async () => {
            setGeneratingDraw(true);
            try {
              await matchesApi.generateDraw(tournamentId, activeCategoryId);
              await fetchBracket(activeCategoryId);
              Alert.alert('Success', 'Draw generated!');
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to generate draw');
            } finally {
              setGeneratingDraw(false);
            }
          },
        },
      ]
    );
  };

  const handleGenerateKnockout = () => {
    if (!tournamentId) return;
    Alert.alert(
      'Generate Knockout Bracket',
      'Pool play is complete. Generate the knockout bracket?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'GENERATE',
          onPress: async () => {
            setGeneratingKnockout(true);
            try {
              await matchesApi.generateDraw(tournamentId, activeCategoryId);
              await fetchBracket(activeCategoryId);
              Alert.alert('Success', 'Knockout bracket generated!');
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to generate knockout');
            } finally {
              setGeneratingKnockout(false);
            }
          },
        },
      ]
    );
  };

  const handleMatchPress = (matchId: string) => {
    (navigation as any).navigate('ScoreEntry', { matchId });
  };

  // Derived
  const teamNames: Record<string, string> = {};
  if (bracketData?.teams) {
    for (const t of bracketData.teams) {
      teamNames[t.id] = t.name;
    }
  }

  const knockoutMatches: BracketMatchData[] = bracketData?.knockout?.map(normaliseBracketMatch) ?? [];
  const pools = bracketData?.pools ?? [];
  const hasPools = pools.length > 0;
  const hasBracket = knockoutMatches.length > 0;
  const noDraw = !bracketData || (!hasPools && !hasBracket);
  const poolsComplete = bracketData ? allPoolMatchesComplete(bracketData) : false;

  const TABS: { key: TabKey; label: string; disabled: boolean }[] = [
    { key: 'pools', label: 'POOLS', disabled: !hasPools },
    { key: 'bracket', label: 'BRACKET', disabled: !hasBracket },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backIcon}>←</Text>
          <Text style={styles.backLabel}>BACK</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {bracketData?.category?.name?.toUpperCase() ?? 'BRACKET'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Category selector tabs (if multiple) */}
      {categories.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catSelectorContent}
          style={styles.catSelector}
        >
          {categories.map((cat) => {
            const active = cat.id === activeCategoryId;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catTab, active && styles.catTabActive]}
                onPress={() => setActiveCategoryId(cat.id)}
                activeOpacity={0.75}
              >
                <Text style={[styles.catTabText, active && styles.catTabTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Generate draw button (no draw yet) */}
      {!loading && noDraw && (
        <View style={styles.generateSection}>
          <TouchableOpacity
            style={[styles.generateBtn, generatingDraw && styles.generateBtnDisabled]}
            onPress={handleGenerateDraw}
            disabled={generatingDraw}
            activeOpacity={0.85}
          >
            {generatingDraw ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.generateBtnText}>GENERATE DRAW</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.generateHint}>
            Generates pools and initial bracket from confirmed registrations.
          </Text>
        </View>
      )}

      {/* Pools / Bracket tab bar */}
      {!noDraw && (
        <View style={styles.tabBar}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabBtn,
                activeTab === tab.key && styles.tabBtnActive,
                tab.disabled && styles.tabBtnDisabled,
              ]}
              onPress={() => !tab.disabled && setActiveTab(tab.key)}
              activeOpacity={tab.disabled ? 1 : 0.75}
            >
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === tab.key && styles.tabLabelActive,
                  tab.disabled && styles.tabLabelDisabled,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={NAVY} />
        </View>
      ) : noDraw ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No draw generated yet.</Text>
        </View>
      ) : activeTab === 'pools' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {pools.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>No pool data available.</Text>
            </View>
          ) : (
            <>
              {pools.map((pool) => {
                const poolTeams: PoolTeam[] = pool.teams.map((t) => ({
                  teamId: t.id,
                  teamName: t.name,
                  groupRank: t.groupRank,
                  wins: t.wins,
                  losses: t.losses,
                  pointsFor: t.pointsFor,
                  pointsAgainst: t.pointsAgainst,
                }));

                return (
                  <View key={pool.groupNumber}>
                    <PoolTable
                      groupNumber={pool.groupNumber}
                      teams={poolTeams}
                      advancingCount={bracketData?.category?.advancingPerGroup ?? 1}
                    />
                    {pool.matches?.map((match) => (
                      <TouchableOpacity
                        key={match.id}
                        style={styles.matchRow}
                        onPress={() => handleMatchPress(match.id)}
                        activeOpacity={0.75}
                      >
                        <View style={styles.matchInner}>
                          <Text style={styles.matchTeamA} numberOfLines={1}>
                            {teamNames[match.teamAId ?? ''] ?? 'TBD'}
                          </Text>
                          <View style={styles.matchCenter}>
                            <Text style={styles.matchVs}>vs</Text>
                            {match.scores?.length > 0 && (
                              <Text style={styles.matchScore}>
                                {match.scores.map((s: any) => `${s.teamAScore}-${s.teamBScore}`).join(', ')}
                              </Text>
                            )}
                          </View>
                          <Text style={styles.matchTeamB} numberOfLines={1}>
                            {teamNames[match.teamBId ?? ''] ?? 'TBD'}
                          </Text>
                        </View>
                        <Text style={styles.scoreLink}>SCORE ›</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}

              {/* Generate knockout button when pools are complete */}
              {poolsComplete && !hasBracket && (
                <View style={styles.generateKnockoutSection}>
                  <TouchableOpacity
                    style={[styles.generateBtn, generatingKnockout && styles.generateBtnDisabled]}
                    onPress={handleGenerateKnockout}
                    disabled={generatingKnockout}
                    activeOpacity={0.85}
                  >
                    {generatingKnockout ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.generateBtnText}>GENERATE KNOCKOUT BRACKET</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        <View style={styles.bracketContainer}>
          {knockoutMatches.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>Knockout bracket not yet available.</Text>
            </View>
          ) : (
            <BracketTree
              matches={knockoutMatches}
              teamNames={teamNames}
              onMatchPress={(match) => handleMatchPress(match.id)}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: NAVY,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  backIcon: {
    fontSize: typography.fontSize.lg,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  backLabel: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
    maxWidth: 160,
    textAlign: 'center',
  },
  catSelector: {
    backgroundColor: colors.surfaceContainerLowest,
    ...shadows.sm,
  },
  catSelectorContent: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  catTab: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHigh,
  },
  catTabActive: {
    backgroundColor: NAVY,
  },
  catTabText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
  catTabTextActive: {
    color: '#FFFFFF',
  },
  generateSection: {
    padding: spacing.base,
    backgroundColor: colors.surfaceContainerLowest,
    ...shadows.sm,
  },
  generateBtn: {
    backgroundColor: BLUE_ACCENT,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  generateBtnDisabled: {
    opacity: 0.6,
  },
  generateBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  generateHint: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    ...shadows.sm,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.DEFAULT,
  },
  tabBtnActive: {
    backgroundColor: NAVY,
  },
  tabBtnDisabled: {
    opacity: 0.4,
  },
  tabLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
  tabLabelDisabled: {
    color: colors.textTertiary,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing['2xl'],
  },
  bracketContainer: {
    flex: 1,
  },
  emptySection: {
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.xs,
    ...shadows.sm,
    justifyContent: 'space-between',
  },
  matchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  matchTeamA: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
  },
  matchCenter: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  matchVs: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  matchScore: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    color: NAVY,
    marginTop: 2,
  },
  matchTeamB: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.text,
  },
  scoreLink: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: BLUE_ACCENT,
    letterSpacing: 0.5,
    marginLeft: spacing.sm,
  },
  generateKnockoutSection: {
    paddingTop: spacing.base,
    paddingBottom: spacing.md,
  },
});
