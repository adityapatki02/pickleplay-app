import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useNavigation } from '@react-navigation/native';
import { tournamentsApi } from '../api/tournaments.api';
import { registrationsApi } from '../api/registrations.api';
import { useAuthStore } from '../store/authStore';
import { Tournament } from '../types/tournament.types';
import TournamentTile from '../components/ui/TournamentTile';
import TournamentCarousel from '../components/ui/TournamentCarousel';
import { light } from '../config/lightTheme';

// ─── Design tokens ──────────────────────────────────────────────────────────
const NAVY = '#001E40';
const BLUE_ACCENT = '#2196F3';
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
  require('../../assets/banners/1.png'),
  require('../../assets/banners/2.png'),
  require('../../assets/banners/3.png'),
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

// ─── Live tournament card ────────────────────────────────────────────────────
function LiveCard({ item, onPress }: { item: Tournament; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.liveCard} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.liveCardAccent} />
      <View style={styles.liveCardBody}>
        <View style={styles.liveCardBadge}>
          <Text style={styles.liveCardBadgeText}>IN PROGRESS</Text>
        </View>
        <Text style={styles.liveCardName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.liveCardCity}>📍 {item.city}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── (UpcomingRow removed — now inline in HomeScreen) ──────────────────────

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();

  const [liveTournaments, setLiveTournaments] = useState<Tournament[]>([]);
  const [recommendedTournaments, setRecommendedTournaments] = useState<Tournament[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<any[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [loadingRegs, setLoadingRegs] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    const [liveResult, regsResult, recoResult] = await Promise.allSettled([
      tournamentsApi.list({ status: 'in_progress', limit: 5 }),
      registrationsApi.getMyRegistrations(),
      tournamentsApi.list({ status: 'registration_open,published,in_progress', limit: 10 }),
    ]);

    if (liveResult.status === 'fulfilled') {
      const data = liveResult.value.data?.data ?? [];
      setLiveTournaments(Array.isArray(data) ? data.slice(0, 5) : []);
    } else {
      Alert.alert('Error', 'Failed to load live tournaments');
    }
    setLoadingLive(false);

    if (regsResult.status === 'fulfilled') {
      const data = regsResult.value.data?.data ?? regsResult.value.data ?? [];
      const arr = Array.isArray(data) ? data : [];
      // Filter upcoming (not completed/cancelled)
      const upcoming = arr.filter((r: any) => {
        const s = (r.tournament ?? r)?.status;
        return s !== 'completed' && s !== 'cancelled';
      });
      setMyRegistrations(upcoming);
    } else {
      Alert.alert('Error', 'Failed to load your registrations');
    }
    setLoadingRegs(false);

    if (recoResult.status === 'fulfilled') {
      const data = recoResult.value.data?.data ?? [];
      // Sort by soonest start date first
      const sorted = (Array.isArray(data) ? data : []).sort((a: Tournament, b: Tournament) => {
        const aDate = new Date(a.startDate).getTime();
        const bDate = new Date(b.startDate).getTime();
        return aDate - bDate;
      });
      setRecommendedTournaments(sorted.slice(0, 10));
    }

    setRefreshing(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const firstName = user?.fullName ? getFirstName(user.fullName) : 'PLAYER';

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


        {/* ── QUICK ACCESS TILES (2 tiles — Upcoming + Live) ── */}
        <View style={styles.quickGrid}>
          {/* Upcoming tile */}
          <TouchableOpacity
            style={styles.quickTile}
            onPress={() => (navigation as any).navigate('MyEventsTab', { screen: 'MyEvents' })}
            activeOpacity={0.8}
          >
            {myRegistrations.length > 0 && (
              <View style={styles.quickTileBadge}>
                <Text style={styles.quickTileBadgeText}>{myRegistrations.length}</Text>
              </View>
            )}
            <Text style={styles.quickTileIcon}>📅</Text>
            <Text style={styles.quickTileLabel}>Upcoming</Text>
            <View style={styles.quickTileDivider} />
            <Text style={styles.quickTileInfo} numberOfLines={1}>
              {myRegistrations.length === 0
                ? 'No events yet'
                : myRegistrations.length === 1
                  ? (myRegistrations[0].tournament ?? myRegistrations[0])?.name ?? '1 event'
                  : `${(myRegistrations[0].tournament ?? myRegistrations[0])?.name} +${myRegistrations.length - 1}`
              }
            </Text>
          </TouchableOpacity>

          {/* Live Now tile */}
          <TouchableOpacity
            style={[styles.quickTile, liveTournaments.length > 0 && styles.quickTileLive]}
            onPress={() => {
              if (liveTournaments.length > 0) {
                navigation.navigate('TournamentDetail', { tournamentId: liveTournaments[0].id });
              }
            }}
            activeOpacity={0.8}
          >
            {liveTournaments.length > 0 && (
              <View style={[styles.quickTileBadge, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.quickTileBadgeText}>{liveTournaments.length}</Text>
              </View>
            )}
            <Text style={styles.quickTileIcon}>⚡</Text>
            <Text style={styles.quickTileLabel}>Live Now</Text>
            <View style={styles.quickTileDivider} />
            <Text style={[styles.quickTileInfo, liveTournaments.length > 0 && { color: '#EF4444' }]} numberOfLines={1}>
              {liveTournaments.length === 0
                ? 'No live events'
                : liveTournaments[0].name
              }
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── RECOMMENDED TOURNAMENTS ── */}
        {recommendedTournaments.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <View style={[styles.sectionHeader, { paddingHorizontal: 24 }]}>
              <Text style={styles.sectionTitle}>RECOMMENDED FOR YOU</Text>
            </View>
            <TournamentCarousel
              tournaments={recommendedTournaments.slice(0, 5)}
              onPress={(t) => navigation.navigate('TournamentDetail', { tournamentId: t.id })}
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
    backgroundColor: '#2196F3',
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
    color: '#2196F3',
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
    color: '#2196F3',
    letterSpacing: 0.3,
  },
});
