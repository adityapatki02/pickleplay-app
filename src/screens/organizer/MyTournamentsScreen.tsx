import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { tournamentsApi } from '../../api/tournaments.api';
import { TournamentCard } from '../../components/tournament/TournamentCard';
import { FilterChips } from '../../components/ui/FilterChips';
import { EmptyState } from '../../components/ui/EmptyState';
import { useTournamentStore } from '../../store/tournamentStore';
import { Tournament, TournamentStatus } from '../../types/tournament.types';
import { colors, spacing, typography, borderRadius, shadows } from '../../config/theme';
import { OrgTournamentsStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<OrgTournamentsStackParamList, 'OrgTournaments'>;

const FILTER_OPTIONS = [
  { label: 'ALL', value: 'all' },
  { label: 'DRAFT', value: 'draft' },
  { label: 'ACTIVE', value: 'active' },
  { label: 'COMPLETED', value: 'completed' },
];

const ACTIVE_STATUSES: TournamentStatus[] = [
  'published',
  'registration_open',
  'registration_closed',
  'in_progress',
];

function matchesFilter(tournament: Tournament, filter: string | null): boolean {
  if (!filter || filter === 'all') return true;
  if (filter === 'draft') return tournament.status === 'draft';
  if (filter === 'completed') return tournament.status === 'completed';
  if (filter === 'active') return ACTIVE_STATUSES.includes(tournament.status);
  return true;
}

export default function MyTournamentsScreen() {
  const navigation = useNavigation<NavProp>();
  const { tournaments, setTournaments, setLoading, isLoading } = useTournamentStore();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string | null>('all');

  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tournamentsApi.list();
      const data = res.data?.data ?? (res.data as any)?.tournaments ?? [];
      setTournaments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setTournaments]);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await tournamentsApi.list();
      const data = res.data?.data ?? (res.data as any)?.tournaments ?? [];
      setTournaments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  }, [setTournaments]);

  const handleCardPress = (tournament: Tournament) => {
    (navigation as any).navigate('TournamentManage', { tournamentId: tournament.id });
  };

  const handleCreatePress = () => {
    (navigation as any).navigate('CreateTournament');
  };

  const filtered = tournaments.filter((t) => matchesFilter(t, filter));

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surfaceContainerLow} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MY TOURNAMENTS</Text>
        <Text style={styles.headerSubtitle}>Manage your events</Text>
      </View>

      {/* Filter chips */}
      <FilterChips
        options={FILTER_OPTIONS}
        selected={filter}
        onSelect={setFilter}
      />

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          filtered.length === 0 && styles.listContentEmpty,
        ]}
        renderItem={({ item }) => (
          <TournamentCard
            tournament={item}
            onPress={() => handleCardPress(item)}
            showStatus
          />
        )}
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              icon="🏆"
              title="No tournaments yet."
              subtitle="Create your first tournament!"
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreatePress}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
  },
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.primary,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '800',
    color: colors.onPrimary,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.primaryFixedDim,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: 100,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  fab: {
    position: 'absolute',
    bottom: spacing['2xl'],
    right: spacing['2xl'],
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  fabIcon: {
    fontSize: 28,
    color: colors.onPrimary,
    lineHeight: 32,
    fontWeight: '300',
  },
});
