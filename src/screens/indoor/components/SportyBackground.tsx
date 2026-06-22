import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Rect, Line } from 'react-native-svg';

export function SportyBackground() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="sporty" width={36} height={36} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <Rect width={36} height={36} fill="#F4F7FB" />
          <Line x1={0} y1={0} x2={0} y2={36} stroke="#001E40" strokeWidth={18} strokeOpacity={0.045} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#sporty)" />
    </Svg>
  );
}
