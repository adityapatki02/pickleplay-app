import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { tournamentsApi } from '../api/tournaments.api';
import { Tournament, TournamentCategory } from '../types/tournament.types';
import TournamentTile from '../components/ui/TournamentTile';
import TournamentCarousel from '../components/ui/TournamentCarousel';
import { light } from '../config/lightTheme';

// ─── Design tokens ────────────────────────────────────────────────────────────
const NAVY = '#001E40';
const BLUE_ACCENT = '#2196F3';
const TEXT_PRIMARY = '#1A1D21';
const TEXT_SECONDARY = '#64748B';
const TEXT_TERTIARY = '#94A3B8';
const CARD_BORDER = '#E2E8F0';
const CARD_BG = '#FFFFFF';
const DIVIDER = '#E2E8F0';

// ─── Filter definitions ───────────────────────────────────────────────────────
const FILTERS = [
  { label: 'ALL',           value: 'all' },
  { label: 'OPEN',          value: 'open' },
  { label: 'NEARBY',        value: 'nearby' },
  { label: 'FREE',          value: 'free' },
  { label: 'CLOSING SOON',  value: 'closing' },
  { label: 'DOUBLES',       value: 'doubles' },
  { label: 'SINGLES',       value: 'singles' },
];

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft:               { color: '#F59E0B', label: 'DRAFT' },
  published:           { color: BLUE_ACCENT, label: 'PUBLISHED' },
  registration_open:   { color: '#22C55E', label: 'REG. OPEN' },
  registration_closed: { color: '#F59E0B', label: 'REG. CLOSED' },
  in_progress:         { color: '#EF4444', label: '● LIVE' },
  completed:           { color: '#6B7280', label: 'COMPLETED' },
  cancelled:           { color: '#9CA3AF', label: 'CANCELLED' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: string): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function minFee(categories?: TournamentCategory[]): number {
  if (!categories?.length) return 0;
  return Math.min(...categories.map((c) => c.entryFee ?? 0));
}

function spotsInfo(categories?: TournamentCategory[]): { registered: number; total: number } {
  if (!categories?.length) return { registered: 0, total: 0 };
  const registered = categories.reduce((s, c) => s + (c.registeredTeams ?? 0), 0);
  const total = categories.reduce((s, c) => s + (c.maxTeams ?? 0), 0);
  return { registered, total };
}

function categoryFormats(categories?: TournamentCategory[]): string[] {
  if (!categories?.length) return [];
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const c of categories) {
    const key = `${c.gender}_${c.format}`;
    if (!seen.has(key)) {
      seen.add(key);
      const g = c.gender === 'male' ? "MEN'S" : c.gender === 'female' ? "WOMEN'S" : c.gender === 'mixed' ? 'MIXED' : 'OPEN';
      const f = c.format === 'singles' ? 'SINGLES' : 'DOUBLES';
      labels.push(`${g} ${f}`);
    }
  }
  return labels;
}

function skillRange(categories?: TournamentCategory[]): string {
  if (!categories?.length) return '';
  const mins = categories.filter((c) => c.minRating != null).map((c) => c.minRating!);
  const maxs = categories.filter((c) => c.maxRating != null).map((c) => c.maxRating!);
  if (!mins.length && !maxs.length) return 'ALL LEVELS';
  const lo = mins.length ? Math.min(...mins) : null;
  const hi = maxs.length ? Math.max(...maxs) : null;
  if (lo != null && hi != null) return `${lo}–${hi}`;
  if (lo != null) return `${lo}+`;
  if (hi != null) return `≤${hi}`;
  return 'ALL LEVELS';
}

function clientFilter(t: Tournament, filter: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q) {
    const match =
      t.name.toLowerCase().includes(q) ||
      t.city.toLowerCase().includes(q) ||
      t.venueName?.toLowerCase().includes(q);
    if (!match) return false;
  }
  if (filter === 'all') return true;
  if (filter === 'open') return t.status === 'registration_open';
  if (filter === 'free') return minFee(t.categories) === 0;
  if (filter === 'closing') {
    if (!t.registrationDeadline) return false;
    const diff = new Date(t.registrationDeadline).getTime() - Date.now();
    return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000; // within 3 days
  }
  if (filter === 'doubles') return t.categories?.some((c) => c.format === 'doubles') ?? false;
  if (filter === 'singles') return t.categories?.some((c) => c.format === 'singles') ?? false;
  if (filter === 'nearby') return true; // would use geolocation; show all for now
  return true;
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonBar} />
      <View style={styles.skeletonContent}>
        <View style={[styles.skeletonLine, { width: '70%', height: 16, marginBottom: 10 }]} />
        <View style={[styles.skeletonLine, { width: '50%', height: 11, marginBottom: 8 }]} />
        <View style={[styles.skeletonLine, { width: '90%', height: 11, marginBottom: 8 }]} />
        <View style={[styles.skeletonLine, { width: '40%', height: 11 }]} />
      </View>
    </View>
  );
}

// ─── Tournament card ──────────────────────────────────────────────────────────
function TournamentCard({ item, onPress }: { item: Tournament; onPress: () => void }) {
  const cfg = STATUS_CONFIG[item.status] ?? { color: '#6B7280', label: item.status.toUpperCase() };
  const fee = minFee(item.categories);
  const { registered, total } = spotsInfo(item.categories);
  const formats = categoryFormats(item.categories);
  const skill = skillRange(item.categories);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.82}>
      {/* Left accent bar colored by status */}
      <View style={[styles.cardAccent, { backgroundColor: cfg.color }]} />

      <View style={styles.cardBody}>
        {/* Top row: name + status pill */}
        <View style={styles.cardTopRow}>
          <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
          <View style={[styles.statusPill, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '50' }]}>
            <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Date + City */}
        <View style={styles.cardMetaRow}>
          <Text style={styles.cardMeta}>📅 {fmtDate(item.startDate)} – {fmtDate(item.endDate)}</Text>
          <Text style={styles.cardMeta}>  📍 {item.city}</Text>
        </View>

        {/* Format chips */}
        {formats.length > 0 && (
          <View style={styles.formatRow}>
            {formats.map((f) => (
              <View key={f} style={styles.formatPill}>
                <Text style={styles.formatPillText}>{f}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Fee + Spots */}
        <View style={styles.cardInfoRow}>
          <Text style={styles.feeText}>
            {fee === 0 ? 'FREE ENTRY' : `FROM ₹${fee}`}
          </Text>
          {total > 0 && (
            <Text style={styles.spotsText}>
              {total - registered}/{total} SPOTS LEFT
            </Text>
          )}
        </View>

        {/* Footer: skill + CTA */}
        <View style={styles.cardFooter}>
          <View style={styles.skillTag}>
            <Text style={styles.skillTagText}>{skill}</Text>
          </View>
          <TouchableOpacity style={styles.registerBtn} onPress={onPress} activeOpacity={0.85}>
            <Text style={styles.registerBtnText}>VIEW & REGISTER →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Compact row (list/table style) ──────────────────────────────────────────
function CompactTournamentRow({
  tournament,
  onPress,
}: {
  tournament: Tournament;
  onPress: () => void;
}) {
  const cfg = STATUS_CONFIG[tournament.status] ?? STATUS_CONFIG.published;
  const { registered, total } = spotsInfo(tournament.categories);
  const fee = minFee(tournament.categories);
  return (
    <TouchableOpacity
      style={styles.compactRow}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.compactAccentBar, { backgroundColor: cfg.color }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.compactTopRow}>
          <Text style={styles.compactRowName} numberOfLines={1}>
            {tournament.name}
          </Text>
          <View style={[styles.compactRowBadge, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '40' }]}>
            <Text style={[styles.compactRowBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <View style={styles.compactMetaRow}>
          <Text style={styles.compactMetaIcon}>📅</Text>
          <Text style={styles.compactMetaText} numberOfLines={1}>
            {fmtDate(tournament.startDate)}
          </Text>
        </View>
        <View style={styles.compactMetaRow}>
          <Text style={styles.compactMetaIcon}>📍</Text>
          <Text style={styles.compactMetaText} numberOfLines={1}>
            {tournament.city}{tournament.state ? `, ${tournament.state}` : ''}
          </Text>
        </View>
        <View style={styles.compactMetaRow}>
          <Text style={styles.compactMetaIcon}>💰</Text>
          <Text style={styles.compactMetaText}>
            <Text style={styles.compactHighlight}>
              {fee === 0 ? 'FREE' : `₹${fee}`}
            </Text>
            {total > 0 ? `   ·   ${total - registered}/${total} spots left` : ''}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const navigation = useNavigation<any>();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [query, setQuery] = useState('');

  const fetchTournaments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await tournamentsApi.discover();
      const data = res.data?.data ?? [];
      setTournaments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to load tournaments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchTournaments(); }, [fetchTournaments]);

  const filtered = tournaments.filter((t) => clientFilter(t, activeFilter, query));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>DISCOVER</Text>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search tournaments, cities..."
            placeholderTextColor={TEXT_TERTIARY}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* ── FILTER CHIPS ── */}
      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTERS.map((f) => {
            const active = activeFilter === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setActiveFilter(f.value)}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── CONTENT ── */}
      {loading ? (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 160 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchTournaments(true)}
              tintColor={BLUE_ACCENT}
              colors={[BLUE_ACCENT]}
            />
          }
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🏆</Text>
              <Text style={styles.emptyTitle}>NO TOURNAMENTS FOUND</Text>
              <Text style={styles.emptySub}>
                {query || activeFilter !== 'all'
                  ? 'Try adjusting your filters or search.'
                  : 'Check back soon for tournaments near you.'}
              </Text>
              {(query || activeFilter !== 'all') && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => { setQuery(''); setActiveFilter('all'); }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.clearBtnText}>CLEAR FILTERS</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {/* Top 5 tournaments as a Hotstar-style stacked carousel */}
              <View style={{ marginTop: 8, marginBottom: 4 }}>
                <TournamentCarousel
                  tournaments={filtered.slice(0, 5)}
                  onPress={(t) =>
                    navigation.navigate('TournamentDetail', { tournamentId: t.id })
                  }
                />
              </View>

              {/* Full compact list of all filtered tournaments */}
              <View style={styles.compactListSection}>
                <View style={styles.compactListHeader}>
                  <Text style={styles.compactListHeaderText}>ALL TOURNAMENTS</Text>
                  <Text style={styles.compactListHeaderCount}>
                    {filtered.length} total
                  </Text>
                </View>
                {filtered.map((t) => (
                  <CompactTournamentRow
                    key={t.id}
                    tournament={t}
                    onPress={() =>
                      navigation.navigate('TournamentDetail', { tournamentId: t.id })
                    }
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Header
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 16 : 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '900',
    fontStyle: 'italic',
    color: NAVY,
    letterSpacing: -1,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontWeight: '500',
    paddingVertical: 0,
  },

  // Filters
  filterWrapper: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 12,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: CARD_BORDER,
    backgroundColor: '#F5F7FA',
  },
  filterChipActive: {
    backgroundColor: NAVY,
    borderColor: NAVY,
  },
  filterChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: TEXT_SECONDARY,
    letterSpacing: 0.6,
  },
  filterChipTextActive: { color: '#FFFFFF' },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 160,
    gap: 12,
  },
  listContentEmpty: { flexGrow: 1 },

  // Card
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardAccent: {
    width: 5,
  },
  cardBody: {
    flex: 1,
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  cardName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.4,
    lineHeight: 20,
  },
  statusPill: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  cardMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  cardMeta: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },
  formatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  formatPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: BLUE_ACCENT + '50',
    backgroundColor: BLUE_ACCENT + '0E',
  },
  formatPillText: {
    fontSize: 8,
    fontWeight: '800',
    color: BLUE_ACCENT,
    letterSpacing: 0.5,
  },
  cardInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  feeText: {
    fontSize: 12,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  spotsText: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_SECONDARY,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: DIVIDER,
  },
  skillTag: {
    backgroundColor: '#F5F7FA',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  skillTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    letterSpacing: 0.5,
  },
  registerBtn: {
    backgroundColor: BLUE_ACCENT,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  registerBtnText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },

  // Skeleton
  skeletonCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  skeletonBar: {
    width: 5,
    backgroundColor: '#F0F2F5',
  },
  skeletonContent: {
    flex: 1,
    padding: 14,
  },
  skeletonLine: {
    backgroundColor: '#F0F2F5',
    borderRadius: 4,
  },

  // Empty
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '900',
    fontStyle: 'italic',
    color: TEXT_PRIMARY,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  clearBtn: {
    borderWidth: 1.5,
    borderColor: CARD_BORDER,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 999,
  },
  clearBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: TEXT_PRIMARY,
    letterSpacing: 1,
  },

  // Compact tournament list (same theme as draws brackets)
  compactListSection: {
    marginTop: 16,
    paddingHorizontal: 20,
  },
  compactListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  compactListHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    color: TEXT_SECONDARY,
    letterSpacing: 1.8,
  },
  compactListHeaderCount: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_TERTIARY,
    letterSpacing: 0.8,
  },
  compactRow: {
    flexDirection: 'row',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    paddingVertical: 14,
    paddingRight: 14,
    paddingLeft: 0,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
  },
  compactAccentBar: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 12,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  compactTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  compactRowName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    color: TEXT_PRIMARY,
    letterSpacing: -0.2,
  },
  compactMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  compactMetaIcon: {
    fontSize: 11,
    width: 16,
  },
  compactMetaText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  compactHighlight: {
    fontWeight: '900',
    color: NAVY,
  },
  compactRowBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  compactRowBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
