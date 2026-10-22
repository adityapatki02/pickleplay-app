// Line icons for v2, drawn from the same Lucide shapes the website uses.
import React from 'react';
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';

type P = { size?: number; color?: string; strokeWidth?: number; fill?: string };

const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24' });

export const SearchIcon = ({ size = 18, color = '#fff', strokeWidth = 2 }: P) => (
  <Svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="11" cy="11" r="8" />
    <Path d="m21 21-4.3-4.3" />
  </Svg>
);

export const StarIcon = ({ size = 16, color = '#001E40', strokeWidth = 2, fill = 'none' }: P) => (
  <Svg {...base(size)} fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11.5 2.9a.6.6 0 0 1 1 0l2.3 4.7a2 2 0 0 0 1.6 1.2l5.2.8a.6.6 0 0 1 .3 1l-3.8 3.7a2 2 0 0 0-.6 1.9l.9 5.2a.6.6 0 0 1-.8.6l-4.7-2.5a2 2 0 0 0-1.9 0l-4.7 2.5a.6.6 0 0 1-.8-.6l.9-5.2a2 2 0 0 0-.6-1.9L2.7 10.6a.6.6 0 0 1 .3-1l5.2-.8a2 2 0 0 0 1.6-1.2z" />
  </Svg>
);

export const ChevronLeft = ({ size = 20, color = '#fff', strokeWidth = 2.2 }: P) => (
  <Svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m15 18-6-6 6-6" />
  </Svg>
);

export const ChevronRight = ({ size = 16, color = '#001E40', strokeWidth = 2.2 }: P) => (
  <Svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m9 18 6-6-6-6" />
  </Svg>
);

export const HomeIcon = ({ size = 22, color = '#001E40', strokeWidth = 2 }: P) => (
  <Svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
    <Path d="M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Svg>
);

export const TrophyIcon = ({ size = 22, color = '#001E40', strokeWidth = 2 }: P) => (
  <Svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <Path d="M4 22h16" />
    <Path d="M10 14.7V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22" />
    <Path d="M14 14.7V17c0 .6.5 1 1 1.2 1.2.5 2 2 2 3.8" />
    <Path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </Svg>
);

export const BookmarkIcon = ({ size = 22, color = '#001E40', strokeWidth = 2 }: P) => (
  <Svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
  </Svg>
);

export const UserIcon = ({ size = 22, color = '#001E40', strokeWidth = 2 }: P) => (
  <Svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <Circle cx="12" cy="7" r="4" />
  </Svg>
);

export const GavelIcon = ({ size = 18, color = '#001E40', strokeWidth = 2.2 }: P) => (
  <Svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m14.5 12.5-8 8a2.1 2.1 0 1 1-3-3l8-8" />
    <Path d="m16 16 6-6" />
    <Path d="m8 8 6-6" />
    <Path d="m9 7 8 8" />
    <Path d="m21 11-8-8" />
  </Svg>
);

export const ClipboardIcon = ({ size = 18, color = '#001E40', strokeWidth = 2.2 }: P) => (
  <Svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
    <Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <Path d="M12 11h4" />
    <Path d="M12 16h4" />
    <Path d="M8 11h.01" />
    <Path d="M8 16h.01" />
  </Svg>
);

export const PlayIcon = ({ size = 22, color = '#001E40' }: P) => (
  <Svg {...base(size)} fill={color} stroke="none">
    <Path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z" />
  </Svg>
);

export const ShareIcon = ({ size = 16, color = '#fff', strokeWidth = 2 }: P) => (
  <Svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <Polyline points="16 6 12 2 8 6" />
    <Path d="M12 2v13" />
  </Svg>
);

export const GearIcon = ({ size = 16, color = '#001E40', strokeWidth = 2 }: P) => (
  <Svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z" />
    <Circle cx="12" cy="12" r="3" />
  </Svg>
);

export const CloseIcon = ({ size = 20, color = '#4B5565', strokeWidth = 2.2 }: P) => (
  <Svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 6 6 18" />
    <Path d="m6 6 12 12" />
  </Svg>
);

export const ExternalIcon = ({ size = 14, color = '#4B5565', strokeWidth = 2.2 }: P) => (
  <Svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M7 7h10v10" />
    <Path d="M7 17 17 7" />
  </Svg>
);
