/**
 * ConcentricRing - Animated concentric calorie + macro rings
 * Outer ring: calories, inner rings: protein, carbs, fat
 * Built with react-native-svg + reanimated
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
import { Colors } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface RingConfig {
  progress: number; // 0 to 1+
  color: string;
  trackColor: string;
  radius: number;
  strokeWidth: number;
}

interface ConcentricRingProps {
  calorieProgress: number;   // consumed / goal
  proteinProgress: number;
  carbsProgress: number;
  fatProgress: number;
  size?: number;
  centerContent?: React.ReactNode;
}

function AnimatedRing({
  progress,
  color,
  trackColor,
  radius,
  strokeWidth,
  cx,
  cy,
}: RingConfig & { cx: number; cy: number }) {
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

  // Determine ring color based on progress percentage
  let ringColor = color;
  if (progress >= 1.1) {
    ringColor = '#E57373'; // Soft red at 110%+
  } else if (progress >= 0.9) {
    ringColor = Colors.yellow; // Amber at 90-110%
  }

  return (
    <>
      {/* Track */}
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Progress */}
      <AnimatedCircle
        cx={cx}
        cy={cy}
        r={radius}
        stroke={ringColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        animatedProps={animatedProps}
        rotation={-90}
        origin={`${cx}, ${cy}`}
      />
    </>
  );
}

export function ConcentricRing({
  calorieProgress,
  proteinProgress,
  carbsProgress,
  fatProgress,
  size = 200,
  centerContent,
}: ConcentricRingProps) {
  const cx = size / 2;
  const cy = size / 2;

  // Ring specs (outer to inner)
  const outerStroke = 12;
  const innerStroke = 8;
  const gap = 6;

  const outerRadius = (size - outerStroke) / 2;
  const ring2Radius = outerRadius - outerStroke / 2 - gap - innerStroke / 2;
  const ring3Radius = ring2Radius - innerStroke - gap;
  const ring4Radius = ring3Radius - innerStroke - gap;

  // Constrain center content to innermost ring
  const centerSize = Math.max(0, (ring4Radius - innerStroke / 2) * 2);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Outer: Calories */}
        <AnimatedRing
          progress={calorieProgress}
          color={Colors.olive}
          trackColor={Colors.border}
          radius={outerRadius}
          strokeWidth={outerStroke}
          cx={cx}
          cy={cy}
        />

        {/* Inner 1: Protein */}
        <AnimatedRing
          progress={proteinProgress}
          color={Colors.brownMid}
          trackColor={Colors.border}
          radius={ring2Radius}
          strokeWidth={innerStroke}
          cx={cx}
          cy={cy}
        />

        {/* Inner 2: Carbs */}
        <AnimatedRing
          progress={carbsProgress}
          color={Colors.yellow}
          trackColor={Colors.border}
          radius={ring3Radius}
          strokeWidth={innerStroke}
          cx={cx}
          cy={cy}
        />

        {/* Inner 3: Fat */}
        <AnimatedRing
          progress={fatProgress}
          color={Colors.oliveMid}
          trackColor={Colors.border}
          radius={ring4Radius}
          strokeWidth={innerStroke}
          cx={cx}
          cy={cy}
        />
      </Svg>

      {/* Center content overlay - constrained to innermost ring */}
      {centerContent && (
        <View style={[styles.center, { width: size, height: size }]}>
          <View style={{ width: centerSize, height: centerSize, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
            {centerContent}
          </View>
        </View>
      )}
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
});
