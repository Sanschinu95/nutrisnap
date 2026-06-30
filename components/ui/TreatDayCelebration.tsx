/**
 * Full-screen celebration overlay shown the first time a treat day appears.
 * Two outcomes: activate it now (transitions Home into treat-day mode) or
 * save it for later (banner stays on Home).
 */

import { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { useTreatDayStore } from '@/stores/treatDay.store';
import { useAuthStore } from '@/stores/auth.store';
import { trackEvent } from '@/lib/telemetry';
import { Typography } from '@/constants/theme';

const PRIMARY_GREEN = '#22C55E';

export function TreatDayCelebration() {
  const justUnlocked = useTreatDayStore((s) => s.justUnlocked);
  const available = useTreatDayStore((s) => s.availableTreatDay);
  const markSeen = useTreatDayStore((s) => s.markUnlockSeen);
  const activate = useTreatDayStore((s) => s.activateToday);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  // Soft pulsing glow around the badge.
  const glow = useSharedValue(0.7);
  useEffect(() => {
    if (!justUnlocked) return;
    glow.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
  }, [glow, justUnlocked]);

  useEffect(() => {
    if (justUnlocked) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      trackEvent('treat_day_unlocked', { reason: available?.unlock_reason ?? null });
    }
  }, [justUnlocked, available?.unlock_reason]);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.9 + glow.value * 0.2 }],
    opacity: 0.25 + glow.value * 0.35,
  }));

  if (!justUnlocked || !available) return null;
  const suggestions = (available.suggestions ?? []).slice(0, 3);

  const onSaveLater = async () => {
    Haptics.selectionAsync();
    trackEvent('treat_day_celebration_dismissed', { choice: 'save' });
    await markSeen();
  };

  const onUseToday = async () => {
    if (!userId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    trackEvent('treat_day_activated', { source: 'unlock_immediate' });
    await activate(userId);
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onSaveLater}>
      <View style={styles.overlay}>
        <Animated.View entering={FadeIn.duration(280)} style={styles.glowOuter}>
          <Animated.View style={[styles.glow, glowStyle]} />
          <Animated.View entering={FadeIn.delay(120).springify().damping(12)} style={styles.badge}>
            <ThemedText style={styles.badgeEmoji}>🎁</ThemedText>
          </Animated.View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).springify()} style={styles.header}>
          <ThemedText style={styles.title}>Treat Day Unlocked</ThemedText>
          <ThemedText style={styles.subtitle}>
            5 days of showing up. Time to enjoy something.
          </ThemedText>
        </Animated.View>

        {suggestions.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsRow}
            style={styles.suggestionsScroll}
          >
            {suggestions.map((s, i) => (
              <Animated.View
                key={s.name + i}
                entering={FadeInRight.delay(240 + i * 80).springify()}
                style={styles.suggestionCard}
              >
                <ThemedText style={styles.suggestionEmoji}>{s.emoji}</ThemedText>
                <ThemedText style={styles.suggestionName} numberOfLines={2}>
                  {s.name}
                </ThemedText>
              </Animated.View>
            ))}
          </ScrollView>
        )}

        <View style={styles.actions}>
          <Pressable style={styles.primaryButton} onPress={onUseToday}>
            <ThemedText style={styles.primaryButtonText}>Use it today</ThemedText>
          </Pressable>
          <Pressable style={styles.outlineButton} onPress={onSaveLater}>
            <ThemedText style={styles.outlineButtonText}>Save for later</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#FEF3E2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 22,
  },
  glowOuter: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 100,
    backgroundColor: '#F9D589',
  },
  badge: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#FBE9C4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F5C763',
  },
  badgeEmoji: { fontSize: 84 },
  header: { alignItems: 'center', gap: 8 },
  title: {
    fontSize: 32,
    fontFamily: Typography.fonts.serif,
    fontWeight: '500',
    color: '#2F241E',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8a7e74',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  suggestionsScroll: { maxHeight: 130 },
  suggestionsRow: { paddingHorizontal: 8, gap: 10, paddingVertical: 4 },
  suggestionCard: {
    width: 110,
    height: 110,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#F5E0B6',
  },
  suggestionEmoji: { fontSize: 32 },
  suggestionName: {
    fontSize: 11,
    color: '#2F241E',
    textAlign: 'center',
    fontFamily: Typography.fonts.bodyMedium,
  },
  actions: { alignSelf: 'stretch', gap: 10, marginTop: 4 },
  primaryButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: PRIMARY_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: Typography.fonts.bodySemiBold,
  },
  outlineButton: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4b87a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButtonText: {
    color: '#5a4f45',
    fontSize: 14,
    fontFamily: Typography.fonts.bodySemiBold,
  },
});
