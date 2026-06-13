/**
 * Welcome / Get Started screen
 * First screen users see when opening NutriSnap
 * Inspired by: assets/UI mockups/welcome.png
 */

import { View, StyleSheet, Dimensions, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ui/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/auth.store';
import { Spacing, BorderRadius, Colors } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function WelcomeScreen() {
  const { theme } = useTheme();
  const { session, isInitialized } = useAuthStore();

  // If already authenticated, the _layout guard will redirect
  // so this screen won't show for long

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/onboarding/continue' as any);
  };

  const handleLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/auth');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Decorative blobs */}
      <View style={[styles.blobTopRight, { backgroundColor: Colors.oliveLight + '40' }]} />
      <View style={[styles.blobLeft, { backgroundColor: Colors.orangeLight + '50' }]} />
      <View style={[styles.blobBottomLeft, { backgroundColor: Colors.oliveLight + '30' }]} />

      {/* App icon badge */}
      <Animated.View entering={FadeIn.delay(100).duration(600)} style={styles.iconBadge}>
        <View style={[styles.appIcon, { backgroundColor: Colors.olive }]}>
          <Ionicons name="leaf" size={20} color="white" />
        </View>
      </Animated.View>

      {/* Hero illustration area */}
      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.heroContainer}>
        <View style={[styles.heroImageWrapper, { backgroundColor: Colors.brown }]}>
          <Image
            source={require('@/assets/onboarding/welcome.png')}
            style={styles.heroImage}
            resizeMode="cover"
          />
        </View>
      </Animated.View>

      {/* Text content */}
      <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.textSection}>
        <ThemedText variant="h1" align="center" style={styles.heading}>
          Transform Your{'\n'}Relationship With{'\n'}Food
        </ThemedText>

        <ThemedText
          variant="bodyMedium"
          color={Colors.olive}
          align="center"
          style={styles.tagline}
        >
          Snap. Track. Transform.
        </ThemedText>

        <ThemedText
          variant="body"
          color={theme.textMuted}
          align="center"
          style={styles.subtitle}
        >
          AI-powered nutrition tracking designed{'\n'}around who you want to become.
        </ThemedText>
      </Animated.View>

      {/* Buttons */}
      <Animated.View entering={FadeInDown.delay(600).springify()} style={styles.buttonSection}>
        <Pressable
          style={[styles.getStartedButton, { backgroundColor: Colors.orange }]}
          onPress={handleGetStarted}
        >
          <ThemedText variant="button" color="white" align="center">
            Get Started
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.loginButton, { borderColor: theme.border }]}
          onPress={handleLogin}
        >
          <ThemedText variant="button" color={theme.text} align="center">
            Log In
          </ThemedText>
        </Pressable>
      </Animated.View>

      {/* Trust line */}
      <Animated.View entering={FadeIn.delay(800).duration(600)} style={styles.trustSection}>
        <ThemedText
          variant="label"
          color={theme.textMuted}
          align="center"
          style={styles.trustText}
        >
          TRUSTED BY THOUSANDS BUILDING HEALTHIER HABITS.
        </ThemedText>
        <View style={styles.dots}>
          <View style={[styles.dot, { backgroundColor: Colors.olive }]} />
          <View style={[styles.dot, { backgroundColor: Colors.oliveLight }]} />
          <View style={[styles.dot, { backgroundColor: Colors.oliveLight }]} />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  blobTopRight: {
    position: 'absolute',
    top: -40,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  blobLeft: {
    position: 'absolute',
    top: 200,
    left: -80,
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  blobBottomLeft: {
    position: 'absolute',
    bottom: 120,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  iconBadge: {
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.base,
  },
  appIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  heroImageWrapper: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.55,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  textSection: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  heading: {
    fontSize: 32,
    lineHeight: 40,
    marginBottom: Spacing.md,
  },
  tagline: {
    fontStyle: 'italic',
    marginBottom: Spacing.md,
    fontSize: 18,
  },
  subtitle: {
    maxWidth: 280,
  },
  buttonSection: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  getStartedButton: {
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  loginButton: {
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  trustSection: {
    alignItems: 'center',
    paddingBottom: Spacing.xl,
  },
  trustText: {
    letterSpacing: 1.5,
    fontSize: 10,
    marginBottom: Spacing.md,
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
