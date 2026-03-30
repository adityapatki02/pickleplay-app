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
import { Button } from '../../components/ui/Button';
import { BracketData, TournamentCategory } from '../../types/tournament.types';
import { colors, spacing, typography, borderRadius, shadows } from '../../config/theme';
import { OrgTournamentsStackParamList } from '../../navigation/types';

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

export default function BracketManageScreen() {
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
      // If 404, it means no draw generated yet — that's fine
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

  const handleCategorySwitch = (catId: string) => {
    setActiveCategoryId(catId);
  };

  const handleGenerateDraw = async () => {
    if (!tournamentId) return;
    Alert.alert(
      'Generate Draw',
      'This will generate the draw for this category. Confirmed registrations will be seeded. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            setGeneratingDraw(true);
            try {
              await matchesApi.generateDraw(tournamentId, activeCategoryId);
              await fetchBracket(activeCategoryId);
              Alert.alert('Success', 'Draw generated successfully!');
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

  const handleGenerateKnockout = async () => {
    if (!tournamentId) return;
    Alert.alert(
      'Generate Knockout Bracket',
      'Pool play is complete. Generate the knockout bracket now?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            setGeneratingKnockout(true);
            try {
              // Re-use generate-draw endpoint; backend handles pool → knockout transition
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

  const handleBracketMatchPress = (match: BracketMatchData) => {
    handleMatchPress(match.id);
  };

  // Derived
  const teamNames: Record<string, string> = {};
  if (bracketData?.teams) {
    for (const t of bracketData.teams) {
      teamNames[t.id] = t.name;
    }
  }

  const knockoutMatches: BracketMatchData[] =
    bracketData?.knockout?.map(normaliseBracketMatch) ?? [];

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
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* Nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backTouchable}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backIcon}>{'←'}</Text>
          <Text style={styles.backLabel}>BACK</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>
          {bracketData?.category?.name ?? 'BRACKET'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Category selector (if multiple) */}
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
                onPress={() => handleCategorySwitch(cat.id)}
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

      {/* Generate draw button (when no draw yet) */}
      {!loading && noDraw && (
        <View style={styles.generateSection}>
          <Button
            title={generatingDraw ? 'Generating…' : 'Generate Draw'}
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleGenerateDraw}
            disabled={generatingDraw}
          />
          <Text style={styles.generateHint}>
            Generates pools and initial bracket from confirmed registrations.
          </Text>
        </View>
      )}

      {/* Tab toggle (when draw exists) */}
      {!noDraw && (
        <View style={styles.tabBar}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabButton,
                activeTab === tab.key && styles.tabButtonActive,
                tab.disabled && styles.tabButtonDisabled,
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
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : noDraw ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            {tournamentId ? 'No draw generated yet.' : 'No bracket data available.'}
          </Text>
        </View>
      ) : activeTab === 'pools' ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {pools.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>No pool data available yet.</Text>
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

                const poolMatches = pool.matches ?? [];

                return (
                  <View key={pool.groupNumber}>
                    <PoolTable
                      groupNumber={pool.groupNumber}
                      teams={poolTeams}
                      advancingCount={bracketData?.category?.advancingPerGroup ?? 1}
                    />
                    {/* Pool matches with tap to score */}
                    {poolMatches.map((match) => (
                      <TouchableOpacity
                        key={match.id}
                        style={styles.matchRow}
                        onPress={() => handleMatchPress(match.id)}
                        activeOpacity={0.75}
                      >
                        <View style={styles.matchRowInner}>
                          <Text style={styles.matchTeamA}>
                            {teamNames[match.teamAId ?? ''] ?? 'TBD'}
                          </Text>
                          <View style={styles.matchCenter}>
                            <Text style={styles.matchVs}>vs</Text>
                            {match.scores?.length > 0 && (
                              <Text style={styles.matchScore}>
                                {match.scores.map((s) => `${s.teamAScore}-${s.teamBScore}`).join(', ')}
                              </Text>
                            )}
                          </View>
                          <Text style={styles.matchTeamB}>
                            {teamNames[match.teamBId ?? ''] ?? 'TBD'}
                          </Text>
                        </View>
                        <Text style={styles.enterScore}>SCORE ›</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}

              {/* Generate knockout button */}
              {poolsComplete && !hasBracket && (
                <View style={styles.generateKnockoutSection}>
                  <Button
                    title={generatingKnockout ? 'Generating…' : 'Generate Knockout Bracket'}
                    variant="primary"
                    size="lg"
                    fullWidth
                    onPress={handleGenerateKnockout}
                    disabled={generatingKnockout}
                  />
                </View>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        // Bracket tab
        <View style={styles.bracketContainer}>
          {knockoutMatches.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>Knockout bracket not yet available.</Text>
            </View>
          ) : (
            <BracketTree
              matches={knockoutMatches}
              teamNames={teamNames}
              onMatchPress={handleBracketMatchPress}
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
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
  },
  backTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  backIcon: {
    fontSize: typography.fontSize.lg,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  backLabel: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.onPrimary,
    letterSpacing: 1.5,
  },
  navTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.onPrimary,
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
    backgroundColor: colors.primary,
  },
  catTabText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
  catTabTextActive: {
    color: colors.onPrimary,
  },
  generateSection: {
    padding: spacing.base,
    backgroundColor: colors.surfaceContainerLowest,
    ...shadows.sm,
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
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.DEFAULT,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabButtonDisabled: {
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
    color: colors.textInverse,
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
  matchRowInner: {
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
    color: colors.primary,
    marginTop: 2,
  },
  matchTeamB: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.text,
  },
  enterScore: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.secondary,
    letterSpacing: 0.5,
    marginLeft: spacing.sm,
  },
  generateKnockoutSection: {
    paddingTop: spacing.base,
    paddingBottom: spacing.md,
  },
});
