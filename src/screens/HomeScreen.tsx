import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getLeagues, getSeasons, getTies } from '../api/leagues.api';
import { useAuthStore } from '../store/authStore';
import type { League, Tie } from '../types/league.types';
import { light } from '../config/lightTheme';

// ─── Design tokens ──────────────────────────────────────────────────────────
const NAVY = '#001E40';
const BLUE_ACCENT = '#1858D6';
const RED = '#EF4444';
const GREEN = '#22C55E';
const TEXT_PRIMARY = '#1A1D21';
const TEXT_SECONDARY = '#64748B';
const TEXT_TERTIARY = '#94A3B8';
const CARD_BORDER = '#E2E8F0';
const CARD_BG = '#FFFFFF';
const DIVIDER = '#E2E8F0';

// ─── Helpers ────────────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'GOOD MORNING';
  if (h < 17) return 'GOOD AFTERNOON';
  return 'GOOD EVENING';
}

function getFirstName(fullName: string): string {
  return fullName.split(' ')[0].toUpperCase();
}

function fmtDate(d: string): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft:               { color: '#F59E0B', label: 'DRAFT' },
  published:           { color: BLUE_ACCENT, label: 'PUBLISHED' },
  registration_open:   { color: GREEN, label: 'REG. OPEN' },
  registration_closed: { color: '#F59E0B', label: 'REG. CLOSED' },
  in_progress:         { color: RED, label: '● LIVE' },
  completed:           { color: TEXT_TERTIARY, label: 'COMPLETED' },
  cancelled:           { color: TEXT_TERTIARY, label: 'CANCELLED' },
};

// ─── Banner images ──────────────────────────────────────────────────────────
const BANNER_IMAGES = [
  require('../../assets/banners/1.jpg'),
  require('../../assets/banners/2.jpg'),
  require('../../assets/banners/3.jpg'),
];
const SCREEN_WIDTH = Dimensions.get('window').width;
const BANNER_WIDTH = SCREEN_WIDTH - 32; // 16px padding each side
const BANNER_HEIGHT = 180;
const BANNER_GAP = 10;
const BANNER_SNAP = BANNER_WIDTH + BANNER_GAP;
const BANNER_AUTO_SCROLL = 4000;

function HeroBannerCarousel() {
  const flatRef = useRef<FlatList>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const count = BANNER_IMAGES.length;

  const startAuto = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current);
    autoRef.current = setInterval(() => {
      setActiveIdx((prev) => {
        const next = (prev + 1) % count;
        flatRef.current?.scrollToOffset({ offset: next * BANNER_SNAP, animated: true });
        return next;
      });
    }, BANNER_AUTO_SCROLL);
  }, [count]);

  useEffect(() => { startAuto(); return () => { if (autoRef.current) clearInterval(autoRef.current); }; }, [startAuto]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / BANNER_SNAP);
    if (idx !== activeIdx && idx >= 0 && idx < count) setActiveIdx(idx);
  };

  const onScrollBegin = () => { if (autoRef.current) clearInterval(autoRef.current); };
  const onScrollEnd = () => startAuto();

  return (
    <View style={bannerStyles.container}>
      <FlatList
        ref={flatRef}
        data={BANNER_IMAGES}
        horizontal
        pagingEnabled={false}
        snapToInterval={BANNER_SNAP}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBegin}
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
        keyExtractor={(_, i) => `banner-${i}`}
        renderItem={({ item }) => (
          <View style={bannerStyles.card}>
            <Image source={item} style={bannerStyles.image} resizeMode="cover" />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ width: BANNER_GAP }} />}
      />
      {/* Dots */}
      <View style={bannerStyles.dots}>
        {BANNER_IMAGES.map((_, i) => (
          <View key={i} style={[bannerStyles.dot, activeIdx === i && bannerStyles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  container: { marginBottom: 12 },
  card: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F5F7FA',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  dotActive: {
    width: 20,
    borderRadius: 3,
    backgroundColor: NAVY,
  },
});

// ─── Motivational quotes ────────────────────────────────────────────────────
const QUOTES = [
  'Life\'s better on the court.',
  'Eat. Sleep. Pickle. Repeat.',
  'Less talk. More dinks.',
  'Good vibes & great rallies.',
  'Dink responsibly.',
  'The net is just a suggestion.',
  'Keep calm and stay in the kitchen.',
  'Pickle is my cardio.',
  'Love at first dink.',
  'No bad days on the court.',
  'Built different. Built for pickle.',
  'Serving looks. And aces.',
];

function getDailyQuote(): string {
  const day = new Date().getDate() + new Date().getMonth() * 31;
  return QUOTES[day % QUOTES.length];
}

// ─── Live dot animation ──────────────────────────────────────────────────────
function PulsingDot() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);
  return (
    <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
  );
}

// ─── Fixture tile (for horizontal fixtures carousel) ────────────────────────
function FixtureTile({ tie, onPress }: { tie: Tie; onPress: () => void }) {
  const when = tie.scheduledStart ? new Date(tie.scheduledStart) : null;
  const dateLabel = when
    ? when.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).toUpperCase()
    : (tie.matchDay ? new Date(tie.matchDay).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).toUpperCase() : 'TBD');
  const timeLabel = when
    ? when.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    : '';
  const isLive = tie.status === 'in_progress';
  const isDone = tie.status === 'completed';

  const home = tie.homeTeam?.shortName || tie.homeTeam?.name || 'TBD';
  const away = tie.awayTeam?.shortName || tie.awayTeam?.name || 'TBD';

  return (
    <TouchableOpacity style={styles.fixtureTile} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.fixtureHeader}>
        <Text style={styles.fixtureDate}>{dateLabel}</Text>
        {isLive ? (
          <View style={styles.fixtureLiveBadge}>
            <PulsingDot />
            <Text style={styles.fixtureLiveText}>LIVE</Text>
          </View>
        ) : isDone ? (
          <View style={styles.fixtureDoneBadge}>
            <Text style={styles.fixtureDoneText}>DONE</Text>
          </View>
        ) : timeLabel ? (
          <Text style={styles.fixtureTime}>{timeLabel}</Text>
        ) : null}
      </View>

      <View style={styles.fixtureTeams}>
        <Text style={styles.fixtureTeam} numberOfLines={1}>{home}</Text>
        <Text style={styles.fixtureVs}>vs</Text>
        <Text style={styles.fixtureTeam} numberOfLines={1}>{away}</Text>
      </View>

      {isDone ? (
        <Text style={styles.fixtureScore}>{tie.homeScore} – {tie.awayScore}</Text>
      ) : (
        <Text style={styles.fixtureRound} numberOfLines={1}>
          {tie.round ? tie.round.replace(/_/g, ' ').toUpperCase() : 'FIXTURE'}
          {tie.courtNumber ? ` • COURT ${tie.courtNumber}` : ''}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();

  const [refreshing, setRefreshing] = useState(false);

  // League state — show ALL leagues the user organizes
  const [myLeagues, setMyLeagues] = useState<{ league: League; seasonId: string; seasonName: string; ties: Tie[]; status: string }[]>([]);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    // Fetch user's leagues — try with organizerId first, fall back to all
    let leagues = await getLeagues({ organizerId: user?.id }).catch(() => []);
    if (!Array.isArray(leagues) || leagues.length === 0) {
      leagues = await getLeagues().catch(() => []);
    }
    const list: League[] = Array.isArray(leagues) ? leagues : [];
    if (list.length === 0) {
      setMyLeagues([]);
      setRefreshing(false);
      return;
    }
    const enriched = await Promise.all(list.map(async (league: League) => {
      const seasons = await getSeasons(league.id).catch(() => []);
      const seasonList = Array.isArray(seasons) ? seasons : [];
      if (seasonList.length === 0) return { league, seasonId: '', seasonName: '', ties: [] as Tie[], status: 'setup' };
      const season = seasonList[0];
      const ties = await getTies(league.id, season.id).catch(() => [] as Tie[]);
      return { league, seasonId: season.id, seasonName: season.name, ties: Array.isArray(ties) ? ties : [], status: season.status };
    }));
    setMyLeagues(enriched);

    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Live polling: refresh ties every 5s while Home tab is focused.
  // Background fetch only — does NOT toggle the pull-to-refresh spinner.
  useFocusEffect(
    useCallback(() => {
      const id = setInterval(() => { fetchData(false); }, 30000);
      return () => clearInterval(id);
    }, [fetchData])
  );

  const firstName = user?.fullName ? getFirstName(user.fullName) : 'PLAYER';

  // Flatten all ties across leagues, keep only upcoming/live, sort earliest first, top 5
  const upcomingFixtures = myLeagues
    .flatMap((ml) => ml.ties.map((tie) => ({ tie, leagueId: ml.league.id, seasonId: ml.seasonId })))
    .filter(({ tie }) => tie.status !== 'completed' && (tie.status as string) !== 'cancelled')
    .sort((a, b) => {
      const aT = new Date(a.tie.scheduledStart || a.tie.matchDay || 0).getTime();
      const bT = new Date(b.tie.scheduledStart || b.tie.matchDay || 0).getTime();
      return aT - bT;
    })
    .slice(0, 5);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            tintColor={TEXT_SECONDARY}
            colors={[BLUE_ACCENT]}
          />
        }
      >
        {/* ── SECTION 1: HEADER ── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.heroName}>
                <Text style={{ color: BLUE_ACCENT }}>{firstName.charAt(0)}</Text>
                {firstName.slice(1)}.
              </Text>
            </View>
            <TouchableOpacity style={styles.bellBtn} activeOpacity={0.75}>
              <Text style={styles.bellIcon}>🔔</Text>
            </TouchableOpacity>
          </View>

          {/* Stat pills */}
          <View style={styles.statRow}>
            <View style={styles.statPill}>
              <Text style={styles.statValue}>—</Text>
              <Text style={styles.statLabel}>RATING</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statValue}>0/0</Text>
              <Text style={styles.statLabel}>W/L</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>PLAYED</Text>
            </View>
          </View>
        </View>


        {/* ── LEAGUE HERO CARDS ── */}
        {myLeagues.map((ml) => (
          <TouchableOpacity
            key={ml.league.id}
            style={styles.leagueCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('LeagueDashboard', { leagueId: ml.league.id, seasonId: ml.seasonId })}
          >
            <View style={styles.leagueCardGradient}>
              {/* Live badge if any tie in progress */}
              {ml.ties.some((t) => t.status === 'in_progress') ? (
                <View style={styles.leagueLiveBadge}>
                  <PulsingDot />
                  <Text style={styles.leagueLiveBadgeText}>LIVE NOW</Text>
                </View>
              ) : (
                <View style={styles.leagueStatusBadge}>
                  <Text style={styles.leagueStatusBadgeText}>
                    {ml.status === 'league_phase' ? 'LEAGUE PHASE' : ml.status?.replace(/_/g, ' ').toUpperCase() || 'SETUP'}
                  </Text>
                </View>
              )}

              {/* League progress % */}
              <Text style={styles.leaguePercent}>
                {ml.ties.length > 0
                  ? `${Math.round((ml.ties.filter((t) => t.status === 'completed').length / ml.ties.length) * 100)}%`
                  : '0%'}
              </Text>

              <Text style={styles.leagueName} numberOfLines={2}>{ml.league.name}</Text>
              <Text style={styles.leagueSub}>
                {ml.league.city || ''} {ml.league.city ? '•' : ''} {ml.ties.length > 0 ? `${ml.ties.length} ties` : ml.seasonName}
              </Text>

              {/* Progress bar */}
              <View style={styles.leagueProgressBg}>
                <View
                  style={[
                    styles.leagueProgressFill,
                    {
                      width: ml.ties.length > 0
                        ? `${(ml.ties.filter((t) => t.status === 'completed').length / ml.ties.length) * 100}%`
                        : '0%',
                    },
                  ]}
                />
              </View>
              <Text style={styles.leagueProgressText}>
                {ml.ties.filter((t) => t.status === 'completed').length} / {ml.ties.length} matches done
              </Text>

              <View style={styles.leagueArrow}>
                <Text style={styles.leagueArrowText}>OPEN MATCH HUB  →</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {/* ── FANTASY LEAGUE CTA ── Show for each league's active season */}
        {myLeagues.map((ml) => ml.seasonId ? (
          <TouchableOpacity
            key={`fantasy-${ml.league.id}`}
            style={styles.fantasyCard}
            activeOpacity={0.85}
            onPress={() => (navigation as any).navigate('Fantasy', { seasonId: ml.seasonId, leagueId: ml.league.id })}
          >
            <View style={styles.fantasyCardBody}>
              <Text style={styles.fantasyBadge}>🏆 FANTASY LEAGUE</Text>
              <Text style={styles.fantasyTitle}>Pick Your Dream Team</Text>
              <Text style={styles.fantasySub}>
                Predict qualifiers • Build 16-player squad • Climb leaderboard
              </Text>
              <View style={styles.fantasyArrow}>
                <Text style={styles.fantasyArrowText}>PLAY NOW  →</Text>
              </View>
            </View>
          </TouchableOpacity>
        ) : null)}

        {/* ── UPCOMING FIXTURES CAROUSEL (earliest 5, tiles) ── */}
        {upcomingFixtures.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <View style={[styles.sectionHeader, { paddingHorizontal: 24 }]}>
              <Text style={styles.sectionTitle}>UPCOMING FIXTURES</Text>
            </View>
            <FlatList
              data={upcomingFixtures}
              keyExtractor={(t) => t.tie.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.fixturesListContent}
              renderItem={({ item }) => (
                <FixtureTile
                  tie={item.tie}
                  onPress={() => navigation.navigate('TieDetail', { tieId: item.tie.id, leagueId: item.leagueId, seasonId: item.seasonId })}
                />
              )}
            />
          </View>
        )}

        {/* Bottom spacer */}
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 120 },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 28,
    overflow: 'hidden',
    position: 'relative',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: { flex: 1 },
  greeting: {
    fontSize: 9,
    fontWeight: '700',
    color: TEXT_TERTIARY,
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  heroName: {
    fontSize: 38,
    fontWeight: '900',
    fontStyle: 'italic',
    color: TEXT_PRIMARY,
    letterSpacing: -1.5,
    lineHeight: 40,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  bellIcon: { fontSize: 18 },

  // Stat pills
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statPill: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
    color: TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 7,
    fontWeight: '700',
    color: TEXT_TERTIARY,
    letterSpacing: 1.2,
    marginTop: 2,
  },

  // Sections
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },

  // Next Match card
  nextMatchCard: {
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
  nextMatchAccent: {
    width: 5,
    backgroundColor: BLUE_ACCENT,
  },
  nextMatchBody: {
    flex: 1,
    padding: 16,
  },
  nextMatchLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: TEXT_TERTIARY,
    letterSpacing: 2.5,
    marginBottom: 8,
  },
  nextMatchEmpty: {
    fontSize: 18,
    fontWeight: '900',
    fontStyle: 'italic',
    color: TEXT_PRIMARY,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  nextMatchSub: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 14,
  },
  discoverBtn: {
    alignSelf: 'flex-start',
    backgroundColor: BLUE_ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  discoverBtnText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },

  // Live list
  liveList: {
    paddingRight: 20,
    gap: 12,
  },
  liveCard: {
    width: 160,
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
  liveCardAccent: {
    width: 4,
    backgroundColor: '#EF4444',
  },
  liveCardBody: {
    flex: 1,
    padding: 12,
  },
  liveCardBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 6,
  },
  liveCardBadgeText: {
    fontSize: 7,
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: 0.8,
  },
  liveCardName: {
    fontSize: 12,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.3,
    marginBottom: 6,
    lineHeight: 16,
  },
  liveCardCity: {
    fontSize: 10,
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },

  // Quick access grid
  // Quote
  quoteCard: {
    marginHorizontal: 24,
    marginBottom: 20,
  },
  quoteText: {
    fontSize: 22,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#94A3B8',
    letterSpacing: -0.5,
    lineHeight: 28,
  },

  quickGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 10,
  },
  quickTile: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  quickTileLive: {
    borderWidth: 1.5,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.04)',
  },
  quickTileIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  quickTileLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: 0.2,
  },
  quickTileDivider: {
    width: 32,
    height: 1,
    backgroundColor: DIVIDER,
    marginVertical: 8,
  },
  quickTileInfo: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },
  quickTileBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#1858D6',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  quickTileBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // Fixture tiles (horizontal carousel)
  fixturesListContent: {
    paddingLeft: 20,
    paddingRight: 8,
    paddingVertical: 6,
    gap: 12,
  },
  fixtureTile: {
    width: 180,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  fixtureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  fixtureDate: {
    fontSize: 10,
    fontWeight: '800',
    color: NAVY,
    letterSpacing: 1.2,
  },
  fixtureTime: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    letterSpacing: 0.4,
  },
  fixtureLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fixtureLiveText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: 1.2,
  },
  fixtureDoneBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fixtureDoneText: {
    fontSize: 8,
    fontWeight: '900',
    color: TEXT_TERTIARY,
    letterSpacing: 1.2,
  },
  fixtureTeams: {
    marginBottom: 10,
  },
  fixtureTeam: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.2,
  },
  fixtureVs: {
    fontSize: 9,
    fontWeight: '700',
    color: TEXT_TERTIARY,
    letterSpacing: 1.5,
    marginVertical: 2,
  },
  fixtureScore: {
    fontSize: 16,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: -0.5,
  },
  fixtureRound: {
    fontSize: 9,
    fontWeight: '800',
    color: TEXT_TERTIARY,
    letterSpacing: 1.2,
  },

  // Upcoming compact cards (kept for other screens)
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  upcomingAccent: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: '#06D6A0',
  },
  upcomingCardBody: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  upcomingCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  upcomingCardName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.2,
    marginRight: 8,
  },
  upcomingStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  upcomingStatusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  upcomingCardMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  upcomingCardMetaText: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  upcomingCardCat: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1858D6',
    marginTop: 2,
  },
  upcomingChevron: {
    fontSize: 22,
    fontWeight: '300',
    color: TEXT_TERTIARY,
    paddingRight: 14,
  },
  seeAllBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 2,
  },
  seeAllBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1858D6',
    letterSpacing: 0.3,
  },

  // League hero card
  leagueCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  leagueCardGradient: {
    backgroundColor: NAVY,
    padding: 20,
    paddingBottom: 16,
  },
  leagueLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  leagueLiveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 1,
  },
  leagueStatusBadge: {
    backgroundColor: 'rgba(33,150,243,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  leagueStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1858D6',
    letterSpacing: 1,
  },
  leaguePercent: {
    position: 'absolute',
    top: 18,
    right: 20,
    fontSize: 28,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.15)',
    letterSpacing: -1,
  },
  leagueName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 26,
    marginBottom: 4,
  },
  leagueSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 14,
  },
  leagueProgressBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  leagueProgressFill: {
    height: '100%',
    backgroundColor: '#06D6A0',
    borderRadius: 3,
  },
  leagueProgressText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 12,
  },
  leagueArrow: {
    backgroundColor: '#1858D6',
    alignSelf: 'stretch',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  leagueArrowText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  fantasyCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  fantasyCardBody: {
    backgroundColor: '#7C3AED', // violet accent — visually distinct from league navy
    padding: 18,
    borderRadius: 16,
  },
  fantasyBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FDE68A',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  fantasyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  fantasySub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 14,
  },
  fantasyArrow: {
    backgroundColor: '#FDE68A',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  fantasyArrowText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.8,
  },
});
