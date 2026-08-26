/**
 * Notification settings — full control over the personality reminder system.
 * Every change persists (Supabase / AsyncStorage for guests) and reschedules
 * the OS notifications, debounced in the prefs store.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useShallow } from 'zustand/react/shallow';
import { ThemedText } from '@/components/ui/ThemedText';
import { ScrollWheelPicker } from '@/components/ui/ScrollWheelPicker';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth.store';
import { useUserStore } from '@/stores/user.store';
import { useNotificationPrefsStore } from '@/stores/notificationPrefs.store';
import type { NotificationPreferences } from '@/lib/notificationPrefs';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
} from '@/lib/notifications';
import {
  MAX_DAILY_NOTIFICATIONS,
  rescheduleAllPersonalityNotifications,
  sendTestNotification,
} from '@/lib/notificationScheduler';

type TimeField =
  | 'breakfast_time'
  | 'lunch_time'
  | 'snack_time'
  | 'dinner_time'
  | 'sleep_reminder_time'
  | 'quiet_hours_start'
  | 'quiet_hours_end';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function format12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(Number.isFinite(m) ? m : 0)} ${suffix}`;
}

function formatHour(hour: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${suffix}`;
}

export default function NotificationSettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const profile = useUserStore((s) => s.profile);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const { prefs, isLoaded, loadPrefs, updatePrefs, resetToDefaults } =
    useNotificationPrefsStore(
      useShallow((s) => ({
        prefs: s.prefs,
        isLoaded: s.isLoaded,
        loadPrefs: s.loadPrefs,
        updatePrefs: s.updatePrefs,
        resetToDefaults: s.resetToDefaults,
      })),
    );

  const [editingTime, setEditingTime] = useState<TimeField | null>(null);
  const [permission, setPermission] = useState<string>('granted');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadPrefs(user?.id ?? profile?.id ?? null);
    getNotificationPermissionStatus().then(setPermission);
  }, [loadPrefs, user?.id, profile?.id]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const setPref = useCallback(
    (updates: Partial<NotificationPreferences>) => {
      Haptics.selectionAsync();
      updatePrefs(updates);
    },
    [updatePrefs],
  );

  const handleEnableSystemPermission = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setPermission(granted ? 'granted' : 'denied');
    if (granted) {
      rescheduleAllPersonalityNotifications(
        useNotificationPrefsStore.getState().prefs,
      );
      showToast('Notifications enabled');
    } else {
      showToast('Enable notifications for Nyurix in system settings');
    }
  }, [showToast]);

  const handleTest = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await sendTestNotification();
    showToast('Sent — check your notification shade');
  }, [showToast]);

  const handleReset = useCallback(() => {
    Haptics.selectionAsync();
    resetToDefaults();
    showToast('Back to defaults');
  }, [resetToDefaults, showToast]);

  if (!isLoaded) {
    return <SafeAreaView style={styles.container} />;
  }

  const master = prefs.notifications_enabled;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.brown} />
        </Pressable>
        <ThemedText variant="bodySemiBold">Notifications</ThemedText>
        <View style={styles.iconButton} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {permission !== 'granted' && (
          <Pressable style={styles.permissionBanner} onPress={handleEnableSystemPermission}>
            <Ionicons name="notifications-off-outline" size={20} color={Colors.orange} />
            <View style={{ flex: 1 }}>
              <ThemedText variant="bodySemiBold">Notifications are off</ThemedText>
              <ThemedText variant="label" color={Colors.muted}>
                Tap to allow Nyurix to send warm reminders.
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
          </Pressable>
        )}

        {/* ── Master toggle ── */}
        <View style={styles.card}>
          <ToggleRow
            title="Notifications"
            subtitle="Warm reminders to keep you consistent"
            icon="notifications-outline"
            value={master}
            onChange={(v) => setPref({ notifications_enabled: v })}
            prominent
          />
        </View>

        {master && (
          <>
            {/* ── Categories ── */}
            <SectionTitle title="What I remind you about" />
            <View style={styles.card}>
              <ToggleRow
                title="Meal reminders"
                subtitle="Breakfast, lunch, snack, dinner"
                icon="restaurant-outline"
                value={prefs.meal_reminders_enabled}
                onChange={(v) => setPref({ meal_reminders_enabled: v })}
              />
              <ToggleRow
                title="Hydration reminders"
                subtitle="Small sips through the day"
                icon="water-outline"
                value={prefs.hydration_reminders_enabled}
                onChange={(v) => setPref({ hydration_reminders_enabled: v })}
              />
              <ToggleRow
                title="Sleep reminders"
                subtitle="Wind-down nudge and a morning check-in"
                icon="moon-outline"
                value={prefs.sleep_reminders_enabled}
                onChange={(v) => setPref({ sleep_reminders_enabled: v })}
              />
              <ToggleRow
                title="Streak protection"
                subtitle="An evening nudge when a 3+ day streak is at risk"
                icon="flame-outline"
                value={prefs.streak_reminders_enabled}
                onChange={(v) => {
                  // Mirror to the profile flag the streak store reads today.
                  setPref({ streak_reminders_enabled: v });
                  if (profile) updateProfile({ streak_reminders_enabled: v });
                }}
              />
              <ToggleRow
                title="Milestones"
                subtitle="'One more day to Day 7' and milestone celebrations"
                icon="trophy-outline"
                value={profile?.milestone_notifications_enabled !== false}
                onChange={(v) => {
                  Haptics.selectionAsync();
                  if (profile) updateProfile({ milestone_notifications_enabled: v });
                }}
              />
              <ToggleRow
                title="Encouragement"
                subtitle="A quiet 'nice work' after a fully-logged day"
                icon="heart-outline"
                value={prefs.encouragement_enabled}
                onChange={(v) => setPref({ encouragement_enabled: v })}
              />
              <ToggleRow
                title="Check-ins"
                subtitle="'Missed you' when a day slips by — never guilt"
                icon="chatbubble-ellipses-outline"
                value={prefs.checkin_enabled}
                onChange={(v) => setPref({ checkin_enabled: v })}
                last
              />
            </View>
            <ThemedText variant="label" color={Colors.muted} style={styles.footnote}>
              Nyurix keeps it to {MAX_DAILY_NOTIFICATIONS} scheduled reminders a day —
              meals and sleep first, water fills the rest. Warmth over frequency.
            </ThemedText>

            {/* ── Meal times ── */}
            {prefs.meal_reminders_enabled && (
              <>
                <SectionTitle title="Meal times" />
                <View style={styles.card}>
                  <TimeRow
                    label="Breakfast" icon="cafe-outline"
                    value={prefs.breakfast_time}
                    editing={editingTime === 'breakfast_time'}
                    onPress={() => setEditingTime(editingTime === 'breakfast_time' ? null : 'breakfast_time')}
                    onChange={(v) => setPref({ breakfast_time: v })}
                  />
                  <TimeRow
                    label="Lunch" icon="restaurant-outline"
                    value={prefs.lunch_time}
                    editing={editingTime === 'lunch_time'}
                    onPress={() => setEditingTime(editingTime === 'lunch_time' ? null : 'lunch_time')}
                    onChange={(v) => setPref({ lunch_time: v })}
                  />
                  <TimeRow
                    label="Snack" icon="pizza-outline"
                    value={prefs.snack_time}
                    editing={editingTime === 'snack_time'}
                    onPress={() => setEditingTime(editingTime === 'snack_time' ? null : 'snack_time')}
                    onChange={(v) => setPref({ snack_time: v })}
                  />
                  <TimeRow
                    label="Dinner" icon="moon-outline"
                    value={prefs.dinner_time}
                    editing={editingTime === 'dinner_time'}
                    onPress={() => setEditingTime(editingTime === 'dinner_time' ? null : 'dinner_time')}
                    onChange={(v) => setPref({ dinner_time: v })}
                    last
                  />
                </View>
              </>
            )}

            {/* ── Hydration ── */}
            {prefs.hydration_reminders_enabled && (
              <>
                <SectionTitle title="Hydration" />
                <View style={styles.card}>
                  <View style={styles.rowPadded}>
                    <ThemedText variant="bodyMedium">Remind me every</ThemedText>
                    <View style={styles.chipRow}>
                      {[1, 2, 3].map((h) => (
                        <Pressable
                          key={h}
                          style={[styles.chip, prefs.hydration_interval_hours === h && styles.chipActive]}
                          onPress={() => setPref({ hydration_interval_hours: h })}
                        >
                          <ThemedText
                            variant="bodySemiBold"
                            color={prefs.hydration_interval_hours === h ? Colors.white : Colors.brown}
                          >
                            {h}h
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={[styles.rowPadded, styles.rowBorderTop]}>
                    <ThemedText variant="bodyMedium">Between</ThemedText>
                    <View style={styles.chipRow}>
                      <HourStepper
                        value={prefs.hydration_start_hour}
                        min={5} max={12}
                        onChange={(v) => setPref({ hydration_start_hour: v })}
                      />
                      <ThemedText variant="body" color={Colors.muted}>and</ThemedText>
                      <HourStepper
                        value={prefs.hydration_end_hour}
                        min={16} max={23}
                        onChange={(v) => setPref({ hydration_end_hour: v })}
                      />
                    </View>
                  </View>
                </View>
              </>
            )}

            {/* ── Sleep ── */}
            {prefs.sleep_reminders_enabled && (
              <>
                <SectionTitle title="Sleep" />
                <View style={styles.card}>
                  <TimeRow
                    label="Wind-down reminder" icon="bed-outline"
                    value={prefs.sleep_reminder_time}
                    editing={editingTime === 'sleep_reminder_time'}
                    onPress={() => setEditingTime(editingTime === 'sleep_reminder_time' ? null : 'sleep_reminder_time')}
                    onChange={(v) => setPref({ sleep_reminder_time: v })}
                  />
                  <View style={[styles.rowPadded, styles.rowBorderTop]}>
                    <ThemedText variant="bodyMedium">Morning check-in after</ThemedText>
                    <HourStepper
                      value={prefs.wake_confirmation_hour}
                      min={5} max={11}
                      onChange={(v) => setPref({ wake_confirmation_hour: v })}
                    />
                  </View>
                </View>
              </>
            )}

            {/* ── Quiet hours ── */}
            <SectionTitle title="Quiet hours" />
            <View style={styles.card}>
              <ToggleRow
                title="Enable quiet hours"
                subtitle="No notifications inside this window"
                icon="moon-outline"
                value={prefs.quiet_hours_enabled}
                onChange={(v) => setPref({ quiet_hours_enabled: v })}
                last={!prefs.quiet_hours_enabled}
              />
              {prefs.quiet_hours_enabled && (
                <>
                  <TimeRow
                    label="From" icon="cloudy-night-outline"
                    value={prefs.quiet_hours_start}
                    editing={editingTime === 'quiet_hours_start'}
                    onPress={() => setEditingTime(editingTime === 'quiet_hours_start' ? null : 'quiet_hours_start')}
                    onChange={(v) => setPref({ quiet_hours_start: v })}
                  />
                  <TimeRow
                    label="Until" icon="sunny-outline"
                    value={prefs.quiet_hours_end}
                    editing={editingTime === 'quiet_hours_end'}
                    onPress={() => setEditingTime(editingTime === 'quiet_hours_end' ? null : 'quiet_hours_end')}
                    onChange={(v) => setPref({ quiet_hours_end: v })}
                    last
                  />
                </>
              )}
            </View>
            <ThemedText variant="label" color={Colors.muted} style={styles.footnote}>
              Reminders that fall inside quiet hours are skipped, not delayed.
            </ThemedText>
          </>
        )}

        {/* ── Footer actions ── */}
        <Pressable
          style={[styles.testButton, !master && styles.testButtonDisabled]}
          onPress={handleTest}
          disabled={!master || permission !== 'granted'}
        >
          <Ionicons name="paper-plane-outline" size={18} color={Colors.white} />
          <ThemedText variant="button" color="white">Send a test notification</ThemedText>
        </Pressable>
        <Pressable style={styles.resetButton} onPress={handleReset}>
          <ThemedText variant="bodyMedium" color={Colors.muted}>Reset to defaults</ThemedText>
        </Pressable>
      </ScrollView>

      {toast && (
        <View style={styles.toast}>
          <ThemedText variant="bodyMedium" color="white">{toast}</ThemedText>
        </View>
      )}
    </SafeAreaView>
  );
}

/* ─── Small components ─────────────────────────────────────────── */

function SectionTitle({ title }: { title: string }) {
  return (
    <ThemedText variant="h3" style={styles.sectionTitle}>
      {title}
    </ThemedText>
  );
}

function ToggleRow({
  title,
  subtitle,
  icon,
  value,
  onChange,
  prominent,
  last,
}: {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: boolean;
  onChange: (value: boolean) => void;
  prominent?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, !last && !prominent && styles.rowDivider]}>
      <View style={[styles.rowIcon, prominent && styles.rowIconProminent]}>
        <Ionicons name={icon} size={prominent ? 22 : 18} color={value ? Colors.olive : Colors.muted} />
      </View>
      <View style={styles.rowText}>
        <ThemedText variant={prominent ? 'bodySemiBold' : 'bodyMedium'}>{title}</ThemedText>
        {subtitle && (
          <ThemedText variant="label" color={Colors.muted}>
            {subtitle}
          </ThemedText>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.oliveMid }}
        thumbColor={Colors.white}
      />
    </View>
  );
}

function TimeRow({
  label,
  icon,
  value,
  editing,
  onPress,
  onChange,
  last,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  editing: boolean;
  onPress: () => void;
  onChange: (hhmm: string) => void;
  last?: boolean;
}) {
  const [h, m] = value.split(':').map(Number);
  return (
    <View style={!last && !editing ? styles.rowDivider : undefined}>
      <Pressable style={styles.toggleRow} onPress={onPress}>
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={18} color={Colors.muted} />
        </View>
        <View style={styles.rowText}>
          <ThemedText variant="bodyMedium">{label}</ThemedText>
        </View>
        <ThemedText variant="bodySemiBold" color={editing ? Colors.olive : Colors.brown}>
          {format12h(value)}
        </ThemedText>
        <Ionicons
          name={editing ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={Colors.muted}
          style={{ marginLeft: Spacing.sm }}
        />
      </Pressable>
      {editing && (
        <View style={styles.timePicker}>
          <View style={{ flex: 1 }}>
            <ScrollWheelPicker
              min={0} max={23}
              value={Number.isFinite(h) ? h : 8}
              onChange={(nh) => onChange(`${pad(nh)}:${pad(Number.isFinite(m) ? m : 0)}`)}
              fontSize={28} itemHeight={44} visibleItems={3} unit="h"
            />
          </View>
          <View style={{ flex: 1 }}>
            <ScrollWheelPicker
              min={0} max={55} step={5}
              value={Number.isFinite(m) ? Math.round(m / 5) * 5 : 0}
              onChange={(nm) => onChange(`${pad(Number.isFinite(h) ? h : 8)}:${pad(nm)}`)}
              fontSize={28} itemHeight={44} visibleItems={3} unit="m"
            />
          </View>
        </View>
      )}
    </View>
  );
}

function HourStepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        style={styles.stepperButton}
        onPress={() => value > min && onChange(value - 1)}
        hitSlop={8}
      >
        <Ionicons name="remove" size={16} color={value > min ? Colors.brown : Colors.border} />
      </Pressable>
      <ThemedText variant="bodySemiBold" style={styles.stepperValue}>
        {formatHour(value)}
      </ThemedText>
      <Pressable
        style={styles.stepperButton}
        onPress={() => value < max && onChange(value + 1)}
        hitSlop={8}
      >
        <Ionicons name="add" size={16} color={value < max ? Colors.brown : Colors.border} />
      </Pressable>
    </View>
  );
}

/* ─── Styles ───────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing['4xl'],
    gap: Spacing.sm,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.orangePale,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.orangeLight,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconProminent: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.oliveLight,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowPadded: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  rowBorderTop: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.olive,
    borderColor: Colors.olive,
  },
  timePicker: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepperButton: {
    width: 30,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 48,
    textAlign: 'center',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.olive,
    marginTop: Spacing.xl,
  },
  testButtonDisabled: {
    opacity: 0.45,
  },
  resetButton: {
    alignItems: 'center',
    paddingVertical: Spacing.base,
  },
  footnote: {
    paddingHorizontal: Spacing.xs,
  },
  toast: {
    position: 'absolute',
    bottom: Spacing['2xl'],
    alignSelf: 'center',
    backgroundColor: Colors.brown,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
});
