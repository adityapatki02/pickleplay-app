// PicklePlay Design System — Athletic Editorial
// Inspired by: Navy blue, sporty uppercase, glassmorphism, Lexend + Manrope

export const colors = {
  // Primary — Deep Navy
  primary: '#001E40',
  primaryContainer: '#003366',
  primaryLight: '#1F477B',
  primaryFixed: '#D5E3FF',
  primaryFixedDim: '#A7C8FF',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#799DD6',

  // Secondary — Vivid Blue
  secondary: '#00629F',
  secondaryContainer: '#40A9FF',
  secondaryFixed: '#D0E4FF',
  secondaryFixedDim: '#9ACBFF',
  onSecondary: '#FFFFFF',
  onSecondaryContainer: '#003C64',

  // Tertiary — Red Accents
  tertiary: '#460001',
  tertiaryContainer: '#6E0003',
  onTertiaryContainer: '#FF6D5D',

  // Error
  error: '#BA1A1A',
  errorContainer: '#FFDAD6',
  onError: '#FFFFFF',

  // Surfaces — Light Gray System
  background: '#F8F9FA',
  surface: '#F8F9FA',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F3F4F5',
  surfaceContainer: '#EDEEEF',
  surfaceContainerHigh: '#E7E8E9',
  surfaceContainerHighest: '#E1E3E4',
  surfaceVariant: '#E1E3E4',
  surfaceDim: '#D9DADB',
  surfaceBright: '#F8F9FA',
  surfaceTint: '#3A5F94',

  // Text
  onSurface: '#191C1D',
  onSurfaceVariant: '#43474F',
  onBackground: '#191C1D',
  text: '#191C1D',
  textSecondary: '#43474F',
  textTertiary: '#737780',
  textInverse: '#FFFFFF',

  // Outlines
  outline: '#737780',
  outlineVariant: '#C3C6D1',
  border: '#E1E3E4',
  borderLight: '#EDEEEF',

  // Inverse
  inverseSurface: '#2E3132',
  inverseOnSurface: '#F0F1F2',
  inversePrimary: '#A7C8FF',

  // Status
  success: '#06D6A0',
  warning: '#FFB703',
  info: '#40A9FF',

  // Overlay
  overlay: 'rgba(0, 30, 64, 0.5)',
  shadow: 'rgba(0, 30, 64, 0.08)',

  // Rating skill levels
  rating: {
    beginner: '#9ACBFF',
    intermediate: '#40A9FF',
    advanced: '#00629F',
    pro: '#001E40',
  },

  // Match status
  matchStatus: {
    scheduled: '#40A9FF',
    in_progress: '#06D6A0',
    completed: '#43474F',
    cancelled: '#BA1A1A',
  },

  // Win/Loss badges
  win: {
    bg: '#6E0003',
    text: '#FF6D5D',
  },
  loss: {
    bg: '#E1E3E4',
    text: '#43474F',
  },
} as const;

export const typography = {
  fontFamily: {
    headline: 'System',  // Will be Lexend when loaded via expo-font
    body: 'System',      // Will be Manrope when loaded via expo-font
    label: 'System',     // Will be Lexend when loaded via expo-font
  },
  fontSize: {
    '2xs': 10,
    xs: 11,
    sm: 12,
    md: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
    '6xl': 60,
  },
  lineHeight: {
    none: 1,
    tight: 1.1,
    snug: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  letterSpacing: {
    tighter: -1.5,
    tight: -0.8,
    normal: 0,
    wide: 0.5,
    wider: 1,
    widest: 2,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

export const borderRadius = {
  none: 0,
  sm: 2,
  DEFAULT: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#001E40',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#001E40',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#001E40',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5,
  },
  '2xl': {
    shadowColor: '#001E40',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 8,
  },
} as const;
