/**
 * TodaysPlan — Archetype-based daily meal plan section for the Home screen
 * Shows breakfast/lunch/dinner suggestions and a daily archetype tip
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ui/ThemedText';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/hooks/useTheme';
import { ArchetypeColors, Spacing, BorderRadius, Colors } from '@/constants/theme';
import { getDailyPlan, type MealSuggestion } from '@/lib/archetypePlans';
import type { ArchetypeKey } from '@/types/archetype';

interface TodaysPlanProps {
  archetype: ArchetypeKey;
}

function MealRow({ meal }: { meal: MealSuggestion }) {
  const { theme } = useTheme();

  const mealTypeLabels: Record<MealSuggestion['type'], string> = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
  };

  return (
    <View style={[styles.mealCard, { backgroundColor: theme.background }]}>
      <View style={styles.mealTopRow}>
        <View style={styles.mealTitleRow}>
          <ThemedText style={styles.mealEmoji}>{meal.emoji}</ThemedText>
          <View style={styles.mealInfo}>
            <ThemedText variant="label" color={theme.textMuted}>
              {mealTypeLabels[meal.type].toUpperCase()}
            </ThemedText>
            <ThemedText variant="bodyMedium" color={theme.text} numberOfLines={1}>
              {meal.name}
            </ThemedText>
          </View>
        </View>
        <View style={[styles.caloriePill, { backgroundColor: Colors.orangeLight + '35' }]}>
          <ThemedText variant="label" color={Colors.orange}>
            ~{meal.approxCalories} cal
          </ThemedText>
        </View>
      </View>
      <ThemedText variant="label" color={theme.textMuted} style={styles.foodList}>
        {meal.description}
      </ThemedText>
    </View>
  );
}

export function TodaysPlan({ archetype }: TodaysPlanProps) {
  const { theme } = useTheme();
  const colors = ArchetypeColors[archetype];
  const plan = getDailyPlan(archetype);

  return (
    <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.container}>
      <ThemedText variant="h3" style={styles.sectionTitle}>
        Today's Meal Rhythm
      </ThemedText>

      <Card style={styles.planCard}>
        {plan.meals.map((meal) => (
          <View key={meal.type} style={styles.mealCardWrap}>
            <MealRow meal={meal} />
          </View>
        ))}
      </Card>

      {/* Archetype tip */}
      <Card style={[styles.tipCard, { borderLeftColor: colors.accent }]}>
        <View style={styles.tipContent}>
          <Ionicons name="bulb-outline" size={18} color={colors.accent} />
          <ThemedText variant="label" color={theme.textSecondary} style={styles.tipText}>
            {plan.tip}
          </ThemedText>
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  planCard: {
    marginBottom: Spacing.md,
  },
  mealCardWrap: {
    marginBottom: Spacing.md,
  },
  mealCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
  },
  mealTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  mealTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealEmoji: {
    fontSize: 28,
    marginRight: Spacing.md,
    width: 36,
    textAlign: 'center',
  },
  mealInfo: {
    flex: 1,
  },
  caloriePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  foodList: {
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  tipCard: {
    borderLeftWidth: 3,
  },
  tipContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  tipText: {
    flex: 1,
    lineHeight: 18,
  },
});
