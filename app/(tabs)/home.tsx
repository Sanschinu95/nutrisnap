import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { ThemedText } from '@/components/ui/ThemedText';
import { CalorieRing } from '@/components/ui/CalorieRing';
import { HydrationJar } from '@/components/ui/HydrationJar';
import { NutritionRouteChart, type ChartMode, type RouteDataPoint } from '@/components/ui/NutritionRouteChart';
import { ChartModeSwitcher } from '@/components/ui/ChartModeSwitcher';
import { FeedbackModal } from '@/components/ui/FeedbackModal';
import { SkeletonCard } from '@/components/ui/SkeletonLoader';
import { useTheme } from '@/hooks/useTheme';
import { useWaterSound } from '@/hooks/useWaterSound';
import { useUserStore } from '@/stores/user.store';
import { useAuthStore } from '@/stores/auth.store';
import { useDailyStore } from '@/stores/daily.store';
import { loadAvatar } from '@/lib/profileAvatar';
import { useAuthGate } from '@/hooks/useAuthGate';
import { shouldShowFeedback } from '@/lib/feedback';
import { BorderRadius, Colors, Shadows, Spacing } from '@/constants/theme';
import { formatVolume, getWaterQuickAdds } from '@/lib/units';
import { PinnedInsight } from '@/components/ui/PinnedInsight';
import { StepsSleepRow } from '@/components/ui/StepsSleepRow';
import { SleepMorningPrompt } from '@/components/ui/SleepMorningPrompt';
import { useActivityStore } from '@/stores/activity.store';
import { useTreatDayStore } from '@/stores/treatDay.store';
import { TreatDayBanner } from '@/components/ui/TreatDayBanner';
import { TreatDayCelebration } from '@/components/ui/TreatDayCelebration';
import { StreakPill } from '@/components/ui/StreakPill';
import { MilestoneCelebration } from '@/components/ui/MilestoneCelebration';
import type { FoodEntry } from '@/types/nutrition';
import { trackEvent } from '@/lib/telemetry';

type RingMetric = 'calories' | 'protein' | 'carbs' | 'fat';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

interface DailyInsightInputs {
  entries: FoodEntry[];
  proteinProgress: number;
  hydrationProgress: number;
  steps: number;
  stepGoal: number;
  sleepMinutes: number;
  sleepGoalMinutes: number;
}

function getDailyInsight({
  entries,
  proteinProgress,
  hydrationProgress,
  steps,
  stepGoal,
  sleepMinutes,
  sleepGoalMinutes,
}: DailyInsightInputs): string {
  // Sleep is one of the most actionable signals, so surface it when it stands out.
  if (sleepMinutes > 0 && sleepMinutes < sleepGoalMinutes - 60) {
    const hrs = (sleepMinutes / 60).toFixed(1);
    return `Sleep was a bit short last night (${hrs}h). Try winding down 30 min earlier tonight.`;
  }
  if (sleepMinutes >= sleepGoalMinutes) {
    return `${(sleepMinutes / 60).toFixed(1)}h of sleep last night. You're trending well.`;
  }

  // Steps: nudge if we're close, celebrate if we've passed.
  if (stepGoal > 0 && steps > 0) {
    if (steps >= stepGoal) return `You hit ${steps.toLocaleString()} steps today. Strong day.`;
    const remaining = stepGoal - steps;
    if (remaining <= 2500 && remaining > 500) {
      return `You're ${remaining.toLocaleString()} steps from your daily goal. A short walk after dinner?`;
    }
  }

  if (entries.length === 0) return 'Start with one scan and let the day take shape.';
  if (entries.some((entry) => new Date(entry.logged_at).getHours() < 11) && proteinProgress >= 0.5) {
    return 'Protein looks steadier when breakfast is part of the route.';
  }
  if (hydrationProgress >= 0.6) return 'Hydration improved the rhythm of today.';
  return 'Your next small win is water before the next meal.';
}

function getInitials(name?: string | null): string {
  return name
    ? name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2)
    : '?';
}

const METRIC_CONFIG: Record<RingMetric, { label: string; color: string }> = {
  calories: { label: 'Calories Left', color: Colors.olive },
  protein: { label: 'Protein Left', color: Colors.olive },
  carbs: { label: 'Carbs Left', color: Colors.orange },
  fat: { label: 'Fat Left', color: Colors.brownMid },
};

export default function HomeScreen() {
  const { theme } = useTheme();
  const { profile, calorieGoal, macroGoals, streak, hydrationGoalMl } = useUserStore(
    useShallow((s) => ({
      profile: s.profile, calorieGoal: s.calorieGoal, macroGoals: s.macroGoals,
      streak: s.streak, hydrationGoalMl: s.hydrationGoalMl,
    })),
  );
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { entries, summary, waterMl, addWater, removeEntry, loadToday } = useDailyStore(
    useShallow((s) => ({
      entries: s.entries, summary: s.summary, waterMl: s.waterMl,
      addWater: s.addWater, removeEntry: s.removeEntry, loadToday: s.loadToday,
    })),
  );
  const { requireAuth } = useAuthGate();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  useEffect(() => {
    loadAvatar(userId).then(setAvatarUri);
  }, [userId]);
  const [selectedEntry, setSelectedEntry] = useState<FoodEntry | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>('spline');
  const [activeRingMetric, setActiveRingMetric] = useState<RingMetric>('calories');
  const [showFeedback, setShowFeedback] = useState(false);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const { playWaterSound } = useWaterSound();

  // Transform FoodEntry[] â†’ RouteDataPoint[] for the chart component
  const routeData: RouteDataPoint[] = useMemo(
    () => entries.map((e) => ({
      timestamp: e.occurred_at_local ?? e.logged_at,
      calories: e.total_calories,
      mealId: e.id,
      thumbnailUrl: e.image_url ?? undefined,
      source: e.source,
    })),
    [entries],
  );

  const handleNodePress = useCallback((mealId: string) => {
    const entry = entries.find((e) => e.id === mealId);
    if (entry) setSelectedEntry(entry);
  }, [entries]);

  useEffect(() => {
    loadToday();
    trackEvent('route_viewed', { surface: 'home' });
    // Check if we should show the daily feedback modal
    shouldShowFeedback().then((show) => {
      if (show) setShowFeedback(true);
    });
  }, [loadToday]);

  useEffect(() => {
    if (selectedEntry) {
      trackEvent('route_node_expanded', { meal_id: selectedEntry.id });
      bottomSheetRef.current?.snapToIndex(0);
    }
  }, [selectedEntry]);

  const totalCalories = summary?.total_calories ?? 0;
  const totalProtein = summary?.total_protein ?? 0;
  const totalCarbs = summary?.total_carbs ?? 0;
  const totalFat = summary?.total_fat ?? 0;
  const caloriesLeft = Math.max(0, calorieGoal - totalCalories);
  const calProgress = calorieGoal > 0 ? Math.min(1, totalCalories / calorieGoal) : 0;
  const proteinProgress = macroGoals.protein > 0 ? Math.min(1, totalProtein / macroGoals.protein) : 0;
  const carbsProgress = macroGoals.carbs > 0 ? Math.min(1, totalCarbs / macroGoals.carbs) : 0;
  const fatProgress = macroGoals.fat > 0 ? Math.min(1, totalFat / macroGoals.fat) : 0;
  const hydrationProgress = Math.min(1, waterMl / hydrationGoalMl);
  const unitPref = profile?.unit_preference ?? 'metric';
  const waterDisplay = formatVolume(waterMl, unitPref);
  const hydrationGoalDisplay = formatVolume(hydrationGoalMl, unitPref);
  const quickAddMl = getWaterQuickAdds(unitPref)[0].ml;
  const userName = profile?.name?.split(' ')[0] ?? 'there';
  const treatActiveToday = useTreatDayStore((s) => s.activeTreatDayToday);
  const treatAvailable = useTreatDayStore((s) => s.availableTreatDay);
  const todaySteps = useActivityStore((s) => s.todaySteps);
  const stepGoal = useActivityStore((s) => s.stepGoal);
  const lastNightSleep = useActivityStore((s) => s.lastNightSleep);
  const sleepGoalHours = useActivityStore((s) => s.sleepGoalHours);
  const sleepMinutes = lastNightSleep?.durationMinutes ?? 0;
  const sleepGoalMinutes = Math.round(sleepGoalHours * 60);
  const insight = useMemo(
    () =>
      getDailyInsight({
        entries,
        proteinProgress,
        hydrationProgress,
        steps: todaySteps,
        stepGoal,
        sleepMinutes,
        sleepGoalMinutes,
      }),
    [entries, hydrationProgress, proteinProgress, todaySteps, stepGoal, sleepMinutes, sleepGoalMinutes],
  );

  // All metrics report the amount *remaining* to the goal, so the ring center
  // reads consistently ("X Left") whether calories or a macro is selected.
  const proteinLeft = Math.max(0, Math.round(macroGoals.protein - totalProtein));
  const carbsLeft = Math.max(0, Math.round(macroGoals.carbs - totalCarbs));
  const fatLeft = Math.max(0, Math.round(macroGoals.fat - totalFat));

  // Build ring + row data based on which metric is active
  const metricData: Record<RingMetric, { value: string; progress: number }> = {
    calories: { value: caloriesLeft.toLocaleString(), progress: calProgress },
    protein: { value: `${proteinLeft}g`, progress: proteinProgress },
    carbs: { value: `${carbsLeft}g`, progress: carbsProgress },
    fat: { value: `${fatLeft}g`, progress: fatProgress },
  };

  const activeConfig = METRIC_CONFIG[activeRingMetric];
  const activeData = metricData[activeRingMetric];
  const rowMetrics = (['calories', 'protein', 'carbs', 'fat'] as RingMetric[]).filter(
    (m) => m !== activeRingMetric,
  );

  const handleSwapMetric = useCallback((metric: RingMetric) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveRingMetric(metric);
  }, []);

  const handleAddWater = useCallback(() => {
    requireAuth(async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      addWater(quickAddMl);
      playWaterSound();
    });
  }, [addWater, playWaterSound, requireAuth, quickAddMl]);

  const handleDelete = useCallback(() => {
    if (!selectedEntry) return;
    requireAuth(async () => {
      Alert.alert('Delete meal', 'Remove this meal from today?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeEntry(selectedEntry.id);
            setSelectedEntry(null);
            bottomSheetRef.current?.close();
          },
        },
      ]);
    });
  }, [removeEntry, selectedEntry, requireAuth]);

  const handleEdit = useCallback(() => {
    if (!selectedEntry) return;
    const editPayload = {
      meal_name: selectedEntry.meal_name,
      food_items: selectedEntry.food_items,
      total_calories: selectedEntry.total_calories,
      total_protein_g: selectedEntry.protein_g ?? 0,
      total_carbs_g: selectedEntry.carbs_g ?? 0,
      total_fat_g: selectedEntry.fat_g ?? 0,
      image_url: selectedEntry.image_url ?? undefined,
      existing_entry_id: selectedEntry.id,
      source: selectedEntry.source ?? 'scan',
    };
    bottomSheetRef.current?.close();
    router.push({ pathname: '/confirm', params: { data: JSON.stringify(editPayload) } });
  }, [selectedEntry]);

  const handleRescan = useCallback(() => {
    if (!selectedEntry) return;
    requireAuth(async () => {
      Alert.alert('Rescan meal', 'Replace this meal with a new scan?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rescan',
          onPress: async () => {
            await removeEntry(selectedEntry.id);
            setSelectedEntry(null);
            bottomSheetRef.current?.close();
            router.push('/(tabs)/camera');
          },
        },
      ]);
    });
  }, [removeEntry, selectedEntry, requireAuth]);

  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <SkeletonCard lines={3} style={styles.skeletonCard} />
        <SkeletonCard lines={4} style={styles.skeletonCard} />
      </SafeAreaView>
    );
  }

  // Treat day active today shifts the entire surface into a warmer cream.
  const surfaceBg = treatActiveToday ? '#FAF3E8' : theme.background;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surfaceBg }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.hydrationTint,
          { backgroundColor: Colors.blue, opacity: hydrationProgress * 0.1 },
        ]}
      />
      <TreatDayCelebration />
      <MilestoneCelebration />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeIn.duration(450)} style={styles.header}>
          <View style={styles.headerCopy}>
            <ThemedText variant="h1" style={styles.greeting}>
              {getGreeting()}, {userName}
            </ThemedText>
            <ThemedText variant="body" color={theme.textMuted}>
              Your nutrition journey continues today.
            </ThemedText>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.friendsButton} onPress={() => router.push('/friends' as any)} accessibilityLabel="Friends">
              <Ionicons name="people-outline" size={22} color={Colors.brown} />
            </Pressable>
            <Pressable style={styles.avatarButton} onPress={() => router.push('/(tabs)/profile')}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <ThemedText variant="bodySemiBold" color="white">
                  {getInitials(profile.name)}
                </ThemedText>
              )}
            </Pressable>
          </View>
        </Animated.View>

        {(treatAvailable || treatActiveToday) && (
          <View style={styles.treatSlot}>
            <TreatDayBanner />
          </View>
        )}

        <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.weekRow}>
          {Array.from({ length: 7 }).map((_, index) => {
            const active = index < Math.min(7, Math.max(streak, entries.length > 0 ? 1 : 0));
            return (
              <View key={index} style={[styles.flameDot, active && styles.flameDotActive]}>
                <Ionicons
                  name={active ? 'flame' : 'ellipse-outline'}
                  size={18}
                  color={active ? Colors.orange : Colors.border}
                />
              </View>
            );
          })}
          <View style={{ flex: 1 }} />
          <StreakPill />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).springify()} style={styles.heroGrid}>
          <View style={[styles.ringsPanel, Shadows.card]}>
            <CalorieRing
              size={210}
              progress={activeData.progress}
              centerLabel={activeConfig.label}
              centerValue={activeData.value}
              ringColor={treatActiveToday ? '#D97706' : activeConfig.color}
              strokeWidth={16}
            />
            <View style={styles.macroLegend}>
              {rowMetrics.map((metric) => {
                const config = METRIC_CONFIG[metric];
                const data = metricData[metric];
                return (
                  <MacroRow
                    key={metric}
                    label={config.label}
                    value={data.value}
                    progress={data.progress}
                    color={config.color}
                    onPress={() => handleSwapMetric(metric)}
                  />
                );
              })}
            </View>
          </View>

          <HydrationJar
            totalMl={waterMl}
            targetMl={hydrationGoalMl}
            quickAddMl={quickAddMl}
            onPress={handleAddWater}
            label={`${waterDisplay} / ${hydrationGoalDisplay}`}
            sublabel="Tap to log water"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).springify()} style={styles.stepsSleepSlot}>
          <SleepMorningPrompt
            onEdit={() => useActivityStore.getState().requestOpenSleepSheet()}
          />
          <StepsSleepRow />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.routeSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <ThemedText variant="h2">Nutrition Route</ThemedText>
              <ThemedText variant="label" color={theme.textMuted}>
                Calories shape the wave. Protein-rich meals lift it.
              </ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share nutrition route to your story"
              style={styles.shareButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: '/share-story' as any,
                  params: {
                    calories: String(totalCalories),
                    streak: String(streak),
                    protein: String(Math.round(totalProtein)),
                    carbs: String(Math.round(totalCarbs)),
                    fat: String(Math.round(totalFat)),
                    chartData: JSON.stringify(entries.map((entry) => ({
                      calories: entry.total_calories,
                      timestamp: entry.occurred_at_local ?? entry.logged_at,
                      thumbnailUrl: entry.image_url ?? undefined,
                    }))),
                  },
                });
              }}
            >
              <Ionicons name="share-outline" size={18} color={Colors.white} />
              <ThemedText variant="bodySemiBold" color={Colors.white}>Share</ThemedText>
            </Pressable>
          </View>
          <View style={styles.routeCard}>
            <ChartModeSwitcher activeMode={chartMode} onModeChange={setChartMode} />
            <View style={{ marginTop: 8 }}>
              <NutritionRouteChart
                data={routeData}
                mode={chartMode}
                orientation="horizontal"
                calorieGoal={calorieGoal}
                onNodePress={handleNodePress}
              />
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).springify()} style={styles.pinnedInsightSlot}>
          <PinnedInsight />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260).springify()} style={styles.insightCard}>
          <View style={styles.insightIcon}>
            <Ionicons name="bulb-outline" size={22} color={Colors.orange} />
          </View>
          <View style={styles.insightCopy}>
            <ThemedText variant="bodySemiBold">Daily Insight</ThemedText>
            <ThemedText variant="body" color={theme.textMuted}>
              {insight}
            </ThemedText>
          </View>
        </Animated.View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {selectedEntry && (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['45%']}
        enablePanDownToClose
        onClose={() => setSelectedEntry(null)}
        backgroundStyle={{ backgroundColor: Colors.white }}
        handleIndicatorStyle={{ backgroundColor: Colors.border }}
      >
        <BottomSheetView style={styles.sheetContent}>
          {selectedEntry && (
            <>
              <ThemedText variant="h2">{selectedEntry.meal_name}</ThemedText>
              <ThemedText variant="label" color={theme.textMuted}>
                {new Date(selectedEntry.logged_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </ThemedText>
              <View style={styles.sheetCalories}>
                <ThemedText variant="h1" color={Colors.olive}>{selectedEntry.total_calories}</ThemedText>
                <ThemedText variant="body" color={theme.textMuted}>calories</ThemedText>
              </View>
              <View style={styles.sheetMacroRow}>
                <MacroChip label="Protein" value={`${Math.round(selectedEntry.protein_g ?? 0)}g`} color={Colors.olive} />
                <MacroChip label="Carbs" value={`${Math.round(selectedEntry.carbs_g ?? 0)}g`} color={Colors.orange} />
                <MacroChip label="Fat" value={`${Math.round(selectedEntry.fat_g ?? 0)}g`} color={Colors.brownMid} />
              </View>
              <View style={styles.sheetActions}>
                <Pressable style={styles.editAction} onPress={handleEdit}>
                  <Ionicons name="create-outline" size={18} color={Colors.olive} />
                  <ThemedText variant="button" color={Colors.olive}>Edit</ThemedText>
                </Pressable>
                {selectedEntry?.source !== 'manual' && (
                  <Pressable style={styles.rescanAction} onPress={handleRescan}>
                    <Ionicons name="camera-outline" size={18} color={Colors.orange} />
                    <ThemedText variant="button" color={Colors.orange}>Rescan</ThemedText>
                  </Pressable>
                )}
                <Pressable style={styles.deleteAction} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={18} color={Colors.error} />
                  <ThemedText variant="button" color={Colors.error}>Delete</ThemedText>
                </Pressable>
              </View>
            </>
          )}
        </BottomSheetView>
      </BottomSheet>
      )}

      {/* Daily feedback modal */}
      <FeedbackModal
        visible={showFeedback}
        onClose={() => setShowFeedback(false)}
      />
    </SafeAreaView>
  );
}

/** Tappable macro row with progress bar â€” used below the ring */
function MacroRow({
  label,
  value,
  progress,
  color,
  onPress,
}: {
  label: string;
  value: string;
  progress: number;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.macroRow} onPress={onPress}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <View style={styles.macroRowText}>
        <ThemedText variant="labelSmall" color={Colors.muted}>{label}</ThemedText>
        <ThemedText variant="bodySemiBold">{value}</ThemedText>
      </View>
      <View style={styles.macroBarTrack}>
        <View style={[styles.macroBarFill, { width: `${Math.min(100, progress * 100)}%`, backgroundColor: color }]} />
      </View>
    </Pressable>
  );
}

function MacroChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.macroChip}>
      <View style={[styles.chipDot, { backgroundColor: color }]} />
      <View>
        <ThemedText variant="labelSmall" color={Colors.muted}>{label}</ThemedText>
        <ThemedText variant="bodySemiBold">{value}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hydrationTint: {
    ...StyleSheet.absoluteFillObject,
  },
  scrollContent: {
    paddingBottom: Spacing['5xl'],
  },
  skeletonCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.base,
    gap: Spacing.lg,
  },
  headerCopy: { flex: 1 },
  greeting: {
    fontSize: 30,
    lineHeight: 36,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  friendsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  avatarButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.olive,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  flameDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  flameDotActive: {
    backgroundColor: Colors.orangePale,
    borderColor: Colors.orangeLight,
  },
  heroGrid: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    alignItems: 'stretch',
  },
  ringsPanel: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    alignItems: 'center',
  },
  macroLegend: {
    width: '100%',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  macroDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  macroRowText: {
    flex: 1,
  },
  macroBarTrack: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  macroBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  macroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  chipDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  routeSection: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
  },
  stepsSleepSlot: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  treatSlot: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  pinnedInsightSlot: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.base,
    marginBottom: Spacing.md,
  },
  sectionHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    minHeight: 44,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.orange,
    ...Shadows.card,
    shadowColor: Colors.orange,
    shadowOpacity: 0.25,
    elevation: 4,
    flexShrink: 0,
  },
  routeCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },

  insightCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.white,
    flexDirection: 'row',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  insightIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.orangePale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightCopy: { flex: 1, gap: 2 },
  bottomPadding: { height: 120 },
  sheetContent: { padding: Spacing.xl, gap: Spacing.base },
  sheetCalories: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  sheetMacroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  editAction: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.oliveLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  deleteAction: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  rescanAction: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.orangePale,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});
