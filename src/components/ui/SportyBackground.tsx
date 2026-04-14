import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

// Dynamic action-oriented background pattern
// Speed lines, burst rays, angular swooshes, energy dots
// Sport-agnostic — conveys motion, energy, competition

const S1 = 'rgba(255,255,255,0.12)'; // primary stroke
const S2 = 'rgba(255,255,255,0.07)'; // secondary stroke
const S3 = 'rgba(255,255,255,0.04)'; // tertiary stroke
const DOT = 'rgba(255,255,255,0.14)';
const GLOW = 'rgba(33,150,243,0.12)'; // subtle blue glow

interface Props {
  variant?: 'header' | 'hero' | 'section';
}

export default function SportyBackground({ variant = 'header' }: Props) {
  if (variant === 'hero') {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 400 280" preserveAspectRatio="xMaxYMax slice">
          {/* Burst rays from top-right corner */}
          <Line x1="400" y1="0" x2="200" y2="280" stroke={S3} strokeWidth="1.5" />
          <Line x1="400" y1="0" x2="250" y2="280" stroke={S3} strokeWidth="1.2" />
          <Line x1="400" y1="0" x2="300" y2="280" stroke={S3} strokeWidth="1" />
          <Line x1="400" y1="0" x2="350" y2="280" stroke={S3} strokeWidth="0.8" />

          {/* Speed lines — horizontal, varying lengths */}
          <Line x1="-20" y1="60" x2="80" y2="60" stroke={S1} strokeWidth="2.5" strokeLinecap="round" />
          <Line x1="-20" y1="75" x2="55" y2="75" stroke={S2} strokeWidth="2" strokeLinecap="round" />
          <Line x1="-20" y1="90" x2="35" y2="90" stroke={S3} strokeWidth="1.5" strokeLinecap="round" />

          {/* Angular swoosh — bottom left */}
          <Path
            d="M -20 240 Q 60 200 140 220 Q 200 235 260 200"
            stroke={S1}
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M -20 255 Q 60 215 140 235 Q 200 250 260 215"
            stroke={S3}
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
          />

          {/* Double chevrons — mid right (victory/action symbol) */}
          <Path d="M 330 100 L 355 80 L 380 100" stroke={S1} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M 330 115 L 355 95 L 380 115" stroke={S2} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />

          {/* Energy dots — scattered */}
          <Circle cx="120" cy="40" r="2" fill={DOT} />
          <Circle cx="300" cy="180" r="2" fill={DOT} />
          <Circle cx="180" cy="260" r="1.5" fill={DOT} />
          <Circle cx="350" cy="240" r="1.5" fill={DOT} />

          {/* Subtle glow circle — top right */}
          <Circle cx="380" cy="20" r="60" fill={GLOW} />
        </Svg>
      </View>
    );
  }

  if (variant === 'section') {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 400 120" preserveAspectRatio="xMaxYMax slice">
          {/* Speed streaks */}
          <Line x1="280" y1="20" x2="420" y2="20" stroke={S2} strokeWidth="1.5" strokeLinecap="round" />
          <Line x1="300" y1="35" x2="420" y2="35" stroke={S3} strokeWidth="1.2" strokeLinecap="round" />

          {/* Angular line */}
          <Path d="M 350 80 L 380 60 L 420 80" stroke={S2} strokeWidth="1.2" fill="none" strokeLinecap="round" />

          {/* Dot */}
          <Circle cx="340" cy="100" r="1.5" fill={DOT} />
        </Svg>
      </View>
    );
  }

  // Default: 'header' variant — used on Home header + tile area
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 400 320" preserveAspectRatio="xMaxYMax slice">
        {/* Burst rays — radiating from top-right */}
        <Line x1="400" y1="-20" x2="180" y2="320" stroke={S3} strokeWidth="1.5" />
        <Line x1="400" y1="-20" x2="230" y2="320" stroke={S3} strokeWidth="1.2" />
        <Line x1="400" y1="-20" x2="280" y2="320" stroke={S3} strokeWidth="1" />
        <Line x1="400" y1="-20" x2="330" y2="320" stroke={S3} strokeWidth="0.8" />

        {/* Speed lines — left side, stacked */}
        <Line x1="-30" y1="70" x2="90" y2="70" stroke={S1} strokeWidth="3" strokeLinecap="round" />
        <Line x1="-30" y1="88" x2="60" y2="88" stroke={S2} strokeWidth="2.2" strokeLinecap="round" />
        <Line x1="-30" y1="106" x2="40" y2="106" stroke={S3} strokeWidth="1.6" strokeLinecap="round" />

        {/* Dynamic swoosh curve — mid section */}
        <Path
          d="M -20 180 Q 80 140 180 165 Q 280 190 380 140"
          stroke={S1}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M -20 195 Q 80 155 180 180 Q 280 205 380 155"
          stroke={S3}
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />

        {/* Double chevrons — right side (action/forward) */}
        <Path d="M 340 40 L 365 20 L 390 40" stroke={S1} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M 340 56 L 365 36 L 390 56" stroke={S2} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Angular accent — bottom right */}
        <Path d="M 300 280 L 340 260 L 380 280 L 420 260" stroke={S2} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Energy dots */}
        <Circle cx="150" cy="40" r="2" fill={DOT} />
        <Circle cx="280" cy="120" r="1.8" fill={DOT} />
        <Circle cx="100" cy="250" r="1.5" fill={DOT} />
        <Circle cx="350" cy="300" r="1.5" fill={DOT} />
        <Circle cx="200" cy="300" r="1.2" fill={DOT} />

        {/* Glow — top right corner */}
        <Circle cx="390" cy="10" r="70" fill={GLOW} />

        {/* Glow — bottom left */}
        <Circle cx="30" cy="300" r="50" fill="rgba(6,214,160,0.06)" />
      </Svg>
    </View>
  );
}
