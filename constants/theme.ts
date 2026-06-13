/**
 * NutriSnap Design System - Theme Constants
 * All colors, shadows, spacing, and typography tokens
 */

export const Colors = {
  // Light mode
  background: '#F5F0E8',
  card: '#EDE6D6',
  border: '#E0D5C5',
  brown: '#3D2B1F',
  brownMid: '#6B4C3B',
  muted: '#9E8A78',
  olive: '#5D7A3E',
  oliveMid: '#7A9E54',
  oliveLight: '#C8DBA8',
  orange: '#E8703A',
  orangeLight: '#F5C4A8',
  orangePale: '#FDF0E8',
  yellow: '#E8C13A',
  yellowLight: '#FAF0C0',
  error: '#C0392B',
  errorLight: '#FADBD8',
  white: '#FFFFFF',

  // Dark mode
  darkBg: '#1C1410',
  darkCard: '#2C1F16',
  darkCardMid: '#3D2B1F',
  darkText: '#F0E8D8',
  darkMuted: '#9E8A78',
} as const;

export const ArchetypeColors = {
  wolf: { primary: '#1A1A2E', accent: '#E94560', bg: '#0F0F1A' },
  bear: { primary: '#7B3F00', accent: '#FFB347', bg: '#2A1500' },
  lion: { primary: '#8B4513', accent: '#FFD700', bg: '#2C1810' },
  deer: { primary: '#2D5A27', accent: '#90EE90', bg: '#0D1A0D' },
  tigress: { primary: '#6B1414', accent: '#FF6B6B', bg: '#1A0A0A' },
  phoenix: { primary: '#8B2500', accent: '#FFD700', bg: '#1A0D00' },
  doe: { primary: '#2E5E2E', accent: '#98FB98', bg: '#0D1A0D' },
  swan: { primary: '#1B6B5A', accent: '#A0E8D5', bg: '#0D1A17' },
} as const;

export const Shadows = {
  card: {
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
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

// Theme object for light/dark mode
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
  background: Colors.darkBg,
  card: Colors.darkCard,
  border: Colors.darkCardMid,
  text: Colors.darkText,
  textSecondary: Colors.darkText,
  textMuted: Colors.darkMuted,
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
