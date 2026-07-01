/**
 * Pair of cards under the macro pills on Home: Steps (left) + Sleep (right).
 * Tapping either routes to the corresponding full-screen detail
 * (`/steps-detail`, `/sleep-detail`). The morning prompt's "Edit" bumps
 * `sleepSheetOpenRequest` on the activity store — this component watches
 * for an increment and routes to the sleep detail.
 */

import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ui/ThemedText';
import { useActivityStore } from '@/stores/activity.store';
import { Colors, Typography } from '@/constants/theme';

const STEPS_COLOR = '#E8703A';
const SLEEP_COLOR = '#6366F1';
const SLEEP_TINT = '#EEF0FF';
const STEPS_TINT = '#FFF1EA';

export function StepsSleepRow() {
  const {
    todaySteps,
    stepGoal,
    stepPermissionGranted,
    lastNightSleep,
    sleepGoalHours,
    sleepSheetOpenRequest,
  } = useActivityStore();

  // Route on ACTUAL request increments only. A useEffect that just checks
  // `sleepSheetOpenRequest > 0` also fires on remount, which would open the
  // detail screen every time Home re-renders.
  const lastSeenRequestRef = useRef(sleepSheetOpenRequest);
  useEffect(() => {
    if (sleepSheetOpenRequest > lastSeenRequestRef.current) {
      lastSeenRequestRef.current = sleepSheetOpenRequest;
      router.push('/sleep-detail' as any);
    }
  }, [sleepSheetOpenRequest]);

  const stepProgress = stepGoal > 0 ? Math.min(1, todaySteps / stepGoal) : 0;
  const sleepDuration = lastNightSleep?.durationMinutes ?? 0;
  const sleepGoalMin = Math.round(sleepGoalHours * 60);
  const sleepProgress = sleepGoalMin > 0 ? Math.min(1, sleepDuration / sleepGoalMin) : 0;

  const openSteps = useCallback(() => {
    Haptics.selectionAsync();
    router.push('/steps-detail' as any);
  }, []);

  const openSleep = useCallback(() => {
    Haptics.selectionAsync();
    router.push('/sleep-detail' as any);
  }, []);

  return (
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
            <ThemedText style={styles.cardEmptyValue} numberOfLines={1} adjustsFontSizeToFit>
              Not logged
            </ThemedText>
            <ThemedText style={styles.cardSub}>Tap to log</ThemedText>
          </>
        )}
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${sleepProgress * 100}%`, backgroundColor: SLEEP_COLOR }]} />
        </View>
      </Pressable>
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

export function format12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${pad(m)} ${period}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
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
  cardValueMuted: { color: '#8a7e74' },
  /** Smaller than cardValue so "Not logged" doesn't clip against the card edge. */
  cardEmptyValue: {
    fontSize: 16,
    color: '#8a7e74',
    fontFamily: Typography.fonts.bodySemiBold,
  },
  cardSub: { fontSize: 11, color: '#8a7e74' },
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
});
