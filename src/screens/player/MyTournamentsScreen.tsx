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
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MyMatchesStackParamList } from '../../navigation/types';
import { colors, typography, spacing, borderRadius, shadows } from '../../config/theme';
import { registrationsApi } from '../../api/registrations.api';
import { TournamentCard } from '../../components/tournament/TournamentCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { Tournament, TournamentStatus } from '../../types/tournament.types';

type Props = NativeStackScreenProps<MyMatchesStackParamList, 'MyTournaments'>;

type TabKey = 'upcoming' | 'in_progress' | 'past';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'upcoming', label: 'UPCOMING' },
  { key: 'in_progress', label: 'IN PROGRESS' },
  { key: 'past', label: 'PAST' },
];

const UPCOMING_STATUSES: TournamentStatus[] = [
  'draft',
  'published',
  'registration_open',
  'registration_closed',
];
const IN_PROGRESS_STATUSES: TournamentStatus[] = ['in_progress'];
const PAST_STATUSES: TournamentStatus[] = ['completed', 'cancelled'];

function groupTournaments(registrations: any[]): Record<TabKey, Tournament[]> {
  const upcoming: Tournament[] = [];
  const in_progress: Tournament[] = [];
  const past: Tournament[] = [];

  for (const reg of registrations) {
    const tournament: Tournament = reg.tournament ?? reg;
    if (!tournament?.id) continue;
    const status = tournament.status as TournamentStatus;
    if (IN_PROGRESS_STATUSES.includes(status)) {
      in_progress.push(tournament);
    } else if (PAST_STATUSES.includes(status)) {
      past.push(tournament);
    } else if (UPCOMING_STATUSES.includes(status)) {
      upcoming.push(tournament);
    }
  }

  return { upcoming, in_progress, past };
}

export default function MyTournamentsScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('upcoming');
  const [grouped, setGrouped] = useState<Record<TabKey, Tournament[]>>({
    upcoming: [],
    in_progress: [],
    past: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRegistrations = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await registrationsApi.getMyRegistrations();
      const data: any[] = response.data?.data ?? response.data ?? [];
      setGrouped(groupTournaments(data));
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? err?.message ?? 'Failed to load your tournaments.';
      setError(msg);
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const currentList = grouped[activeTab];

  const renderItem = ({ item }: { item: Tournament }) => (
    <TournamentCard
      tournament={item}
      onPress={() =>
        navigation.navigate('Schedule', { tournamentId: item.id })
      }
      showStatus
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MY TOURNAMENTS</Text>
        <Text style={styles.headerSubtitle}>Track your registrations</Text>
      </View>

      {/* Tab toggle */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabButton,
              activeTab === tab.key && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.key && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
            {grouped[tab.key].length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{grouped[tab.key].length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={currentList}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            currentList.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchRegistrations(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={activeTab === 'past' ? '📋' : '🏓'}
              title={
                activeTab === 'upcoming'
                  ? 'No upcoming tournaments'
                  : activeTab === 'in_progress'
                  ? 'No tournaments in progress'
                  : 'No past tournaments'
              }
              subtitle={
                activeTab === 'upcoming'
                  ? 'Discover and register for tournaments to see them here.'
                  : activeTab === 'in_progress'
                  ? 'Your active tournament matches will appear here.'
                  : 'Your completed tournament history will appear here.'
              }
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
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '900',
    fontStyle: 'italic',
    color: colors.textInverse,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.primaryFixedDim,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    ...shadows.sm,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.DEFAULT,
    gap: 4,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tabLabelActive: {
    color: colors.textInverse,
  },
  tabBadge: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: borderRadius.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing['2xl'],
  },
  listContentEmpty: {
    flexGrow: 1,
  },
});
