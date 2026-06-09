import React from 'react';
import { Pressable, View, StyleSheet, ViewStyle } from 'react-native';
import { YColors } from '../../config/yoiden';
import { YDisplay, YEyebrow, YUiText } from './YText';

type YStatTileProps = {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  accent?: string;        // accent color for the value
  onPress?: () => void;
  style?: ViewStyle;
};

// Compact stat widget for dashboards.
// Layout: icon top-left, large display number bottom-left, eyebrow label below.
export const YStatTile: React.FC<YStatTileProps> = ({
  label,
  value,
  icon,
  accent = YColors.ink,
  onPress,
  style,
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        pressed && { backgroundColor: YColors.bg4 },
        style,
      ]}
    >
      <View style={styles.head}>
        {icon ? <View style={styles.iconWrap}>{icon}</View> : <View />}
      </View>
      <View style={styles.body}>
        <YDisplay size={36} color={accent} italic={false} style={{ lineHeight: 34 }}>
          {String(value)}
        </YDisplay>
        <YEyebrow color={YColors.ink2} style={{ marginTop: 6 }}>
          {label}
        </YEyebrow>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  tile: {
    backgroundColor: YColors.bg2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: YColors.line2,
    padding: 14,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: YColors.bg3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    marginTop: 16,
  },
});
