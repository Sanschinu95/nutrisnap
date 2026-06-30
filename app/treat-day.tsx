/**
 * Treat-day detail screen — list of AI-generated indulgent suggestions.
 *
 * Tap a suggestion → confirm → logs the item as a meal (source: 'treat_day')
 * AND activates the treat day. Streak continues because a meal still gets
 * logged, just with the indulgent calorie estimate.
 */

import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuthStore } from '@/stores/auth.store';
import { useUserStore } from '@/stores/user.store';
import { useTreatDayStore, logTreatItemAsMeal } from '@/stores/treatDay.store';
import type { TreatSuggestion } from '@/lib/treatDay';
import { trackEvent } from '@/lib/telemetry';
import { Typography } from '@/constants/theme';

const WARM_CREAM = '#FAF3E8';
const PRIMARY_GREEN = '#22C55E';

export default function TreatDayScreen() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const updateStreak = useUserStore((s) => s.updateStreak);
  const available = useTreatDayStore((s) => s.availableTreatDay);
  const activeToday = useTreatDayStore((s) => s.activeTreatDayToday);
  const activate = useTreatDayStore((s) => s.activateToday);

  const treat = activeToday ?? available;
  const suggestions = useMemo<TreatSuggestion[]>(
    () => (Array.isArray(treat?.suggestions) ? treat!.suggestions : []),
    [treat],
  );

  const [confirming, setConfirming] = useState<TreatSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const handleActivateOnly = async () => {
    if (!userId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    trackEvent('treat_day_activated', { source: 'detail_screen' });
    await activate(userId);
  };

  const confirmAndLog = async () => {
    if (!confirming || !userId) return;
    setBusy(true);
    try {
      // Log the item as a meal first so the streak update sees today as logged,
      // then mark the treat day used. Order matters for analytics ordering.
      const result = await logTreatItemAsMeal({
        userId,
        name: confirming.name,
        calories: confirming.estimated_calories,
      });
      if (result.success) {
        trackEvent('treat_day_suggestion_selected', { category: confirming.category });
        await updateStreak();
        if (!activeToday) await activate(userId);
      }
    } finally {
      setBusy(false);
      setConfirming(null);
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#5a4f45" />
        </Pressable>
        <View style={styles.headerCopy}>
          <ThemedText style={styles.headerTitle}>Treat Day</ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            {activeToday ? `Today, ${todayLabel}` : "You've earned this"}
          </ThemedText>
        </View>
        <Pressable style={styles.iconBtn} onPress={() => setShowInfo(true)}>
          <Ionicons name="information-circle-outline" size={22} color="#5a4f45" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(260)} style={styles.hero}>
          <ThemedText style={styles.heroTitle}>Time to enjoy something good</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            {activeToday
              ? 'No tracking guilt today. Just savor it.'
              : '5 days of consistency. Pick your treat.'}
          </ThemedText>
        </Animated.View>

        {suggestions.length === 0 ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color={PRIMARY_GREEN} />
            <ThemedText style={styles.emptyText}>Preparing your suggestions…</ThemedText>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {suggestions.map((s, i) => (
              <Animated.View key={s.name + i} entering={FadeInDown.delay(120 + i * 60).springify()}>
                <Pressable
                  style={styles.suggestionCard}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setConfirming(s);
                  }}
                >
                  <View style={styles.suggestionTop}>
                    <ThemedText style={styles.suggestionEmoji}>{s.emoji}</ThemedText>
                    <View style={{ flex: 1, gap: 4 }}>
                      <ThemedText style={styles.suggestionName}>{s.name}</ThemedText>
                      <View style={styles.categoryPill}>
                        <ThemedText style={styles.categoryText}>{s.category}</ThemedText>
                      </View>
                    </View>
                  </View>
                  <ThemedText style={styles.suggestionDesc}>{s.description}</ThemedText>
                  <View style={styles.suggestionFooter}>
                    <ThemedText style={styles.suggestionCalories}>
                      ~{s.estimated_calories} cal
                      <ThemedText style={styles.suggestionApprox}> approx</ThemedText>
                    </ThemedText>
                  </View>
                  {s.pairing_tip && (
                    <ThemedText style={styles.suggestionPairing}>“{s.pairing_tip}”</ThemedText>
                  )}
                </Pressable>
              </Animated.View>
            ))}
          </View>
        )}

        <View style={styles.bottomActions}>
          {!activeToday && available && (
            <Pressable style={styles.primaryButton} onPress={handleActivateOnly}>
              <ThemedText style={styles.primaryButtonText}>Start treat day</ThemedText>
            </Pressable>
          )}
          {activeToday && (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.push({
                  pathname: '/confirm',
                  params: {
                    data: JSON.stringify({
                      meal_name: '',
                      food_items: [
                        {
                          name: '',
                          quantity: '1 serving',
                          calories: 0,
                          protein_g: 0,
                          carbs_g: 0,
                          fat_g: 0,
                          fiber_g: 0,
                          confidence: 'low',
                        },
                      ],
                      total_calories: 0,
                      total_protein_g: 0,
                      total_carbs_g: 0,
                      total_fat_g: 0,
                      source: 'manual',
                    }),
                  },
                });
              }}
            >
              <ThemedText style={styles.linkButton}>Log custom treat</ThemedText>
            </Pressable>
          )}
          <Pressable onPress={() => setShowInfo(true)}>
            <ThemedText style={styles.linkSecondary}>How treat days work</ThemedText>
          </Pressable>
        </View>
      </ScrollView>

      {confirming && (
        <Modal transparent animationType="fade" onRequestClose={() => setConfirming(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <ThemedText style={styles.modalTitle}>Going to enjoy this {confirming.name}?</ThemedText>
              <ThemedText style={styles.modalBody}>
                We'll log it as ~{confirming.estimated_calories} cal and mark today as your treat day.
              </ThemedText>
              <View style={styles.modalActions}>
                <Pressable style={styles.outlineButton} onPress={() => setConfirming(null)} disabled={busy}>
                  <ThemedText style={styles.outlineButtonText}>Not yet</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.primaryButton, busy && { opacity: 0.6 }]}
                  onPress={confirmAndLog}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={styles.primaryButtonText}>Yes</ThemedText>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {showInfo && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowInfo(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <ThemedText style={styles.modalTitle}>About Treat Days</ThemedText>
              <ThemedText style={styles.modalBody}>
                Every 5 days of consistent logging, you unlock a Treat Day. It's a planned,
                guilt-free moment to enjoy something indulgent without breaking your habit.
                {'\n\n'}
                Treat days don't reset your streak. Calories still count, but the goal is to enjoy.
                Save them for celebrations, weekends, or whenever feels right.
                {'\n\n'}
                If you don't use a treat day within 14 days, it expires, but the next one is always
                5 days away.
              </ThemedText>
              <Pressable style={styles.primaryButton} onPress={() => setShowInfo(false)}>
                <ThemedText style={styles.primaryButtonText}>Got it</ThemedText>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WARM_CREAM },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, color: '#2F241E', fontFamily: Typography.fonts.bodySemiBold },
  headerSubtitle: { fontSize: 12, color: '#8a7e74', marginTop: 2 },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 20 },
  hero: { gap: 6, paddingTop: 4 },
  heroTitle: {
    fontSize: 32,
    fontFamily: Typography.fonts.serif,
    color: '#2F241E',
    fontWeight: '500',
    lineHeight: 38,
  },
  heroSubtitle: { fontSize: 14, color: '#8a7e74', lineHeight: 20 },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: { color: '#8a7e74', fontSize: 13 },

  suggestionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  suggestionTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  suggestionEmoji: { fontSize: 32 },
  suggestionName: {
    fontSize: 18,
    color: '#2F241E',
    fontFamily: Typography.fonts.serif,
    fontWeight: '500',
  },
  categoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#FEF3E2',
  },
  categoryText: {
    fontSize: 10,
    color: '#92400e',
    textTransform: 'capitalize',
    fontFamily: Typography.fonts.bodyMedium,
  },
  suggestionDesc: { fontSize: 13, color: '#5a4f45', lineHeight: 19 },
  suggestionFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggestionCalories: { fontSize: 13, color: '#2F241E', fontFamily: Typography.fonts.bodyMedium },
  suggestionApprox: { color: '#8a7e74', fontFamily: Typography.fonts.body },
  suggestionPairing: { fontStyle: 'italic', fontSize: 12, color: '#8a7e74' },

  bottomActions: { gap: 12, marginTop: 8, alignItems: 'center' },
  primaryButton: {
    alignSelf: 'stretch',
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
    flex: 1,
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
  linkButton: { color: PRIMARY_GREEN, fontSize: 14, fontFamily: Typography.fonts.bodySemiBold },
  linkSecondary: { color: '#8a7e74', fontSize: 12 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: Typography.fonts.serif,
    fontWeight: '500',
    color: '#2F241E',
  },
  modalBody: { fontSize: 13, color: '#5a4f45', lineHeight: 19 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
