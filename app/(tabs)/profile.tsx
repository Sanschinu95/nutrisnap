/**
 * Profile tab - Stats, weight chart, settings
 */

import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Switch, Image, type ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ui/ThemedText';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/SkeletonLoader';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/user.store';
import { useAuthStore } from '@/stores/auth.store';
import { useDailyStore } from '@/stores/daily.store';
import { getArchetype, type ArchetypeKey } from '@/constants/archetypes';
import { Spacing, Colors, BorderRadius } from '@/constants/theme';

const ARCHETYPE_ART: Record<ArchetypeKey, ImageSourcePropType> = {
  wolf: require('@/assets/archetypes/wolf.png'),
  bear: require('@/assets/archetypes/bear.png'),
  lion: require('@/assets/archetypes/lion.png'),
  deer: require('@/assets/archetypes/deer.png'),
  tigress: require('@/assets/archetypes/tigress.png'),
  phoenix: require('@/assets/archetypes/phoenix.png'),
  doe: require('@/assets/archetypes/doe.png'),
  swan: require('@/assets/archetypes/swan.png'),
};

const JOURNEY_TITLES: Record<ArchetypeKey, string> = {
  wolf: 'Focused Hunter',
  bear: 'Steady Strength',
  lion: 'Commanding Discipline',
  deer: 'Light Endurance',
  tigress: 'Lean Strength',
  phoenix: 'Transformation Journey',
  doe: 'Mindful Sustainability',
  swan: 'Graceful Discipline',
};

export default function ProfileScreen() {
  const { theme, isDark } = useTheme();
  const { profile, archetype, streak, calorieGoal, isLoading } = useUserStore();
  const { entries, waterMl, loadToday } = useDailyStore();
  const { signOut } = useAuthStore();
  const [darkModeEnabled, setDarkModeEnabled] = useState(isDark);

  const archetypeInfo = archetype ? getArchetype(archetype) : null;

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  }, [signOut]);

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
        {/* Character header */}
        <View style={styles.header}>
          {archetypeInfo && archetype ? (
            <View style={[styles.characterHero, { backgroundColor: archetypeInfo.colors.bg }]}>
              <View style={styles.characterCopy}>
                <View style={[styles.avatarSmall, { backgroundColor: theme.primary }]}>
                  <ThemedText variant="bodyMedium" color="white">
                    {initials}
                  </ThemedText>
                </View>
                <ThemedText variant="label" color={archetypeInfo.colors.accent}>
                  {profile.name}
                </ThemedText>
                <ThemedText variant="h1" color="white" style={styles.characterName}>
                  {archetypeInfo.name}
                </ThemedText>
                <ThemedText variant="bodyMedium" color="rgba(255,255,255,0.78)">
                  {JOURNEY_TITLES[archetype]}
                </ThemedText>
                <ThemedText variant="label" color="rgba(255,255,255,0.68)" style={styles.characterDescription}>
                  {archetypeInfo.description}
                </ThemedText>
              </View>
              <Image source={ARCHETYPE_ART[archetype]} style={styles.characterImage} resizeMode="contain" />
            </View>
          ) : (
            <View style={styles.emptyProfileHeader}>
              <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                <ThemedText variant="h2" color="white">{initials}</ThemedText>
              </View>
              <ThemedText variant="h2" style={styles.name}>{profile.name}</ThemedText>
              <ThemedText variant="body" color={theme.textMuted}>Let's build your nutrition journey.</ThemedText>
            </View>
          )}
        </View>

        {/* Stats row */}
        <View style={styles.statsGrid}>
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
          <Card style={styles.statCard}>
            <ThemedText variant="h2" color={theme.primary}>
              {entries.length}
            </ThemedText>
            <ThemedText variant="label" color={theme.textMuted}>
              Meals Logged
            </ThemedText>
          </Card>
          <Card style={styles.statCard}>
            <ThemedText variant="h2" color="#4FC3F7">
              {(waterMl / 1000).toFixed(1)}L
            </ThemedText>
            <ThemedText variant="label" color={theme.textMuted}>
              Water Today
            </ThemedText>
          </Card>
          <Card style={styles.statCard}>
            <ThemedText variant="h2" color={theme.accent}>
              {Math.max(streak, profile.longest_streak ?? 0)}
            </ThemedText>
            <ThemedText variant="label" color={theme.textMuted}>
              Days Active
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
                Your story begins with today's choices.
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
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  characterHero: {
    minHeight: 190,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  characterCopy: {
    flex: 1,
    zIndex: 1,
  },
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  characterName: {
    fontSize: 34,
    lineHeight: 40,
  },
  characterDescription: {
    marginTop: Spacing.sm,
    maxWidth: 190,
  },
  characterImage: {
    width: 138,
    height: 138,
    marginRight: -Spacing.md,
  },
  emptyProfileHeader: {
    alignItems: 'center',
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    width: '30.5%',
    alignItems: 'center',
    paddingVertical: Spacing.base,
    minHeight: 92,
    justifyContent: 'center',
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
