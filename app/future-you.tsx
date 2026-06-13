/**
 * Plan Reveal / Future-You Screen — Post-onboarding
 * Inspired by: assets/UI mockups/plan.png
 * Shows: archetype circle with all 4 animal images, macro grid, "Enter NutriSnap" CTA
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Dimensions, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  FadeInDown,
  FadeIn,
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/user.store';
import { ARCHETYPES, type ArchetypeKey } from '@/constants/archetypes';
import { ArchetypeColors, Spacing, BorderRadius, Colors } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ARCHETYPE_IMAGES: Record<string, any> = {
  wolf: require('@/assets/archetypes/wolf.png'),
  bear: require('@/assets/archetypes/bear.png'),
  lion: require('@/assets/archetypes/lion.png'),
  deer: require('@/assets/archetypes/deer.png'),
  tigress: require('@/assets/archetypes/tigress.png'),
  phoenix: require('@/assets/archetypes/phoenix.png'),
  doe: require('@/assets/archetypes/doe.png'),
  swan: require('@/assets/archetypes/swan.png'),
};

const MALE_ARCHETYPES: ArchetypeKey[] = ['wolf', 'bear', 'lion', 'deer'];
const FEMALE_ARCHETYPES: ArchetypeKey[] = ['tigress', 'phoenix', 'doe', 'swan'];

/** Animated count-up text component */
function CountUp({
  target,
  duration = 1200,
  delay = 0,
  suffix = '',
  color,
  style,
}: {
  target: number;
  duration?: number;
  delay?: number;
  suffix?: string;
  color: string;
  style?: any;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withDelay(
      delay,
      withTiming(target, { duration, easing: Easing.out(Easing.cubic) })
    );
  }, [target, delay, duration, animatedValue]);

  useAnimatedReaction(
    () => Math.round(animatedValue.value),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setDisplayValue)(current);
      }
    },
    [animatedValue]
  );

  return (
    <ThemedText variant="h1" color={color} style={style}>
      {displayValue}{suffix}
    </ThemedText>
  );
}

export default function FutureYouScreen() {
  const { theme } = useTheme();
  const { calorieGoal, macroGoals, archetype, profile } = useUserStore();
  const params = useLocalSearchParams<{ archetype?: string }>();

  const selectedArchetype = (params.archetype ?? archetype ?? 'wolf') as ArchetypeKey;
  const archetypeInfo = ARCHETYPES[selectedArchetype];
  const colors = ArchetypeColors[selectedArchetype];

  // Determine which set of 4 archetypes to show based on the selected one
  const isFemale = FEMALE_ARCHETYPES.includes(selectedArchetype);
  const archetypeSet = isFemale ? FEMALE_ARCHETYPES : MALE_ARCHETYPES;

  // Calculate macro grams
  const proteinG = macroGoals?.protein ?? Math.round(calorieGoal * archetypeInfo.macros.protein / 4);
  const carbsG = macroGoals?.carbs ?? Math.round(calorieGoal * archetypeInfo.macros.carbs / 4);
  const fatG = macroGoals?.fat ?? Math.round(calorieGoal * archetypeInfo.macros.fat / 9);

  // Motivational subtitle based on archetype
  const subtitleMap: Record<string, string> = {
    wolf: "Wolves thrive on precision. Let's build lean muscle together.",
    bear: "Bears dominate with power. Let's fuel your strength.",
    lion: "Lions lead from the front. Let's command your nutrition.",
    deer: "Deer run with purpose. Let's build your endurance.",
    tigress: "Tigresses are fierce and lean. Let's sculpt your power.",
    phoenix: "Phoenixes rise through transformation. Let's begin yours.",
    doe: "Does move with grace. Let's nourish your balance.",
    swan: "Swans glide with elegance. Let's refine your discipline.",
  };

  const handleEnter = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)/home');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Phase indicator */}
      <Animated.View entering={FadeIn.delay(100).duration(500)} style={styles.phaseHeader}>
        <ThemedText variant="label" color={theme.textMuted} style={styles.phaseText}>
          PHASE 6 / 6
        </ThemedText>
      </Animated.View>

      {/* Title */}
      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.titleSection}>
        <ThemedText variant="h1" align="center" style={styles.heading}>
          Your Journey Starts{'\n'}Today
        </ThemedText>
        <ThemedText variant="body" color={theme.textMuted} align="center" style={styles.subtitle}>
          {subtitleMap[selectedArchetype] ?? "Let's build your plan together."}
        </ThemedText>
      </Animated.View>

      {/* Circular archetype showcase */}
      <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.circleSection}>
        <View style={[styles.outerCircle, { borderColor: Colors.olive }]}>
          <View style={styles.archetypeImagesGrid}>
            {archetypeSet.map((key, index) => {
              const isSelected = key === selectedArchetype;
              return (
                <View
                  key={key}
                  style={[
                    styles.archetypeThumb,
                    isSelected && styles.archetypeThumbSelected,
                  ]}
                >
                  <Image
                    source={ARCHETYPE_IMAGES[key]}
                    style={[
                      styles.archetypeThumbImage,
                      !isSelected && { opacity: 0.6 },
                    ]}
                    resizeMode="contain"
                  />
                </View>
              );
            })}
          </View>

          {/* Mode badge */}
          <View style={[styles.modeBadge, { backgroundColor: Colors.olive }]}>
            <ThemedText variant="label" color="white" align="center" style={styles.modeBadgeText}>
              {archetypeInfo.name.toUpperCase()}{'\n'}MODE
            </ThemedText>
          </View>
        </View>
      </Animated.View>

      {/* Macro Grid 2×2 */}
      <Animated.View entering={FadeInDown.delay(600).springify()} style={styles.macroGrid}>
        <View style={styles.macroRow}>
          <View style={styles.macroCell}>
            <ThemedText variant="label" color={theme.textMuted}>CALORIES</ThemedText>
            <CountUp target={calorieGoal} delay={700} color={theme.text} style={styles.macroValue} />
            <ThemedText variant="label" color={theme.textMuted}>kcal</ThemedText>
          </View>
          <View style={[styles.macroDividerV, { backgroundColor: theme.border }]} />
          <View style={styles.macroCell}>
            <ThemedText variant="label" color={theme.textMuted}>PROTEIN</ThemedText>
            <CountUp target={proteinG} delay={800} suffix="g" color={Colors.olive} style={styles.macroValue} />
            <View style={[styles.macroUnderline, { backgroundColor: Colors.olive }]} />
          </View>
        </View>
        <View style={[styles.macroDividerH, { backgroundColor: theme.border }]} />
        <View style={styles.macroRow}>
          <View style={styles.macroCell}>
            <ThemedText variant="label" color={theme.textMuted}>CARBS</ThemedText>
            <CountUp target={carbsG} delay={900} suffix="g" color={Colors.orange} style={styles.macroValue} />
            <View style={[styles.macroUnderline, { backgroundColor: Colors.orange }]} />
          </View>
          <View style={[styles.macroDividerV, { backgroundColor: theme.border }]} />
          <View style={styles.macroCell}>
            <ThemedText variant="label" color={theme.textMuted}>FAT</ThemedText>
            <CountUp target={fatG} delay={1000} suffix="g" color={Colors.brownMid} style={styles.macroValue} />
            <View style={[styles.macroUnderline, { backgroundColor: Colors.brownMid }]} />
          </View>
        </View>
      </Animated.View>

      {/* Enter CTA */}
      <Animated.View entering={FadeInDown.delay(1100).springify()} style={styles.ctaSection}>
        <Pressable
          style={[styles.enterButton, { backgroundColor: Colors.orange }]}
          onPress={handleEnter}
        >
          <ThemedText variant="button" color="white" style={styles.enterButtonText}>
            Enter NutriSnap
          </ThemedText>
        </Pressable>
        <ThemedText variant="label" color={theme.textMuted} align="center" style={styles.ctaFooter}>
          Plan ready. Profile optimized.
        </ThemedText>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  phaseHeader: {
    alignItems: 'center',
    paddingTop: Spacing.base,
    marginBottom: Spacing.sm,
  },
  phaseText: {
    letterSpacing: 2,
    fontSize: 12,
  },
  titleSection: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  heading: {
    fontSize: 30,
    lineHeight: 38,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    maxWidth: 300,
    alignSelf: 'center',
    lineHeight: 22,
  },
  circleSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  outerCircle: {
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.6,
    borderRadius: SCREEN_WIDTH * 0.3,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  archetypeImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: SCREEN_WIDTH * 0.45,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  archetypeThumb: {
    width: SCREEN_WIDTH * 0.18,
    height: SCREEN_WIDTH * 0.18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  archetypeThumbSelected: {
    transform: [{ scale: 1.15 }],
  },
  archetypeThumbImage: {
    width: '90%',
    height: '90%',
  },
  modeBadge: {
    position: 'absolute',
    bottom: -14,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  modeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    lineHeight: 16,
  },
  macroGrid: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  macroCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.base,
    gap: 2,
  },
  macroValue: {
    fontSize: 28,
  },
  macroUnderline: {
    width: 40,
    height: 3,
    borderRadius: 1.5,
    marginTop: 4,
  },
  macroDividerV: {
    width: 1,
    height: 60,
  },
  macroDividerH: {
    height: 1,
    width: '100%',
  },
  ctaSection: {
    paddingHorizontal: Spacing.xl,
    marginTop: 'auto',
    paddingBottom: Spacing['2xl'],
  },
  enterButton: {
    paddingVertical: Spacing.base + 2,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  enterButtonText: {
    fontSize: 18,
    letterSpacing: 0.5,
  },
  ctaFooter: {
    marginTop: Spacing.md,
    fontStyle: 'italic',
  },
});
