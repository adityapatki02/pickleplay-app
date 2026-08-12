import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';


import apiClient from '../../api/client';
import { tournamentsApi } from '../../api/tournaments.api';
import { matchesApi } from '../../api/matches.api';
import { registrationsApi } from '../../api/registrations.api';
import { xAlert, xConfirm } from '../../utils/alert';
import { YColors, YTopBar } from '../../components/yoiden';

const NAVY = '#001E40';
const BLUE = '#1858D6';
const GREEN = '#06D6A0';
const RED = '#FF3B30';

// ── Inline Score Entry ──────────────────────────────────────────────

function InlineScore({
  matchId,
  teamAId,
  teamBId,
  teamAName,
  teamBName,
  existingScores,
  onDone,
}: {
  matchId: string;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  existingScores?: any[];
  onDone: () => void;
}) {
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState(
    existingScores?.[0]?.teamAScore?.toString() ?? '',
  );
  const [scoreB, setScoreB] = useState(
    existingScores?.[0]?.teamBScore?.toString() ?? '',
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!winnerId) {
      xAlert('Select Winner', 'Tap on the winning team first.');
      return;
    }
    setSaving(true);
    try {
      const a = parseInt(scoreA, 10);
      const b = parseInt(scoreB, 10);
      const hasScores = !isNaN(a) && !isNaN(b);

      if (hasScores) {
        // Enter score — backend auto-determines winner from score
        await matchesApi.enterScore(matchId, [{ gameNumber: 1, teamAScore: a, teamBScore: b }]);
      } else {
        // No score — use walkover with selected winner
        await matchesApi.setWalkover(matchId, winnerId);
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

  return (
    <View style={scoreStyles.container}>
      {/* Step 1: Select winner */}
      <Text style={scoreStyles.stepLabel}>SELECT WINNER</Text>
      <View style={scoreStyles.winnerRow}>
        <TouchableOpacity
          style={[scoreStyles.winnerBtn, winnerId === teamAId && scoreStyles.winnerBtnActive]}
          onPress={() => setWinnerId(teamAId)}
          activeOpacity={0.7}
        >
          <Text style={[scoreStyles.winnerBtnText, winnerId === teamAId && scoreStyles.winnerBtnTextActive]} numberOfLines={1}>
            {aShort[0]}
          </Text>
          {aShort[1] && (
            <Text style={[scoreStyles.winnerBtnSub, winnerId === teamAId && { color: '#475569' }]} numberOfLines={1}>
              {aShort[1]}
            </Text>
          )}
          {winnerId === teamAId && <Text style={scoreStyles.checkmark}>✓</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[scoreStyles.winnerBtn, winnerId === teamBId && scoreStyles.winnerBtnActive]}
          onPress={() => setWinnerId(teamBId)}
          activeOpacity={0.7}
        >
          <Text style={[scoreStyles.winnerBtnText, winnerId === teamBId && scoreStyles.winnerBtnTextActive]} numberOfLines={1}>
            {bShort[0]}
          </Text>
          {bShort[1] && (
            <Text style={[scoreStyles.winnerBtnSub, winnerId === teamBId && { color: '#475569' }]} numberOfLines={1}>
              {bShort[1]}
            </Text>
          )}
          {winnerId === teamBId && <Text style={scoreStyles.checkmark}>✓</Text>}
        </TouchableOpacity>
      </View>

      {/* Step 2: Score (optional) */}
      {winnerId && (
        <>
          <Text style={[scoreStyles.stepLabel, { marginTop: 12 }]}>SCORE (optional)</Text>
          <View style={scoreStyles.scoreRow}>
            <View style={scoreStyles.teamSide}>
              <Text style={scoreStyles.teamLabel} numberOfLines={1}>{aShort[0]}</Text>
              <TextInput
                style={scoreStyles.input}
                value={scoreA}
                onChangeText={(v) => setScoreA(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="—"
                placeholderTextColor="#94A3B8"
                textAlign="center"
              />
            </View>
            <Text style={scoreStyles.dash}>—</Text>
            <View style={scoreStyles.teamSide}>
              <Text style={scoreStyles.teamLabel} numberOfLines={1}>{bShort[0]}</Text>
              <TextInput
                style={scoreStyles.input}
                value={scoreB}
                onChangeText={(v) => setScoreB(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="—"
                placeholderTextColor="#94A3B8"
                textAlign="center"
              />
            </View>
          </View>
        </>
      )}

      {/* Save */}
      <TouchableOpacity
        style={[scoreStyles.saveBtn, (!winnerId || saving) && { opacity: 0.4 }]}
        onPress={handleSave}
        disabled={!winnerId || saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={scoreStyles.saveBtnText}>
            {winnerId ? 'SAVE RESULT' : 'SELECT WINNER FIRST'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const scoreStyles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F7FA',
  },
  stepLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  winnerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  winnerBtn: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  winnerBtnActive: {
    backgroundColor: 'rgba(6,214,160,0.15)',
    borderColor: GREEN,
  },
  winnerBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  winnerBtnTextActive: {
    color: '#1A1D21',
  },
  winnerBtnSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  checkmark: {
    color: GREEN,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  teamSide: {
    flex: 1,
    alignItems: 'center',
  },
  teamLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    color: '#1A1D21',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    width: 60,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dash: {
    color: '#94A3B8',
    fontSize: 20,
    fontWeight: '300',
    marginTop: 16,
  },
  saveBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnText: {
    color: '#1A1D21',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

interface ScheduledMatch {
  id: string;
  matchNumber: number;
  round: string;
  categoryId?: string;
  teamAId: string;
  teamBId: string;
  status: string;
  winnerId?: string;
  courtId?: string;
  courtName?: string;
  scheduledStart?: string;
  scores?: any[];
}

function TeamNameDisplay({ name, checkedIn, onCheckIn }: { name: string; checkedIn?: boolean; onCheckIn?: () => void }) {
  const parts = name.split(' / ');
  const indicator = checkedIn === true ? '✓' : checkedIn === false ? '⏳' : null;
  const indicatorColor = checkedIn ? '#06D6A0' : '#FFB300';

  const IndicatorIcon = () => {
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

  if (parts.length > 1) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <IndicatorIcon />
        <View style={{ flex: 1 }}>
          <Text style={s.matchPlayerName} numberOfLines={1}>{parts[0]}</Text>
          <Text style={s.matchPartnerName} numberOfLines={1}>{parts[1]}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <IndicatorIcon />
      <Text style={[s.matchPlayerName, { flex: 1 }]} numberOfLines={1}>{name}</Text>
    </View>
  );
}

export default function ScheduleScreen() {
  const navigation = useNavigation();
  const route = useRoute<{ key: string; name: string; params: { tournamentId: string } }>();
  const { tournamentId } = route.params;

  const [loading, setLoading] = useState(true);
  const [hasSchedule, setHasSchedule] = useState(false);
  const [matches, setMatches] = useState<ScheduledMatch[]>([]);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [courts, setCourts] = useState<{ id: string; name: string }[]>([]);
  // View toggle: 'court' (default — group by Court A/B/C) | 'category' (group by event)
  const [scheduleView, setScheduleView] = useState<'court' | 'category'>('court');
  const [scheduleCategoryFilter, setScheduleCategoryFilter] = useState<string | null>(null);

  // Setup form state
  const [startHour, setStartHour] = useState('09');
  const [startMinute, setStartMinute] = useState('00');
  const [matchDuration, setMatchDuration] = useState('12');
  const [restBetween, setRestBetween] = useState('5');
  const [pointsPerGame, setPointsPerGame] = useState('11');
  const [setsPerMatch, setSetsPerMatch] = useState('1');
  const [advancingPerPool, setAdvancingPerPool] = useState('2');
  const [courtName, setCourtName] = useState('');
  const [addingCourt, setAddingCourt] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [tournamentCourts, setTournamentCourts] = useState<any[]>([]);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [teamCheckedIn, setTeamCheckedIn] = useState<Record<string, boolean>>({});
  const [checkInSummary, setCheckInSummary] = useState<{ total: number; checkedIn: number } | null>(null);
  const [showCheckInPanel, setShowCheckInPanel] = useState(false);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  // Move to Knockouts state
  const [showAdvancingModal, setShowAdvancingModal] = useState(false);
  const [advancingTeams, setAdvancingTeams] = useState<any[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [loadingAdvancing, setLoadingAdvancing] = useState(false);
  const [confirmingKnockout, setConfirmingKnockout] = useState(false);

  // Map of categoryId → category name for the "BY CATEGORY" view header
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch tournament for courts + categories
      const tournRes = await tournamentsApi.getById(tournamentId);
      const t = tournRes.data?.data ?? tournRes.data;
      setTournamentCourts(t?.courts ?? []);
      const catMap: Record<string, string> = {};
      for (const c of t?.categories ?? []) catMap[c.id] = c.name;
      setCategoryNames(catMap);

      // Fetch schedule
      const schedRes = await apiClient.get(`/tournaments/${tournamentId}/schedule`);
      const data = schedRes.data?.data ?? schedRes.data;
      const matchList = data?.matches ?? [];
      setMatches(matchList);
      setTeamNames(data?.teamNames ?? {});
      setCourts(data?.courts ?? []);
      const rawCheckedIn = data?.teamCheckedIn ?? {};
      const summary = data?.checkInSummary ?? null;
      // If all teams are checked in per summary, fill in any gaps
      if (summary && summary.total > 0 && summary.checkedIn >= summary.total) {
        const allTeamIds = matchList.flatMap((m: any) => [m.teamAId, m.teamBId].filter(Boolean));
        for (const tid of allTeamIds) {
          if (rawCheckedIn[tid] === undefined) rawCheckedIn[tid] = true;
        }
      }
      setTeamCheckedIn(rawCheckedIn);
      setCheckInSummary(summary);
      // Sticky-ish: once any match has a time, treat the schedule as "generated".
      // Matches without a court are TBA, not "no schedule".
      setHasSchedule(matchList.length > 0 && matchList.some((m: any) => !!m.scheduledStart));
    } catch {
      setHasSchedule(false);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  const isMounted = React.useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (isMounted.current) fetchData();
      else { isMounted.current = true; fetchData(); }

      // Auto-refresh every 30 seconds when schedule is live
      const interval = setInterval(() => {
        if (hasSchedule) fetchData();
      }, 30000);
      return () => clearInterval(interval);
    }, [fetchData, hasSchedule]),
  );

  const handleAddCourt = async () => {
    if (!courtName.trim()) return;
    setAddingCourt(true);
    try {
      await tournamentsApi.addCourt(tournamentId, { name: courtName.trim(), surfaceType: 'standard' });
      setCourtName('');
      // Refresh courts
      const tournRes = await tournamentsApi.getById(tournamentId);
      const t = tournRes.data?.data ?? tournRes.data;
      setTournamentCourts(t?.courts ?? []);
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
          fetchData();
        } catch (err: any) {
          xAlert('Error', err?.response?.data?.message ?? 'Check-in failed');
        }
      },
      'Check In',
    );
  };

  const handleGenerate = () => {
    if (tournamentCourts.length === 0) {
      xAlert('No Courts', 'Add at least one court before generating the schedule.');
      return;
    }
    const dur = parseInt(matchDuration) || 30;
    const rest = parseInt(restBetween) || 10;
    const h = parseInt(startHour) || 9;
    const m = parseInt(startMinute) || 0;

    // Build start time as today at the specified hour
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);

    xConfirm(
      'Generate Schedule',
      `Assign ${tournamentCourts.length} court${tournamentCourts.length > 1 ? 's' : ''} starting at ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}\n${dur} min/match + ${rest} min rest`,
      async () => {
        setGenerating(true);
        try {
          await apiClient.post(`/tournaments/${tournamentId}/generate-schedule`, {
            startTime: start.toISOString(),
            matchDurationMin: dur,
            restBetweenMin: rest,
            courtIds: tournamentCourts.map((c: any) => c.id),
            pointsPerGame: parseInt(pointsPerGame) || 11,
            setsPerMatch: parseInt(setsPerMatch) || 1,
            advancingPerPool: parseInt(advancingPerPool) || 2,
          });
          await fetchData();
          xAlert('Schedule Created', 'Matches have been assigned to courts and time slots.');
        } catch (err: any) {
          xAlert('Error', err?.response?.data?.message ?? 'Failed to generate schedule');
        } finally {
          setGenerating(false);
        }
      },
      'Generate',
    );
  };

  // Check if all pool matches are complete (ignore knockout matches)
  const poolMatches = matches.filter((m) => !m.round || m.round === 'pool');
  const knockoutMatches = matches.filter((m) => m.round && m.round !== 'pool');
  const allPoolMatchesDone = poolMatches.length > 0
    && poolMatches.every((m) => m.status === 'completed' || m.status === 'walkover')
    && knockoutMatches.length === 0; // Don't show if knockout already exists

  const handleMoveToKnockouts = async () => {
    setShowAdvancingModal(true);
    setLoadingAdvancing(true);
    try {
      // Get categoryId from the first pool match
      const firstPoolMatch = poolMatches.find((m: any) => m.categoryId);
      const catId = firstPoolMatch?.categoryId;
      if (!catId) { xAlert('Error', 'Could not determine category'); setShowAdvancingModal(false); return; }
      const res = await matchesApi.getAdvancingTeams(tournamentId, catId);
      const data = res.data?.data ?? res.data;
      const pools = data?.pools ?? [];
      setAdvancingTeams(pools);
      // Pre-select the advancing teams
      const preSelected = new Set<string>();
      for (const pool of pools) {
        for (const team of pool.teams ?? []) {
          if (team.advancing) {
            preSelected.add(team.teamId);
          }
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
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
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
      const catMatch = poolMatches.find((m: any) => m.categoryId);
      if (!catMatch?.categoryId) { xAlert('Error', 'Could not determine category'); setConfirmingKnockout(false); return; }
      await matchesApi.confirmAdvancing(tournamentId, catMatch.categoryId, Array.from(selectedTeamIds));
      setShowAdvancingModal(false);
      xAlert('Success', 'Knockout bracket has been generated!');
      const firstMatch = poolMatches.find((m: any) => m.categoryId);
      (navigation as any).navigate('BracketManage', { categoryId: firstMatch?.categoryId, tournamentId });
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? 'Failed to generate knockout bracket');
    } finally {
      setConfirmingKnockout(false);
    }
  };

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Group matches by court. Matches without a court (courtId=null) go under
  // "Court TBA" — they have a preliminary scheduledStart but the court is
  // assigned only when teams check in and the upcoming-slot cap allows it.
  const matchesByCourt: Record<string, ScheduledMatch[]> = {};
  for (const m of matches) {
    const key = m.courtName || (m.courtId ? m.courtId : 'Court TBA');
    if (!matchesByCourt[key]) matchesByCourt[key] = [];
    matchesByCourt[key].push(m);
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: YColors.bg }}>
        <SafeAreaView style={s.screen}>
          <View style={s.center}>
            <ActivityIndicator size="large" color={BLUE} />
          </View>
        </SafeAreaView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: YColors.bg }}>
      <SafeAreaView style={s.screen}>
        <YTopBar
          eyebrow="ORGANIZER"
          title="SCHEDULE"
          onBack={() => navigation.goBack()}
        />

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {!hasSchedule ? (
            /* ──── SETUP FORM ──── */
            <View>
              <Text style={s.sectionTitle}>Create Schedule</Text>
              <Text style={s.sectionDesc}>
                Assign matches to courts and time slots automatically.
              </Text>

              {/* Start Time */}
              <View style={s.formCard}>
                <Text style={s.formLabel}>START TIME</Text>
                <View style={s.timeRow}>
                  <TextInput
                    style={s.timeInput}
                    value={startHour}
                    onChangeText={setStartHour}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="09"
                    placeholderTextColor={'#94A3B8'}
                  />
                  <Text style={s.timeColon}>:</Text>
                  <TextInput
                    style={s.timeInput}
                    value={startMinute}
                    onChangeText={setStartMinute}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="00"
                    placeholderTextColor={'#94A3B8'}
                  />
                </View>
              </View>

              {/* Match Duration & Rest */}
              <View style={s.formCard}>
                <Text style={s.formLabel}>MATCH SETTINGS</Text>
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
                        placeholderTextColor={'#94A3B8'}
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
                        placeholderTextColor={'#94A3B8'}
                      />
                      <Text style={s.unitText}>min</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Game Format */}
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
                      placeholderTextColor={'#94A3B8'}
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
                          <Text style={[s.optionChipText, setsPerMatch === val && s.optionChipTextActive]}>{val}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </View>

              {/* Pool Advancement */}
              <View style={s.formCard}>
                <Text style={s.formLabel}>POOL ADVANCEMENT</Text>
                <Text style={s.settingLabel}>Teams advancing per pool</Text>
                <TextInput
                  style={[s.settingInput, { marginTop: 6, width: 80 }]}
                  value={advancingPerPool}
                  onChangeText={setAdvancingPerPool}
                  keyboardType="number-pad"
                  placeholder="2"
                  placeholderTextColor={'#94A3B8'}
                />
              </View>

              {/* Courts */}
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
                    placeholderTextColor={'#94A3B8'}
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

              {/* Generate Button */}
              <TouchableOpacity
                style={[s.generateBtn, (generating || tournamentCourts.length === 0) && { opacity: 0.5 }]}
                onPress={handleGenerate}
                disabled={generating || tournamentCourts.length === 0}
              >
                {generating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.generateBtnText}>GENERATE SCHEDULE</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* ──── SCHEDULE VIEW ──── */
            <View>
              {/* View toggle: BY COURT / BY CATEGORY */}
              <View style={s.viewToggleRow}>
                <TouchableOpacity
                  style={[s.viewToggleBtn, scheduleView === 'court' && s.viewToggleBtnActive]}
                  onPress={() => { setScheduleView('court'); setScheduleCategoryFilter(null); }}
                >
                  <Text style={[s.viewToggleText, scheduleView === 'court' && s.viewToggleTextActive]}>BY COURT</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.viewToggleBtn, scheduleView === 'category' && s.viewToggleBtnActive]}
                  onPress={() => setScheduleView('category')}
                >
                  <Text style={[s.viewToggleText, scheduleView === 'category' && s.viewToggleTextActive]}>BY CATEGORY</Text>
                </TouchableOpacity>
              </View>

              {/* Check-in summary banner + button */}
              {checkInSummary && (
                <TouchableOpacity
                  style={s.checkInBanner}
                  onPress={() => setShowCheckInPanel(true)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={s.checkInBannerText}>
                        {checkInSummary.checkedIn}/{checkInSummary.total} teams checked in
                      </Text>
                      {checkInSummary.checkedIn < checkInSummary.total && (
                        <Text style={s.checkInBannerSub}>
                          Tap to manage check-ins
                        </Text>
                      )}
                    </View>
                    <View style={s.checkInBannerBtn}>
                      <Text style={s.checkInBannerBtnText}>CHECK IN</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}

              {/* BY CATEGORY view: 40-tile grid → drill into one */}
              {scheduleView === 'category' && !scheduleCategoryFilter && (() => {
                const byCat: Record<string, ScheduledMatch[]> = {};
                for (const m of matches) {
                  const key = m.categoryId ?? '_';
                  if (!byCat[key]) byCat[key] = [];
                  byCat[key].push(m);
                }
                const catIds = Object.keys(categoryNames);
                if (catIds.length === 0) {
                  return <Text style={s.sectionDesc}>No categories found.</Text>;
                }
                return (
                  <View style={s.catGridWrap}>
                    {catIds.map((cid) => {
                      const count = byCat[cid]?.length ?? 0;
                      return (
                        <TouchableOpacity
                          key={cid}
                          style={s.catGridTile}
                          onPress={() => setScheduleCategoryFilter(cid)}
                        >
                          <Text style={s.catGridTileName} numberOfLines={2}>{categoryNames[cid]}</Text>
                          <View style={s.catGridFooter}>
                            <View style={[s.catGridPill, count === 0 && s.catGridPillMuted]}>
                              <Text style={[s.catGridPillText, count === 0 && s.catGridPillTextMuted]}>
                                {count} matches
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })()}

              {/* BY CATEGORY drilled-in: header + filtered matches grouped by court */}
              {scheduleView === 'category' && scheduleCategoryFilter && (
                <View style={{ marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setScheduleCategoryFilter(null)} style={s.catBackBtn}>
                    <Text style={s.catBackText}>← All categories</Text>
                  </TouchableOpacity>
                  <Text style={s.catFilterTitle}>{categoryNames[scheduleCategoryFilter] ?? 'Category'}</Text>
                </View>
              )}

              {/* BY COURT (default) OR drilled-in category view: iterate matchesByCourt
                  but filter to the selected category when in drill-in. */}
              {(scheduleView === 'court' || scheduleCategoryFilter) && Object.entries(matchesByCourt)
                .map(([courtLabel, courtMatches]) => {
                  const filtered = scheduleCategoryFilter
                    ? courtMatches.filter((m) => m.categoryId === scheduleCategoryFilter)
                    : courtMatches;
                  if (filtered.length === 0) return null;
                  return [courtLabel, filtered] as [string, ScheduledMatch[]];
                })
                .filter(Boolean)
                .map((entry) => {
                  const [courtLabel, courtMatches] = entry as [string, ScheduledMatch[]];
                  return (
                <View key={courtLabel} style={s.courtGroup}>
                  <View style={s.courtHeader}>
                    <Text style={s.courtHeaderText}>{courtLabel}</Text>
                    <Text style={s.courtMatchCount}>{courtMatches.length} matches</Text>
                  </View>

                  {/* TBA explainer — preliminary times only, real court + start
                      are committed once both teams have checked in and the
                      previous matches on that court have finished. */}
                  {courtLabel === 'Court TBA' && (
                    <View style={s.tbaNote}>
                      <Text style={s.tbaNoteText}>
                        These are preliminary timings. The actual time and court will be revealed once all teams have checked in and the previous matches are completed.
                      </Text>
                    </View>
                  )}

                  {courtMatches.map((match) => {
                    const teamA = teamNames[match.teamAId] ?? 'TBD';
                    const teamB = teamNames[match.teamBId] ?? 'TBD';
                    const isDone = match.status === 'completed' || match.status === 'walkover';
                    const isExpanded = expandedMatchId === match.id;
                    const hasScores = match.scores && match.scores.length > 0;
                    const scoreText = hasScores
                      ? match.scores!.map((sc: any) => `${sc.teamAScore ?? 0}-${sc.teamBScore ?? 0}`).join(', ')
                      : null;
                    const roundLabel = match.round && match.round !== 'pool'
                      ? match.round.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
                      : null;

                    return (
                      <View key={match.id} style={[s.scheduleCard, isExpanded && s.scheduleCardExpanded, roundLabel && { borderLeftWidth: 3, borderLeftColor: '#FFB300' }]}>
                        {roundLabel && (
                          <View style={{ backgroundColor: '#FFF8E1', paddingHorizontal: 12, paddingVertical: 4, borderTopLeftRadius: 10, borderTopRightRadius: 10 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#F59E0B', letterSpacing: 1.5, textTransform: 'uppercase' }}>{roundLabel}</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          style={s.scheduleCardTouchable}
                          onPress={() => {
                            if (isDone) {
                              // For completed matches, keep the inline summary toggle
                              setExpandedMatchId(isExpanded ? null : match.id);
                            } else {
                              // For live/pending matches, route to the unified Score Entry screen
                              (navigation as any).navigate('ScoreEntry', { matchId: match.id, tournamentId });
                            }
                          }}
                          activeOpacity={0.75}
                        >
                          <View style={s.scheduleTime}>
                            <Text style={s.scheduleTimeText}>{formatTime(match.scheduledStart)}</Text>
                          </View>
                          <View style={s.scheduleMatch}>
                            <View style={[
                              s.teamBlock,
                              isDone && match.winnerId === match.teamAId && s.winnerBlock,
                              isDone && match.winnerId && match.winnerId !== match.teamAId && s.loserBlock,
                            ]}>
                              <TeamNameDisplay
                                name={teamA}
                                checkedIn={!isDone ? (teamCheckedIn[match.teamAId] ?? false) : undefined}
                                onCheckIn={!isDone && !(teamCheckedIn[match.teamAId]) ? () => handleCheckInTeam(match.teamAId, teamA) : undefined}
                              />
                            </View>
                            <View style={{ alignItems: 'center', paddingHorizontal: 4 }}>
                              {scoreText ? (
                                <Text style={s.scoreResult}>{scoreText}</Text>
                              ) : (
                                <Text style={s.scheduleVs}>vs</Text>
                              )}
                            </View>
                            <View style={[
                              s.teamBlock,
                              { alignItems: 'flex-end' },
                              isDone && match.winnerId === match.teamBId && s.winnerBlock,
                              isDone && match.winnerId && match.winnerId !== match.teamBId && s.loserBlock,
                            ]}>
                              <TeamNameDisplay
                                name={teamB}
                                checkedIn={!isDone ? (teamCheckedIn[match.teamBId] ?? false) : undefined}
                                onCheckIn={!isDone && !(teamCheckedIn[match.teamBId]) ? () => handleCheckInTeam(match.teamBId, teamB) : undefined}
                              />
                            </View>
                          </View>
                          <View style={[s.statusDot, {
                            backgroundColor: isDone ? GREEN : match.status === 'in_progress' ? '#FFB300' : '#CBD5E1',
                          }]} />
                        </TouchableOpacity>

                        {isExpanded && isDone && (
                          <View style={s.doneMessage}>
                            <Text style={s.doneMessageText}>Match completed — {scoreText}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
                  );
                })}

              {/* Move to Knockouts section */}
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

              {/* Refresh preliminary times — soft reshuffle without touching settings */}
              <TouchableOpacity
                style={s.regenerateBtn}
                onPress={async () => {
                  try {
                    await matchesApi.reschedule(tournamentId);
                    await fetchData();
                  } catch (err: any) {
                    xAlert('Error', err?.response?.data?.message ?? 'Could not refresh schedule');
                  }
                }}
              >
                <Text style={s.regenerateBtnText}>↻ Refresh preliminary times</Text>
              </TouchableOpacity>

              {/* Regenerate option — full reset to setup form */}
              <TouchableOpacity
                style={s.regenerateBtn}
                onPress={() => {
                  xConfirm(
                    'Regenerate Schedule',
                    'This will reassign all matches to courts and time slots. Existing assignments will be overwritten.',
                    () => { setHasSchedule(false); },
                    'Regenerate',
                  );
                }}
              >
                <Text style={s.regenerateBtnText}>Regenerate Schedule</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
        {/* Check-in Panel Modal */}
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
                {/* Build unique teams from teamNames + teamCheckedIn */}
                {Object.entries(teamNames).map(([teamId, name]) => {
                  const isChecked = teamCheckedIn[teamId] ?? false;
                  const parts = name.split(' / ');
                  const isLoading = checkingInId === teamId;

                  return (
                    <View key={teamId} style={[s.ciTeamRow, isChecked && s.ciTeamRowChecked]}>
                      <View style={s.ciTeamInfo}>
                        <Text style={s.ciTeamName} numberOfLines={1}>{parts[0]}</Text>
                        {parts[1] && (
                          <Text style={s.ciTeamPartner} numberOfLines={1}>{parts[1]}</Text>
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
                              setCheckInSummary((prev) => prev ? { ...prev, checkedIn: prev.checkedIn + 1 } : prev);
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
                onPress={() => { setShowCheckInPanel(false); fetchData(); }}
              >
                <Text style={s.ciModalDoneBtnText}>DONE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Advancing Teams Modal */}
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
                  <ActivityIndicator size="large" color={BLUE} />
                  <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 12 }}>Loading standings...</Text>
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
                        const diff = team.pointDiff ?? ((team.pointsFor ?? 0) - (team.pointsAgainst ?? 0));
                        const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;
                        const poolLetter = String.fromCharCode(65 + poolIdx); // A, B, C...
                        const poolTag = `${poolLetter}${tIdx + 1}`; // A1, A2, B1, B2...

                        return (
                          <TouchableOpacity
                            key={team.teamId}
                            style={[
                              s.advTeamRow,
                              isSelected && s.advTeamRowSelected,
                            ]}
                            onPress={() => toggleTeamSelection(team.teamId)}
                            activeOpacity={0.7}
                          >
                            <View style={s.advTeamRank}>
                              <Text style={s.advTeamRankText}>{poolTag}</Text>
                            </View>
                            <View style={s.advTeamInfo}>
                              <Text style={s.advTeamName} numberOfLines={1}>{team.name}</Text>
                              <Text style={s.advTeamRecord}>
                                {wins}W - {losses}L  |  {diffStr} pts
                              </Text>
                            </View>
                            <View style={[
                              s.advCheckbox,
                              isSelected && s.advCheckboxSelected,
                            ]}>
                              {isSelected && (
                                <Text style={s.advCheckmark}>✓</Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </ScrollView>
              )}

              <TouchableOpacity
                style={[s.advConfirmBtn, (confirmingKnockout || loadingAdvancing || selectedTeamIds.size === 0) && { opacity: 0.5 }]}
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
    </SafeAreaView>
  );
}

const CARD_BG = '#F5F7FA';
const CARD_BORDER = '#F5F7FA';

const s = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { color: BLUE, fontSize: 14, fontWeight: '600' },
  headerTitle: { color: '#1A1D21', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },

  sectionTitle: { color: '#1A1D21', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  sectionDesc: { color: '#64748B', fontSize: 13, marginBottom: 20 },

  // Form cards
  formCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  formLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },

  // Time inputs
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#1A1D21',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    width: 70,
  },
  timeColon: { color: '#1A1D21', fontSize: 24, fontWeight: '800' },

  // Settings
  settingsRow: { flexDirection: 'row', gap: 12 },
  settingItem: { flex: 1 },
  settingLabel: { color: '#64748B', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  settingInput: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#1A1D21',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  inputWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  settingInputCompact: {
    color: '#1A1D21',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 30,
  },
  unitText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Option chips (for points, sets, advancing)
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  optionChip: {
    backgroundColor: '#F5F7FA',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  optionChipActive: {
    backgroundColor: 'rgba(33,150,243,0.2)',
    borderColor: BLUE,
  },
  optionChipText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },
  optionChipTextActive: {
    color: BLUE,
  },

  // Courts
  courtChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  courtChip: {
    backgroundColor: 'rgba(33,150,243,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  courtChipText: { color: BLUE, fontSize: 12, fontWeight: '700' },
  addCourtRow: { flexDirection: 'row', gap: 8 },
  addCourtInput: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1A1D21',
    fontSize: 14,
  },
  addCourtBtn: {
    backgroundColor: BLUE,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  addCourtBtnText: { color: '#1A1D21', fontSize: 13, fontWeight: '700' },
  courtHint: { color: '#FFB300', fontSize: 11, fontWeight: '500', marginTop: 8 },

  // Generate button
  generateBtn: {
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  generateBtnText: { color: '#1A1D21', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },

  // Check-in banner
  checkInBanner: {
    backgroundColor: 'rgba(33,150,243,0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(33,150,243,0.2)',
  },
  checkInBannerText: {
    color: BLUE,
    fontSize: 14,
    fontWeight: '700',
  },
  checkInBannerSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  checkInBannerBtn: {
    backgroundColor: GREEN,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  checkInBannerBtnText: {
    color: '#1A1D21',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Check-in Modal
  ciModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  ciModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ciModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ciModalTitle: {
    color: '#1A1D21',
    fontSize: 18,
    fontWeight: '800',
  },
  ciModalClose: {
    color: '#64748B',
    fontSize: 18,
    fontWeight: '600',
    padding: 4,
  },
  ciModalSummary: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 16,
  },
  ciModalScroll: {
    maxHeight: 400,
  },
  ciTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F5F7FA',
  },
  ciTeamRowChecked: {
    borderColor: 'rgba(6,214,160,0.2)',
    backgroundColor: 'rgba(6,214,160,0.05)',
  },
  ciTeamInfo: {
    flex: 1,
    marginRight: 10,
  },
  ciTeamName: {
    color: '#1A1D21',
    fontSize: 14,
    fontWeight: '700',
  },
  ciTeamPartner: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  ciCheckedBadge: {
    backgroundColor: 'rgba(6,214,160,0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ciCheckedText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ciCheckInBtn: {
    backgroundColor: GREEN,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  ciCheckInBtnText: {
    color: '#1A1D21',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ciModalDoneBtn: {
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  ciModalDoneBtnText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },

  // BY COURT / BY CATEGORY view toggle
  viewToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  viewToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: YColors.bg3,
  },
  viewToggleBtnActive: { backgroundColor: YColors.ink },
  viewToggleText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4, color: YColors.ink2 },
  viewToggleTextActive: { color: '#FFFFFF' },

  // Category grid (drill-in landing for BY CATEGORY)
  catGridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catGridTile: {
    width: '48.5%', minHeight: 88,
    backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12,
    justifyContent: 'space-between',
  },
  catGridTileName: { fontSize: 12, fontWeight: '900', color: YColors.ink, letterSpacing: 0.3, textTransform: 'uppercase', lineHeight: 15 },
  catGridFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  catGridPill: { backgroundColor: YColors.ink, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  catGridPillMuted: { backgroundColor: YColors.line },
  catGridPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  catGridPillTextMuted: { color: YColors.ink2 },
  catBackBtn: { paddingVertical: 6, alignSelf: 'flex-start' },
  catBackText: { fontSize: 12, fontWeight: '700', color: YColors.ink2 },
  catFilterTitle: { fontSize: 16, fontWeight: '900', color: YColors.ink, letterSpacing: 0.5, marginTop: 4, textTransform: 'uppercase' },

  // Schedule view
  courtGroup: { marginBottom: 20 },
  courtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  courtHeaderText: { color: BLUE, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  courtMatchCount: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },

  // TBA explainer banner — sits between the "Court TBA" header and its match list
  tbaNote: {
    backgroundColor: '#FFF8E1',
    borderLeftWidth: 3,
    borderLeftColor: '#FFB300',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    borderRadius: 6,
  },
  tbaNoteText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7C5803',
    lineHeight: 16,
    fontStyle: 'italic',
  },

  scheduleCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 10,
    marginBottom: 6,
    overflow: 'hidden',
  },
  scheduleCardExpanded: {
    borderColor: 'rgba(33,150,243,0.3)',
  },
  scheduleCardTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  scheduleTime: {
    backgroundColor: '#F5F7FA',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scheduleTimeText: { color: '#1A1D21', fontSize: 11, fontWeight: '700' },
  scheduleMatch: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  teamBlock: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  winnerBlock: {
    backgroundColor: '#E2E8F0',
  },
  loserBlock: {
    opacity: 0.35,
  },
  scheduleVs: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  matchPlayerName: { color: '#1A1D21', fontSize: 12, fontWeight: '700' },
  matchPartnerName: { color: '#64748B', fontSize: 10, fontWeight: '600' },

  scoreResult: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  doneMessage: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F7FA',
    alignItems: 'center',
  },
  doneMessageText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  regenerateBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  regenerateBtnText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },

  // Move to Knockouts section
  knockoutSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#F5F7FA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  knockoutDivider: {
    width: 40,
    height: 3,
    backgroundColor: NAVY,
    borderRadius: 2,
    marginBottom: 16,
  },
  knockoutEmoji: {
    fontSize: 36,
    marginBottom: 12,
  },
  knockoutTitle: {
    color: '#1A1D21',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  knockoutDesc: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  knockoutBtn: {
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  knockoutBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Advancing Teams Modal
  advModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  advModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  advModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  advModalTitle: {
    color: '#1A1D21',
    fontSize: 18,
    fontWeight: '800',
  },
  advModalClose: {
    color: '#64748B',
    fontSize: 18,
    fontWeight: '600',
    padding: 4,
  },
  advModalSummary: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 16,
  },
  advModalScroll: {
    maxHeight: 400,
  },
  advPoolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: NAVY,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  advPoolHeaderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  advPoolCount: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
  },
  advTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  advTeamRowSelected: {
    borderLeftColor: GREEN,
    backgroundColor: 'rgba(6,214,160,0.05)',
  },
  advTeamRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  advTeamRankText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
  },
  advTeamInfo: {
    flex: 1,
    marginRight: 10,
  },
  advTeamName: {
    color: '#1A1D21',
    fontSize: 14,
    fontWeight: '700',
  },
  advTeamRecord: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  advCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  advCheckboxSelected: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  advCheckmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  advConfirmBtn: {
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  advConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
