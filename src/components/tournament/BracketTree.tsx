import React from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors, spacing, typography, borderRadius, shadows } from '../../config/theme';

interface MatchScore {
  teamA: number;
  teamB: number;
}

export interface MatchData {
  id: string;
  round: number;
  matchNumber: number;
  status: string;
  teamAId: string | null;
  teamBId: string | null;
  winnerId: string | null;
  scores?: MatchScore[];
}

interface BracketTreeProps {
  matches: MatchData[];
  teamNames: Record<string, string>;
  onMatchPress?: (match: MatchData) => void;
}

function getRoundLabel(round: number): string {
  if (round === -1) return 'FINAL';
  if (round === -2) return 'SEMI-FINALS';
  if (round === -3) return 'QUARTER-FINALS';
  if (round < 0) return `ROUND ${Math.abs(round)}`;
  return `ROUND ${round}`;
}

function groupByRound(matches: MatchData[]): Map<number, MatchData[]> {
  const map = new Map<number, MatchData[]>();
  for (const match of matches) {
    const bucket = map.get(match.round) ?? [];
    bucket.push(match);
    map.set(match.round, bucket);
  }
  // sort matches within each round
  for (const [round, bucket] of map.entries()) {
    map.set(round, bucket.sort((a, b) => a.matchNumber - b.matchNumber));
  }
  return map;
}

interface BracketMatchBoxProps {
  match: MatchData;
  teamNames: Record<string, string>;
  onPress?: () => void;
}

const BracketMatchBox: React.FC<BracketMatchBoxProps> = ({ match, teamNames, onPress }) => {
  const teamAName = match.teamAId ? (teamNames[match.teamAId] ?? 'TBD') : 'TBD';
  const teamBName = match.teamBId ? (teamNames[match.teamBId] ?? 'TBD') : 'TBD';
  const teamAWon = match.winnerId !== null && match.winnerId === match.teamAId;
  const teamBWon = match.winnerId !== null && match.winnerId === match.teamBId;

  const box = (
    <View style={boxStyles.container}>
      {/* Team A */}
      <View style={[boxStyles.teamRow, teamAWon && boxStyles.winnerRow]}>
        <Text
          style={[boxStyles.teamName, teamAWon && boxStyles.winnerName]}
          numberOfLines={1}
        >
          {teamAName}
        </Text>
        {match.scores && match.scores.length > 0 && (
          <View style={boxStyles.scoreGroup}>
            {match.scores.map((s, i) => (
              <Text key={i} style={[boxStyles.score, teamAWon && boxStyles.winnerScore]}>
                {s.teamA}
              </Text>
            ))}
          </View>
        )}
      </View>

      <View style={boxStyles.divider} />

      {/* Team B */}
      <View style={[boxStyles.teamRow, teamBWon && boxStyles.winnerRow]}>
        <Text
          style={[boxStyles.teamName, teamBWon && boxStyles.winnerName]}
          numberOfLines={1}
        >
          {teamBName}
        </Text>
        {match.scores && match.scores.length > 0 && (
          <View style={boxStyles.scoreGroup}>
            {match.scores.map((s, i) => (
              <Text key={i} style={[boxStyles.score, teamBWon && boxStyles.winnerScore]}>
                {s.teamB}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        {box}
      </TouchableOpacity>
    );
  }
  return box;
};

const boxStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.DEFAULT,
    width: 180,
    marginBottom: spacing.sm,
    ...shadows.sm,
    overflow: 'hidden',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  winnerRow: {
    backgroundColor: '#EDF4FF',
  },
  teamName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  winnerName: {
    fontWeight: '700',
    color: colors.primary,
  },
  scoreGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  score: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    minWidth: 16,
    textAlign: 'center',
  },
  winnerScore: {
    fontWeight: '700',
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
  },
});

export const BracketTree: React.FC<BracketTreeProps> = ({
  matches,
  teamNames,
  onMatchPress,
}) => {
  const byRound = groupByRound(matches);
  // Sort rounds: positive ascending, then negative descending (e.g. -3, -2, -1)
  const positiveRounds = [...byRound.keys()].filter(r => r > 0).sort((a, b) => a - b);
  const negativeRounds = [...byRound.keys()].filter(r => r < 0).sort((a, b) => a - b);
  const roundOrder = [...positiveRounds, ...negativeRounds];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {roundOrder.map((round) => {
        const roundMatches = byRound.get(round) ?? [];
        return (
          <View key={round} style={styles.column}>
            <Text style={styles.roundTitle}>{getRoundLabel(round)}</Text>
            {roundMatches.map((match) => (
              <BracketMatchBox
                key={match.id}
                match={match}
                teamNames={teamNames}
                onPress={onMatchPress ? () => onMatchPress(match) : undefined}
              />
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.base,
  },
  column: {
    alignItems: 'center',
  },
  roundTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
});
