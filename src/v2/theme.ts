// ─── v2 broadcast theme ──────────────────────────────────────────
//
// The same look as the event sites and yoiden.com: navy bars, lime for
// highlights, white tiles on a light grey page, Barlow Condensed for headings
// and Inter for text. Every v2 screen takes its colours and fonts from here.

import { Platform, TextStyle } from 'react-native';

export const C = {
  bar: '#001E40', // navy: top bars, banners, title bars
  barSoft: '#22385A', // grid lines on navy
  hl: '#D7F205', // lime: highlights, primary buttons
  hlInk: '#5B6B00', // lime-ish text on white ("Upcoming")
  accent: '#2952E3', // stripes, links, event tile edge
  page: '#F2F4F7',
  white: '#FFFFFF',
  line: '#E3E6EB',
  lineStrong: '#C9CED6',
  ink: '#0B0F1A',
  soft: '#4B5565',
  mute: '#6B7585',
  live: '#E11D2E',
  green: '#16A34A',
  greenSoft: '#DCFCE7',
  amber: '#B45309',
  amberSoft: '#FEF3C7',
} as const;

export const F = {
  cond: 'BarlowCondensed_800ExtraBold',
  condBold: 'BarlowCondensed_700Bold',
  condSemi: 'BarlowCondensed_600SemiBold',
  text: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semi: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  heavy: 'Inter_800ExtraBold',
} as const;

/** Condensed uppercase heading ("sport-head" on the website). */
export const head = (size: number, color: string = C.ink): TextStyle => ({
  fontFamily: F.cond,
  fontSize: size,
  color,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  lineHeight: Math.round(size * 1.05),
});

/** Small condensed uppercase label ("sport-label"). */
export const label = (size: number, color: string = C.bar): TextStyle => ({
  fontFamily: F.condBold,
  fontSize: size,
  color,
  textTransform: 'uppercase',
  letterSpacing: 0.9,
});

export const body = (size = 14, color: string = C.ink, weight: keyof typeof F = 'text'): TextStyle => ({
  fontFamily: F[weight],
  fontSize: size,
  color,
});

export const card = {
  backgroundColor: C.white,
  borderWidth: 1,
  borderColor: C.line,
  borderRadius: 14,
} as const;

/** Width of a tile in the horizontal rows on Home. */
export const TILE_W = 260;

/** Max content width when the app runs in a wide browser window. */
export const MAX_W = 760;

export const isWeb = Platform.OS === 'web';

/** True for light team colours that need dark text on top. */
export function isLight(hex: string | null | undefined): boolean {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return false;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}
