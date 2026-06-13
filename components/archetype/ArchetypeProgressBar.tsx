/**
 * ArchetypeProgressBar — Animated progress bar showing archetype level advancement
 * Displays: progress bar, level name, percentage, days-to-next-level
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/hooks/useTheme';
import { getArchetype, type ArchetypeKey } from '@/constants/archetypes';
import { ArchetypeColors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import {
  getLevelForProgress,
  getNextLevel,
  daysToNextLevel,
  MAX_PROGRESS,
} from '@/constants/archetypeProgress';

interface ArchetypeProgressBarProps {
  archetype: ArchetypeKey;
  progress: number; // 0-100
}

export function ArchetypeProgressBar({ archetype, progress }: ArchetypeProgressBarProps) {
  const { theme } = useTheme();
  const colors = ArchetypeColors[archetype];
  const archetypeInfo = getArchetype(archetype);
  const level = getLevelForProgress(progress);
  const nextLevel = getNextLevel(progress);
  const daysLeft = daysToNextLevel(progress);

  const clampedProgress = Math.min(Math.max(progress, 0), MAX_PROGRESS);
  const fillPercentage = clampedProgress / MAX_PROGRESS;

  const animatedWidth = useSharedValue(0);

  useEffect(() => {
    // Animate the bar width on mount or progress change
    animatedWidth.value = withTiming(fillPercentage, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [fillPercentage, animatedWidth]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value * 100}%`,
  }));

  const progressText = `${archetypeInfo.name} Progress — ${clampedProgress}%`;
  const levelText = nextLevel
    ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} to ${nextLevel.label}`
    : 'Max level reached 🏆';

  return (
    <Card style={styles.container}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.leftHeader}>
          <ThemedText style={styles.emoji}>{archetypeInfo.emoji}</ThemedText>
          <View>
            <ThemedText variant="bodySemiBold" color={theme.text}>
              {progressText}
            </ThemedText>
            <ThemedText variant="labelSmall" color={theme.textMuted}>
              {levelText}
            </ThemedText>
          </View>
        </View>
        <View style={[styles.levelBadge, { backgroundColor: colors.primary + '20' }]}>
          <ThemedText variant="labelSmall" color={colors.accent}>
            {level.emoji} {level.label}
          </ThemedText>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: colors.accent,
            },
            barStyle,
          ]}
        />
        {/* Level markers */}
        <View style={[styles.marker, { left: '20%' }]} />
        <View style={[styles.marker, { left: '50%' }]} />
        <View style={[styles.marker, { left: '80%' }]} />
      </View>

      {/* Level labels below bar */}
      <View style={styles.levelLabels}>
        <ThemedText variant="labelSmall" color={theme.textMuted}>Pup</ThemedText>
        <ThemedText variant="labelSmall" color={theme.textMuted}>Base</ThemedText>
        <ThemedText variant="labelSmall" color={theme.textMuted}>Alpha</ThemedText>
        <ThemedText variant="labelSmall" color={theme.textMuted}>Legend</ThemedText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  emoji: {
    fontSize: 24,
  },
  levelBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  barTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  marker: {
    position: 'absolute',
    top: 0,
    width: 1.5,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  levelLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
    paddingHorizontal: 2,
  },
});
