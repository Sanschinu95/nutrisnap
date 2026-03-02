/**
 * Profile tab - Stats, weight chart, settings
 */

import { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ui/ThemedText';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/SkeletonLoader';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/user.store';
import { useAuthStore } from '@/stores/auth.store';
import { getArchetype } from '@/constants/archetypes';
import { Spacing, Colors, BorderRadius } from '@/constants/theme';

export default function ProfileScreen() {
  const { theme, isDark } = useTheme();
  const { profile, archetype, streak, calorieGoal, isLoading } = useUserStore();
  // const { signOut } = useAuthStore(); // auth bypassed for local testing
  const [darkModeEnabled, setDarkModeEnabled] = useState(isDark);

  const archetypeInfo = archetype ? getArchetype(archetype) : null;

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Auth is bypassed in local testing mode. Sign out is disabled.',
      [{ text: 'OK', style: 'cancel' }]
    );
  }, []);

  if (isLoading || !profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <SkeletonCard lines={2} style={styles.skeletonCard} />
        <SkeletonCard lines={4} style={styles.skeletonCard} />
      </SafeAreaView>
    );
  }

  // Get initials for avatar
  const initials = profile.name
    ? profile.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header with avatar */}
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <ThemedText variant="h2" color="white">
              {initials}
            </ThemedText>
          </View>
          <ThemedText variant="h2" style={styles.name}>
            {profile.name}
          </ThemedText>
          {archetypeInfo && (
            <Badge
              text={`${archetypeInfo.emoji} ${archetypeInfo.name}`}
              variant="success"
            />
          )}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <ThemedText variant="h2" color={theme.primary}>
              {profile.weight_kg?.toFixed(1)}
            </ThemedText>
            <ThemedText variant="label" color={theme.textMuted}>
              Current (kg)
            </ThemedText>
          </Card>
          <Card style={styles.statCard}>
            <ThemedText variant="h2" color={theme.accent}>
              {profile.goal_weight_kg?.toFixed(1)}
            </ThemedText>
            <ThemedText variant="label" color={theme.textMuted}>
              Goal (kg)
            </ThemedText>
          </Card>
          <Card style={styles.statCard}>
            <ThemedText variant="h2" color={Colors.yellow}>
              {streak}
            </ThemedText>
            <ThemedText variant="label" color={theme.textMuted}>
              Day Streak
            </ThemedText>
          </Card>
        </View>

        {/* Weight Chart placeholder */}
        <View style={styles.section}>
          <ThemedText variant="h3" style={styles.sectionTitle}>
            Weight Progress
          </ThemedText>
          <Card style={styles.chartCard}>
            <View style={styles.chartPlaceholder}>
              <Ionicons name="analytics-outline" size={48} color={theme.textMuted} />
              <ThemedText
                variant="body"
                color={theme.textMuted}
                align="center"
                style={styles.chartText}
              >
                Log more weight entries to see your progress chart
              </ThemedText>
            </View>
          </Card>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <ThemedText variant="h3" style={styles.sectionTitle}>
            Settings
          </ThemedText>

          <Card style={styles.settingsCard}>
            {/* Edit Profile */}
            <Pressable style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="person-outline" size={22} color={theme.text} />
                <ThemedText variant="body" style={styles.settingLabel}>
                  Edit Profile
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
            </Pressable>

            {/* Calorie Goal */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="flame-outline" size={22} color={theme.text} />
                <ThemedText variant="body" style={styles.settingLabel}>
                  Daily Calorie Goal
                </ThemedText>
              </View>
              <ThemedText variant="bodyMedium" color={theme.primary}>
                {calorieGoal} cal
              </ThemedText>
            </View>

            {/* Notifications */}
            <Pressable style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="notifications-outline" size={22} color={theme.text} />
                <ThemedText variant="body" style={styles.settingLabel}>
                  Notifications
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
            </Pressable>

            {/* Dark Mode */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="moon-outline" size={22} color={theme.text} />
                <ThemedText variant="body" style={styles.settingLabel}>
                  Dark Mode
                </ThemedText>
              </View>
              <Switch
                value={darkModeEnabled}
                onValueChange={setDarkModeEnabled}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="white"
              />
            </View>

            {/* Units */}
            <Pressable style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="scale-outline" size={22} color={theme.text} />
                <ThemedText variant="body" style={styles.settingLabel}>
                  Units
                </ThemedText>
              </View>
              <ThemedText variant="label" color={theme.textMuted}>
                kg / cm
              </ThemedText>
            </Pressable>
          </Card>

          {/* Sign Out */}
          <Button
            title="Sign Out"
            onPress={handleSignOut}
            variant="ghost"
            style={styles.signOutButton}
            textStyle={{ color: theme.error }}
          />
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skeletonCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  name: {
    marginBottom: Spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.base,
  },
  section: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  chartCard: {
    minHeight: 200,
  },
  chartPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
  },
  chartText: {
    marginTop: Spacing.base,
    maxWidth: 200,
  },
  settingsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    marginLeft: Spacing.md,
  },
  signOutButton: {
    marginTop: Spacing.xl,
  },
  bottomPadding: {
    height: Spacing['4xl'],
  },
});
