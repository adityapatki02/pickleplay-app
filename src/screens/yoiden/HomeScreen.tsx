import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
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
} from '../../components/yoiden';
import { useAuthStore } from '../../store/authStore';
import { tournamentsApi } from '../../api/tournaments.api';
import { registrationsApi } from '../../api/registrations.api';
import type { Tournament } from '../../types/tournament.types';
import { SPPL, type YoidenTabParamList } from '../../navigation/YoidenTabNavigator';

type Nav = BottomTabNavigationProp<YoidenTabParamList, 'HomeTab'>;

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
  const goSPPL = () =>
    nav.navigate('HomeTab', {
      screen: 'LeagueDashboard',
      params: { leagueId: SPPL.leagueId, seasonId: SPPL.seasonId },
    });
  const openTournament = (id: string) =>
    nav.navigate('HomeTab', { screen: 'TournamentDetail', params: { tournamentId: id } });

  // Pull tournaments out of registrations (when API populates them)
  const upcomingRegs = myRegs
    .map((r) => r.tournament)
    .filter((t): t is Tournament => !!t);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YColors.ink2} />
        }
      >
        {/* Greeting + actions */}
        <YTopBar
          title={
            <View>
              <YDisplay size={24} color={YColors.ink3}>HEY,</YDisplay>
              <YDisplay size={42} color={YColors.accent} style={{ marginTop: 12 }}>{firstName}</YDisplay>
            </View>
          }
          action={
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable style={styles.iconBtn} hitSlop={8}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 0 1-6 0"
                    stroke={YColors.ink}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    fill="none"
                  />
                </Svg>
              </Pressable>
              <Pressable onPress={goMe} hitSlop={4}>
                <YAvatar initials={initials(fullName)} size={38} color={YColors.lime} />
              </Pressable>
            </View>
          }
        />

        {/* Live hero — empty state */}
        <View style={styles.liveCard}>
          <YEyebrow color={YColors.ink3}>NO LIVE MATCHES</YEyebrow>
          <YDisplay size={28} color={YColors.ink} style={{ marginTop: 6 }}>
            ALL QUIET
          </YDisplay>
          <YUiText size={12} color={YColors.ink2} style={{ marginTop: 8 }}>
            Nothing courtside right now. Live coverage will appear here during a tournament.
          </YUiText>
        </View>

        {/* Big quick actions */}
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

        {/* Stat tiles */}
        <View style={[styles.quickRow, { marginTop: 10 }]}>
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
          <View style={{ flex: 1 }}>
            <YStatTile
              label="HOSTING"
              value={myHosted.length}
              accent={YColors.accent}
              icon={
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M3 21h18M5 21V8l7-4 7 4v13M9 12h2M13 12h2M9 16h2M13 16h2" stroke={YColors.ink} strokeWidth={1.6} strokeLinecap="round" fill="none" />
                </Svg>
              }
              onPress={goMe}
            />
          </View>
        </View>

        {/* Featured league — SPPL */}
        <View style={styles.featuredWrap}>
          <Pressable onPress={goSPPL} style={({ pressed }) => [styles.featuredCard, pressed && { opacity: 0.92 }]}>
            <View style={styles.featuredBadgeRow}>
              <View style={styles.featuredBadge}>
                <YUiText size={9} weight={900} color="#000" style={{ letterSpacing: 1.2 }}>FEATURED LEAGUE</YUiText>
              </View>
              <View style={styles.featuredLiveBadge}>
                <YUiText size={9} weight={900} color="#fff" style={{ letterSpacing: 1.2 }}>SEASON 1</YUiText>
              </View>
            </View>
            <YDisplay size={36} color="#fff" style={{ marginTop: 18, lineHeight: 34 }}>
              SPPL
            </YDisplay>
            <YUiText size={12} weight={700} color="rgba(255,255,255,0.85)" style={{ marginTop: 6, letterSpacing: 0.5 }}>
              SKY CITY PICKLEBALL PREMIER LEAGUE
            </YUiText>
            <View style={styles.featuredFooter}>
              <YUiText size={11} weight={800} color={YColors.lime} style={{ letterSpacing: 1 }}>
                VIEW LEAGUE  →
              </YUiText>
            </View>
          </Pressable>
        </View>

        {/* YOUR EVENTS — combined registrations + hosted */}
        {(upcomingRegs.length > 0 || myHosted.length > 0) ? (
          <>
            <YSectionHead
              eyebrow={`${upcomingRegs.length + myHosted.length} ACTIVE`}
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
              {myHosted.slice(0, 3).map((t) => (
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
          action={nearby.length > 0 ? 'ALL →' : undefined}
        />
        <View style={styles.listWrap}>
          {loading ? (
            <View style={{ paddingVertical: 24 }}>
              <YUiText size={12} color={YColors.ink3}>Loading…</YUiText>
            </View>
          ) : nearby.length === 0 ? (
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
            nearby.slice(0, 4).map((t) => (
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
  root: { flex: 1, backgroundColor: YColors.bg },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: YColors.bg3,
    borderWidth: 1,
    borderColor: YColors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveCard: {
    marginHorizontal: 16,
    marginBottom: 4,
    padding: 18,
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line2,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  quickRow: {
    marginTop: 12,
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
  featuredWrap: {
    marginTop: 22,
    paddingHorizontal: 16,
  },
  featuredCard: {
    borderRadius: 14,
    padding: 22,
    backgroundColor: YColors.accentDeep,
    minHeight: 180,
    overflow: 'hidden',
  },
  featuredBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  featuredBadge: {
    backgroundColor: YColors.lime,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 3,
  },
  featuredLiveBadge: {
    backgroundColor: '#000',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 3,
  },
  featuredFooter: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
