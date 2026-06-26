import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Button } from '@/components/ui/Button';
import { ThemedText } from '@/components/ui/ThemedText';
import { useDailyStore } from '@/stores/daily.store';
import { useUserStore } from '@/stores/user.store';
import { useAuthGate } from '@/hooks/useAuthGate';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import type { FoodItem, MealSource, NutritionEntry, UserCorrection } from '@/types/nutrition';
import { collectTrainingData } from '@/lib/datasetCollector';

type FeedbackState = 'correct' | 'incorrect' | null;

export default function ConfirmScreen() {
  const params = useLocalSearchParams<{ data: string; feedback?: string }>();
  const { addEntry, removeEntry, summary } = useDailyStore();
  const { calorieGoal, updateStreak } = useUserStore();
  const { requireAuth } = useAuthGate();
  const [nutritionData, setNutritionData] = useState<NutritionEntry | null>(null);
  const [originalData, setOriginalData] = useState<NutritionEntry | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isSaving, setIsSaving] = useState(false);
  const source: MealSource = ((nutritionData as any)?.source ?? 'scan') as MealSource;
  const isManual = source === 'manual';
  const successOpacity = useSharedValue(0);
  const successX = useSharedValue(0);
  const successY = useSharedValue(0);

  const successStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
    transform: [{ translateX: successX.value }, { translateY: successY.value }, { scale: successOpacity.value ? 1 : 0.7 }],
  }));

  useEffect(() => {
    if (!params.data) return;
    try {
      const parsed = JSON.parse(params.data) as NutritionEntry;
      setNutritionData(parsed);
      setOriginalData(parsed);
      if (params.feedback === 'incorrect') {
        setFeedback('incorrect');
      }
    } catch (e) {
      console.error('Failed to parse nutrition data:', e);
      router.back();
    }
  }, [params.data, params.feedback]);

  const totals = useMemo(() => {
    if (!nutritionData) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    return {
      calories: nutritionData.total_calories,
      protein: nutritionData.total_protein_g,
      carbs: nutritionData.total_carbs_g,
      fat: nutritionData.total_fat_g,
    };
  }, [nutritionData]);

  const updateFoodItem = (index: number, updates: Partial<FoodItem>) => {
    if (!nutritionData) return;
    const foodItems = [...nutritionData.food_items];
    foodItems[index] = { ...foodItems[index], ...updates };
    setNutritionData({
      ...nutritionData,
      food_items: foodItems,
      total_calories: foodItems.reduce((sum, item) => sum + item.calories, 0),
      total_protein_g: foodItems.reduce((sum, item) => sum + item.protein_g, 0),
      total_carbs_g: foodItems.reduce((sum, item) => sum + item.carbs_g, 0),
      total_fat_g: foodItems.reduce((sum, item) => sum + item.fat_g, 0),
    });
  };

  const calculateCorrections = (): UserCorrection[] => {
    if (!nutritionData || !originalData) return [];
    const corrections: UserCorrection[] = [];
    if (nutritionData.meal_name !== originalData.meal_name) {
      corrections.push({ field: 'meal_name', from: originalData.meal_name, to: nutritionData.meal_name });
    }
    nutritionData.food_items.forEach((item, index) => {
      const original = originalData.food_items[index];
      if (!original) return;
      (['name', 'calories', 'protein_g', 'carbs_g', 'fat_g'] as const).forEach((field) => {
        if (item[field] !== original[field]) {
          corrections.push({ field: `food_items[${index}].${field}`, from: original[field], to: item[field] });
        }
      });
    });
    return corrections;
  };

  const handleSave = async () => {
    if (!nutritionData) return;
    requireAuth(async () => {
      try {
        setIsSaving(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const corrections = calculateCorrections();
        const existingEntryId = (nutritionData as any).existing_entry_id as string | undefined;
        if (existingEntryId) {
          await removeEntry(existingEntryId);
        }

        const result = await addEntry({
          meal_name: nutritionData.meal_name,
          food_items: nutritionData.food_items,
          total_calories: nutritionData.total_calories,
          protein_g: nutritionData.total_protein_g,
          carbs_g: nutritionData.total_carbs_g,
          fat_g: nutritionData.total_fat_g,
          fiber_g: nutritionData.food_items.reduce((sum, item) => sum + item.fiber_g, 0),
          image_url: (nutritionData as any).image_url || null,
          raw_ai_response: isManual ? null : originalData,
          user_corrections: corrections.length > 0 || feedback === 'incorrect' ? corrections : null,
          user_accepted_without_edit: feedback !== 'incorrect' && corrections.length === 0,
          is_cheat_day: false,
          logged_at: (nutritionData as any).logged_at ?? new Date().toISOString(),
          source,
        });
        if (result.success) {
          await updateStreak();

          // Fire-and-forget dataset collection. Runs AFTER main save succeeds.
          // Failure is swallowed inside collectTrainingData; .catch here is a
          // belt-and-suspenders second safety net. Never awaited — never blocks
          // the success animation or navigation.
          const isCorrected = feedback === 'incorrect' && corrections.length > 0;
          const feedbackTypeForDataset: 'confirmed' | 'corrected' | 'rejected' | 'none' =
            isManual
              ? 'none'
              : feedback === 'correct'
                ? 'confirmed'
                : feedback === 'incorrect'
                  ? (isCorrected ? 'corrected' : 'rejected')
                  : 'none';
          collectTrainingData({
            imageUrl: (nutritionData as any).image_url ?? '',
            aiPrediction: !isManual && originalData
              ? {
                  food_name: originalData.meal_name,
                  calories: originalData.total_calories,
                  protein_g: originalData.total_protein_g,
                  carbs_g: originalData.total_carbs_g,
                  fat_g: originalData.total_fat_g,
                  raw_response: originalData,
                }
              : null,
            userCorrection: isManual || isCorrected
              ? {
                  food_name: nutritionData.meal_name,
                  calories: nutritionData.total_calories,
                  protein_g: nutritionData.total_protein_g,
                  carbs_g: nutritionData.total_carbs_g,
                  fat_g: nutritionData.total_fat_g,
                }
              : null,
            feedbackType: feedbackTypeForDataset,
            source: isManual ? 'manual' : 'scan',
          }).catch(() => {});

          successOpacity.value = withSequence(withTiming(1, { duration: 120 }), withTiming(1, { duration: 420 }), withTiming(0, { duration: 180 }));
          successY.value = withSequence(withSpring(-70), withTiming(260, { duration: 520 }));
          successX.value = withTiming(-90, { duration: 640 });
          setTimeout(() => router.replace('/(tabs)/home'), 720);
        } else {
          Alert.alert('Save failed', result.error ?? 'Please try again.');
        }
      } finally {
        setIsSaving(false);
      }
    });
  };

  if (!nutritionData) return null;

  const currentCalories = summary?.total_calories ?? 0;
  const projected = currentCalories + nutritionData.total_calories;
  const projectedProgress = calorieGoal > 0 ? Math.min(1, projected / calorieGoal) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
        <View style={styles.header}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="close" size={22} color={Colors.brown} />
          </Pressable>
          <ThemedText variant="bodySemiBold">{isManual ? 'Manual Entry' : 'Scan Result'}</ThemedText>
          <View style={styles.iconButton} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <View style={styles.foodImageFallback}>
              {(nutritionData as any).image_url ? (
                <Image source={{ uri: (nutritionData as any).image_url }} style={styles.foodImage} />
              ) : (
                <Ionicons name="restaurant-outline" size={58} color={Colors.olive} />
              )}
            </View>
            <TextInput
              value={nutritionData.meal_name}
              onChangeText={(mealName) => setNutritionData({ ...nutritionData, meal_name: mealName })}
              style={styles.mealName}
              placeholder="Food name"
              placeholderTextColor={Colors.muted}
            />
            <View style={styles.calorieLine}>
              <ThemedText variant="h1" color={Colors.olive}>{totals.calories}</ThemedText>
              <ThemedText variant="body" color={Colors.muted}>calories</ThemedText>
            </View>
          </View>

          <View style={styles.macroCard}>
            <MacroInput label="Protein" value={totals.protein} color={Colors.olive} onChange={(value) => updateFoodItem(0, { protein_g: value })} />
            <MacroInput label="Carbs" value={totals.carbs} color={Colors.orange} onChange={(value) => updateFoodItem(0, { carbs_g: value })} />
            <MacroInput label="Fat" value={totals.fat} color={Colors.brownMid} onChange={(value) => updateFoodItem(0, { fat_g: value })} />
          </View>

          {!isManual && (
            <View style={styles.feedbackCard}>
              <ThemedText variant="bodySemiBold">Was this scan right?</ThemedText>
              <View style={styles.feedbackRow}>
                <Pressable
                  style={[styles.feedbackButton, feedback === 'correct' && styles.feedbackActive]}
                  onPress={() => setFeedback('correct')}
                >
                  <Ionicons name="thumbs-up-outline" size={18} color={feedback === 'correct' ? Colors.white : Colors.olive} />
                  <ThemedText variant="button" color={feedback === 'correct' ? Colors.white : Colors.olive}>Correct</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.feedbackButton, feedback === 'incorrect' && styles.feedbackActiveOrange]}
                  onPress={() => setFeedback('incorrect')}
                >
                  <Ionicons name="thumbs-down-outline" size={18} color={feedback === 'incorrect' ? Colors.white : Colors.orange} />
                  <ThemedText variant="button" color={feedback === 'incorrect' ? Colors.white : Colors.orange}>Incorrect</ThemedText>
                </Pressable>
              </View>
            </View>
          )}

          {(isManual || feedback === 'incorrect') && (
            <View style={styles.correctionCard}>
              <ThemedText variant="bodySemiBold">{isManual ? 'Adjust details' : 'Submit correction'}</ThemedText>
              {nutritionData.food_items.map((item, index) => (
                <View key={index} style={styles.foodRow}>
                  <TextInput
                    value={item.name}
                    onChangeText={(name) => updateFoodItem(index, { name })}
                    style={styles.textInput}
                    placeholder="Food name"
                    placeholderTextColor={Colors.muted}
                  />
                  <TextInput
                    value={String(item.calories)}
                    onChangeText={(value) => updateFoodItem(index, { calories: parseInt(value, 10) || 0 })}
                    style={styles.textInput}
                    keyboardType="number-pad"
                    placeholder="Calories"
                    placeholderTextColor={Colors.muted}
                  />
                  <View style={styles.inlineMacroInputs}>
                    <SmallMacroField label="Protein" value={item.protein_g} onChange={(protein_g) => updateFoodItem(index, { protein_g })} />
                    <SmallMacroField label="Carbs" value={item.carbs_g} onChange={(carbs_g) => updateFoodItem(index, { carbs_g })} />
                    <SmallMacroField label="Fat" value={item.fat_g} onChange={(fat_g) => updateFoodItem(index, { fat_g })} />
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.projectedCard}>
            <View>
              <ThemedText variant="label" color={Colors.muted}>AFTER THIS MEAL</ThemedText>
              <ThemedText variant="h2">{projected} / {calorieGoal}</ThemedText>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${projectedProgress * 100}%` }]} />
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomActions}>
          <Button title={isManual ? 'Save' : 'Confirm'} onPress={handleSave} loading={isSaving} size="large" fullWidth />
          {!isManual && (
            <Button title="Edit" variant="ghost" onPress={() => setFeedback('incorrect')} fullWidth style={styles.editButton} />
          )}
        </View>
        <Animated.View pointerEvents="none" style={[styles.successFly, successStyle]}>
          <Ionicons name="fast-food" size={28} color={Colors.orange} />
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MacroInput({ label, value, color, onChange }: { label: string; value: number; color: string; onChange: (value: number) => void }) {
  return (
    <View style={styles.macroInput}>
      <ThemedText variant="label" color={Colors.muted}>{label}</ThemedText>
      <TextInput
        value={String(Math.round(value))}
        onChangeText={(text) => onChange(parseFloat(text) || 0)}
        keyboardType="decimal-pad"
        style={[styles.macroValue, { color }]}
      />
      <ThemedText variant="labelSmall" color={Colors.muted}>g</ThemedText>
    </View>
  );
}

function SmallMacroField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <View style={styles.smallMacroField}>
      <ThemedText variant="labelSmall" color={Colors.muted}>{label}</ThemedText>
      <TextInput
        value={String(Math.round(value))}
        onChangeText={(text) => onChange(parseFloat(text) || 0)}
        keyboardType="decimal-pad"
        style={styles.smallMacroInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboard: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  foodImageFallback: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: Colors.oliveLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  foodImage: {
    width: '100%',
    height: '100%',
  },
  mealName: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: 'Nunito_800ExtraBold',
    color: Colors.brown,
    textAlign: 'center',
    minWidth: '80%',
  },
  calorieLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  macroCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  macroInput: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 22,
    fontFamily: 'Nunito_800ExtraBold',
    textAlign: 'center',
    minWidth: 52,
  },
  feedbackCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  feedbackButton: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  feedbackActive: {
    backgroundColor: Colors.olive,
    borderColor: Colors.olive,
  },
  feedbackActiveOrange: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  correctionCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  foodRow: {
    gap: Spacing.sm,
  },
  inlineMacroInputs: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  smallMacroField: {
    flex: 1,
  },
  smallMacroInput: {
    minHeight: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    color: Colors.brown,
    fontSize: 15,
  },
  textInput: {
    minHeight: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    color: Colors.brown,
    fontSize: 16,
  },
  projectedCard: {
    backgroundColor: Colors.orangePale,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.orangeLight,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
    overflow: 'hidden',
    marginTop: Spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.orange,
  },
  bottomActions: {
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  editButton: {
    marginTop: Spacing.sm,
  },
  successFly: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 116,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
