import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors, spacing, typography, borderRadius, shadows } from '../../config/theme';
import { StatusBadge } from '../ui/StatusBadge';
import { Tournament } from '../../types/tournament.types';

interface TournamentCardProps {
  tournament: Tournament;
  onPress: () => void;
  showStatus?: boolean;
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString('en-IN', opts);
  const endStr = end.toLocaleDateString('en-IN', { ...opts, year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

export const TournamentCard: React.FC<TournamentCardProps> = ({
  tournament,
  onPress,
  showStatus = true,
}) => {
  const categoryCount = tournament.categories?.length ?? 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {/* Header row */}
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
          {tournament.name}
        </Text>
        {showStatus && (
          <StatusBadge status={tournament.status} size="sm" />
        )}
      </View>

      {/* Details */}
      <View style={styles.details}>
        <Text style={styles.venue} numberOfLines={1}>
          {tournament.venueName}
        </Text>
        <Text style={styles.meta}>
          {tournament.city}  ·  {formatDateRange(tournament.startDate, tournament.endDate)}
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerLabel}>
          {categoryCount} {categoryCount === 1 ? 'CATEGORY' : 'CATEGORIES'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.DEFAULT,
    padding: spacing.base,
    marginBottom: spacing.sm,
    ...shadows.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  details: {
    marginBottom: spacing.md,
  },
  venue: {
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  meta: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm,
  },
  footerLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
