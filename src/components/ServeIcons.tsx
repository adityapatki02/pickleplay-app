import React from 'react';
import Svg, { Path, Circle, Line } from 'react-native-svg';

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

// Target / bullseye — receiver marker. Clearly distinct from the shuttle at
// small sizes (concentric rings read instantly as "the receiving end").
export function TargetIcon({ size = 16, color = '#B45309' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth={1.7} />
      <Circle cx="12" cy="12" r="5" fill="none" stroke={color} strokeWidth={1.7} />
      <Circle cx="12" cy="12" r="2" fill={color} />
    </Svg>
  );
}
