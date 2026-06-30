/**
 * Streak detail — hero number, stats row, milestone badges (locked/unlocked),
 * last-30-days heatmap, and a consistency message. Reachable from the Home
 * StreakCard tap.
 */

import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Defs, LinearGradient, Polygon, Stop } from 'react-native-svg';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { useStreakStore } from '@/stores/streak.store';
import { useAuthStore } from '@/stores/auth.store';
import { supabase } from '@/lib/supabase';
import { logSupabaseError } from '@/lib/supabaseError';
import { MILESTONES, type Milestone } from '@/lib/streakMilestones';
import { Typography } from '@/constants/theme';

const CREAM = '#F7F4EE';
const PRIMARY_GREEN = '#22C55E';

export default function StreakDetailScreen() {
  const currentStreak = useStreakStore((s) => s.currentStreak);
  const longestStreak = useStreakStore((s) => s.longestStreak);
  const graceDaysUsed = useStreakStore((s) => s.graceDaysUsed);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [last30, setLast30] = useState<{ date: string; logged: boolean }[]>([]);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

  // Pull last 30 days of meal activity.
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const start = new Date();
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('meals')
        .select('occurred_at_utc')
        .eq('user_id', userId)
        .gte('occurred_at_utc', start.toISOString());
      if (error) {
        logSupabaseError('meals.select(last30)', error);
        return;
      }
      const loggedDates = new Set(
        (data ?? []).map((row: { occurred_at_utc: string }) =>
          new Date(row.occurred_at_utc).toISOString().split('T')[0],
        ),
      );
      const days: { date: string; logged: boolean }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        days.push({ date: key, logged: loggedDates.has(key) });
      }
      setLast30(days);
    })();
  }, [userId]);

  const thisWeekLogged = useMemo(() => {
    if (last30.length === 0) return 0;
    return last30.slice(-7).filter((d) => d.logged).length;
  }, [last30]);

  const graceLeftThisWeek = useMemo(() => {
    const today = Date.now();
    const usedThisWeek = graceDaysUsed.filter((iso) => {
      const age = Math.floor((today - new Date(iso).getTime()) / 86_400_000);
      return age >= 0 && age <= 7;
    });
    return Math.max(0, 1 - usedThisWeek.length);
  }, [graceDaysUsed]);

  const consistencyMsg = useMemo(() => {
    if (currentStreak < 3) return 'Every streak starts with one day.';
    if (currentStreak < 7) return "You're building momentum.";
    if (currentStreak < 14) return "A week of showing up. That's not nothing.";
    if (currentStreak < 30) return "You're past the hardest part.";
    return 'This is who you are now.';
  }, [currentStreak]);

  const openScan = () => {
    Haptics.selectionAsync();
    router.push('/(tabs)/camera' as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#5a4f45" />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Streak</ThemedText>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {currentStreak === 0 ? (
          <Animated.View entering={FadeIn.duration(220)} style={styles.emptyHero}>
            <Ionicons name="flame-outline" size={56} color="#8a7e74" />
            <ThemedText style={styles.emptyTitle}>Your story starts with one meal</ThemedText>
            <Pressable style={styles.primaryButton} onPress={openScan}>
              <ThemedText style={styles.primaryButtonText}>Scan a meal</ThemedText>
            </Pressable>
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(240)} style={styles.hero}>
              <Ionicons name="flame" size={24} color="#E8703A" />
              <ThemedText style={styles.bigNumber}>{currentStreak} days</ThemedText>
              <ThemedText style={styles.subLabel}>Current streak</ThemedText>
            </Animated.View>

            <View style={styles.statsRow}>
              <StatCol label="Longest" value={`${longestStreak}`} />
              <StatCol label="This week" value={`${thisWeekLogged}/7`} />
              <StatCol label="Grace days left" value={`${graceLeftThisWeek}`} />
            </View>

            <SectionTitle title="Milestones" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.milestonesRow}
            >
              {MILESTONES.map((m) => (
                <Pressable
                  key={m.days}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedMilestone(m);
                  }}
                  style={styles.milestoneCell}
                >
                  <HexBadge milestone={m} unlocked={currentStreak >= m.days} />
                  <ThemedText style={styles.milestoneCaption}>Day {m.days}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            <SectionTitle title="Last 30 days" />
            <View style={styles.heatmap}>
              {last30.map((d, i) => {
                const isGrace = graceDaysUsed.includes(d.date);
                const tone = d.logged ? PRIMARY_GREEN : isGrace ? '#fcd34d' : '#efe9e0';
                return (
                  <View key={d.date + i} style={[styles.heatmapDot, { backgroundColor: tone }]} />
                );
              })}
            </View>

            <ThemedText style={styles.consistency}>{consistencyMsg}</ThemedText>
          </>
        )}
      </ScrollView>

      {selectedMilestone && (
        <Modal transparent animationType="fade" onRequestClose={() => setSelectedMilestone(null)}>
          <Pressable style={styles.modalOverlay} onPress={() => setSelectedMilestone(null)}>
            <View style={styles.milestoneModal}>
              <HexBadge milestone={selectedMilestone} unlocked />
              <ThemedText style={styles.modalTitle}>{selectedMilestone.name}</ThemedText>
              <ThemedText style={styles.modalDesc}>{selectedMilestone.description}</ThemedText>
              <ThemedText style={styles.modalReward}>“{selectedMilestone.rewardText}”</ThemedText>
            </View>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <ThemedText style={styles.sectionTitle}>{title}</ThemedText>;
}

function StatCol({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCol}>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
    </View>
  );
}

function HexBadge({ milestone, unlocked }: { milestone: Milestone; unlocked: boolean }) {
  const size = 72;
  const r = size / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  const polygon = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const gradId = `g-${milestone.days}-${unlocked ? 'on' : 'off'}`;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={unlocked ? milestone.badgeColors[0] : '#d4cabe'} stopOpacity="1" />
            <Stop offset="1" stopColor={unlocked ? milestone.badgeColors[1] : '#a8a095'} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Polygon points={polygon} fill={`url(#${gradId})`} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
      </Svg>
      <ThemedText style={{ fontSize: 26, opacity: unlocked ? 1 : 0.5 }}>
        {unlocked ? milestone.emoji : '🔒'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CREAM },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    color: '#2F241E',
    fontFamily: Typography.fonts.bodySemiBold,
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 20 },

  hero: { alignItems: 'center', gap: 4, paddingTop: 12 },
  bigNumber: {
    fontSize: 64,
    fontFamily: Typography.fonts.serif,
    fontWeight: '500',
    color: '#2F241E',
    lineHeight: 70,
  },
  subLabel: { fontSize: 14, color: '#8a7e74' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
  },
  statCol: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: {
    fontSize: 18,
    color: '#2F241E',
    fontFamily: Typography.fonts.serif,
    fontWeight: '500',
  },
  statLabel: {
    fontSize: 11,
    color: '#8a7e74',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  sectionTitle: {
    fontSize: 18,
    fontFamily: Typography.fonts.serif,
    fontWeight: '500',
    color: '#2F241E',
  },
  milestonesRow: { gap: 14, paddingVertical: 4, paddingHorizontal: 2 },
  milestoneCell: { alignItems: 'center', gap: 4 },
  milestoneCaption: { fontSize: 11, color: '#8a7e74' },

  heatmap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  heatmapDot: { width: 24, height: 24, borderRadius: 7 },

  consistency: {
    fontSize: 14,
    color: '#5a4f45',
    fontStyle: 'italic',
    fontFamily: Typography.fonts.serif,
    textAlign: 'center',
    paddingHorizontal: 12,
  },

  emptyHero: { alignItems: 'center', gap: 12, paddingTop: 60 },
  emptyTitle: {
    fontSize: 22,
    fontFamily: Typography.fonts.serif,
    fontWeight: '500',
    color: '#2F241E',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: PRIMARY_GREEN,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: Typography.fonts.bodySemiBold,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  milestoneModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: Typography.fonts.serif,
    fontWeight: '500',
    color: '#2F241E',
  },
  modalDesc: { fontSize: 13, color: '#8a7e74', textAlign: 'center' },
  modalReward: {
    fontSize: 14,
    fontFamily: Typography.fonts.serif,
    fontStyle: 'italic',
    color: '#5a4f45',
    textAlign: 'center',
    marginTop: 4,
  },
});
