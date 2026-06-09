/**
 * RankingsScreen — per-category final ranking view.
 *
 * Same two-step picker pattern as Standings:
 *   step 1 (brackets):  U12 / U14 / U18 / Open / 35+ / 50+ / 60+ / Beg/Int
 *   step 2 (events):    M Singles / W Singles / M Doubles / W Doubles / Mixed
 *   step 3 (detail):    Final ranking table, derived from knockout + pool data.
 *
 * Ranking algorithm (no points system):
 *   1. CHAMPION    — final winner
 *   2. RUNNER-UP   — final loser
 *   3-4. SEMIFINAL — SF losers, ordered by pool point diff desc
 *   5-8. QUARTER   — QF losers, ordered by pool point diff desc
 *   9+.  POOL      — remaining teams that played, by wins desc / pdiff desc
 *   last. N/A      — teams with no completed matches
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../api/client';
import { tournamentsApi } from '../../api/tournaments.api';
import { matchesApi } from '../../api/matches.api';
import { YColors, YTopBar } from '../../components/yoiden';

type CategorySummary = { id: string; name: string; format: string; registeredTeams?: number };

const BRACKET_ORDER = ['U12', 'U14', 'U18', 'Open', '35+', '50+', '60+', 'Beg/Int'];
const SEP = ' — ';

type Standing = {
  teamId: string; name: string; rank: number;
  wins: number; losses: number; pointsFor: number; pointsAgainst: number;
  pointDiff: number; isEliminated: boolean;
};

type Pool = { poolNumber: number; standings: Standing[] };

type LoggedMatch = {
  id: string; round: string; matchNumber: number; status: string;
  teamAId: string; teamBId: string; winnerId?: string;
  teamAName?: string | null; teamBName?: string | null; winnerName?: string | null;
  scores?: { teamAScore: number; teamBScore: number }[];
};

type RankRow = {
  rank: number;
  teamId: string;
  name: string;
  stage: 'CHAMPION' | 'RUNNER-UP' | 'SEMIFINAL' | 'QUARTERFINAL' | 'POOL' | 'N/A';
};

const STAGE_COLORS: Record<RankRow['stage'], { bg: string; fg: string }> = {
  'CHAMPION':    { bg: '#FFD60A', fg: '#000' },
  'RUNNER-UP':   { bg: '#C7C7C7', fg: '#000' },
  'SEMIFINAL':   { bg: '#CD7F32', fg: '#fff' },
  'QUARTERFINAL':{ bg: YColors.ink, fg: '#fff' },
  'POOL':        { bg: YColors.bg3, fg: YColors.ink2 },
  'N/A':         { bg: YColors.bg3, fg: YColors.ink3 },
};

export default function RankingsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const tournamentId: string = route.params?.tournamentId;

  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [view, setView] = useState<'brackets' | 'events' | 'detail'>('brackets');
  const [activeBracket, setActiveBracket] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const [pools, setPools] = useState<Pool[]>([]);
  const [allMatches, setAllMatches] = useState<LoggedMatch[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Load categories ───────────────────────────────────────────────
  const fetchCategories = useCallback(async () => {
    try {
      const res = await tournamentsApi.getById(tournamentId);
      const t: any = (res.data as any)?.data ?? res.data;
      const cats: any[] = Array.isArray(t?.categories) ? t.categories : [];
      setCategories(cats.map((c) => ({
        id: c.id, name: c.name, format: c.format, registeredTeams: c.registeredTeams ?? 0,
      })));
    } catch {}
    setCategoriesLoading(false);
  }, [tournamentId]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  // ── Load detail (standings + matches) when category selected ──────
  const fetchDetail = useCallback(async (catId: string) => {
    setDetailLoading(true);
    try {
      const [sRes, mRes] = await Promise.all([
        apiClient.get(`/tournaments/${tournamentId}/categories/${catId}/standings`),
        matchesApi.listManualMatches(tournamentId, catId),
      ]);
      const sData: any = (sRes.data as any)?.data ?? sRes.data;
      const poolList: Pool[] = Array.isArray(sData?.pools) ? sData.pools : [];
      setPools(poolList);
      const mData: any[] = (mRes.data as any)?.data ?? mRes.data ?? [];
      setAllMatches(mData);
    } catch {
      setPools([]); setAllMatches([]);
    } finally {
      setDetailLoading(false);
    }
  }, [tournamentId]);
  useEffect(() => {
    if (view === 'detail' && activeCategoryId) fetchDetail(activeCategoryId);
  }, [view, activeCategoryId, fetchDetail]);

  // ── Compute final ranking ─────────────────────────────────────────
  const ranking: RankRow[] = useMemo(() => {
    // Build team registry from pools + matches
    const teamName: Record<string, string> = {};
    for (const p of pools) for (const t of p.standings) teamName[t.teamId] = t.name;
    for (const m of allMatches) {
      if (m.teamAName) teamName[m.teamAId] = m.teamAName;
      if (m.teamBName) teamName[m.teamBId] = m.teamBName;
    }

    // Pool metrics for tie-breaking
    const poolWins: Record<string, number> = {};
    const poolPdiff: Record<string, number> = {};
    const poolPlayed: Record<string, boolean> = {};
    for (const p of pools) {
      for (const t of p.standings) {
        poolWins[t.teamId] = t.wins;
        poolPdiff[t.teamId] = t.pointDiff;
        poolPlayed[t.teamId] = (t.wins + t.losses) > 0;
      }
    }

    const completed = allMatches.filter((m) => m.status === 'completed');
    const finalM = completed.find((m) => m.round === 'final') ?? null;
    const sfMatches = completed.filter((m) => m.round === 'sf');
    const qfMatches = completed.filter((m) => m.round === 'qf');

    const used = new Set<string>();
    const rows: RankRow[] = [];

    // CHAMPION + RUNNER-UP from final
    if (finalM && finalM.winnerId) {
      const champId = finalM.winnerId;
      const loserId = finalM.winnerId === finalM.teamAId ? finalM.teamBId : finalM.teamAId;
      if (champId) {
        rows.push({ rank: 1, teamId: champId, name: teamName[champId] || 'TBD', stage: 'CHAMPION' });
        used.add(champId);
      }
      if (loserId) {
        rows.push({ rank: 2, teamId: loserId, name: teamName[loserId] || 'TBD', stage: 'RUNNER-UP' });
        used.add(loserId);
      }
    }

    // SEMIFINAL losers (both lose to finalists, so 2 teams)
    const sfLosers: string[] = [];
    for (const m of sfMatches) {
      if (!m.winnerId) continue;
      const loserId = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
      if (loserId && !used.has(loserId)) sfLosers.push(loserId);
    }
    sfLosers.sort((a, b) => (poolPdiff[b] ?? -999) - (poolPdiff[a] ?? -999));
    for (const tid of sfLosers) {
      rows.push({ rank: rows.length + 1, teamId: tid, name: teamName[tid] || 'TBD', stage: 'SEMIFINAL' });
      used.add(tid);
    }

    // QUARTERFINAL losers (up to 4 teams)
    const qfLosers: string[] = [];
    for (const m of qfMatches) {
      if (!m.winnerId) continue;
      const loserId = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
      if (loserId && !used.has(loserId)) qfLosers.push(loserId);
    }
    qfLosers.sort((a, b) => (poolPdiff[b] ?? -999) - (poolPdiff[a] ?? -999));
    for (const tid of qfLosers) {
      rows.push({ rank: rows.length + 1, teamId: tid, name: teamName[tid] || 'TBD', stage: 'QUARTERFINAL' });
      used.add(tid);
    }

    // POOL — remaining teams that played at least one match
    const poolRest: { id: string; wins: number; pdiff: number }[] = [];
    for (const tid of Object.keys(teamName)) {
      if (used.has(tid)) continue;
      if (!poolPlayed[tid]) continue;
      poolRest.push({ id: tid, wins: poolWins[tid] ?? 0, pdiff: poolPdiff[tid] ?? 0 });
    }
    poolRest.sort((a, b) => b.wins - a.wins || b.pdiff - a.pdiff);
    for (const t of poolRest) {
      rows.push({ rank: rows.length + 1, teamId: t.id, name: teamName[t.id] || 'TBD', stage: 'POOL' });
      used.add(t.id);
    }

    // N/A — teams with no completed matches
    const naRows: RankRow[] = [];
    for (const tid of Object.keys(teamName)) {
      if (used.has(tid)) continue;
      naRows.push({ rank: 0, teamId: tid, name: teamName[tid] || 'TBD', stage: 'N/A' });
    }
    naRows.sort((a, b) => a.name.localeCompare(b.name));
    for (const r of naRows) {
      rows.push({ ...r, rank: rows.length + 1 });
    }

    return rows;
  }, [pools, allMatches]);

  // ── Group categories by bracket ───────────────────────────────────
  const byBracket = new Map<string, { id: string; eventName: string; count: number }[]>();
  for (const c of categories) {
    const i = c.name.indexOf(SEP);
    const bracket = i >= 0 ? c.name.slice(0, i).trim() : c.name;
    const eventName = i >= 0 ? c.name.slice(i + SEP.length).trim() : c.name;
    if (!byBracket.has(bracket)) byBracket.set(bracket, []);
    byBracket.get(bracket)!.push({ id: c.id, eventName, count: c.registeredTeams ?? 0 });
  }
  const bracketList = [
    ...BRACKET_ORDER.filter((b) => byBracket.has(b)),
    ...Array.from(byBracket.keys()).filter((b) => !BRACKET_ORDER.includes(b)),
  ];

  if (categoriesLoading) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.center}><ActivityIndicator size="large" color={YColors.ink} /></View>
      </SafeAreaView>
    );
  }

  // ── STEP 1: bracket picker ────────────────────────────────────────
  if (view === 'brackets') {
    return (
      <SafeAreaView style={s.screen}>
        <YTopBar
          eyebrow="ORGANIZER · RANKINGS"
          title="RANKINGS"
          onBack={() => navigation.goBack()}
        />
        <ScrollView contentContainerStyle={s.gridScroll}>
          <Text style={s.gridHint}>Pick a bracket</Text>
          <View style={s.gridWrap}>
            {bracketList.map((bracket) => {
              const events = byBracket.get(bracket) ?? [];
              const totalTeams = events.reduce((sum, e) => sum + e.count, 0);
              return (
                <TouchableOpacity
                  key={bracket}
                  style={s.bracketTile}
                  onPress={() => { setActiveBracket(bracket); setView('events'); }}
                >
                  <Text style={s.bracketTileName} numberOfLines={1}>{bracket}</Text>
                  <View style={s.bracketPill}>
                    <Text style={s.bracketPillText}>{totalTeams} teams · {events.length} events</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── STEP 2: event picker ──────────────────────────────────────────
  if (view === 'events') {
    const events = activeBracket ? byBracket.get(activeBracket) ?? [] : [];
    return (
      <SafeAreaView style={s.screen}>
        <YTopBar
          eyebrow={`${activeBracket?.toUpperCase()} · PICK EVENT`}
          title="RANKINGS"
          onBack={() => { setActiveBracket(null); setView('brackets'); }}
        />
        <ScrollView contentContainerStyle={s.gridScroll}>
          <Text style={s.gridHint}>Pick an event in {activeBracket}</Text>
          <View style={s.gridWrap}>
            {events.map((ev) => (
              <TouchableOpacity
                key={ev.id}
                style={s.gridTile}
                onPress={() => { setActiveCategoryId(ev.id); setView('detail'); }}
              >
                <Text style={s.gridTileName} numberOfLines={2}>{ev.eventName}</Text>
                <View style={[s.pill, ev.count === 0 && s.pillMuted]}>
                  <Text style={[s.pillText, ev.count === 0 && s.pillTextMuted]}>{ev.count} teams</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── STEP 3: detail (ranking table) ────────────────────────────────
  const currentCat = categories.find((c) => c.id === activeCategoryId);
  const champion = ranking.find((r) => r.stage === 'CHAMPION');

  return (
    <SafeAreaView style={s.screen}>
      <YTopBar
        eyebrow={currentCat?.name?.toUpperCase() ?? 'CATEGORY'}
        title="RANKINGS"
        onBack={() => { setActiveCategoryId(null); setView('events'); }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, flexGrow: 1 }}
      >
        {detailLoading ? (
          <View style={s.center}><ActivityIndicator color={YColors.ink} /></View>
        ) : ranking.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyText}>No ranking data available for this category yet.</Text>
          </View>
        ) : (
          <>
            {champion && (
              <View style={s.championCard}>
                <Text style={s.championEyebrow}>🏆 CHAMPION</Text>
                <Text style={s.championName} numberOfLines={2}>{champion.name}</Text>
              </View>
            )}

            <Text style={s.sectionHeader}>FINAL RANKING</Text>
            <View style={s.rankCard}>
              <View style={s.rankHeaderRow}>
                <Text style={[s.thCell, { width: 36 }]}>#</Text>
                <Text style={[s.thCell, { width: 102 }]}>STAGE</Text>
                <Text style={[s.thCell, { flex: 1 }]}>PLAYER / TEAM</Text>
              </View>
              {ranking.map((r) => {
                const c = STAGE_COLORS[r.stage];
                const isTop = r.stage === 'CHAMPION';
                // Split doubles team names on " & " or " / " so both partners are visible
                const parts = r.name.split(/\s*[&/]\s*/).map((p) => p.trim()).filter(Boolean);
                return (
                  <View key={r.teamId} style={[s.rankRow, isTop && s.rankRowTop]}>
                    <Text style={[s.tdRank, isTop && s.tdBold]}>{r.rank}</Text>
                    <View style={[s.stageBadge, { backgroundColor: c.bg, width: 92 }]}>
                      <Text style={[s.stageBadgeText, { color: c.fg }]} numberOfLines={1}>{r.stage}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      {parts.length > 1 ? (
                        parts.map((p, i) => (
                          <Text key={i} style={[s.tdName, isTop && s.tdBold]} numberOfLines={1}>{p}</Text>
                        ))
                      ) : (
                        <Text style={[s.tdName, isTop && s.tdBold]} numberOfLines={2}>{r.name}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: YColors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  // Grid (steps 1+2)
  gridScroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  gridHint: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: YColors.ink2, textTransform: 'uppercase', marginBottom: 12 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridTile: { width: '48.5%', minHeight: 92, backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, justifyContent: 'space-between' },
  gridTileName: { fontSize: 13, fontWeight: '900', color: YColors.ink, letterSpacing: 0.3, textTransform: 'uppercase', lineHeight: 16 },
  pill: { backgroundColor: YColors.ink, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start', marginTop: 10 },
  pillMuted: { backgroundColor: YColors.line },
  pillText: { color: YColors.lime, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  pillTextMuted: { color: YColors.ink2 },
  bracketTile: { width: '48.5%', minHeight: 110, backgroundColor: YColors.ink, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 16, justifyContent: 'space-between' },
  bracketTileName: { fontSize: 28, fontWeight: '900', color: YColors.lime, letterSpacing: 0.5, lineHeight: 30 },
  bracketPill: { backgroundColor: YColors.lime, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  bracketPillText: { color: YColors.ink, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },

  // Champion banner
  championCard: {
    marginTop: 12, marginBottom: 6, padding: 18, borderRadius: 16,
    backgroundColor: YColors.lime, borderWidth: 1, borderColor: YColors.ink,
  },
  championEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.6, color: YColors.ink, marginBottom: 6 },
  championName: { fontSize: 22, fontWeight: '900', color: YColors.ink, letterSpacing: 0.4, lineHeight: 26 },

  sectionHeader: { fontSize: 11, fontWeight: '900', letterSpacing: 1.6, color: YColors.ink2, textTransform: 'uppercase', marginTop: 22, marginBottom: 10 },

  emptyState: { padding: 24, alignItems: 'center', backgroundColor: YColors.bg2, borderRadius: 14, borderWidth: 1, borderColor: YColors.line, borderStyle: 'dashed', marginTop: 12 },
  emptyText: { fontSize: 12, color: YColors.ink3, textAlign: 'center' },

  // Ranking table
  rankCard: { backgroundColor: YColors.bg2, borderRadius: 14, borderWidth: 1, borderColor: YColors.line, overflow: 'hidden' },
  rankHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: YColors.ink },
  thCell: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8, color: YColors.lime },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: YColors.line, gap: 10 },
  rankRowTop: { backgroundColor: 'rgba(200, 242, 50, 0.18)' },
  tdRank: { width: 26, fontSize: 14, fontWeight: '900', color: YColors.ink, textAlign: 'left' },
  tdName: { fontSize: 13, fontWeight: '700', color: YColors.ink, lineHeight: 17 },
  tdBold: { fontWeight: '900' },
  stageBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  stageBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
});
