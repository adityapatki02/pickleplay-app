import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  YColors,
  YDisplay,
  YEyebrow,
  YUiText,
  YTopBar,
  YChip,
  YBadge,
  YTournamentRow,
  YSectionHead,
  YButton,
} from '../../components/yoiden';
import { tournamentsApi } from '../../api/tournaments.api';
import type { Tournament } from '../../types/tournament.types';
import type { PlayStackParamList } from '../../navigation/YoidenTabNavigator';

type Nav = NativeStackNavigationProp<PlayStackParamList, 'Play'>;

type Filter = 'all' | 'open' | 'live' | 'upcoming' | 'finished';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all',      label: 'ALL' },
  { id: 'open',     label: 'OPEN' },
  { id: 'live',     label: 'LIVE' },
  { id: 'upcoming', label: 'UPCOMING' },
  { id: 'finished', label: 'FINISHED' },
];

const matchesFilter = (t: Tournament, f: Filter) => {
  if (f === 'all') return true;
  if (f === 'open')     return t.status === 'registration_open';
  if (f === 'live')     return t.status === 'in_progress';
  if (f === 'upcoming') return t.status === 'published' || t.status === 'registration_open' || t.status === 'registration_closed';
  if (f === 'finished') return t.status === 'completed';
  return true;
};

export default function PlayScreen() {
  const nav = useNavigation<Nav>();
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchTournaments = useCallback(async () => {
    try {
      setError(null);
      const res = await tournamentsApi.discover({ limit: 50 });
      const data = (res.data as any)?.data ?? (res.data as any) ?? [];
      setTournaments(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Could not load tournaments');
      setTournaments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTournaments();
  }, [fetchTournaments]);

  const filtered = useMemo(
    () => tournaments.filter((t) => matchesFilter(t, filter)),
    [tournaments, filter]
  );

  const featured = useMemo(
    () => tournaments.find((t) => t.isFeatured) || null,
    [tournaments]
  );

  const openDetail = (id: string) => nav.navigate('TournamentDetail', { tournamentId: id });
  const openCreate = () => nav.navigate('CreateTournament');

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={YColors.ink2}
          />
        }
      >
        <YTopBar
          eyebrow="WHAT'S NEXT"
          title="DISCOVER"
          action={
            <Pressable onPress={openCreate} style={styles.plusBtn} hitSlop={8}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M12 5v14M5 12h14" stroke={YColors.ink} strokeWidth={2.5} strokeLinecap="round" />
              </Svg>
            </Pressable>
          }
        />

        <TournamentsView
          tournaments={filtered}
          loading={loading}
          error={error}
          filter={filter}
          setFilter={setFilter}
          featured={featured}
          onOpenDetail={openDetail}
          onCreate={openCreate}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Tournaments subview ─────────────────────────────────────────
const TournamentsView: React.FC<{
  tournaments: Tournament[];
  loading: boolean;
  error: string | null;
  filter: Filter;
  setFilter: (f: Filter) => void;
  featured: Tournament | null;
  onOpenDetail: (id: string) => void;
  onCreate: () => void;
}> = ({ tournaments, loading, error, filter, setFilter, featured, onOpenDetail, onCreate }) => {
  return (
    <View>
      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {FILTERS.map((f) => (
          <View key={f.id} style={{ marginRight: 6 }}>
            <YChip active={filter === f.id} onPress={() => setFilter(f.id)}>
              {f.label}
            </YChip>
          </View>
        ))}
      </ScrollView>

      {/* Featured banner (only if API has a featured tournament) */}
      {featured ? (
        <FeaturedBanner
          tournament={featured}
          onPress={() => onOpenDetail(featured.id)}
        />
      ) : null}

      <YSectionHead
        eyebrow={`${tournaments.length} TOURNAMENT${tournaments.length === 1 ? '' : 'S'}`}
        title="NEARBY"
      />

      {/* List */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={YColors.ink2} /></View>
      ) : error ? (
        <ErrorBox message={error} />
      ) : tournaments.length === 0 ? (
        <EmptyState filter={filter} onCreate={onCreate} />
      ) : (
        <View style={styles.listWrap}>
          {tournaments.map((t) => (
            <YTournamentRow
              key={t.id}
              tournament={t as any}
              onPress={() => onOpenDetail(t.id)}
              style={{ marginBottom: 8 }}
            />
          ))}

          {/* Host CTA at the bottom */}
          <View style={{ marginTop: 16, alignItems: 'flex-start' }}>
            <YButton variant="ghost" size="md" onPress={onCreate}>
              + HOST A TOURNAMENT
            </YButton>
          </View>
        </View>
      )}
    </View>
  );
};

// ─── Featured banner ─────────────────────────────────────────────
const FeaturedBanner: React.FC<{ tournament: Tournament; onPress: () => void }> = ({
  tournament,
  onPress,
}) => {
  const date = tournament.startDate ? new Date(tournament.startDate) : null;
  const dateLabel = date && !Number.isNaN(date.getTime())
    ? `${date.toLocaleString('en', { month: 'short' }).toUpperCase()} ${date.getDate()} · ${tournament.city?.toUpperCase() || ''}`
    : tournament.city?.toUpperCase() || '';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.featured, { opacity: pressed ? 0.92 : 1 }]}>
      <View style={styles.featuredInner}>
        <View style={styles.featuredHeader}>
          <YBadge color="#fff" bg="#000">FEATURED</YBadge>
          {tournament.categories && tournament.categories.length > 0 ? (
            <YBadge color="#000" bg={YColors.lime}>
              {tournament.categories.length} CATEGORIES
            </YBadge>
          ) : null}
        </View>
        <YDisplay size={32} color="#fff" style={{ marginTop: 18, lineHeight: 30 }}>
          {tournament.name}
        </YDisplay>
        <YUiText size={11} weight={700} color="rgba(255,255,255,0.85)" style={styles.featuredMeta}>
          {dateLabel}
        </YUiText>
        <View style={styles.featuredFooter}>
          <YUiText size={11} weight={700} color="rgba(255,255,255,0.7)" style={{ letterSpacing: 1 }}>
            {tournament.venueName || ''}
          </YUiText>
          <YButton variant="lime" size="sm">REGISTER</YButton>
        </View>
      </View>
    </Pressable>
  );
};

// ─── Empty / error / book stub ───────────────────────────────────
const EmptyState: React.FC<{ filter: Filter; onCreate: () => void }> = ({ filter, onCreate }) => (
  <View style={styles.empty}>
    <YEyebrow color={YColors.ink3}>NO TOURNAMENTS</YEyebrow>
    <YDisplay size={26} style={{ marginTop: 8 }}>
      {filter === 'all' ? 'NOTHING YET' : 'NONE IN VIEW'}
    </YDisplay>
    <YUiText size={13} color={YColors.ink2} style={{ marginTop: 8, marginBottom: 16 }}>
      {filter === 'all'
        ? 'Be the first to host a tournament here.'
        : 'Try another filter, or host one yourself.'}
    </YUiText>
    <YButton variant="primary" size="md" onPress={onCreate}>
      HOST A TOURNAMENT
    </YButton>
  </View>
);

const ErrorBox: React.FC<{ message: string }> = ({ message }) => (
  <View style={styles.empty}>
    <YEyebrow color={YColors.live}>COULDN'T LOAD</YEyebrow>
    <YUiText size={13} color={YColors.ink2} style={{ marginTop: 8 }}>
      {message}
    </YUiText>
  </View>
);

// ─── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },
  plusBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: YColors.bg3,
    borderWidth: 1,
    borderColor: YColors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentWrap: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  segment: {
    backgroundColor: '#0A0A0B',
    borderRadius: 10,
    padding: 4,
    flexDirection: 'row',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#fff',
  },
  chipRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  listWrap: {
    paddingHorizontal: 16,
  },
  featured: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: YColors.accentDeep,
    minHeight: 200,
  },
  featuredInner: {
    padding: 18,
  },
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  featuredMeta: {
    letterSpacing: 1.4,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  featuredFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  center: {
    padding: 40,
    alignItems: 'center',
  },
  empty: {
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
});
