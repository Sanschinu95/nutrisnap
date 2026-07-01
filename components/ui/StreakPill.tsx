/**
 * Compact streak indicator that sits inline with the week-row flame dots at
 * the top of Home. Tap → streak detail. Loss-aversion still triggers a warm
 * tint after 6pm when the streak is at risk.
 */

import { Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ui/ThemedText';
import { useStreakStore } from '@/stores/streak.store';
import { Typography } from '@/constants/theme';

export function StreakPill() {
  const currentStreak = useStreakStore((s) => s.currentStreak);
  const atRisk = useStreakStore((s) => s.isStreakAtRisk());

  const onPress = () => {
    Haptics.selectionAsync();
    router.push('/streak-detail' as any);
  };

  return (
    <Pressable
      style={[styles.pill, atRisk && styles.pillAtRisk]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        currentStreak === 0
          ? 'Start a streak'
          : `${currentStreak}-day streak, tap for details`
      }
    >
      <Ionicons
        name={currentStreak === 0 ? 'flame-outline' : 'flame'}
        size={16}
        color={atRisk ? '#c2410c' : currentStreak === 0 ? '#8a7e74' : '#E8703A'}
      />
      <ThemedText style={[styles.count, atRisk && { color: '#c2410c' }]}>
        {currentStreak}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECE6DE',
  },
  pillAtRisk: {
    backgroundColor: '#FFF5E8',
    borderColor: '#F5D4B8',
  },
  count: {
    fontSize: 13,
    color: '#2F241E',
    fontFamily: Typography.fonts.bodySemiBold,
  },
});
