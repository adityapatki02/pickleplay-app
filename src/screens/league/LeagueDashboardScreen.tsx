import React, { useCallback, useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import {
  getLeague,
  getSeasons,
  getSeason,
  getTies,
  getStandings,
  getGroups,
  getFranchises,
  startLeaguePhase,
  importMasterCSV,
  generateCaptainTokens,
  getKnockoutBracket,
  generateKnockout,
  resetKnockout,
  resetSeason,
  sendCaptainPortalLinks,
  sendDefaultLineupReminderToOne,
  sendDefaultLineupReminders,
  setCaptain,
  sendCaptainLinkToOne,
  importDefaultLineupsCSV,
  listScorers,
  addScorer,
  resetScorerPin,
  removeScorer,
  sendScorerInvite,
  bulkUpdateTies,
  listLeagueAdmins,
  addLeagueAdmin,
  removeLeagueAdmin,
  recalculateStandings,
  updateSeason,
  backfillGender,
  resetLeagueTie,
  applyDefaultSchedule,
} from '../../api/leagues.api';
import { setFantasyFrozen, recalculateFantasy } from '../../api/fantasy.api';
import { useLeagueStore } from '../../store/leagueStore';
import { useAuthStore } from '../../store/authStore';
import { xAlert, xConfirm, xPrompt } from '../../utils/alert';
import { API_BASE_URL } from '../../config/constants';
import DownloadButton from '../../components/DownloadButton';
import { downloadCSV } from '../../utils/csvExport';
import type {
  Tie,
  LeagueStanding,
  LeagueGroup,
  SeasonStatus,
  TieStatus,
  Franchise,
  KnockoutBracketData,
} from '../../types/league.types';

import { YColors, YTopBar } from '../../components/yoiden';
import { SPPL } from '../../navigation/nav-types';

// ─── Design tokens ──────────────────────────────────────────────────────────
const NAVY: string = YColors.ink;
const BLUE: string = YColors.accent;
const GREEN = '#06D6A0';
const SURFACE: string = YColors.bg;
const BORDER: string = YColors.line2;
const TEXT_COLOR: string = YColors.ink;
const TEXT_SUB: string = YColors.ink2;
const TEXT_MUTED: string = YColors.ink3;
const WHITE = '#FFFFFF';
const WARN = '#FFB300';
const RED = '#EF4444';
const PURPLE = '#8B5CF6';
const ORANGE = '#F97316';
const PINK = '#EC4899';

// ─── Tab definitions ────────────────────────────────────────────────────────
// STATS removed — replaced by the curated Best Performers card on OVERVIEW.
const TABS = ['OVERVIEW', 'FIXTURES', 'STANDINGS', 'KNOCKOUT'] as const;
type Tab = (typeof TABS)[number];

// ─── Phase colors ───────────────────────────────────────────────────────────
const PHASE_CONFIG: Record<SeasonStatus, { label: string; color: string; bg: string }> = {
  setup: { label: 'SETUP', color: TEXT_SUB, bg: '#E2E8F0' },
  registration: { label: 'REGISTRATION', color: BLUE, bg: '#DBEAFE' },
  league_phase: { label: 'LEAGUE PHASE', color: GREEN, bg: '#D1FAE5' },
  knockout_phase: { label: 'KNOCKOUT', color: WARN, bg: '#FEF3C7' },
  completed: { label: 'COMPLETED', color: NAVY, bg: '#E0E7FF' },
};

// ─── Status chip colors ─────────────────────────────────────────────────────
const STATUS_CHIP: Record<TieStatus, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', color: TEXT_SUB, bg: '#F1F5F9' },
  lineup_submitted: { label: 'Lineup In', color: BLUE, bg: '#DBEAFE' },
  lineup_locked: { label: 'Locked', color: PURPLE, bg: '#EDE9FE' },
  in_progress: { label: 'Live', color: ORANGE, bg: '#FFF7ED' },
  completed: { label: 'Completed', color: GREEN, bg: '#D1FAE5' },
  postponed: { label: 'Postponed', color: RED, bg: '#FEE2E2' },
};

// ═════════════════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════════════════

const LeagueDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { leagueId, seasonId: routeSeasonId } = route.params as { leagueId: string; seasonId?: string };

  const store = useLeagueStore();
  const authUser = useAuthStore((s) => s.user);
  const [league, setLeague] = useState(store.currentLeague);
  const isAdmin = !!authUser?.id && league?.organizerId === authUser.id;

  // Fetch league by ID so isAdmin check works on direct navigation
  useEffect(() => {
    let cancelled = false;
    getLeague(leagueId)
      .then((l) => {
        if (cancelled) return;
        setLeague(l as any);
        store.setCurrentLeague(l as any);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [leagueId]);
  const [activeTab, setActiveTab] = useState<Tab>('OVERVIEW');
  // GROUP is the most useful default — that's what stakeholders watch during
  // knockout qualification. Mirrors the standalone StandingsScreen default.
  // Standings sub-tab.  Once QFs are generated the dashboard auto-promotes
  // 'qf' to the default (see useEffect after knockoutData loads). Manual taps
  // on POOL/GROUP/OVERALL stick — the auto-promotion only fires when the user
  // hasn't picked anything else yet.
  const [standingsSubTab, setStandingsSubTab] = useState<'qf' | 'pool' | 'group' | 'overall'>('group');
  // Head-to-head winner map shipped from /standings. Used to apply the H2H
  // tiebreaker when re-sorting cross-pool views (Group, Overall) and to build
  // the "Beat <X> head-to-head" reason text shown under tied rows.
  const [h2h, setH2h] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [showDefaultsModal, setShowDefaultsModal] = useState(false);
  const [defaultsCsvText, setDefaultsCsvText] = useState('');
  const [showScorersModal, setShowScorersModal] = useState(false);
  const [scorers, setScorers] = useState<{ userId: string; name: string; phone: string }[]>([]);
  const [scorerPinMap, setScorerPinMap] = useState<Record<string, string>>({}); // userId -> PIN (shown once)
  const [newScorerName, setNewScorerName] = useState('');
  const [newScorerPhone, setNewScorerPhone] = useState('');
  const [newScorerPin, setNewScorerPin] = useState('');
  const [showLinksModal, setShowLinksModal] = useState(false);
  const [captainLinks, setCaptainLinks] = useState<{ name: string; token: string; url: string; franchiseId?: string }[]>([]);
  const [captainEdits, setCaptainEdits] = useState<Record<string, { name: string; phone: string }>>({});
  const [captainEditMode, setCaptainEditMode] = useState<Record<string, boolean>>({});
  const [resolvedSeasonId, setResolvedSeasonId] = useState(routeSeasonId || '');
  const [showSetup, setShowSetup] = useState(false);

  // League admins
  const [showAdminsModal, setShowAdminsModal] = useState(false);
  const [admins, setAdmins] = useState<{ id: string | null; userId: string; name: string; phone: string; isOwner: boolean; addedAt: string | null }[]>([]);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');

  // Knockout round setup
  const [showRoundSetup, setShowRoundSetup] = useState<null | 'LEAGUE' | 'QF' | 'SF' | 'PLAYOFFS' | 'FINAL'>(null);
  const [showOverlaysModal, setShowOverlaysModal] = useState(false);
  const [showCourtsModal, setShowCourtsModal] = useState(false);
  const [savingCourts, setSavingCourts] = useState(false);

  // Backfill-gender modal (multi-line CSV input)
  const [showBackfillModal, setShowBackfillModal] = useState(false);
  const [backfillCsv, setBackfillCsv] = useState('');
  const [backfillSaving, setBackfillSaving] = useState(false);

  /** Sub-tab within the Knockout tab. null = auto-selected based on stage progress. */
  const [koSubTab, setKoSubTab] = useState<'qf' | 'playoffs' | 'final' | null>(null);

  /**
   * Knockout stage-advancement modal.
   * stage:
   *   'playoffs'       = after all 4 QFs complete → confirm H1-H4 → fills Q1 + Eliminator
   *   'q1-advance'     = after Q1 completes → winner → Final.home, loser → Q2.home
   *   'elim-advance'   = after Eliminator completes → winner → Q2.away
   *   'q2-advance'     = after Q2 completes → winner → Final.away
   */
  const [advanceModal, setAdvanceModal] = useState<{
    visible: boolean;
    stage: 'playoffs' | 'q1-advance' | 'elim-advance' | 'q2-advance' | null;
    picks: Record<string, string>; // slot name → franchiseId
  }>({ visible: false, stage: null, picks: {} });
  const [advanceSaving, setAdvanceSaving] = useState(false);
  // Knockout-generation manual picker: pre-seeded from auto-qualifiers, admin can override.
  const [knockoutPicks, setKnockoutPicks] = useState<{
    ab1?: string; ab2?: string; ab3?: string; ab4?: string;
    cd1?: string; cd2?: string; cd3?: string; cd4?: string;
  }>({});
  const [knockoutPickerSlot, setKnockoutPickerSlot] = useState<
    'ab1' | 'ab2' | 'ab3' | 'ab4' | 'cd1' | 'cd2' | 'cd3' | 'cd4' | null
  >(null);
  const [knockoutConfirmVisible, setKnockoutConfirmVisible] = useState(false);
  // Per-tie drafts keyed by tieId: { court, time, pointsToWin, gamesPerMatch }
  const [roundEdits, setRoundEdits] = useState<Record<string, { court: string; courtNumber: number | null; time: string; pointsToWin: number; gamesPerMatch: number }>>({});

  // Local state
  const [ties, setTies] = useState<Tie[]>([]);
  const [standings, setStandings] = useState<LeagueStanding[]>([]);
  const [groups, setGroups] = useState<LeagueGroup[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [knockoutData, setKnockoutData] = useState<KnockoutBracketData | null>(null);
  const season = store.currentSeason;

  // ── Data fetching ──
  const fetchAll = useCallback(async () => {
    try {
      // If no seasonId, fetch the latest season for this league
      let seasonId = resolvedSeasonId;
      if (!seasonId) {
        const seasons = await getSeasons(leagueId);
        const seasonList = Array.isArray(seasons) ? seasons : [];
        if (seasonList.length > 0) {
          seasonId = seasonList[0].id;
          setResolvedSeasonId(seasonId);
        } else {
          // No seasons yet — just show franchises
          const franchisesData = await getFranchises(leagueId).catch(() => [] as Franchise[]);
          setFranchises(franchisesData);
          return;
        }
      }

      const [seasonData, tiesData, standingsData, groupsData, franchisesData] = await Promise.all([
        getSeason(leagueId, seasonId),
        getTies(leagueId, seasonId).catch(() => [] as Tie[]),
        getStandings(leagueId, seasonId).catch(() => ({ groups: [] })),
        getGroups(leagueId, seasonId).catch(() => [] as LeagueGroup[]),
        getFranchises(leagueId).catch(() => [] as Franchise[]),
      ]);
      store.setCurrentSeason(seasonData);
      const tieList = Array.isArray(tiesData) ? tiesData : [];
      const groupList = Array.isArray(groupsData) ? groupsData : [];
      // Standings API returns { groups: [{ group, standings }], h2h } —
      // flatten the rows and capture the head-to-head map.
      let standingList: any[] = [];
      if (Array.isArray(standingsData)) {
        standingList = standingsData;
      } else if ((standingsData as any)?.groups) {
        for (const g of (standingsData as any).groups) {
          if (g.standings) standingList.push(...g.standings);
        }
      }
      const h2hData = (standingsData && (standingsData as any).h2h) || {};
      setH2h(typeof h2hData === 'object' ? h2hData : {});
      setTies(tieList);
      setStandings(standingList);
      setGroups(groupList);
      setFranchises(Array.isArray(franchisesData) ? franchisesData : []);
      store.setTies(tieList);
      store.setGroups(groupList);

      // Fetch knockout bracket data
      try {
        const koData = await getKnockoutBracket(leagueId, seasonId);
        setKnockoutData(koData);
      } catch {
        setKnockoutData(null);
      }
    } catch (err: any) {
      console.warn('League dashboard fetch error:', err?.message);
    }
  }, [leagueId, resolvedSeasonId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchAll().finally(() => setLoading(false));
    }, [fetchAll]),
  );

  // Once QFs are generated, auto-promote the standings sub-tab to 'qf' so
  // viewers land on the meaningful knockout-day leaderboard instead of the
  // frozen league-stage table. Only fires while the user is still on the
  // initial 'group' default — manual taps on any sub-tab stick.
  const __qfRankingLen = knockoutData?.qfRanking?.length || 0;
  React.useEffect(() => {
    if (__qfRankingLen > 0 && standingsSubTab === 'group') {
      setStandingsSubTab('qf');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [__qfRankingLen]);

  // Handle Android hardware back button
  const activeTabRef = React.useRef(activeTab);
  activeTabRef.current = activeTab;

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (activeTabRef.current !== 'OVERVIEW') {
          setActiveTab('OVERVIEW');
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  // ── Helpers ──
  const franchiseMap = React.useMemo(() => {
    const m: Record<string, Franchise> = {};
    franchises.forEach((f) => (m[f.id] = f));
    return m;
  }, [franchises]);

  // Build pool tag map: franchiseId → "A1", "B2", "C3", "D4" etc.
  const poolTagMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    const poolLetters: Record<string, string> = {
      'Pool A': 'A', 'Pool B': 'B', 'Pool C': 'C', 'Pool D': 'D',
    };
    // Try building from groups data (each group has franchises array)
    const rawGroups = Array.isArray(groups) ? groups : [];
    rawGroups.forEach((g: any) => {
      const letter = poolLetters[g.name] || g.name?.replace('Pool ', '') || '?';
      const members = g.franchises || [];
      members.forEach((gf: any, idx: number) => {
        const fId = gf.franchiseId || gf.franchise?.id || gf.id;
        if (fId) m[fId] = `${letter}${idx + 1}`;
      });
    });

    // Fallback: if groups didn't populate, build from tie patterns
    // Pool A teams play Pool B teams (in group 1), Pool C play Pool D (group 2)
    if (Object.keys(m).length === 0 && ties.length > 0) {
      // Group ties by groupId, collect unique home/away teams per group
      const groupTeams = new Map<string, { home: Set<string>; away: Set<string> }>();
      ties.forEach((t: any) => {
        const gId = t.groupId || 'default';
        if (!groupTeams.has(gId)) groupTeams.set(gId, { home: new Set(), away: new Set() });
        const gt = groupTeams.get(gId)!;
        // In cross-pool ties, all homeTeams are from one pool, awayTeams from the other
        gt.home.add(t.homeTeamId);
        gt.away.add(t.awayTeamId);
      });

      const groupEntries = Array.from(groupTeams.entries());
      const letters = ['A', 'B', 'C', 'D'];
      groupEntries.forEach(([, gt], gi) => {
        const homeArr = Array.from(gt.home);
        const awayArr = Array.from(gt.away);
        const l1 = letters[gi * 2] || '?';
        const l2 = letters[gi * 2 + 1] || '?';
        homeArr.forEach((fId, idx) => { m[fId] = `${l1}${idx + 1}`; });
        awayArr.forEach((fId, idx) => { m[fId] = `${l2}${idx + 1}`; });
      });
    }
    return m;
  }, [groups, ties]);

  const teamNamePlain = (id: string) => franchiseMap[id]?.shortName || franchiseMap[id]?.name || '—';
  const teamName = (id: string) => teamNamePlain(id); // plain for non-JSX usage
  const teamPoolTag = (id: string) => poolTagMap[id] || '';

  const completedTies = ties.filter((t) => t.status === 'completed');
  // Upcoming ties: sort chronologically (earliest scheduledStart first) so the
  // overview "Upcoming Ties" section shows the next-to-play tie at the top.
  // Ties without a scheduledStart fall to the end. Tie-breaks: matchDay,
  // courtNumber, then id (stable).
  const upcomingTies = ties
    .filter((t) => t.status !== 'completed' && t.status !== 'postponed')
    .slice()
    .sort((a, b) => {
      const ta = (a as any).scheduledStart ? new Date((a as any).scheduledStart).getTime() : Number.POSITIVE_INFINITY;
      const tb = (b as any).scheduledStart ? new Date((b as any).scheduledStart).getTime() : Number.POSITIVE_INFINITY;
      if (ta !== tb) return ta - tb;
      const da = (a as any).matchDay || '';
      const db = (b as any).matchDay || '';
      if (da !== db) return da < db ? -1 : 1;
      const ca = (a as any).courtNumber ?? Number.POSITIVE_INFINITY;
      const cb = (b as any).courtNumber ?? Number.POSITIVE_INFINITY;
      if (ca !== cb) return ca - cb;
      return (a.id || '').localeCompare(b.id || '');
    });

  const ROUND_LABELS: Record<string, string> = {
    knockout_qf1: 'Quarterfinal 1',
    knockout_qf2: 'Quarterfinal 2',
    knockout_qf3: 'Quarterfinal 3',
    knockout_qf4: 'Quarterfinal 4',
    knockout_q1: 'Qualifier 1',
    knockout_eliminator: 'Eliminator',
    knockout_q2: 'Qualifier 2',
    knockout_final: 'Final',
    // Legacy
    knockout_sf1: 'Semi-Final 1',
    knockout_sf2: 'Semi-Final 2',
  };
  const formatRound = (round: string) => {
    if (ROUND_LABELS[round]) return ROUND_LABELS[round];
    // league_week_1 → "Week 1"
    const weekMatch = round.match(/league_week_(\d+)/);
    if (weekMatch) return `Week ${weekMatch[1]}`;
    return round;
  };

  const tiesByRound = React.useMemo(() => {
    const map = new Map<string, Tie[]>();
    ties.forEach((t) => {
      const arr = map.get(t.round) || [];
      arr.push(t);
      map.set(t.round, arr);
    });
    // Sort: league weeks first (by number), then knockout rounds
    const roundOrder = (r: string) => {
      if (r.startsWith('league_week_')) return parseInt(r.replace(/\D/g, ''), 10);
      if (r === 'knockout_qf1') return 100;
      if (r === 'knockout_qf2') return 101;
      if (r === 'knockout_qf3') return 102;
      if (r === 'knockout_qf4') return 103;
      if (r === 'knockout_q1') return 104;
      if (r === 'knockout_eliminator') return 105;
      if (r === 'knockout_q2') return 106;
      if (r === 'knockout_final') return 107;
      // Legacy
      if (r === 'knockout_sf1') return 104;
      if (r === 'knockout_sf2') return 105;
      return 50;
    };
    return Array.from(map.entries()).sort((a, b) => roundOrder(a[0]) - roundOrder(b[0]));
  }, [ties]);

  const standingsByGroup = React.useMemo(() => {
    const map = new Map<string, LeagueStanding[]>();
    standings.forEach((s) => {
      const arr = map.get(s.groupId) || [];
      arr.push(s);
      map.set(s.groupId, arr);
    });
    // Sort each group by rank/standing points
    map.forEach((arr) => {
      arr.sort((a, b) => (a.rank || 999) - (b.rank || 999));
    });
    return map;
  }, [standings]);

  const groupName = (groupId: string) => groups.find((g) => g.id === groupId)?.name || groupId;

  // ── Actions ──
  const handleStartLeague = () => {
    xConfirm(
      'Start League Phase',
      'This will generate fixtures for all groups. Continue?',
      async () => {
        setActionLoading(true);
        try {
          await startLeaguePhase(leagueId, resolvedSeasonId);
          xAlert('Success', 'League phase started! Fixtures have been generated.');
          await fetchAll();
        } catch (err: any) {
          xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to start league');
        } finally {
          setActionLoading(false);
        }
      },
    );
  };

  // ─── RENDERS ──────────────────────────────────────────────────────────────

  const renderPhaseBar = () => {
    if (!season) return null;
    const phase = PHASE_CONFIG[season.status] || PHASE_CONFIG.setup;
    return (
      <View style={[styles.phaseBanner, { backgroundColor: phase.bg }]}>
        <Text style={[styles.phaseLabel, { color: phase.color }]}>{phase.label}</Text>
        <Text style={[styles.phaseSubtext, { color: phase.color }]}>
          {season.name}
        </Text>
      </View>
    );
  };

  // Branded tournament hero — makes the dashboard read as the event's own page
  // (shown above the tabs, persistent across them). Reads already-loaded league
  // + season data, so it works for any league.
  const renderBrandedHero = () => {
    const name = store.currentLeague?.name || season?.name || 'Tournament';
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fmt = (d?: string) => {
      if (!d) return '';
      const parts = d.slice(0, 10).split('-');
      const day = Number(parts[2]);
      const mon = MONTHS[Number(parts[1]) - 1] || '';
      return `${day} ${mon}`;
    };
    const dateRange = season?.startDate
      ? `${fmt(season.startDate)}${season.endDate ? ' – ' + fmt(season.endDate) : ''}`
      : '';
    const phase = season ? (PHASE_CONFIG[season.status] || PHASE_CONFIG.setup) : null;
    return (
      <View style={styles.brandHero}>
        <Text style={styles.brandHeroEyebrow}>YOIDEN · LIVE LEAGUE</Text>
        <Text style={styles.brandHeroTitle} numberOfLines={2}>{name.toUpperCase()}</Text>
        <View style={styles.brandHeroMetaRow}>
          {dateRange ? <Text style={styles.brandHeroMeta}>{dateRange}</Text> : null}
          {phase ? (
            <View style={[styles.brandHeroBadge, { backgroundColor: phase.bg }]}>
              <Text style={[styles.brandHeroBadgeText, { color: phase.color }]}>{phase.label}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const renderQuickStats = () => {
    const totalTies = ties.length;
    const played = completedTies.length;
    const remaining = totalTies - played;
    // Find top team
    const sorted = [...standings].sort((a, b) => b.standingPoints - a.standingPoints);
    const topTeam = sorted[0] ? teamName(sorted[0].franchiseId) : '—';

    const stats = [
      { label: 'Franchises', value: String(franchises.length) },
      { label: 'Ties Played', value: String(played) },
      { label: 'Remaining', value: String(remaining) },
    ];

    return (
      <View style={styles.statsRow}>
        {stats.map((s, i) => (
          <View key={i} style={styles.statPill}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderTieCard = (tie: Tie, compact = false) => {
    const chipCfg = STATUS_CHIP[tie.status] || STATUS_CHIP.scheduled;
    const isMyAssignedTie = !!authUser?.id && (tie as any).scorerId === authUser.id;

    // Human-readable knockout stage label + placeholder names before teams are seeded
    const KNOCKOUT_LABELS: Record<string, string> = {
      knockout_qf1: 'QF 1', knockout_qf2: 'QF 2', knockout_qf3: 'QF 3', knockout_qf4: 'QF 4',
      knockout_q1: 'QUALIFIER 1', knockout_eliminator: 'ELIMINATOR',
      knockout_q2: 'QUALIFIER 2', knockout_final: 'FINAL',
    };
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
    const stageLabel = KNOCKOUT_LABELS[tie.round] || null;
    const koPh = KO_PLACEHOLDERS[tie.round];
    const homeDisplay = tie.homeTeamId ? teamNamePlain(tie.homeTeamId) : (koPh ? koPh[0] : 'TBD');
    const awayDisplay = tie.awayTeamId ? teamNamePlain(tie.awayTeamId) : (koPh ? koPh[1] : 'TBD');

    return (
      <TouchableOpacity
        key={tie.id}
        style={[
          styles.tieCard,
          isMyAssignedTie && { backgroundColor: '#ECFDF5', borderColor: '#06D6A0', borderWidth: 2 },
        ]}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('TieDetail', { tieId: tie.id, leagueId })}
      >
        <View style={styles.tieCardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {tie.scheduledStart ? (
              <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#92400E', letterSpacing: 0.3 }}>
                  {new Date(tie.scheduledStart).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </Text>
              </View>
            ) : null}
            {(tie as any).courtNumber ? (
              <View style={{ backgroundColor: '#E0F2FE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#0369A1', letterSpacing: 0.5 }}>
                  COURT {(tie as any).courtNumber}
                </Text>
              </View>
            ) : null}
            {tie.notes ? (
              <View style={{ backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#7C3AED', letterSpacing: 0.5 }}>{tie.notes}</Text>
              </View>
            ) : null}
            {isMyAssignedTie ? (
              <View style={{ backgroundColor: '#06D6A0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: WHITE, letterSpacing: 0.5 }}>MY TIE</Text>
              </View>
            ) : null}
            {stageLabel ? (
              <View style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#1D4ED8', letterSpacing: 0.8 }}>{stageLabel}</Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.statusChip, { backgroundColor: chipCfg.bg }]}>
            <Text style={[styles.statusChipText, { color: chipCfg.color }]}>{chipCfg.label}</Text>
          </View>
        </View>

        <View style={styles.tieMatchup}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.tieTeamName}>{homeDisplay}</Text>
          </View>
          {tie.status === 'completed' ? (
            <View style={styles.tieScoreBox}>
              <Text style={styles.tieScoreText}>
                {tie.homeStandingPoints} - {tie.awayStandingPoints}
              </Text>
            </View>
          ) : (
            <Text style={styles.tieVsText}>vs</Text>
          )}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.tieTeamName}>{awayDisplay}</Text>
          </View>
        </View>

        {tie.status === 'completed' && (tie.homeBonusPoints > 0 || tie.awayBonusPoints > 0) && (
          <View style={styles.tieBonusRow}>
            <Text style={styles.tieBonusText}>+{tie.homeBonusPoints} bonus</Text>
            <Text style={styles.tieBonusText}>+{tie.awayBonusPoints} bonus</Text>
          </View>
        )}

        {tie.matchDay && (
          <Text style={styles.tieDateText}>
            {new Date(tie.matchDay).toLocaleDateString('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  // ── OVERVIEW TAB ──
  // ── Setup action cards ──
  const renderSetupActions = () => {
    const actions = [
      {
        icon: '🏢',
        title: 'Manage Franchises',
        sub: `${franchises.length} franchise${franchises.length !== 1 ? 's' : ''} added`,
        onPress: () => navigation.navigate('FranchiseManagement', { leagueId }),
        color: '#3B82F6',
        bg: '#DBEAFE',
      },
      {
        icon: '📋',
        title: 'Import CSV (All Franchises)',
        sub: 'Bulk import franchises + players from CSV',
        onPress: () => setShowCSVModal(true),
        color: '#059669',
        bg: '#D1FAE5',
      },
      {
        icon: '👥',
        title: 'Manage Groups',
        sub: `${groups.length} group${groups.length !== 1 ? 's' : ''} set up`,
        onPress: () => navigation.navigate('GroupManagement', { leagueId, seasonId: resolvedSeasonId }),
        color: '#8B5CF6',
        bg: '#EDE9FE',
      },
      {
        icon: '🔗',
        title: 'Captain Portal Links',
        sub: 'Generate & share links for team captains',
        onPress: async () => {
          setActionLoading(true);
          try {
            const links = await generateCaptainTokens(leagueId);
            setCaptainLinks(Array.isArray(links) ? links : []);
            setShowLinksModal(true);
          } catch (err: any) {
            xAlert('Error', err?.message || 'Failed to generate links');
          } finally {
            setActionLoading(false);
          }
        },
        color: '#0891B2',
        bg: '#CFFAFE',
      },
      {
        icon: '📝',
        title: 'Default Lineups',
        sub: 'Upload fallback lineups (used if captains miss deadline)',
        onPress: () => setShowDefaultsModal(true),
        color: '#059669',
        bg: '#D1FAE5',
      },
      {
        icon: '🎯',
        title: 'Scorers',
        sub: 'Add people who can enter match scores',
        onPress: async () => {
          try {
            const list = await listScorers(leagueId);
            setScorers(Array.isArray(list) ? list : []);
            setShowScorersModal(true);
          } catch (err: any) {
            xAlert('Error', err?.message || 'Failed to load scorers');
          }
        },
        color: '#DC2626',
        bg: '#FEE2E2',
      },
      {
        icon: '👥',
        title: 'Admins',
        sub: 'Give others full organizer powers',
        onPress: async () => {
          try {
            const list = await listLeagueAdmins(leagueId);
            setAdmins(Array.isArray(list) ? list : []);
            setShowAdminsModal(true);
          } catch (err: any) {
            xAlert('Error', err?.message || 'Failed to load admins');
          }
        },
        color: '#7C3AED',
        bg: '#EDE9FE',
      },
      {
        icon: '📺',
        title: 'OBS Overlays',
        sub: 'Persistent URLs per court — set once in OBS',
        onPress: () => setShowOverlaysModal(true),
        color: '#0891B2',
        bg: '#CFFAFE',
      },
      {
        icon: '🎾',
        title: 'Court Assignments',
        sub: 'Assign each tie to Court 1/2/3 for streaming',
        onPress: () => setShowCourtsModal(true),
        color: '#16A34A',
        bg: '#DCFCE7',
      },
      {
        icon: '🔄',
        title: 'Recalculate Standings',
        sub: 'Re-aggregate rally points & match wins from all completed ties',
        onPress: async () => {
          if (!season?.id) return;
          xConfirm(
            'Recalculate Standings',
            'This re-runs the standings math for every completed tie. Use this if Points Won/Lost columns look stale.',
            async () => {
              setActionLoading(true);
              try {
                await recalculateStandings(leagueId, season.id);
                xAlert('Done', 'Standings recalculated. Pull down to refresh the standings view.');
                await fetchAll();
              } catch (err: any) {
                xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to recalculate');
              } finally {
                setActionLoading(false);
              }
            },
          );
        },
        color: '#0EA5E9',
        bg: '#E0F2FE',
      },
      {
        icon: '👥',
        title: 'Backfill Player Gender',
        sub: 'Auto-tag M1/M2/M3 male, W1/W2 female. Paste CSV to tag Teen-F/M.',
        onPress: () => {
          setBackfillCsv('');
          setShowBackfillModal(true);
        },
        color: '#9333EA',
        bg: '#F3E8FF',
      },
      {
        icon: '🏆',
        title: 'Fantasy Deadline',
        sub: (season as any)?.fantasyDeadline
          ? `Locks: ${new Date((season as any).fantasyDeadline).toLocaleString()}`
          : 'Set when fantasy entries lock (e.g., before matchday 1)',
        onPress: () => {
          if (!season?.id) return;
          const current = (season as any)?.fantasyDeadline
            ? new Date((season as any).fantasyDeadline).toISOString().slice(0, 16)
            : '';
          xPrompt(
            'Fantasy Deadline',
            'Enter the deadline as local datetime (YYYY-MM-DDTHH:MM). After this, entries lock.',
            async (value) => {
              if (!value) return;
              const clean = value.trim();
              // Parse as local time → ISO
              const d = new Date(clean);
              if (isNaN(d.getTime())) {
                xAlert('Invalid', 'Use format YYYY-MM-DDTHH:MM (e.g., 2026-04-30T18:00)');
                return;
              }
              setActionLoading(true);
              try {
                await updateSeason(leagueId, season.id, { fantasyDeadline: d.toISOString() });
                xAlert('Saved', `Fantasy entries lock at ${d.toLocaleString()}`);
                await fetchAll();
              } catch (err: any) {
                xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to save deadline');
              } finally {
                setActionLoading(false);
              }
            },
            { defaultValue: current, placeholder: '2026-04-30T18:00' },
          );
        },
        color: '#7C3AED',
        bg: '#EDE9FE',
      },
      {
        icon: (season as any)?.fantasyFrozen ? '❄️' : '🔥',
        title: (season as any)?.fantasyFrozen ? 'Fantasy Scoring: FROZEN' : 'Fantasy Scoring: LIVE',
        sub: (season as any)?.fantasyFrozen
          ? 'Tap to UNFREEZE. While frozen, match results don\'t move the leaderboard.'
          : 'Tap to FREEZE (useful during pre-tournament testing).',
        onPress: () => {
          if (!season?.id) return;
          const currentlyFrozen = !!(season as any).fantasyFrozen;
          xConfirm(
            currentlyFrozen ? 'Unfreeze Fantasy Scoring?' : 'Freeze Fantasy Scoring?',
            currentlyFrozen
              ? 'After unfreezing, the leaderboard will recalculate based on all completed matches. Continue?'
              : 'Freezing stops the leaderboard from moving when matches complete. Useful for rehearsal scoring. Entries remain editable. Continue?',
            async () => {
              setActionLoading(true);
              try {
                await setFantasyFrozen(season.id, !currentlyFrozen);
                xAlert(
                  currentlyFrozen ? 'Unfrozen' : 'Frozen',
                  currentlyFrozen
                    ? 'Fantasy scoring is LIVE again. Leaderboard will update as matches complete.'
                    : 'Fantasy scoring is FROZEN. Scores won\'t change until you unfreeze.',
                );
                await fetchAll();
              } catch (err: any) {
                xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to toggle fantasy freeze');
              } finally {
                setActionLoading(false);
              }
            },
          );
        },
        color: (season as any)?.fantasyFrozen ? '#0369A1' : '#B45309',
        bg: (season as any)?.fantasyFrozen ? '#E0F2FE' : '#FEF3C7',
      },
      {
        icon: '⚠️',
        title: 'Reset Season',
        sub: 'DANGER: wipes all ties, scores, standings, stats & fantasy. Setup preserved.',
        onPress: () => {
          if (!season?.id) return;
          xConfirm(
            'Reset Season?',
            'This WIPES all ties, matches, scores, standings, player stats, and fantasy picks for this season. League config, groups, rosters, admins and scorer grants are preserved. You will need to press Start League again. This cannot be undone.',
            async () => {
              // Double-confirm for destructive op
              xConfirm(
                'Really reset?',
                'Last chance. All tournament data will be erased. Continue?',
                async () => {
                  setActionLoading(true);
                  try {
                    const res: any = await resetSeason(leagueId, season.id);
                    const summary = res
                      ? `Ties: ${res.tiesDeleted ?? 0} · Matches: ${res.matchesDeleted ?? 0} · Standings: ${res.standingsDeleted ?? 0} · Fantasy: ${res.fantasyEntriesDeleted ?? 0}`
                      : 'Season reset.';
                    xAlert('Season Reset', `Back to setup.\n\n${summary}\n\nPress Start League to regenerate fixtures.`);
                    await fetchAll();
                  } catch (err: any) {
                    xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to reset season');
                  } finally {
                    setActionLoading(false);
                  }
                },
              );
            },
          );
        },
        color: '#DC2626',
        bg: '#FEE2E2',
      },
    ];

    return (
      <View style={{ marginBottom: 16 }}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Setup</Text>
        </View>
        {actions.map((a, i) => (
          <TouchableOpacity
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: WHITE,
              borderRadius: 12,
              padding: 14,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: BORDER,
            }}
            onPress={a.onPress}
            activeOpacity={0.7}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: a.bg,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Text style={{ fontSize: 18 }}>{a.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT_COLOR }}>{a.title}</Text>
              <Text style={{ fontSize: 12, color: TEXT_SUB, marginTop: 2 }}>{a.sub}</Text>
            </View>
            <Text style={{ fontSize: 18, color: TEXT_MUTED }}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // ── Mini standings for Overview hero ──
  // Once QFs are generated, the dashboard hero shows the live QF ranking
  // (QF tie score + group-stage avg, top 4 advance) instead of the league
  // table — that's the meaningful leaderboard during knockout day. Falls back
  // to league standings for the regular round-robin phase.
  const renderHeroStandings = () => {
    const qfRanking = knockoutData?.qfRanking;
    const inQfMode = Array.isArray(qfRanking) && qfRanking.length > 0;

    if (inQfMode) {
      // Show the FULL QF ranking inline — no truncation, no "View All" link.
      // Card height grows with the team count but that's fine on the home tab.
      const all = qfRanking;
      return (
        <View style={styles.heroStandings}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>QF Standings</Text>
          </View>
          <View style={styles.heroTable}>
            {/* Header */}
            <View style={styles.heroTableHeader}>
              <Text style={[styles.heroTableCell, { flex: 0.4, textAlign: 'left' }]}>#</Text>
              <Text style={[styles.heroTableCell, { flex: 2, textAlign: 'left' }]}>Team</Text>
              <Text style={styles.heroTableCell}>QF</Text>
              <Text style={styles.heroTableCell}>AVG</Text>
              <Text style={[styles.heroTableCell, { fontWeight: '800' }]}>TOTAL</Text>
            </View>
            {all.map((r, idx) => {
              const fr = r.franchise;
              const name = fr?.shortName || fr?.name || teamName(r.franchiseId) || 'TBD';
              const inAdvanceZone = r.rank <= 4;
              const rowBg = r.status === 'advanced'
                ? '#ECFDF5'
                : (inAdvanceZone ? '#FEF3C7' : 'transparent');
              const rankColor = r.status === 'advanced'
                ? GREEN
                : (inAdvanceZone ? '#F59E0B' : TEXT_SUB);
              return (
                <View
                  key={r.franchiseId}
                  style={[
                    styles.heroTableRow,
                    { backgroundColor: rowBg },
                    idx === all.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <Text style={[styles.heroTableCellVal, { flex: 0.4, textAlign: 'left', fontWeight: '900', color: rankColor }]}>
                    H{r.rank}
                  </Text>
                  <Text style={[styles.heroTableCellVal, { flex: 2, textAlign: 'left', fontWeight: '600' }]} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={styles.heroTableCellVal}>{r.qfScore}</Text>
                  <Text style={styles.heroTableCellVal}>{r.groupAvg.toFixed(1)}</Text>
                  <Text style={[styles.heroTableCellVal, { fontWeight: '800', color: NAVY }]}>
                    {r.weighted.toFixed(1)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      );
    }

    // League-phase fallback — pre-QF standings sorted by SP, top 5.
    const sorted = [...standings].sort((a, b) => b.standingPoints - a.standingPoints);
    const top = sorted.slice(0, 5);
    if (top.length === 0) return null;
    return (
      <View style={styles.heroStandings}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Standings Snapshot</Text>
          <TouchableOpacity onPress={() => setActiveTab('STANDINGS')}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: BLUE }}>View All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.heroTable}>
          {/* Header */}
          <View style={styles.heroTableHeader}>
            <Text style={[styles.heroTableCell, { flex: 0.3 }]}>#</Text>
            <Text style={[styles.heroTableCell, { flex: 2, textAlign: 'left' }]}>Team</Text>
            <Text style={styles.heroTableCell}>P</Text>
            <Text style={styles.heroTableCell}>W</Text>
            <Text style={[styles.heroTableCell, { fontWeight: '800' }]}>SP</Text>
          </View>
          {top.map((row, idx) => (
            <View
              key={row.id}
              style={[
                styles.heroTableRow,
                idx === top.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <Text style={[styles.heroTableCellVal, { flex: 0.3, fontWeight: '800', color: idx < 3 ? BLUE : TEXT_SUB }]}>
                {idx + 1}
              </Text>
              <Text style={[styles.heroTableCellVal, { flex: 2, textAlign: 'left', fontWeight: '600' }]} numberOfLines={1}>
                {teamName(row.franchiseId)}
              </Text>
              <Text style={styles.heroTableCellVal}>{row.tiesPlayed}</Text>
              <Text style={styles.heroTableCellVal}>{row.tiesWon}</Text>
              <Text style={[styles.heroTableCellVal, { fontWeight: '800', color: NAVY }]}>
                {row.standingPoints}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // ── Live / Next Up tie highlight ──
  const renderLiveTie = () => {
    const liveTie = ties.find((t) => t.status === 'in_progress');
    if (!liveTie) return null;
    return (
      <View style={{ marginBottom: 16 }}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: RED }} />
            <Text style={styles.sectionTitle}>Live Now</Text>
          </View>
        </View>
        {renderTieCard(liveTie)}
      </View>
    );
  };

  // ── Best Performers (curated, per-category) ──
  // Replaces the old auto-generated Stats screen with a hand-picked list of
  // category MVPs from SPPL 2026 Season 1. Data is intentionally static —
  // sourced from a manual review of the season's stats so we can showcase
  // the players the league actually wants to highlight, regardless of what
  // an algorithm would pick.
  const BEST_PERFORMERS: Array<{
    category: string;
    players: Array<{ name: string; franchise: string; played: number; won: number; lost: number; teamPts: number; bonus: number; total: number }>;
  }> = [
    {
      category: 'Kids',
      players: [
        { name: 'Arham Vora',     franchise: 'Ghatak Gliders',     played: 4, won: 4, lost: 0, teamPts: 16, bonus: 6, total: 22 },
        { name: 'Arnav Bhatter',  franchise: 'Ghatak Gliders',     played: 4, won: 4, lost: 0, teamPts: 16, bonus: 6, total: 22 },
        { name: 'Mivaan Tutwala', franchise: 'Joshilaay Jumpers',  played: 4, won: 3, lost: 1, teamPts: 12, bonus: 4, total: 16 },
        { name: 'Dhriti Shah',    franchise: 'Joshilaay Jumpers',  played: 4, won: 3, lost: 1, teamPts: 12, bonus: 4, total: 16 },
      ],
    },
    {
      category: 'Teen',
      players: [
        { name: 'Twishaa',       franchise: 'Ghatak Gliders',     played: 4, won: 4, lost: 0, teamPts: 16, bonus: 0, total: 16 },
        { name: 'Manav Khemka',  franchise: 'Ghatak Gliders',     played: 4, won: 4, lost: 0, teamPts: 16, bonus: 0, total: 16 },
        { name: 'Aarna Rathi',   franchise: 'Indian Inbounders',  played: 4, won: 4, lost: 0, teamPts: 16, bonus: 0, total: 16 },
        { name: 'Parv Jhawar',   franchise: 'Indian Inbounders',  played: 4, won: 4, lost: 0, teamPts: 16, bonus: 0, total: 16 },
      ],
    },
    {
      category: 'Women 1',
      players: [
        { name: 'Rutvi Mehta',          franchise: 'Natkhat Netters',     played: 4, won: 4, lost: 0, teamPts: 16, bonus: 2, total: 18 },
        { name: 'Dr Sarita Ambesange',  franchise: 'Natkhat Netters',     played: 4, won: 4, lost: 0, teamPts: 15, bonus: 2, total: 17 },
        { name: 'Purnita Pandagle',     franchise: 'Chaalbaaz Crushers',  played: 4, won: 4, lost: 0, teamPts: 12, bonus: 4, total: 16 },
      ],
    },
    {
      category: 'Women 2',
      players: [
        { name: 'Niti Shah',         franchise: 'Chaalbaaz Crushers', played: 4, won: 4, lost: 0, teamPts: 12, bonus: 2, total: 14 },
        { name: 'Shiru Bhutra',      franchise: 'Singham Servers',    played: 4, won: 4, lost: 0, teamPts: 12, bonus: 2, total: 14 },
        { name: 'Shruti Shetty',     franchise: 'Hungama Hustlers',   played: 4, won: 4, lost: 0, teamPts: 14, bonus: 0, total: 14 },
        { name: 'Krutika Sanghavi',  franchise: 'Hungama Hustlers',   played: 4, won: 4, lost: 0, teamPts: 14, bonus: 0, total: 14 },
      ],
    },
    {
      category: 'Men 1',
      players: [
        { name: 'Vinayak Karnawat',     franchise: 'OMG Onsetters',     played: 4, won: 4, lost: 0, teamPts: 16, bonus: 0, total: 16 },
        { name: 'Jimeet Manish Shah',   franchise: 'OMG Onsetters',     played: 4, won: 4, lost: 0, teamPts: 16, bonus: 0, total: 16 },
        { name: 'Krishna Bhosle',       franchise: 'Hungama Hustlers',  played: 4, won: 4, lost: 0, teamPts: 16, bonus: 0, total: 16 },
        { name: 'Dhaval Rajendra Shah', franchise: 'Hungama Hustlers',  played: 4, won: 4, lost: 0, teamPts: 16, bonus: 0, total: 16 },
      ],
    },
    {
      category: 'Men 2',
      players: [
        { name: 'Tarak Desai',       franchise: 'Maidaan Markers',    played: 4, won: 4, lost: 0, teamPts: 16, bonus: 0, total: 16 },
        { name: 'Yatharth Ratadiya', franchise: 'Maidaan Markers',    played: 4, won: 4, lost: 0, teamPts: 16, bonus: 0, total: 16 },
        { name: 'Ajit Asser',        franchise: 'Force Finishers',    played: 4, won: 3, lost: 1, teamPts: 12, bonus: 4, total: 16 },
        { name: 'Om Thadeshwar',     franchise: 'Force Finishers',    played: 4, won: 3, lost: 1, teamPts: 12, bonus: 4, total: 16 },
        { name: 'Ankit Mishra',      franchise: 'Chaalbaaz Crushers', played: 4, won: 4, lost: 0, teamPts: 12, bonus: 2, total: 14 },
        { name: 'Hari Shetty',       franchise: 'Singham Servers',    played: 4, won: 4, lost: 0, teamPts: 12, bonus: 2, total: 14 },
      ],
    },
    {
      category: 'Men 3',
      players: [
        { name: 'Meet',             franchise: 'Hungama Hustlers',  played: 4, won: 4, lost: 0, teamPts: 16, bonus: 2, total: 18 },
        { name: 'Nikul Chheda',     franchise: 'Hungama Hustlers',  played: 4, won: 4, lost: 0, teamPts: 16, bonus: 0, total: 16 },
        { name: 'Ritesh Bhimani',   franchise: 'Ghatak Gliders',    played: 4, won: 4, lost: 0, teamPts: 16, bonus: 0, total: 16 },
        { name: 'Jay Duwa',         franchise: 'Force Finishers',   played: 4, won: 3, lost: 1, teamPts: 12, bonus: 4, total: 16 },
        { name: 'Sandeep Parekh',   franchise: 'Force Finishers',   played: 4, won: 3, lost: 1, teamPts: 12, bonus: 4, total: 16 },
        { name: 'Hitanshu Budhdev', franchise: 'Ghatak Gliders',    played: 4, won: 4, lost: 0, teamPts: 16, bonus: 0, total: 16 },
      ],
    },
  ];

  const renderBestPerformers = () => (
    <View style={{ marginHorizontal: 14, marginTop: 14, marginBottom: 14, backgroundColor: WHITE, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 0, borderWidth: 1, borderColor: BORDER }}>
      <View style={{ paddingHorizontal: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 16, fontWeight: '900', color: NAVY, letterSpacing: 0.4 }}>⭐ Best Performers</Text>
        <Text style={{ fontSize: 10, fontWeight: '700', color: TEXT_MUTED, letterSpacing: 0.6, textTransform: 'uppercase' }}>By Category</Text>
      </View>
      {BEST_PERFORMERS.map((group, gi) => (
        <View key={group.category} style={{ marginBottom: gi === BEST_PERFORMERS.length - 1 ? 0 : 14 }}>
          <View style={{ paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#F1F5F9', borderTopWidth: 1, borderBottomWidth: 1, borderColor: BORDER }}>
            <Text style={{ fontSize: 11, fontWeight: '900', color: NAVY, letterSpacing: 1.2, textTransform: 'uppercase' }}>{group.category}</Text>
          </View>
          {group.players.map((p, pi) => (
            <View
              key={`${group.category}-${p.name}`}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                borderBottomWidth: pi === group.players.length - 1 ? 0 : 1,
                borderBottomColor: BORDER,
              }}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: NAVY }} numberOfLines={1}>{p.name}</Text>
                <Text style={{ fontSize: 11, color: TEXT_SUB, marginTop: 1 }} numberOfLines={1}>{p.franchise}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 10 }}>
                <View style={{ alignItems: 'center', minWidth: 42 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: TEXT_SUB }}>{p.won}-{p.lost}</Text>
                  <Text style={{ fontSize: 9, color: TEXT_MUTED, letterSpacing: 0.4 }}>W-L</Text>
                </View>
                <View style={{ alignItems: 'center', minWidth: 38 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: TEXT_COLOR }}>{p.teamPts}</Text>
                  <Text style={{ fontSize: 9, color: TEXT_MUTED, letterSpacing: 0.4 }}>PTS</Text>
                </View>
                <View style={{ alignItems: 'center', minWidth: 38 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: p.bonus > 0 ? GREEN : TEXT_SUB }}>{p.bonus > 0 ? `+${p.bonus}` : '0'}</Text>
                  <Text style={{ fontSize: 9, color: TEXT_MUTED, letterSpacing: 0.4 }}>BONUS</Text>
                </View>
                <View style={{ alignItems: 'center', minWidth: 42 }}>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: NAVY }}>{p.total}</Text>
                  <Text style={{ fontSize: 9, color: TEXT_MUTED, letterSpacing: 0.4 }}>TOTAL</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );

  // ── Champion banner (overview hero) ──
  // Once the Final completes (and the season auto-flips to 'completed'), surface
  // the champion at the top of the dashboard so it's the first thing every
  // viewer sees. Falls back gracefully if knockoutData hasn't loaded yet.
  const renderChampionBanner = () => {
    const finalTie = knockoutData?.final;
    if (!finalTie || finalTie.status !== 'completed' || !finalTie.winnerId) return null;
    const champ = franchiseMap[finalTie.winnerId];
    const champName = champ?.name || champ?.shortName || 'TBD';
    const runnerUpId = finalTie.winnerId === finalTie.homeTeamId ? finalTie.awayTeamId : finalTie.homeTeamId;
    const runnerUp = runnerUpId ? franchiseMap[runnerUpId] : null;
    const runnerUpName = runnerUp?.name || runnerUp?.shortName || '';
    return (
      <View
        style={{
          marginHorizontal: 14,
          marginTop: 12,
          marginBottom: 10,
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: NAVY,
          borderWidth: 2,
          borderColor: '#FFC857',
        }}
      >
        <View
          style={{
            paddingVertical: 18,
            paddingHorizontal: 20,
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '900',
              letterSpacing: 2,
              color: '#FFC857',
              textTransform: 'uppercase',
            }}
          >
            🏆 SPPL 2026 Champions
          </Text>
          <Text
            style={{
              fontSize: 22,
              fontWeight: '900',
              color: '#fff',
              letterSpacing: 0.4,
              textAlign: 'center',
            }}
            numberOfLines={2}
          >
            {champName}
          </Text>
          {runnerUpName ? (
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: 'rgba(255,255,255,0.7)',
                letterSpacing: 0.3,
                marginTop: 2,
              }}
            >
              Defeated {runnerUpName} in the Final
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  const renderOverview = () => (
    <ScrollView
      contentContainerStyle={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {renderPhaseBar()}

      {/* Champion banner — only after final completes */}
      {renderChampionBanner()}

      {/* Quick stats — compact row */}
      {renderQuickStats()}

      {/* Hero: Standings snapshot */}
      {renderHeroStandings()}

      {/* Live tie if any */}
      {renderLiveTie()}

      {/* Upcoming Ties */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Upcoming Ties</Text>
        {upcomingTies.length > 3 && (
          <TouchableOpacity onPress={() => setActiveTab('FIXTURES')}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: BLUE }}>All Fixtures</Text>
          </TouchableOpacity>
        )}
      </View>
      {upcomingTies.length === 0 ? (
        <Text style={[styles.emptyText, { marginBottom: 16 }]}>No upcoming ties</Text>
      ) : (
        upcomingTies.slice(0, 3).map((t) => renderTieCard(t))
      )}

      {/* Recent Results */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Recent Results</Text>
      </View>
      {completedTies.length === 0 ? (
        <Text style={[styles.emptyText, { marginBottom: 16 }]}>No results yet</Text>
      ) : (
        completedTies.slice(-3).reverse().map((t) => renderTieCard(t))
      )}

      {/* Best Performers — hand-curated SPPL Season 1 MVPs (static data).
          Only valid for the SPPL league; hidden everywhere else (e.g. Mumbai Open). */}
      {leagueId === SPPL.leagueId && renderBestPerformers()}

      {/* Action: Start League (only in setup/registration, admin only) */}
      {isAdmin && (season?.status === 'setup' || season?.status === 'registration') && (
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleStartLeague}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <ActivityIndicator color={WHITE} />
          ) : (
            <Text style={styles.primaryBtnText}>GENERATE FIXTURES & START LEAGUE</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Setup / Admin — collapsible at bottom (admin only) */}
      {isAdmin && (
        <>
          <TouchableOpacity
            style={styles.setupToggle}
            onPress={() => setShowSetup(!showSetup)}
            activeOpacity={0.7}
          >
            <Text style={styles.setupToggleIcon}>{showSetup ? '▲' : '⚙'}</Text>
            <Text style={styles.setupToggleText}>
              {showSetup ? 'Hide Setup' : 'Setup & Admin'}
            </Text>
          </TouchableOpacity>

          {showSetup && renderSetupActions()}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  // ── FIXTURES TAB ──
  const renderFixtures = () => (
    <ScrollView
      contentContainerStyle={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {isAdmin && (season?.status === 'setup' || season?.status === 'registration') && (
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleStartLeague}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <ActivityIndicator color={WHITE} />
          ) : (
            <Text style={styles.primaryBtnText}>GENERATE FIXTURES</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Schedule for SPPL 2026 is pre-applied in the database; manual + bulk
          schedule buttons removed at organizer's request to prevent accidental
          re-application. Court/time edits per-tie remain available via the
          tie detail screen. */}

      {ties.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Fixtures Yet</Text>
          <Text style={styles.emptyText}>
            Start the league phase to generate fixtures for all groups.
          </Text>
        </View>
      ) : (
        [...ties]
          .sort((a, b) => {
            // Primary sort: scheduledStart (full date+time). Falls back to
            // matchDay (date only) when scheduledStart isn't set on a tie.
            const aTime = new Date(a.scheduledStart || a.matchDay || 0).getTime();
            const bTime = new Date(b.scheduledStart || b.matchDay || 0).getTime();
            if (aTime !== bTime) return aTime - bTime;
            // Secondary: court number ascending (lower courts first when ties
            // share a slot). Ties without a court go last.
            const aCourt = (a as any).courtNumber ?? Number.MAX_SAFE_INTEGER;
            const bCourt = (b as any).courtNumber ?? Number.MAX_SAFE_INTEGER;
            if (aCourt !== bCourt) return aCourt - bCourt;
            // Tertiary: id, just to keep order stable across renders.
            return a.id.localeCompare(b.id);
          })
          .map((t) => (
          <View key={t.id}>
            {renderTieCard(t)}
          </View>
        ))
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );

  // ── STANDINGS TAB ──
  const renderStandingsTab = () => {
    // Head-to-head lookup. Pair key is sorted lexicographically.
    const headToHead = (a: string, b: string): string | null => {
      if (!a || !b || a === b) return null;
      const [x, y] = [a, b].sort();
      return h2h[`${x}:${y}`] || null;
    };

    // Mirrors the backend chain exactly:
    //   TP → H2H → matchesWon → rallyPointDiff → ralliesFor → totalMatchPoints
    const rankCompare = (a: LeagueStanding, b: LeagueStanding) => {
      if (b.standingPoints !== a.standingPoints) return b.standingPoints - a.standingPoints;
      const w = headToHead(a.franchiseId, b.franchiseId);
      if (w === a.franchiseId) return -1;
      if (w === b.franchiseId) return 1;
      if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
      const aPD = (a as any).rallyPointDiff || 0;
      const bPD = (b as any).rallyPointDiff || 0;
      if (bPD !== aPD) return bPD - aPD;
      const aPF = (a as any).ralliesFor || 0;
      const bPF = (b as any).ralliesFor || 0;
      if (bPF !== aPF) return bPF - aPF;
      return b.totalMatchPoints - a.totalMatchPoints;
    };

    // Compute reason for `cur` ranking above `nxt` when both are tied on TP.
    // Returns null when the rows aren't tied. Mirrors the same chain so the
    // reason matches whichever rule actually broke the tie.
    const computeReason = (
      cur: LeagueStanding,
      nxt: LeagueStanding,
    ): { reason: string; type: 'h2h' | 'matchesWon' | 'rallyPointDiff' | 'ralliesFor' } | null => {
      if (cur.standingPoints !== nxt.standingPoints) return null;
      const otherName = teamName(nxt.franchiseId);
      const w = headToHead(cur.franchiseId, nxt.franchiseId);
      if (w === cur.franchiseId) {
        return { reason: `Beat ${otherName} head-to-head`, type: 'h2h' };
      }
      if (cur.matchesWon !== nxt.matchesWon) {
        return {
          reason: `More matches won (${cur.matchesWon} vs ${nxt.matchesWon})`,
          type: 'matchesWon',
        };
      }
      const cPD = (cur as any).rallyPointDiff || 0;
      const nPD = (nxt as any).rallyPointDiff || 0;
      if (cPD !== nPD) {
        const sgn = (n: number) => (n > 0 ? `+${n}` : `${n}`);
        return {
          reason: `Better rally point diff (${sgn(cPD)} vs ${sgn(nPD)})`,
          type: 'rallyPointDiff',
        };
      }
      const cPF = (cur as any).ralliesFor || 0;
      const nPF = (nxt as any).ralliesFor || 0;
      if (cPF !== nPF) {
        return {
          reason: `More rally points scored (${cPF} vs ${nPF})`,
          type: 'ralliesFor',
        };
      }
      return null;
    };

    // Build sections per sub-tab
    type Section = { label: string; rows: LeagueStanding[]; qualifyTop: number };
    let sections: Section[] = [];

    if (standingsSubTab === 'qf') {
      // QF view doesn't go through the section/row rendering — handled
      // separately below. Leave sections empty so hasData drops out and we
      // skip straight to the QF render branch.
      sections = [];
    } else if (standingsSubTab === 'pool') {
      const groupEntries = Array.from(standingsByGroup.entries());
      // Sort by group displayOrder
      groupEntries.sort((a, b) => {
        const ga = groups.find((g) => g.id === a[0]);
        const gb = groups.find((g) => g.id === b[0]);
        return (ga?.displayOrder || 0) - (gb?.displayOrder || 0);
      });
      sections = groupEntries.map(([gId, rows]) => ({
        label: groupName(gId),
        rows,
        qualifyTop: 0,
      }));
    } else if (standingsSubTab === 'group') {
      const sortedGroups = [...groups].sort((a, b) => a.displayOrder - b.displayOrder);
      for (let i = 0; i + 1 < sortedGroups.length; i += 2) {
        const g1 = sortedGroups[i];
        const g2 = sortedGroups[i + 1];
        const g1Letter = g1.name.replace(/pool\s*/i, '').trim();
        const g2Letter = g2.name.replace(/pool\s*/i, '').trim();
        const label = `Group ${g1Letter}${g2Letter}`;
        const rows = standings
          .filter((s) => s.groupId === g1.id || s.groupId === g2.id)
          .sort(rankCompare);
        sections.push({ label, rows, qualifyTop: 4 });
      }
    } else {
      // Overall
      sections = [
        {
          label: 'All Teams',
          rows: [...standings].sort(rankCompare),
          qualifyTop: 0,
        },
      ];
    }

    const hasData = sections.some((s) => s.rows.length > 0);
    // QF tab only shows up once a knockout bracket has been generated. Sits
    // first so it's the obvious landing spot during knockout day.
    const qfRanking = knockoutData?.qfRanking;
    const hasQfRanking = Array.isArray(qfRanking) && qfRanking.length > 0;
    const SUB_TABS: { key: 'qf' | 'pool' | 'group' | 'overall'; label: string }[] = [
      ...(hasQfRanking ? [{ key: 'qf' as const, label: 'QF' }] : []),
      { key: 'pool', label: 'POOL' },
      { key: 'group', label: 'GROUP' },
      { key: 'overall', label: 'OVERALL' },
    ];

    // CSV export — open to everyone (not admin-gated). Mirrors whichever
    // sub-tab is active so the file matches what's on screen. Column order
    // matches the on-screen table (#, Team, P, TP, then breakdown stats)
    // so admins/captains can read the spreadsheet the same way they read
    // the page. Multi-section layouts (POOL / GROUP) get blank divider rows
    // + a section label header so Excel keeps the tables visually separable.
    // Standings download — defers to a backend xlsx export so the file ships
    // with proper formatting (navy headers, green-highlighted top-4 qualified
    // rows, sequential 1-N rank within each group, footer rules block).
    // Beats the previous flat CSV which surfaced confusing per-pool ranks.
    const onDownloadStandingsXlsx = () => {
      const url =
        API_BASE_URL.replace(/\/$/, '') +
        `/scoreboard/standings-export/${seasonId}.xlsx`;
      // Open in a new tab so the browser handles the download. Works on
      // mobile web + desktop without juggling blob fetches in the bundle.
      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
    };

    return (
      <ScrollView
        contentContainerStyle={styles.tabContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Public XLSX export — visible to all viewers, not admin-only.
            Sits above the sub-tabs so it's easy to spot but doesn't clutter
            the table itself. Hidden in QF view because the export endpoint
            ships league-phase data, not the weighted QF ranking. */}
        {hasData && standingsSubTab !== 'qf' && (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 }}>
            <DownloadButton onPress={onDownloadStandingsXlsx} compact label="DOWNLOAD XLSX" />
          </View>
        )}

        {/* Sub-tabs */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {SUB_TABS.map((t) => {
            const active = standingsSubTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: active ? NAVY : SURFACE,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: active ? NAVY : BORDER,
                }}
                onPress={() => setStandingsSubTab(t.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '800',
                    color: active ? WHITE : TEXT_SUB,
                    letterSpacing: 0.8,
                  }}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {standingsSubTab === 'qf' && hasQfRanking ? (
          <View style={[styles.groupSection, { padding: 14 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: NAVY, letterSpacing: 0.5 }}>QF STANDINGS</Text>
              {(() => {
                const anyLive = qfRanking!.some((r: any) => r.status === 'live' || r.status === 'pending');
                if (!anyLive) return null;
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' }} />
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#92400E', letterSpacing: 0.5 }}>LIVE</Text>
                  </View>
                );
              })()}
            </View>
            <View style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: BORDER }}>
              <Text numberOfLines={1} style={{ width: 32, fontSize: 10, fontWeight: '800', color: TEXT_SUB }}>#</Text>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 10, fontWeight: '800', color: TEXT_SUB }}>TEAM</Text>
              <Text numberOfLines={1} style={{ width: 40, fontSize: 10, fontWeight: '800', color: TEXT_SUB, textAlign: 'right' }}>QF</Text>
              <Text numberOfLines={1} style={{ width: 44, fontSize: 10, fontWeight: '800', color: TEXT_SUB, textAlign: 'right' }}>AVG</Text>
              <Text numberOfLines={1} style={{ width: 52, fontSize: 10, fontWeight: '800', color: TEXT_SUB, textAlign: 'right' }}>TOTAL</Text>
            </View>
            {qfRanking!.map((r: any) => {
              const fr = r.franchise;
              const name = fr?.shortName || fr?.name || teamName(r.franchiseId) || 'TBD';
              const rowStyle: any = { backgroundColor: 'transparent' };
              let rankColor = TEXT_MUTED;
              if (r.status === 'advanced') {
                rowStyle.backgroundColor = '#ECFDF5';
                rankColor = GREEN;
              } else if (r.rank <= 4) {
                rowStyle.backgroundColor = '#FEF3C7';
                rankColor = '#F59E0B';
              }
              return (
                <View
                  key={r.franchiseId}
                  style={{
                    flexDirection: 'row',
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: BORDER,
                    ...rowStyle,
                  }}
                >
                  <View style={{ width: 32, flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: rankColor }}>H{r.rank}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: NAVY }} numberOfLines={1}>{name}</Text>
                  </View>
                  <Text style={{ width: 40, fontSize: 12, color: TEXT_COLOR, textAlign: 'right', alignSelf: 'center' }}>{r.qfScore}</Text>
                  <Text style={{ width: 44, fontSize: 12, color: TEXT_COLOR, textAlign: 'right', alignSelf: 'center' }}>{r.groupAvg.toFixed(1)}</Text>
                  <Text style={{ width: 52, fontSize: 13, color: NAVY, fontWeight: '800', textAlign: 'right', alignSelf: 'center' }}>{r.weighted.toFixed(1)}</Text>
                </View>
              );
            })}
          </View>
        ) : !hasData ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Standings</Text>
            <Text style={styles.emptyText}>Standings will appear once matches are played.</Text>
          </View>
        ) : (
          sections.map((section) => (
            <View key={section.label} style={styles.groupSection}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupHeaderText}>{section.label}</Text>
              </View>
              {/* Horizontally scrollable table so all rally columns fit comfortably on narrow phones.
                  Column order:  # | Team | P | W | L | TP || MW | PW | PL | PD
                  Headline stats (P / W / L / TP) live left of the divider —
                  these are the numbers a glance-reader cares about. The
                  rally-level breakdown (MW / PW / PL / PD) sits right of the
                  divider for anyone digging into tie-breakers. */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  {/* Table header — each cell carries its own border so the
                      table reads as a proper grid. The last cell drops its
                      right border to avoid doubling against the outer
                      container's border. */}
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, { width: 28 }]}>#</Text>
                    <Text style={[styles.tableHeaderCell, { width: 160, textAlign: 'left', paddingHorizontal: 8 }]}>Team</Text>
                    <Text style={[styles.tableHeaderCell, { width: 30 }]}>P</Text>
                    <Text style={[styles.tableHeaderCell, { width: 30 }]}>W</Text>
                    <Text style={[styles.tableHeaderCell, { width: 30 }]}>L</Text>
                    {/* TP carries no own right border — the divider provides it. */}
                    <Text style={[styles.tableHeaderCell, styles.tableHeaderCellLast, { width: 44 }]}>TP</Text>
                    <View style={styles.tableColDivider} />
                    <Text style={[styles.tableHeaderCell, { width: 36 }]}>MW</Text>
                    <Text style={[styles.tableHeaderCell, { width: 44 }]}>PW</Text>
                    <Text style={[styles.tableHeaderCell, { width: 44 }]}>PL</Text>
                    <Text style={[styles.tableHeaderCell, styles.tableHeaderCellLast, { width: 48 }]}>PD</Text>
                  </View>
                  {/* Table rows */}
                  {section.rows.map((row, idx) => {
                    const qualified = section.qualifyTop > 0 && idx < section.qualifyTop;
                    const rf = row.ralliesFor ?? 0;
                    const ra = row.ralliesAgainst ?? 0;
                    const rpd = row.rallyPointDiff ?? (rf - ra);
                    // Tiebreaker reason vs the row directly below in this view's sort
                    const nxt = section.rows[idx + 1];
                    const tb = nxt ? computeReason(row, nxt) : null;
                    return (
                      <React.Fragment key={row.id}>
                      <View
                        style={[
                          styles.tableRow,
                          qualified && styles.tableRowQualified,
                          // Drop the bottom border when we're showing a
                          // tiebreaker subtitle right below — keeps the row
                          // and its annotation visually as one unit.
                          (idx === section.rows.length - 1 && !tb) && { borderBottomWidth: 0 },
                          tb && { borderBottomWidth: 0 },
                        ]}
                      >
                        <Text style={[styles.tableCell, { width: 28, fontWeight: '700' }]}>
                          {standingsSubTab === 'pool' ? (row.rank || idx + 1) : idx + 1}
                        </Text>
                        <Text style={[styles.tableCell, { width: 160, fontWeight: '600', textAlign: 'left', paddingHorizontal: 8 }]} numberOfLines={2}>
                          {teamName(row.franchiseId)}
                        </Text>
                        <Text style={[styles.tableCell, { width: 30 }]}>{row.tiesPlayed}</Text>
                        <Text style={[styles.tableCell, { width: 30 }]}>{row.tiesWon}</Text>
                        <Text style={[styles.tableCell, { width: 30 }]}>{row.tiesLost}</Text>
                        {/* TP — divider carries the right border, so this cell drops its own. */}
                        <Text style={[styles.tableCell, styles.tableCellLast, { width: 44, fontWeight: '800', color: NAVY }]}>
                          {row.standingPoints}
                        </Text>
                        {/* Match the header divider so columns line up. */}
                        <View style={styles.tableColDivider} />
                        <Text style={[styles.tableCell, { width: 36 }]}>{row.matchesWon}</Text>
                        <Text style={[styles.tableCell, { width: 44 }]}>{rf}</Text>
                        <Text style={[styles.tableCell, { width: 44 }]}>{ra}</Text>
                        <Text
                          style={[
                            styles.tableCell,
                            styles.tableCellLast,
                            {
                              width: 48,
                              fontWeight: '700',
                              color: rpd > 0 ? GREEN : rpd < 0 ? RED : TEXT_SUB,
                            },
                          ]}
                        >
                          {rpd > 0 ? `+${rpd}` : rpd}
                        </Text>
                      </View>
                      {tb && (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 12,
                            paddingLeft: 44,
                            paddingTop: 0,
                            paddingBottom: 9,
                            gap: 8,
                            backgroundColor: qualified ? '#F0FDF4' : 'transparent',
                            borderBottomWidth: idx === section.rows.length - 1 ? 0 : 1,
                            borderBottomColor: BORDER,
                          }}
                        >
                          <View
                            style={{
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              borderRadius: 5,
                              backgroundColor: '#E0F2FE',
                              borderWidth: 1,
                              borderColor: '#BAE6FD',
                            }}
                          >
                            <Text style={{ fontSize: 9, fontWeight: '900', color: '#0369A1', letterSpacing: 0.6 }}>
                              {tb.type === 'h2h' ? 'H2H' : tb.type === 'matchesWon' ? 'MW' : tb.type === 'rallyPointDiff' ? 'PD' : 'PF'}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 11, color: TEXT_SUB, fontStyle: 'italic', flex: 1 }} numberOfLines={1}>
                            {tb.reason}
                          </Text>
                        </View>
                      )}
                      </React.Fragment>
                    );
                  })}
                </View>
              </ScrollView>
              <Text style={{ fontSize: 10, color: TEXT_MUTED, fontStyle: 'italic', paddingHorizontal: 12, paddingVertical: 6 }}>
                P=Played, W=Won, L=Lost, TP=Total Points · MW=Match Wins, PW=Points Won, PL=Points Lost, PD=Point Diff
              </Text>
            </View>
          ))
        )}

        {/* Tiebreaker rules — only shown when there's standings data so the
            page doesn't show a meaningless legend on an empty state. */}
        {hasData && (
          <View
            style={{
              backgroundColor: WHITE,
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: BORDER,
              marginTop: 12,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: NAVY }}>How tiebreakers work</Text>
              <Text style={{ fontSize: 10, color: TEXT_MUTED, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Applied in order until one rule decides
              </Text>
            </View>
            {[
              { num: 1, title: 'Tie Points',          desc: 'Higher Tie Points (TP = match points + bonus) ranks higher.' },
              { num: 2, title: 'Head-to-Head',        desc: 'If still tied, the team that won the league tie between them ranks higher.' },
              { num: 3, title: 'Matches Won',         desc: 'If still tied, more individual match (pair-game) wins ranks higher.' },
              { num: 4, title: 'Rally Point Diff',    desc: 'If still tied, higher rally point difference (PW − PL) ranks higher.' },
              { num: 5, title: 'Rally Points Scored', desc: 'If still tied, more total rally points scored ranks higher.' },
            ].map((r) => (
              <View key={r.num} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: NAVY,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginTop: 1,
                  }}
                >
                  <Text style={{ color: WHITE, fontSize: 11, fontWeight: '900' }}>{r.num}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: TEXT_COLOR, letterSpacing: 0.2 }}>{r.title}</Text>
                  <Text style={{ fontSize: 12, color: TEXT_SUB, marginTop: 2, lineHeight: 17 }}>{r.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  // ── Round setup helpers ──
  // Used to bulk-edit time / court / scoring format for every tie in a given
  // round. The knockout rounds (QF / SF / PLAYOFFS / FINAL) come from
  // `knockoutData`. The LEAGUE round-robin ties come from the main `ties`
  // list, filtered by `round` prefix.
  type RoundKey = 'LEAGUE' | 'QF' | 'SF' | 'PLAYOFFS' | 'FINAL';

  const tiesForRound = (round: RoundKey): Tie[] => {
    if (round === 'LEAGUE') {
      // All round-robin ties, sorted chronologically so the modal lists them
      // in match-day order (much easier to schedule sequentially).
      return [...ties]
        .filter((t) => (t.round || '').startsWith('league_week_'))
        .sort((a, b) => {
          const aTime = new Date(a.scheduledStart || a.matchDay || 0).getTime();
          const bTime = new Date(b.scheduledStart || b.matchDay || 0).getTime();
          if (aTime !== bTime) return aTime - bTime;
          return a.id.localeCompare(b.id);
        });
    }
    if (round === 'QF') {
      return [knockoutData?.qf1, knockoutData?.qf2, knockoutData?.qf3, knockoutData?.qf4].filter(Boolean) as Tie[];
    }
    if (round === 'PLAYOFFS') {
      // IPL-style playoffs: Q1, Eliminator, Q2 (Final has its own modal)
      return [knockoutData?.q1, knockoutData?.eliminator, knockoutData?.q2].filter(Boolean) as Tie[];
    }
    if (round === 'SF') {
      return [knockoutData?.sf1, knockoutData?.sf2].filter(Boolean) as Tie[];
    }
    return [knockoutData?.final].filter(Boolean) as Tie[];
  };

  const openRoundSetup = (round: RoundKey) => {
    // Seed edits from current tie values. Default Final to 21 pts if not already set.
    const seed: Record<string, { court: string; courtNumber: number | null; time: string; pointsToWin: number; gamesPerMatch: number }> = {};
    for (const t of tiesForRound(round)) {
      const timeStr = t.scheduledStart
        ? new Date(t.scheduledStart as any).toISOString().slice(0, 16) // yyyy-mm-ddThh:mm
        : '';
      seed[t.id] = {
        court: (t as any).notes || '',
        courtNumber: (t as any).courtNumber ?? null,
        time: timeStr,
        pointsToWin: (t as any).pointsToWin ?? (round === 'FINAL' ? 21 : 15),
        gamesPerMatch: (t as any).gamesPerMatch ?? 1,
      };
    }
    setRoundEdits(seed);
    setShowRoundSetup(round);
  };

  const saveRoundSetup = async () => {
    if (!showRoundSetup) return;
    const ties = tiesForRound(showRoundSetup);
    if (ties.length === 0) { setShowRoundSetup(null); return; }

    setActionLoading(true);
    try {
      const updates = ties.map((t) => {
        const e = roundEdits[t.id];
        if (!e) return { tieId: t.id };
        const u: any = { tieId: t.id };
        if (e.court !== ((t as any).notes || '')) u.notes = e.court;
        if (e.courtNumber !== ((t as any).courtNumber ?? null)) u.courtNumber = e.courtNumber;
        if (e.time) u.scheduledStart = new Date(e.time).toISOString();
        if (e.pointsToWin) u.pointsToWin = e.pointsToWin;
        if (e.gamesPerMatch) u.gamesPerMatch = e.gamesPerMatch;
        return u;
      });
      await bulkUpdateTies(leagueId, updates);
      xAlert('Saved', `${showRoundSetup} setup saved. All matches in these ties will use the new format.`);
      setShowRoundSetup(null);
      await fetchAll();
    } catch (err: any) {
      xAlert('Save Failed', err?.response?.data?.message || err?.message || 'Could not save round setup');
    } finally {
      setActionLoading(false);
    }
  };

  // ── KNOCKOUT TAB ──
  // KNOCKOUT (cross_5game format): 2 semis → final. SF1 = A1·B2, SF2 = B1·A2;
  // the backend seeds these and auto-advances the Final from the SF winners.
  const renderCrossPoolKnockout = () => {
    const sf1 = knockoutData?.sf1;
    const sf2 = knockoutData?.sf2;
    const final = knockoutData?.final;
    const seeded = !!(sf1?.homeTeamId && sf2?.homeTeamId);
    const nm = (id?: string | null) => (id ? teamNamePlain(id) : 'TBD');

    const Card = ({ tie, label }: { tie?: Tie | null; label: string }) => (
      <TouchableOpacity
        disabled={!tie?.id}
        activeOpacity={0.7}
        onPress={() => tie?.id && navigation.navigate('TieDetail', { tieId: tie.id, leagueId })}
        style={{ backgroundColor: WHITE, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, marginBottom: 12 }}
      >
        <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, marginBottom: 8 }}>{label}</Text>
        <Text style={{ fontSize: 16, fontWeight: '800', color: NAVY }}>{nm(tie?.homeTeamId)}</Text>
        <Text style={{ fontSize: 12, color: '#94A3B8', marginVertical: 2 }}>vs</Text>
        <Text style={{ fontSize: 16, fontWeight: '800', color: NAVY }}>{nm(tie?.awayTeamId)}</Text>
        {tie?.status === 'completed' && tie?.winnerId ? (
          <Text style={{ fontSize: 12, fontWeight: '800', color: GREEN, marginTop: 8 }}>✓ {nm(tie.winnerId)} won</Text>
        ) : null}
      </TouchableOpacity>
    );

    return (
      <ScrollView contentContainerStyle={styles.tabContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <Text style={{ fontSize: 18, fontWeight: '900', color: NAVY, marginBottom: 14 }}>KNOCKOUT</Text>
        {!seeded ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>
              Top 2 of each group advance. SF1 = A1 vs B2, SF2 = B1 vs A2.
            </Text>
            <TouchableOpacity
              disabled={actionLoading}
              onPress={() => xConfirm('Generate Knockout', 'Seed the semifinals from the current group standings?', async () => {
                setActionLoading(true);
                try { await generateKnockout(leagueId, resolvedSeasonId); await fetchAll(); }
                catch (err: any) { xAlert('Error', err?.response?.data?.message || err?.message || 'Failed'); }
                finally { setActionLoading(false); }
              })}
              style={{ backgroundColor: BLUE, borderRadius: 10, padding: 16, alignItems: 'center' }}
            >
              <Text style={{ color: WHITE, fontWeight: '800', fontSize: 14 }}>{actionLoading ? 'WORKING…' : 'GENERATE KNOCKOUT'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <Card tie={sf1} label="SEMIFINAL 1" />
        <Card tie={sf2} label="SEMIFINAL 2" />
        <Card tie={final} label="FINAL" />
      </ScrollView>
    );
  };

  const renderKnockoutTab = () => {
    if ((season as any)?.format === 'cross_5game') return renderCrossPoolKnockout();
    const seasonStatus = season?.status;
    // "Has knockout ties" = knockouts have actually been GENERATED (teams
    // assigned), not just that empty shells exist. Shell ties are pre-created
    // at fixture generation so the schedule is visible day 1, but they sit as
    // TBD vs TBD until the admin runs generateKnockout. Treating shells as
    // "already generated" hides the GENERATE button and leaves the bracket
    // stuck on TBD forever, so we test on the assigned home/away team ids
    // instead of the shell's existence.
    const hasKnockoutTies = !!(
      knockoutData?.qf1?.homeTeamId || knockoutData?.qf2?.homeTeamId ||
      knockoutData?.qf3?.homeTeamId || knockoutData?.qf4?.homeTeamId ||
      knockoutData?.sf1?.homeTeamId || knockoutData?.sf2?.homeTeamId ||
      knockoutData?.final?.homeTeamId
    );
    const qt = knockoutData?.qualifiedTeams;

    // Build a CSV of every knockout tie. Pulls each known shell from
    // knockoutData (qf1..qf4 → q1/elim → q2 → final, plus legacy sf1/sf2)
    // so the export matches the bracket regardless of which stage is live.
    const exportKnockoutCSV = () => {
      const headers = ['Round', 'Date', 'Court', 'Home', 'Away', 'Home SP', 'Away SP', 'Winner', 'Status'];
      const rounds: { tie: Tie | null | undefined; label: string }[] = [
        { tie: knockoutData?.qf1, label: 'QF1' },
        { tie: knockoutData?.qf2, label: 'QF2' },
        { tie: knockoutData?.qf3, label: 'QF3' },
        { tie: knockoutData?.qf4, label: 'QF4' },
        { tie: knockoutData?.q1, label: 'Qualifier 1' },
        { tie: knockoutData?.eliminator, label: 'Eliminator' },
        { tie: knockoutData?.q2, label: 'Qualifier 2' },
        { tie: knockoutData?.sf1, label: 'SF1 (legacy)' },
        { tie: knockoutData?.sf2, label: 'SF2 (legacy)' },
        { tie: knockoutData?.final, label: 'Final' },
      ];
      const rows: unknown[][] = rounds
        .filter((r) => !!r.tie)
        .map((r) => {
          const t = r.tie!;
          const homeName = t.homeTeam?.name || (t.homeTeamId ? franchiseMap[t.homeTeamId]?.name : '') || 'TBD';
          const awayName = t.awayTeam?.name || (t.awayTeamId ? franchiseMap[t.awayTeamId]?.name : '') || 'TBD';
          const winner = t.winnerId
            ? (t.winnerId === t.homeTeamId ? homeName : t.winnerId === t.awayTeamId ? awayName : '')
            : '';
          const sched = t.scheduledStart
            ? new Date(t.scheduledStart).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            : (t.matchDay || '');
          return [
            r.label,
            sched,
            (t as any).courtNumber ?? '',
            homeName,
            awayName,
            t.homeStandingPoints ?? 0,
            t.awayStandingPoints ?? 0,
            winner,
            t.status,
          ];
        });
      const filename = `knockout-bracket-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadCSV(filename, headers, rows);
    };

    // Helper to render a knockout tie card
    const renderKnockoutTieCard = (tie: Tie | null, label: string, subLabel?: string) => {
      if (!tie) return null;
      const chip = STATUS_CHIP[tie.status as TieStatus] || STATUS_CHIP.scheduled;
      const homeName = tie.homeTeam?.shortName || tie.homeTeam?.name || 'TBD';
      const awayName = tie.awayTeam?.shortName || tie.awayTeam?.name || 'TBD';
      const isCompleted = tie.status === 'completed';
      const isLive = tie.status === 'in_progress';

      return (
        <TouchableOpacity
          style={[koStyles.tieCard, isLive && { borderColor: ORANGE, borderWidth: 2 }]}
          onPress={() => navigation.navigate('TieDetail', { tieId: tie.id, leagueId, seasonId: resolvedSeasonId })}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={koStyles.tieLabel}>{label}</Text>
            <View style={[koStyles.statusChip, { backgroundColor: chip.bg }]}>
              <Text style={[koStyles.statusText, { color: chip.color }]}>{chip.label}</Text>
            </View>
          </View>
          {subLabel && <Text style={koStyles.tieSubLabel}>{subLabel}</Text>}
          <View style={koStyles.matchupRow}>
            <View style={koStyles.teamSide}>
              <Text style={[koStyles.teamName, isCompleted && tie.winnerId === tie.homeTeamId && { color: GREEN }]} numberOfLines={1}>
                {homeName}
              </Text>
              {isCompleted && <Text style={koStyles.score}>{tie.homeStandingPoints} SP</Text>}
            </View>
            <Text style={koStyles.vs}>VS</Text>
            <View style={[koStyles.teamSide, { alignItems: 'flex-end' }]}>
              <Text style={[koStyles.teamName, isCompleted && tie.winnerId === tie.awayTeamId && { color: GREEN }]} numberOfLines={1}>
                {awayName}
              </Text>
              {isCompleted && <Text style={koStyles.score}>{tie.awayStandingPoints} SP</Text>}
            </View>
          </View>
          {isCompleted && tie.winnerId && (
            <Text style={koStyles.winnerText}>
              Winner: {franchiseMap[tie.winnerId]?.shortName || franchiseMap[tie.winnerId]?.name || '—'}
            </Text>
          )}
        </TouchableOpacity>
      );
    };

    // Helper: pre-knockout "Qualifying Teams" panel (shown inside QF sub-tab when no QFs yet)
    const renderPreKnockoutQF = () => {
      const allLeagueTiesCompleted = ties.filter((t) => t.round.startsWith('league_')).every((t) => t.status === 'completed');
      const leagueTiesExist = ties.filter((t) => t.round.startsWith('league_')).length > 0;
      if (!leagueTiesExist) {
        return (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>League Phase Not Started</Text>
            <Text style={styles.emptyText}>Generate fixtures and complete the league phase first.</Text>
          </View>
        );
      }
      return (
        <>
          <Text style={[koStyles.recTitle, { paddingHorizontal: 14 }]}>
            {allLeagueTiesCompleted ? 'Recommended Qualifiers' : 'Current Qualifying Teams'}
          </Text>
          <Text style={[koStyles.recSub, { paddingHorizontal: 14 }]}>
            {allLeagueTiesCompleted
              ? 'Top 4 from each group advance to the quarterfinals'
              : 'Based on current standings. Complete all league ties to generate knockout.'}
          </Text>

          <View style={{ paddingHorizontal: 14 }}>
            {/* Effective pick: admin override if set, else auto-qualifier */}
            {(() => {
              const effective = (key: 'ab1'|'ab2'|'ab3'|'ab4'|'cd1'|'cd2'|'cd3'|'cd4') =>
                knockoutPicks[key] || qt?.[key]?.franchiseId || null;
              const nameOf = (fid: string | null) =>
                fid ? (franchiseMap[fid]?.shortName || franchiseMap[fid]?.name || '—') : 'TAP TO PICK';
              // Non-admin viewers see a read-only ranked list — no override
              // taps, no "TAP TO CHANGE" hint. Admins get the interactive
              // picker so they can tweak qualifiers before generating.
              const renderSlot = (
                key: 'ab1'|'ab2'|'ab3'|'ab4'|'cd1'|'cd2'|'cd3'|'cd4',
                i: number,
              ) => {
                const fid = effective(key);
                const auto = qt?.[key]?.franchiseId;
                const isOverride = !!knockoutPicks[key] && knockoutPicks[key] !== auto;
                const interactive = isAdmin && allLeagueTiesCompleted;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[koStyles.qualRow, isOverride && { backgroundColor: '#FEF3C7' }]}
                    activeOpacity={interactive ? 0.7 : 1}
                    disabled={!interactive}
                    onPress={() => interactive && setKnockoutPickerSlot(key)}
                  >
                    <Text style={koStyles.qualRank}>{i + 1}</Text>
                    <Text style={[koStyles.qualName, isOverride && { color: '#92400E', fontWeight: '700' }]}>{nameOf(fid)}</Text>
                    <Text style={koStyles.qualSP}>
                      {isOverride ? 'MANUAL' : (qt?.[key]?.standingPoints != null ? `${qt[key].standingPoints} SP` : '')}
                    </Text>
                  </TouchableOpacity>
                );
              };
              const groupSuffix = isAdmin ? ' (TAP TO CHANGE)' : '';
              return (
                <>
                  <View style={koStyles.groupPairCard}>
                    <Text style={koStyles.groupPairLabel}>{`GROUP AB — TOP 4${groupSuffix}`}</Text>
                    {(['ab1','ab2','ab3','ab4'] as const).map((k, i) => renderSlot(k, i))}
                  </View>
                  <View style={koStyles.groupPairCard}>
                    <Text style={koStyles.groupPairLabel}>{`GROUP CD — TOP 4${groupSuffix}`}</Text>
                    {(['cd1','cd2','cd3','cd4'] as const).map((k, i) => renderSlot(k, i))}
                  </View>
                </>
              );
            })()}

            {allLeagueTiesCompleted && (() => {
              const eff = (key: 'ab1'|'ab2'|'ab3'|'ab4'|'cd1'|'cd2'|'cd3'|'cd4') =>
                knockoutPicks[key] || qt?.[key]?.franchiseId || null;
              const label = (fid: string | null) =>
                fid ? (franchiseMap[fid]?.shortName || franchiseMap[fid]?.name || '—') : '—';
              return (
                <View style={koStyles.bracketPreview}>
                  <Text style={koStyles.bracketPreviewTitle}>QUARTERFINALS</Text>
                  <Text style={koStyles.bracketPreviewText}>QF1: {label(eff('ab1'))} vs {label(eff('cd4'))}</Text>
                  <Text style={koStyles.bracketPreviewText}>QF2: {label(eff('ab2'))} vs {label(eff('cd3'))}</Text>
                  <Text style={koStyles.bracketPreviewText}>QF3: {label(eff('ab3'))} vs {label(eff('cd2'))}</Text>
                  <Text style={koStyles.bracketPreviewText}>QF4: {label(eff('ab4'))} vs {label(eff('cd1'))}</Text>
                  <Text style={[koStyles.bracketPreviewTitle, { marginTop: 8 }]}>PLAYOFFS (IPL-STYLE)</Text>
                  <Text style={koStyles.bracketPreviewText}>Q1: H1 vs H2 (winner → Final, loser → Q2)</Text>
                  <Text style={koStyles.bracketPreviewText}>Eliminator: H3 vs H4 (winner → Q2)</Text>
                  <Text style={koStyles.bracketPreviewText}>Q2: Loser(Q1) vs Winner(Elim)</Text>
                  <Text style={[koStyles.bracketPreviewTitle, { marginTop: 8 }]}>FINAL</Text>
                  <Text style={koStyles.bracketPreviewText}>Winner(Q1) vs Winner(Q2)</Text>
                </View>
              );
            })()}

            {allLeagueTiesCompleted ? (
              isAdmin ? (
                // Admin: interactive button to confirm qualifiers + generate
                <TouchableOpacity
                  style={[styles.primaryBtn, actionLoading && { opacity: 0.5 }]}
                  disabled={actionLoading}
                  onPress={() => setKnockoutConfirmVisible(true)}
                >
                  <Text style={styles.primaryBtnText}>
                    {actionLoading ? 'GENERATING...' : 'REVIEW 8 TEAMS & GENERATE'}
                  </Text>
                </TouchableOpacity>
              ) : (
                // Non-admins: read-only "waiting" message — generation is an
                // organizer-only action, but everyone can see the projected
                // qualifiers above.
                <View style={koStyles.pendingBanner}>
                  <Text style={koStyles.pendingText}>
                    Waiting for organizer to generate the knockout bracket
                  </Text>
                </View>
              )
            ) : (
              <View style={koStyles.pendingBanner}>
                <Text style={koStyles.pendingText}>
                  {ties.filter((t) => t.round.startsWith('league_') && t.status !== 'completed').length} league ties remaining
                </Text>
              </View>
            )}
          </View>
        </>
      );
    };

    // State A: Pre-knockout — render in sub-tab shell so QF/Playoffs/Final tabs are visible
    if (!hasKnockoutTies && (seasonStatus === 'league_phase' || seasonStatus === 'setup' || seasonStatus === 'registration')) {
      // Simple sub-tab nav (only QF is active — Playoffs/Final greyed)
      const preSubTabs = [
        { key: 'qf' as const, label: 'QF', unlocked: true },
        { key: 'playoffs' as const, label: 'Playoffs', unlocked: false },
        { key: 'final' as const, label: 'Final', unlocked: false },
      ];
      return (
        <ScrollView
          contentContainerStyle={styles.tabContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={{ flexDirection: 'row', marginHorizontal: 14, marginTop: 6, marginBottom: 10, backgroundColor: SURFACE, borderRadius: 10, padding: 4 }}>
            {preSubTabs.map((t) => {
              const active = t.key === 'qf';
              return (
                <View
                  key={t.key}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 8,
                    backgroundColor: active ? NAVY : 'transparent',
                    alignItems: 'center',
                    opacity: t.unlocked ? 1 : 0.4,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: active ? WHITE : TEXT_SUB, letterSpacing: 0.8 }}>
                    {t.label.toUpperCase()}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text style={[koStyles.sectionTitle, { paddingHorizontal: 14 }]}>KNOCKOUT PHASE</Text>
          {renderPreKnockoutQF()}
          <View style={{ height: 40 }} />
        </ScrollView>
      );
    }

    // State B/C: Knockout active or completed — show bracket
    const qf1 = knockoutData?.qf1;
    const qf2 = knockoutData?.qf2;
    const qf3 = knockoutData?.qf3;
    const qf4 = knockoutData?.qf4;
    const q1Tie = knockoutData?.q1;
    const eliminator = knockoutData?.eliminator;
    const q2Tie = knockoutData?.q2;
    // Legacy SF1/SF2 — only render for old seasons that pre-date the IPL refactor
    const sf1 = knockoutData?.sf1;
    const sf2 = knockoutData?.sf2;
    const finalTie = knockoutData?.final;
    const qfRanking = knockoutData?.qfRanking;
    const isFinished = finalTie?.status === 'completed';
    const champion = isFinished && finalTie?.winnerId ? franchiseMap[finalTie.winnerId] : null;

    // ───── Progress gates (drive sub-tab unlocking + auto-selection) ─────
    const allQFsDone = !!qf1 && !!qf2 && !!qf3 && !!qf4 &&
      [qf1, qf2, qf3, qf4].every((t) => t?.status === 'completed');
    const playoffsUnlocked = allQFsDone;
    const finalUnlocked = q2Tie?.status === 'completed' || !!finalTie?.homeTeamId || !!finalTie?.awayTeamId;

    // Auto-select the most relevant sub-tab if none explicitly chosen yet
    const activeSubTab: 'qf' | 'playoffs' | 'final' = koSubTab || (
      finalUnlocked ? 'final' : playoffsUnlocked ? 'playoffs' : 'qf'
    );

    // Advancement state — shared across sub-tabs
    const needsPlayoffConfirm = allQFsDone && q1Tie && eliminator &&
      !q1Tie.homeTeamId && !q1Tie.awayTeamId &&
      !eliminator.homeTeamId && !eliminator.awayTeamId;
    const needsQ1Advance = q1Tie?.status === 'completed' && !!q1Tie.winnerId &&
      (!finalTie?.homeTeamId || !q2Tie?.homeTeamId);
    const needsElimAdvance = eliminator?.status === 'completed' && !!eliminator.winnerId &&
      !q2Tie?.awayTeamId;
    const needsQ2Advance = q2Tie?.status === 'completed' && !!q2Tie.winnerId &&
      !finalTie?.awayTeamId;

    const openAdvance = (stage: typeof advanceModal.stage) => {
      const seed: Record<string, string> = {};
      if (stage === 'playoffs' && qfRanking && qfRanking.length >= 4) {
        seed.h1 = qfRanking[0].franchiseId;
        seed.h2 = qfRanking[1].franchiseId;
        seed.h3 = qfRanking[2].franchiseId;
        seed.h4 = qfRanking[3].franchiseId;
      } else if (stage === 'q1-advance' && q1Tie?.winnerId) {
        const loserId = q1Tie.homeTeamId === q1Tie.winnerId ? q1Tie.awayTeamId : q1Tie.homeTeamId;
        seed.finalHome = q1Tie.winnerId;
        seed.q2Home = loserId || '';
      } else if (stage === 'elim-advance' && eliminator?.winnerId) {
        seed.q2Away = eliminator.winnerId;
      } else if (stage === 'q2-advance' && q2Tie?.winnerId) {
        seed.finalAway = q2Tie.winnerId;
      }
      setAdvanceModal({ visible: true, stage, picks: seed });
    };

    const renderAdvanceBanner = (title: string, sub: string, cta: string, stage: typeof advanceModal.stage, accent: string) => (
      <View style={{ marginHorizontal: 14, marginTop: 12, marginBottom: 4, backgroundColor: WHITE, borderRadius: 12, padding: 14, borderWidth: 2, borderColor: accent }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: WHITE, fontSize: 18 }}>↗</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: NAVY }}>{title}</Text>
            <Text style={{ fontSize: 11, color: TEXT_SUB, marginTop: 2 }}>{sub}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => openAdvance(stage)}
          style={{ marginTop: 10, backgroundColor: accent, borderRadius: 8, paddingVertical: 12, alignItems: 'center' }}
        >
          <Text style={{ color: WHITE, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>{cta}</Text>
        </TouchableOpacity>
      </View>
    );

    // ───────── Sub-tab nav ─────────
    const renderSubTabNav = () => {
      const subTabs: { key: 'qf' | 'playoffs' | 'final'; label: string; unlocked: boolean; badge?: boolean }[] = [
        { key: 'qf', label: 'QF', unlocked: true, badge: !!needsPlayoffConfirm },
        { key: 'playoffs', label: 'Playoffs', unlocked: playoffsUnlocked, badge: !!needsQ1Advance || !!needsElimAdvance },
        { key: 'final', label: 'Final', unlocked: finalUnlocked, badge: !!needsQ2Advance },
      ];
      return (
        <View style={{ flexDirection: 'row', marginHorizontal: 14, marginTop: 6, marginBottom: 10, backgroundColor: SURFACE, borderRadius: 10, padding: 4 }}>
          {subTabs.map((t) => {
            const active = activeSubTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => t.unlocked && setKoSubTab(t.key)}
                disabled={!t.unlocked}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: active ? NAVY : 'transparent',
                  alignItems: 'center',
                  opacity: t.unlocked ? 1 : 0.4,
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: active ? WHITE : TEXT_SUB, letterSpacing: 0.8 }}>
                    {t.label.toUpperCase()}
                  </Text>
                  {t.badge && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    };

    // ───────── Sub-tab: QF ─────────
    const renderQFSubTab = () => (
      <>
        {/* Advancement banner at top if applicable */}
        {isAdmin && needsPlayoffConfirm && renderAdvanceBanner(
          'QFs Complete — Confirm Playoff Seeding',
          'Review the weighted ranking below. Confirm who advances to Q1 and Eliminator.',
          'CONFIRM H1–H4 & GENERATE PLAYOFFS',
          'playoffs',
          '#2196F3',
        )}

        {/* Standings — live weighted ranking (appears as soon as any QF exists, updates with every completed match) */}
        {qfRanking && qfRanking.length > 0 ? (
          <View style={{ marginHorizontal: 14, marginTop: 4, marginBottom: 14, backgroundColor: WHITE, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: BORDER }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={[koStyles.sectionTitle, { paddingHorizontal: 0, marginBottom: 0 }]}>QF STANDINGS</Text>
              {(() => {
                const anyLive = qfRanking.some((r) => r.status === 'live' || r.status === 'pending');
                if (!anyLive) return null;
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' }} />
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#92400E', letterSpacing: 0.5 }}>LIVE</Text>
                  </View>
                );
              })()}
            </View>
            <View style={{ flexDirection: 'row', paddingVertical: 6, marginTop: 8, borderBottomWidth: 1, borderBottomColor: BORDER }}>
              <Text numberOfLines={1} style={{ width: 28, fontSize: 10, fontWeight: '800', color: TEXT_SUB }}>#</Text>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 10, fontWeight: '800', color: TEXT_SUB }}>TEAM</Text>
              <Text numberOfLines={1} style={{ width: 36, fontSize: 10, fontWeight: '800', color: TEXT_SUB, textAlign: 'right' }}>QF</Text>
              <Text numberOfLines={1} style={{ width: 40, fontSize: 10, fontWeight: '800', color: TEXT_SUB, textAlign: 'right' }}>AVG</Text>
              <Text numberOfLines={1} style={{ width: 44, fontSize: 10, fontWeight: '800', color: TEXT_SUB, textAlign: 'right' }}>TOTAL</Text>
            </View>
            {qfRanking.map((r) => {
              const fr = r.franchise;
              const name = fr?.shortName || fr?.name || 'TBD';
              // Visual treatment + label per status
              const rowStyle: any = { backgroundColor: 'transparent' };
              let rankColor = TEXT_MUTED;
              let statusLabel = '';
              let statusColor = TEXT_MUTED;
              if (r.status === 'advanced') {
                rowStyle.backgroundColor = '#ECFDF5';
                rankColor = GREEN;
                statusLabel = '✓ Advances';
                statusColor = GREEN;
              } else if (r.status === 'eliminated') {
                statusLabel = '✗ Eliminated';
                statusColor = TEXT_MUTED;
              } else if (r.rank <= 4) {
                // Any team currently in the top 4 (live or still-awaiting QFs) is in the advance zone
                rowStyle.backgroundColor = '#FEF3C7';
                rankColor = '#F59E0B';
                statusLabel = r.status === 'pending' ? '⏳ Awaiting QF' : '🏃 In advancement zone';
                statusColor = '#92400E';
              } else if (r.status === 'live') {
                statusLabel = '🏃 Projected out';
                statusColor = TEXT_SUB;
              } else if (r.status === 'pending') {
                statusLabel = '⏳ Awaiting QF';
                statusColor = TEXT_MUTED;
              }
              return (
                <View
                  key={r.franchiseId}
                  style={{
                    flexDirection: 'row',
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: BORDER,
                    ...rowStyle,
                  }}
                >
                  <View style={{ width: 28, flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: rankColor }}>
                      H{r.rank}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: NAVY }} numberOfLines={1}>{name}</Text>
                  </View>
                  <Text style={{ width: 36, fontSize: 12, color: TEXT_COLOR, textAlign: 'right', alignSelf: 'center' }}>{r.qfScore}</Text>
                  <Text style={{ width: 40, fontSize: 12, color: TEXT_COLOR, textAlign: 'right', alignSelf: 'center' }}>{r.groupAvg.toFixed(1)}</Text>
                  <Text style={{ width: 44, fontSize: 13, color: NAVY, fontWeight: '800', textAlign: 'right', alignSelf: 'center' }}>{r.weighted.toFixed(1)}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={{ marginHorizontal: 14, marginTop: 4, marginBottom: 14, padding: 14, backgroundColor: SURFACE, borderRadius: 10 }}>
            <Text style={{ fontSize: 12, color: TEXT_SUB, textAlign: 'center' }}>
              QF standings will appear here once QFs are generated.
            </Text>
          </View>
        )}

        {/* Fixtures — QF1-4 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, marginBottom: 4 }}>
          <Text style={koStyles.sectionTitle}>QF FIXTURES</Text>
          {isAdmin && (qf1 || qf2 || qf3 || qf4) && (
            <TouchableOpacity onPress={() => openRoundSetup('QF')} style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#2196F3' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#1E40AF' }}>⚙ SETUP</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={{ paddingHorizontal: 14 }}>
          {renderKnockoutTieCard(qf1 || null, 'QF1', 'AB1 vs CD4')}
          {renderKnockoutTieCard(qf2 || null, 'QF2', 'AB2 vs CD3')}
          {renderKnockoutTieCard(qf3 || null, 'QF3', 'AB3 vs CD2')}
          {renderKnockoutTieCard(qf4 || null, 'QF4', 'AB4 vs CD1')}
        </View>
      </>
    );

    // ───────── Sub-tab: Playoffs ─────────
    const renderPlayoffsSubTab = () => {
      // Mini-bracket summary: show how teams flow through Q1 → Eliminator → Q2
      const summaryRow = (label: string, tie: Tie | null | undefined, accent: string) => {
        const homeName = tie?.homeTeamId ? (franchiseMap[tie.homeTeamId]?.shortName || franchiseMap[tie.homeTeamId]?.name || '—') : '—';
        const awayName = tie?.awayTeamId ? (franchiseMap[tie.awayTeamId]?.shortName || franchiseMap[tie.awayTeamId]?.name || '—') : '—';
        const winnerName = tie?.winnerId ? (franchiseMap[tie.winnerId]?.shortName || franchiseMap[tie.winnerId]?.name || '') : '';
        const isDone = tie?.status === 'completed';
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER }}>
            <View style={{ width: 72, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 4, height: 20, backgroundColor: accent, borderRadius: 2, marginRight: 6 }} />
              <Text style={{ fontSize: 11, fontWeight: '800', color: accent, letterSpacing: 0.5 }}>{label}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: NAVY }} numberOfLines={1}>{homeName} vs {awayName}</Text>
              {isDone && winnerName && (
                <Text style={{ fontSize: 11, color: GREEN, fontWeight: '700', marginTop: 2 }}>🏆 {winnerName}</Text>
              )}
            </View>
          </View>
        );
      };
      return (
        <>
          {/* Advancement banners for playoff-stage transitions */}
          {isAdmin && needsQ1Advance && renderAdvanceBanner(
            'Q1 Complete — Advance to Final & Q2',
            'Confirm: Q1 winner goes to Final, Q1 loser goes to Q2.',
            'ADVANCE Q1 TEAMS',
            'q1-advance',
            '#FFB300',
          )}
          {isAdmin && needsElimAdvance && renderAdvanceBanner(
            'Eliminator Complete — Set Q2 Opponent',
            'Confirm which team joins Q2 from the Eliminator.',
            'ADVANCE ELIMINATOR WINNER',
            'elim-advance',
            '#FFB300',
          )}

          {/* Mini-bracket summary */}
          <View style={{ marginHorizontal: 14, marginTop: 4, marginBottom: 14, backgroundColor: WHITE, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: BORDER }}>
            <Text style={[koStyles.sectionTitle, { paddingHorizontal: 0, marginBottom: 4 }]}>PLAYOFFS BRACKET</Text>
            <Text style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 8 }}>
              Q1 winner → Final • Q1 loser → Q2 • Eliminator winner → Q2 • Q2 winner → Final
            </Text>
            {summaryRow('Q1', q1Tie, '#2196F3')}
            {summaryRow('ELIM', eliminator, '#F97316')}
            {summaryRow('Q2', q2Tie, '#FFB300')}
          </View>

          {/* Fixtures */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, marginBottom: 4 }}>
            <Text style={koStyles.sectionTitle}>PLAYOFF FIXTURES</Text>
            {isAdmin && (q1Tie || eliminator || q2Tie) && (
              <TouchableOpacity onPress={() => openRoundSetup('PLAYOFFS')} style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#2196F3' }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#1E40AF' }}>⚙ SETUP</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={{ paddingHorizontal: 14 }}>
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#2196F3', marginBottom: 4, letterSpacing: 0.5 }}>QUALIFIER 1</Text>
              {renderKnockoutTieCard(q1Tie || null, 'Q1', 'H1 vs H2 — Winner → Final, Loser → Q2')}
            </View>
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#F97316', marginBottom: 4, letterSpacing: 0.5 }}>ELIMINATOR</Text>
              {renderKnockoutTieCard(eliminator || null, 'ELIM', 'H3 vs H4 — Winner → Q2, Loser ✗')}
            </View>
            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFB300', marginBottom: 4, letterSpacing: 0.5 }}>QUALIFIER 2</Text>
              {renderKnockoutTieCard(q2Tie || null, 'Q2', 'Loser(Q1) vs Winner(Elim) — Winner → Final')}
            </View>
          </View>

          {/* Legacy SF1/SF2 for old seasons */}
          {(sf1 || sf2) && (
            <View style={{ paddingHorizontal: 14, marginTop: 14 }}>
              <Text style={koStyles.sectionTitle}>SEMIFINALS (LEGACY)</Text>
              <View style={koStyles.sfRow}>
                <View style={{ flex: 1, marginRight: 6 }}>{renderKnockoutTieCard(sf1 || null, 'SF1', 'QF1w vs QF2w')}</View>
                <View style={{ flex: 1, marginLeft: 6 }}>{renderKnockoutTieCard(sf2 || null, 'SF2', 'QF3w vs QF4w')}</View>
              </View>
            </View>
          )}
        </>
      );
    };

    // ───────── Sub-tab: Final ─────────
    const renderFinalSubTab = () => (
      <>
        {isAdmin && needsQ2Advance && renderAdvanceBanner(
          'Q2 Complete — Set Final Opponent',
          'Confirm the second finalist.',
          'ADVANCE Q2 WINNER TO FINAL',
          'q2-advance',
          '#06D6A0',
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, marginBottom: 4 }}>
          <Text style={koStyles.sectionTitle}>FINAL</Text>
          {isAdmin && finalTie && (
            <TouchableOpacity onPress={() => openRoundSetup('FINAL')} style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#F59E0B' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#92400E' }}>⚙ SETUP (21-POINT)</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={{ marginHorizontal: 20 }}>
          {renderKnockoutTieCard(finalTie || null, 'FINAL')}
        </View>
      </>
    );

    return (
      <ScrollView
        contentContainerStyle={styles.tabContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Admin export — sits above the champion banner so it's reachable
            from every sub-tab (QF/Playoffs/Final) without crowding the
            sub-tab nav. Visible only to the league organizer. */}
        {isAdmin && (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 14, marginBottom: 8 }}>
            <DownloadButton onPress={exportKnockoutCSV} compact label="DOWNLOAD CSV" />
          </View>
        )}

        {/* Champion banner — spans all sub-tabs */}
        {champion && (
          <View style={koStyles.championBanner}>
            <Text style={koStyles.championLabel}>CHAMPION</Text>
            <Text style={koStyles.championName}>{champion.shortName || champion.name}</Text>
          </View>
        )}

        {renderSubTabNav()}

        {activeSubTab === 'qf' && renderQFSubTab()}
        {activeSubTab === 'playoffs' && renderPlayoffsSubTab()}
        {activeSubTab === 'final' && renderFinalSubTab()}

        {/* Admin: reset knockout — wipes QF/Playoffs/Final so admin can re-pick 8 teams */}
        {isAdmin && (
          <View style={{ paddingHorizontal: 14, marginTop: 20 }}>
            <TouchableOpacity
              style={{
                borderWidth: 1, borderColor: '#FCA5A5',
                backgroundColor: '#FEF2F2',
                borderRadius: 10, paddingVertical: 12, alignItems: 'center',
                opacity: actionLoading ? 0.5 : 1,
              }}
              disabled={actionLoading}
              onPress={() => {
                xConfirm(
                  'Reset Knockout?',
                  'This will delete QFs, Playoffs, and Final. League phase and standings are preserved. You can re-generate with manual team selection.',
                  async () => {
                    try {
                      setActionLoading(true);
                      await resetKnockout(leagueId, resolvedSeasonId);
                      setKnockoutPicks({});
                      xAlert('Success', 'Knockout reset. You can now re-generate with your own team selection.');
                      await fetchAll();
                    } catch (err: any) {
                      xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to reset knockout');
                    } finally {
                      setActionLoading(false);
                    }
                  },
                );
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: RED, letterSpacing: 0.5 }}>
                RESET KNOCKOUT BRACKET
              </Text>
              <Text style={{ fontSize: 11, color: '#991B1B', marginTop: 2 }}>
                League phase stays intact · 8 teams can be re-picked manually
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  // ─── MAIN RENDER ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={styles.loadingText}>Loading league data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (activeTab !== 'OVERVIEW') {
              setActiveTab('OVERVIEW');
            } else {
              navigation.goBack();
            }
          }}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>{'<'}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {store.currentLeague?.name || 'League'}
          </Text>
          <Text style={styles.headerSubtitle}>{season?.name || 'Season'}</Text>
        </View>
        {/* Header gear opens the admin-only Setup panel (CSV import, scorers,
            admins, captain links, reset, etc.). Hidden for non-admins so
            viewers don't see a dead-end icon that opens an empty panel. */}
        {isAdmin ? (
          <TouchableOpacity
            style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}
            onPress={() => {
              setActiveTab('OVERVIEW');
              setShowSetup(true);
            }}
          >
            <Text style={{ color: WHITE, fontSize: 18 }}>⚙</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40, height: 40 }} />
        )}
      </View>

      {/* Branded tournament hero — persistent above the tabs.
          Gated to cross_5game so existing SPPL leagues are untouched. */}
      {(season as any)?.format === 'cross_5game' && renderBrandedHero()}

      {/* Tab Bar — 2 rows, all visible (no horizontal scroll).
          KNOCKOUT is admin-only: it contains setup, advancement, and reset
          controls that non-admins have no use for. Hidden entirely for
          scorers, captains, and players. */}
      <View style={[styles.tabBar, { paddingHorizontal: 12, paddingVertical: 10 }]}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {TABS.filter((tab) => tab !== 'KNOCKOUT' || isAdmin).map((tab) => {
            const active = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tabChip,
                  {
                    flexGrow: 1,
                    flexBasis: '31%', // 3 per row → 5 tabs = 3+2 layout
                    alignItems: 'center',
                    marginHorizontal: 0,
                  },
                  active && styles.tabChipActive,
                ]}
                onPress={() => {
                  setActiveTab(tab);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Tab Content */}
      {activeTab === 'OVERVIEW' && renderOverview()}
      {activeTab === 'FIXTURES' && renderFixtures()}
      {activeTab === 'STANDINGS' && renderStandingsTab()}
      {activeTab === 'KNOCKOUT' && isAdmin && renderKnockoutTab()}

      {/* Captain Links Modal */}
      <Modal visible={showLinksModal} transparent animationType="slide">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setShowLinksModal(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: NAVY, marginBottom: 4 }}>Captain Portal Links</Text>
              <Text style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 12 }}>Share each link with the respective team captain</Text>
              <ScrollView style={{ maxHeight: 450 }}>
                {captainLinks.map((link, i) => {
                  const fullUrl = `https://yoiden-api-460478077750.asia-south1.run.app${link.url}`;
                  const fr = link.franchiseId ? franchiseMap[link.franchiseId] : undefined;
                  const captainUser = fr?.captain;
                  const hasCaptain = !!(captainUser?.fullName && captainUser?.phone);
                  const isEditing = captainEditMode[link.name] || !hasCaptain;
                  const edit = captainEdits[link.name] || { name: captainUser?.fullName || '', phone: captainUser?.phone || '' };
                  return (
                    <View key={i} style={{ backgroundColor: SURFACE, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: NAVY, marginBottom: 6 }}>{link.name}</Text>

                      {isEditing ? (
                        <>
                          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                            <TextInput
                              style={{ flex: 1, backgroundColor: WHITE, borderRadius: 8, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, color: NAVY }}
                              placeholder="Captain Name"
                              placeholderTextColor={TEXT_MUTED}
                              value={edit.name}
                              onChangeText={(t) => setCaptainEdits((prev) => ({ ...prev, [link.name]: { ...edit, name: t } }))}
                            />
                            <TextInput
                              style={{ flex: 1, backgroundColor: WHITE, borderRadius: 8, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, color: NAVY }}
                              placeholder="Phone (10 digits)"
                              placeholderTextColor={TEXT_MUTED}
                              keyboardType="phone-pad"
                              value={edit.phone}
                              onChangeText={(t) => setCaptainEdits((prev) => ({ ...prev, [link.name]: { ...edit, phone: t } }))}
                            />
                          </View>
                          {link.franchiseId && edit.name && edit.phone && (
                            <TouchableOpacity
                              style={{ backgroundColor: NAVY, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 6 }}
                              onPress={async () => {
                                try {
                                  await setCaptain(link.franchiseId!, edit.name, edit.phone);
                                  setCaptainEditMode((prev) => ({ ...prev, [link.name]: false }));
                                  xAlert('Saved', `Captain set for ${link.name}`);
                                  await fetchAll();
                                } catch (err: any) {
                                  xAlert('Error', err?.response?.data?.message || err?.message || 'Failed');
                                }
                              }}
                            >
                              <Text style={{ color: WHITE, fontSize: 11, fontWeight: '700' }}>SAVE CAPTAIN</Text>
                            </TouchableOpacity>
                          )}
                        </>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT_COLOR }}>{captainUser?.fullName}</Text>
                            <Text style={{ fontSize: 12, color: TEXT_SUB }}>{captainUser?.phone}</Text>
                          </View>
                          <TouchableOpacity
                            style={{ backgroundColor: '#06D6A0', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 }}
                            onPress={async () => {
                              try {
                                const res = await sendCaptainLinkToOne(link.franchiseId!);
                                xAlert(res.success ? 'Sent' : 'Failed', res.success ? `WhatsApp sent to ${captainUser?.fullName}` : (res.error || 'Failed'));
                              } catch (err: any) {
                                xAlert('Error', err?.response?.data?.message || err?.message || 'Failed');
                              }
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: WHITE }}>SEND</Text>
                          </TouchableOpacity>
                          {/* Default-lineup deadline reminder — distinct orange so the
                              operator can tell at a glance which template they're firing. */}
                          <TouchableOpacity
                            style={{ backgroundColor: '#F97316', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 }}
                            onPress={async () => {
                              try {
                                const res = await sendDefaultLineupReminderToOne(link.franchiseId!);
                                xAlert(
                                  res.success ? 'Sent' : 'Failed',
                                  res.success
                                    ? `Default-lineup reminder sent to ${captainUser?.fullName}`
                                    : (res.error || 'Failed'),
                                );
                              } catch (err: any) {
                                xAlert('Error', err?.response?.data?.message || err?.message || 'Failed');
                              }
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: WHITE }}>DEFAULT</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ backgroundColor: BORDER, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 }}
                            onPress={() => {
                              setCaptainEdits((prev) => ({ ...prev, [link.name]: { name: captainUser?.fullName || '', phone: captainUser?.phone || '' } }));
                              setCaptainEditMode((prev) => ({ ...prev, [link.name]: true }));
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: TEXT_SUB }}>EDIT</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Link + Copy */}
                      <Text style={{ fontSize: 11, color: BLUE, marginTop: 2 }} selectable numberOfLines={2}>
                        {fullUrl}
                      </Text>
                      <TouchableOpacity
                        style={{ marginTop: 6, backgroundColor: BLUE, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, alignSelf: 'flex-start' }}
                        onPress={async () => {
                          await Clipboard.setStringAsync(fullUrl);
                          xAlert('Copied', `Link for ${link.name} copied to clipboard`);
                        }}
                      >
                        <Text style={{ color: WHITE, fontSize: 12, fontWeight: '700' }}>COPY LINK</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                style={{ marginTop: 12, paddingVertical: 14, borderRadius: 10, backgroundColor: '#06D6A0', alignItems: 'center' }}
                onPress={async () => {
                  try {
                    setActionLoading(true);
                    const result = await sendCaptainPortalLinks(leagueId);
                    xAlert('Sent', `WhatsApp sent to ${result.sent} captains${result.failed > 0 ? `, ${result.failed} failed` : ''}`);
                  } catch (err: any) {
                    xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to send');
                  } finally {
                    setActionLoading(false);
                  }
                }}
                disabled={actionLoading}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: WHITE }}>
                  {actionLoading ? 'SENDING...' : 'SEND TO ALL CAPTAINS VIA WHATSAPP'}
                </Text>
              </TouchableOpacity>
              {/* Bulk default-lineup reminder — orange to match the per-row
                  DEFAULT button. Shoots the dedicated reminder template to
                  every captain in this league. */}
              <TouchableOpacity
                style={{ marginTop: 8, paddingVertical: 14, borderRadius: 10, backgroundColor: '#F97316', alignItems: 'center' }}
                onPress={async () => {
                  try {
                    setActionLoading(true);
                    const result = await sendDefaultLineupReminders(leagueId);
                    xAlert(
                      'Sent',
                      `Default-lineup reminder sent to ${result.sent} captains${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
                    );
                  } catch (err: any) {
                    xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to send');
                  } finally {
                    setActionLoading(false);
                  }
                }}
                disabled={actionLoading}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: WHITE }}>
                  {actionLoading ? 'SENDING...' : 'SEND DEFAULT-LINEUP REMINDER TO ALL'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ marginTop: 8, paddingVertical: 14, borderRadius: 10, backgroundColor: SURFACE, alignItems: 'center' }}
                onPress={() => setShowLinksModal(false)}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: TEXT_SUB }}>CLOSE</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* CSV Import Modal */}
      <Modal visible={showCSVModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
            activeOpacity={1}
            onPress={() => setShowCSVModal(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={{ backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: NAVY, marginBottom: 4 }}>
                  Import Master CSV
                </Text>
                <Text style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 12 }}>
                  Format: franchise_name,slot_number,category,player1_name,player1_phone,player2_name,player2_phone
                </Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: BORDER,
                    borderRadius: 10,
                    padding: 12,
                    minHeight: 200,
                    fontSize: 13,
                    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                    backgroundColor: SURFACE,
                    textAlignVertical: 'top',
                  }}
                  multiline
                  value={csvText}
                  onChangeText={setCsvText}
                  placeholder={`franchise_name,slot_number,category,player1_name,player1_phone,player2_name,player2_phone\nAces,1,Kids & Kids,Rahul Kumar,9876543210,Amit Singh,9876543211\nAces,2,Kid & Teen (M),Rohan P,9876543212,Vijay S,9876543213`}
                  placeholderTextColor={TEXT_MUTED}
                />
                <View style={{ flexDirection: 'row', marginTop: 16, gap: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: SURFACE, alignItems: 'center' }}
                    onPress={() => { setShowCSVModal(false); setCsvText(''); }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: TEXT_SUB }}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: GREEN, alignItems: 'center' }}
                    onPress={async () => {
                      if (!csvText.trim() || !resolvedSeasonId) return;
                      setActionLoading(true);
                      try {
                        const result = await importMasterCSV(leagueId, resolvedSeasonId, csvText);
                        setShowCSVModal(false);
                        setCsvText('');
                        const msg = `Created ${result.franchisesCreated ?? 0} franchises, imported ${result.playersImported ?? 0} players.${result.errors?.length ? `\n${result.errors.length} errors.` : ''}`;
                        xAlert('Import Complete', msg);
                        await fetchAll();
                      } catch (err: any) {
                        xAlert('Import Error', err?.response?.data?.message || err?.message || 'Failed');
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    disabled={actionLoading || !csvText.trim()}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color={WHITE} />
                    ) : (
                      <Text style={{ fontSize: 14, fontWeight: '700', color: WHITE }}>IMPORT</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Default Lineups CSV Import Modal */}
      <Modal visible={showDefaultsModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
            activeOpacity={1}
            onPress={() => setShowDefaultsModal(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={{ backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: NAVY, marginBottom: 4 }}>
                  Upload Default Lineups
                </Text>
                <Text style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 12 }}>
                  Used when captains miss the 45-min tie-sheet deadline.{'\n'}
                  Format: franchise_name, slot_number, player1_name, player2_name
                </Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: BORDER,
                    borderRadius: 10,
                    padding: 12,
                    minHeight: 200,
                    fontSize: 13,
                    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                    backgroundColor: SURFACE,
                    textAlignVertical: 'top',
                  }}
                  multiline
                  value={defaultsCsvText}
                  onChangeText={setDefaultsCsvText}
                  placeholder={`franchise_name,slot_number,player1_name,player2_name\nDangal Dinkers,1,Player A,Player B\nDangal Dinkers,2,Player C,Player D\n...`}
                  placeholderTextColor={TEXT_MUTED}
                />
                <View style={{ flexDirection: 'row', marginTop: 16, gap: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: SURFACE, alignItems: 'center' }}
                    onPress={() => { setShowDefaultsModal(false); setDefaultsCsvText(''); }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: TEXT_SUB }}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: GREEN, alignItems: 'center' }}
                    onPress={async () => {
                      if (!defaultsCsvText.trim() || !resolvedSeasonId) return;
                      setActionLoading(true);
                      try {
                        const result = await importDefaultLineupsCSV(leagueId, resolvedSeasonId, defaultsCsvText);
                        setShowDefaultsModal(false);
                        setDefaultsCsvText('');
                        const msg = `Imported ${result.imported ?? 0} default lineups.${result.errors?.length ? `\n${result.errors.length} errors:\n${result.errors.slice(0, 5).join('\n')}` : ''}`;
                        xAlert('Import Complete', msg);
                      } catch (err: any) {
                        xAlert('Import Error', err?.response?.data?.message || err?.message || 'Failed');
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    disabled={actionLoading || !defaultsCsvText.trim()}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color={WHITE} />
                    ) : (
                      <Text style={{ fontSize: 14, fontWeight: '700', color: WHITE }}>IMPORT</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Round Setup Modal (QF / SF / FINAL) */}
      <Modal visible={!!showRoundSetup} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
            activeOpacity={1}
            onPress={() => setShowRoundSetup(null)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={{ backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '92%' }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: NAVY }}>
                    {showRoundSetup === 'LEAGUE' && 'League Schedule (Time + Court)'}
                    {showRoundSetup === 'QF' && 'Quarterfinals Setup'}
                    {showRoundSetup === 'PLAYOFFS' && 'Playoffs Setup (Q1 / Eliminator / Q2)'}
                    {showRoundSetup === 'SF' && 'Semifinals Setup'}
                    {showRoundSetup === 'FINAL' && 'Final Setup'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowRoundSetup(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={{ fontSize: 24, color: TEXT_SUB, fontWeight: '600' }}>×</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 12 }}>
                  Configure court, time, and scoring format for each tie in this round. Changes apply to all 13 matches in each tie.
                </Text>

                <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
                  {showRoundSetup && tiesForRound(showRoundSetup).map((t) => {
                    const edit = roundEdits[t.id] || { court: '', courtNumber: null, time: '', pointsToWin: 15, gamesPerMatch: 1 };
                    const homeName = t.homeTeam?.shortName || t.homeTeam?.name || 'TBD';
                    const awayName = t.awayTeam?.shortName || t.awayTeam?.name || 'TBD';
                    const updateEdit = (patch: Partial<{ court: string; courtNumber: number | null; time: string; pointsToWin: number; gamesPerMatch: number }>) => {
                      setRoundEdits((prev) => ({ ...prev, [t.id]: { ...edit, ...patch } }));
                    };
                    return (
                      <View key={t.id} style={{ backgroundColor: SURFACE, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: BORDER }}>
                        {/* Matchup header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: BLUE, letterSpacing: 0.5 }}>{t.round.toUpperCase().replace('KNOCKOUT_', '')}</Text>
                          <Text style={{ fontSize: 10, color: TEXT_SUB }}>{t.status?.toUpperCase()}</Text>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: NAVY, marginBottom: 10 }}>{homeName} vs {awayName}</Text>

                        {/* Court (free-text label shown in overlay footer) */}
                        <Text style={{ fontSize: 11, fontWeight: '700', color: TEXT_SUB, marginBottom: 4 }}>COURT LABEL</Text>
                        <TextInput
                          value={edit.court}
                          onChangeText={(v) => updateEdit({ court: v })}
                          placeholder="e.g. Court 1"
                          placeholderTextColor={TEXT_MUTED}
                          style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 10, backgroundColor: WHITE }}
                        />

                        {/* Court number (drives the persistent OBS overlay URL — same per camera) */}
                        <Text style={{ fontSize: 11, fontWeight: '700', color: TEXT_SUB, marginBottom: 4 }}>COURT # (FOR STREAMING)</Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                          {[null, 1, 2, 3].map((n) => {
                            const selected = edit.courtNumber === n;
                            return (
                              <TouchableOpacity
                                key={n === null ? 'none' : n}
                                onPress={() => updateEdit({ courtNumber: n })}
                                style={{
                                  flex: 1,
                                  paddingVertical: 10,
                                  borderRadius: 8,
                                  backgroundColor: selected ? NAVY : WHITE,
                                  borderWidth: 1,
                                  borderColor: selected ? NAVY : BORDER,
                                  alignItems: 'center',
                                }}
                              >
                                <Text style={{ fontSize: 13, fontWeight: '800', color: selected ? WHITE : NAVY }}>
                                  {n === null ? 'None' : n}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <Text style={{ fontSize: 10, color: TEXT_MUTED, fontStyle: 'italic', marginBottom: 10 }}>
                          This tie's live scoreboard will appear on the matching Court URL (set up once per camera in OBS).
                        </Text>

                        {/* Time */}
                        <Text style={{ fontSize: 11, fontWeight: '700', color: TEXT_SUB, marginBottom: 4 }}>DATE & TIME (YYYY-MM-DD HH:MM)</Text>
                        <TextInput
                          value={edit.time}
                          onChangeText={(v) => updateEdit({ time: v })}
                          placeholder="2026-04-25T18:00"
                          placeholderTextColor={TEXT_MUTED}
                          style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 10, backgroundColor: WHITE, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}
                        />

                        {/* Points to win */}
                        <Text style={{ fontSize: 11, fontWeight: '700', color: TEXT_SUB, marginBottom: 4 }}>POINTS TO WIN</Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                          {[11, 15, 21].map((p) => (
                            <TouchableOpacity
                              key={p}
                              onPress={() => updateEdit({ pointsToWin: p })}
                              style={{
                                flex: 1,
                                paddingVertical: 10,
                                borderRadius: 8,
                                backgroundColor: edit.pointsToWin === p ? NAVY : WHITE,
                                borderWidth: 1,
                                borderColor: edit.pointsToWin === p ? NAVY : BORDER,
                                alignItems: 'center',
                              }}
                            >
                              <Text style={{ fontSize: 14, fontWeight: '800', color: edit.pointsToWin === p ? WHITE : NAVY }}>{p}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        {/* Games per match (Phase 2 — only 1 is active, 3/5 locked) */}
                        <Text style={{ fontSize: 11, fontWeight: '700', color: TEXT_SUB, marginBottom: 4 }}>GAMES PER MATCH</Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                          {[1, 3, 5].map((g) => {
                            const disabled = g !== 1; // Phase 2
                            return (
                              <TouchableOpacity
                                key={g}
                                onPress={() => !disabled && updateEdit({ gamesPerMatch: g })}
                                disabled={disabled}
                                style={{
                                  flex: 1,
                                  paddingVertical: 10,
                                  borderRadius: 8,
                                  backgroundColor: edit.gamesPerMatch === g ? NAVY : WHITE,
                                  borderWidth: 1,
                                  borderColor: edit.gamesPerMatch === g ? NAVY : BORDER,
                                  alignItems: 'center',
                                  opacity: disabled ? 0.35 : 1,
                                }}
                              >
                                <Text style={{ fontSize: 13, fontWeight: '800', color: edit.gamesPerMatch === g ? WHITE : NAVY }}>
                                  Best of {g}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <Text style={{ fontSize: 10, color: TEXT_MUTED, fontStyle: 'italic', marginBottom: 4 }}>
                          Best-of-3 / Best-of-5 scoring coming soon.
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: SURFACE, alignItems: 'center' }}
                    onPress={() => setShowRoundSetup(null)}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: TEXT_SUB }}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 2, paddingVertical: 14, borderRadius: 10, backgroundColor: GREEN, alignItems: 'center', opacity: actionLoading ? 0.6 : 1 }}
                    onPress={saveRoundSetup}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color={WHITE} />
                    ) : (
                      <Text style={{ fontSize: 14, fontWeight: '800', color: WHITE, letterSpacing: 0.5 }}>SAVE ROUND</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Backfill Gender Modal — multi-line CSV paste area */}
      <Modal visible={showBackfillModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
            activeOpacity={1}
            onPress={() => !backfillSaving && setShowBackfillModal(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={{ backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: NAVY }}>Backfill Player Gender</Text>
                  <TouchableOpacity onPress={() => !backfillSaving && setShowBackfillModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={{ fontSize: 24, color: TEXT_SUB, fontWeight: '600' }}>×</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 14 }}>
                  Leave empty to auto-tag only M1/M2/M3 (male) and W1/W2 (female). To also split Teens by F/M, paste the auction CSV text below.
                </Text>

                <Text style={{ fontSize: 11, fontWeight: '700', color: TEXT_SUB, marginBottom: 6 }}>AUCTION CSV (OPTIONAL)</Text>
                <TextInput
                  value={backfillCsv}
                  onChangeText={setBackfillCsv}
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                  placeholder={'Paste the full auction CSV here...\ne.g.\nSNo,Team,Name,Age,Category\n1,Joshilaay Jumpers,Mivaan Tutwala,10,Anant (K1)\n...'}
                  placeholderTextColor={TEXT_MUTED}
                  style={{
                    borderWidth: 1,
                    borderColor: BORDER,
                    borderRadius: 10,
                    padding: 12,
                    minHeight: 160,
                    maxHeight: 280,
                    fontSize: 12,
                    color: TEXT_COLOR,
                    backgroundColor: SURFACE,
                    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                  }}
                />
                <Text style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 6, fontStyle: 'italic' }}>
                  This only updates User.gender — it does NOT touch rosters or create new users. Safe to run multiple times.
                </Text>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: SURFACE,
                      borderWidth: 1,
                      borderColor: BORDER,
                      borderRadius: 10,
                      paddingVertical: 14,
                      alignItems: 'center',
                    }}
                    onPress={() => !backfillSaving && setShowBackfillModal(false)}
                    disabled={backfillSaving}
                  >
                    <Text style={{ color: TEXT_COLOR, fontWeight: '700', fontSize: 14 }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1.4,
                      backgroundColor: '#9333EA',
                      borderRadius: 10,
                      paddingVertical: 14,
                      alignItems: 'center',
                      opacity: backfillSaving ? 0.6 : 1,
                    }}
                    onPress={async () => {
                      if (!season?.id) return;
                      setBackfillSaving(true);
                      try {
                        const res = await backfillGender(leagueId, season.id, backfillCsv.trim() || undefined);
                        setShowBackfillModal(false);
                        xAlert(
                          'Done',
                          `Tagged ${res.byCategory} players by category` +
                            (res.byTeenCsv ? ` + ${res.byTeenCsv} teens from CSV` : '') +
                            `. Skipped ${res.skipped} (already had gender).`,
                        );
                        await fetchAll();
                      } catch (err: any) {
                        xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to backfill');
                      } finally {
                        setBackfillSaving(false);
                      }
                    }}
                    disabled={backfillSaving}
                  >
                    {backfillSaving ? (
                      <ActivityIndicator size="small" color={WHITE} />
                    ) : (
                      <Text style={{ color: WHITE, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>
                        RUN BACKFILL
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Court Assignments Modal — quick per-tie court picker */}
      <Modal visible={showCourtsModal} transparent animationType="slide">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => !savingCourts && setShowCourtsModal(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '92%' }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: NAVY }}>Court Assignments</Text>
                <TouchableOpacity onPress={() => !savingCourts && setShowCourtsModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={{ fontSize: 24, color: TEXT_SUB, fontWeight: '600' }}>×</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 12 }}>
                Tap a court number next to a tie to assign it. The OBS overlay for that court will auto-switch to this tie when it becomes the active one.
              </Text>

              <ScrollView style={{ maxHeight: 560 }}>
                {(() => {
                  // Group ties by round, show upcoming/in-progress first
                  const activeTies = (ties || []).filter((t) => t.status !== 'completed');
                  const completedTies = (ties || []).filter((t) => t.status === 'completed');
                  const grouped: Record<string, Tie[]> = {};
                  const roundLabel = (r: string) => {
                    if (r.startsWith('league_week_')) return `League Week ${r.replace('league_week_', '')}`;
                    if (r === 'quarterfinal' || r === 'qf') return 'Quarterfinals';
                    if (r === 'semifinal' || r === 'sf') return 'Semifinals';
                    if (r === 'final') return 'Final';
                    if (r === 'qualifier1') return 'Qualifier 1';
                    if (r === 'qualifier2') return 'Qualifier 2';
                    if (r === 'eliminator') return 'Eliminator';
                    return r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                  };
                  [...activeTies, ...completedTies].forEach((t) => {
                    const key = roundLabel(t.round);
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(t);
                  });
                  const groupOrder = Object.keys(grouped);

                  if (groupOrder.length === 0) {
                    return (
                      <View style={{ padding: 20, alignItems: 'center' }}>
                        <Text style={{ color: TEXT_SUB, fontSize: 13 }}>No ties yet. Generate fixtures first.</Text>
                      </View>
                    );
                  }

                  const assignCourt = async (tieId: string, courtNumber: number | null) => {
                    setSavingCourts(true);
                    try {
                      await bulkUpdateTies(leagueId, [{ tieId, courtNumber }]);
                      await fetchAll();
                    } catch (err: any) {
                      xAlert('Save Failed', err?.response?.data?.message || err?.message || 'Could not update court');
                    } finally {
                      setSavingCourts(false);
                    }
                  };

                  return groupOrder.map((grp) => (
                    <View key={grp} style={{ marginBottom: 14 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: TEXT_SUB, letterSpacing: 1, marginBottom: 6 }}>{grp.toUpperCase()}</Text>
                      {grouped[grp].map((t) => {
                        const homeName = t.homeTeam?.shortName || t.homeTeam?.name || 'TBD';
                        const awayName = t.awayTeam?.shortName || t.awayTeam?.name || 'TBD';
                        const current = (t as any).courtNumber ?? null;
                        const timeStr = t.scheduledStart
                          ? new Date(t.scheduledStart as any).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                          : '—';
                        return (
                          <View key={t.id} style={{ backgroundColor: SURFACE, borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: BORDER }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: NAVY, flex: 1 }} numberOfLines={1}>
                                {homeName} vs {awayName}
                              </Text>
                              <Text style={{ fontSize: 11, color: TEXT_MUTED, marginLeft: 6 }}>{timeStr}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 6 }}>
                              {[null, 1, 2, 3].map((n) => {
                                const selected = current === n;
                                return (
                                  <TouchableOpacity
                                    key={n === null ? 'none' : n}
                                    onPress={() => !savingCourts && assignCourt(t.id, n)}
                                    disabled={savingCourts}
                                    style={{
                                      flex: 1,
                                      paddingVertical: 8,
                                      borderRadius: 6,
                                      backgroundColor: selected ? NAVY : WHITE,
                                      borderWidth: 1,
                                      borderColor: selected ? NAVY : BORDER,
                                      alignItems: 'center',
                                      opacity: savingCourts ? 0.6 : 1,
                                    }}
                                  >
                                    <Text style={{ fontSize: 12, fontWeight: '800', color: selected ? WHITE : NAVY }}>
                                      {n === null ? 'None' : `Court ${n}`}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ));
                })()}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Knockout Review Modal — shows all 8 teams with Change buttons before generating */}
      <Modal visible={knockoutConfirmVisible} transparent animationType="slide">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => !actionLoading && setKnockoutConfirmVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '92%' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: NAVY, marginBottom: 4 }}>
                Confirm 8 Qualified Teams
              </Text>
              <Text style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 16 }}>
                Teams are pre-selected based on standings. Tap CHANGE on any slot to override. These 8 teams will seed the quarterfinals.
              </Text>

              <ScrollView style={{ maxHeight: 480 }}>
                {(() => {
                  const qt = knockoutData?.qualifiedTeams as any;
                  const effective = (key: 'ab1'|'ab2'|'ab3'|'ab4'|'cd1'|'cd2'|'cd3'|'cd4') =>
                    knockoutPicks[key] || qt?.[key]?.franchiseId || null;
                  const nameOf = (fid: string | null) =>
                    fid ? (franchiseMap[fid]?.shortName || franchiseMap[fid]?.name || '—') : '—';
                  const renderRow = (key: 'ab1'|'ab2'|'ab3'|'ab4'|'cd1'|'cd2'|'cd3'|'cd4', label: string) => {
                    const fid = effective(key);
                    const auto = qt?.[key]?.franchiseId;
                    const isOverride = !!knockoutPicks[key] && knockoutPicks[key] !== auto;
                    return (
                      <View
                        key={key}
                        style={{
                          flexDirection: 'row', alignItems: 'center',
                          paddingVertical: 12, paddingHorizontal: 12,
                          borderRadius: 10, marginBottom: 8,
                          backgroundColor: isOverride ? '#FEF3C7' : '#F8FAFC',
                          borderWidth: 1,
                          borderColor: isOverride ? '#F59E0B' : '#E2E8F0',
                        }}
                      >
                        <Text style={{ width: 48, fontSize: 11, fontWeight: '800', color: TEXT_SUB, letterSpacing: 0.5 }}>{label}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: NAVY }} numberOfLines={1}>{nameOf(fid)}</Text>
                          {isOverride ? (
                            <Text style={{ fontSize: 10, color: '#92400E', fontWeight: '700' }}>MANUAL OVERRIDE</Text>
                          ) : null}
                        </View>
                        <TouchableOpacity
                          onPress={() => setKnockoutPickerSlot(key)}
                          style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: BLUE, borderRadius: 6 }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '800', color: WHITE, letterSpacing: 0.5 }}>CHANGE</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  };
                  return (
                    <>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: TEXT_SUB, letterSpacing: 1, marginBottom: 6 }}>GROUP AB</Text>
                      {renderRow('ab1', 'AB1')}
                      {renderRow('ab2', 'AB2')}
                      {renderRow('ab3', 'AB3')}
                      {renderRow('ab4', 'AB4')}
                      <Text style={{ fontSize: 11, fontWeight: '800', color: TEXT_SUB, letterSpacing: 1, marginTop: 10, marginBottom: 6 }}>GROUP CD</Text>
                      {renderRow('cd1', 'CD1')}
                      {renderRow('cd2', 'CD2')}
                      {renderRow('cd3', 'CD3')}
                      {renderRow('cd4', 'CD4')}
                    </>
                  );
                })()}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  disabled={actionLoading}
                  style={{ flex: 1, paddingVertical: 14, backgroundColor: '#F1F5F9', borderRadius: 10, alignItems: 'center', opacity: actionLoading ? 0.5 : 1 }}
                  onPress={() => setKnockoutConfirmVisible(false)}
                >
                  <Text style={{ fontSize: 13, fontWeight: '800', color: NAVY }}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={actionLoading}
                  style={{ flex: 2, paddingVertical: 14, backgroundColor: GREEN, borderRadius: 10, alignItems: 'center', opacity: actionLoading ? 0.5 : 1 }}
                  onPress={async () => {
                    try {
                      setActionLoading(true);
                      const overrides = Object.fromEntries(
                        Object.entries(knockoutPicks).filter(([, v]) => !!v),
                      ) as any;
                      await generateKnockout(leagueId, resolvedSeasonId, Object.keys(overrides).length ? overrides : undefined);
                      setKnockoutConfirmVisible(false);
                      setKnockoutPicks({});
                      xAlert('Success', 'Knockout bracket generated!');
                      await fetchAll();
                    } catch (err: any) {
                      xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to generate knockout');
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '800', color: WHITE, letterSpacing: 0.5 }}>
                    {actionLoading ? 'GENERATING...' : 'GENERATE KNOCKOUT'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Knockout Team Picker Modal — admin overrides the auto-qualifier for one AB/CD slot */}
      <Modal visible={knockoutPickerSlot != null} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 }}
          activeOpacity={1}
          onPress={() => setKnockoutPickerSlot(null)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: WHITE, borderRadius: 14, padding: 18, maxHeight: '85%' }}>
              {(() => {
                const slot = knockoutPickerSlot;
                if (!slot) return null;
                const isAB = slot.startsWith('ab');
                const sortedGroups = [...groups].sort((a, b) => a.displayOrder - b.displayOrder);
                const eligibleGroupIds = isAB
                  ? sortedGroups.slice(0, 2).map((g) => g.id)
                  : sortedGroups.slice(2, 4).map((g) => g.id);
                const eligibleStandings = standings
                  .filter((s) => eligibleGroupIds.includes(s.groupId))
                  .sort((a, b) =>
                    (b.standingPoints || 0) - (a.standingPoints || 0) ||
                    (b.matchesWon || 0) - (a.matchesWon || 0) ||
                    (b.pointDiff || 0) - (a.pointDiff || 0)
                  );
                const otherPicks = Object.entries(knockoutPicks)
                  .filter(([k, v]) => k !== slot && !!v)
                  .map(([, v]) => v as string);
                // Also block the auto-picks used by other slots unless admin overrode them
                const qt = knockoutData?.qualifiedTeams as any;
                for (const k of ['ab1','ab2','ab3','ab4','cd1','cd2','cd3','cd4']) {
                  if (k === slot) continue;
                  if (!knockoutPicks[k as keyof typeof knockoutPicks] && qt?.[k]?.franchiseId) {
                    otherPicks.push(qt[k].franchiseId);
                  }
                }
                return (
                  <>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: NAVY, marginBottom: 4 }}>
                      Select {slot.toUpperCase()}
                    </Text>
                    <Text style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 12 }}>
                      Pick a team from Group {isAB ? 'AB' : 'CD'}. Teams already used in other slots are greyed out.
                    </Text>
                    <ScrollView style={{ maxHeight: 420 }}>
                      {eligibleStandings.map((s) => {
                        const f = franchiseMap[s.franchiseId];
                        const name = f?.shortName || f?.name || '—';
                        const taken = otherPicks.includes(s.franchiseId);
                        const selected = knockoutPicks[slot] === s.franchiseId || (!knockoutPicks[slot] && qt?.[slot]?.franchiseId === s.franchiseId);
                        return (
                          <TouchableOpacity
                            key={s.franchiseId}
                            disabled={taken}
                            onPress={() => {
                              setKnockoutPicks((prev) => ({ ...prev, [slot]: s.franchiseId }));
                              setKnockoutPickerSlot(null);
                            }}
                            style={{
                              flexDirection: 'row', alignItems: 'center',
                              paddingVertical: 12, paddingHorizontal: 10,
                              borderRadius: 8, marginBottom: 6,
                              backgroundColor: selected ? '#DCFCE7' : (taken ? '#F1F5F9' : '#F8FAFC'),
                              borderWidth: 1,
                              borderColor: selected ? GREEN : (taken ? '#E2E8F0' : '#E2E8F0'),
                              opacity: taken ? 0.5 : 1,
                            }}
                          >
                            <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: taken ? TEXT_MUTED : NAVY }}>
                              {name}{taken ? '  (already picked)' : ''}
                            </Text>
                            <Text style={{ fontSize: 12, color: TEXT_SUB }}>{s.standingPoints} SP</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                      {knockoutPicks[slot] && (
                        <TouchableOpacity
                          style={{ flex: 1, paddingVertical: 12, backgroundColor: '#FEF2F2', borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#FCA5A5' }}
                          onPress={() => {
                            setKnockoutPicks((prev) => { const n = { ...prev }; delete (n as any)[slot]; return n; });
                            setKnockoutPickerSlot(null);
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '800', color: RED }}>RESET TO AUTO</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={{ flex: 1, paddingVertical: 12, backgroundColor: '#F1F5F9', borderRadius: 8, alignItems: 'center' }}
                        onPress={() => setKnockoutPickerSlot(null)}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '800', color: NAVY }}>CANCEL</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                );
              })()}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Knockout Stage Advancement Modal — confirms team assignments for each stage transition */}
      <Modal visible={advanceModal.visible} transparent animationType="slide">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => !advanceSaving && setAdvanceModal({ visible: false, stage: null, picks: {} })}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '92%' }}>
              {(() => {
                const stage = advanceModal.stage;
                const picks = advanceModal.picks;
                const kd = knockoutData;
                const kdQfRanking = kd?.qfRanking || [];

                // Build franchise options (all teams in season)
                const allFranchises = franchises.map((f) => ({ id: f.id, name: f.shortName || f.name }));

                // Per-stage config
                const config = (() => {
                  if (stage === 'playoffs') {
                    const options = kdQfRanking.map((r) => ({
                      id: r.franchiseId,
                      name: r.franchise?.shortName || r.franchise?.name || 'Team',
                      sub: `QF ${r.qfScore} • Grp ${r.groupAvg.toFixed(1)} • Weighted ${r.weighted.toFixed(1)}`,
                    }));
                    return {
                      title: 'Confirm Playoff Seeding',
                      subtitle: 'Top 4 teams advance. Override any slot if needed.',
                      slots: [
                        { key: 'h1', label: 'H1 (→ Q1 home)', options, accent: GREEN },
                        { key: 'h2', label: 'H2 (→ Q1 away)', options, accent: GREEN },
                        { key: 'h3', label: 'H3 (→ Eliminator home)', options, accent: BLUE },
                        { key: 'h4', label: 'H4 (→ Eliminator away)', options, accent: BLUE },
                      ],
                      cta: 'GENERATE Q1 + ELIMINATOR',
                    };
                  }
                  if (stage === 'q1-advance') {
                    const q1 = kd?.q1;
                    const homeTeam = q1?.homeTeamId ? allFranchises.find((f) => f.id === q1.homeTeamId) : null;
                    const awayTeam = q1?.awayTeamId ? allFranchises.find((f) => f.id === q1.awayTeamId) : null;
                    const opts = [homeTeam, awayTeam].filter(Boolean).map((t) => ({
                      id: t!.id, name: t!.name, sub: t!.id === q1?.winnerId ? '🏆 Q1 winner' : 'Q1 loser',
                    }));
                    return {
                      title: 'Advance Q1 Teams',
                      subtitle: 'Winner goes to Final, loser goes to Q2.',
                      slots: [
                        { key: 'finalHome', label: 'Final — Home (winner of Q1)', options: opts, accent: GREEN },
                        { key: 'q2Home', label: 'Q2 — Home (loser of Q1)', options: opts, accent: WARN },
                      ],
                      cta: 'CONFIRM & ADVANCE',
                    };
                  }
                  if (stage === 'elim-advance') {
                    const el = kd?.eliminator;
                    const homeTeam = el?.homeTeamId ? allFranchises.find((f) => f.id === el.homeTeamId) : null;
                    const awayTeam = el?.awayTeamId ? allFranchises.find((f) => f.id === el.awayTeamId) : null;
                    const opts = [homeTeam, awayTeam].filter(Boolean).map((t) => ({
                      id: t!.id, name: t!.name, sub: t!.id === el?.winnerId ? '🏆 Eliminator winner' : 'Eliminated',
                    }));
                    return {
                      title: 'Advance Eliminator Winner',
                      subtitle: 'Winner joins Q2 as the away team.',
                      slots: [
                        { key: 'q2Away', label: 'Q2 — Away', options: opts, accent: WARN },
                      ],
                      cta: 'CONFIRM & ADVANCE',
                    };
                  }
                  if (stage === 'q2-advance') {
                    const q2 = kd?.q2;
                    const homeTeam = q2?.homeTeamId ? allFranchises.find((f) => f.id === q2.homeTeamId) : null;
                    const awayTeam = q2?.awayTeamId ? allFranchises.find((f) => f.id === q2.awayTeamId) : null;
                    const opts = [homeTeam, awayTeam].filter(Boolean).map((t) => ({
                      id: t!.id, name: t!.name, sub: t!.id === q2?.winnerId ? '🏆 Q2 winner' : 'Eliminated',
                    }));
                    return {
                      title: 'Advance Q2 Winner',
                      subtitle: 'Winner goes to the Final as the away team.',
                      slots: [
                        { key: 'finalAway', label: 'Final — Away', options: opts, accent: GREEN },
                      ],
                      cta: 'CONFIRM & ADVANCE',
                    };
                  }
                  return null;
                })();

                if (!config) return <Text style={{ color: TEXT_SUB }}>Nothing to advance.</Text>;

                const pickedCount = config.slots.filter((s) => !!picks[s.key]).length;
                const canSubmit = pickedCount === config.slots.length && !advanceSaving;

                const handleSubmit = async () => {
                  if (!season?.id) return;
                  setAdvanceSaving(true);
                  try {
                    const updates: any[] = [];
                    if (stage === 'playoffs') {
                      if (kd?.q1) updates.push({ tieId: kd.q1.id, homeTeamId: picks.h1, awayTeamId: picks.h2 });
                      if (kd?.eliminator) updates.push({ tieId: kd.eliminator.id, homeTeamId: picks.h3, awayTeamId: picks.h4 });
                    } else if (stage === 'q1-advance') {
                      if (kd?.final) updates.push({ tieId: kd.final.id, homeTeamId: picks.finalHome });
                      if (kd?.q2) updates.push({ tieId: kd.q2.id, homeTeamId: picks.q2Home });
                    } else if (stage === 'elim-advance') {
                      if (kd?.q2) updates.push({ tieId: kd.q2.id, awayTeamId: picks.q2Away });
                    } else if (stage === 'q2-advance') {
                      if (kd?.final) updates.push({ tieId: kd.final.id, awayTeamId: picks.finalAway });
                    }
                    if (updates.length) await bulkUpdateTies(leagueId, updates);
                    setAdvanceModal({ visible: false, stage: null, picks: {} });
                    await fetchAll();
                  } catch (err: any) {
                    xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to advance');
                  } finally {
                    setAdvanceSaving(false);
                  }
                };

                return (
                  <>
                    {/* Header */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontSize: 18, fontWeight: '800', color: NAVY }}>{config.title}</Text>
                      <TouchableOpacity
                        onPress={() => !advanceSaving && setAdvanceModal({ visible: false, stage: null, picks: {} })}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={{ fontSize: 24, color: TEXT_SUB, fontWeight: '600' }}>×</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 16 }}>{config.subtitle}</Text>

                    <ScrollView style={{ maxHeight: 520 }}>
                      {config.slots.map((slot) => (
                        <View key={slot.key} style={{ marginBottom: 14 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                            <View style={{ width: 4, height: 14, backgroundColor: slot.accent, borderRadius: 2, marginRight: 8 }} />
                            <Text style={{ fontSize: 12, fontWeight: '800', color: NAVY, letterSpacing: 0.5 }}>
                              {slot.label}
                            </Text>
                          </View>
                          <View style={{ gap: 6 }}>
                            {slot.options.map((opt) => {
                              const selected = picks[slot.key] === opt.id;
                              return (
                                <TouchableOpacity
                                  key={`${slot.key}-${opt.id}`}
                                  onPress={() => setAdvanceModal((p) => ({ ...p, picks: { ...p.picks, [slot.key]: opt.id } }))}
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    padding: 12,
                                    borderRadius: 10,
                                    backgroundColor: selected ? slot.accent + '22' : SURFACE,
                                    borderWidth: 2,
                                    borderColor: selected ? slot.accent : BORDER,
                                  }}
                                >
                                  <View
                                    style={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: 10,
                                      borderWidth: 2,
                                      borderColor: selected ? slot.accent : BORDER,
                                      backgroundColor: selected ? slot.accent : WHITE,
                                      marginRight: 10,
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    {selected && <Text style={{ color: WHITE, fontSize: 12, fontWeight: '900' }}>✓</Text>}
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: NAVY }} numberOfLines={1}>{opt.name}</Text>
                                    {(opt as any).sub && (
                                      <Text style={{ fontSize: 10, color: TEXT_SUB, marginTop: 1 }} numberOfLines={1}>{(opt as any).sub}</Text>
                                    )}
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      ))}
                    </ScrollView>

                    {/* Actions */}
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                      <TouchableOpacity
                        style={{ flex: 1, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingVertical: 14, alignItems: 'center' }}
                        onPress={() => !advanceSaving && setAdvanceModal({ visible: false, stage: null, picks: {} })}
                        disabled={advanceSaving}
                      >
                        <Text style={{ color: TEXT_COLOR, fontWeight: '700', fontSize: 14 }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          flex: 1.6,
                          backgroundColor: canSubmit ? GREEN : '#A7F3D0',
                          borderRadius: 10,
                          paddingVertical: 14,
                          alignItems: 'center',
                        }}
                        onPress={handleSubmit}
                        disabled={!canSubmit}
                      >
                        {advanceSaving ? (
                          <ActivityIndicator size="small" color={WHITE} />
                        ) : (
                          <Text style={{ color: WHITE, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>
                            {config.cta}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                );
              })()}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* OBS Overlays Modal — persistent URLs per court */}
      <Modal visible={showOverlaysModal} transparent animationType="slide">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setShowOverlaysModal(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '92%' }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: NAVY }}>OBS Overlays</Text>
                <TouchableOpacity onPress={() => setShowOverlaysModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={{ fontSize: 24, color: TEXT_SUB, fontWeight: '600' }}>×</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 12 }}>
                Paste these URLs into an OBS Browser Source — one per camera. Each URL stays the same all tournament; the overlay auto-switches to whatever tie is live on that court.
              </Text>

              <ScrollView style={{ maxHeight: 520 }}>
                {(() => {
                  const seasonId = season?.id;
                  if (!seasonId) {
                    return (
                      <View style={{ padding: 20, alignItems: 'center' }}>
                        <Text style={{ color: TEXT_SUB, fontSize: 13 }}>No active season — create a season first.</Text>
                      </View>
                    );
                  }
                  // API_BASE_URL ends with /api/v1 → drop that and rebuild the overlay base.
                  const apiBase = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
                  const courts = [1, 2, 3];
                  return courts.map((n) => {
                    const bottomUrl = `${apiBase}/api/v1/scoreboard/court/${seasonId}/${n}`;
                    const cornerUrl = `${bottomUrl}/corner`;
                    return (
                      <View key={n} style={{ backgroundColor: SURFACE, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: BORDER }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: NAVY, marginBottom: 10 }}>Court {n}</Text>

                        <Text style={{ fontSize: 11, fontWeight: '700', color: TEXT_SUB, marginBottom: 4 }}>BOTTOM TICKER</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                          <View style={{ flex: 1, backgroundColor: WHITE, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: BORDER }}>
                            <Text style={{ fontSize: 11, color: TEXT_COLOR }} numberOfLines={2} selectable>{bottomUrl}</Text>
                          </View>
                          <TouchableOpacity
                            onPress={async () => {
                              await Clipboard.setStringAsync(bottomUrl);
                              xAlert('Copied', `Court ${n} bottom-ticker URL copied`);
                            }}
                            style={{ paddingHorizontal: 14, justifyContent: 'center', backgroundColor: NAVY, borderRadius: 8 }}
                          >
                            <Text style={{ color: WHITE, fontSize: 12, fontWeight: '700' }}>COPY</Text>
                          </TouchableOpacity>
                        </View>

                        <Text style={{ fontSize: 11, fontWeight: '700', color: TEXT_SUB, marginBottom: 4 }}>CORNER BOX</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <View style={{ flex: 1, backgroundColor: WHITE, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: BORDER }}>
                            <Text style={{ fontSize: 11, color: TEXT_COLOR }} numberOfLines={2} selectable>{cornerUrl}</Text>
                          </View>
                          <TouchableOpacity
                            onPress={async () => {
                              await Clipboard.setStringAsync(cornerUrl);
                              xAlert('Copied', `Court ${n} corner-box URL copied`);
                            }}
                            style={{ paddingHorizontal: 14, justifyContent: 'center', backgroundColor: NAVY, borderRadius: 8 }}
                          >
                            <Text style={{ color: WHITE, fontSize: 12, fontWeight: '700' }}>COPY</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  });
                })()}

                <View style={{ backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, marginTop: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#92400E', marginBottom: 4 }}>Setup reminder</Text>
                  <Text style={{ fontSize: 11, color: '#78350F', lineHeight: 16 }}>
                    Each tie must be assigned a Court # (in the Knockout round setup, or the tie's config). Ties without a court # won't appear on any overlay.
                  </Text>
                </View>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* League Admins Modal */}
      <Modal visible={showAdminsModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
            activeOpacity={1}
            onPress={() => setShowAdminsModal(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={{ backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: NAVY }}>League Admins</Text>
                  <TouchableOpacity onPress={() => setShowAdminsModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={{ fontSize: 24, color: TEXT_SUB, fontWeight: '600' }}>×</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 16 }}>
                  Admins have full organizer powers — manage franchises, ties, scorers, fixtures. Only the league owner can add or remove admins.
                </Text>

                <ScrollView style={{ maxHeight: 480 }} keyboardShouldPersistTaps="handled">
                  {/* Add admin form */}
                  <View style={{ backgroundColor: SURFACE, borderRadius: 12, padding: 14, marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: NAVY, marginBottom: 8 }}>+ Add an admin</Text>
                    <TextInput
                      placeholder="Full name"
                      placeholderTextColor={TEXT_MUTED}
                      value={newAdminName}
                      onChangeText={setNewAdminName}
                      style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 8, backgroundColor: WHITE }}
                    />
                    <TextInput
                      placeholder="Phone (10-digit or +91xxxxxxxxxx)"
                      placeholderTextColor={TEXT_MUTED}
                      value={newAdminPhone}
                      onChangeText={setNewAdminPhone}
                      keyboardType="phone-pad"
                      style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 8, backgroundColor: WHITE }}
                    />
                    <Text style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 10, fontStyle: 'italic' }}>
                      They'll see this league in their Yoiden app once they sign in with this phone number.
                    </Text>
                    <TouchableOpacity
                      style={{ backgroundColor: '#7C3AED', paddingVertical: 12, borderRadius: 8, alignItems: 'center', opacity: (actionLoading || !newAdminName.trim() || !newAdminPhone.trim()) ? 0.5 : 1 }}
                      disabled={actionLoading || !newAdminName.trim() || !newAdminPhone.trim()}
                      onPress={async () => {
                        if (!newAdminName.trim() || !newAdminPhone.trim()) return;
                        setActionLoading(true);
                        try {
                          const result = await addLeagueAdmin(leagueId, newAdminName.trim(), newAdminPhone.trim());
                          setNewAdminName('');
                          setNewAdminPhone('');
                          const list = await listLeagueAdmins(leagueId);
                          setAdmins(Array.isArray(list) ? list : []);
                          if (!result?.isExistingUser) {
                            xAlert('Added', `${newAdminName.trim()} added as admin. They'll get access once they sign in to Yoiden with that phone number.`);
                          } else {
                            xAlert('Added', `${result?.user?.fullName || newAdminName.trim()} is now an admin on this league.`);
                          }
                        } catch (err: any) {
                          xAlert('Add Failed', err?.response?.data?.message || err?.message || 'Could not add admin');
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                    >
                      {actionLoading ? <ActivityIndicator color={WHITE} /> : <Text style={{ fontSize: 13, fontWeight: '700', color: WHITE, letterSpacing: 0.5 }}>ADD ADMIN</Text>}
                    </TouchableOpacity>
                  </View>

                  {/* Admin list */}
                  <Text style={{ fontSize: 13, fontWeight: '700', color: NAVY, marginBottom: 8 }}>
                    Current admins ({admins.length})
                  </Text>
                  {admins.length === 0 ? (
                    <Text style={{ fontSize: 12, color: TEXT_SUB, fontStyle: 'italic', textAlign: 'center', marginVertical: 24 }}>
                      No admins yet. Add one above.
                    </Text>
                  ) : (
                    admins.map((a) => (
                      <View key={a.userId} style={{ backgroundColor: WHITE, borderWidth: 1, borderColor: a.isOwner ? '#F59E0B' : BORDER, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={{ fontSize: 14, fontWeight: '700', color: NAVY }}>{a.name}</Text>
                              {a.isOwner && (
                                <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#92400E', letterSpacing: 0.5 }}>OWNER</Text>
                                </View>
                              )}
                            </View>
                            <Text style={{ fontSize: 12, color: TEXT_SUB, marginTop: 2 }}>{a.phone}</Text>
                          </View>
                          {!a.isOwner && (
                            <TouchableOpacity
                              style={{ backgroundColor: '#EF4444', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 }}
                              onPress={() => {
                                xConfirm(
                                  'Remove Admin',
                                  `Remove ${a.name} as an admin? They'll lose access to this league.`,
                                  async () => {
                                    try {
                                      await removeLeagueAdmin(leagueId, a.userId);
                                      setAdmins((prev) => prev.filter((x) => x.userId !== a.userId));
                                    } catch (err: any) {
                                      xAlert('Remove Failed', err?.response?.data?.message || err?.message || 'Could not remove admin');
                                    }
                                  },
                                );
                              }}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '700', color: WHITE }}>🗑 REMOVE</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))
                  )}

                  <View style={{ backgroundColor: '#F5F3FF', borderRadius: 8, padding: 10, marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#7C3AED' }}>
                    <Text style={{ fontSize: 11, color: '#5B21B6', lineHeight: 16 }}>
                      💡 Admins <Text style={{ fontWeight: '700' }}>cannot</Text>: delete the league, add/remove other admins, or transfer ownership. Only the owner can. Everything else (ties, franchises, scorers, fixtures, setup) — admins can do it all.
                    </Text>
                  </View>
                </ScrollView>

                <TouchableOpacity
                  style={{ paddingVertical: 14, borderRadius: 10, backgroundColor: SURFACE, alignItems: 'center', marginTop: 12 }}
                  onPress={() => setShowAdminsModal(false)}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: TEXT_SUB }}>CLOSE</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Scorers Management Modal */}
      <Modal visible={showScorersModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
            activeOpacity={1}
            onPress={() => setShowScorersModal(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={{ backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: NAVY }}>Scorers</Text>
                  <TouchableOpacity onPress={() => setShowScorersModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={{ fontSize: 24, color: TEXT_SUB, fontWeight: '600' }}>×</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 16 }}>
                  People who can enter scores at the courts via the scorer portal
                </Text>

                <ScrollView style={{ maxHeight: 480 }} keyboardShouldPersistTaps="handled">
                  {/* Add scorer form */}
                  <View style={{ backgroundColor: SURFACE, borderRadius: 12, padding: 14, marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: NAVY, marginBottom: 8 }}>+ Add a scorer</Text>
                    <TextInput
                      placeholder="Full name"
                      placeholderTextColor={TEXT_MUTED}
                      value={newScorerName}
                      onChangeText={setNewScorerName}
                      style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 8, backgroundColor: WHITE }}
                    />
                    <TextInput
                      placeholder="Phone (10-digit or +91xxxxxxxxxx)"
                      placeholderTextColor={TEXT_MUTED}
                      value={newScorerPhone}
                      onChangeText={setNewScorerPhone}
                      keyboardType="phone-pad"
                      style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 8, backgroundColor: WHITE }}
                    />
                    <TextInput
                      placeholder="6-digit PIN (e.g. 482917)"
                      placeholderTextColor={TEXT_MUTED}
                      value={newScorerPin}
                      onChangeText={(v) => setNewScorerPin(v.replace(/\D/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                      secureTextEntry={false}
                      style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 4, backgroundColor: WHITE, letterSpacing: 2 }}
                    />
                    <Text style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 10, fontStyle: 'italic' }}>
                      Required. Pick something the scorer will remember — you'll share it with them manually via WhatsApp.
                    </Text>
                    <TouchableOpacity
                      style={{ backgroundColor: NAVY, paddingVertical: 12, borderRadius: 8, alignItems: 'center', opacity: (actionLoading || !newScorerName.trim() || !newScorerPhone.trim() || newScorerPin.length !== 6) ? 0.5 : 1 }}
                      disabled={actionLoading || !newScorerName.trim() || !newScorerPhone.trim() || newScorerPin.length !== 6}
                      onPress={async () => {
                        if (!newScorerName.trim() || !newScorerPhone.trim()) return;
                        const pinTrimmed = newScorerPin.trim();
                        if (!/^\d{6}$/.test(pinTrimmed)) {
                          xAlert('Invalid PIN', 'PIN is required and must be exactly 6 digits.');
                          return;
                        }
                        setActionLoading(true);
                        try {
                          const result = await addScorer(leagueId, newScorerName.trim(), newScorerPhone.trim(), pinTrimmed);
                          const userId = result?.user?.id;
                          const pin = result?.generatedPin;
                          if (userId && pin) {
                            setScorerPinMap((prev) => ({ ...prev, [userId]: pin }));
                          }
                          setNewScorerName('');
                          setNewScorerPhone('');
                          setNewScorerPin('');
                          const list = await listScorers(leagueId);
                          setScorers(Array.isArray(list) ? list : []);
                        } catch (err: any) {
                          xAlert('Add Failed', err?.response?.data?.message || err?.message || 'Could not add scorer');
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                    >
                      {actionLoading ? <ActivityIndicator color={WHITE} /> : <Text style={{ fontSize: 13, fontWeight: '700', color: WHITE, letterSpacing: 0.5 }}>ADD SCORER</Text>}
                    </TouchableOpacity>
                  </View>

                  {/* Scorer list */}
                  <Text style={{ fontSize: 13, fontWeight: '700', color: NAVY, marginBottom: 8 }}>
                    Active scorers ({scorers.length})
                  </Text>
                  {scorers.length === 0 ? (
                    <Text style={{ fontSize: 12, color: TEXT_SUB, fontStyle: 'italic', textAlign: 'center', marginVertical: 24 }}>
                      No scorers yet. Add one above.
                    </Text>
                  ) : (
                    scorers.map((s: any) => {
                      const pin = scorerPinMap[s.userId];
                      return (
                        <View key={s.userId} style={{ backgroundColor: WHITE, borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: NAVY }}>{s.name}</Text>
                          <Text style={{ fontSize: 12, color: TEXT_SUB, marginTop: 2 }}>{s.phone}</Text>
                          {pin ? (
                            <View style={{ backgroundColor: '#D1FAE5', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#10B981' }}>
                              <Text style={{ fontSize: 11, color: '#065F46', fontWeight: '700' }}>NEW PIN: {pin}</Text>
                              <Text style={{ fontSize: 10, color: '#047857', marginTop: 2 }}>Tap COPY PIN below, then paste it in a manual WhatsApp message after sending the invite. Won't show again after closing.</Text>
                            </View>
                          ) : null}
                          <View style={{ flexDirection: 'row', marginTop: 10, gap: 6, flexWrap: 'wrap' }}>
                            <TouchableOpacity
                              style={{ flex: 1, backgroundColor: '#25D366', paddingVertical: 10, borderRadius: 6, alignItems: 'center', minWidth: 95 }}
                              onPress={async () => {
                                try {
                                  await sendScorerInvite(leagueId, s.userId);
                                  xAlert('Sent', `WhatsApp invite sent to ${s.name}. Now share their PIN manually (use COPY PIN if this is a new/reset PIN).`);
                                } catch (err: any) {
                                  xAlert('Send Failed', err?.response?.data?.message || err?.message || 'Could not send WhatsApp');
                                }
                              }}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '700', color: WHITE }}>📱 SEND WA</Text>
                            </TouchableOpacity>
                            {pin ? (
                              <TouchableOpacity
                                style={{ flex: 1, backgroundColor: '#2196F3', paddingVertical: 10, borderRadius: 6, alignItems: 'center', minWidth: 95 }}
                                onPress={async () => {
                                  try {
                                    await Clipboard.setStringAsync(pin);
                                    xAlert('Copied', `PIN ${pin} copied. Paste into your own WhatsApp chat with ${s.name}.`);
                                  } catch {
                                    xAlert('Copy Failed', 'Could not copy PIN');
                                  }
                                }}
                              >
                                <Text style={{ fontSize: 11, fontWeight: '700', color: WHITE }}>📋 COPY PIN</Text>
                              </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity
                              style={{ flex: 1, backgroundColor: '#F59E0B', paddingVertical: 10, borderRadius: 6, alignItems: 'center', minWidth: 95 }}
                              onPress={() => {
                                xPrompt(
                                  `Reset PIN for ${s.name}`,
                                  'Enter new 6-digit PIN. The old PIN will stop working immediately.',
                                  async (input) => {
                                    const pinTrimmed = (input || '').trim();
                                    if (!/^\d{6}$/.test(pinTrimmed)) {
                                      xAlert('Invalid PIN', 'PIN is required and must be exactly 6 digits.');
                                      return;
                                    }
                                    try {
                                      const r = await resetScorerPin(leagueId, s.userId, pinTrimmed);
                                      if (r?.newPin) {
                                        setScorerPinMap((prev) => ({ ...prev, [s.userId]: r.newPin }));
                                      }
                                    } catch (err: any) {
                                      xAlert('Reset Failed', err?.response?.data?.message || err?.message || 'Could not reset PIN');
                                    }
                                  },
                                  { keyboardType: 'number-pad' },
                                );
                              }}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '700', color: WHITE }}>🔄 RESET</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ flex: 1, backgroundColor: '#EF4444', paddingVertical: 10, borderRadius: 6, alignItems: 'center', minWidth: 95 }}
                              onPress={() => {
                                xConfirm(
                                  'Remove Scorer',
                                  `Remove ${s.name} as a scorer for this league? They'll lose access to score entry.`,
                                  async () => {
                                    try {
                                      await removeScorer(leagueId, s.userId);
                                      setScorers((prev) => prev.filter((x: any) => x.userId !== s.userId));
                                      setScorerPinMap((prev) => {
                                        const copy = { ...prev };
                                        delete copy[s.userId];
                                        return copy;
                                      });
                                    } catch (err: any) {
                                      xAlert('Remove Failed', err?.response?.data?.message || err?.message || 'Could not remove');
                                    }
                                  },
                                );
                              }}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '700', color: WHITE }}>🗑 REMOVE</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}

                  {/* Helper note */}
                  <View style={{ backgroundColor: '#EFF6FF', borderRadius: 8, padding: 10, marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#2196F3' }}>
                    <Text style={{ fontSize: 11, color: '#1E40AF', lineHeight: 16 }}>
                      💡 <Text style={{ fontWeight: '700' }}>Two-step invite:</Text> (1) Tap SEND WA — sends a generic "you're a scorer" message with the portal link. (2) Tap COPY PIN, then paste it into your own WhatsApp chat with them. PINs are only shown when first generated or reset.
                    </Text>
                  </View>
                </ScrollView>

                <TouchableOpacity
                  style={{ paddingVertical: 14, borderRadius: 10, backgroundColor: SURFACE, alignItems: 'center', marginTop: 12 }}
                  onPress={() => setShowScorersModal(false)}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: TEXT_SUB }}>CLOSE</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default LeagueDashboardScreen;

// ═════════════════════════════════════════════════════════════════════════════
// Styles
// ═════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: TEXT_SUB },

  // Header — cream surface, ink text, matches Yoiden top bars
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: YColors.bg,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: YColors.line,
  },
  backBtn: { width: 36, height: 36, borderRadius: 999, borderWidth: 1, borderColor: YColors.line2, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: YColors.ink, fontSize: 18, fontWeight: '700' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: YColors.ink, fontSize: 18, fontWeight: '900', letterSpacing: 0.3 },
  headerSubtitle: { color: YColors.ink2, fontSize: 11, marginTop: 2, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700' },

  // Tab bar
  tabBar: { backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER },
  tabBarInner: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tabChip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: SURFACE,
  },
  tabChipActive: { backgroundColor: NAVY },
  tabChipText: { fontSize: 13, fontWeight: '700', color: TEXT_SUB, letterSpacing: 0.5 },
  tabChipTextActive: { color: WHITE },

  // Tab content
  tabContent: { padding: 16, paddingBottom: 120 },

  // Phase banner
  phaseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  phaseLabel: { fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  phaseSubtext: { fontSize: 13, fontWeight: '500' },
  brandHero: { backgroundColor: NAVY, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18 },
  brandHeroEyebrow: { color: BLUE, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  brandHeroTitle: { color: WHITE, fontSize: 28, fontWeight: '900', letterSpacing: 0.5, lineHeight: 30 },
  brandHeroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  brandHeroMeta: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  brandHeroBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  brandHeroBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  // Quick stats
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  statPill: {
    flex: 1,
    backgroundColor: WHITE,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: NAVY },
  statLabel: { fontSize: 10, fontWeight: '600', color: TEXT_SUB, marginTop: 4, letterSpacing: 0.3 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: NAVY, letterSpacing: -0.2 },

  // Hero standings
  heroStandings: { marginBottom: 20 },
  heroTable: {
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  heroTableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: NAVY,
  },
  heroTableCell: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  heroTableRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  heroTableCellVal: {
    flex: 1,
    fontSize: 13,
    color: TEXT_COLOR,
    textAlign: 'center',
  },

  // Setup toggle
  setupToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 8,
  },
  setupToggleIcon: { fontSize: 16, color: TEXT_SUB },
  setupToggleText: { fontSize: 13, fontWeight: '700', color: TEXT_SUB, letterSpacing: 0.3 },

  // Tie card
  tieCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tieCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  roundBadge: {
    backgroundColor: SURFACE,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roundBadgeText: { fontSize: 11, fontWeight: '700', color: TEXT_SUB, letterSpacing: 0.5 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusChipText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  tieMatchup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tieTeamName: { flex: 1, fontSize: 15, fontWeight: '700', color: TEXT_COLOR, textAlign: 'center' },
  tieVsText: { fontSize: 12, fontWeight: '600', color: TEXT_MUTED, marginHorizontal: 8 },
  tieScoreBox: {
    backgroundColor: NAVY,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  tieScoreText: { fontSize: 16, fontWeight: '800', color: WHITE },

  tieBonusRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  tieBonusText: { fontSize: 11, fontWeight: '600', color: GREEN },
  tieDateText: { fontSize: 11, color: TEXT_SUB, marginTop: 8, textAlign: 'center' },

  // Round header (fixtures)
  roundHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 12 },
  roundDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE, marginRight: 8 },
  roundHeaderText: { fontSize: 14, fontWeight: '800', color: NAVY, letterSpacing: 0.3 },
  roundLine: { flex: 1, height: 1, backgroundColor: BORDER, marginLeft: 12 },

  // Standings table
  groupSection: {
    backgroundColor: WHITE,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  groupHeader: {
    backgroundColor: NAVY,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  groupHeaderText: { color: WHITE, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  // Each header cell is its own bordered box so the table reads as a
  // proper grid (vertical column separators + horizontal row separators).
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_SUB,
    textAlign: 'center',
    letterSpacing: 0.5,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },
  // Last header cell — drop the right border so it sits flush with the
  // outer container border (no doubled-up line).
  tableHeaderCellLast: { borderRightWidth: 0 },
  // Visual divider between headline columns (P, W, L, TP) and the rally
  // breakdown (MW, PW, PL, PD). Slightly wider than a normal column gap;
  // its right border draws the separator line itself.
  tableColDivider: {
    width: 14,
    alignSelf: 'stretch',
    backgroundColor: SURFACE,
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRowQualified: { backgroundColor: '#F0FDF4' },
  tableCell: {
    fontSize: 13,
    color: TEXT_COLOR,
    textAlign: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    // Vertical centering for single-line cells; multi-line team-name cell
    // overrides this with `textAlignVertical: 'center'` via numberOfLines.
    textAlignVertical: 'center',
  },
  tableCellLast: { borderRightWidth: 0 },

  // Buttons
  primaryBtn: {
    backgroundColor: GREEN,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  primaryBtnText: { color: NAVY, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  secondaryBtn: {
    backgroundColor: WHITE,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: NAVY,
  },
  secondaryBtnText: { color: NAVY, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: TEXT_COLOR, marginBottom: 6 },
  emptyText: { fontSize: 13, color: TEXT_SUB, textAlign: 'center' },
});

// ── Knockout styles ─────────────────────────────────────────────────────────
const koStyles = StyleSheet.create({
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: TEXT_SUB,
    letterSpacing: 1.5,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  recTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: NAVY,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  recSub: {
    fontSize: 12,
    color: TEXT_SUB,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  groupPairCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: SURFACE,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  groupPairLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: BLUE,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  qualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 10,
  },
  qualRank: {
    fontSize: 14,
    fontWeight: '900',
    color: TEXT_MUTED,
    width: 20,
    textAlign: 'center',
  },
  qualName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: NAVY,
  },
  qualSP: {
    fontSize: 13,
    fontWeight: '800',
    color: GREEN,
  },
  bracketPreview: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  bracketPreviewTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  bracketPreviewText: {
    fontSize: 13,
    color: TEXT_COLOR,
    fontWeight: '600',
    marginBottom: 4,
  },
  pendingBanner: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  pendingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  // Bracket view
  sfRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    marginBottom: 0,
  },
  tieCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 8,
  },
  tieLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: 1,
  },
  tieSubLabel: {
    fontSize: 10,
    color: TEXT_MUTED,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: -4,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamSide: {
    flex: 1,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '800',
    color: NAVY,
  },
  score: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_SUB,
    marginTop: 2,
  },
  vs: {
    fontSize: 10,
    fontWeight: '900',
    color: TEXT_MUTED,
    marginHorizontal: 8,
  },
  winnerText: {
    fontSize: 11,
    fontWeight: '700',
    color: GREEN,
    marginTop: 8,
    textAlign: 'center',
  },
  connectorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    marginBottom: 4,
  },
  connectorLine: {
    height: 2,
    width: 40,
    backgroundColor: BORDER,
  },
  connectorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: NAVY,
    marginHorizontal: 4,
  },
  championBanner: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  championLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#92400E',
    letterSpacing: 2,
    marginBottom: 4,
  },
  championName: {
    fontSize: 22,
    fontWeight: '900',
    color: NAVY,
  },
});
