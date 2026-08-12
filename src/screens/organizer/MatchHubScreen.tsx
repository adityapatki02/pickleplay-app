import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
  TextInput,
  Modal,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';

import apiClient from '../../api/client';
import { matchesApi } from '../../api/matches.api';
import { tournamentsApi } from '../../api/tournaments.api';
import { registrationsApi } from '../../api/registrations.api';
import { xAlert, xConfirm } from '../../utils/alert';
import { buildExportFilename } from '../../utils/downloadAsJpg';
import DownloadJpgButton from '../../components/ui/DownloadJpgButton';
import { BracketData, TournamentCategory } from '../../types/tournament.types';

// ═══════════════════════════════════════════════════════════════════════════
// Theme tokens
// ═══════════════════════════════════════════════════════════════════════════

const COLORS = {
  bg: '#FFFFFF',
  surface: '#F5F7FA',
  surfaceAlt: '#F9FAFB',
  border: '#E2E8F0',
  navy: '#001E40',
  blue: '#1858D6',
  green: '#06D6A0',
  warn: '#FFB300',
  red: '#EF4444',
  text: '#1A1D21',
  textSub: '#64748B',
  textMuted: '#94A3B8',
  white: '#FFFFFF',
};

const GROUP_LETTERS = 'ABCDEFGHIJKLMNOP';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface SeedPartner {
  userId: string;
  userName: string;
  displayName?: string;
  phone?: string;
  rating: number | null;
}

interface SeedPlayer {
  id: string;
  userId: string;
  teamId?: string;
  userName: string;
  displayName?: string;
  city?: string;
  skillLevel?: string;
  phone?: string;
  rating: number | null;
  registeredAt: string;
  isDoubles?: boolean;
  partner?: SeedPartner | null;
}

interface ScheduledMatch {
  id: string;
  matchNumber: number;
  round: string;
  teamAId: string;
  teamBId: string;
  status: string;
  winnerId?: string;
  courtId?: string;
  courtName?: string;
  scheduledStart?: string;
  scores?: any[];
  categoryId?: string;
}

type TabKey = 'teams' | 'draws' | 'live';

// ═══════════════════════════════════════════════════════════════════════════
// Small presentational helpers
// ═══════════════════════════════════════════════════════════════════════════

const TeamNameDisplay = ({
  name,
  size = 'md',
  checkedIn,
  onCheckIn,
}: {
  name: string;
  size?: 'sm' | 'md';
  checkedIn?: boolean;
  onCheckIn?: () => void;
}) => {
  const parts = name.split(' / ');
  const fontSize = size === 'sm' ? 12 : 13;
  const subSize = size === 'sm' ? 10 : 11;
  const indicator = checkedIn === true ? '✓' : checkedIn === false ? '⏳' : null;
  const indicatorColor = checkedIn ? COLORS.green : COLORS.warn;

  const Indicator = () => {
    if (indicator === null) return null;
    if (checkedIn === false && onCheckIn) {
      return (
        <TouchableOpacity onPress={onCheckIn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ color: indicatorColor, fontSize: 12, fontWeight: '700' }}>{indicator}</Text>
        </TouchableOpacity>
      );
    }
    return <Text style={{ color: indicatorColor, fontSize: 10 }}>{indicator}</Text>;
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
      <Indicator />
      <View style={{ flex: 1 }}>
        <Text style={{ color: COLORS.text, fontSize, fontWeight: '700' }} numberOfLines={1}>
          {parts[0]}
        </Text>
        {parts[1] && (
          <Text style={{ color: COLORS.textSub, fontSize: subSize, fontWeight: '600' }} numberOfLines={1}>
            {parts[1]}
          </Text>
        )}
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Inline score entry (for a single match)
// ═══════════════════════════════════════════════════════════════════════════

const InlineScore = ({
  matchId,
  teamAId,
  teamBId,
  teamAName,
  teamBName,
  existingScores,
  matchFormat = 'best_of_1',
  onDone,
}: {
  matchId: string;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  existingScores?: any[];
  matchFormat?: string;
  onDone: () => void;
}) => {
  // Parse best-of from format
  const bestOfMatch = matchFormat.match(/best_of_(\d+)/);
  const bestOf = bestOfMatch ? parseInt(bestOfMatch[1], 10) : 1;
  const totalGames = bestOf; // max possible games

  // Initialize game scores from existing data
  const initScores = () => {
    const games: { a: string; b: string }[] = [];
    for (let i = 0; i < totalGames; i++) {
      const existing = existingScores?.find((s: any) => s.gameNumber === i + 1);
      games.push({
        a: existing?.teamAScore?.toString() ?? '',
        b: existing?.teamBScore?.toString() ?? '',
      });
    }
    return games;
  };

  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [games, setGames] = useState(initScores);
  const [saving, setSaving] = useState(false);

  // Compute how many games are "decided" and if we can stop early
  const winsNeeded = Math.ceil(bestOf / 2);
  let aWins = 0;
  let bWins = 0;
  let gamesNeeded = totalGames;
  for (let i = 0; i < totalGames; i++) {
    const a = parseInt(games[i].a, 10);
    const b = parseInt(games[i].b, 10);
    if (!isNaN(a) && !isNaN(b) && (a > 0 || b > 0)) {
      if (a > b) aWins++;
      else if (b > a) bWins++;
    }
    if (aWins >= winsNeeded || bWins >= winsNeeded) {
      gamesNeeded = i + 1;
      break;
    }
  }

  // Auto-detect winner from scores
  const autoWinner = aWins >= winsNeeded ? teamAId : bWins >= winsNeeded ? teamBId : null;

  const updateGame = (gameIdx: number, team: 'a' | 'b', value: string) => {
    setGames((prev) => {
      const next = [...prev];
      next[gameIdx] = { ...next[gameIdx], [team]: value.replace(/[^0-9]/g, '') };
      return next;
    });
  };

  const handleSave = async () => {
    const finalWinner = winnerId || autoWinner;
    if (!finalWinner) {
      xAlert('Select Winner', bestOf > 1
        ? 'Enter scores for enough games, or tap a team to select the winner.'
        : 'Tap on the winning team first.');
      return;
    }
    setSaving(true);
    try {
      // Collect all games with valid scores
      const scorePayload: { gameNumber: number; teamAScore: number; teamBScore: number }[] = [];
      for (let i = 0; i < gamesNeeded; i++) {
        const a = parseInt(games[i].a, 10);
        const b = parseInt(games[i].b, 10);
        if (!isNaN(a) && !isNaN(b)) {
          scorePayload.push({ gameNumber: i + 1, teamAScore: a, teamBScore: b });
        }
      }

      if (scorePayload.length > 0) {
        await matchesApi.enterScore(matchId, scorePayload);
      } else {
        await matchesApi.setWalkover(matchId, finalWinner);
      }
      onDone();
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const aShort = teamAName.split(' / ');
  const bShort = teamBName.split(' / ');
  const effectiveWinner = winnerId || autoWinner;

  // Helper to render a team card with score inputs inline
  const renderTeamCard = (
    tId: string,
    names: string[],
    side: 'a' | 'b',
  ) => {
    const isWinner = effectiveWinner === tId;
    const isLoser = effectiveWinner && effectiveWinner !== tId;

    const headerContent = (
      <View style={scoreStyles.teamCardHeader}>
        <View style={{ flex: 1 }}>
          <Text
            style={[scoreStyles.teamCardName, isWinner && scoreStyles.teamCardNameWinner]}
            numberOfLines={1}
          >
            {names[0]}
          </Text>
          {names[1] && (
            <Text style={scoreStyles.teamCardSub} numberOfLines={1}>
              {names[1]}
            </Text>
          )}
        </View>
        {isWinner && (
          <View style={scoreStyles.winnerBadge}>
            <Text style={scoreStyles.winnerBadgeText}>WINNER</Text>
          </View>
        )}
        {!effectiveWinner && (
          <View style={scoreStyles.tapHint}>
            <Text style={scoreStyles.tapHintText}>TAP</Text>
          </View>
        )}
      </View>
    );

    const scoreInputs = effectiveWinner ? (
      <View style={scoreStyles.scoresInline}>
        {Array.from({
          length: bestOf > 1
            ? gamesNeeded + (gamesNeeded < totalGames && !autoWinner ? 1 : 0)
            : 1,
        }).map((_, i) => {
          if (i >= totalGames) return null;
          if (autoWinner !== null && i >= gamesNeeded) return null;
          return (
            <View key={i} style={scoreStyles.gameInputWrap}>
              <Text style={scoreStyles.gameInputLabel}>
                {bestOf > 1 ? `G${i + 1}` : 'Score'}
              </Text>
              <TextInput
                style={[
                  scoreStyles.gameInput,
                  isWinner && scoreStyles.gameInputWinner,
                ]}
                value={games[i][side]}
                onChangeText={(v) => updateGame(i, side, v)}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="—"
                placeholderTextColor={COLORS.textMuted}
                textAlign="center"
              />
            </View>
          );
        })}
      </View>
    ) : null;

    // Before winner is selected: entire card is tappable
    if (!effectiveWinner) {
      return (
        <TouchableOpacity
          style={[scoreStyles.teamCard]}
          onPress={() => setWinnerId(tId)}
          activeOpacity={0.7}
        >
          {headerContent}
        </TouchableOpacity>
      );
    }

    // After winner selected: only header is tappable (to change winner), scores are plain View
    return (
      <View
        style={[
          scoreStyles.teamCard,
          isWinner && scoreStyles.teamCardWinner,
          isLoser && scoreStyles.teamCardLoser,
        ]}
      >
        <TouchableOpacity onPress={() => setWinnerId(tId)} activeOpacity={0.7}>
          {headerContent}
        </TouchableOpacity>
        {scoreInputs}
      </View>
    );
  };

  return (
    <View style={scoreStyles.container}>
      <Text style={scoreStyles.stepLabel}>
        {effectiveWinner ? 'ENTER SCORES' : 'TAP THE WINNING TEAM'}
      </Text>

      {renderTeamCard(teamAId, aShort, 'a')}
      <Text style={scoreStyles.vsLabel}>vs</Text>
      {renderTeamCard(teamBId, bShort, 'b')}

      {bestOf > 1 && autoWinner && (
        <Text style={scoreStyles.seriesResult}>
          {autoWinner === teamAId ? aShort[0] : bShort[0]} wins {Math.max(aWins, bWins)}–{Math.min(aWins, bWins)}
        </Text>
      )}

      <TouchableOpacity
        style={[scoreStyles.saveBtn, (!effectiveWinner || saving) && { opacity: 0.4 }]}
        onPress={handleSave}
        disabled={!effectiveWinner || saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={scoreStyles.saveBtnText}>
            {effectiveWinner ? 'SAVE RESULT' : 'SELECT WINNER FIRST'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Player row (Teams tab)
// ═══════════════════════════════════════════════════════════════════════════

const PlayerRow = ({
  player,
  index,
  total,
  onMoveUp,
  onMoveDown,
  locked = false,
}: {
  player: SeedPlayer;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  locked?: boolean;
}) => {
  const hasRating = player.rating != null && Number(player.rating) > 2.0;
  const phone = player.phone ? player.phone.replace('+91', '') : '';
  const p1Name = player.displayName ?? player.userName;
  const isDoubles = !!player.isDoubles;
  const hasPartner = isDoubles && !!player.partner;
  const p2Name = hasPartner ? player.partner!.displayName ?? player.partner!.userName : null;
  const p2HasRating =
    hasPartner && player.partner!.rating != null && Number(player.partner!.rating) > 2.0;

  return (
    <View style={s.playerRow}>
      <View style={s.seedBadge}>
        <Text style={s.seedNum}>{index + 1}</Text>
      </View>
      <View style={s.playerInfo}>
        <View style={s.teamPlayerLine}>
          <Text style={s.playerName} numberOfLines={1}>
            {p1Name}
          </Text>
          {phone ? <Text style={s.phoneInline}>☎ {phone}</Text> : null}
        </View>
        {isDoubles && hasPartner && p2Name ? (
          <View style={s.teamPlayerLine}>
            <Text style={s.partnerName} numberOfLines={1}>
              {p2Name}
            </Text>
            {player.partner!.phone ? (
              <Text style={s.phoneInline}>☎ {player.partner!.phone.replace('+91', '')}</Text>
            ) : null}
          </View>
        ) : isDoubles && !hasPartner ? (
          <View style={s.partnerNeededWrap}>
            <Text style={s.partnerNeededText}>PARTNER NEEDED</Text>
          </View>
        ) : null}
      </View>

      <View style={s.ratingCol}>
        {hasRating ? (
          <View style={s.ratingBadge}>
            <Text style={s.ratingText}>{Number(player.rating).toFixed(1)}</Text>
          </View>
        ) : (
          <View style={s.newBadge}>
            <Text style={s.newBadgeText}>NEW</Text>
          </View>
        )}
        {isDoubles &&
          hasPartner &&
          (p2HasRating ? (
            <View style={[s.ratingBadge, { marginTop: 2 }]}>
              <Text style={s.ratingText}>{Number(player.partner!.rating).toFixed(1)}</Text>
            </View>
          ) : (
            <View style={[s.newBadge, { marginTop: 2 }]}>
              <Text style={s.newBadgeText}>NEW</Text>
            </View>
          ))}
      </View>

      {!locked && (
        <View style={s.arrows}>
          <TouchableOpacity onPress={onMoveUp} disabled={index === 0} hitSlop={8}>
            <Text style={[s.arrow, index === 0 && s.arrowDisabled]}>▲</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onMoveDown} disabled={index === total - 1} hitSlop={8}>
            <Text style={[s.arrow, index === total - 1 && s.arrowDisabled]}>▼</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Main Screen
// ═══════════════════════════════════════════════════════════════════════════

export default function MatchHubScreen() {
  const navigation = useNavigation();
  const route = useRoute<{ key: string; name: string; params: { tournamentId: string } }>();
  const { tournamentId } = route.params;

  // ─── Shared state ────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('teams');
  const initialTabSetRef = useRef(false);

  const [tournament, setTournament] = useState<any>(null);
  const [categories, setCategories] = useState<TournamentCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');

  // Teams tab data
  const [seedingPlayers, setSeedingPlayers] = useState<SeedPlayer[]>([]);
  const [categoryFormat, setCategoryFormat] = useState<string>('singles');

  // Draws tab data
  const [bracketData, setBracketData] = useState<BracketData | null>(null);

  // Live tab data
  const [scheduleMatches, setScheduleMatches] = useState<ScheduledMatch[]>([]);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [teamCheckedIn, setTeamCheckedIn] = useState<Record<string, boolean>>({});
  const [checkInSummary, setCheckInSummary] = useState<{ total: number; checkedIn: number } | null>(
    null,
  );
  const [hasSchedule, setHasSchedule] = useState(false);

  // ─── Teams tab local UI state ────────────────────────────────────────
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addPartnerName, setAddPartnerName] = useState('');
  const [addPartnerPhone, setAddPartnerPhone] = useState('');
  const [adding, setAdding] = useState(false);
  const [showAutoMenu, setShowAutoMenu] = useState(false);
  const [savingSeeds, setSavingSeeds] = useState(false);

  // Resolve partners modal
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [addPartnerForId, setAddPartnerForId] = useState<string | null>(null);
  const [resolvePartnerName, setResolvePartnerName] = useState('');
  const [resolvePartnerPhone, setResolvePartnerPhone] = useState('');
  const [resolving, setResolving] = useState(false);

  // ─── Draws tab local UI state ─────────────────────────────────────────
  const [generatingDraw, setGeneratingDraw] = useState(false);
  const [expandedDrawMatchId, setExpandedDrawMatchId] = useState<string | null>(null);
  const [expandedPools, setExpandedPools] = useState<Set<number>>(new Set());
  const [collapsedPoolCards, setCollapsedPoolCards] = useState<Set<number>>(new Set());

  // ─── Export refs for JPG download ─────────────────────────────────────
  const drawsExportRef = useRef<any>(null);
  const scheduleExportRef = useRef<any>(null);

  // ─── Live tab local UI state ──────────────────────────────────────────
  const [courtName, setCourtName] = useState('');
  const [addingCourt, setAddingCourt] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [startHour, setStartHour] = useState('09');
  const [startMinute, setStartMinute] = useState('00');
  const [matchDuration, setMatchDuration] = useState('12');
  const [restBetween, setRestBetween] = useState('5');
  const [pointsPerGame, setPointsPerGame] = useState('11');
  const [setsPerMatch, setSetsPerMatch] = useState('1');
  const [advancingPerPool, setAdvancingPerPool] = useState('2');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [showCheckInPanel, setShowCheckInPanel] = useState(false);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  // Advancing teams modal
  const [showAdvancingModal, setShowAdvancingModal] = useState(false);
  const [advancingTeams, setAdvancingTeams] = useState<any[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [loadingAdvancing, setLoadingAdvancing] = useState(false);
  const [confirmingKnockout, setConfirmingKnockout] = useState(false);

  // ─── Data fetching ────────────────────────────────────────────────────

  const fetchTournament = useCallback(async () => {
    try {
      const res = await tournamentsApi.getById(tournamentId);
      const t = res.data?.data ?? res.data;
      setTournament(t);
      const cats: TournamentCategory[] = t?.categories ?? [];
      setCategories(cats);
      if (cats.length > 0 && !activeCategoryId) {
        setActiveCategoryId(cats[0].id);
      }
      return t;
    } catch {
      return null;
    }
  }, [tournamentId, activeCategoryId]);

  const fetchSeeding = useCallback(
    async (catId: string) => {
      if (!catId) return;
      try {
        const res = await apiClient.get(
          `/tournaments/${tournamentId}/categories/${catId}/seeding`,
        );
        const raw = res.data?.data ?? res.data ?? [];
        setSeedingPlayers(Array.isArray(raw) ? raw : []);
        // Determine category format from categories list
        const cat = categories.find((c) => c.id === catId);
        if (cat?.format) setCategoryFormat(cat.format);
      } catch {
        setSeedingPlayers([]);
      }
    },
    [tournamentId, categories],
  );

  const fetchBracket = useCallback(
    async (catId: string) => {
      if (!catId) return;
      try {
        const res = await matchesApi.getBracket(tournamentId, catId);
        setBracketData(res.data?.data ?? res.data);
      } catch {
        setBracketData(null);
      }
    },
    [tournamentId],
  );

  const fetchSchedule = useCallback(async () => {
    try {
      const schedRes = await apiClient.get(`/tournaments/${tournamentId}/schedule`);
      const data = schedRes.data?.data ?? schedRes.data;
      const matchList: ScheduledMatch[] = data?.matches ?? [];
      setScheduleMatches(matchList);
      setTeamNames(data?.teamNames ?? {});
      const rawCheckedIn = data?.teamCheckedIn ?? {};
      const summary = data?.checkInSummary ?? null;
      if (summary && summary.total > 0 && summary.checkedIn >= summary.total) {
        const allTeamIds = matchList.flatMap((m) => [m.teamAId, m.teamBId].filter(Boolean));
        for (const tid of allTeamIds) {
          if (rawCheckedIn[tid] === undefined) rawCheckedIn[tid] = true;
        }
      }
      setTeamCheckedIn(rawCheckedIn);
      setCheckInSummary(summary);
      // hasSchedule is now driven by tournament.startedAt, set after fetchTournament() runs
    } catch {
      setScheduleMatches([]);
    }
  }, [tournamentId]);

  const refetchAll = useCallback(async () => {
    const t = await fetchTournament();
    const cats: TournamentCategory[] = t?.categories ?? [];
    const catId = activeCategoryId || cats[0]?.id || '';
    if (catId) {
      await Promise.all([fetchSeeding(catId), fetchBracket(catId), fetchSchedule()]);
    } else {
      await fetchSchedule();
    }
  }, [fetchTournament, fetchSeeding, fetchBracket, fetchSchedule, activeCategoryId]);

  // ─── Smart default tab selection ────────────────────────────────────
  // On first load, pick the most relevant tab based on tournament state:
  //   • No seeded players         → TEAMS
  //   • Players exist, no draw    → DRAWS
  //   • Draw generated            → SCHEDULE
  useEffect(() => {
    if (loading) return;
    if (initialTabSetRef.current) return;
    const hasPlayers = seedingPlayers.length > 0;
    const hasDraw =
      (bracketData?.pools?.length ?? 0) > 0 || (bracketData?.knockout?.length ?? 0) > 0;
    if (hasDraw) {
      setActiveTab('live');
    } else if (hasPlayers) {
      setActiveTab('draws');
    } else {
      setActiveTab('teams');
    }
    initialTabSetRef.current = true;
  }, [loading, seedingPlayers.length, bracketData]);

  // Initial load
  const isMounted = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const run = async () => {
        setLoading(true);
        await refetchAll();
        if (active) setLoading(false);
      };
      if (isMounted.current) run();
      else {
        isMounted.current = true;
        run();
      }

      // Auto-refresh Live tab every 30s while schedule is live
      const interval = setInterval(() => {
        if (hasSchedule) fetchSchedule();
      }, 30000);
      return () => {
        active = false;
        clearInterval(interval);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tournamentId]),
  );

  // Refetch category-dependent data when active category changes
  useEffect(() => {
    if (activeCategoryId) {
      fetchSeeding(activeCategoryId);
      fetchBracket(activeCategoryId);
    }
  }, [activeCategoryId, fetchSeeding, fetchBracket]);

  // ─── Teams tab actions ────────────────────────────────────────────────

  const isDoublesCategory =
    categoryFormat === 'doubles' || (seedingPlayers.length > 0 && !!seedingPlayers[0]?.isDoubles);

  const activeMatchFormat =
    categories.find((c) => c.id === activeCategoryId)?.matchFormat ?? 'best_of_1';

  // Auto-save seed order to backend (fire-and-forget)
  const autoSaveSeeds = (players: typeof seedingPlayers) => {
    const teamOrder = players.filter((p) => !!p.teamId).map((p) => p.teamId!);
    if (teamOrder.length < 2) return;
    apiClient
      .post(`/tournaments/${tournamentId}/categories/${activeCategoryId}/save-seeds`, { teamOrder })
      .catch(() => {}); // silent — best effort
  };

  const movePlayer = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= seedingPlayers.length) return;
    const newList = [...seedingPlayers];
    const [moved] = newList.splice(fromIndex, 1);
    newList.splice(toIndex, 0, moved);
    setSeedingPlayers(newList);
    autoSaveSeeds(newList);
  };

  const autoSeedByRating = () => {
    const sorted = [...seedingPlayers].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    setSeedingPlayers(sorted);
    setShowAutoMenu(false);
    autoSaveSeeds(sorted);
  };

  const autoSeedRandom = () => {
    const shuffled = [...seedingPlayers].sort(() => Math.random() - 0.5);
    setSeedingPlayers(shuffled);
    setShowAutoMenu(false);
    autoSaveSeeds(shuffled);
  };

  const handleAddPlayer = async () => {
    if (!addName.trim()) {
      xAlert('Required', 'Player name is required');
      return;
    }
    setAdding(true);
    try {
      await apiClient.post(
        `/tournaments/${tournamentId}/categories/${activeCategoryId}/manual-register`,
        {
          name: addName.trim(),
          phone: addPhone.trim() || undefined,
          partnerName: addPartnerName.trim() || undefined,
          partnerPhone: addPartnerPhone.trim() || undefined,
          paymentMethod: 'venue',
        },
      );
      setAddName('');
      setAddPhone('');
      setAddPartnerName('');
      setAddPartnerPhone('');
      setShowAddForm(false);
      await fetchSeeding(activeCategoryId);
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? 'Failed to add player');
    } finally {
      setAdding(false);
    }
  };

  const pendingPartnerPlayers = seedingPlayers.filter((p) => p.isDoubles && !p.partner);

  const handleSaveSeeds = () => {
    // Persist the current ordering by generating a draw with this teamOrder.
    // This matches the existing flow (generate-draw accepts teamOrder to enforce seeding).
    if (pendingPartnerPlayers.length > 0) {
      setShowResolveModal(true);
      return;
    }
    proceedSaveSeeds();
  };

  const proceedSaveSeeds = () => {
    const ready = seedingPlayers.filter((p) => !!p.teamId);
    if (ready.length < 2) {
      xAlert('Not Enough Teams', 'Need at least 2 teams to save seeds.');
      return;
    }
    xConfirm(
      'Save Seeds and Regenerate Draw',
      `Create pools and matches for ${ready.length} teams using this seeding order?`,
      async () => {
        setSavingSeeds(true);
        try {
          const teamOrder = ready.map((p) => p.teamId).filter(Boolean);
          await apiClient.post(
            `/tournaments/${tournamentId}/categories/${activeCategoryId}/generate-draw`,
            { teamOrder },
          );
          await refetchAll();
          setActiveTab('draws');
          xAlert('Saved', 'Seeds saved. Draw has been generated.');
        } catch (err: any) {
          xAlert('Error', err?.response?.data?.message ?? 'Failed to save seeds');
        } finally {
          setSavingSeeds(false);
        }
      },
      'Save',
    );
  };

  const handleMerge = async (regId1: string, regId2: string) => {
    setResolving(true);
    try {
      await registrationsApi.mergeRegistrations(tournamentId, activeCategoryId, regId1, regId2);
      setMergeTargetId(null);
      await fetchSeeding(activeCategoryId);
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? 'Failed to merge');
    } finally {
      setResolving(false);
    }
  };

  const handleAddPartner = async (regId: string) => {
    if (!resolvePartnerName.trim()) {
      xAlert('Required', 'Partner name is required');
      return;
    }
    setResolving(true);
    try {
      await registrationsApi.editRegistration(tournamentId, regId, {
        partnerName: resolvePartnerName.trim(),
        partnerPhone: resolvePartnerPhone.trim() || undefined,
      });
      setAddPartnerForId(null);
      setResolvePartnerName('');
      setResolvePartnerPhone('');
      await fetchSeeding(activeCategoryId);
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? 'Failed to add partner');
    } finally {
      setResolving(false);
    }
  };

  // ─── Draws tab actions ────────────────────────────────────────────────

  const actuallyGenerateDraw = async () => {
    setGeneratingDraw(true);
    try {
      // Always send current seed order so draw matches what's on screen
      const teamOrder = seedingPlayers
        .filter((p) => !!p.teamId)
        .map((p) => p.teamId!);
      await matchesApi.generateDraw(tournamentId, activeCategoryId, teamOrder.length > 0 ? teamOrder : undefined);
      await fetchBracket(activeCategoryId);
      xAlert('Draw Generated', 'Pools and matches have been created.');
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? 'Failed to generate draw');
    } finally {
      setGeneratingDraw(false);
    }
  };

  const [showSeedingConfirm, setShowSeedingConfirm] = useState(false);
  const [showManualAdjust, setShowManualAdjust] = useState(false);
  const [manualAssignments, setManualAssignments] = useState<Record<string, number>>({});
  const [regenerating, setRegenerating] = useState(false);
  const [poolPickerForTeamId, setPoolPickerForTeamId] = useState<string | null>(null);
  const [showContacts, setShowContacts] = useState(false);

  const handleGenerateDraw = () => {
    setShowSeedingConfirm(true);
  };

  const handleRegenerateDraw = () => {
    // Jump straight into manual adjust — auto shuffle was redundant with Save Seeds
    setManualAssignments({});
    setShowManualAdjust(true);
  };

  const confirmManualAdjust = async () => {
    setShowManualAdjust(false);
    setRegenerating(true);
    try {
      await matchesApi.regenerateDraw(tournamentId, activeCategoryId, manualAssignments);
      await fetchBracket(activeCategoryId);
      xAlert('Draw Regenerated', 'Manual pool assignments applied.');
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? 'Failed to regenerate draw');
    } finally {
      setRegenerating(false);
    }
  };

  const handleResetKnockout = () => {
    xConfirm(
      'Reset Knockout',
      'This will delete all knockout matches and let you re-select advancing teams. Pool matches will be kept. Continue?',
      async () => {
        try {
          await matchesApi.resetKnockout(tournamentId, activeCategoryId);
          await fetchBracket(activeCategoryId);
          xAlert('Success', 'Knockout bracket reset.');
        } catch (err: any) {
          xAlert('Error', err?.response?.data?.message ?? 'Failed to reset');
        }
      },
      'Reset',
    );
  };

  const handleMarkComplete = () => {
    xConfirm(
      'Mark Tournament Complete',
      'This will mark the entire tournament as completed. You can still view all matches and brackets afterwards. Continue?',
      async () => {
        try {
          await tournamentsApi.changeStatus(tournamentId, 'completed');
          await fetchTournament();
          xAlert('Tournament Completed', 'This tournament has been marked as complete. 🏆');
        } catch (err: any) {
          xAlert('Error', err?.response?.data?.message ?? 'Failed to update status');
        }
      },
      'Mark Complete',
    );
  };

  // ─── Live tab actions ─────────────────────────────────────────────────

  const tournamentCourts: any[] = tournament?.courts ?? [];

  const handleAddCourt = async () => {
    if (!courtName.trim()) return;
    setAddingCourt(true);
    try {
      await tournamentsApi.addCourt(tournamentId, {
        name: courtName.trim(),
        surfaceType: 'standard',
      });
      setCourtName('');
      await fetchTournament();
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? 'Failed to add court');
    } finally {
      setAddingCourt(false);
    }
  };

  const handleCheckInTeam = (teamId: string, teamName: string) => {
    xConfirm(
      'Check In',
      `Mark ${teamName.split(' / ')[0]} as arrived?`,
      async () => {
        try {
          await registrationsApi.checkInTeam(tournamentId, teamId);
          await fetchSchedule();
        } catch (err: any) {
          xAlert('Error', err?.response?.data?.message ?? 'Check-in failed');
        }
      },
      'Check In',
    );
  };

  const handleGenerateSchedule = () => {
    // Legacy — no longer used. Kept for reference.
    if (tournamentCourts.length === 0) {
      xAlert('No Courts', 'Add at least one court before generating the schedule.');
      return;
    }
  };

  const [showStartModal, setShowStartModal] = useState(false);
  const [starting, setStarting] = useState(false);

  const handleOpenStartModal = () => {
    if (tournamentCourts.length === 0) {
      xAlert('No Courts', 'Add at least one court before starting the tournament.');
      return;
    }
    setShowStartModal(true);
  };

  const handleConfirmStart = async () => {
    setStarting(true);
    try {
      await matchesApi.startTournament(tournamentId, {
        matchDurationMin: parseInt(matchDuration) || 12,
        restBetweenMin: parseInt(restBetween) || 5,
        pointsPerGame: parseInt(pointsPerGame) || 11,
        setsPerMatch: parseInt(setsPerMatch) || 1,
      });
      await fetchTournament();
      await fetchSchedule();
      setShowStartModal(false);
      xAlert(
        'Tournament Started',
        'Matches will be scheduled as teams check in. Go to the check-in panel to mark teams as present.',
      );
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? 'Failed to start tournament');
    } finally {
      setStarting(false);
    }
  };

  const poolMatches = scheduleMatches.filter((m) => !m.round || m.round === 'pool');
  const knockoutMatches = scheduleMatches.filter((m) => m.round && m.round !== 'pool');
  const allPoolMatchesDone =
    poolMatches.length > 0 &&
    poolMatches.every((m) => m.status === 'completed' || m.status === 'walkover') &&
    knockoutMatches.length === 0;

  const handleMoveToKnockouts = async () => {
    setShowAdvancingModal(true);
    setLoadingAdvancing(true);
    try {
      const firstPoolMatch: any = poolMatches.find((m: any) => m.categoryId);
      const catId = firstPoolMatch?.categoryId ?? activeCategoryId;
      if (!catId) {
        xAlert('Error', 'Could not determine category');
        setShowAdvancingModal(false);
        return;
      }
      const res = await matchesApi.getAdvancingTeams(tournamentId, catId);
      const data = res.data?.data ?? res.data;
      const pools = data?.pools ?? [];
      setAdvancingTeams(pools);
      const preSelected = new Set<string>();
      for (const pool of pools) {
        for (const team of pool.teams ?? []) {
          if (team.advancing) preSelected.add(team.teamId);
        }
      }
      setSelectedTeamIds(preSelected);
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? 'Failed to load advancing teams');
      setShowAdvancingModal(false);
    } finally {
      setLoadingAdvancing(false);
    }
  };

  const toggleTeamSelection = (teamId: string) => {
    setSelectedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const handleConfirmKnockout = async () => {
    if (selectedTeamIds.size === 0) {
      xAlert('No Teams', 'Select at least one team to advance.');
      return;
    }
    setConfirmingKnockout(true);
    try {
      const catMatch: any = poolMatches.find((m: any) => m.categoryId);
      const catId = catMatch?.categoryId ?? activeCategoryId;
      await matchesApi.confirmAdvancing(tournamentId, catId, Array.from(selectedTeamIds));
      setShowAdvancingModal(false);
      await refetchAll();
      setActiveTab('draws');
      xAlert('Success', 'Knockout bracket has been generated!');
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? 'Failed to generate knockout bracket');
    } finally {
      setConfirmingKnockout(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.blue} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* ─── Header ──────────────────────────────────────── */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={s.backBtn}>← BACK</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>MATCH HUB</Text>
            {tournament?.name ? (
              <Text style={s.headerSub} numberOfLines={1}>
                {tournament.name}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => setShowContacts(true)}
            hitSlop={12}
            style={{ width: 60, alignItems: 'flex-end' }}
          >
            <Text style={s.contactsBtn}>☎ TEAMS</Text>
          </TouchableOpacity>
        </View>

        {/* Category chips */}
        {categories.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.catRow}
          >
            {categories.map((cat) => {
              const active = cat.id === activeCategoryId;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[s.catChip, active && s.catChipActive]}
                  onPress={() => setActiveCategoryId(cat.id)}
                >
                  <Text style={[s.catChipText, active && s.catChipTextActive]}>{cat.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Tab bar */}
        <View style={s.tabBar}>
          {(['teams', 'draws', 'live'] as TabKey[]).map((tab) => {
            const active = activeTab === tab;
            const label = tab === 'live' ? 'SCHEDULE' : tab.toUpperCase();
            return (
              <TouchableOpacity
                key={tab}
                style={[s.tabBtn, active && s.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ─── Tab content ─────────────────────────────────── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {activeTab === 'teams' && renderTeamsTab()}
          {activeTab === 'draws' && renderDrawsTab()}
          {activeTab === 'live' && renderLiveTab()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── Resolve partners modal ──────────────────────── */}
      <Modal visible={showResolveModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Resolve Partners</Text>
            <Text style={s.modalSubtitle}>
              {pendingPartnerPlayers.length}{' '}
              {pendingPartnerPlayers.length === 1 ? 'entry needs' : 'entries need'} a partner before
              saving.
            </Text>

            <ScrollView style={s.modalScroll} showsVerticalScrollIndicator={false}>
              {pendingPartnerPlayers.map((p) => {
                const pName = p.displayName ?? p.userName;
                const isMergeOpen = mergeTargetId === p.id;
                const isAddOpen = addPartnerForId === p.id;
                const otherPending = pendingPartnerPlayers.filter((o) => o.id !== p.id);

                return (
                  <View key={p.id} style={s.resolveCard}>
                    <View style={s.resolveCardHeader}>
                      <Text style={s.resolvePlayerName}>{pName}</Text>
                      {p.phone ? (
                        <Text style={s.resolvePhone}>☎ {p.phone.replace('+91', '')}</Text>
                      ) : null}
                    </View>

                    {!isMergeOpen && !isAddOpen && (
                      <View style={s.resolveActions}>
                        {otherPending.length > 0 && (
                          <TouchableOpacity
                            style={s.mergeBtn}
                            onPress={() => {
                              setMergeTargetId(p.id);
                              setAddPartnerForId(null);
                            }}
                          >
                            <Text style={s.mergeBtnText}>MERGE</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={s.addPartnerBtn}
                          onPress={() => {
                            setAddPartnerForId(p.id);
                            setMergeTargetId(null);
                          }}
                        >
                          <Text style={s.addPartnerBtnText}>ADD PARTNER</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {isMergeOpen && (
                      <View style={s.mergeSection}>
                        <Text style={s.mergeSectionLabel}>Select player to merge with:</Text>
                        {otherPending.map((o) => (
                          <TouchableOpacity
                            key={o.id}
                            style={s.mergeOption}
                            onPress={() => handleMerge(p.id, o.id)}
                            disabled={resolving}
                          >
                            <Text style={s.mergeOptionText}>{o.displayName ?? o.userName}</Text>
                            {resolving ? (
                              <ActivityIndicator size="small" color={COLORS.blue} />
                            ) : (
                              <Text style={s.mergeArrow}>→</Text>
                            )}
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity onPress={() => setMergeTargetId(null)}>
                          <Text style={s.cancelLink}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {isAddOpen && (
                      <View style={s.addPartnerSection}>
                        <TextInput
                          style={s.input}
                          placeholder="Partner Name *"
                          placeholderTextColor={COLORS.textMuted}
                          value={resolvePartnerName}
                          onChangeText={setResolvePartnerName}
                        />
                        <View style={s.phoneRow}>
                          <View style={s.phonePrefix}>
                            <Text style={s.phonePrefixText}>+91</Text>
                          </View>
                          <TextInput
                            style={[s.input, s.phoneInput]}
                            placeholder="Partner Phone (optional)"
                            placeholderTextColor={COLORS.textMuted}
                            value={resolvePartnerPhone}
                            onChangeText={(t) =>
                              setResolvePartnerPhone(t.replace(/[^0-9]/g, '').slice(0, 10))
                            }
                            keyboardType="phone-pad"
                            maxLength={10}
                          />
                        </View>
                        <View style={s.addPartnerActions}>
                          <TouchableOpacity
                            onPress={() => {
                              setAddPartnerForId(null);
                              setResolvePartnerName('');
                              setResolvePartnerPhone('');
                            }}
                          >
                            <Text style={s.cancelLink}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[s.savePartnerBtn, resolving && { opacity: 0.6 }]}
                            onPress={() => handleAddPartner(p.id)}
                            disabled={resolving}
                          >
                            {resolving ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={s.savePartnerBtnText}>Save</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}

              {pendingPartnerPlayers.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <Text style={{ color: COLORS.green, fontSize: 14, fontWeight: '700' }}>
                    All partners resolved!
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={s.modalFooter}>
              <TouchableOpacity
                style={s.modalCancelBtn}
                onPress={() => setShowResolveModal(false)}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              {pendingPartnerPlayers.length === 0 ? (
                <TouchableOpacity
                  style={s.modalGenerateBtn}
                  onPress={() => {
                    setShowResolveModal(false);
                    proceedSaveSeeds();
                  }}
                >
                  <Text style={s.modalGenerateBtnText}>SAVE & GENERATE</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={s.modalSkipBtn}
                  onPress={() => {
                    setShowResolveModal(false);
                    xConfirm(
                      'Skip Unresolved',
                      `${pendingPartnerPlayers.length} entries without partners will be excluded.`,
                      () => proceedSaveSeeds(),
                      'Save Anyway',
                    );
                  }}
                >
                  <Text style={s.modalSkipBtnText}>SKIP & SAVE</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Check-in modal ──────────────────────────────── */}
      <Modal visible={showCheckInPanel} transparent animationType="slide">
        <View style={s.ciModalOverlay}>
          <View style={s.ciModalContent}>
            <View style={s.ciModalHeader}>
              <Text style={s.ciModalTitle}>Check In Teams</Text>
              <TouchableOpacity onPress={() => setShowCheckInPanel(false)} hitSlop={12}>
                <Text style={s.ciModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {checkInSummary && (
              <Text style={s.ciModalSummary}>
                {checkInSummary.checkedIn} of {checkInSummary.total} checked in
              </Text>
            )}
            <ScrollView style={s.ciModalScroll} showsVerticalScrollIndicator={false}>
              {Object.entries(teamNames).map(([teamId, name]) => {
                const isChecked = teamCheckedIn[teamId] ?? false;
                const parts = name.split(' / ');
                const isLoading = checkingInId === teamId;
                return (
                  <View key={teamId} style={[s.ciTeamRow, isChecked && s.ciTeamRowChecked]}>
                    <View style={s.ciTeamInfo}>
                      <Text style={s.ciTeamName} numberOfLines={1}>
                        {parts[0]}
                      </Text>
                      {parts[1] && (
                        <Text style={s.ciTeamPartner} numberOfLines={1}>
                          {parts[1]}
                        </Text>
                      )}
                    </View>
                    {isChecked ? (
                      <View style={s.ciCheckedBadge}>
                        <Text style={s.ciCheckedText}>✓ ARRIVED</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[s.ciCheckInBtn, isLoading && { opacity: 0.5 }]}
                        onPress={async () => {
                          setCheckingInId(teamId);
                          try {
                            await registrationsApi.checkInTeam(tournamentId, teamId);
                            setTeamCheckedIn((prev) => ({ ...prev, [teamId]: true }));
                            setCheckInSummary((prev) =>
                              prev ? { ...prev, checkedIn: prev.checkedIn + 1 } : prev,
                            );
                            // Refresh the schedule immediately so waiting matches
                            // get slotted into courts as teams check in
                            fetchSchedule();
                          } catch (err: any) {
                            xAlert('Error', err?.response?.data?.message ?? 'Check-in failed');
                          } finally {
                            setCheckingInId(null);
                          }
                        }}
                        disabled={isLoading}
                        activeOpacity={0.7}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={s.ciCheckInBtnText}>CHECK IN</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={s.ciModalDoneBtn}
              onPress={() => {
                setShowCheckInPanel(false);
                fetchSchedule();
              }}
            >
              <Text style={s.ciModalDoneBtnText}>DONE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Seeding confirmation modal ──────────────────── */}
      <Modal visible={showSeedingConfirm} transparent animationType="fade">
        <View style={s.confirmOverlay}>
          <View style={s.confirmCard}>
            <Text style={s.confirmEmoji}>🎯</Text>
            <Text style={s.confirmTitle}>Are you sure about player seeding?</Text>
            <Text style={s.confirmMsg}>
              Once the draw is generated, the seed order determines pool groupings. Review or
              adjust seeding before continuing.
            </Text>
            <View style={s.confirmActions}>
              <TouchableOpacity
                style={s.confirmSecondaryBtn}
                onPress={() => {
                  setShowSeedingConfirm(false);
                  setActiveTab('teams');
                }}
              >
                <Text style={s.confirmSecondaryBtnText}>CHECK SEEDING</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.confirmPrimaryBtn}
                onPress={() => {
                  setShowSeedingConfirm(false);
                  actuallyGenerateDraw();
                }}
              >
                <Text style={s.confirmPrimaryBtnText}>GENERATE NOW</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Team contacts modal ─────────────────────────── */}
      <Modal visible={showContacts} transparent animationType="slide">
        <View style={s.ciModalOverlay}>
          <View style={[s.ciModalContent, { maxHeight: '85%' }]}>
            <View style={s.ciModalHeader}>
              <Text style={s.ciModalTitle}>Team Contacts</Text>
              <TouchableOpacity onPress={() => setShowContacts(false)} hitSlop={12}>
                <Text style={s.ciModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.ciModalSummary}>
              {seedingPlayers.length} {isDoublesCategory ? 'team' : 'player'}
              {seedingPlayers.length === 1 ? '' : 's'} in this category
            </Text>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 10 }}>
              {seedingPlayers.length === 0 ? (
                <View style={s.emptyWrap}>
                  <Text style={s.emptyText}>No players registered yet.</Text>
                </View>
              ) : (
                seedingPlayers.map((p, idx) => {
                  const p1Name = p.displayName ?? p.userName;
                  const p1Phone = p.phone ? p.phone.replace('+91', '') : null;
                  const p2Name = p.partner
                    ? p.partner.displayName ?? p.partner.userName
                    : null;
                  const p2Phone = p.partner?.phone
                    ? p.partner.phone.replace('+91', '')
                    : null;
                  return (
                    <View key={p.id} style={s.contactRow}>
                      <View style={s.contactSeedBadge}>
                        <Text style={s.contactSeedNum}>{idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={s.contactLine}>
                          <Text style={s.contactName} numberOfLines={1}>
                            {p1Name}
                          </Text>
                          {p1Phone ? (
                            <TouchableOpacity
                              onPress={() => Linking.openURL(`tel:+91${p1Phone}`)}
                            >
                              <Text style={s.contactPhone}>☎ {p1Phone}</Text>
                            </TouchableOpacity>
                          ) : (
                            <Text style={s.contactPhoneMissing}>no phone</Text>
                          )}
                        </View>
                        {p2Name ? (
                          <View style={[s.contactLine, { marginTop: 4 }]}>
                            <Text style={s.contactPartnerName} numberOfLines={1}>
                              {p2Name}
                            </Text>
                            {p2Phone ? (
                              <TouchableOpacity
                                onPress={() => Linking.openURL(`tel:+91${p2Phone}`)}
                              >
                                <Text style={s.contactPhone}>☎ {p2Phone}</Text>
                              </TouchableOpacity>
                            ) : (
                              <Text style={s.contactPhoneMissing}>no phone</Text>
                            )}
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Manual pool adjustment modal ────────────────── */}
      <Modal visible={showManualAdjust} transparent animationType="slide">
        <View style={s.ciModalOverlay}>
          <View style={[s.ciModalContent, { maxHeight: '85%' }]}>
            <View style={s.ciModalHeader}>
              <Text style={s.ciModalTitle}>Assign Teams to Pools</Text>
              <TouchableOpacity onPress={() => setShowManualAdjust(false)} hitSlop={12}>
                <Text style={s.ciModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.ciModalSummary}>
              Tap a letter next to each team to assign them to that pool.
            </Text>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 10 }}>
              {(() => {
                const allTeams: { id: string; name: string }[] = [];
                const pools = bracketData?.pools ?? [];
                for (const pool of pools) {
                  for (const team of pool.teams) {
                    allTeams.push({ id: team.id, name: team.name });
                  }
                }
                const numPools = pools.length || 1;
                const poolLetters = 'ABCDEFGH'.split('').slice(0, numPools);

                // Count how many teams are currently assigned to each pool
                const poolCounts: number[] = Array(numPools).fill(0);
                for (const tId of Object.keys(manualAssignments)) {
                  const p = manualAssignments[tId];
                  if (p >= 0 && p < numPools) poolCounts[p]++;
                }

                return (
                  <>
                    {/* Pool count summary */}
                    <View style={s.manualPoolCounts}>
                      {poolLetters.map((letter, idx) => (
                        <View key={letter} style={s.manualPoolCountChip}>
                          <Text style={s.manualPoolCountLetter}>{letter}</Text>
                          <Text style={s.manualPoolCountNum}>{poolCounts[idx]}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Team list with pool dropdown pickers */}
                    {allTeams.map((team) => {
                      const currentPool = manualAssignments[team.id];
                      const label =
                        currentPool !== undefined && currentPool >= 0
                          ? `Pool ${poolLetters[currentPool] ?? '?'}`
                          : 'Select pool';
                      return (
                        <View key={team.id} style={s.manualTeamRow}>
                          <Text style={s.manualTeamName} numberOfLines={1}>
                            {team.name}
                          </Text>
                          <TouchableOpacity
                            style={s.manualDropdownBtn}
                            onPress={() => setPoolPickerForTeamId(team.id)}
                            activeOpacity={0.75}
                          >
                            <Text style={s.manualDropdownBtnText}>{label}</Text>
                            <Text style={s.manualDropdownChevron}>▾</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </>
                );
              })()}
            </ScrollView>

            <TouchableOpacity
              style={[s.confirmPrimaryBtn, { flex: 0, marginTop: 12, alignSelf: 'stretch' }]}
              onPress={confirmManualAdjust}
              disabled={regenerating}
            >
              <Text style={s.confirmPrimaryBtnText}>
                {regenerating ? 'APPLYING...' : 'CONFIRM & REGENERATE'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Pool picker (nested inside manual adjust) ────── */}
      <Modal visible={!!poolPickerForTeamId} transparent animationType="fade">
        <TouchableOpacity
          style={s.confirmOverlay}
          activeOpacity={1}
          onPress={() => setPoolPickerForTeamId(null)}
        >
          <View style={s.poolPickerCard}>
            <Text style={s.poolPickerTitle}>Choose pool</Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {(() => {
                const pools = bracketData?.pools ?? [];
                const numPools = pools.length || 1;
                const letters = 'ABCDEFGHIJKLMNOPQRST'.split('').slice(0, numPools);
                return letters.map((letter, idx) => {
                  const count = Object.values(manualAssignments).filter((v) => v === idx).length;
                  return (
                    <TouchableOpacity
                      key={letter}
                      style={s.poolPickerOption}
                      onPress={() => {
                        if (poolPickerForTeamId) {
                          setManualAssignments((prev) => ({
                            ...prev,
                            [poolPickerForTeamId]: idx,
                          }));
                        }
                        setPoolPickerForTeamId(null);
                      }}
                    >
                      <Text style={s.poolPickerLetter}>Pool {letter}</Text>
                      <Text style={s.poolPickerCount}>
                        {count} team{count !== 1 ? 's' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                });
              })()}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Start Tournament modal ──────────────────────── */}
      <Modal visible={showStartModal} transparent animationType="fade">
        <View style={s.ciModalOverlay}>
          <View style={[s.ciModalContent, { maxHeight: '80%' }]}>
            <View style={s.ciModalHeader}>
              <Text style={s.ciModalTitle}>Start Tournament</Text>
              <TouchableOpacity onPress={() => setShowStartModal(false)} hitSlop={12}>
                <Text style={s.ciModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.ciModalSummary}>
              Confirm match settings — these can't be changed after starting.
            </Text>

            <ScrollView contentContainerStyle={{ paddingBottom: 10 }}>
              <View style={s.formCard}>
                <Text style={s.formLabel}>MATCH TIMING</Text>
                <View style={s.settingsRow}>
                  <View style={s.settingItem}>
                    <Text style={s.settingLabel}>Match duration</Text>
                    <View style={s.inputWithUnit}>
                      <TextInput
                        style={s.settingInputCompact}
                        value={matchDuration}
                        onChangeText={setMatchDuration}
                        keyboardType="number-pad"
                        placeholder="12"
                        placeholderTextColor={COLORS.textMuted}
                      />
                      <Text style={s.unitText}>min</Text>
                    </View>
                  </View>
                  <View style={s.settingItem}>
                    <Text style={s.settingLabel}>Rest between</Text>
                    <View style={s.inputWithUnit}>
                      <TextInput
                        style={s.settingInputCompact}
                        value={restBetween}
                        onChangeText={setRestBetween}
                        keyboardType="number-pad"
                        placeholder="5"
                        placeholderTextColor={COLORS.textMuted}
                      />
                      <Text style={s.unitText}>min</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={s.formCard}>
                <Text style={s.formLabel}>GAME FORMAT</Text>
                <View style={s.settingsRow}>
                  <View style={s.settingItem}>
                    <Text style={s.settingLabel}>Points per game</Text>
                    <TextInput
                      style={s.settingInput}
                      value={pointsPerGame}
                      onChangeText={setPointsPerGame}
                      keyboardType="number-pad"
                      placeholder="11"
                      placeholderTextColor={COLORS.textMuted}
                    />
                  </View>
                  <View style={s.settingItem}>
                    <Text style={s.settingLabel}>Sets per match</Text>
                    <View style={s.chipRow}>
                      {['1', '3', '5'].map((val) => (
                        <TouchableOpacity
                          key={val}
                          style={[s.optionChip, setsPerMatch === val && s.optionChipActive]}
                          onPress={() => setSetsPerMatch(val)}
                        >
                          <Text
                            style={[
                              s.optionChipText,
                              setsPerMatch === val && s.optionChipTextActive,
                            ]}
                          >
                            {val}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[s.startBtn, starting && { opacity: 0.6 }]}
              onPress={handleConfirmStart}
              disabled={starting}
            >
              {starting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.startBtnText}>🏁  START TOURNAMENT</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Advancing teams modal ───────────────────────── */}
      <Modal visible={showAdvancingModal} transparent animationType="slide">
        <View style={s.advModalOverlay}>
          <View style={s.advModalContent}>
            <View style={s.advModalHeader}>
              <Text style={s.advModalTitle}>Confirm Advancing Teams</Text>
              <TouchableOpacity onPress={() => setShowAdvancingModal(false)} hitSlop={12}>
                <Text style={s.advModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.advModalSummary}>
              {selectedTeamIds.size} team{selectedTeamIds.size !== 1 ? 's' : ''} selected to advance
            </Text>

            {loadingAdvancing ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={COLORS.blue} />
                <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 12 }}>
                  Loading standings...
                </Text>
              </View>
            ) : (
              <ScrollView style={s.advModalScroll} showsVerticalScrollIndicator={false}>
                {advancingTeams.map((pool: any, poolIdx: number) => (
                  <View key={`adv-pool-${poolIdx}`} style={{ marginBottom: 16 }}>
                    <View style={s.advPoolHeader}>
                      <Text style={s.advPoolHeaderText}>
                        POOL {String.fromCharCode(65 + poolIdx)}
                      </Text>
                      <Text style={s.advPoolCount}>{pool.teams?.length ?? 0} teams</Text>
                    </View>
                    {(pool.teams ?? []).map((team: any, tIdx: number) => {
                      const isSelected = selectedTeamIds.has(team.teamId);
                      const wins = team.wins ?? 0;
                      const losses = team.losses ?? 0;
                      const diff =
                        team.pointDiff ?? (team.pointsFor ?? 0) - (team.pointsAgainst ?? 0);
                      const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;
                      const poolLetter = String.fromCharCode(65 + poolIdx);
                      const poolTag = `${poolLetter}${tIdx + 1}`;
                      return (
                        <TouchableOpacity
                          key={team.teamId}
                          style={[s.advTeamRow, isSelected && s.advTeamRowSelected]}
                          onPress={() => toggleTeamSelection(team.teamId)}
                          activeOpacity={0.7}
                        >
                          <View style={s.advTeamRank}>
                            <Text style={s.advTeamRankText}>{poolTag}</Text>
                          </View>
                          <View style={s.advTeamInfo}>
                            <Text style={s.advTeamName} numberOfLines={1}>
                              {team.name}
                            </Text>
                            <Text style={s.advTeamRecord}>
                              {wins}W - {losses}L | {diffStr} pts
                            </Text>
                          </View>
                          <View style={[s.advCheckbox, isSelected && s.advCheckboxSelected]}>
                            {isSelected && <Text style={s.advCheckmark}>✓</Text>}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[
                s.advConfirmBtn,
                (confirmingKnockout || loadingAdvancing || selectedTeamIds.size === 0) && {
                  opacity: 0.5,
                },
              ]}
              onPress={handleConfirmKnockout}
              disabled={confirmingKnockout || loadingAdvancing || selectedTeamIds.size === 0}
            >
              {confirmingKnockout ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.advConfirmBtnText}>CONFIRM & GENERATE KNOCKOUT</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // Tab renderers (defined inside component to access state via closure)
  // ═══════════════════════════════════════════════════════════════════════

  function renderTeamsTab() {
    const locked = !!tournament?.startedAt;
    return (
      <View>
        {locked && (
          <View style={s.lockedBanner}>
            <Text style={s.lockedBannerText}>
              🔒 Tournament has started — seeds and draw are locked
            </Text>
          </View>
        )}

        {/* Action row */}
        {!locked && (
          <>
            <View style={s.actionsRow}>
              <TouchableOpacity
                style={[s.actionBtn, { flex: 1 }]}
                onPress={() => setShowAddForm(!showAddForm)}
              >
                <Text style={[s.actionBtnText, { textAlign: 'center' }]}>
                  + ADD {isDoublesCategory ? 'TEAM' : 'PLAYER'}
                </Text>
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <TouchableOpacity style={s.actionBtn} onPress={() => setShowAutoMenu(!showAutoMenu)}>
                  <Text style={[s.actionBtnText, { textAlign: 'center' }]}>
                    AUTO SEED {showAutoMenu ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>
                {showAutoMenu && (
                  <View style={s.autoMenu}>
                    <TouchableOpacity style={s.autoMenuItem} onPress={autoSeedByRating}>
                      <Text style={s.autoMenuText}>By Rating (Highest First)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.autoMenuItem} onPress={autoSeedRandom}>
                      <Text style={s.autoMenuText}>Random Shuffle</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[s.saveSeedsBtn, { marginBottom: 10 }, savingSeeds && { opacity: 0.5 }]}
              onPress={handleSaveSeeds}
              disabled={savingSeeds || seedingPlayers.length === 0}
            >
              {savingSeeds ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.saveSeedsBtnText}>SAVE SEEDS AND REGENERATE DRAW</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Add form */}
        {!locked && showAddForm && (
          <View style={s.addForm}>
            <Text style={s.addFormTitle}>
              {isDoublesCategory ? 'Add Walk-in Team' : 'Add Walk-in Player'}
            </Text>

            {isDoublesCategory && <Text style={s.addSectionLabel}>PLAYER 1</Text>}
            <TextInput
              style={s.input}
              placeholder="Player Name *"
              placeholderTextColor={COLORS.textMuted}
              value={addName}
              onChangeText={setAddName}
            />
            <View style={s.phoneRow}>
              <View style={s.phonePrefix}>
                <Text style={s.phonePrefixText}>+91</Text>
              </View>
              <TextInput
                style={[s.input, s.phoneInput]}
                placeholder="Phone (optional)"
                placeholderTextColor={COLORS.textMuted}
                value={addPhone}
                onChangeText={(t) => setAddPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>

            {isDoublesCategory && (
              <>
                <Text style={s.addSectionLabel}>PLAYER 2</Text>
                <TextInput
                  style={s.input}
                  placeholder="Partner Name"
                  placeholderTextColor={COLORS.textMuted}
                  value={addPartnerName}
                  onChangeText={setAddPartnerName}
                />
                <View style={s.phoneRow}>
                  <View style={s.phonePrefix}>
                    <Text style={s.phonePrefixText}>+91</Text>
                  </View>
                  <TextInput
                    style={[s.input, s.phoneInput]}
                    placeholder="Partner Phone (optional)"
                    placeholderTextColor={COLORS.textMuted}
                    value={addPartnerPhone}
                    onChangeText={(t) =>
                      setAddPartnerPhone(t.replace(/[^0-9]/g, '').slice(0, 10))
                    }
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
                {!addPartnerName.trim() && (
                  <Text style={s.addHint}>Leave partner empty to add as "Partner Needed"</Text>
                )}
              </>
            )}

            <View style={s.addFormActions}>
              <TouchableOpacity style={s.addCancelBtn} onPress={() => setShowAddForm(false)}>
                <Text style={s.addCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.addSubmitBtn, adding && { opacity: 0.6 }]}
                onPress={handleAddPlayer}
                disabled={adding}
              >
                {adding ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.addSubmitText}>
                    {isDoublesCategory ? 'Add Team' : 'Add Player'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Player list */}
        {seedingPlayers.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyText}>No confirmed players yet.</Text>
            <Text style={s.emptySubText}>Add walk-in players or wait for registrations.</Text>
          </View>
        ) : (
          seedingPlayers.map((player, idx) => (
            <PlayerRow
              key={player.id}
              player={player}
              index={idx}
              total={seedingPlayers.length}
              onMoveUp={() => movePlayer(idx, idx - 1)}
              onMoveDown={() => movePlayer(idx, idx + 1)}
              locked={!!tournament?.startedAt}
            />
          ))
        )}
      </View>
    );
  }

  function renderDrawsTab() {
    const pools = bracketData?.pools ?? [];
    const knockout = bracketData?.knockout ?? [];
    const hasPools = pools.length > 0;
    const hasKnockout = knockout.length > 0;
    const noDraw = !bracketData || (!hasPools && !hasKnockout);

    const teamNamesMap: Record<string, string> = {};
    if (bracketData?.teams) {
      for (const t of bracketData.teams) teamNamesMap[t.id] = t.name;
    }

    // Check if all pool matches are done (for move to knockouts button)
    let allPoolsDone = false;
    if (hasPools) {
      const allMatches: any[] = pools.flatMap((p: any) => p.matches ?? []);
      allPoolsDone =
        allMatches.length > 0 &&
        allMatches.every(
          (m) => m.status === 'completed' || m.status === 'walkover',
        );
    }

    const togglePool = (idx: number) => {
      setExpandedPools((prev) => {
        const next = new Set(prev);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        return next;
      });
    };

    if (noDraw) {
      return (
        <View style={s.drawEmpty}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🏆</Text>
          <Text style={s.emptyTitle}>NO DRAW YET</Text>
          <Text style={s.emptySub}>Generate the draw to create pools and matches.</Text>
          <TouchableOpacity
            style={[s.drawGenerateBtn, generatingDraw && { opacity: 0.5 }]}
            onPress={handleGenerateDraw}
            disabled={generatingDraw}
          >
            {generatingDraw ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.drawGenerateBtnText}>GENERATE DRAW</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    const renderTeamRow = (team: any, tIdx: number) => {
      const played = (team.wins ?? 0) + (team.losses ?? 0);
      const diff = (team.pointsFor ?? 0) - (team.pointsAgainst ?? 0);
      const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
      const diffColor =
        diff > 0 ? COLORS.green : diff < 0 ? COLORS.red : COLORS.textSub;
      return (
        <View
          key={team.id}
          style={[s.tableRow, tIdx % 2 === 0 && s.tableRowAlt]}
        >
          <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={s.rankNum}>{tIdx + 1}</Text>
            <TeamNameDisplay name={team.name} size="sm" />
            {team.seedNumber != null && (
              <Text style={s.seedTag}>S{team.seedNumber}</Text>
            )}
          </View>
          <Text style={s.td}>{played}</Text>
          <Text style={s.td}>{team.wins}</Text>
          <Text style={s.td}>{team.losses}</Text>
          <Text style={s.td}>{team.pointsFor}</Text>
          <Text style={s.td}>{team.pointsAgainst}</Text>
          <Text style={[s.td, { color: diffColor, fontWeight: '800' }]}>
            {diffStr}
          </Text>
        </View>
      );
    };

    const renderPoolMatch = (match: any) => {
      const teamA = teamNamesMap[match.teamAId ?? ''] ?? 'TBD';
      const teamB = teamNamesMap[match.teamBId ?? ''] ?? 'TBD';
      const isDone =
        match.status === 'completed' || match.status === 'walkover';
      const scoreText =
        match.scores?.length > 0
          ? match.scores
              .map(
                (sc: any) => `${sc.teamAScore ?? 0}-${sc.teamBScore ?? 0}`,
              )
              .join(', ')
          : null;
      const isExp = expandedDrawMatchId === match.id;

      return (
        <View
          key={match.id}
          style={[s.matchCard, isExp && s.matchCardExpanded]}
        >
          <TouchableOpacity
            style={s.matchRowTouchable}
            onPress={() =>
              setExpandedDrawMatchId(isExp ? null : match.id)
            }
            activeOpacity={0.75}
          >
            <View
              style={[
                s.matchStatusDot,
                {
                  backgroundColor: isDone
                    ? COLORS.green
                    : match.status === 'in_progress'
                    ? COLORS.blue
                    : COLORS.textSub,
                },
              ]}
            />
            <View style={s.matchContent}>
              <View style={s.matchTeams}>
                <View
                  style={[
                    { flex: 1 },
                    isDone &&
                      match.winnerId &&
                      match.winnerId !== match.teamAId && { opacity: 0.5 },
                  ]}
                >
                  <TeamNameDisplay name={teamA} size="sm" />
                </View>
                <Text style={s.matchVs}>vs</Text>
                <View
                  style={[
                    { flex: 1 },
                    isDone &&
                      match.winnerId &&
                      match.winnerId !== match.teamBId && { opacity: 0.5 },
                  ]}
                >
                  <TeamNameDisplay name={teamB} size="sm" />
                </View>
              </View>
              {scoreText && <Text style={s.matchScoreText}>{scoreText}</Text>}
            </View>
            <View style={[s.scoreBtn, isDone && s.scoreBtnDone]}>
              <Text style={[s.scoreBtnText, isDone && s.scoreBtnTextDone]}>
                {isDone ? '✓' : 'SCORE'}
              </Text>
            </View>
          </TouchableOpacity>
          {isExp && !isDone && match.teamAId && match.teamBId && (
            <InlineScore
              matchId={match.id}
              teamAId={match.teamAId}
              teamBId={match.teamBId}
              teamAName={teamA}
              teamBName={teamB}
              existingScores={match.scores}
              matchFormat={activeMatchFormat}
              onDone={() => {
                setExpandedDrawMatchId(null);
                fetchBracket(activeCategoryId);
                fetchSchedule();
              }}
            />
          )}
          {isExp && isDone && match.teamAId && match.teamBId && (
            <View style={s.doneMessage}>
              <TouchableOpacity
                style={s.editScoreBtn}
                onPress={() => setEditingMatchId(
                  editingMatchId === match.id ? null : match.id,
                )}
              >
                <Text style={s.editScoreBtnText}>
                  {editingMatchId === match.id ? 'CANCEL EDIT' : 'EDIT SCORE'}
                </Text>
              </TouchableOpacity>
              {editingMatchId === match.id && (
                <InlineScore
                  matchId={match.id}
                  teamAId={match.teamAId}
                  teamBId={match.teamBId}
                  teamAName={teamA}
                  teamBName={teamB}
                  existingScores={match.scores}
                  matchFormat={activeMatchFormat}
                  onDone={() => {
                    setEditingMatchId(null);
                    setExpandedDrawMatchId(null);
                    fetchBracket(activeCategoryId);
                    fetchSchedule();
                  }}
                />
              )}
            </View>
          )}
        </View>
      );
    };

    const togglePoolCard = (idx: number) => {
      setCollapsedPoolCards((prev) => {
        const next = new Set(prev);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        return next;
      });
    };

    const renderPool = (pool: any, idx: number) => {
      const matchesExpanded = expandedPools.has(idx);
      const cardCollapsed = collapsedPoolCards.has(idx);
      const totalMatches = pool.matches?.length ?? 0;
      const doneMatches = (pool.matches ?? []).filter(
        (m: any) => m.status === 'completed' || m.status === 'walkover',
      ).length;

      return (
        <View key={`pool-${idx}`} style={s.poolCard}>
          <TouchableOpacity
            style={s.poolHeader}
            onPress={() => togglePoolCard(idx)}
            activeOpacity={0.75}
          >
            <View style={s.poolBadge}>
              <Text style={s.poolBadgeText}>
                {GROUP_LETTERS[idx] ?? idx + 1}
              </Text>
            </View>
            <Text style={s.poolTitle}>
              GROUP {GROUP_LETTERS[idx] ?? idx + 1}
            </Text>
            <Text style={s.poolCount}>{pool.teams.length} teams</Text>
            <Text style={s.poolChevron}>{cardCollapsed ? '▼' : '▲'}</Text>
          </TouchableOpacity>

          {!cardCollapsed && (
            <>
              <View style={s.table}>
                <View style={s.tableHeader}>
                  <Text style={[s.th, { flex: 2, textAlign: 'left' }]}>TEAM</Text>
                  <Text style={s.th}>P</Text>
                  <Text style={s.th}>W</Text>
                  <Text style={s.th}>L</Text>
                  <Text style={s.th}>PF</Text>
                  <Text style={s.th}>PA</Text>
                  <Text style={s.th}>+/-</Text>
                </View>
                {pool.teams.map(renderTeamRow)}
              </View>

              <TouchableOpacity
                style={s.matchesToggle}
                onPress={() => togglePool(idx)}
                activeOpacity={0.7}
              >
                <Text style={s.matchesToggleText}>
                  MATCHES ({doneMatches}/{totalMatches} PLAYED)
                </Text>
                <Text style={s.matchesToggleChevron}>
                  {matchesExpanded ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>

              {matchesExpanded && (
                <View style={s.matchesSection}>
                  {pool.matches.map(renderPoolMatch)}
                </View>
              )}
            </>
          )}
        </View>
      );
    };

    // Knockout rounds helpers
    const roundOrder: Record<string, number> = {
      round_of_32: 0,
      round_of_16: 1,
      quarterfinal: 2,
      semifinal: 3,
      final: 4,
      third_place: 5,
    };
    const roundLabels: Record<string, string> = {
      round_of_32: 'ROUND OF 32',
      round_of_16: 'ROUND OF 16',
      quarterfinal: 'QUARTERFINALS',
      semifinal: 'SEMIFINALS',
      final: 'FINAL',
      third_place: '3RD PLACE',
    };
    const grouped: Record<string, any[]> = {};
    for (const m of knockout) {
      const r = m.round ?? 'other';
      if (!grouped[r]) grouped[r] = [];
      grouped[r].push(m);
    }
    const sortedRounds = Object.keys(grouped).sort(
      (a, b) => (roundOrder[a] ?? 99) - (roundOrder[b] ?? 99),
    );
    const matchById: Record<string, any> = {};
    for (const m of knockout) matchById[m.id] = m;

    const activeCategory = categories.find((c) => c.id === activeCategoryId);
    const drawsFilename = () =>
      buildExportFilename(tournament?.name ?? 'tournament', activeCategory?.name, 'draws');

    return (
      <View>
        {/* Download JPG button */}
        {(hasPools || hasKnockout) && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            {/* Regenerate button — only if no scores yet and before knockout */}
            {hasPools && !hasKnockout && !tournament?.startedAt ? (
              <TouchableOpacity
                style={s.regenerateBtn}
                onPress={handleRegenerateDraw}
                activeOpacity={0.8}
                disabled={regenerating}
              >
                <Text style={s.regenerateBtnText}>
                  {regenerating ? '...' : '↻ REGENERATE'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}
            <DownloadJpgButton targetRef={drawsExportRef} getFilename={drawsFilename} />
          </View>
        )}

        <View ref={drawsExportRef} collapsable={false} style={{ backgroundColor: '#FFFFFF' }}>
        {/* POOLS section */}
        {hasPools && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionHeaderText}>POOLS</Text>
            </View>
            {pools.map((pool: any, idx: number) => renderPool(pool, idx))}

            {/* Move to Knockouts button */}
            {allPoolsDone && !hasKnockout && (
              <View style={s.knockoutSection}>
                <View style={s.knockoutDivider} />
                <Text style={s.knockoutEmoji}>🏆</Text>
                <Text style={s.knockoutTitle}>POOL PLAY COMPLETE</Text>
                <Text style={s.knockoutDesc}>
                  All pool matches are done.{'\n'}Ready to move to knockout stage?
                </Text>
                <TouchableOpacity
                  style={s.knockoutBtn}
                  onPress={handleMoveToKnockouts}
                  activeOpacity={0.8}
                >
                  <Text style={s.knockoutBtnText}>MOVE TO KNOCKOUTS  →</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* BRACKET section */}
        {hasKnockout && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionHeaderText}>BRACKET</Text>
            </View>
            {sortedRounds.map((round) => (
              <View key={round} style={s.koRoundSection}>
                <View style={s.koRoundHeader}>
                  <Text style={s.koRoundHeaderText}>
                    {roundLabels[round] ?? round.toUpperCase().replace(/_/g, ' ')}
                  </Text>
                  <Text style={s.koRoundCount}>
                    {grouped[round].length} match{grouped[round].length !== 1 ? 'es' : ''}
                  </Text>
                </View>
                {grouped[round].map((match: any) => {
                  const teamA = match.teamAId
                    ? teamNamesMap[match.teamAId] ?? 'TBD'
                    : match.dependsOnMatchA
                    ? `Winner of M${matchById[match.dependsOnMatchA]?.matchNumber ?? '?'}`
                    : 'TBD';
                  const teamB = match.teamBId
                    ? teamNamesMap[match.teamBId] ?? 'TBD'
                    : match.dependsOnMatchB
                    ? `Winner of M${matchById[match.dependsOnMatchB]?.matchNumber ?? '?'}`
                    : 'TBD';
                  const isDone = match.status === 'completed' || match.status === 'walkover';
                  const scoreText =
                    match.scores?.length > 0
                      ? match.scores
                          .map((sc: any) => `${sc.teamAScore ?? 0}-${sc.teamBScore ?? 0}`)
                          .join(', ')
                      : null;
                  const isExpanded = expandedDrawMatchId === match.id;

                  return (
                    <View
                      key={match.id}
                      style={[s.koMatchCard, isExpanded && s.matchCardExpanded]}
                    >
                      <TouchableOpacity
                        style={s.koMatchTouchable}
                        onPress={() => setExpandedDrawMatchId(isExpanded ? null : match.id)}
                        activeOpacity={0.75}
                      >
                        <View style={s.koMatchNumber}>
                          <Text style={s.koMatchNumberText}>M{match.matchNumber}</Text>
                        </View>
                        <View style={s.koMatchContent}>
                          <View style={s.koMatchTeams}>
                            <View
                              style={[
                                { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
                                isDone &&
                                  match.winnerId === match.teamAId && {
                                    backgroundColor: 'rgba(6,214,160,0.15)',
                                    borderRadius: 6,
                                    paddingHorizontal: 6,
                                    paddingVertical: 4,
                                  },
                                isDone &&
                                  match.winnerId &&
                                  match.winnerId !== match.teamAId && { opacity: 0.4 },
                              ]}
                            >
                              {isDone && match.winnerId === match.teamAId && (
                                <Text style={{ fontSize: 12 }}>🏆</Text>
                              )}
                              <View style={{ flex: 1 }}>
                                <TeamNameDisplay name={teamA} size="sm" />
                              </View>
                            </View>
                            <Text style={s.koVs}>vs</Text>
                            <View
                              style={[
                                {
                                  flex: 1,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 4,
                                  justifyContent: 'flex-end',
                                },
                                isDone &&
                                  match.winnerId === match.teamBId && {
                                    backgroundColor: 'rgba(6,214,160,0.15)',
                                    borderRadius: 6,
                                    paddingHorizontal: 6,
                                    paddingVertical: 4,
                                  },
                                isDone &&
                                  match.winnerId &&
                                  match.winnerId !== match.teamBId && { opacity: 0.4 },
                              ]}
                            >
                              <View style={{ flex: 1 }}>
                                <TeamNameDisplay name={teamB} size="sm" />
                              </View>
                              {isDone && match.winnerId === match.teamBId && (
                                <Text style={{ fontSize: 12 }}>🏆</Text>
                              )}
                            </View>
                          </View>
                          {scoreText && <Text style={s.koScoreText}>{scoreText}</Text>}
                        </View>
                        <View
                          style={[
                            s.koStatusDot,
                            {
                              backgroundColor: isDone
                                ? COLORS.green
                                : match.status === 'in_progress'
                                ? COLORS.blue
                                : COLORS.textSub,
                            },
                          ]}
                        />
                      </TouchableOpacity>

                      {isExpanded && !isDone && match.teamAId && match.teamBId && (
                        <InlineScore
                          matchId={match.id}
                          teamAId={match.teamAId}
                          teamBId={match.teamBId}
                          teamAName={teamA}
                          teamBName={teamB}
                          existingScores={match.scores}
                          matchFormat={activeMatchFormat}
                          onDone={() => {
                            setExpandedDrawMatchId(null);
                            fetchBracket(activeCategoryId);
                            fetchSchedule();
                          }}
                        />
                      )}
                      {isExpanded && isDone && match.teamAId && match.teamBId && (
                        <View style={s.doneMessage}>
                          <TouchableOpacity
                            style={s.editScoreBtn}
                            onPress={() => setEditingMatchId(
                              editingMatchId === match.id ? null : match.id,
                            )}
                          >
                            <Text style={s.editScoreBtnText}>
                              {editingMatchId === match.id ? 'CANCEL EDIT' : 'EDIT SCORE'}
                            </Text>
                          </TouchableOpacity>
                          {editingMatchId === match.id && (
                            <InlineScore
                              matchId={match.id}
                              teamAId={match.teamAId}
                              teamBId={match.teamBId}
                              teamAName={teamA}
                              teamBName={teamB}
                              existingScores={match.scores}
                              matchFormat={activeMatchFormat}
                              onDone={() => {
                                setEditingMatchId(null);
                                setExpandedDrawMatchId(null);
                                fetchBracket(activeCategoryId);
                                fetchSchedule();
                              }}
                            />
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}

            <TouchableOpacity
              style={{ alignSelf: 'center', paddingVertical: 12, marginTop: 8 }}
              onPress={handleResetKnockout}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: COLORS.red,
                  letterSpacing: 0.5,
                }}
              >
                Reset Knockout Bracket
              </Text>
            </TouchableOpacity>
          </>
        )}
        </View>

        {/* Mark Tournament Complete — shown when final has a winner and tournament is still in progress */}
        {(() => {
          if (!hasKnockout) return null;
          if (tournament?.status === 'completed') {
            return (
              <View style={s.completeBanner}>
                <Text style={s.completeBannerIcon}>🏆</Text>
                <Text style={s.completeBannerText}>TOURNAMENT COMPLETED</Text>
              </View>
            );
          }
          const finalMatch = knockout.find((m: any) => m.round === 'final');
          const finalDone =
            finalMatch && (finalMatch.status === 'completed' || finalMatch.status === 'walkover');
          if (!finalDone) return null;
          return (
            <TouchableOpacity
              style={s.completeBtn}
              onPress={handleMarkComplete}
              activeOpacity={0.85}
            >
              <Text style={s.completeBtnText}>🏆  MARK TOURNAMENT COMPLETE</Text>
            </TouchableOpacity>
          );
        })()}
      </View>
    );
  }

  function renderLiveTab() {
    const formatTime = (iso?: string) => {
      if (!iso) return '';
      const d = new Date(iso);
      return d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    };

    const matchesByCourt: Record<string, ScheduledMatch[]> = {};
    const courtTbdMatches: ScheduledMatch[] = [];
    const waitingMatches: ScheduledMatch[] = [];

    // First pass: group all scheduled matches by court
    const allByCourt: Record<string, ScheduledMatch[]> = {};
    for (const m of scheduleMatches) {
      const isDone = m.status === 'completed' || m.status === 'walkover';
      const hasTime = !!m.scheduledStart;
      const hasCourt = !!(m.courtName || m.courtId);

      if (!hasCourt && isDone) continue;

      if (hasTime && hasCourt) {
        const key = m.courtName || m.courtId || 'Court';
        if (!allByCourt[key]) allByCourt[key] = [];
        allByCourt[key].push(m);
      } else {
        waitingMatches.push(m);
      }
    }

    // Second pass: per court, show completed + in_progress + next 2 pending only.
    // Everything else goes to "Court TBD" section.
    const MAX_UPCOMING_PER_COURT = 2;
    for (const [courtKey, courtMatches] of Object.entries(allByCourt)) {
      // Sort by scheduled time
      courtMatches.sort(
        (a, b) =>
          new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime(),
      );

      const visible: ScheduledMatch[] = [];
      let pendingCount = 0;

      for (const m of courtMatches) {
        const isDone = m.status === 'completed' || m.status === 'walkover';
        const isLive = m.status === 'in_progress';

        if (isDone || isLive) {
          // Always show completed and live matches on their court
          visible.push(m);
        } else {
          // Pending/scheduled: only show next 2
          if (pendingCount < MAX_UPCOMING_PER_COURT) {
            visible.push(m);
            pendingCount++;
          } else {
            // Move to Court TBD
            courtTbdMatches.push(m);
          }
        }
      }

      if (visible.length > 0) {
        matchesByCourt[courtKey] = visible;
      }
    }

    // Sort Court TBD by time
    courtTbdMatches.sort(
      (a, b) =>
        new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime(),
    );

    return (
      <View>
        {/* Court management card (always visible) */}
        <View style={s.formCard}>
          <Text style={s.formLabel}>COURTS</Text>
          {tournamentCourts.length > 0 && (
            <View style={s.courtChips}>
              {tournamentCourts.map((c: any) => (
                <View key={c.id} style={s.courtChip}>
                  <Text style={s.courtChipText}>{c.name}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={s.addCourtRow}>
            <TextInput
              style={s.addCourtInput}
              placeholder="Court name"
              placeholderTextColor={COLORS.textMuted}
              value={courtName}
              onChangeText={setCourtName}
            />
            <TouchableOpacity
              style={[s.addCourtBtn, (!courtName.trim() || addingCourt) && { opacity: 0.4 }]}
              disabled={!courtName.trim() || addingCourt}
              onPress={handleAddCourt}
            >
              <Text style={s.addCourtBtnText}>{addingCourt ? '...' : 'Add'}</Text>
            </TouchableOpacity>
          </View>
          {tournamentCourts.length === 0 && (
            <Text style={s.courtHint}>Add at least one court to generate a schedule</Text>
          )}
        </View>

        {!tournament?.startedAt ? (
          <View style={s.startSection}>
            <Text style={s.startEmoji}>🏁</Text>
            <Text style={s.startTitle}>READY TO START?</Text>
            <Text style={s.startSubtitle}>
              {checkInSummary
                ? `${checkInSummary.checkedIn} / ${checkInSummary.total} teams checked in`
                : 'Check in teams, then start the tournament'}
            </Text>
            <TouchableOpacity
              style={[
                s.startBtn,
                tournamentCourts.length === 0 && { opacity: 0.5 },
              ]}
              onPress={handleOpenStartModal}
              disabled={tournamentCourts.length === 0}
            >
              <Text style={s.startBtnText}>START TOURNAMENT  →</Text>
            </TouchableOpacity>
            <Text style={s.startHelp}>
              Matches will be scheduled automatically as teams check in.{'\n'}
              You can start even if some teams haven't arrived yet.
            </Text>
            {tournamentCourts.length === 0 && (
              <Text style={s.startWarn}>⚠ Add at least one court above first</Text>
            )}
          </View>
        ) : (
          <>
            {/* Download JPG button */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 }}>
              <DownloadJpgButton
                targetRef={scheduleExportRef}
                getFilename={() =>
                  buildExportFilename(tournament?.name ?? 'tournament', undefined, 'schedule')
                }
              />
            </View>
            <View ref={scheduleExportRef} collapsable={false} style={{ backgroundColor: '#FFFFFF' }}>
            {/* Check-in banner */}
            {checkInSummary && (
              <TouchableOpacity
                style={s.checkInBanner}
                onPress={() => setShowCheckInPanel(true)}
                activeOpacity={0.8}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View>
                    <Text style={s.checkInBannerText}>
                      {checkInSummary.checkedIn}/{checkInSummary.total} teams checked in
                    </Text>
                    {checkInSummary.checkedIn < checkInSummary.total && (
                      <Text style={s.checkInBannerSub}>Tap to manage check-ins</Text>
                    )}
                  </View>
                  <View style={s.checkInBannerBtn}>
                    <Text style={s.checkInBannerBtnText}>CHECK IN</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {/* Matches by court */}
            {Object.entries(matchesByCourt).map(([courtLabel, courtMatches]) => (
              <View key={courtLabel} style={s.courtGroup}>
                <View style={s.courtHeader}>
                  <Text style={s.courtHeaderText}>{courtLabel}</Text>
                  <Text style={s.courtMatchCount}>{courtMatches.length} matches</Text>
                </View>
                {courtMatches.map((match) => {
                  const teamA = teamNames[match.teamAId] ?? 'TBD';
                  const teamB = teamNames[match.teamBId] ?? 'TBD';
                  const isDone = match.status === 'completed' || match.status === 'walkover';
                  const isExpanded = expandedMatchId === match.id;
                  const hasScores = match.scores && match.scores.length > 0;
                  const scoreText = hasScores
                    ? match
                        .scores!.map((sc: any) => `${sc.teamAScore ?? 0}-${sc.teamBScore ?? 0}`)
                        .join(', ')
                    : null;
                  const isLive = match.status === 'in_progress';
                  const isScheduled = !isDone && !isLive;
                  const roundLabel =
                    match.round && match.round !== 'pool'
                      ? match.round.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
                      : null;

                  return (
                    <View
                      key={match.id}
                      style={[
                        s.scheduleCard,
                        isExpanded && s.scheduleCardExpanded,
                        isLive && { borderLeftWidth: 3, borderLeftColor: COLORS.green },
                        roundLabel && !isLive && { borderLeftWidth: 3, borderLeftColor: COLORS.warn },
                      ]}
                    >
                      {roundLabel && (
                        <View
                          style={{
                            backgroundColor: '#FFF8E1',
                            paddingHorizontal: 12,
                            paddingVertical: 4,
                            borderTopLeftRadius: 10,
                            borderTopRightRadius: 10,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: '800',
                              color: '#F59E0B',
                              letterSpacing: 1.5,
                              textTransform: 'uppercase',
                            }}
                          >
                            {roundLabel}
                          </Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={s.scheduleCardTouchable}
                        onPress={() => setExpandedMatchId(isExpanded ? null : match.id)}
                        activeOpacity={0.75}
                      >
                        <View style={s.scheduleTime}>
                          <Text style={s.scheduleTimeText}>
                            {formatTime(match.scheduledStart)}
                          </Text>
                          {isLive && (
                            <View style={s.liveBadge}>
                              <Text style={s.liveBadgeText}>LIVE</Text>
                            </View>
                          )}
                        </View>
                        <View style={s.scheduleMatch}>
                          <View
                            style={[
                              s.teamBlock,
                              isDone && match.winnerId === match.teamAId && s.winnerBlock,
                              isDone && match.winnerId && match.winnerId !== match.teamAId && s.loserBlock,
                            ]}
                          >
                            <TeamNameDisplay
                              name={teamA}
                              size="sm"
                              checkedIn={
                                !isDone ? teamCheckedIn[match.teamAId] ?? false : undefined
                              }
                              onCheckIn={
                                !isDone && !teamCheckedIn[match.teamAId]
                                  ? () => handleCheckInTeam(match.teamAId, teamA)
                                  : undefined
                              }
                            />
                          </View>
                          <View style={{ alignItems: 'center', paddingHorizontal: 4 }}>
                            {scoreText ? (
                              <Text style={s.scoreResult}>{scoreText}</Text>
                            ) : (
                              <Text style={s.scheduleVs}>vs</Text>
                            )}
                          </View>
                          <View
                            style={[
                              s.teamBlock,
                              { alignItems: 'flex-end' },
                              isDone && match.winnerId === match.teamBId && s.winnerBlock,
                              isDone && match.winnerId && match.winnerId !== match.teamBId && s.loserBlock,
                            ]}
                          >
                            <TeamNameDisplay
                              name={teamB}
                              size="sm"
                              checkedIn={
                                !isDone ? teamCheckedIn[match.teamBId] ?? false : undefined
                              }
                              onCheckIn={
                                !isDone && !teamCheckedIn[match.teamBId]
                                  ? () => handleCheckInTeam(match.teamBId, teamB)
                                  : undefined
                              }
                            />
                          </View>
                        </View>
                        <View
                          style={[
                            s.statusDot,
                            {
                              backgroundColor: isDone
                                ? COLORS.green
                                : match.status === 'in_progress'
                                ? COLORS.warn
                                : '#CBD5E1',
                            },
                          ]}
                        />
                      </TouchableOpacity>

                      {isExpanded && isScheduled && (
                        <View style={s.startMatchWrap}>
                          <TouchableOpacity
                            style={s.startMatchBtn}
                            onPress={async () => {
                              try {
                                await matchesApi.startMatch(match.id);
                                fetchSchedule();
                              } catch (err: any) {
                                xAlert('Error', err?.response?.data?.message ?? 'Failed to start match');
                              }
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={s.startMatchBtnText}>START MATCH</Text>
                          </TouchableOpacity>
                          <Text style={s.startMatchHint}>Mark this match as in progress to lock the court</Text>
                        </View>
                      )}
                      {isExpanded && isLive && (
                        <InlineScore
                          matchId={match.id}
                          teamAId={match.teamAId}
                          teamBId={match.teamBId}
                          teamAName={teamA}
                          teamBName={teamB}
                          existingScores={match.scores}
                          matchFormat={activeMatchFormat}
                          onDone={() => {
                            setExpandedMatchId(null);
                            fetchSchedule();
                            fetchBracket(activeCategoryId);
                          }}
                        />
                      )}
                      {isExpanded && isDone && (
                        <View style={s.doneMessage}>
                          <Text style={s.doneMessageText}>Match completed — {scoreText}</Text>
                          <TouchableOpacity
                            style={s.editScoreBtn}
                            onPress={() => setEditingMatchId(
                              editingMatchId === match.id ? null : match.id,
                            )}
                          >
                            <Text style={s.editScoreBtnText}>
                              {editingMatchId === match.id ? 'CANCEL EDIT' : 'EDIT SCORE'}
                            </Text>
                          </TouchableOpacity>
                          {editingMatchId === match.id && (
                            <InlineScore
                              matchId={match.id}
                              teamAId={match.teamAId}
                              teamBId={match.teamBId}
                              teamAName={teamA}
                              teamBName={teamB}
                              existingScores={match.scores}
                              matchFormat={activeMatchFormat}
                              onDone={() => {
                                setEditingMatchId(null);
                                setExpandedMatchId(null);
                                fetchSchedule();
                                fetchBracket(activeCategoryId);
                              }}
                            />
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}

            {/* Court TBD — scheduled but court not yet revealed */}
            {courtTbdMatches.length > 0 && (
              <View style={s.waitingSection}>
                <View style={s.waitingHeader}>
                  <Text style={s.waitingHeaderText}>
                    UPCOMING — COURT TBD
                  </Text>
                  <Text style={s.waitingHeaderCount}>
                    {courtTbdMatches.length} match{courtTbdMatches.length !== 1 ? 'es' : ''}
                  </Text>
                </View>
                {courtTbdMatches.map((match) => {
                  const teamA = teamNames[match.teamAId] ?? 'TBD';
                  const teamB = teamNames[match.teamBId] ?? 'TBD';
                  return (
                    <View key={match.id} style={s.courtTbdCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <Text style={s.scheduleTimeText}>
                          {formatTime(match.scheduledStart)}
                        </Text>
                        <View style={s.courtTbdBadge}>
                          <Text style={s.courtTbdBadgeText}>COURT TBD</Text>
                        </View>
                      </View>
                      <View style={s.waitingTeams}>
                        <View style={s.teamBlock}>
                          <TeamNameDisplay name={teamA} size="sm" />
                        </View>
                        <View style={{ alignItems: 'center', paddingHorizontal: 4 }}>
                          <Text style={s.waitingVs}>vs</Text>
                        </View>
                        <View style={[s.teamBlock, { alignItems: 'flex-end' }]}>
                          <TeamNameDisplay name={teamB} size="sm" />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Waiting for check-in section — matches without court/time */}
            {waitingMatches.length > 0 && (
              <View style={s.waitingSection}>
                <View style={s.waitingHeader}>
                  <Text style={s.waitingHeaderText}>
                    ⏳ WAITING FOR CHECK-IN
                  </Text>
                  <Text style={s.waitingHeaderCount}>
                    {waitingMatches.length} match{waitingMatches.length !== 1 ? 'es' : ''}
                  </Text>
                </View>
                {waitingMatches.map((match) => {
                  const teamA = teamNames[match.teamAId] ?? (match as any).teamAId === null ? 'TBD' : 'TBD';
                  const teamB = teamNames[match.teamBId] ?? 'TBD';
                  const teamAName = match.teamAId ? (teamNames[match.teamAId] ?? 'TBD') : 'TBD';
                  const teamBName = match.teamBId ? (teamNames[match.teamBId] ?? 'TBD') : 'TBD';
                  const aCheckedIn = match.teamAId ? (teamCheckedIn[match.teamAId] ?? false) : false;
                  const bCheckedIn = match.teamBId ? (teamCheckedIn[match.teamBId] ?? false) : false;
                  const roundLabel =
                    match.round && match.round !== 'pool'
                      ? match.round.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
                      : null;
                  return (
                    <View key={match.id} style={s.waitingCard}>
                      {roundLabel && (
                        <View style={s.waitingRoundBadge}>
                          <Text style={s.waitingRoundBadgeText}>{roundLabel}</Text>
                        </View>
                      )}
                      <View style={s.waitingTeams}>
                        <View style={s.teamBlock}>
                          <TeamNameDisplay
                            name={teamAName}
                            size="sm"
                            checkedIn={match.teamAId ? aCheckedIn : undefined}
                          />
                        </View>
                        <View style={{ alignItems: 'center', paddingHorizontal: 4 }}>
                          <Text style={s.waitingVs}>vs</Text>
                        </View>
                        <View style={[s.teamBlock, { alignItems: 'flex-end' }]}>
                          <TeamNameDisplay
                            name={teamBName}
                            size="sm"
                            checkedIn={match.teamBId ? bCheckedIn : undefined}
                          />
                        </View>
                      </View>
                      <Text style={s.waitingHint}>
                        {!match.teamAId || !match.teamBId
                          ? 'Waiting for previous round to finish'
                          : 'Will be scheduled when both teams check in'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Move to Knockouts */}
            {allPoolMatchesDone && (
              <View style={s.knockoutSection}>
                <View style={s.knockoutDivider} />
                <Text style={s.knockoutEmoji}>🏆</Text>
                <Text style={s.knockoutTitle}>POOL PLAY COMPLETE</Text>
                <Text style={s.knockoutDesc}>
                  All pool matches are done.{'\n'}Ready to move to knockout stage?
                </Text>
                <TouchableOpacity
                  style={s.knockoutBtn}
                  onPress={handleMoveToKnockouts}
                  activeOpacity={0.8}
                >
                  <Text style={s.knockoutBtnText}>MOVE TO KNOCKOUTS  →</Text>
                </TouchableOpacity>
              </View>
            )}
            </View>
          </>
        )}
      </View>
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════

const scoreStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surfaceAlt,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surface,
  },
  stepLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  winnerRow: { flexDirection: 'row', gap: 8 },
  winnerBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  winnerBtnActive: {
    backgroundColor: 'rgba(6,214,160,0.15)',
    borderColor: COLORS.green,
  },
  winnerBtnText: { color: COLORS.textSub, fontSize: 13, fontWeight: '700' },
  winnerBtnTextActive: { color: COLORS.text },
  winnerBtnSub: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600', marginTop: 1 },
  checkmark: { color: COLORS.green, fontSize: 16, fontWeight: '800', marginTop: 4 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  teamSide: { flex: 1, alignItems: 'center' },
  teamLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', marginBottom: 4 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    width: 60,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dash: { color: COLORS.textMuted, fontSize: 20, fontWeight: '300', marginTop: 16 },
  saveBtn: {
    backgroundColor: COLORS.green,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnText: { color: COLORS.text, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  gameLabel: {
    color: COLORS.blue,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 4,
    textAlign: 'center',
  },
  seriesResult: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },

  // New team card layout
  teamCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
  },
  teamCardWinner: {
    backgroundColor: 'rgba(6,214,160,0.08)',
    borderColor: COLORS.green,
  },
  teamCardLoser: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    opacity: 0.7,
  },
  teamCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamCardName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  teamCardNameWinner: {
    color: COLORS.text,
  },
  teamCardSub: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 1,
  },
  winnerBadge: {
    backgroundColor: COLORS.green,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  winnerBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1,
  },
  tapHint: {
    backgroundColor: 'rgba(33,150,243,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tapHintText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.blue,
    letterSpacing: 1,
  },
  vsLabel: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginVertical: 6,
  },
  scoresInline: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  gameInputWrap: {
    alignItems: 'center',
    gap: 4,
  },
  gameInputLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  gameInput: {
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    width: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gameInputWinner: {
    borderColor: COLORS.green,
    backgroundColor: 'rgba(6,214,160,0.06)',
  },
});

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 8,
    paddingBottom: 8,
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  backBtn: { color: COLORS.blue, fontSize: 14, fontWeight: '600', width: 60 },
  contactsBtn: { color: COLORS.blue, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactSeedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactSeedNum: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
  contactLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  contactName: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.text },
  contactPartnerName: { flex: 1, fontSize: 13, fontWeight: '500', color: COLORS.textSub },
  contactPhone: { fontSize: 13, fontWeight: '700', color: COLORS.blue },
  contactPhoneMissing: { fontSize: 11, fontStyle: 'italic', color: COLORS.textMuted },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { color: COLORS.textSub, fontSize: 11, fontWeight: '500', marginTop: 1 },

  // Category chips
  catRow: { paddingBottom: 8, gap: 8, flexDirection: 'row' as const },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catChipActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  catChipText: { fontSize: 12, fontWeight: '700', color: COLORS.textSub, letterSpacing: 0.3 },
  catChipTextActive: { color: COLORS.white },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabBtnActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  tabText: { fontSize: 11, fontWeight: '800', color: COLORS.textSub, letterSpacing: 1.5 },
  tabTextActive: { color: COLORS.white },

  // Shared inputs
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    color: COLORS.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  phoneRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  phonePrefix: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 54,
  },
  phonePrefixText: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  phoneInput: { flex: 1, marginBottom: 0 },

  // ── Teams tab ─────────────────────────────────
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
    zIndex: 10,
  },
  lockedBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  lockedBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    letterSpacing: 0.3,
  },
  actionBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionBtnText: { color: COLORS.blue, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  saveSeedsBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveSeedsBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  autoMenu: {
    position: 'absolute',
    top: 42,
    right: 0,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    minWidth: 200,
    zIndex: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  autoMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  autoMenuText: { color: COLORS.text, fontSize: 13, fontWeight: '500' },

  addForm: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    marginBottom: 10,
    padding: 14,
  },
  addFormTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  addSectionLabel: {
    color: COLORS.blue,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 4,
  },
  addHint: { color: COLORS.warn, fontSize: 11, fontWeight: '500', marginTop: -4, marginBottom: 4 },
  addFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 10,
  },
  addCancelBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  addCancelText: { color: COLORS.textSub, fontSize: 13, fontWeight: '600' },
  addSubmitBtn: {
    backgroundColor: COLORS.blue,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  addSubmitText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.text, fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptySubText: { color: COLORS.textSub, fontSize: 13 },

  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  seedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  seedNum: { color: COLORS.white, fontSize: 14, fontWeight: '900' },
  playerInfo: { flex: 1, marginLeft: 4 },
  teamPlayerLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 1 },
  playerName: { color: COLORS.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  partnerName: { color: '#475569', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  phoneInline: { color: COLORS.textMuted, fontSize: 11 },
  partnerNeededWrap: {
    backgroundColor: 'rgba(255,152,0,0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  partnerNeededText: { color: COLORS.warn, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  ratingCol: { alignItems: 'center', marginRight: 8 },
  ratingBadge: {
    backgroundColor: 'rgba(255,183,3,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  ratingText: { color: '#F59E0B', fontSize: 13, fontWeight: '800' },
  newBadge: {
    backgroundColor: 'rgba(33,150,243,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  newBadgeText: { color: COLORS.blue, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  arrows: { alignItems: 'center', gap: 4 },
  arrow: { color: '#475569', fontSize: 16, paddingHorizontal: 6, paddingVertical: 2 },
  arrowDisabled: { opacity: 0.2 },

  // ── Draws tab ────────────────────────────────
  sectionHeader: {
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  sectionHeaderText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },

  drawEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSub,
    textAlign: 'center',
    lineHeight: 20,
  },
  drawGenerateBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 36,
    alignItems: 'center',
    marginTop: 20,
  },
  drawGenerateBtnText: { fontSize: 12, fontWeight: '800', color: COLORS.white, letterSpacing: 1.5 },

  poolCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  poolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.navy,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  poolBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  poolBadgeText: { fontSize: 13, fontWeight: '900', color: COLORS.white },
  poolTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: COLORS.white, letterSpacing: 1.5 },
  poolCount: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  poolChevron: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '700',
    marginLeft: 8,
  },

  table: { paddingHorizontal: 12, paddingTop: 8 },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  th: {
    width: 28,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textSub,
    letterSpacing: 0.8,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  tableRowAlt: { backgroundColor: COLORS.surfaceAlt },
  rankNum: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSub,
    width: 16,
    textAlign: 'center',
  },
  seedTag: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.blue,
    backgroundColor: 'rgba(33,150,243,0.1)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  td: { width: 28, textAlign: 'center', fontSize: 12, fontWeight: '600', color: COLORS.text },

  matchesSection: { padding: 12 },
  matchesLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSub,
    letterSpacing: 2,
    marginBottom: 8,
  },
  matchesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  matchesToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.navy,
    letterSpacing: 1.5,
  },
  matchesToggleChevron: {
    fontSize: 10,
    color: COLORS.textSub,
    fontWeight: '700',
  },
  matchCard: {
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  matchCardExpanded: { borderColor: 'rgba(33,150,243,0.4)' },
  matchRowTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  matchStatusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  matchContent: { flex: 1 },
  matchTeams: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  matchVs: { fontSize: 10, fontWeight: '700', color: COLORS.textSub, marginHorizontal: 4 },
  matchScoreText: { fontSize: 11, fontWeight: '700', color: COLORS.blue, marginTop: 4 },

  scoreBtn: {
    backgroundColor: COLORS.blue,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginLeft: 8,
  },
  scoreBtnDone: { backgroundColor: 'rgba(6,214,160,0.15)' },
  scoreBtnText: { fontSize: 10, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
  scoreBtnTextDone: { color: COLORS.green },

  koRoundSection: { marginBottom: 16 },
  koRoundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  koRoundHeaderText: { color: COLORS.white, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  koRoundCount: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
  koMatchCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  koMatchTouchable: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  koMatchNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  koMatchNumberText: { color: COLORS.textSub, fontSize: 10, fontWeight: '800' },
  koMatchContent: { flex: 1 },
  koMatchTeams: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  koVs: { fontSize: 10, fontWeight: '700', color: COLORS.textSub, marginHorizontal: 4 },
  koScoreText: { fontSize: 11, fontWeight: '700', color: COLORS.blue, marginTop: 4 },
  koStatusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },

  // ── Live tab ─────────────────────────────────
  formCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  formLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    width: 70,
  },
  timeColon: { color: COLORS.text, fontSize: 24, fontWeight: '800' },
  settingsRow: { flexDirection: 'row', gap: 12 },
  settingItem: { flex: 1 },
  settingLabel: { color: COLORS.textSub, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  settingInput: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  inputWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  settingInputCompact: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 30,
  },
  unitText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600', marginLeft: 4 },

  chipRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  optionChip: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  optionChipActive: { backgroundColor: 'rgba(33,150,243,0.15)', borderColor: COLORS.blue },
  optionChipText: { color: COLORS.textSub, fontSize: 14, fontWeight: '700' },
  optionChipTextActive: { color: COLORS.blue },

  courtChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  courtChip: {
    backgroundColor: 'rgba(33,150,243,0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  courtChipText: { color: COLORS.blue, fontSize: 12, fontWeight: '700' },
  addCourtRow: { flexDirection: 'row', gap: 8 },
  addCourtInput: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
  },
  addCourtBtn: {
    backgroundColor: COLORS.blue,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  addCourtBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  courtHint: { color: COLORS.warn, fontSize: 11, fontWeight: '500', marginTop: 8 },

  // Regenerate draw button
  regenerateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
  },
  regenerateBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.navy,
    letterSpacing: 1,
  },

  // Manual pool adjustment
  manualPoolCounts: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    justifyContent: 'center',
  },
  manualPoolCountChip: {
    alignItems: 'center',
    minWidth: 40,
  },
  manualPoolCountLetter: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSub,
    letterSpacing: 0.8,
  },
  manualPoolCountNum: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.navy,
  },
  manualTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  manualTeamName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  manualDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    minWidth: 110,
    justifyContent: 'center',
  },
  manualDropdownBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.navy,
  },
  manualDropdownChevron: {
    fontSize: 10,
    color: COLORS.textSub,
    marginLeft: 2,
  },

  // Pool picker modal (nested)
  poolPickerCard: {
    width: '85%',
    maxWidth: 340,
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    padding: 16,
  },
  poolPickerTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.textSub,
    letterSpacing: 1.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  poolPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  poolPickerLetter: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.navy,
  },
  poolPickerCount: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSub,
  },

  // Seeding confirmation modal
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.bg,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  confirmEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.navy,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  confirmMsg: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSub,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 22,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  confirmSecondaryBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmSecondaryBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.navy,
    letterSpacing: 1,
  },
  confirmPrimaryBtn: {
    flex: 1,
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmPrimaryBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 1,
  },

  // Start Tournament section (pre-start)
  startSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  startEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  startTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.navy,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  startSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSub,
    marginBottom: 20,
  },
  startBtn: {
    backgroundColor: COLORS.green,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 260,
    alignItems: 'center',
  },
  startBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  startHelp: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 16,
  },
  startWarn: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.warn,
    marginTop: 8,
  },

  // Waiting for check-in section
  waitingSection: {
    marginTop: 20,
  },
  waitingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  waitingHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.warn,
    letterSpacing: 1.5,
  },
  waitingHeaderCount: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  courtTbdCard: {
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: '#94A3B8',
  },
  courtTbdBadge: {
    backgroundColor: 'rgba(148,163,184,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  courtTbdBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  waitingCard: {
    backgroundColor: 'rgba(255,179,0,0.06)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,179,0,0.25)',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warn,
  },
  waitingRoundBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 6,
  },
  waitingRoundBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.warn,
    letterSpacing: 1,
  },
  waitingTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  waitingVs: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  waitingDot: {
    fontSize: 12,
    width: 16,
    textAlign: 'center',
  },
  waitingDotOk: {
    color: COLORS.green,
  },
  waitingDotPending: {
    color: COLORS.warn,
  },
  waitingHint: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSub,
    fontStyle: 'italic',
  },

  generateScheduleBtn: {
    backgroundColor: COLORS.green,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  generateScheduleBtnText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  checkInBanner: {
    backgroundColor: 'rgba(33,150,243,0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(33,150,243,0.2)',
  },
  checkInBannerText: { color: COLORS.blue, fontSize: 14, fontWeight: '700' },
  checkInBannerSub: { color: COLORS.textMuted, fontSize: 11, fontWeight: '500', marginTop: 2 },
  checkInBannerBtn: {
    backgroundColor: COLORS.green,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  checkInBannerBtnText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  courtGroup: { marginBottom: 20 },
  courtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  courtHeaderText: { color: COLORS.blue, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  courtMatchCount: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },

  scheduleCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    marginBottom: 6,
    overflow: 'hidden',
  },
  scheduleCardExpanded: { borderColor: 'rgba(33,150,243,0.4)' },
  scheduleCardTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  scheduleTime: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scheduleTimeText: { color: COLORS.text, fontSize: 11, fontWeight: '700' },
  liveBadge: {
    backgroundColor: 'rgba(6,214,160,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  liveBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: COLORS.green,
    letterSpacing: 1.5,
  },
  startMatchWrap: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
  },
  startMatchBtn: {
    backgroundColor: COLORS.green,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    alignItems: 'center',
  },
  startMatchBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  startMatchHint: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  scheduleMatch: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  teamBlock: { flex: 1, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 6 },
  winnerBlock: { backgroundColor: 'rgba(6,214,160,0.12)' },
  loserBlock: { opacity: 0.4 },
  scheduleVs: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  scoreResult: { color: COLORS.green, fontSize: 11, fontWeight: '800', marginTop: 2 },
  doneMessage: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
  },
  doneMessageText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  editScoreBtn: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.blue,
    alignSelf: 'center',
  },
  editScoreBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.blue,
    letterSpacing: 0.5,
  },

  knockoutSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginTop: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  knockoutDivider: {
    width: 40,
    height: 3,
    backgroundColor: COLORS.navy,
    borderRadius: 2,
    marginBottom: 16,
  },
  knockoutEmoji: { fontSize: 36, marginBottom: 12 },
  knockoutTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  knockoutDesc: {
    color: COLORS.textSub,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  knockoutBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  knockoutBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '800', letterSpacing: 1 },

  completeBtn: {
    backgroundColor: COLORS.green,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    marginHorizontal: 4,
  },
  completeBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  completeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(6,214,160,0.1)',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(6,214,160,0.3)',
  },
  completeBannerIcon: {
    fontSize: 20,
  },
  completeBannerText: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  // ── Modals ───────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  modalSubtitle: { color: COLORS.textSub, fontSize: 13, marginBottom: 16 },
  modalScroll: { maxHeight: 400 },
  resolveCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  resolveCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resolvePlayerName: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  resolvePhone: { color: COLORS.textMuted, fontSize: 12 },
  resolveActions: { flexDirection: 'row', gap: 8 },
  mergeBtn: {
    flex: 1,
    backgroundColor: 'rgba(33,150,243,0.15)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  mergeBtnText: { color: COLORS.blue, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  addPartnerBtn: {
    flex: 1,
    backgroundColor: 'rgba(6,214,160,0.15)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addPartnerBtnText: { color: COLORS.green, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  mergeSection: { marginTop: 4 },
  mergeSectionLabel: { color: COLORS.textSub, fontSize: 11, fontWeight: '600', marginBottom: 6 },
  mergeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(33,150,243,0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  mergeOptionText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  mergeArrow: { color: COLORS.blue, fontSize: 16, fontWeight: '700' },
  cancelLink: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 6,
  },
  addPartnerSection: { marginTop: 4 },
  addPartnerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  savePartnerBtn: {
    backgroundColor: COLORS.green,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  savePartnerBtnText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  modalFooter: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: { color: COLORS.textSub, fontSize: 14, fontWeight: '700' },
  modalGenerateBtn: {
    flex: 1,
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalGenerateBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  modalSkipBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,152,0,0.15)',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSkipBtnText: {
    color: COLORS.warn,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Check-in modal
  ciModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  ciModalContent: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ciModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ciModalTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  ciModalClose: { color: COLORS.textSub, fontSize: 18, fontWeight: '600', padding: 4 },
  ciModalSummary: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 16 },
  ciModalScroll: { maxHeight: 400 },
  ciTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ciTeamRowChecked: {
    borderColor: 'rgba(6,214,160,0.3)',
    backgroundColor: 'rgba(6,214,160,0.05)',
  },
  ciTeamInfo: { flex: 1, marginRight: 10 },
  ciTeamName: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  ciTeamPartner: { color: COLORS.textSub, fontSize: 12, fontWeight: '600', marginTop: 1 },
  ciCheckedBadge: {
    backgroundColor: 'rgba(6,214,160,0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ciCheckedText: { color: COLORS.green, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  ciCheckInBtn: {
    backgroundColor: COLORS.green,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  ciCheckInBtnText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ciModalDoneBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  ciModalDoneBtnText: { color: COLORS.textSub, fontSize: 14, fontWeight: '700' },

  // Advancing modal
  advModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  advModalContent: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  advModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  advModalTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  advModalClose: { color: COLORS.textSub, fontSize: 18, fontWeight: '600', padding: 4 },
  advModalSummary: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 16 },
  advModalScroll: { maxHeight: 400 },
  advPoolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  advPoolHeaderText: { color: COLORS.white, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  advPoolCount: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
  advTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  advTeamRowSelected: {
    borderLeftColor: COLORS.green,
    backgroundColor: 'rgba(6,214,160,0.05)',
  },
  advTeamRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  advTeamRankText: { color: COLORS.textSub, fontSize: 11, fontWeight: '800' },
  advTeamInfo: { flex: 1, marginRight: 10 },
  advTeamName: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  advTeamRecord: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2 },
  advCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  advCheckboxSelected: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  advCheckmark: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
  advConfirmBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  advConfirmBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
});
