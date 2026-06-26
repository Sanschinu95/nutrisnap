import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { useUserStore } from '@/stores/user.store';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import type { ArchetypeKey } from '@/constants/archetypes';
import type { BiologicalSex, GoalType } from '@/types/archetype';
import type { UnitPreference } from '@/lib/units';

export default function TransitionScreen() {
  const params = useLocalSearchParams();
  const { completeOnboarding } = useUserStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 1200 });
  }, [progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const handleBuildPlan = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSubmitting(true);
    try {
      const unitPreference = (params.unitPreference as UnitPreference) === 'imperial'
        ? 'imperial'
        : 'metric';
      const splitCsv = (raw: unknown): string[] => {
        if (typeof raw !== 'string' || raw.length === 0) return [];
        return raw.split(',').map((part) => part.trim()).filter(Boolean);
      };
      const dietary = {
        allergies: splitCsv(params.allergies),
        diets: splitCsv(params.dietPreferences),
        custom: splitCsv(params.customPreferences),
      };
      const hasDietary =
        dietary.allergies.length > 0 || dietary.diets.length > 0 || dietary.custom.length > 0;
      const result = await completeOnboarding({
        name: (params.name as string) || 'User',
        biological_sex: (params.biologicalSex as BiologicalSex) || 'male',
        age: parseInt(params.age as string, 10) || 25,
        weight_kg: parseFloat(params.weight as string) || 70,
        height_cm: parseFloat(params.height as string) || 170,
        goal_type: (params.goal as GoalType) || 'maintain',
        activity_level: parseInt(params.activityLevel as string, 10) || 3,
        archetype: (params.archetype as ArchetypeKey) || 'lion',
        unit_preference: unitPreference,
        dietary_preferences: hasDietary ? dietary : undefined,
      });
      if (!result.success) console.warn('Onboarding save error:', result.error);
      router.replace('/future-you');
    } catch (error) {
      console.error('Transition error:', error);
      router.replace('/future-you');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoMark}>
          <Ionicons name="leaf-outline" size={22} color={Colors.olive} />
        </View>
        <ThemedText variant="bodySemiBold" color={Colors.olive}>NutriSnap</ThemedText>
      </View>

      <Animated.View entering={FadeInDown.springify()} style={styles.content}>
        <View style={styles.progressShell}>
          <Animated.View style={[styles.progressFill, progressStyle]} />
        </View>
        <ThemedText variant="h1" align="center" style={styles.title}>
          Your food companion is almost ready.
        </ThemedText>
        <ThemedText variant="body" color={Colors.muted} align="center" style={styles.subtitle}>
          We are preparing your calorie target, macro guide, hydration rhythm, and daily route.
        </ThemedText>

        <View style={styles.previewCard}>
          <PreviewRow icon="flame-outline" label="Calories" />
          <PreviewRow icon="pulse-outline" label="Macros" />
          <PreviewRow icon="water-outline" label="Hydration" />
          <PreviewRow icon="git-branch-outline" label="Nutrition route" />
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <Pressable style={styles.ctaButton} onPress={handleBuildPlan} disabled={isSubmitting}>
          <ThemedText variant="button" color="white">
            {isSubmitting ? 'Preparing...' : 'Enter NutriSnap'}
          </ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function PreviewRow({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.previewRow}>
      <Ionicons name={icon} size={20} color={Colors.olive} />
      <ThemedText variant="bodyMedium">{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  progressShell: {
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
  title: {
    fontSize: 34,
    lineHeight: 41,
  },
  subtitle: {
    maxWidth: 320,
    alignSelf: 'center',
  },
  previewCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  footer: {
    padding: Spacing.xl,
  },
  ctaButton: {
    minHeight: 54,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
