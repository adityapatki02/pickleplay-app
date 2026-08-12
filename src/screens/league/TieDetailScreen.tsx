import React, { useCallback, useState, useEffect, useRef } from 'react';
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
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import {
  getTie,
  getTieSheets,
  lockLineups,
  lockCategory,
  unlockCategory,
  setKidsDeadline,
  startTie,
  completeTie,
  submitTieSheet,
  getRoster,
  bulkUpdateTies,
  adminLiveScore,
  adminFinalizeMatch,
  adminDeclareWinner,
  adminSetMatchCourt,
  adminSyncServe,
  getLeague,
  getSeasons,
  listScorers,
  resetLeagueTie,
  substitutePlayer,
  adminSwapSlotPlayer,
  openCaptainPortal,
} from '../../api/leagues.api';
import { matchesApi } from '../../api/matches.api';
import { computeMatchBonus, bonusToSides, SeasonBonusRules } from '../../utils/bonus';
import {
  foldServe,
  ServeConfig,
  ServeEvent,
  Positions,
  Side,
} from '../../utils/serveState';
import { sbplGroupForCategory, courtForSlot } from '../../utils/sbplCategory';
import { ShuttleIcon, TargetIcon } from '../../components/ServeIcons';
import { useLeagueStore } from '../../store/leagueStore';
import { useAuthStore } from '../../store/authStore';
import { IS_LEAGUE_KIOSK } from '../../config/appMode';
import { useLeagueAdminAccess } from '../../hooks/useLeagueAdminAccess';
import { xAlert, xConfirm } from '../../utils/alert';
import { downloadTieSheet, SPPL_TIE_SHEET_LABELS } from '../../utils/downloadTieSheet';
import type {
  Tie,
  TieMatch,
  TieSheet,
  TieStatus,
  TieSheetStatus,
  CategorySlug,
  FranchiseRoster,
} from '../../types/league.types';
import { SPPL_MATCH_SLOTS } from '../../types/league.types';

import { YColors, YTopBar, YDisplay, YUiText, YEyebrow, YBadge } from '../../components/yoiden';

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

// ─── Category colors ────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  // SPPL
  kids: { color: PURPLE, bg: '#EDE9FE', label: 'Kids' },
  teen: { color: ORANGE, bg: '#FFF7ED', label: 'Teen' },
  women1: { color: PINK, bg: '#FCE7F3', label: 'Women 1' },
  women2: { color: PINK, bg: '#FCE7F3', label: 'Women 2' },
  men1: { color: BLUE, bg: '#DBEAFE', label: 'Men 1' },
  men2: { color: BLUE, bg: '#DBEAFE', label: 'Men 2' },
  men3: { color: BLUE, bg: '#DBEAFE', label: 'Men 3' },
  // SBPL (rulebook §2)
  women13: { color: PINK, bg: '#FCE7F3', label: 'Women 1-3' },
  women45: { color: PINK, bg: '#FCE7F3', label: 'Women 4-5' },
  menA: { color: BLUE, bg: '#DBEAFE', label: 'Men A' },
  menB: { color: BLUE, bg: '#DBEAFE', label: 'Men B' },
  menC: { color: BLUE, bg: '#DBEAFE', label: 'Men C' },
};

// ─── Status chip colors ─────────────────────────────────────────────────────
const STATUS_CHIP: Record<TieStatus, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', color: TEXT_SUB, bg: '#F1F5F9' },
  lineup_submitted: { label: 'Lineup Submitted', color: BLUE, bg: '#DBEAFE' },
  lineup_locked: { label: 'Lineups Locked', color: PURPLE, bg: '#EDE9FE' },
  in_progress: { label: 'In Progress', color: ORANGE, bg: '#FFF7ED' },
  completed: { label: 'Completed', color: GREEN, bg: '#D1FAE5' },
  postponed: { label: 'Postponed', color: RED, bg: '#FEE2E2' },
};

const SHEET_STATUS_LABEL: Record<TieSheetStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: TEXT_MUTED },
  submitted: { label: 'Submitted', color: BLUE },
  approved: { label: 'Approved', color: GREEN },
  rejected: { label: 'Rejected', color: RED },
  locked: { label: 'Locked', color: PURPLE },
};

// ═════════════════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════════════════

const TieDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { tieId } = route.params as { tieId: string };

  const store = useLeagueStore();
  const authUser = useAuthStore((s) => s.user);
  const [league, setLeague] = useState(store.currentLeague);
  // Season bonus bands for the live overlay (SBPL narrows the close-loss band).
  // Null → the util uses SPPL defaults, so other leagues are unaffected.
  const [bonusRules, setBonusRules] = useState<SeasonBonusRules | null>(null);
  // Season format — drives the two-court UI (sbpl_15game ties play on 2 courts).
  const [seasonFormat, setSeasonFormat] = useState<string | null>(null);
  const isOwner = !!authUser?.id && league?.organizerId === authUser.id;
  // Owner OR co-admin (league_admins) — resolved via the shared hook so
  // backend-granted admins get score/management access, not just the organizer.
  const isAdmin = useLeagueAdminAccess(league?.id, authUser?.id, isOwner);
  const [isScorer, setIsScorer] = useState(false);
  const [scorersList, setScorersList] = useState<Array<{ id: string; userId: string; name: string; phone: string }>>([]);
  const [tie, setTie] = useState<Tie | null>(null);
  // Scorers can only score the ties they're assigned to. SPPL uses a single
  // scorerId; SBPL two-court ties assign via scorer1Id / scorer2Id (either may
  // score any game) — so match against all three. Admin/organizer can always score.
  const isAssignedScorer =
    !!authUser?.id &&
    isScorer &&
    [tie?.scorerId, (tie as any)?.scorer1Id, (tie as any)?.scorer2Id].includes(authUser.id);
  const canScore = isAdmin || isAssignedScorer;

  // Court-lock for two-court ties: a scorer assigned to Court 1 (scorer1Id →
  // courtNumber) may only score that court's games; likewise Court 2. If the
  // same person holds both slots, or it's a single-scorer tie, no lock applies.
  const myScorerCourts = React.useMemo(() => {
    const t = tie as any;
    const s = new Set<number>();
    if (!authUser?.id || !t) return s;
    if (t.scorer1Id === authUser.id && t.courtNumber != null) s.add(t.courtNumber);
    if (t.scorer2Id === authUser.id && t.courtNumber2 != null) s.add(t.courtNumber2);
    return s;
  }, [authUser?.id, tie]);

  // May the logged-in user score THIS game? Admin: always. Assigned scorer:
  // only games on their court (the Rally Point Game and court-less games are
  // unrestricted). Single-scorer ties (no court lock) are unaffected.
  const canScoreMatch = (tm: TieMatch): boolean => {
    if (isAdmin) return true;
    if (!isAssignedScorer) return false;
    if (myScorerCourts.size === 0) return true;
    const isRally = (tm as any).isRallyPointGame === true || tm.slotNumber === 0;
    if (isRally) return true;
    const c = tm.courtNumber ?? courtForSlot(tie as any, tm.slotNumber);
    if (c == null) return true;
    return myScorerCourts.has(c);
  };

  // Lineup is "revealed" once admin locks both teams' picks. Until then,
  // anyone who isn't the admin (scorers, captains-of-other-teams browsing
  // in-app, viewers) sees only the match structure — slot, category, point
  // value, score — never the player names.
  //
  // Status ladder: scheduled → lineup_submitted → lineup_locked → in_progress → completed
  // The reveal moment is `lineup_locked` and beyond.
  const lineupRevealed = !!tie && (
    tie.status === 'lineup_locked' ||
    tie.status === 'in_progress' ||
    tie.status === 'completed'
  );
  /** Should the current viewer see player names anywhere on this screen? */
  const canSeeLineups = isAdmin || lineupRevealed;
  const [tieSheets, setTieSheets] = useState<TieSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Score entry modal state
  const [scoreModal, setScoreModal] = useState<{
    visible: boolean;
    tieMatch: TieMatch | null;
  }>({ visible: false, tieMatch: null });
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [scoreSubmitting, setScoreSubmitting] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  // Per-game court override modal
  const [courtModal, setCourtModal] = useState<{ visible: boolean; tieMatch: TieMatch | null }>({
    visible: false,
    tieMatch: null,
  });
  const [courtSaving, setCourtSaving] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Player name map (playerId → name)
  const [playerMap, setPlayerMap] = useState<Record<string, string>>({});
  // One lineup position → display name. A real player shows their name (with
  // " (sub)" if they were substituted in); an empty placeholder shows the word
  // "Substitute" so a not-yet-filled slot reads clearly instead of blank/TBD.
  const posName = (pid?: string | null, isSub?: any): string =>
    pid ? `${playerMap[pid] || 'Player'}${isSub ? ' (sub)' : ''}` : 'Substitute';
  const pairName = (p1?: string | null, p1s?: any, p2?: string | null, p2s?: any): string =>
    `${posName(p1, p1s)} & ${posName(p2, p2s)}`;
  // JSX variant that highlights "Substitute" / "(sub)" in orange.
  const SUB_ORANGE = { color: '#EA580C', fontWeight: '800' as const };
  const posNameJSX = (pid?: string | null, isSub?: any) =>
    pid
      ? (<>{playerMap[pid] || 'Player'}{isSub ? <Text style={SUB_ORANGE}> (sub)</Text> : null}</>)
      : (<Text style={SUB_ORANGE}>Substitute</Text>);
  const pairNameJSX = (p1?: string | null, p1s?: any, p2?: string | null, p2s?: any) =>
    (<>{posNameJSX(p1, p1s)} & {posNameJSX(p2, p2s)}</>);
  const [showLineups, setShowLineups] = useState(false);

  // Full rosters per team for the substitute modal — { home: [...], away: [...] }
  // Each item is FranchiseRoster (has playerId, categorySlug, player.fullName, etc.)
  // Loaded alongside playerMap during fetchData.
  const [teamRosters, setTeamRosters] = useState<{
    home: FranchiseRoster[];
    away: FranchiseRoster[];
  }>({ home: [], away: [] });

  // Substitute modal — replaces one player on either team across every
  // still-scheduled match in the current tie. Visible to admin or assigned scorer.
  const [substituteModal, setSubstituteModal] = useState<{
    visible: boolean;
    team: 'home' | 'away';
    oldPlayerId: string | null;
    newPlayerId: string | null;
  }>({ visible: false, team: 'home', oldPlayerId: null, newPlayerId: null });
  // Within the substitute modal: which empty slot is being filled. When set,
  // the modal shows the full-team picker (any category) instead of the grid.
  const [fillTarget, setFillTarget] = useState<{ slotNumber: number; position: 'player1' | 'player2'; label: string } | null>(null);
  const [substituteSubmitting, setSubstituteSubmitting] = useState(false);

  // Admin slot-swap modal — pencil icon next to a player in the lineup
  // table opens this. Replaces ONE player in ONE slot on ONE side. Admin
  // only.
  const [slotSwapModal, setSlotSwapModal] = useState<{
    visible: boolean;
    team: 'home' | 'away';
    slotNumber: number;
    position: 'player1' | 'player2';
    currentPlayerId: string | null;
    currentPlayerName: string;
    slotLabel: string;
  }>({
    visible: false,
    team: 'home',
    slotNumber: 0,
    position: 'player1',
    currentPlayerId: null,
    currentPlayerName: '',
    slotLabel: '',
  });
  const [slotSwapSubmitting, setSlotSwapSubmitting] = useState(false);

  // Admin lineup submission state
  const [lineupModal, setLineupModal] = useState<{
    visible: boolean;
    franchiseId: string; // which team we're submitting for
    franchiseName: string;
  }>({ visible: false, franchiseId: '', franchiseName: '' });
  const [rosterPlayers, setRosterPlayers] = useState<FranchiseRoster[]>([]);
  const [lineupSlots, setLineupSlots] = useState<Record<number, { player1Id: string; player2Id: string }>>({});
  const [lineupSubmitting, setLineupSubmitting] = useState(false);

  // Start-tie court confirmation modal
  const [startCourtModal, setStartCourtModal] = useState<{ visible: boolean; courtNumber: number | null }>({
    visible: false,
    courtNumber: null,
  });

  // Open-captain-portal modal (admin re-opens the portal for N minutes)
  const [openPortalModal, setOpenPortalModal] = useState(false);
  const [openPortalMins, setOpenPortalMins] = useState('');
  const [openPortalBusy, setOpenPortalBusy] = useState(false);
  // Kids submission modal (set an absolute deadline, or open for N minutes)
  const [kidsModal, setKidsModal] = useState(false);
  const [kidsMins, setKidsMins] = useState('');
  const [kidsWhen, setKidsWhen] = useState(''); // absolute datetime text, e.g. 2026-07-31 18:00
  const [kidsBusy, setKidsBusy] = useState(false);

  // Score modal +/- counters (replace old text inputs)
  const [scoreVals, setScoreVals] = useState<{ a: number; b: number }>({ a: 0, b: 0 });
  // Serve tracking (SBPL): config (first server/positions) + the rally-winner
  // sequence fed from the +/- taps. Whose-serve is derived by folding these.
  const [serveConfig, setServeConfig] = useState<ServeConfig | null>(null);
  const [serveEvents, setServeEvents] = useState<ServeEvent[]>([]);
  const [serveSetupServer, setServeSetupServer] = useState<string | null>(null);
  // Total points already on the board when serve was declared. Serve is set up
  // AT the current score (often mid-match), so sync is measured by points since
  // setup — not against the absolute score (which would strand it "out of sync").
  const [serveBaseTotal, setServeBaseTotal] = useState(0);
  const [livePushStatus, setLivePushStatus] = useState<'idle' | 'syncing' | 'live' | 'error'>('idle');

  // Persist serve state to the backend so the OBS overlays show server/receiver.
  // The app owns the serve state; push the full snapshot (config + events) on
  // change, debounced. Only while a serve is actively declared (config set).
  useEffect(() => {
    const tm = scoreModal.tieMatch;
    if (!tm || seasonFormat !== 'sbpl_15game' || !serveConfig) return;
    const t = setTimeout(() => {
      adminSyncServe(tieId, tm.matchId, serveConfig, serveEvents).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [serveConfig, serveEvents, scoreModal.tieMatch, seasonFormat, tieId]);
  const [winnerPickerVisible, setWinnerPickerVisible] = useState(false);
  // When true, the winner-confirm panel flips its presumed winner to the
  // OTHER team. Lets the scorer correct a mistaken score side without
  // exposing the losing team as a prominent button. Resets each time the
  // panel opens.
  const [swapWinner, setSwapWinner] = useState(false);

  // ── Data fetching ──
  const fetchData = useCallback(async () => {
    try {
      const [tieData, sheetsData] = await Promise.all([
        getTie(tieId),
        getTieSheets(tieId).catch(() => [] as TieSheet[]),
      ]);
      setTie(tieData);
      setTieSheets(Array.isArray(sheetsData) ? sheetsData : []);
      store.setCurrentTie(tieData);

      // Resolve league so admin-only UI renders on direct navigation.
      // Prefer route param, then the tie's own leagueId (new field), then the store.
      const routeLeagueId = (route.params as any)?.leagueId;
      const tieLeagueId = (tieData as any)?.leagueId;
      const effectiveLeagueId = routeLeagueId || tieLeagueId || store.currentLeague?.id || null;
      if (effectiveLeagueId && (!league || league.id !== effectiveLeagueId)) {
        try {
          const leagueData = await getLeague(effectiveLeagueId).catch(() => null);
          if (leagueData) {
            setLeague(leagueData as any);
            store.setCurrentLeague(leagueData as any);
          }
        } catch {}
      }

      // Resolve this season's bonus bands for the live overlay (SBPL differs
      // from SPPL). Best-effort — on failure the util falls back to SPPL.
      if (effectiveLeagueId && tieData?.seasonId) {
        try {
          const seasons = await getSeasons(effectiveLeagueId).catch(() => []);
          const arr = Array.isArray(seasons) ? seasons : [];
          const season = arr.find((s: any) => s.id === tieData.seasonId);
          setBonusRules(((season as any)?.bonusRules ?? null) as SeasonBonusRules | null);
          setSeasonFormat(((season as any)?.format ?? null) as string | null);
        } catch {}
      }

      // Detect scorer role for this league + cache list for admin assignment UI
      if (effectiveLeagueId && authUser?.id) {
        try {
          const scorers = await listScorers(effectiveLeagueId).catch(() => []);
          const arr = Array.isArray(scorers) ? scorers : [];
          setIsScorer(arr.some((s: any) => s.userId === authUser.id));
          setScorersList(arr);
        } catch {}
      }

      // Build player name map from rosters of both franchises. Stash the
      // raw rosters too so the Substitute modal has them on hand without a
      // second fetch.
      if (tieData?.homeTeamId && tieData?.awayTeamId) {
        try {
          const seasonId = tieData.seasonId;
          const [homeRoster, awayRoster] = await Promise.all([
            getRoster(tieData.homeTeamId, seasonId).catch(() => []),
            getRoster(tieData.awayTeamId, seasonId).catch(() => []),
          ]);
          const homeArr = Array.isArray(homeRoster) ? homeRoster : [];
          const awayArr = Array.isArray(awayRoster) ? awayRoster : [];
          setTeamRosters({ home: homeArr as any, away: awayArr as any });
          const pMap: Record<string, string> = {};
          [...homeArr, ...awayArr].forEach((r: any) => {
            const name = r.player?.fullName || r.player?.displayName || r.name;
            if (r.playerId && name) pMap[r.playerId] = name;
          });
          setPlayerMap(pMap);
        } catch {}
      }
    } catch (err: any) {
      xAlert('Error', err?.message || 'Failed to load tie details');
    }
  }, [tieId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData().finally(() => setLoading(false));

      // Poll every 30 seconds while screen is focused
      const interval = setInterval(() => {
        fetchData();
      }, 30000);

      return () => clearInterval(interval);
    }, [fetchData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // ── Actions ──
  const handleLockLineups = () => {
    xConfirm('Lock Lineups', 'Lock both team lineups? This cannot be undone.', async () => {
      setActionLoading(true);
      try {
        await lockLineups(tieId);
        xAlert('Success', 'Lineups locked successfully.');
        await fetchData();
      } catch (err: any) {
        xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to lock lineups');
      } finally {
        setActionLoading(false);
      }
    });
  };

  // SBPL kids-first: lock only the kids games ahead of the rest of the tie.
  const kidsLocked = Array.isArray((tie as any)?.lockedCategories)
    && (tie as any).lockedCategories.includes('kids');
  const handleLockKids = () => {
    xConfirm(
      'Lock Kids Games',
      'Lock only the Kids pairs and reveal them? The rest of the tie stays open for teams to submit later.',
      async () => {
        setActionLoading(true);
        try {
          await lockCategory(tieId, 'kids');
          xAlert('Kids Locked', 'Kids pairs are locked and revealed. Scorers can now play them.');
          await fetchData();
        } catch (err: any) {
          xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to lock kids games');
        } finally {
          setActionLoading(false);
        }
      },
    );
  };
  const handleUnlockKids = () => {
    xConfirm(
      'Unlock Kids Games',
      'Unlock the Kids pairs? Only allowed if no kids game has started yet.',
      async () => {
        setActionLoading(true);
        try {
          await unlockCategory(tieId, 'kids');
          xAlert('Kids Unlocked', 'Kids pairs are open for editing again.');
          await fetchData();
        } catch (err: any) {
          xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to unlock kids games');
        } finally {
          setActionLoading(false);
        }
      },
    );
  };

  // Set the Kids submission window — either a fixed date/time (e.g. 6pm 31 Jul)
  // or "open for N minutes from now". Past it, kids auto-fill from defaults.
  const handleSetKidsDeadline = async (opts: { minutes?: number; deadline?: string }) => {
    setKidsBusy(true);
    try {
      const data = await setKidsDeadline(tieId, opts);
      setKidsModal(false);
      setKidsMins('');
      setKidsWhen('');
      await fetchData();
      const dl = data?.kidsDeadline ? new Date(data.kidsDeadline) : null;
      xAlert(
        'Kids Submission Open',
        dl ? `Captains can submit Kids pairs until ${dl.toLocaleString('en-IN')}.` : 'Kids deadline cleared.',
      );
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to set kids deadline');
    } finally {
      setKidsBusy(false);
    }
  };
  const submitKidsWhen = () => {
    // Accept "YYYY-MM-DD HH:mm" (local) → ISO.
    const raw = kidsWhen.trim();
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
    if (!m) {
      xAlert('Invalid', 'Enter date & time as YYYY-MM-DD HH:MM (e.g. 2026-07-31 18:00).');
      return;
    }
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
    handleSetKidsDeadline({ deadline: dt.toISOString() });
  };

  const handleOpenCaptainPortal = async (minutes: number) => {
    if (!Number.isFinite(minutes) || minutes < 1) {
      xAlert('Invalid', 'Enter a number of minutes (1 or more).');
      return;
    }
    setOpenPortalBusy(true);
    try {
      await openCaptainPortal(tieId, Math.round(minutes));
      setOpenPortalModal(false);
      setOpenPortalMins('');
      await fetchData();
      xAlert(
        'Portal Opened',
        `Captains can now submit or edit their lineup for the next ${Math.round(minutes)} minutes.`,
      );
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to open captain portal');
    } finally {
      setOpenPortalBusy(false);
    }
  };

  const handleStartTie = async () => {
    // OBS overlay isn't used for this league, so skip the court-confirmation
    // step and start the tie directly.
    setActionLoading(true);
    try {
      await startTie(tieId);
      await fetchData();
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to start tie');
    } finally {
      setActionLoading(false);
    }
  };

  /** Called when the user confirms a court from the start-tie modal. */
  const confirmStartTie = async () => {
    const courtNumber = startCourtModal.courtNumber;
    setActionLoading(true);
    try {
      // 1. Persist court assignment (if they picked one or changed it)
      if (courtNumber !== ((tie as any)?.courtNumber ?? null)) {
        await bulkUpdateTies('', [{ tieId, courtNumber }]);
      }
      // 2. Actually start the tie
      await startTie(tieId);
      setStartCourtModal({ visible: false, courtNumber: null });
      xAlert('Tie Started', courtNumber ? `Live on Court ${courtNumber}. Scoreboard is now active on that overlay.` : 'Tie started. No court assigned — assign one in Dashboard → Court Assignments if you need the OBS overlay.');
      await fetchData();
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to start tie');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteTie = () => {
    xConfirm(
      'Complete Tie',
      'Finalize this tie? Standings will be recalculated.',
      async () => {
        setActionLoading(true);
        try {
          await completeTie(tieId);
          xAlert('Success', 'Tie completed! Standings updated.');
          await fetchData();
        } catch (err: any) {
          xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to complete tie');
        } finally {
          setActionLoading(false);
        }
      },
    );
  };

  // ── Score entry ──
  // Two-step flow:
  //   1. Admin taps +/- to increment scores. Each tap debounces a live push
  //      to the server so the OBS overlay stays in sync.
  //   2. Admin taps SAVE SCORE → validates target reached → opens a winner
  //      picker. Admin taps the winning team → match is finalised with that
  //      winnerId. Manual winner confirmation prevents golden-point typos.
  const openScoreEntry = (tm: TieMatch) => {
    const existing = tm.match?.scores?.[0];
    const a = existing?.teamAScore ?? 0;
    const b = existing?.teamBScore ?? 0;
    setScoreA(String(a));
    setScoreB(String(b));
    setScoreVals({ a, b });
    setLivePushStatus('idle');
    setWinnerPickerVisible(false);
    setServeConfig(null);
    setServeEvents([]);
    setServeSetupServer(null);
    setServeBaseTotal(0);
    setScoreModal({ visible: true, tieMatch: tm });
  };

  // ── Per-game court override ──
  // Each game defaults to its rulebook court (slots 1–7 → court 1, 8–15 →
  // court 2); admin can move an individual game to another court here.
  const handleSetMatchCourt = async (courtNumber: number | null) => {
    const tm = courtModal.tieMatch;
    if (!tm) return;
    setCourtSaving(true);
    try {
      await adminSetMatchCourt(tieId, tm.matchId, courtNumber);
      // Reflect locally so the badge updates without a full refetch.
      setTie((prev) =>
        prev
          ? {
              ...prev,
              tieMatches: (prev.tieMatches || []).map((x) =>
                x.matchId === tm.matchId ? { ...x, courtNumber } : x,
              ),
            }
          : prev,
      );
      setCourtModal({ visible: false, tieMatch: null });
    } catch (e: any) {
      xAlert('Could not change court', e?.response?.data?.message || e?.message || 'Please try again.');
    } finally {
      setCourtSaving(false);
    }
  };

  /** Target points (14 / 15 / 21) derived from the match's scoringMode. */
  const getTargetPoints = (tm: TieMatch | null): number => {
    if (!tm?.match) return tie?.pointsToWin || 15;
    const mode = (tm.match as any).scoringMode;
    if (mode === 'rally_point_game') return 14;
    if (mode === 'rally_21') return 21;
    if (mode === 'rally_15') return 15;
    return tie?.pointsToWin || 15;
  };

  /** Ref-like mutable for debounced live pushes so rapid taps coalesce. */
  const livePushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePush = (tm: TieMatch, a: number, b: number) => {
    if (livePushTimer.current) clearTimeout(livePushTimer.current);
    setLivePushStatus('syncing');
    livePushTimer.current = setTimeout(async () => {
      try {
        await adminLiveScore(tieId, tm.matchId, a, b);
        setLivePushStatus('live');
      } catch {
        setLivePushStatus('error');
      }
    }, 400);
  };

  /** +/- tap handler. Caps at the target for that match. */
  const adjScore = (side: 'a' | 'b', delta: number) => {
    const tm = scoreModal.tieMatch;
    if (!tm) return;
    const cap = getTargetPoints(tm);
    const before = side === 'a' ? scoreVals.a : scoreVals.b;
    const after = Math.max(0, Math.min(cap, before + delta));
    if (after === before) return; // no change at floor/cap
    const next = side === 'a' ? { ...scoreVals, a: after } : { ...scoreVals, b: after };
    setScoreVals(next);
    schedulePush(tm, next.a, next.b);
    // Feed the serve reducer: +1 = a rally win for that side; -1 = undo the
    // last rally if it was that side's (out-of-order edits leave the log,
    // which the "out of sync" guard surfaces in the panel).
    const winner: Side = side === 'a' ? 'home' : 'away';
    if (delta > 0) {
      setServeEvents((ev) => ev.concat({ type: 'rally', winner }));
    } else {
      setServeEvents((ev) => {
        const last = ev[ev.length - 1];
        return last && last.type === 'rally' && last.winner === winner ? ev.slice(0, -1) : ev;
      });
    }
  };

  // Build a ServeConfig from the chosen first server + receiver. The server's
  // partner takes the Left court; the receiver + partner mirror on the other side.
  const buildServeConfig = (tm: TieMatch, serverId: string, receiverId: string): ServeConfig => {
    const home = [(tm as any).homePlayer1Id, (tm as any).homePlayer2Id] as string[];
    const away = [(tm as any).awayPlayer1Id, (tm as any).awayPlayer2Id] as string[];
    const serverSide: Side = home.includes(serverId) ? 'home' : 'away';
    const serverPair = serverSide === 'home' ? home : away;
    const recvPair = serverSide === 'home' ? away : home;
    const serverPartner = serverPair.find((id) => id !== serverId) || serverId;
    const recvPartner = recvPair.find((id) => id !== receiverId) || receiverId;
    const serving = { R: serverId, L: serverPartner };
    const receiving = { R: receiverId, L: recvPartner };
    const positions: Positions =
      serverSide === 'home' ? { home: serving, away: receiving } : { home: receiving, away: serving };
    return { firstServingSide: serverSide, positions };
  };

  // Serve indicator inside the score modal (SBPL games only). Setup (first
  // server + receiver) → then whose-serve derived from the +/- rally taps.
  const renderServePanel = (tm: TieMatch) => {
    if (seasonFormat !== 'sbpl_15game') return null;
    const h1 = (tm as any).homePlayer1Id, h2 = (tm as any).homePlayer2Id;
    const a1 = (tm as any).awayPlayer1Id, a2 = (tm as any).awayPlayer2Id;
    const ids = [h1, h2, a1, a2];
    const nameOf = (id?: string | null) => (id ? playerMap[id] || 'Player' : '—');
    const box = { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' };
    const chip = (id: string) => (
      <TouchableOpacity
        key={id}
        onPress={() =>
          serveSetupServer
            ? (setServeConfig(buildServeConfig(tm, serveSetupServer, id)),
              setServeEvents([]),
              // Serve declared at the current score → track points from here.
              setServeBaseTotal(scoreVals.a + scoreVals.b))
            : setServeSetupServer(id)
        }
        style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE', margin: 3 }}
      >
        <Text style={{ fontSize: 12, fontWeight: '800', color: NAVY }}>{nameOf(id)}</Text>
      </TouchableOpacity>
    );

    if (ids.some((x) => !x)) {
      return (
        <View style={box}>
          <Text style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic' }}>Submit lineups to track serve.</Text>
        </View>
      );
    }
    if (serveConfig) {
      const st = foldServe(serveConfig, serveEvents);
      // In sync when the rallies logged since setup match the points scored since
      // setup. Serve is declared at serveBaseTotal, not necessarily 0-0.
      const inSync = serveEvents.length === scoreVals.a + scoreVals.b - serveBaseTotal;
      // Fixed 4-name display; only the 🏸 (server) and 🎯 (receiver) icons move.
      const playerLine = (id?: string | null) => {
        const isServer = inSync && st.serverId === id;
        const isReceiver = inSync && st.receiverId === id;
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}>
            <View style={{ width: 22, alignItems: 'center' }}>
              {isServer ? <ShuttleIcon size={16} color="#0369A1" /> : isReceiver ? <TargetIcon size={16} color="#B45309" /> : null}
            </View>
            <Text
              numberOfLines={1}
              style={{
                flex: 1, fontSize: 13,
                fontWeight: isServer ? '900' : isReceiver ? '800' : '600',
                color: isServer ? '#0369A1' : isReceiver ? '#B45309' : NAVY,
              }}
            >
              {nameOf(id)}
            </Text>
          </View>
        );
      };
      return (
        <View style={box}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: BLUE, letterSpacing: 1, marginBottom: 2 }} numberOfLines={1}>
                {homeName.toUpperCase()}
              </Text>
              {playerLine(h1)}
              {playerLine(h2)}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: RED, letterSpacing: 1, marginBottom: 2 }} numberOfLines={1}>
                {awayName.toUpperCase()}
              </Text>
              {playerLine(a1)}
              {playerLine(a2)}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <ShuttleIcon size={12} color="#64748B" />
            <Text style={{ fontSize: 10, color: '#64748B' }}> Server   </Text>
            <TargetIcon size={12} color="#64748B" />
            <Text style={{ fontSize: 10, color: '#64748B' }}> Receiver</Text>
            {!inSync && (
              <Text style={{ fontSize: 10, color: ORANGE, fontWeight: '700', marginLeft: 8 }}>· out of sync</Text>
            )}
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => {
              setServeConfig(null); setServeSetupServer(null);
              // Clear serve on the backend too so OBS stops showing server/receiver.
              adminSyncServe(tieId, tm.matchId, null, []).catch(() => {});
            }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: BLUE }}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    // Setup
    const serverSide = !serveSetupServer ? null : [h1, h2].includes(serveSetupServer) ? 'home' : 'away';
    const setupIds = !serveSetupServer ? ids : serverSide === 'home' ? [a1, a2] : [h1, h2];
    return (
      <View style={box}>
        <Text style={{ fontSize: 11, fontWeight: '800', color: NAVY, marginBottom: 6 }}>
          {serveSetupServer ? `Server: ${nameOf(serveSetupServer)} — WHO RECEIVES?` : 'WHO SERVES FIRST?'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{setupIds.map((id) => chip(id))}</View>
      </View>
    );
  };

  /** SAVE SCORE → validate target → open winner picker. */
  const handleSaveScore = () => {
    const tm = scoreModal.tieMatch;
    if (!tm?.matchId) return;
    const { a, b } = scoreVals;
    const target = getTargetPoints(tm);

    if (a === b) {
      xAlert('Cannot save tied score', 'Use DECLARE WINNER for forfeits / decisions.');
      return;
    }
    if (Math.max(a, b) !== target) {
      xAlert(`Score must reach ${target}`, `Winning team needs exactly ${target}. Current: ${a}-${b}.`);
      return;
    }
    if (Math.min(a, b) < 0 || Math.min(a, b) > target - 1) {
      xAlert('Invalid losing score', `Losing score must be 0-${target - 1}.`);
      return;
    }
    // All good — ask which team won. Reset swap so we always start with the
    // score-implied winner highlighted.
    setSwapWinner(false);
    setWinnerPickerVisible(true);
  };

  /** User picked a winner in the confirmation panel. */
  const confirmWinner = async (side: 'home' | 'away') => {
    const tm = scoreModal.tieMatch;
    if (!tm?.matchId || !tie) return;
    const winnerId = side === 'home' ? tie.homeTeamId : tie.awayTeamId;
    if (!winnerId) {
      xAlert('Error', 'Could not determine winning team.');
      return;
    }
    setScoreSubmitting(true);
    try {
      await adminFinalizeMatch(tieId, tm.matchId, scoreVals.a, scoreVals.b, winnerId);
      setWinnerPickerVisible(false);
      setScoreModal({ visible: false, tieMatch: null });
      await fetchData();
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to save score');
    } finally {
      setScoreSubmitting(false);
    }
  };

  /** Declare winner at current score (forfeit / injury / decision). */
  const handleDeclareWinner = async (side: 'home' | 'away') => {
    const tm = scoreModal.tieMatch;
    if (!tm?.matchId || !tie) return;
    const winnerName = side === 'home' ? homeName : awayName;
    xConfirm(
      `Declare ${winnerName} as winner?`,
      `Match will end at current score ${scoreVals.a}-${scoreVals.b}. Use for forfeit, injury, or umpire decision.`,
      async () => {
        const winnerId = side === 'home' ? tie.homeTeamId : tie.awayTeamId;
        if (!winnerId) return;
        setScoreSubmitting(true);
        try {
          await adminDeclareWinner(tieId, tm.matchId, winnerId, scoreVals.a, scoreVals.b);
          setScoreModal({ visible: false, tieMatch: null });
          await fetchData();
        } catch (err: any) {
          xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to declare winner');
        } finally {
          setScoreSubmitting(false);
        }
      },
    );
  };

  // ── Admin lineup submission ──
  const openLineupModal = async (franchiseId: string, franchiseName: string) => {
    if (!tie) return;
    setLineupModal({ visible: true, franchiseId, franchiseName });
    setLineupSlots({});
    try {
      const roster = await getRoster(franchiseId, tie.seasonId);
      setRosterPlayers(Array.isArray(roster) ? roster : []);
    } catch {
      setRosterPlayers([]);
    }
  };

  const handleAdminSubmitLineup = async () => {
    if (!tie) return;
    const lineupData = tieSlots.map((slot) => {
      const picks = lineupSlots[slot.slotNumber];
      return {
        slotNumber: slot.slotNumber,
        categorySlug: slot.categorySlug,
        player1Id: picks?.player1Id || '',
        player2Id: picks?.player2Id || '',
      };
    });
    // Validate all slots filled
    const empty = lineupData.filter((s) => !s.player1Id || !s.player2Id);
    if (empty.length > 0) {
      xAlert('Incomplete', `${empty.length} slot(s) still need both players selected.`);
      return;
    }
    // Validate Player 1 ≠ Player 2 within the same slot
    const dupes = lineupData.filter((s) => s.player1Id && s.player1Id === s.player2Id);
    if (dupes.length > 0) {
      xAlert(
        'Duplicate Player',
        `Slot ${dupes.map((s) => `#${s.slotNumber}`).join(', ')} has the same player listed as both Player 1 and Player 2. Please pick two different players.`,
      );
      return;
    }
    setLineupSubmitting(true);
    try {
      await submitTieSheet(tieId, { franchiseId: lineupModal.franchiseId, lineupData });
      xAlert('Success', `Lineup submitted for ${lineupModal.franchiseName}`);
      setLineupModal({ visible: false, franchiseId: '', franchiseName: '' });
      await fetchData();
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to submit lineup');
    } finally {
      setLineupSubmitting(false);
    }
  };

  // ── Helpers ──
  const homeName = tie?.homeTeam?.name || tie?.homeTeam?.shortName || 'Home';
  const awayName = tie?.awayTeam?.name || tie?.awayTeam?.shortName || 'Away';

  const homeSheet = tieSheets.find((s) => s.franchiseId === tie?.homeTeamId);
  const awaySheet = tieSheets.find((s) => s.franchiseId === tie?.awayTeamId);

  // Tie sheet downloader — opens the print-friendly HTML page with both
  // teams' lineups pre-filled, ready for the admin to save as PDF or
  // print on A4 for on-court use. Requires both lineups to exist; the
  // caller already gates the button on lineup-submitted/locked status.
  const handleDownloadTieSheet = () => {
    if (!tie) return;
    /** Resolve a player ID → full name. Falls back to empty string when the
     * lineup hasn't been submitted yet, so the sheet renders an underscore
     * placeholder for the captain to fill in by hand. */
    const nameOf = (pid: string | undefined | null) =>
      (pid ? (playerMap[pid] || '') : '');
    // Slot 0 (Rally Point Game) only exists in Q1 / Eliminator / Q2 / Final
    // per SPPL §15.a. Skip it for league-phase ties and QFs so the printed
    // sheet doesn't show an empty rally row where it doesn't belong.
    const round = tie.round || '';
    const hasRallyGame =
      round === 'knockout_q1' ||
      round === 'knockout_eliminator' ||
      round === 'knockout_q2' ||
      round === 'knockout_final';
    const slotNumbers = hasRallyGame
      ? [0, ...tieSlots.map((s) => s.slotNumber)]
      : tieSlots.map((s) => s.slotNumber);
    // Per-game label source depends on the league. SPPL prints its compact
    // rulebook codes ("K & K"); SBPL (and any category-based format) labels
    // each game by its own category ("Kids", "Women 1-3", "Men A"). Detect
    // SBPL by the presence of a badminton-only category slug — the "kids"
    // slug overlaps with SPPL and slot numbers alone can't tell them apart.
    const SPPL_SLUGS = ['kids', 'teen', 'women1', 'women2', 'men1', 'men2', 'men3'];
    const catBySlot = new Map(tieSlots.map((s) => [s.slotNumber, s.categorySlug as string]));
    const isSbpl = tieSlots.some((s) => {
      const slug = s.categorySlug as string;
      return slug && slug !== 'open' && !SPPL_SLUGS.includes(slug);
    });
    const labelFor = (slotNum: number) => {
      if (slotNum === 0) return 'Rally Pt';
      const slug = catBySlot.get(slotNum);
      if (isSbpl) return (slug && CATEGORY_COLORS[slug]?.label) || `Game ${slotNum}`;
      return SPPL_TIE_SHEET_LABELS[slotNum] || `Game ${slotNum}`;
    };
    const nameSub = (pid: string | undefined | null, isSub: any) =>
      pid ? `${nameOf(pid)}${isSub ? ' (sub)' : ''}` : 'Substitute';
    const slots = slotNumbers.map((slotNum) => {
      const homeSlot: any = homeSheet?.lineupData?.find((s: any) => s.slotNumber === slotNum);
      const awaySlot: any = awaySheet?.lineupData?.find((s: any) => s.slotNumber === slotNum);
      return {
        slotNumber: slotNum,
        gameLabel: labelFor(slotNum),
        team1Player1: nameSub(homeSlot?.player1Id, homeSlot?.player1IsSub),
        team1Player2: nameSub(homeSlot?.player2Id, homeSlot?.player2IsSub),
        team2Player1: nameSub(awaySlot?.player1Id, awaySlot?.player1IsSub),
        team2Player2: nameSub(awaySlot?.player2Id, awaySlot?.player2IsSub),
      };
    });
    const ist = (d: Date) => d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const dateStr = tie.scheduledStart
      ? new Date(tie.scheduledStart).toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric',
        })
      : (tie.matchDay || '');
    const timeStr = tie.scheduledStart
      ? new Date(tie.scheduledStart).toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
        })
      : '';
    // Match-badge label: keep it simple — "LEAGUE" for round-robin ties,
    // "KNOCKOUT" for everything else (QFs, Q1/Q2, Eliminator, Final). The
    // detailed round + week is already implied by the tie's date/time on
    // the sheet, so a coarse label is enough here.
    const stage = (tie.round || '').startsWith('league_week_') ? 'LEAGUE' : 'KNOCKOUT';
    downloadTieSheet({
      leagueName: league?.name,
      matchNo: stage,
      date: dateStr,
      time: timeStr,
      court: (tie as any).courtNumber ?? null,
      team1Name: homeName,
      team2Name: awayName,
      slots,
    });
  };

  const allMatchesCompleted =
    tie?.tieMatches?.every((tm) => tm.match?.status === 'completed') || false;

  // Per-tie lineup slots, derived from the tie's actual games (data-driven) so
  // this screen works for any format: SPPL (13 categorized slots) or cross_5game
  // (5 generic "Game N" slots, any player eligible). Excludes the rally game (slot 0).
  const tieSlots = React.useMemo(() => {
    const tms = (tie?.tieMatches || [])
      .filter((tm) => !tm.isRallyPointGame && tm.slotNumber > 0)
      .slice()
      .sort((a, b) => a.slotNumber - b.slotNumber);
    const SPPL_SLUGS = ['kids', 'teen', 'women1', 'women2', 'men1', 'men2', 'men3'];
    return tms.map((tm) => {
      const slug = tm.categorySlug as string;
      const isOpen = !slug || slug === 'open';
      const sppl = SPPL_MATCH_SLOTS.find((s) => s.slotNumber === tm.slotNumber);
      // SPPL keeps its slot-number-based label + eligibility (unchanged).
      // SBPL (and any format with real category slugs) labels from the game's
      // own category via CATEGORY_COLORS; eligibility stays open for now
      // (group → auction sub-category mapping is a follow-up).
      const useSppl = !isOpen && !!sppl && SPPL_SLUGS.includes(slug);
      const label = isOpen
        ? `Game ${tm.slotNumber}`
        : useSppl
          ? sppl!.label
          : CATEGORY_COLORS[slug]?.label || `Game ${tm.slotNumber}`;
      return {
        slotNumber: tm.slotNumber,
        categorySlug: tm.categorySlug,
        allowedCategories: useSppl ? sppl!.allowedCategories : [],
        label,
        pointValue: tm.pointValue,
      };
    });
  }, [tie]);

  // ── Live score computation from individual matches (must be before early return) ──
  const liveScores = React.useMemo(() => {
    if (!tie) return { homeMP: 0, awayMP: 0, homeBonus: 0, awayBonus: 0, homeSP: 0, awaySP: 0, completed: 0, total: 0 };
    let homeMP = 0, awayMP = 0, homeBonus = 0, awayBonus = 0;
    const tieMatches = tie.tieMatches || [];
    for (const tm of tieMatches) {
      const m = tm.match;
      if (!m || m.status !== 'completed' || !m.scores?.length) continue;
      const s = m.scores[0];
      const winnerScore = Math.max(s.teamAScore, s.teamBScore);
      const loserScore = Math.min(s.teamAScore, s.teamBScore);
      // winnerId may be team-entity UUID (teamAId/teamBId) or franchise UUID (tie.homeTeamId/awayTeamId)
      const wId = m.winnerId;
      const homeWon = !!wId && (wId === m.teamAId || wId === tie.homeTeamId);

      // Match points go to winner
      if (homeWon) {
        homeMP += tm.pointValue;
      } else {
        awayMP += tm.pointValue;
      }

      // Rally Point Game: no bonus per SPPL rulebook § 15
      if ((tm as any).isRallyPointGame) continue;

      // Bonus via the shared util (honors season.bonusRules — SBPL narrows the
      // close-loss band; defaults to SPPL when bonusRules is absent).
      const sides = bonusToSides(
        computeMatchBonus(winnerScore, loserScore, (m as any).scoringMode, bonusRules),
        homeWon,
      );
      homeBonus += sides.home;
      awayBonus += sides.away;
    }
    return {
      homeMP, awayMP, homeBonus, awayBonus,
      homeSP: homeMP + homeBonus,
      awaySP: awayMP + awayBonus,
      completed: tieMatches.filter((tm: any) => tm.match?.status === 'completed').length,
      total: tieMatches.length,
    };
  }, [tie, bonusRules]);

  // ─── RENDERS ──────────────────────────────────────────────────────────────

  if (loading || !tie) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={styles.loadingText}>Loading tie details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const chipCfg = STATUS_CHIP[tie.status] || STATUS_CHIP.scheduled;

  const renderHeader = () => (
    <View style={styles.headerBanner}>
      <View style={styles.headerNav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{'<'}</Text>
        </TouchableOpacity>
        <YBadge color={chipCfg.color} bg={chipCfg.bg}>{chipCfg.label}</YBadge>
      </View>

      {/* Standing Points — hero */}
      <View style={{ alignItems: 'center', marginTop: 2, marginBottom: 12 }}>
        <YEyebrow size={10} color={YColors.ink2}>STANDING POINTS</YEyebrow>
        <YDisplay size={48} color={YColors.ink} style={{ marginTop: 4, lineHeight: 60 }}>{`${liveScores.homeSP} – ${liveScores.awaySP}`}</YDisplay>
        <YUiText size={11} weight={600} color={YColors.ink3} style={{ marginTop: 4 }}>{`${liveScores.completed} of ${liveScores.total} matches played`}</YUiText>
      </View>

      {/* Teams + breakdown */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12 }}>
        {/* Home */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: YColors.ink, fontSize: 14, fontWeight: '900', textAlign: 'center' }} numberOfLines={2}>{homeName}</Text>
          <Text style={{ color: YColors.ink3, fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginTop: 2 }}>HOME</Text>
          <View style={{ flexDirection: 'row', marginTop: 6, gap: 6 }}>
            <View style={{ backgroundColor: YColors.bg3, borderWidth: 1, borderColor: YColors.line2, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: YColors.ink }}>{liveScores.homeMP}</Text>
              <Text style={{ fontSize: 8, color: YColors.ink3 }}>match</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(6,214,160,0.18)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#0E8F66' }}>+{liveScores.homeBonus}</Text>
              <Text style={{ fontSize: 8, color: '#0E8F66', opacity: 0.7 }}>bonus</Text>
            </View>
          </View>
        </View>

        {/* VS divider */}
        <View style={{ width: 24, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 11, color: YColors.ink3, fontWeight: '800', letterSpacing: 1 }}>VS</Text>
        </View>

        {/* Away */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: YColors.ink, fontSize: 14, fontWeight: '900', textAlign: 'center' }} numberOfLines={2}>{awayName}</Text>
          <Text style={{ color: YColors.ink3, fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginTop: 2 }}>AWAY</Text>
          <View style={{ flexDirection: 'row', marginTop: 6, gap: 6 }}>
            <View style={{ backgroundColor: YColors.bg3, borderWidth: 1, borderColor: YColors.line2, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: YColors.ink }}>{liveScores.awayMP}</Text>
              <Text style={{ fontSize: 8, color: YColors.ink3 }}>match</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(6,214,160,0.18)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#0E8F66' }}>+{liveScores.awayBonus}</Text>
              <Text style={{ fontSize: 8, color: '#0E8F66', opacity: 0.7 }}>bonus</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Round + date */}
      <View style={styles.metaRow}>
        <View style={styles.roundBadge}>
          <Text style={styles.roundBadgeText}>{tie.round}</Text>
        </View>
        {tie.matchDay && (
          <Text style={styles.metaDate}>
            {new Date(tie.matchDay).toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        )}
      </View>
    </View>
  );

  /** Admin quick controls — swap court or scorer in one tap. */
  const renderTieControls = () => {
    if (!tie) return null;
    const currentCourt = (tie as any).courtNumber ?? null;
    const currentCourt2 = (tie as any).courtNumber2 ?? null;
    const currentScorerId = (tie as any).scorerId ?? null;
    const currentScorer1Id = (tie as any).scorer1Id ?? null;
    const currentScorer2Id = (tie as any).scorer2Id ?? null;
    // SBPL ties play across two courts with two scorers; other formats use one.
    const twoCourt = seasonFormat === 'sbpl_15game';

    const updateTie = async (patch: {
      courtNumber?: number | null;
      courtNumber2?: number | null;
      scorerId?: string | null;
    }) => {
      try {
        setActionLoading(true);
        await bulkUpdateTies('', [{ tieId, ...patch }]);
        await fetchData();
      } catch (err: any) {
        xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to update tie');
      } finally {
        setActionLoading(false);
      }
    };

    const COURTS = [1, 2, 3, 4];
    // One selectable court row bound to a field (courtNumber or courtNumber2).
    const courtRow = (
      label: string,
      current: number | null,
      field: 'courtNumber' | 'courtNumber2',
    ) => (
      <>
        <Text style={{ fontSize: 11, fontWeight: '800', color: NAVY, letterSpacing: 1, marginTop: 8, marginBottom: 6 }}>{label}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {COURTS.map((c) => {
            const selected = current === c;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => updateTie({ [field]: selected ? null : c } as any)}
                disabled={actionLoading}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: selected ? BLUE : '#F1F5F9',
                  borderWidth: 1,
                  borderColor: selected ? BLUE : '#E2E8F0',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: selected ? WHITE : NAVY }}>
                  Court {c}
                </Text>
              </TouchableOpacity>
            );
          })}
          {current !== null && (
            <TouchableOpacity
              onPress={() => updateTie({ [field]: null } as any)}
              disabled={actionLoading}
              style={{
                paddingHorizontal: 12, paddingVertical: 8,
                borderRadius: 8, backgroundColor: '#FEF2F2',
                borderWidth: 1, borderColor: '#FCA5A5',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: RED }}>Unassign</Text>
            </TouchableOpacity>
          )}
        </View>
      </>
    );

    // One selectable scorer row bound to a field (scorerId / scorer1Id / scorer2Id).
    const scorerRow = (
      label: string,
      current: string | null,
      field: 'scorerId' | 'scorer1Id' | 'scorer2Id',
    ) => (
      <>
        <Text style={{ fontSize: 11, fontWeight: '800', color: NAVY, letterSpacing: 1, marginTop: 14, marginBottom: 6 }}>{label}</Text>
        {scorersList.length === 0 ? (
          <Text style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic' }}>
            No scorers added yet. Add from League Dashboard → Scorers.
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {scorersList.map((s) => {
              const selected = current === s.userId;
              return (
                <TouchableOpacity
                  key={s.userId}
                  onPress={() => updateTie({ [field]: selected ? null : s.userId } as any)}
                  disabled={actionLoading}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
                    backgroundColor: selected ? '#06D6A0' : '#F1F5F9',
                    borderWidth: 1, borderColor: selected ? '#06D6A0' : '#E2E8F0',
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: selected ? WHITE : NAVY }}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {current && (
              <TouchableOpacity
                onPress={() => updateTie({ [field]: null } as any)}
                disabled={actionLoading}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5' }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: RED }}>Unassign</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </>
    );

    return (
      <View style={styles.tieSheetBar}>
        <Text style={styles.tieSheetTitle}>Tie Controls</Text>

        {/* Court-wise controls — SBPL ties run on two courts in parallel. Each
            court is grouped with its own scorer, and the scorer label follows
            the physical court number the admin picks (Court 1/2/3/4). Either
            scorer may still score any game; this just assigns who's on which court. */}
        {twoCourt ? (
          <>
            {courtRow('COURT 1', currentCourt, 'courtNumber')}
            {scorerRow(`SCORER · COURT ${currentCourt ?? 1}`, currentScorer1Id, 'scorer1Id')}
            <View style={{ height: 1, backgroundColor: '#E2E8F0', marginTop: 16 }} />
            {courtRow('COURT 2', currentCourt2, 'courtNumber2')}
            {scorerRow(`SCORER · COURT ${currentCourt2 ?? 2}`, currentScorer2Id, 'scorer2Id')}
          </>
        ) : (
          <>
            {courtRow('COURT', currentCourt, 'courtNumber')}
            {scorerRow('SCORER', currentScorerId, 'scorerId')}
          </>
        )}

        {/* Open the captain portal on demand — available on EVERY tie. Opening it
            can never change an already-played game (that's frozen per-game). */}
        {true && (
          <TouchableOpacity
            onPress={() => { setOpenPortalMins(''); setOpenPortalModal(true); }}
            activeOpacity={0.85}
            style={{
              marginTop: 12,
              backgroundColor: '#EFF6FF',
              borderWidth: 1,
              borderColor: '#1858D6',
              borderRadius: 10,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#1E40AF', letterSpacing: 0.3 }}>
              🔓  OPEN CAPTAIN'S PORTAL
            </Text>
            <Text style={{ fontSize: 11, color: '#3B82F6', marginTop: 2 }}>
              Give captains a fresh window to submit lineups
            </Text>
          </TouchableOpacity>
        )}

        {/* SBPL: open the Kids submission window (own deadline; past it kids
            auto-fill from defaults). */}
        {seasonFormat === 'sbpl_15game' && (
          <TouchableOpacity
            onPress={() => { setKidsMins(''); setKidsWhen(''); setKidsModal(true); }}
            activeOpacity={0.85}
            style={{
              marginTop: 10,
              backgroundColor: '#F5F3FF',
              borderWidth: 1,
              borderColor: '#7C3AED',
              borderRadius: 10,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#6D28D9', letterSpacing: 0.3 }}>
              🧒  OPEN KIDS SUBMISSION
            </Text>
            <Text style={{ fontSize: 11, color: '#7C3AED', marginTop: 2 }}>
              {(tie as any)?.kidsDeadline
                ? `Kids deadline: ${new Date((tie as any).kidsDeadline).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                : 'Set the Kids submission deadline'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ── Substitute Player panel ───────────────────────────────────────────
  // Shown to admin or the tie's assigned scorer. Lets them swap a player
  // on either team across all upcoming matches in this tie. Useful when a
  // rostered player is unavailable last-minute.
  const renderSubstitutePanel = () => {
    if (!tie) return null;
    return (
      <View style={styles.tieSheetBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tieSheetTitle}>Player Substitution</Text>
            <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
              Replace a player across upcoming matches in this tie. Already-played and live matches stay untouched.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setSubstituteModal({
              visible: true,
              team: 'home',
              oldPlayerId: null,
              newPlayerId: null,
            })}
            style={{
              backgroundColor: '#001E40',
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              marginLeft: 10,
            }}
            activeOpacity={0.7}
          >
            <Text style={{ color: WHITE, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 }}>
              🔁 SUBSTITUTE
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Returns the unique players currently in this tie's lineup on a given side.
  // Each entry includes the playerId, display name, and the categories the
  // player is scheduled in (so the modal can hint context, e.g. "in M1, RPG").
  const lineupPlayersForTeam = (team: 'home' | 'away'): Array<{
    playerId: string;
    name: string;
    categories: string[];
    // Set for empty (substitute) slots so the modal can fill THIS specific
    // game/position instead of the old merged "one placeholder" behaviour.
    sub?: { slotNumber: number; position: 'player1' | 'player2'; categorySlug: string };
  }> => {
    if (!tie) return [];
    const map = new Map<string, Set<string>>();
    // Each empty slot+position becomes its own entry, labelled by game, so a
    // captain who left multiple substitutes gets a clear, per-game fill list.
    const subs: Array<{ playerId: string; name: string; categories: string[]; sub: { slotNumber: number; position: 'player1' | 'player2'; categorySlug: string } }> = [];
    const catLabelOf = (slug: string) => CATEGORY_COLORS[slug]?.label || slug;
    for (const tm of tie.tieMatches || []) {
      if ((tm as any).isRallyPointGame || tm.slotNumber === 0) continue; // skip RPG
      const p1 = team === 'home' ? tm.homePlayer1Id : tm.awayPlayer1Id;
      const p2 = team === 'home' ? tm.homePlayer2Id : tm.awayPlayer2Id;
      const addNamed = (id: string | null | undefined) => {
        if (!id) return;
        if (!map.has(id)) map.set(id, new Set());
        map.get(id)!.add(tm.categorySlug);
      };
      addNamed(p1);
      addNamed(p2);
      const lbl = catLabelOf(tm.categorySlug);
      if (!p1) subs.push({ playerId: `__SUB__:${tm.slotNumber}:player1`, name: `Substitute — #${tm.slotNumber} ${lbl} · Player 1`, categories: [tm.categorySlug], sub: { slotNumber: tm.slotNumber, position: 'player1', categorySlug: tm.categorySlug } });
      if (!p2) subs.push({ playerId: `__SUB__:${tm.slotNumber}:player2`, name: `Substitute — #${tm.slotNumber} ${lbl} · Player 2`, categories: [tm.categorySlug], sub: { slotNumber: tm.slotNumber, position: 'player2', categorySlug: tm.categorySlug } });
    }
    const named = Array.from(map.entries()).map(([pid, cats]) => ({
      playerId: pid,
      name: playerMap[pid] || 'Player',
      categories: Array.from(cats),
    }));
    // Named players first (for injury swaps), then each empty slot to fill.
    return [...named, ...subs];
  };

  // Open the admin slot-swap modal for a specific (team, slot, position).
  // Surfaces same-category candidates from that team's roster (excluding
  // the player currently in the slot).
  const openSlotSwap = (
    team: 'home' | 'away',
    slotNumber: number,
    position: 'player1' | 'player2',
    currentPlayerId: string | null,
  ) => {
    if (!isAdmin) return;
    const slotCfg = tieSlots.find((s) => s.slotNumber === slotNumber);
    const slotLabel = slotCfg ? slotCfg.label : `Slot ${slotNumber}`;
    setSlotSwapModal({
      visible: true,
      team,
      slotNumber,
      position,
      currentPlayerId: currentPlayerId || null,
      currentPlayerName: currentPlayerId ? (playerMap[currentPlayerId] || 'Player') : '—',
      slotLabel,
    });
  };

  // Apply the slot swap. Backend handles tie_sheet always, tie_match if
  // locked + match not started; reports skipped state.
  const handleSlotSwap = async (newPlayerId: string) => {
    const { team, slotNumber, position, currentPlayerId } = slotSwapModal;
    if (!newPlayerId) return;
    if (newPlayerId === currentPlayerId) {
      xAlert('Same player', 'The replacement must be different from the current player.');
      return;
    }
    try {
      setSlotSwapSubmitting(true);
      const result = await adminSwapSlotPlayer(tieId, { team, slotNumber, position, newPlayerId });
      setSlotSwapModal((s) => ({ ...s, visible: false }));
      const parts: string[] = [];
      if (result.sheetUpdated) parts.push('tie sheet updated');
      if (result.matchUpdated) parts.push('match lineup updated');
      if (result.matchSkipped) parts.push(result.skipReason || 'match unchanged');
      xAlert('Swap applied', parts.join('\n') || 'Done');
      await fetchData();
    } catch (err: any) {
      xAlert('Could not swap', err?.response?.data?.message || err?.message || 'Failed');
    } finally {
      setSlotSwapSubmitting(false);
    }
  };

  // Handle the actual substitution API call.
  const handleSubstitute = async () => {
    const { team, oldPlayerId, newPlayerId } = substituteModal;
    if (!oldPlayerId || !newPlayerId) {
      xAlert('Pick both players', 'Choose the player to remove and the replacement.');
      return;
    }
    if (oldPlayerId === newPlayerId) {
      xAlert('Same player', 'The replacement must be different from the player being replaced.');
      return;
    }
    try {
      setSubstituteSubmitting(true);
      // Empty-slot fill: `__SUB__:<slot>:<position>` → fill THAT specific game.
      if (oldPlayerId.startsWith('__SUB__:')) {
        const [, slotStr, position] = oldPlayerId.split(':');
        await adminSwapSlotPlayer(tieId, {
          team,
          slotNumber: parseInt(slotStr, 10),
          position: position as 'player1' | 'player2',
          newPlayerId,
        });
        setSubstituteModal({ visible: false, team: 'home', oldPlayerId: null, newPlayerId: null });
        xAlert('Substitute filled', `${playerMap[newPlayerId] || 'Player'} added to game #${slotStr}.`);
        await fetchData();
        return;
      }
      const result = await substitutePlayer(tieId, { team, oldPlayerId, newPlayerId });
      setSubstituteModal({ visible: false, team: 'home', oldPlayerId: null, newPlayerId: null });
      xAlert(
        'Substitution applied',
        `Updated ${result.updatedMatches} ${result.updatedMatches === 1 ? 'match' : 'matches'}.`
        + (result.skippedMatches > 0
          ? `\n${result.skippedMatches} match${result.skippedMatches === 1 ? '' : 'es'} skipped (already started or didn't have that player).`
          : ''),
      );
      await fetchData();
    } catch (err: any) {
      xAlert('Could not substitute', err?.response?.data?.message || err?.message || 'Failed');
    } finally {
      setSubstituteSubmitting(false);
    }
  };

  // Fill the currently-targeted empty slot with any team player (any category).
  // The player is tagged as a substitute on the backend so their stats for
  // this game don't count toward their totals.
  const applyFill = async (newPlayerId: string) => {
    if (!fillTarget) return;
    const target = fillTarget;
    setSubstituteSubmitting(true);
    try {
      await adminSwapSlotPlayer(tieId, {
        team: substituteModal.team,
        slotNumber: target.slotNumber,
        position: target.position,
        newPlayerId,
      });
      setFillTarget(null);
      await fetchData();
      xAlert(
        'Substitute filled',
        `${playerMap[newPlayerId] || 'Player'} added to ${target.label} · ${target.position === 'player1' ? 'Player 1' : 'Player 2'} — tagged (sub); their stats for this game won't count.`,
      );
    } catch (err: any) {
      xAlert('Could not fill', err?.response?.data?.message || err?.message || 'Failed');
    } finally {
      setSubstituteSubmitting(false);
    }
  };

  const renderTieSheetStatus = () => (
    <View style={styles.tieSheetBar}>
      <Text style={styles.tieSheetTitle}>Lineup Status</Text>
      <View style={styles.tieSheetRow}>
        {/* Home */}
        <View style={styles.sheetStatus}>
          <Text style={styles.sheetTeam} numberOfLines={1}>
            {homeName}
          </Text>
          {homeSheet ? (
            <Text
              style={[
                styles.sheetBadge,
                { color: SHEET_STATUS_LABEL[homeSheet.status]?.color || TEXT_MUTED },
              ]}
            >
              {SHEET_STATUS_LABEL[homeSheet.status]?.label || homeSheet.status}
            </Text>
          ) : (
            <Text style={[styles.sheetBadge, { color: TEXT_MUTED }]}>Not Submitted</Text>
          )}
          {!!(homeSheet as any)?.lineupData?.some?.((l: any) => l.fromDefault) && (
            <Text style={{ fontSize: 10, fontWeight: '900', color: '#C2410C', backgroundColor: '#FFEDD5', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5, marginTop: 3, letterSpacing: 0.4 }}>
              DEFAULT USED
            </Text>
          )}
        </View>
        {/* Away */}
        <View style={styles.sheetStatus}>
          <Text style={styles.sheetTeam} numberOfLines={1}>
            {awayName}
          </Text>
          {awaySheet ? (
            <Text
              style={[
                styles.sheetBadge,
                { color: SHEET_STATUS_LABEL[awaySheet.status]?.color || TEXT_MUTED },
              ]}
            >
              {SHEET_STATUS_LABEL[awaySheet.status]?.label || awaySheet.status}
            </Text>
          ) : (
            <Text style={[styles.sheetBadge, { color: TEXT_MUTED }]}>Not Submitted</Text>
          )}
          {!!(awaySheet as any)?.lineupData?.some?.((l: any) => l.fromDefault) && (
            <Text style={{ fontSize: 10, fontWeight: '900', color: '#C2410C', backgroundColor: '#FFEDD5', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5, marginTop: 3, letterSpacing: 0.4 }}>
              DEFAULT USED
            </Text>
          )}
        </View>
      </View>

      {/* Lock / Re-lock button — admin only. Scorers see the locked status
          via the panel above but don't get the re-lock action since lineups
          are an organizer decision, not a scorer one. */}
      {/* SBPL kids-first: lock only the Kids games ahead of the rest of the tie. */}
      {isAdmin && seasonFormat === 'sbpl_15game' && homeSheet && awaySheet
        && tie.status !== 'in_progress' && tie.status !== 'completed' && (
        <TouchableOpacity
          style={[styles.lockBtn, { backgroundColor: kidsLocked ? '#64748B' : '#7C3AED', marginBottom: 10 }]}
          onPress={kidsLocked ? handleUnlockKids : handleLockKids}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <ActivityIndicator color={WHITE} size="small" />
          ) : (
            <Text style={styles.lockBtnText}>{kidsLocked ? 'UNLOCK KIDS GAMES' : 'LOCK KIDS GAMES'}</Text>
          )}
        </TouchableOpacity>
      )}

      {isAdmin && (tie.status === 'lineup_submitted' || tie.status === 'lineup_locked') && homeSheet && awaySheet && (
        <TouchableOpacity
          style={[styles.lockBtn, tie.status === 'lineup_locked' && { backgroundColor: '#F97316' }]}
          onPress={handleLockLineups}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <ActivityIndicator color={WHITE} size="small" />
          ) : (
            <Text style={styles.lockBtnText}>
              {tie.status === 'lineup_locked' ? 'RE-LOCK LINEUPS' : 'LOCK LINEUPS'}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Admin tie-sheet PDF download — opens a printable HTML page with
          both lineups pre-filled. Available once at least one lineup is
          submitted (admin can print early to scribble in the missing side
          on paper if needed). Admin only. */}
      {isAdmin && (homeSheet || awaySheet) && (
        <TouchableOpacity
          style={{
            marginTop: 10,
            backgroundColor: '#001E40',
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
          onPress={handleDownloadTieSheet}
          activeOpacity={0.8}
        >
          <Text style={{ color: WHITE, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>
            🖨️  DOWNLOAD TIE SHEET (PDF)
          </Text>
        </TouchableOpacity>
      )}

      {/* Admin: Submit lineup on behalf of captain */}
      {(tie.status === 'scheduled' || tie.status === 'lineup_submitted') && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          {!homeSheet && (
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: '#DBEAFE', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
              onPress={() => openLineupModal(tie.homeTeamId, homeName)}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: BLUE }}>SUBMIT {homeName.slice(0, 12).toUpperCase()}</Text>
            </TouchableOpacity>
          )}
          {!awaySheet && (
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: '#FFF7ED', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
              onPress={() => openLineupModal(tie.awayTeamId, awayName)}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: ORANGE }}>SUBMIT {awayName.slice(0, 12).toUpperCase()}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* View Lineups toggle — only available to viewers who are allowed
          to see player names. Admin always; scorers/others only after lock. */}
      {(homeSheet || awaySheet) && canSeeLineups && (
        <TouchableOpacity
          style={{ paddingVertical: 8, alignItems: 'center' }}
          onPress={() => setShowLineups(!showLineups)}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: BLUE }}>
            {showLineups ? 'HIDE LINEUPS ▲' : 'VIEW LINEUPS ▼'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Lineup details — side by side per slot */}
      {showLineups && canSeeLineups && (
        <View style={{ marginTop: 8 }}>
          {/* Column headers */}
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: NAVY, textAlign: 'center' }}>{homeName}</Text>
            </View>
            <View style={{ width: 40 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: NAVY, textAlign: 'center' }}>{awayName}</Text>
            </View>
          </View>

          {/* Slot rows */}
          {tieSlots.map((s) => s.slotNumber).map((slotNum) => {
            const homeSlot = homeSheet?.lineupData?.find((s: any) => s.slotNumber === slotNum);
            const awaySlot = awaySheet?.lineupData?.find((s: any) => s.slotNumber === slotNum);
            const catSlug = homeSlot?.categorySlug || awaySlot?.categorySlug || '';
            const catLabel = catSlug ? catSlug.replace(/(\d)/, ' $1').toUpperCase() : '';
            return (
              <View key={slotNum} style={{ backgroundColor: SURFACE, borderRadius: 8, padding: 8, marginBottom: 4 }}>
                {/* Slot header */}
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: TEXT_MUTED, letterSpacing: 0.5 }}>
                    #{slotNum} {catLabel}
                  </Text>
                </View>
                {/* Side by side players. Pencil icon next to each name is
                    admin-only; tap to swap that single player out for any
                    same-category roster member. */}
                <View style={{ flexDirection: 'row' }}>
                  {/* Home */}
                  <View style={{ flex: 1, paddingRight: 4 }}>
                    {homeSlot ? (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ fontSize: 12, color: NAVY, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                            {playerMap[homeSlot.player1Id] || '—'}
                            {(homeSlot as any).player1IsSub ? <Text style={{ color: '#EA580C', fontWeight: '800' }}> (sub)</Text> : null}
                          </Text>
                          {isAdmin && (
                            <TouchableOpacity
                              onPress={() => openSlotSwap('home', slotNum, 'player1', homeSlot.player1Id)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={{ paddingHorizontal: 4 }}
                            >
                              <Text style={{ fontSize: 12, color: BLUE }}>✎</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ fontSize: 12, color: TEXT_SUB, flex: 1 }} numberOfLines={1}>
                            {playerMap[homeSlot.player2Id] || '—'}
                            {(homeSlot as any).player2IsSub ? <Text style={{ color: '#EA580C', fontWeight: '800' }}> (sub)</Text> : null}
                          </Text>
                          {isAdmin && (
                            <TouchableOpacity
                              onPress={() => openSlotSwap('home', slotNum, 'player2', homeSlot.player2Id)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={{ paddingHorizontal: 4 }}
                            >
                              <Text style={{ fontSize: 12, color: BLUE }}>✎</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </>
                    ) : (
                      <Text style={{ fontSize: 11, color: TEXT_MUTED }}>—</Text>
                    )}
                  </View>
                  {/* Divider */}
                  <View style={{ width: 1, backgroundColor: BORDER, marginHorizontal: 6 }} />
                  {/* Away */}
                  <View style={{ flex: 1, paddingLeft: 4 }}>
                    {awaySlot ? (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                          {isAdmin && (
                            <TouchableOpacity
                              onPress={() => openSlotSwap('away', slotNum, 'player1', awaySlot.player1Id)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={{ paddingHorizontal: 4 }}
                            >
                              <Text style={{ fontSize: 12, color: BLUE }}>✎</Text>
                            </TouchableOpacity>
                          )}
                          <Text style={{ fontSize: 12, color: NAVY, fontWeight: '600', textAlign: 'right' }} numberOfLines={1}>
                            {playerMap[awaySlot.player1Id] || '—'}
                            {(awaySlot as any).player1IsSub ? <Text style={{ color: '#EA580C', fontWeight: '800' }}> (sub)</Text> : null}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                          {isAdmin && (
                            <TouchableOpacity
                              onPress={() => openSlotSwap('away', slotNum, 'player2', awaySlot.player2Id)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={{ paddingHorizontal: 4 }}
                            >
                              <Text style={{ fontSize: 12, color: BLUE }}>✎</Text>
                            </TouchableOpacity>
                          )}
                          <Text style={{ fontSize: 12, color: TEXT_SUB, textAlign: 'right' }} numberOfLines={1}>
                            {playerMap[awaySlot.player2Id] || '—'}
                            {(awaySlot as any).player2IsSub ? <Text style={{ color: '#EA580C', fontWeight: '800' }}> (sub)</Text> : null}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <Text style={{ fontSize: 11, color: TEXT_MUTED, textAlign: 'right' }}>—</Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  const renderMatchCard = (tm: TieMatch, idx: number) => {
    const cat = CATEGORY_COLORS[tm.categorySlug] || CATEGORY_COLORS.men1;
    const matchStatus = tm.match?.status || 'scheduled';
    const scores = tm.match?.scores?.[0];
    const isCompleted = matchStatus === 'completed';
    const isRally = (tm as any).isRallyPointGame === true || tm.slotNumber === 0;
    // Two-court tie: each game shows its court (rulebook default, or override) and
    // an admin/scorer can move it. Effective court = explicit override else default.
    const isTwoCourt = (tie as any).courtNumber2 != null;
    const effectiveCourt = tm.courtNumber ?? courtForSlot(tie, tm.slotNumber);
    const showCourt = isTwoCourt && !isRally;
    // Court-lock: a scorer assigned to the other court can't score this game.
    const courtEligible = canScoreMatch(tm);
    const lockedForScorer = isAssignedScorer && !isAdmin && !courtEligible;
    // Rally Point Game can be scored any time after tie starts (no lineup gate)
    const canEnterScore = courtEligible && (
      isRally
        ? (tie.status === 'in_progress' || tie.status === 'lineup_locked' || tie.status === 'scheduled' || tie.status === 'lineup_submitted')
        : (tie.status === 'in_progress' || tie.status === 'lineup_locked')
    );

    return (
      <TouchableOpacity
        key={tm.id}
        style={[styles.matchCard, isRally && { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#93C5FD' }, lockedForScorer && { opacity: 0.45 }]}
        activeOpacity={canEnterScore ? 0.7 : 1}
        onPress={() => {
          if (canEnterScore) return openScoreEntry(tm);
          if (lockedForScorer) {
            xAlert('Other court', `This game is on Court ${effectiveCourt ?? '—'}. You're assigned to a different court, so you can't score it.`);
          }
        }}
      >
        {/* Top row: slot, category, points */}
        <View style={styles.matchCardTop}>
          <View style={[styles.matchSlot, isRally && { backgroundColor: BLUE }]}>
            <Text style={[styles.matchSlotText, isRally && { color: WHITE }]}>{isRally ? 'RPG' : `#${tm.slotNumber}`}</Text>
          </View>
          <View style={[styles.categoryBadge, isRally ? { backgroundColor: '#DBEAFE' } : { backgroundColor: cat.bg }]}>
            <Text style={[styles.categoryBadgeText, isRally ? { color: BLUE } : { color: cat.color }]}>
              {isRally ? 'RALLY POINT GAME' : cat.label}
            </Text>
          </View>
          <View style={styles.pointBadge}>
            <Text style={styles.pointBadgeText}>{tm.pointValue}pts</Text>
          </View>
          {showCourt && (
            <TouchableOpacity
              style={styles.courtBadge}
              activeOpacity={canScore ? 0.6 : 1}
              onPress={(e) => {
                (e as any).stopPropagation?.();
                if (canScore) setCourtModal({ visible: true, tieMatch: tm });
              }}
            >
              <Text style={styles.courtBadgeText}>
                {effectiveCourt ? `COURT ${effectiveCourt}` : 'NO COURT'}
                {tm.courtNumber != null ? ' •' : ''}
              </Text>
              {canScore && <Text style={styles.courtBadgePencil}> ✎</Text>}
            </TouchableOpacity>
          )}
          {isCompleted && (
            <View style={[styles.matchStatusDot, { backgroundColor: GREEN }]} />
          )}
          {matchStatus === 'in_progress' && (
            <View style={[styles.matchStatusDot, { backgroundColor: ORANGE }]} />
          )}
        </View>

        {/* Players + score. Player names are gated on `canSeeLineups` so
            scorers, opposing captains, and other viewers see only the team
            label until the admin locks both lineups. Admin always sees
            full player names. Rally Point Game shows team name regardless
            (no per-player lineup for it). */}
        <View style={styles.matchPlayers}>
          <View style={styles.matchPlayerSide}>
            <Text style={styles.matchPlayerText} numberOfLines={2}>
              {isRally
                ? homeName
                : !canSeeLineups
                  ? homeName
                  : (tm.homePlayer1Id || tm.homePlayer2Id)
                    ? pairNameJSX(tm.homePlayer1Id, (tm as any).homePlayer1IsSub, tm.homePlayer2Id, (tm as any).homePlayer2IsSub)
                    : 'TBD'}
            </Text>
          </View>
          <View style={styles.matchScoreCenter}>
            {scores ? (
              <YDisplay size={26} color={isCompleted ? YColors.accent : YColors.ink} style={{ lineHeight: 32 }}>{`${scores.teamAScore}–${scores.teamBScore}`}</YDisplay>
            ) : (
              <YDisplay size={22} color={YColors.ink4} style={{ lineHeight: 28 }}>–</YDisplay>
            )}
          </View>
          <View style={styles.matchPlayerSide}>
            <Text style={[styles.matchPlayerText, { textAlign: 'right' }]} numberOfLines={2}>
              {isRally
                ? awayName
                : !canSeeLineups
                  ? awayName
                  : (tm.awayPlayer1Id || tm.awayPlayer2Id)
                    ? pairNameJSX(tm.awayPlayer1Id, (tm as any).awayPlayer1IsSub, tm.awayPlayer2Id, (tm as any).awayPlayer2IsSub)
                    : 'TBD'}
            </Text>
          </View>
        </View>

        {/* Per-match points breakdown */}
        {isCompleted && scores && (() => {
          const winnerScore = Math.max(scores.teamAScore, scores.teamBScore);
          const loserScore = Math.min(scores.teamAScore, scores.teamBScore);
          // match.winnerId can be either the team-entity UUID (teamAId) or the franchise UUID (tie.homeTeamId)
          // depending on which endpoint saved it — accept either.
          const wId = tm.match?.winnerId;
          const homeWon = !!wId && (wId === tm.match?.teamAId || wId === tie.homeTeamId);
          // Winner gets match points
          const homeMatchPts = homeWon ? tm.pointValue : 0;
          const awayMatchPts = homeWon ? 0 : tm.pointValue;
          // Bonus via the shared util (honors season.bonusRules — SBPL narrows
          // the close-loss band; defaults to SPPL when bonusRules is absent).
          const _sides = bonusToSides(
            computeMatchBonus(winnerScore, loserScore, (tm.match as any)?.scoringMode, bonusRules),
            homeWon,
          );
          const homeBonusPts = _sides.home;
          const awayBonusPts = _sides.away;
          return (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
              {/* Home points */}
              <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                {homeMatchPts > 0 && (
                  <View style={{ backgroundColor: '#DBEAFE', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#1858D6' }}>+{homeMatchPts}</Text>
                  </View>
                )}
                {homeBonusPts > 0 && (
                  <View style={{ backgroundColor: '#D1FAE5', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#06D6A0' }}>+{homeBonusPts}</Text>
                  </View>
                )}
                {homeMatchPts === 0 && homeBonusPts === 0 && (
                  <Text style={{ fontSize: 10, color: '#94A3B8' }}>0</Text>
                )}
              </View>
              {/* Winner indicator */}
              <Text style={{ fontSize: 10, fontWeight: '700', color: homeWon ? '#1858D6' : '#F97316' }}>
                {homeWon ? '← WIN' : 'WIN →'}
              </Text>
              {/* Away points */}
              <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                {awayMatchPts > 0 && (
                  <View style={{ backgroundColor: '#DBEAFE', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#1858D6' }}>+{awayMatchPts}</Text>
                  </View>
                )}
                {awayBonusPts > 0 && (
                  <View style={{ backgroundColor: '#D1FAE5', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#06D6A0' }}>+{awayBonusPts}</Text>
                  </View>
                )}
                {awayMatchPts === 0 && awayBonusPts === 0 && (
                  <Text style={{ fontSize: 10, color: '#94A3B8' }}>0</Text>
                )}
              </View>
            </View>
          );
        })()}
      </TouchableOpacity>
    );
  };

  const renderLineupModal = () => {
    // Group roster players by category for easy selection
    const playersByCategory: Record<string, FranchiseRoster[]> = {};
    rosterPlayers.forEach((r) => {
      const cat = r.categorySlug || 'men1';
      if (!playersByCategory[cat]) playersByCategory[cat] = [];
      playersByCategory[cat].push(r);
    });

    return (
      <Modal
        visible={lineupModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setLineupModal({ visible: false, franchiseId: '', franchiseName: '' })}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>Submit Lineup</Text>
            <Text style={styles.modalSubtitle}>
              Admin submission for {lineupModal.franchiseName}
            </Text>

            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator>
              {tieSlots.map((slot) => {
                // Mixed-gender slots (#2 K&TM, #5 W1&M1, #8 W2&M2) have TWO
                // categories in allowedCategories — index [0] is for Player 1
                // and [1] is for Player 2 (matches the slot label order, e.g.,
                // "Women1 & Men1" → P1=women1, P2=men1). Same-category slots
                // share one pool across both players.
                const picks = lineupSlots[slot.slotNumber] || { player1Id: '', player2Id: '' };
                let p1Players: FranchiseRoster[];
                let p2Players: FranchiseRoster[];
                if (seasonFormat === 'sbpl_15game') {
                  // SBPL: both players must belong to the slot's category group
                  // (map each roster player's sub-category to its group).
                  const eligible = rosterPlayers.filter(
                    (r) => sbplGroupForCategory(r.categorySlug) === slot.categorySlug,
                  );
                  p1Players = eligible;
                  p2Players = eligible;
                } else {
                  // Mixed-gender SPPL slots have TWO categories in
                  // allowedCategories — [0] for Player 1, [1] for Player 2.
                  const p1Cats =
                    slot.allowedCategories.length === 2
                      ? [slot.allowedCategories[0]]
                      : slot.allowedCategories;
                  const p2Cats =
                    slot.allowedCategories.length === 2
                      ? [slot.allowedCategories[1]]
                      : slot.allowedCategories;
                  const p1CatPlayers = p1Cats.flatMap((cat) => playersByCategory[cat] || []);
                  const p2CatPlayers = p2Cats.flatMap((cat) => playersByCategory[cat] || []);
                  // Fallback to full roster only if no eligible players configured at all
                  p1Players = p1CatPlayers.length > 0 ? p1CatPlayers : rosterPlayers;
                  p2Players = p2CatPlayers.length > 0 ? p2CatPlayers : rosterPlayers;
                }

                // SPPL Season 1 rule: each player plays at most 1 match per
                // tie. Build a set of every playerId already picked in any
                // OTHER slot so the chips can grey them out.
                const pickedElsewhere = new Set<string>();
                Object.entries(lineupSlots).forEach(([slotKey, sel]) => {
                  if (Number(slotKey) === slot.slotNumber) return;
                  if (sel.player1Id) pickedElsewhere.add(sel.player1Id);
                  if (sel.player2Id) pickedElsewhere.add(sel.player2Id);
                });

                return (
                  <View
                    key={slot.slotNumber}
                    style={{
                      backgroundColor: SURFACE,
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: NAVY }}>
                        #{slot.slotNumber}
                      </Text>
                      <View style={{ backgroundColor: CATEGORY_COLORS[slot.categorySlug]?.bg || '#EDE9FE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: CATEGORY_COLORS[slot.categorySlug]?.color || PURPLE }}>
                          {slot.label}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 10, color: TEXT_MUTED, marginLeft: 'auto' }}>{slot.pointValue}pts</Text>
                    </View>

                    {/* Player 1 picker */}
                    <View style={{ marginBottom: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: TEXT_SUB, marginBottom: 4 }}>Player 1</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {p1Players.map((p) => {
                            const name = p.player?.fullName || p.player?.displayName || playerMap[p.playerId] || p.playerId.slice(0, 8);
                            const selected = picks.player1Id === p.playerId;
                            const usedAsP2 = picks.player2Id === p.playerId;
                            const usedInOtherSlot = pickedElsewhere.has(p.playerId);
                            const disabled = usedAsP2 || usedInOtherSlot;
                            const suffix = usedAsP2 ? ' (P2)' : usedInOtherSlot ? ' (used)' : '';
                            return (
                              <TouchableOpacity
                                key={p.playerId}
                                disabled={disabled}
                                style={{
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  borderRadius: 6,
                                  backgroundColor: selected ? BLUE : WHITE,
                                  borderWidth: 1,
                                  borderColor: selected ? BLUE : BORDER,
                                  opacity: disabled ? 0.35 : 1,
                                }}
                                onPress={() => {
                                  if (disabled) return;
                                  setLineupSlots((prev) => ({
                                    ...prev,
                                    [slot.slotNumber]: { ...picks, player1Id: p.playerId },
                                  }));
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '600',
                                    color: selected ? WHITE : TEXT_COLOR,
                                  }}
                                  numberOfLines={1}
                                >
                                  {name}{suffix}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </ScrollView>
                    </View>

                    {/* Player 2 picker */}
                    <View>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: TEXT_SUB, marginBottom: 4 }}>Player 2</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {p2Players.map((p) => {
                            const name = p.player?.fullName || p.player?.displayName || playerMap[p.playerId] || p.playerId.slice(0, 8);
                            const selected = picks.player2Id === p.playerId;
                            const usedAsP1 = picks.player1Id === p.playerId;
                            const usedInOtherSlot = pickedElsewhere.has(p.playerId);
                            const disabled = usedAsP1 || usedInOtherSlot;
                            const suffix = usedAsP1 ? ' (P1)' : usedInOtherSlot ? ' (used)' : '';
                            return (
                              <TouchableOpacity
                                key={p.playerId}
                                disabled={disabled}
                                style={{
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  borderRadius: 6,
                                  backgroundColor: selected ? BLUE : WHITE,
                                  borderWidth: 1,
                                  borderColor: selected ? BLUE : BORDER,
                                  opacity: disabled ? 0.35 : 1,
                                }}
                                onPress={() => {
                                  if (disabled) return;
                                  setLineupSlots((prev) => ({
                                    ...prev,
                                    [slot.slotNumber]: { ...picks, player2Id: p.playerId },
                                  }));
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '600',
                                    color: selected ? WHITE : TEXT_COLOR,
                                  }}
                                  numberOfLines={1}
                                >
                                  {name}{suffix}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </ScrollView>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setLineupModal({ visible: false, franchiseId: '', franchiseName: '' })}
              >
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleAdminSubmitLineup}
                disabled={lineupSubmitting}
              >
                {lineupSubmitting ? (
                  <ActivityIndicator color={NAVY} size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>SUBMIT LINEUP</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderScoreModal = () => {
    const tm = scoreModal.tieMatch;
    const target = getTargetPoints(tm);
    const pipColor =
      livePushStatus === 'live' ? GREEN :
      livePushStatus === 'syncing' ? WARN :
      livePushStatus === 'error' ? RED : TEXT_MUTED;
    const pipText =
      livePushStatus === 'live' ? '● live' :
      livePushStatus === 'syncing' ? '● syncing…' :
      livePushStatus === 'error' ? '● sync failed' : '● idle';

    return (
      <Modal
        visible={scoreModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setScoreModal({ visible: false, tieMatch: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: Math.max(36, kbHeight) }]}>
            <Text style={styles.modalTitle}>Score Match</Text>
            {tm && (
              <Text style={styles.modalSubtitle}>
                Match #{tm.slotNumber} -{' '}
                {CATEGORY_COLORS[tm.categorySlug]?.label || tm.categorySlug}{' '}
                ({tm.pointValue}pts)
              </Text>
            )}

            {/* Target + live sync pip */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 10 }}>
              <Text style={{ fontSize: 11, color: TEXT_SUB, fontWeight: '700' }}>FIRST TO {target}</Text>
              <Text style={{ fontSize: 10, fontWeight: '800', color: pipColor }}>{pipText}</Text>
            </View>

            {/* +/- Counter rows */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: BLUE, marginBottom: 4 }} numberOfLines={1}>{homeName.toUpperCase()}</Text>
                <Text style={{ fontSize: 56, fontWeight: '900', color: NAVY, marginVertical: 6 }}>{scoreVals.a}</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => adjScore('a', -1)}
                    disabled={scoreSubmitting}
                    style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: SURFACE, borderWidth: 2, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 28, fontWeight: '900', color: TEXT_COLOR }}>−</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => adjScore('a', 1)}
                    disabled={scoreSubmitting}
                    style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 28, fontWeight: '900', color: WHITE }}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={{ fontSize: 32, fontWeight: '900', color: TEXT_MUTED, marginHorizontal: 8 }}>–</Text>

              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: RED, marginBottom: 4 }} numberOfLines={1}>{awayName.toUpperCase()}</Text>
                <Text style={{ fontSize: 56, fontWeight: '900', color: NAVY, marginVertical: 6 }}>{scoreVals.b}</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => adjScore('b', -1)}
                    disabled={scoreSubmitting}
                    style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: SURFACE, borderWidth: 2, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 28, fontWeight: '900', color: TEXT_COLOR }}>−</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => adjScore('b', 1)}
                    disabled={scoreSubmitting}
                    style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 28, fontWeight: '900', color: WHITE }}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {scoreModal.tieMatch ? renderServePanel(scoreModal.tieMatch) : null}

            {/* Winner picker (shown after SAVE validates target).
                Redesigned to show ONLY the winning team prominently, with
                a small "switch" link for correcting mistakes — keeps the
                visual focus on the actual winner instead of giving the
                losing team an equal-weight button. */}
            {winnerPickerVisible ? (() => {
              // Score-implied winner; flips when the scorer taps "switch"
              // (e.g. they entered the score on the wrong side by accident).
              const presumedSide: 'home' | 'away' = scoreVals.a > scoreVals.b ? 'home' : 'away';
              const finalSide: 'home' | 'away' =
                swapWinner ? (presumedSide === 'home' ? 'away' : 'home') : presumedSide;
              const winnerName = finalSide === 'home' ? homeName : awayName;
              const otherName = finalSide === 'home' ? awayName : homeName;
              const winnerColor = finalSide === 'home' ? BLUE : RED;
              return (
                <View style={{ backgroundColor: SURFACE, borderRadius: 12, padding: 14, marginTop: 4, borderWidth: 2, borderColor: winnerColor }}>
                  <Text style={{ textAlign: 'center', fontSize: 11, fontWeight: '800', color: winnerColor, letterSpacing: 1.5, marginBottom: 2 }}>CONFIRM WINNER</Text>
                  <Text style={{ textAlign: 'center', fontSize: 16, fontWeight: '800', color: NAVY, marginBottom: 12 }}>
                    Score: {scoreVals.a} – {scoreVals.b}
                  </Text>

                  {/* The winner — one big button, no opposing team shown
                      as a peer button. Tap to confirm and finalize. */}
                  <TouchableOpacity
                    onPress={() => confirmWinner(finalSide)}
                    disabled={scoreSubmitting}
                    style={{
                      backgroundColor: winnerColor,
                      borderRadius: 12,
                      paddingVertical: 18,
                      alignItems: 'center',
                      shadowColor: winnerColor,
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 4,
                    }}
                  >
                    <Text style={{ color: WHITE, fontWeight: '900', fontSize: 16, letterSpacing: 0.5 }} numberOfLines={1}>
                      🏆 {winnerName.toUpperCase()} WIN
                    </Text>
                    <Text style={{ color: WHITE, fontWeight: '700', fontSize: 11, opacity: 0.85, marginTop: 4, letterSpacing: 0.5 }}>
                      TAP TO SAVE
                    </Text>
                  </TouchableOpacity>

                  {/* Subtle correction link — small, secondary, no big
                      button representation of the loser. */}
                  <TouchableOpacity
                    onPress={() => setSwapWinner(!swapWinner)}
                    disabled={scoreSubmitting}
                    style={{ marginTop: 12, alignSelf: 'center' }}
                  >
                    <Text style={{ color: TEXT_SUB, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>
                      Wrong team? <Text style={{ color: BLUE, fontWeight: '800' }}>Declare {otherName} as winner →</Text>
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setWinnerPickerVisible(false)}
                    style={{ marginTop: 8, alignSelf: 'center' }}
                    disabled={scoreSubmitting}
                  >
                    <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: '700' }}>Cancel</Text>
                  </TouchableOpacity>
                  {scoreSubmitting && <ActivityIndicator size="small" color={winnerColor} style={{ marginTop: 8 }} />}
                </View>
              );
            })() : (
              <>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, { marginTop: 4 }]}
                  onPress={handleSaveScore}
                  disabled={scoreSubmitting}
                >
                  <Text style={styles.modalSaveText}>SAVE SCORE</Text>
                </TouchableOpacity>

                {/* Declare Winner (forfeit / injury / decision) — admin-only.
                    Scorers should record the actual play; tournament-level
                    decisions like forfeits are an organizer call. */}
                {isAdmin && (
                  <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: BORDER, borderStyle: 'dashed' }}>
                    <Text style={{ textAlign: 'center', fontSize: 10, color: TEXT_MUTED, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 }}>
                      END MATCH EARLY (FORFEIT / INJURY / DECISION)
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => handleDeclareWinner('home')}
                        disabled={scoreSubmitting}
                        style={{ flex: 1, backgroundColor: BLUE, borderRadius: 10, paddingVertical: 14, alignItems: 'center' }}
                      >
                        <Text style={{ color: WHITE, fontWeight: '800', fontSize: 12 }} numberOfLines={1}>🏆 {homeName.toUpperCase()}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeclareWinner('away')}
                        disabled={scoreSubmitting}
                        style={{ flex: 1, backgroundColor: RED, borderRadius: 10, paddingVertical: 14, alignItems: 'center' }}
                      >
                        <Text style={{ color: WHITE, fontWeight: '800', fontSize: 12 }} numberOfLines={1}>🏆 {awayName.toUpperCase()}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.modalCancelBtn, { marginTop: 14 }]}
                  onPress={() => setScoreModal({ visible: false, tieMatch: null })}
                  disabled={scoreSubmitting}
                >
                  <Text style={styles.modalCancelText}>CLOSE</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 160 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {renderHeader()}
        {isAdmin && renderTieControls()}
        {/* Friendly waiting notice for assigned scorers until the admin
            locks both lineups. Without this, scorers would just see an
            empty page below the header and might think it's broken. */}
        {!isAdmin && isAssignedScorer && !lineupRevealed && (
          <View style={{
            marginHorizontal: 14,
            marginBottom: 14,
            padding: 14,
            backgroundColor: '#FEF3C7',
            borderWidth: 1,
            borderColor: '#FBBF24',
            borderRadius: 12,
          }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#92400E', marginBottom: 4 }}>
              🔒 Waiting for admin to lock lineups
            </Text>
            <Text style={{ fontSize: 12, color: '#92400E', lineHeight: 17 }}>
              You'll see both squads here once the organizer locks the tie sheets.
              Until then, only the match structure is visible.
            </Text>
          </View>
        )}
        {/* Lineup Status panel: admin sees it always (they need it to manage
            the lock workflow); scorers only after lineup is revealed (no
            "submitted vs not submitted" signal pre-lock). */}
        {(isAdmin || (canScore && lineupRevealed)) && renderTieSheetStatus()}
        {/* Substitute panel: admin-only. Mid-tie squad changes are an
            organizer decision; scorers just record what plays out. */}
        {isAdmin && tie.status !== 'completed' && renderSubstitutePanel()}

        {/* Match list */}
        <View style={styles.matchesSection}>
          <Text style={styles.matchesSectionTitle}>
            Matches ({tie.tieMatches?.length || 0})
          </Text>
          {(tie.tieMatches || []).map((tm, idx) => renderMatchCard(tm, idx))}
        </View>

        {/* Admin: reset a league tie back to 'scheduled'. Hidden for
            knockout ties (use Reset Knockout to avoid orphaning the bracket)
            and for ties already at scheduled state. Accepts any non-scheduled
            state — lineup_submitted, lineup_locked, in_progress, completed —
            so organizers can wipe a tie mid-flight for pre-tournament
            rehearsals. Rescores standings, player stats, and fantasy after wipe. */}
        {/* Reset-the-game button is hidden on the league-kiosk build (live
            event) to avoid accidental wipes; it stays available in the full
            app for the owner. */}
        {!IS_LEAGUE_KIOSK && isAdmin && (tie.round || '').startsWith('league_week_') && tie.status !== 'scheduled' && (
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
                const effectiveLeagueId = league?.id || (tie as any)?.leagueId || (route.params as any)?.leagueId;
                if (!effectiveLeagueId) {
                  xAlert('Error', 'Could not resolve leagueId for this tie.');
                  return;
                }
                xConfirm(
                  'Reset This Tie?',
                  'This wipes scores, winners, and lineups for this tie only. The captain will need to re-submit the tie sheet. Standings, player stats, and fantasy are recalculated.\n\nIf anyone is scoring this tie right now their session will go stale. Continue?',
                  async () => {
                    try {
                      setActionLoading(true);
                      await resetLeagueTie(effectiveLeagueId, tie.seasonId, tie.id);
                      xAlert('Tie Reset', 'Back to scheduled. Captain can re-submit the tie sheet.');
                      await fetchData();
                    } catch (err: any) {
                      xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to reset tie');
                    } finally {
                      setActionLoading(false);
                    }
                  },
                );
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#DC2626', letterSpacing: 0.5 }}>
                RESET THIS TIE
              </Text>
              <Text style={{ fontSize: 11, color: '#991B1B', marginTop: 2 }}>
                Admin only · rehearsal use · other ties & entries preserved
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Bottom action buttons (admin or scorer) */}
      {canScore && (
        <View style={styles.bottomActions}>
          {(tie.status === 'lineup_locked'
            || (kidsLocked && tie.status !== 'in_progress' && tie.status !== 'completed')) && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: BLUE }]}
              onPress={handleStartTie}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={WHITE} />
              ) : (
                <Text style={styles.actionBtnText}>{tie.status === 'lineup_locked' ? 'START TIE' : 'START TIE (KIDS)'}</Text>
              )}
            </TouchableOpacity>
          )}
          {tie.status === 'in_progress' && allMatchesCompleted && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: GREEN }]}
              onPress={handleCompleteTie}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={NAVY} />
              ) : (
                <Text style={[styles.actionBtnText, { color: NAVY }]}>COMPLETE TIE</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {renderScoreModal()}
      {renderLineupModal()}

      {/* Start-Tie Court Confirmation Modal */}
      {/* Open Captain's Portal — pick a duration */}
      <Modal
        visible={openPortalModal}
        transparent
        animationType="fade"
        onRequestClose={() => !openPortalBusy && setOpenPortalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 'auto' }]}>
            <Text style={styles.modalTitle}>Open Captain's Portal</Text>
            <Text style={styles.modalSubtitle}>
              How long should captains be able to submit or edit their lineup for this tie?
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {[15, 30, 40, 60].map((m) => (
                <TouchableOpacity
                  key={m}
                  disabled={openPortalBusy}
                  onPress={() => handleOpenCaptainPortal(m)}
                  activeOpacity={0.85}
                  style={{
                    flexGrow: 1, minWidth: 64, paddingVertical: 14, borderRadius: 10,
                    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#1858D6',
                    alignItems: 'center', opacity: openPortalBusy ? 0.5 : 1,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#1E40AF' }}>{m}</Text>
                  <Text style={{ fontSize: 10, color: '#3B82F6' }}>min</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontSize: 11, color: '#64748B', marginTop: 16, marginBottom: 6, fontWeight: '700' }}>
              Or enter manually
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextInput
                placeholder="e.g. 45"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                value={openPortalMins}
                onChangeText={(v) => setOpenPortalMins(v.replace(/\D/g, '').slice(0, 3))}
                editable={!openPortalBusy}
                style={{
                  flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10,
                  paddingVertical: 12, paddingHorizontal: 14, fontSize: 15, color: '#0F172A',
                }}
              />
              <TouchableOpacity
                disabled={openPortalBusy || !openPortalMins}
                onPress={() => handleOpenCaptainPortal(parseInt(openPortalMins, 10))}
                activeOpacity={0.85}
                style={{
                  paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10,
                  backgroundColor: '#1858D6', opacity: (openPortalBusy || !openPortalMins) ? 0.5 : 1,
                }}
              >
                {openPortalBusy
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>Open</Text>}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              disabled={openPortalBusy}
              onPress={() => setOpenPortalModal(false)}
              style={{ paddingVertical: 14, alignItems: 'center', marginTop: 10 }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#64748B' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Open Kids Submission — absolute deadline or open-for-N-minutes */}
      <Modal
        visible={kidsModal}
        transparent
        animationType="fade"
        onRequestClose={() => !kidsBusy && setKidsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 'auto' }]}>
            <Text style={styles.modalTitle}>Open Kids Submission</Text>
            <Text style={styles.modalSubtitle}>
              Set a deadline for captains to submit their Kids pairs. Past it, missing kids
              lineups auto-fill from each team's default.
            </Text>

            <Text style={{ fontSize: 11, color: '#64748B', marginTop: 14, marginBottom: 6, fontWeight: '700' }}>
              Set a date & time
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextInput
                placeholder="2026-07-31 18:00"
                placeholderTextColor="#94A3B8"
                value={kidsWhen}
                onChangeText={setKidsWhen}
                editable={!kidsBusy}
                autoCapitalize="none"
                style={{
                  flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10,
                  paddingVertical: 12, paddingHorizontal: 14, fontSize: 15, color: '#0F172A',
                }}
              />
              <TouchableOpacity
                disabled={kidsBusy || !kidsWhen.trim()}
                onPress={submitKidsWhen}
                activeOpacity={0.85}
                style={{
                  paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10,
                  backgroundColor: '#7C3AED', opacity: (kidsBusy || !kidsWhen.trim()) ? 0.5 : 1,
                }}
              >
                {kidsBusy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>Set</Text>}
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 11, color: '#64748B', marginTop: 16, marginBottom: 6, fontWeight: '700' }}>
              Or open now for
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[30, 60, 120].map((m) => (
                <TouchableOpacity
                  key={m}
                  disabled={kidsBusy}
                  onPress={() => handleSetKidsDeadline({ minutes: m })}
                  activeOpacity={0.85}
                  style={{
                    flexGrow: 1, minWidth: 64, paddingVertical: 14, borderRadius: 10,
                    backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#7C3AED',
                    alignItems: 'center', opacity: kidsBusy ? 0.5 : 1,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#6D28D9' }}>{m}</Text>
                  <Text style={{ fontSize: 10, color: '#7C3AED' }}>min</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              disabled={kidsBusy}
              onPress={() => handleSetKidsDeadline({ deadline: null } as any)}
              style={{ paddingVertical: 12, alignItems: 'center', marginTop: 12 }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#DC2626' }}>Clear kids deadline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={kidsBusy}
              onPress={() => setKidsModal(false)}
              style={{ paddingVertical: 10, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#64748B' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={startCourtModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => !actionLoading && setStartCourtModal({ visible: false, courtNumber: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 'auto' }]}>
            <Text style={styles.modalTitle}>Start Tie</Text>
            <Text style={styles.modalSubtitle}>
              Which court is this tie being played on? The live scoreboard will appear on that court's OBS overlay URL.
            </Text>

            <View style={{ marginTop: 14, marginBottom: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: TEXT_SUB, marginBottom: 8, letterSpacing: 1 }}>COURT</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[1, 2, 3].map((n) => {
                  const selected = startCourtModal.courtNumber === n;
                  return (
                    <TouchableOpacity
                      key={n}
                      onPress={() => setStartCourtModal((p) => ({ ...p, courtNumber: n }))}
                      style={{
                        flex: 1,
                        paddingVertical: 14,
                        borderRadius: 10,
                        backgroundColor: selected ? NAVY : WHITE,
                        borderWidth: 2,
                        borderColor: selected ? NAVY : BORDER,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 11, color: selected ? 'rgba(255,255,255,0.7)' : TEXT_MUTED, fontWeight: '600' }}>COURT</Text>
                      <Text style={{ fontSize: 22, fontWeight: '900', color: selected ? WHITE : NAVY, marginTop: 2 }}>{n}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                onPress={() => setStartCourtModal((p) => ({ ...p, courtNumber: null }))}
                style={{ marginTop: 8, alignSelf: 'center' }}
              >
                <Text style={{ fontSize: 12, color: TEXT_SUB, textDecorationLine: 'underline' }}>
                  No court / not streaming
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
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
                onPress={() => !actionLoading && setStartCourtModal({ visible: false, courtNumber: null })}
                disabled={actionLoading}
              >
                <Text style={{ color: TEXT_COLOR, fontWeight: '700', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1.4,
                  backgroundColor: GREEN,
                  borderRadius: 10,
                  paddingVertical: 14,
                  alignItems: 'center',
                  opacity: actionLoading ? 0.6 : 1,
                }}
                onPress={confirmStartTie}
                disabled={actionLoading}
              >
                <Text style={{ color: WHITE, fontWeight: '800', fontSize: 14, letterSpacing: 0.5 }}>
                  {actionLoading ? 'STARTING…' : 'START TIE'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Per-game court override — admin/scorer picks which court a game is on.
          Defaults to the rulebook court; "Default" clears the override. */}
      <Modal
        visible={courtModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => !courtSaving && setCourtModal({ visible: false, tieMatch: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 'auto' }]}>
            <Text style={styles.modalTitle}>Move game to court</Text>
            <Text style={styles.modalSubtitle}>
              {courtModal.tieMatch ? `Game #${courtModal.tieMatch.slotNumber}` : ''} — pick the court this game
              is being played on. It updates that court's OBS overlay.
            </Text>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              {(() => {
                const opts = Array.from(
                  new Set(
                    [(tie as any).courtNumber, (tie as any).courtNumber2].filter(
                      (n) => n != null,
                    ) as number[],
                  ),
                );
                const list = opts.length ? opts : [1, 2, 3, 4];
                const cur =
                  courtModal.tieMatch?.courtNumber ??
                  (courtModal.tieMatch ? courtForSlot(tie, courtModal.tieMatch.slotNumber) : null);
                return list.map((n) => {
                  const selected = cur === n;
                  return (
                    <TouchableOpacity
                      key={n}
                      disabled={courtSaving}
                      onPress={() => handleSetMatchCourt(n)}
                      style={{
                        flex: 1,
                        paddingVertical: 16,
                        borderRadius: 10,
                        backgroundColor: selected ? NAVY : WHITE,
                        borderWidth: 2,
                        borderColor: selected ? NAVY : BORDER,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 11, color: selected ? 'rgba(255,255,255,0.7)' : TEXT_MUTED, fontWeight: '600' }}>COURT</Text>
                      <Text style={{ fontSize: 24, fontWeight: '900', color: selected ? WHITE : NAVY, marginTop: 2 }}>{n}</Text>
                    </TouchableOpacity>
                  );
                });
              })()}
            </View>

            <TouchableOpacity
              onPress={() => handleSetMatchCourt(null)}
              disabled={courtSaving}
              style={{ marginTop: 12, alignSelf: 'center' }}
            >
              <Text style={{ fontSize: 12, color: TEXT_SUB, textDecorationLine: 'underline' }}>
                Reset to rulebook default
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                marginTop: 18,
                backgroundColor: SURFACE,
                borderWidth: 1,
                borderColor: BORDER,
                borderRadius: 10,
                paddingVertical: 14,
                alignItems: 'center',
              }}
              onPress={() => !courtSaving && setCourtModal({ visible: false, tieMatch: null })}
              disabled={courtSaving}
            >
              <Text style={{ color: TEXT_COLOR, fontWeight: '700', fontSize: 14 }}>{courtSaving ? 'SAVING…' : 'Cancel'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Substitute Player Modal — admin/scorer-only. Pick a team, pick the
          rostered player to remove, pick the replacement (any category in
          the team's full roster), confirm. */}
      <Modal
        visible={substituteModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => { if (!substituteSubmitting) { setFillTarget(null); setSubstituteModal({ visible: false, team: 'home', oldPlayerId: null, newPlayerId: null }); } }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>Substitute Player</Text>
            <Text style={styles.modalSubtitle}>
              Your captain's lineup is shown below. Tap any orange "Fill substitute" slot, then pick a player. Only matches that haven't started yet are affected.
            </Text>

            {/* Team picker */}
            <Text style={{ fontSize: 11, fontWeight: '800', color: TEXT_SUB, letterSpacing: 1, marginTop: 16, marginBottom: 8 }}>
              TEAM
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['home', 'away'] as const).map((side) => {
                const selected = substituteModal.team === side;
                const label = side === 'home' ? homeName : awayName;
                return (
                  <TouchableOpacity
                    key={side}
                    onPress={() => { setFillTarget(null); setSubstituteModal((p) => ({
                      ...p,
                      team: side,
                      // Reset selections when switching teams since the rosters differ.
                      oldPlayerId: null,
                      newPlayerId: null,
                    })); }}
                    disabled={substituteSubmitting}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 10,
                      backgroundColor: selected ? NAVY : WHITE,
                      borderWidth: 2,
                      borderColor: selected ? NAVY : '#E2E8F0',
                      alignItems: 'center',
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '800', color: selected ? WHITE : NAVY }} numberOfLines={1}>
                      {label || (side === 'home' ? 'Home' : 'Away')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <ScrollView style={{ marginTop: 14 }} contentContainerStyle={{ paddingBottom: 8 }}>
              {/* Full lineup from the captain's tie sheet. Every game shows both
                  players; only the empty (substitute) slots are tappable to fill.
                  Tapping one switches this modal to the full-team picker below. */}
              {!fillTarget && (
                <>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: TEXT_SUB, letterSpacing: 1, marginBottom: 8 }}>
                    LINEUP — tap a substitute slot to fill it
                  </Text>
                  {(() => {
                    const sheet = substituteModal.team === 'home' ? homeSheet : awaySheet;
                    if (!sheet?.lineupData || sheet.lineupData.length === 0) {
                      return (
                        <Text style={{ fontSize: 12, color: TEXT_SUB, fontStyle: 'italic', marginBottom: 8 }}>
                          This team hasn't submitted a lineup yet.
                        </Text>
                      );
                    }
                    const isEmptyId = (pid: any) => !pid || pid === 'SUBSTITUTE' || !playerMap[pid];
                    const anyEmpty = tieSlots.some((slot) => {
                      const row = sheet.lineupData.find((x: any) => x.slotNumber === slot.slotNumber);
                      return isEmptyId(row?.player1Id) || isEmptyId(row?.player2Id);
                    });
                    const renderPos = (row: any, position: 'player1' | 'player2', gameLabel: string) => {
                      const pid = row?.[`${position}Id`];
                      if (!isEmptyId(pid)) {
                        const isSub = !!row?.[`${position}IsSub`];
                        return (
                          <View style={{ flex: 1, paddingVertical: 7, paddingHorizontal: 8 }}>
                            <Text style={{ fontSize: 13, color: NAVY, fontWeight: '600' }} numberOfLines={1}>
                              {playerMap[pid]}
                              {isSub ? <Text style={{ color: '#EA580C', fontWeight: '800' }}>  (sub)</Text> : null}
                            </Text>
                          </View>
                        );
                      }
                      return (
                        <TouchableOpacity
                          onPress={() => setFillTarget({ slotNumber: row?.slotNumber, position, label: gameLabel })}
                          disabled={substituteSubmitting}
                          style={{ flex: 1, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '800', color: '#9A3412' }}>🔁 Fill substitute</Text>
                        </TouchableOpacity>
                      );
                    };
                    return (
                      <>
                        {!anyEmpty && (
                          <Text style={{ fontSize: 12, color: '#065F46', fontStyle: 'italic', marginBottom: 8 }}>
                            ✓ No substitutes to fill — every slot has a player.
                          </Text>
                        )}
                        {tieSlots.map((slot) => {
                          const row = sheet.lineupData.find((x: any) => x.slotNumber === slot.slotNumber) || { slotNumber: slot.slotNumber };
                          const gameLabel = `#${slot.slotNumber} ${slot.label}`;
                          return (
                            <View key={slot.slotNumber} style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: '#E2E8F0' }}>
                              <Text style={{ fontSize: 10, fontWeight: '800', color: TEXT_MUTED, letterSpacing: 0.5, marginBottom: 6 }}>
                                {gameLabel}
                              </Text>
                              <View style={{ gap: 6 }}>
                                {renderPos(row, 'player1', gameLabel)}
                                {renderPos(row, 'player2', gameLabel)}
                              </View>
                            </View>
                          );
                        })}
                      </>
                    );
                  })()}
                </>
              )}

              {/* Full-team picker — any player, any category. Shown after tapping
                  a "Fill substitute" slot. Selecting fills that slot and flags
                  the player as a substitute (stats for this game excluded). */}
              {fillTarget && (() => {
                const roster = substituteModal.team === 'home' ? teamRosters.home : teamRosters.away;
                return (
                  <>
                    <TouchableOpacity onPress={() => setFillTarget(null)} disabled={substituteSubmitting} style={{ marginBottom: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: BLUE }}>‹ Back to lineup</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: NAVY }}>
                      Fill {fillTarget.label} · {fillTarget.position === 'player1' ? 'Player 1' : 'Player 2'}
                    </Text>
                    <Text style={{ fontSize: 11, color: TEXT_SUB, marginTop: 2, marginBottom: 10 }}>
                      Pick any player from the squad — they'll be tagged as a substitute for this game.
                    </Text>
                    {(!roster || roster.length === 0) ? (
                      <Text style={{ fontSize: 12, color: TEXT_SUB, fontStyle: 'italic' }}>Roster not loaded.</Text>
                    ) : (
                      roster.map((r: any) => (
                        <TouchableOpacity
                          key={r.id || r.playerId}
                          disabled={substituteSubmitting}
                          onPress={() => applyFill(r.playerId)}
                          activeOpacity={0.7}
                          style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 6 }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '700', color: NAVY }}>
                            {r.player?.fullName || r.player?.displayName || playerMap[r.playerId] || 'Player'}
                          </Text>
                          <Text style={{ fontSize: 11, color: TEXT_SUB, marginTop: 2 }}>Category: {r.categorySlug || '—'}</Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </>
                );
              })()}

            </ScrollView>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => { setFillTarget(null); setSubstituteModal({ visible: false, team: 'home', oldPlayerId: null, newPlayerId: null }); }}
                disabled={substituteSubmitting}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 10,
                  backgroundColor: NAVY,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: WHITE, letterSpacing: 0.5 }}>DONE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Admin slot-swap modal — single-slot single-player replace.
          Lists same-category candidates from the team's active roster. */}
      <Modal
        visible={slotSwapModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => !slotSwapSubmitting && setSlotSwapModal((s) => ({ ...s, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>Replace Player</Text>
            <Text style={styles.modalSubtitle}>
              Slot #{slotSwapModal.slotNumber} {slotSwapModal.slotLabel} — {slotSwapModal.position === 'player1' ? 'Player 1' : 'Player 2'}
              {'\n'}Replacing: <Text style={{ fontWeight: '700', color: NAVY }}>{slotSwapModal.currentPlayerName}</Text>
            </Text>

            <Text style={{ fontSize: 11, fontWeight: '800', color: TEXT_SUB, letterSpacing: 1, marginTop: 16, marginBottom: 8 }}>
              SAME-CATEGORY CANDIDATES
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {(() => {
                const PER_POSITION: Record<number, [string[], string[]]> = {
                  1: [['kids'], ['kids']],
                  2: [['kids'], ['teen']],
                  3: [['teen'], ['teen']],
                  4: [['women1'], ['women1']],
                  5: [['women1'], ['men1']],
                  6: [['women2'], ['women2']],
                  7: [['women2'], ['women2']],
                  8: [['women2'], ['men2']],
                  9: [['men1'], ['men1']],
                  10: [['men2'], ['men2']],
                  11: [['men3'], ['men3']],
                  12: [['men3'], ['men3']],
                  13: [['men3'], ['men3']],
                };
                const cats = PER_POSITION[slotSwapModal.slotNumber] || [['kids'], ['kids']];
                const allowed = slotSwapModal.position === 'player1' ? cats[0] : cats[1];
                const roster = slotSwapModal.team === 'home' ? teamRosters.home : teamRosters.away;
                const candidates = (roster as any[]).filter(
                  (r) =>
                    r.playerId !== slotSwapModal.currentPlayerId &&
                    (r.status ? r.status === 'active' : true) &&
                    allowed.includes(r.categorySlug),
                );
                if (candidates.length === 0) {
                  return (
                    <Text style={{ fontSize: 12, color: TEXT_MUTED, fontStyle: 'italic', padding: 12 }}>
                      No same-category replacements available on this team's roster.
                    </Text>
                  );
                }
                return candidates.map((r) => (
                  <TouchableOpacity
                    key={r.playerId}
                    onPress={() => handleSlotSwap(r.playerId)}
                    disabled={slotSwapSubmitting}
                    style={{
                      backgroundColor: SURFACE,
                      padding: 12,
                      borderRadius: 8,
                      marginBottom: 6,
                      opacity: slotSwapSubmitting ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: NAVY }}>
                      {r.player?.fullName || r.player?.displayName || playerMap[r.playerId] || 'Player'}
                    </Text>
                    <Text style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
                      Roster category: {r.categorySlug}
                    </Text>
                  </TouchableOpacity>
                ));
              })()}
            </ScrollView>

            <View style={{ marginTop: 16, flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => !slotSwapSubmitting && setSlotSwapModal((s) => ({ ...s, visible: false }))}
                disabled={slotSwapSubmitting}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: BORDER,
                  alignItems: 'center',
                  opacity: slotSwapSubmitting ? 0.5 : 1,
                }}
              >
                <Text style={{ fontWeight: '700', color: TEXT_SUB }}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default TieDetailScreen;

// ═════════════════════════════════════════════════════════════════════════════
// Styles
// ═════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: TEXT_SUB },

  // Header banner — cream surface, ink text (Yoiden style)
  headerBanner: {
    backgroundColor: YColors.bg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 14,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: YColors.line,
  },
  headerNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 999, borderWidth: 1, borderColor: YColors.line2, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: YColors.ink, fontSize: 18, fontWeight: '700' },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  statusChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },

  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  teamBlock: { flex: 1, alignItems: 'center' },
  teamName: { color: YColors.ink, fontSize: 16, fontWeight: '900', textAlign: 'center', lineHeight: 20, letterSpacing: 0.3 },
  teamLabel: { color: YColors.ink3, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: 4 },

  scoreBlock: { alignItems: 'center', marginHorizontal: 12 },
  scoreText: { color: YColors.ink, fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  scoreSub: { color: YColors.ink3, fontSize: 10, marginTop: 2 },

  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  bonusSide: { alignItems: 'center' },
  bonusValue: { color: GREEN, fontSize: 14, fontWeight: '800' },
  bonusLabel: { color: YColors.ink3, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: 2 },

  standingPointsBox: {
    backgroundColor: YColors.bg3,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: YColors.line2,
  },
  spLabel: { color: YColors.ink2, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  spText: { color: YColors.ink, fontSize: 16, fontWeight: '900', marginTop: 4 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },
  roundBadge: {
    backgroundColor: YColors.ink,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  roundBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  metaDate: { color: YColors.ink3, fontSize: 12, fontWeight: '600' },

  // Tie sheet status bar
  tieSheetBar: {
    backgroundColor: WHITE,
    marginHorizontal: 16,
    marginTop: -8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  tieSheetTitle: { fontSize: 13, fontWeight: '800', color: NAVY, marginBottom: 10, letterSpacing: 0.3 },
  tieSheetRow: { flexDirection: 'row', gap: 12 },
  sheetStatus: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  sheetTeam: { fontSize: 12, fontWeight: '700', color: TEXT_COLOR, marginBottom: 4 },
  sheetBadge: { fontSize: 12, fontWeight: '600' },
  lockBtn: {
    backgroundColor: PURPLE,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  lockBtnText: { color: WHITE, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  // Matches section
  matchesSection: { paddingHorizontal: 16, paddingTop: 20 },
  matchesSectionTitle: { fontSize: 16, fontWeight: '800', color: NAVY, marginBottom: 12, letterSpacing: -0.2 },

  // Match card
  matchCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  matchCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  matchSlot: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchSlotText: { fontSize: 11, fontWeight: '700', color: TEXT_SUB },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  categoryBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  pointBadge: {
    backgroundColor: NAVY,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pointBadgeText: { color: WHITE, fontSize: 10, fontWeight: '700' },
  courtBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: '#C4B5FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  courtBadgeText: { color: '#6D28D9', fontSize: 10, fontWeight: '800' },
  courtBadgePencil: { color: '#6D28D9', fontSize: 11, fontWeight: '800' },
  matchStatusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 'auto' },

  matchPlayers: { flexDirection: 'row', alignItems: 'center' },
  matchPlayerSide: { flex: 1 },
  matchPlayerText: { fontSize: 13, fontWeight: '600', color: TEXT_COLOR },
  matchScoreCenter: {
    minWidth: 60,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  matchScoreText: { fontSize: 18, fontWeight: '800', color: TEXT_COLOR },
  matchScorePending: { fontSize: 16, fontWeight: '600', color: TEXT_MUTED },

  matchBonusRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  matchBonusText: { fontSize: 11, fontWeight: '600', color: GREEN },

  // Bottom actions
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: WHITE,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  actionBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnText: { color: WHITE, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  // Score modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: NAVY, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: TEXT_SUB, marginBottom: 24 },

  scoreInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  scoreInputBlock: { alignItems: 'center' },
  scoreInputLabel: { fontSize: 12, fontWeight: '700', color: TEXT_SUB, marginBottom: 8 },
  scoreInput: {
    width: 80,
    height: 60,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BORDER,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '800',
    color: NAVY,
  },
  scoreDash: { fontSize: 28, fontWeight: '800', color: TEXT_MUTED },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 28 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: SURFACE,
  },
  modalCancelText: { color: TEXT_SUB, fontSize: 14, fontWeight: '700' },
  modalSaveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: GREEN,
  },
  modalSaveText: { color: NAVY, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
});
