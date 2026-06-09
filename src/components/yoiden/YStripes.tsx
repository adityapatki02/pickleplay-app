import React from 'react';
import { View, Text, ViewStyle, StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Rect, Path, Circle } from 'react-native-svg';
import { YColors, YFonts } from '../../config/yoiden';

// ── 3-stripe motif ───────────────────────────────────────────────
// Stack of N tapered bars rotated at an angle. Yoiden's signature decoration.
type YStripesProps = {
  count?: number;
  color?: string;
  thickness?: number;
  gap?: number;
  length?: number;
  angle?: number;
  style?: ViewStyle;
};
export const YStripes: React.FC<YStripesProps> = ({
  count = 3,
  color = YColors.accent,
  thickness = 5,
  gap = 6,
  length = 56,
  angle = -22,
  style,
}) => (
  <View style={[{ transform: [{ rotate: `${angle}deg` }] }, style]}>
    {Array.from({ length: count }).map((_, i) => (
      <View
        key={i}
        style={{
          height: thickness,
          width: length - i * 8,
          backgroundColor: color,
          borderRadius: thickness,
          marginBottom: gap,
        }}
      />
    ))}
  </View>
);

// ── Diagonal stripe fill (absolute) ──────────────────────────────
// Uses SVG <Pattern> for true CSS-like repeating-linear-gradient feel.
type YStripeFillProps = {
  color?: string;
  opacity?: number;
  angle?: number;
  w?: number;     // stripe thickness
  gap?: number;   // space between stripes
  style?: ViewStyle;
};
export const YStripeFill: React.FC<YStripeFillProps> = ({
  color = YColors.accent,
  opacity = 1,
  angle = -65,
  w = 4,
  gap = 11,
  style,
}) => {
  const step = w + gap;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { opacity }, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id="diag"
            patternUnits="userSpaceOnUse"
            width={step}
            height={step}
            patternTransform={`rotate(${angle})`}
          >
            <Rect x={0} y={0} width={w} height={step * 2} fill={color} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#diag)" />
      </Svg>
    </View>
  );
};

// ── Yoiden wordmark: "YOID[3-bar E]N" ────────────────────────────
type YWordmarkProps = {
  size?: number;
  color?: string;
  accent?: string;
  style?: ViewStyle;
};
export const YWordmark: React.FC<YWordmarkProps> = ({
  size = 22,
  color = YColors.ink,
  accent = YColors.accent,
  style,
}) => {
  const charStyle = {
    fontFamily: YFonts.uiBlack,
    fontSize: size,
    color,
    letterSpacing: size * 0.02,
    includeFontPadding: false,
  } as const;
  const barH = size * 0.12;
  const barW = size * 0.5;
  const barGap = size * 0.08;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      <Text style={charStyle}>YOID</Text>
      <View style={{ marginHorizontal: size * 0.05, justifyContent: 'center', height: size * 0.85 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ height: barH, width: barW, backgroundColor: accent, borderRadius: 1, marginBottom: i < 2 ? barGap : 0 }} />
        ))}
      </View>
      <Text style={charStyle}>N</Text>
    </View>
  );
};

// ── Yoiden glyph: Z-stroke with accent dot ───────────────────────
type YGlyphProps = {
  size?: number;
  color?: string;
  accent?: string;
};
export const YGlyph: React.FC<YGlyphProps> = ({
  size = 22,
  color = YColors.ink,
  accent = YColors.accent,
}) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Path
      d="M6 6 L26 6 L8 26 L26 26"
      stroke={color}
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx={26} cy={26} r={2.6} fill={accent} />
  </Svg>
);
