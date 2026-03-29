import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../../config/theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'elevated' | 'outlined' | 'filled';
  padding?: keyof typeof spacing;
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  variant = 'elevated',
  padding = 'base',
  style,
}) => {
  const cardStyle = [
    styles.base,
    styles[variant],
    { padding: spacing[padding] },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.7}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
  },
  elevated: {
    backgroundColor: colors.surface,
    ...shadows.md,
  },
  outlined: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filled: {
    backgroundColor: colors.surfaceVariant,
  },
});
