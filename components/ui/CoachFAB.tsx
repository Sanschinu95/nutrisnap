/**
 * Floating coach button — bottom-right, where the green scan FAB used to live.
 * Big, blue, prominent. Coach is the premium feature, so it gets the FAB slot.
 */

import { Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { trackEvent } from '@/lib/telemetry';

export const COACH_BLUE = '#3D8BFF';
const FAB_SIZE = 56;

interface CoachFABProps {
  /** Hide on screens where it shouldn't appear (matches old scan FAB's isHome). */
  hidden?: boolean;
}

export function CoachFAB({ hidden = false }: CoachFABProps) {
  if (hidden) return null;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    trackEvent('coach_opened', { source: 'fab' });
    router.push('/coach' as any);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(300).springify().damping(14)}
      exiting={FadeOut.duration(200)}
      style={styles.container}
    >
      <Animated.View entering={ZoomIn.duration(400).springify().damping(12)}>
        <Pressable
          onPress={handlePress}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          accessibilityLabel="Open nutrition coach"
          accessibilityRole="button"
        >
          <Ionicons name="chatbubble-ellipses" size={26} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -FAB_SIZE + 12,
    right: -48,
    zIndex: 10,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: COACH_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COACH_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.93 }],
  },
});
