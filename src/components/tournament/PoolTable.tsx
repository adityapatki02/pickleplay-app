import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../config/theme';

export interface PoolTeam {
  teamId: string;
  teamName: string;
  groupRank: number | null;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

interface PoolTableProps {
  groupNumber: number;
  teams: PoolTeam[];
  advancingCount: number;
}

function getPoolTitle(groupNumber: number): string {
  return `POOL ${String.fromCharCode(65 + groupNumber)}`;
}

export const PoolTable: React.FC<PoolTableProps> = ({
  groupNumber,
  teams,
  advancingCount,
}) => {
  const sorted = [...teams].sort((a, b) => {
    const rankA = a.groupRank ?? 9999;
    const rankB = b.groupRank ?? 9999;
    return rankA - rankB;
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{getPoolTitle(groupNumber)}</Text>

      {/* Header row */}
      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.cell, styles.cellRank, styles.headerText]}>#</Text>
        <Text style={[styles.cell, styles.cellTeam, styles.headerText]}>TEAM</Text>
        <Text style={[styles.cell, styles.cellStat, styles.headerText]}>W</Text>
        <Text style={[styles.cell, styles.cellStat, styles.headerText]}>L</Text>
        <Text style={[styles.cell, styles.cellStat, styles.headerText]}>PF</Text>
        <Text style={[styles.cell, styles.cellStat, styles.headerText]}>PA</Text>
        <Text style={[styles.cell, styles.cellStat, styles.headerText]}>+/-</Text>
      </View>

      {/* Data rows */}
      {sorted.map((team, index) => {
        const diff = team.pointsFor - team.pointsAgainst;
        const isAdvancing = index < advancingCount;
        return (
          <View
            key={team.teamId}
            style={[styles.row, styles.dataRow, isAdvancing && styles.advancingRow]}
          >
            <Text style={[styles.cell, styles.cellRank, styles.rankText]}>
              {team.groupRank ?? index + 1}
            </Text>
            <Text
              style={[styles.cell, styles.cellTeam, styles.teamText]}
              numberOfLines={1}
            >
              {team.teamName}
            </Text>
            <Text style={[styles.cell, styles.cellStat, styles.statText]}>{team.wins}</Text>
            <Text style={[styles.cell, styles.cellStat, styles.statText]}>{team.losses}</Text>
            <Text style={[styles.cell, styles.cellStat, styles.statText]}>{team.pointsFor}</Text>
            <Text style={[styles.cell, styles.cellStat, styles.statText]}>{team.pointsAgainst}</Text>
            <Text
              style={[
                styles.cell,
                styles.cellStat,
                styles.statText,
                diff > 0 && styles.diffPositive,
              ]}
            >
              {diff > 0 ? `+${diff}` : `${diff}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.DEFAULT,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryFixed,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRow: {
    backgroundColor: colors.surfaceContainerLow,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  dataRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  advancingRow: {
    backgroundColor: '#EDF4FF',
  },
  cell: {
    // base
  },
  cellRank: {
    width: 24,
    textAlign: 'center',
  },
  cellTeam: {
    flex: 1,
    paddingHorizontal: spacing.xs,
  },
  cellStat: {
    width: 32,
    textAlign: 'center',
  },
  headerText: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  rankText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  teamText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.text,
  },
  statText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  diffPositive: {
    color: '#2E7D32',
    fontWeight: '700',
  },
});
