import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../config/theme';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '🏓',
  title,
  subtitle,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing['2xl'],
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.base,
    textAlign: 'center',
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.fontSize.md * typography.lineHeight.normal,
  },
});
