/**
 * PlayerRecapScreen — public per-player day recap.
 *
 * URL: /player/:userId  (no auth required)
 *
 * Shows every match the player has been in, grouped by date and tournament.
 * Used as the landing page for WhatsApp daily-recap links — recipients tap
 * the link and see their day without having to log in.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import { YColors } from '../../components/yoiden';
import apiClient from '../../api/client';

type RecapMatch = {
  id: string;
  tournamentId: string;
  tournamentName: string | null;
  categoryId: string;
  categoryName: string;
  round: string;
  matchNumber: number;
  status: string;
  court: string | null;
  scheduledStart: string | null;
  actualEnd: string | null;
  you: { teamName: string; score: number | null; won: boolean };
  opponent: { teamName: string; score: number | null };
  decided: boolean;
};

type RecapData = {
  user: { id: string; fullName: string; displayName?: string; phone?: string };
  tournaments: { id: string; name: string; startDate: string; endDate: string; venueName: string; city: string }[];
  matches: RecapMatch[];
};

function dateKey(iso: string | null): string {
  if (!iso) return 'TBD';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
}

function fmtTime(iso: string | null): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function PlayerRecapScreen() {
  // Read userId from the URL (web only — no nav params expected on this route)
  const userId = Platform.OS === 'web' && typeof window !== 'undefined'
    ? (window.location.pathname.match(/^\/player\/([^/]+)/i)?.[1] || null)
    : null;

  const [data, setData] = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) { setError('No player ID in URL'); setLoading(false); return; }
    apiClient.get(`/players/${userId}/recap`)
      .then((res) => {
        const d = (res.data as any)?.data ?? res.data;
        setData(d);
      })
      .catch((e: any) => {
        setError(e?.response?.data?.message ?? e?.message ?? 'Could not load recap');
      })
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.center}><ActivityIndicator size="large" color={YColors.lime} /></View>
      </SafeAreaView>
    );
  }
  if (error || !data) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.center}>
          <Text style={s.errorTitle}>Couldn't load this page</Text>
          <Text style={s.errorBody}>{error ?? 'Unknown error'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Group matches by date (newest day first)
  const byDate: Record<string, RecapMatch[]> = {};
  for (const m of data.matches) {
    const k = dateKey(m.actualEnd || m.scheduledStart);
    if (!byDate[k]) byDate[k] = [];
    byDate[k].push(m);
  }
  const dateGroups = Object.entries(byDate).sort((a, b) => {
    // sort chronologically by first match's start
    const ta = new Date(a[1][0]?.scheduledStart || a[1][0]?.actualEnd || 0).getTime();
    const tb = new Date(b[1][0]?.scheduledStart || b[1][0]?.actualEnd || 0).getTime();
    return tb - ta;
  });

  const totalPlayed = data.matches.filter((m) => m.decided).length;
  const totalWon = data.matches.filter((m) => m.you.won).length;
  const totalLost = totalPlayed - totalWon;

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.eyebrow}>PLAYER RECAP</Text>
          <Text style={s.name}>{data.user.fullName}</Text>
          {data.tournaments[0] && (
            <Text style={s.subtitle}>
              {data.tournaments[0].name} · {data.tournaments[0].venueName}
            </Text>
          )}
        </View>

        {/* Summary */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statNum}>{totalPlayed}</Text>
            <Text style={s.statLabel}>PLAYED</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statNum, { color: '#06D6A0' }]}>{totalWon}</Text>
            <Text style={s.statLabel}>WON</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statNum, { color: '#E76F51' }]}>{totalLost}</Text>
            <Text style={s.statLabel}>LOST</Text>
          </View>
        </View>

        {/* Match groups by day */}
        {data.matches.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyText}>No matches logged yet. Check back during the event.</Text>
          </View>
        ) : (
          dateGroups.map(([day, matches]) => (
            <View key={day} style={s.daySection}>
              <Text style={s.dayHeader}>{day.toUpperCase()}</Text>
              {matches.map((m) => {
                const tone =
                  !m.decided ? 'pending' :
                  m.you.won ? 'win' : 'loss';
                return (
                  <View key={m.id} style={[s.matchCard, tone === 'win' && s.cardWin, tone === 'loss' && s.cardLoss]}>
                    <View style={s.matchTopRow}>
                      <Text style={s.matchRound}>
                        {(m.round || 'match').toUpperCase()} · {m.categoryName}
                      </Text>
                      <Text style={s.matchTime}>
                        {fmtTime(m.actualEnd || m.scheduledStart)}{m.court ? ` · ${m.court}` : ''}
                      </Text>
                    </View>
                    <View style={s.matchScoreRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.youLabel}>YOU</Text>
                        <Text style={s.youTeam} numberOfLines={2}>{m.you.teamName}</Text>
                      </View>
                      <View style={s.scoreBox}>
                        <Text style={[s.scoreText, m.you.won && s.scoreWinner]}>
                          {m.you.score ?? '—'}
                        </Text>
                        <Text style={s.scoreSep}>—</Text>
                        <Text style={[s.scoreText, m.decided && !m.you.won && s.scoreWinner]}>
                          {m.opponent.score ?? '—'}
                        </Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={s.oppLabel}>OPPONENT</Text>
                        <Text style={s.oppTeam} numberOfLines={2}>{m.opponent.teamName}</Text>
                      </View>
                    </View>
                    {tone !== 'pending' && (
                      <View style={[s.outcomeBadge, tone === 'win' ? s.outcomeWin : s.outcomeLoss]}>
                        <Text style={[s.outcomeText, tone === 'win' && { color: YColors.ink }]}>
                          {tone === 'win' ? '✓ WON' : '✗ LOST'}
                        </Text>
                      </View>
                    )}
                    {tone === 'pending' && (
                      <View style={[s.outcomeBadge, { backgroundColor: YColors.line }]}>
                        <Text style={[s.outcomeText, { color: YColors.ink2 }]}>UPCOMING</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))
        )}

        <Text style={s.footer}>
          1st West Zone Pickleball Championship · Powered by Yoiden
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: YColors.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  errorTitle: { fontSize: 18, fontWeight: '900', color: YColors.ink, marginBottom: 8 },
  errorBody: { fontSize: 13, color: YColors.ink2, textAlign: 'center' },

  // Header
  header: { marginBottom: 16 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: YColors.ink2, textTransform: 'uppercase' },
  name: { fontSize: 30, fontWeight: '900', color: YColors.ink, marginTop: 6, letterSpacing: 0.3 },
  subtitle: { fontSize: 13, color: YColors.ink2, marginTop: 8 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: YColors.ink, paddingVertical: 16, alignItems: 'center', borderRadius: 14,
  },
  statNum: { fontSize: 32, fontWeight: '900', color: YColors.lime, letterSpacing: 0.5 },
  statLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  // Empty
  emptyState: { padding: 28, alignItems: 'center', backgroundColor: YColors.bg2, borderRadius: 14, borderWidth: 1, borderColor: YColors.line, borderStyle: 'dashed' },
  emptyText: { fontSize: 13, color: YColors.ink3, textAlign: 'center' },

  // Day section
  daySection: { marginBottom: 22 },
  dayHeader: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: YColors.ink2, marginBottom: 10, textTransform: 'uppercase' },

  // Match card
  matchCard: {
    backgroundColor: YColors.bg2, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: YColors.line,
  },
  cardWin: { borderLeftWidth: 4, borderLeftColor: '#06D6A0' },
  cardLoss: { borderLeftWidth: 4, borderLeftColor: '#E76F51' },

  matchTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  matchRound: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: YColors.ink2, flex: 1 },
  matchTime: { fontSize: 11, fontWeight: '700', color: YColors.ink2 },

  matchScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  youLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.4, color: YColors.ink3, marginBottom: 2 },
  youTeam: { fontSize: 13, fontWeight: '800', color: YColors.ink, lineHeight: 16 },
  oppLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.4, color: YColors.ink3, marginBottom: 2 },
  oppTeam: { fontSize: 13, fontWeight: '700', color: YColors.ink, lineHeight: 16, textAlign: 'right' },
  scoreBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: YColors.bg, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, gap: 8 },
  scoreText: { fontSize: 22, fontWeight: '900', color: YColors.ink3 },
  scoreSep: { fontSize: 16, color: YColors.ink3 },
  scoreWinner: { color: YColors.ink },

  outcomeBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 12 },
  outcomeWin: { backgroundColor: YColors.lime },
  outcomeLoss: { backgroundColor: '#E76F51' },
  outcomeText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: '#FFFFFF' },

  footer: { textAlign: 'center', fontSize: 11, fontWeight: '700', color: YColors.ink3, marginTop: 24, letterSpacing: 0.6 },
});
