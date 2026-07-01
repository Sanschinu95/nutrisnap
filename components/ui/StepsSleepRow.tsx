/**
 * Pair of cards under the macro pills on Home: Steps (left) + Sleep (right).
 * Tapping either opens a bottom sheet for details / editing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { ThemedText } from '@/components/ui/ThemedText';
import { ScrollWheelPicker, PICKER_GREEN } from '@/components/ui/ScrollWheelPicker';
import { useActivityStore } from '@/stores/activity.store';
import { useAuthStore } from '@/stores/auth.store';
import { Colors, Typography } from '@/constants/theme';

const STEPS_COLOR = '#E8703A';
const SLEEP_COLOR = '#6366F1';
const SLEEP_TINT = '#EEF0FF';
const STEPS_TINT = '#FFF1EA';

export function StepsSleepRow() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const {
    todaySteps,
    stepGoal,
    stepPermissionGranted,
    lastNightSleep,
    sleepGoalHours,
    sleepSheetOpenRequest,
    setStepGoal,
  } = useActivityStore();

  const [showSteps, setShowSteps] = useState(false);
  const [showSleep, setShowSleep] = useState(false);
  const stepsRef = useRef<BottomSheet>(null);
  const sleepRef = useRef<BottomSheet>(null);

  // External trigger (morning prompt's "Edit") to open the full-screen sleep detail.
  useEffect(() => {
    if (sleepSheetOpenRequest > 0) {
      router.push('/sleep-detail' as any);
    }
  }, [sleepSheetOpenRequest]);

  const stepProgress = stepGoal > 0 ? Math.min(1, todaySteps / stepGoal) : 0;
  const sleepDuration = lastNightSleep?.durationMinutes ?? 0;
  const sleepGoalMin = Math.round(sleepGoalHours * 60);
  const sleepProgress = sleepGoalMin > 0 ? Math.min(1, sleepDuration / sleepGoalMin) : 0;

  const openSteps = useCallback(() => {
    Haptics.selectionAsync();
    setShowSteps(true);
    requestAnimationFrame(() => stepsRef.current?.snapToIndex(0));
  }, []);

  const openSleep = useCallback(() => {
    Haptics.selectionAsync();
    router.push('/sleep-detail' as any);
  }, []);

  return (
    <View>
      <View style={styles.row}>
        <Pressable style={styles.card} onPress={openSteps}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: STEPS_TINT }]}>
              <Ionicons name="footsteps" size={14} color={STEPS_COLOR} />
            </View>
            <ThemedText style={styles.cardLabel}>Steps</ThemedText>
          </View>
          {stepPermissionGranted || todaySteps > 0 ? (
            <>
              <ThemedText style={styles.cardValue}>{todaySteps.toLocaleString()}</ThemedText>
              <ThemedText style={styles.cardSub}>of {stepGoal.toLocaleString()}</ThemedText>
            </>
          ) : (
            <>
              <ThemedText style={[styles.cardValue, styles.cardValueMuted]}>—</ThemedText>
              <ThemedText style={styles.cardSub}>Tap to enable</ThemedText>
            </>
          )}
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${stepProgress * 100}%`, backgroundColor: STEPS_COLOR }]} />
          </View>
        </Pressable>

        <Pressable style={styles.card} onPress={openSleep}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: SLEEP_TINT }]}>
              <Ionicons name="moon" size={14} color={SLEEP_COLOR} />
            </View>
            <ThemedText style={styles.cardLabel}>Sleep</ThemedText>
          </View>
          {lastNightSleep ? (
            <>
              <ThemedText style={styles.cardValue}>{formatDuration(sleepDuration)}</ThemedText>
              <ThemedText style={styles.cardSub}>of {sleepGoalHours.toFixed(0)}h goal</ThemedText>
            </>
          ) : (
            <>
              <ThemedText style={[styles.cardValue, styles.cardValueMuted]}>Not logged</ThemedText>
              <ThemedText style={styles.cardSub}>Tap to log</ThemedText>
            </>
          )}
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${sleepProgress * 100}%`, backgroundColor: SLEEP_COLOR }]} />
          </View>
        </Pressable>
      </View>

      {showSteps && (
        <BottomSheet
          ref={stepsRef}
          index={-1}
          snapPoints={['62%']}
          enablePanDownToClose
          onClose={() => setShowSteps(false)}
          backgroundStyle={{ backgroundColor: '#F7F4EE' }}
          handleIndicatorStyle={{ backgroundColor: '#c4b9ab', width: 36 }}
        >
          <BottomSheetView style={styles.sheet}>
            <StepsSheetBody
              steps={todaySteps}
              goal={stepGoal}
              onSaveGoal={async (g) => {
                if (userId) await setStepGoal(userId, g);
              }}
            />
          </BottomSheetView>
        </BottomSheet>
      )}

      {showSleep && (
        <BottomSheet
          ref={sleepRef}
          index={-1}
          snapPoints={['82%']}
          enablePanDownToClose
          onClose={() => setShowSleep(false)}
          backgroundStyle={{ backgroundColor: '#F7F4EE' }}
          handleIndicatorStyle={{ backgroundColor: '#c4b9ab', width: 36 }}
        >
          <BottomSheetView style={styles.sheet}>
            <SleepSheetBody onClose={() => sleepRef.current?.close()} />
          </BottomSheetView>
        </BottomSheet>
      )}
    </View>
  );
}

/* ─── Steps sheet ─────────────────────────────────────────────── */

function StepsSheetBody({
  steps,
  goal,
  onSaveGoal,
}: {
  steps: number;
  goal: number;
  onSaveGoal: (goal: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [tmpGoal, setTmpGoal] = useState(goal);

  const distanceKm = useMemo(() => (steps * 0.762) / 1000, [steps]);
  const activeMin = useMemo(() => Math.round(steps / 100), [steps]);
  const calories = useMemo(() => Math.round(steps * 0.04), [steps]);

  return (
    <View style={{ gap: 20 }}>
      <ThemedText style={styles.sheetTitle}>Steps today</ThemedText>

      <View style={{ alignItems: 'center', gap: 4 }}>
        <ThemedText style={styles.sheetBigNumber}>{steps.toLocaleString()}</ThemedText>
        <ThemedText style={styles.sheetSubLabel}>of {goal.toLocaleString()} goal</ThemedText>
      </View>

      <View style={styles.statsRow}>
        <StatCol label="Distance" value={`${distanceKm.toFixed(2)} km`} />
        <StatCol label="Active min" value={`${activeMin}`} />
        <StatCol label="Calories" value={`${calories}`} />
      </View>

      {editing ? (
        <View style={{ gap: 12 }}>
          <ThemedText style={styles.sheetSubLabel}>Set your daily step goal</ThemedText>
          <ScrollWheelPicker
            min={1000}
            max={30000}
            step={500}
            value={tmpGoal}
            onChange={setTmpGoal}
            unit="steps"
            fontSize={36}
            itemHeight={64}
            visibleItems={5}
          />
          <View style={styles.sheetActions}>
            <Pressable
              style={styles.outlineButton}
              onPress={() => {
                setEditing(false);
                setTmpGoal(goal);
              }}
            >
              <ThemedText style={styles.outlineButtonText}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              style={styles.primaryButton}
              onPress={async () => {
                Haptics.selectionAsync();
                await onSaveGoal(tmpGoal);
                setEditing(false);
              }}
            >
              <ThemedText style={styles.primaryButtonText}>Save goal</ThemedText>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setTmpGoal(goal);
            setEditing(true);
          }}
        >
          <ThemedText style={styles.linkButton}>Edit goal</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

/* ─── Sleep sheet ─────────────────────────────────────────────── */

function SleepSheetBody({ onClose }: { onClose: () => void }) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const {
    lastNightSleep,
    regularSleepTime,
    regularWakeTime,
    updateSleepSchedule,
    editAndConfirmSleep,
  } = useActivityStore();

  const initialSleep = lastNightSleep
    ? formatHHMM(lastNightSleep.sleepTime)
    : regularSleepTime;
  const initialWake = lastNightSleep
    ? formatHHMM(lastNightSleep.wakeTime)
    : regularWakeTime;

  const [sleepHHMM, setSleepHHMM] = useState(initialSleep);
  const [wakeHHMM, setWakeHHMM] = useState(initialWake);

  const [editing, setEditing] = useState<'sleep' | 'wake' | null>(null);

  const duration = computeDuration(sleepHHMM, wakeHHMM);

  const save = async (mode: 'log' | 'schedule') => {
    if (!userId) return;
    Haptics.selectionAsync();
    if (mode === 'schedule') {
      await updateSleepSchedule(userId, sleepHHMM, wakeHHMM);
    } else {
      const today = new Date();
      const [sh, sm] = sleepHHMM.split(':').map(Number);
      const [wh, wm] = wakeHHMM.split(':').map(Number);
      const sleepTime = new Date(today);
      sleepTime.setDate(sleepTime.getDate() - 1);
      sleepTime.setHours(sh, sm, 0, 0);
      const wakeTime = new Date(today);
      wakeTime.setHours(wh, wm, 0, 0);
      await editAndConfirmSleep(userId, sleepTime, wakeTime);
    }
    onClose();
  };

  return (
    <View style={{ gap: 18 }}>
      <ThemedText style={styles.sheetTitle}>
        {lastNightSleep ? 'Edit last night' : 'Sleep tracker'}
      </ThemedText>

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

      <View style={{ alignItems: 'center', gap: 2 }}>
        <ThemedText style={styles.sheetDuration}>{formatDuration(duration)}</ThemedText>
        <ThemedText style={styles.sheetSubLabel}>Sleep duration</ThemedText>
      </View>

      <View style={styles.recommendCard}>
        <Ionicons name="information-circle-outline" size={14} color="#15803d" />
        <ThemedText style={styles.recommendText}>
          7-9 hours is the recommended amount for adults from age 18-64.
        </ThemedText>
      </View>

      <View style={styles.sheetActions}>
        {!lastNightSleep && (
          <Pressable style={styles.outlineButton} onPress={() => save('schedule')}>
            <ThemedText style={styles.outlineButtonText}>Save as my schedule</ThemedText>
          </Pressable>
        )}
        <Pressable style={styles.primaryButton} onPress={() => save('log')}>
          <ThemedText style={styles.primaryButtonText}>
            {lastNightSleep ? 'Update' : 'Log last night'}
          </ThemedText>
        </Pressable>
      </View>
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
  icon: keyof typeof Ionicons.glyphMap;
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

function StatCol({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCol}>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
    </View>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────── */

export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0h 0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function computeDuration(sleepHHMM: string, wakeHHMM: string): number {
  const [sh, sm] = sleepHHMM.split(':').map(Number);
  const [wh, wm] = wakeHHMM.split(':').map(Number);
  let mins = wh * 60 + wm - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60; // wake next day
  return mins;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatHHMM(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function format12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${pad(m)} ${period}`;
}

/* ─── Styles ──────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 12,
    color: '#8a7e74',
    fontFamily: Typography.fonts.bodyMedium,
  },
  cardValue: {
    fontSize: 24,
    color: '#2F241E',
    fontFamily: Typography.fonts.headingBold,
  },
  cardValueMuted: {
    color: '#8a7e74',
  },
  cardSub: {
    fontSize: 11,
    color: '#8a7e74',
  },
  barTrack: {
    height: 3,
    backgroundColor: '#efe9e0',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 6,
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },

  sheet: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  sheetTitle: {
    fontSize: 22,
    fontFamily: Typography.fonts.serif,
    fontWeight: '500',
    color: '#2F241E',
  },
  sheetBigNumber: {
    fontSize: 48,
    fontFamily: Typography.fonts.serif,
    fontWeight: '500',
    color: '#2F241E',
  },
  sheetDuration: {
    fontSize: 28,
    fontFamily: Typography.fonts.serif,
    color: '#2F241E',
    fontWeight: '500',
  },
  sheetSubLabel: {
    fontSize: 13,
    color: '#8a7e74',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
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
  linkButton: {
    color: PICKER_GREEN,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 8,
    fontFamily: Typography.fonts.bodySemiBold,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  primaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: PICKER_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: Typography.fonts.bodySemiBold,
    fontSize: 14,
  },
  outlineButton: {
    flex: 1,
    height: 44,
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
  sleepTimeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timeButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    gap: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  timeButtonActive: {
    borderColor: PICKER_GREEN,
  },
  timeButtonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeButtonLabel: {
    fontSize: 12,
    color: '#8a7e74',
    fontFamily: Typography.fonts.bodyMedium,
  },
  timeButtonValue: {
    fontSize: 20,
    color: '#2F241E',
    fontFamily: Typography.fonts.serif,
    fontWeight: '500',
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
  recommendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e9f5ec',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recommendText: {
    flex: 1,
    fontSize: 12,
    color: '#15803d',
    lineHeight: 17,
  },
});
