import React from 'react';
import Svg, { Path, Circle, Line, Ellipse } from 'react-native-svg';

// Shuttlecock — server marker. Feather cone + cork base.
export function ShuttleIcon({ size = 16, color = '#0369A1' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8 5 L12 16 L16 5" fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      <Line x1="10" y1="5" x2="11.2" y2="15" stroke={color} strokeWidth={0.9} />
      <Line x1="12" y1="4.5" x2="12" y2="16" stroke={color} strokeWidth={0.9} />
      <Line x1="14" y1="5" x2="12.8" y2="15" stroke={color} strokeWidth={0.9} />
      <Circle cx="12" cy="17.8" r="2.3" fill={color} />
    </Svg>
  );
}

// Badminton racket — receiver marker. Oval strung head + handle.
export function RacketIcon({ size = 16, color = '#B45309' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Ellipse cx="10.5" cy="8" rx="5.2" ry="6.2" fill="none" stroke={color} strokeWidth={1.5} />
      <Line x1="6.5" y1="8" x2="14.5" y2="8" stroke={color} strokeWidth={0.6} />
      <Line x1="10.5" y1="2" x2="10.5" y2="14" stroke={color} strokeWidth={0.6} />
      <Line x1="14" y1="12.6" x2="20" y2="21" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}
