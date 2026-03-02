/**
 * Badge/Pill component
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { ThemedText } from './ThemedText';
import { BorderRadius, Spacing } from '@/constants/theme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
type BadgeSize = 'small' | 'medium';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: string;
  style?: ViewStyle;
}

export function Badge({
  text,
  variant = 'default',
  size = 'medium',
  icon,
  style,
}: BadgeProps) {
  const { theme } = useTheme();

  const getVariantColors = (): { bg: string; text: string } => {
    switch (variant) {
      case 'success':
        return { bg: theme.primaryLight, text: theme.primary };
      case 'warning':
        return { bg: theme.warningLight, text: theme.text };
      case 'error':
        return { bg: theme.errorLight, text: theme.error };
      case 'info':
        return { bg: theme.accentPale, text: theme.accent };
      default:
        return { bg: theme.card, text: theme.textMuted };
    }
  };

  const colors = getVariantColors();
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          paddingVertical: isSmall ? Spacing.xs : Spacing.sm,
          paddingHorizontal: isSmall ? Spacing.sm : Spacing.md,
        },
        style,
      ]}
    >
      {icon && <ThemedText style={styles.icon}>{icon}</ThemedText>}
      <ThemedText
        variant={isSmall ? 'labelSmall' : 'label'}
        color={colors.text}
      >
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: Spacing.xs,
  },
});
