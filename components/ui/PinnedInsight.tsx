/**
 * Pinned coach insight card rendered on Home. Only mounts when the user has
 * pinned a coach ACTION; otherwise renders nothing.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { useCoachStore } from '@/stores/coach.store';
import { trackEvent } from '@/lib/telemetry';

const COACH_BLUE = '#3D8BFF';

export function PinnedInsight() {
  const pinnedInsight = useCoachStore((s) => s.pinnedInsight);
  const unpinInsight = useCoachStore((s) => s.unpinInsight);

  if (!pinnedInsight) return null;

  const handleOpen = () => {
    trackEvent('coach_pinned_opened');
    router.push('/coach' as any);
  };

  const handleDismiss = () => {
    trackEvent('coach_pinned_dismissed');
    unpinInsight();
  };

  return (
    <Animated.View
      entering={FadeIn.duration(280)}
      exiting={FadeOut.duration(220)}
      style={styles.card}
    >
      <ThemedText variant="labelSmall" color={COACH_BLUE} style={styles.label}>
        📌 Coach insight
      </ThemedText>
      <ThemedText variant="body" color="#2F241E" style={styles.body}>
        {pinnedInsight.text}
      </ThemedText>
      <View style={styles.actions}>
        <Pressable onPress={handleOpen} hitSlop={8}>
          <ThemedText variant="labelSmall" color={COACH_BLUE} style={styles.actionText}>
            Open
          </ThemedText>
        </Pressable>
        <Pressable onPress={handleDismiss} hitSlop={8}>
          <ThemedText variant="labelSmall" color="#8a7e74" style={styles.actionText}>
            Dismiss
          </ThemedText>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    paddingLeft: 16,
    borderLeftWidth: 3,
    borderLeftColor: COACH_BLUE,
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
  body: {
    fontSize: 13,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 2,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
