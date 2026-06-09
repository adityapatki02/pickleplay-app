import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import {
  getPlayerBasicInfo,
  getPlayerMatches,
  getLifetimeStats,
} from '../../api/leagues.api';
import { xAlert } from '../../utils/alert';

// ─── Design tokens ──────────────────────────────────────────────────────────
import { YColors, YTopBar } from '../../components/yoiden';

const NAVY: string = YColors.ink;
const BLUE: string = YColors.accent;
const GREEN = '#06D6A0';
const RED = '#EF4444';
const GOLD = '#F59E0B';
const SURFACE: string = YColors.bg;
const BORDER: string = YColors.line2;
const TEXT_COLOR: string = YColors.ink;
const TEXT_SUB: string = YColors.ink2;
const TEXT_MUTED: string = YColors.ink3;
const WHITE = '#FFFFFF';

// Category display labels + emojis
const CAT_LABELS: Record<string, { label: string; emoji: string }> = {
  kids: { label: 'Kids', emoji: '🧒' },
  teen: { label: 'Teen', emoji: '🧑' },
  women1: { label: 'Women 1', emoji: '👩' },
  women2: { label: 'Women 2', emoji: '👩' },
  men1: { label: 'Men 1', emoji: '👨' },
  men2: { label: 'Men 2', emoji: '👨' },
  men3: { label: 'Men 3', emoji: '👨' },
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function initialsFrom(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function relativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = now - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return 'today';
  if (diff < 2 * day) return 'yesterday';
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ── Screen ──────────────────────────────────────────────────────────────────
const PlayerProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { playerId, seasonId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [basic, setBasic] = useState<any>(null);
  const [lifetime, setLifetime] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!playerId) return;
    try {
      const [b, l, m] = await Promise.all([
        getPlayerBasicInfo(playerId).catch(() => null),
        getLifetimeStats(playerId).catch(() => null),
        getPlayerMatches(playerId, { seasonId, limit: 30 }).catch(() => []),
      ]);
      setBasic(b);
      setLifetime(l);
      setMatches(Array.isArray(m) ? m : []);
    } catch (err: any) {
      xAlert('Error', err?.message || 'Failed to load player profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [playerId, seasonId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  // Derived: sort categoryBreakdown entries by played DESC for display
  const catEntries = useMemo(() => {
    const cb = lifetime?.categoryBreakdown || {};
    return Object.entries(cb)
      .map(([slug, raw]: [string, any]) => ({
        slug,
        label: CAT_LABELS[slug]?.label || slug,
        emoji: CAT_LABELS[slug]?.emoji || '🎾',
        played: raw.played || 0,
        won: raw.won || 0,
        lost: raw.lost || 0,
        winRate: raw.played > 0 ? Math.round((raw.won / raw.played) * 100) : 0,
      }))
      .filter((e) => e.played > 0)
      .sort((a, b) => b.played - a.played);
  }, [lifetime]);

  const franchise = basic?.currentFranchise;
  const heroBg = franchise?.color || NAVY;

  if (loading && !basic) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <YTopBar eyebrow="SPPL" title="PLAYER PROFILE" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={BLUE} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Player Profile</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Hero card */}
        <View style={[styles.hero, { backgroundColor: heroBg }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsFrom(basic?.name || '')}</Text>
          </View>
          <Text style={styles.playerName}>{basic?.name || 'Unknown'}</Text>
          <View style={styles.chipRow}>
            {franchise && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{franchise.shortName || franchise.name}</Text>
              </View>
            )}
            {basic?.currentCategory && CAT_LABELS[basic.currentCategory] && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {CAT_LABELS[basic.currentCategory].emoji} {CAT_LABELS[basic.currentCategory].label}
                </Text>
              </View>
            )}
            {basic?.jerseyNumber != null && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>🎽 #{basic.jerseyNumber}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Lifetime stats grid */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>LIFETIME</Text>
          {!lifetime || lifetime.matchesPlayed === 0 ? (
            <Text style={styles.emptyText}>No matches played yet.</Text>
          ) : (
            <View style={styles.statsGrid}>
              <StatCell big value={lifetime.matchesPlayed} label="Played" />
              <StatCell big color={GREEN} value={lifetime.matchesWon} label="Won" />
              <StatCell big color={BLUE} value={`${lifetime.winRate}%`} label="Win Rate" />
              <StatCell
                big
                color={GOLD}
                value={((lifetime as any).teamPointsEarned || 0) + (lifetime.bonusPointsEarned || 0)}
                label="Total Pts"
              />
            </View>
          )}
          {lifetime && lifetime.matchesPlayed > 0 && (
            <View style={styles.subStats}>
              <Text style={styles.subStatText}>
                Team Pts: <Text style={{ fontWeight: '700', color: GREEN }}>{(lifetime as any).teamPointsEarned || 0}</Text>
                {'  ·  '}Bonus: <Text style={{ fontWeight: '700', color: NAVY }}>{lifetime.bonusPointsEarned}</Text>
                {'  ·  '}Points: <Text style={{ fontWeight: '700', color: NAVY }}>{lifetime.pointsScored}</Text>
                {'  ·  '}Point diff: <Text style={{
                  color: lifetime.pointDiff >= 0 ? GREEN : RED,
                  fontWeight: '700',
                }}>
                  {lifetime.pointDiff >= 0 ? '+' : ''}{lifetime.pointDiff}
                </Text>
                {basic?.totalSeasons != null && (
                  <>
                    {'  ·  '}Seasons: <Text style={{ fontWeight: '700', color: NAVY }}>{basic.totalSeasons}</Text>
                  </>
                )}
              </Text>
            </View>
          )}
        </View>

        {/* Category breakdown */}
        {catEntries.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>BY CATEGORY</Text>
            {catEntries.map((c) => (
              <View key={c.slug} style={styles.catRow}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.catEmoji}>{c.emoji}</Text>
                  <Text style={styles.catLabel}>{c.label}</Text>
                </View>
                <View style={styles.catStats}>
                  <Text style={styles.catStat}>
                    <Text style={styles.catStatNum}>{c.played}</Text>
                    <Text style={styles.catStatLabel}> P</Text>
                  </Text>
                  <Text style={styles.catStat}>
                    <Text style={[styles.catStatNum, { color: GREEN }]}>{c.won}</Text>
                    <Text style={styles.catStatLabel}> W</Text>
                  </Text>
                  <View style={[styles.winRatePill, { backgroundColor: c.winRate >= 60 ? '#D1FAE5' : c.winRate >= 40 ? '#FEF3C7' : '#FEE2E2' }]}>
                    <Text style={[styles.winRateText, {
                      color: c.winRate >= 60 ? '#047857' : c.winRate >= 40 ? '#92400E' : '#991B1B',
                    }]}>
                      {c.winRate}%
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Recent matches */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={styles.cardTitle}>RECENT MATCHES</Text>
            <Text style={styles.cardCount}>{matches.length}</Text>
          </View>
          {matches.length === 0 ? (
            <Text style={styles.emptyText}>No match history yet.</Text>
          ) : (
            matches.map((m, idx) => {
              const catInfo = CAT_LABELS[m.categorySlug] || { label: m.categorySlug, emoji: '🎾' };
              const opp = m.opponentTeam?.shortName || m.opponentTeam?.name || 'TBD';
              return (
                <View key={m.matchId || idx} style={styles.matchRow}>
                  <View style={[styles.wlBadge, { backgroundColor: m.won ? GREEN : RED }]}>
                    <Text style={styles.wlBadgeText}>{m.won ? 'W' : 'L'}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <Text style={styles.matchCat} numberOfLines={1}>
                        {catInfo.emoji} {catInfo.label}
                      </Text>
                      <Text style={styles.matchScore}>
                        {m.myScore ?? '-'}–{m.oppScore ?? '-'}
                      </Text>
                    </View>
                    <Text style={styles.matchOpp} numberOfLines={1}>
                      vs {opp}
                      {m.partnerName ? `  ·  w/ ${m.partnerName}` : ''}
                    </Text>
                    <Text style={styles.matchMeta}>
                      {m.seasonName ? `${m.seasonName}  ·  ` : ''}
                      {relativeDate(m.scheduledStart)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ── Small stat cell ─────────────────────────────────────────────────────────
const StatCell: React.FC<{ value: string | number; label: string; big?: boolean; color?: string }> = ({ value, label, big, color }) => (
  <View style={styles.statCell}>
    <Text style={[styles.statValue, big && { fontSize: 26 }, color ? { color } : null]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export default PlayerProfileScreen;

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE },
  header: {
    backgroundColor: NAVY,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { paddingVertical: 4 },
  backTxt: { color: WHITE, fontSize: 14, fontWeight: '600' },
  headerTitle: { color: WHITE, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  hero: {
    margin: 14,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: WHITE, fontSize: 30, fontWeight: '800', letterSpacing: 1 },
  playerName: { color: WHITE, fontSize: 22, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  chipText: { color: WHITE, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  card: {
    backgroundColor: WHITE,
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardTitle: { fontSize: 11, fontWeight: '800', color: TEXT_SUB, letterSpacing: 0.8, marginBottom: 12 },
  cardCount: { fontSize: 11, fontWeight: '700', color: TEXT_MUTED },
  emptyText: { fontSize: 12, color: TEXT_MUTED, fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },

  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statCell: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: NAVY },
  statLabel: { fontSize: 10, color: TEXT_SUB, fontWeight: '600', marginTop: 4, letterSpacing: 0.5 },
  subStats: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER },
  subStatText: { fontSize: 11, color: TEXT_SUB, textAlign: 'center' },

  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE,
  },
  catEmoji: { fontSize: 18, marginRight: 8 },
  catLabel: { fontSize: 13, fontWeight: '700', color: TEXT_COLOR },
  catStats: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catStat: { fontSize: 12 },
  catStatNum: { fontSize: 14, fontWeight: '800', color: NAVY },
  catStatLabel: { fontSize: 10, color: TEXT_SUB, fontWeight: '600' },
  winRatePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, minWidth: 42, alignItems: 'center' },
  winRateText: { fontSize: 11, fontWeight: '800' },

  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE,
  },
  wlBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wlBadgeText: { color: WHITE, fontSize: 13, fontWeight: '800' },
  matchCat: { fontSize: 12, fontWeight: '700', color: NAVY, flex: 1 },
  matchScore: { fontSize: 14, fontWeight: '800', color: NAVY, marginLeft: 6 },
  matchOpp: { fontSize: 11, color: TEXT_SUB, marginTop: 2 },
  matchMeta: { fontSize: 10, color: TEXT_MUTED, marginTop: 3, letterSpacing: 0.2 },
});
