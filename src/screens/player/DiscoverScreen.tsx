import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DiscoverStackParamList } from '../../navigation/types';
import { colors, typography, spacing, borderRadius, shadows } from '../../config/theme';
import { tournamentsApi } from '../../api/tournaments.api';
import { useTournamentStore } from '../../store/tournamentStore';
import { TournamentCard } from '../../components/tournament/TournamentCard';
import { FilterChips } from '../../components/ui/FilterChips';
import { EmptyState } from '../../components/ui/EmptyState';
import { Tournament } from '../../types/tournament.types';

type Props = NativeStackScreenProps<DiscoverStackParamList, 'Discover'>;

const FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Singles', value: 'singles' },
  { label: 'Doubles', value: 'doubles' },
  { label: 'Registration Open', value: 'registration_open' },
];

export default function DiscoverScreen({ navigation }: Props) {
  const { discoveredTournaments, setDiscoveredTournaments } = useTournamentStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>('all');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTournaments = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params: Parameters<typeof tournamentsApi.discover>[0] = {};
      const response = await tournamentsApi.discover(params);
      setDiscoveredTournaments(response.data.data);
    } catch (err: any) {
      setError('Failed to load tournaments. Pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setDiscoveredTournaments]);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  // Client-side filtering based on active filter and search query
  const filteredTournaments: Tournament[] = discoveredTournaments.filter((t) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.venueName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (!activeFilter || activeFilter === 'all') return true;

    if (activeFilter === 'registration_open') {
      return t.status === 'registration_open';
    }

    if (activeFilter === 'singles' || activeFilter === 'doubles') {
      return t.categories?.some((c) => c.format === activeFilter) ?? false;
    }

    return true;
  });

  const handleFilterSelect = (value: string | null) => {
    setActiveFilter(value ?? 'all');
  };

  const renderItem = ({ item }: { item: Tournament }) => (
    <TournamentCard
      tournament={item}
      onPress={() => navigation.navigate('TournamentDetail', { tournamentId: item.id })}
      showStatus
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>DISCOVER</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search tournaments, cities, venues…"
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter chips */}
      <FilterChips
        options={FILTER_OPTIONS}
        selected={activeFilter}
        onSelect={handleFilterSelect}
      />

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredTournaments}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            filteredTournaments.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchTournaments(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="🏆"
              title="No tournaments found"
              subtitle={
                searchQuery || (activeFilter && activeFilter !== 'all')
                  ? 'Try adjusting your filters or search query.'
                  : 'Check back soon for upcoming tournaments in your area.'
              }
            />
          }
        />
      )}

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surfaceContainerLow,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xs,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text,
    fontWeight: '500',
    paddingVertical: 0,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing['2xl'],
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  errorBanner: {
    backgroundColor: colors.errorContainer,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.error,
    textAlign: 'center',
  },
});
