/**
 * ChartModeSwitcher — animated pill/tab switcher for NutritionRouteChart modes.
 *
 * Three segments: Spline (default) · Bar · Trend
 * Includes animated sliding indicator and tap sound on press.
 */

import React, { useCallback, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Colors, BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useChartSound } from '@/hooks/useChartSound';
import type { ChartMode } from './NutritionRouteChart';

interface ChartModeSwitcherProps {
  activeMode: ChartMode;
  onModeChange: (mode: ChartMode) => void;
}

const MODES: { key: ChartMode; label: string }[] = [
  { key: 'spline', label: 'Spline' },
  { key: 'bar', label: 'Bar' },
  { key: 'dual-line', label: 'Trend' },
];

const INDICATOR_INSET = 3;

export function ChartModeSwitcher({ activeMode, onModeChange }: ChartModeSwitcherProps) {
  const { playTap } = useChartSound();
  const activeIndex = MODES.findIndex((m) => m.key === activeMode);
  const [tabWidth, setTabWidth] = useState(0);
  const indicatorX = useSharedValue(0);

  const onContainerLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = (e.nativeEvent.layout.width - INDICATOR_INSET * 2) / MODES.length;
      setTabWidth(w);
      indicatorX.value = activeIndex * w;
    },
    [activeIndex, indicatorX],
  );

  const handlePress = useCallback(
    (mode: ChartMode, index: number) => {
      playTap();
      indicatorX.value = withSpring(index * tabWidth, {
        damping: 20,
        stiffness: 220,
      });
      onModeChange(mode);
    },
    [indicatorX, onModeChange, playTap, tabWidth],
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View style={styles.container} onLayout={onContainerLayout}>
      <Animated.View
        style={[
          styles.indicator,
          { width: tabWidth, left: INDICATOR_INSET },
          indicatorStyle,
        ]}
      />
      {MODES.map((mode, index) => {
        const isActive = mode.key === activeMode;
        return (
          <Pressable
            key={mode.key}
            style={styles.tab}
            onPress={() => handlePress(mode.key, index)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Animated.Text
              style={[styles.label, isActive && styles.labelActive]}
            >
              {mode.label}
            </Animated.Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.full,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.routePink,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    zIndex: 1,
  },
  label: {
    fontFamily: Typography.fonts.bodyMedium,
    fontSize: Typography.sizes.sm,
    color: Colors.muted,
  },
  labelActive: {
    color: Colors.white,
    fontFamily: Typography.fonts.bodySemiBold,
  },
});
