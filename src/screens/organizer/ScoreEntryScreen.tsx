import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { matchesApi } from '../../api/matches.api';
import apiClient from '../../api/client';
import { colors, spacing, typography, borderRadius, shadows } from '../../config/theme';
import { OrgTournamentsStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<OrgTournamentsStackParamList, 'ScoreEntry'>;
type RouteType = RouteProp<OrgTournamentsStackParamList, 'ScoreEntry'>;

interface MatchDetail {
  id: string;
  round: string | number;
  matchNumber: number;
  status: string;
  matchFormat?: string;
  teamAId: string | null;
  teamBId: string | null;
  teamA?: { id: string; name: string } | null;
  teamB?: { id: string; name: string } | null;
  court?: { name: string } | null;
  scores?: { gameNumber: number; teamAScore: number; teamBScore: number }[];
  winnerId?: string | null;
}

interface GameScore {
  teamAScore: string;
  teamBScore: string;
}

function getRoundLabel(round: string | number): string {
  const n = typeof round === 'string' ? parseInt(round, 10) : round;
  if (n === -1) return 'FINAL';
  if (n === -2) return 'SEMI-FINALS';
  if (n === -3) return 'QUARTER-FINALS';
  if (n < 0) return `ROUND ${Math.abs(n)}`;
  return `ROUND ${n}`;
}

function getMaxGames(matchFormat?: string): number {
  if (!matchFormat) return 3;
  if (matchFormat === 'best_of_5') return 5;
  if (matchFormat === 'best_of_1') return 1;
  return 3; // best_of_3
}

function countWins(scores: GameScore[]): { teamAWins: number; teamBWins: number } {
  let teamAWins = 0;
  let teamBWins = 0;
  for (const s of scores) {
    const a = parseInt(s.teamAScore, 10) || 0;
    const b = parseInt(s.teamBScore, 10) || 0;
    if (a > b) teamAWins++;
    else if (b > a) teamBWins++;
  }
  return { teamAWins, teamBWins };
}

function shouldShowGame(gameIndex: number, scores: GameScore[], maxGames: number): boolean {
  if (gameIndex === 0) return true;
  if (maxGames === 1) return gameIndex === 0;

  // For best_of_3: show game 3 only if split (1-1 after 2 games)
  // For best_of_5: show game N only if neither side has enough to win
  const gamesNeeded = Math.ceil(maxGames / 2);
  const prevScores = scores.slice(0, gameIndex);
  const { teamAWins, teamBWins } = countWins(prevScores);

  if (teamAWins >= gamesNeeded || teamBWins >= gamesNeeded) return false;
  if (gameIndex >= maxGames) return false;
  return true;
}

export default function ScoreEntryScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const { matchId } = route.params;

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Score state — up to 5 games
  const [gameScores, setGameScores] = useState<GameScore[]>(
    Array.from({ length: 5 }, () => ({ teamAScore: '', teamBScore: '' }))
  );

  // Walkover state
  const [isWalkover, setIsWalkover] = useState(false);
  const [walkoverWinner, setWalkoverWinner] = useState<'A' | 'B' | null>(null);
  const [walkoverNotes, setWalkoverNotes] = useState('');

  const fetchMatch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/matches/${matchId}`);
      const data: MatchDetail = res.data?.data ?? res.data;
      setMatch(data);

      // Pre-fill existing scores
      if (data.scores && data.scores.length > 0) {
        const filled = Array.from({ length: 5 }, (_, i) => {
          const existing = data.scores?.find((s) => s.gameNumber === i + 1);
          return existing
            ? {
                teamAScore: String(existing.teamAScore),
                teamBScore: String(existing.teamBScore),
              }
            : { teamAScore: '', teamBScore: '' };
        });
        setGameScores(filled);
      }

      if (data.status === 'walkover') {
        setIsWalkover(true);
        if (data.winnerId) {
          if (data.winnerId === data.teamAId) setWalkoverWinner('A');
          else if (data.winnerId === data.teamBId) setWalkoverWinner('B');
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to load match');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchMatch();
  }, [fetchMatch]);

  const teamAName = match?.teamA?.name ?? `Team ${match?.teamAId?.slice(0, 6) ?? 'A'}`;
  const teamBName = match?.teamB?.name ?? `Team ${match?.teamBId?.slice(0, 6) ?? 'B'}`;
  const maxGames = getMaxGames(match?.matchFormat);

  const updateScore = (gameIndex: number, field: 'teamAScore' | 'teamBScore', value: string) => {
    setGameScores((prev) => {
      const next = [...prev];
      next[gameIndex] = { ...next[gameIndex], [field]: value.replace(/[^0-9]/g, '') };
      return next;
    });
  };

  const handleSubmit = () => {
    if (isWalkover) {
      if (!walkoverWinner) {
        Alert.alert('Required', 'Please select the walkover winner.');
        return;
      }
      const winnerId = walkoverWinner === 'A' ? match?.teamAId : match?.teamBId;
      if (!winnerId) {
        Alert.alert('Error', 'Cannot determine winner ID.');
        return;
      }
      Alert.alert(
        'Submit Walkover',
        `Mark this match as walkover. Winner: ${walkoverWinner === 'A' ? teamAName : teamBName}. Confirm?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Submit',
            onPress: async () => {
              setSubmitting(true);
              try {
                await matchesApi.setWalkover(matchId, winnerId, walkoverNotes || undefined);
                Alert.alert('Success', 'Walkover recorded.', [
                  { text: 'OK', onPress: () => navigation.goBack() },
                ]);
              } catch (err: any) {
                Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to submit');
              } finally {
                setSubmitting(false);
              }
            },
          },
        ]
      );
    } else {
      // Build score payload
      const scores: { gameNumber: number; teamAScore: number; teamBScore: number }[] = [];
      for (let i = 0; i < maxGames; i++) {
        if (!shouldShowGame(i, gameScores, maxGames)) break;
        const a = parseInt(gameScores[i].teamAScore, 10);
        const b = parseInt(gameScores[i].teamBScore, 10);
        if (isNaN(a) || isNaN(b)) {
          Alert.alert('Incomplete', `Please enter scores for Game ${i + 1}.`);
          return;
        }
        scores.push({ gameNumber: i + 1, teamAScore: a, teamBScore: b });
      }

      if (scores.length === 0) {
        Alert.alert('Required', 'Enter at least one game score.');
        return;
      }

      const { teamAWins, teamBWins } = countWins(gameScores.map((g) => ({ ...g })));
      const neededWins = Math.ceil(maxGames / 2);
      const winnerName =
        teamAWins >= neededWins ? teamAName : teamBWins >= neededWins ? teamBName : null;

      const confirmMsg = winnerName
        ? `Submit scores? Winner: ${winnerName}`
        : 'Submit scores for this match?';

      Alert.alert('Confirm Submission', confirmMsg, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setSubmitting(true);
            try {
              await matchesApi.enterScore(matchId, scores);
              Alert.alert('Success', 'Scores submitted.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to submit scores');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!match) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Match not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* Nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backTouchable}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backIcon}>{'←'}</Text>
          <Text style={styles.backLabel}>BACK</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>SCORE ENTRY</Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Match header */}
          <View style={styles.matchHeader}>
            <Text style={styles.roundLabel}>
              {getRoundLabel(match.round)}  ·  MATCH #{match.matchNumber}
            </Text>
            {match.court && (
              <Text style={styles.courtLabel}>{match.court.name}</Text>
            )}
          </View>

          {/* Teams */}
          <View style={styles.teamsSection}>
            <Text style={styles.teamName} numberOfLines={2}>{teamAName}</Text>
            <Text style={styles.vsText}>VS</Text>
            <Text style={[styles.teamName, styles.teamNameRight]} numberOfLines={2}>{teamBName}</Text>
          </View>

          {/* Walkover toggle */}
          <View style={styles.walkoverRow}>
            <Text style={styles.walkoverLabel}>WALKOVER</Text>
            <Switch
              value={isWalkover}
              onValueChange={(val) => {
                setIsWalkover(val);
                if (!val) {
                  setWalkoverWinner(null);
                  setWalkoverNotes('');
                }
              }}
              trackColor={{ false: colors.surfaceContainerHigh, true: colors.primaryLight }}
              thumbColor={isWalkover ? colors.primary : colors.surfaceContainerHighest}
            />
          </View>

          {isWalkover ? (
            /* Walkover form */
            <View style={styles.walkoverSection}>
              <Text style={styles.fieldLabel}>WINNER</Text>
              <View style={styles.radioRow}>
                <TouchableOpacity
                  style={[styles.radioOption, walkoverWinner === 'A' && styles.radioOptionActive]}
                  onPress={() => setWalkoverWinner('A')}
                  activeOpacity={0.75}
                >
                  <View style={styles.radioCircle}>
                    {walkoverWinner === 'A' && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.radioLabel}>{teamAName}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.radioOption, walkoverWinner === 'B' && styles.radioOptionActive]}
                  onPress={() => setWalkoverWinner('B')}
                  activeOpacity={0.75}
                >
                  <View style={styles.radioCircle}>
                    {walkoverWinner === 'B' && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.radioLabel}>{teamBName}</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: spacing.base }]}>NOTES (optional)</Text>
              <TextInput
                style={styles.notesInput}
                value={walkoverNotes}
                onChangeText={setWalkoverNotes}
                placeholder="Reason for walkover…"
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={2}
              />
            </View>
          ) : (
            /* Score entry grid */
            <View style={styles.scoresSection}>
              {/* Header row */}
              <View style={styles.scoreHeaderRow}>
                <Text style={styles.scoreColHeader}>GAME</Text>
                <Text style={[styles.scoreColHeader, styles.scoreColTeam]}>
                  {teamAName.length > 14 ? teamAName.substring(0, 12) + '…' : teamAName}
                </Text>
                <View style={styles.scoreColSpacer} />
                <Text style={[styles.scoreColHeader, styles.scoreColTeam, styles.scoreColTeamRight]}>
                  {teamBName.length > 14 ? teamBName.substring(0, 12) + '…' : teamBName}
                </Text>
              </View>

              {Array.from({ length: maxGames }, (_, i) => {
                const show = shouldShowGame(i, gameScores, maxGames);
                if (!show) return null;
                return (
                  <View key={i} style={styles.scoreRow}>
                    <Text style={styles.gameLabel}>G{i + 1}</Text>
                    <TextInput
                      style={styles.scoreInput}
                      value={gameScores[i].teamAScore}
                      onChangeText={(v) => updateScore(i, 'teamAScore', v)}
                      keyboardType="numeric"
                      maxLength={3}
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      textAlign="center"
                    />
                    <Text style={styles.scoreDash}>—</Text>
                    <TextInput
                      style={styles.scoreInput}
                      value={gameScores[i].teamBScore}
                      onChangeText={(v) => updateScore(i, 'teamBScore', v)}
                      keyboardType="numeric"
                      maxLength={3}
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      textAlign="center"
                    />
                  </View>
                );
              })}
            </View>
          )}

          {/* Submit button */}
          <View style={styles.submitSection}>
            {submitting ? (
              <View style={styles.submittingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.submittingText}>Submitting…</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSubmit}
                activeOpacity={0.85}
              >
                <Text style={styles.submitBtnText}>
                  {isWalkover ? 'SUBMIT WALKOVER' : 'SUBMIT SCORES'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
  },
  backTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  backIcon: {
    fontSize: typography.fontSize.lg,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  backLabel: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.onPrimary,
    letterSpacing: 1.5,
  },
  navTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.onPrimary,
    letterSpacing: 1.5,
  },
  scrollContent: {
    paddingBottom: spacing['3xl'],
  },
  matchHeader: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  roundLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.primaryFixedDim,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  courtLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.primaryFixedDim,
    marginTop: 2,
  },
  teamsSection: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  teamName: {
    flex: 1,
    fontSize: typography.fontSize.xl,
    fontWeight: '800',
    color: colors.onPrimary,
    letterSpacing: typography.letterSpacing.tight,
    textAlign: 'left',
  },
  teamNameRight: {
    textAlign: 'right',
  },
  vsText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '900',
    color: colors.primaryFixedDim,
    letterSpacing: 2,
  },
  walkoverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceContainerLowest,
    marginTop: spacing.base,
    marginHorizontal: spacing.base,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  walkoverLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 1,
  },
  walkoverSection: {
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    ...shadows.sm,
  },
  fieldLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  radioRow: {
    gap: spacing.sm,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceContainerLow,
  },
  radioOptionActive: {
    backgroundColor: colors.primaryFixed,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  radioLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  notesInput: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    color: colors.text,
    height: 72,
    textAlignVertical: 'top',
  },
  scoresSection: {
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    ...shadows.sm,
  },
  scoreHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  scoreColHeader: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    width: 36,
  },
  scoreColTeam: {
    flex: 1,
    textAlign: 'center',
    width: undefined,
  },
  scoreColTeamRight: {
    textAlign: 'center',
  },
  scoreColSpacer: {
    width: 32,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  gameLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.textSecondary,
    width: 28,
    letterSpacing: 0.5,
  },
  scoreInput: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    fontSize: typography.fontSize.xl,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
    minWidth: 60,
  },
  scoreDash: {
    fontSize: typography.fontSize.xl,
    fontWeight: '300',
    color: colors.textTertiary,
    width: 20,
    textAlign: 'center',
  },
  submitSection: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xl,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    ...shadows.md,
  },
  submitBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.onPrimary,
    letterSpacing: 1.5,
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  submittingText: {
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    color: colors.textSecondary,
  },
});
