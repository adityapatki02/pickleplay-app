import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { getTies, getFranchises, getSeasons } from '../../api/leagues.api';
import { YColors, YBadge } from '../../components/yoiden';
import type { Tie, Franchise } from '../../types/league.types';

const NAVY: string = YColors.ink;
const SUB: string = YColors.ink2;
const SURFACE: string = YColors.bg;
const BORDER: string = YColors.line2;
const WHITE = '#fff';
const GREEN = '#06D6A0';

const ROUND_LABELS: Record<string, string> = {
  knockout_qf1: 'Quarterfinal 1', knockout_qf2: 'Quarterfinal 2',
  knockout_qf3: 'Quarterfinal 3', knockout_qf4: 'Quarterfinal 4',
  knockout_sf1: 'Semifinal 1', knockout_sf2: 'Semifinal 2',
  knockout_final: 'Final',
};

const roundLabel = (round: string): string => {
  if (ROUND_LABELS[round]) return ROUND_LABELS[round];
  if (round?.startsWith('league_week_')) return `League · Week ${round.replace('league_week_', '')}`;
  return 'League';
};

const ScorerMatchesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { leagueId, seasonId: routeSeasonId } = (route.params || {}) as {
    leagueId: string;
    seasonId?: string;
  };
  const authUser = useAuthStore((s) => s.user);

  const [ties, setTies] = useState<Tie[]>([]);
  const [franchiseMap, setFranchiseMap] = useState<Record<string, Franchise>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      let seasonId = routeSeasonId;
      if (!seasonId) {
        const seasons = await getSeasons(leagueId).catch(() => [] as any[]);
        seasonId = Array.isArray(seasons) && seasons[0]?.id ? seasons[0].id : '';
      }
      const [tiesData, franchisesData] = await Promise.all([
        seasonId ? getTies(leagueId, seasonId).catch(() => [] as Tie[]) : Promise.resolve([] as Tie[]),
        getFranchises(leagueId).catch(() => [] as Franchise[]),
      ]);
      const fmap: Record<string, Franchise> = {};
      (Array.isArray(franchisesData) ? franchisesData : []).forEach((f) => (fmap[f.id] = f));
      setFranchiseMap(fmap);
      setTies(Array.isArray(tiesData) ? tiesData : []);
    } finally {
      setLoading(false);
    }
  }, [leagueId, routeSeasonId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const uid = authUser?.id;
  const mine = uid
    ? ties.filter((t) => [t.scorerId, t.scorer1Id, t.scorer2Id].includes(uid))
    : [];
  // Latest allocated (most recently updated — assignment or scoring) first.
  const byRecent = (a: Tie, b: Tie) =>
    new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
  const toScore = mine.filter((t) => t.status !== 'completed').sort(byRecent);
  const completed = mine.filter((t) => t.status === 'completed').sort(byRecent);

  const nameOf = (id?: string | null) =>
    (id && (franchiseMap[id]?.shortName || franchiseMap[id]?.name)) || 'TBD';

  const renderCard = (tie: Tie) => {
    const isLive = tie.status === 'in_progress';
    const isDone = tie.status === 'completed';
    const home = tie.homeTeamId ? nameOf(tie.homeTeamId) : (tie.homeTeam?.shortName || tie.homeTeam?.name || 'TBD');
    const away = tie.awayTeamId ? nameOf(tie.awayTeamId) : (tie.awayTeam?.shortName || tie.awayTeam?.name || 'TBD');
    const dateStr = tie.scheduledStart
      ? new Date(tie.scheduledStart).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
      : (tie.matchDay || '');
    const timeStr = tie.scheduledStart
      ? new Date(tie.scheduledStart).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      : '';
    return (
      <TouchableOpacity
        key={tie.id}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('TieDetail', { tieId: tie.id, leagueId })}
        style={[styles.card, isLive && { borderColor: GREEN, borderWidth: 2 }]}
      >
        <View style={styles.cardTop}>
          <View style={styles.badgeRow}>
            {tie.courtNumber ? <YBadge color="#0369A1" bg="#E0F2FE">{`COURT ${tie.courtNumber}`}</YBadge> : null}
            {tie.courtNumber2 ? <YBadge color="#0369A1" bg="#E0F2FE">{`COURT ${tie.courtNumber2}`}</YBadge> : null}
            <YBadge color={SUB} bg={SURFACE}>{roundLabel(tie.round)}</YBadge>
          </View>
          {isLive ? (
            <YBadge color="#065F46" bg="#D1FAE5">● LIVE</YBadge>
          ) : isDone ? (
            <YBadge color={SUB} bg={SURFACE}>DONE</YBadge>
          ) : timeStr ? (
            <YBadge color="#92400E" bg="#FEF3C7">{timeStr}</YBadge>
          ) : null}
        </View>

        <View style={styles.teamsRow}>
          <Text style={styles.team} numberOfLines={1}>{home}</Text>
          <Text style={styles.vs}>vs</Text>
          <Text style={[styles.team, { textAlign: 'right' }]} numberOfLines={1}>{away}</Text>
        </View>

        <View style={styles.cardBottom}>
          <Text style={styles.sub}>{dateStr}</Text>
          {isDone ? (
            <Text style={styles.score}>{tie.homeStandingPoints ?? 0} – {tie.awayStandingPoints ?? 0}</Text>
          ) : (
            <Text style={styles.open}>Open scoring ›</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('LeagueDashboard', { leagueId }))}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.back}
        >
          <Text style={styles.backTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🎯 Scorer's Matches</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={NAVY} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {mine.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No matches assigned to you yet</Text>
              <Text style={styles.emptySub}>When an organizer assigns you a tie, it'll show up here.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.section}>TO SCORE ({toScore.length})</Text>
              {toScore.length === 0 ? (
                <Text style={styles.emptyLine}>Nothing to score right now.</Text>
              ) : (
                toScore.map(renderCard)
              )}

              {completed.length > 0 && (
                <>
                  <Text style={[styles.section, { marginTop: 20 }]}>COMPLETED ({completed.length})</Text>
                  {completed.map(renderCard)}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: SURFACE },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12, backgroundColor: WHITE,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 30, color: NAVY, marginTop: -4 },
  title: { fontSize: 17, fontWeight: '900', color: NAVY },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 12, fontWeight: '900', color: SUB, letterSpacing: 0.8, marginBottom: 10 },
  card: {
    backgroundColor: WHITE, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    padding: 14, marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 },
  teamsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  team: { flex: 1, fontSize: 16, fontWeight: '800', color: NAVY },
  vs: { fontSize: 12, fontWeight: '700', color: SUB },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  sub: { fontSize: 12, color: SUB },
  score: { fontSize: 14, fontWeight: '900', color: NAVY },
  open: { fontSize: 13, fontWeight: '800', color: GREEN },
  emptyBox: { backgroundColor: WHITE, borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: NAVY, marginBottom: 6, textAlign: 'center' },
  emptySub: { fontSize: 12, color: SUB, textAlign: 'center' },
  emptyLine: { fontSize: 13, color: SUB, fontStyle: 'italic', marginBottom: 8 },
});

export default ScorerMatchesScreen;
