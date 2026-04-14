// Light Theme — "Clean Court" Design System
// White backgrounds, Navy accents, clean shadows

export const light = {
  // Primary colors
  primary: '#001E40',       // Deep Navy
  secondary: '#2196F3',     // Velocity Blue
  accent: '#2196F3',        // Same as secondary

  // Backgrounds
  bg: '#FFFFFF',            // Main background
  bgSecondary: '#F5F7FA',   // Section/card backgrounds
  bgTertiary: '#EEF2F7',    // Deeper sections
  bgNavy: '#001E40',        // Navy sections (headers, CTAs)

  // Surfaces
  card: '#FFFFFF',           // Card background
  cardBorder: '#E2E8F0',    // Card border
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  // Text
  textPrimary: '#1A1D21',   // Near black
  textSecondary: '#64748B',  // Slate gray
  textTertiary: '#94A3B8',   // Light slate
  textOnNavy: '#FFFFFF',     // White text on navy
  textOnNavySub: 'rgba(255,255,255,0.7)', // Subdued white

  // Borders & Dividers
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  divider: '#F1F5F9',

  // Status colors
  success: '#06D6A0',
  warning: '#FFB703',
  error: '#EF4444',
  info: '#2196F3',

  // Specific UI elements
  inputBg: '#F5F7FA',
  inputBorder: '#E2E8F0',
  inputText: '#1A1D21',
  inputPlaceholder: '#94A3B8',

  // Chip/Tab states
  chipActive: '#001E40',
  chipActiveText: '#FFFFFF',
  chipInactive: '#F5F7FA',
  chipInactiveText: '#64748B',

  // Navigation
  navBg: '#001E40',
  navText: '#FFFFFF',
  tabBarBg: '#FFFFFF',
  tabBarActive: '#001E40',
  tabBarInactive: '#94A3B8',

  // Score/Match specific
  winnerBg: 'rgba(6,214,160,0.08)',
  loserOpacity: 0.4,
  scoreBadgeBg: '#F0FDF4',
  scoreBadgeText: '#06D6A0',

  // Rating
  ratingBg: '#FFF8E1',
  ratingText: '#F59E0B',
  newBadgeBg: '#EFF6FF',
  newBadgeText: '#2196F3',

  // Check-in
  checkedInBg: '#F0FDF4',
  checkedInText: '#06D6A0',
  notCheckedInBg: '#FFFBEB',
  notCheckedInText: '#FFB703',
};
