/**
 * "Coach is thinking" — three dots pulsing in sequence inside a chat-bubble
 * shape that matches the assistant-message style. ~1.2s loop.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const CYCLE_MS = 1200;
const STEP_MS = 400; // each dot's up-down half-cycle
const STAGGER_MS = 200;
const DOT_MIN_OPACITY = 0.4;
const DOT_MAX_OPACITY = 1.0;

function useDotStyle(delayMs: number) {
  const opacity = useSharedValue(DOT_MIN_OPACITY);

  useEffect(() => {
    opacity.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(DOT_MAX_OPACITY, {
            duration: STEP_MS,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(DOT_MIN_OPACITY, {
            duration: CYCLE_MS - STEP_MS,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        false,
      ),
    );
  }, [delayMs, opacity]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: 0.7 + opacity.value * 0.3 }],
  }));
}

export function TypingIndicator() {
  const dot1 = useDotStyle(0);
  const dot2 = useDotStyle(STAGGER_MS);
  const dot3 = useDotStyle(STAGGER_MS * 2);

  return (
    <View style={styles.bubble}>
      <Animated.View style={[styles.dot, dot1]} />
      <Animated.View style={[styles.dot, dot2]} />
      <Animated.View style={[styles.dot, dot3]} />
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f7f2ea',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8a7e74',
  },
});
