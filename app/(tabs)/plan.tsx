import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { ThemedText } from '@/components/ui/ThemedText';
import { SkeletonCard } from '@/components/ui/SkeletonLoader';
import { useTheme } from '@/hooks/useTheme';
import { useDailyStore } from '@/stores/daily.store';
import { useUserStore } from '@/stores/user.store';
import { useAuthStore } from '@/stores/auth.store';
import { loadMonthlyData, loadWeeklyData, type MonthlyData, type WeeklyData } from '@/lib/progressData';
import { Spacing, Typography } from '@/constants/theme';
import type { FoodEntry } from '@/types/nutrition';
import { formatVolume, type UnitPreference } from '@/lib/units';

// ────────────────────────────────────────────────────────────────────────────
// Progress-tab design tokens (override the global palette per design spec)
// ────────────────────────────────────────────────────────────────────────────

const C = {
  cream: '#F7F4EE',
  card: '#FFFFFF',
  primary: '#2F241E',
  primarySoft: '#5a4f45',
  muted: '#8a7e74',
  mutedFaint: '#c4b9ab',
  daily: '#E8703A',
  weekly: '#22C55E',
  monthly: '#E0397A',
  hydration: '#5FA8FF',
  hydrationLight: '#d0e4f7',
  emptyFill: '#efe9e0',
  emptyFillSoft: '#f0ebe3',
  pillBg: '#f7f2ea',
  proteinGreen: '#22C55E',
  carbsOrange: '#E8703A',
  fatPink: '#E0397A',
  heatNone: '#f0ebe3',
  heat1: '#bbf7d0',
  heat2: '#4ade80',
  heat3: '#22C55E',
  heat4: '#15803d',
};

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.04,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

const SERIF = Typography.fonts.serif;
const SERIF_BOLD = Typography.fonts.serifBold;
const SANS = Typography.fonts.body;
const SANS_MED = Typography.fonts.bodyMedium;
const SANS_SEMI = Typography.fonts.bodySemiBold;

type ProgressTab = 'Daily' | 'Weekly' | 'Monthly';
const TABS: ProgressTab[] = ['Daily', 'Weekly', 'Monthly'];
const TAB_COLOR: Record<ProgressTab, string> = {
  Daily: C.daily,
  Weekly: C.weekly,
  Monthly: C.monthly,
};

// ────────────────────────────────────────────────────────────────────────────
// Screen
// ────────────────────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const { theme } = useTheme();
  const { profile, calorieGoal, macroGoals, hydrationGoalMl, streak, isLoading } = useUserStore();
  const { entries, summary, waterMl, loadToday, removeEntry } = useDailyStore();
  const [activeTab, setActiveTab] = useState<ProgressTab>('Daily');
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<FoodEntry | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  useEffect(() => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    if (activeTab === 'Weekly' && !weeklyData) {
      loadWeeklyData(user.id).then(setWeeklyData).catch(() => {});
    }
    if (activeTab === 'Monthly' && !monthlyData) {
      loadMonthlyData(user.id).then(setMonthlyData).catch(() => {});
    }
  }, [activeTab, weeklyData, monthlyData]);

  // When today's meals change (add/delete), invalidate weekly + monthly caches
  // so the rollups stay in sync.
  useEffect(() => {
    setWeeklyData(null);
    setMonthlyData(null);
  }, [entries.length]);

  const openEntry = useCallback((entry: FoodEntry) => {
    setSelectedEntry(entry);
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

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

  const handleDelete = useCallback(() => {
    if (!selectedEntry) return;
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
  }, [removeEntry, selectedEntry]);

  const handleRescan = useCallback(() => {
    if (!selectedEntry) return;
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
  }, [removeEntry, selectedEntry]);

  if (isLoading || !profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: C.cream }]}>
        <SkeletonCard lines={3} style={styles.skeleton} />
        <SkeletonCard lines={4} style={styles.skeleton} />
      </SafeAreaView>
    );
  }

  const firstName = profile.name?.split(' ')[0] ?? 'there';
  const totalCalories = summary?.total_calories ?? 0;
  const totalProtein = summary?.total_protein ?? 0;
  const totalCarbs = summary?.total_carbs ?? 0;
  const totalFat = summary?.total_fat ?? 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.cream }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.greetingSerif}>Good progress, {firstName}</Text>
            <ThemedText variant="body" color={C.muted}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </ThemedText>
          </View>
          <Pressable style={styles.avatarButton} onPress={() => router.push('/(tabs)/profile')}>
            <ThemedText variant="bodySemiBold" color="white">
              {profile.name?.charAt(0).toUpperCase() ?? '?'}
            </ThemedText>
          </Pressable>
        </View>

        {/* Segmented control */}
        <View style={styles.segmented}>
          {TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <Pressable
                key={tab}
                style={[styles.segment, active && { backgroundColor: TAB_COLOR[tab] }]}
                onPress={() => setActiveTab(tab)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? '#FFFFFF' : C.muted },
                  ]}
                >
                  {tab}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Crossfade between views */}
        <Animated.View key={activeTab} entering={FadeIn.duration(250)}>
          {activeTab === 'Daily' && (
            <DailyView
              entries={entries}
              totalProtein={totalProtein}
              totalCarbs={totalCarbs}
              totalFat={totalFat}
              proteinGoal={macroGoals.protein}
              carbsGoal={macroGoals.carbs}
              fatGoal={macroGoals.fat}
              onMealPress={openEntry}
            />
          )}
          {activeTab === 'Weekly' && (
            <WeeklyView
              data={weeklyData}
              calorieGoal={calorieGoal}
              hydrationGoalMl={hydrationGoalMl}
              proteinGoal={macroGoals.protein}
              unitPref={profile?.unit_preference ?? 'metric'}
            />
          )}
          {activeTab === 'Monthly' && (
            <MonthlyView
              data={monthlyData}
              streak={streak}
              totalCaloriesToday={totalCalories}
              unitPref={profile?.unit_preference ?? 'metric'}
            />
          )}
        </Animated.View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['45%']}
        enablePanDownToClose
        onClose={() => setSelectedEntry(null)}
        backgroundStyle={{ backgroundColor: C.card }}
        handleIndicatorStyle={{ backgroundColor: C.emptyFill }}
      >
        <BottomSheetView style={styles.sheetContent}>
          {selectedEntry && (
            <>
              <ThemedText variant="h2">{selectedEntry.meal_name}</ThemedText>
              <ThemedText variant="label" color={C.muted}>
                {new Date(selectedEntry.logged_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                {selectedEntry.source === 'manual' ? ' · manual' : ''}
              </ThemedText>
              <View style={styles.sheetCalories}>
                <Text style={styles.sheetCalNumber}>{selectedEntry.total_calories}</Text>
                <ThemedText variant="body" color={C.muted}>calories</ThemedText>
              </View>
              <View style={styles.sheetMacroRow}>
                <SheetMacro label="Protein" value={`${Math.round(selectedEntry.protein_g ?? 0)}g`} color={C.proteinGreen} />
                <SheetMacro label="Carbs" value={`${Math.round(selectedEntry.carbs_g ?? 0)}g`} color={C.carbsOrange} />
                <SheetMacro label="Fat" value={`${Math.round(selectedEntry.fat_g ?? 0)}g`} color={C.fatPink} />
              </View>
              <View style={styles.sheetActions}>
                <Pressable style={[styles.actionBtn, { backgroundColor: '#E8F5E9' }]} onPress={handleEdit}>
                  <Ionicons name="create-outline" size={18} color={C.proteinGreen} />
                  <Text style={[styles.actionText, { color: C.proteinGreen }]}>Edit</Text>
                </Pressable>
                {selectedEntry.source !== 'manual' && (
                  <Pressable style={[styles.actionBtn, { backgroundColor: '#FFF1EA' }]} onPress={handleRescan}>
                    <Ionicons name="camera-outline" size={18} color={C.daily} />
                    <Text style={[styles.actionText, { color: C.daily }]}>Rescan</Text>
                  </Pressable>
                )}
                <Pressable style={[styles.actionBtn, { backgroundColor: '#FADBD8' }]} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={18} color="#C0392B" />
                  <Text style={[styles.actionText, { color: '#C0392B' }]}>Delete</Text>
                </Pressable>
              </View>
            </>
          )}
        </BottomSheetView>
      </BottomSheet>
    </SafeAreaView>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// DailyView
// ────────────────────────────────────────────────────────────────────────────

interface DailyViewProps {
  entries: FoodEntry[];
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  onMealPress: (entry: FoodEntry) => void;
}

function DailyView({
  entries,
  totalProtein,
  totalCarbs,
  totalFat,
  proteinGoal,
  carbsGoal,
  fatGoal,
  onMealPress,
}: DailyViewProps) {
  const insight = useMemo(() => buildDailyInsight(entries.length), [entries.length]);

  return (
    <View style={styles.viewWrap}>
      <InsightSentence parts={insight} />

      <View style={[styles.cardBig, CARD_SHADOW]}>
        <CumulativeRoute entries={entries} />
      </View>

      <View style={[styles.cardBig, CARD_SHADOW]}>
        {entries.length === 0 ? (
          <View style={styles.emptyMealList}>
            <Ionicons name="restaurant-outline" size={26} color={C.muted} />
            <ThemedText variant="body" color={C.muted} style={{ marginTop: 8 }}>
              No meals yet — your timeline will appear here.
            </ThemedText>
          </View>
        ) : (
          entries
            .slice()
            .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
            .map((entry, idx, arr) => (
              <MealRow
                key={entry.id}
                entry={entry}
                showDivider={idx < arr.length - 1}
                onPress={() => onMealPress(entry)}
              />
            ))
        )}
      </View>

      <View style={styles.macroPillRow}>
        <MacroPill label="Protein" value={`${Math.round(totalProtein)}g`} progress={proteinGoal > 0 ? totalProtein / proteinGoal : 0} color={C.proteinGreen} />
        <MacroPill label="Carbs" value={`${Math.round(totalCarbs)}g`} progress={carbsGoal > 0 ? totalCarbs / carbsGoal : 0} color={C.carbsOrange} />
        <MacroPill label="Fat" value={`${Math.round(totalFat)}g`} progress={fatGoal > 0 ? totalFat / fatGoal : 0} color={C.fatPink} />
      </View>
    </View>
  );
}

function buildDailyInsight(count: number): InsightPart[] {
  if (count === 0) {
    return [{ text: 'No meals logged yet — your Route is waiting.' }];
  }
  if (count === 1) {
    return [
      { text: 'Just ' },
      { text: '1 meal', highlight: C.daily },
      { text: ' so far. Lunch?' },
    ];
  }
  return [
    { text: 'You’ve had ' },
    { text: `${count} meals`, highlight: C.daily },
    { text: ' today, nicely spaced across the day.' },
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// CumulativeRoute — upward-only cumulative-calorie spline
// ────────────────────────────────────────────────────────────────────────────

interface CumulativeRouteProps {
  entries: FoodEntry[];
}

const ROUTE_PADDING = { top: 24, right: 20, bottom: 36, left: 20 };

function CumulativeRoute({ entries }: CumulativeRouteProps) {
  const width = 320;
  const height = 200;
  const plotW = width - ROUTE_PADDING.left - ROUTE_PADDING.right;
  const plotH = height - ROUTE_PADDING.top - ROUTE_PADDING.bottom;

  const sorted = useMemo(
    () => entries.slice().sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()),
    [entries],
  );

  const points = useMemo(() => {
    if (sorted.length === 0) return [];
    let cum = 0;
    return sorted.map((e) => {
      cum += e.total_calories;
      return { t: new Date(e.logged_at).getTime(), cum, entry: e };
    });
  }, [sorted]);

  const dashOffset = useSharedValue(1);
  useEffect(() => {
    dashOffset.value = 1;
    dashOffset.value = withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [points.length]);

  // Empty state — flat dotted baseline with helper text
  if (points.length === 0) {
    return (
      <View style={{ width: '100%', alignItems: 'center' }}>
        <Svg width={width} height={height}>
          <Path
            d={`M ${ROUTE_PADDING.left} ${ROUTE_PADDING.top + plotH * 0.85} L ${ROUTE_PADDING.left + plotW} ${ROUTE_PADDING.top + plotH * 0.85}`}
            stroke={C.emptyFill}
            strokeWidth={2}
            strokeDasharray="6,6"
          />
        </Svg>
        <ThemedText variant="body" color={C.muted} align="center" style={{ marginTop: -32, paddingHorizontal: 24 }}>
          Scan your first meal to start your Route.
        </ThemedText>
      </View>
    );
  }

  // X range: cover the actual meal span, or a 6-hour minimum so a single meal
  // does not collapse to a vertical line.
  const tMin = points[0].t;
  const tMaxRaw = points[points.length - 1].t;
  const tSpanMs = Math.max(tMaxRaw - tMin, 6 * 3600 * 1000);
  const tMax = tMin + tSpanMs;
  const yMax = Math.max(points[points.length - 1].cum, 1);

  // Project to pixel coords; prepend a baseline anchor at (tMin, 0) so the
  // curve starts from the bottom rather than mid-air at the first meal.
  const px = (t: number) => ROUTE_PADDING.left + ((t - tMin) / (tMax - tMin || 1)) * plotW;
  const py = (cum: number) => ROUTE_PADDING.top + (1 - cum / yMax) * plotH;

  const curvePts = [{ x: px(tMin), y: py(0) }, ...points.map((p) => ({ x: px(p.t), y: py(p.cum) }))];
  const splinePath = monotoneCubicPath(curvePts);
  const areaPath = `${splinePath} L ${curvePts[curvePts.length - 1].x} ${ROUTE_PADDING.top + plotH} L ${curvePts[0].x} ${ROUTE_PADDING.top + plotH} Z`;

  // Total perimeter estimate for the stroke draw-in animation.
  const pathLength = curvePts.reduce((acc, p, i) => (i === 0 ? 0 : acc + Math.hypot(p.x - curvePts[i - 1].x, p.y - curvePts[i - 1].y)), 0);

  const strokeAnimProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value * pathLength,
  }));

  return (
    <View style={{ width: '100%', alignItems: 'center' }}>
      <Svg width={width} height={height}>
        <Defs>
          <SvgLinearGradient id="routeFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.monthly} stopOpacity={0.25} />
            <Stop offset="1" stopColor={C.monthly} stopOpacity={0.02} />
          </SvgLinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#routeFill)" />
        <AnimatedPath
          d={splinePath}
          stroke={C.monthly}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${pathLength} ${pathLength}`}
          animatedProps={strokeAnimProps}
        />

        {/* Meal nodes: thumbnail-in-circle */}
        {points.map((p, i) => {
          const x = px(p.t);
          const y = py(p.cum);
          const r = 16;
          const thumb = p.entry.image_url ?? undefined;
          const clipId = `route-clip-${i}`;
          return (
            <G key={p.entry.id}>
              {thumb ? (
                <>
                  <Defs>
                    <ClipPath id={clipId}>
                      <Circle cx={x} cy={y} r={r - 1.5} />
                    </ClipPath>
                  </Defs>
                  <Circle cx={x} cy={y} r={r} fill="#FFFFFF" stroke={C.monthly} strokeWidth={1.5} />
                  <SvgImage
                    href={thumb}
                    x={x - (r - 1.5)}
                    y={y - (r - 1.5)}
                    width={(r - 1.5) * 2}
                    height={(r - 1.5) * 2}
                    clipPath={`url(#${clipId})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                </>
              ) : (
                <>
                  <Circle cx={x} cy={y} r={r} fill="#FFFFFF" stroke={C.monthly} strokeWidth={1.5} />
                  <SvgText x={x} y={y + r * 0.32} fontSize={r * 0.95} textAnchor="middle">
                    🍴
                  </SvgText>
                </>
              )}
              <SvgText
                x={x}
                y={y + r + 14}
                fontSize={9}
                fill={C.muted}
                textAnchor="middle"
                fontFamily={SANS_MED}
              >
                {formatHourLabel(p.t)}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

function formatHourLabel(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')}${ampm}`;
}

// Monotone-cubic interpolation (single point: degrade to a line)
function monotoneCubicPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  const n = points.length;
  const deltas: number[] = [];
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    deltas.push(dx === 0 ? 0 : (points[i + 1].y - points[i].y) / dx);
  }
  slopes.push(deltas[0]);
  for (let i = 1; i < n - 1; i++) {
    if (deltas[i - 1] * deltas[i] <= 0) slopes.push(0);
    else slopes.push((deltas[i - 1] + deltas[i]) / 2);
  }
  slopes.push(deltas[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(deltas[i]) < 1e-12) { slopes[i] = 0; slopes[i + 1] = 0; continue; }
    const a = slopes[i] / deltas[i];
    const b = slopes[i + 1] / deltas[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      slopes[i] = t * a * deltas[i];
      slopes[i + 1] = t * b * deltas[i];
    }
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = (p1.x - p0.x) / 3;
    d += ` C ${p0.x + dx} ${p0.y + slopes[i] * dx}, ${p1.x - dx} ${p1.y - slopes[i + 1] * dx}, ${p1.x} ${p1.y}`;
  }
  return d;
}

// ────────────────────────────────────────────────────────────────────────────
// Meal row
// ────────────────────────────────────────────────────────────────────────────

function MealRow({ entry, showDivider, onPress }: { entry: FoodEntry; showDivider: boolean; onPress: () => void }) {
  const time = new Date(entry.logged_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  const sourceLabel = entry.source === 'manual' ? 'manual' : 'scanned';

  return (
    <Pressable onPress={onPress} style={[styles.mealRow, showDivider && styles.mealRowDivider]}>
      <View style={styles.mealThumb}>
        {entry.image_url ? (
          <Image source={{ uri: entry.image_url }} style={styles.mealThumbImg} />
        ) : (
          <Text style={{ fontSize: 18 }}>🍴</Text>
        )}
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.mealName} numberOfLines={1}>{entry.meal_name}</Text>
        <Text style={styles.mealMeta}>{time} · {sourceLabel}</Text>
      </View>
      <Text style={styles.mealCal}>{entry.total_calories}</Text>
    </Pressable>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Macro pill
// ────────────────────────────────────────────────────────────────────────────

function MacroPill({ label, value, progress, color }: { label: string; value: string; progress: number; color: string }) {
  const fillW = Math.min(100, Math.max(0, progress * 100));
  return (
    <View style={styles.macroPill}>
      <Text style={styles.macroPillLabel}>{label}</Text>
      <Text style={styles.macroPillValue}>{value}</Text>
      <View style={styles.macroPillTrack}>
        <View style={[styles.macroPillFill, { width: `${fillW}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// WeeklyView
// ────────────────────────────────────────────────────────────────────────────

interface WeeklyViewProps {
  data: WeeklyData | null;
  calorieGoal: number;
  hydrationGoalMl: number;
  proteinGoal: number;
  unitPref: UnitPreference;
}

function WeeklyView({ data, calorieGoal, hydrationGoalMl, proteinGoal, unitPref }: WeeklyViewProps) {
  if (!data) {
    return (
      <View style={styles.viewWrap}>
        <SkeletonCard lines={4} style={{ marginBottom: 16 }} />
        <SkeletonCard lines={4} style={{ marginBottom: 16 }} />
      </View>
    );
  }

  const insight = useMemo(() => buildWeeklyInsight(data, calorieGoal), [data, calorieGoal]);
  const maxCal = Math.max(calorieGoal || 0, ...data.days.map((d) => d.calories), 1);
  const maxProtein = Math.max(proteinGoal || 0, ...data.days.map((d) => d.protein), 1);

  return (
    <View style={styles.viewWrap}>
      <InsightSentence parts={insight} />

      {/* Calories card */}
      <View style={[styles.cardBig, CARD_SHADOW]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeaderLabel}>Calories</Text>
          <Text style={styles.cardHeaderValue}>{data.avgCalories.toLocaleString()} avg</Text>
        </View>
        <BarRow values={data.days.map((d) => d.calories)} max={maxCal} dayLabels={data.days.map((d) => d.day)} isFuture={data.days.map((d) => d.isFuture)} color={C.monthly} />
      </View>

      {/* Hydration card */}
      <View style={[styles.cardBig, CARD_SHADOW]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeaderLabel}>Hydration</Text>
          <Text style={styles.cardHeaderValue}>{formatVolume(data.avgWaterMl, unitPref)} avg</Text>
        </View>
        <View style={styles.dropRow}>
          {data.days.map((d, i) => (
            <View key={d.date} style={styles.dropColumn}>
              <WaterDrop
                fillPct={hydrationGoalMl > 0 ? d.waterMl / hydrationGoalMl : 0}
                isFuture={d.isFuture}
              />
              <Text style={[styles.dayLabel, d.isFuture && { color: C.mutedFaint }]}>{d.day}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Protein card */}
      <View style={[styles.cardBig, CARD_SHADOW]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeaderLabel}>Protein</Text>
          <Text style={styles.cardHeaderValue}>{data.avgProtein}g avg</Text>
        </View>
        <BarRow values={data.days.map((d) => d.protein)} max={maxProtein} dayLabels={data.days.map((d) => d.day)} isFuture={data.days.map((d) => d.isFuture)} color={C.proteinGreen} />
      </View>

      {/* Consistency sentence (plain text, no card) */}
      <Text style={styles.flatSentence}>
        You logged meals{' '}
        <Text style={{ color: C.weekly, fontFamily: SANS_MED }}>{data.activeDays} of 7 days</Text>
        {' '}this week.
      </Text>
    </View>
  );
}

function buildWeeklyInsight(data: WeeklyData, calorieGoal: number): InsightPart[] {
  const past = data.days.filter((d) => !d.isFuture && d.calories > 0);
  if (past.length === 0) {
    return [{ text: 'Nothing logged yet this week — start with one meal.' }];
  }
  const best = past.reduce((a, b) => (b.calories > a.calories ? b : a));
  const bestDayName = bestDayLong(best.date);
  if (calorieGoal > 0) {
    const pct = Math.min(100, Math.round((best.calories / calorieGoal) * 100));
    return [
      { text: 'Your best day was ' },
      { text: bestDayName, highlight: C.daily },
      { text: ` — you hit ${pct}% of your calorie goal.` },
    ];
  }
  return [
    { text: 'Your best day was ' },
    { text: bestDayName, highlight: C.daily },
    { text: `, at ${best.calories.toLocaleString()} cal.` },
  ];
}

function bestDayLong(dateKey: string): string {
  return new Date(dateKey + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' });
}

// ────────────────────────────────────────────────────────────────────────────
// Animated bar row (used by Calories & Protein cards)
// ────────────────────────────────────────────────────────────────────────────

function BarRow({
  values,
  max,
  dayLabels,
  isFuture,
  color,
}: {
  values: number[];
  max: number;
  dayLabels: string[];
  isFuture: boolean[];
  color: string;
}) {
  return (
    <View style={styles.barChart}>
      {values.map((v, i) => (
        <View key={`${i}-${dayLabels[i]}`} style={styles.barColumn}>
          <View style={styles.barTrack}>
            <AnimatedBar
              targetHeight={Math.max(0, (v / max) * 100)}
              color={isFuture[i] || v === 0 ? C.emptyFill : color}
              delay={i * 50}
            />
          </View>
          <Text style={[styles.dayLabel, (isFuture[i] || v === 0) && { color: C.mutedFaint }]}>
            {dayLabels[i]}
          </Text>
        </View>
      ))}
    </View>
  );
}

function AnimatedBar({ targetHeight, color, delay }: { targetHeight: number; color: string; delay: number }) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.value = 0;
    h.value = withDelay(delay, withTiming(targetHeight, { duration: 300, easing: Easing.out(Easing.cubic) }));
  }, [targetHeight, delay]);
  const animHeight = useAnimatedStyle(() => ({ height: `${h.value}%` as `${number}%` }));
  return <Animated.View style={[styles.barFill, { backgroundColor: color }, animHeight]} />;
}

// ────────────────────────────────────────────────────────────────────────────
// WaterDrop — teardrop SVG with a fill level
// ────────────────────────────────────────────────────────────────────────────

function WaterDrop({ fillPct, isFuture }: { fillPct: number; isFuture: boolean }) {
  const W = 28;
  const H = 34;
  const fill = Math.max(0, Math.min(1, fillPct));
  // Classic teardrop path: peak at top center, rounded base
  const dropPath = `M ${W / 2} 2 C ${W * 0.05} ${H * 0.55} ${W * 0.1} ${H * 0.95} ${W / 2} ${H - 2} C ${W * 0.9} ${H * 0.95} ${W * 0.95} ${H * 0.55} ${W / 2} 2 Z`;
  const fillY = H - fill * (H - 4);
  const clipId = `drop-clip-${Math.random().toString(36).slice(2, 8)}`;

  if (isFuture) {
    return (
      <Svg width={W} height={H}>
        <Path d={dropPath} fill={C.emptyFillSoft} stroke="#e0d9ce" strokeWidth={1} />
      </Svg>
    );
  }

  return (
    <Svg width={W} height={H}>
      <Defs>
        <ClipPath id={clipId}>
          <Path d={dropPath} />
        </ClipPath>
      </Defs>
      <Path d={dropPath} fill="#FFFFFF" stroke={C.hydrationLight} strokeWidth={1.5} />
      <Path
        d={`M 0 ${fillY} L ${W} ${fillY} L ${W} ${H} L 0 ${H} Z`}
        fill={C.hydration}
        clipPath={`url(#${clipId})`}
      />
      <Path d={dropPath} fill="none" stroke={C.hydrationLight} strokeWidth={1.5} />
    </Svg>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MonthlyView
// ────────────────────────────────────────────────────────────────────────────

interface MonthlyViewProps {
  data: MonthlyData | null;
  streak: number;
  totalCaloriesToday: number;
  unitPref: UnitPreference;
}

function MonthlyView({ data, streak, unitPref }: MonthlyViewProps) {
  if (!data) {
    return (
      <View style={styles.viewWrap}>
        <SkeletonCard lines={4} style={{ marginBottom: 16 }} />
        <SkeletonCard lines={4} style={{ marginBottom: 16 }} />
      </View>
    );
  }

  const insight = useMemo(() => buildMonthlyInsight(data), [data]);
  const consistency = Math.round((data.activeDays / Math.max(1, data.days.filter((d) => !d.isFuture).length)) * 100);

  return (
    <View style={styles.viewWrap}>
      {/* Streak badge */}
      <View style={{ alignItems: 'flex-start', marginBottom: 14 }}>
        <LinearGradient
          colors={['#E8703A', '#f09060']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.streakBadge}
        >
          <Text style={styles.streakBadgeText}>🔥 {streak} day streak</Text>
        </LinearGradient>
      </View>

      <InsightSentence parts={insight} />

      {/* Heatmap card */}
      <View style={[styles.cardBig, CARD_SHADOW]}>
        <Heatmap data={data} />
      </View>

      {/* Monthly stats list (vertical, NOT a grid) */}
      <View style={[styles.cardBig, CARD_SHADOW, { paddingVertical: 4 }]}>
        <StatsRow
          icon="🔥"
          iconBg="#fef2ec"
          label="Average daily calories"
          value={`${data.avgCalories.toLocaleString()}`}
          divider
        />
        <StatsRow
          icon="💧"
          iconBg="#eef5ff"
          label="Average hydration"
          value={formatVolume(data.avgWaterMl, unitPref)}
          divider
        />
        <StatsRow
          icon="💪"
          iconBg="#f0faf0"
          label="Average protein"
          value={`${data.avgProtein}g`}
        />
      </View>

      <Text style={styles.flatSentence}>
        Your consistency score is{' '}
        <Text style={{ color: C.weekly, fontFamily: SANS_MED }}>{consistency} / 100</Text>
        {' '}— {consistency >= 60 ? 'that’s a solid rhythm.' : 'plenty of room to grow.'}
      </Text>
    </View>
  );
}

function buildMonthlyInsight(data: MonthlyData): InsightPart[] {
  const past = data.days.filter((d) => !d.isFuture).length;
  if (data.activeDays === 0) {
    return [{ text: `${data.monthLabel} is open canvas — your first meal starts the story.` }];
  }
  return [
    { text: `${data.monthLabel} has been solid — you logged ` },
    { text: `${data.activeDays} of ${past} days`, highlight: C.daily },
    { text: ' so far.' },
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// Heatmap
// ────────────────────────────────────────────────────────────────────────────

function Heatmap({ data }: { data: MonthlyData }) {
  // Pad with leading empties so day-of-week alignment is correct.
  const lead = data.days[0]?.weekday ?? 0;
  const cells: ({ key: string; mealCount: number; isFuture: boolean; placeholder: true } | { key: string; mealCount: number; isFuture: boolean; placeholder?: false })[] = [];
  for (let i = 0; i < lead; i++) {
    cells.push({ key: `lead-${i}`, mealCount: 0, isFuture: true, placeholder: true });
  }
  data.days.forEach((d) => {
    cells.push({ key: d.date, mealCount: d.mealCount, isFuture: d.isFuture });
  });

  return (
    <View>
      <View style={styles.heatmapDayLabels}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <Text key={`${d}-${i}`} style={styles.heatmapDayLabel}>{d}</Text>
        ))}
      </View>
      <View style={styles.heatmapGrid}>
        {cells.map((cell, i) => (
          <HeatmapCell key={cell.key} cell={cell} delay={Math.floor(i / 7) * 30 + (i % 7) * 12} />
        ))}
      </View>
      <View style={styles.heatmapLegend}>
        <Text style={styles.heatmapLegendText}>Less</Text>
        {[C.heatNone, C.heat1, C.heat2, C.heat3, C.heat4].map((c, i) => (
          <View key={i} style={[styles.heatmapLegendSquare, { backgroundColor: c }]} />
        ))}
        <Text style={styles.heatmapLegendText}>More</Text>
      </View>
    </View>
  );
}

function HeatmapCell({ cell, delay }: { cell: { mealCount: number; isFuture: boolean; placeholder?: boolean }; delay: number }) {
  if (cell.placeholder) return <View style={[styles.heatmapCell, { backgroundColor: 'transparent' }]} />;
  if (cell.isFuture) return <View style={[styles.heatmapCell, { backgroundColor: 'transparent' }]} />;
  const color =
    cell.mealCount >= 4 ? C.heat4 :
    cell.mealCount === 3 ? C.heat3 :
    cell.mealCount === 2 ? C.heat2 :
    cell.mealCount === 1 ? C.heat1 :
    C.heatNone;
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(280)}
      style={[styles.heatmapCell, { backgroundColor: color }]}
    />
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Stats row (monthly)
// ────────────────────────────────────────────────────────────────────────────

function StatsRow({
  icon,
  iconBg,
  label,
  value,
  divider,
}: {
  icon: string;
  iconBg: string;
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <View style={[styles.statsRow, divider && styles.statsRowDivider]}>
      <View style={[styles.statsIcon, { backgroundColor: iconBg }]}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={styles.statsLabel}>{label}</Text>
        <Text style={styles.statsValue}>{value}</Text>
      </View>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Shared bits
// ────────────────────────────────────────────────────────────────────────────

interface InsightPart {
  text: string;
  highlight?: string;
}

function InsightSentence({ parts }: { parts: InsightPart[] }) {
  return (
    <Text style={styles.insightSentence}>
      {parts.map((p, i) => (
        <Text
          key={i}
          style={[
            styles.insightSerif,
            p.highlight ? { color: p.highlight, fontFamily: SERIF_BOLD } : undefined,
          ]}
        >
          {p.text}
        </Text>
      ))}
    </Text>
  );
}

function SheetMacro({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />
      <View>
        <Text style={{ fontSize: 10, color: C.muted, fontFamily: SANS_MED }}>{label}</Text>
        <Text style={{ fontSize: 14, color: C.primary, fontFamily: SANS_SEMI }}>{value}</Text>
      </View>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: Spacing['5xl'] },
  skeleton: { marginHorizontal: Spacing.xl, marginTop: Spacing.xl },

  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.lg,
  },
  headerCopy: { flex: 1 },
  greetingSerif: {
    fontFamily: SERIF_BOLD,
    fontSize: 28,
    lineHeight: 34,
    color: C.primary,
  },
  avatarButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.weekly,
    alignItems: 'center',
    justifyContent: 'center',
  },

  segmented: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    backgroundColor: C.emptyFill,
    borderRadius: 24,
    padding: 3,
    marginBottom: Spacing.lg,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 20,
  },
  segmentText: {
    fontFamily: SANS_SEMI,
    fontSize: 13,
    letterSpacing: 0.2,
  },

  viewWrap: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },

  insightSentence: {
    paddingHorizontal: 0,
    marginBottom: 6,
  },
  insightSerif: {
    fontFamily: SERIF,
    fontSize: 15,
    lineHeight: 22,
    color: C.primary,
  },

  cardBig: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardHeaderLabel: {
    fontFamily: SANS_MED,
    fontSize: 14,
    color: C.primary,
  },
  cardHeaderValue: {
    fontFamily: SERIF_BOLD,
    fontSize: 18,
    color: C.primary,
  },

  // Meal timeline list
  emptyMealList: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  mealRowDivider: {
    borderBottomColor: C.emptyFillSoft,
    borderBottomWidth: 1,
  },
  mealThumb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.emptyFillSoft,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealThumbImg: { width: '100%', height: '100%' },
  mealName: {
    fontFamily: SANS_MED,
    fontSize: 14,
    color: C.primary,
  },
  mealMeta: {
    fontFamily: SANS,
    fontSize: 12,
    color: C.muted,
    marginTop: 1,
  },
  mealCal: {
    fontFamily: SERIF_BOLD,
    fontSize: 16,
    color: C.primary,
  },

  // Macro pills
  macroPillRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  macroPill: {
    flex: 1,
    backgroundColor: C.pillBg,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  macroPillLabel: {
    fontFamily: SANS_MED,
    fontSize: 10,
    color: C.muted,
    letterSpacing: 0.3,
  },
  macroPillValue: {
    fontFamily: SERIF_BOLD,
    fontSize: 16,
    color: C.primary,
    marginTop: 3,
  },
  macroPillTrack: {
    height: 3,
    width: '100%',
    backgroundColor: C.emptyFill,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  macroPillFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Bar charts
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: 6,
    marginTop: 4,
  },
  barColumn: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: {
    width: '100%',
    height: 96,
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  dayLabel: {
    fontFamily: SANS_MED,
    fontSize: 10,
    color: C.muted,
  },

  // Hydration
  dropRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  dropColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },

  flatSentence: {
    fontFamily: SANS,
    fontSize: 14,
    color: C.primarySoft,
    lineHeight: 22,
    paddingTop: 4,
    paddingHorizontal: 4,
  },

  // Monthly
  streakBadge: {
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  streakBadgeText: {
    color: '#FFFFFF',
    fontFamily: SANS_MED,
    fontSize: 13,
  },

  // Heatmap
  heatmapDayLabels: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  heatmapDayLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: SANS_MED,
    fontSize: 9,
    color: C.muted,
  },
  heatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  heatmapCell: {
    width: 'auto',
    aspectRatio: 1,
    flexBasis: '13%',
    borderRadius: 6,
    flexGrow: 0,
    flexShrink: 0,
  },
  heatmapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    marginTop: 14,
  },
  heatmapLegendText: {
    fontFamily: SANS,
    fontSize: 10,
    color: C.muted,
  },
  heatmapLegendSquare: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },

  // Stats row (monthly)
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  statsRowDivider: {
    borderBottomColor: C.emptyFillSoft,
    borderBottomWidth: 1,
  },
  statsIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsLabel: {
    fontFamily: SANS_MED,
    fontSize: 12,
    color: C.muted,
  },
  statsValue: {
    fontFamily: SERIF_BOLD,
    fontSize: 20,
    color: C.primary,
    marginTop: 2,
  },

  // Sheet
  sheetContent: { padding: Spacing.xl, gap: Spacing.base },
  sheetCalories: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  sheetCalNumber: {
    fontFamily: SERIF_BOLD,
    fontSize: 30,
    color: C.daily,
  },
  sheetMacroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  actionText: {
    fontFamily: SANS_SEMI,
    fontSize: 14,
  },

  bottomPadding: { height: 120 },
});
