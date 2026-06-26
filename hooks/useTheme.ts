/**
 * Theme hook for V1 light-only design.
 */

import { lightTheme, type Theme } from '@/constants/theme';

export interface UseThemeReturn {
  theme: Theme;
  isDark: boolean;
  colorScheme: 'light' | 'dark';
}

export function useTheme(): UseThemeReturn {
  return {
    theme: lightTheme,
    isDark: false,
    colorScheme: 'light',
  };
}

// Helper to get themed styles
export function useThemedStyles<T>(
  createStyles: (theme: Theme, isDark: boolean) => T
): T {
  const { theme, isDark } = useTheme();
  return createStyles(theme, isDark);
}
