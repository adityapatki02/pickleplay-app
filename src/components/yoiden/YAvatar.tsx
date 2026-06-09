import React from 'react';
import { View, Image, ImageSourcePropType, ViewStyle } from 'react-native';
import { YColors, YFonts } from '../../config/yoiden';
import { YUiText } from './YText';

// ── Avatar ──────────────────────────────────────────────────────
type YAvatarProps = {
  initials: string;
  size?: number;
  color?: string;
  textColor?: string;
  style?: ViewStyle;
};
export const YAvatar: React.FC<YAvatarProps> = ({
  initials,
  size = 40,
  color = YColors.accent,
  textColor = '#000',
  style,
}) => (
  <View
    style={[
      {
        width: size,
        height: size,
        borderRadius: 999,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      },
      style,
    ]}
  >
    <YUiText
      size={Math.round(size * 0.36)}
      weight={900}
      color={textColor}
      style={{ letterSpacing: 0.4 }}
    >
      {initials}
    </YUiText>
  </View>
);

// ── Team logo bubble ────────────────────────────────────────────
type YTeamLogoProps = {
  src: ImageSourcePropType;
  size?: number;
  ring?: boolean;
  ringColor?: string;
  style?: ViewStyle;
};
export const YTeamLogo: React.FC<YTeamLogoProps> = ({
  src,
  size = 32,
  ring = false,
  ringColor = YColors.accent,
  style,
}) => (
  <View
    style={[
      {
        width: size,
        height: size,
        borderRadius: 999,
        overflow: 'hidden',
        backgroundColor: '#fff',
        ...(ring
          ? {
              borderWidth: 2,
              borderColor: ringColor,
            }
          : {}),
      },
      style,
    ]}
  >
    <Image source={src} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
  </View>
);
