import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Alert,
  SectionList,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MyMatchesStackParamList } from '../../navigation/types';
import { colors, typography, spacing, borderRadius, shadows } from '../../config/theme';
import { matchesApi } from '../../api/matches.api';
import { MatchCard } from '../../components/tournament/MatchCard';
import { EmptyState } from '../../components/ui/EmptyState';

type Props = NativeStackScreenProps<MyMatchesStackParamList, 'Schedule'>;

interface MatchData {
  id: string;
  round: number;
  matchNumber: number;
  status: string;
  teamAId: string | null;
  teamBId: string | null;
  winnerId: string | null;
  scheduledStart?: string | null;
  scores?: { teamA: number; teamB: number }[];
}

const SCHEDULED_STATUSES = ['scheduled', 'in_progress'];
const COMPLETED_STATUSES = ['completed', 'walkover', 'cancelled'];

interface MatchSection {
  title: string;
  data: MatchData[];
}

function buildSections(matches: MatchData[]): MatchSection[] {
  const upcoming: MatchData[] = [];
  const completed: MatchData[] = [];

  for (const m of matches) {
    if (COMPLETED_STATUSES.includes(m.status)) {
      completed.push(m);
    } else {
      upcoming.push(m);
    }
  }

  const sections: MatchSection[] = [];
  if (upcoming.length > 0) sections.push({ title: 'UPCOMING', data: upcoming });
  if (completed.length > 0) sections.push({ title: 'COMPLETED', data: completed });
  return sections;
}

export default function MatchScheduleScreen({ navigation, route }: Props) {
  const { tournamentId } = route.params;

  const [matches, setMatches] = useState<MatchData[]>([]);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMatches = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await matchesApi.getMyMatches(tournamentId);
      const data = response.data?.data ?? response.data ?? {};

      // Server may return { matches, teamNames } or just an array
      const matchList: MatchData[] = data.matches ?? data ?? [];
      const names: Record<string, string> = data.teamNames ?? {};

      // Normalise scores shape: API returns gameNumber/teamAScore/teamBScore
      const normalised = matchList.map((m: any) => ({
        ...m,
        round: typeof m.round === 'string' ? parseInt(m.round, 10) || 1 : m.round,
        scores: (m.scores ?? []).map((s: any) => ({
          teamA: s.teamAScore ?? s.teamA ?? 0,
          teamB: s.teamBScore ?? s.teamB ?? 0,
        })),
      }));

      setMatches(normalised);
      setTeamNames(names);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? err?.message ?? 'Failed to load matches.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const sections = buildSections(matches);

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
        <Text style={styles.navTitle}>MATCH SCHEDULE</Text>
        <View style={styles.navSpacer} />
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="📅"
            title="No matches yet"
            subtitle="Your matches in this tournament will appear here once the draw is generated."
          />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.matchItem}>
              <MatchCard
                match={item}
                teamNames={teamNames}
                onPress={() => {
                  // Navigate to bracket if categoryId is available
                  // For now navigate back to the tournament detail
                }}
              />
            </View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchMatches(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
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
    letterSpacing: 2,
  },
  navSpacer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  sectionTitle: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  matchItem: {
    paddingHorizontal: spacing.xl,
  },
  listContent: {
    paddingBottom: spacing['2xl'],
  },
});
