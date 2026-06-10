import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Ellipse, Line } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import {
  YColors,
  YDisplay,
  YEyebrow,
  YMono,
  YUiText,
  YTopBar,
  YAvatar,
  YBadge,
  YButton,
  YSectionHead,
  YTournamentRow,
  YQuickAction,
  YStatTile,
  YVenueEditorial,
  YVenueRow,
  type Venue,
} from '../../components/yoiden';
import { useAuthStore } from '../../store/authStore';
import { tournamentsApi } from '../../api/tournaments.api';
import { registrationsApi } from '../../api/registrations.api';
import type { Tournament } from '../../types/tournament.types';
import { SPPL, type YoidenTabParamList } from '../../navigation/YoidenTabNavigator';

type Nav = BottomTabNavigationProp<YoidenTabParamList, 'HomeTab'>;

// Featured tournaments shown on Home (both banner + Your Events + Nearby are
// filtered to this allowlist). Two slots:
//   1. AIPA West Zone — used for SHADOW SCORING (real KheloMore data)
//   2. AIPA West Zone — DEMO — sandbox twin for live demos (synthetic players)
// Clear both (set to []) to restore the full discover/your-events feed.
const FEATURED_TOURNAMENT_IDS = [
  '043c6b38-da45-41e9-968f-34f4d4d0bb05', // AIPA — live shadow
  '77e4837b-9730-4ba6-b070-65948ff70dc6', // AIPA — DEMO
] as const;

// Venues shown on Home. Mock data for now — swap for a venues API when available.
// 2 sponsored (editorial cards) + 6 normal (compact rows).
const SPONSORED_VENUES: Venue[] = [
  { id: 'v1', name: 'Apex Padel Club', area: 'Dockside', distanceKm: 1.2, rating: 4.9, reviews: 168, sponsored: true, sports: ['padel', 'tennis', 'football', 'swimming'], imageUrl: 'https://picsum.photos/seed/apexpadel/640/400' },
  { id: 'v2', name: 'Smash Arena', area: 'Riverside', distanceKm: 2.1, rating: 4.8, reviews: 204, sponsored: true, sports: ['tennis', 'basketball', 'football'], imageUrl: 'https://picsum.photos/seed/smasharena/640/400' },
];
const NORMAL_VENUES: Venue[] = [
  { id: 'v3', name: 'Riverside Sports Hub', area: 'Greenpoint', distanceKm: 2.5, rating: 4.8, reviews: 96, topRated: true, sports: ['football', 'basketball', 'swimming'], imageUrl: 'https://picsum.photos/seed/riverside/300/300' },
  { id: 'v4', name: 'Baseline Tennis Centre', area: 'Hillview', distanceKm: 3.1, rating: 4.6, reviews: 74, sports: ['tennis', 'padel'], imageUrl: 'https://picsum.photos/seed/baseline/300/300' },
  { id: 'v5', name: 'Net Zone Courts', area: 'Old Town', distanceKm: 3.8, rating: 4.5, reviews: 52, sports: ['pickleball', 'tennis', 'basketball'], imageUrl: 'https://picsum.photos/seed/netzone/300/300' },
  { id: 'v6', name: 'Grand Slam Academy', area: 'Lakeside', distanceKm: 4.4, rating: 4.7, reviews: 131, topRated: true, sports: ['tennis', 'football', 'swimming'], imageUrl: 'https://picsum.photos/seed/grandslam/300/300' },
  { id: 'v7', name: 'Rally Point Club', area: 'Westend', distanceKm: 5.0, rating: 4.4, reviews: 38, sports: ['padel', 'basketball'], imageUrl: 'https://picsum.photos/seed/rallypoint/300/300' },
  { id: 'v8', name: 'Ace Sports Park', area: 'Northgate', distanceKm: 5.6, rating: 4.3, reviews: 47, sports: ['football', 'tennis', 'basketball', 'swimming'], imageUrl: 'https://picsum.photos/seed/acepark/300/300' },
];

// Helpers
const unwrap = <T,>(res: any): T => (res?.data?.data ?? res?.data ?? res) as T;
const initials = (name: string) =>
  name
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

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
  const [activeSport, setActiveSport] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [regsRes, hostedRes, discoverRes] = await Promise.allSettled([
        registrationsApi.getMyRegistrations(),
        tournamentsApi.getMyTournaments(),
        tournamentsApi.discover({ limit: 5 }),
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
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  const goPlay = () => nav.navigate('PlayTab', { screen: 'Play' });
  const goHost = () => nav.navigate('PlayTab', { screen: 'CreateTournament' });
  const goMe = () => nav.navigate('MeTab', { screen: 'Me' });
  const openLocation = () => nav.navigate('HomeTab', { screen: 'CityPicker' });
  const goSPPL = () =>
    nav.navigate('HomeTab', {
      screen: 'LeagueDashboard',
      params: { leagueId: SPPL.leagueId, seasonId: SPPL.seasonId },
    });
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
  const visibleNearby = onlyFeatured(nearby);

  // Live card is shown only when at least one tournament spans today
  const todayStr = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  const hasTodayMatch = [...allUpcomingRegs, ...myHosted, ...nearby].some(
    (t) => t.startDate?.slice(0, 10) <= todayStr && t.endDate?.slice(0, 10) >= todayStr,
  );

  return (
    // SafeAreaView gets accent bg so the status-bar notch region is blue too
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
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
                {/* Location sits below the name */}
                <Pressable onPress={openLocation} hitSlop={8} style={styles.locTag}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 21s7-5.686 7-11a7 7 0 1 0-14 0c0 5.314 7 11 7 11z"
                      stroke={YColors.lime}
                      strokeWidth={2.4}
                      strokeLinejoin="round"
                      fill="none"
                    />
                    <Path
                      d="M12 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
                      stroke={YColors.lime}
                      strokeWidth={2.4}
                      fill="none"
                    />
                  </Svg>
                  <YUiText
                    size={12}
                    weight={500}
                    color="rgba(255,255,255,0.75)"
                    style={{ letterSpacing: 0.3 }}
                  >
                    {user?.city ? user.city.toUpperCase() : 'SET LOCATION'}
                  </YUiText>
                </Pressable>
              </View>
            }
            action={
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable style={styles.iconBtn} hitSlop={8}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 0 1-6 0"
                      stroke="#fff"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      fill="none"
                    />
                  </Svg>
                </Pressable>
                <Pressable onPress={goMe} hitSlop={4}>
                  <YAvatar
                    initials={initials(fullName)}
                    size={38}
                    color={YColors.lime}
                    textColor="#000"
                  />
                </Pressable>
              </View>
            }
          />

          {/* Live hero — only shown when a tournament is happening today */}
          {hasTodayMatch && (
            <View style={styles.liveCard}>
              <YEyebrow color={YColors.ink3}>NO LIVE MATCHES</YEyebrow>
              <YDisplay size={28} color={YColors.ink} style={{ marginTop: 6 }}>
                ALL QUIET
              </YDisplay>
              <YUiText size={12} color={YColors.ink2} style={{ marginTop: 8 }}>
                Nothing courtside right now. Live coverage will appear here during a tournament.
              </YUiText>
            </View>
          )}

          {/* Search bar — marks the bottom of the blue zone */}
          <View style={styles.searchWrap}>
            <View style={styles.searchBar}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M21 21l-4.3-4.3M10 17a7 7 0 1 1 0-14 7 7 0 0 1 0 14z"
                  stroke={YColors.ink3}
                  strokeWidth={2}
                  strokeLinecap="round"
                  fill="none"
                />
              </Svg>
              <TextInput
                style={styles.searchInput}
                placeholder="Search venues, tournaments…"
                placeholderTextColor={YColors.ink3}
                editable={false}
              />
            </View>
          </View>
        </View>

        {/* Big quick actions — bento grid, untouched */}
        <View style={styles.quickRow}>
          <View style={{ flex: 1 }}>
            <YQuickAction
              big
              label="HOST"
              sub="Run a tournament"
              color={YColors.lime}
              icon={
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M3 21h18M5 21V8l7-4 7 4v13M9 12h2M13 12h2M9 16h2M13 16h2" stroke="#000" strokeWidth={2} strokeLinecap="round" />
                </Svg>
              }
              onPress={goHost}
            />
          </View>
          <View style={{ flex: 1 }}>
            <YQuickAction
              big
              label="DISCOVER"
              sub={nearby.length > 0 ? `${nearby.length} tournaments` : 'Browse near you'}
              color={YColors.accent}
              icon={
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M21 21l-4.3-4.3M10 17a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
                </Svg>
              }
              onPress={goPlay}
            />
          </View>
        </View>

        {/* Stat tiles — only shown when the user has events or hosted tournaments */}
        {(upcomingRegs.length > 0 || visibleHosted.length > 0) && (
          <View style={[styles.quickRow, { marginTop: 10 }]}>
            {upcomingRegs.length > 0 && (
              <View style={{ flex: 1 }}>
                <YStatTile
                  label="MY EVENTS"
                  value={upcomingRegs.length}
                  accent={YColors.ink}
                  icon={
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path d="M7 4v2M17 4v2M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" stroke={YColors.ink} strokeWidth={1.6} strokeLinecap="round" fill="none" />
                    </Svg>
                  }
                  onPress={goMe}
                />
              </View>
            )}
            {visibleHosted.length > 0 && (
              <View style={{ flex: 1 }}>
                <YStatTile
                  label="HOSTING"
                  value={visibleHosted.length}
                  accent={YColors.accent}
                  icon={
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path d="M3 21h18M5 21V8l7-4 7 4v13M9 12h2M13 12h2M9 16h2M13 16h2" stroke={YColors.ink} strokeWidth={1.6} strokeLinecap="round" fill="none" />
                    </Svg>
                  }
                  onPress={goMe}
                />
              </View>
            )}
          </View>
        )}

        {/* Sport selector */}
        <View style={styles.sportSection}>
          <YUiText size={11} weight={900} color={YColors.ink3} style={{ letterSpacing: 1.2, paddingHorizontal: 20, marginBottom: 12 }}>
            CHOOSE A SPORT
          </YUiText>
          <View style={styles.sportRow}>
            {([
              { key: 'pickleball', label: 'Pickleball' },
              { key: 'badminton',  label: 'Badminton'  },
            ] as const).map(({ key, label }) => {
              const active = activeSport === key;
              const stroke = active ? YColors.ink : YColors.ink2;
              return (
                <Pressable
                  key={key}
                  onPress={() => setActiveSport(active ? null : key)}
                  style={[styles.sportChip, active && styles.sportChipActive]}
                >
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Ellipse cx={12} cy={8.5} rx={5.2} ry={6} stroke={stroke} strokeWidth={1.6} />
                    <Line x1={6.8} y1={8.5} x2={17.2} y2={8.5} stroke={stroke} strokeWidth={1} opacity={0.5} />
                    <Line x1={12} y1={2.6} x2={12} y2={14.4} stroke={stroke} strokeWidth={1} opacity={0.5} />
                    <Path d="M12 14.5V21" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
                  </Svg>
                  <YUiText size={13} weight={700} color={stroke}>{label}</YUiText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* VENUES NEARBY — 2 sponsored (editorial) + 6 normal (compact) */}
        <YSectionHead
          eyebrow={user?.city ? user.city.toUpperCase() : 'NEAR YOU'}
          title="VENUES NEARBY"
          action="ALL →"
          onActionPress={goPlay}
        />
        <View style={styles.listWrap}>
          {SPONSORED_VENUES.map((v) => (
            <YVenueEditorial key={v.id} venue={v} onPress={goPlay} style={{ marginBottom: 14 }} />
          ))}
          {NORMAL_VENUES.map((v) => (
            <YVenueRow key={v.id} venue={v} onPress={goPlay} style={{ marginBottom: 8 }} />
          ))}
        </View>

        {/* YOUR EVENTS — combined registrations + hosted */}
        {(upcomingRegs.length > 0 || visibleHosted.length > 0) ? (
          <>
            <YSectionHead
              eyebrow={`${upcomingRegs.length + visibleHosted.length} ACTIVE`}
              title="YOUR EVENTS"
            />
            <View style={styles.listWrap}>
              {upcomingRegs.slice(0, 3).map((t) => (
                <YTournamentRow
                  key={`reg-${t.id}`}
                  tournament={t as any}
                  onPress={() => openTournament(t.id)}
                  style={{ marginBottom: 8 }}
                />
              ))}
              {visibleHosted.slice(0, 3).map((t) => (
                <YTournamentRow
                  key={`host-${t.id}`}
                  tournament={t as any}
                  hosting
                  onPress={() => openTournament(t.id)}
                  style={{ marginBottom: 8 }}
                />
              ))}
            </View>
          </>
        ) : null}

        {/* UPCOMING NEARBY */}
        <YSectionHead
          eyebrow={user?.city ? user.city.toUpperCase() : 'INDIA'}
          title="UPCOMING NEARBY"
          action={visibleNearby.length > 0 ? 'ALL →' : undefined}
        />
        <View style={styles.listWrap}>
          {loading ? (
            <View style={{ paddingVertical: 24 }}>
              <YUiText size={12} color={YColors.ink3}>Loading…</YUiText>
            </View>
          ) : visibleNearby.length === 0 ? (
            <View style={styles.emptyState}>
              <YEyebrow color={YColors.ink3}>NOTHING YET</YEyebrow>
              <YUiText size={12} color={YColors.ink2} style={{ marginTop: 6 }}>
                No tournaments in your city right now. Be the first to host.
              </YUiText>
              <View style={{ marginTop: 14 }}>
                <YButton size="sm" variant="primary" onPress={goHost}>
                  HOST A TOURNAMENT
                </YButton>
              </View>
            </View>
          ) : (
            visibleNearby.slice(0, 4).map((t) => (
              <YTournamentRow
                key={t.id}
                tournament={t as any}
                onPress={() => openTournament(t.id)}
                style={{ marginBottom: 8 }}
              />
            ))
          )}
        </View>

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
  root: { flex: 1, backgroundColor: YColors.accent },

  // ── Blue header zone ──────────────────────────────────────────────
  headerZone: {
    backgroundColor: YColors.accent,
    paddingBottom: 8,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    // Lift the zone above the scroll bg so the curve sits cleanly
    overflow: 'hidden',
  },
  nameRow: {
    marginTop: 10,
  },
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
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: YColors.ink,
  },

  // ── Sport selector ────────────────────────────────────────────────
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
    backgroundColor: YColors.lime,
    borderColor: YColors.ink,
  },

  // ── Content (unchanged) ───────────────────────────────────────────
  quickRow: {
    marginTop: 24,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 10,
  },
  listWrap: {
    paddingHorizontal: 16,
  },
  hostingTag: {
    position: 'absolute',
    top: 8,
    right: 8,
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
