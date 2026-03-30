import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../config/theme';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  primary: { bg: `${colors.primary}20`, text: colors.primary },
  secondary: { bg: `${colors.secondary}30`, text: colors.secondary },
  success: { bg: `${colors.success}20`, text: '#059669' },
  warning: { bg: `${colors.warning}20`, text: '#B45309' },
  error: { bg: `${colors.error}20`, text: colors.error },
  info: { bg: `${colors.info}20`, text: colors.info },
  neutral: { bg: colors.surfaceVariant, text: colors.textSecondary },
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'primary',
  size = 'md',
  style,
}) => {
  const colorSet = variantColors[variant];

  return (
    <View
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: colorSet.bg },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          size === 'sm' ? styles.textSm : styles.textMd,
          { color: colorSet.text },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius['2xl'],
  },
  sm: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  md: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  text: {
    fontWeight: '600',
  },
  textSm: {
    fontSize: typography.fontSize.xs,
  },
  textMd: {
    fontSize: typography.fontSize.sm,
  },
});
