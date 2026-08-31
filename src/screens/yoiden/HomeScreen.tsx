import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
  Linking,
  Image,
  ImageBackground,
  TextInput,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Ellipse, Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { thumbUrl } from '../../utils/img';
import { useNavigation, useFocusEffect, useScrollToTop } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import {
  YColors,
  YDisplay,
  YEyebrow,
  YMono,
  YUiText,
  YTopBar,
  YBadge,
  YButton,
  YSectionHead,
  YTournamentRow,
  YStatTile,
  YVenueEditorial,
  YVenueRow,
  type Venue,
} from '../../components/yoiden';
import { useAuthStore } from '../../store/authStore';
import { tournamentsApi } from '../../api/tournaments.api';
import { registrationsApi } from '../../api/registrations.api';
import { venuesApi } from '../../api/venues.api';
import { bookingsApi } from '../../api/bookings.api';
import type { Tournament } from '../../types/tournament.types';
import type { Venue as ApiVenue, Booking } from '../../types/booking.types';
import VenueBookingBoard from '../../components/venue/VenueBookingBoard';
import { getDuprMe, DuprMeResponse, getMyDuprAdminClubs, DuprAdminClub } from '../../api/dupr.api';
import { DUPR_ENABLED } from '../../config/constants';
import { type YoidenTabParamList } from '../../navigation/nav-types';
import { FEATURED_LEAGUES, liveLeagues, type FeaturedLeague } from '../../config/leagues';

type Nav = BottomTabNavigationProp<YoidenTabParamList, 'HomeTab'>;

// Featured-tournament allowlist. Empty = show the real discover / your-events
// feed (production). Previously pinned to a synthetic "AIPA — DEMO" tournament
// for sales demos — cleared for release so Home shows real events.
const FEATURED_TOURNAMENT_IDS: readonly string[] = [];

// Featured-league strip is hidden on Home for now — it dominated the fold and
// pushed the real actions below it. Flip to true to bring the banners back.
const SHOW_FEATURED_LEAGUES = false;




// Helpers
/** Straight-line km between two points (Haversine) — good enough to tell
 *  "same city" from "browsing somewhere else". */
const kmBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Device GPS when it's in (or near) the chosen city; otherwise the city itself. */
const pickSearchOrigin = (
  gps: { lat: number; lng: number } | null,
  user?: { cityLat?: number; cityLng?: number },
): { lat: number; lng: number } | null => {
  const city =
    user?.cityLat != null && user?.cityLng != null
      ? { lat: Number(user.cityLat), lng: Number(user.cityLng) }
      : null;
  if (!city) return gps;
  if (!gps) return city;
  return kmBetween(gps, city) > 50 ? city : gps;
};

const unwrap = <T,>(res: any): T => (res?.data?.data ?? res?.data ?? res) as T;
// DUPR rating → compact display (e.g. 4.213 → "4.213", null → "NR").
const formatDuprRating = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined || v === '') return 'NR';
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') : String(v);
};

type Registration = {
  id: string;
  tournamentId: string;
  categoryId: string;
  tournament?: Tournament;
  category?: { id: string; name: string };
  status?: string;
};

export default function HomeScreen() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const fullName = user?.displayName || user?.fullName || 'PLAYER';
  const firstName = fullName.split(' ')[0].toUpperCase();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myRegs, setMyRegs] = useState<Registration[]>([]);
  const [myHosted, setMyHosted] = useState<Tournament[]>([]);
  const [nearby, setNearby] = useState<Tournament[]>([]);
  const [apiVenues, setApiVenues] = useState<ApiVenue[]>([]);
  const [myVenues, setMyVenues] = useState<ApiVenue[]>([]);
  const [nextBooking, setNextBooking] = useState<Booking | null>(null);
  const [activeSport, setActiveSport] = useState<string | null>(null);
  // Fetched once on mount — null means not yet resolved, undefined means denied/unavailable
  const userCoords = useRef<{ lat: number; lng: number } | null>(null);
  // Tapping the active bottom-tab scrolls this screen back to the top.
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  // Featured-league slider geometry + paging
  const { width: winW } = useWindowDimensions();
  const LEAGUE_GAP = 12;
  const leagueCardW = Math.min(winW, 520) - 32; // cap on wide web viewports
  const [leaguePage, setLeaguePage] = useState(0);
  const onLeagueScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setLeaguePage(Math.round(e.nativeEvent.contentOffset.x / (leagueCardW + LEAGUE_GAP)));

  const loadVenues = useCallback(async (sport?: string | null) => {
    try {
      // Location, done the way pro apps (Playtomic/Uber) do it: the city label
      // scopes WHICH courts show, and device GPS drives the ORDER — nearest
      // first — plus the "X km away" on each card. We always send GPS when we
      // have it (alongside the city) so the backend computes real distance;
      // without a fix it can't, and far-away courts would rank as high as close
      // ones. No GPS yet → the backend falls back to newest-first (unchanged).
      const hasCity = !!user?.city;
      // Which point do we measure distance from? Normally the device GPS, so
      // "1.1 km away" stays accurate while you're at home. But if you've picked a
      // city you're not in, GPS would rank that city's courts by how far they
      // are from YOU — which is useless and makes changing city look like it
      // did nothing. In that case centre on the city instead.
      const origin = pickSearchOrigin(userCoords.current, user as any);
      const res = await venuesApi.list({
        city: hasCity ? user!.city : undefined,
        lat: origin?.lat,
        lng: origin?.lng,
        limit: 8,
        sport: sport || undefined,
      }) as any;
      const data: ApiVenue[] = res?.data?.data ?? res?.data ?? [];
      setApiVenues(Array.isArray(data) ? data : []);
    } catch { /* silent — fallback venues shown */ }
  }, [user?.city, user?.cityLat, user?.cityLng]);

  const fetchAll = useCallback(async () => {
    try {
      const [regsRes, hostedRes, discoverRes, bookingsRes, myVenuesRes] = await Promise.allSettled([
        registrationsApi.getMyRegistrations(),
        tournamentsApi.getMyTournaments(),
        tournamentsApi.discover({ limit: 5 }),
        bookingsApi.myBookings(),
        venuesApi.getMyVenues(),
      ]);

      if (regsRes.status === 'fulfilled') {
        const data = unwrap<Registration[]>(regsRes.value);
        setMyRegs(Array.isArray(data) ? data : []);
      }
      if (hostedRes.status === 'fulfilled') {
        const data = unwrap<Tournament[]>(hostedRes.value);
        setMyHosted(Array.isArray(data) ? data : []);
      }
      if (discoverRes.status === 'fulfilled') {
        const data = unwrap<Tournament[]>(discoverRes.value);
        setNearby(Array.isArray(data) ? data : []);
      }
      if (myVenuesRes.status === 'fulfilled') {
        const data = (myVenuesRes.value as any)?.data?.data ?? (myVenuesRes.value as any)?.data ?? [];
        setMyVenues(Array.isArray(data) ? data : []);
      }
      if (bookingsRes.status === 'fulfilled') {
        const data = unwrap<Booking[]>(bookingsRes.value);
        const all = Array.isArray(data) ? data : [];
        const now = new Date().toISOString().slice(0, 10);
        const upcoming = all
          .filter(b => (b.status === 'confirmed' || b.status === 'pending') && b.bookingDate >= now)
          .sort((a, b) =>
            a.bookingDate !== b.bookingDate
              ? a.bookingDate.localeCompare(b.bookingDate)
              : a.startTime.localeCompare(b.startTime),
          );
        setNextBooking(upcoming[0] ?? null);
      }
      await loadVenues(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadVenues]);

  // Ask for location ONCE on mount, then kick off the full data load.
  // We request foreground permission (no background tracking ever).
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted' && !cancelled) {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced, // fast, city-level precision
          });
          if (!cancelled) {
            userCoords.current = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            };
          }
        }
      } catch { /* permission denied or GPS unavailable — city filter used instead */ }
      if (!cancelled) fetchAll();
    };
    init();
    return () => { cancelled = true; };
  // fetchAll is stable (wrapped in useCallback) — safe to include
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch whenever Home regains focus (e.g. returning after making a booking
  // in the Book tab) so the "Upcoming booking" card is fresh — without needing a
  // full page reload. Skip the very first focus; the mount effect already loaded.
  const didInitialFocus = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!didInitialFocus.current) {
        didInitialFocus.current = true;
        return;
      }
      fetchAll();
    // fetchAll is stable (useCallback)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // Re-fetch venues whenever the sport chip OR the chosen city changes
  // (after the initial load) so switching city updates the courts live.
  useEffect(() => {
    if (!loading) {
      loadVenues(activeSport);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSport, user?.city, user?.cityLat, user?.cityLng]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  const goVenueAdmin = (venueId: string) =>
    nav.navigate('MeTab', { screen: 'VenueAdmin', params: { venueId } });
  // Straight to the analytics dashboard — VenueAdmin is the slot board, which
  // the Home "My court" face already shows inline, so routing through it just
  // made the owner tap "View full dashboard" a second time.
  const goOwnerDashboard = (venueId: string) =>
    nav.navigate('MeTab', { screen: 'OwnerDashboard', params: { venueId } });
  const goHost = () => nav.navigate('PlayTab', { screen: 'CreateTournament' });
  const goPlay = () => nav.navigate('PlayTab', { screen: 'Play' });
  const goBook = () => nav.navigate('BookTab', { screen: 'Book' });
  const openVenue = (venueId: string) =>
    nav.navigate('BookTab', { screen: 'VenueDetail', params: { venueId } });
  const goMe = () => nav.navigate('MeTab', { screen: 'Me' });
  const openLocation = () => nav.navigate('HomeTab', { screen: 'CityPicker' });
  const goLearn = () => Linking.openURL('https://yoiden.com');

  // Dashboard mini-search: typing + submit hands off to the full Book / Events page.
  const [courtQuery, setCourtQuery] = useState('');
  const [eventQuery, setEventQuery] = useState('');
  const [activeFace, setActiveFace] = useState<'book' | 'event' | 'manage'>('book');
  // Which owned venue the "My court" board is showing (defaults to the first).
  const [manageVenueId, setManageVenueId] = useState<string | null>(null);
  // The player's DUPR snapshot + club authority — powers the hero score chip.
  const [duprMe, setDuprMe] = useState<DuprMeResponse | null>(null);
  const [duprAdminClubs, setDuprAdminClubs] = useState<DuprAdminClub[]>([]);
  useEffect(() => {
    if (!DUPR_ENABLED) return;
    getDuprMe().then(r => setDuprMe(unwrap<DuprMeResponse>(r))).catch(() => {});
    getMyDuprAdminClubs()
      .then(r => setDuprAdminClubs(Array.isArray((r as any)?.data?.clubs) ? (r as any).data.clubs : []))
      .catch(() => {});
  }, []);
  const goBookSearch = (q: string) =>
    (nav as any).navigate('BookTab', { screen: 'Book', params: q ? { q } : undefined });
  const goPlaySearch = (q: string) =>
    (nav as any).navigate('PlayTab', { screen: 'Play', params: q ? { q } : undefined });
  const HOST_CONTACT_WA = '918149998143';
  const getInTouch = () =>
    Linking.openURL(
      `https://wa.me/${HOST_CONTACT_WA}?text=${encodeURIComponent(
        "Hi Yoiden, I'd like to host a custom league.",
      )}`,
    ).catch(() => {});
  const openLeague = (l: FeaturedLeague) =>
    nav.navigate('HomeTab', {
      screen: 'LeagueDashboard',
      params: { leagueId: l.leagueId, seasonId: l.seasonId },
    });
  const goLiveLeagues = () =>
    nav.navigate('HomeTab', { screen: 'LiveLeagues' });
  const openTournament = (id: string) =>
    nav.navigate('HomeTab', { screen: 'TournamentDetail', params: { tournamentId: id } });

  // Pull tournaments out of registrations (when API populates them).
  // A user can be registered in many categories of the same tournament — collapse
  // to one card per tournament so "Your Events" doesn't repeat the same banner.
  const allUpcomingRegs = (() => {
    const seen = new Set<string>();
    const list: Tournament[] = [];
    for (const r of myRegs) {
      const t = r.tournament;
      if (!t || seen.has(t.id)) continue;
      seen.add(t.id);
      list.push(t);
    }
    return list;
  })();

  // Featured-only: keep only the AIPA + Demo tournaments. Empty allowlist = no filter.
  const onlyFeatured = <T extends Tournament>(list: T[]): T[] =>
    FEATURED_TOURNAMENT_IDS.length > 0
      ? list.filter((t) => (FEATURED_TOURNAMENT_IDS as readonly string[]).includes(t.id))
      : list;

  const upcomingRegs = onlyFeatured(allUpcomingRegs);
  const visibleHosted = onlyFeatured(myHosted);

  // "Your events" = registrations + hosted, combined; Home shows max 3 then
  // View all. Drop events that have already finished and order by start date,
  // otherwise the three slots fill with whatever the APIs happened to return
  // first — which meant months-old events hid the one just created. Bookings
  // above are filtered the same way.
  const todayIso = new Date().toISOString().slice(0, 10);
  const eventDay = (t: Tournament) => (t.endDate || t.startDate || '').slice(0, 10);
  const yourEvents = (() => {
    const byId = new Map<string, { t: Tournament; hosting: boolean }>();
    for (const t of upcomingRegs) byId.set(t.id, { t, hosting: false });
    // Hosting wins when the organiser is also registered — same event, one row.
    for (const t of visibleHosted) byId.set(t.id, { t, hosting: true });
    return [...byId.values()]
      .filter(({ t }) => !eventDay(t) || eventDay(t) >= todayIso)
      .sort((a, b) => (a.t.startDate || '').localeCompare(b.t.startDate || ''));
  })();
  const visibleNearby = onlyFeatured(nearby);

  // Transform API venues → display shape for YVenueEditorial / YVenueRow.
  // Fields not yet in the backend (rating, distanceKm, sports) are zeroed so
  // the card components hide them via their own guards.
  const toDisplayVenue = (v: ApiVenue, i: number): Venue => {
    // photos may be {url,thumbUrl,caption}[] or string[] depending on backend
    // version. Cards use the lightweight thumbUrl when available (fast lists).
    const firstPhoto = Array.isArray(v.photos)
      ? typeof v.photos[0] === 'string'
        ? (v.photos[0] as string)
        : (v.photos[0] as { url: string; thumbUrl?: string })?.thumbUrl ??
          (v.photos[0] as { url: string })?.url
      : undefined;
    return {
      id: v.id,
      name: v.name,
      area: v.neighbourhood || v.city,
      distanceKm: v.distanceKm ?? 0,         // 0 = hide distance chip on card
      rating: v.rating ?? 0,
      reviews: v.reviewCount ?? 0,
      sports: (v.sports ?? []) as unknown as Venue['sports'],
      imageUrl: firstPhoto ?? `https://picsum.photos/seed/${v.id}/640/400`,
      sponsored: v.isSponsored ?? false,
      topRated: (v.rating ?? 0) >= 4.5,
    };
  };

  // Compact court-card helpers (mirror the Book tab, from the full venue).
  const venuePhotoUrl = (v: ApiVenue): string => {
    const p = Array.isArray(v.photos) ? v.photos[0] : undefined;
    const raw = typeof p === 'string' ? p : (p as { url?: string } | undefined)?.url;
    return (raw ? thumbUrl(raw, 640) : undefined) ?? `https://picsum.photos/seed/${v.id}/640/360`;
  };
  const priceRange = (v: ApiVenue): string => {
    const prices: number[] = [];
    for (const c of v.courts ?? []) {
      const perHour = 60 / (c.slotDurationMin || 60);
      if (c.basePrice != null) prices.push(Number(c.basePrice) * perHour);
      if (c.peakPrice != null) prices.push(Number(c.peakPrice) * perHour);
    }
    if (!prices.length) return '';
    const min = Math.round(Math.min(...prices));
    const max = Math.round(Math.max(...prices));
    return min === max ? `₹${min}` : `₹${min}–₹${max}`;
  };
  // A SHORT location for the card — the neighbourhood/area, never the full
  // street address. Falls back to city so there's always something to show.
  const shortArea = (v: ApiVenue): string => (v.neighbourhood || v.city || '').trim();
  // "How far from me?" — pro-app style. Only when the backend had our GPS and
  // computed a real distance (distanceKm present & > 0).
  const distanceLabel = (v: ApiVenue): string | null => {
    const km = v.distanceKm;
    if (km == null || km <= 0) return null;
    if (km < 1) return `${Math.round(km * 1000)} m`;
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
  };
  const displayVenues: Venue[] = apiVenues.map(toDisplayVenue);
  const sponsoredVenues = displayVenues.filter((v) => v.sponsored);
  const normalVenues = displayVenues.filter((v) => !v.sponsored);

  return (
    // SafeAreaView gets accent bg so the status-bar notch region is blue too
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={{ backgroundColor: YColors.bg }}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        {/* ── Blue header zone — greeting → live card → search bar ── */}
        <View style={styles.headerZone}>
          {/* Greeting + actions */}
          <YTopBar
            title={
              <View>
                <YDisplay size={22} color="#fff">HEY,</YDisplay>
                <View style={styles.nameRow}>
                  <YDisplay size={40} color="#fff">{firstName}</YDisplay>
                </View>
                {/* Lime signature accent under the name */}
                <View style={styles.heroAccent} />
                {/* Location sits below the name */}
                <Pressable onPress={openLocation} hitSlop={8} style={styles.locTag}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 21s7-5.686 7-11a7 7 0 1 0-14 0c0 5.314 7 11 7 11z"
                      stroke={YColors.orange}
                      strokeWidth={2.4}
                      strokeLinejoin="round"
                      fill="none"
                    />
                    <Path
                      d="M12 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
                      stroke={YColors.orange}
                      strokeWidth={2.4}
                      fill="none"
                    />
                  </Svg>
                  <YUiText
                    size={12}
                    weight={600}
                    color="#fff"
                    style={{ letterSpacing: 0.3 }}
                  >
                    {user?.city ? user.city.toUpperCase() : 'SET LOCATION'}
                  </YUiText>
                </Pressable>
              </View>
            }
            action={
              <Pressable onPress={goMe} hitSlop={4} style={styles.duprChip}>
                <YMono size={7.5} bold color="rgba(255,255,255,0.72)" style={{ letterSpacing: 1.3 }}>
                  DUPR
                </YMono>
                {duprMe?.linked ? (
                  <View style={styles.duprStatRow}>
                    <View style={styles.duprStat}>
                      <YDisplay size={15} color="#fff" style={{ lineHeight: 16 }}>
                        {formatDuprRating(duprMe.snapshot?.ratings?.doubles)}
                      </YDisplay>
                      <YMono size={6.5} bold color="rgba(255,255,255,0.6)" style={{ letterSpacing: 0.6, marginTop: 1 }}>
                        DOUBLES
                      </YMono>
                    </View>
                    <View style={styles.duprDivider} />
                    <View style={styles.duprStat}>
                      <YDisplay size={15} color="#fff" style={{ lineHeight: 16 }}>
                        {formatDuprRating(duprMe.snapshot?.ratings?.singles)}
                      </YDisplay>
                      <YMono size={6.5} bold color="rgba(255,255,255,0.6)" style={{ letterSpacing: 0.6, marginTop: 1 }}>
                        SINGLES
                      </YMono>
                    </View>
                  </View>
                ) : null}
                {duprMe?.linked && duprAdminClubs.length > 0 ? (
                  <YMono size={7} bold color={YColors.brandLine} style={{ letterSpacing: 1, marginTop: 4 }}>
                    {duprAdminClubs[0].role}
                  </YMono>
                ) : null}
                {!duprMe?.linked && (
                  <YUiText size={10.5} weight={800} color="#fff" style={{ marginTop: 2 }}>
                    LINK →
                  </YUiText>
                )}
              </Pressable>
            }
          />


          {/* Upcoming booking card — nearest confirmed booking */}
          {nextBooking && (() => {
            const b = nextBooking;
            const dateLabel = new Date(`${b.bookingDate}T00:00:00`).toLocaleDateString('en-IN', {
              weekday: 'short', day: 'numeric', month: 'short',
            });
            const to12 = (t: string) => {
              const [h, m] = t.split(':').map(Number);
              return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
            };
            const venueName = b.venue?.name ?? 'Your booking';
            const courtName = b.court?.name ?? b.courtLabel ?? '';
            // Free maps deep-link — opens turn-by-turn directions to the court in
            // the user's maps app (no Directions API call, so no server cost).
            const v = b.venue;
            const canDirect = !!(v && ((v.lat != null && v.lng != null) || v.address));
            const openDirections = (e?: any) => {
              // Nested inside the card Pressable — on web the click bubbles, so
              // stop it or the card would also navigate to My Bookings.
              e?.stopPropagation?.();
              if (!v) return;
              const dest = v.lat != null && v.lng != null
                ? `${v.lat},${v.lng}`
                : [v.name, v.address, v.city].filter(Boolean).join(', ');
              if (!dest) return;
              Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`);
            };
            return (
              <>
                <Pressable
                  style={styles.upcomingCard}
                  onPress={() => nav.navigate('BookTab', { screen: 'BookingDetail', params: { bookingId: b.id } })}
                >
                  <View style={styles.upcomingCardInner}>
                    <View style={{ flex: 1 }}>
                      <YEyebrow color={YColors.accent} style={{ marginBottom: 4 }}>
                        UPCOMING BOOKING
                      </YEyebrow>
                      <YDisplay size={15} color={YColors.ink} numberOfLines={1}>
                        {venueName}
                      </YDisplay>
                      <YUiText size={12} color={YColors.ink2} style={{ marginTop: 3 }}>
                        {dateLabel} · {to12(b.startTime)}–{to12(b.endTime)}{courtName ? ` · ${courtName}` : ''}
                      </YUiText>
                    </View>
                    <View style={styles.upcomingActions}>
                      {canDirect && (
                        <Pressable onPress={openDirections} hitSlop={10} style={styles.dirBtn}>
                          {/* Material "directions" glyph — a signpost turn arrow, reads as navigation. */}
                          <Svg width={30} height={30} viewBox="0 0 24 24">
                            <Path d="M21.71 11.29l-9-9a.996.996 0 00-1.41 0l-9 9a.996.996 0 000 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 000-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z" fill={YColors.ink} />
                          </Svg>
                        </Pressable>
                      )}
                      <View style={styles.upcomingArrow}>
                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                          <Path d="M9 18l6-6-6-6" stroke={YColors.ink3} strokeWidth={2} strokeLinecap="round" />
                        </Svg>
                      </View>
                    </View>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => nav.navigate('BookTab', { screen: 'MyBookings' })}
                  hitSlop={8}
                  style={styles.pastBookingsLink}
                >
                  <YUiText size={11.5} weight={800} color="#fff" style={{ letterSpacing: 0.3 }}>
                    Past bookings →
                  </YUiText>
                </Pressable>
              </>
            );
          })()}

        </View>

        {/* ── Book / Event toggle + owner "Manage" nav. The two toggle tiles pick
             which interface shows below; the third (owners only) jumps to the
             venue dashboard. Owner → 3-up, narrower tiles + slightly smaller
             labels; non-owner → the original 2-up. ── */}
        {(() => {
          const isOwner = myVenues.length > 0;
          // Narrower tiles when three sit in the row — trim label + icon a touch.
          const labelSize = isOwner ? 12 : 13.5;
          return (
            <View style={styles.shortcutRow}>
              {([
                {
                  key: 'book' as const, label: 'Book a court',
                  icon: (c: string) => (
                    <Svg width={isOwner ? 38 : 44} height={isOwner ? 28 : 32} viewBox="0 0 30 22" fill="none">
                      <Rect x={2} y={2} width={26} height={18} rx={3.5} stroke={c} strokeWidth={1.9} />
                      <Path d="M9 2v18M21 2v18M9 11h12" stroke={c} strokeWidth={1.9} strokeLinecap="round" />
                    </Svg>
                  ),
                },
                {
                  key: 'event' as const, label: 'Join an event',
                  icon: (c: string) => (
                    <Svg width={isOwner ? 26 : 30} height={isOwner ? 26 : 30} viewBox="0 0 24 24" fill="none">
                      <Path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4ZM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3" stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  ),
                },
              ]).map((f) => {
                const active = activeFace === f.key;
                // Active tile is lime-filled — dark ink icon + label read best on it.
                const c = active ? YColors.ink : YColors.accent;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setActiveFace(f.key)}
                    style={[styles.shortcutTile, active && styles.shortcutTilePrimary]}
                  >
                    {f.icon(c)}
                    <YUiText size={labelSize} weight={active ? 800 : 600} color={YColors.ink} style={styles.shortcutLabel}>
                      {f.label}
                    </YUiText>
                  </Pressable>
                );
              })}
              {isOwner && (() => {
                const active = activeFace === 'manage';
                const c = active ? YColors.ink : YColors.accent;
                return (
                  <Pressable
                    key="manage"
                    onPress={() => setActiveFace('manage')}
                    style={[styles.shortcutTile, active && styles.shortcutTilePrimary]}
                  >
                    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                      <Path d="M3 21h18M5 21V8l7-4 7 4v13M9 12h2M13 12h2M9 16h2M13 16h2" stroke={c} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <YUiText size={labelSize} weight={active ? 800 : 600} color={YColors.ink} style={styles.shortcutLabel}>
                      My court
                    </YUiText>
                  </Pressable>
                );
              })()}
            </View>
          );
        })()}

        {/* ── The selected interface — swaps when you tap a tile ── */}
        {activeFace === 'book' ? (
          <View style={styles.faceBody}>
            <View style={styles.searchBar}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M11 4a7 7 0 104.95 11.95A7 7 0 0011 4zM20 20l-3.6-3.6" stroke={YColors.ink3} strokeWidth={2} strokeLinecap="round" />
              </Svg>
              <TextInput
                style={styles.searchInput}
                placeholder="Search courts or area"
                placeholderTextColor={YColors.ink3}
                value={courtQuery}
                onChangeText={setCourtQuery}
                returnKeyType="search"
                onSubmitEditing={() => goBookSearch(courtQuery)}
              />
            </View>
            <YEyebrow color={YColors.ink3} style={{ marginTop: 18, marginBottom: 10 }}>
              NEAREST TO ME
            </YEyebrow>
            <View style={styles.courtList}>
              {apiVenues.length > 0 ? (
                apiVenues.slice(0, 2).map((v) => (
                  <Pressable
                    key={v.id}
                    onPress={() => openVenue(v.id)}
                    style={({ pressed }) => [styles.venueCard, pressed && { opacity: 0.92 }]}
                  >
                    <Image source={{ uri: venuePhotoUrl(v) }} style={styles.venueCardImage} resizeMode="cover" />
                    <View style={styles.venueCardBody}>
                      <View style={styles.venueCardHead}>
                        <View style={{ flex: 1 }}>
                          <YDisplay size={22} color={YColors.accent} numberOfLines={1}>
                            {v.name}
                          </YDisplay>
                          <View style={styles.venueCardLoc}>
                            <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
                              <Path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z" stroke={YColors.ink3} strokeWidth={2} strokeLinejoin="round" />
                              <Path d="M12 12.5a2 2 0 100-4 2 2 0 000 4z" fill={YColors.ink3} />
                            </Svg>
                            <YUiText size={12} color={YColors.ink2} numberOfLines={1} style={{ flexShrink: 1 }}>
                              {shortArea(v)}
                            </YUiText>
                            {distanceLabel(v) ? (
                              <>
                                <YUiText size={12} color={YColors.ink3}>·</YUiText>
                                <YUiText size={12} weight={800} color={YColors.accent}>{distanceLabel(v)} away</YUiText>
                              </>
                            ) : null}
                          </View>
                        </View>
                        {priceRange(v) ? (
                          <YBadge color={YColors.accentDeep} bg="rgba(24,88,214,0.12)">{priceRange(v)}/hr</YBadge>
                        ) : null}
                      </View>
                      <YUiText size={12} color={YColors.ink3} numberOfLines={2} style={{ marginTop: 10 }}>
                        {v.address}
                      </YUiText>
                      <View style={styles.venueCardFoot}>
                        <YMono size={10} color={YColors.ink3} style={{ letterSpacing: 1 }}>
                          {(v.courts?.length ?? 0)} COURT{(v.courts?.length ?? 0) === 1 ? '' : 'S'} · {v.openTime}–{v.closeTime}
                        </YMono>
                        <YButton variant="primary" size="sm" onPress={() => openVenue(v.id)}>BOOK</YButton>
                      </View>
                    </View>
                  </Pressable>
                ))
              ) : (
                <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                  <YUiText size={12} color={YColors.ink2}>Courts coming soon to {user?.city || 'your city'}.</YUiText>
                </View>
              )}
            </View>
            <Pressable onPress={goBook} hitSlop={8} style={styles.seeAll}>
              <YUiText size={11.5} weight={800} color={YColors.accent}>See all courts →</YUiText>
            </Pressable>
          </View>
        ) : activeFace === 'manage' ? (
          <View style={styles.faceBody}>
            {(() => {
              const manageVenue = myVenues.find(v => v.id === manageVenueId) ?? myVenues[0] ?? null;
              return (
                <>
                  {/* Venue switcher — only when the owner has more than one court */}
                  {myVenues.length > 1 && (
                    <View style={styles.manageVenueRow}>
                      {myVenues.map(v => {
                        const on = manageVenue?.id === v.id;
                        return (
                          <Pressable
                            key={v.id}
                            onPress={() => setManageVenueId(v.id)}
                            style={[styles.manageVenueChip, on && styles.manageVenueChipOn]}
                          >
                            <YUiText size={12.5} weight={on ? 800 : 600} color={on ? '#fff' : YColors.ink2} numberOfLines={1}>
                              {v.name}
                            </YUiText>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                  {manageVenue ? (
                    <VenueBookingBoard
                      venue={manageVenue}
                      onOpenDashboard={() => goOwnerDashboard(manageVenue.id)}
                    />
                  ) : (
                    <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                      <YUiText size={12} color={YColors.ink2}>No court is linked to your account yet.</YUiText>
                    </View>
                  )}
                  {manageVenue ? (
                    <Pressable onPress={() => goVenueAdmin(manageVenue.id)} hitSlop={8} style={styles.seeAll}>
                      <YUiText size={11.5} weight={800} color={YColors.accent}>Venue admin →</YUiText>
                    </Pressable>
                  ) : null}
                </>
              );
            })()}
          </View>
        ) : (
          <View style={styles.faceBody}>
            <View style={styles.searchBar}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M11 4a7 7 0 104.95 11.95A7 7 0 0011 4zM20 20l-3.6-3.6" stroke={YColors.ink3} strokeWidth={2} strokeLinecap="round" />
              </Svg>
              <TextInput
                style={styles.searchInput}
                placeholder="Search tournaments or city"
                placeholderTextColor={YColors.ink3}
                value={eventQuery}
                onChangeText={setEventQuery}
                returnKeyType="search"
                onSubmitEditing={() => goPlaySearch(eventQuery)}
              />
            </View>
            <View style={styles.listWrap}>
              {visibleNearby.length > 0 ? (
                visibleNearby.slice(0, 3).map((t) => (
                  <YTournamentRow
                    key={t.id}
                    tournament={t as any}
                    onPress={() => openTournament(t.id)}
                    style={{ marginBottom: 8 }}
                  />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <YUiText size={12} color={YColors.ink2}>No events in your city yet.</YUiText>
                </View>
              )}
            </View>
            <Pressable onPress={goPlay} hitSlop={8} style={styles.seeAll}>
              <YUiText size={11.5} weight={800} color={YColors.accent}>See all events →</YUiText>
            </Pressable>
          </View>
        )}

        {/* Venue admin now lives in the shortcut row above ("Manage my court",
            owners only) — the standalone banner was removed to avoid two entry
            points to the same dashboard. */}

        {/* FEATURED LEAGUES — horizontal slider of live/featured league banners.
            Swipes between many when more go live, with a "See all live leagues"
            link into the full LiveLeagues page. */}
        {SHOW_FEATURED_LEAGUES ? (
        <View style={styles.leagueSection}>
          <View style={styles.leagueHeadRow}>
            <YUiText size={10} weight={900} color={YColors.ink3} style={{ letterSpacing: 1.4 }}>
              {FEATURED_LEAGUES.length > 1 ? 'FEATURED LEAGUES' : 'FEATURED LEAGUE'}
            </YUiText>
            {liveLeagues().length > 0 ? (
              <Pressable onPress={goLiveLeagues} hitSlop={8}>
                <YUiText size={11.5} weight={800} color={YColors.accent}>
                  See all live leagues →
                </YUiText>
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={leagueCardW + LEAGUE_GAP}
            snapToAlignment="start"
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 16 }}
            onMomentumScrollEnd={onLeagueScroll}
          >
            {FEATURED_LEAGUES.map((l, i) => {
              const live = l.status === 'live';
              const last = i === FEATURED_LEAGUES.length - 1;
              return (
                <Pressable
                  key={l.key}
                  onPress={() => openLeague(l)}
                  style={({ pressed }) => [
                    styles.leagueBanner,
                    { width: leagueCardW, marginRight: last ? 0 : LEAGUE_GAP },
                    pressed && { opacity: 0.94 },
                  ]}
                >
                  <View style={styles.leagueTop}>
                    <View style={styles.leagueLogoWrap}>
                      <Image source={l.logo} style={styles.leagueLogo} resizeMode="cover" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <View style={styles.leagueTitleRow}>
                        <YDisplay size={26} color="#fff">{l.name}</YDisplay>
                        {live ? (
                          <View style={styles.livePill}>
                            <View style={styles.liveDot} />
                            <YUiText size={9} weight={900} color="#fff" style={{ letterSpacing: 1 }}>LIVE</YUiText>
                          </View>
                        ) : null}
                      </View>
                      <YUiText size={11} weight={800} color="rgba(255,255,255,0.62)" style={{ letterSpacing: 2, marginTop: 2 }}>
                        {l.season.toUpperCase()}
                      </YUiText>
                    </View>
                  </View>

                  {/* Live tile — current match when one is on, else a season summary */}
                  <View style={styles.leagueTile}>
                    <View style={styles.leagueTileDot} />
                    <YUiText size={12.5} weight={700} color="#fff" numberOfLines={1} style={{ flex: 1 }}>
                      {live ? 'Match underway — tap to watch live' : `${l.blurb} · ${l.season}`}
                    </YUiText>
                  </View>

                  <View style={styles.leagueFooter}>
                    <YUiText size={12} weight={600} color="rgba(255,255,255,0.75)">
                      Standings · Schedule · Fantasy
                    </YUiText>
                    <YUiText size={12.5} weight={900} color="#fff">
                      Open league →
                    </YUiText>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {FEATURED_LEAGUES.length > 1 ? (
            <View style={styles.leagueDots}>
              {FEATURED_LEAGUES.map((l, i) => (
                <View
                  key={l.key}
                  style={[styles.leagueDot, i === leaguePage && styles.leagueDotActive]}
                />
              ))}
            </View>
          ) : null}
        </View>
        ) : null}

        {/* ── Custom-tournament promo — rich media banner ── */}
        <Pressable onPress={getInTouch} style={styles.promo}>
          <ImageBackground
            source={require('../../../assets/bg/court-night.jpg')}
            style={styles.promoBg}
            imageStyle={{ resizeMode: 'cover' }}
          >
            <LinearGradient
              colors={['rgba(11,15,26,0.15)', 'rgba(20,40,90,0.55)', 'rgba(12,20,40,0.94)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.promoContent}>
              <YUiText size={11} weight={900} color="#fff" style={{ letterSpacing: 2 }}>
                CUSTOM TOURNAMENTS
              </YUiText>
              <YDisplay size={26} color="#fff" style={{ marginTop: 8 }}>
                Your rules. Your scoring.{'\n'}Our platform.
              </YDisplay>
              <YUiText size={12.5} weight={600} color="rgba(255,255,255,0.82)" style={{ marginTop: 8 }}>
                Leagues, auctions, live scoring and broadcast overlays — built around your format.
              </YUiText>
              <View style={styles.promoCta}>
                <YUiText size={12} weight={900} color={YColors.navy} style={{ letterSpacing: 0.4 }}>
                  GET IN TOUCH →
                </YUiText>
              </View>
            </View>
          </ImageBackground>
        </Pressable>

        {/* YOUR EVENTS — combined registrations + hosted */}
        {yourEvents.length > 0 ? (
          <>
            <YSectionHead
              eyebrow={`${yourEvents.length} ACTIVE`}
              title="YOUR EVENTS"
              action={yourEvents.length > 3 ? 'VIEW ALL →' : undefined}
              onActionPress={goPlay}
            />
            <View style={styles.listWrap}>
              {yourEvents.slice(0, 3).map(({ t, hosting }) => (
                <YTournamentRow
                  key={`${hosting ? 'host' : 'reg'}-${t.id}`}
                  tournament={t as any}
                  hosting={hosting}
                  onPress={() => openTournament(t.id)}
                  style={{ marginBottom: 8 }}
                />
              ))}
            </View>
          </>
        ) : null}

        {/* Editorial spacer / footer */}
        <View style={styles.footer}>
          <YEyebrow color={YColors.ink3}>YOIDEN · {new Date().getFullYear()}</YEyebrow>
          <YMono size={10} color={YColors.ink4} style={{ marginTop: 4 }}>
            EQUIP · ENGAGE
          </YMono>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Root gets accent bg so the top rubber-band overscroll (iOS) stays blue
  root: { flex: 1, backgroundColor: YColors.navy },

  // ── Blue header zone ──────────────────────────────────────────────
  headerZone: {
    backgroundColor: YColors.navy,
    paddingBottom: 8,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    // Lift the zone above the scroll bg so the curve sits cleanly
    overflow: 'hidden',
  },
  nameRow: {
    marginTop: 10,
  },
  heroAccent: {
    width: 46,
    height: 5,
    borderRadius: 3,
    backgroundColor: YColors.brandLine,
    marginTop: 10,
    marginBottom: 2,
  },
  // Compact DUPR-score chip in the hero's top-right (replaces the avatar).
  duprChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    minWidth: 54,
  },
  // Two mini stats (doubles | singles) inside the DUPR chip.
  duprStatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  duprStat: { alignItems: 'center', minWidth: 30 },
  duprDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.25)' },
  // Bare tappable location row — sits below the name, no pill
  locTag: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    marginTop: 6,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveCard: {
    marginHorizontal: 16,
    marginBottom: 4,
    padding: 18,
    backgroundColor: '#fff',
    borderWidth: 0,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  upcomingCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  upcomingCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  upcomingActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dirBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  pastBookingsLink: {
    alignSelf: 'flex-end',
    marginRight: 16,
    marginTop: 8,
    marginBottom: 2,
    paddingVertical: 2,
  },
  upcomingArrow: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: YColors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  hostNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
  },
  // ── Sport selector ────────────────────────────────────────────────
  courtCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: YColors.line2,
  },
  // Compact court cards (Book-tab layout, smaller) for the Home "Book" face.
  // faceBody already insets by 16; a second margin here made the card
  // narrower than the Book tab's and than the promo banner below it.
  courtList: { marginTop: 14, gap: 12 },
  // Matches the Book tab's court card exactly — same radius, image height,
  // padding and rhythm, so the two surfaces read as one component.
  venueCard: {
    backgroundColor: YColors.bg2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: YColors.line,
    overflow: 'hidden',
  },
  venueCardImage: { width: '100%', height: 150, backgroundColor: YColors.bg3 },
  venueCardBody: { padding: 16 },
  venueCardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  venueCardLoc: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  venueCardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  courtCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  courtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  courtRowDivider: {
    borderTopWidth: 1,
    borderTopColor: YColors.line,
  },
  courtThumb: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: YColors.bg3,
  },
  courtSkeleton: {
    height: 74,
    borderRadius: 12,
    backgroundColor: YColors.bg3,
  },
  sportSection: {
    paddingTop: 24,
    paddingBottom: 4,
  },
  sportRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
  },
  sportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line2,
  },
  sportChipActive: {
    backgroundColor: YColors.accent,
    borderColor: YColors.ink,
  },

  // ── Content (unchanged) ───────────────────────────────────────────
  quickRow: {
    marginTop: 24,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 10,
  },
  // ── Featured league slider ────────────────────────────────────────
  leagueSection: {
    marginTop: 18,
  },
  leagueHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  leagueDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  leagueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: YColors.line2,
  },
  leagueDotActive: {
    width: 18,
    backgroundColor: YColors.accentDeep,
  },
  leagueBanner: {
    backgroundColor: '#1858D6', // deep navy — reads as broadcast, not chrome
    borderRadius: 18,
    padding: 16,
    overflow: 'hidden',
  },
  leagueTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leagueLogoWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  leagueLogo: {
    width: '100%',
    height: '100%',
  },
  leagueTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: YColors.live,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  leagueTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 14,
  },
  leagueTileDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: YColors.accent,
  },
  leagueFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },

  organizeBar: {
    marginTop: 16,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: YColors.line2,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  organizeIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(24,88,214,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  organizeCta: {
    backgroundColor: YColors.accentDeep,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: 10,
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
  },
  shortcutTile: {
    flex: 1,
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line2,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    minHeight: 84,
  },
  shortcutTilePrimary: {
    backgroundColor: YColors.brandLine,
    borderColor: YColors.brandLine,
  },
  shortcutLabel: {
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  faceSection: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  faceBody: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  seeAll: {
    alignSelf: 'flex-end',
    marginTop: 10,
  },
  manageVenueRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  manageVenueChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1.5, borderColor: YColors.line2, backgroundColor: YColors.bg,
  },
  manageVenueChipOn: { backgroundColor: YColors.accent, borderColor: YColors.accent },
  promo: {
    marginHorizontal: 16,
    marginTop: 22,
    borderRadius: 18,
    overflow: 'hidden',
  },
  promoBg: {
    width: '100%',
    minHeight: 200,
    justifyContent: 'flex-end',
  },
  promoContent: {
    padding: 18,
  },
  promoCta: {
    marginTop: 16,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
  },
  faceHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  faceHeadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: YColors.line2,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: YColors.ink,
    paddingVertical: 0,
  },
  sectionAccent: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: YColors.brandLine,
    marginTop: 18,
    marginBottom: -6,
    marginLeft: 20,
  },
  bookCardWrap: {
    marginTop: 14,
    paddingHorizontal: 16,
  },
  bookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: YColors.accentDeep,
    borderRadius: 16,
    padding: 18,
  },
  listWrap: {
    paddingHorizontal: 16,
  },
  hostingTag: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  venueSkeleton: {
    height: 240,
    borderRadius: 14,
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line2,
    marginBottom: 14,
  },
  emptyState: {
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line,
    borderRadius: 12,
    padding: 18,
  },
  footer: {
    marginTop: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: YColors.line,
  },
});
