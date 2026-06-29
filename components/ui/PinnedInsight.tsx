/**
 * Pinned coach insights on Home — up to 3 stacked cards, most recent on top.
 * Renders nothing when the user has no pins.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { useCoachStore, type PinnedInsightState } from '@/stores/coach.store';
import { trackEvent } from '@/lib/telemetry';

const COACH_BLUE = '#3D8BFF';

export function PinnedInsight() {
  const pinnedInsights = useCoachStore((s) => s.pinnedInsights);
  const unpinInsight = useCoachStore((s) => s.unpinInsight);

  if (pinnedInsights.length === 0) return null;

  const sorted = [...pinnedInsights].sort((a, b) => b.pinnedAt - a.pinnedAt);

  return (
    <View style={styles.stack}>
      {sorted.map((pin) => (
        <PinnedCard
          key={pin.fromMessageId}
          pin={pin}
          onDismiss={() => {
            trackEvent('coach_pinned_dismissed');
            unpinInsight(pin.fromMessageId);
          }}
        />
      ))}
    </View>
  );
}

function PinnedCard({ pin, onDismiss }: { pin: PinnedInsightState; onDismiss: () => void }) {
  const handleOpen = () => {
    trackEvent('coach_pinned_opened');
    router.push('/coach' as any);
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
        {pin.text}
      </ThemedText>
      <View style={styles.actions}>
        <Pressable onPress={handleOpen} hitSlop={8}>
          <ThemedText variant="labelSmall" color={COACH_BLUE} style={styles.actionText}>
            Open
          </ThemedText>
        </Pressable>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <ThemedText variant="labelSmall" color="#8a7e74" style={styles.actionText}>
            Dismiss
          </ThemedText>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 8,
  },
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
