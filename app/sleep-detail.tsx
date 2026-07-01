/**
 * Sleep detail — full-screen replacement for the old bottom sheet.
 * Shows last-7-night bar chart, the current schedule, inline time editing,
 * and Save / Log actions. Reached from the Sleep card tap on Home.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { ScrollWheelPicker, PICKER_GREEN } from '@/components/ui/ScrollWheelPicker';
import { format12h, formatDuration } from '@/components/ui/StepsSleepRow';
import { useAuthStore } from '@/stores/auth.store';
import { useActivityStore } from '@/stores/activity.store';
import { supabase } from '@/lib/supabase';
import { logSupabaseError } from '@/lib/supabaseError';
import { Typography } from '@/constants/theme';

const CREAM = '#F7F4EE';
const SLEEP_COLOR = '#6366F1';
const SLEEP_TINT = '#EEF0FF';

interface NightRow {
  date: string;
  minutes: number;
}

export default function SleepDetailScreen() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const {
    lastNightSleep,
    regularSleepTime,
    regularWakeTime,
    sleepGoalHours,
    updateSleepSchedule,
    editAndConfirmSleep,
  } = useActivityStore();

  const initSleepHHMM = lastNightSleep ? formatHHMM(lastNightSleep.sleepTime) : regularSleepTime;
  const initWakeHHMM = lastNightSleep ? formatHHMM(lastNightSleep.wakeTime) : regularWakeTime;

  const [sleepHHMM, setSleepHHMM] = useState(initSleepHHMM);
  const [wakeHHMM, setWakeHHMM] = useState(initWakeHHMM);
  const [editing, setEditing] = useState<'sleep' | 'wake' | null>(null);
  const [history, setHistory] = useState<NightRow[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('sleep_logs')
        .select('date, duration_minutes')
        .eq('user_id', userId)
        .gte('date', start.toISOString().split('T')[0])
        .order('date', { ascending: true });
      if (error) {
        logSupabaseError('sleep_logs.select(history)', error);
        return;
      }
      const map = new Map<string, number>();
      (data ?? []).forEach((row: { date: string; duration_minutes: number }) =>
        map.set(row.date, row.duration_minutes),
      );
      const nights: NightRow[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        nights.push({ date: key, minutes: map.get(key) ?? 0 });
      }
      setHistory(nights);
    })();
  }, [userId]);

  const duration = useMemo(() => computeDuration(sleepHHMM, wakeHHMM), [sleepHHMM, wakeHHMM]);

  const avgMinutes = useMemo(() => {
    const logged = history.filter((n) => n.minutes > 0);
    if (logged.length === 0) return 0;
    return Math.round(logged.reduce((sum, n) => sum + n.minutes, 0) / logged.length);
  }, [history]);

  const goalMinutes = Math.round(sleepGoalHours * 60);

  const saveSchedule = useCallback(async () => {
    if (!userId) return;
    Haptics.selectionAsync();
    await updateSleepSchedule(userId, sleepHHMM, wakeHHMM);
  }, [userId, sleepHHMM, wakeHHMM, updateSleepSchedule]);

  const logTonight = useCallback(async () => {
    if (!userId) return;
    Haptics.selectionAsync();
    const today = new Date();
    const [sh, sm] = sleepHHMM.split(':').map(Number);
    const [wh, wm] = wakeHHMM.split(':').map(Number);
    const sleepTime = new Date(today);
    sleepTime.setDate(sleepTime.getDate() - 1);
    sleepTime.setHours(sh, sm, 0, 0);
    const wakeTime = new Date(today);
    wakeTime.setHours(wh, wm, 0, 0);
    await editAndConfirmSleep(userId, sleepTime, wakeTime);
    router.back();
  }, [userId, sleepHHMM, wakeHHMM, editAndConfirmSleep]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#5a4f45" />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Sleep</ThemedText>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(240)} style={styles.hero}>
          <View style={styles.moonWrap}>
            <Ionicons name="moon" size={22} color={SLEEP_COLOR} />
          </View>
          <ThemedText style={styles.bigNumber}>
            {lastNightSleep ? formatDuration(lastNightSleep.durationMinutes) : 'Not logged'}
          </ThemedText>
          <ThemedText style={styles.subLabel}>Last night</ThemedText>
        </Animated.View>

        <View style={styles.statsRow}>
          <StatCol label="7-day avg" value={avgMinutes ? formatDuration(avgMinutes) : '—'} />
          <StatCol label="Goal" value={`${sleepGoalHours}h`} />
          <StatCol
            label="Nights logged"
            value={`${history.filter((n) => n.minutes > 0).length}/7`}
          />
        </View>

        <SectionTitle title="Last 7 nights" />
        <View style={styles.chartCard}>
          <SleepChart nights={history} goalMinutes={goalMinutes} />
        </View>

        <SectionTitle title={lastNightSleep ? 'Edit last night' : 'Log last night'} />
        <View style={styles.sleepTimeRow}>
          <TimeButton
            icon="moon"
            color={SLEEP_COLOR}
            label="Sleep time"
            time={sleepHHMM}
            onPress={() => setEditing(editing === 'sleep' ? null : 'sleep')}
            active={editing === 'sleep'}
          />
          <TimeButton
            icon="sunny"
            color="#F59E0B"
            label="Wake time"
            time={wakeHHMM}
            onPress={() => setEditing(editing === 'wake' ? null : 'wake')}
            active={editing === 'wake'}
          />
        </View>

        {editing && (
          <TimePickerInline
            value={editing === 'sleep' ? sleepHHMM : wakeHHMM}
            onChange={(v) => (editing === 'sleep' ? setSleepHHMM(v) : setWakeHHMM(v))}
          />
        )}

        <View style={styles.durationRow}>
          <ThemedText style={styles.durationValue}>{formatDuration(duration)}</ThemedText>
          <ThemedText style={styles.durationLabel}>Sleep duration</ThemedText>
        </View>

        <View style={styles.recommend}>
          <Ionicons name="information-circle-outline" size={14} color="#15803d" />
          <ThemedText style={styles.recommendText}>
            7-9 hours is the recommended amount for adults from age 18-64.
          </ThemedText>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.outlineButton} onPress={saveSchedule}>
            <ThemedText style={styles.outlineButtonText}>Save as my schedule</ThemedText>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={logTonight}>
            <ThemedText style={styles.primaryButtonText}>
              {lastNightSleep ? 'Update' : 'Log last night'}
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Small bits ──────────────────────────────────────────────── */

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

function TimeButton({
  icon,
  color,
  label,
  time,
  onPress,
  active,
}: {
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  color: string;
  label: string;
  time: string;
  onPress: () => void;
  active: boolean;
}) {
  return (
    <Pressable style={[styles.timeButton, active && styles.timeButtonActive]} onPress={onPress}>
      <View style={styles.timeButtonHeader}>
        <Ionicons name={icon} size={16} color={color} />
        <ThemedText style={styles.timeButtonLabel}>{label}</ThemedText>
      </View>
      <ThemedText style={styles.timeButtonValue}>{format12h(time)}</ThemedText>
      <ThemedText style={styles.timeButtonEdit}>{active ? 'Done' : 'Edit'}</ThemedText>
    </Pressable>
  );
}

function TimePickerInline({
  value,
  onChange,
}: {
  value: string;
  onChange: (hhmm: string) => void;
}) {
  const [h, m] = value.split(':').map(Number);
  return (
    <View style={styles.timePicker}>
      <View style={{ flex: 1 }}>
        <ScrollWheelPicker
          min={0}
          max={23}
          value={h}
          onChange={(nh) => onChange(`${pad(nh)}:${pad(m)}`)}
          fontSize={36}
          itemHeight={56}
          visibleItems={5}
          unit="h"
        />
      </View>
      <View style={{ flex: 1 }}>
        <ScrollWheelPicker
          min={0}
          max={55}
          step={5}
          value={Math.round(m / 5) * 5}
          onChange={(nm) => onChange(`${pad(h)}:${pad(nm)}`)}
          fontSize={36}
          itemHeight={56}
          visibleItems={5}
          unit="m"
        />
      </View>
    </View>
  );
}

/* ─── Chart ───────────────────────────────────────────────────── */

function SleepChart({ nights, goalMinutes }: { nights: NightRow[]; goalMinutes: number }) {
  const chartWidth = 320;
  const chartHeight = 160;
  const padX = 24;
  const padY = 22;
  const plotW = chartWidth - padX * 2;
  const plotH = chartHeight - padY * 2;

  const maxMinutes = Math.max(
    ...nights.map((n) => n.minutes),
    goalMinutes + 60,
    600, // 10h floor for scale
  );
  const barWidth = plotW / nights.length - 4;

  const goalY = padY + plotH - (goalMinutes / maxMinutes) * plotH;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={chartWidth} height={chartHeight}>
        {/* Goal line */}
        <Line
          x1={padX}
          y1={goalY}
          x2={chartWidth - padX}
          y2={goalY}
          stroke="#c2b7a8"
          strokeWidth={1}
          strokeDasharray="4,4"
        />
        <SvgText
          x={chartWidth - padX}
          y={goalY - 4}
          fontSize={10}
          fill="#8a7e74"
          textAnchor="end"
        >
          Goal
        </SvgText>

        {nights.map((n, i) => {
          const h = (n.minutes / maxMinutes) * plotH;
          const x = padX + i * (barWidth + 4) + 2;
          const y = padY + plotH - h;
          const hit = n.minutes >= goalMinutes;
          return (
            <Rect
              key={n.date}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(2, h)}
              rx={4}
              fill={hit ? SLEEP_COLOR : '#c7cbf0'}
              opacity={n.minutes === 0 ? 0.25 : 1}
            />
          );
        })}

        {/* Day labels */}
        {nights.map((n, i) => {
          const x = padX + i * (barWidth + 4) + 2 + barWidth / 2;
          const dayLetter = new Date(n.date)
            .toLocaleDateString(undefined, { weekday: 'short' })
            .slice(0, 1);
          return (
            <SvgText
              key={n.date + '-l'}
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

/* ─── Helpers ─────────────────────────────────────────────────── */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatHHMM(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function computeDuration(sleepHHMM: string, wakeHHMM: string): number {
  const [sh, sm] = sleepHHMM.split(':').map(Number);
  const [wh, wm] = wakeHHMM.split(':').map(Number);
  let mins = wh * 60 + wm - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return mins;
}

/* ─── Styles ──────────────────────────────────────────────────── */

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
  moonWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SLEEP_TINT,
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
  },

  sleepTimeRow: { flexDirection: 'row', gap: 10 },
  timeButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    gap: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  timeButtonActive: { borderColor: PICKER_GREEN },
  timeButtonHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeButtonLabel: {
    fontSize: 12,
    color: '#8a7e74',
    fontFamily: Typography.fonts.bodyMedium,
  },
  timeButtonValue: {
    fontSize: 20,
    color: '#2F241E',
    fontFamily: Typography.fonts.bodySemiBold,
  },
  timeButtonEdit: {
    fontSize: 12,
    color: PICKER_GREEN,
    fontFamily: Typography.fonts.bodyMedium,
  },
  timePicker: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },

  durationRow: { alignItems: 'center', marginTop: 6 },
  durationValue: {
    fontSize: 26,
    color: '#2F241E',
    fontFamily: Typography.fonts.headingBold,
  },
  durationLabel: { fontSize: 12, color: '#8a7e74' },

  recommend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e9f5ec',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recommendText: { flex: 1, fontSize: 12, color: '#15803d', lineHeight: 17 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
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
