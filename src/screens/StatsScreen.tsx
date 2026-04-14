import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import Svg, { Path, Circle, Line, Polyline, Rect } from 'react-native-svg';
import { useAuthStore } from '../store/authStore';
import { ratingsApi } from '../api/ratings.api';
import { registrationsApi } from '../api/registrations.api';



// ─── Constants ────────────────────────────────────────────────────────────────

const NAVY = '#001E40';
const BLUE = '#2196F3';
const GREEN = '#06D6A0';
const ORANGE = '#FFB703';
const RED = '#BA1A1A';
const BG = '#F3F4F5';
const WHITE = '#FFFFFF';
const GRAY = '#737780';
const BORDER = '#EDEEEF';
const { width: SW } = Dimensions.get('window');

// ─── Tier system ──────────────────────────────────────────────────────────────

interface Tier {
  name: string;
  min: number;
  max: number;
  color: string;
  icon: string;
}

const TIERS: Tier[] = [
  { name: 'Bronze',    min: 2.0, max: 2.99, color: '#CD7F32', icon: '\uD83E\uDD49' },
  { name: 'Silver',    min: 3.0, max: 3.49, color: '#C0C0C0', icon: '\uD83E\uDD48' },
  { name: 'Gold',      min: 3.5, max: 3.99, color: '#FFD700', icon: '\uD83E\uDD47' },
  { name: 'Platinum',  min: 4.0, max: 4.49, color: '#5B9BD5', icon: '\uD83D\uDC8E' },
  { name: 'Diamond',   min: 4.5, max: 4.99, color: '#7B2FBE', icon: '\uD83D\uDCA0' },
  { name: 'Champion',  min: 5.0, max: 8.0,  color: '#FFB703', icon: '\uD83D\uDC51' },
];

function getTier(rating: number): Tier {
  return TIERS.find(t => rating >= t.min && rating <= t.max) ?? TIERS[0];
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const TrendUpIcon = ({ color = GREEN }: { color?: string }) => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    <Polyline points="17 6 23 6 23 12" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const TrendDownIcon = ({ color = RED }: { color?: string }) => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Polyline points="23 18 13.5 8.5 8.5 13.5 1 6" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    <Polyline points="17 18 23 18 23 12" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Rating Ring ──────────────────────────────────────────────────────────────

function RatingRing({ rating, size = 120 }: { rating: number; size?: number }) {
  const tier = getTier(rating);
  const progress = Math.min(1, (rating - 2.0) / 6.0); // 2.0-8.0 -> 0-1
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {/* Background ring */}
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke={'#E2E8F0'} strokeWidth={8} fill="none"
        />
        {/* Progress ring */}
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke={tier.color} strokeWidth={8} fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 28, fontWeight: '900', color: NAVY }}>{rating.toFixed(2)}</Text>
        <Text style={{ fontSize: 10, fontWeight: '700', color: tier.color, letterSpacing: 1, marginTop: 2 }}>{tier.name.toUpperCase()}</Text>
      </View>
    </View>
  );
}

// ─── Mini history chart ───────────────────────────────────────────────────────

function HistoryChart({ history }: { history: any[] }) {
  if (history.length < 2) return null;

  const chartW = SW - 80;
  const chartH = 80;
  const padding = 8;

  const ratings = history.map((h: any) => Number(h.newDisplay)).reverse();
  const min = Math.max(2.0, Math.min(...ratings) - 0.3);
  const max = Math.min(8.0, Math.max(...ratings) + 0.3);
  const range = max - min || 1;

  const points = ratings.map((r, i) => {
    const x = padding + (i / (ratings.length - 1)) * (chartW - padding * 2);
    const y = chartH - padding - ((r - min) / range) * (chartH - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const lastRating = ratings[ratings.length - 1];
  const firstRating = ratings[0];
  const trending = lastRating >= firstRating;

  return (
    <View style={cs.chartBox}>
      <Svg width={chartW} height={chartH}>
        <Polyline
          points={points}
          stroke={trending ? GREEN : RED}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Last point dot */}
        {ratings.length > 0 && (() => {
          const lastX = padding + ((ratings.length - 1) / (ratings.length - 1)) * (chartW - padding * 2);
          const lastY = chartH - padding - ((lastRating - min) / range) * (chartH - padding * 2);
          return <Circle cx={lastX} cy={lastY} r={4} fill={trending ? GREEN : RED} />;
        })()}
      </Svg>
    </View>
  );
}

const cs = StyleSheet.create({
  chartBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 8,
    marginTop: 8,
  },
});

// ─── Leaderboard row ──────────────────────────────────────────────────────────

function LeaderboardRow({ rank, player, isMe }: { rank: number; player: any; isMe: boolean }) {
  const name = player.user?.fullName ?? player.user?.displayName ?? 'Unknown';
  const rating = Number(player.displayRating ?? player.rating ?? 2.0);
  const tier = getTier(rating);
  const matches = player.matchesPlayed ?? 0;

  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const avatarColors = ['#001E40', '#2196F3', '#7B2FBE', '#00A86B', '#E85D04'];
  const bgColor = avatarColors[rank % avatarColors.length];

  return (
    <View style={[s.lbRow, isMe && s.lbRowMe]}>
      <Text style={[s.lbRank, rank <= 3 && s.lbRankTop]}>{rank}</Text>
      <View style={[s.lbAvatar, { backgroundColor: bgColor }]}>
        <Text style={s.lbInitials}>{initials}</Text>
      </View>
      <View style={s.lbInfo}>
        <Text style={s.lbName} numberOfLines={1}>{name}{isMe ? ' (you)' : ''}</Text>
        <Text style={s.lbMeta}>{matches} matches</Text>
      </View>
      <View style={s.lbRatingBox}>
        <Text style={[s.lbRating, { color: tier.color }]}>{rating.toFixed(2)}</Text>
        <Text style={s.lbTier}>{tier.icon}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type Tab = 'my_stats' | 'leaderboard';

export default function StatsScreen() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('my_stats');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [ratings, setRatings] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [lbFormat, setLbFormat] = useState<'doubles' | 'singles'>('doubles');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const [ratingsRes, historyRes, lbRes, regsRes] = await Promise.allSettled([
      ratingsApi.getMyRatings(),
      ratingsApi.getMyRatingHistory(undefined, 30),
      ratingsApi.getLeaderboard(lbFormat, 20),
      registrationsApi.getMyRegistrations(),
    ]);

    if (ratingsRes.status === 'fulfilled') {
      setRatings(ratingsRes.value.data?.data ?? []);
    }
    if (historyRes.status === 'fulfilled') {
      setHistory(historyRes.value.data?.data ?? []);
    }
    if (lbRes.status === 'fulfilled') {
      setLeaderboard(lbRes.value.data?.data ?? []);
    }
    if (regsRes.status === 'fulfilled') {
      const raw = regsRes.value.data?.data ?? [];
      setRegistrations(Array.isArray(raw) ? raw : []);
    }

    setLoading(false);
    setRefreshing(false);
  }, [lbFormat]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived
  const doublesRating = ratings.find((r: any) => r.format === 'doubles');
  const singlesRating = ratings.find((r: any) => r.format === 'singles');
  const primaryRating = doublesRating ?? singlesRating;
  const displayRating = primaryRating ? Number(primaryRating.displayRating ?? primaryRating.rating ?? 2.0) : 2.0;
  const peakRating = primaryRating ? Number(primaryRating.peakRating ?? displayRating) : 2.0;
  const matchesPlayed = primaryRating ? (primaryRating.matchesPlayed ?? 0) : 0;
  const sigma = primaryRating ? Number(primaryRating.sigma ?? primaryRating.ratingDeviation ?? 8.33) : 8.33;

  const doublesHistory = history.filter((h: any) => h.format === 'doubles');
  const singlesHistory = history.filter((h: any) => h.format === 'singles');

  // Calculate W/L from history
  const totalWins = history.filter((h: any) => Number(h.change) > 0).length;
  const totalLosses = history.filter((h: any) => Number(h.change) < 0).length;
  const winRate = totalWins + totalLosses > 0
    ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0;

  const tournamentsPlayed = new Set(
    registrations.filter((r: any) => {
      const st = r.tournament?.status ?? '';
      return st === 'completed' || st === 'in_progress';
    }).map((r: any) => r.tournament?.id)
  ).size;

  const recentChanges = history.slice(0, 5);
  const lastChange = recentChanges.length > 0 ? Number(recentChanges[0].change) : 0;

  // ── MY STATS TAB ──
  const renderMyStats = () => {
    if (loading) {
      return <View style={s.center}><ActivityIndicator size="large" color={'#2196F3'} /></View>;
    }

    return (
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={'#2196F3'} />}
      >
        {/* Rating card */}
        <View style={s.ratingCard}>
          <View style={s.ratingCardTop}>
            <RatingRing rating={displayRating} />
            <View style={s.ratingMeta}>
              <Text style={s.ratingLabel}>YOIDEN RATING</Text>
              {lastChange !== 0 && (
                <View style={s.trendRow}>
                  {lastChange > 0 ? <TrendUpIcon /> : <TrendDownIcon />}
                  <Text style={[s.trendText, { color: lastChange > 0 ? GREEN : RED }]}>
                    {lastChange > 0 ? '+' : ''}{lastChange.toFixed(2)} last match
                  </Text>
                </View>
              )}
              <View style={s.ratingStatRow}>
                <View style={s.ratingStatItem}>
                  <Text style={s.ratingStatValue}>{peakRating.toFixed(2)}</Text>
                  <Text style={s.ratingStatLabel}>PEAK</Text>
                </View>
                <View style={s.ratingStatDivider} />
                <View style={s.ratingStatItem}>
                  <Text style={s.ratingStatValue}>{sigma.toFixed(1)}</Text>
                  <Text style={s.ratingStatLabel}>CONFIDENCE</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Rating format tabs */}
          {doublesRating && singlesRating && (
            <View style={s.formatRow}>
              <View style={s.formatChip}>
                <Text style={s.formatChipLabel}>DOUBLES</Text>
                <Text style={s.formatChipValue}>{Number(doublesRating.displayRating).toFixed(2)}</Text>
              </View>
              <View style={s.formatChip}>
                <Text style={s.formatChipLabel}>SINGLES</Text>
                <Text style={s.formatChipValue}>{Number(singlesRating.displayRating).toFixed(2)}</Text>
              </View>
            </View>
          )}

          {/* History chart */}
          {(doublesHistory.length > 1 || singlesHistory.length > 1) && (
            <HistoryChart history={doublesHistory.length > 1 ? doublesHistory : singlesHistory} />
          )}
        </View>

        {/* Quick stats */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statValue}>{matchesPlayed}</Text>
            <Text style={s.statLabel}>MATCHES</Text>
          </View>
          <View style={[s.statBox, s.statBoxBorder]}>
            <Text style={s.statValue}>{totalWins}/{totalLosses}</Text>
            <Text style={s.statLabel}>W/L</Text>
          </View>
          <View style={[s.statBox, s.statBoxBorder]}>
            <Text style={s.statValue}>{winRate}%</Text>
            <Text style={s.statLabel}>WIN RATE</Text>
          </View>
          <View style={[s.statBox, s.statBoxBorder]}>
            <Text style={s.statValue}>{tournamentsPlayed}</Text>
            <Text style={s.statLabel}>EVENTS</Text>
          </View>
        </View>

        {/* Recent rating changes */}
        {recentChanges.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardLabel}>RECENT MATCHES</Text>
            {recentChanges.map((h: any, i: number) => {
              const change = Number(h.change);
              const isUp = change > 0;
              return (
                <View key={h.id ?? i} style={[s.historyRow, i < recentChanges.length - 1 && s.historyRowBorder]}>
                  <View style={[s.historyDot, { backgroundColor: isUp ? GREEN : RED }]} />
                  <View style={s.historyInfo}>
                    <Text style={s.historyFormat}>{(h.format ?? 'doubles').toUpperCase()}</Text>
                    <Text style={s.historyRating}>
                      {Number(h.oldDisplay).toFixed(2)} {'\u2192'} {Number(h.newDisplay).toFixed(2)}
                    </Text>
                  </View>
                  <Text style={[s.historyChange, { color: isUp ? GREEN : RED }]}>
                    {isUp ? '+' : ''}{change.toFixed(2)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* No data state */}
        {matchesPlayed === 0 && !loading && (
          <View style={s.emptyCard}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>{'\uD83C\uDFBE'}</Text>
            <Text style={s.emptyTitle}>NO MATCHES YET</Text>
            <Text style={s.emptySub}>
              Play in a tournament to see your Yoiden Rating.{'\n'}
              Your rating starts based on your self-reported skill level.
            </Text>
          </View>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>
    );
  };

  // ── LEADERBOARD TAB ──
  const renderLeaderboard = () => {
    if (loading) {
      return <View style={s.center}><ActivityIndicator size="large" color={'#2196F3'} /></View>;
    }

    return (
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={'#2196F3'} />}
      >
        {/* Format toggle */}
        <View style={s.lbFormatRow}>
          {(['doubles', 'singles'] as const).map(fmt => (
            <TouchableOpacity
              key={fmt}
              style={[s.lbFormatBtn, lbFormat === fmt && s.lbFormatBtnActive]}
              onPress={() => setLbFormat(fmt)}
            >
              <Text style={[s.lbFormatText, lbFormat === fmt && s.lbFormatTextActive]}>
                {fmt.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Leaderboard */}
        {leaderboard.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>{'\uD83C\uDFC6'}</Text>
            <Text style={s.emptyTitle}>NO RANKINGS YET</Text>
            <Text style={s.emptySub}>Play matches to appear on the leaderboard.</Text>
          </View>
        ) : (
          <View style={s.card}>
            {leaderboard.map((player: any, idx: number) => (
              <LeaderboardRow
                key={player.id ?? idx}
                rank={idx + 1}
                player={player}
                isMe={player.userId === user?.id}
              />
            ))}
          </View>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerEyebrow}>YOUR PERFORMANCE</Text>
        <Text style={s.headerTitle}>STATS</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        {([
          { id: 'my_stats' as Tab, label: 'MY RATING' },
          { id: 'leaderboard' as Tab, label: 'LEADERBOARD' },
        ]).map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[s.tabBtn, activeTab === tab.id && s.tabBtnActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[s.tabText, activeTab === tab.id && s.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'my_stats' ? renderMyStats() : renderLeaderboard()}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16,
  },
  headerEyebrow: {
    fontSize: 10, fontWeight: '700', color: '#64748B',
    letterSpacing: 2, marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28, fontWeight: '900', fontStyle: 'italic', color: NAVY, letterSpacing: -1,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row', paddingHorizontal: 16,
    paddingVertical: 8, gap: 8,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  tabBtnActive: { backgroundColor: '#2196F3' },
  tabText: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.2 },
  tabTextActive: { color: WHITE },

  // Scroll
  scroll: { padding: 16 },

  // Rating card
  ratingCard: {
    backgroundColor: '#F5F7FA', borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  ratingCardTop: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  ratingMeta: { flex: 1 },
  ratingLabel: {
    fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 2, marginBottom: 6,
  },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  trendText: { fontSize: 12, fontWeight: '700' },
  ratingStatRow: { flexDirection: 'row', alignItems: 'center' },
  ratingStatItem: { flex: 1, alignItems: 'center' },
  ratingStatValue: { fontSize: 16, fontWeight: '800', color: NAVY, marginBottom: 2 },
  ratingStatLabel: { fontSize: 8, fontWeight: '700', color: '#94A3B8', letterSpacing: 1.2 },
  ratingStatDivider: { width: 1, height: 28, backgroundColor: '#E2E8F0' },

  formatRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  formatChip: {
    flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F5F7FA', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  formatChipLabel: { fontSize: 9, fontWeight: '700', color: '#94A3B8', letterSpacing: 1 },
  formatChipValue: { fontSize: 14, fontWeight: '800', color: '#1A1D21' },

  // Stats row
  statsRow: {
    flexDirection: 'row', backgroundColor: '#F5F7FA', borderRadius: 16,
    padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  statBox: { flex: 1, alignItems: 'center' },
  statBoxBorder: { borderLeftWidth: 1, borderLeftColor: '#E2E8F0' },
  statValue: { fontSize: 18, fontWeight: '900', color: NAVY, marginBottom: 2 },
  statLabel: { fontSize: 8, fontWeight: '700', color: '#94A3B8', letterSpacing: 1 },

  // Card
  card: {
    backgroundColor: '#F5F7FA', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  cardLabel: {
    fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 2, marginBottom: 12,
  },

  // History rows
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  historyRowBorder: { borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  historyDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  historyInfo: { flex: 1 },
  historyFormat: { fontSize: 9, fontWeight: '700', color: '#94A3B8', letterSpacing: 1, marginBottom: 2 },
  historyRating: { fontSize: 13, fontWeight: '600', color: NAVY },
  historyChange: { fontSize: 14, fontWeight: '800' },

  // Empty
  emptyCard: {
    backgroundColor: '#F5F7FA', borderRadius: 16, padding: 32,
    alignItems: 'center', marginBottom: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#64748B', letterSpacing: 1.5, marginBottom: 8 },
  emptySub: { fontSize: 13, fontWeight: '500', color: '#64748B', textAlign: 'center', lineHeight: 20 },

  // Leaderboard
  lbFormatRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  lbFormatBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#F5F7FA', borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  lbFormatBtnActive: { backgroundColor: '#2196F3', borderColor: '#2196F3' },
  lbFormatText: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.2 },
  lbFormatTextActive: { color: WHITE },

  lbRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  lbRowMe: {
    backgroundColor: 'rgba(33,150,243,0.1)', marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 8,
  },
  lbRank: { width: 24, fontSize: 14, fontWeight: '700', color: '#94A3B8', textAlign: 'center' },
  lbRankTop: { fontWeight: '900', color: NAVY },
  lbAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginHorizontal: 10,
  },
  lbInitials: { fontSize: 12, fontWeight: '800', color: WHITE },
  lbInfo: { flex: 1 },
  lbName: { fontSize: 13, fontWeight: '700', color: '#1A1D21', marginBottom: 1 },
  lbMeta: { fontSize: 10, fontWeight: '500', color: '#64748B' },
  lbRatingBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lbRating: { fontSize: 16, fontWeight: '900' },
  lbTier: { fontSize: 14 },
});
