/**
 * Diet & Allergies onboarding step
 * Inspired by: assets/UI mockups/diet.png
 */

import { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Colors } from '@/constants/theme';

const ALLERGIES = [
  'Peanuts', 'Dairy', 'Gluten', 'Soy',
  'Shellfish', 'Eggs', 'Tree Nuts', 'Fish',
];

const DIET_PREFERENCES = [
  'Vegetarian', 'Vegan', 'Keto', 'Paleo', 'High Protein',
];

export default function DietScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams();

  const [selectedAllergies, setSelectedAllergies] = useState<Set<string>>(new Set());
  const [selectedDiets, setSelectedDiets] = useState<Set<string>>(new Set());
  const [customOption, setCustomOption] = useState('');
  const [customOptions, setCustomOptions] = useState<string[]>([]);

  const toggleAllergy = (allergy: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedAllergies(prev => {
      const next = new Set(prev);
      if (next.has(allergy)) next.delete(allergy);
      else next.add(allergy);
      return next;
    });
  };

  const toggleDiet = (diet: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDiets(prev => {
      const next = new Set(prev);
      if (next.has(diet)) next.delete(diet);
      else next.add(diet);
      return next;
    });
  };

  const addCustomOption = () => {
    const trimmed = customOption.trim();
    if (trimmed && !customOptions.includes(trimmed)) {
      setCustomOptions(prev => [...prev, trimmed]);
      setCustomOption('');
    }
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Pass all params through to transition screen
    router.push({
      pathname: '/onboarding/transition' as any,
      params: {
        ...params,
        allergies: Array.from(selectedAllergies).join(','),
        dietPreferences: Array.from(selectedDiets).join(','),
        customPreferences: customOptions.join(','),
      },
    });
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header with progress */}
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.progressSection}>
          <ThemedText variant="label" color={theme.textMuted} style={styles.progressLabel}>
            PROGRESS
          </ThemedText>
          <View style={styles.progressDots}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: i <= 4 ? Colors.olive : theme.border,
                    width: i <= 4 ? 32 : 20,
                  },
                ]}
              />
            ))}
          </View>
          <ThemedText variant="label" color={theme.textMuted}>4 / 6</ThemedText>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Title */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <ThemedText variant="h1" style={styles.title}>
            Anything we should know?
          </ThemedText>
          <ThemedText variant="body" color={theme.textMuted} style={styles.subtitle}>
            Help us personalize your NutriSnap experience by selecting your dietary needs.
          </ThemedText>
        </Animated.View>

        {/* Allergies */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="warning-outline" size={20} color={Colors.orange} />
            <ThemedText variant="h3" color={Colors.orange} style={styles.sectionTitle}>
              Allergies
            </ThemedText>
          </View>
          <View style={styles.chipGrid}>
            {ALLERGIES.map(allergy => (
              <Pressable
                key={allergy}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selectedAllergies.has(allergy)
                      ? Colors.olive
                      : theme.card,
                    borderColor: selectedAllergies.has(allergy)
                      ? Colors.olive
                      : theme.border,
                  },
                ]}
                onPress={() => toggleAllergy(allergy)}
              >
                <ThemedText
                  variant="bodyMedium"
                  color={selectedAllergies.has(allergy) ? 'white' : theme.text}
                >
                  {allergy}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Diet Preferences */}
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="leaf-outline" size={20} color={Colors.olive} />
            <ThemedText variant="h3" style={styles.sectionTitle}>
              Diet Preferences
            </ThemedText>
          </View>
          <View style={styles.chipGrid}>
            {DIET_PREFERENCES.map(diet => (
              <Pressable
                key={diet}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selectedDiets.has(diet)
                      ? Colors.olive
                      : theme.card,
                    borderColor: selectedDiets.has(diet)
                      ? Colors.olive
                      : theme.border,
                  },
                ]}
                onPress={() => toggleDiet(diet)}
              >
                <ThemedText
                  variant="bodyMedium"
                  color={selectedDiets.has(diet) ? 'white' : theme.text}
                >
                  {diet}
                </ThemedText>
              </Pressable>
            ))}
            {/* Custom options */}
            {customOptions.map(opt => (
              <View
                key={opt}
                style={[styles.chip, { backgroundColor: Colors.olive, borderColor: Colors.olive }]}
              >
                <ThemedText variant="bodyMedium" color="white">
                  {opt}
                </ThemedText>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Custom input */}
        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.customSection}>
          <View style={[styles.customCard, { backgroundColor: theme.card }]}>
            <ThemedText variant="h3" style={styles.customTitle}>
              Add Custom Option
            </ThemedText>
            <View style={styles.customInputRow}>
              <TextInput
                style={[styles.customInput, { color: theme.text, borderColor: theme.border }]}
                value={customOption}
                onChangeText={setCustomOption}
                placeholder="e.g. Low sodium, Fructose"
                placeholderTextColor={theme.textMuted}
                returnKeyType="done"
                onSubmitEditing={addCustomOption}
              />
              <Pressable
                style={[styles.addButton, { borderColor: theme.border }]}
                onPress={addCustomOption}
              >
                <Ionicons name="add-circle-outline" size={24} color={theme.primary} />
              </Pressable>
            </View>
            <ThemedText variant="label" color={theme.textMuted}>
              Anything else you'd like to exclude or focus on?
            </ThemedText>
          </View>
        </Animated.View>

        {/* Motivational banner */}
        <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.bannerSection}>
          <View style={[styles.banner, { backgroundColor: Colors.olive + '15' }]}>
            <ThemedText variant="bodyMedium" color={Colors.olive}>
              🌱 Fuel your transformation.
            </ThemedText>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Bottom button */}
      <View style={styles.bottomSection}>
        <Pressable
          style={[styles.continueButton, { backgroundColor: Colors.olive }]}
          onPress={handleContinue}
        >
          <ThemedText variant="button" color="white">
            Continue
          </ThemedText>
          <Ionicons name="arrow-forward" size={20} color="white" />
        </Pressable>
        <ThemedText variant="label" color={theme.textMuted} align="center" style={styles.footerNote}>
          You can change these anytime in your profile settings.
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
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
    gap: Spacing.xs,
  },
  progressLabel: {
    letterSpacing: 2,
    fontSize: 10,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  progressDot: {
    height: 4,
    borderRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['3xl'],
  },
  title: {
    fontSize: 26,
    lineHeight: 34,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  customSection: {
    marginBottom: Spacing.xl,
  },
  customCard: {
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
  },
  customTitle: {
    marginBottom: Spacing.md,
  },
  customInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  customInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    fontFamily: 'Inter_400Regular',
  },
  addButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  bannerSection: {
    marginBottom: Spacing.xl,
  },
  banner: {
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  bottomSection: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  footerNote: {
    marginTop: Spacing.md,
  },
});
