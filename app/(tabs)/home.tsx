/**
 * Home tab - Redesigned Daily Summary screen
 * Inspired by: assets/UI mockups/home.png (light) & home dark.png (dark)
 *
 * Layout: Header → Concentric rings card → Streak → Hydration → Steps → Today's meals → Nutridex explorer
 */

import { useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, FlatList, Dimensions, Image, type ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { Card } from '@/components/ui/Card';
import { ConcentricRing } from '@/components/ui/ConcentricRing';
import { SkeletonCard } from '@/components/ui/SkeletonLoader';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/user.store';
import { useDailyStore } from '@/stores/daily.store';
import { getArchetype, type ArchetypeKey } from '@/constants/archetypes';
import { Spacing, Colors, BorderRadius, Shadows } from '@/constants/theme';
import { WATER_GLASS_ML } from '@/constants/nutrients';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WATER_CUPS = 6;

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

const ARCHETYPE_HEADLINES: Record<ArchetypeKey, string> = {
  wolf: 'Hunt With Focus',
  bear: 'Build Steady Power',
  lion: 'Lead With Discipline',
  deer: 'Move With Lightness',
  tigress: 'Fuel The Fire',
  phoenix: 'Rise Again Today',
  doe: 'Gentle Progress Matters',
  swan: 'Balance Creates Beauty',
};

const COACH_LINES: Record<ArchetypeKey, string> = {
  wolf: 'Every meal sharpens the hunt.',
  bear: 'Strength grows from steady fuel.',
  lion: 'Command the next choice.',
  deer: 'Light steps still carry you forward.',
  tigress: "Tigresses don't skip meals.",
  phoenix: 'Every meal is a chance to rise.',
  doe: 'Consistency beats perfection.',
  swan: 'Small choices create elegant results.',
};

const HYDRATION_LINES: Record<ArchetypeKey, string> = {
  wolf: 'Stay sharp for the hunt.',
  bear: 'Power needs water.',
  lion: 'Discipline starts with basics.',
  deer: 'Nourish your roots.',
  tigress: 'Hydration powers performance.',
  phoenix: 'Fuel the flame.',
  doe: 'Nourish your roots.',
  swan: 'Balance starts with water.',
};

const COMMUNITY_LINES: Record<ArchetypeKey, string> = {
  wolf: '614 Wolves logged meals today.',
  bear: '428 Bears stayed on plan today.',
  lion: '376 Lions kept their streak alive.',
  deer: '512 Deer completed a clean meal today.',
  tigress: '520 Tigresses hit protein targets.',
  phoenix: '842 Phoenixes logged meals today.',
  doe: '467 Does chose steady progress today.',
  swan: '134 Swans completed hydration goals.',
};

const FUEL_FACTS = [
  "Today's calories could power a 15km bike ride.",
  'Enough energy to climb 90 floors.',
  'Enough energy for a 30-minute swim.',
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Evening';
}

function getDailyInsight(
  entriesCount: number,
  proteinRemaining: number,
  waterMl: number,
  calorieProgress: number,
): string {
  if (entriesCount === 0) return "Today's choices build tomorrow's results.";
  if (proteinRemaining > 0) return `You're ${proteinRemaining}g away from today's protein goal.`;
  if (waterMl < 1500) return 'Hydration is still building today.';
  if (calorieProgress >= 0.8) return "You're close to today's energy target.";
  return `You've logged ${entriesCount} meal${entriesCount === 1 ? '' : 's'} today.`;
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  return 'Building';
}

export default function HomeScreen() {
  const { theme, isDark } = useTheme();
  const { profile, archetype, calorieGoal, macroGoals, streak } = useUserStore();
  const { entries, summary, waterMl, addWater, loadToday } = useDailyStore();

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  const archetypeInfo = archetype ? getArchetype(archetype) : null;

  const totalCalories = summary?.total_calories ?? 0;
  const totalProtein = summary?.total_protein ?? 0;
  const totalCarbs = summary?.total_carbs ?? 0;
  const totalFat = summary?.total_fat ?? 0;

  const caloriesLeft = Math.max(0, calorieGoal - totalCalories);
  const calProgress = calorieGoal > 0 ? Math.min(1, totalCalories / calorieGoal) : 0;
  const proteinProgress = macroGoals.protein > 0 ? Math.min(1, totalProtein / macroGoals.protein) : 0;
  const carbsProgress = macroGoals.carbs > 0 ? Math.min(1, totalCarbs / macroGoals.carbs) : 0;
  const fatProgress = macroGoals.fat > 0 ? Math.min(1, totalFat / macroGoals.fat) : 0;

  const waterLiters = (waterMl / 1000).toFixed(1);
  const waterGoalLiters = '2.5';
  const waterCupsFilled = Math.min(WATER_CUPS, Math.floor(waterMl / WATER_GLASS_ML));
  const hydrationProgress = Math.min(1, waterMl / 2500);
  const proteinRemaining = Math.max(0, Math.round(macroGoals.protein - totalProtein));
  const nutriScore = Math.round(
    ((proteinProgress * 0.4) + (hydrationProgress * 0.3) + ((calProgress > 1 ? Math.max(0, 2 - calProgress) : calProgress) * 0.3)) * 100
  );
  const insight = getDailyInsight(entries.length, proteinRemaining, waterMl, calProgress);
  const fuelFact = FUEL_FACTS[new Date().getDate() % FUEL_FACTS.length];

  const rechargePercent = Math.round(calProgress * 100);
  const userName = profile?.name?.split(' ')[0] ?? 'there';

  const handleAddWater = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addWater(WATER_GLASS_ML);
  }, [addWater]);

  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <SkeletonCard lines={3} style={styles.skeletonCard} />
        <SkeletonCard lines={2} style={styles.skeletonCard} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <Animated.View entering={FadeIn.delay(100).duration(500)} style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
              <ThemedText variant="bodyMedium" color="white">
                {userName.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
            <View style={styles.headerBrand}>
              <Ionicons name="leaf" size={14} color={Colors.olive} />
              <ThemedText variant="bodyMedium" color={Colors.olive} style={styles.brandText}>
                NutriSnap
              </ThemedText>
            </View>
          </View>
          <Pressable>
            <Ionicons name="notifications-outline" size={24} color={theme.textMuted} />
          </Pressable>
        </Animated.View>

        {archetypeInfo && archetype && (
          <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.heroWrap}>
            <View style={[styles.archetypeHero, { backgroundColor: archetypeInfo.colors.bg }]}>
              <View style={styles.heroCopy}>
                <ThemedText variant="label" color={archetypeInfo.colors.accent}>
                  {archetypeInfo.name.toUpperCase()} JOURNEY
                </ThemedText>
                <ThemedText variant="h1" color="white" style={styles.heroTitle}>
                  {ARCHETYPE_HEADLINES[archetype]}
                </ThemedText>
                <ThemedText variant="body" color="rgba(255,255,255,0.76)" style={styles.heroText}>
                  {archetypeInfo.description}
                </ThemedText>
              </View>
              <Image source={ARCHETYPE_ART[archetype]} style={styles.heroImage} resizeMode="contain" />
            </View>
          </Animated.View>
        )}

        {/* Greeting */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.greetingSection}>
          <ThemedText variant="h1" style={styles.greetingText}>
            {getGreeting()}, {userName}
          </ThemedText>
          <View style={styles.greetingRow}>
            <ThemedText variant="body" color={theme.textMuted} style={styles.greetingSubtitle}>
              Your body is feeling {rechargePercent}% recharged today.
            </ThemedText>
            {streak > 0 && (
              <View style={styles.streakInline}>
                <ThemedText variant="label" color={Colors.orange} style={styles.streakInlineText}>
                  DAY {streak}{'\n'}STREAK
                </ThemedText>
              </View>
            )}
          </View>
        </Animated.View>

        {archetype && (
          <Animated.View entering={FadeInDown.delay(250).springify()}>
            <View style={[styles.coachCard, { backgroundColor: theme.card }]}>
              <View style={[styles.coachIcon, { backgroundColor: Colors.orangeLight + '45' }]}>
                <Ionicons name="sparkles-outline" size={20} color={Colors.orange} />
              </View>
              <View style={styles.coachText}>
                <ThemedText variant="label" color={theme.textMuted}>DAILY COACH</ThemedText>
                <ThemedText variant="bodyMedium">{COACH_LINES[archetype]}</ThemedText>
              </View>
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(275).springify()}>
          <View style={[styles.insightCard, { backgroundColor: theme.card }]}>
            <View style={[styles.insightIcon, { backgroundColor: Colors.oliveLight + '45' }]}>
              <Ionicons name="bulb-outline" size={20} color={Colors.olive} />
            </View>
            <View style={styles.insightText}>
              <ThemedText variant="bodyMedium">Daily Insight</ThemedText>
              <ThemedText variant="label" color={theme.textMuted}>{insight}</ThemedText>
            </View>
          </View>
        </Animated.View>

        {/* Concentric Rings Card */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <View style={[styles.ringsCard, { backgroundColor: isDark ? theme.card : Colors.oliveLight + '30' }]}>
            <View style={styles.ringsCenter}>
              <ConcentricRing
                size={180}
                calorieProgress={calProgress}
                proteinProgress={proteinProgress}
                carbsProgress={carbsProgress}
                fatProgress={fatProgress}
                centerContent={
                  <View style={styles.ringsCenterText}>
                    <ThemedText
                      variant="h1"
                      style={styles.caloriesLeftNumber}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {caloriesLeft.toLocaleString()}
                    </ThemedText>
                    <ThemedText variant="label" color={theme.textMuted} style={styles.kcalLabel}>
                      KCAL LEFT
                    </ThemedText>
                  </View>
                }
              />
            </View>

            {/* Legend */}
            <View style={styles.ringsLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.olive }]} />
                <ThemedText variant="label" color={theme.textMuted}>Prot</ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.orange }]} />
                <ThemedText variant="label" color={theme.textMuted}>Carb</ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.brownMid }]} />
                <ThemedText variant="label" color={theme.textMuted}>Fat</ThemedText>
              </View>
            </View>

            {/* Macro bars */}
            <View style={styles.macroBarGrid}>
              <View style={styles.macroBarItem}>
                <ThemedText variant="label" color={theme.textMuted}>PROTEIN</ThemedText>
                <View style={styles.macroBarValueRow}>
                  <ThemedText variant="h3">{totalProtein}g</ThemedText>
                  <ThemedText variant="label" color={theme.textMuted}> / {macroGoals.protein}g</ThemedText>
                </View>
                <View style={[styles.macroBarTrack, { backgroundColor: theme.border }]}>
                  <View style={[styles.macroBarFill, { backgroundColor: Colors.olive, width: `${proteinProgress * 100}%` }]} />
                </View>
              </View>
              <View style={styles.macroBarItem}>
                <ThemedText variant="label" color={theme.textMuted}>CARBS</ThemedText>
                <View style={styles.macroBarValueRow}>
                  <ThemedText variant="h3">{totalCarbs}g</ThemedText>
                  <ThemedText variant="label" color={theme.textMuted}> / {macroGoals.carbs}g</ThemedText>
                </View>
                <View style={[styles.macroBarTrack, { backgroundColor: theme.border }]}>
                  <View style={[styles.macroBarFill, { backgroundColor: Colors.orange, width: `${carbsProgress * 100}%` }]} />
                </View>
              </View>
              <View style={styles.macroBarItem}>
                <ThemedText variant="label" color={theme.textMuted}>FATS</ThemedText>
                <View style={styles.macroBarValueRow}>
                  <ThemedText variant="h3">{totalFat}g</ThemedText>
                  <ThemedText variant="label" color={theme.textMuted}> / {macroGoals.fat}g</ThemedText>
                </View>
                <View style={[styles.macroBarTrack, { backgroundColor: theme.border }]}>
                  <View style={[styles.macroBarFill, { backgroundColor: Colors.brownMid, width: `${fatProgress * 100}%` }]} />
                </View>
              </View>
              <View style={styles.macroBarItem}>
                <ThemedText variant="label" color={theme.textMuted}>WATER</ThemedText>
                <View style={styles.macroBarValueRow}>
                  <ThemedText variant="h3">{waterLiters}L</ThemedText>
                  <ThemedText variant="label" color={theme.textMuted}> / {waterGoalLiters}L</ThemedText>
                </View>
                <View style={[styles.macroBarTrack, { backgroundColor: theme.border }]}>
                  <View style={[styles.macroBarFill, { backgroundColor: '#4FC3F7', width: `${Math.min(1, waterMl / 2500) * 100}%` }]} />
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).springify()}>
          <View style={[styles.scoreCard, { backgroundColor: theme.card }]}>
            <View>
              <ThemedText variant="label" color={theme.textMuted}>NUTRISCORE</ThemedText>
              <ThemedText variant="h1" color={theme.primary}>{nutriScore} / 100</ThemedText>
              <ThemedText variant="label" color={theme.textMuted}>{getScoreLabel(nutriScore)} momentum</ThemedText>
            </View>
            <View style={styles.scoreChecks}>
              <ThemedText variant="label" color={proteinProgress >= 0.7 ? Colors.olive : Colors.orange}>
                {proteinProgress >= 0.7 ? '✓' : '!'} Protein {proteinProgress >= 0.7 ? 'On Track' : 'Needs Focus'}
              </ThemedText>
              <ThemedText variant="label" color={hydrationProgress >= 0.6 ? Colors.olive : Colors.orange}>
                {hydrationProgress >= 0.6 ? '✓' : '!'} Hydration {hydrationProgress >= 0.6 ? 'Good' : 'Building'}
              </ThemedText>
              <ThemedText variant="label" color={Colors.orange}>
                ! Fiber Could Improve
              </ThemedText>
            </View>
          </View>
        </Animated.View>

        {/* Streak Card */}
        <Animated.View entering={FadeInDown.delay(400).springify()}>
          <Pressable style={[styles.streakCard, { backgroundColor: Colors.oliveLight + '30' }]}>
            <View style={styles.streakCardLeft}>
              <Ionicons name="flame-outline" size={24} color={Colors.olive} />
              <View>
                <ThemedText variant="h3">{streak} Days</ThemedText>
                <ThemedText variant="label" color={theme.textMuted}>Current Streak</ThemedText>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
          </Pressable>
        </Animated.View>

        {/* Hydration */}
        <Animated.View entering={FadeInDown.delay(450).springify()}>
          <View style={[styles.hydrationCard, { backgroundColor: Colors.oliveLight + '20' }]}>
            <View style={styles.hydrationHeader}>
              <View>
                <ThemedText variant="bodyMedium">Hydration Garden</ThemedText>
                {archetype && (
                  <ThemedText variant="label" color={theme.textMuted}>
                    {HYDRATION_LINES[archetype]}
                  </ThemedText>
                )}
              </View>
              <ThemedText variant="bodyMedium" color={Colors.olive}>
                {waterLiters}L / {waterGoalLiters}L
              </ThemedText>
            </View>
            <View style={styles.waterDrops}>
              {Array.from({ length: WATER_CUPS }).map((_, i) => (
                <Pressable key={i} onPress={i === waterCupsFilled ? handleAddWater : undefined}>
                  <Ionicons
                    name={i < waterCupsFilled ? 'water' : 'water-outline'}
                    size={28}
                    color={i < waterCupsFilled ? Colors.olive : theme.border}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Today's meals */}
        <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.mealsSection}>
          <View style={styles.mealsSectionHeader}>
            <ThemedText variant="h3">Today's meals</ThemedText>
            <Pressable onPress={() => {}}>
              <ThemedText variant="bodyMedium" color={Colors.olive}>View Log</ThemedText>
            </Pressable>
          </View>

          {entries.length === 0 ? (
            <View style={[styles.emptyMeals, { backgroundColor: theme.card }]}>
              <View style={[styles.emptyPlate, { backgroundColor: Colors.orangeLight + '35' }]}>
                <Ionicons name="restaurant-outline" size={42} color={Colors.orange} />
              </View>
              <ThemedText variant="body" color={theme.textMuted} align="center">
                Ready for your first meal scan?
              </ThemedText>
              <Pressable
                style={[styles.emptyScanButton, { backgroundColor: Colors.orange }]}
                onPress={() => router.push('/(tabs)/camera')}
              >
                <Ionicons name="scan" size={18} color="white" />
                <ThemedText variant="button" color="white">Fuel Your Journey</ThemedText>
              </Pressable>
            </View>
          ) : (
            <FlatList
              horizontal
              data={entries}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mealsScroll}
              renderItem={({ item }) => {
                const mealType = item.meal_name?.split(' ')[0]?.toUpperCase() ?? 'MEAL';
                return (
                  <View style={[styles.mealCard, { backgroundColor: theme.card }]}>
                    {/* Meal type badge */}
                    <View style={[styles.mealBadge, { backgroundColor: Colors.olive }]}>
                      <ThemedText variant="labelSmall" color="white">{mealType}</ThemedText>
                    </View>
                    <ThemedText variant="bodyMedium" numberOfLines={2} style={styles.mealName}>
                      {item.meal_name}
                    </ThemedText>
                    <ThemedText variant="label" color={theme.textMuted}>
                      {item.total_calories} kcal • {item.protein_g ?? 0}g protein
                    </ThemedText>
                  </View>
                );
              }}
            />
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(600).springify()}>
          <View style={[styles.factCard, { backgroundColor: theme.card }]}>
            <View style={[styles.insightIcon, { backgroundColor: Colors.orangeLight + '40' }]}>
              <Ionicons name="flash-outline" size={20} color={Colors.orange} />
            </View>
            <View style={styles.insightText}>
              <ThemedText variant="bodyMedium">Fun Fuel Fact</ThemedText>
              <ThemedText variant="label" color={theme.textMuted}>{fuelFact}</ThemedText>
            </View>
          </View>
        </Animated.View>

        {archetype && (
          <Animated.View entering={FadeInDown.delay(650).springify()}>
            <View style={[styles.communityCard, { backgroundColor: isDark ? Colors.darkCardMid : Colors.orangePale }]}>
              <Ionicons name="people-outline" size={22} color={Colors.orange} />
              <View style={styles.insightText}>
                <ThemedText variant="bodyMedium">Community Pulse</ThemedText>
                <ThemedText variant="label" color={theme.textMuted}>{COMMUNITY_LINES[archetype]}</ThemedText>
              </View>
            </View>
          </Animated.View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* FAB for quick scan */}
      <Pressable
        style={[styles.fab, { backgroundColor: Colors.orange }, Shadows.fab]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/(tabs)/camera');
        }}
      >
        <Ionicons name="scan" size={28} color="white" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroWrap: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  archetypeHero: {
    minHeight: 150,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroCopy: {
    flex: 1,
    zIndex: 1,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    marginTop: Spacing.xs,
  },
  heroText: {
    marginTop: Spacing.xs,
    maxWidth: 190,
  },
  heroImage: {
    width: 132,
    height: 132,
    marginRight: -Spacing.sm,
  },
  scrollContent: {
    paddingBottom: Spacing['4xl'],
  },
  skeletonCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  brandText: {
    fontWeight: '700',
  },
  // Greeting
  greetingSection: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  greetingText: {
    fontSize: 26,
    lineHeight: 34,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: Spacing.xs,
  },
  greetingSubtitle: {
    flex: 1,
    lineHeight: 22,
  },
  streakInline: {
    marginLeft: Spacing.md,
  },
  streakInlineText: {
    textAlign: 'right',
    fontWeight: '700',
    lineHeight: 16,
  },
  coachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  coachIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coachText: {
    flex: 1,
    gap: 2,
  },
  // Rings Card
  ringsCard: {
    marginHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
  },
  ringsCenter: {
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  ringsCenterText: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 70,
  },
  caloriesLeftNumber: {
    fontSize: 24,
  },
  kcalLabel: {
    fontSize: 9,
    letterSpacing: 0.5,
  },
  ringsLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xl,
    marginBottom: Spacing.base,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Macro bars
  macroBarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  macroBarItem: {
    width: '47%',
    gap: 2,
  },
  macroBarValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  macroBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  macroBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  scoreCard: {
    marginHorizontal: Spacing.xl,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  scoreChecks: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.xs,
    alignItems: 'flex-end',
  },
  // Streak
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.xl,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  streakCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  // Hydration
  hydrationCard: {
    marginHorizontal: Spacing.xl,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  hydrationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  waterDrops: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  // Meals
  mealsSection: {
    marginBottom: Spacing.md,
  },
  mealsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  mealsScroll: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  mealCard: {
    width: SCREEN_WIDTH * 0.55,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    gap: Spacing.xs,
  },
  mealBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: Spacing.xs,
  },
  mealName: {
    marginBottom: 2,
  },
  emptyMeals: {
    marginHorizontal: Spacing.xl,
    padding: Spacing['2xl'],
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyPlate: {
    width: 82,
    height: 82,
    borderRadius: 41,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  // Insight
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightText: {
    flex: 1,
    gap: 2,
  },
  factCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: Spacing['4xl'],
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomPadding: {
    height: Spacing['5xl'],
  },
});
