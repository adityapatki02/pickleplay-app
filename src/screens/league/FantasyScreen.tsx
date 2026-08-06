import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  getFantasyConfig,
  getFantasyOptions,
  getFantasyMyEntry,
  upsertFantasyEntry,
  getFantasyLeaderboard,
  getFantasyTrends,
  getFantasyAdminExport,
  FantasyConfig,
  FantasyOptions,
  FantasyEntry,
  FantasyForm1,
  FantasyForm2,
  FantasyLeaderboardRow,
  FantasyTrends,
} from '../../api/fantasy.api';
import { getFranchises, getGroups, getLeague } from '../../api/leagues.api';
import { useAuthStore } from '../../store/authStore';
import type { Franchise, LeagueGroup } from '../../types/league.types';
import { xAlert, xConfirm } from '../../utils/alert';
import FantasyTrendsShareCard from '../../components/FantasyTrendsShareCard';
import DownloadButton from '../../components/DownloadButton';
import { downloadCSV } from '../../utils/csvExport';

import { YColors, YTopBar } from '../../components/yoiden';

// ─── Design tokens (matches Home CTA card: navy + orange + light blue) ───
const NAVY: string = YColors.ink;
const BLUE: string = YColors.accent;
const GREEN = '#06D6A0';
const WARN = '#FFB300';
const RED = '#EF4444';
const PURPLE = '#8B5CF6';
const ORANGE = '#F97316';           // brand accent for fantasy feature
const ORANGE_SOFT = '#FED7AA';      // soft orange tint for rows/pills
const ORANGE_DEEP = '#C2410C';      // deep orange for pressed/dark-on-light
const LIGHT_BLUE = '#93C5FD';
const SURFACE: string = YColors.bg;
const BORDER: string = YColors.line2;
const TEXT_COLOR: string = YColors.ink;
const TEXT_SUB: string = YColors.ink2;
const TEXT_MUTED: string = YColors.ink3;
const WHITE = '#FFFFFF';

// Distinct-hue palette for pie slices / chart-column fills. Cycles if we run
// out of colours (which won't happen for 8-team pools).
const SLICE_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
  '#6366F1', // indigo
  '#84CC16', // lime
  '#06B6D4', // cyan
  '#D946EF', // fuchsia
];

type Tab = 'PREDICT' | 'DREAM' | 'LEADER' | 'TRENDS';
const TABS: { key: Tab; label: string }[] = [
  { key: 'PREDICT', label: 'Predict' },
  { key: 'DREAM', label: 'Dream Team' },
  { key: 'LEADER', label: 'Leaderboard' },
  { key: 'TRENDS', label: 'Trends' },
];

// Form-2 bucket metadata. The bucket SET is not fixed — it comes from the
// season's `config.form2Shape` (SPPL = kids/teen/m1-3/w1-2; SBPL =
// kids/women13/women45/menA-C). Labels/accents are looked up per key; the pick
// count comes from the shape. `buildBuckets(shape)` turns the shape into the
// ordered array the UI renders.
const PINK = '#EC4899';
export type BucketDef = { key: string; label: string; picks: number; accent: string; hint: string };
const BUCKET_META: Record<string, { name: string; accent: string; hint: string }> = {
  // SPPL
  kids:      { name: 'Kids',      accent: PURPLE, hint: 'Any players from the Kids roster' },
  teenBoys:  { name: 'Teen Boys', accent: ORANGE, hint: 'Any teen boy' },
  teenGirls: { name: 'Teen Girls',accent: ORANGE, hint: 'Any teen girl' },
  m1: { name: 'Men 1',   accent: BLUE, hint: '' },
  w1: { name: 'Women 1', accent: PINK, hint: '' },
  m2: { name: 'Men 2',   accent: BLUE, hint: '' },
  w2: { name: 'Women 2', accent: PINK, hint: '' },
  m3: { name: 'Men 3',   accent: BLUE, hint: '' },
  // SBPL
  women13: { name: 'Women 1-3', accent: PINK, hint: '' },
  women45: { name: 'Women 4-5', accent: PINK, hint: '' },
  menA:    { name: 'Men A',     accent: BLUE, hint: '' },
  menB:    { name: 'Men B',     accent: BLUE, hint: '' },
  menC:    { name: 'Men C',     accent: BLUE, hint: '' },
};
const BUCKET_ORDER = ['kids', 'teenBoys', 'teenGirls', 'm1', 'w1', 'm2', 'w2', 'm3', 'women13', 'women45', 'menA', 'menB', 'menC'];
function buildBuckets(shape?: Record<string, number>): BucketDef[] {
  if (!shape) return [];
  return Object.keys(shape)
    .sort((a, b) => {
      const ia = BUCKET_ORDER.indexOf(a), ib = BUCKET_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map((key) => {
      const meta = BUCKET_META[key] || { name: key, accent: BLUE, hint: '' };
      const picks = shape[key];
      return { key, picks, accent: meta.accent, hint: meta.hint, label: `${meta.name} — Pick ${picks}` };
    });
}

// ═════════════════════════════════════════════════════════════════════
// Chart primitives (kept as module-scope components to avoid re-creation
// on every render of the parent). All pure — state lives in the parent.
// ═════════════════════════════════════════════════════════════════════

type Slice = { label: string; value: number; pct: number; color: string };

/** Ranked horizontal bar chart. Each row: rank, team, bar, %. Draws nothing if `data` is empty. */
function PieChartCard({ data }: { data: Slice[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0 || data.length === 0) {
    return <Text style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 }}>No picks yet.</Text>;
  }

  const sorted = [...data].sort((a, b) => b.value - a.value);
  const maxPct = sorted[0]?.pct || 1;

  return (
    <View style={{ marginVertical: 4 }}>
      {sorted.map((s, idx) => {
        const barWidth = `${Math.max(6, (s.pct / maxPct) * 100)}%` as const;
        return (
          <View key={s.label} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ width: 20, fontSize: 11, fontWeight: '800', color: '#94A3B8' }}>{idx + 1}.</Text>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: s.color, marginRight: 8 }} />
              <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: '#1A1D21' }} numberOfLines={1}>
                {s.label}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: s.color, marginLeft: 8 }}>{s.pct}%</Text>
              <Text style={{ fontSize: 10, color: '#94A3B8', fontWeight: '600', marginLeft: 4 }}>
                ({s.value})
              </Text>
            </View>
            <View style={{ height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginLeft: 38 }}>
              <View style={{ width: barWidth, height: '100%', backgroundColor: s.color, borderRadius: 4 }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Ranked list (for "Top N Semifinalists", "Top Finalists", etc.) */
function RankedList({ rows, accent }: { rows: Array<{ label: string; pct: number }>; accent: string }) {
  if (rows.length === 0) return <Text style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>No picks yet.</Text>;
  return (
    <View style={{ marginTop: 4 }}>
      {rows.map((r, idx) => (
        <View key={r.label + idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
          <Text style={{ width: 18, fontSize: 11, fontWeight: '800', color: accent }}>{idx + 1}.</Text>
          <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: '#1A1D21' }} numberOfLines={1}>
            {r.label}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '800', color: accent, marginLeft: 8 }}>{r.pct}%</Text>
        </View>
      ))}
    </View>
  );
}

export default function FantasyScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const seasonId: string = route.params?.seasonId;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('PREDICT');

  const [config, setConfig] = useState<FantasyConfig | null>(null);
  const [options, setOptions] = useState<FantasyOptions>({});
  const [entry, setEntry] = useState<FantasyEntry | null>(null);
  const [leaderboard, setLeaderboard] = useState<FantasyLeaderboardRow[]>([]);
  const [trends, setTrends] = useState<FantasyTrends | null>(null);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [groups, setGroups] = useState<LeagueGroup[]>([]);

  // Local draft state (flushed to server on Save)
  const [form1Draft, setForm1Draft] = useState<FantasyForm1>({});
  const [form2Draft, setForm2Draft] = useState<FantasyForm2>({});

  // Dream Team buckets come from the season's shape (SPPL vs SBPL differ).
  const buckets = useMemo(() => buildBuckets(config?.form2Shape), [config]);

  // Dream Team player-picker modal state
  const [pickerModal, setPickerModal] = useState<{
    visible: boolean;
    bucket: string | null;
  }>({ visible: false, bucket: null });
  const [pickerSearch, setPickerSearch] = useState('');

  // Trends sub-tab: 'team' (Form 1 predictions) vs 'player' (Form 2 popularity)
  const [trendsSubTab, setTrendsSubTab] = useState<'team' | 'player'>('team');

  // Off-screen share card capture ref + loading flag for the Share button.
  const shareCardRef = useRef<any>(null);
  const [sharing, setSharing] = useState(false);

  // Edit-mode toggles. Default: if the user has never saved, they're editing.
  // After saving, both flip to read-only until user taps EDIT. After the
  // deadline passes they're permanently locked (config.locked).
  const [editingForm1, setEditingForm1] = useState(false);
  const [editingForm2, setEditingForm2] = useState(false);
  const [showScoringRules, setShowScoringRules] = useState(false);

  // Admin gate — only the league owner sees stats meant for organisers
  // (e.g. the raw entry count on the Trends tab). Viewers see public-facing
  // info only. Pulled from the league's organizerId vs current authUser.id.
  const authUser = useAuthStore((s) => s.user);
  const [leagueOrganizerId, setLeagueOrganizerId] = useState<string | null>(null);
  const isAdmin = !!authUser?.id && !!leagueOrganizerId && leagueOrganizerId === authUser.id;

  // Admin-only fantasy CSV export. Loading state guards against rapid clicks
  // while the (potentially large) admin-export response is on the wire.
  const [fantasyExporting, setFantasyExporting] = useState(false);
  const onDownloadFantasy = useCallback(async () => {
    if (!seasonId || fantasyExporting) return;
    setFantasyExporting(true);
    try {
      const data = await getFantasyAdminExport(seasonId);
      const headers = [
        'Rank', 'User', 'Phone', 'Total Pts', 'Form 1 Pts', 'Form 2 Pts',
        'Submitted At', 'Locked At',
        // Form 1 picks
        'AB1', 'AB2', 'AB3', 'AB4', 'CD1', 'CD2', 'CD3', 'CD4',
        'Semifinalists', 'Finalists', 'Champion',
        // Form 2 picks
        'Kids', 'Teen Boys', 'Teen Girls', 'M1', 'W1', 'M2', 'W2', 'M3',
      ];
      const rows = data.entries.map((e) => [
        e.rank ?? 'DRAFT',
        e.userName,
        e.userPhone || '',
        e.totalPoints,
        e.form1Total,
        e.form2Total,
        e.submittedAt ? new Date(e.submittedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
        e.lockedAt ? new Date(e.lockedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
        e.ab1, e.ab2, e.ab3, e.ab4, e.cd1, e.cd2, e.cd3, e.cd4,
        e.semifinalists, e.finalists, e.champion,
        e.kids, e.teenBoys, e.teenGirls, e.m1, e.w1, e.m2, e.w2, e.m3,
      ]);
      const filename = `fantasy-entries-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadCSV(filename, headers, rows);
    } catch (err: any) {
      xAlert('Export failed', err?.response?.data?.message || err?.message || 'Could not download fantasy data');
    } finally {
      setFantasyExporting(false);
    }
  }, [seasonId, fantasyExporting]);

  const fetchAll = useCallback(async () => {
    if (!seasonId) return;
    try {
      const leagueId = route.params?.leagueId || '';
      const [cfg, opts, my, franchiseList, groupList, leagueData] = await Promise.all([
        getFantasyConfig(seasonId),
        getFantasyOptions(seasonId),
        getFantasyMyEntry(seasonId),
        getFranchises(leagueId).catch(() => []),
        leagueId ? getGroups(leagueId, seasonId).catch(() => []) : Promise.resolve([]),
        leagueId ? getLeague(leagueId).catch(() => null) : Promise.resolve(null),
      ]);
      setConfig(cfg);
      setOptions(opts || {});
      setEntry(my);
      setForm1Draft(my?.form1 || {});
      setForm2Draft(my?.form2 || {});
      setFranchises(Array.isArray(franchiseList) ? franchiseList : []);
      setGroups(Array.isArray(groupList) ? groupList : []);
      setLeagueOrganizerId((leagueData as any)?.organizerId ?? null);
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to load fantasy data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [seasonId, route.params?.leagueId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  const loadLeaderboard = useCallback(async () => {
    try {
      const rows = await getFantasyLeaderboard(seasonId, 5000);
      setLeaderboard(Array.isArray(rows) ? rows : []);
    } catch (err: any) {
      xAlert('Error', err?.message || 'Failed to load leaderboard');
    }
  }, [seasonId]);

  const loadTrends = useCallback(async () => {
    try {
      const t = await getFantasyTrends(seasonId);
      setTrends(t);
    } catch (err: any) {
      xAlert('Error', err?.message || 'Failed to load trends');
    }
  }, [seasonId]);

  useEffect(() => {
    if (tab === 'LEADER') loadLeaderboard();
    if (tab === 'TRENDS') loadTrends();
  }, [tab, loadLeaderboard, loadTrends]);

  // ─── Save handlers ───
  const saveForm1 = async () => {
    if (config?.locked) return;

    // Validate each step has the required count before saving
    const abCount = (form1Draft.abQualifiers || []).length;
    const cdCount = (form1Draft.cdQualifiers || []).length;
    const sfCount = (form1Draft.semifinalists || []).length;
    const finCount = (form1Draft.finalists || []).length;
    const hasChampion = !!form1Draft.champion;

    const missing: string[] = [];
    if (abCount < 4) missing.push(`Pool AB: pick ${4 - abCount} more`);
    if (cdCount < 4) missing.push(`Pool CD: pick ${4 - cdCount} more`);
    if (sfCount < 4) missing.push(`Semifinalists: pick ${4 - sfCount} more`);
    if (finCount < 2) missing.push(`Finalists: pick ${2 - finCount} more`);
    if (!hasChampion) missing.push(`Champion: pick 1`);

    if (missing.length > 0) {
      xAlert(
        'Incomplete Predictions',
        `Please complete your picks before saving:\n\n• ${missing.join('\n• ')}`,
      );
      return;
    }

    setSaving(true);
    try {
      const saved = await upsertFantasyEntry(seasonId, { form1: form1Draft });
      setEntry(saved);
      setEditingForm1(false); // flip back to read-only view after save
      xConfirm(
        'Predictions Saved 🎯',
        'Now build your Dream Team — pick 16 players across 8 categories.',
        () => setTab('DREAM'),
        'GO TO DREAM TEAM',
        'STAY HERE',
      );
    } catch (err: any) {
      xAlert('Save Failed', err?.response?.data?.message || err?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };
  const saveForm2 = async () => {
    if (config?.locked) return;

    // Validate every bucket has its required number of picks
    const missing: string[] = [];
    for (const b of buckets) {
      const raw = form2Draft[b.key] as any;
      const count = Array.isArray(raw) ? raw.length : raw ? 1 : 0;
      if (count < b.picks) {
        missing.push(`${b.label}: pick ${b.picks - count} more`);
      }
    }

    if (missing.length > 0) {
      xAlert(
        'Incomplete Dream Team',
        `Please finish picking players in these categories:\n\n• ${missing.join('\n• ')}`,
      );
      return;
    }

    setSaving(true);
    try {
      const saved = await upsertFantasyEntry(seasonId, { form2: form2Draft });
      setEntry(saved);
      setEditingForm2(false);
      xAlert('Saved 🏆', 'Dream Team saved. Tap EDIT to change before the deadline.');
    } catch (err: any) {
      xAlert('Save Failed', err?.response?.data?.message || err?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  // ─── Derived "has the user saved this form before?" ───
  // Used to gate the view/edit/locked state without relying on submittedAt alone.
  const hasForm1Saved = !!entry && !!(
    entry.form1?.abQualifiers?.length ||
    entry.form1?.cdQualifiers?.length ||
    entry.form1?.semifinalists?.length ||
    entry.form1?.finalists?.length ||
    entry.form1?.champion
  );
  const hasForm2Saved = !!entry && !!entry.form2 && Object.values(entry.form2).some((v: any) => {
    if (Array.isArray(v)) return v.length > 0;
    return !!v;
  });
  // An action button becomes "Edit" once saved. Deadline override wins.
  const form1ReadOnly = !!config?.locked || (hasForm1Saved && !editingForm1);
  const form2ReadOnly = !!config?.locked || (hasForm2Saved && !editingForm2);

  // ─── Render helpers ───
  const renderCountdown = () => {
    if (!config?.deadline) {
      return (
        <View style={styles.deadlineBanner}>
          <Text style={styles.deadlineText}>Fantasy deadline not set yet</Text>
        </View>
      );
    }
    const deadline = new Date(config.deadline);
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    if (diffMs <= 0) {
      return (
        <View style={[styles.deadlineBanner, { backgroundColor: '#FEE2E2', borderColor: RED }]}>
          <Text style={[styles.deadlineText, { color: RED }]}>🔒 Entries Locked</Text>
          <Text style={styles.deadlineSub}>Deadline passed {deadline.toLocaleString()}</Text>
        </View>
      );
    }
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return (
      <View style={styles.deadlineBanner}>
        <Text style={styles.deadlineText}>⏳ {days}d {hours}h {mins}m remaining</Text>
        <Text style={styles.deadlineSub}>Locks at {deadline.toLocaleString()}</Text>
      </View>
    );
  };

  // ═════════════════════════════════════════════════════════════════════
  // PREDICT TAB — Form 1 (bracket picker)
  // ═════════════════════════════════════════════════════════════════════
  const renderPredictTab = () => {
    const quals = [...(form1Draft.abQualifiers || []), ...(form1Draft.cdQualifiers || [])];
    const qualSet = new Set(quals);
    const sfSet = new Set(form1Draft.semifinalists || []);
    const finSet = new Set(form1Draft.finalists || []);
    const franchiseById = new Map(franchises.map((f) => [f.id, f]));
    const displayName = (id: string) => franchiseById.get(id)?.shortName || franchiseById.get(id)?.name || id.slice(0, 8);

    const togglePick = (list: string[] | undefined, max: number, id: string): string[] => {
      const cur = list ? [...list] : [];
      const idx = cur.indexOf(id);
      if (idx !== -1) {
        cur.splice(idx, 1);
      } else if (cur.length < max) {
        cur.push(id);
      }
      return cur;
    };

    // Pool segmentation — Pool AB = groups with displayOrder 0 or 1, Pool CD = 2 or 3.
    // Reuses the `franchiseById` lookup defined above to resolve junction rows
    // (LeagueGroupFranchise) back to full franchise objects with names.
    const sortedGroups = [...groups].sort((a, b) => a.displayOrder - b.displayOrder);
    const abGroupIds = new Set(sortedGroups.slice(0, 2).map((g) => g.id));
    const cdGroupIds = new Set(sortedGroups.slice(2, 4).map((g) => g.id));

    const getPoolFranchises = (poolKey: 'abQualifiers' | 'cdQualifiers'): Franchise[] => {
      const groupIds = poolKey === 'abQualifiers' ? abGroupIds : cdGroupIds;
      if (groupIds.size === 0) return franchises; // fallback if groups not loaded
      // group.franchises is LeagueGroupFranchise[] (junction rows), each with
      // franchiseId + nested franchise object. Pull the franchiseId out.
      const pooledIds = new Set<string>();
      for (const g of sortedGroups) {
        if (!groupIds.has(g.id)) continue;
        for (const gf of (g.franchises as any) || []) {
          const fid = gf.franchiseId || gf.franchise?.id || gf.id;
          if (fid) pooledIds.add(fid);
        }
      }
      // Resolve to full franchise objects from the main franchises list
      const resolved: Franchise[] = [];
      for (const id of pooledIds) {
        const full = franchiseById.get(id);
        if (full) resolved.push(full);
      }
      // Final safety fallback — if resolution is empty for some reason, show all
      if (resolved.length === 0) return franchises;
      return resolved;
    };

    const renderPoolStep = (label: string, poolKey: 'abQualifiers' | 'cdQualifiers') => {
      const poolFranchises = getPoolFranchises(poolKey);
      const poolLabel = poolKey === 'abQualifiers' ? 'Pool AB' : 'Pool CD';
      const pickedIds = form1Draft[poolKey] || [];

      // Read-only view: show only the picked teams
      if (form1ReadOnly) {
        const pickedTeams = pickedIds
          .map((id) => poolFranchises.find((f) => f.id === id))
          .filter(Boolean) as typeof poolFranchises;
        return (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>{label}</Text>
            <Text style={styles.stepSub}>Your picks from {poolLabel}</Text>
            <View style={styles.chipRow}>
              {pickedTeams.length === 0 ? (
                <Text style={[styles.stepSub, { fontStyle: 'italic' }]}>No picks saved</Text>
              ) : (
                pickedTeams.map((f) => (
                  <View key={f.id} style={[styles.chip, { backgroundColor: BLUE, borderColor: BLUE }]}>
                    <Text style={[styles.chipText, { color: WHITE }]} numberOfLines={1}>
                      {f.shortName || f.name}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        );
      }

      return (
        <View style={styles.stepCard}>
          <Text style={styles.stepTitle}>{label}</Text>
          <Text style={styles.stepSub}>
            Pick 4 teams from {poolLabel}
            {poolFranchises.length === 0 ? ' (no teams assigned to this pool yet)' : ` (${poolFranchises.length} available)`}
          </Text>
          <View style={styles.chipRow}>
            {poolFranchises.map((f) => {
              const selected = pickedIds.includes(f.id);
              const count = pickedIds.length;
              const atMax = count >= 4 && !selected;
              return (
                <TouchableOpacity
                  key={f.id}
                  disabled={atMax}
                  onPress={() => setForm1Draft((p) => ({ ...p, [poolKey]: togglePick(p[poolKey], 4, f.id) }))}
                  style={[
                    styles.chip,
                    selected && { backgroundColor: BLUE, borderColor: BLUE },
                    atMax && { opacity: 0.35 },
                  ]}
                >
                  <Text style={[styles.chipText, selected && { color: WHITE }]} numberOfLines={1}>
                    {f.shortName || f.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.stepCount}>
            {pickedIds.length} / 4 picked
          </Text>
        </View>
      );
    };

    return (
      <ScrollView contentContainerStyle={styles.tabContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {renderCountdown()}

        {renderPoolStep('1. Pool AB — Top 4', 'abQualifiers')}
        {renderPoolStep('2. Pool CD — Top 4', 'cdQualifiers')}

        {/* Step 3: Semifinalists (from the 8 quals) */}
        {form1ReadOnly ? (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>3. Your Semifinalists</Text>
            <View style={styles.chipRow}>
              {(form1Draft.semifinalists || []).length === 0 ? (
                <Text style={[styles.stepSub, { fontStyle: 'italic' }]}>No picks saved</Text>
              ) : (
                (form1Draft.semifinalists || []).map((id) => (
                  <View key={id} style={[styles.chip, { backgroundColor: GREEN, borderColor: GREEN }]}>
                    <Text style={[styles.chipText, { color: WHITE }]} numberOfLines={1}>
                      {displayName(id)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>3. Pick Your 4 Semifinalists</Text>
            <Text style={styles.stepSub}>Choose from your 8 Pool AB + CD qualifiers</Text>
            <View style={styles.chipRow}>
              {quals.length === 0 ? (
                <Text style={styles.hintText}>Pick qualifiers first</Text>
              ) : (
                quals.map((id) => {
                  const selected = sfSet.has(id);
                  const atMax = (form1Draft.semifinalists || []).length >= 4 && !selected;
                  return (
                    <TouchableOpacity
                      key={id}
                      disabled={atMax}
                      onPress={() => setForm1Draft((p) => ({
                        ...p,
                        semifinalists: togglePick(p.semifinalists, 4, id),
                        finalists: (p.finalists || []).filter((f) => f !== id || selected),
                        champion: p.champion === id && selected ? undefined : p.champion,
                      }))}
                      style={[
                        styles.chip,
                        selected && { backgroundColor: GREEN, borderColor: GREEN },
                        atMax && { opacity: 0.35 },
                      ]}
                    >
                      <Text style={[styles.chipText, selected && { color: WHITE }]} numberOfLines={1}>
                        {displayName(id)}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
            <Text style={styles.stepCount}>
              {(form1Draft.semifinalists || []).length} / 4 picked
            </Text>
          </View>
        )}

        {/* Step 4: Finalists (from SFs) */}
        {form1ReadOnly ? (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>4. Your Finalists</Text>
            <View style={styles.chipRow}>
              {(form1Draft.finalists || []).length === 0 ? (
                <Text style={[styles.stepSub, { fontStyle: 'italic' }]}>No picks saved</Text>
              ) : (
                (form1Draft.finalists || []).map((id) => (
                  <View key={id} style={[styles.chip, { backgroundColor: WARN, borderColor: WARN }]}>
                    <Text style={[styles.chipText, { color: WHITE }]} numberOfLines={1}>
                      {displayName(id)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>4. Pick Your 2 Finalists</Text>
            <Text style={styles.stepSub}>Choose from your 4 semifinalists</Text>
            <View style={styles.chipRow}>
              {(form1Draft.semifinalists || []).length === 0 ? (
                <Text style={styles.hintText}>Pick semifinalists first</Text>
              ) : (
                (form1Draft.semifinalists || []).map((id) => {
                  const selected = finSet.has(id);
                  const atMax = (form1Draft.finalists || []).length >= 2 && !selected;
                  return (
                    <TouchableOpacity
                      key={id}
                      disabled={atMax}
                      onPress={() => setForm1Draft((p) => ({
                        ...p,
                        finalists: togglePick(p.finalists, 2, id),
                        champion: p.champion === id && selected ? undefined : p.champion,
                      }))}
                      style={[
                        styles.chip,
                        selected && { backgroundColor: WARN, borderColor: WARN },
                        atMax && { opacity: 0.35 },
                      ]}
                    >
                      <Text style={[styles.chipText, selected && { color: WHITE }]} numberOfLines={1}>
                        {displayName(id)}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
            <Text style={styles.stepCount}>
              {(form1Draft.finalists || []).length} / 2 picked
            </Text>
          </View>
        )}

        {/* Step 5: Champion (from Finalists) */}
        {form1ReadOnly ? (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>5. Your Champion 🏆</Text>
            <View style={styles.chipRow}>
              {form1Draft.champion ? (
                <View style={[styles.chip, { paddingHorizontal: 18, paddingVertical: 14, backgroundColor: RED, borderColor: RED }]}>
                  <Text style={[styles.chipText, { fontSize: 14, color: WHITE }]} numberOfLines={1}>
                    🏆 {displayName(form1Draft.champion)}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.stepSub, { fontStyle: 'italic' }]}>No pick saved</Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>5. Predict the Champion 🏆</Text>
            <Text style={styles.stepSub}>Pick from your 2 finalists</Text>
            <View style={styles.chipRow}>
              {(form1Draft.finalists || []).length === 0 ? (
                <Text style={styles.hintText}>Pick finalists first</Text>
              ) : (
                (form1Draft.finalists || []).map((id) => {
                  const selected = form1Draft.champion === id;
                  return (
                    <TouchableOpacity
                      key={id}
                      onPress={() => setForm1Draft((p) => ({ ...p, champion: p.champion === id ? undefined : id }))}
                      style={[
                        styles.chip,
                        { paddingHorizontal: 18, paddingVertical: 14 },
                        selected && { backgroundColor: RED, borderColor: RED },
                      ]}
                    >
                      <Text style={[styles.chipText, { fontSize: 14 }, selected && { color: WHITE }]} numberOfLines={1}>
                        🏆 {displayName(id)}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>
        )}

        {config?.locked ? (
          <View style={[styles.saveBtn, { backgroundColor: TEXT_MUTED, opacity: 0.8 }]}>
            <Text style={styles.saveBtnText}>🔒 LOCKED — DEADLINE PASSED</Text>
          </View>
        ) : form1ReadOnly && hasForm1Saved ? (
          // User has saved previously and is NOT currently editing. Show EDIT button.
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: NAVY, borderWidth: 2, borderColor: ORANGE }]}
            onPress={() => setEditingForm1(true)}
          >
            <Text style={styles.saveBtnText}>✏️  EDIT PREDICTIONS</Text>
          </TouchableOpacity>
        ) : (
          // Initial state OR actively editing — show SAVE button.
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={saveForm1}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color={WHITE} /> : <Text style={styles.saveBtnText}>SAVE PREDICTIONS</Text>}
          </TouchableOpacity>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    );
  };

  // ═════════════════════════════════════════════════════════════════════
  // DREAM TEAM TAB — Form 2
  // ═════════════════════════════════════════════════════════════════════
  const renderDreamTab = () => {
    // Compute all picked player IDs across all buckets (for duplicate detection)
    const allPicked = new Set<string>();
    for (const b of buckets) {
      const raw = form2Draft[b.key] as any;
      if (!raw) continue;
      const ids = Array.isArray(raw) ? raw : [raw];
      ids.forEach((id: string) => allPicked.add(id));
    }

    const renderBucket = (b: BucketDef) => {
      const bucketOptions = options[b.key] || [];
      const raw = form2Draft[b.key] as any;
      const picked: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
      const count = picked.length;
      const optionById = new Map(bucketOptions.map((o) => [o.playerId, o]));

      const removePick = (id: string) => {
        if (form2ReadOnly) return;
        const next = picked.filter((p) => p !== id);
        setForm2Draft((p) => ({
          ...p,
          [b.key]: b.picks === 1 ? (next[0] || undefined) : next,
        }));
      };

      const openPicker = () => {
        if (form2ReadOnly) return;
        setPickerSearch('');
        setPickerModal({ visible: true, bucket: b.key });
      };

      return (
        <View key={b.key} style={[styles.stepCard, { borderLeftWidth: 4, borderLeftColor: b.accent }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.stepTitle}>{b.label}</Text>
            {!form2ReadOnly && (
              <Text style={{ fontSize: 12, fontWeight: '800', color: b.accent }}>{count}/{b.picks}</Text>
            )}
          </View>
          {!form2ReadOnly && !!b.hint && <Text style={styles.stepSub}>{b.hint}</Text>}

          {/* Picked players */}
          {picked.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: form2ReadOnly ? 6 : 0, marginBottom: form2ReadOnly ? 0 : 10 }}>
              {picked.map((id) => {
                const opt = optionById.get(id);
                return (
                  <View
                    key={id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: b.accent,
                      paddingLeft: 10,
                      paddingRight: form2ReadOnly ? 10 : 4,
                      paddingVertical: 4,
                      borderRadius: 8,
                      gap: 6,
                    }}
                  >
                    <View>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: WHITE }} numberOfLines={1}>
                        {opt?.playerName || 'Player'}
                      </Text>
                      <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)' }} numberOfLines={1}>
                        {opt?.franchiseName || ''}
                      </Text>
                    </View>
                    {!form2ReadOnly && (
                      <TouchableOpacity
                        onPress={() => removePick(id)}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: 'rgba(255,255,255,0.3)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: WHITE, fontSize: 14, fontWeight: '900', lineHeight: 16 }}>×</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            form2ReadOnly && (
              <Text style={[styles.stepSub, { fontStyle: 'italic', marginTop: 4 }]}>No picks saved</Text>
            )
          )}

          {/* CHOOSE button — hidden entirely in read-only mode */}
          {!form2ReadOnly && (
            bucketOptions.length === 0 ? (
              <Text style={styles.hintText}>No players available in this category.</Text>
            ) : (
              <TouchableOpacity
                onPress={openPicker}
                disabled={count >= b.picks}
                style={{
                  paddingVertical: 12,
                  borderRadius: 8,
                  borderWidth: 1.5,
                  borderColor: b.accent,
                  borderStyle: 'dashed',
                  alignItems: 'center',
                  backgroundColor: count >= b.picks ? SURFACE : WHITE,
                  opacity: count >= b.picks ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: b.accent, letterSpacing: 0.5 }}>
                  {count >= b.picks
                    ? '✓ ALL PICKED — TAP PLAYER TO REMOVE'
                    : `+ CHOOSE PLAYER${b.picks > 1 ? 'S' : ''}`}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
      );
    };

    return (
      <ScrollView contentContainerStyle={styles.tabContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {renderCountdown()}
        <View style={[styles.infoCard, { backgroundColor: '#FFF7ED', borderColor: ORANGE }]}>
          <Text style={styles.infoTitle}>⭐ Build Your Dream Team</Text>
          <Text style={styles.infoText}>
            Pick 16 players total across 8 categories. You score points for each match your players win + team-progression bonuses.
          </Text>
        </View>

        {buckets.map(renderBucket)}

        {config?.locked ? (
          <View style={[styles.saveBtn, { backgroundColor: TEXT_MUTED, opacity: 0.8 }]}>
            <Text style={styles.saveBtnText}>🔒 LOCKED — DEADLINE PASSED</Text>
          </View>
        ) : form2ReadOnly && hasForm2Saved ? (
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: NAVY, borderWidth: 2, borderColor: ORANGE }]}
            onPress={() => setEditingForm2(true)}
          >
            <Text style={styles.saveBtnText}>✏️  EDIT DREAM TEAM</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={saveForm2}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color={WHITE} /> : <Text style={styles.saveBtnText}>SAVE DREAM TEAM</Text>}
          </TouchableOpacity>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    );
  };

  // ═════════════════════════════════════════════════════════════════════
  // LEADERBOARD TAB
  // ═════════════════════════════════════════════════════════════════════
  const renderLeaderTab = () => {
    const bd = entry?.pointsBreakdown;
    const myRank = leaderboard.findIndex((r) => r.userId === entry?.userId) + 1;
    return (
    <ScrollView contentContainerStyle={styles.tabContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {/* My Score card */}
      {entry && (
        <View style={[styles.stepCard, { borderLeftWidth: 4, borderLeftColor: ORANGE }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.stepTitle}>🎯 My Score</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 28, fontWeight: '900', color: NAVY, letterSpacing: -1 }}>
                {entry.totalPoints}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: TEXT_SUB, letterSpacing: 1 }}>
                {myRank > 0 ? `RANK #${myRank}` : 'UNRANKED'}
              </Text>
            </View>
          </View>

          {/* Form 1 breakdown — always show all 5 buckets */}
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: BLUE, letterSpacing: 1, marginBottom: 6 }}>
              PREDICTIONS ({bd?.form1Total ?? 0} pts)
            </Text>
            {(bd?.form1 && bd.form1.length > 0
              ? bd.form1
              : [
                  { bucket: 'Pool AB qualifiers', earned: 0, max: 8 },
                  { bucket: 'Pool CD qualifiers', earned: 0, max: 8 },
                  { bucket: 'Semifinalists', earned: 0, max: 12 },
                  { bucket: 'Finalists', earned: 0, max: 10 },
                  { bucket: 'Champion', earned: 0, max: 12 },
                ]
            ).map((b, idx) => (
              <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ fontSize: 12, color: TEXT_COLOR, flex: 1 }} numberOfLines={1}>{b.bucket}</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: b.earned > 0 ? GREEN : TEXT_MUTED }}>
                  {b.earned}/{b.max} pts
                </Text>
              </View>
            ))}
          </View>

          {/* Form 2 breakdown — always show section, list scoring players or fallback */}
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: ORANGE, letterSpacing: 1, marginBottom: 6 }}>
              DREAM TEAM ({bd?.form2Total ?? 0} pts)
            </Text>
            {(() => {
              const scoring = (bd?.form2 || []).filter((p) => p.earned > 0);
              if (scoring.length === 0) {
                return (
                  <Text style={{ fontSize: 11, color: TEXT_MUTED, fontStyle: 'italic' }}>
                    No points scored yet — your picks earn points as they win matches and their teams advance.
                  </Text>
                );
              }
              return scoring
                .sort((a, b) => b.earned - a.earned)
                .map((p, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Text style={{ fontSize: 12, color: TEXT_COLOR, flex: 1 }} numberOfLines={1}>
                      {p.playerName || p.playerId.slice(0, 8)} <Text style={{ color: TEXT_MUTED, fontSize: 10 }}>({p.category})</Text>
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: GREEN }}>
                      +{p.earned} pts
                    </Text>
                  </View>
                ));
            })()}
          </View>
        </View>
      )}

      {/* Scoring rules (collapsible) */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setShowScoringRules((s) => !s)}
        style={[styles.stepCard, { backgroundColor: SURFACE }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.stepTitle}>📖 How Scoring Works</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: TEXT_SUB }}>
            {showScoringRules ? '▲' : '▼'}
          </Text>
        </View>
        {showScoringRules && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: BLUE, letterSpacing: 1, marginBottom: 4 }}>PREDICTIONS (Form 1)</Text>
            <Text style={{ fontSize: 12, color: TEXT_COLOR, lineHeight: 18 }}>
              • Each correct Pool AB/CD qualifier: <Text style={{ fontWeight: '800' }}>2 pts</Text>{'\n'}
              • Each correct semifinalist: <Text style={{ fontWeight: '800' }}>3 pts</Text>{'\n'}
              • Each correct finalist: <Text style={{ fontWeight: '800' }}>5 pts</Text>{'\n'}
              • Correct champion: <Text style={{ fontWeight: '800' }}>12 pts</Text>{'\n'}
              <Text style={{ color: TEXT_SUB, fontSize: 11 }}>Max possible: 50 pts</Text>
            </Text>

            <Text style={{ fontSize: 11, fontWeight: '800', color: ORANGE, letterSpacing: 1, marginTop: 14, marginBottom: 4 }}>DREAM TEAM (Form 2)</Text>
            <Text style={{ fontSize: 12, color: TEXT_COLOR, lineHeight: 18 }}>
              Picked players earn points across every match — league rounds, quarterfinals, qualifiers, eliminator, and final:{'\n'}
              • Match win: <Text style={{ fontWeight: '800' }}>3–4 pts</Text> (match's point value){'\n'}
              • Win + opponent under 5: <Text style={{ fontWeight: '800' }}>+2 pts</Text>{'\n'}
              • Loss but scored over 10: <Text style={{ fontWeight: '800' }}>+1 pt</Text>{'\n'}
              • Golden point (14-all): <Text style={{ fontWeight: '800' }}>+2 pts</Text> to loser
            </Text>

            <Text style={{ fontSize: 11, fontWeight: '800', color: TEXT_SUB, letterSpacing: 1, marginTop: 14, marginBottom: 4 }}>TIE-BREAKER</Text>
            <Text style={{ fontSize: 12, color: TEXT_COLOR, lineHeight: 18 }}>
              If two entries have equal points, the one submitted earlier ranks higher.
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.stepCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>🏅 Fantasy Leaderboard</Text>
            <Text style={styles.stepSub}>All entries by total points</Text>
          </View>
          {/* Admin-only export — pulls full picks (Form 1 + Form 2) for every
              entry, resolved to franchise / player names. */}
          {isAdmin && (
            <DownloadButton
              compact
              label="DOWNLOAD CSV"
              loading={fantasyExporting}
              onPress={onDownloadFantasy}
            />
          )}
        </View>
        {leaderboard.length === 0 ? (
          <Text style={styles.hintText}>No entries yet.</Text>
        ) : (
          <View style={{ marginTop: 8 }}>
            <View style={styles.leaderHeaderRow}>
              <Text style={[styles.leaderCell, { width: 36 }]}>#</Text>
              <Text style={[styles.leaderCell, { flex: 1, textAlign: 'left' }]}>Player</Text>
              <Text style={[styles.leaderCell, { width: 64, textAlign: 'right' }]}>Pts</Text>
            </View>
            {leaderboard.map((row) => {
              const isMe = entry?.userId === row.userId;
              return (
                <View
                  key={row.userId}
                  style={[styles.leaderRow, isMe && { backgroundColor: '#ECFDF5' }]}
                >
                  <Text style={[styles.leaderCell, { width: 36, fontWeight: '800', color: row.rank <= 3 ? WARN : TEXT_SUB }]}>
                    {row.rank}
                  </Text>
                  <Text style={[styles.leaderCell, { flex: 1, textAlign: 'left', fontWeight: isMe ? '800' : '600' }]} numberOfLines={1}>
                    {row.userName}{isMe ? ' (You)' : ''}
                  </Text>
                  <Text style={[styles.leaderCell, { width: 64, textAlign: 'right', fontWeight: '800', color: NAVY }]}>
                    {row.totalPoints}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
      <View style={{ height: 120 }} />
    </ScrollView>
    );
  };

  // ═════════════════════════════════════════════════════════════════════
  // TRENDS TAB
  // ═════════════════════════════════════════════════════════════════════
  /** Reusable section renderer — bar-chart style with label + percentage. */
  const renderTrendSection = (
    title: string,
    subtitle: string | undefined,
    rows: Array<{ label: string; sub?: string | null; count: number; pct: number }>,
    color: string,
  ) => (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.trendSectionTitle}>{title}</Text>
      {subtitle ? <Text style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>{subtitle}</Text> : null}
      {rows.length === 0 ? (
        <Text style={styles.hintText}>No picks yet.</Text>
      ) : (
        rows.map((r, idx) => (
          <View key={idx} style={[styles.trendRow, { alignItems: 'flex-start' }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: TEXT_COLOR }} numberOfLines={1}>
                {r.label}
              </Text>
              {r.sub ? (
                <Text style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 1 }} numberOfLines={1}>
                  {r.sub}
                </Text>
              ) : null}
            </View>
            <View style={[styles.trendBarBg, { alignSelf: 'center' }]}>
              <View style={[styles.trendBarFill, { width: `${r.pct}%`, backgroundColor: color }]} />
            </View>
            <Text style={[styles.trendPct, { alignSelf: 'center' }]}>{r.pct}%</Text>
          </View>
        ))
      )}
    </View>
  );

  // Capture the off-screen share card as a JPG and either trigger the Web
  // Share sheet (mobile Android/iOS → picks WhatsApp) or fall back to a
  // plain file download when share isn't supported (desktop browsers).
  const shareTrendsCard = async () => {
    if (!trends || sharing) return;
    if (Platform.OS !== 'web') {
      xAlert('Unsupported', 'Download is available on the web version only.');
      return;
    }
    setSharing(true);
    try {
      const node = shareCardRef.current;
      if (!node) throw new Error('Share card not mounted yet — try again in a moment.');
      if (!node.scrollWidth || !node.scrollHeight) {
        throw new Error(`Share card has zero size (${node.scrollWidth}×${node.scrollHeight}).`);
      }
      const [{ default: html2canvas }, FileSaverMod]: any = await Promise.all([
        import('html2canvas'),
        import('file-saver'),
      ]);
      if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
        try { await (document as any).fonts.ready; } catch { /* ignore */ }
      }
      const canvas = await html2canvas(node, {
        backgroundColor: '#FFFFFF',
        scale: 2,
        useCORS: true,
        logging: false,
        width: node.scrollWidth,
        height: node.scrollHeight,
        windowWidth: node.scrollWidth,
        windowHeight: node.scrollHeight,
      });
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95),
      );
      if (!blob) throw new Error('Canvas capture failed — blob is null');
      const filename = `sppl-fantasy-trends-${new Date().toISOString().slice(0, 10)}.jpg`;
      const saveAs = FileSaverMod?.saveAs || FileSaverMod?.default?.saveAs || FileSaverMod?.default;
      if (typeof saveAs === 'function') {
        saveAs(blob, filename);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (err: any) {
      console.error('[shareTrendsCard]', err);
      xAlert('Download Failed', err?.message || 'Could not create image');
    } finally {
      setSharing(false);
    }
  };

  const renderTrendsTab = () => {
    const subTabButtons: { key: 'team' | 'player'; label: string }[] = [
      { key: 'team', label: 'Team Wise' },
      { key: 'player', label: 'Player Wise' },
    ];

    // Attach a stable color to each team per pool so the pie slice and the
    // ranked-list row agree visually.
    const withColors = <T extends { franchiseName: string; count: number; pct: number }>(rows: T[]) =>
      rows.map((r, i) => ({ ...r, color: SLICE_COLORS[i % SLICE_COLORS.length] }));

    // "Most popular player overall" — highest count in any Dream Team bucket
    // across all entries. Only computed when trends are loaded.
    const mostPopularPlayer = (() => {
      if (!trends) return null;
      let best: { playerName: string; bucket: string; count: number; pct: number } | null = null;
      for (const [bucket, picks] of Object.entries(trends.topPicks || {})) {
        for (const p of picks as any[]) {
          if (!best || p.count > best.count) {
            const bucketLabel = buckets.find((b) => b.key === bucket)?.label || bucket;
            best = { playerName: p.playerName, bucket: bucketLabel, count: p.count, pct: p.pct };
          }
        }
      }
      return best;
    })();

    return (
      <ScrollView contentContainerStyle={styles.tabContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Header + entries count + sub-tabs */}
        <View style={styles.stepCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={styles.stepTitle}>📊 Pick Trends</Text>
            {/* Raw entry count is admin-only — viewers don't need to know
                the participation number. We hype "lots of entries" without
                giving away the actual count. */}
            {isAdmin ? (
              <Text style={{ fontSize: 11, color: TEXT_SUB }}>
                {trends ? `${trends.totalEntries} entries` : '...'}
              </Text>
            ) : null}
          </View>

          {/* Share trends as image — surfaces the Web Share sheet on mobile
              (WhatsApp, etc.) or downloads a JPG on desktop. Hidden on
              native for now (no react-native-view-shot wired yet). */}
          {Platform.OS === 'web' && !!trends && trends.totalEntries > 0 ? (
            <TouchableOpacity
              onPress={shareTrendsCard}
              disabled={sharing}
              activeOpacity={0.85}
              style={{
                marginTop: 8,
                marginBottom: 10,
                backgroundColor: NAVY,
                paddingVertical: 11,
                borderRadius: 10,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
                opacity: sharing ? 0.6 : 1,
              }}
            >
              {sharing ? (
                <ActivityIndicator size="small" color={WHITE} />
              ) : (
                <>
                  <Text style={{ color: WHITE, fontSize: 14 }}>⬇</Text>
                  <Text style={{ color: WHITE, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 }}>
                    DOWNLOAD TRENDS IMAGE
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
          <View style={{ flexDirection: 'row', backgroundColor: SURFACE, borderRadius: 8, padding: 3 }}>
            {subTabButtons.map((st) => {
              const active = trendsSubTab === st.key;
              // Each sub-tab gets its own light pastel pill tinted to match the
              // dashboard it opens (light blue for team, light teal for player).
              const activeBg = st.key === 'team' ? '#DBEAFE' : '#CCFBF1';
              const activeText = st.key === 'team' ? NAVY : '#0F766E';
              return (
                <TouchableOpacity
                  key={st.key}
                  onPress={() => setTrendsSubTab(st.key)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 6,
                    backgroundColor: active ? activeBg : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: active ? activeText : TEXT_SUB, letterSpacing: 0.5 }}>
                    {st.label.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {!trends ? (
          <Text style={styles.hintText}>Loading trends...</Text>
        ) : trendsSubTab === 'team' ? (
          // ═══════════════ DASHBOARD 1 — TEAM PREDICTIONS ═══════════════
          <>
            <View style={styles.dashHeader}>
              <Text style={styles.dashHeaderIcon}>🏆</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.dashHeaderTitle}>DASHBOARD 1 — TEAM PREDICTIONS</Text>
                <Text style={styles.dashHeaderSub}>Overview of Fantasy League Predictions</Text>
              </View>
            </View>

            {/* Pool AB + Pool CD — stacked pies */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>POOL AB — QUARTERFINAL PREDICTIONS</Text>
              <PieChartCard data={withColors(trends.abQualifiers || []).map((c) => ({ label: c.franchiseName, value: c.count, pct: c.pct, color: c.color }))} />
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>POOL CD — QUARTERFINAL PREDICTIONS</Text>
              <PieChartCard data={withColors(trends.cdQualifiers || []).map((c) => ({ label: c.franchiseName, value: c.count, pct: c.pct, color: c.color }))} />
            </View>

            {/* Semifinalist bar chart — shows every team that got any picks */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>SEMIFINALIST TRENDS</Text>
              <Text style={styles.chartSub}>All teams picked as semifinalists</Text>
              {renderTrendSection(
                '',
                undefined,
                (trends.semifinalists || []).map((c) => ({ label: c.franchiseName, count: c.count, pct: c.pct })),
                GREEN,
              )}
              {/* Top 4 callout */}
              {(trends.semifinalists || []).length > 0 && (
                <View style={{ backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, marginTop: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: '#B45309', letterSpacing: 0.5, marginBottom: 6 }}>⭐ TOP 4 SEMIFINALISTS</Text>
                  <RankedList
                    rows={(trends.semifinalists || []).slice(0, 4).map((c) => ({ label: c.franchiseName, pct: c.pct }))}
                    accent={WARN}
                  />
                </View>
              )}
            </View>

            {/* Final Predictions block — finalists bars + winner card */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>FINAL PREDICTIONS</Text>
              <Text style={styles.chartSub}>Who participants think will reach the final & win</Text>

              <Text style={{ fontSize: 11, fontWeight: '900', color: WARN, letterSpacing: 0.5, marginTop: 8, marginBottom: 4 }}>🥈 MOST PICKED FINALISTS</Text>
              {renderTrendSection(
                '',
                undefined,
                (trends.finalists || []).map((c) => ({ label: c.franchiseName, count: c.count, pct: c.pct })),
                WARN,
              )}

              <Text style={{ fontSize: 11, fontWeight: '900', color: RED, letterSpacing: 0.5, marginTop: 12, marginBottom: 4 }}>🏆 MOST PREDICTED CHAMPION</Text>
              {(trends.champions || []).length === 0 ? (
                <Text style={styles.hintText}>No picks yet.</Text>
              ) : (
                <View style={{ backgroundColor: '#FEE2E2', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 }}>
                  <Text style={{ fontSize: 28 }}>🏆</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: NAVY, marginTop: 4 }} numberOfLines={1}>
                    {(trends.champions || [])[0]?.franchiseName}
                  </Text>
                  <Text style={{ fontSize: 26, fontWeight: '900', color: RED, marginTop: 2 }}>
                    {(trends.champions || [])[0]?.pct}%
                  </Text>
                  <Text style={{ fontSize: 10, color: TEXT_SUB, fontStyle: 'italic', marginTop: 2 }}>of participants</Text>
                </View>
              )}

              {/* Full ranking of all champion picks */}
              {(trends.champions || []).length > 1 && (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 4 }}>All champion picks</Text>
                  {renderTrendSection(
                    '',
                    undefined,
                    (trends.champions || []).map((c) => ({ label: c.franchiseName, count: c.count, pct: c.pct })),
                    RED,
                  )}
                </View>
              )}
            </View>

            <Text style={{ fontSize: 9, color: TEXT_MUTED, fontStyle: 'italic', textAlign: 'center', marginTop: 4 }}>
              * Percentages are based on total responses
            </Text>
          </>
        ) : (
          // ═══════════════ DASHBOARD 2 — PLAYER POPULARITY ═══════════════
          <>
            <View style={[styles.dashHeader, { backgroundColor: '#CCFBF1', borderColor: '#99F6E4' }]}>
              <Text style={styles.dashHeaderIcon}>👥</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dashHeaderTitle, { color: '#0F766E' }]}>DASHBOARD 2 — PLAYER POPULARITY</Text>
                <Text style={[styles.dashHeaderSub, { color: '#115E59' }]}>Most Selected Players by Category</Text>
              </View>
            </View>

            {buckets.map((b) => {
              const picks = (trends.topPicks && trends.topPicks[b.key]) || [];
              const topN = picks.slice(0, 5);
              return (
                <View key={b.key} style={[styles.chartCard, { borderLeftWidth: 4, borderLeftColor: b.accent }]}>
                  <Text style={[styles.chartTitle, { color: b.accent }]}>{b.label.toUpperCase()} — TOP {Math.min(5, topN.length || 5)}</Text>
                  {topN.length === 0 ? (
                    <Text style={styles.hintText}>No picks yet.</Text>
                  ) : (
                    topN.map((p, idx) => (
                      <View key={p.playerId} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                        <Text style={{ width: 20, fontSize: 12, fontWeight: '800', color: b.accent }}>{idx + 1}.</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: TEXT_COLOR }} numberOfLines={1}>{p.playerName}</Text>
                          {p.franchiseName ? (
                            <Text style={{ fontSize: 9, color: TEXT_MUTED }} numberOfLines={1}>{p.franchiseName}</Text>
                          ) : null}
                        </View>
                        <View style={{ width: 70, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, marginHorizontal: 8, overflow: 'hidden' }}>
                          <View style={{ width: `${p.pct}%`, height: 6, backgroundColor: b.accent }} />
                        </View>
                        <Text style={{ width: 40, textAlign: 'right', fontSize: 11, fontWeight: '800', color: b.accent }}>{p.pct}%</Text>
                      </View>
                    ))
                  )}
                </View>
              );
            })}

            {/* Most Popular Player Overall — highlighted card */}
            {mostPopularPlayer && (
              <View style={{ backgroundColor: '#FEF3C7', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: WARN }}>
                <Text style={{ fontSize: 11, fontWeight: '900', color: '#B45309', letterSpacing: 0.5, textAlign: 'center', marginBottom: 6 }}>
                  🥇 MOST POPULAR PLAYER OVERALL
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: NAVY, textAlign: 'center' }} numberOfLines={1}>
                  {mostPopularPlayer.playerName}
                </Text>
                <Text style={{ fontSize: 11, color: TEXT_SUB, textAlign: 'center', marginTop: 2 }}>
                  ({mostPopularPlayer.bucket})
                </Text>
                <Text style={{ fontSize: 26, fontWeight: '900', color: WARN, textAlign: 'center', marginTop: 6 }}>
                  {mostPopularPlayer.pct}%
                </Text>
                <Text style={{ fontSize: 10, color: TEXT_SUB, fontStyle: 'italic', textAlign: 'center' }}>selected by {mostPopularPlayer.pct}% of participants</Text>
              </View>
            )}

            <Text style={{ fontSize: 9, color: TEXT_MUTED, fontStyle: 'italic', textAlign: 'center', marginTop: 4 }}>
              * Percentages are based on total responses
            </Text>
          </>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={styles.loadingText}>Loading fantasy league...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <YTopBar
        eyebrow={`SPPL · MY POINTS ${entry?.totalPoints ?? 0}`}
        title="FANTASY"
        onBack={() => navigation.goBack()}
      />

      {/* Tab bar (2 rows — 2 + 2).
          Action tabs (Predict / Dream Team) use an orange accent — they're where
          the user inputs picks. Info tabs (Leaderboard / Trends) stay navy — they
          only display data. Clear visual separation between "do" and "see". */}
      <View style={styles.tabBar}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {TABS.map((t) => {
            const active = tab === t.key;
            const isAction = t.key === 'PREDICT' || t.key === 'DREAM';
            const activeBg = isAction ? ORANGE : NAVY;
            const activeBorder = isAction ? ORANGE : NAVY;
            return (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.tabChip,
                  { flexGrow: 1, flexBasis: '48%', alignItems: 'center' },
                  // Subtle tint on inactive action tabs so they hint "tap me to input"
                  !active && isAction && { backgroundColor: '#FFF7ED', borderColor: ORANGE_SOFT },
                  active && {
                    backgroundColor: activeBg,
                    borderColor: activeBorder,
                    borderWidth: 1,
                  },
                ]}
                onPress={() => setTab(t.key)}
              >
                <Text style={[
                  styles.tabChipText,
                  !active && isAction && { color: ORANGE_DEEP },
                  active && styles.tabChipTextActive,
                ]}>
                  {t.label.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Always-visible My Score summary bar (tap to see breakdown) */}
      {entry && tab !== 'LEADER' && (
        <TouchableOpacity
          onPress={() => setTab('LEADER')}
          activeOpacity={0.85}
          style={styles.myScoreBar}
        >
          <View>
            <Text style={styles.myScoreLabel}>YOUR SCORE</Text>
            <Text style={styles.myScoreValue}>{entry.totalPoints} pts</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {(() => {
              const myRank = leaderboard.findIndex((r) => r.userId === entry.userId) + 1;
              return (
                <Text style={styles.myScoreRank}>
                  {myRank > 0 ? `RANK #${myRank}` : 'UNRANKED'}
                </Text>
              );
            })()}
            <Text style={styles.myScoreHint}>Tap for breakdown →</Text>
          </View>
        </TouchableOpacity>
      )}

      {tab === 'PREDICT' && renderPredictTab()}
      {tab === 'DREAM' && renderDreamTab()}
      {tab === 'LEADER' && renderLeaderTab()}
      {tab === 'TRENDS' && renderTrendsTab()}

      {/* Off-screen share card — rendered at a fixed width so html2canvas
          produces a consistent JPG regardless of the host viewport. We pin
          the ref on an outer <View> (the RN-Web pattern that produces a
          stable DOM node for html2canvas) and pass children in directly —
          forwardRef through a nested View was leaving shareCardRef.current
          null on some web runs. */}
      {Platform.OS === 'web' && trends ? (
        <View
          pointerEvents="none"
          collapsable={false}
          style={{
            position: 'absolute',
            top: 0,
            // Fully off-screen on the x-axis so users never see it, but NO
            // opacity:0 — html2canvas can inherit that and output a blank JPG.
            left: -10000,
          }}
        >
          <View ref={shareCardRef} collapsable={false}>
            <FantasyTrendsShareCard trends={trends} />
          </View>
        </View>
      ) : null}

      {/* ─── Dream Team Player Picker Modal ─── */}
      {(() => {
        const bucket = pickerModal.bucket;
        if (!bucket) return null;
        const bucketDef = buckets.find((b) => b.key === bucket);
        if (!bucketDef) return null;
        const bucketOptions = options[bucket] || [];
        const raw = form2Draft[bucket] as any;
        const picked: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
        const pickedSet = new Set(picked);

        // Compute all-picked-across-team for greyed-out state
        const allPickedIds = new Set<string>();
        for (const b of buckets) {
          const r = form2Draft[b.key] as any;
          if (!r) continue;
          (Array.isArray(r) ? r : [r]).forEach((id: string) => allPickedIds.add(id));
        }

        // Filter options by search — matches both player name AND team name.
        // No separate team-filter chips — search covers it.
        const searchLower = pickerSearch.trim().toLowerCase();
        const filtered = bucketOptions.filter((o) => {
          if (!searchLower) return true;
          return (
            o.playerName.toLowerCase().includes(searchLower) ||
            o.franchiseName.toLowerCase().includes(searchLower)
          );
        });

        const togglePick = (id: string) => {
          if (form2ReadOnly) return;
          const isPicked = pickedSet.has(id);
          let next: string[];
          if (isPicked) next = picked.filter((p) => p !== id);
          else if (picked.length >= bucketDef.picks) {
            // Auto-replace last pick if maxed out? No — just block and show toast.
            // Keep it simple: require user to remove first.
            return;
          }
          else next = [...picked, id];
          setForm2Draft((p) => ({
            ...p,
            [bucket]: bucketDef.picks === 1 ? (next[0] || undefined) : next,
          }));
        };

        const closeModal = () => setPickerModal({ visible: false, bucket: null });

        return (
          <Modal visible={pickerModal.visible} transparent animationType="slide" onRequestClose={closeModal}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
            >
              <View style={{ backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%' }}>
                {/* Header */}
                <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: BORDER, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 4, height: 24, backgroundColor: bucketDef.accent, borderRadius: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: NAVY }}>{bucketDef.label}</Text>
                    <Text style={{ fontSize: 11, color: TEXT_SUB, marginTop: 2 }}>
                      {picked.length} of {bucketDef.picks} picked {!!bucketDef.hint && `• ${bucketDef.hint}`}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={closeModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={{ fontSize: 26, color: TEXT_SUB, fontWeight: '600' }}>×</Text>
                  </TouchableOpacity>
                </View>

                {/* Search — matches player name OR team name */}
                <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
                  <TextInput
                    value={pickerSearch}
                    onChangeText={setPickerSearch}
                    placeholder="Search player or team..."
                    placeholderTextColor={TEXT_MUTED}
                    style={{
                      backgroundColor: SURFACE,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: BORDER,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      fontSize: 13,
                      color: TEXT_COLOR,
                    }}
                  />
                </View>

                {/* Player list — flex so it shrinks when keyboard is up, keyboardShouldPersistTaps so taps land without needing to dismiss keyboard first */}
                <ScrollView
                  style={{ flexShrink: 1 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {filtered.length === 0 ? (
                    <Text style={{ padding: 20, textAlign: 'center', color: TEXT_MUTED, fontStyle: 'italic' }}>
                      No players match your filter.
                    </Text>
                  ) : (
                    filtered.map((opt) => {
                      const selected = pickedSet.has(opt.playerId);
                      const usedElsewhere = !selected && allPickedIds.has(opt.playerId);
                      const atMax = picked.length >= bucketDef.picks && !selected;
                      const disabled = form2ReadOnly || usedElsewhere || atMax;
                      return (
                        <TouchableOpacity
                          key={opt.playerId}
                          disabled={disabled && !selected}
                          onPress={() => togglePick(opt.playerId)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            borderBottomWidth: 1,
                            borderBottomColor: BORDER,
                            backgroundColor: selected ? '#FFF7ED' : WHITE,
                            opacity: disabled && !selected ? 0.4 : 1,
                          }}
                        >
                          <View
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 11,
                              borderWidth: 2,
                              borderColor: selected ? bucketDef.accent : BORDER,
                              backgroundColor: selected ? bucketDef.accent : WHITE,
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 12,
                            }}
                          >
                            {selected && <Text style={{ color: WHITE, fontSize: 13, fontWeight: '900' }}>✓</Text>}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: NAVY }} numberOfLines={1}>
                              {opt.playerName}
                            </Text>
                            <Text style={{ fontSize: 11, color: TEXT_SUB, marginTop: 1 }} numberOfLines={1}>
                              {opt.franchiseName}{usedElsewhere ? ' • picked in another bucket' : ''}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>

                {/* Done button — changes state based on completeness */}
                <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: BORDER }}>
                  {picked.length < bucketDef.picks ? (
                    <>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: RED, textAlign: 'center', marginBottom: 8, letterSpacing: 0.3 }}>
                        PICK {bucketDef.picks - picked.length} MORE TO COMPLETE THIS CATEGORY
                      </Text>
                      <TouchableOpacity
                        onPress={closeModal}
                        style={{
                          backgroundColor: TEXT_MUTED,
                          borderRadius: 10,
                          paddingVertical: 13,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: WHITE, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>
                          CLOSE ({picked.length}/{bucketDef.picks})
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      onPress={closeModal}
                      style={{
                        backgroundColor: GREEN,
                        borderRadius: 10,
                        paddingVertical: 13,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: WHITE, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>
                        ✓ DONE ({picked.length}/{bucketDef.picks})
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        );
      })()}
    </SafeAreaView>
  );
}

// ─── Styles ───
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 14, color: TEXT_SUB, fontSize: 14 },

  header: {
    backgroundColor: NAVY,
    paddingTop: 8,
    paddingBottom: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 3,
    borderBottomColor: ORANGE, // thin orange strip ties the page to the Home card
  },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  backBtnText: { color: WHITE, fontSize: 28, fontWeight: '600', lineHeight: 30 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: WHITE, fontSize: 16, fontWeight: '800' },
  headerSub: { color: ORANGE, fontSize: 11, marginTop: 2, fontWeight: '700' }, // orange for the "My Points" line

  myScoreBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: ORANGE,
    borderRadius: 12,
  },
  myScoreLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: ORANGE,
    letterSpacing: 1.5,
  },
  myScoreValue: {
    fontSize: 22,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  myScoreRank: {
    fontSize: 12,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: 1,
  },
  myScoreHint: {
    fontSize: 10,
    fontWeight: '700',
    color: ORANGE,
    marginTop: 3,
  },

  tabBar: { backgroundColor: WHITE, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  tabChip: { paddingVertical: 9, paddingHorizontal: 10, borderRadius: 8, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER },
  tabChipActive: { backgroundColor: NAVY, borderColor: ORANGE, borderWidth: 2 }, // orange border on the active tab
  tabChipText: { fontSize: 11, fontWeight: '800', color: TEXT_SUB, letterSpacing: 0.8 },
  tabChipTextActive: { color: WHITE },

  tabContent: { padding: 14 },

  deadlineBanner: {
    backgroundColor: '#FFF7ED',  // soft orange tint
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: ORANGE,
    marginBottom: 14,
    alignItems: 'center',
  },
  deadlineText: { fontSize: 14, fontWeight: '800', color: ORANGE_DEEP },
  deadlineSub: { fontSize: 11, color: '#9A3412', marginTop: 2 },

  stepCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderLeftWidth: 3,           // thin orange strip on the left of each step
    borderLeftColor: ORANGE,
  },
  stepTitle: { fontSize: 14, fontWeight: '800', color: NAVY, marginBottom: 2 },
  stepSub: { fontSize: 11, color: TEXT_SUB, marginBottom: 10 },
  stepCount: { fontSize: 11, color: TEXT_SUB, marginTop: 8, fontStyle: 'italic' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: TEXT_COLOR },

  playerChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    minWidth: 130,
    maxWidth: 180,
  },
  playerName: { fontSize: 12, fontWeight: '700', color: TEXT_COLOR },
  playerTeam: { fontSize: 10, color: TEXT_SUB, marginTop: 1 },

  hintText: { fontSize: 12, color: TEXT_MUTED, fontStyle: 'italic', paddingVertical: 6 },

  infoCard: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 14 },
  infoTitle: { fontSize: 14, fontWeight: '800', color: NAVY, marginBottom: 4 },
  infoText: { fontSize: 12, color: TEXT_SUB, lineHeight: 18 },

  saveBtn: {
    backgroundColor: ORANGE,       // primary action = orange to match Home card CTA
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: WHITE, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },

  leaderHeaderRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  leaderRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  leaderCell: { fontSize: 13, color: TEXT_COLOR, textAlign: 'center' },

  trendSectionTitle: { fontSize: 12, fontWeight: '800', color: TEXT_SUB, letterSpacing: 0.5, marginBottom: 6 },
  trendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  trendName: { flex: 1, fontSize: 12, fontWeight: '700', color: TEXT_COLOR },
  trendBarBg: { width: 100, height: 8, backgroundColor: SURFACE, borderRadius: 4, overflow: 'hidden' },
  trendBarFill: { height: '100%' },
  trendPct: { width: 36, fontSize: 11, fontWeight: '800', color: NAVY, textAlign: 'right' },

  // ── Dashboard-style trend layout ──
  dashHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#DBEAFE',          // light blue pastel (Dashboard 1 default)
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',              // slightly darker light blue outline
  },
  dashHeaderIcon: { fontSize: 28 },
  dashHeaderTitle: { fontSize: 13, fontWeight: '900', color: NAVY, letterSpacing: 0.5 },
  dashHeaderSub: { fontSize: 11, color: '#334155', marginTop: 2 },

  chartCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chartTitle: { fontSize: 12, fontWeight: '900', color: NAVY, letterSpacing: 0.5, marginBottom: 4 },
  chartSub: { fontSize: 10, color: TEXT_MUTED, marginBottom: 10 },
});
