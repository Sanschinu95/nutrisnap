/**
 * Macro Pill component for displaying protein/carbs/fat
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { ThemedText } from './ThemedText';
import { BorderRadius, Spacing, Colors } from '@/constants/theme';

type MacroType = 'protein' | 'carbs' | 'fat';

interface MacroPillProps {
  type: MacroType;
  value: number;
  unit?: string;
  showLabel?: boolean;
  size?: 'small' | 'medium';
  style?: ViewStyle;
}

const MACRO_COLORS: Record<MacroType, string> = {
  protein: Colors.brownMid,
  carbs: Colors.yellow,
  fat: Colors.oliveMid,
};

const MACRO_LABELS: Record<MacroType, string> = {
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
};

const MACRO_EMOJI: Record<MacroType, string> = {
  protein: '🥩',
  carbs: '🍞',
  fat: '🥑',
};

export function MacroPill({
  type,
  value,
  unit = 'g',
  showLabel = true,
  size = 'medium',
  style,
}: MacroPillProps) {
  const { theme } = useTheme();
  const color = MACRO_COLORS[type];
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: `${color}20`,
          borderColor: color,
          paddingVertical: isSmall ? Spacing.xs : Spacing.sm,
          paddingHorizontal: isSmall ? Spacing.sm : Spacing.md,
        },
        style,
      ]}
    >
      <ThemedText style={styles.emoji}>
        {MACRO_EMOJI[type]}
      </ThemedText>
      <View style={styles.textContainer}>
        {showLabel && (
          <ThemedText
            variant="labelSmall"
            color={theme.textMuted}
            style={styles.label}
          >
            {MACRO_LABELS[type]}
          </ThemedText>
        )}
        <ThemedText
          variant={isSmall ? 'label' : 'bodyMedium'}
          color={color}
        >
          {Math.round(value)}{unit}
        </ThemedText>
      </View>
    </View>
  );
}

interface MacroPillRowProps {
  protein: number;
  carbs: number;
  fat: number;
  showLabels?: boolean;
  size?: 'small' | 'medium';
  style?: ViewStyle;
}

export function MacroPillRow({
  protein,
  carbs,
  fat,
  showLabels = true,
  size = 'medium',
  style,
}: MacroPillRowProps) {
  return (
    <View style={[styles.row, style]}>
      <MacroPill type="protein" value={protein} showLabel={showLabels} size={size} />
      <MacroPill type="carbs" value={carbs} showLabel={showLabels} size={size} />
      <MacroPill type="fat" value={fat} showLabel={showLabels} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  emoji: {
    fontSize: 14,
    marginRight: Spacing.xs,
  },
  textContainer: {
    alignItems: 'flex-start',
  },
  label: {
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});
