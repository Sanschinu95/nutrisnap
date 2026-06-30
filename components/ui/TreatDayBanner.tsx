/**
 * Treat-day banner on Home. Three states:
 *   - hidden (nothing to show)
 *   - "waiting" — unlocked but not used; warm golden card
 *   - "active"  — already activated today; brighter celebration card
 * Tapping navigates to the dedicated treat-day screen.
 */

import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { useTreatDayStore } from '@/stores/treatDay.store';
import { Typography } from '@/constants/theme';

export function TreatDayBanner() {
  const available = useTreatDayStore((s) => s.availableTreatDay);
  const activeToday = useTreatDayStore((s) => s.activeTreatDayToday);

  const expiresInDays = useMemo(() => {
    if (!available?.expires_at) return null;
    const ms = new Date(available.expires_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }, [available?.expires_at]);

  const onPress = () => {
    Haptics.selectionAsync();
    router.push('/treat-day' as any);
  };

  if (activeToday) {
    return (
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)}>
        <Pressable style={[styles.card, styles.cardActive]} onPress={onPress}>
          <View style={styles.iconWrap}>
            <ThemedText style={styles.emoji}>🎉</ThemedText>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.titleActive}>Today is your treat day</ThemedText>
            <ThemedText style={styles.subtitle}>
              Calories still count, but no judgment today.
            </ThemedText>
          </View>
          <ThemedText style={styles.cta}>See suggestions</ThemedText>
        </Pressable>
      </Animated.View>
    );
  }

  if (available) {
    return (
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)}>
        <Pressable style={styles.card} onPress={onPress}>
          <View style={styles.iconWrap}>
            <ThemedText style={styles.emoji}>🎁</ThemedText>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.title}>Treat day waiting</ThemedText>
            <ThemedText style={styles.subtitle}>Tap when you're ready to enjoy it.</ThemedText>
            {expiresInDays !== null && expiresInDays <= 3 && (
              <ThemedText style={styles.expires}>
                {expiresInDays === 0
                  ? 'Expires today'
                  : `Expires in ${expiresInDays} ${expiresInDays === 1 ? 'day' : 'days'}`}
              </ThemedText>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color="#8a7e74" />
        </Pressable>
      </Animated.View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF3E2',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F5E0B6',
  },
  cardActive: {
    backgroundColor: '#FBE9C4',
    borderColor: '#F9D589',
    padding: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 18 },
  title: {
    fontSize: 16,
    color: '#2F241E',
    fontFamily: Typography.fonts.serif,
    fontWeight: '500',
  },
  titleActive: {
    fontSize: 18,
    color: '#2F241E',
    fontFamily: Typography.fonts.serif,
    fontWeight: '500',
  },
  subtitle: { fontSize: 12, color: '#8a7e74', marginTop: 2 },
  expires: { fontSize: 11, color: '#c2410c', marginTop: 4, fontFamily: Typography.fonts.bodyMedium },
  cta: {
    fontSize: 12,
    color: '#92400e',
    fontFamily: Typography.fonts.bodySemiBold,
  },
});
