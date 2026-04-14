import React from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SW, height: SH } = Dimensions.get('window');

// Background images — pickleball court scenes
const BG_IMAGES = [
  require('../../../assets/bg/court-night.jpg'),
  require('../../../assets/bg/player-action.jpg'),
  require('../../../assets/bg/net-blue.jpg'),
  require('../../../assets/bg/net-clay.jpg'),
];

interface Props {
  /** Which image to show (0-3), or 'none' for solid dark */
  imageIndex?: number;
  /** Image opacity (0-1). Default 0.12 */
  opacity?: number;
  /** Extra dark gradient overlay on top. Default true */
  gradient?: boolean;
  children?: React.ReactNode;
}

/**
 * Full-screen dark background with optional court image at low opacity.
 * Wrap your screen content in this component for the dark theme look.
 */
export default function DarkBackground({
  imageIndex = 0,
  opacity = 0.12,
  gradient = true,
  children,
}: Props) {
  const img = BG_IMAGES[imageIndex % BG_IMAGES.length];

  return (
    <View style={s.root}>
      {/* Base dark color */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0E14' }]} />

      {/* Court image at low opacity */}
      <Image
        source={img}
        style={[
          s.bgImage,
          { opacity },
        ] as any}
      />

      {/* Gradient overlay for depth — darker at top and bottom */}
      {gradient && (
        <LinearGradient
          colors={[
            'rgba(10,14,20,0.8)',
            'rgba(10,14,20,0.3)',
            'rgba(10,14,20,0.5)',
            'rgba(10,14,20,0.9)',
          ]}
          locations={[0, 0.3, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Content */}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0E14',
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  } as any,
});
