/**
 * Onboarding - 9-step Typeform-style flow
 */

import { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/user.store';
import { ARCHETYPES, type ArchetypeKey } from '@/constants/archetypes';
import { ArchetypeColors, Spacing, BorderRadius, Colors } from '@/constants/theme';
import type { BiologicalSex, GoalType } from '@/types/archetype';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type StepData = {
  name: string;
  biologicalSex: BiologicalSex | null;
  age: number | null;
  weight: number | null; // kg
  height: number | null; // cm
  goal: GoalType | null;
  activityLevel: number | null; // 1-5
  archetype: ArchetypeKey | null;
  notificationsEnabled: boolean;
};

const ACTIVITY_OPTIONS = [
  { value: 1, label: 'Sedentary', desc: 'Little to no exercise' },
  { value: 2, label: 'Light', desc: '1-2 days/week' },
  { value: 3, label: 'Moderate', desc: '3-5 days/week' },
  { value: 4, label: 'Active', desc: '6-7 days/week' },
  { value: 5, label: 'Very Active', desc: 'Pro athlete level' },
];

const GOAL_OPTIONS = [
  { value: 'cut', label: '🔪 Cut', desc: 'Lose fat, maintain muscle' },
  { value: 'maintain', label: '⚖️ Maintain', desc: 'Stay at current weight' },
  { value: 'bulk', label: '💪 Bulk', desc: 'Gain muscle, minimize fat' },
];

const MALE_ARCHETYPES: ArchetypeKey[] = ['wolf', 'bear', 'lion', 'deer'];
const FEMALE_ARCHETYPES: ArchetypeKey[] = ['tigress', 'phoenix', 'doe', 'lioness'];

export default function OnboardingScreen() {
  const { theme, colorScheme } = useTheme();
  const { completeOnboarding, profile } = useUserStore();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<StepData>({
    name: '',
    biologicalSex: null,
    age: null,
    weight: null,
    height: null,
    goal: null,
    activityLevel: null,
    archetype: null,
    notificationsEnabled: true,
  });
  
  const progress = useSharedValue(0);
  const scrollRef = useRef<FlatList>(null);

  const TOTAL_STEPS = 9;

  const updateData = useCallback(<K extends keyof StepData>(key: K, value: StepData[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

  const canProceed = useCallback((): boolean => {
    switch (currentStep) {
      case 0: return data.name.trim().length >= 2;
      case 1: return data.biologicalSex !== null;
      case 2: return data.age !== null && data.age >= 13 && data.age <= 120;
      case 3: return data.weight !== null && data.weight >= 30 && data.weight <= 300;
      case 4: return data.height !== null && data.height >= 100 && data.height <= 250;
      case 5: return data.goal !== null;
      case 6: return data.activityLevel !== null;
      case 7: return data.archetype !== null;
      case 8: return true; // Notifications is optional
      default: return false;
    }
  }, [currentStep, data]);

  const goNext = useCallback(async () => {
    if (!canProceed()) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (currentStep < TOTAL_STEPS - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      progress.value = withSpring((nextStep + 1) / TOTAL_STEPS);
      scrollRef.current?.scrollToIndex({ index: nextStep, animated: true });
    } else {
      // Final step - submit
      await handleComplete();
    }
  }, [currentStep, canProceed, progress]);

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      progress.value = withSpring((prevStep + 1) / TOTAL_STEPS);
      scrollRef.current?.scrollToIndex({ index: prevStep, animated: true });
    }
  }, [currentStep, progress]);

  const handleComplete = async () => {
    // Validate all required data is present
    if (
      !data.name.trim() ||
      !data.biologicalSex ||
      !data.age ||
      !data.weight ||
      !data.height ||
      !data.goal ||
      !data.activityLevel ||
      !data.archetype
    ) {
      Alert.alert('Error', 'Please complete all required fields');
      return;
    }
    
    try {
      setIsSubmitting(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      const result = await completeOnboarding({
        name: data.name.trim(),
        biological_sex: data.biologicalSex,
        age: data.age,
        weight_kg: data.weight,
        height_cm: data.height,
        goal_type: data.goal,
        activity_level: data.activityLevel,
        archetype: data.archetype,
      });
      
      if (result.success) {
        router.replace('/(tabs)/camera');
      } else {
        Alert.alert('Error', result.error ?? 'Failed to save profile');
      }
    } catch (error) {
      console.error('Onboarding error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const archetypes = data.biologicalSex === 'female' ? FEMALE_ARCHETYPES : MALE_ARCHETYPES;

  const renderStep = useCallback(({ item, index }: { item: number; index: number }) => {
    switch (index) {
      case 0:
        return (
          <StepContainer>
            <ThemedText variant="h2" style={styles.stepTitle}>
              What's your name? 👋
            </ThemedText>
            <TextInput
              style={[styles.textInput, { color: theme.text, borderColor: theme.border }]}
              value={data.name}
              onChangeText={(text) => updateData('name', text)}
              placeholder="Enter your name"
              placeholderTextColor={theme.textMuted}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={goNext}
            />
          </StepContainer>
        );
        
      case 1:
        return (
          <StepContainer>
            <ThemedText variant="h2" style={styles.stepTitle}>
              Biological Sex 🧬
            </ThemedText>
            <ThemedText variant="body" color={theme.textMuted} style={styles.stepSubtitle}>
              This helps calculate your metabolism accurately
            </ThemedText>
            <View style={styles.optionsGrid}>
              {(['male', 'female'] as const).map((sex) => (
                <Pressable
                  key={sex}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: data.biologicalSex === sex ? theme.primary : theme.card,
                      borderColor: data.biologicalSex === sex ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => {
                    updateData('biologicalSex', sex);
                    // Reset archetype when sex changes
                    updateData('archetype', null);
                  }}
                >
                  <ThemedText
                    variant="h3"
                    color={data.biologicalSex === sex ? 'white' : theme.text}
                  >
                    {sex === 'male' ? '♂️' : '♀️'}
                  </ThemedText>
                  <ThemedText
                    variant="bodyMedium"
                    color={data.biologicalSex === sex ? 'white' : theme.text}
                  >
                    {sex.charAt(0).toUpperCase() + sex.slice(1)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </StepContainer>
        );
        
      case 2:
        return (
          <StepContainer>
            <ThemedText variant="h2" style={styles.stepTitle}>
              How old are you? 🎂
            </ThemedText>
            <TextInput
              style={[styles.textInput, { color: theme.text, borderColor: theme.border }]}
              value={data.age?.toString() ?? ''}
              onChangeText={(text) => updateData('age', parseInt(text) || null)}
              placeholder="Enter your age"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              returnKeyType="next"
              onSubmitEditing={goNext}
            />
          </StepContainer>
        );
        
      case 3:
        return (
          <StepContainer>
            <ThemedText variant="h2" style={styles.stepTitle}>
              Current weight? ⚖️
            </ThemedText>
            <View style={styles.inputWithUnit}>
              <TextInput
                style={[styles.textInput, styles.inputFlex, { color: theme.text, borderColor: theme.border }]}
                value={data.weight?.toString() ?? ''}
                onChangeText={(text) => updateData('weight', parseFloat(text) || null)}
                placeholder="Weight"
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
                returnKeyType="next"
                onSubmitEditing={goNext}
              />
              <ThemedText variant="h3" color={theme.textMuted} style={styles.unitLabel}>
                kg
              </ThemedText>
            </View>
          </StepContainer>
        );
        
      case 4:
        return (
          <StepContainer>
            <ThemedText variant="h2" style={styles.stepTitle}>
              Height? 📏
            </ThemedText>
            <View style={styles.inputWithUnit}>
              <TextInput
                style={[styles.textInput, styles.inputFlex, { color: theme.text, borderColor: theme.border }]}
                value={data.height?.toString() ?? ''}
                onChangeText={(text) => updateData('height', parseFloat(text) || null)}
                placeholder="Height"
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
                returnKeyType="next"
                onSubmitEditing={goNext}
              />
              <ThemedText variant="h3" color={theme.textMuted} style={styles.unitLabel}>
                cm
              </ThemedText>
            </View>
          </StepContainer>
        );
        
      case 5:
        return (
          <StepContainer>
            <ThemedText variant="h2" style={styles.stepTitle}>
              What's your goal? 🎯
            </ThemedText>
            <View style={styles.optionsStack}>
              {GOAL_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.optionRow,
                    {
                      backgroundColor: data.goal === option.value ? theme.primary : theme.card,
                      borderColor: data.goal === option.value ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => updateData('goal', option.value as GoalType)}
                >
                  <ThemedText
                    variant="bodyMedium"
                    color={data.goal === option.value ? 'white' : theme.text}
                  >
                    {option.label}
                  </ThemedText>
                  <ThemedText
                    variant="label"
                    color={data.goal === option.value ? 'rgba(255,255,255,0.8)' : theme.textMuted}
                  >
                    {option.desc}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </StepContainer>
        );
        
      case 6:
        return (
          <StepContainer>
            <ThemedText variant="h2" style={styles.stepTitle}>
              Activity level? 🏃
            </ThemedText>
            <View style={styles.optionsStack}>
              {ACTIVITY_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.optionRow,
                    {
                      backgroundColor: data.activityLevel === option.value ? theme.primary : theme.card,
                      borderColor: data.activityLevel === option.value ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => updateData('activityLevel', option.value)}
                >
                  <ThemedText
                    variant="bodyMedium"
                    color={data.activityLevel === option.value ? 'white' : theme.text}
                  >
                    {option.label}
                  </ThemedText>
                  <ThemedText
                    variant="label"
                    color={data.activityLevel === option.value ? 'rgba(255,255,255,0.8)' : theme.textMuted}
                  >
                    {option.desc}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </StepContainer>
        );
        
      case 7:
        return (
          <StepContainer>
            <ThemedText variant="h2" style={styles.stepTitle}>
              Pick your archetype 🦁
            </ThemedText>
            <ThemedText variant="body" color={theme.textMuted} style={styles.stepSubtitle}>
              This defines your macro ratios and meal style
            </ThemedText>
            <View style={styles.archetypeGrid}>
              {archetypes.map((key) => {
                const archetype = ARCHETYPES[key];
                const colors = ArchetypeColors[key];
                const isSelected = data.archetype === key;
                
                return (
                  <Pressable
                    key={key}
                    style={[
                      styles.archetypeCard,
                      {
                        backgroundColor: isSelected ? colors.primary : theme.card,
                        borderColor: isSelected ? colors.primary : theme.border,
                      },
                    ]}
                    onPress={() => updateData('archetype', key)}
                  >
                    <View
                      style={[
                        styles.archetypeIcon,
                        { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : colors.primary },
                      ]}
                    >
                      <ThemedText variant="h2">{archetype.emoji}</ThemedText>
                    </View>
                    <ThemedText
                      variant="bodyMedium"
                      color={isSelected ? 'white' : theme.text}
                      style={styles.archetypeName}
                    >
                      {archetype.name}
                    </ThemedText>
                    <ThemedText
                      variant="labelSmall"
                      color={isSelected ? 'rgba(255,255,255,0.8)' : theme.textMuted}
                      align="center"
                    >
                      {archetype.description}
                    </ThemedText>
                    <ThemedText
                      variant="labelSmall"
                      color={isSelected ? 'rgba(255,255,255,0.7)' : colors.primary}
                      style={styles.archetypeMacros}
                    >
                      P{Math.round(archetype.macros.protein * 100)} C{Math.round(archetype.macros.carbs * 100)} F{Math.round(archetype.macros.fat * 100)}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </StepContainer>
        );
        
      case 8:
        return (
          <StepContainer>
            <View style={[styles.celebrationIcon, { backgroundColor: theme.primary }]}>
              <Ionicons name="checkmark-circle" size={64} color="white" />
            </View>
            <ThemedText variant="h2" style={styles.stepTitle}>
              You're all set! 🎉
            </ThemedText>
            <ThemedText variant="body" color={theme.textMuted} style={styles.stepSubtitle}>
              Would you like to receive daily reminders to track your meals?
            </ThemedText>
            <View style={styles.notificationOptions}>
              <Pressable
                style={[
                  styles.notificationCard,
                  {
                    backgroundColor: data.notificationsEnabled ? theme.primary : theme.card,
                    borderColor: data.notificationsEnabled ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => updateData('notificationsEnabled', true)}
              >
                <Ionicons
                  name="notifications"
                  size={32}
                  color={data.notificationsEnabled ? 'white' : theme.textMuted}
                />
                <ThemedText
                  variant="bodyMedium"
                  color={data.notificationsEnabled ? 'white' : theme.text}
                >
                  Yes, remind me
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.notificationCard,
                  {
                    backgroundColor: !data.notificationsEnabled ? theme.card : theme.card,
                    borderColor: !data.notificationsEnabled ? theme.text : theme.border,
                  },
                ]}
                onPress={() => updateData('notificationsEnabled', false)}
              >
                <Ionicons
                  name="notifications-off"
                  size={32}
                  color={theme.textMuted}
                />
                <ThemedText
                  variant="bodyMedium"
                  color={theme.text}
                >
                  No thanks
                </ThemedText>
              </Pressable>
            </View>
          </StepContainer>
        );
        
      default:
        return null;
    }
  }, [data, theme, archetypes, updateData, goNext]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
            <Animated.View
              style={[styles.progressFill, { backgroundColor: theme.primary }, progressAnimatedStyle]}
            />
          </View>
          <ThemedText variant="label" color={theme.textMuted} style={styles.stepCounter}>
            {currentStep + 1} / {TOTAL_STEPS}
          </ThemedText>
        </View>

        {/* Steps */}
        <FlatList
          ref={scrollRef}
          data={Array.from({ length: TOTAL_STEPS }, (_, i) => i)}
          keyExtractor={(item) => item.toString()}
          renderItem={renderStep}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
        />

        {/* Navigation */}
        <View style={styles.navigation}>
          {currentStep > 0 ? (
            <Pressable style={styles.backButton} onPress={goBack}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </Pressable>
          ) : (
            <View style={styles.placeholder} />
          )}
          
          <Button
            title={currentStep === TOTAL_STEPS - 1 ? "Let's Go!" : 'Continue'}
            onPress={goNext}
            disabled={!canProceed()}
            loading={isSubmitting}
            variant="primary"
            size="large"
            style={styles.nextButton}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepContainer({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={styles.stepContainer}
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  stepCounter: {
    marginLeft: Spacing.md,
    minWidth: 40,
    textAlign: 'right',
  },
  stepContainer: {
    width: SCREEN_WIDTH,
  },
  stepContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['3xl'],
    paddingBottom: Spacing['4xl'],
  },
  stepTitle: {
    marginBottom: Spacing.md,
  },
  stepSubtitle: {
    marginBottom: Spacing.xl,
  },
  textInput: {
    fontSize: 24,
    paddingVertical: Spacing.base,
    borderBottomWidth: 2,
    fontFamily: 'Inter_500Medium',
  },
  inputWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputFlex: {
    flex: 1,
  },
  unitLabel: {
    marginLeft: Spacing.md,
  },
  optionsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  optionCard: {
    flex: 1,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  optionsStack: {
    gap: Spacing.md,
  },
  optionRow: {
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  archetypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  archetypeCard: {
    width: (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md) / 2,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    alignItems: 'center',
  },
  archetypeIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  archetypeName: {
    marginBottom: Spacing.xs,
  },
  archetypeMacros: {
    marginTop: Spacing.sm,
  },
  celebrationIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  notificationOptions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  notificationCard: {
    flex: 1,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
  },
  backButton: {
    padding: Spacing.md,
  },
  placeholder: {
    width: 48,
  },
  nextButton: {
    flex: 1,
    marginLeft: Spacing.md,
  },
});
