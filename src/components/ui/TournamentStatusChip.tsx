import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TournamentStatus } from '../../types/tournament.types';

const NAVY = '#001E40';
const BLUE = '#1858D6';
const GREEN = '#06D6A0';
const ORANGE = '#F59E0B';
const RED = '#EF4444';
const GRAY = '#94A3B8';

export const STATUS_CONFIG: Record<
  TournamentStatus,
  { color: string; label: string }
> = {
  draft: { color: ORANGE, label: 'DRAFT' },
  published: { color: BLUE, label: 'PUBLISHED' },
  registration_open: { color: GREEN, label: 'REG. OPEN' },
  registration_closed: { color: ORANGE, label: 'REG. CLOSED' },
  in_progress: { color: RED, label: '● LIVE' },
  completed: { color: GRAY, label: 'COMPLETED' },
  cancelled: { color: GRAY, label: 'CANCELLED' },
};

interface Props {
  status: TournamentStatus;
  size?: 'sm' | 'md';
}

export default function TournamentStatusChip({ status, size = 'md' }: Props) {
  const cfg = STATUS_CONFIG[status] ?? { color: GRAY, label: String(status).toUpperCase() };
  const isSmall = size === 'sm';
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: cfg.color + '18',
          borderColor: cfg.color + '55',
          paddingHorizontal: isSmall ? 8 : 10,
          paddingVertical: isSmall ? 3 : 4,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: cfg.color,
            fontSize: isSmall ? 9 : 10,
          },
        ]}
      >
        {cfg.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '800',
    letterSpacing: 1.1,
  },
});
