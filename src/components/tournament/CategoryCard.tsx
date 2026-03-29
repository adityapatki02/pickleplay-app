import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../config/theme';
import { TournamentCategory } from '../../types/tournament.types';

interface CategoryCardProps {
  category: TournamentCategory;
  registeredCount?: number;
  onRegister?: () => void;
  showRegister?: boolean;
}

function formatKnockout(k: string): string {
  return k.replace(/_/g, ' ').toUpperCase();
}

function formatMatchFormat(m: string): string {
  return m.replace(/_/g, ' ').toUpperCase();
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  registeredCount,
  onRegister,
  showRegister = false,
}) => {
  const registered = registeredCount ?? category.registeredTeams ?? 0;
  const spotsRemaining = category.maxTeams - registered;
  const isFull = spotsRemaining <= 0;
  const feeLabel = category.entryFee === 0 ? 'FREE' : `₹${category.entryFee}`;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {/* Left: info */}
        <View style={styles.info}>
          <Text style={styles.name}>{category.name}</Text>
          <Text style={styles.subline}>
            {category.format.toUpperCase()} · {category.gender.toUpperCase()}
          </Text>
          <Text style={styles.detail}>
            {formatKnockout(category.knockoutFormat)}
          </Text>
          <Text style={styles.detail}>
            {formatMatchFormat(category.matchFormat)}
          </Text>
        </View>

        {/* Right: fee + spots */}
        <View style={styles.rightCol}>
          <Text style={styles.fee}>{feeLabel}</Text>
          {isFull ? (
            <Text style={styles.fullLabel}>FULL</Text>
          ) : (
            <Text style={styles.spots}>
              {spotsRemaining} spot{spotsRemaining !== 1 ? 's' : ''} left
            </Text>
          )}
        </View>
      </View>

      {/* Optional register button */}
      {showRegister && onRegister && (
        <TouchableOpacity
          style={[styles.registerButton, isFull && styles.registerButtonDisabled]}
          onPress={onRegister}
          disabled={isFull}
          activeOpacity={0.85}
        >
          <Text style={styles.registerLabel}>
            {isFull ? 'FULL' : 'REGISTER'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.DEFAULT,
    padding: spacing.base,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  info: {
    flex: 1,
    marginRight: spacing.sm,
  },
  name: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  subline: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detail: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.textTertiary,
    marginBottom: 2,
  },
  rightCol: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  fee: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  spots: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  fullLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.error,
    letterSpacing: 0.5,
  },
  registerButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.DEFAULT,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  registerButtonDisabled: {
    opacity: 0.4,
  },
  registerLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
