/**
 * StandingsScreen — read-only standings + knockout + champion view per category.
 *
 * Same two-step picker pattern as Score Logger:
 *   step 1 (brackets):  U12 / U14 / U18 / Open / 35+ / 50+ / 60+ / Beg/Int
 *   step 2 (events):    M Singles / W Singles / M Doubles / W Doubles / Mixed
 *   step 3 (detail):    Pool standings tables + knockout rounds + champion banner
 *
 * Fetches:
 *   GET /tournaments/:tid/categories/:cid/standings  -> pools + W/L/PF/PA
 *   GET /tournaments/:tid/categories/:cid/manual-matches -> matches with team names
 *     (used to derive knockout rounds + champion)
 */

import React, { useCallback, useEffect, useState } from 'react';
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

const ROUND_LABELS: Record<string, string> = {
  qf: 'Quarter Finals',
  sf: 'Semi Finals',
  final: 'Final',
};
const KO_ORDER = ['qf', 'sf', 'final'];

export default function StandingsScreen() {
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
  const [detailTab, setDetailTab] = useState<'roundrobin' | 'knockout'>('roundrobin');

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

  // ── Load detail (standings + KO) when category selected ───────────
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
      // Default tab: if pools exist, show round robin first; else jump to knockout
      setDetailTab(poolList.length > 0 ? 'roundrobin' : 'knockout');
    } catch {
      setPools([]); setAllMatches([]);
    } finally {
      setDetailLoading(false);
    }
  }, [tournamentId]);
  useEffect(() => {
    if (view === 'detail' && activeCategoryId) fetchDetail(activeCategoryId);
  }, [view, activeCategoryId, fetchDetail]);

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
          eyebrow="ORGANIZER · STANDINGS"
          title="STANDINGS"
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
          title="STANDINGS"
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

  // ── STEP 3: detail ────────────────────────────────────────────────
  const currentCat = categories.find((c) => c.id === activeCategoryId);

  // Split matches into pool vs knockout
  const koMatches = allMatches.filter((m) => KO_ORDER.includes(m.round));
  const poolMatchesRaw = allMatches.filter((m) => m.round === 'pool' || m.round === 'manual');

  // Group pool matches by pool number using team→pool from standings
  const teamPool: Record<string, number> = {};
  for (const pool of pools) {
    for (const t of pool.standings) teamPool[t.teamId] = pool.poolNumber;
  }
  const poolMatchesByPool: Record<number, LoggedMatch[]> = {};
  const orphanPoolMatches: LoggedMatch[] = []; // matches whose teams have no pool#
  for (const m of poolMatchesRaw) {
    const pn = teamPool[m.teamAId] ?? teamPool[m.teamBId];
    if (pn) {
      if (!poolMatchesByPool[pn]) poolMatchesByPool[pn] = [];
      poolMatchesByPool[pn].push(m);
    } else {
      orphanPoolMatches.push(m);
    }
  }
  // Sort each pool's matches by matchNumber asc for chronological feel
  for (const k of Object.keys(poolMatchesByPool)) {
    poolMatchesByPool[Number(k)].sort((a, b) => a.matchNumber - b.matchNumber);
  }

  // Group knockout by round
  const koByRound: Record<string, LoggedMatch[]> = {};
  for (const m of koMatches) {
    if (!koByRound[m.round]) koByRound[m.round] = [];
    koByRound[m.round].push(m);
  }
  const finalMatch = (koByRound.final ?? []).find((m) => m.status === 'completed') ?? null;
  const champion = finalMatch?.winnerId
    ? (finalMatch.winnerId === finalMatch.teamAId ? finalMatch.teamAName : finalMatch.teamBName)
    : null;

  // Inline match-row renderer used in both tabs
  const renderMatch = (m: LoggedMatch) => {
    const winA = !!(m.winnerId && m.winnerId === m.teamAId);
    const winB = !!(m.winnerId && m.winnerId === m.teamBId);
    const aName = m.teamAName || 'TBD';
    const bName = m.teamBName || 'TBD';
    const scoresA = (m.scores || []).map((s) => s.teamAScore).join(', ');
    const scoresB = (m.scores || []).map((s) => s.teamBScore).join(', ');
    return (
      <View key={m.id} style={s.matchRow}>
        <View style={s.matchRowInner}>
          <Text style={[s.matchTeam, winA && s.matchTeamWin]} numberOfLines={1}>{aName}</Text>
          <Text style={[s.matchScore, winA && s.matchTeamWin]}>{scoresA || '—'}</Text>
        </View>
        <View style={s.matchRowInner}>
          <Text style={[s.matchTeam, winB && s.matchTeamWin]} numberOfLines={1}>{bName}</Text>
          <Text style={[s.matchScore, winB && s.matchTeamWin]}>{scoresB || '—'}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.screen}>
      <YTopBar
        eyebrow={currentCat?.name?.toUpperCase() ?? 'CATEGORY'}
        title="STANDINGS"
        onBack={() => { setActiveCategoryId(null); setView('events'); }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, flexGrow: 1 }}
      >
        {detailLoading ? (
          <View style={s.center}><ActivityIndicator color={YColors.ink} /></View>
        ) : (
          <>
            {/* Champion banner */}
            {champion && (
              <View style={s.championCard}>
                <Text style={s.championEyebrow}>🏆 CHAMPION</Text>
                <Text style={s.championName} numberOfLines={2}>{champion}</Text>
                <Text style={s.championSub}>
                  Final: {finalMatch?.teamAName} vs {finalMatch?.teamBName}
                  {finalMatch?.scores?.length
                    ? '  ·  ' + finalMatch.scores.map((s) => `${s.teamAScore}-${s.teamBScore}`).join(', ')
                    : ''}
                </Text>
              </View>
            )}

            {/* Pool standings */}
            {pools.length > 0 ? (
              <>
                <Text style={s.sectionHeader}>POOL STANDINGS</Text>
                {pools.map((pool) => (
                  <View key={pool.poolNumber} style={s.poolCard}>
                    <View style={s.poolHeader}>
                      <Text style={s.poolBadge}>POOL {String.fromCharCode(64 + pool.poolNumber)}</Text>
                      <Text style={s.poolCount}>{pool.standings.length} teams</Text>
                    </View>
                    {/* Column headers */}
                    <View style={s.tableRow}>
                      <Text style={[s.thCell, { width: 24 }]}>#</Text>
                      <Text style={[s.thCell, { flex: 1 }]}>TEAM</Text>
                      <Text style={[s.thCell, s.tdNum, { width: 36 }]}>W</Text>
                      <Text style={[s.thCell, s.tdNum, { width: 36 }]}>L</Text>
                      <Text style={[s.thCell, s.tdNum, { width: 44 }]}>PF</Text>
                      <Text style={[s.thCell, s.tdNum, { width: 44 }]}>PA</Text>
                      <Text style={[s.thCell, s.tdNum, { width: 44 }]}>DIFF</Text>
                    </View>
                    {pool.standings.map((t) => {
                      const isTop = t.rank === 1;
                      return (
                        <View key={t.teamId} style={[s.tableRow, isTop && s.tableRowTop]}>
                          <Text style={[s.tdCell, { width: 24 }, isTop && s.tdBold]}>{t.rank}</Text>
                          <Text style={[s.tdCell, { flex: 1 }, isTop && s.tdBold]} numberOfLines={1}>
                            {t.name}
                          </Text>
                          <Text style={[s.tdCell, s.tdNum, { width: 36 }, isTop && s.tdBold]}>{t.wins}</Text>
                          <Text style={[s.tdCell, s.tdNum, { width: 36 }]}>{t.losses}</Text>
                          <Text style={[s.tdCell, s.tdNum, { width: 44 }]}>{t.pointsFor}</Text>
                          <Text style={[s.tdCell, s.tdNum, { width: 44 }]}>{t.pointsAgainst}</Text>
                          <Text style={[s.tdCell, s.tdNum, { width: 44, color: t.pointDiff >= 0 ? '#06D6A0' : '#E76F51' }]}>
                            {t.pointDiff > 0 ? '+' : ''}{t.pointDiff}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </>
            ) : (
              <View style={s.emptyState}>
                <Text style={s.emptyText}>No pool standings available yet.</Text>
              </View>
            )}

            {/* Tab strip: ROUND ROBIN / KNOCKOUTS */}
            {(poolMatchesRaw.length > 0 || koMatches.length > 0) && (
              <View style={s.tabBar}>
                <TouchableOpacity
                  style={[s.tabBtn, detailTab === 'roundrobin' && s.tabBtnActive]}
                  onPress={() => setDetailTab('roundrobin')}
                  disabled={poolMatchesRaw.length === 0}
                >
                  <Text style={[s.tabBtnText, detailTab === 'roundrobin' && s.tabBtnTextActive,
                    poolMatchesRaw.length === 0 && s.tabBtnTextDisabled]}>
                    ROUND ROBIN
                  </Text>
                  {poolMatchesRaw.length > 0 && (
                    <Text style={[s.tabBtnCount, detailTab === 'roundrobin' && s.tabBtnCountActive]}>
                      {poolMatchesRaw.length}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.tabBtn, detailTab === 'knockout' && s.tabBtnActive]}
                  onPress={() => setDetailTab('knockout')}
                  disabled={koMatches.length === 0}
                >
                  <Text style={[s.tabBtnText, detailTab === 'knockout' && s.tabBtnTextActive,
                    koMatches.length === 0 && s.tabBtnTextDisabled]}>
                    KNOCKOUTS
                  </Text>
                  {koMatches.length > 0 && (
                    <Text style={[s.tabBtnCount, detailTab === 'knockout' && s.tabBtnCountActive]}>
                      {koMatches.length}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* ROUND ROBIN tab: matches grouped by pool */}
            {detailTab === 'roundrobin' && (
              poolMatchesRaw.length === 0 ? (
                <View style={s.emptyState}>
                  <Text style={s.emptyText}>No pool matches in this category.</Text>
                </View>
              ) : (
                <>
                  {Object.keys(poolMatchesByPool)
                    .map(Number).sort((a, b) => a - b)
                    .map((pn) => (
                      <View key={pn} style={s.poolMatchesCard}>
                        <View style={s.poolHeader}>
                          <Text style={s.poolBadge}>POOL {String.fromCharCode(64 + pn)}</Text>
                          <Text style={s.poolCount}>{poolMatchesByPool[pn].length} matches</Text>
                        </View>
                        {poolMatchesByPool[pn].map(renderMatch)}
                      </View>
                  ))}
                  {orphanPoolMatches.length > 0 && (
                    <View style={s.poolMatchesCard}>
                      <View style={s.poolHeader}>
                        <Text style={s.poolBadge}>OTHER POOL MATCHES</Text>
                        <Text style={s.poolCount}>{orphanPoolMatches.length} matches</Text>
                      </View>
                      {orphanPoolMatches.map(renderMatch)}
                    </View>
                  )}
                </>
              )
            )}

            {/* KNOCKOUTS tab: matches grouped by round */}
            {detailTab === 'knockout' && (
              koMatches.length === 0 ? (
                <View style={s.emptyState}>
                  <Text style={s.emptyText}>No knockout matches in this category yet.</Text>
                </View>
              ) : (
                KO_ORDER.filter((r) => koByRound[r]?.length).map((round) => (
                  <View key={round} style={s.koSection}>
                    <Text style={s.koRoundLabel}>{ROUND_LABELS[round]}</Text>
                    {koByRound[round].map(renderMatch)}
                  </View>
                ))
              )
            )}
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
  pillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  pillTextMuted: { color: YColors.ink2 },
  bracketTile: { width: '48.5%', minHeight: 110, backgroundColor: YColors.ink, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 16, justifyContent: 'space-between' },
  bracketTileName: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5, lineHeight: 30 },
  bracketPill: { backgroundColor: YColors.accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  bracketPillText: { color: YColors.ink, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },

  // Champion banner
  championCard: {
    marginTop: 12, marginBottom: 6, padding: 18, borderRadius: 16,
    backgroundColor: YColors.accent, borderWidth: 1, borderColor: YColors.ink,
  },
  championEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.6, color: YColors.ink, marginBottom: 6 },
  championName: { fontSize: 22, fontWeight: '900', color: YColors.ink, letterSpacing: 0.4, lineHeight: 26 },
  championSub: { fontSize: 11, fontWeight: '700', color: YColors.ink2, marginTop: 8 },

  sectionHeader: { fontSize: 11, fontWeight: '900', letterSpacing: 1.6, color: YColors.ink2, textTransform: 'uppercase', marginTop: 22, marginBottom: 10 },

  emptyState: { padding: 24, alignItems: 'center', backgroundColor: YColors.bg2, borderRadius: 14, borderWidth: 1, borderColor: YColors.line, borderStyle: 'dashed', marginTop: 12 },
  emptyText: { fontSize: 12, color: YColors.ink3, textAlign: 'center' },

  // Pool tables
  poolCard: { marginBottom: 14, backgroundColor: YColors.bg2, borderRadius: 14, borderWidth: 1, borderColor: YColors.line, overflow: 'hidden' },
  poolHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: YColors.ink, paddingHorizontal: 14, paddingVertical: 10 },
  poolBadge: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  poolCount: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: YColors.line },
  tableRowTop: { backgroundColor: 'rgba(200, 242, 50, 0.18)' },
  thCell: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6, color: YColors.ink3 },
  tdCell: { fontSize: 12, fontWeight: '700', color: YColors.ink },
  tdNum: { textAlign: 'center' },
  tdBold: { fontWeight: '900' },

  // Tabs
  tabBar: { flexDirection: 'row', gap: 8, marginTop: 22, marginBottom: 14 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: YColors.bg3, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  tabBtnActive: { backgroundColor: YColors.ink },
  tabBtnText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4, color: YColors.ink2 },
  tabBtnTextActive: { color: '#FFFFFF' },
  tabBtnTextDisabled: { color: YColors.ink3 },
  tabBtnCount: { fontSize: 10, fontWeight: '900', color: YColors.ink3, backgroundColor: '#FFFFFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, overflow: 'hidden', minWidth: 22, textAlign: 'center' },
  tabBtnCountActive: { color: '#fff', backgroundColor: YColors.accent },

  // Round robin / pool matches list
  poolMatchesCard: { marginBottom: 14, backgroundColor: YColors.bg2, borderRadius: 14, borderWidth: 1, borderColor: YColors.line, overflow: 'hidden' },

  // Compact match row (used in both tabs)
  matchRow: { paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: YColors.line },
  matchRowInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  matchTeam: { fontSize: 13, fontWeight: '700', color: YColors.ink, flex: 1 },
  matchTeamWin: { fontWeight: '900' },
  matchScore: { fontSize: 14, fontWeight: '900', color: YColors.ink, marginLeft: 8 },

  // Knockout — round labels above each grouping
  koSection: { marginBottom: 16, backgroundColor: YColors.bg2, borderRadius: 14, borderWidth: 1, borderColor: YColors.line, overflow: 'hidden' },
  koRoundLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1.4, color: '#FFFFFF', backgroundColor: YColors.ink, paddingHorizontal: 14, paddingVertical: 10, textTransform: 'uppercase' },
});
