/**
 * Onboarding V2 — premium, tactile, scroll-wheel driven flow.
 *
 * Steps:
 *   0  Name
 *   1  Biological sex
 *   2  Age (wheel)
 *   3  Height (wheel + cm/ft toggle)
 *   4  Current weight (wheel + kg/lb toggle)
 *   5  Goal weight (wheel + smart tip)
 *   6  Pace (slider) — skipped if goal == 'maintain'
 *   7  Activity level (4 cards)
 *   8  Diet style (cards)
 *   9  Medical conditions (pills)
 *
 * Everything stays in component state until the final step pushes to
 * /onboarding/transition which performs the single Supabase upsert.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  PanResponder,
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
import { ScrollWheelPicker, PICKER_GREEN } from '@/components/ui/ScrollWheelPicker';
import { Colors, BorderRadius, Spacing, Typography } from '@/constants/theme';
import type { ArchetypeKey } from '@/constants/archetypes';
import type { BiologicalSex, GoalType } from '@/types/archetype';
import {
  cmToFeetInches,
  detectDefaultUnit,
  feetInchesToCm,
  kgToLb,
  lbToKg,
  type UnitPreference,
} from '@/lib/units';

/* ─── Static option lists ─────────────────────────────────────── */

interface ActivityOption {
  key: number;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}
const ACTIVITY_OPTIONS: ActivityOption[] = [
  { key: 1, title: 'Mostly Sitting', desc: 'Seated work, low movement.', icon: 'desktop-outline' },
  { key: 2, title: 'Often Standing', desc: 'Standing work, occasional walking.', icon: 'walk-outline' },
  { key: 3, title: 'Regularly Walking', desc: 'Frequent walking, steady activity.', icon: 'footsteps-outline' },
  { key: 5, title: 'Physically Intense Work', desc: 'Heavy labor, high exertion.', icon: 'barbell-outline' },
];

interface DietOption {
  key: ArchetypeKey;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}
const DIET_OPTIONS: DietOption[] = [
  { key: 'lion', title: 'Balanced', desc: 'A steady mix of protein, carbs, and fats.', icon: 'scale-outline' },
  { key: 'wolf', title: 'High Protein', desc: 'More protein for strength and recovery.', icon: 'barbell-outline' },
  { key: 'deer', title: 'Plant Forward', desc: 'Lighter meals with more carbs and plants.', icon: 'leaf-outline' },
  { key: 'bear', title: 'Strength Fuel', desc: 'More energy for training and growth.', icon: 'fitness-outline' },
];

const MEDICAL_CONDITIONS = [
  'Diabetes',
  'Pre-Diabetes',
  'Cholesterol',
  'Hypertension',
  'PCOS',
  'Thyroid',
  'Physical Injury',
  'Excessive stress/anxiety',
  'Sleep issues',
  'Depression',
  'Anger issues',
  'Loneliness',
  'Relationship stress',
];

/* ─── State shape ─────────────────────────────────────────────── */

interface StepData {
  name: string;
  biologicalSex: BiologicalSex | null;
  age: number;
  unitPreference: UnitPreference;
  /** Always stored in cm; height pickers convert as needed. */
  heightCm: number;
  /** Always stored in kg. */
  weightKg: number;
  /** Always stored in kg. */
  goalWeightKg: number;
  /** kg/week (0.25–1.0). Null if goal is maintain. */
  paceKgPerWeek: number | null;
  activityLevel: number | null;
  archetype: ArchetypeKey | null;
  medicalConditions: string[];
}

const TOTAL_STEPS = 10;

/* ─── Screen ──────────────────────────────────────────────────── */

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<StepData>(() => ({
    name: '',
    biologicalSex: null,
    age: 25,
    unitPreference: detectDefaultUnit(),
    heightCm: 170,
    weightKg: 70,
    goalWeightKg: 70,
    paceKgPerWeek: 0.5,
    activityLevel: null,
    archetype: null,
    medicalConditions: [],
  }));

  // Derive goal type from weight gap.
  const derivedGoal = useMemo<GoalType>(() => {
    if (data.goalWeightKg < data.weightKg - 0.5) return 'cut';
    if (data.goalWeightKg > data.weightKg + 0.5) return 'bulk';
    return 'maintain';
  }, [data.goalWeightKg, data.weightKg]);

  // Total steps shown in progress; pace is hidden when goal === maintain.
  const isPaceSkipped = derivedGoal === 'maintain';
  const visibleStepCount = isPaceSkipped ? TOTAL_STEPS - 1 : TOTAL_STEPS;
  const displayStep = step >= 7 && isPaceSkipped ? step - 1 : step;
  const progress = (displayStep + 1) / visibleStepCount;

  const canProceed = useMemo(() => {
    switch (step) {
      case 0: return data.name.trim().length >= 2;
      case 1: return data.biologicalSex !== null;
      case 2: return data.age >= 13 && data.age <= 100;
      case 3: return data.heightCm >= 100 && data.heightCm <= 250;
      case 4: return data.weightKg >= 30 && data.weightKg <= 200;
      case 5: return data.goalWeightKg >= 30 && data.goalWeightKg <= 200;
      case 6: return data.paceKgPerWeek !== null;
      case 7: return data.activityLevel !== null;
      case 8: return data.archetype !== null;
      case 9: return true; // medical conditions optional
      default: return false;
    }
  }, [data, step]);

  const patch = useCallback(<K extends keyof StepData>(key: K, value: StepData[K]) => {
    setData((cur) => ({ ...cur, [key]: value }));
  }, []);

  const goBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 0) return router.back();
    let prev = step - 1;
    if (prev === 6 && isPaceSkipped) prev = 5;
    setStep(prev);
  };

  const goNext = () => {
    if (!canProceed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 9) {
      // Final step — push everything to transition for the single upsert.
      router.push({
        pathname: '/onboarding/transition' as any,
        params: {
          name: data.name.trim(),
          biologicalSex: data.biologicalSex!,
          age: String(data.age),
          height: data.heightCm.toFixed(2),
          weight: data.weightKg.toFixed(2),
          goalWeight: data.goalWeightKg.toFixed(2),
          paceKgPerWeek: data.paceKgPerWeek == null ? '' : String(data.paceKgPerWeek),
          goal: derivedGoal,
          activityLevel: String(data.activityLevel!),
          archetype: data.archetype!,
          unitPreference: data.unitPreference,
          medicalConditions: data.medicalConditions.join(','),
        },
      });
      return;
    }
    let next = step + 1;
    if (next === 6 && isPaceSkipped) next = 7;
    setStep(next);
  };

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
            <ThemedText variant="label" color={Colors.muted}>
              {displayStep + 1} / {visibleStepCount}
            </ThemedText>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          // Let the nested picker FlatList consume the pan on Android.
          nestedScrollEnabled
        >
          <Animated.View key={step} entering={FadeInDown.duration(220)}>
            {step === 0 && (
              <Question title="What should we call you?" subtitle="NutriSnap will use this to make the app feel personal.">
                <LargeInput value={data.name} onChangeText={(v) => patch('name', v)} placeholder="Your name" />
              </Question>
            )}

            {step === 1 && (
              <Question title="Choose your biological sex" subtitle="This is only used for nutrition estimates.">
                <ChoiceGrid
                  options={[
                    { key: 'female', title: 'Female', desc: 'Use female baseline estimates.', icon: 'female-outline' },
                    { key: 'male', title: 'Male', desc: 'Use male baseline estimates.', icon: 'male-outline' },
                  ]}
                  selected={data.biologicalSex}
                  onSelect={(v) => patch('biologicalSex', v as BiologicalSex)}
                />
              </Question>
            )}

            {step === 2 && (
              <Question title="What's your age?" subtitle="Age helps estimate your daily energy needs.">
                <ScrollWheelPicker min={13} max={100} value={data.age} onChange={(v) => patch('age', v)} />
              </Question>
            )}

            {step === 3 && (
              <HeightStep
                heightCm={data.heightCm}
                unit={data.unitPreference}
                onChangeCm={(v) => patch('heightCm', v)}
                onChangeUnit={(u) => patch('unitPreference', u)}
              />
            )}

            {step === 4 && (
              <WeightStep
                weightKg={data.weightKg}
                unit={data.unitPreference}
                onChangeKg={(v) => {
                  patch('weightKg', v);
                  // Keep goal weight in sync until the user moves it.
                  if (Math.abs(data.weightKg - data.goalWeightKg) < 0.05) patch('goalWeightKg', v);
                }}
                onChangeUnit={(u) => patch('unitPreference', u)}
              />
            )}

            {step === 5 && (
              <GoalWeightStep
                currentKg={data.weightKg}
                goalKg={data.goalWeightKg}
                unit={data.unitPreference}
                onChange={(v) => patch('goalWeightKg', v)}
              />
            )}

            {step === 6 && (
              <PaceStep
                pace={data.paceKgPerWeek ?? 0.5}
                weightGapKg={Math.abs(data.weightKg - data.goalWeightKg)}
                onChange={(v) => patch('paceKgPerWeek', v)}
              />
            )}

            {step === 7 && (
              <Question title="How active are you?" subtitle="Based on your lifestyle, we can assess your daily calorie requirements.">
                <CardList
                  options={ACTIVITY_OPTIONS}
                  selected={data.activityLevel}
                  onSelect={(v) => patch('activityLevel', v as number)}
                />
              </Question>
            )}

            {step === 8 && (
              <Question title="What's your eating style?" subtitle="We'll personalize your nutrition guidance.">
                <CardList
                  options={DIET_OPTIONS}
                  selected={data.archetype}
                  onSelect={(v) => patch('archetype', v as ArchetypeKey)}
                />
              </Question>
            )}

            {step === 9 && (
              <Question
                title="Any medical condition we should be aware of?"
                subtitle="This info will help us guide you to your fitness goals safely and quickly."
              >
                <MedicalConditions
                  selected={data.medicalConditions}
                  onChange={(v) => patch('medicalConditions', v)}
                />
              </Question>
            )}
          </Animated.View>

          <View style={styles.footer}>
            <Pressable
              style={[styles.continueButton, !canProceed && styles.continueDisabled]}
              onPress={goNext}
              disabled={!canProceed}
            >
              <ThemedText variant="button" color={canProceed ? Colors.white : Colors.muted}>
                {step === 9 ? "Let's go" : 'Continue'}
              </ThemedText>
              <Ionicons name="arrow-forward" size={18} color={canProceed ? Colors.white : Colors.muted} />
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ─── Reusable bits ───────────────────────────────────────────── */

function Question({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.question}>
      <ThemedText variant="h1" style={styles.title}>{title}</ThemedText>
      <ThemedText variant="body" color={Colors.muted} style={styles.subtitle}>{subtitle}</ThemedText>
      {children}
    </View>
  );
}

function LargeInput(props: React.ComponentProps<typeof TextInput> & { suffix?: string; containerStyle?: object }) {
  const { suffix, style, containerStyle, ...rest } = props;
  return (
    <View style={[styles.inputWrap, containerStyle]}>
      <TextInput {...rest} placeholderTextColor={Colors.muted} style={[styles.largeInput, style]} />
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
          <Pressable
            key={option.key}
            style={[styles.choiceCard, active && styles.choiceSelected]}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(option.key);
            }}
          >
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

interface CardListOption {
  key: string | number;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}

function CardList({
  options,
  selected,
  onSelect,
}: {
  options: CardListOption[];
  selected: string | number | null;
  onSelect: (key: string | number) => void;
}) {
  return (
    <View style={styles.cardList}>
      {options.map((option) => {
        const active = selected === option.key;
        return (
          <Pressable
            key={option.key}
            style={[styles.activityCard, active && styles.activityCardActive]}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(option.key);
            }}
          >
            <View style={styles.activityIcon}>
              <Ionicons name={option.icon} size={24} color={active ? PICKER_GREEN : Colors.brownMid} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.activityTitle}>{option.title}</ThemedText>
              <ThemedText style={styles.activityDesc}>{option.desc}</ThemedText>
            </View>
            {active && <Ionicons name="checkmark-circle" size={22} color={PICKER_GREEN} />}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ─── Height step ─────────────────────────────────────────────── */

function HeightStep({
  heightCm,
  unit,
  onChangeCm,
  onChangeUnit,
}: {
  heightCm: number;
  unit: UnitPreference;
  onChangeCm: (cm: number) => void;
  onChangeUnit: (u: UnitPreference) => void;
}) {
  const { feet, inches } = cmToFeetInches(heightCm);
  return (
    <Question
      title="What's your height?"
      subtitle={unit === 'metric' ? 'Enter your height in centimeters.' : 'Enter your height in feet and inches.'}
    >
      {unit === 'metric' ? (
        <ScrollWheelPicker min={100} max={250} value={Math.round(heightCm)} onChange={onChangeCm} unit="cm" />
      ) : (
        <View style={styles.dualPickerRow}>
          <View style={styles.dualPickerCol}>
            <ScrollWheelPicker
              min={3}
              max={8}
              value={feet}
              onChange={(ft) => onChangeCm(feetInchesToCm(ft, inches))}
              unit="ft"
              fontSize={42}
            />
          </View>
          <View style={styles.dualPickerCol}>
            <ScrollWheelPicker
              min={0}
              max={11}
              value={inches}
              onChange={(inch) => onChangeCm(feetInchesToCm(feet, inch))}
              unit="in"
              fontSize={42}
            />
          </View>
        </View>
      )}
      <UnitTogglePill
        left={{ key: 'metric', label: 'Cm' }}
        right={{ key: 'imperial', label: 'Ft/In' }}
        value={unit}
        onChange={onChangeUnit}
      />
    </Question>
  );
}

/* ─── Weight step ─────────────────────────────────────────────── */

function WeightStep({
  weightKg,
  unit,
  onChangeKg,
  onChangeUnit,
}: {
  weightKg: number;
  unit: UnitPreference;
  onChangeKg: (kg: number) => void;
  onChangeUnit: (u: UnitPreference) => void;
}) {
  const lbs = Math.round(kgToLb(weightKg));
  return (
    <Question
      title="What's your weight?"
      subtitle={unit === 'metric' ? 'Enter your weight in kilograms.' : 'Enter your weight in pounds.'}
    >
      {unit === 'metric' ? (
        <ScrollWheelPicker
          min={30}
          max={200}
          step={0.5}
          value={+weightKg.toFixed(1)}
          onChange={onChangeKg}
          unit="kg"
        />
      ) : (
        <ScrollWheelPicker
          min={66}
          max={440}
          value={lbs}
          onChange={(lb) => onChangeKg(+lbToKg(lb).toFixed(2))}
          unit="lb"
        />
      )}
      <UnitTogglePill
        left={{ key: 'metric', label: 'Kg' }}
        right={{ key: 'imperial', label: 'Lb' }}
        value={unit}
        onChange={onChangeUnit}
      />
    </Question>
  );
}

/* ─── Goal weight step ────────────────────────────────────────── */

function GoalWeightStep({
  currentKg,
  goalKg,
  unit,
  onChange,
}: {
  currentKg: number;
  goalKg: number;
  unit: UnitPreference;
  onChange: (kg: number) => void;
}) {
  const tip = goalTip(currentKg, goalKg);
  return (
    <Question title="What's your target weight?" subtitle="Set a realistic weight goal for yourself.">
      {/* Static tip card — was remounting with FadeIn on every scroll tick,
          causing 3-4 concurrent 220ms animations while the wheel spun. */}
      <View style={styles.tipCard}>
        <Ionicons name="bulb-outline" size={16} color={PICKER_GREEN} />
        <ThemedText style={styles.tipText}>{tip}</ThemedText>
      </View>
      {unit === 'metric' ? (
        <ScrollWheelPicker
          min={30}
          max={200}
          step={0.5}
          value={+goalKg.toFixed(1)}
          onChange={onChange}
          unit="kg"
        />
      ) : (
        <ScrollWheelPicker
          min={66}
          max={440}
          value={Math.round(kgToLb(goalKg))}
          onChange={(lb) => onChange(+lbToKg(lb).toFixed(2))}
          unit="lb"
        />
      )}
    </Question>
  );
}

function goalTip(currentKg: number, goalKg: number): string {
  if (Math.abs(currentKg - goalKg) < 0.1) {
    return 'Maintenance mode. Focus on consistency over change.';
  }
  const pct = Math.abs(goalKg - currentKg) / currentKg;
  const losing = goalKg < currentKg;
  if (pct <= 0.05) return 'Your target weight is perfectly aligned with your ideal weight range.';
  if (losing && pct <= 0.15) return 'This is a healthy, achievable goal.';
  if (losing) return "That's an ambitious goal. We'll guide you safely.";
  if (pct <= 0.15) return "A gradual gain is sustainable. Let's plan it right.";
  return 'Aim for steady progress. Muscle takes time to build.';
}

/* ─── Pace step ───────────────────────────────────────────────── */

function PaceStep({
  pace,
  weightGapKg,
  onChange,
}: {
  pace: number;
  weightGapKg: number;
  onChange: (v: number) => void;
}) {
  const subtitle = paceCopy(pace);
  const weeks = Math.max(1, Math.ceil(weightGapKg / pace));
  const eta = weeks < 8 ? `${weeks} ${weeks === 1 ? 'week' : 'weeks'}` : `${Math.ceil(weeks / 4.33)} months`;
  return (
    <Question title="How fast do you want to reach your goal?" subtitle={subtitle}>
      <View style={styles.paceValueWrap}>
        <ThemedText
          style={styles.paceValue}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {pace.toFixed(2)} kg
        </ThemedText>
        <ThemedText style={styles.paceValueLabel}>per week</ThemedText>
      </View>
      <PaceSlider min={0.25} max={1.0} step={0.05} value={pace} onChange={onChange} />
      {/* Static ETA card — the FadeIn key={eta} was remounting on every
          slider tick, competing with the slider gesture. */}
      <View style={styles.tipCard}>
        <Ionicons name="time-outline" size={16} color={PICKER_GREEN} />
        <ThemedText style={styles.tipText}>You will reach your goal in about {eta}.</ThemedText>
      </View>
    </Question>
  );
}

function paceCopy(pace: number): string {
  if (pace <= 0.25) return 'A gentle pace. Best for long-term sustainability.';
  if (pace < 0.5) return 'A steady, sustainable pace.';
  if (pace < 0.55) return 'This is a good pace, but you would need to work a bit harder.';
  if (pace < 0.8) return "Ambitious. You'll need to stay disciplined.";
  return 'Aggressive. We recommend slower for long-term results.';
}

/* ─── Pace slider (custom Reanimated/PanResponder) ───────────── */

function PaceSlider({
  min,
  max,
  step,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const TRACK_WIDTH_REF = useRef(0);
  const lastSteppedRef = useRef(value);

  const updateFromX = (x: number) => {
    const w = TRACK_WIDTH_REF.current;
    if (w <= 0) return;
    const clamped = Math.max(0, Math.min(w, x));
    const frac = clamped / w;
    const raw = min + frac * (max - min);
    const steps = Math.round((raw - min) / step);
    const stepped = +(min + steps * step).toFixed(2);
    if (stepped !== lastSteppedRef.current) {
      lastSteppedRef.current = stepped;
      Haptics.selectionAsync();
      onChange(stepped);
    }
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => updateFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => updateFromX(e.nativeEvent.locationX),
    }),
  ).current;

  const fillFrac = (value - min) / (max - min);

  return (
    <View
      style={styles.sliderHit}
      {...responder.panHandlers}
      onLayout={(e) => {
        TRACK_WIDTH_REF.current = e.nativeEvent.layout.width;
      }}
    >
      <View style={styles.sliderTrack}>
        <View style={[styles.sliderFill, { width: `${fillFrac * 100}%` }]} />
      </View>
      <View style={[styles.sliderThumb, { left: `${fillFrac * 100}%` }]} />
    </View>
  );
}

/* ─── Medical conditions ──────────────────────────────────────── */

function MedicalConditions({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const noneSelected = selected.length === 0;
  const toggle = (cond: string) => {
    Haptics.selectionAsync();
    if (selected.includes(cond)) onChange(selected.filter((c) => c !== cond));
    else onChange([...selected, cond]);
  };
  const selectNone = () => {
    Haptics.selectionAsync();
    onChange([]);
  };
  return (
    <View style={{ gap: Spacing.md }}>
      <Pressable
        style={[styles.condPill, styles.condPillFull, noneSelected && styles.condPillActive]}
        onPress={selectNone}
      >
        <View style={[styles.condCheck, noneSelected && styles.condCheckActive]} />
        <ThemedText style={[styles.condText, noneSelected && styles.condTextActive]}>None</ThemedText>
      </Pressable>
      <View style={styles.condDivider} />
      <View style={styles.condWrap}>
        {MEDICAL_CONDITIONS.map((cond) => {
          const active = selected.includes(cond);
          return (
            <Pressable
              key={cond}
              style={[styles.condPill, active && styles.condPillActive]}
              onPress={() => toggle(cond)}
            >
              <View style={[styles.condCheck, active && styles.condCheckActive]} />
              <ThemedText style={[styles.condText, active && styles.condTextActive]}>{cond}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ─── Unit toggle pill ────────────────────────────────────────── */

function UnitTogglePill<T extends string>({
  left,
  right,
  value,
  onChange,
}: {
  left: { key: T; label: string };
  right: { key: T; label: string };
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.unitTogglePill}>
      {[left, right].map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            style={[styles.unitToggleHalf, active && styles.unitToggleHalfActive]}
            onPress={() => {
              if (!active) {
                Haptics.selectionAsync();
                onChange(opt.key);
              }
            }}
          >
            <ThemedText style={[styles.unitToggleText, active && styles.unitToggleTextActive]}>{opt.label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  keyboard: { flex: 1 },
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
    backgroundColor: PICKER_GREEN,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  question: { gap: Spacing.lg },
  title: { fontSize: 30, lineHeight: 38 },
  subtitle: { maxWidth: 340 },
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
  largeInput: {
    flex: 1,
    fontSize: 30,
    fontFamily: 'Nunito_800ExtraBold',
    color: Colors.brown,
  },
  choiceGrid: { gap: Spacing.md },
  choiceCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  choiceSelected: {
    borderColor: PICKER_GREEN,
    backgroundColor: '#f0faf0',
  },
  choiceIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.oliveLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceIconActive: { backgroundColor: PICKER_GREEN },

  /* Activity / diet cards */
  cardList: { gap: 12 },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  activityCardActive: {
    borderColor: PICKER_GREEN,
    backgroundColor: '#f0faf0',
  },
  activityIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: { fontSize: 16, fontWeight: '600', color: '#2F241E' },
  activityDesc: { fontSize: 13, color: '#8a7e74', lineHeight: 18, marginTop: 2 },

  /* Dual picker layout (ft + in) */
  dualPickerRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  dualPickerCol: {
    flex: 1,
  },

  /* Unit toggle pill */
  unitTogglePill: {
    alignSelf: 'center',
    marginTop: Spacing.md,
    flexDirection: 'row',
    padding: 4,
    borderRadius: 999,
    backgroundColor: '#efe9e0',
  },
  unitToggleHalf: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
  },
  unitToggleHalfActive: { backgroundColor: PICKER_GREEN },
  unitToggleText: { fontSize: 13, color: '#8a7e74', fontFamily: Typography.fonts.bodySemiBold },
  unitToggleTextActive: { color: '#fff' },

  /* Tip card */
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e9f5ec',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tipText: { flex: 1, color: PICKER_GREEN, fontSize: 13, lineHeight: 18 },

  /* Pace */
  paceValueWrap: {
    alignItems: 'center',
    gap: 2,
    alignSelf: 'stretch',
    paddingHorizontal: 24,
  },
  paceValue: {
    fontSize: 40,
    lineHeight: 46,
    fontFamily: Typography.fonts.headingBold,
    color: '#2F241E',
    textAlign: 'center',
  },
  paceValueLabel: { fontSize: 15, color: '#8a7e74' },
  sliderHit: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginTop: Spacing.md,
  },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#efe9e0',
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: PICKER_GREEN,
  },
  sliderThumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: PICKER_GREEN,
    marginLeft: -11,
    top: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },

  /* Medical conditions */
  condPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8e2d6',
    borderRadius: 24,
  },
  condPillFull: { alignSelf: 'stretch', justifyContent: 'center', borderRadius: 14 },
  condPillActive: {
    borderColor: PICKER_GREEN,
    borderWidth: 1.5,
    backgroundColor: '#f0faf0',
  },
  condCheck: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#c4b9ab',
  },
  condCheckActive: {
    borderColor: PICKER_GREEN,
    backgroundColor: PICKER_GREEN,
  },
  condText: { fontSize: 14, color: '#2F241E' },
  condTextActive: { color: PICKER_GREEN, fontWeight: '500' },
  condDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#e8e2d6' },
  condWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  /* Footer */
  footer: { paddingTop: Spacing['2xl'], paddingBottom: Spacing.md },
  continueButton: {
    minHeight: 54,
    borderRadius: BorderRadius.md,
    backgroundColor: PICKER_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  continueDisabled: { backgroundColor: Colors.border, opacity: 0.6 },
});
