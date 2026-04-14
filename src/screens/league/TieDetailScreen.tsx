import React, { useCallback, useState } from 'react';
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
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import {
  getTie,
  getTieSheets,
  lockLineups,
  startTie,
  completeTie,
} from '../../api/leagues.api';
import { matchesApi } from '../../api/matches.api';
import { useLeagueStore } from '../../store/leagueStore';
import { xAlert, xConfirm } from '../../utils/alert';
import type {
  Tie,
  TieMatch,
  TieSheet,
  TieStatus,
  TieSheetStatus,
  CategorySlug,
} from '../../types/league.types';

// ─── Design tokens ──────────────────────────────────────────────────────────
const NAVY = '#001E40';
const BLUE = '#2196F3';
const GREEN = '#06D6A0';
const SURFACE = '#F5F7FA';
const BORDER = '#E2E8F0';
const TEXT_COLOR = '#1A1D21';
const TEXT_SUB = '#64748B';
const TEXT_MUTED = '#94A3B8';
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
  const [tie, setTie] = useState<Tie | null>(null);
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

  // ── Data fetching ──
  const fetchData = useCallback(async () => {
    try {
      const [tieData, sheetsData] = await Promise.all([
        getTie(tieId),
        getTieSheets(tieId).catch(() => [] as TieSheet[]),
      ]);
      setTie(tieData);
      setTieSheets(sheetsData);
      store.setCurrentTie(tieData);
    } catch (err: any) {
      xAlert('Error', err?.message || 'Failed to load tie details');
    }
  }, [tieId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData().finally(() => setLoading(false));
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

  const handleStartTie = () => {
    xConfirm('Start Tie', 'Begin this tie? All 13 matches will become active.', async () => {
      setActionLoading(true);
      try {
        await startTie(tieId);
        xAlert('Success', 'Tie started!');
        await fetchData();
      } catch (err: any) {
        xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to start tie');
      } finally {
        setActionLoading(false);
      }
    });
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
  const openScoreEntry = (tm: TieMatch) => {
    const existing = tm.match?.scores?.[0];
    setScoreA(existing ? String(existing.teamAScore) : '');
    setScoreB(existing ? String(existing.teamBScore) : '');
    setScoreModal({ visible: true, tieMatch: tm });
  };

  const handleSaveScore = async () => {
    const tm = scoreModal.tieMatch;
    if (!tm?.matchId) return;

    const a = parseInt(scoreA, 10);
    const b = parseInt(scoreB, 10);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) {
      xAlert('Invalid Score', 'Please enter valid scores for both teams.');
      return;
    }

    setScoreSubmitting(true);
    try {
      await matchesApi.enterScore(tm.matchId, [{ gameNumber: 1, teamAScore: a, teamBScore: b }]);
      setScoreModal({ visible: false, tieMatch: null });
      await fetchData();
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message || err?.message || 'Failed to save score');
    } finally {
      setScoreSubmitting(false);
    }
  };

  // ── Helpers ──
  const homeName = tie?.homeTeam?.name || tie?.homeTeam?.shortName || 'Home';
  const awayName = tie?.awayTeam?.name || tie?.awayTeam?.shortName || 'Away';

  const homeSheet = tieSheets.find((s) => s.franchiseId === tie?.homeTeamId);
  const awaySheet = tieSheets.find((s) => s.franchiseId === tie?.awayTeamId);

  const allMatchesCompleted =
    tie?.tieMatches?.every((tm) => tm.match?.status === 'completed') || false;

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
        <View style={[styles.statusChip, { backgroundColor: chipCfg.bg }]}>
          <Text style={[styles.statusChipText, { color: chipCfg.color }]}>{chipCfg.label}</Text>
        </View>
      </View>

      {/* Team names */}
      <View style={styles.matchupRow}>
        <View style={styles.teamBlock}>
          <Text style={styles.teamName} numberOfLines={2}>
            {homeName}
          </Text>
          <Text style={styles.teamLabel}>HOME</Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={styles.scoreText}>
            {tie.homeScore} - {tie.awayScore}
          </Text>
          <Text style={styles.scoreSub}>Match Points</Text>
        </View>
        <View style={styles.teamBlock}>
          <Text style={styles.teamName} numberOfLines={2}>
            {awayName}
          </Text>
          <Text style={styles.teamLabel}>AWAY</Text>
        </View>
      </View>

      {/* Bonus + standing points */}
      <View style={styles.bonusRow}>
        <View style={styles.bonusSide}>
          <Text style={styles.bonusValue}>+{tie.homeBonusPoints}</Text>
          <Text style={styles.bonusLabel}>bonus</Text>
        </View>
        <View style={styles.standingPointsBox}>
          <Text style={styles.spLabel}>Standing Pts</Text>
          <Text style={styles.spText}>
            {tie.homeStandingPoints} vs {tie.awayStandingPoints}
          </Text>
        </View>
        <View style={styles.bonusSide}>
          <Text style={styles.bonusValue}>+{tie.awayBonusPoints}</Text>
          <Text style={styles.bonusLabel}>bonus</Text>
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

      {/* Lock button */}
      {tie.status === 'lineup_submitted' && homeSheet && awaySheet && (
        <TouchableOpacity
          style={styles.lockBtn}
          onPress={handleLockLineups}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <ActivityIndicator color={WHITE} size="small" />
          ) : (
            <Text style={styles.lockBtnText}>LOCK LINEUPS</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  const renderMatchCard = (tm: TieMatch, idx: number) => {
    const cat = CATEGORY_COLORS[tm.categorySlug] || CATEGORY_COLORS.men1;
    const matchStatus = tm.match?.status || 'scheduled';
    const scores = tm.match?.scores?.[0];
    const isCompleted = matchStatus === 'completed';
    const canEnterScore = tie.status === 'in_progress' || tie.status === 'lineup_locked';

    return (
      <TouchableOpacity
        key={tm.id}
        style={styles.matchCard}
        activeOpacity={canEnterScore ? 0.7 : 1}
        onPress={() => canEnterScore && openScoreEntry(tm)}
      >
        {/* Top row: slot, category, points */}
        <View style={styles.matchCardTop}>
          <View style={styles.matchSlot}>
            <Text style={styles.matchSlotText}>#{tm.slotNumber}</Text>
          </View>
          <View style={[styles.categoryBadge, { backgroundColor: cat.bg }]}>
            <Text style={[styles.categoryBadgeText, { color: cat.color }]}>{cat.label}</Text>
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

        {/* Players + score */}
        <View style={styles.matchPlayers}>
          <View style={styles.matchPlayerSide}>
            <Text style={styles.matchPlayerText} numberOfLines={1}>
              {tm.homePlayer1Id ? 'P1 & P2' : 'TBD'}
            </Text>
          </View>
          <View style={styles.matchScoreCenter}>
            {scores ? (
              <Text style={[styles.matchScoreText, isCompleted && { color: NAVY }]}>
                {scores.teamAScore} - {scores.teamBScore}
              </Text>
            ) : (
              <Text style={styles.matchScorePending}>--</Text>
            )}
          </View>
          <View style={styles.matchPlayerSide}>
            <Text style={[styles.matchPlayerText, { textAlign: 'right' }]} numberOfLines={1}>
              {tm.awayPlayer1Id ? 'P3 & P4' : 'TBD'}
            </Text>
          </View>
        </View>

        {/* Bonus */}
        {isCompleted && (tm.bonusPointsHome > 0 || tm.bonusPointsAway > 0) && (
          <View style={styles.matchBonusRow}>
            {tm.bonusPointsHome > 0 && (
              <Text style={styles.matchBonusText}>+{tm.bonusPointsHome} winner bonus</Text>
            )}
            {tm.bonusPointsAway > 0 && (
              <Text style={styles.matchBonusText}>+{tm.bonusPointsAway} loser bonus</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderScoreModal = () => (
    <Modal
      visible={scoreModal.visible}
      transparent
      animationType="slide"
      onRequestClose={() => setScoreModal({ visible: false, tieMatch: null })}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Enter Score</Text>
          {scoreModal.tieMatch && (
            <Text style={styles.modalSubtitle}>
              Match #{scoreModal.tieMatch.slotNumber} -{' '}
              {CATEGORY_COLORS[scoreModal.tieMatch.categorySlug]?.label || scoreModal.tieMatch.categorySlug}{' '}
              ({scoreModal.tieMatch.pointValue}pts)
            </Text>
          )}

          <View style={styles.scoreInputRow}>
            <View style={styles.scoreInputBlock}>
              <Text style={styles.scoreInputLabel}>{homeName}</Text>
              <TextInput
                style={styles.scoreInput}
                value={scoreA}
                onChangeText={setScoreA}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={TEXT_MUTED}
                maxLength={3}
              />
            </View>
            <Text style={styles.scoreDash}>-</Text>
            <View style={styles.scoreInputBlock}>
              <Text style={styles.scoreInputLabel}>{awayName}</Text>
              <TextInput
                style={styles.scoreInput}
                value={scoreB}
                onChangeText={setScoreB}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={TEXT_MUTED}
                maxLength={3}
              />
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setScoreModal({ visible: false, tieMatch: null })}
            >
              <Text style={styles.modalCancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={handleSaveScore}
              disabled={scoreSubmitting}
            >
              {scoreSubmitting ? (
                <ActivityIndicator color={WHITE} size="small" />
              ) : (
                <Text style={styles.modalSaveText}>SAVE SCORE</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 160 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {renderHeader()}
        {renderTieSheetStatus()}

        {/* Match list */}
        <View style={styles.matchesSection}>
          <Text style={styles.matchesSectionTitle}>
            Matches ({tie.tieMatches?.length || 0})
          </Text>
          {(tie.tieMatches || []).map((tm, idx) => renderMatchCard(tm, idx))}
        </View>
      </ScrollView>

      {/* Bottom action buttons */}
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

      {renderScoreModal()}
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

  // Header banner
  headerBanner: {
    backgroundColor: NAVY,
    paddingBottom: 20,
  },
  headerNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: WHITE, fontSize: 22, fontWeight: '700' },
  statusChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  statusChipText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },

  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  teamBlock: { flex: 1, alignItems: 'center' },
  teamName: { color: WHITE, fontSize: 16, fontWeight: '800', textAlign: 'center', lineHeight: 20 },
  teamLabel: { color: TEXT_MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 4 },

  scoreBlock: { alignItems: 'center', marginHorizontal: 12 },
  scoreText: { color: WHITE, fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  scoreSub: { color: TEXT_MUTED, fontSize: 10, marginTop: 2 },

  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  bonusSide: { alignItems: 'center' },
  bonusValue: { color: GREEN, fontSize: 14, fontWeight: '700' },
  bonusLabel: { color: TEXT_MUTED, fontSize: 10, marginTop: 2 },

  standingPointsBox: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  spLabel: { color: TEXT_MUTED, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  spText: { color: WHITE, fontSize: 16, fontWeight: '800', marginTop: 2 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },
  roundBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roundBadgeText: { color: WHITE, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  metaDate: { color: TEXT_MUTED, fontSize: 12 },

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
