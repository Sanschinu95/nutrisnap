import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/SkeletonLoader';
import { ThemedText } from '@/components/ui/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useAuthGate } from '@/hooks/useAuthGate';
import { useAuthStore } from '@/stores/auth.store';
import { useDailyStore } from '@/stores/daily.store';
import { useUserStore } from '@/stores/user.store';
import { exportAccountData, deleteAccountData } from '@/lib/accountData';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { formatVolume, formatWeight, unitLabel, type UnitPreference } from '@/lib/units';

type FeedbackType = 'Report Bug' | 'Feature Request' | null;

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { profile, streak, isLoading, calorieGoal, updateProfile } = useUserStore();
  const { entries, waterMl, loadToday } = useDailyStore();
  const { signOut, user } = useAuthStore();
  const { requireAuth } = useAuthGate();
  const [feedbackType, setFeedbackType] = useState<FeedbackType>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  const initials = useMemo(
    () => profile?.name?.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2) ?? '?',
    [profile?.name]
  );

  const unitPref = profile?.unit_preference ?? 'metric';

  const handleSignOut = useCallback(() => {
    requireAuth(async () => {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]);
    });
  }, [signOut, requireAuth]);

  const handleToggleUnits = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newPref: UnitPreference = unitPref === 'metric' ? 'imperial' : 'metric';
    updateProfile({ unit_preference: newPref });
  }, [unitPref, updateProfile]);

  const handleExportData = useCallback(() => {
    requireAuth(async () => {
      if (!user) return;
      setIsExporting(true);
      try {
        const data = await exportAccountData(user.id);
        const jsonString = JSON.stringify(data, null, 2);
        await Share.share({
          title: 'NutriSnap Data Export',
          message: jsonString,
        });
      } catch (error) {
        Alert.alert('Export Failed', 'Unable to export your data. Please try again.');
        console.error('Export error:', error);
      } finally {
        setIsExporting(false);
      }
    });
  }, [user, requireAuth]);

  const handleDeleteAccount = useCallback(() => {
    requireAuth(async () => {
      if (!user) return;
      setDeleteError(null);
      setShowDeleteConfirm(true);
    });
  }, [user, requireAuth]);

  const confirmDeleteAccount = useCallback(async () => {
    if (!user) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccountData(user.id);
      setShowDeleteConfirm(false);
      await signOut();
    } catch (error) {
      console.error('Delete error:', error);
      setDeleteError('Unable to delete your account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [user, signOut]);

  const handleFeedbackSubmit = () => {
    setFeedbackType(null);
    setFeedbackText('');
    Alert.alert('Thanks', 'Feedback captured locally for this V1 UI flow.');
  };

  if (isLoading || !profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <SkeletonCard lines={3} style={styles.skeleton} />
        <SkeletonCard lines={4} style={styles.skeleton} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={() => router.push('/(tabs)/home')}>
            <Ionicons name="chevron-back" size={22} color={Colors.brown} />
          </Pressable>
          <ThemedText variant="bodySemiBold">Profile</ThemedText>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.header}>
          <View style={styles.avatar}>
            <ThemedText variant="h1" color="white">{initials}</ThemedText>
          </View>
          <ThemedText variant="h1" align="center" style={styles.name}>
            {profile.name}
          </ThemedText>
          <View style={styles.streakPill}>
            <Ionicons name="flame" size={18} color={Colors.orange} />
            <ThemedText variant="bodySemiBold" color={Colors.orange}>{streak} day streak</ThemedText>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <Stat label="Current Weight" value={formatWeight(profile.weight_kg, unitPref)} icon="scale-outline" />
          <Stat label="Goal Weight" value={formatWeight(profile.goal_weight_kg, unitPref)} icon="flag-outline" />
          <Stat label="Meals Logged" value={`${entries.length}`} icon="restaurant-outline" />
          <Stat label="Days Active" value={`${Math.max(streak, profile.longest_streak ?? 0)}`} icon="calendar-outline" />
          <Stat label="Water Logged" value={formatVolume(waterMl, unitPref)} icon="water-outline" />
          <Stat label="Calorie Goal" value={`${calorieGoal}`} icon="pulse-outline" />
        </View>

        <View style={styles.section}>
          <ThemedText variant="h3">Consistency</ThemedText>
          <View style={styles.heatmapCard}>
            {Array.from({ length: 35 }).map((_, index) => {
              const active = index >= 34 - Math.max(0, Math.min(34, streak));
              const today = index === 34;
              return (
                <View
                  key={index}
                  style={[
                    styles.heatCell,
                    { backgroundColor: active ? Colors.olive : Colors.border },
                    today && styles.heatCellToday,
                  ]}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText variant="h3">Feedback</ThemedText>
          <View style={styles.feedbackCard}>
            <FeedbackRow title="Report Bug" icon="bug-outline" onPress={() => setFeedbackType('Report Bug')} />
            <FeedbackRow title="Feature Request" icon="sparkles-outline" onPress={() => setFeedbackType('Feature Request')} />
            <FeedbackRow title="Contact Support" icon="mail-outline" onPress={() => Alert.alert('Support', 'Use your existing NutriSnap support channel.')} />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText variant="h3">Settings</ThemedText>
          <View style={styles.settingsCard}>
            <SettingsRow title="Edit Profile" icon="person-outline" trailing="Open" />
            <SettingsRow title="Daily Calorie Goal" icon="flame-outline" trailing={`${calorieGoal} cal`} />
            <SettingsRow title="Notifications" icon="notifications-outline" trailing="On" />
            <SettingsRow
              title="Units"
              icon="scale-outline"
              trailing={unitLabel(unitPref)}
              onPress={handleToggleUnits}
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText variant="h3">Account</ThemedText>
          <View style={styles.settingsCard}>
            <SettingsRow
              title="Export My Data"
              icon="download-outline"
              trailing={isExporting ? '' : 'JSON'}
              onPress={handleExportData}
              iconColor={Colors.blue}
              trailingContent={isExporting ? <ActivityIndicator size="small" color={Colors.blue} /> : undefined}
            />
            <SettingsRow
              title="Delete Account"
              icon="trash-outline"
              trailing={isDeleting ? '' : 'Permanent'}
              onPress={handleDeleteAccount}
              iconColor={Colors.error}
              labelColor={Colors.error}
              trailingContent={isDeleting ? <ActivityIndicator size="small" color={Colors.error} /> : undefined}
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText variant="h3">Legal</ThemedText>
          <View style={styles.settingsCard}>
            <SettingsRow
              title="Privacy Policy"
              icon="shield-checkmark-outline"
              trailing=""
              onPress={() => router.push({ pathname: '/legal' as any, params: { section: 'privacy' } })}
              showChevron
            />
            <SettingsRow
              title="Terms of Service"
              icon="document-text-outline"
              trailing=""
              onPress={() => router.push({ pathname: '/legal' as any, params: { section: 'terms' } })}
              showChevron
            />
          </View>
        </View>

        <Button title="Sign Out" variant="ghost" onPress={handleSignOut} style={styles.signOut} textStyle={{ color: Colors.error }} />

        <View style={styles.bottomPadding} />
      </ScrollView>

      {feedbackType && (
        <View style={styles.modalOverlay}>
          <View style={styles.feedbackForm}>
            <ThemedText variant="h3">{feedbackType}</ThemedText>
            <TextInput
              value={feedbackText}
              onChangeText={setFeedbackText}
              placeholder="Tell us what happened"
              placeholderTextColor={Colors.muted}
              multiline
              style={styles.feedbackInput}
            />
            <View style={styles.formActions}>
              <Button title="Cancel" variant="ghost" onPress={() => setFeedbackType(null)} style={styles.formButton} />
              <Button title="Submit" onPress={handleFeedbackSubmit} style={styles.formButton} />
            </View>
          </View>
        </View>
      )}

      {showDeleteConfirm && (
        <View style={styles.modalOverlay}>
          <View style={styles.deleteCard}>
            <View style={styles.deleteIconWrap}>
              <Ionicons name="trash-outline" size={28} color={Colors.error} />
            </View>
            <ThemedText variant="h2" align="center" style={styles.deleteTitle}>
              Delete everything?
            </ThemedText>
            <ThemedText variant="body" color={Colors.muted} align="center" style={styles.deleteBody}>
              This permanently removes your profile, meals, hydration logs, weight history, and streaks. This cannot be undone.
            </ThemedText>
            {deleteError && (
              <View style={styles.deleteErrorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
                <ThemedText variant="label" color={Colors.error} style={styles.deleteErrorText}>
                  {deleteError}
                </ThemedText>
              </View>
            )}
            <View style={styles.formActions}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => {
                  if (isDeleting) return;
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                }}
                style={styles.formButton}
              />
              <Pressable
                style={[styles.deleteConfirmButton, isDeleting && styles.deleteConfirmDisabled]}
                onPress={confirmDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <ThemedText variant="button" color={Colors.white}>
                    Delete everything
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={20} color={Colors.olive} />
      <ThemedText variant="bodySemiBold" numberOfLines={1} adjustsFontSizeToFit>{value}</ThemedText>
      <ThemedText variant="labelSmall" color={Colors.muted} align="center">{label}</ThemedText>
    </View>
  );
}

function FeedbackRow({ title, icon, onPress }: { title: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={21} color={Colors.olive} />
        <ThemedText variant="bodyMedium">{title}</ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
    </Pressable>
  );
}

function SettingsRow({
  title,
  icon,
  trailing,
  onPress,
  iconColor,
  labelColor,
  showChevron,
  trailingContent,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  trailing: string;
  onPress?: () => void;
  iconColor?: string;
  labelColor?: string;
  showChevron?: boolean;
  trailingContent?: React.ReactNode;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={!onPress}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={21} color={iconColor ?? Colors.brown} />
        <ThemedText variant="bodyMedium" color={labelColor}>{title}</ThemedText>
      </View>
      {trailingContent ?? (
        showChevron ? (
          <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
        ) : (
          <ThemedText variant="label" color={Colors.muted}>{trailing}</ThemedText>
        )
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: Spacing['5xl'] },
  skeleton: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
  },
  topBar: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.olive,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  name: {
    fontSize: 34,
    lineHeight: 40,
  },
  streakPill: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.orangePale,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    width: '30.5%',
    minHeight: 104,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
  },
  section: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  heatmapCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  heatCell: {
    width: 24,
    height: 24,
    borderRadius: 7,
  },
  heatCellToday: {
    borderWidth: 2,
    borderColor: Colors.orange,
  },
  feedbackCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  settingsCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    minHeight: 58,
    paddingHorizontal: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  signOut: { marginHorizontal: Spacing.xl },
  bottomPadding: { height: 120 },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(47,36,30,0.25)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  feedbackForm: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  feedbackInput: {
    minHeight: 130,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    color: Colors.brown,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  formActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  formButton: {
    flex: 1,
  },
  deleteCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    gap: Spacing.md,
    alignItems: 'center',
  },
  deleteIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteTitle: {
    fontSize: 22,
    lineHeight: 28,
  },
  deleteBody: {
    maxWidth: 320,
  },
  deleteErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorLight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    width: '100%',
  },
  deleteErrorText: {
    flex: 1,
  },
  deleteConfirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteConfirmDisabled: {
    opacity: 0.6,
  },
});
