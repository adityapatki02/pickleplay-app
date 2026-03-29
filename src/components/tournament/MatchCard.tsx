import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors, spacing, typography, borderRadius, shadows } from '../../config/theme';
import { StatusBadge } from '../ui/StatusBadge';

interface MatchScore {
  teamA: number;
  teamB: number;
}

interface MatchData {
  id: string;
  round: number;
  matchNumber: number;
  status: string;
  teamAId: string | null;
  teamBId: string | null;
  winnerId: string | null;
  scores?: MatchScore[];
}

interface MatchCardProps {
  match: MatchData;
  teamNames: Record<string, string>;
  onPress?: () => void;
  highlightTeamId?: string;
}

function getRoundLabel(round: number): string {
  if (round === -1) return 'FINAL';
  if (round === -2) return 'SEMI-FINAL';
  if (round === -3) return 'QUARTER-FINAL';
  if (round < 0) return `ROUND ${Math.abs(round)}`;
  return `ROUND ${round}`;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  match,
  teamNames,
  onPress,
  highlightTeamId,
}) => {
  const teamAName = match.teamAId ? (teamNames[match.teamAId] ?? 'TBD') : 'TBD';
  const teamBName = match.teamBId ? (teamNames[match.teamBId] ?? 'TBD') : 'TBD';
  const teamAWon = match.winnerId !== null && match.winnerId === match.teamAId;
  const teamBWon = match.winnerId !== null && match.winnerId === match.teamBId;

  const isTeamAHighlighted = highlightTeamId != null && match.teamAId === highlightTeamId;
  const isTeamBHighlighted = highlightTeamId != null && match.teamBId === highlightTeamId;

  const content = (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.roundLabel}>{getRoundLabel(match.round)}</Text>
        <Text style={styles.matchNumber}>#{match.matchNumber}</Text>
        <StatusBadge status={match.status} size="sm" />
      </View>

      {/* Team A row */}
      <View
        style={[
          styles.teamRow,
          teamAWon && styles.teamRowWinner,
          isTeamAHighlighted && styles.teamRowHighlighted,
        ]}
      >
        <Text
          style={[
            styles.teamName,
            teamAWon && styles.teamNameWinner,
          ]}
          numberOfLines={1}
        >
          {teamAName}
        </Text>
        {match.scores && match.scores.length > 0 && (
          <View style={styles.scoresRow}>
            {match.scores.map((s, i) => (
              <Text key={i} style={[styles.score, teamAWon && styles.scoreWinner]}>
                {s.teamA}
              </Text>
            ))}
          </View>
        )}
      </View>

      <View style={styles.divider} />

      {/* Team B row */}
      <View
        style={[
          styles.teamRow,
          teamBWon && styles.teamRowWinner,
          isTeamBHighlighted && styles.teamRowHighlighted,
        ]}
      >
        <Text
          style={[
            styles.teamName,
            teamBWon && styles.teamNameWinner,
          ]}
          numberOfLines={1}
        >
          {teamBName}
        </Text>
        {match.scores && match.scores.length > 0 && (
          <View style={styles.scoresRow}>
            {match.scores.map((s, i) => (
              <Text key={i} style={[styles.score, teamBWon && styles.scoreWinner]}>
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
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.DEFAULT,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  roundLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    flex: 1,
  },
  matchNumber: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: 2,
    borderRadius: borderRadius.sm,
  },
  teamRowWinner: {
    backgroundColor: '#EDF4FF',
  },
  teamRowHighlighted: {
    backgroundColor: colors.primaryFixed,
  },
  teamName: {
    flex: 1,
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  teamNameWinner: {
    fontWeight: '700',
    color: colors.primary,
  },
  scoresRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  score: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: colors.textSecondary,
    minWidth: 20,
    textAlign: 'center',
  },
  scoreWinner: {
    fontWeight: '700',
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 2,
  },
});
