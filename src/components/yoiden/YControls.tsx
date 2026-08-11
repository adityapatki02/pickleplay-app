import React from 'react';
import { Pressable, View, ViewStyle, StyleSheet } from 'react-native';
import { YColors, YFonts } from '../../config/yoiden';
import { YUiText } from './YText';

// ── Pill chip ────────────────────────────────────────────────────
type YChipProps = {
  children: React.ReactNode;
  active?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};
export const YChip: React.FC<YChipProps> = ({ children, active = false, onPress, style }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      {
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? YColors.ink : YColors.line2,
        backgroundColor: active ? YColors.ink : 'transparent',
        opacity: pressed ? 0.85 : 1,
      },
      style,
    ]}
  >
    <YUiText
      size={11}
      weight={700}
      color={active ? '#fff' : YColors.ink2}
      style={{ letterSpacing: 0.9, textTransform: 'uppercase' }}
    >
      {children as any}
    </YUiText>
  </Pressable>
);

// ── Button (primary / lime / accent / ghost / dark) ──────────────
type YButtonVariant = 'primary' | 'accent' | 'ghost' | 'dark';
type YButtonSize = 'sm' | 'md' | 'lg';
type YButtonProps = {
  children: React.ReactNode;
  variant?: YButtonVariant;
  size?: YButtonSize;
  icon?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  disabled?: boolean;
  fullWidth?: boolean;
};
export const YButton: React.FC<YButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  onPress,
  style,
  disabled,
  fullWidth,
}) => {
  const sizes = {
    sm: { pv: 10, ph: 14, fs: 11 },
    md: { pv: 14, ph: 18, fs: 12 },
    lg: { pv: 18, ph: 22, fs: 14 },
  }[size];
  const variants: Record<YButtonVariant, { bg: string; color: string; border: string }> = {
    primary: { bg: YColors.accentDeep, color: '#fff', border: YColors.accentDeep },
    accent:  { bg: YColors.accent, color: '#fff', border: YColors.accent },
    ghost:   { bg: 'transparent', color: YColors.ink, border: YColors.line2 },
    dark:    { bg: YColors.ink, color: '#fff', border: YColors.ink },
  };
  const v = variants[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: sizes.pv,
          paddingHorizontal: sizes.ph,
          backgroundColor: v.bg,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: v.border,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
      <YUiText
        size={sizes.fs}
        weight={900}
        color={v.color}
        style={{ letterSpacing: sizes.fs * 0.12, textTransform: 'uppercase' }}
      >
        {children as any}
      </YUiText>
    </Pressable>
  );
};
