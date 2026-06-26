/**
 * HydrationJar — SVG jar/bottle silhouette with animated water fill.
 *
 * The jar has a narrower neck and rounded body, rendered as an SVG path.
 * Water fill rises from the bottom clipped to the jar's shape.
 * A gentle wave animation plays at the water surface.
 */

import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { Colors, Spacing } from '@/constants/theme';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface HydrationJarProps {
  /** 0–1 fill fraction */
  progress: number;
  /** Callback when the jar is tapped */
  onPress?: () => void;
  /** Primary label, e.g. "1.2L / 2.5L" */
  label: string;
  /** Secondary label, e.g. "Tap to log water" */
  sublabel?: string;
}

// Jar path: narrower neck, rounded body (~38×132 viewport)
// We draw a mason-jar-style silhouette
const JAR_WIDTH = 46;
const JAR_HEIGHT = 120;
const JAR_VIEWBOX = `0 0 ${JAR_WIDTH} ${JAR_HEIGHT}`;

// The jar outline path — narrower neck at top, wider rounded body
const JAR_PATH = [
  'M 15 4',           // top-left of rim
  'L 31 4',           // top-right of rim
  'Q 33 4 33 6',      // rim corner
  'L 33 10',          // right side of neck
  'Q 33 14 37 18',    // neck-to-body curve right
  'Q 44 24 44 36',    // body bulge right top
  'L 44 96',          // right side body
  'Q 44 116 23 116',  // bottom-right curve
  'Q 2 116 2 96',     // bottom-left curve
  'L 2 36',           // left side body
  'Q 2 24 9 18',      // body bulge left top
  'Q 13 14 13 10',    // neck-to-body curve left
  'L 13 6',           // left side of neck
  'Q 13 4 15 4',      // rim corner left
  'Z',
].join(' ');

export function HydrationJar({
  progress,
  onPress,
  label,
  sublabel,
}: HydrationJarProps) {
  const clampedProgress = Math.min(1, Math.max(0, progress));

  // Animate fill height
  const fillHeight = useSharedValue(0);

  useEffect(() => {
    fillHeight.value = withTiming(clampedProgress, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [clampedProgress, fillHeight]);

  // Gentle horizontal wave oscillation
  const waveOffset = useSharedValue(0);
  useEffect(() => {
    waveOffset.value = withRepeat(
      withTiming(4, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [waveOffset]);

  // The water fill rect rises from bottom of jar
  // Jar body runs roughly from y=18 to y=116 (height ~98)
  const BODY_TOP = 18;
  const BODY_BOTTOM = 116;
  const BODY_HEIGHT = BODY_BOTTOM - BODY_TOP;

  const fillAnimatedProps = useAnimatedProps(() => {
    const h = fillHeight.value * BODY_HEIGHT;
    return {
      y: BODY_BOTTOM - h,
      height: h,
      x: waveOffset.value - 2,
    };
  });

  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View style={styles.jarWrap}>
        <Svg width={JAR_WIDTH} height={JAR_HEIGHT} viewBox={JAR_VIEWBOX}>
          <Defs>
            <ClipPath id="jarClip">
              <Path d={JAR_PATH} />
            </ClipPath>
          </Defs>

          {/* Background fill inside jar */}
          <Rect
            x={0}
            y={0}
            width={JAR_WIDTH}
            height={JAR_HEIGHT}
            fill="rgba(77,142,255,0.06)"
            clipPath="url(#jarClip)"
          />

          {/* Animated water fill */}
          <AnimatedRect
            width={JAR_WIDTH + 4}
            fill="rgba(77,142,255,0.45)"
            clipPath="url(#jarClip)"
            animatedProps={fillAnimatedProps}
          />

          {/* Jar outline */}
          <Path
            d={JAR_PATH}
            stroke={Colors.blue}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
          />
        </Svg>
      </View>

      <ThemedText variant="bodySemiBold" color={Colors.blue} align="center">
        {label}
      </ThemedText>
      {sublabel && (
        <ThemedText variant="label" color={Colors.muted} align="center">
          {sublabel}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 92,
    backgroundColor: Colors.white,
    borderRadius: 24,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  jarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
