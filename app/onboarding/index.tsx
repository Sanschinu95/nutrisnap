import { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { Colors, BorderRadius, Spacing } from '@/constants/theme';
import type { ArchetypeKey } from '@/constants/archetypes';
import type { BiologicalSex, GoalType } from '@/types/archetype';
import { detectDefaultUnit, feetInchesToCm, lbToKg, type UnitPreference } from '@/lib/units';

type StepData = {
  name: string;
  biologicalSex: BiologicalSex | null;
  age: string;
  unitPreference: UnitPreference;
  /** Height in cm — used when unitPreference === 'metric' */
  heightCm: string;
  /** Feet portion — used when unitPreference === 'imperial' */
  heightFt: string;
  /** Inches portion — used when unitPreference === 'imperial' */
  heightIn: string;
  /** Weight value in the user-facing unit (kg if metric, lb if imperial) */
  weight: string;
  activityLevel: number | null;
  archetype: ArchetypeKey | null;
  goal: GoalType | null;
};

const TOTAL_STEPS = 8;

const NUTRITION_STYLES: Array<{ key: ArchetypeKey; title: string; desc: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'lion', title: 'Balanced', desc: 'A steady mix of protein, carbs, and fats.', icon: 'scale-outline' },
  { key: 'wolf', title: 'High Protein', desc: 'More protein for strength and recovery.', icon: 'barbell-outline' },
  { key: 'deer', title: 'Plant Forward', desc: 'Lighter meals with more carbs and plants.', icon: 'leaf-outline' },
  { key: 'bear', title: 'Strength Fuel', desc: 'More energy for training and growth.', icon: 'fitness-outline' },
];

const ACTIVITY_OPTIONS = [
  { value: 1, title: 'Low', desc: 'Mostly seated days' },
  { value: 2, title: 'Light', desc: 'A few active moments' },
  { value: 3, title: 'Moderate', desc: 'Training a few days weekly' },
  { value: 4, title: 'High', desc: 'Active most days' },
  { value: 5, title: 'Athlete', desc: 'Very active routine' },
];

const GOAL_OPTIONS: Array<{ value: GoalType; title: string; desc: string }> = [
  { value: 'cut', title: 'Lose Weight', desc: 'Reduce body fat while protecting muscle.' },
  { value: 'maintain', title: 'Maintain', desc: 'Stay steady and improve consistency.' },
  { value: 'bulk', title: 'Gain Muscle', desc: 'Build mass with a controlled surplus.' },
];

const UNIT_OPTIONS: Array<{
  key: UnitPreference;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'metric', title: 'Metric', desc: 'kg, cm, ml', icon: 'flask-outline' },
  { key: 'imperial', title: 'Imperial', desc: 'lb, ft·in, fl oz', icon: 'speedometer-outline' },
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<StepData>(() => ({
    name: '',
    biologicalSex: null,
    age: '',
    unitPreference: detectDefaultUnit(),
    heightCm: '',
    heightFt: '',
    heightIn: '',
    weight: '',
    activityLevel: null,
    archetype: null,
    goal: null,
  }));

  const progress = (step + 1) / TOTAL_STEPS;

  const canProceed = useMemo(() => {
    switch (step) {
      case 0: return data.name.trim().length >= 2;
      case 1: return data.age.length > 0 && Number(data.age) >= 13;
      case 2: return data.unitPreference === 'metric' || data.unitPreference === 'imperial';
      case 3: {
        if (data.unitPreference === 'metric') {
          return data.heightCm.length > 0 && Number(data.heightCm) >= 100 && Number(data.heightCm) <= 250;
        }
        const ft = Number(data.heightFt);
        const inch = Number(data.heightIn || '0');
        const cm = feetInchesToCm(ft, inch);
        return data.heightFt.length > 0 && cm >= 100 && cm <= 250 && inch >= 0 && inch < 12;
      }
      case 4: {
        if (data.weight.length === 0) return false;
        const value = Number(data.weight);
        if (!Number.isFinite(value)) return false;
        const kg = data.unitPreference === 'imperial' ? lbToKg(value) : value;
        return kg >= 30 && kg <= 300;
      }
      case 5: return data.biologicalSex !== null;
      case 6: return data.activityLevel !== null && data.archetype !== null;
      case 7: return data.goal !== null;
      default: return false;
    }
  }, [data, step]);

  const patchData = useCallback(<K extends keyof StepData>(key: K, value: StepData[K]) => {
    setData((current) => ({ ...current, [key]: value }));
  }, []);

  const goBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 0) router.back();
    else setStep((current) => current - 1);
  };

  const goNext = () => {
    if (!canProceed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < TOTAL_STEPS - 1) {
      setStep((current) => current + 1);
      return;
    }
    // Convert to SI at the boundary
    const heightCm = data.unitPreference === 'imperial'
      ? feetInchesToCm(Number(data.heightFt), Number(data.heightIn || '0'))
      : Number(data.heightCm);
    const weightKg = data.unitPreference === 'imperial'
      ? lbToKg(Number(data.weight))
      : Number(data.weight);

    router.push({
      pathname: '/onboarding/diet' as any,
      params: {
        name: data.name.trim(),
        biologicalSex: data.biologicalSex!,
        age: data.age,
        weight: String(weightKg.toFixed(2)),
        height: String(heightCm.toFixed(2)),
        unitPreference: data.unitPreference,
        goal: data.goal!,
        activityLevel: String(data.activityLevel!),
        archetype: data.archetype!,
      },
    });
  };

  // Steps with text input need keyboard avoidance; long card steps top-align
  const isInputStep = step === 0 || step === 1 || step === 3 || step === 4;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={goBack}>
            <Ionicons name="arrow-back" size={22} color={Colors.brown} />
          </Pressable>
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <ThemedText variant="label" color={Colors.muted}>{step + 1} / {TOTAL_STEPS}</ThemedText>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isInputStep && styles.scrollContentCentered,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={!isInputStep}
        >
          <Animated.View key={step} entering={FadeInDown.springify()}>
            {step === 0 && (
              <Question title="What should we call you?" subtitle="NutriSnap will use this to make the app feel personal.">
                <LargeInput value={data.name} onChangeText={(value) => patchData('name', value)} placeholder="Your name" />
              </Question>
            )}

            {step === 1 && (
              <Question title="How old are you?" subtitle="Age helps estimate your daily energy needs.">
                <LargeInput value={data.age} onChangeText={(value) => patchData('age', value.replace(/[^0-9]/g, ''))} placeholder="25" keyboardType="number-pad" />
              </Question>
            )}

            {step === 2 && (
              <Question
                title="Which units do you prefer?"
                subtitle="We'll show every measurement this way. You can change it later in Settings."
              >
                <ChoiceGrid
                  options={UNIT_OPTIONS.map((option) => ({
                    key: option.key,
                    title: option.title,
                    desc: option.desc,
                    icon: option.icon,
                  }))}
                  selected={data.unitPreference}
                  onSelect={(value) => patchData('unitPreference', value as UnitPreference)}
                />
              </Question>
            )}

            {step === 3 && (
              <Question
                title="What is your height?"
                subtitle={data.unitPreference === 'metric' ? 'Enter your height in centimeters.' : 'Enter your height in feet and inches.'}
              >
                {data.unitPreference === 'metric' ? (
                  <LargeInput
                    value={data.heightCm}
                    onChangeText={(value) => patchData('heightCm', value.replace(/[^0-9.]/g, ''))}
                    placeholder="170"
                    keyboardType="decimal-pad"
                    suffix="cm"
                  />
                ) : (
                  <View style={styles.dualInputRow}>
                    <LargeInput
                      value={data.heightFt}
                      onChangeText={(value) => patchData('heightFt', value.replace(/[^0-9]/g, ''))}
                      placeholder="5"
                      keyboardType="number-pad"
                      suffix="ft"
                      containerStyle={styles.dualInputCell}
                    />
                    <LargeInput
                      value={data.heightIn}
                      onChangeText={(value) => {
                        const cleaned = value.replace(/[^0-9]/g, '');
                        // Clamp to 0–11
                        const num = Number(cleaned);
                        if (cleaned === '' || num <= 11) patchData('heightIn', cleaned);
                      }}
                      placeholder="9"
                      keyboardType="number-pad"
                      suffix="in"
                      containerStyle={styles.dualInputCell}
                    />
                  </View>
                )}
              </Question>
            )}

            {step === 4 && (
              <Question
                title="What is your weight?"
                subtitle={data.unitPreference === 'metric' ? 'Enter your weight in kilograms.' : 'Enter your weight in pounds.'}
              >
                <LargeInput
                  value={data.weight}
                  onChangeText={(value) => patchData('weight', value.replace(/[^0-9.]/g, ''))}
                  placeholder={data.unitPreference === 'metric' ? '70' : '155'}
                  keyboardType="decimal-pad"
                  suffix={data.unitPreference === 'metric' ? 'kg' : 'lb'}
                />
              </Question>
            )}

            {step === 5 && (
              <Question title="Choose your biological sex" subtitle="This is only used for nutrition estimates.">
                <ChoiceGrid
                  options={[
                    { key: 'female', title: 'Female', desc: 'Use female baseline estimates.', icon: 'female-outline' },
                    { key: 'male', title: 'Male', desc: 'Use male baseline estimates.', icon: 'male-outline' },
                  ]}
                  selected={data.biologicalSex}
                  onSelect={(value) => patchData('biologicalSex', value as BiologicalSex)}
                />
              </Question>
            )}

            {step === 6 && (
              <Question title="Pick your nutrition style" subtitle="This keeps the existing personalization logic, with a simpler face.">
                <ChoiceGrid
                  options={NUTRITION_STYLES.map((style) => ({ key: style.key, title: style.title, desc: style.desc, icon: style.icon }))}
                  selected={data.archetype}
                  onSelect={(value) => {
                    patchData('archetype', value as ArchetypeKey);
                    if (!data.activityLevel) patchData('activityLevel', 3);
                  }}
                />
                <View style={styles.activityStack}>
                  <ThemedText variant="bodySemiBold">Activity level</ThemedText>
                  {ACTIVITY_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      style={[styles.activityRow, data.activityLevel === option.value && styles.choiceSelected]}
                      onPress={() => patchData('activityLevel', option.value)}
                    >
                      <View>
                        <ThemedText variant="bodySemiBold">{option.title}</ThemedText>
                        <ThemedText variant="label" color={Colors.muted}>{option.desc}</ThemedText>
                      </View>
                      {data.activityLevel === option.value && <Ionicons name="checkmark-circle" size={22} color={Colors.olive} />}
                    </Pressable>
                  ))}
                </View>
              </Question>
            )}

            {step === 7 && (
              <Question title="What is your goal?" subtitle="This adjusts your calorie target using the existing calculation.">
                <ChoiceGrid
                  options={GOAL_OPTIONS.map((goal) => ({ key: goal.value, title: goal.title, desc: goal.desc, icon: 'flag-outline' as const }))}
                  selected={data.goal}
                  onSelect={(value) => patchData('goal', value as GoalType)}
                />
              </Question>
            )}
          </Animated.View>

          <View style={styles.footer}>
            <Pressable style={[styles.continueButton, !canProceed && styles.continueDisabled]} onPress={goNext} disabled={!canProceed}>
              <ThemedText variant="button" color={canProceed ? Colors.white : Colors.muted}>
                Continue
              </ThemedText>
              <Ionicons name="arrow-forward" size={18} color={canProceed ? Colors.white : Colors.muted} />
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Question({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View style={styles.question}>
      <ThemedText variant="h1" style={styles.title}>{title}</ThemedText>
      <ThemedText variant="body" color={Colors.muted} style={styles.subtitle}>{subtitle}</ThemedText>
      {children}
    </View>
  );
}

function LargeInput(props: React.ComponentProps<typeof TextInput> & {
  suffix?: string;
  containerStyle?: object;
}) {
  const { suffix, style, containerStyle, ...rest } = props;
  return (
    <View style={[styles.inputWrap, containerStyle]}>
      <TextInput
        {...rest}
        placeholderTextColor={Colors.muted}
        style={[styles.largeInput, style]}
      />
      {suffix && <ThemedText variant="h3" color={Colors.muted}>{suffix}</ThemedText>}
    </View>
  );
}

function ChoiceGrid({
  options,
  selected,
  onSelect,
}: {
  options: Array<{ key: string; title: string; desc: string; icon: keyof typeof Ionicons.glyphMap }>;
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <View style={styles.choiceGrid}>
      {options.map((option) => {
        const active = selected === option.key;
        return (
          <Pressable key={option.key} style={[styles.choiceCard, active && styles.choiceSelected]} onPress={() => onSelect(option.key)}>
            <View style={[styles.choiceIcon, active && styles.choiceIconActive]}>
              <Ionicons name={option.icon} size={22} color={active ? Colors.white : Colors.olive} />
            </View>
            <ThemedText variant="bodySemiBold">{option.title}</ThemedText>
            <ThemedText variant="label" color={Colors.muted}>{option.desc}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboard: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.olive,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  scrollContentCentered: {
    justifyContent: 'center',
  },
  question: {
    gap: Spacing.lg,
  },
  title: {
    fontSize: 34,
    lineHeight: 41,
  },
  subtitle: {
    maxWidth: 320,
  },
  inputWrap: {
    minHeight: 76,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  dualInputRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  dualInputCell: {
    flex: 1,
  },
  largeInput: {
    flex: 1,
    fontSize: 30,
    fontFamily: 'Nunito_800ExtraBold',
    color: Colors.brown,
  },
  choiceGrid: {
    gap: Spacing.md,
  },
  choiceCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  choiceSelected: {
    borderColor: Colors.olive,
    backgroundColor: Colors.oliveLight,
  },
  choiceIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.oliveLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceIconActive: {
    backgroundColor: Colors.olive,
  },
  activityStack: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  activityRow: {
    minHeight: 58,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footer: {
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing.md,
  },
  continueButton: {
    minHeight: 54,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  continueDisabled: {
    backgroundColor: Colors.border,
  },
});
