import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  Alert,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MyMatchesStackParamList } from '../../navigation/types';
import { colors, typography, spacing, borderRadius, shadows } from '../../config/theme';
import { matchesApi } from '../../api/matches.api';
import { BracketTree, MatchData as BracketMatchData } from '../../components/tournament/BracketTree';
import { PoolTable, PoolTeam } from '../../components/tournament/PoolTable';
import { BracketData } from '../../types/tournament.types';

type Props = NativeStackScreenProps<MyMatchesStackParamList, 'Bracket'>;

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

export default function BracketViewScreen({ navigation, route }: Props) {
  const { categoryId } = route.params;
  // Attempt to get tournamentId from route; fallback handled gracefully
  const tournamentId = (route.params as any).tournamentId as string | undefined;

  const [activeTab, setActiveTab] = useState<TabKey>('pools');
  const [bracketData, setBracketData] = useState<BracketData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBracket = useCallback(async () => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const response = await matchesApi.getBracket(tournamentId, categoryId);
      const data: BracketData = response.data?.data ?? response.data;
      setBracketData(data);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? err?.message ?? 'Failed to load bracket.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }, [tournamentId, categoryId]);

  useEffect(() => {
    fetchBracket();
  }, [fetchBracket]);

  // Build teamNames map from bracket data
  const teamNames: Record<string, string> = {};
  if (bracketData?.teams) {
    for (const t of bracketData.teams) {
      teamNames[t.id] = t.name;
    }
  }

  // Build knockout matches for BracketTree
  const knockoutMatches: BracketMatchData[] =
    bracketData?.knockout?.map(normaliseBracketMatch) ?? [];

  // Build pool data for PoolTable
  const pools = bracketData?.pools ?? [];

  const hasPools = pools.length > 0;
  const hasBracket = knockoutMatches.length > 0;

  const TABS: { key: TabKey; label: string; disabled: boolean }[] = [
    { key: 'pools', label: 'POOLS', disabled: !hasPools },
    { key: 'bracket', label: 'BRACKET', disabled: !hasBracket },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.navBackTouchable}
        >
          <Text style={styles.navBackIcon}>{'←'}</Text>
          <Text style={styles.navBackLabel}>BACK</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>
          {bracketData?.category?.name ?? 'BRACKET'}
        </Text>
        <View style={styles.navSpacer} />
      </View>

      {/* Tab toggle */}
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

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !bracketData ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>
            {tournamentId ? 'Draw has not been generated yet.' : 'No bracket data available.'}
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
            pools.map((pool) => {
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
                <PoolTable
                  key={pool.groupNumber}
                  groupNumber={pool.groupNumber}
                  teams={poolTeams}
                  advancingCount={bracketData.category?.advancingPerGroup ?? 1}
                />
              );
            })
          )}
        </ScrollView>
      ) : (
        // Bracket tab — horizontally scrollable
        <View style={styles.bracketContainer}>
          {knockoutMatches.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>Knockout bracket not yet available.</Text>
            </View>
          ) : (
            <BracketTree
              matches={knockoutMatches}
              teamNames={teamNames}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceContainerLowest,
    ...shadows.sm,
  },
  navBackTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  navBackIcon: {
    fontSize: typography.fontSize.lg,
    color: colors.primary,
    fontWeight: '700',
  },
  navBackLabel: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1.5,
  },
  navTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
    maxWidth: 160,
    textAlign: 'center',
  },
  navSpacer: {
    flex: 1,
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
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
});
