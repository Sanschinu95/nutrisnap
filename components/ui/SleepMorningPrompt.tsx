/**
 * Morning prompt: "Did you sleep at X and wake up at Y?" Shows on Home only
 * when the user hasn't logged sleep yet today and we're in the morning
 * window. Tap Yes for a one-tap log, Edit to open the sleep sheet.
 */

import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { PICKER_GREEN } from '@/components/ui/ScrollWheelPicker';
import { format12h } from '@/components/ui/StepsSleepRow';
import { useShallow } from 'zustand/react/shallow';
import { useActivityStore } from '@/stores/activity.store';
import { useAuthStore } from '@/stores/auth.store';
import { useUserStore } from '@/stores/user.store';
import { Typography } from '@/constants/theme';

interface Props {
  onEdit: () => void;
}

export function SleepMorningPrompt({ onEdit }: Props) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const profile = useUserStore((s) => s.profile);
  const {
    sleepConfirmationPending,
    regularSleepTime,
    regularWakeTime,
    confirmLastNightSleep,
    dismissSleepPrompt,
  } = useActivityStore(
    useShallow((s) => ({
      sleepConfirmationPending: s.sleepConfirmationPending,
      regularSleepTime: s.regularSleepTime,
      regularWakeTime: s.regularWakeTime,
      confirmLastNightSleep: s.confirmLastNightSleep,
      dismissSleepPrompt: s.dismissSleepPrompt,
    })),
  );

  const handleYes = useCallback(async () => {
    if (!userId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await confirmLastNightSleep(userId);
  }, [userId, confirmLastNightSleep]);

  const handleEdit = useCallback(() => {
    Haptics.selectionAsync();
    dismissSleepPrompt();
    onEdit();
  }, [dismissSleepPrompt, onEdit]);

  if (!sleepConfirmationPending) return null;
  const firstName = profile?.name?.split(' ')[0] ?? 'there';

  return (
    <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(200)} style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="sunny" size={16} color="#F59E0B" />
        <ThemedText style={styles.title}>Good morning, {firstName}</ThemedText>
      </View>
      <ThemedText style={styles.body}>
        Did you sleep at {format12h(regularSleepTime)} and wake up at {format12h(regularWakeTime)}?
      </ThemedText>
      <View style={styles.actions}>
        <Pressable style={styles.primary} onPress={handleYes}>
          <ThemedText style={styles.primaryText}>Yes, that's right</ThemedText>
        </Pressable>
        <Pressable style={styles.outline} onPress={handleEdit}>
          <ThemedText style={styles.outlineText}>Edit</ThemedText>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FBF7F0',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#F5E8D2',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 14, color: '#2F241E', fontFamily: Typography.fonts.bodySemiBold },
  body: { fontSize: 13, color: '#5a4f45', lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  primary: {
    flex: 1,
    backgroundColor: PICKER_GREEN,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: Typography.fonts.bodySemiBold,
  },
  outline: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d4cabe',
    alignItems: 'center',
  },
  outlineText: {
    color: '#5a4f45',
    fontSize: 13,
    fontFamily: Typography.fonts.bodySemiBold,
  },
});
