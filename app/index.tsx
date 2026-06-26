/**
 * Welcome / Landing screen — single green hero moment.
 *
 * Full-bleed green background, white "NutriSnap" wordmark with animated
 * entrance, followed by staggered Get Started + Log In buttons.
 */

import { StyleSheet, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  ZoomIn,
} from 'react-native-reanimated';
import { useAuthStore } from '@/stores/auth.store';
import { Spacing, BorderRadius } from '@/constants/theme';

// Slightly deepened green for full-bleed hero impact
const HERO_GREEN = '#3D9B40';

export default function WelcomeScreen() {
  const { session, isInitialized } = useAuthStore();

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/onboarding' as any);
  };

  const handleLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/auth');
  };

  return (
    <View style={styles.container}>
      {/* Wordmark — animated entrance */}
      <Animated.View
        entering={FadeIn.duration(700).delay(100)}
        style={styles.wordmarkWrap}
      >
        <Animated.Text
          entering={ZoomIn.duration(700).delay(100)}
          style={styles.wordmark}
        >
          NutriSnap
        </Animated.Text>
        <Animated.Text
          entering={FadeIn.duration(500).delay(600)}
          style={styles.tagline}
        >
          Understand Your Food
        </Animated.Text>
      </Animated.View>

      {/* Buttons — staggered entrance after wordmark */}
      <Animated.View
        entering={FadeInDown.delay(900).springify().damping(18)}
        style={styles.buttonSection}
      >
        <Pressable style={styles.getStartedButton} onPress={handleGetStarted}>
          <Animated.Text style={styles.getStartedText}>
            Get Started
          </Animated.Text>
        </Pressable>

        <Pressable style={styles.loginButton} onPress={handleLogin}>
          <Animated.Text style={styles.loginText}>
            Log In
          </Animated.Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HERO_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  wordmarkWrap: {
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
  },
  wordmark: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 52,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
    marginTop: Spacing.sm,
  },
  buttonSection: {
    width: '100%',
    gap: Spacing.md,
    position: 'absolute',
    bottom: 80,
    left: Spacing.xl,
    right: Spacing.xl,
    paddingHorizontal: 0,
  },
  getStartedButton: {
    backgroundColor: '#F8F7F4',
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  getStartedText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    color: HERO_GREEN,
  },
  loginButton: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  loginText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    color: '#FFFFFF',
  },
});
