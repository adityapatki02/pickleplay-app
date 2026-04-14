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
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { tournamentsApi } from '../../api/tournaments.api';
import { Tournament, TournamentStatus } from '../../types/tournament.types';
import { spacing, borderRadius } from '../../config/theme';
import { OrgTournamentsStackParamList } from '../../navigation/types';

const NAVY = '#001E40';
const NAVY_MID = '#002E5F';
const BLUE_ACCENT = '#2196F3';
const BG = '#F3F4F5';
const { width: SW } = Dimensions.get('window');

type NavProp = NativeStackNavigationProp<OrgTournamentsStackParamList, 'OrgTournaments'>;

const FILTERS = [
  { label: 'ALL', value: 'all' },
  { label: 'DRAFT', value: 'draft' },
  { label: 'ACTIVE', value: 'active' },
  { label: 'COMPLETED', value: 'completed' },
];

const ACTIVE_STATUSES: TournamentStatus[] = [
  'published', 'registration_open', 'registration_closed', 'in_progress',
];

function matchesFilter(t: Tournament, f: string) {
  if (f === 'all') return true;
  if (f === 'draft') return t.status === 'draft';
  if (f === 'completed') return t.status === 'completed';
  if (f === 'active') return ACTIVE_STATUSES.includes(t.status);
  return true;
}

function fmtDate(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft:               { color: '#F59E0B', label: 'DRAFT' },
  published:           { color: BLUE_ACCENT, label: 'PUBLISHED' },
  registration_open:   { color: '#22C55E', label: 'REG. OPEN' },
  registration_closed: { color: '#F59E0B', label: 'REG. CLOSED' },
  in_progress:         { color: '#EF4444', label: '● LIVE' },
  completed:           { color: '#6B7280', label: 'DONE' },
};

export default function OrganizerTournamentsScreen() {
  const navigation = useNavigation<NavProp>();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const fetchTournaments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await tournamentsApi.list();
      const data = res.data?.data ?? [];
      setTournaments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to load tournaments');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchTournaments(); }, [fetchTournaments]);

  const filtered = tournaments.filter((t) => matchesFilter(t, activeFilter));
  const totalRegs = tournaments.reduce((s, t) =>
    s + ((t as any).registrationCount ?? t.categories?.reduce((x, c) => x + (c.registeredTeams ?? 0), 0) ?? 0), 0);
  const activeCount = tournaments.filter((t) => ACTIVE_STATUSES.includes(t.status)).length;
  const draftCount  = tournaments.filter((t) => t.status === 'draft').length;
  const filterCounts: Record<string, number> = {
    all: tournaments.length, draft: draftCount, active: activeCount,
    completed: tournaments.filter((t) => t.status === 'completed').length,
  };

  const renderItem = ({ item, index }: { item: Tournament; index: number }) => {
    const regCount = (item as any).registrationCount
      ?? item.categories?.reduce((s, c) => s + (c.registeredTeams ?? 0), 0) ?? 0;
    const cfg = STATUS_CONFIG[item.status] ?? { color: '#6B7280', label: item.status.toUpperCase() };
    const isLive = item.status === 'in_progress';

    return (
      <TouchableOpacity
        style={[styles.card, isLive && styles.cardLive]}
        onPress={() => (navigation as any).navigate('TournamentManage', { tournamentId: item.id })}
        activeOpacity={0.82}
      >
        {/* Index number */}
        <View style={[styles.cardIndex, { backgroundColor: isLive ? '#EF444415' : NAVY + '0A' }]}>
          <Text style={[styles.cardIndexText, { color: isLive ? '#EF4444' : NAVY }]}>
            {String(index + 1).padStart(2, '0')}
          </Text>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardRow}>
            <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
            <View style={[styles.statusPill, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '50' }]}>
              <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          <View style={styles.cardMeta}>
            <Text style={styles.metaChip}>📅 {fmtDate(item.startDate)} – {fmtDate(item.endDate)}</Text>
            <Text style={styles.metaChip}>📍 {item.city}</Text>
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.regRow}>
              <Text style={styles.regNum}>{regCount}</Text>
              <Text style={styles.regLabel}> REGISTERED</Text>
            </View>
            <Text style={styles.venueLine} numberOfLines={1}>{item.venueName}</Text>
          </View>
        </View>

        <View style={styles.cardArrow}>
          <Text style={styles.arrowText}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = (
    <View>
      {/* ─── FILTER TABS ─── */}
      <View style={styles.filterBar}>
        {FILTERS.map((opt) => {
          const active = activeFilter === opt.value;
          const count = filterCounts[opt.value] ?? 0;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setActiveFilter(opt.value)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{opt.label}</Text>
              <View style={[styles.filterBadge, active && styles.filterBadgeActive]}>
                <Text style={[styles.filterBadgeText, active && styles.filterBadgeTextActive]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>
        {filtered.length} TOURNAMENT{filtered.length !== 1 ? 'S' : ''}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* ─── HERO HEADER ─── */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.eyebrow}>ORGANIZER COMMAND CENTER</Text>
            <Text style={styles.heroTitle}>MY{'\n'}TOURNAMENTS</Text>
          </View>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => (navigation as any).navigate('CreateTournament')}
            activeOpacity={0.85}
          >
            <Text style={styles.createBtnText}>+ NEW</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{tournaments.length}</Text>
            <Text style={styles.statKey}>TOURNAMENTS</Text>
          </View>
          <View style={[styles.statCard, styles.statCardHighlight]}>
            <Text style={[styles.statValue, { color: BLUE_ACCENT }]}>{activeCount}</Text>
            <Text style={styles.statKey}>ACTIVE</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalRegs}</Text>
            <Text style={styles.statKey}>REGISTRATIONS</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>{draftCount}</Text>
            <Text style={styles.statKey}>DRAFTS</Text>
          </View>
        </View>
      </View>

      {/* ─── CONTENT ─── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={NAVY} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={[styles.list, filtered.length === 0 && styles.listEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchTournaments(true)} tintColor={NAVY} colors={[NAVY]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🏆</Text>
              <Text style={styles.emptyTitle}>NO TOURNAMENTS YET</Text>
              <Text style={styles.emptySub}>Tap + NEW to create your first tournament</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => (navigation as any).navigate('CreateTournament')}
              >
                <Text style={styles.emptyBtnText}>CREATE TOURNAMENT</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // ─── HERO ───
  hero: {
    backgroundColor: NAVY,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#FFFFFF',
    letterSpacing: -1,
    lineHeight: 36,
  },
  createBtn: {
    backgroundColor: BLUE_ACCENT,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginTop: 6,
  },
  createBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },

  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  statCardHighlight: {
    backgroundColor: 'rgba(33,150,243,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(33,150,243,0.25)',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 24,
  },
  statKey: {
    fontSize: 7,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.2,
    marginTop: 2,
    textAlign: 'center',
  },

  // ─── FILTER ───
  filterBar: {
    flexDirection: 'row',
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: '#FFFFFF',
    gap: 5,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: NAVY,
    borderColor: NAVY,
  },
  filterText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.8,
  },
  filterTextActive: { color: '#FFFFFF' },
  filterBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeActive: { backgroundColor: BLUE_ACCENT },
  filterBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6B7280',
  },
  filterBadgeTextActive: { color: '#FFFFFF' },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 2,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },

  // ─── LIST ───
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  listEmpty: { flexGrow: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ─── CARD ───
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardLive: {
    borderWidth: 1.5,
    borderColor: '#EF444430',
  },
  cardIndex: {
    width: 44,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIndexText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  cardContent: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingRight: spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 6,
  },
  cardName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: NAVY,
    letterSpacing: -0.3,
  },
  statusPill: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  metaChip: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
    paddingTop: 7,
  },
  regRow: { flexDirection: 'row', alignItems: 'baseline' },
  regNum: { fontSize: 18, fontWeight: '900', color: NAVY },
  regLabel: { fontSize: 8, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1 },
  venueLine: { fontSize: 10, color: '#9CA3AF', fontWeight: '500', maxWidth: SW * 0.3 },
  cardArrow: {
    paddingHorizontal: spacing.sm,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  arrowText: { fontSize: 22, color: '#D1D5DB' },

  // ─── EMPTY ───
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyIcon: { fontSize: 52, marginBottom: spacing.lg },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    fontStyle: 'italic',
    color: NAVY,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  emptySub: { fontSize: 13, color: '#9CA3AF', marginBottom: spacing.xl },
  emptyBtn: {
    backgroundColor: NAVY,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
  emptyBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
});
