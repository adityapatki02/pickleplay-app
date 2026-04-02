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
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { matchesApi } from '../../api/matches.api';
import { tournamentsApi } from '../../api/tournaments.api';
import { TournamentCategory } from '../../types/tournament.types';
import { colors, spacing, typography, borderRadius, shadows } from '../../config/theme';
import { OrgTournamentsStackParamList } from '../../navigation/types';

const NAVY = '#001E40';
const BLUE_ACCENT = '#2196F3';

// Note: ScoreEntry route takes matchId in the existing nav types.
// This screen is enhanced to also support a tournamentId flow (show list).
type NavProp = NativeStackNavigationProp<OrgTournamentsStackParamList, 'ScoreEntry'>;
type RouteType = RouteProp<OrgTournamentsStackParamList, 'ScoreEntry'>;

interface MatchItem {
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
  return 3;
}

function countWins(scores: GameScore[]): { teamAWins: number; teamBWins: number } {
  let a = 0, b = 0;
  for (const s of scores) {
    const sa = parseInt(s.teamAScore, 10) || 0;
    const sb = parseInt(s.teamBScore, 10) || 0;
    if (sa > sb) a++;
    else if (sb > sa) b++;
  }
  return { teamAWins: a, teamBWins: b };
}

function shouldShowGame(gameIndex: number, scores: GameScore[], maxGames: number): boolean {
  if (gameIndex === 0) return true;
  if (maxGames === 1) return false;
  const gamesNeeded = Math.ceil(maxGames / 2);
  const prevScores = scores.slice(0, gameIndex);
  const { teamAWins, teamBWins } = countWins(prevScores);
  if (teamAWins >= gamesNeeded || teamBWins >= gamesNeeded) return false;
  if (gameIndex >= maxGames) return false;
  return true;
}

// ─── Inline score form ────────────────────────────────────────────────────────

function InlineScoreForm({
  match,
  teamAName,
  teamBName,
  onDone,
}: {
  match: MatchItem;
  teamAName: string;
  teamBName: string;
  onDone: () => void;
}) {
  const maxGames = getMaxGames(match.matchFormat);
  const [gameScores, setGameScores] = useState<GameScore[]>(
    Array.from({ length: 5 }, (_, i) => {
      const existing = match.scores?.find((s) => s.gameNumber === i + 1);
      return existing
        ? { teamAScore: String(existing.teamAScore), teamBScore: String(existing.teamBScore) }
        : { teamAScore: '', teamBScore: '' };
    })
  );
  const [submitting, setSubmitting] = useState(false);

  const updateScore = (idx: number, field: 'teamAScore' | 'teamBScore', val: string) => {
    setGameScores((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val.replace(/[^0-9]/g, '') };
      return next;
    });
  };

  const handleSave = async () => {
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
    setSubmitting(true);
    try {
      await matchesApi.enterScore(match.id, scores);
      onDone();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to save scores');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWalkover = () => {
    Alert.alert(
      'Walkover',
      'Select the winner for this walkover:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: teamAName,
          onPress: async () => {
            if (!match.teamAId) return;
            try {
              await matchesApi.setWalkover(match.id, match.teamAId);
              onDone();
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message ?? 'Failed');
            }
          },
        },
        {
          text: teamBName,
          onPress: async () => {
            if (!match.teamBId) return;
            try {
              await matchesApi.setWalkover(match.id, match.teamBId);
              onDone();
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message ?? 'Failed');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={inlineStyles.container}>
      {/* Score rows */}
      <View style={inlineStyles.headerRow}>
        <Text style={inlineStyles.colLabel}>G</Text>
        <Text style={[inlineStyles.colLabel, inlineStyles.teamCol]} numberOfLines={1}>{teamAName.slice(0, 12)}</Text>
        <View style={inlineStyles.spacer} />
        <Text style={[inlineStyles.colLabel, inlineStyles.teamCol, { textAlign: 'center' }]} numberOfLines={1}>{teamBName.slice(0, 12)}</Text>
      </View>
      {Array.from({ length: maxGames }, (_, i) => {
        if (!shouldShowGame(i, gameScores, maxGames)) return null;
        return (
          <View key={i} style={inlineStyles.scoreRow}>
            <Text style={inlineStyles.gameLabel}>G{i + 1}</Text>
            <TextInput
              style={inlineStyles.scoreInput}
              value={gameScores[i].teamAScore}
              onChangeText={(v) => updateScore(i, 'teamAScore', v)}
              keyboardType="numeric"
              maxLength={3}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              textAlign="center"
            />
            <Text style={inlineStyles.dash}>—</Text>
            <TextInput
              style={inlineStyles.scoreInput}
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
      {/* Actions */}
      <View style={inlineStyles.actions}>
        <TouchableOpacity style={inlineStyles.walkoverBtn} onPress={handleWalkover}>
          <Text style={inlineStyles.walkoverBtnText}>WALKOVER</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[inlineStyles.saveBtn, submitting && inlineStyles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={inlineStyles.saveBtnText}>SAVE SCORES</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const inlineStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceContainerLow,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  colLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1,
    width: 28,
    textTransform: 'uppercase',
  },
  teamCol: {
    flex: 1,
    width: undefined,
    textAlign: 'center',
  },
  spacer: {
    width: 28,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  gameLabel: {
    width: 28,
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  scoreInput: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.lg,
    fontWeight: '800',
    color: NAVY,
    textAlign: 'center',
    minWidth: 48,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  dash: {
    fontSize: typography.fontSize.lg,
    color: colors.textTertiary,
    fontWeight: '300',
    width: 20,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  walkoverBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.error,
    alignItems: 'center',
  },
  walkoverBtnText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.error,
    letterSpacing: 1,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: NAVY,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ScoreEntryScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  // Route may have matchId (old pattern) or tournamentId+categoryId (list view)
  const { matchId } = route.params;
  const tournamentId = (route.params as any).tournamentId as string | undefined;
  const categoryId = (route.params as any).categoryId as string | undefined;

  const [categories, setCategories] = useState<TournamentCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | undefined>(categoryId);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Single match mode (launched from BracketManage with matchId)
  const [singleMatch, setSingleMatch] = useState<MatchItem | null>(null);

  const isSingleMatchMode = Boolean(matchId && !tournamentId);

  const fetchCategories = useCallback(async () => {
    if (!tournamentId) return;
    try {
      const res = await tournamentsApi.listCategories(tournamentId);
      const data = res.data?.data ?? res.data ?? [];
      const cats = Array.isArray(data) ? data : [];
      setCategories(cats);
      if (!activeCategoryId && cats.length > 0) {
        setActiveCategoryId(cats[0].id);
      }
    } catch {
      // Non-critical
    }
  }, [tournamentId, activeCategoryId]);

  const fetchMatches = useCallback(async (catId: string) => {
    if (!tournamentId) return;
    setLoading(true);
    try {
      const res = await matchesApi.getBracket(tournamentId, catId);
      const data = res.data?.data ?? res.data;
      // Flatten pools + knockout matches
      const poolMatches: MatchItem[] = (data?.pools ?? []).flatMap((p: any) => p.matches ?? []);
      const knockoutMatches: MatchItem[] = data?.knockout ?? [];
      const all: MatchItem[] = [...poolMatches, ...knockoutMatches];
      // Only show scheduled matches
      setMatches(all.filter((m) => m.status === 'scheduled' || m.status === 'in_progress'));
    } catch (err: any) {
      if (err?.response?.status !== 404) {
        Alert.alert('Error', 'Failed to load matches');
      }
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  const fetchSingleMatch = useCallback(async () => {
    if (!matchId) return;
    setLoading(true);
    try {
      const res = await matchesApi.getMatch(matchId);
      const data: MatchItem = res.data?.data ?? res.data;
      setSingleMatch(data);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to load match');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    if (isSingleMatchMode) {
      fetchSingleMatch();
    } else {
      fetchCategories();
    }
  }, [isSingleMatchMode, fetchSingleMatch, fetchCategories]);

  useEffect(() => {
    if (!isSingleMatchMode && activeCategoryId) {
      fetchMatches(activeCategoryId);
    }
  }, [isSingleMatchMode, activeCategoryId, fetchMatches]);

  // Group matches by round
  const groupedByRound: { round: string | number; matches: MatchItem[] }[] = [];
  const roundMap = new Map<string, MatchItem[]>();
  for (const m of matches) {
    const key = String(m.round);
    if (!roundMap.has(key)) roundMap.set(key, []);
    roundMap.get(key)!.push(m);
  }
  for (const [round, ms] of roundMap.entries()) {
    groupedByRound.push({ round, matches: ms });
  }

  // ── Single match mode ────────────────────────────────────────────────────────

  if (isSingleMatchMode) {
    if (loading) {
      return (
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>SCORE ENTRY</Text>
            <View style={{ width: 60 }} />
          </View>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={NAVY} />
          </View>
        </SafeAreaView>
      );
    }

    if (!singleMatch) {
      return (
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>SCORE ENTRY</Text>
            <View style={{ width: 60 }} />
          </View>
          <View style={styles.centered}>
            <Text style={styles.emptyText}>Match not found.</Text>
          </View>
        </SafeAreaView>
      );
    }

    const teamAName = singleMatch.teamA?.name ?? `Team A`;
    const teamBName = singleMatch.teamB?.name ?? `Team B`;

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.backIcon}>←</Text>
            <Text style={styles.backLabel}>BACK</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SCORE ENTRY</Text>
          <View style={{ width: 60 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >
          <ScrollView contentContainerStyle={styles.singleScrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Match header */}
            <View style={styles.matchHero}>
              <Text style={styles.heroRound}>
                {getRoundLabel(singleMatch.round)}  ·  MATCH #{singleMatch.matchNumber}
              </Text>
              {singleMatch.court && <Text style={styles.heroCourt}>{singleMatch.court.name}</Text>}
              <View style={styles.heroTeams}>
                <Text style={styles.heroTeamA} numberOfLines={2}>{teamAName}</Text>
                <Text style={styles.heroVs}>VS</Text>
                <Text style={styles.heroTeamB} numberOfLines={2}>{teamBName}</Text>
              </View>
            </View>

            <View style={styles.singleFormWrapper}>
              <InlineScoreForm
                match={singleMatch}
                teamAName={teamAName}
                teamBName={teamBName}
                onDone={() => navigation.goBack()}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Tournament list mode ──────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backIcon}>←</Text>
          <Text style={styles.backLabel}>BACK</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SCORE ENTRY</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Category selector */}
      {categories.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catContent}
          style={styles.catBar}
        >
          {categories.map((cat) => {
            const active = cat.id === activeCategoryId;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catTab, active && styles.catTabActive]}
                onPress={() => setActiveCategoryId(cat.id)}
                activeOpacity={0.75}
              >
                <Text style={[styles.catTabText, active && styles.catTabTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Matches list */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={NAVY} />
        </View>
      ) : matches.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No scheduled matches found.</Text>
          <Text style={styles.emptyHint}>Matches appear here when the draw is generated and matches are scheduled.</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >
          <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {groupedByRound.map(({ round, matches: roundMatches }) => (
              <View key={String(round)}>
                <Text style={styles.roundHeader}>{getRoundLabel(round)}</Text>
                {roundMatches.map((match) => {
                  const expanded = expandedMatchId === match.id;
                  const tA = match.teamA?.name ?? `Team ${match.teamAId?.slice(0, 6) ?? 'A'}`;
                  const tB = match.teamB?.name ?? `Team ${match.teamBId?.slice(0, 6) ?? 'B'}`;
                  return (
                    <View key={match.id} style={styles.matchCard}>
                      <TouchableOpacity
                        style={styles.matchCardHeader}
                        onPress={() => setExpandedMatchId(expanded ? null : match.id)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.matchCardLeft}>
                          <Text style={styles.matchCardTeams} numberOfLines={1}>
                            {tA} vs {tB}
                          </Text>
                          {match.court && (
                            <Text style={styles.matchCardMeta}>{match.court.name}</Text>
                          )}
                        </View>
                        <Text style={styles.matchCardChevron}>{expanded ? '▲' : '▼'}</Text>
                      </TouchableOpacity>

                      {expanded && (
                        <InlineScoreForm
                          match={match}
                          teamAName={tA}
                          teamBName={tB}
                          onDone={() => {
                            setExpandedMatchId(null);
                            if (activeCategoryId) fetchMatches(activeCategoryId);
                          }}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: typography.fontSize.sm,
    fontWeight: '400',
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: NAVY,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  backIcon: {
    fontSize: typography.fontSize.lg,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  backLabel: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
    textAlign: 'center',
  },
  catBar: {
    backgroundColor: colors.surfaceContainerLowest,
    ...shadows.sm,
  },
  catContent: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  catTab: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHigh,
  },
  catTabActive: {
    backgroundColor: NAVY,
  },
  catTabText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
  catTabTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  roundHeader: {
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  matchCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadows.sm,
  },
  matchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    justifyContent: 'space-between',
  },
  matchCardLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  matchCardTeams: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.text,
  },
  matchCardMeta: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    color: colors.textTertiary,
    marginTop: 2,
  },
  matchCardChevron: {
    fontSize: 10,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  // Single match mode styles
  singleScrollContent: {
    paddingBottom: spacing['3xl'],
  },
  matchHero: {
    backgroundColor: NAVY,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl,
  },
  heroRound: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.primaryFixedDim,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  heroCourt: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.primaryFixedDim,
    marginBottom: spacing.sm,
  },
  heroTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroTeamA: {
    flex: 1,
    fontSize: typography.fontSize.xl,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'left',
  },
  heroVs: {
    fontSize: typography.fontSize.sm,
    fontWeight: '900',
    color: colors.primaryFixedDim,
    letterSpacing: 2,
  },
  heroTeamB: {
    flex: 1,
    fontSize: typography.fontSize.xl,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  singleFormWrapper: {
    margin: spacing.base,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
});
