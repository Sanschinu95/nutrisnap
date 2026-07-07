/**
 * Streak card on Home — three visual states:
 *   - empty:    "Start a streak today"      (no streak yet)
 *   - active:   shows count + progress to next milestone + grace marker
 *   - at-risk:  same as active but warm tint + "Log now" prompt after 6pm
 * Tapping opens app/streak-detail.tsx.
 */

import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { useStreakStore } from '@/stores/streak.store';
import {
  getNextMilestone,
  getPreviousMilestoneDays,
} from '@/lib/streakMilestones';
import { Typography } from '@/constants/theme';

const PRIMARY_GREEN = '#22C55E';
const WARM_TINT = '#FFF5E8';

export function StreakCard() {
  const currentStreak = useStreakStore((s) => s.currentStreak);
  const graceDaysUsed = useStreakStore((s) => s.graceDaysUsed);
  const isAtRisk = useStreakStore((s) => s.isStreakAtRisk());

  const next = useMemo(() => getNextMilestone(currentStreak), [currentStreak]);
  const previous = useMemo(() => getPreviousMilestoneDays(currentStreak), [currentStreak]);

  const recentGrace = useMemo(() => {
    const today = Date.now();
    return graceDaysUsed
      .map((d) => ({ date: d, age: Math.floor((today - new Date(d).getTime()) / 86_400_000) }))
      .filter((g) => g.age >= 0 && g.age <= 7)
      .sort((a, b) => a.age - b.age)
      .map((g) => g.date)[0];
  }, [graceDaysUsed]);

  const navigateDetail = () => {
    Haptics.selectionAsync();
    router.push('/streak-detail' as any);
  };

  const openScan = () => {
    Haptics.selectionAsync();
    router.push('/(tabs)/camera' as any);
  };

  if (currentStreak === 0) {
    return (
      <Animated.View entering={FadeIn.duration(220)}>
        <Pressable style={styles.emptyCard} onPress={openScan}>
          <Ionicons name="flame-outline" size={28} color="#8a7e74" />
          <ThemedText style={styles.emptyTitle}>Start a streak today</ThemedText>
          <ThemedText style={styles.emptySub}>Log a meal and the count begins.</ThemedText>
        </Pressable>
      </Animated.View>
    );
  }

  const span = next ? next.days - previous : 1;
  const progressed = next ? currentStreak - previous : 1;
  const progressFrac = next ? Math.min(1, Math.max(0, progressed / span)) : 1;

  return (
    <Animated.View entering={FadeIn.duration(220)}>
      <Pressable
        style={[styles.card, isAtRisk && styles.cardAtRisk]}
        onPress={navigateDetail}
      >
        <View style={styles.headerRow}>
          <Ionicons name="flame" size={16} color="#E8703A" />
          <ThemedText style={styles.label}>Current streak</ThemedText>
        </View>

        <View style={styles.numberRow}>
          <ThemedText style={styles.bigNumber}>{currentStreak}</ThemedText>
          <ThemedText style={styles.dayWord}>{currentStreak === 1 ? 'day' : 'days'}</ThemedText>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressFrac * 100}%`,
                backgroundColor: next ? next.badgeColors[1] : PRIMARY_GREEN,
              },
            ]}
          />
        </View>
        <ThemedText style={styles.progressLabel}>
          {next
            ? `${next.days - currentStreak} ${next.days - currentStreak === 1 ? 'day' : 'days'} to ${next.name}`
            : "You've passed every milestone. Keep going."}
        </ThemedText>

        {recentGrace && (
          <ThemedText style={styles.graceText}>
            🛡️ Grace day used on {formatDayName(recentGrace)}
          </ThemedText>
        )}

        {isAtRisk && (
          <View style={styles.riskRow}>
            <ThemedText style={styles.riskText}>
              Don't break your {currentStreak}-day streak. Log something today.
            </ThemedText>
            <Pressable style={styles.riskButton} onPress={openScan}>
              <ThemedText style={styles.riskButtonText}>Log now</ThemedText>
            </Pressable>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function formatDayName(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'long' });
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    gap: 8,
    shadowColor: '#2F241E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardAtRisk: {
    backgroundColor: WARM_TINT,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 12, color: '#8a7e74', fontFamily: Typography.fonts.bodyMedium },

  numberRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  bigNumber: {
    fontSize: 36,
    color: '#2F241E',
    fontFamily: Typography.fonts.headingBold,
    fontWeight: '500',
  },
  dayWord: { fontSize: 14, color: '#8a7e74' },

  progressTrack: {
    height: 4,
    backgroundColor: '#efe9e0',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabel: { fontSize: 12, color: '#8a7e74' },
  graceText: { fontSize: 11, color: '#8a7e74', marginTop: 2 },

  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  riskText: { flex: 1, fontSize: 12, color: '#c2410c', lineHeight: 17 },
  riskButton: {
    backgroundColor: '#E8703A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  riskButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: Typography.fonts.bodySemiBold,
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e8e2d6',
    borderStyle: 'dashed',
    padding: 18,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 18,
    color: '#2F241E',
    fontFamily: Typography.fonts.headingBold,
    fontWeight: '500',
    marginTop: 4,
  },
  emptySub: { fontSize: 13, color: '#8a7e74' },
});
