/**
 * Notification permission ask — shown ONCE, right after onboarding, before
 * the user first lands on Home. Never at cold start: by now they've seen the
 * app's value, so the OS prompt has context (and a much better accept rate).
 */

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuthStore } from '@/stores/auth.store';
import { useUserStore } from '@/stores/user.store';
import { useNotificationPrefsStore } from '@/stores/notificationPrefs.store';
import { requestNotificationPermission } from '@/lib/notifications';
import { rescheduleAllPersonalityNotifications } from '@/lib/notificationScheduler';
import { trackEvent } from '@/lib/telemetry';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

export default function NotificationIntroScreen() {
  const profile = useUserStore((s) => s.profile);
  const [isRequesting, setIsRequesting] = useState(false);
  const firstName = profile?.name?.trim().split(/\s+/)[0] || 'friend';

  const goHome = useCallback(() => {
    router.replace('/(tabs)/home');
  }, []);

  const handleEnable = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRequesting(true);
    try {
      const granted = await requestNotificationPermission();
      trackEvent(
        granted ? 'notification_permission_granted' : 'notification_permission_denied',
        { source: 'intro' },
      );
      if (granted) {
        const userId =
          useAuthStore.getState().user?.id ?? profile?.id ?? null;
        await useNotificationPrefsStore.getState().loadPrefs(userId);
        await rescheduleAllPersonalityNotifications(
          useNotificationPrefsStore.getState().prefs,
        );
      }
    } catch (e) {
      console.warn('Notification enable failed:', e);
    } finally {
      setIsRequesting(false);
      // Denied? No nagging — Home either way. Settings has a re-enable path.
      goHome();
    }
  }, [profile?.id, goHome]);

  const handleLater = useCallback(() => {
    Haptics.selectionAsync();
    trackEvent('notification_permission_denied', { source: 'intro_maybe_later' });
    goHome();
  }, [goHome]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.duration(300)} style={styles.iconWrap}>
          <Ionicons name="notifications-outline" size={30} color={Colors.olive} />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(300).delay(80)}>
          <ThemedText align="center" style={styles.headline}>
            Little reminders, big impact
          </ThemedText>
          <ThemedText variant="body" color={Colors.muted} align="center" style={styles.subtitle}>
            I&apos;ll check in at meal times, water breaks, and bedtime. Nothing
            intrusive — just warm nudges.
          </ThemedText>
        </Animated.View>

        <View style={styles.bubbles}>
          <ExampleBubble
            delay={200}
            icon="cafe-outline"
            text={`Good morning, ${firstName}. Chai + breakfast?`}
          />
          <ExampleBubble
            delay={320}
            icon="water-outline"
            text="Water break? Even 2 sips counts."
          />
          <ExampleBubble
            delay={440}
            icon="heart-outline"
            text="Missed you yesterday. Everything okay?"
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryButton, isRequesting && styles.primaryButtonBusy]}
          onPress={handleEnable}
          disabled={isRequesting}
        >
          <ThemedText variant="button" color="white">
            {isRequesting ? 'One moment…' : 'Enable notifications'}
          </ThemedText>
        </Pressable>
        <Pressable style={styles.laterButton} onPress={handleLater} disabled={isRequesting}>
          <ThemedText variant="bodyMedium" color={Colors.muted}>Maybe later</ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ExampleBubble({
  delay,
  icon,
  text,
}: {
  delay: number;
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(300).delay(delay)} style={styles.bubble}>
      <View style={styles.bubbleIcon}>
        <Ionicons name={icon} size={16} color={Colors.olive} />
      </View>
      <ThemedText variant="bodyMedium" style={styles.bubbleText}>
        {text}
      </ThemedText>
    </Animated.View>
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
    gap: Spacing.xl,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.oliveLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  headline: {
    fontFamily: Typography.fonts.serifSemi,
    fontSize: Typography.sizes['2xl'],
    lineHeight: Typography.sizes['2xl'] * Typography.lineHeights.tight,
    marginBottom: Spacing.md,
  },
  subtitle: {
    maxWidth: 300,
    alignSelf: 'center',
  },
  bubbles: {
    gap: Spacing.md,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: BorderRadius.sm / 2,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    marginRight: Spacing['2xl'],
  },
  bubbleIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.oliveLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleText: {
    flex: 1,
  },
  footer: {
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.olive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonBusy: {
    opacity: 0.7,
  },
  laterButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
});
