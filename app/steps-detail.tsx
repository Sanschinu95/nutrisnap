/**
 * Steps detail — full-screen replacement for the old bottom sheet.
 * Shows today's total, last-7-day bar chart, distance / active-min / calorie
 * estimates, and an editable step goal.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { ScrollWheelPicker, PICKER_GREEN } from '@/components/ui/ScrollWheelPicker';
import { useAuthStore } from '@/stores/auth.store';
import { useActivityStore } from '@/stores/activity.store';
import { supabase } from '@/lib/supabase';
import { logSupabaseError } from '@/lib/supabaseError';
import { Typography } from '@/constants/theme';

const CREAM = '#F7F4EE';
const STEPS_COLOR = '#E8703A';
const STEPS_TINT = '#FFF1EA';

interface DayRow {
  date: string;
  count: number;
}

export default function StepsDetailScreen() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { todaySteps, stepGoal, setStepGoal } = useActivityStore();
  const [history, setHistory] = useState<DayRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [tmpGoal, setTmpGoal] = useState(stepGoal);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('steps_logs')
        .select('date, step_count')
        .eq('user_id', userId)
        .gte('date', start.toISOString().split('T')[0])
        .order('date', { ascending: true });
      if (error) {
        logSupabaseError('steps_logs.select(history)', error);
        return;
      }
      const map = new Map<string, number>();
      (data ?? []).forEach((row: { date: string; step_count: number }) =>
        map.set(row.date, row.step_count),
      );
      const days: DayRow[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        days.push({ date: key, count: map.get(key) ?? 0 });
      }
      // Overwrite today with the live count from the activity store.
      if (days.length > 0) days[days.length - 1].count = Math.max(days[days.length - 1].count, todaySteps);
      setHistory(days);
    })();
  }, [userId, todaySteps]);

  const distanceKm = useMemo(() => (todaySteps * 0.762) / 1000, [todaySteps]);
  const activeMin = useMemo(() => Math.round(todaySteps / 100), [todaySteps]);
  const calories = useMemo(() => Math.round(todaySteps * 0.04), [todaySteps]);
  const weeklyAvg = useMemo(() => {
    const withData = history.filter((d) => d.count > 0);
    if (withData.length === 0) return 0;
    return Math.round(withData.reduce((s, d) => s + d.count, 0) / withData.length);
  }, [history]);
  const hitDays = useMemo(() => history.filter((d) => d.count >= stepGoal).length, [history, stepGoal]);

  const saveGoal = async () => {
    if (!userId) return;
    Haptics.selectionAsync();
    await setStepGoal(userId, tmpGoal);
    setEditing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#5a4f45" />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Steps</ThemedText>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(240)} style={styles.hero}>
          <View style={styles.iconWrap}>
            <Ionicons name="footsteps" size={22} color={STEPS_COLOR} />
          </View>
          <ThemedText style={styles.bigNumber}>{todaySteps.toLocaleString()}</ThemedText>
          <ThemedText style={styles.subLabel}>of {stepGoal.toLocaleString()} today</ThemedText>
        </Animated.View>

        <View style={styles.statsRow}>
          <StatCol label="Distance" value={`${distanceKm.toFixed(2)} km`} />
          <StatCol label="Active min" value={`${activeMin}`} />
          <StatCol label="Calories" value={`${calories}`} />
        </View>

        <SectionTitle title="Last 7 days" />
        <View style={styles.chartCard}>
          <StepsChart days={history} goal={stepGoal} />
          <View style={styles.chartFooter}>
            <ThemedText style={styles.chartSummary}>
              7-day avg {weeklyAvg.toLocaleString()}
            </ThemedText>
            <ThemedText style={styles.chartSummaryMuted}>
              {hitDays}/7 days at goal
            </ThemedText>
          </View>
        </View>

        <SectionTitle title="Daily step goal" />
        {editing ? (
          <View style={{ gap: 12 }}>
            <View style={styles.pickerCard}>
              <ScrollWheelPicker
                min={1000}
                max={30000}
                step={500}
                value={tmpGoal}
                onChange={setTmpGoal}
                unit="steps"
                fontSize={32}
                itemHeight={60}
                visibleItems={5}
              />
            </View>
            <View style={styles.actions}>
              <Pressable
                style={styles.outlineButton}
                onPress={() => {
                  setTmpGoal(stepGoal);
                  setEditing(false);
                }}
              >
                <ThemedText style={styles.outlineButtonText}>Cancel</ThemedText>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={saveGoal}>
                <ThemedText style={styles.primaryButtonText}>Save goal</ThemedText>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            style={styles.goalCard}
            onPress={() => {
              Haptics.selectionAsync();
              setTmpGoal(stepGoal);
              setEditing(true);
            }}
          >
            <ThemedText style={styles.goalValue}>{stepGoal.toLocaleString()}</ThemedText>
            <ThemedText style={styles.goalEdit}>Edit</ThemedText>
          </Pressable>
        )}
      </ScrollView>
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

function StepsChart({ days, goal }: { days: DayRow[]; goal: number }) {
  const chartWidth = 320;
  const chartHeight = 160;
  const padX = 24;
  const padY = 22;
  const plotW = chartWidth - padX * 2;
  const plotH = chartHeight - padY * 2;

  const maxCount = Math.max(...days.map((d) => d.count), goal * 1.2, 5000);
  const barWidth = plotW / days.length - 4;
  const goalY = padY + plotH - (goal / maxCount) * plotH;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={chartWidth} height={chartHeight}>
        <Line
          x1={padX}
          y1={goalY}
          x2={chartWidth - padX}
          y2={goalY}
          stroke="#c2b7a8"
          strokeWidth={1}
          strokeDasharray="4,4"
        />
        <SvgText x={chartWidth - padX} y={goalY - 4} fontSize={10} fill="#8a7e74" textAnchor="end">
          Goal
        </SvgText>

        {days.map((d, i) => {
          const h = (d.count / maxCount) * plotH;
          const x = padX + i * (barWidth + 4) + 2;
          const y = padY + plotH - h;
          const hit = d.count >= goal;
          return (
            <Rect
              key={d.date}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(2, h)}
              rx={4}
              fill={hit ? STEPS_COLOR : '#f0b48f'}
              opacity={d.count === 0 ? 0.25 : 1}
            />
          );
        })}

        {days.map((d, i) => {
          const x = padX + i * (barWidth + 4) + 2 + barWidth / 2;
          const dayLetter = new Date(d.date)
            .toLocaleDateString(undefined, { weekday: 'short' })
            .slice(0, 1);
          return (
            <SvgText
              key={d.date + '-l'}
              x={x}
              y={chartHeight - 4}
              fontSize={10}
              fill="#8a7e74"
              textAnchor="middle"
            >
              {dayLetter}
            </SvgText>
          );
        })}
      </Svg>
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
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    color: '#2F241E',
    fontFamily: Typography.fonts.bodySemiBold,
  },

  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 18 },

  hero: { alignItems: 'center', gap: 4, paddingTop: 8 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: STEPS_TINT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  bigNumber: {
    fontSize: 44,
    color: '#2F241E',
    fontFamily: Typography.fonts.headingBold,
    lineHeight: 52,
  },
  subLabel: { fontSize: 13, color: '#8a7e74' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
  },
  statCol: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: {
    fontSize: 16,
    color: '#2F241E',
    fontFamily: Typography.fonts.bodySemiBold,
  },
  statLabel: {
    fontSize: 11,
    color: '#8a7e74',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  sectionTitle: {
    fontSize: 16,
    color: '#2F241E',
    fontFamily: Typography.fonts.bodySemiBold,
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  chartSummary: {
    fontSize: 13,
    color: '#2F241E',
    fontFamily: Typography.fonts.bodySemiBold,
  },
  chartSummaryMuted: { fontSize: 12, color: '#8a7e74' },

  goalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalValue: {
    fontSize: 22,
    color: '#2F241E',
    fontFamily: Typography.fonts.bodySemiBold,
  },
  goalEdit: {
    color: PICKER_GREEN,
    fontSize: 13,
    fontFamily: Typography.fonts.bodySemiBold,
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
  },

  actions: { flexDirection: 'row', gap: 10 },
  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: PICKER_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Typography.fonts.bodySemiBold,
  },
  outlineButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4cabe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButtonText: {
    color: '#5a4f45',
    fontSize: 14,
    fontFamily: Typography.fonts.bodySemiBold,
  },
});
