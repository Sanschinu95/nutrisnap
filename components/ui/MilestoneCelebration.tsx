/**
 * Full-screen milestone celebration shown when streak hits a milestone day.
 * Calm-cream background, hexagon-ish gradient badge, italic reward quote.
 * Two CTAs: Share (opens share-story with milestone params) or Continue.
 * Auto-dismisses after 8s of no interaction.
 */

import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Defs, LinearGradient, Polygon, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { useStreakStore } from '@/stores/streak.store';
import { trackEvent } from '@/lib/telemetry';
import { Typography } from '@/constants/theme';

const PRIMARY_GREEN = '#22C55E';
const CREAM = '#FAF6EE';
const AUTO_DISMISS_MS = 8000;

export function MilestoneCelebration() {
  const milestone = useStreakStore((s) => s.justReachedMilestone);
  const clear = useStreakStore((s) => s.clearJustReached);

  // Bouncy entrance for the badge.
  const badgeScale = useSharedValue(0);
  // Subtle pulsing glow.
  const glow = useSharedValue(0.7);

  useEffect(() => {
    if (!milestone) return;
    badgeScale.value = 0;
    badgeScale.value = withSpring(1, { damping: 10, stiffness: 90 });
    glow.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    trackEvent('streak_milestone_reached', { days: milestone.days });

    const t = setTimeout(() => clear(), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [milestone, badgeScale, glow, clear]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.95 + glow.value * 0.15 }],
    opacity: 0.18 + glow.value * 0.22,
  }));

  if (!milestone) return null;

  const onShare = () => {
    Haptics.selectionAsync();
    trackEvent('streak_milestone_shared', { days: milestone.days });
    clear();
    router.push({
      pathname: '/milestone-share' as any,
      params: { milestoneDays: String(milestone.days) },
    });
  };

  const onContinue = () => {
    Haptics.selectionAsync();
    trackEvent('streak_milestone_dismissed', { days: milestone.days });
    clear();
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onContinue}>
      <View style={styles.overlay}>
        <View style={styles.badgeWrap}>
          <Animated.View
            style={[
              styles.glow,
              { backgroundColor: milestone.badgeColors[0] },
              glowStyle,
            ]}
          />
          <Animated.View style={badgeStyle}>
            <HexBadge
              from={milestone.badgeColors[0]}
              to={milestone.badgeColors[1]}
              emoji={milestone.emoji}
              days={milestone.days}
            />
          </Animated.View>
        </View>

        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.copy}>
          <ThemedText style={styles.name}>{milestone.name}</ThemedText>
          <ThemedText style={styles.description}>{milestone.description}</ThemedText>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(360).duration(400)} style={styles.rewardWrap}>
          <ThemedText style={styles.reward}>“{milestone.rewardText}”</ThemedText>
        </Animated.View>

        <View style={styles.actions}>
          <Pressable style={styles.primaryButton} onPress={onShare}>
            <ThemedText style={styles.primaryButtonText}>Share</ThemedText>
          </Pressable>
          <Pressable style={styles.outlineButton} onPress={onContinue}>
            <ThemedText style={styles.outlineButtonText}>Continue</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Hexagonal badge SVG ────────────────────────────────────── */

function HexBadge({
  from,
  to,
  emoji,
  days,
}: {
  from: string;
  to: string;
  emoji: string;
  days: number;
}) {
  const size = 160;
  // Pointy-top hexagon vertices, centered in viewBox.
  const r = size / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  const polygon = pts.map(([x, y]) => `${x},${y}`).join(' ');

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="hex" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} stopOpacity="1" />
            <Stop offset="1" stopColor={to} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Polygon points={polygon} fill="url(#hex)" stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
      </Svg>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <ThemedText style={styles.badgeEmoji}>{emoji}</ThemedText>
        <ThemedText style={styles.badgeDays}>Day {days}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: CREAM,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 22,
  },
  badgeWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  badgeEmoji: { fontSize: 56 },
  badgeDays: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: Typography.fonts.bodySemiBold,
    letterSpacing: 1,
  },
  copy: { alignItems: 'center', gap: 6 },
  name: {
    fontSize: 28,
    fontFamily: Typography.fonts.serif,
    fontWeight: '500',
    color: '#2F241E',
    textAlign: 'center',
  },
  description: { fontSize: 14, color: '#8a7e74', textAlign: 'center' },
  rewardWrap: { paddingHorizontal: 8 },
  reward: {
    fontSize: 16,
    fontStyle: 'italic',
    fontFamily: Typography.fonts.serif,
    color: '#2F241E',
    textAlign: 'center',
    lineHeight: 24,
  },
  actions: { alignSelf: 'stretch', gap: 10, marginTop: 6 },
  primaryButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: PRIMARY_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: Typography.fonts.bodySemiBold,
  },
  outlineButton: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4cabe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButtonText: {
    color: '#5a4f45',
    fontSize: 14,
    fontFamily: Typography.fonts.bodySemiBold,
  },
});
