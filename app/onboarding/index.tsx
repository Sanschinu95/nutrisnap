/**
 * Onboarding - Redesigned multi-step flow
 * Steps: Gender → Archetype → Body Stats → Goal
 * Inspired by: archetype.png mockup
 *
 * Archetype card behavior:
 * - Single tap: scale 1.07x, show expanded info, glowing border
 * - Double tap: select and proceed
 */

import { useState, useRef, useCallback, useEffect } from 'react';
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
  Image,
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
  withRepeat,
  withSequence,
  Easing,
  FadeInDown,
  interpolateColor,
  cancelAnimation,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/user.store';
import { ARCHETYPES, ARCHETYPE_MACROS, type ArchetypeKey, FEMALE_ARCHETYPES } from '@/constants/archetypes';
import { ArchetypeColors, Spacing, BorderRadius, Colors } from '@/constants/theme';
import type { BiologicalSex, GoalType } from '@/types/archetype';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MALE_ARCHETYPES: ArchetypeKey[] = ['wolf', 'bear', 'lion', 'deer'];

const ARCHETYPE_IMAGES: Record<ArchetypeKey, any> = {
  wolf: require('@/assets/archetypes/wolf.png'),
  bear: require('@/assets/archetypes/bear.png'),
  lion: require('@/assets/archetypes/lion.png'),
  deer: require('@/assets/archetypes/deer.png'),
  tigress: require('@/assets/archetypes/tigress.png'),
  phoenix: require('@/assets/archetypes/phoenix.png'),
  doe: require('@/assets/archetypes/doe.png'),
  swan: require('@/assets/archetypes/swan.png'),
};

const GENDER_IMAGES = {
  male: require('@/assets/archetypes/male.png'),
  female: require('@/assets/archetypes/female.png'),
};

const ARCHETYPE_BADGES: Record<ArchetypeKey, string> = {
  wolf: 'Lean & Athletic',
  bear: 'Bulk & Strength',
  lion: 'Balanced Power',
  deer: 'Endurance & Flexibility',
  tigress: 'Fierce & Lean',
  phoenix: 'Rising Transformation',
  doe: 'Graceful & Balanced',
  swan: 'Elegant & Disciplined',
};

const GOAL_OPTIONS = [
  { value: 'cut', label: '🔪 Cut', desc: 'Lose fat, maintain muscle' },
  { value: 'maintain', label: '⚖️ Maintain', desc: 'Stay at current weight' },
  { value: 'bulk', label: '💪 Bulk', desc: 'Gain muscle, minimize fat' },
];

const ACTIVITY_OPTIONS = [
  { value: 1, label: 'Sedentary', desc: 'Little to no exercise' },
  { value: 2, label: 'Light', desc: '1-2 days/week' },
  { value: 3, label: 'Moderate', desc: '3-5 days/week' },
  { value: 4, label: 'Active', desc: '6-7 days/week' },
  { value: 5, label: 'Very Active', desc: 'Pro athlete level' },
];

type StepData = {
  name: string;
  biologicalSex: BiologicalSex | null;
  age: number | null;
  weight: number | null;
  height: number | null;
  goal: GoalType | null;
  activityLevel: number | null;
  archetype: ArchetypeKey | null;
};

// ─── Glowing Archetype Card ─────────────────────────────────────
function GlowingArchetypeCard({
  archetypeKey,
  isExpanded,
  isSelected,
  onSingleTap,
  onDoubleTap,
}: {
  archetypeKey: ArchetypeKey;
  isExpanded: boolean;
  isSelected: boolean;
  onSingleTap: () => void;
  onDoubleTap: () => void;
}) {
  const { theme } = useTheme();
  const info = ARCHETYPES[archetypeKey];
  const accentColor = info.colors.accent;
  const cardWidth = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md) / 2;

  // Scale animation
  const scale = useSharedValue(1);
  // Glow animation for border
  const glowProgress = useSharedValue(0);

  // Track for double tap
  const lastTap = useRef<number>(0);
  const DOUBLE_TAP_DELAY = 300;

  useEffect(() => {
    if (isExpanded) {
      scale.value = withSpring(1.07, { damping: 12, stiffness: 150 });
      // Start glowing border animation
      glowProgress.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      scale.value = withSpring(1, { damping: 14, stiffness: 200 });
      cancelAnimation(glowProgress);
      glowProgress.value = withTiming(0, { duration: 300 });
    }
  }, [isExpanded, scale, glowProgress]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedBorderStyle = useAnimatedStyle(() => {
    if (!isExpanded) {
      return {
        borderColor: isSelected ? accentColor : theme.border,
        borderWidth: isSelected ? 2.5 : 1,
      };
    }
    // Animate border color through accent shades
    const color = interpolateColor(
      glowProgress.value,
      [0, 0.33, 0.66, 1],
      [accentColor + '40', accentColor, accentColor + '80', accentColor + '40']
    );
    return {
      borderColor: color,
      borderWidth: 2.5,
    };
  });

  // Shadow glow for expanded
  const animatedShadowStyle = useAnimatedStyle(() => ({
    shadowOpacity: isExpanded ? 0.4 : 0.08,
    shadowRadius: isExpanded ? 16 : 6,
    shadowColor: isExpanded ? accentColor : '#000',
    elevation: isExpanded ? 8 : 2,
  }));

  const handlePress = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      // Double tap
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDoubleTap();
    } else {
      // Single tap
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSingleTap();
    }
    lastTap.current = now;
  };

  const macroP = Math.round(info.macros.protein * 100);
  const macroC = Math.round(info.macros.carbs * 100);
  const macroF = Math.round(info.macros.fat * 100);

  return (
    <Animated.View style={[animatedCardStyle, animatedShadowStyle, { shadowOffset: { width: 0, height: 4 } }]}>
      <Pressable onPress={handlePress}>
        <Animated.View
          style={[
            styles.archetypeCard,
            { width: cardWidth, backgroundColor: theme.card },
            animatedBorderStyle,
          ]}
        >
          {/* Image */}
          <View style={styles.archetypeImageContainer}>
            <Image
              source={ARCHETYPE_IMAGES[archetypeKey]}
              style={styles.archetypeImage}
              resizeMode="contain"
            />
          </View>

          {/* Name */}
          <ThemedText
            variant="h3"
            color={isExpanded ? accentColor : theme.text}
            align="center"
            style={styles.archetypeName}
          >
            {info.name}
          </ThemedText>

          {/* Badge */}
          <View style={[styles.archetypeBadge, { backgroundColor: theme.border }]}>
            <ThemedText variant="labelSmall" color={theme.textSecondary} align="center">
              {ARCHETYPE_BADGES[archetypeKey]}
            </ThemedText>
          </View>

          {/* Description */}
          <ThemedText
            variant="label"
            color={theme.textMuted}
            align="center"
            style={styles.archetypeDesc}
            numberOfLines={isExpanded ? 5 : 2}
          >
            {isExpanded ? info.longDescription : info.description}
          </ThemedText>

          {/* Expanded: macro breakdown */}
          {isExpanded && (
            <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.macroExpanded}>
              <View style={styles.macroRow}>
                <ThemedText variant="label" color={Colors.olive}>Protein {macroP}%</ThemedText>
              </View>
              <View style={styles.macroRow}>
                <ThemedText variant="label" color={Colors.orange}>Carbs {macroC}%</ThemedText>
              </View>
              <View style={styles.macroRow}>
                <ThemedText variant="label" color={Colors.yellow}>Fat {macroF}%</ThemedText>
              </View>

              <ThemedText variant="labelSmall" color={theme.textMuted} align="center" style={styles.doubleTapHint}>
                Double tap to select
              </ThemedText>
            </Animated.View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Main Onboarding Screen ─────────────────────────────────────
export default function OnboardingScreen() {
  const { theme } = useTheme();
  const { completeOnboarding } = useUserStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedArchetype, setExpandedArchetype] = useState<ArchetypeKey | null>(null);
  const [data, setData] = useState<StepData>({
    name: '',
    biologicalSex: null,
    age: null,
    weight: null,
    height: null,
    goal: null,
    activityLevel: null,
    archetype: null,
  });

  const progress = useSharedValue(0);
  const scrollRef = useRef<FlatList>(null);
  // Total steps: 0=Gender, 1=Archetype, 2=BodyStats, 3=Goal
  const TOTAL_STEPS = 4;
  const DISPLAY_STEP_OFFSET = 2; // We're steps 2-5 of 6 total (continue=1, diet=5, etc.)

  const updateData = useCallback(<K extends keyof StepData>(key: K, value: StepData[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

  const canProceed = useCallback((): boolean => {
    switch (currentStep) {
      case 0: return data.biologicalSex !== null;
      case 1: return data.archetype !== null;
      case 2: return (
        data.name.trim().length >= 2 &&
        data.age !== null && data.age >= 13 && data.age <= 120 &&
        data.weight !== null && data.weight >= 30 && data.weight <= 300 &&
        data.height !== null && data.height >= 100 && data.height <= 250 &&
        data.activityLevel !== null
      );
      case 3: return data.goal !== null;
      default: return false;
    }
  }, [currentStep, data]);

  const goNext = useCallback(async () => {
    if (!canProceed()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (currentStep < TOTAL_STEPS - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      progress.value = withSpring((nextStep + DISPLAY_STEP_OFFSET) / 6);
      scrollRef.current?.scrollToIndex({ index: nextStep, animated: true });
    } else {
      // Navigate to diet page
      await handleProceedToDiet();
    }
  }, [currentStep, canProceed, progress]);

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      progress.value = withSpring((prevStep + DISPLAY_STEP_OFFSET) / 6);
      scrollRef.current?.scrollToIndex({ index: prevStep, animated: true });
    } else {
      router.back();
    }
  }, [currentStep, progress]);

  const handleProceedToDiet = async () => {
    // Save data in state for now, navigate to diet screen
    // Will pass all data to final submission
    router.push({
      pathname: '/onboarding/diet' as any,
      params: {
        name: data.name.trim(),
        biologicalSex: data.biologicalSex!,
        age: String(data.age!),
        weight: String(data.weight!),
        height: String(data.height!),
        goal: data.goal!,
        activityLevel: String(data.activityLevel!),
        archetype: data.archetype!,
      },
    });
  };

  const handleArchetypeSingleTap = (key: ArchetypeKey) => {
    setExpandedArchetype(prev => prev === key ? null : key);
  };

  const handleArchetypeDoubleTap = (key: ArchetypeKey) => {
    updateData('archetype', key);
    setExpandedArchetype(key);
    // Auto-advance after a brief moment
    setTimeout(() => {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      progress.value = withSpring((nextStep + DISPLAY_STEP_OFFSET) / 6);
      scrollRef.current?.scrollToIndex({ index: nextStep, animated: true });
    }, 400);
  };

  useEffect(() => {
    progress.value = withSpring((currentStep + DISPLAY_STEP_OFFSET) / 6);
  }, []);

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const archetypes = data.biologicalSex === 'female' ? FEMALE_ARCHETYPES : MALE_ARCHETYPES;

  const renderStep = useCallback(({ item, index }: { item: number; index: number }) => {
    switch (index) {
      // Step 0: Gender selection
      case 0:
        return (
          <StepContainer>
            <ThemedText variant="h1" style={styles.stepTitle}>
              Who do you want to{'\n'}become?
            </ThemedText>
            <ThemedText variant="body" color={theme.textMuted} style={styles.stepSubtitle}>
              Select your biological sex to personalize your archetypes
            </ThemedText>

            <View style={styles.genderGrid}>
              {(['female', 'male'] as const).map((sex) => (
                <Pressable
                  key={sex}
                  style={[
                    styles.genderCard,
                    {
                      backgroundColor: data.biologicalSex === sex ? theme.primary + '15' : theme.card,
                      borderColor: data.biologicalSex === sex ? theme.primary : theme.border,
                      borderWidth: data.biologicalSex === sex ? 2.5 : 1,
                    },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    updateData('biologicalSex', sex);
                    updateData('archetype', null);
                    setExpandedArchetype(null);
                  }}
                >
                  <Image
                    source={GENDER_IMAGES[sex]}
                    style={styles.genderImage}
                    resizeMode="contain"
                  />
                  <ThemedText
                    variant="h3"
                    color={data.biologicalSex === sex ? theme.primary : theme.text}
                    align="center"
                  >
                    {sex === 'male' ? 'Male' : 'Female'}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </StepContainer>
        );

      // Step 1: Archetype selection
      case 1:
        return (
          <StepContainer>
            <ThemedText variant="h1" style={styles.stepTitle}>
              Who do you want to{'\n'}become?
            </ThemedText>
            <ThemedText variant="body" color={theme.textMuted} style={styles.stepSubtitle}>
              Choose the physical archetype that best aligns with your long-term wellness vision.
            </ThemedText>

            <View style={styles.archetypeGrid}>
              {archetypes.map((key) => (
                <GlowingArchetypeCard
                  key={key}
                  archetypeKey={key}
                  isExpanded={expandedArchetype === key}
                  isSelected={data.archetype === key}
                  onSingleTap={() => handleArchetypeSingleTap(key)}
                  onDoubleTap={() => handleArchetypeDoubleTap(key)}
                />
              ))}
            </View>
          </StepContainer>
        );

      // Step 2: Body stats (compact)
      case 2:
        return (
          <StepContainer>
            <ThemedText variant="h1" style={styles.stepTitle}>
              Tell us about you 📋
            </ThemedText>
            <ThemedText variant="body" color={theme.textMuted} style={styles.stepSubtitle}>
              We need this to calculate your personalized nutrition plan
            </ThemedText>

            {/* Name */}
            <View style={styles.fieldGroup}>
              <ThemedText variant="bodyMedium" style={styles.fieldLabel}>Name</ThemedText>
              <TextInput
                style={[styles.textInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                value={data.name}
                onChangeText={(text) => updateData('name', text)}
                placeholder="Your name"
                placeholderTextColor={theme.textMuted}
              />
            </View>

            {/* Age + Weight row */}
            <View style={styles.fieldRow}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <ThemedText variant="bodyMedium" style={styles.fieldLabel}>Age</ThemedText>
                <TextInput
                  style={[styles.textInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                  value={data.age?.toString() ?? ''}
                  onChangeText={(text) => updateData('age', parseInt(text) || null)}
                  placeholder="25"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="number-pad"
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <ThemedText variant="bodyMedium" style={styles.fieldLabel}>Weight (kg)</ThemedText>
                <TextInput
                  style={[styles.textInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                  value={data.weight?.toString() ?? ''}
                  onChangeText={(text) => updateData('weight', parseFloat(text) || null)}
                  placeholder="70"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Height */}
            <View style={styles.fieldGroup}>
              <ThemedText variant="bodyMedium" style={styles.fieldLabel}>Height (cm)</ThemedText>
              <TextInput
                style={[styles.textInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                value={data.height?.toString() ?? ''}
                onChangeText={(text) => updateData('height', parseFloat(text) || null)}
                placeholder="170"
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Activity Level */}
            <View style={styles.fieldGroup}>
              <ThemedText variant="bodyMedium" style={styles.fieldLabel}>Activity Level</ThemedText>
              <View style={styles.activityGrid}>
                {ACTIVITY_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.activityChip,
                      {
                        backgroundColor: data.activityLevel === opt.value ? theme.primary : theme.card,
                        borderColor: data.activityLevel === opt.value ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => updateData('activityLevel', opt.value)}
                  >
                    <ThemedText
                      variant="label"
                      color={data.activityLevel === opt.value ? 'white' : theme.text}
                    >
                      {opt.label}
                    </ThemedText>
                    <ThemedText
                      variant="labelSmall"
                      color={data.activityLevel === opt.value ? 'rgba(255,255,255,0.7)' : theme.textMuted}
                    >
                      {opt.desc}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          </StepContainer>
        );

      // Step 3: Goal
      case 3:
        return (
          <StepContainer>
            <ThemedText variant="h1" style={styles.stepTitle}>
              What's your goal? 🎯
            </ThemedText>
            <ThemedText variant="body" color={theme.textMuted} style={styles.stepSubtitle}>
              This adjusts your daily calorie target
            </ThemedText>
            <View style={styles.goalStack}>
              {GOAL_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.goalCard,
                    {
                      backgroundColor: data.goal === option.value ? theme.primary : theme.card,
                      borderColor: data.goal === option.value ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    updateData('goal', option.value as GoalType);
                  }}
                >
                  <ThemedText
                    variant="h3"
                    color={data.goal === option.value ? 'white' : theme.text}
                  >
                    {option.label}
                  </ThemedText>
                  <ThemedText
                    variant="body"
                    color={data.goal === option.value ? 'rgba(255,255,255,0.8)' : theme.textMuted}
                  >
                    {option.desc}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </StepContainer>
        );

      default:
        return null;
    }
  }, [data, theme, archetypes, expandedArchetype, updateData, goNext]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header with back + progress */}
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={goBack}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <View style={styles.progressSection}>
            <ThemedText variant="label" color={theme.textMuted} style={styles.progressLabel}>
              Progress: {currentStep + DISPLAY_STEP_OFFSET} / 6
            </ThemedText>
            <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
              <Animated.View
                style={[styles.progressFill, { backgroundColor: Colors.olive }, progressAnimatedStyle]}
              />
            </View>
          </View>
        </View>

        {/* Steps FlatList */}
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

        {/* Continue button */}
        <View style={styles.navigation}>
          <Pressable
            style={[
              styles.continueButton,
              {
                backgroundColor: canProceed() ? Colors.olive : theme.border,
              },
            ]}
            onPress={goNext}
            disabled={!canProceed() || isSubmitting}
          >
            <ThemedText variant="button" color={canProceed() ? 'white' : theme.textMuted}>
              Continue
            </ThemedText>
          </Pressable>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  backButton: {
    padding: Spacing.xs,
  },
  progressSection: {
    flex: 1,
    alignItems: 'center',
  },
  progressLabel: {
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  stepContainer: {
    width: SCREEN_WIDTH,
  },
  stepContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['5xl'],
  },
  stepTitle: {
    marginBottom: Spacing.md,
    fontSize: 28,
    lineHeight: 36,
  },
  stepSubtitle: {
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  // Gender selection
  genderGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  genderCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  genderImage: {
    width: 100,
    height: 130,
  },
  // Archetype grid
  archetypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    justifyContent: 'center',
  },
  archetypeCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    alignItems: 'center',
  },
  archetypeImageContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  archetypeImage: {
    width: 80,
    height: 80,
  },
  archetypeName: {
    marginBottom: Spacing.xs,
  },
  archetypeBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  archetypeDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  macroExpanded: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
    width: '100%',
  },
  macroRow: {
    paddingVertical: 2,
  },
  doubleTapHint: {
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  // Body stats
  fieldGroup: {
    marginBottom: Spacing.base,
  },
  fieldLabel: {
    marginBottom: Spacing.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  textInput: {
    fontSize: 16,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    fontFamily: 'Inter_500Medium',
  },
  activityGrid: {
    gap: Spacing.sm,
  },
  activityChip: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  // Goal
  goalStack: {
    gap: Spacing.md,
  },
  goalCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    gap: Spacing.xs,
  },
  // Navigation
  navigation: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.base,
    paddingBottom: Spacing.xl,
  },
  continueButton: {
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
});
