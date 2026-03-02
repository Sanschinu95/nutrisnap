/**
 * Plan tab - Archetype, meal plan, habits, cheat day
 */

import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ui/ThemedText';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MacroPillRow } from '@/components/ui/MacroPill';
import { SkeletonCard } from '@/components/ui/SkeletonLoader';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/user.store';
import { useDailyStore } from '@/stores/daily.store';
import { getArchetype, type ArchetypeKey } from '@/constants/archetypes';
import { Spacing, Colors, BorderRadius } from '@/constants/theme';

// Static meal suggestions based on archetype
const MEAL_SUGGESTIONS: Record<ArchetypeKey, { breakfast: string; lunch: string; dinner: string }> = {
  wolf: {
    breakfast: 'Egg white omelette with turkey bacon',
    lunch: 'Grilled chicken salad with olive oil',
    dinner: 'Lean steak with roasted vegetables',
  },
  bear: {
    breakfast: 'Oatmeal with banana and honey',
    lunch: 'Brown rice bowl with grilled salmon',
    dinner: 'Pasta with turkey meatballs',
  },
  lion: {
    breakfast: 'Skip breakfast (intermittent fasting)',
    lunch: 'Grilled chicken with quinoa',
    dinner: 'Baked fish with sweet potato',
  },
  deer: {
    breakfast: 'Green smoothie with plant protein',
    lunch: 'Buddha bowl with chickpeas',
    dinner: 'Veggie stir-fry with tofu',
  },
  tigress: {
    breakfast: 'Protein pancakes with berries',
    lunch: 'Tuna salad with avocado',
    dinner: 'Grilled chicken breast with greens',
  },
  phoenix: {
    breakfast: 'Greek yogurt with granola',
    lunch: 'Quinoa salad with grilled chicken',
    dinner: 'Salmon with roasted vegetables',
  },
  doe: {
    breakfast: 'Acai bowl with fresh fruit',
    lunch: 'Garden salad with nuts and seeds',
    dinner: 'Lentil soup with whole grain bread',
  },
  lioness: {
    breakfast: 'Scrambled eggs with whole wheat toast',
    lunch: 'Turkey wrap with vegetables',
    dinner: 'Grilled fish with brown rice',
  },
};

export default function PlanScreen() {
  const { theme, isDark } = useTheme();
  const { profile, archetype, macroGoals, isLoading } = useUserStore();
  const { isCheatDay, toggleCheatDay, loadToday } = useDailyStore();
  const [completedHabits, setCompletedHabits] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  const archetypeInfo = archetype ? getArchetype(archetype) : null;
  const meals = archetype ? MEAL_SUGGESTIONS[archetype] : null;

  const handleHabitToggle = (habit: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCompletedHabits((prev) => {
      const next = new Set(prev);
      if (next.has(habit)) {
        next.delete(habit);
      } else {
        next.add(habit);
      }
      return next;
    });
  };

  const handleCheatDayToggle = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await toggleCheatDay();
  };

  if (isLoading || !archetypeInfo) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <ThemedText variant="h2">Your Plan</ThemedText>
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText variant="h2">Your Plan</ThemedText>
          <ThemedText variant="label" color={theme.textMuted}>
            {today}
          </ThemedText>
        </View>

        {/* Archetype Card */}
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
                {profile?.archetype_tier === 'base' ? 'Base' : profile?.archetype_tier} Tier
              </ThemedText>
            </View>
          </View>
          <ThemedText variant="body" color={Colors.darkText} style={styles.archetypeDesc}>
            {archetypeInfo.description}
          </ThemedText>
          <MacroPillRow
            protein={macroGoals.protein}
            carbs={macroGoals.carbs}
            fat={macroGoals.fat}
            showLabels
            size="small"
            style={styles.macroRow}
          />
        </Card>

        {/* Meal Plan */}
        <View style={styles.section}>
          <ThemedText variant="h3" style={styles.sectionTitle}>
            Today's Meal Plan
          </ThemedText>
          
          {meals && ['breakfast', 'lunch', 'dinner'].map((mealType) => (
            <Card key={mealType} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <ThemedText variant="bodyMedium" style={styles.mealType}>
                  {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
                </ThemedText>
                <ThemedText variant="label" color={theme.textMuted}>
                  ~{mealType === 'breakfast' ? '400' : mealType === 'lunch' ? '500' : '600'} cal
                </ThemedText>
              </View>
              <ThemedText variant="body" color={theme.textSecondary}>
                {meals[mealType as keyof typeof meals]}
              </ThemedText>
              <Button
                title="Log It"
                onPress={() => {}}
                variant="ghost"
                size="small"
                style={styles.logButton}
              />
            </Card>
          ))}
        </View>

        {/* Habits */}
        <View style={styles.section}>
          <ThemedText variant="h3" style={styles.sectionTitle}>
            Daily Habits
          </ThemedText>
          
          <Card style={styles.habitsCard}>
            {archetypeInfo.defaultHabits.map((habit, index) => (
              <Pressable
                key={habit}
                style={styles.habitRow}
                onPress={() => handleHabitToggle(habit)}
              >
                <View
                  style={[
                    styles.habitCheckbox,
                    {
                      backgroundColor: completedHabits.has(habit)
                        ? theme.primary
                        : 'transparent',
                      borderColor: completedHabits.has(habit)
                        ? theme.primary
                        : theme.border,
                    },
                  ]}
                >
                  {completedHabits.has(habit) && (
                    <Ionicons name="checkmark" size={14} color="white" />
                  )}
                </View>
                <ThemedText
                  variant="body"
                  style={[
                    styles.habitText,
                    completedHabits.has(habit) && styles.habitCompleted,
                  ]}
                  color={completedHabits.has(habit) ? theme.textMuted : theme.text}
                >
                  {habit}
                </ThemedText>
              </Pressable>
            ))}
          </Card>
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
                    ? 'Enjoy it. You earned it. 🎉'
                    : 'Take a break from calorie tracking'}
                </ThemedText>
              </View>
              <Pressable
                style={[
                  styles.cheatDayToggle,
                  {
                    backgroundColor: isCheatDay ? Colors.orange : theme.border,
                  },
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
    marginBottom: Spacing.xl,
  },
  archetypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  archetypeEmoji: {
    fontSize: 48,
    marginRight: Spacing.base,
  },
  archetypeInfo: {
    flex: 1,
  },
  archetypeDesc: {
    marginBottom: Spacing.base,
  },
  macroRow: {
    marginTop: Spacing.sm,
  },
  section: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  mealCard: {
    marginBottom: Spacing.md,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  mealType: {
    textTransform: 'capitalize',
  },
  logButton: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
  },
  habitsCard: {
    padding: Spacing.base,
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  habitCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  habitText: {
    flex: 1,
  },
  habitCompleted: {
    textDecorationLine: 'line-through',
  },
  cheatDayCard: {
    padding: Spacing.base,
  },
  cheatDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cheatDayInfo: {
    flex: 1,
  },
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
  cheatDayKnobActive: {
    alignSelf: 'flex-end',
  },
  bottomPadding: {
    height: Spacing['4xl'],
  },
});
