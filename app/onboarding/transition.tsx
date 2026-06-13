/**
 * Transition / Social Proof screen
 * Inspired by: assets/UI mockups/transition.png
 * Shows community stats and testimonial before plan reveal
 */

import { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/user.store';
import { Spacing, BorderRadius, Colors } from '@/constants/theme';
import type { ArchetypeKey } from '@/constants/archetypes';
import type { GoalType, BiologicalSex } from '@/types/archetype';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function TransitionScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams();
  const { completeOnboarding } = useUserStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Progress bar animation
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    progressWidth.value = withTiming(83, { duration: 1200, easing: Easing.out(Easing.cubic) });
  }, []);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const handleBuildPlan = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      setIsSubmitting(true);

      // Complete onboarding with all collected data
      const result = await completeOnboarding({
        name: (params.name as string) || 'User',
        biological_sex: (params.biologicalSex as BiologicalSex) || 'male',
        age: parseInt(params.age as string) || 25,
        weight_kg: parseFloat(params.weight as string) || 70,
        height_cm: parseFloat(params.height as string) || 170,
        goal_type: (params.goal as GoalType) || 'maintain',
        activity_level: parseInt(params.activityLevel as string) || 3,
        archetype: (params.archetype as ArchetypeKey) || 'wolf',
      });

      if (result.success) {
        router.replace({
          pathname: '/future-you',
          params: { archetype: params.archetype as string },
        });
      } else {
        // Even if DB fails, proceed to future-you for demo
        console.error('Onboarding save error:', result.error);
        router.replace({
          pathname: '/future-you',
          params: { archetype: params.archetype as string },
        });
      }
    } catch (error) {
      console.error('Transition error:', error);
      router.replace({
        pathname: '/future-you',
        params: { archetype: params.archetype as string },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <Animated.View entering={FadeIn.delay(100).duration(500)} style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="leaf" size={20} color={Colors.olive} />
          <ThemedText variant="bodyMedium" color={Colors.olive} style={styles.brandName}>
            NutriSnap
          </ThemedText>
        </View>
        <Ionicons name="notifications-outline" size={22} color={theme.textMuted} />
      </Animated.View>

      {/* Progress bar */}
      <Animated.View entering={FadeIn.delay(200).duration(500)} style={styles.progressContainer}>
        <View style={styles.progressRow}>
          <ThemedText variant="label" color={theme.textMuted}>Progress</ThemedText>
          <ThemedText variant="label" color={theme.textMuted}>5 / 6</ThemedText>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
          <Animated.View style={[styles.progressFill, { backgroundColor: Colors.olive }, progressStyle]} />
        </View>
      </Animated.View>

      {/* Main content */}
      <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.content}>
        <ThemedText variant="h1" align="center" style={styles.heading}>
          Join Thousands{'\n'}Snapping With{'\n'}NutriSnap
        </ThemedText>
        <ThemedText
          variant="body"
          color={theme.textMuted}
          align="center"
          style={styles.subtitle}
        >
          Real people, real transformations. Your journey to a healthier you starts with a community that supports every bite.
        </ThemedText>
      </Animated.View>

      {/* Stats Row */}
      <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <View style={[styles.statIconCircle, { backgroundColor: Colors.olive + '20' }]}>
            <Ionicons name="restaurant-outline" size={22} color={Colors.olive} />
          </View>
          <ThemedText variant="h2" color={Colors.olive}>100K+</ThemedText>
          <ThemedText variant="label" color={theme.textMuted}>MEALS LOGGED</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <View style={[styles.statIconCircle, { backgroundColor: Colors.orange + '20' }]}>
            <Ionicons name="camera-outline" size={22} color={Colors.orange} />
          </View>
          <ThemedText variant="h2" color={Colors.orange}>50K+</ThemedText>
          <ThemedText variant="label" color={theme.textMuted}>FOOD SCANS</ThemedText>
        </View>
      </Animated.View>

      {/* Community stat */}
      <Animated.View entering={FadeInDown.delay(650).springify()} style={styles.communityCard}>
        <View style={[styles.communityInner, { backgroundColor: Colors.oliveLight + '30' }]}>
          <View style={styles.communityAvatars}>
            {['🧑‍🍳', '👩‍⚕️', '🧑‍💼', '👩‍🔬'].map((emoji, i) => (
              <View
                key={i}
                style={[styles.avatarCircle, { backgroundColor: theme.card, marginLeft: i > 0 ? -8 : 0 }]}
              >
                <ThemedText style={styles.avatarEmoji}>{emoji}</ThemedText>
              </View>
            ))}
            <View style={[styles.avatarCircle, { backgroundColor: Colors.olive, marginLeft: -8 }]}>
              <ThemedText variant="labelSmall" color="white">+12k</ThemedText>
            </View>
          </View>
          <View style={styles.communityText}>
            <ThemedText variant="bodyMedium">1M+ Calories</ThemedText>
            <ThemedText variant="label" color={theme.textMuted}>
              Tracked by our growing community this month.
            </ThemedText>
          </View>
        </View>
      </Animated.View>

      {/* Testimonial */}
      <Animated.View entering={FadeInDown.delay(800).springify()} style={styles.testimonialCard}>
        <View style={[styles.testimonialInner, { backgroundColor: theme.card }]}>
          <View style={[styles.testimonialAvatar, { backgroundColor: Colors.oliveLight + '40' }]}>
            <ThemedText style={styles.testimonialEmoji}>🌟</ThemedText>
          </View>
          <ThemedText variant="h3" color={Colors.olive} align="center" style={styles.testimonialScore}>
            99
          </ThemedText>
          <ThemedText
            variant="body"
            color={theme.textSecondary}
            align="center"
            style={styles.testimonialQuote}
          >
            "NutriSnap changed how I look at food. It's not about restriction anymore; it's about awareness and the community keeps me coming back every single day."
          </ThemedText>
          <ThemedText variant="label" color={theme.textMuted} align="center" style={styles.testimonialAuthor}>
            — Amy R., Lost 15lbs & Gained Confidence
          </ThemedText>
        </View>
      </Animated.View>

      {/* CTA Button */}
      <Animated.View entering={FadeInDown.delay(1000).springify()} style={styles.ctaSection}>
        <Pressable
          style={[styles.ctaButton, { backgroundColor: Colors.orange }]}
          onPress={handleBuildPlan}
          disabled={isSubmitting}
        >
          <ThemedText variant="button" color="white" style={styles.ctaText}>
            {isSubmitting ? 'Building Your Plan...' : "Let's Build Your Plan"}
          </ThemedText>
        </Pressable>
        <ThemedText variant="label" color={theme.textMuted} align="center" style={styles.ctaFooter}>
          Free for 7 days. Join over 150,000+ active members.
        </ThemedText>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '700',
  },
  progressContainer: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  heading: {
    fontSize: 26,
    lineHeight: 34,
    marginBottom: Spacing.md,
  },
  subtitle: {
    maxWidth: 320,
    alignSelf: 'center',
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  statIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  communityCard: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  communityInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  communityAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  avatarEmoji: {
    fontSize: 16,
  },
  communityText: {
    flex: 1,
  },
  testimonialCard: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  testimonialInner: {
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  testimonialAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  testimonialEmoji: {
    fontSize: 24,
  },
  testimonialScore: {
    marginBottom: Spacing.sm,
  },
  testimonialQuote: {
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: Spacing.sm,
    maxWidth: 300,
  },
  testimonialAuthor: {
    fontSize: 11,
  },
  ctaSection: {
    paddingHorizontal: Spacing.xl,
    marginTop: 'auto',
    paddingBottom: Spacing.xl,
  },
  ctaButton: {
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
  },
  ctaFooter: {
    marginTop: Spacing.sm,
    fontSize: 11,
  },
});
