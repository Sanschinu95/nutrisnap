/**
 * Plan tab - Interactive progress & plan screen
 * Shows archetype card, weekly progress, today's nutrition summary,
 * body metrics, workout plan, and cheat day toggle
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { Card } from '@/components/ui/Card';
import { MacroPillRow } from '@/components/ui/MacroPill';
import { SkeletonCard } from '@/components/ui/SkeletonLoader';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/user.store';
import { useDailyStore } from '@/stores/daily.store';
import { useAuthStore } from '@/stores/auth.store';
import { getArchetype } from '@/constants/archetypes';
import { generatePlan, type PersonalizedPlan, type ActivityLevel } from '@/lib/planEngine';
import { supabase } from '@/lib/supabase';
import { Spacing, Colors, BorderRadius } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WORKOUT_TYPE_ICONS: Record<string, string> = {
  Push: 'barbell-outline',
  Pull: 'barbell-outline',
  Legs: 'barbell-outline',
  Strength: 'barbell-outline',
  'Full Body': 'body-outline',
  Cardio: 'bicycle-outline',
  Yoga: 'leaf-outline',
  Rest: 'bed-outline',
  'Active Recovery': 'walk-outline',
};

const WORKOUT_TYPE_COLORS: Record<string, string> = {
  Push: Colors.orange,
  Pull: Colors.olive,
  Legs: Colors.brownMid,
  Strength: Colors.orange,
  'Full Body': Colors.olive,
  Cardio: '#4FC3F7',
  Yoga: Colors.oliveMid,
  Rest: Colors.muted,
  'Active Recovery': Colors.yellow,
};

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface WeeklyDayData {
  day: string;
  calories: number;
  date: string;
}

export default function PlanScreen() {
  const { theme } = useTheme();
  const { profile, archetype, macroGoals, calorieGoal, isLoading } = useUserStore();
  const { entries, summary, isCheatDay, toggleCheatDay, loadToday } = useDailyStore();
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set());
  const [weeklyData, setWeeklyData] = useState<WeeklyDayData[]>([]);
  const [weightInput, setWeightInput] = useState<string>('');

  useEffect(() => {
    loadToday();
    loadWeeklyData();
  }, [loadToday]);

  // Load weekly calorie data from Supabase
  const loadWeeklyData = async () => {
    try {
      const user = useAuthStore.getState().user;
      if (!user) {
        // Generate empty week data
        setWeeklyData(getLast7Days());
        return;
      }

      const dates = getLast7Days();
      const startDate = dates[0].date;
      const endDate = dates[6].date;

      const { data, error } = await supabase
        .from('daily_summaries')
        .select('date, total_calories')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) {
        console.warn('Weekly data load error:', error);
        setWeeklyData(dates);
        return;
      }

      const calByDate = new Map(data?.map((d: any) => [d.date, d.total_calories || 0]) || []);
      const enriched = dates.map((d) => ({
        ...d,
        calories: calByDate.get(d.date) || 0,
      }));
      setWeeklyData(enriched);
    } catch (e) {
      console.warn('Weekly data error:', e);
      setWeeklyData(getLast7Days());
    }
  };

  const archetypeInfo = archetype ? getArchetype(archetype) : null;

  // Generate plan from engine
  const plan: PersonalizedPlan | null = useMemo(() => {
    if (!profile || !profile.archetype || !profile.goal_type) return null;

    const activityMap: Record<number, ActivityLevel> = {
      1: 'sedentary',
      2: 'light',
      3: 'active',
      4: 'very_active',
    };

    return generatePlan({
      age: profile.age ?? 25,
      weight_kg: profile.weight_kg ?? 70,
      height_cm: profile.height_cm ?? 170,
      sex: (profile.biological_sex === 'female' ? 'female' : 'male'),
      goal_type: profile.goal_type,
      activity_level: activityMap[3] ?? 'active',
      archetype: profile.archetype,
    });
  }, [profile]);

  const handleDayToggle = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleExerciseToggle = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCompletedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCheatDayToggle = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await toggleCheatDay();
  };

  const handleQuickScan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(tabs)/camera');
  };

  // Compute today's nutrition from actual entries
  const todayCalories = summary?.total_calories ?? 0;
  const todayProtein = summary?.total_protein ?? 0;
  const todayCarbs = summary?.total_carbs ?? 0;
  const todayFat = summary?.total_fat ?? 0;
  const calProgress = calorieGoal > 0 ? Math.min(1, todayCalories / calorieGoal) : 0;
  const proteinProgress = macroGoals.protein > 0 ? Math.min(1, todayProtein / macroGoals.protein) : 0;
  const carbsProgress = macroGoals.carbs > 0 ? Math.min(1, todayCarbs / macroGoals.carbs) : 0;
  const fatProgress = macroGoals.fat > 0 ? Math.min(1, todayFat / macroGoals.fat) : 0;
  const waterProgress = summary?.water_ml ? Math.min(1, summary.water_ml / 2500) : 0;
  const consistencyScore = Math.round(
    ((entries.length > 0 ? 0.34 : 0) +
      Math.min(1, proteinProgress) * 0.33 +
      Math.min(1, waterProgress) * 0.33) * 100
  );
  const consistencyLabel = consistencyScore >= 80
    ? 'Excellent'
    : consistencyScore >= 60
    ? 'Good'
    : 'Needs Improvement';

  if (isLoading || !archetypeInfo || !plan) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <ThemedText variant="h2">Your Journey</ThemedText>
        </View>
        <SkeletonCard lines={4} style={styles.skeletonCard} />
        <SkeletonCard lines={3} style={styles.skeletonCard} />
      </SafeAreaView>
    );
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const todayDayIndex = new Date().getDay();
  const todayIndex = todayDayIndex === 0 ? 6 : todayDayIndex - 1;

  // Max calorie value in the week for bar chart scaling
  const maxWeekCal = Math.max(calorieGoal, ...weeklyData.map((d) => d.calories), 1);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText variant="h2">Your Journey</ThemedText>
          <ThemedText variant="label" color={theme.textMuted}>
            {today}
          </ThemedText>
        </View>

        {/* Archetype Card */}
        <Animated.View entering={FadeInDown.delay(0).springify()}>
          <Card
            variant="hero"
            style={[
              styles.archetypeCard,
              { backgroundColor: archetypeInfo.colors.bg },
            ]}
          >
            <View style={styles.archetypeHeader}>
              <ThemedText style={styles.archetypeEmoji}>
                {archetypeInfo.emoji}
              </ThemedText>
              <View style={styles.archetypeInfo}>
                <ThemedText variant="h2" color={archetypeInfo.colors.accent}>
                  {archetypeInfo.name}
                </ThemedText>
                <ThemedText variant="label" color={Colors.darkMuted}>
                  {plan.daily_calories} kcal daily rhythm
                </ThemedText>
              </View>
            </View>
            <MacroPillRow
              protein={plan.macros.protein_g}
              carbs={plan.macros.carbs_g}
              fat={plan.macros.fat_g}
              showLabels
              size="small"
              style={styles.macroRow}
            />
          </Card>
        </Animated.View>

        {/* Quick-Add Meal CTA */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Pressable
            style={[styles.quickAddCard, { backgroundColor: Colors.orange }]}
            onPress={handleQuickScan}
          >
            <View style={styles.quickAddLeft}>
              <Ionicons name="scan-outline" size={24} color="white" />
              <View>
                <ThemedText variant="bodyMedium" color="white">
                  Fuel Your Journey
                </ThemedText>
                <ThemedText variant="label" color="rgba(255,255,255,0.75)">
                  Snap a photo to track instantly
                </ThemedText>
              </View>
            </View>
            <Ionicons name="arrow-forward-circle" size={32} color="rgba(255,255,255,0.9)" />
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(125).springify()}>
          <View style={styles.section}>
            <ThemedText variant="h3" style={styles.sectionTitle}>
              Weekly Summary
            </ThemedText>
            <View style={styles.summaryGrid}>
              <Card style={styles.summaryCard}>
                <ThemedText variant="h2" color={theme.primary}>{entries.length}</ThemedText>
                <ThemedText variant="label" color={theme.textMuted}>Meals Logged</ThemedText>
              </Card>
              <Card style={styles.summaryCard}>
                <ThemedText variant="h2" color={proteinProgress >= 1 ? theme.primary : Colors.orange}>
                  {proteinProgress >= 1 ? 1 : 0}
                </ThemedText>
                <ThemedText variant="label" color={theme.textMuted}>Protein Goals Hit</ThemedText>
              </Card>
              <Card style={styles.summaryCard}>
                <ThemedText variant="h2" color={waterProgress >= 1 ? theme.primary : Colors.orange}>
                  {waterProgress >= 1 ? 1 : 0}
                </ThemedText>
                <ThemedText variant="label" color={theme.textMuted}>Water Goals Hit</ThemedText>
              </Card>
              <Card style={styles.summaryCard}>
                <ThemedText variant="h2" color={Colors.yellow}>{profile?.streak_count ?? 0}</ThemedText>
                <ThemedText variant="label" color={theme.textMuted}>Current Streak</ThemedText>
              </Card>
            </View>
          </View>
        </Animated.View>

        {/* Today's Nutrition Summary */}
        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <View style={styles.section}>
            <ThemedText variant="h3" style={styles.sectionTitle}>
              Nutrition Trends
            </ThemedText>

            <Card style={styles.nutritionCard}>
              {/* Calorie progress bar */}
              <View style={styles.calProgressSection}>
                <View style={styles.calProgressHeader}>
                  <ThemedText variant="bodyMedium">Calories</ThemedText>
                  <ThemedText variant="bodyMedium" color={theme.primary}>
                    {todayCalories} / {calorieGoal}
                  </ThemedText>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: calProgress >= 1 ? Colors.yellow : Colors.olive,
                        width: `${calProgress * 100}%`,
                      },
                    ]}
                  />
                </View>
                <ThemedText variant="label" color={theme.textMuted} style={styles.calRemaining}>
                  {Math.max(0, calorieGoal - todayCalories)} kcal remaining
                </ThemedText>
              </View>

              {/* Macro breakdown */}
              <View style={styles.macroGrid}>
                <View style={styles.macroItem}>
                  <View style={styles.macroItemHeader}>
                    <View style={[styles.macroDot, { backgroundColor: Colors.olive }]} />
                    <ThemedText variant="label" color={theme.textMuted}>PROTEIN</ThemedText>
                  </View>
                  <ThemedText variant="h3">{todayProtein}g</ThemedText>
                  <View style={[styles.miniTrack, { backgroundColor: theme.border }]}>
                    <View style={[styles.miniFill, { backgroundColor: Colors.olive, width: `${proteinProgress * 100}%` }]} />
                  </View>
                  <ThemedText variant="label" color={theme.textMuted}>of {macroGoals.protein}g</ThemedText>
                </View>

                <View style={styles.macroItem}>
                  <View style={styles.macroItemHeader}>
                    <View style={[styles.macroDot, { backgroundColor: Colors.orange }]} />
                    <ThemedText variant="label" color={theme.textMuted}>CARBS</ThemedText>
                  </View>
                  <ThemedText variant="h3">{todayCarbs}g</ThemedText>
                  <View style={[styles.miniTrack, { backgroundColor: theme.border }]}>
                    <View style={[styles.miniFill, { backgroundColor: Colors.orange, width: `${carbsProgress * 100}%` }]} />
                  </View>
                  <ThemedText variant="label" color={theme.textMuted}>of {macroGoals.carbs}g</ThemedText>
                </View>

                <View style={styles.macroItem}>
                  <View style={styles.macroItemHeader}>
                    <View style={[styles.macroDot, { backgroundColor: Colors.brownMid }]} />
                    <ThemedText variant="label" color={theme.textMuted}>FAT</ThemedText>
                  </View>
                  <ThemedText variant="h3">{todayFat}g</ThemedText>
                  <View style={[styles.miniTrack, { backgroundColor: theme.border }]}>
                    <View style={[styles.miniFill, { backgroundColor: Colors.brownMid, width: `${fatProgress * 100}%` }]} />
                  </View>
                  <ThemedText variant="label" color={theme.textMuted}>of {macroGoals.fat}g</ThemedText>
                </View>
              </View>

              {/* Recent meals */}
              {entries.length > 0 && (
                <View style={styles.recentMeals}>
                  <View style={[styles.recentDivider, { backgroundColor: theme.border }]} />
                  <ThemedText variant="label" color={theme.textMuted} style={styles.recentLabel}>
                    RECENT MEALS
                  </ThemedText>
                  {entries.slice(0, 3).map((entry) => (
                    <View key={entry.id} style={styles.recentMealRow}>
                      <View style={styles.recentMealInfo}>
                        <ThemedText variant="body" numberOfLines={1} style={styles.recentMealName}>
                          {entry.meal_name}
                        </ThemedText>
                        <ThemedText variant="label" color={theme.textMuted}>
                          {entry.total_calories} kcal
                        </ThemedText>
                      </View>
                      <ThemedText variant="label" color={theme.primary}>
                        {entry.protein_g ?? 0}g P
                      </ThemedText>
                    </View>
                  ))}
                </View>
              )}

              {entries.length === 0 && (
                <View style={styles.emptyNutrition}>
                  <Ionicons name="restaurant-outline" size={24} color={theme.textMuted} />
                  <ThemedText variant="body" color={theme.textMuted}>
                    Your story begins with today's choices.
                  </ThemedText>
                </View>
              )}
            </Card>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(175).springify()}>
          <View style={styles.section}>
            <ThemedText variant="h3" style={styles.sectionTitle}>
              Smart Insights
            </ThemedText>
            <Card style={styles.smartInsightCard}>
              <Ionicons name="analytics-outline" size={22} color={Colors.orange} />
              <View style={styles.smartInsightText}>
                <ThemedText variant="bodyMedium">
                  {proteinProgress >= 1
                    ? 'You hit your protein goal today.'
                    : `You are ${Math.max(0, Math.round(macroGoals.protein - todayProtein))}g from your protein goal.`}
                </ThemedText>
                <ThemedText variant="label" color={theme.textMuted}>
                  {entries.length > 0
                    ? `Most progress today came from ${entries[0]?.meal_name ?? 'your latest meal'}.`
                    : 'Log your first meal to unlock sharper trends.'}
                </ThemedText>
              </View>
            </Card>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(190).springify()}>
          <View style={styles.section}>
            <Card style={styles.consistencyCard}>
              <View>
                <ThemedText variant="label" color={theme.textMuted}>CONSISTENCY SCORE</ThemedText>
                <ThemedText variant="h1" color={theme.primary}>{consistencyScore} / 100</ThemedText>
                <ThemedText variant="bodyMedium">{consistencyLabel}</ThemedText>
              </View>
              <View style={[styles.consistencyBadge, { backgroundColor: Colors.oliveLight + '40' }]}>
                <Ionicons name="trending-up-outline" size={28} color={Colors.olive} />
              </View>
            </Card>
          </View>
        </Animated.View>

        {/* Weekly Progress Chart */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <View style={styles.section}>
            <ThemedText variant="h3" style={styles.sectionTitle}>
              Weekly Progress
            </ThemedText>
            <Card style={styles.chartCard}>
              <View style={styles.chartContainer}>
                {weeklyData.map((day, idx) => {
                  const barHeight = maxWeekCal > 0 ? (day.calories / maxWeekCal) * 100 : 0;
                  const isCurrentDay = idx === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
                  const hitGoal = day.calories >= calorieGoal && day.calories > 0;

                  return (
                    <View key={day.date} style={styles.barColumn}>
                      <ThemedText
                        variant="label"
                        color={theme.textMuted}
                        style={styles.barValue}
                        numberOfLines={1}
                      >
                        {day.calories > 0 ? day.calories : ''}
                      </ThemedText>
                      <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              height: `${Math.max(barHeight, day.calories > 0 ? 5 : 0)}%`,
                              backgroundColor: hitGoal
                                ? Colors.olive
                                : day.calories > 0
                                ? Colors.orange
                                : 'transparent',
                            },
                          ]}
                        />
                      </View>
                      <ThemedText
                        variant="label"
                        color={isCurrentDay ? theme.primary : theme.textMuted}
                        style={[
                          styles.barLabel,
                          isCurrentDay && { fontWeight: '700' },
                        ]}
                      >
                        {day.day}
                      </ThemedText>
                      {isCurrentDay && (
                        <View style={[styles.currentDayDot, { backgroundColor: theme.primary }]} />
                      )}
                    </View>
                  );
                })}
              </View>
              {/* Goal line label */}
              <View style={styles.goalLegend}>
                <View style={[styles.legendDot, { backgroundColor: Colors.olive }]} />
                <ThemedText variant="label" color={theme.textMuted}>
                  Goal met
                </ThemedText>
                <View style={[styles.legendDot, { backgroundColor: Colors.orange, marginLeft: Spacing.md }]} />
                <ThemedText variant="label" color={theme.textMuted}>
                  In progress
                </ThemedText>
              </View>
            </Card>
          </View>
        </Animated.View>

        {/* Body Metrics Card */}
        <Animated.View entering={FadeInDown.delay(250).springify()}>
          <View style={styles.section}>
            <ThemedText variant="h3" style={styles.sectionTitle}>
              Body Metrics
            </ThemedText>
            <Card style={styles.metricsCard}>
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Ionicons name="scale-outline" size={22} color={Colors.olive} />
                  <ThemedText variant="label" color={theme.textMuted}>Current Weight</ThemedText>
                  <ThemedText variant="h3">
                    {profile?.weight_kg ?? '—'} kg
                  </ThemedText>
                </View>
                <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />
                <View style={styles.metricItem}>
                  <Ionicons name="flag-outline" size={22} color={Colors.orange} />
                  <ThemedText variant="label" color={theme.textMuted}>Goal Weight</ThemedText>
                  <ThemedText variant="h3">
                    {profile?.goal_weight_kg ?? '—'} kg
                  </ThemedText>
                </View>
              </View>
              {profile?.weight_kg && profile?.goal_weight_kg && (
                <View style={styles.weightProgress}>
                  <View style={[styles.weightTrack, { backgroundColor: theme.border }]}>
                    <View
                      style={[
                        styles.weightFill,
                        {
                          backgroundColor: Colors.olive,
                          width: `${Math.min(100, Math.max(0,
                            profile.goal_type === 'cut'
                              ? ((profile.weight_kg - profile.goal_weight_kg) /
                                  (profile.weight_kg - profile.goal_weight_kg + 10)) * 100
                              : profile.goal_type === 'bulk'
                              ? ((profile.goal_weight_kg - profile.weight_kg) /
                                  (profile.goal_weight_kg - profile.weight_kg + 10)) * 100
                              : 100
                          ))}%`,
                        },
                      ]}
                    />
                  </View>
                  <ThemedText variant="label" color={theme.textMuted} style={styles.weightLabel}>
                    {profile.goal_type === 'cut'
                      ? `${Math.abs(profile.weight_kg - profile.goal_weight_kg).toFixed(1)} kg to go`
                      : profile.goal_type === 'bulk'
                      ? `${Math.abs(profile.goal_weight_kg - profile.weight_kg).toFixed(1)} kg to gain`
                      : 'Maintaining weight'}
                  </ThemedText>
                </View>
              )}
            </Card>
          </View>
        </Animated.View>

        {/* Workout Plan */}
        <View style={styles.section}>
          <ThemedText variant="h3" style={styles.sectionTitle}>
            Movement Rhythm
          </ThemedText>

          {plan.workout_plan.map((day, idx) => {
            const isToday = idx === todayIndex;
            const isExpanded = expandedDays.has(idx);
            const isRest = day.type === 'Rest';
            const iconName = WORKOUT_TYPE_ICONS[day.type] ?? 'fitness-outline';
            const typeColor = WORKOUT_TYPE_COLORS[day.type] ?? theme.primary;

            return (
              <Animated.View
                key={idx}
                entering={FadeInDown.delay(300 + idx * 50).springify()}
              >
                <Pressable
                  onPress={() => !isRest && handleDayToggle(idx)}
                  style={[
                    styles.workoutDay,
                    {
                      backgroundColor: isToday ? theme.card : 'transparent',
                      borderColor: isToday ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <View style={styles.workoutDayHeader}>
                    <View style={styles.workoutDayLeft}>
                      <ThemedText
                        variant="bodyMedium"
                        color={isRest ? theme.textMuted : theme.text}
                      >
                        {day.day.slice(0, 3)}
                      </ThemedText>
                      {isToday && (
                        <View style={[styles.todayBadge, { backgroundColor: theme.primary }]}>
                          <ThemedText variant="labelSmall" color="white">
                            TODAY
                          </ThemedText>
                        </View>
                      )}
                    </View>
                    <View style={styles.workoutDayRight}>
                      <View style={[styles.typePill, { backgroundColor: typeColor + '20' }]}>
                        <Ionicons name={iconName as any} size={14} color={typeColor} />
                        <ThemedText variant="label" color={typeColor} style={styles.typeLabel}>
                          {isRest ? 'Rest & Recover' : day.type}
                        </ThemedText>
                      </View>
                      {!isRest && (
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={theme.textMuted}
                        />
                      )}
                    </View>
                  </View>

                  {isExpanded && !isRest && (
                    <View style={styles.exerciseList}>
                      {day.exercises.map((ex, ei) => {
                        const exKey = `${idx}-${ei}`;
                        const isDone = completedExercises.has(exKey);
                        return (
                          <Pressable
                            key={ei}
                            style={styles.exerciseRow}
                            onPress={() => handleExerciseToggle(exKey)}
                          >
                            <View
                              style={[
                                styles.exerciseCheck,
                                {
                                  backgroundColor: isDone ? theme.primary : 'transparent',
                                  borderColor: isDone ? theme.primary : theme.border,
                                },
                              ]}
                            >
                              {isDone && (
                                <Ionicons name="checkmark" size={12} color="white" />
                              )}
                            </View>
                            <ThemedText
                              variant="body"
                              color={isDone ? theme.textMuted : theme.text}
                              style={[
                                styles.exerciseName,
                                isDone && styles.exerciseDone,
                              ]}
                            >
                              {ex.name}
                            </ThemedText>
                            <ThemedText variant="label" color={theme.textMuted}>
                              {ex.sets} x {ex.reps}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        {/* Cheat Day */}
        <View style={styles.section}>
          <Card
            style={[
              styles.cheatDayCard,
              isCheatDay && { backgroundColor: '#4A1A6B' },
            ]}
          >
            <View style={styles.cheatDayHeader}>
              <View style={styles.cheatDayInfo}>
                <ThemedText
                  variant="bodyMedium"
                  color={isCheatDay ? 'white' : theme.text}
                >
                  Cheat Day Mode
                </ThemedText>
                <ThemedText
                  variant="label"
                  color={isCheatDay ? Colors.darkMuted : theme.textMuted}
                >
                  {isCheatDay
                    ? 'Enjoy it. You earned it.'
                    : 'Take a break from calorie tracking'}
                </ThemedText>
              </View>
              <Pressable
                style={[
                  styles.cheatDayToggle,
                  { backgroundColor: isCheatDay ? Colors.orange : theme.border },
                ]}
                onPress={handleCheatDayToggle}
              >
                <View
                  style={[
                    styles.cheatDayKnob,
                    isCheatDay && styles.cheatDayKnobActive,
                  ]}
                />
              </Pressable>
            </View>
          </Card>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Helper to get last 7 days as {day, date, calories}
function getLast7Days(): WeeklyDayData[] {
  const result: WeeklyDayData[] = [];
  const today = new Date();
  // Start from Monday of this week
  const currentDay = today.getDay(); // 0=Sun
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    result.push({
      day: DAYS_SHORT[i],
      date: `${year}-${month}-${day}`,
      calories: 0,
    });
  }
  return result;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.base,
  },
  skeletonCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.base,
  },
  archetypeCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  archetypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  archetypeEmoji: { fontSize: 48, marginRight: Spacing.base },
  archetypeInfo: { flex: 1 },
  macroRow: { marginTop: Spacing.sm },

  // Quick-Add
  quickAddCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.xl,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  quickAddLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },

  // Section
  section: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  sectionTitle: { marginBottom: Spacing.md },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  summaryCard: {
    width: '47%',
    minHeight: 96,
    justifyContent: 'center',
  },
  smartInsightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  smartInsightText: {
    flex: 1,
    gap: Spacing.xs,
  },
  consistencyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  consistencyBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Nutrition
  nutritionCard: { padding: Spacing.base },
  calProgressSection: {
    marginBottom: Spacing.base,
  },
  calProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  calRemaining: {
    marginTop: Spacing.xs,
  },
  macroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  macroItem: {
    flex: 1,
    gap: 2,
  },
  macroItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 2,
  },
  macroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  miniTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 2,
  },
  miniFill: {
    height: '100%',
    borderRadius: 2,
  },
  recentMeals: {
    marginTop: Spacing.base,
  },
  recentDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: Spacing.md,
  },
  recentLabel: {
    marginBottom: Spacing.sm,
    letterSpacing: 1,
  },
  recentMealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  recentMealInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  recentMealName: {
    marginBottom: 2,
  },
  emptyNutrition: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
  },

  // Chart
  chartCard: { padding: Spacing.base },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    marginBottom: Spacing.md,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barValue: {
    fontSize: 9,
    marginBottom: 2,
  },
  barTrack: {
    width: 20,
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 10,
    minHeight: 0,
  },
  barLabel: {
    fontSize: 10,
    marginTop: 4,
  },
  currentDayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  goalLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Body Metrics
  metricsCard: { padding: Spacing.base },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metricDivider: {
    width: 1,
    height: 48,
    marginHorizontal: Spacing.md,
  },
  weightProgress: {
    marginTop: Spacing.base,
  },
  weightTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  weightFill: {
    height: '100%',
    borderRadius: 3,
  },
  weightLabel: {
    marginTop: Spacing.xs,
    textAlign: 'center',
  },

  // Workout
  workoutDay: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
  },
  workoutDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutDayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  workoutDayRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  todayBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  typeLabel: { marginLeft: 2 },
  exerciseList: {
    marginTop: Spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  exerciseCheck: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  exerciseName: { flex: 1 },
  exerciseDone: { textDecorationLine: 'line-through' },

  // Cheat Day
  cheatDayCard: { padding: Spacing.base },
  cheatDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cheatDayInfo: { flex: 1 },
  cheatDayToggle: {
    width: 52,
    height: 32,
    borderRadius: 16,
    padding: 2,
    justifyContent: 'center',
  },
  cheatDayKnob: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'white',
  },
  cheatDayKnobActive: { alignSelf: 'flex-end' },
  bottomPadding: { height: Spacing['4xl'] },
});
