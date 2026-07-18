import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { YColors } from '../../config/yoiden';
import { resizeUrl } from '../../utils/img';
import { YDisplay, YEyebrow, YUiText } from './YText';

type YCoverImageProps = {
  src?: string | null;
  height?: number;
  // What to render if no src — defaults to a clean accent gradient.
  // Pass `title` to overlay a big italic display word (like the tournament name) for editorial flair.
  fallbackTitle?: string;
  fallbackEyebrow?: string;
  // Children render on top of the image/fallback (for badges, status pills, etc.)
  children?: React.ReactNode;
  style?: ViewStyle;
  rounded?: boolean;
};

export const YCoverImage: React.FC<YCoverImageProps> = ({
  src,
  height = 180,
  fallbackTitle,
  fallbackEyebrow,
  children,
  style,
  rounded = true,
}) => {
  const containerStyle: ViewStyle = {
    height,
    width: '100%',
    backgroundColor: YColors.accentDeep,
    overflow: 'hidden',
    borderTopLeftRadius: rounded ? 14 : 0,
    borderTopRightRadius: rounded ? 14 : 0,
    position: 'relative',
  };

  return (
    <View style={[containerStyle, style]}>
      {src ? (
        <>
          {/* Covers are full-bleed; ask the proxy for a 2x-of-height crop rather
              than pulling whatever full-res file was uploaded. */}
          <Image
            source={{ uri: resizeUrl(src, { w: 1200, h: height * 2 }) ?? src }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          {/* Dark gradient at the bottom so overlaid text stays readable on any photo */}
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']}
            locations={[0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <>
          {/* Solid accent gradient fallback — no stripes */}
          <LinearGradient
            colors={[YColors.accent, YColors.accentDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Soft top-right glow */}
          <LinearGradient
            colors={['rgba(255,255,255,0.18)', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[StyleSheet.absoluteFill, { opacity: 0.7 }]}
          />
          {/* Optional faint watermark — opt-in by passing fallbackTitle */}
          {fallbackTitle ? (
            <View style={styles.fallbackTitleWrap} pointerEvents="none">
              {fallbackEyebrow ? (
                <YEyebrow color="rgba(255,255,255,0.55)" style={{ marginBottom: 4 }}>
                  {fallbackEyebrow}
                </YEyebrow>
              ) : null}
              <YDisplay size={48} color="rgba(255,255,255,0.18)" style={{ lineHeight: 44 }}>
                {fallbackTitle}
              </YDisplay>
            </View>
          ) : null}
        </>
      )}

      {/* Overlay slot for badges or controls */}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  fallbackTitleWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
  },
});
