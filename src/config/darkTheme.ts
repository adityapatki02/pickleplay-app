// Yoiden Dark Theme
// Inspired by: JioHotstar dark mode, premium sports apps
// Background court images at low opacity with dark overlay

export const dark = {
  // Core backgrounds
  bg: '#0A0E14',              // Near-black with slight blue tint
  bgSecondary: '#111722',     // Slightly lighter for cards
  bgTertiary: '#1A2230',      // Card hover / elevated surfaces
  bgCard: 'rgba(255,255,255,0.06)',  // Glassmorphic card
  bgCardHover: 'rgba(255,255,255,0.10)',

  // Surfaces
  surface: '#0F1520',
  surfaceElevated: '#161E2E',
  surfaceBorder: 'rgba(255,255,255,0.08)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',
  textTertiary: 'rgba(255,255,255,0.45)',
  textMuted: 'rgba(255,255,255,0.3)',

  // Brand
  accent: '#1858D6',          // Yoiden blue
  accentLight: 'rgba(33,150,243,0.15)',
  accentGlow: 'rgba(33,150,243,0.25)',

  // Status
  green: '#06D6A0',
  red: '#EF4444',
  orange: '#FFB703',
  gray: '#6B7280',

  // Specific
  navyHeader: '#0A0E14',      // Same as bg — seamless
  cardBorder: 'rgba(255,255,255,0.08)',
  divider: 'rgba(255,255,255,0.06)',
  overlay: 'rgba(0,0,0,0.6)', // For image overlays

  // Navbar
  navbarBg: 'rgba(10,14,20,0.95)',
  navbarBorder: 'rgba(255,255,255,0.06)',
} as const;
