import React from 'react';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const HomeIcon: React.FC<IconProps> = ({ size = 24, color = '#001E40', strokeWidth = 1.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 9.5L12 3L21 9.5V20C21 20.5523 20.5523 21 20 21H15V15H9V21H4C3.44772 21 3 20.5523 3 20V9.5Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ExploreIcon: React.FC<IconProps> = ({ size = 24, color = '#001E40', strokeWidth = 1.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="8" stroke={color} strokeWidth={strokeWidth} />
    <Path d="M21 21L16.65 16.65" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

export const TrophyIcon: React.FC<IconProps> = ({ size = 24, color = '#FFFFFF', strokeWidth = 1.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M6 2H18V13C18 16.3137 15.3137 19 12 19C8.68629 19 6 16.3137 6 13V2Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
    <Path d="M6 5H3C3 5 2 11 6 12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M18 5H21C21 5 22 11 18 12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M12 19V22" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M8 22H16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

export const MatchesIcon: React.FC<IconProps> = ({ size = 24, color = '#001E40', strokeWidth = 1.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <Path d="M3 9H21" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M8 2V5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M16 2V5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M7 14H10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M14 14H17" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

export const CalendarIcon: React.FC<IconProps> = ({ size = 24, color = '#001E40', strokeWidth = 1.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="4" width="18" height="17" rx="2" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <Path d="M3 9H21" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M8 2V5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M16 2V5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Circle cx="8" cy="14" r="1" fill={color} />
    <Circle cx="12" cy="14" r="1" fill={color} />
    <Circle cx="16" cy="14" r="1" fill={color} />
  </Svg>
);

export const StatsIcon: React.FC<IconProps> = ({ size = 24, color = '#001E40', strokeWidth = 1.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 20H21" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M7 20V13" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M12 20V8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M17 20V4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

export const ProfileIcon: React.FC<IconProps> = ({ size = 24, color = '#001E40', strokeWidth = 1.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M4 20C4 17.2386 7.58172 15 12 15C16.4183 15 20 17.2386 20 20"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </Svg>
);
