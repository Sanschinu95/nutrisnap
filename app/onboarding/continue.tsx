/**
 * Continue / Fun Facts page - pre-onboarding engagement screen
 * Inspired by: assets/UI mockups/continue.png
 */

import { View, StyleSheet, Dimensions, Pressable, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Colors } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ContinueScreen() {
  const { theme } = useTheme();

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/onboarding');
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText variant="bodyMedium" color={Colors.olive} style={styles.brandName}>
            NutriSnap
          </ThemedText>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <View style={[styles.closeCircle, { backgroundColor: theme.card }]}>
              <Ionicons name="close" size={20} color={theme.textMuted} />
            </View>
          </Pressable>
        </View>

        {/* Hero image */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.heroContainer}>
          <View style={[styles.heroImageWrapper, { backgroundColor: Colors.brown }]}>
            <Image
              source={require('@/assets/onboarding/continue.png')}
              style={styles.heroImage}
              resizeMode="cover"
            />
          </View>
        </Animated.View>

        {/* Text content */}
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.textSection}>
          <ThemedText variant="h1" align="center" style={styles.heading}>
            You're Not Counting{'\n'}Calories.
          </ThemedText>

          <ThemedText
            variant="h3"
            color={Colors.olive}
            align="center"
            style={styles.subheading}
          >
            You're Becoming Someone New.
          </ThemedText>

          <ThemedText
            variant="body"
            color={theme.textMuted}
            align="center"
            style={styles.description}
          >
            Choose your identity. Build better habits.{'\n'}Track effortlessly with AI.
          </ThemedText>
        </Animated.View>

        {/* Pagination */}
        <Animated.View entering={FadeIn.delay(500).duration(600)} style={styles.pagination}>
          <ThemedText variant="label" color={theme.textMuted}>
            1 / 6
          </ThemedText>
          <View style={styles.paginationDots}>
            <View style={[styles.dotActive, { backgroundColor: Colors.olive }]} />
            <View style={[styles.dotInactive, { backgroundColor: theme.border }]} />
            <View style={[styles.dotInactive, { backgroundColor: theme.border }]} />
            <View style={[styles.dotInactive, { backgroundColor: theme.border }]} />
            <View style={[styles.dotInactive, { backgroundColor: theme.border }]} />
            <View style={[styles.dotInactive, { backgroundColor: theme.border }]} />
          </View>
        </Animated.View>

        {/* Spacer to push button down on taller screens */}
        <View style={styles.flexSpacer} />

        {/* Continue button */}
        <Animated.View entering={FadeInDown.delay(600).springify()} style={styles.buttonSection}>
          <Pressable
            style={[styles.continueButton, { backgroundColor: Colors.orange }]}
            onPress={handleContinue}
          >
            <ThemedText variant="button" color="white" style={styles.buttonText}>
              Continue
            </ThemedText>
            <Ionicons name="arrow-forward" size={20} color="white" />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  brandName: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  heroImageWrapper: {
    width: SCREEN_WIDTH - Spacing.xl * 2,
    height: SCREEN_WIDTH * 0.55,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  textSection: {
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  heading: {
    fontSize: 28,
    lineHeight: 36,
    marginBottom: Spacing.md,
  },
  subheading: {
    color: Colors.olive,
    marginBottom: Spacing.base,
    fontSize: 18,
  },
  description: {
    maxWidth: 300,
    lineHeight: 22,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  paginationDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dotActive: {
    width: 24,
    height: 6,
    borderRadius: 3,
  },
  dotInactive: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  flexSpacer: {
    flexGrow: 1,
    minHeight: Spacing.xl,
  },
  buttonSection: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  buttonText: {
    fontSize: 18,
  },
});
