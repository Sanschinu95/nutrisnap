/**
 * HydrationJar — SVG jar/bottle silhouette with animated water fill.
 *
 * Supports a horizontal multi-jar mode: once daily target is met, completed
 * jars stack to the left and the partially-filled current jar is on the right.
 * A +250ml (or other amount) floating label animates upward on each tap.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ui/ThemedText';
import { Colors, Spacing } from '@/constants/theme';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface HydrationJarProps {
  /** Total ml the user has logged today */
  totalMl: number;
  /** Daily target in ml */
  targetMl: number;
  /** Quick-add amount in ml — shown as the floating "+Xml" label */
  quickAddMl: number;
  /** Callback when the jar is tapped */
  onPress?: () => void;
  /** Primary label, e.g. "1.2L / 2.5L" */
  label: string;
  /** Secondary label, e.g. "Tap to log water" */
  sublabel?: string;
}

// Jar path: narrower neck, rounded body (~46×120 viewport)
const JAR_WIDTH = 46;
const JAR_HEIGHT = 120;
const JAR_VIEWBOX = `0 0 ${JAR_WIDTH} ${JAR_HEIGHT}`;
const JAR_PATH = [
  'M 15 4',
  'L 31 4',
  'Q 33 4 33 6',
  'L 33 10',
  'Q 33 14 37 18',
  'Q 44 24 44 36',
  'L 44 96',
  'Q 44 116 23 116',
  'Q 2 116 2 96',
  'L 2 36',
  'Q 2 24 9 18',
  'Q 13 14 13 10',
  'L 13 6',
  'Q 13 4 15 4',
  'Z',
].join(' ');

const BODY_TOP = 18;
const BODY_BOTTOM = 116;
const BODY_HEIGHT = BODY_BOTTOM - BODY_TOP;

const HYDRATION_BLUE = '#5FA8FF';

interface FloatingLabel {
  id: number;
  amount: number;
}

export function HydrationJar({
  totalMl,
  targetMl,
  quickAddMl,
  onPress,
  label,
  sublabel,
}: HydrationJarProps) {
  const safeTarget = targetMl > 0 ? targetMl : 1;
  const bottlesFilled = Math.floor(totalMl / safeTarget);
  const currentFill = (totalMl % safeTarget) / safeTarget;
  const showMulti = totalMl >= safeTarget && bottlesFilled >= 1;

  const [labels, setLabels] = useState<FloatingLabel[]>([]);
  const nextLabelId = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  const removeLabel = useCallback((id: number) => {
    setLabels((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const handlePress = useCallback(() => {
    const id = nextLabelId.current++;
    setLabels((prev) => [...prev, { id, amount: quickAddMl }]);
    onPress?.();
  }, [onPress, quickAddMl]);

  // Auto-scroll to the rightmost (current) jar when the count changes
  useEffect(() => {
    if (!showMulti) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [showMulti, bottlesFilled]);

  const jars = useMemo(() => {
    if (!showMulti) {
      // Single jar mode (most common)
      return [{ progress: Math.min(1, totalMl / safeTarget), complete: false, key: 'single' }];
    }
    const list: { progress: number; complete: boolean; key: string }[] = [];
    for (let i = 0; i < bottlesFilled; i++) {
      list.push({ progress: 1, complete: true, key: `full-${i}` });
    }
    list.push({ progress: currentFill, complete: false, key: 'current' });
    return list;
  }, [showMulti, totalMl, safeTarget, bottlesFilled, currentFill]);

  const renderJar = (progress: number, complete: boolean, size: number) => (
    <JarSvg progress={progress} complete={complete} sizeFactor={size} />
  );

  const containerInner = showMulti ? (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.multiScrollContent}
    >
      {jars.map((j, i) => (
        <View key={j.key} style={[styles.jarWrap, i > 0 && { marginLeft: 12 }]}>
          {renderJar(j.progress, j.complete, 0.8)}
        </View>
      ))}
    </ScrollView>
  ) : (
    <View style={styles.jarWrap}>{renderJar(jars[0].progress, jars[0].complete, 1)}</View>
  );

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      <View style={styles.jarStage} pointerEvents="box-none">
        {containerInner}
        {labels.map((l) => (
          <FloatingPlus key={l.id} amount={l.amount} onDone={() => removeLabel(l.id)} />
        ))}
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

/* ─── Single jar SVG ─────────────────────────────────────────── */

function JarSvg({
  progress,
  complete,
  sizeFactor,
}: {
  progress: number;
  complete: boolean;
  sizeFactor: number;
}) {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const width = JAR_WIDTH * sizeFactor;
  const height = JAR_HEIGHT * sizeFactor;

  const fillHeight = useSharedValue(0);
  useEffect(() => {
    fillHeight.value = withTiming(clampedProgress, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [clampedProgress, fillHeight]);

  const waveOffset = useSharedValue(0);
  useEffect(() => {
    waveOffset.value = withRepeat(
      withTiming(4, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [waveOffset]);

  const fillAnimatedProps = useAnimatedProps(() => {
    const h = fillHeight.value * BODY_HEIGHT;
    return {
      y: BODY_BOTTOM - h,
      height: h,
      x: waveOffset.value - 2,
    };
  });

  return (
    <View>
      <Svg width={width} height={height} viewBox={JAR_VIEWBOX}>
        <Defs>
          <ClipPath id={`jarClip-${sizeFactor}`}>
            <Path d={JAR_PATH} />
          </ClipPath>
        </Defs>

        <Rect
          x={0}
          y={0}
          width={JAR_WIDTH}
          height={JAR_HEIGHT}
          fill="rgba(77,142,255,0.06)"
          clipPath={`url(#jarClip-${sizeFactor})`}
        />

        <AnimatedRect
          width={JAR_WIDTH + 4}
          fill={complete ? 'rgba(77,142,255,0.65)' : 'rgba(77,142,255,0.45)'}
          clipPath={`url(#jarClip-${sizeFactor})`}
          animatedProps={fillAnimatedProps}
        />

        <Path
          d={JAR_PATH}
          stroke={Colors.blue}
          strokeWidth={2}
          fill="none"
          strokeLinejoin="round"
        />
      </Svg>
      {complete && (
        <View style={styles.completeBadge}>
          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}

/* ─── Floating "+250ml" label ─────────────────────────────────── */

function FloatingPlus({ amount, onDone }: { amount: number; onDone: () => void }) {
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(-40, { duration: 800, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(
      0,
      { duration: 800, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onDone)();
      },
    );
  }, [opacity, translateY, onDone]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.floatingLabel, animatedStyle]}>
      <ThemedText style={styles.floatingText}>{`+${amount}ml`}</ThemedText>
    </Animated.View>
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
  jarStage: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: JAR_HEIGHT,
  },
  jarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  completeBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: HYDRATION_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  floatingLabel: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    pointerEvents: 'none',
  },
  floatingText: {
    fontSize: 16,
    fontWeight: '500',
    color: HYDRATION_BLUE,
  },
});
