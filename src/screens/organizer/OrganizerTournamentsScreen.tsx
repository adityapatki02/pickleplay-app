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
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { tournamentsApi } from '../../api/tournaments.api';
import { TournamentCard } from '../../components/tournament/TournamentCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tournament, TournamentStatus } from '../../types/tournament.types';
import { colors, spacing, typography, borderRadius, shadows } from '../../config/theme';
import { OrgTournamentsStackParamList } from '../../navigation/types';

const NAVY = '#001E40';

type NavProp = NativeStackNavigationProp<OrgTournamentsStackParamList, 'OrgTournaments'>;

const FILTER_OPTIONS: { label: string; value: string }[] = [
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

function matchesFilter(t: Tournament, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'draft') return t.status === 'draft';
  if (filter === 'completed') return t.status === 'completed';
  if (filter === 'active') return ACTIVE_STATUSES.includes(t.status);
  return true;
}

export default function OrganizerTournamentsScreen() {
  const navigation = useNavigation<NavProp>();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const fetchTournaments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await tournamentsApi.list();
      const data = res.data?.data ?? [];
      setTournaments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to load tournaments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  const filtered = tournaments.filter((t) => matchesFilter(t, activeFilter));

  const renderItem = ({ item }: { item: Tournament }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => (navigation as any).navigate('TournamentManage', { tournamentId: item.id })}
      activeOpacity={0.82}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardDate}>
            {item.startDate} – {item.endDate}
          </Text>
          <Text style={styles.cardVenue} numberOfLines={1}>
            {item.venueName}, {item.city}
          </Text>
        </View>
        <StatusBadge status={item.status} size="sm" />
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.cardReg}>
          {(item as any).registrationCount ?? item.categories?.reduce((s, c) => s + (c.registeredTeams ?? 0), 0) ?? 0} registrations
        </Text>
        <Text style={styles.cardChevron}>›</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MY TOURNAMENTS</Text>
      </View>

      {/* Filter chips */}
      <View style={styles.filterBar}>
        {FILTER_OPTIONS.map((opt) => {
          const active = activeFilter === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setActiveFilter(opt.value)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={NAVY} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            filtered.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchTournaments(true)}
              tintColor={NAVY}
              colors={[NAVY]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="🏆"
              title="No tournaments yet"
              subtitle="Create your first one."
            />
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => (navigation as any).navigate('CreateTournament')}
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
    backgroundColor: NAVY,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainerLowest,
    ...shadows.sm,
  },
  filterChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHigh,
  },
  filterChipActive: {
    backgroundColor: NAVY,
  },
  filterChipText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: 100,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: typography.fontSize.base,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  cardDate: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 1,
  },
  cardVenue: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  cardReg: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  cardChevron: {
    fontSize: typography.fontSize.xl,
    color: colors.textTertiary,
    fontWeight: '300',
  },
  fab: {
    position: 'absolute',
    bottom: spacing['2xl'],
    right: spacing['2xl'],
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  fabIcon: {
    fontSize: 28,
    color: '#FFFFFF',
    lineHeight: 32,
    fontWeight: '300',
  },
});
