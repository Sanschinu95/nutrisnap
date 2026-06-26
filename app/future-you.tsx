import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { useUserStore } from '@/stores/user.store';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';

function CountUp({ target, suffix = '', delay = 0, color = Colors.brown }: { target: number; suffix?: string; delay?: number; color?: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withDelay(delay, withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [animatedValue, delay, target]);

  useAnimatedReaction(
    () => Math.round(animatedValue.value),
    (current, previous) => {
      if (current !== previous) runOnJS(setDisplayValue)(current);
    },
    [animatedValue]
  );

  return <ThemedText variant="h1" color={color}>{displayValue}{suffix}</ThemedText>;
}

export default function FutureYouScreen() {
  const { calorieGoal, macroGoals, profile } = useUserStore();
  const protein = macroGoals.protein ?? 0;
  const carbs = macroGoals.carbs ?? 0;
  const fat = macroGoals.fat ?? 0;

  const handleEnter = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)/home');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeInDown.springify()} style={styles.content}>
        <View style={styles.logoMark}>
          <Ionicons name="leaf-outline" size={34} color={Colors.olive} />
        </View>
        <ThemedText variant="label" color={Colors.muted}>PLAN READY</ThemedText>
        <ThemedText variant="h1" align="center" style={styles.title}>
          {profile?.name ? `${profile.name.split(' ')[0]}, your day is set.` : 'Your day is set.'}
        </ThemedText>
        <ThemedText variant="body" color={Colors.muted} align="center" style={styles.subtitle}>
          NutriSnap will guide calories, macros, water, and meal rhythm from one calm home screen.
        </ThemedText>

        <View style={styles.calorieCard}>
          <ThemedText variant="label" color={Colors.muted}>DAILY CALORIES</ThemedText>
          <CountUp target={calorieGoal} color={Colors.olive} />
          <ThemedText variant="body" color={Colors.muted}>kcal target</ThemedText>
        </View>

        <View style={styles.macroGrid}>
          <MacroReveal title="Protein" value={protein} color={Colors.olive} delay={150} />
          <MacroReveal title="Carbs" value={carbs} color={Colors.orange} delay={250} />
          <MacroReveal title="Fat" value={fat} color={Colors.brownMid} delay={350} />
          <View style={styles.macroCard}>
            <ThemedText variant="label" color={Colors.muted}>Water</ThemedText>
            <ThemedText variant="h1" color={Colors.blue}>2.5L</ThemedText>
          </View>
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <Pressable style={styles.enterButton} onPress={handleEnter}>
          <ThemedText variant="button" color="white">Enter NutriSnap</ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function MacroReveal({ title, value, color, delay }: { title: string; value: number; color: string; delay: number }) {
  return (
    <View style={styles.macroCard}>
      <ThemedText variant="label" color={Colors.muted}>{title}</ThemedText>
      <CountUp target={value} suffix="g" delay={delay} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  logoMark: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 34,
    lineHeight: 41,
  },
  subtitle: {
    maxWidth: 330,
  },
  calorieCard: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  macroGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  macroCard: {
    width: '47.5%',
    minHeight: 112,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    justifyContent: 'center',
  },
  footer: {
    padding: Spacing.xl,
  },
  enterButton: {
    minHeight: 54,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
