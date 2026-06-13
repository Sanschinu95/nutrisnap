/**
 * Confirm screen - Review and edit nutrition data before saving
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ui/ThemedText';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { MacroPillRow } from '@/components/ui/MacroPill';
import { useTheme } from '@/hooks/useTheme';
import { useDailyStore } from '@/stores/daily.store';
import { useUserStore } from '@/stores/user.store';
import { Spacing, Colors, BorderRadius } from '@/constants/theme';
import type { NutritionEntry, FoodItem, UserCorrection } from '@/types/nutrition';
import type { ArchetypeKey } from '@/constants/archetypes';

const SCAN_FEEDBACK: Record<ArchetypeKey, string[]> = {
  wolf: ['Strong fuel for the hunt.', 'Keep the protein sharp.'],
  bear: ['Steady energy for strength.', 'Balanced fuel builds power.'],
  lion: ['A disciplined choice.', 'Lead the day with control.'],
  deer: ['Light, sustainable momentum.', 'Simple fuel can carry you far.'],
  tigress: ['Excellent fuel for strength.', 'Stay fierce and fed.'],
  phoenix: ['High energy meal.', 'Keep rising.'],
  doe: ['Simple and sustainable.', 'Gentle progress still counts.'],
  swan: ['Balanced nutrition choice.', 'Elegance is consistency.'],
};

function getScanFeedback(archetype: ArchetypeKey | null, data: NutritionEntry): string {
  if (!archetype) return "Today's choices build tomorrow's results.";

  const proteinRatio = data.total_calories > 0
    ? (data.total_protein_g * 4) / data.total_calories
    : 0;
  const base = SCAN_FEEDBACK[archetype][0];

  if (proteinRatio < 0.22) {
    return `${base} Add 15g more protein for stronger recovery.`;
  }

  if (data.total_calories >= 650) {
    return `${base} Strong energy for the next stretch.`;
  }

  return `${base} ${SCAN_FEEDBACK[archetype][1]}`;
}

export default function ConfirmScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ data: string }>();
  const { addEntry, summary } = useDailyStore();
  const { calorieGoal, macroGoals, updateStreak, archetype } = useUserStore();

  const [nutritionData, setNutritionData] = useState<NutritionEntry | null>(null);
  const [originalData, setOriginalData] = useState<NutritionEntry | null>(null);
  const [isCheatDay, setIsCheatDay] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (params.data) {
      try {
        const parsed = JSON.parse(params.data) as NutritionEntry;
        setNutritionData(parsed);
        setOriginalData(parsed);
      } catch (e) {
        console.error('Failed to parse nutrition data:', e);
        router.back();
      }
    }
  }, [params.data]);

  const handleBack = () => {
    router.back();
  };

  const updateMealName = (name: string) => {
    if (!nutritionData) return;
    setNutritionData({ ...nutritionData, meal_name: name });
  };

  const updateFoodItem = (index: number, updates: Partial<FoodItem>) => {
    if (!nutritionData) return;
    
    const newItems = [...nutritionData.food_items];
    newItems[index] = { ...newItems[index], ...updates };
    
    // Recalculate totals
    const totalCalories = newItems.reduce((sum, item) => sum + item.calories, 0);
    const totalProtein = newItems.reduce((sum, item) => sum + item.protein_g, 0);
    const totalCarbs = newItems.reduce((sum, item) => sum + item.carbs_g, 0);
    const totalFat = newItems.reduce((sum, item) => sum + item.fat_g, 0);
    
    setNutritionData({
      ...nutritionData,
      food_items: newItems,
      total_calories: totalCalories,
      total_protein_g: totalProtein,
      total_carbs_g: totalCarbs,
      total_fat_g: totalFat,
    });
  };

  const toggleItemExpanded = (index: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return { text: '🟢 High', variant: 'success' as const };
      case 'medium':
        return { text: '🟡 Medium', variant: 'warning' as const };
      case 'low':
        return { text: '🔴 Low', variant: 'error' as const };
      default:
        return { text: '🟡 Medium', variant: 'warning' as const };
    }
  };

  const calculateCorrections = (): UserCorrection[] => {
    if (!nutritionData || !originalData) return [];
    
    const corrections: UserCorrection[] = [];
    
    if (nutritionData.meal_name !== originalData.meal_name) {
      corrections.push({
        field: 'meal_name',
        from: originalData.meal_name,
        to: nutritionData.meal_name,
      });
    }
    
    nutritionData.food_items.forEach((item, index) => {
      const original = originalData.food_items[index];
      if (!original) return;
      
      if (item.name !== original.name) {
        corrections.push({
          field: `food_items[${index}].name`,
          from: original.name,
          to: item.name,
        });
      }
      if (item.calories !== original.calories) {
        corrections.push({
          field: `food_items[${index}].calories`,
          from: original.calories,
          to: item.calories,
        });
      }
    });
    
    return corrections;
  };

  const handleSave = async () => {
    if (!nutritionData) return;
    
    try {
      setIsSaving(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      const corrections = calculateCorrections();
      const wasEdited = corrections.length > 0;
      
      const result = await addEntry({
        meal_name: nutritionData.meal_name,
        food_items: nutritionData.food_items,
        total_calories: nutritionData.total_calories,
        protein_g: nutritionData.total_protein_g,
        carbs_g: nutritionData.total_carbs_g,
        fat_g: nutritionData.total_fat_g,
        fiber_g: nutritionData.food_items.reduce((sum, item) => sum + item.fiber_g, 0),
        image_url: (nutritionData as any).image_url || null,
        raw_gemini_response: originalData,
        user_corrections: wasEdited ? corrections : null,
        user_accepted_without_edit: !wasEdited,
        is_cheat_day: isCheatDay,
        logged_at: new Date().toISOString(),
      });
      
      if (result.success) {
        await updateStreak();
        router.replace('/(tabs)/camera');
        Alert.alert('Success', 'Food logged successfully!');
      } else {
        Alert.alert('Error', result.error ?? 'Failed to save food entry');
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save food entry');
    } finally {
      setIsSaving(false);
    }
  };

  if (!nutritionData) {
    return null;
  }

  // Calculate progress with this meal
  const currentCalories = summary?.total_calories ?? 0;
  const newTotal = currentCalories + nutritionData.total_calories;
  const progress = Math.min(1, newTotal / calorieGoal);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <ThemedText variant="h3">Confirm Entry</ThemedText>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Meal name (editable) */}
          <TextInput
            style={[styles.mealNameInput, { color: theme.text }]}
            value={nutritionData.meal_name}
            onChangeText={updateMealName}
            placeholder="Meal name"
            placeholderTextColor={theme.textMuted}
          />

          <View style={[styles.feedbackCard, { backgroundColor: theme.card }]}>
            <View style={[styles.feedbackIcon, { backgroundColor: Colors.orangeLight + '40' }]}>
              <Ionicons name="sparkles-outline" size={20} color={Colors.orange} />
            </View>
            <View style={styles.feedbackText}>
              <ThemedText variant="label" color={theme.textMuted}>ARCHETYPE FEEDBACK</ThemedText>
              <ThemedText variant="bodyMedium">
                {getScanFeedback(archetype, nutritionData)}
              </ThemedText>
            </View>
          </View>

          {/* Food items */}
          <View style={styles.itemsContainer}>
            {nutritionData.food_items.map((item, index) => {
              const isExpanded = expandedItems.has(index);
              const confidence = getConfidenceBadge(item.confidence);
              
              return (
                <Card key={index} style={styles.itemCard}>
                  <Pressable
                    style={styles.itemHeader}
                    onPress={() => toggleItemExpanded(index)}
                  >
                    <View style={styles.itemInfo}>
                      <TextInput
                        style={[styles.itemName, { color: theme.text }]}
                        value={item.name}
                        onChangeText={(text) => updateFoodItem(index, { name: text })}
                        placeholder="Food name"
                        placeholderTextColor={theme.textMuted}
                      />
                      <TextInput
                        style={[styles.itemQuantity, { color: theme.textMuted }]}
                        value={item.quantity}
                        onChangeText={(text) => updateFoodItem(index, { quantity: text })}
                        placeholder="Quantity"
                        placeholderTextColor={theme.textMuted}
                      />
                    </View>
                    <View style={styles.itemRight}>
                      <TextInput
                        style={[styles.itemCalories, { color: theme.primary }]}
                        value={item.calories.toString()}
                        onChangeText={(text) => {
                          const cal = parseInt(text) || 0;
                          updateFoodItem(index, { calories: cal });
                        }}
                        keyboardType="number-pad"
                      />
                      <ThemedText variant="labelSmall" color={theme.textMuted}>
                        cal
                      </ThemedText>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={theme.textMuted}
                    />
                  </Pressable>
                  
                  {/* Confidence badge */}
                  <Badge
                    text={confidence.text}
                    variant={confidence.variant}
                    size="small"
                    style={styles.confidenceBadge}
                  />
                  
                  {/* Expanded macros */}
                  {isExpanded && (
                    <View style={styles.expandedContent}>
                      <View style={styles.macroInputRow}>
                        <View style={styles.macroInput}>
                          <ThemedText variant="label" color={theme.textMuted}>
                            Protein
                          </ThemedText>
                          <TextInput
                            style={[styles.macroValue, { color: Colors.brownMid }]}
                            value={item.protein_g.toString()}
                            onChangeText={(text) =>
                              updateFoodItem(index, { protein_g: parseFloat(text) || 0 })
                            }
                            keyboardType="decimal-pad"
                          />
                          <ThemedText variant="labelSmall" color={theme.textMuted}>g</ThemedText>
                        </View>
                        <View style={styles.macroInput}>
                          <ThemedText variant="label" color={theme.textMuted}>
                            Carbs
                          </ThemedText>
                          <TextInput
                            style={[styles.macroValue, { color: Colors.yellow }]}
                            value={item.carbs_g.toString()}
                            onChangeText={(text) =>
                              updateFoodItem(index, { carbs_g: parseFloat(text) || 0 })
                            }
                            keyboardType="decimal-pad"
                          />
                          <ThemedText variant="labelSmall" color={theme.textMuted}>g</ThemedText>
                        </View>
                        <View style={styles.macroInput}>
                          <ThemedText variant="label" color={theme.textMuted}>
                            Fat
                          </ThemedText>
                          <TextInput
                            style={[styles.macroValue, { color: Colors.oliveMid }]}
                            value={item.fat_g.toString()}
                            onChangeText={(text) =>
                              updateFoodItem(index, { fat_g: parseFloat(text) || 0 })
                            }
                            keyboardType="decimal-pad"
                          />
                          <ThemedText variant="labelSmall" color={theme.textMuted}>g</ThemedText>
                        </View>
                      </View>
                    </View>
                  )}
                </Card>
              );
            })}
          </View>

          {/* Totals */}
          <View style={styles.totalsSection}>
            <MacroPillRow
              protein={nutritionData.total_protein_g}
              carbs={nutritionData.total_carbs_g}
              fat={nutritionData.total_fat_g}
              showLabels
            />
          </View>

          {/* Preview ring */}
          <View style={styles.previewSection}>
            <ProgressRing
              progress={progress}
              size={100}
              strokeWidth={8}
              centerContent={
                <View style={styles.ringContent}>
                  <ThemedText variant="h3" color={theme.primary}>
                    {newTotal}
                  </ThemedText>
                  <ThemedText variant="labelSmall" color={theme.textMuted}>
                    of {calorieGoal}
                  </ThemedText>
                </View>
              }
            />
            <ThemedText
              variant="label"
              color={theme.textMuted}
              style={styles.previewLabel}
            >
              After this meal
            </ThemedText>
          </View>

          {/* Cheat day toggle */}
          <Pressable
            style={[styles.cheatDayRow, { backgroundColor: theme.card }]}
            onPress={() => setIsCheatDay(!isCheatDay)}
          >
            <ThemedText variant="bodyMedium">
              🔥 Mark as cheat day
            </ThemedText>
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: isCheatDay ? theme.primary : 'transparent',
                  borderColor: isCheatDay ? theme.primary : theme.border,
                },
              ]}
            >
              {isCheatDay && (
                <Ionicons name="checkmark" size={14} color="white" />
              )}
            </View>
          </Pressable>
        </ScrollView>

        {/* Bottom actions */}
        <View style={[styles.bottomActions, { backgroundColor: theme.background }]}>
          <Button
            title="Fuel Your Journey"
            onPress={handleSave}
            loading={isSaving}
            variant="primary"
            size="large"
            fullWidth
          />
          <Button
            title="Edit Manually"
            onPress={() => {}}
            variant="ghost"
            size="medium"
            fullWidth
            style={styles.editButton}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  backButton: {
    padding: Spacing.sm,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  mealNameInput: {
    fontSize: 24,
    fontFamily: 'Nunito_800ExtraBold',
    marginBottom: Spacing.xl,
  },
  feedbackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  feedbackIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackText: {
    flex: 1,
    gap: 2,
  },
  itemsContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  itemCard: {
    padding: Spacing.base,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  itemQuantity: {
    fontSize: 14,
    marginTop: 2,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: Spacing.sm,
  },
  itemCalories: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'right',
    minWidth: 50,
  },
  confidenceBadge: {
    marginTop: Spacing.sm,
  },
  expandedContent: {
    marginTop: Spacing.base,
    paddingTop: Spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  macroInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  macroValue: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    minWidth: 40,
    textAlign: 'right',
  },
  totalsSection: {
    marginBottom: Spacing.xl,
  },
  previewSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  ringContent: {
    alignItems: 'center',
  },
  previewLabel: {
    marginTop: Spacing.sm,
  },
  cheatDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomActions: {
    padding: Spacing.xl,
    paddingBottom: Spacing['2xl'],
  },
  editButton: {
    marginTop: Spacing.sm,
  },
});
