/**
 * CalorieRing — single thick animated progress ring.
 *
 * Displays one metric at a time (calories or a macro) with a bold
 * center value. The parent controls *which* metric is shown via
 * props — this component is purely presentational.
 */

import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { Colors } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CalorieRingProps {
  /** 0-1+ progress fraction (consumed / goal) */
  progress: number;
  /** Label shown above the center value */
  centerLabel: string;
  /** Bold center value (e.g. "1,420" or "42g") */
  centerValue: string;
  /** Ring fill color */
  ringColor?: string;
  /** Track (background) color */
  trackColor?: string;
  /** Overall diameter */
  size?: number;
  /** Ring stroke thickness */
  strokeWidth?: number;
}

export function CalorieRing({
  progress,
  centerLabel,
  centerValue,
  ringColor = Colors.olive,
  trackColor = Colors.border,
  size = 210,
  strokeWidth = 16,
}: CalorieRingProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animProgress = useSharedValue(0);

  useEffect(() => {
    animProgress.value = withTiming(Math.min(progress, 1.15), {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, animProgress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animProgress.value),
  }));

  // Color shifts at thresholds
  let fillColor = ringColor;
  if (progress >= 1.1) {
    fillColor = '#E57373'; // Soft red at 110%+
  } else if (progress >= 0.9) {
    fillColor = Colors.yellow; // Amber at 90-110%
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={fillColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          rotation={-90}
          origin={`${cx}, ${cy}`}
        />
      </Svg>

      {/* Center content */}
      <View style={styles.center}>
        <ThemedText variant="label" color={Colors.muted} align="center">
          {centerLabel}
        </ThemedText>
        <ThemedText
          variant="h1"
          style={styles.value}
          align="center"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {centerValue}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    fontSize: 34,
    lineHeight: 40,
  },
});
