import React from 'react';
import { Pressable, View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { YColors } from '../../config/yoiden';
import { YUiText } from './YText';

type YQuickActionProps = {
  label: string;
  sub?: string;
  color?: string;          // background color
  icon?: React.ReactNode;
  big?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

const isLightBg = (c?: string) =>
  c === YColors.lime || c === '#fff' || c === YColors.bg2 || c === YColors.bg3 || c === YColors.bg4;

export const YQuickAction: React.FC<YQuickActionProps> = ({
  label,
  sub,
  color = YColors.bg3,
  icon,
  big = false,
  onPress,
  style,
}) => {
  const light = isLightBg(color);
  const fg = light ? '#000' : '#fff';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: color,
          borderRadius: 12,
          padding: big ? 14 : 14,
          paddingBottom: big ? 12 : 14,
          borderWidth: color === YColors.bg3 ? 1 : 0,
          borderColor: YColors.line2,
          minHeight: big ? 88 : undefined,
          overflow: 'hidden',
          opacity: pressed ? 0.92 : 1,
        },
        style,
      ]}
    >
      <View style={styles.headerRow}>
        <View>{icon}</View>
        {big ? (
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path
              d="M7 17L17 7M9 7h8v8"
              stroke={fg}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : null}
      </View>

      <View style={{ marginTop: big ? 20 : 0 }}>
        <YUiText
          size={13}
          weight={900}
          color={fg}
          style={{ letterSpacing: 1, textTransform: 'uppercase' }}
        >
          {label}
        </YUiText>
        {sub ? (
          <YUiText
            size={10}
            weight={600}
            color={fg}
            style={{ marginTop: 2, opacity: 0.7 }}
          >
            {sub}
          </YUiText>
        ) : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
});
