/**
 * NutriSnap Design System - Theme Constants
 * All colors, shadows, spacing, and typography tokens
 */

export const Colors = {
  background: '#F8F7F4',
  card: '#FFFFFF',
  border: '#ECE6DE',
  brown: '#2F241E',
  brownMid: '#7A726A',
  muted: '#7A726A',
  olive: '#4CAF50',
  oliveMid: '#66BB6A',
  oliveLight: '#E8F5E9',
  orange: '#E8703A',
  orangeLight: '#F7D4C3',
  orangePale: '#FFF1EA',
  blue: '#4D8EFF',
  blueLight: '#DCEAFF',
  yellow: '#F2B84B',
  yellowLight: '#FFF2D4',
  error: '#C0392B',
  errorLight: '#FADBD8',
  white: '#FFFFFF',
  // Chart-specific colors (scoped to NutritionRouteChart only)
  routePink: '#E0397A',
  routePinkLight: 'rgba(224,57,122,0.15)',
  chartBlue: '#3D8BFF',
  chartBlueLight: 'rgba(61,139,255,0.15)',
  chartGrid: '#E8E4E0',
} as const;

export const Shadows = {
  card: {
    shadowColor: '#2F241E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  fab: {
    shadowColor: '#E8703A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;

// Spacing scale - only use these values
export const Spacing = {
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

// Border radius tokens
export const BorderRadius = {
  sm: 8,    // Small chips/badges
  md: 16,   // Cards, Buttons
  lg: 24,   // Hero cards
  full: 32, // FAB (circle)
} as const;

// Typography configuration
export const Typography = {
  fonts: {
    headingBold: 'Nunito_800ExtraBold',
    headingSemiBold: 'Nunito_700Bold',
    body: 'Inter_400Regular',
    bodyMedium: 'Inter_500Medium',
    bodySemiBold: 'Inter_600SemiBold',
    serif: 'Fraunces_500Medium',
    serifSemi: 'Fraunces_600SemiBold',
    serifBold: 'Fraunces_700Bold',
  },
  sizes: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

// Theme type definition
export type Theme = {
  background: string;
  card: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryMid: string;
  primaryLight: string;
  accent: string;
  accentLight: string;
  accentPale: string;
  warning: string;
  warningLight: string;
  error: string;
  errorLight: string;
  white: string;
};

export const lightTheme: Theme = {
  background: Colors.background,
  card: Colors.card,
  border: Colors.border,
  text: Colors.brown,
  textSecondary: Colors.brownMid,
  textMuted: Colors.muted,
  primary: Colors.olive,
  primaryMid: Colors.oliveMid,
  primaryLight: Colors.oliveLight,
  accent: Colors.orange,
  accentLight: Colors.orangeLight,
  accentPale: Colors.orangePale,
  warning: Colors.yellow,
  warningLight: Colors.yellowLight,
  error: Colors.error,
  errorLight: Colors.errorLight,
  white: Colors.white,
};

export const darkTheme: Theme = {
  ...lightTheme,
  background: Colors.background,
  card: Colors.card,
  border: Colors.border,
  text: Colors.brown,
  textSecondary: Colors.brownMid,
  textMuted: Colors.muted,
  primary: Colors.olive,
  primaryMid: Colors.oliveMid,
  primaryLight: Colors.oliveLight,
  accent: Colors.orange,
  accentLight: Colors.orangeLight,
  accentPale: Colors.orangePale,
  warning: Colors.yellow,
  warningLight: Colors.yellowLight,
  error: Colors.error,
  errorLight: Colors.errorLight,
  white: Colors.white,
};
