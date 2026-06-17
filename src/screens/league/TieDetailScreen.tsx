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
  startTie,
  completeTie,
  submitTieSheet,
  getRoster,
  bulkUpdateTies,
  adminLiveScore,
  adminFinalizeMatch,
  adminDeclareWinner,
  getLeague,
  listScorers,
  resetLeagueTie,
  substitutePlayer,
  adminSwapSlotPlayer,
} from '../../api/leagues.api';
import { matchesApi } from '../../api/matches.api';
import { useLeagueStore } from '../../store/leagueStore';
import { useAuthStore } from '../../store/authStore';
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
const CATEGORY_COLORS: Record<CategorySlug, { color: string; bg: string; label: string }> = {
  kids: { color: PURPLE, bg: '#EDE9FE', label: 'Kids' },
  teen: { color: ORANGE, bg: '#FFF7ED', label: 'Teen' },
  women1: { color: PINK, bg: '#FCE7F3', label: 'Women 1' },
  women2: { color: PINK, bg: '#FCE7F3', label: 'Women 2' },
  men1: { color: BLUE, bg: '#DBEAFE', label: 'Men 1' },
  men2: { color: BLUE, bg: '#DBEAFE', label: 'Men 2' },
  men3: { color: BLUE, bg: '#DBEAFE', label: 'Men 3' },
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
  const isAdmin = !!authUser?.id && league?.organizerId === authUser.id;
  const [isScorer, setIsScorer] = useState(false);
  const [scorersList, setScorersList] = useState<Array<{ id: string; userId: string; name: string; phone: string }>>([]);
  const [tie, setTie] = useState<Tie | null>(null);
  // Scorers can only score the ties they're assigned to (tie.scorerId === user.id).
  // Admin/organizer can always score.
  const isAssignedScorer = !!authUser?.id && isScorer && !!tie?.scorerId && tie.scorerId === authUser.id;
  const canScore = isAdmin || isAssignedScorer;

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

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Player name map (playerId → name)
  const [playerMap, setPlayerMap] = useState<Record<string, string>>({});
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

  // Score modal +/- counters (replace old text inputs)
  const [scoreVals, setScoreVals] = useState<{ a: number; b: number }>({ a: 0, b: 0 });
  const [livePushStatus, setLivePushStatus] = useState<'idle' | 'syncing' | 'live' | 'error'>('idle');
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
    setScoreModal({ visible: true, tieMatch: tm });
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
    setScoreVals((prev) => {
      const next = { ...prev };
      if (side === 'a') next.a = Math.max(0, Math.min(cap, next.a + delta));
      else next.b = Math.max(0, Math.min(cap, next.b + delta));
      schedulePush(tm, next.a, next.b);
      return next;
    });
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
    const slots = slotNumbers.map((slotNum) => {
      const homeSlot = homeSheet?.lineupData?.find((s: any) => s.slotNumber === slotNum);
      const awaySlot = awaySheet?.lineupData?.find((s: any) => s.slotNumber === slotNum);
      return {
        slotNumber: slotNum,
        gameLabel: SPPL_TIE_SHEET_LABELS[slotNum] || (slotNum === 0 ? 'Rally' : `Game ${slotNum}`),
        team1Player1: nameOf(homeSlot?.player1Id),
        team1Player2: nameOf(homeSlot?.player2Id),
        team2Player1: nameOf(awaySlot?.player1Id),
        team2Player2: nameOf(awaySlot?.player2Id),
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
    return tms.map((tm) => {
      const sppl = SPPL_MATCH_SLOTS.find((s) => s.slotNumber === tm.slotNumber);
      const generic = tm.categorySlug === ('open' as any) || !sppl;
      return {
        slotNumber: tm.slotNumber,
        categorySlug: tm.categorySlug,
        allowedCategories: generic ? [] : sppl!.allowedCategories,
        label: generic ? `Game ${tm.slotNumber}` : sppl!.label,
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

      // Bonus rules branch on scoringMode.
      // rally_21 (knockout): loser≤7 / 14-19+win=21 / 20+win=21
      // rally_15 (default):  loser≤4 / 11-13+win=15 / 14
      const mode = (m as any).scoringMode;
      if (mode === 'rally_21') {
        if (loserScore <= 7) {
          if (homeWon) homeBonus += 2; else awayBonus += 2;
        } else if (loserScore >= 14 && loserScore <= 19 && winnerScore === 21) {
          if (homeWon) awayBonus += 1; else homeBonus += 1;
        } else if (loserScore === 20 && winnerScore === 21) {
          if (homeWon) awayBonus += 2; else homeBonus += 2;
        }
      } else {
        if (loserScore <= 4) {
          if (homeWon) homeBonus += 2; else awayBonus += 2;
        } else if (loserScore >= 11 && loserScore <= 13 && winnerScore === 15) {
          if (homeWon) awayBonus += 1; else homeBonus += 1;
        } else if (loserScore === 14) {
          if (homeWon) awayBonus += 2; else homeBonus += 2;
        }
      }
    }
    return {
      homeMP, awayMP, homeBonus, awayBonus,
      homeSP: homeMP + homeBonus,
      awaySP: awayMP + awayBonus,
      completed: tieMatches.filter((tm: any) => tm.match?.status === 'completed').length,
      total: tieMatches.length,
    };
  }, [tie]);

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
        <YDisplay size={48} color={YColors.ink} style={{ marginTop: 4, lineHeight: 50 }}>{`${liveScores.homeSP} – ${liveScores.awaySP}`}</YDisplay>
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
    const currentScorerId = (tie as any).scorerId ?? null;

    const updateTie = async (patch: { courtNumber?: number | null; scorerId?: string | null }) => {
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
    return (
      <View style={styles.tieSheetBar}>
        <Text style={styles.tieSheetTitle}>Tie Controls</Text>

        {/* Court picker */}
        <Text style={{ fontSize: 11, fontWeight: '800', color: NAVY, letterSpacing: 1, marginTop: 8, marginBottom: 6 }}>COURT</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {COURTS.map((c) => {
            const selected = currentCourt === c;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => updateTie({ courtNumber: selected ? null : c })}
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
          {currentCourt !== null && (
            <TouchableOpacity
              onPress={() => updateTie({ courtNumber: null })}
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

        {/* Scorer picker */}
        <Text style={{ fontSize: 11, fontWeight: '800', color: NAVY, letterSpacing: 1, marginTop: 14, marginBottom: 6 }}>SCORER</Text>
        {scorersList.length === 0 ? (
          <Text style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic' }}>
            No scorers added yet. Add from League Dashboard → Scorers.
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {scorersList.map((s) => {
              const selected = currentScorerId === s.userId;
              return (
                <TouchableOpacity
                  key={s.userId}
                  onPress={() => updateTie({ scorerId: selected ? null : s.userId })}
                  disabled={actionLoading}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: selected ? '#06D6A0' : '#F1F5F9',
                    borderWidth: 1,
                    borderColor: selected ? '#06D6A0' : '#E2E8F0',
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: selected ? WHITE : NAVY }}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {currentScorerId && (
              <TouchableOpacity
                onPress={() => updateTie({ scorerId: null })}
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
  }> => {
    if (!tie) return [];
    const map = new Map<string, Set<string>>();
    // Collect categories where this team has at least one NULL player slot
    // so we can surface a synthetic SUBSTITUTE entry the admin can replace.
    const subCats = new Set<string>();
    for (const tm of tie.tieMatches || []) {
      const ids = team === 'home'
        ? [tm.homePlayer1Id, tm.homePlayer2Id]
        : [tm.awayPlayer1Id, tm.awayPlayer2Id];
      for (const id of ids) {
        if (!id) {
          // NULL = substitute placeholder waiting to be filled.
          subCats.add(tm.categorySlug);
          continue;
        }
        if (!map.has(id)) map.set(id, new Set());
        map.get(id)!.add(tm.categorySlug);
      }
    }
    const named = Array.from(map.entries()).map(([pid, cats]) => ({
      playerId: pid,
      name: playerMap[pid] || 'Player',
      categories: Array.from(cats),
    }));
    // Append the substitute placeholder entry (if any). The pseudo-id
    // 'SUBSTITUTE' is recognised server-side and matched against null slots.
    if (subCats.size > 0) {
      named.push({
        playerId: 'SUBSTITUTE',
        name: 'Substitute placeholder',
        categories: Array.from(subCats),
      });
    }
    return named;
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
        </View>
      </View>

      {/* Lock / Re-lock button — admin only. Scorers see the locked status
          via the panel above but don't get the re-lock action since lineups
          are an organizer decision, not a scorer one. */}
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
    // Rally Point Game can be scored any time after tie starts (no lineup gate)
    const canEnterScore = canScore && (
      isRally
        ? (tie.status === 'in_progress' || tie.status === 'lineup_locked' || tie.status === 'scheduled' || tie.status === 'lineup_submitted')
        : (tie.status === 'in_progress' || tie.status === 'lineup_locked')
    );

    return (
      <TouchableOpacity
        key={tm.id}
        style={[styles.matchCard, isRally && { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#93C5FD' }]}
        activeOpacity={canEnterScore ? 0.7 : 1}
        onPress={() => canEnterScore && openScoreEntry(tm)}
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
                  : tm.homePlayer1Id
                    ? `${playerMap[tm.homePlayer1Id] || 'Player'} & ${playerMap[tm.homePlayer2Id || ''] || 'Player'}`
                    : 'TBD'}
            </Text>
          </View>
          <View style={styles.matchScoreCenter}>
            {scores ? (
              <YDisplay size={26} color={isCompleted ? YColors.accent : YColors.ink} style={{ lineHeight: 28 }}>{`${scores.teamAScore}–${scores.teamBScore}`}</YDisplay>
            ) : (
              <YDisplay size={22} color={YColors.ink4} style={{ lineHeight: 24 }}>–</YDisplay>
            )}
          </View>
          <View style={styles.matchPlayerSide}>
            <Text style={[styles.matchPlayerText, { textAlign: 'right' }]} numberOfLines={2}>
              {isRally
                ? awayName
                : !canSeeLineups
                  ? awayName
                  : tm.awayPlayer1Id
                    ? `${playerMap[tm.awayPlayer1Id] || 'Player'} & ${playerMap[tm.awayPlayer2Id || ''] || 'Player'}`
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
          // Bonus — branch on scoringMode (rally_21 knockouts vs rally_15 league)
          let homeBonusPts = 0, awayBonusPts = 0;
          const matchMode = (tm.match as any)?.scoringMode;
          if (matchMode === 'rally_21') {
            if (loserScore <= 7) {
              if (homeWon) homeBonusPts = 2; else awayBonusPts = 2;
            } else if (loserScore >= 14 && loserScore <= 19 && winnerScore === 21) {
              if (homeWon) awayBonusPts = 1; else homeBonusPts = 1;
            } else if (loserScore === 20 && winnerScore === 21) {
              if (homeWon) awayBonusPts = 2; else homeBonusPts = 2;
            }
          } else {
            if (loserScore <= 4) {
              if (homeWon) homeBonusPts = 2; else awayBonusPts = 2;
            } else if (loserScore >= 11 && loserScore <= 13 && winnerScore === 15) {
              if (homeWon) awayBonusPts = 1; else homeBonusPts = 1;
            } else if (loserScore === 14) {
              if (homeWon) awayBonusPts = 2; else homeBonusPts = 2;
            }
          }
          return (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
              {/* Home points */}
              <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                {homeMatchPts > 0 && (
                  <View style={{ backgroundColor: '#DBEAFE', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#2196F3' }}>+{homeMatchPts}</Text>
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
              <Text style={{ fontSize: 10, fontWeight: '700', color: homeWon ? '#2196F3' : '#F97316' }}>
                {homeWon ? '← WIN' : 'WIN →'}
              </Text>
              {/* Away points */}
              <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                {awayMatchPts > 0 && (
                  <View style={{ backgroundColor: '#DBEAFE', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#2196F3' }}>+{awayMatchPts}</Text>
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
                const picks = lineupSlots[slot.slotNumber] || { player1Id: '', player2Id: '' };
                // Fallback to full roster only if no eligible players configured at all
                const allPlayers = rosterPlayers;
                const p1Players = p1CatPlayers.length > 0 ? p1CatPlayers : allPlayers;
                const p2Players = p2CatPlayers.length > 0 ? p2CatPlayers : allPlayers;

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
        {isAdmin && (tie.round || '').startsWith('league_week_') && tie.status !== 'scheduled' && (
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
          {tie.status === 'lineup_locked' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: BLUE }]}
              onPress={handleStartTie}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={WHITE} />
              ) : (
                <Text style={styles.actionBtnText}>START TIE</Text>
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

      {/* Substitute Player Modal — admin/scorer-only. Pick a team, pick the
          rostered player to remove, pick the replacement (any category in
          the team's full roster), confirm. */}
      <Modal
        visible={substituteModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => !substituteSubmitting && setSubstituteModal({ visible: false, team: 'home', oldPlayerId: null, newPlayerId: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>Substitute Player</Text>
            <Text style={styles.modalSubtitle}>
              Replace one rostered player with another. Only matches that haven't started yet are affected.
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
                    onPress={() => setSubstituteModal((p) => ({
                      ...p,
                      team: side,
                      // Reset selections when switching teams since the rosters differ.
                      oldPlayerId: null,
                      newPlayerId: null,
                    }))}
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
              {/* Player to replace — picks from current lineup only (deduped across matches) */}
              <Text style={{ fontSize: 11, fontWeight: '800', color: TEXT_SUB, letterSpacing: 1, marginBottom: 8 }}>
                REPLACE
              </Text>
              {(() => {
                const lineup = lineupPlayersForTeam(substituteModal.team);
                if (lineup.length === 0) {
                  return (
                    <Text style={{ fontSize: 12, color: TEXT_SUB, fontStyle: 'italic', marginBottom: 8 }}>
                      No players are currently in this team's lineup. The captain may need to submit the tie sheet first.
                    </Text>
                  );
                }
                return lineup.map((p) => {
                  const selected = substituteModal.oldPlayerId === p.playerId;
                  return (
                    <TouchableOpacity
                      key={p.playerId}
                      onPress={() => setSubstituteModal((prev) => ({ ...prev, oldPlayerId: p.playerId }))}
                      disabled={substituteSubmitting}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        backgroundColor: selected ? '#FEE2E2' : '#F8FAFC',
                        borderWidth: 1,
                        borderColor: selected ? '#FCA5A5' : '#E2E8F0',
                        marginBottom: 6,
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: NAVY }}>{p.name}</Text>
                      <Text style={{ fontSize: 11, color: TEXT_SUB, marginTop: 2 }}>
                        Playing in: {p.categories.join(', ')}
                      </Text>
                    </TouchableOpacity>
                  );
                });
              })()}

              {/* Replacement — picks from full team roster (all categories) */}
              <Text style={{ fontSize: 11, fontWeight: '800', color: TEXT_SUB, letterSpacing: 1, marginTop: 14, marginBottom: 8 }}>
                WITH
              </Text>
              {(() => {
                const roster = substituteModal.team === 'home' ? teamRosters.home : teamRosters.away;
                if (!roster || roster.length === 0) {
                  return (
                    <Text style={{ fontSize: 12, color: TEXT_SUB, fontStyle: 'italic' }}>
                      Roster not loaded.
                    </Text>
                  );
                }
                // Hide the player being replaced from the replacement list (clearer UX).
                const candidates = roster.filter((r: any) => r.playerId !== substituteModal.oldPlayerId);
                if (candidates.length === 0) {
                  return (
                    <Text style={{ fontSize: 12, color: TEXT_SUB, fontStyle: 'italic' }}>
                      No other roster players available.
                    </Text>
                  );
                }
                return candidates.map((r: any) => {
                  const selected = substituteModal.newPlayerId === r.playerId;
                  const name = r.player?.fullName || r.player?.displayName || playerMap[r.playerId] || 'Player';
                  return (
                    <TouchableOpacity
                      key={r.id || r.playerId}
                      onPress={() => setSubstituteModal((prev) => ({ ...prev, newPlayerId: r.playerId }))}
                      disabled={substituteSubmitting}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        backgroundColor: selected ? '#DCFCE7' : '#F8FAFC',
                        borderWidth: 1,
                        borderColor: selected ? '#86EFAC' : '#E2E8F0',
                        marginBottom: 6,
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: NAVY }}>{name}</Text>
                      <Text style={{ fontSize: 11, color: TEXT_SUB, marginTop: 2 }}>
                        Roster category: {r.categorySlug || '—'}
                      </Text>
                    </TouchableOpacity>
                  );
                });
              })()}
            </ScrollView>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => setSubstituteModal({ visible: false, team: 'home', oldPlayerId: null, newPlayerId: null })}
                disabled={substituteSubmitting}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 10,
                  backgroundColor: '#F1F5F9',
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: NAVY }}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubstitute}
                disabled={substituteSubmitting || !substituteModal.oldPlayerId || !substituteModal.newPlayerId}
                style={{
                  flex: 1.4,
                  paddingVertical: 14,
                  borderRadius: 10,
                  backgroundColor: NAVY,
                  alignItems: 'center',
                  opacity: substituteSubmitting || !substituteModal.oldPlayerId || !substituteModal.newPlayerId ? 0.5 : 1,
                }}
              >
                {substituteSubmitting ? (
                  <ActivityIndicator color={WHITE} />
                ) : (
                  <Text style={{ fontSize: 13, fontWeight: '800', color: WHITE, letterSpacing: 0.5 }}>
                    APPLY SUBSTITUTION
                  </Text>
                )}
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
