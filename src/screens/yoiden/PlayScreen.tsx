import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';

import {
  YColors,
  YDisplay,
  YEyebrow,
  YUiText,
  YTopBar,
  YTournamentRow,
  YButton,
} from '../../components/yoiden';
import { tournamentsApi } from '../../api/tournaments.api';
import { useAuthStore } from '../../store/authStore';
import type { Tournament } from '../../types/tournament.types';
import { liveLeagues, type FeaturedLeague } from '../../config/leagues';

// Previews before the "view all" link
const TOURNEYS_PREVIEW = 4;
const LEAGUES_PREVIEW = 3;

// Only surface what's live now or still ahead — drop finished/cancelled.
const isLiveOrUpcoming = (t: Tournament, todayStr: string) => {
  if (t.status === 'cancelled' || t.status === 'completed') return false;
  const end = (t.endDate || t.startDate || '').slice(0, 10);
  return !end || end >= todayStr;
};

const LEAGUE_STATUS = {
  live: { label: 'LIVE', bg: '#FDE7EA', fg: '#C1203A', dot: YColors.live },
  in_season: { label: 'IN SEASON', bg: '#E7F0FB', fg: '#185FA5', dot: YColors.accent },
} as const;

// Accented section header — lime "green line" + blue eyebrow/link so the page
// isn't a wall of black text.
const Section: React.FC<{
  eyebrow: string;
  title: string;
  action?: string;
  onAction?: () => void;
}> = ({ eyebrow, title, action, onAction }) => (
  <View style={styles.section}>
    <View style={styles.accentBar} />
    <View style={styles.sectionRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <YUiText size={11} weight={900} color={YColors.accent} style={{ letterSpacing: 1.2, marginBottom: 4 }}>
          {eyebrow}
        </YUiText>
        <YUiText size={17} weight={900} color={YColors.ink} style={{ letterSpacing: 0.4, textTransform: 'uppercase' }}>
          {title}
        </YUiText>
      </View>
      {action ? (
        <Pressable onPress={onAction} hitSlop={6}>
          <YUiText size={11} weight={900} color={YColors.accent} style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
            {action}
          </YUiText>
        </Pressable>
      ) : null}
    </View>
  </View>
);

// The "Events" tab — leagues (top) + tournaments (bottom). Courts live under Book.
export default function PlayScreen() {
  const nav = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const city = user?.city;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [showAllTourneys, setShowAllTourneys] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTournaments = useCallback(async () => {
    try {
      setError(null);
      const res = await tournamentsApi.discover({ city: city || undefined, limit: 50 });
      const data = (res.data as any)?.data ?? (res.data as any) ?? [];
      setTournaments(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Could not load tournaments');
      setTournaments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [city]);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTournaments();
  }, [fetchTournaments]);

  // Leagues that are live now or in season (completed ones excluded).
  const leagues = useMemo(() => liveLeagues(), []);
  const leaguePreview = leagues.slice(0, LEAGUES_PREVIEW);

  // Live / upcoming tournaments only.
  const upcoming = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return tournaments.filter((t) => isLiveOrUpcoming(t, todayStr));
  }, [tournaments]);
  const tourneyView = showAllTourneys ? upcoming : upcoming.slice(0, TOURNEYS_PREVIEW);

  const cityLabel = city ? city.toUpperCase() : 'NEAR YOU';
  const openDetail = (id: string) => nav.navigate('TournamentDetail', { tournamentId: id });
  const openCreate = () => nav.navigate('CreateTournament');
  const goAllLeagues = () => nav.navigate('LiveLeagues');
  const openLeague = (l: FeaturedLeague) =>
    nav.navigate('LeagueDashboard', { leagueId: l.leagueId, seasonId: l.seasonId });

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YColors.ink2} />
        }
      >
        <YTopBar
          eyebrow="WHAT'S ON"
          title={<YDisplay size={34} color={YColors.accent}>EVENTS</YDisplay>}
          action={
            <Pressable onPress={openCreate} style={styles.plusBtn} hitSlop={8}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M12 5v14M5 12h14" stroke={YColors.ink} strokeWidth={2.5} strokeLinecap="round" />
              </Svg>
            </Pressable>
          }
        />

        {/* ── Leagues (live / in season) ── */}
        {leagues.length > 0 ? (
          <>
            <Section
              eyebrow="LIVE NOW"
              title="LEAGUES"
              action={leagues.length > LEAGUES_PREVIEW ? 'ALL LEAGUES →' : undefined}
              onAction={goAllLeagues}
            />
            <View style={styles.listWrap}>
              {leaguePreview.map((l) => {
                const s = LEAGUE_STATUS[l.status as 'live' | 'in_season'] ?? LEAGUE_STATUS.in_season;
                return (
                  <Pressable
                    key={l.key}
                    onPress={() => openLeague(l)}
                    style={({ pressed }) => [styles.leagueRow, pressed && { opacity: 0.95 }]}
                  >
                    <View style={styles.leagueLogoWrap}>
                      <Image source={l.logo} style={styles.leagueLogo} resizeMode="cover" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={styles.leagueTitleRow}>
                        <YUiText size={15} weight={900} color={YColors.ink}>{l.name}</YUiText>
                        <View style={[styles.pill, { backgroundColor: s.bg }]}>
                          <View style={[styles.pillDot, { backgroundColor: s.dot }]} />
                          <YUiText size={8.5} weight={900} color={s.fg} style={{ letterSpacing: 0.8 }}>
                            {s.label}
                          </YUiText>
                        </View>
                      </View>
                      <YUiText size={11.5} weight={600} color={YColors.ink2} style={{ marginTop: 2 }}>
                        {l.season} · {l.sport}
                      </YUiText>
                    </View>
                    <YUiText size={22} color={YColors.ink3} style={{ marginLeft: 6 }}>›</YUiText>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {/* ── Tournaments (live / upcoming) ── */}
        <Section
          eyebrow={`${upcoming.length} IN ${cityLabel}`}
          title="TOURNAMENTS"
          action={!showAllTourneys && upcoming.length > TOURNEYS_PREVIEW ? 'ALL TOURNAMENTS →' : undefined}
          onAction={() => setShowAllTourneys(true)}
        />
        <View style={styles.listWrap}>
          {loading ? (
            <View style={styles.center}><ActivityIndicator color={YColors.ink2} /></View>
          ) : error ? (
            <View style={styles.miniEmpty}>
              <YEyebrow color={YColors.live}>COULDN'T LOAD</YEyebrow>
              <YUiText size={12.5} color={YColors.ink2} style={{ marginTop: 6 }}>{error}</YUiText>
            </View>
          ) : upcoming.length === 0 ? (
            <View style={styles.empty}>
              <YEyebrow color={YColors.ink3}>NO TOURNAMENTS</YEyebrow>
              <YDisplay size={24} style={{ marginTop: 8 }}>NOTHING COMING UP</YDisplay>
              <YUiText size={13} color={YColors.ink2} style={{ marginTop: 8, marginBottom: 16 }}>
                No live or upcoming tournaments in {city || 'your city'}. Be the first to host.
              </YUiText>
              <YButton variant="accent" size="md" onPress={openCreate}>HOST A TOURNAMENT</YButton>
            </View>
          ) : (
            <>
              {tourneyView.map((t) => (
                <YTournamentRow
                  key={t.id}
                  tournament={t as any}
                  onPress={() => openDetail(t.id)}
                  style={{ marginBottom: 8 }}
                />
              ))}
              <View style={{ marginTop: 16, alignItems: 'flex-start' }}>
                <YButton variant="accent" size="md" onPress={openCreate}>
                  + HOST A TOURNAMENT
                </YButton>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  listWrap: { paddingHorizontal: 16 },
  section: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 10 },
  accentBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: YColors.accent,
    marginBottom: 12,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  center: { padding: 40, alignItems: 'center' },
  miniEmpty: {
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line2,
    borderRadius: 12,
    padding: 16,
  },
  empty: { paddingVertical: 24 },

  // League rows
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: YColors.bg2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: YColors.line2,
    padding: 12,
    marginBottom: 8,
  },
  leagueLogoWrap: {
    width: 44,
    height: 44,
    borderRadius: 11,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: YColors.line2,
  },
  leagueLogo: { width: '100%', height: '100%' },
  leagueTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  pillDot: { width: 5, height: 5, borderRadius: 3 },
});
