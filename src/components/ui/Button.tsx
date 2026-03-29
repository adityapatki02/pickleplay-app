import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../config/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'tonal';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  style,
  textStyle,
}) => {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'outline' || variant === 'ghost'
              ? colors.primary
              : colors.textInverse
          }
          size="small"
        />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text
            style={[
              styles.text,
              styles[`text_${variant}`],
              styles[`text_${size}`],
              icon ? { marginLeft: spacing.sm } : undefined,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.4,
  },

  // Variants
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.secondaryFixed,
  },
  tonal: {
    backgroundColor: colors.primaryFixed,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.outline,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.error,
  },

  // Sizes
  size_sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    minHeight: 36,
  },
  size_md: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: 44,
  },
  size_lg: {
    paddingVertical: spacing.base,
    paddingHorizontal: spacing['2xl'],
    minHeight: 56,
  },

  // Text — Athletic uppercase style
  text: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  text_primary: {
    color: colors.onPrimary,
  },
  text_secondary: {
    color: colors.onSecondaryContainer,
  },
  text_tonal: {
    color: colors.primaryLight,
  },
  text_outline: {
    color: colors.primary,
  },
  text_ghost: {
    color: colors.primary,
  },
  text_danger: {
    color: colors.onError,
  },
  text_sm: {
    fontSize: typography.fontSize.xs,
  },
  text_md: {
    fontSize: typography.fontSize.sm,
  },
  text_lg: {
    fontSize: typography.fontSize.md,
  },
});
