// Yoiden — Light Editorial Design System
// Source of truth: design_yoiden/app/styles-light.css + ui-v3.jsx

export const YColors = {
  // Backgrounds (paper / cream)
  bg: '#F6F5F1',
  bg2: '#FFFFFF',
  bg3: '#EDEBE4',
  bg4: '#DEDBD2',

  // Ink (text) — black on light
  ink: '#0A0A0B',
  ink2: 'rgba(10,10,11,0.66)',
  ink3: 'rgba(10,10,11,0.42)',
  ink4: 'rgba(10,10,11,0.22)',

  // Lines / borders
  line: 'rgba(10,10,11,0.10)',
  line2: 'rgba(10,10,11,0.18)',

  // Brand
  accent: '#1858D6',       // deep blue
  accentDeep: '#0E3FA5',
  lime: '#C8F232',         // pop
  live: '#FF3D5C',         // live/danger
  gold: '#E6A82B',

  // Inverse (for dark-on-light moments)
  inverseInk: '#FFFFFF',
} as const;

export const YFonts = {
  display: 'Anton_400Regular',
  ui: 'Archivo_400Regular',
  uiMedium: 'Archivo_500Medium',
  uiSemibold: 'Archivo_600SemiBold',
  uiBold: 'Archivo_700Bold',
  uiExtrabold: 'Archivo_800ExtraBold',
  uiBlack: 'Archivo_900Black',
  narrow: 'ArchivoNarrow_400Regular',
  narrowBold: 'ArchivoNarrow_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
  monoExtrabold: 'JetBrainsMono_800ExtraBold',
} as const;

export const YType = {
  // Display — Anton, condensed, italic, uppercase
  display: {
    fontFamily: YFonts.display,
    fontStyle: 'italic' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  displayUp: {
    fontFamily: YFonts.display,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  // Eyebrow — small uppercase label
  eyebrow: {
    fontFamily: YFonts.uiExtrabold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    color: YColors.ink2,
  },
  // UI text
  ui: { fontFamily: YFonts.ui },
  uiBold: { fontFamily: YFonts.uiBold },
  uiBlack: { fontFamily: YFonts.uiBlack },
  // Mono — JetBrains, tabular numbers
  mono: { fontFamily: YFonts.mono },
  monoBold: { fontFamily: YFonts.monoBold },
} as const;

export const YSpacing = {
  '2xs': 4,
  xs: 6,
  sm: 8,
  md: 10,
  base: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
} as const;

export const YRadius = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 10,
  xl: 14,
  '2xl': 16,
  pill: 999,
} as const;

export const YShadow = {
  card: {
    shadowColor: '#0A0A0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  raised: {
    shadowColor: '#0A0A0B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 6,
  },
} as const;

// Letter-spacing presets aligned with the editorial design (RN uses raw px)
export const YTracking = {
  eyebrow: 1.5,   // 0.14em ≈ 1.5 at 11px
  loud: 2,
  uiTight: 0.3,
  uiWide: 1,
  display: 0.5,
} as const;

