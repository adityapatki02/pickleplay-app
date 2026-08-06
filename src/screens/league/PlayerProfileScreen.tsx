import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getPlayerCareer } from '../../api/leagues.api';
import { xAlert } from '../../utils/alert';
import { useAuthStore } from '../../store/authStore';

// ─── Design tokens ──────────────────────────────────────────────────────────
import { YColors, YTopBar } from '../../components/yoiden';

// Header / avatar / active tabs use a deep blue (was near-black — the page read
// as a wall of black). LIME drives the small accent lines before each section;
// GREEN stays a readable teal for the auction-price text.
const NAVY: string = YColors.accentDeep;
const BLUE: string = YColors.accent;
const GREEN = '#06D6A0';
const LIME: string = YColors.lime;
const SURFACE: string = YColors.bg;
const BORDER: string = YColors.line2;
const TEXT_COLOR: string = YColors.ink;
const TEXT_SUB: string = YColors.ink2;
const TEXT_MUTED: string = YColors.ink3;
const WHITE = '#FFFFFF';

// ── Helpers ─────────────────────────────────────────────────────────────────
function initialsFrom(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatLabel(format: string): string {
  if (!format) return '';
  return format.charAt(0).toUpperCase() + format.slice(1);
}

// Column definitions for the by-format / by-league tables. The first four
// (played/won/lost/winPct) always show; matchPoints/teamPoints only show
// when the sport's `metrics` list includes them.
type Col = { key: string; label: string; get: (f: any) => string | number };

const ALL_COLS: Col[] = [
  { key: 'played', label: 'P', get: (f) => f.played ?? 0 },
  { key: 'won', label: 'W', get: (f) => f.won ?? 0 },
  { key: 'lost', label: 'L', get: (f) => f.lost ?? 0 },
  { key: 'winPct', label: 'Win%', get: (f) => `${f.winPct ?? 0}%` },
  { key: 'matchPoints', label: 'Match pts', get: (f) => f.matchPointsFor ?? 0 },
  { key: 'teamPoints', label: 'Team pts', get: (f) => f.teamPoints ?? 0 },
];

const ALWAYS_ON = new Set(['played', 'won', 'lost', 'winPct']);

function colsForMetrics(metrics: string[] | undefined): Col[] {
  const m = metrics || [];
  return ALL_COLS.filter((c) => ALWAYS_ON.has(c.key) || m.includes(c.key));
}

// ── Small reusable stat table ───────────────────────────────────────────────
const StatTable: React.FC<{ cols: Col[]; rows: { label: string; f: any }[]; totalRow?: { label: string; f: any } }> = ({
  cols,
  rows,
  totalRow,
}) => (
  <View style={styles.table}>
    <View style={styles.tableHeaderRow}>
      <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 2, textAlign: 'left' }]}>Format</Text>
      {cols.map((c) => (
        <Text key={c.key} style={[styles.tableCell, styles.tableHeaderCell]}>
          {c.label}
        </Text>
      ))}
    </View>
    {rows.map((r, idx) => (
      <View key={r.label + idx} style={styles.tableRow}>
        <Text style={[styles.tableCell, styles.tableLabelCell, { flex: 2, textAlign: 'left' }]} numberOfLines={1}>
          {r.label}
        </Text>
        {cols.map((c) => (
          <Text key={c.key} style={styles.tableCell}>
            {c.get(r.f)}
          </Text>
        ))}
      </View>
    ))}
    {totalRow && (
      <View style={[styles.tableRow, styles.tableTotalRow]}>
        <Text style={[styles.tableCell, styles.tableTotalCell, { flex: 2, textAlign: 'left' }]}>{totalRow.label}</Text>
        {cols.map((c) => (
          <Text key={c.key} style={[styles.tableCell, styles.tableTotalCell]}>
            {c.get(totalRow.f)}
          </Text>
        ))}
      </View>
    )}
  </View>
);

function buildTotal(formats: any[]) {
  const totalPlayed = formats.reduce((s, f) => s + (f.played || 0), 0);
  const totalWon = formats.reduce((s, f) => s + (f.won || 0), 0);
  const totalLost = formats.reduce((s, f) => s + (f.lost || 0), 0);
  const totalMatchPts = formats.reduce((s, f) => s + (f.matchPointsFor || 0), 0);
  const totalTeamPts = formats.reduce((s, f) => s + (f.teamPoints || 0), 0);
  const winPct = totalPlayed > 0 ? Math.round((totalWon / totalPlayed) * 100) : 0;
  return {
    played: totalPlayed,
    won: totalWon,
    lost: totalLost,
    winPct,
    matchPointsFor: totalMatchPts,
    teamPoints: totalTeamPts,
  };
}

// Fixed sport filter shown at the top of every profile — Pickleball first, then
// Badminton. Each tab shows only that sport's leagues; a sport with no matches
// yet shows an empty state.
const SPORT_TABS: { key: string; label: string }[] = [
  { key: 'pickleball', label: 'Pickleball' },
  { key: 'badminton', label: 'Badminton' },
];

// ── Screen ──────────────────────────────────────────────────────────────────
const PlayerProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const authUser = useAuthStore((s) => s.user);
  // When opened from the bottom Profile tab there are no params — fall back to
  // the logged-in user so it shows "my profile".
  const playerId = route.params?.playerId || authUser?.id;
  const seasonId = route.params?.seasonId;

  const [loading, setLoading] = useState(true);
  const [career, setCareer] = useState<any>(null);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) { setLoading(false); return; }
    setLoading(true);
    getPlayerCareer(playerId, 'private')
      .then((c) => {
        setCareer(c);
        // Pickleball first (per design); fall back to whatever sport has data.
        const has = (sp: string) => c?.sports?.some((s: any) => s.sport === sp);
        setSelectedSport(has('pickleball') ? 'pickleball' : (c?.sports?.[0]?.sport ?? 'pickleball'));
      })
      .catch((e: any) => xAlert('Error', e?.message || 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, [playerId]);

  const sport = career?.sports?.find((s: any) => s.sport === selectedSport) ?? null;

  if (loading && !career) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <YTopBar eyebrow="PROFILE" title="PLAYER PROFILE" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={BLUE} />
        </View>
      </SafeAreaView>
    );
  }

  const player = career?.player;
  const cols = colsForMetrics(sport?.metrics);

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

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsFrom(player?.fullName || '')}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.name} numberOfLines={1}>
              {player?.fullName || 'Unknown'}
            </Text>
            {player?.city ? <Text style={styles.city}>{player.city}</Text> : null}
          </View>
          {sport ? (
            <View style={styles.headline}>
              <Text style={styles.headlinePct}>{sport.headline?.winPct ?? 0}%</Text>
              <Text style={styles.headlineLabel}>{sport.sport} win</Text>
            </View>
          ) : null}
        </View>

        {/* Sport filter — Pickleball / Badminton, each shows its own data */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={{ paddingHorizontal: 14 }}>
          {SPORT_TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, t.key === selectedSport && styles.tabActive]}
              onPress={() => setSelectedSport(t.key)}
            >
              <Text style={[styles.tabText, t.key === selectedSport && styles.tabTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {!sport ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>
              No {(SPORT_TABS.find((t) => t.key === selectedSport)?.label || 'sport').toLowerCase()} matches yet.
            </Text>
          </View>
        ) : (
          <>
            {/* By-format table */}
            <View style={styles.card}>
              <View style={styles.accentBar} />
              <Text style={styles.cardTitle}>BY FORMAT</Text>
              {sport.formats?.length > 0 ? (
                <StatTable
                  cols={cols}
                  rows={sport.formats.map((f: any) => ({ label: formatLabel(f.format), f }))}
                  totalRow={{ label: 'Total', f: buildTotal(sport.formats) }}
                />
              ) : (
                <Text style={styles.emptyText}>No matches played yet.</Text>
              )}
            </View>

            {/* By-league */}
            {sport.leagues?.length > 0 && (
              <View style={styles.card}>
                <View style={styles.accentBar} />
                <Text style={styles.cardTitle}>BY LEAGUE</Text>
                {sport.leagues.map((l: any, idx: number) => (
                  <View key={l.seasonId || idx} style={styles.leagueBlock}>
                    <View style={styles.leagueHeaderRow}>
                      <Text style={styles.leagueName} numberOfLines={1}>
                        {l.leagueName} {l.seasonName ? `· ${l.seasonName}` : ''}
                      </Text>
                      {l.auctionPrice != null && <Text style={styles.leaguePrice}>₹{l.auctionPrice}</Text>}
                    </View>
                    {l.team ? <Text style={styles.leagueTeam}>{l.team}</Text> : null}
                    {l.byFormat?.length > 0 ? (
                      <StatTable cols={cols} rows={l.byFormat.map((f: any) => ({ label: formatLabel(f.format), f }))} />
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Private strip */}
        {career?.private ? (
          <View style={styles.privateStrip}>
            <Text style={styles.privateTxt}>
              Your profile · fantasy {career.private.fantasy?.points ?? 0} pts
              {career.private.fantasy?.rank != null ? ` · rank ${career.private.fantasy.rank}` : ''}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('ProfileTab', { screen: 'EditProfile' })}>
              <Text style={styles.privateLink}>Edit profile</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

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

  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 14,
    padding: 16,
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: WHITE, fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  name: { fontSize: 17, fontWeight: '800', color: TEXT_COLOR },
  city: { fontSize: 12, color: TEXT_SUB, marginTop: 2 },
  headline: { alignItems: 'flex-end' },
  headlinePct: { fontSize: 20, fontWeight: '800', color: BLUE },
  headlineLabel: { fontSize: 10, color: TEXT_MUTED, fontWeight: '600', letterSpacing: 0.3, marginTop: 2 },

  tabs: { marginBottom: 4 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    marginRight: 8,
  },
  tabActive: { backgroundColor: NAVY, borderColor: NAVY },
  tabText: { fontSize: 12, fontWeight: '700', color: TEXT_SUB },
  tabTextActive: { color: WHITE },

  card: {
    backgroundColor: WHITE,
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  accentBar: { width: 32, height: 3, borderRadius: 2, backgroundColor: LIME, marginBottom: 10 },
  cardTitle: { fontSize: 11, fontWeight: '800', color: TEXT_SUB, letterSpacing: 0.8, marginBottom: 12 },
  emptyText: { fontSize: 12, color: TEXT_MUTED, fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },

  table: { width: '100%' },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 4,
  },
  tableHeaderCell: { fontSize: 10, fontWeight: '800', color: TEXT_MUTED, letterSpacing: 0.3 },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE,
  },
  tableCell: { flex: 1, fontSize: 12, color: TEXT_COLOR, textAlign: 'right' },
  tableLabelCell: { fontSize: 12, fontWeight: '700', color: TEXT_COLOR },
  tableTotalRow: { borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: BORDER, marginTop: 2 },
  tableTotalCell: { fontWeight: '800', color: NAVY },

  leagueBlock: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE,
  },
  leagueHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leagueName: { fontSize: 13, fontWeight: '800', color: TEXT_COLOR, flex: 1 },
  leaguePrice: { fontSize: 12, fontWeight: '700', color: GREEN, marginLeft: 8 },
  leagueTeam: { fontSize: 11, color: TEXT_SUB, marginTop: 2, marginBottom: 8 },

  privateStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: 14,
    marginTop: 4,
    padding: 14,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  privateTxt: { fontSize: 12, color: NAVY, fontWeight: '600', flex: 1, marginRight: 8 },
  privateLink: { fontSize: 12, color: BLUE, fontWeight: '800' },
});
