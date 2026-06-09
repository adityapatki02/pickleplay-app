import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getLeagues, getSeasons, getTies, getStandings, getFranchises, getTie } from '../../api/leagues.api';
import { getFantasyTrends, getFantasyLeaderboard, FantasyTrends, FantasyLeaderboardRow } from '../../api/fantasy.api';
import { useAuthStore } from '../../store/authStore';
import type { League, LeagueSeason, Tie, LeagueStanding, Franchise } from '../../types/league.types';

// ─── Design tokens ──────────────────────────────────────────────────────────
const SCREEN_WIDTH = Dimensions.get('window').width;
// Trend tile: show exactly 3 circles per screen width
const TREND_SIDE_PAD = 16;
const TREND_GAP = 10;
const TREND_ITEM_WIDTH = Math.floor((SCREEN_WIDTH - TREND_SIDE_PAD * 2 - TREND_GAP * 2) / 3);

const NAVY = '#001E40';
const BLUE = '#2196F3';
const GREEN = '#06D6A0';
const ORANGE = '#F59E0B';
const RED = '#EF4444';
const BG = '#FFFFFF';
const SURFACE = '#F5F7FA';
const BORDER = '#E2E8F0';
const TEXT = '#1A1D21';
const TEXT_SUB = '#64748B';
const TEXT_MUTED = '#94A3B8';

// ─── Helpers ────────────────────────────────────────────────────────────────
function getFirstName(fullName?: string): string {
  if (!fullName) return 'Organizer';
  const first = fullName.split(' ')[0];
  if (!first) return 'Organizer';
  // Title-case: first letter upper, rest lower
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

// ─── Main Screen ────────────────────────────────────────────────────────────
export default function OrganizerHomeScreen() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);

  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueSeasons, setLeagueSeasons] = useState<Record<string, LeagueSeason>>({});
  const [leagueTies, setLeagueTies] = useState<Record<string, Tie[]>>({});
  const [leagueStandings, setLeagueStandings] = useState<Record<string, LeagueStanding[]>>({});
  const [leagueFranchises, setLeagueFranchises] = useState<Record<string, Franchise[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fantasyTrends, setFantasyTrends] = useState<FantasyTrends | null>(null);
  const [fantasyLeaderboard, setFantasyLeaderboard] = useState<FantasyLeaderboardRow[]>([]);
  const [liveTieDetails, setLiveTieDetails] = useState<Record<string, Tie>>({});

  const isMounted = useRef(false);
  const trendScrollRef = useRef<ScrollView | null>(null);
  const trendIndexRef = useRef(0);

  // ── Data fetch ──
  const fetchData = useCallback(async () => {
    try {
      // Prefer leagues user organizes; fall back to all leagues so every user
      // sees SPPL content (admin-only UI is gated separately in render).
      let leaguesRes = await getLeagues({ organizerId: user?.id }).catch(() => []);
      if (!Array.isArray(leaguesRes) || leaguesRes.length === 0) {
        leaguesRes = await getLeagues().catch(() => []);
      }
      const leaguesData = (Array.isArray(leaguesRes) ? leaguesRes : []) as League[];
      setLeagues(leaguesData);

      const seasonsMap: Record<string, LeagueSeason> = {};
      const tiesMap: Record<string, Tie[]> = {};
      const standingsMap: Record<string, LeagueStanding[]> = {};
      const franchisesMap: Record<string, Franchise[]> = {};

      await Promise.all(
        leaguesData.map(async (league) => {
          try {
            const seasons = await getSeasons(league.id);
            const seasonsArr = Array.isArray(seasons) ? seasons : [];
            if (seasonsArr.length > 0) {
              const season = seasonsArr[0];
              seasonsMap[league.id] = season;

              const [tiesRes, standingsRes, franchisesRes] = await Promise.all([
                getTies(league.id, season.id).catch(() => []),
                getStandings(league.id, season.id).catch(() => ({ groups: [] })),
                getFranchises(league.id).catch(() => []),
              ]);

              tiesMap[league.id] = Array.isArray(tiesRes) ? tiesRes : [];

              let flatStandings: LeagueStanding[] = [];
              if (Array.isArray(standingsRes)) {
                flatStandings = standingsRes;
              } else if ((standingsRes as any)?.groups) {
                for (const g of (standingsRes as any).groups) {
                  if (g.standings) flatStandings.push(...g.standings);
                }
              }
              standingsMap[league.id] = flatStandings;
              franchisesMap[league.id] = Array.isArray(franchisesRes) ? franchisesRes : [];
            }
          } catch {}
        }),
      );

      setLeagueSeasons(seasonsMap);
      setLeagueTies(tiesMap);
      setLeagueStandings(standingsMap);
      setLeagueFranchises(franchisesMap);

      // Fetch detail for live ties to get current match score
      const liveTieIds = Object.values(tiesMap)
        .flat()
        .filter((t) => t.status === 'in_progress')
        .map((t) => t.id);
      if (liveTieIds.length > 0) {
        const details = await Promise.all(
          liveTieIds.map((tid) => getTie(tid).catch(() => null)),
        );
        const detailMap: Record<string, Tie> = {};
        details.forEach((d) => { if (d) detailMap[d.id] = d as Tie; });
        setLiveTieDetails(detailMap);
      } else {
        setLiveTieDetails({});
      }

      // Fetch fantasy data for the first league's active season
      const firstSeason = Object.values(seasonsMap)[0];
      if (firstSeason?.id) {
        const [trendsRes, lbRes] = await Promise.allSettled([
          getFantasyTrends(firstSeason.id),
          getFantasyLeaderboard(firstSeason.id, 5),
        ]);
        setFantasyTrends(trendsRes.status === 'fulfilled' ? trendsRes.value : null);
        setFantasyLeaderboard(lbRes.status === 'fulfilled' ? lbRes.value : []);
      }
    } catch (err) {
      console.warn('[OrganizerHome] fetchData failed', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!isMounted.current) {
        isMounted.current = true;
        fetchData();
      } else {
        fetchData();
      }
      // Live polling: refresh ties every 5s while screen is focused.
      // Surfaces in-progress score updates without requiring a manual reload.
      const id = setInterval(() => { fetchData(); }, 30000);
      return () => clearInterval(id);
    }, [fetchData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // ── Derived data ──
  // Flatten ties across all leagues, keep only upcoming/live, sort earliest first, top 5
  const upcomingFixtures = leagues
    .flatMap((league) => {
      const season = leagueSeasons[league.id];
      const franchises = leagueFranchises[league.id] || [];
      const franchiseMap: Record<string, Franchise> = {};
      franchises.forEach((f) => (franchiseMap[f.id] = f));
      return (leagueTies[league.id] || []).map((tie) => ({
        tie,
        leagueId: league.id,
        seasonId: season?.id || '',
        home: franchiseMap[tie.homeTeamId],
        away: franchiseMap[tie.awayTeamId],
      }));
    })
    .filter(({ tie }) => tie.status !== 'completed' && tie.status !== 'cancelled')
    .sort((a, b) => {
      const aT = new Date(a.tie.scheduledStart || a.tie.matchDay || 0).getTime();
      const bT = new Date(b.tie.scheduledStart || b.tie.matchDay || 0).getTime();
      return aT - bT;
    })
    .slice(0, 5);

  // ── Navigation helpers ──
  const openLeagueDashboard = (leagueId: string) => {
    navigation.navigate('MyEventsTab', {
      screen: 'LeagueDashboard',
      params: { screen: 'LeagueOverview', leagueId },
    });
  };
  const openTieDetail = (tieId: string, leagueId?: string) => {
    navigation.navigate('MyEventsTab', {
      screen: 'TieDetail',
      params: { tieId, leagueId },
    });
  };
  const openStandings = (leagueId: string, seasonId: string) => {
    navigation.navigate('MyEventsTab', {
      screen: 'Standings',
      params: { leagueId, seasonId },
    });
  };

  // Fantasy top trends — circular tiles (computed always, used in render)
  const topChampion = fantasyTrends?.champions?.[0];
  const topFinalist = fantasyTrends?.finalists?.[0];
  const topSemi = fantasyTrends?.semifinalists?.[0];
  const topAb = fantasyTrends?.abQualifiers?.[0];
  const topCd = fantasyTrends?.cdQualifiers?.[0];
  const allPlayerPicks = Object.values(fantasyTrends?.topPicks || {}).flat();
  const topPlayer = [...allPlayerPicks].sort((a, b) => b.pct - a.pct)[0];

  const trendTiles: Array<{ icon: string; color: string; value: string; label: string }> = [];
  if (topChampion) trendTiles.push({
    icon: '🏆', color: '#F59E0B',
    value: `${topChampion.pct}%`,
    label: `Pick ${topChampion.franchiseName} to win`,
  });
  if (topPlayer) trendTiles.push({
    icon: '⭐', color: '#2196F3',
    value: `${topPlayer.pct}%`,
    label: `${topPlayer.playerName} most picked`,
  });
  if (topFinalist) trendTiles.push({
    icon: '🥇', color: '#EF4444',
    value: `${topFinalist.pct}%`,
    label: `${topFinalist.franchiseName} in finals`,
  });
  if (topSemi) trendTiles.push({
    icon: '🎯', color: '#06D6A0',
    value: `${topSemi.pct}%`,
    label: `${topSemi.franchiseName} in semis`,
  });
  if (topAb) trendTiles.push({
    icon: '🅰️', color: '#8B5CF6',
    value: `${topAb.pct}%`,
    label: `${topAb.franchiseName} tops Pool AB`,
  });
  if (topCd) trendTiles.push({
    icon: '🅲', color: '#F97316',
    value: `${topCd.pct}%`,
    label: `${topCd.franchiseName} tops Pool CD`,
  });

  // Auto-scroll trend tiles — seamless infinite marquee.
  // We render the list twice so when x reaches the end of the first copy,
  // we can snap back to 0 invisibly (the pixels match).
  const trendCount = trendTiles.length;
  useEffect(() => {
    if (trendCount < 2) return;
    const ITEM_WIDTH = TREND_ITEM_WIDTH + TREND_GAP;
    const loopWidth = trendCount * ITEM_WIDTH;
    let x = 0;
    const id = setInterval(() => {
      x = x + 1;
      if (x >= loopWidth) x = 0;
      trendScrollRef.current?.scrollTo({ x, animated: false });
    }, 60);
    return () => clearInterval(id);
  }, [trendCount]);

  // ── Render ──
  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.brandBar}>
          <Image
            source={require('../../../assets/Logo.png')}
            style={s.brandLogoIcon}
            resizeMode="contain"
          />
        </View>
        <View style={s.loadingWrap}>
          <ActivityIndicator color={NAVY} />
        </View>
      </SafeAreaView>
    );
  }

  const primaryLeague = leagues[0];
  const primarySeason = primaryLeague ? leagueSeasons[primaryLeague.id] : undefined;
  const primaryTies = primaryLeague ? (leagueTies[primaryLeague.id] || []) : [];
  const primaryFranchises = primaryLeague ? (leagueFranchises[primaryLeague.id] || []) : [];
  const completedTies = primaryTies.filter((t) => t.status === 'completed').length;
  const totalTies = primaryTies.length;
  const inProgressTies = primaryTies.filter((t) => t.status === 'in_progress').length;
  const leaguePct = totalTies > 0 ? Math.round((completedTies / totalTies) * 100) : 0;

  return (
    <SafeAreaView style={s.root}>
      {/* ─── Brand Bar ─── */}
      <View style={s.brandBar}>
        <Image
          source={require('../../../assets/Logo.png')}
          style={s.brandLogoIcon}
          resizeMode="contain"
        />
        <View style={s.brandRight}>
          <Text style={s.brandGreeting}>{getFirstName(user?.fullName).toUpperCase()}</Text>
          <TouchableOpacity style={s.brandBell} activeOpacity={0.75}>
            <Text style={{ fontSize: 14 }}>🔔</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NAVY} />
        }
      >
        {/* ─── SPPL League Bar ─── */}
        {primaryLeague && (
          <TouchableOpacity
            style={s.leagueBar}
            activeOpacity={0.85}
            onPress={() => openLeagueDashboard(primaryLeague.id)}
          >
            <View style={s.leagueBarLeft}>
              <View style={s.leagueBarBadgeRow}>
                {inProgressTies > 0 ? (
                  <View style={s.leagueBarLiveBadge}>
                    <View style={s.leagueBarLiveDot} />
                    <Text style={s.leagueBarLiveText}>LIVE</Text>
                  </View>
                ) : (
                  <Text style={s.leagueBarStatus}>
                    {primarySeason?.status === 'league_phase' ? 'LEAGUE PHASE' : (primarySeason?.status || 'SETUP').toUpperCase().replace(/_/g, ' ')}
                  </Text>
                )}
              </View>
              <Text style={s.leagueBarTitle} numberOfLines={1}>{primaryLeague.name}</Text>
              <Text style={s.leagueBarSub} numberOfLines={1}>
                {primaryLeague.city ? `${primaryLeague.city} • ` : ''}
                {primaryFranchises.length} franchises
                {totalTies > 0 ? ` • ${totalTies} ties` : ''}
              </Text>
            </View>
            <View style={s.leagueBarRight}>
              <Text style={s.leagueBarPct}>{leaguePct}%</Text>
              <Text style={s.leagueBarArrow}>→</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ─── Quick actions row ─── */}
        {primaryLeague && primarySeason?.id && (
          <View style={s.quickActions}>
            <TouchableOpacity
              style={s.quickAction}
              activeOpacity={0.85}
              onPress={() => openStandings(primaryLeague.id, primarySeason.id)}
            >
              <Text style={s.quickActionIcon}>📊</Text>
              <Text style={s.quickActionLabel}>Standings</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Upcoming fixtures (earliest 5, tile carousel) ─── */}
        {upcomingFixtures.length > 0 && (
          <View style={fx.section}>
            <View style={{ paddingHorizontal: 20 }}>
              <Text style={fx.header}>UPCOMING FIXTURES</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={fx.listContent}
            >
              {upcomingFixtures.map(({ tie, leagueId, home, away }) => (
                <FixtureTile
                  key={tie.id}
                  tie={tie}
                  home={home}
                  away={away}
                  liveDetail={liveTieDetails[tie.id]}
                  isMyAssignedTie={!!user?.id && (tie as any).scorerId === user.id}
                  onPress={() => openTieDetail(tie.id, leagueId)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ─── League Management tile (admin only) ─── */}
        {primaryLeague && primaryLeague.organizerId === user?.id && (
          <TouchableOpacity
            style={mgmt.card}
            activeOpacity={0.85}
            onPress={() => openLeagueDashboard(primaryLeague.id)}
          >
            <View style={mgmt.iconWrap}>
              <Text style={mgmt.icon}>⚙️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={mgmt.badge}>ADMIN</Text>
              <Text style={mgmt.title}>League Management</Text>
              <Text style={mgmt.sub}>Ties, standings, franchises, scorers</Text>
            </View>
            <Text style={mgmt.arrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* ─── Fantasy CTA tile + stats row ─── */}
        {primarySeason?.id && (
          <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
            <TouchableOpacity
              style={fantasyStyles.card}
              activeOpacity={0.85}
              onPress={() => (navigation as any).navigate('Fantasy', { seasonId: primarySeason.id, leagueId: primaryLeague!.id })}
            >
              <Text style={fantasyStyles.badge}>🏆 SPPL FANTASY LEAGUE</Text>
              <Text style={fantasyStyles.title}>Pick Your Dream Team</Text>
              <Text style={fantasyStyles.sub}>
                Predict qualifiers • Build 16-player squad • Climb leaderboard
              </Text>
              <View style={fantasyStyles.ctaFantasy}>
                <Text style={fantasyStyles.ctaFantasyText}>PLAY NOW  →</Text>
              </View>
            </TouchableOpacity>

          </View>
        )}

        {/* Fantasy top trends — circular tiles */}
        {trendTiles.length > 0 && (
          <View style={trend.section}>
            <View style={{ paddingHorizontal: 20 }}>
              <Text style={trend.header}>TOP FANTASY TRENDS</Text>
            </View>
            <ScrollView
              ref={trendScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={trend.listContent}
            >
              {[...trendTiles, ...trendTiles].map((t, idx) => (
                <View key={idx} style={trend.item}>
                  <View style={[trend.circle, { borderColor: t.color }]}>
                    <Text style={[trend.circleValue, { color: t.color }]}>{t.value}</Text>
                    <Text style={trend.circleIcon}>{t.icon}</Text>
                  </View>
                  <Text style={trend.caption}>{t.label}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Fixture tile (horizontal carousel) ────────────────────────────────────
function FixtureTile({
  tie,
  home,
  away,
  liveDetail,
  isMyAssignedTie,
  onPress,
}: {
  tie: Tie;
  home?: Franchise;
  away?: Franchise;
  liveDetail?: Tie;
  isMyAssignedTie?: boolean;
  onPress: () => void;
}) {
  const when = tie.scheduledStart ? new Date(tie.scheduledStart) : (tie.matchDay ? new Date(tie.matchDay) : null);
  const dateLabel = when
    ? when.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).toUpperCase()
    : 'TBD';
  const timeLabel = when && tie.scheduledStart
    ? when.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    : '';
  const isLive = tie.status === 'in_progress';

  const homeName = home?.shortName || home?.name || 'TBD';
  const awayName = away?.shortName || away?.name || 'TBD';

  // Find in-progress match from liveDetail (if available)
  const tm = liveDetail?.tieMatches?.find((m) => m.match?.status === 'in_progress');
  let matchScoreHome = 0;
  let matchScoreAway = 0;
  if (tm?.match?.scores && tm.match.scores.length > 0) {
    // Use the most recent game
    const latest = tm.match.scores[tm.match.scores.length - 1];
    // teamA corresponds to home if teamAId === homeTeamId, else swap
    // teamA is always the home side (set during lineup lock) — home score = teamAScore, away = teamBScore.
    matchScoreHome = latest.teamAScore;
    matchScoreAway = latest.teamBScore;
  }
  const matchCategory = tm?.categorySlug?.replace(/_/g, ' ').toUpperCase();

  // Compute live tie standing points from completed matches (tie aggregates stale until tie complete).
  // Mirrors backend logic: match pointValue to winner + bonus (blowout/close/golden).
  let tieHomeLive = 0;
  let tieAwayLive = 0;
  if (liveDetail?.tieMatches) {
    for (const m of liveDetail.tieMatches) {
      const mm = m.match;
      if (!mm || mm.status !== 'completed' || !mm.scores?.length) continue;
      const s = mm.scores[0];
      const winnerScore = Math.max(s.teamAScore, s.teamBScore);
      const loserScore = Math.min(s.teamAScore, s.teamBScore);
      const wId = mm.winnerId;
      if (!wId) continue;
      const homeWon = wId === tie.homeTeamId || wId === mm.teamAId;
      if (homeWon) tieHomeLive += m.pointValue;
      else tieAwayLive += m.pointValue;

      // Rally Point Game: no bonus per SPPL rulebook § 15
      if ((m as any).isRallyPointGame) continue;

      // Bonus rules branch on match scoringMode.
      // rally_21 (knockout): loser≤7 → +2 winner, 14-19 + win=21 → +1 loser, 20 + win=21 → +2 loser
      // rally_15 (league):   loser≤4 → +2 winner, 11-13 + win=15 → +1 loser, 14 → +2 loser
      const mode = (mm as any).scoringMode;
      const is21 = mode === 'rally_21';
      if (is21) {
        if (loserScore <= 7) {
          if (homeWon) tieHomeLive += 2; else tieAwayLive += 2;
        } else if (loserScore >= 14 && loserScore <= 19 && winnerScore === 21) {
          if (homeWon) tieAwayLive += 1; else tieHomeLive += 1;
        } else if (loserScore === 20 && winnerScore === 21) {
          if (homeWon) tieAwayLive += 2; else tieHomeLive += 2;
        }
      } else {
        if (loserScore <= 4) {
          if (homeWon) tieHomeLive += 2; else tieAwayLive += 2;
        } else if (loserScore >= 11 && loserScore <= 13 && winnerScore === 15) {
          if (homeWon) tieAwayLive += 1; else tieHomeLive += 1;
        } else if (loserScore === 14) {
          if (homeWon) tieAwayLive += 2; else tieHomeLive += 2;
        }
      }
    }
  }
  const tieHomeDisplay = tie.status === 'completed' ? tie.homeStandingPoints : tieHomeLive;
  const tieAwayDisplay = tie.status === 'completed' ? tie.awayStandingPoints : tieAwayLive;

  // Human-readable knockout stage label (e.g. "FINAL", "QUALIFIER 1", "ELIMINATOR", "QF1")
  // Returns null for league ties.
  const KNOCKOUT_LABELS: Record<string, string> = {
    knockout_qf1: 'QF 1',
    knockout_qf2: 'QF 2',
    knockout_qf3: 'QF 3',
    knockout_qf4: 'QF 4',
    knockout_q1: 'QUALIFIER 1',
    knockout_eliminator: 'ELIMINATOR',
    knockout_q2: 'QUALIFIER 2',
    knockout_final: 'FINAL',
  };
  const stageLabel = KNOCKOUT_LABELS[(tie as any).round] || null;
  // Fallback-friendly team names for knockout ties before teams are seeded
  const KO_PLACEHOLDERS: Record<string, [string, string]> = {
    knockout_qf1: ['AB1', 'CD4'],
    knockout_qf2: ['AB2', 'CD3'],
    knockout_qf3: ['AB3', 'CD2'],
    knockout_qf4: ['AB4', 'CD1'],
    knockout_q1: ['H1', 'H2'],
    knockout_eliminator: ['H3', 'H4'],
    knockout_q2: ['Loser Q1', 'Winner Elim'],
    knockout_final: ['Winner Q1', 'Winner Q2'],
  };
  const koPh = KO_PLACEHOLDERS[(tie as any).round];
  const displayHomeName = (home?.shortName || home?.name) ? homeName : (koPh ? koPh[0] : 'TBD');
  const displayAwayName = (away?.shortName || away?.name) ? awayName : (koPh ? koPh[1] : 'TBD');

  return (
    <TouchableOpacity
      style={[
        fx.tile,
        isLive && fx.tileLive,
        isMyAssignedTie && { backgroundColor: '#ECFDF5', borderColor: '#06D6A0', borderWidth: 2 },
      ]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {isMyAssignedTie ? (
        <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#06D6A0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, zIndex: 2 }}>
          <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 }}>MY TIE</Text>
        </View>
      ) : null}
      <View style={fx.tileHeader}>
        <Text style={fx.tileDate}>{dateLabel}</Text>
        {isLive ? (
          <View style={fx.liveBadge}>
            <View style={fx.liveDot} />
            <Text style={fx.liveText}>LIVE</Text>
          </View>
        ) : timeLabel ? (
          <Text style={fx.tileTime}>{timeLabel}</Text>
        ) : null}
      </View>
      {stageLabel ? (
        <View style={{
          alignSelf: 'flex-start',
          backgroundColor: '#DBEAFE',
          borderRadius: 4,
          paddingHorizontal: 6,
          paddingVertical: 2,
          marginBottom: 6,
        }}>
          <Text style={{ fontSize: 9, fontWeight: '800', color: '#1D4ED8', letterSpacing: 0.8 }}>
            {stageLabel}
          </Text>
        </View>
      ) : null}

      {isLive ? (
        <>
          {/* Tie score row */}
          <View style={fx.scoreRow}>
            <Text style={fx.scoreTeam} numberOfLines={1}>{displayHomeName}</Text>
            <Text style={fx.scoreNum}>{tieHomeDisplay}</Text>
          </View>
          <View style={fx.scoreRow}>
            <Text style={fx.scoreTeam} numberOfLines={1}>{displayAwayName}</Text>
            <Text style={fx.scoreNum}>{tieAwayDisplay}</Text>
          </View>

          {/* Current match panel */}
          {tm ? (
            <View style={fx.matchPanel}>
              <Text style={fx.matchLabel}>
                NOW • {matchCategory}{tie.courtNumber ? ` • COURT ${tie.courtNumber}` : ''}
              </Text>
              <View style={fx.matchScoreRow}>
                <Text style={fx.matchScore}>{matchScoreHome}</Text>
                <Text style={fx.matchDash}>–</Text>
                <Text style={fx.matchScore}>{matchScoreAway}</Text>
              </View>
            </View>
          ) : (
            <Text style={fx.tileRound} numberOfLines={1}>
              {tie.courtNumber ? `COURT ${tie.courtNumber}` : ''}
            </Text>
          )}
        </>
      ) : (
        <>
          <Text style={fx.tileTeam} numberOfLines={1}>{displayHomeName}</Text>
          <Text style={fx.tileVs}>vs</Text>
          <Text style={fx.tileTeam} numberOfLines={1}>{displayAwayName}</Text>
          <Text style={fx.tileRound} numberOfLines={1}>
            {tie.courtNumber ? `COURT ${tie.courtNumber}` : ''}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // ─── Brand bar (top) ─────────────────────────────────────────────────────
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 12 : 14,
    paddingBottom: 14,
    backgroundColor: NAVY,
  },
  brandLogoIcon: {
    width: 32,
    height: 32,
    tintColor: '#FFFFFF',
  },
  brandRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandGreeting: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.8,
  },
  brandBell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── SPPL League bar (below brand) ───────────────────────────────────────
  leagueBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: NAVY,
    borderRadius: 14,
  },
  leagueBarLeft: { flex: 1 },
  leagueBarBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  leagueBarLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  leagueBarLiveDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: RED,
  },
  leagueBarLiveText: {
    fontSize: 9, fontWeight: '900',
    color: RED,
    letterSpacing: 1.2,
  },
  leagueBarStatus: {
    fontSize: 9,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: 1.5,
  },
  leagueBarTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: -0.5,
  },
  leagueBarSub: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_SUB,
    marginTop: 2,
  },
  leagueBarRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  leagueBarPct: {
    fontSize: 20,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: -0.5,
  },
  leagueBarArrow: {
    fontSize: 16,
    fontWeight: '900',
    color: NAVY,
  },

  loadingWrap: {
    paddingTop: 60,
    alignItems: 'center',
  },

  // Quick action chips under the league bar
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickActionIcon: {
    fontSize: 14,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: NAVY,
    letterSpacing: 0.3,
  },
});

// ─── Upcoming fixtures carousel ───────────────────────────────────────────
const fx = StyleSheet.create({
  section: {
    marginTop: 20,
  },
  header: {
    fontSize: 11,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: 2,
    marginBottom: 10,
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 10,
    paddingVertical: 4,
  },
  tile: {
    width: 170,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  tileLive: {
    borderWidth: 1.5,
    borderColor: 'rgba(239,68,68,0.35)',
    backgroundColor: '#FFF9F9',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  scoreTeam: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.2,
  },
  scoreNum: {
    fontSize: 16,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: -0.5,
    marginLeft: 8,
  },
  matchPanel: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    alignItems: 'center',
  },
  matchLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: RED,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  matchScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchScore: {
    fontSize: 20,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: -0.8,
  },
  matchDash: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_MUTED,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tileDate: {
    fontSize: 10,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: 1.2,
  },
  tileTime: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_SUB,
    letterSpacing: 0.4,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239,68,68,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: RED,
  },
  liveText: {
    fontSize: 8,
    fontWeight: '900',
    color: RED,
    letterSpacing: 1.2,
  },
  tileTeam: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.2,
  },
  tileVs: {
    fontSize: 9,
    fontWeight: '700',
    color: TEXT_MUTED,
    letterSpacing: 1.5,
    marginVertical: 2,
  },
  tileRound: {
    fontSize: 9,
    fontWeight: '800',
    color: TEXT_MUTED,
    letterSpacing: 1.2,
    marginTop: 8,
  },
});

// ─── Fantasy top trends (ESPN-style circular tiles) ───────────────────────
const trend = StyleSheet.create({
  section: {
    marginTop: 20,
  },
  header: {
    fontSize: 11,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: 2,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: TREND_SIDE_PAD,
  },
  item: {
    width: TREND_ITEM_WIDTH,
    alignItems: 'center',
    marginRight: TREND_GAP,
  },
  circle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  circleValue: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  circleIcon: {
    fontSize: 14,
    marginTop: 2,
  },
  caption: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT,
    textAlign: 'center',
    lineHeight: 13,
    textTransform: 'capitalize',
  },
});

// ─── League Management tile (admin only) ──────────────────────────────────
const mgmt = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    borderLeftWidth: 4,
    borderLeftColor: NAVY,
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0,30,64,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 22,
  },
  badge: {
    fontSize: 9,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: TEXT,
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_SUB,
    marginTop: 2,
  },
  arrow: {
    fontSize: 18,
    fontWeight: '900',
    color: NAVY,
  },
});

// Fantasy League CTA — navy background matching League hero card, with orange
// accent CTA and light-blue subtext. Visual-family with the League card but
// distinct enough to catch the eye.
const fantasyStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 18,
    backgroundColor: '#001E40', // brand navy (same as League card)
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F97316', // orange accent strip on the left edge
  },
  badge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#F97316', // orange
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  sub: {
    fontSize: 12,
    color: '#93C5FD', // light blue
    marginBottom: 10,
  },
  deadlinePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(249, 115, 22, 0.15)', // translucent orange
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 12,
  },
  deadlineText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FDBA74', // muted orange
    letterSpacing: 0.8,
  },
  ctaFantasy: {
    backgroundColor: '#F97316', // orange CTA button
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
  },
  ctaFantasyText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
});
