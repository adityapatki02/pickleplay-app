import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { borderRadius, typography } from '../../config/theme';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft:                { bg: '#E7E8E9', text: '#43474F' },
  published:            { bg: '#D5E3FF', text: '#001E40' },
  registration_open:    { bg: '#D0E4FF', text: '#00629F' },
  registration_closed:  { bg: '#FFE0B2', text: '#E65100' },
  in_progress:          { bg: '#C8E6C9', text: '#2E7D32' },
  completed:            { bg: '#E8F5E9', text: '#1B5E20' },
  cancelled:            { bg: '#FFDAD6', text: '#BA1A1A' },
  confirmed:            { bg: '#C8E6C9', text: '#2E7D32' },
  pending_payment:      { bg: '#FFE0B2', text: '#E65100' },
  waitlisted:           { bg: '#E1E3E4', text: '#43474F' },
  scheduled:            { bg: '#D5E3FF', text: '#001E40' },
};

const FALLBACK_COLORS = { bg: '#E1E3E4', text: '#43474F' };

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const colorSet = STATUS_COLORS[status] ?? FALLBACK_COLORS;
  const label = status.replace(/_/g, ' ').toUpperCase();

  return (
    <View
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: colorSet.bg },
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
    paddingHorizontal: 8,
  },
  md: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  textSm: {
    fontSize: typography.fontSize['2xs'],
  },
  textMd: {
    fontSize: typography.fontSize.xs,
  },
});
