/**
 * Theme hook for dark/light mode support
 */

import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme, type Theme } from '@/constants/theme';

export interface UseThemeReturn {
  theme: Theme;
  isDark: boolean;
  colorScheme: 'light' | 'dark';
}

export function useTheme(): UseThemeReturn {
  const systemColorScheme = useColorScheme();
  const colorScheme: 'light' | 'dark' = systemColorScheme === 'dark' ? 'dark' : 'light';
  const isDark = colorScheme === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  return {
    theme,
    isDark,
    colorScheme,
  };
}

// Helper to get themed styles
export function useThemedStyles<T>(
  createStyles: (theme: Theme, isDark: boolean) => T
): T {
  const { theme, isDark } = useTheme();
  return createStyles(theme, isDark);
}
