import React from 'react';
import { View, ViewStyle, ColorValue } from 'react-native';
import { YColors, YFonts } from '../../config/yoiden';
import { YUiText } from './YText';

// ── Solid tag with uppercase label ──────────────────────────────
type YBadgeProps = {
  children: React.ReactNode;
  color?: string;          // foreground when `bg` is set, else background
  bg?: string;             // optional background; if omitted, `color` is bg, fg is white
  style?: ViewStyle;
};
export const YBadge: React.FC<YBadgeProps> = ({
  children,
  color = YColors.accent,
  bg,
  style,
}) => {
  const background = bg ?? color;
  const foreground = bg ? color : '#fff';
  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          paddingHorizontal: 6,
          paddingVertical: 3,
          borderRadius: 3,
          backgroundColor: background,
        },
        style,
      ]}
    >
      <YUiText
        size={9}
        weight={800}
        color={foreground}
        style={{ letterSpacing: 1.3, textTransform: 'uppercase' }}
      >
        {children as any}
      </YUiText>
    </View>
  );
};

// ── LIVE pulse indicator ────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export const YLive: React.FC<{ size?: number; color?: string }> = ({ size = 9, color = YColors.live }) => {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Animated.View
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          backgroundColor: color,
          marginRight: 5,
          opacity,
        }}
      />
      <YUiText
        size={size}
        weight={800}
        color={color}
        style={{ letterSpacing: size * 0.18, textTransform: 'uppercase' }}
      >
        LIVE
      </YUiText>
    </View>
  );
};
