import React from 'react';
import { Pressable, View } from 'react-native';
import { YUiText, YEyebrow, YBadge, YColors, YRadius } from '../yoiden';

export type LeagueTieCardProps = {
  homeName: string;
  awayName: string;
  homeWon?: boolean;
  awayWon?: boolean;
  meta?: string; // e.g. "21 Jun · Court 1" or "SEMIFINAL 1"
  statusLabel?: string; // e.g. "Scheduled" / "Live" / "Completed"
  statusColor?: string; // YColors token (foreground)
  statusBg?: string;
  onPress?: () => void;
  disabled?: boolean;
};

/** Presentational tie card — two teams, meta line, status badge. Reused by
 *  Fixtures, Knockout, and the Overview live/upcoming lists. Props in, no fetch. */
export const LeagueTieCard: React.FC<LeagueTieCardProps> = ({
  homeName,
  awayName,
  homeWon,
  awayWon,
  meta,
  statusLabel,
  statusColor,
  statusBg,
  onPress,
  disabled,
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled || !onPress}
    style={({ pressed }) => [
      {
        backgroundColor: '#fff',
        borderRadius: YRadius.xl,
        borderWidth: 1,
        borderColor: YColors.line2,
        padding: 16,
        marginBottom: 10,
        opacity: pressed ? 0.92 : 1,
      },
    ]}
  >
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      {meta ? <YEyebrow size={10} color={YColors.ink3}>{meta}</YEyebrow> : <View />}
      {statusLabel ? (
        <YBadge color={statusColor ?? YColors.ink2} bg={statusBg ?? '#F1F5F9'}>{statusLabel}</YBadge>
      ) : null}
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <YUiText size={15} weight={homeWon ? 900 : 700} color={YColors.ink} numberOfLines={1} style={{ flex: 1 }}>
        {homeName}
      </YUiText>
      <YUiText size={11} weight={700} color={YColors.ink3} style={{ marginHorizontal: 10 }}>vs</YUiText>
      <YUiText size={15} weight={awayWon ? 900 : 700} color={YColors.ink} numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>
        {awayName}
      </YUiText>
    </View>
  </Pressable>
);
