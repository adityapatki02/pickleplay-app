// Yoiden v1 design system.
// Adopted from the approved Lovable design (codename "DinkMaster").
// This is the single source of truth for v1 styling. The legacy
// src/config/yoiden.ts is retired screen-by-screen in later phases.

export const Colors = {
  background: '#FAFAFB', // app background (off-white)
  surface:    '#FFFFFF', // card surface
  ink:        '#1B1E2E', // primary text
  navy:       '#2A2E4D', // dark hero cards
  blue:       '#5471F0', // accent / links
  lime:       '#C7F03A', // pop accent, winning score, FAB
  amber:      '#E8B43F', // secondary accent
  muted:      '#6C7186', // secondary text
  border:     '#E6E8EE', // hairline borders / rings
  danger:     '#DC4838', // live / danger
  white:      '#FFFFFF',
} as const;

export const Fonts = {
  display:      'SpaceGrotesk_600SemiBold', // headings
  displayBold:  'SpaceGrotesk_700Bold',     // emphatic headings
  displayMedium:'SpaceGrotesk_500Medium',
  body:         'DMSans_400Regular',
  bodyMedium:   'DMSans_500Medium',
  bodySemibold: 'DMSans_600SemiBold',
  bodyBold:     'DMSans_700Bold',
  mono:         'JetBrainsMono_500Medium',  // scores / numbers
  monoBold:     'JetBrainsMono_700Bold',
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,   // rounded-2xl cards
  xl: 20,
  pill: 999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const Shadow = {
  // Subtle card lift used across surfaces.
  card: {
    shadowColor: '#1B1E2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  // Stronger lift for the floating bottom nav / FAB.
  raised: {
    shadowColor: '#1B1E2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;
