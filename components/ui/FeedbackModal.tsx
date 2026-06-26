/**
 * FeedbackModal — daily rating prompt.
 *
 * Displays a card with 5 tappable stars, supportive copy,
 * and submit/dismiss actions. Uses NutriSnap's brand tokens.
 */

import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { Button } from '@/components/ui/Button';
import { saveFeedback, dismissFeedback } from '@/lib/feedback';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
}

const STAR_COUNT = 5;
const STAR_LABELS = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

export function FeedbackModal({ visible, onClose }: FeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSelectStar = useCallback((star: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRating(star);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (rating === 0) return;
    setIsSubmitting(true);
    try {
      await saveFeedback(rating);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
      // Auto-close after showing the thank-you state
      setTimeout(() => {
        onClose();
        // Reset for next mount (shouldn't happen, but safety)
        setRating(0);
        setSubmitted(false);
      }, 1600);
    } catch {
      // saveFeedback already handles errors internally
    } finally {
      setIsSubmitting(false);
    }
  }, [rating, onClose]);

  const handleDismiss = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await dismissFeedback();
    onClose();
    setRating(0);
  }, [onClose]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <Animated.View
          entering={FadeInDown.duration(350).springify().damping(20)}
          style={styles.card}
        >
          {/* Close button */}
          <Pressable style={styles.closeButton} onPress={handleDismiss}>
            <Ionicons name="close" size={20} color={Colors.muted} />
          </Pressable>

          {submitted ? (
            /* ── Thank-you state ── */
            <Animated.View entering={FadeIn.duration(300)} style={styles.thankYouWrap}>
              <View style={styles.thankYouIcon}>
                <Ionicons name="heart" size={36} color={Colors.white} />
              </View>
              <ThemedText variant="h2" align="center" style={styles.title}>
                Thank you! 💚
              </ThemedText>
              <ThemedText variant="body" color={Colors.muted} align="center">
                Your feedback helps us improve NutriSnap.
              </ThemedText>
            </Animated.View>
          ) : (
            /* ── Rating state ── */
            <>
              {/* Icon */}
              <Animated.View entering={FadeIn.duration(400)} style={styles.iconWrap}>
                <View style={styles.iconCircle}>
                  <Ionicons name="chatbubble-ellipses" size={32} color={Colors.white} />
                </View>
              </Animated.View>

              {/* Copy */}
              <ThemedText variant="h2" align="center" style={styles.title}>
                How's NutriSnap treating you?
              </ThemedText>
              <ThemedText variant="body" color={Colors.muted} align="center" style={styles.subtitle}>
                Your honest feedback shapes the next update.
              </ThemedText>

              {/* Star row */}
              <View style={styles.starRow}>
                {Array.from({ length: STAR_COUNT }).map((_, i) => {
                  const starValue = i + 1;
                  return (
                    <AnimatedStar
                      key={starValue}
                      filled={starValue <= rating}
                      onPress={() => handleSelectStar(starValue)}
                    />
                  );
                })}
              </View>

              {/* Star label */}
              {rating > 0 && (
                <Animated.View entering={FadeIn.duration(200)}>
                  <ThemedText variant="bodySemiBold" color={Colors.olive} align="center">
                    {STAR_LABELS[rating - 1]}
                  </ThemedText>
                </Animated.View>
              )}

              {/* Submit button */}
              <Button
                title={isSubmitting ? 'Sending...' : 'Submit'}
                onPress={handleSubmit}
                disabled={rating === 0 || isSubmitting}
                style={StyleSheet.flatten([styles.submitButton, rating === 0 && styles.submitDisabled])}
              />

              {/* Dismiss */}
              <Button
                title="Maybe later"
                variant="ghost"
                onPress={handleDismiss}
                textStyle={{ color: Colors.muted }}
              />
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ── Animated Star Component ── */

function AnimatedStar({ filled, onPress }: { filled: boolean; onPress: () => void }) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSequence(
      withTiming(0.7, { duration: 80 }),
      withSpring(1.15, { damping: 8, stiffness: 300 }),
      withSpring(1, { damping: 10, stiffness: 200 }),
    );
    onPress();
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.starWrap, animStyle]}>
        <Ionicons
          name={filled ? 'star' : 'star-outline'}
          size={38}
          color={filled ? Colors.yellow : Colors.border}
        />
      </Animated.View>
    </Pressable>
  );
}

/* ── Styles ── */

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(47, 36, 30, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    paddingTop: Spacing['3xl'],
    alignItems: 'center',
    gap: Spacing.md,
    shadowColor: '#2F241E',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    marginBottom: Spacing.xs,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: Colors.olive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thankYouWrap: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
  },
  thankYouIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.olive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
  },
  subtitle: {
    maxWidth: 280,
    marginBottom: Spacing.sm,
  },
  starRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  starWrap: {
    padding: Spacing.xs,
  },
  submitButton: {
    width: '100%',
    marginTop: Spacing.sm,
  },
  submitDisabled: {
    opacity: 0.5,
  },
});
