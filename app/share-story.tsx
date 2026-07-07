import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Dimensions, Image, Keyboard, KeyboardAvoidingView, Modal,
  Platform, Pressable, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Share, { Social } from 'react-native-share';
import ViewShot from 'react-native-view-shot';
import Animated, {
  useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming, interpolate, Extrapolation, runOnJS,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { Colors, Typography } from '@/constants/theme';
import { computeRoutePoints, type RouteMealInput } from '@/lib/routePoints';
import { buildAreaPath, buildSplinePath, projectPoints } from '@/lib/routeSpline';
import { useAuthStore } from '@/stores/auth.store';

const STORY_W = 1080;
const STORY_H = 1920;
// Graph-only "Meal timeline" sticker — transparent PNG, sized to the graph.
const TIMELINE_STICKER_W = 1080;
const TIMELINE_STICKER_H = 820;
const META_APP_ID = '1878768349457558';
const WINDOW = Dimensions.get('window');
const PREVIEW_W = Math.min(WINDOW.width - 40, 300, Math.max(220, (WINDOW.height - 360) * STORY_W / STORY_H));
const PREVIEW_H = PREVIEW_W * STORY_H / STORY_W;

const NOTE_MAX = 40;
const DEFAULT_NOTE: Record<Template, string> = {
  route: 'Every meal shaped the day',
  stats: 'This week in numbers',
  timeline: 'Your day, one line',
};

const TEMPLATE_LABEL: Record<Template, string> = {
  route: 'Route Hero',
  stats: 'Stats Card',
  timeline: 'Meal Timeline',
};

type Template = 'route' | 'stats' | 'timeline';
type RouteDatum = { calories: number; timestamp?: string; thumbnailUrl?: string };
type ShareData = { calories: number; streak: number; protein: number; carbs: number; fat: number; route: RouteDatum[] };
type Params = Partial<Record<'calories' | 'streak' | 'protein' | 'carbs' | 'fat' | 'chartData', string>>;

interface Toggles {
  showTitle: boolean;
  showStreak: boolean;
  showTimeline: boolean;
  showCalories: boolean;
  showWatermark: boolean;
  showFoodNodes: boolean;
}
const DEFAULT_TOGGLES: Toggles = {
  showTitle: true, showStreak: true, showTimeline: true, showCalories: true, showWatermark: true, showFoodNodes: true,
};

interface PersistedState {
  template: Template;
  routeNote: string;
  statsNote: string;
  toggles: Toggles;
}

const FALLBACK_ROUTE: RouteDatum[] = [
  { timestamp: '08:00', calories: 320 }, { timestamp: '10:00', calories: 180 },
  { timestamp: '12:30', calories: 580 }, { timestamp: '14:00', calories: 420 },
  { timestamp: '16:30', calories: 250 }, { timestamp: '18:30', calories: 640 },
  { timestamp: '20:00', calories: 390 },
];

function numeric(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseRoute(value?: string): RouteDatum[] {
  if (!value) return FALLBACK_ROUTE;
  try {
    const raw: unknown = JSON.parse(value);
    if (!Array.isArray(raw) || raw.length === 0) return FALLBACK_ROUTE;
    const data = raw.map((item): RouteDatum | null => {
      if (typeof item === 'number' && Number.isFinite(item)) return { calories: Math.max(0, item) };
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const calories = Number(row.calories);
      if (!Number.isFinite(calories)) return null;
      return {
        calories: Math.max(0, calories),
        timestamp: typeof row.timestamp === 'string' ? row.timestamp : undefined,
        thumbnailUrl: typeof row.thumbnailUrl === 'string' ? row.thumbnailUrl : undefined,
      };
    }).filter((item): item is RouteDatum => item !== null);
    return data.length ? data : FALLBACK_ROUTE;
  } catch {
    return FALLBACK_ROUTE;
  }
}

function timeLabel(value: string | undefined, index: number) {
  if (!value) return `${index + 1}`;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date.toLocaleTimeString([], { hour: 'numeric' });
  const match = value.match(/^(\d{1,2}):/);
  if (!match) return `${index + 1}`;
  const hour = Number(match[1]);
  return `${hour % 12 || 12}${hour >= 12 ? 'PM' : 'AM'}`;
}

/* ─── Toggleable: fade + slight scale, never unmounts so the card never reflows ─── */
function Toggleable({ visible, style, children }: { visible: boolean; style?: any; children: React.ReactNode }) {
  const p = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(visible ? 1 : 0, { duration: 200 });
  }, [visible, p]);
  const anim = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.96 + p.value * 0.04 }],
  }));
  return (
    <Animated.View style={[style, anim]} pointerEvents={visible ? 'auto' : 'none'}>
      {children}
    </Animated.View>
  );
}

/* ─── Route spline graph. showNodes toggles the meal-photo nodes on the curve. ─── */
function RouteGraph({ data, width, height, dark, labels = true, brand = false, showNodes = true }: {
  data: RouteDatum[]; width: number; height: number; dark: boolean; labels?: boolean; brand?: boolean; showNodes?: boolean;
}) {
  const u = width / 920;
  const padX = 54 * u;
  const padTop = 62 * u;
  const padBottom = (labels ? 80 : 42) * u;

  const mealInputs: RouteMealInput[] = data.map((d, i) => ({
    id: `route-${i}`,
    occurredAt: d.timestamp ?? '',
    calories: d.calories,
    thumbnailUrl: d.thumbnailUrl,
  }));
  const routePoints = computeRoutePoints(mealInputs);
  const padding = { top: padTop, right: padX, bottom: padBottom, left: padX };
  const points = projectPoints(routePoints, width, height, padding);

  const path = buildSplinePath(points);
  const baseline = height - padBottom + 12 * u;
  const area = buildAreaPath(path, points, baseline);
  const gradientId = `route-${dark ? 'd' : 'l'}-${Math.round(width)}`;

  return <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    <Defs>
      <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={Colors.routePink} stopOpacity={dark ? .42 : .28} /><Stop offset="1" stopColor={Colors.routePink} stopOpacity="0" /></LinearGradient>
      {points.map((p, i) => <ClipPath id={`clip-${Math.round(width)}-${i}`} key={i}><Circle cx={p.x} cy={p.y} r={25 * u} /></ClipPath>)}
    </Defs>
    {area ? <Path d={area} fill={`url(#${gradientId})`} /> : null}
    {dark && path ? <Path d={path} stroke={Colors.routePink} strokeWidth={18 * u} opacity={.2} fill="none" strokeLinecap="round" /> : null}
    {path ? <Path d={path} stroke={Colors.routePink} strokeWidth={8 * u} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
    {showNodes ? points.map((point, i) => {
      const r = 25 * u;
      const meal = routePoints[i];
      const image = meal?.thumbnailUrl;
      return <G key={i}>
        <Circle cx={point.x} cy={point.y} r={r + 7 * u} fill={dark ? '#151219' : '#FFF'} stroke={Colors.routePink} strokeWidth={5 * u} />
        {image ? <SvgImage href={image} x={point.x - r} y={point.y - r} width={r * 2} height={r * 2} clipPath={`url(#clip-${Math.round(width)}-${i})`} preserveAspectRatio="xMidYMid slice" /> : <Circle cx={point.x} cy={point.y} r={r} fill={dark ? '#31232C' : '#F7DCE7'} />}
        {!image ? <Circle cx={point.x} cy={point.y} r={7 * u} fill={Colors.routePink} /> : null}
      </G>;
    }) : null}
    {labels ? points.map((point, i) => <SvgText key={i} x={point.x} y={height - 22 * u} fill={dark ? 'rgba(255,255,255,.58)' : '#786F68'} fontSize={22 * u} fontWeight="600" textAnchor="middle">{timeLabel(routePoints[i]?.occurredAt, i)}</SvgText>) : null}
    {brand ? <SvgText x={width - 30 * u} y={36 * u} fill={dark ? 'rgba(255,255,255,.72)' : '#5F5550'} fontSize={22 * u} fontWeight="800" textAnchor="end" letterSpacing={2 * u}>NYURIX</SvgText> : null}
  </Svg>;
}

/* ─── Route Hero card — every toggleable element is wrapped in <Toggleable> ─── */
function RouteHero({ data, width, height, note, backgroundUri, toggles }: {
  data: ShareData; width: number; height: number; note: string; backgroundUri: string | null; toggles: Toggles;
}) {
  const u = width / STORY_W;
  return <View style={[s.canvas, { width, height, backgroundColor: '#0B090D' }]}>
    {backgroundUri ? (
      <>
        <Image source={{ uri: backgroundUri }} style={[StyleSheet.absoluteFillObject, { width, height }]} resizeMode="cover" />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
      </>
    ) : (
      <View style={[s.glow, { width: 760 * u, height: 760 * u, borderRadius: 380 * u, top: 480 * u, left: 160 * u }]} />
    )}

    <Toggleable visible={toggles.showTitle} style={{ position: 'absolute', top: 280 * u, left: 80 * u, right: 80 * u }}>
      <Text style={[s.eyebrow, { fontSize: 26 * u, letterSpacing: 6 * u }]}>TODAY'S NUTRITION ROUTE</Text>
      <Text style={[s.heroTitle, { fontSize: 70 * u, lineHeight: 78 * u, marginTop: 16 * u }]}>{note || DEFAULT_NOTE.route}</Text>
    </Toggleable>

    <Toggleable visible={toggles.showTimeline} style={{ position: 'absolute', top: 600 * u, left: 80 * u }}>
      <RouteGraph data={data.route} width={920 * u} height={590 * u} dark showNodes={toggles.showFoodNodes} />
    </Toggleable>

    <View style={{ position: 'absolute', top: 1260 * u, left: 80 * u, right: 80 * u, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <Toggleable visible={toggles.showCalories}>
        <Text style={[s.heroCalories, { fontSize: 112 * u, lineHeight: 120 * u }]}>{Math.round(data.calories).toLocaleString()}</Text>
        <Text style={[s.heroCaloriesLabel, { fontSize: 28 * u, marginTop: 8 * u }]}>CALORIES LOGGED</Text>
      </Toggleable>
      <Toggleable visible={toggles.showStreak} style={{ marginBottom: 12 * u }}>
        <View style={[s.streak, { borderRadius: 40 * u, paddingHorizontal: 28 * u, paddingVertical: 18 * u }]}>
          <Text style={{ fontSize: 31 * u }}>🔥</Text>
          <Text style={[s.streakText, { fontSize: 27 * u, marginLeft: 10 * u }]}>{data.streak} day streak</Text>
        </View>
      </Toggleable>
    </View>

    <Toggleable visible={toggles.showWatermark} style={{ position: 'absolute', bottom: 280 * u, right: 80 * u }}>
      <Text style={[s.heroWordmark, { fontSize: 28 * u, letterSpacing: 5 * u }]}>NYURIX</Text>
    </Toggleable>
  </View>;
}

function MacroBar({ label, value, max, u }: { label: string; value: number; max: number; u: number }) {
  const progress = Math.max(.06, Math.min(1, value / Math.max(max, 1)));
  return <View style={{ marginTop: 24 * u }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}><Text style={[s.macroLabel, { fontSize: 25 * u }]}>{label}</Text><Text style={[s.macroValue, { fontSize: 27 * u }]}>{Math.round(value)}g</Text></View>
    <View style={[s.macroTrack, { height: 14 * u, borderRadius: 7 * u, marginTop: 10 * u }]}><View style={{ width: `${progress * 100}%`, height: '100%', borderRadius: 7 * u, backgroundColor: Colors.routePink }} /></View>
  </View>;
}

function StatsContent({ data, width, backgroundUri, toggles }: { data: ShareData; width: number; backgroundUri?: string | null; toggles: Toggles }) {
  const u = width / 900; const maxMacro = Math.max(data.protein, data.carbs, data.fat, 1);
  return <View style={{ width, paddingHorizontal: 54 * u, paddingTop: 52 * u, paddingBottom: 58 * u }}>
    <Toggleable visible={toggles.showTimeline} style={{ height: 500 * u, position: 'relative', overflow: 'hidden', borderRadius: 24 * u }}>
      {backgroundUri ? (
        <>
          <Image source={{ uri: backgroundUri }} style={[StyleSheet.absoluteFillObject]} resizeMode="cover" />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
        </>
      ) : null}
      <Text style={[s.statsRouteLabel, { fontSize: 23 * u, letterSpacing: 4 * u, marginLeft: 18 * u, color: backgroundUri ? '#FFFFFF' : Colors.routePink }]}>YOUR ROUTE</Text>
      <RouteGraph data={data.route} width={792 * u} height={440 * u} dark={!!backgroundUri} showNodes={toggles.showFoodNodes} />
    </Toggleable>
    <View style={[s.divider, { marginHorizontal: 18 * u }]} />
    <View style={{ paddingHorizontal: 18 * u, paddingTop: 34 * u }}>
      <Toggleable visible={toggles.showCalories}>
        <Text style={[s.statsTotal, { fontSize: 78 * u, lineHeight: 84 * u }]}>{Math.round(data.calories).toLocaleString()}</Text>
        <Text style={[s.statsTotalLabel, { fontSize: 23 * u, marginTop: 4 * u }]}>CALORIES TODAY</Text>
      </Toggleable>
      <View style={{ marginTop: 24 * u }}><MacroBar label="Protein" value={data.protein} max={maxMacro} u={u} /><MacroBar label="Carbs" value={data.carbs} max={maxMacro} u={u} /><MacroBar label="Fat" value={data.fat} max={maxMacro} u={u} /></View>
    </View>
  </View>;
}

function StatsCard({ data, width, height, note, backgroundUri, toggles }: {
  data: ShareData; width: number; height: number; note: string; backgroundUri: string | null; toggles: Toggles;
}) {
  const u = width / STORY_W;
  return <View style={[s.canvas, { width, height, backgroundColor: '#F5F0E8' }]}>
    <View style={{ position: 'absolute', top: 275 * u, left: 90 * u, width: 900 * u }}>
      <Toggleable visible={toggles.showWatermark}>
        <Text style={[s.statsWordmark, { fontSize: 27 * u, letterSpacing: 5 * u, marginBottom: 28 * u }]}>NYURIX · DAILY SNAPSHOT</Text>
      </Toggleable>
      <View style={[s.statsCard, { width: 900 * u, borderRadius: 52 * u }]}><StatsContent data={data} width={900 * u} backgroundUri={backgroundUri} toggles={toggles} /></View>
    </View>
    <Toggleable visible={toggles.showTitle} style={{ position: 'absolute', bottom: 275 * u, left: 90 * u, right: 90 * u }}>
      <Text style={[s.statsFooter, { fontSize: 24 * u }]}>{note || DEFAULT_NOTE.stats}</Text>
    </Toggleable>
  </View>;
}

function Artwork({ template, data, width, height, note, backgroundUri, toggles }: {
  template: Template; data: ShareData; width: number; height: number; note: string; backgroundUri: string | null; toggles: Toggles;
}) {
  return template === 'route'
    ? <RouteHero data={data} width={width} height={height} note={note} backgroundUri={backgroundUri} toggles={toggles} />
    : <StatsCard data={data} width={width} height={height} note={note} backgroundUri={backgroundUri} toggles={toggles} />;
}

/* ─── Meal timeline: JUST the graph, previewed over the chosen photo/gradient ───
 * The shared artefact is a transparent graph-only sticker (captured separately
 * below); this preview shows how it will float over the Story image. */
function TimelinePreview({ data, width, height, backgroundUri, showNodes }: {
  data: ShareData; width: number; height: number; backgroundUri: string | null; showNodes: boolean;
}) {
  const u = width / STORY_W;
  const graphH = width * 0.78;
  return (
    <View style={[s.canvas, { width, height, backgroundColor: '#0B090D' }]}>
      {backgroundUri ? (
        <>
          <Image source={{ uri: backgroundUri }} style={[StyleSheet.absoluteFillObject, { width, height }]} resizeMode="cover" />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.22)' }]} />
        </>
      ) : (
        <View style={[s.glow, { width: 760 * u, height: 760 * u, borderRadius: 380 * u, top: height * 0.34, left: 160 * u }]} />
      )}
      <View style={{ position: 'absolute', top: (height - graphH) / 2, left: 0, right: 0, alignItems: 'center' }}>
        <RouteGraph data={data.route} width={width} height={graphH} dark labels={false} brand showNodes={showNodes} />
      </View>
    </View>
  );
}

/* ─── Editor row primitive ─── */
function EditorRow({ icon, iconBg, iconColor, label, subtitle, children }: {
  icon: keyof typeof Ionicons.glyphMap; iconBg: string; iconColor: string; label: string; subtitle?: string; children?: React.ReactNode;
}) {
  return (
    <View style={s.row}>
      <View style={[s.rowIcon, { backgroundColor: iconBg }]}><Ionicons name={icon} size={17} color={iconColor} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        {subtitle ? <Text style={s.rowSub}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const CREAM = '#F7F4EE';
const PRIMARY = '#2F241E';
const MUTED = '#8a7e74';
const BLUE = '#3D8BFF';
const GREEN = '#22C55E';

export default function ShareStoryScreen() {
  const params = useLocalSearchParams() as Params;
  const userId = useAuthStore((st) => st.user?.id ?? 'guest');
  const storageKey = `share_editor_state_${userId}`;

  const [template, setTemplate] = useState<Template>('route');
  const [backgroundUri, setBackgroundUri] = useState<string | null>(null);
  const [routeNote, setRouteNote] = useState(DEFAULT_NOTE.route);
  const [statsNote, setStatsNote] = useState(DEFAULT_NOTE.stats);
  const [toggles, setToggles] = useState<Toggles>(DEFAULT_TOGGLES);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [busy, setBusy] = useState<'share' | 'instagram' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const scrollRef = useRef<Animated.ScrollView>(null);
  const storyRef = useRef<ViewShot>(null);
  const timelineStickerRef = useRef<ViewShot>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const data = useMemo<ShareData>(() => ({
    calories: numeric(params.calories, 1842), streak: numeric(params.streak, 5),
    protein: numeric(params.protein, 87), carbs: numeric(params.carbs, 214), fat: numeric(params.fat, 63),
    route: parseRoute(params.chartData),
  }), [params]);
  const note = template === 'route' ? routeNote : statsNote;

  // ── Restore last-used editor state ──
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw) {
          const p = JSON.parse(raw) as Partial<PersistedState>;
          if (p.template === 'route' || p.template === 'stats' || p.template === 'timeline') setTemplate(p.template);
          if (typeof p.routeNote === 'string') setRouteNote(p.routeNote);
          if (typeof p.statsNote === 'string') setStatsNote(p.statsNote);
          if (p.toggles) setToggles({ ...DEFAULT_TOGGLES, ...p.toggles });
        }
      } catch {
        // ignore — defaults apply
      } finally {
        setHydrated(true);
      }
    })();
  }, [storageKey]);

  // ── Persist on change (after hydration, so we don't overwrite with defaults) ──
  useEffect(() => {
    if (!hydrated) return;
    const payload: PersistedState = { template, routeNote, statsNote, toggles };
    AsyncStorage.setItem(storageKey, JSON.stringify(payload)).catch(() => {});
  }, [hydrated, template, routeNote, statsNote, toggles, storageKey]);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const flashToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  };

  const setToggle = (key: keyof Toggles, value: boolean) => {
    Haptics.selectionAsync();
    setToggles((t) => ({ ...t, [key]: value }));
  };

  const setNote = (value: string) => {
    const trimmed = value.slice(0, NOTE_MAX);
    if (template === 'route') setRouteNote(trimmed); else setStatsNote(trimmed);
  };

  // ── Sticky compact preview driven by scroll ──
  const scrollY = useSharedValue(0);
  const wasActive = useSharedValue(false);
  const [compactActive, setCompactActive] = useState(false);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
    // Flip the JS-side flag only on threshold crossings so the invisible bar
    // never sits on top of the preview swallowing taps.
    const active = e.contentOffset.y > PREVIEW_H * 0.7;
    if (active !== wasActive.value) {
      wasActive.value = active;
      runOnJS(setCompactActive)(active);
    }
  });
  const compactStyle = useAnimatedStyle(() => {
    const t = interpolate(scrollY.value, [PREVIEW_H * 0.5, PREVIEW_H * 0.8], [0, 1], Extrapolation.CLAMP);
    return { opacity: t, transform: [{ translateY: (1 - t) * -12 }] };
  });

  const handlePickBackground = async () => {
    try {
      Haptics.selectionAsync();
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setError('Photo access denied. Enable it in Settings to add a background.'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.9 });
      if (!res.canceled && res.assets[0]?.uri) { setBackgroundUri(res.assets[0].uri); setError(null); }
    } catch (reason) {
      console.error('[Share background]', reason);
      setError('Could not load that photo. Try another.');
    }
  };

  const openTitleEditor = () => {
    Haptics.selectionAsync();
    setDraftTitle(note);
    setEditingTitle(true);
  };
  const saveTitle = () => { setNote(draftTitle); setEditingTitle(false); Keyboard.dismiss(); };
  const cancelTitle = () => { setEditingTitle(false); Keyboard.dismiss(); };

  const resetAll = () => {
    setTemplate('route');
    setBackgroundUri(null);
    setRouteNote(DEFAULT_NOTE.route);
    setStatsNote(DEFAULT_NOTE.stats);
    setToggles(DEFAULT_TOGGLES);
    setEditingTitle(false);
    setShowResetModal(false);
    flashToast('Reset to defaults');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Route/Stats capture the full flattened artwork; Timeline captures ONLY the
  // graph on a transparent background so it floats over the Story image.
  const captureShareImage = async () => {
    const ref = template === 'timeline' ? timelineStickerRef : storyRef;
    const uri = await ref.current?.capture?.();
    if (!uri) throw new Error('Could not create the share image.');
    return uri;
  };

  const share = async () => {
    setBusy('share'); setError(null);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (!await Sharing.isAvailableAsync()) throw new Error('The native share sheet is not available on this device.');
      const uri = await captureShareImage();
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your Nyurix story', UTI: 'public.png' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      flashToast('Ready to post');
    } catch (reason) {
      console.error('[Share story] Universal share failed:', reason);
      setError(reason instanceof Error ? reason.message : 'Could not share this image.');
    } finally {
      setBusy(null);
    }
  };

  const instagram = async () => {
    setBusy('instagram'); setError(null);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (Platform.OS === 'android') {
        const { isInstalled } = await Share.isPackageInstalled('com.instagram.android');
        if (!isInstalled) { setError('Instagram isn’t installed on this device. Use the Share button instead.'); return; }
      }
      const stickerImage = await captureShareImage();
      if (template === 'timeline') {
        // Graph-only transparent sticker floating over the user's photo (or our
        // gradient if they didn't pick one). This is the "graph over an image" look.
        await Share.shareSingle({
          social: Social.InstagramStories,
          stickerImage,
          ...(backgroundUri
            ? { backgroundImage: backgroundUri }
            : { backgroundTopColor: CREAM, backgroundBottomColor: PRIMARY }),
          appId: META_APP_ID,
        });
      } else {
        // ONE fully-flattened image (photo + route + title + calories + streak)
        // as the only sticker; IG draws our gradient behind it.
        await Share.shareSingle({
          social: Social.InstagramStories,
          stickerImage,
          backgroundTopColor: CREAM,
          backgroundBottomColor: PRIMARY,
          appId: META_APP_ID,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      flashToast('Ready to post');
    } catch (reason) {
      console.error('[InstagramShare]', reason);
      const message = reason instanceof Error ? reason.message : '';
      if (/cancel/i.test(message)) return;
      setError('Couldn’t open Instagram. Try the Share button instead.');
    } finally {
      setBusy(null);
    }
  };

  const scrollToTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });

  return (
    <View style={s.screen}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={s.header}>
          <Pressable accessibilityLabel="Back" style={s.iconBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={PRIMARY} />
          </Pressable>
          <Text style={s.title}>Share</Text>
          <View style={s.iconBtn} />
        </View>

        {/* Sticky compact preview (fades in once the full preview scrolls away) */}
        <Animated.View style={[s.compact, compactStyle]} pointerEvents={compactActive ? 'box-none' : 'none'}>
          <Pressable style={s.compactInner} onPress={scrollToTop}>
            <View style={s.compactThumb}>
              {template === 'timeline'
                ? <TimelinePreview data={data} width={38} height={38 * STORY_H / STORY_W} backgroundUri={backgroundUri} showNodes={toggles.showFoodNodes} />
                : <Artwork template={template} data={data} width={38} height={38 * STORY_H / STORY_W} note={note} backgroundUri={backgroundUri} toggles={toggles} />}
            </View>
            <Text style={s.compactLabel}>{TEMPLATE_LABEL[template]}</Text>
            <Ionicons name="chevron-up" size={16} color={MUTED} />
          </Pressable>
        </Animated.View>

        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={20}>
          <Animated.ScrollView
            ref={scrollRef}
            style={s.flex}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            {/* Live preview */}
            <View style={s.preview}>
              {template === 'timeline'
                ? <TimelinePreview data={data} width={PREVIEW_W} height={PREVIEW_H} backgroundUri={backgroundUri} showNodes={toggles.showFoodNodes} />
                : <Artwork template={template} data={data} width={PREVIEW_W} height={PREVIEW_H} note={note} backgroundUri={backgroundUri} toggles={toggles} />}
            </View>

            {/* Template toggle */}
            <View style={s.tabs}>
              {(['route', 'stats', 'timeline'] as const).map((value) => (
                <Pressable key={value} style={[s.tab, template === value && s.tabActive]} onPress={() => { Haptics.selectionAsync(); setTemplate(value); setError(null); setEditingTitle(false); }}>
                  <Text style={[s.tabText, template === value && s.tabTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{TEMPLATE_LABEL[value]}</Text>
                </Pressable>
              ))}
            </View>

            {/* ── Editor controls ── */}
            <EditorRow icon="image-outline" iconBg="#e9f1ff" iconColor={BLUE} label="Background photo" subtitle={backgroundUri ? 'Tap to replace or remove' : undefined}>
              {backgroundUri ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Image source={{ uri: backgroundUri }} style={s.bgThumb} />
                  <Pressable onPress={handlePickBackground} hitSlop={8}><Text style={[s.linkBtn, { color: BLUE }]}>Replace</Text></Pressable>
                  <Pressable onPress={() => { Haptics.selectionAsync(); setBackgroundUri(null); }} hitSlop={8}><Text style={[s.linkBtn, { color: '#C0392B' }]}>Remove</Text></Pressable>
                </View>
              ) : (
                <Pressable style={s.pillBtn} onPress={handlePickBackground}><Text style={[s.pillBtnText, { color: BLUE }]}>Add photo</Text></Pressable>
              )}
            </EditorRow>

            {/* Food-item nodes on the graph — applies to all three templates. */}
            <ToggleRow icon="fast-food-outline" iconBg="#fdeaf2" iconColor={Colors.routePink} label="Show food photos on graph" subtitle="The meal thumbnails on the curve" value={toggles.showFoodNodes} onChange={(v) => setToggle('showFoodNodes', v)} />

            {/* Timeline = graph only; the background photo is the only relevant control. */}
            {template === 'timeline' && (
              <View style={s.timelineNote}>
                <Ionicons name="sparkles-outline" size={16} color={BLUE} />
                <Text style={s.timelineNoteText}>Only the route graph is shared, as a transparent sticker. Add a background photo above to preview it over your image — or drop it over any Story in Instagram.</Text>
              </View>
            )}

            {/* Title + element toggles apply to Route Hero and Stats Card only. */}
            {template !== 'timeline' && (
              <>
            {/* Title text with inline editor */}
            <View style={s.rowCard}>
              <EditorRow icon="text-outline" iconBg="#f0ece6" iconColor={PRIMARY} label="Title" subtitle={note || 'Add a title…'}>
                {!editingTitle && (
                  <Pressable onPress={openTitleEditor} hitSlop={8}><Text style={[s.linkBtn, { color: BLUE }]}>Edit</Text></Pressable>
                )}
              </EditorRow>
              {editingTitle && (
                <View style={s.titleEditor}>
                  <TextInput
                    style={s.titleInput}
                    value={draftTitle}
                    onChangeText={(v) => setDraftTitle(v.slice(0, NOTE_MAX))}
                    placeholder="Add a title..."
                    placeholderTextColor={MUTED}
                    maxLength={NOTE_MAX}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={saveTitle}
                  />
                  <Text style={s.charCount}>{draftTitle.length}/{NOTE_MAX}</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <Pressable style={[s.smallBtn, { backgroundColor: '#efe9e0' }]} onPress={cancelTitle}><Text style={[s.smallBtnText, { color: PRIMARY }]}>Cancel</Text></Pressable>
                    <Pressable style={[s.smallBtn, { backgroundColor: GREEN }]} onPress={saveTitle}><Text style={[s.smallBtnText, { color: '#FFF' }]}>Save</Text></Pressable>
                  </View>
                </View>
              )}
            </View>

            <ToggleRow icon="text" label="Show title on card" value={toggles.showTitle} onChange={(v) => setToggle('showTitle', v)} />
            <ToggleRow icon="flame" iconBg="#fef2ec" iconColor="#E8703A" label="Show streak badge" subtitle={`Currently ${data.streak} day${data.streak === 1 ? '' : 's'}`} value={toggles.showStreak} onChange={(v) => setToggle('showStreak', v)} />
            <ToggleRow icon="analytics" iconBg="#fdeaf2" iconColor={Colors.routePink} label="Show Route timeline" subtitle="The pink curve and meal photos" value={toggles.showTimeline} onChange={(v) => setToggle('showTimeline', v)} />
            <ToggleRow icon="bonfire" iconBg="#fef2ec" iconColor="#E8703A" label="Show calorie total" subtitle={`${Math.round(data.calories).toLocaleString()} calories logged`} value={toggles.showCalories} onChange={(v) => setToggle('showCalories', v)} />
            <ToggleRow icon="pricetag" iconBg="#eef6ee" iconColor={GREEN} label="Show Nyurix watermark" subtitle="Recommended so friends know where it's from" value={toggles.showWatermark} onChange={(v) => setToggle('showWatermark', v)} />
              </>
            )}

            {/* Reset */}
            <Pressable style={s.resetBtn} onPress={() => { Haptics.selectionAsync(); setShowResetModal(true); }}>
              <Ionicons name="refresh-outline" size={15} color={MUTED} />
              <Text style={s.resetText}>Reset to defaults</Text>
            </Pressable>

            {error ? (
              <View style={s.error}>
                <Ionicons name="alert-circle-outline" size={18} color="#8E2D3E" />
                <Text style={s.errorText}>{error}</Text>
                <Pressable onPress={() => setError(null)}><Ionicons name="close" size={17} color="#8E2D3E" /></Pressable>
              </View>
            ) : null}
          </Animated.ScrollView>
        </KeyboardAvoidingView>

        {/* Share buttons */}
        <View style={s.actions}>
          <Pressable accessibilityLabel="Share to Instagram Story" style={[s.igButton, busy && s.disabled]} disabled={!!busy} onPress={instagram}>
            {busy === 'instagram' ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="logo-instagram" size={20} color="#FFF" />}
            <Text style={s.igText}>{busy === 'instagram' ? 'Preparing…' : 'Instagram Story'}</Text>
          </Pressable>
          <Pressable accessibilityLabel="Share via…" style={[s.shareButton, busy && s.disabled]} disabled={!!busy} onPress={share}>
            {busy === 'share' ? <ActivityIndicator size="small" color={PRIMARY} /> : <Ionicons name="share-outline" size={20} color={PRIMARY} />}
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Success toast */}
      {toast ? (
        <View pointerEvents="none" style={s.toast}><Text style={s.toastText}>{toast}</Text></View>
      ) : null}

      {/* Reset confirmation */}
      <Modal transparent visible={showResetModal} animationType="fade" onRequestClose={() => setShowResetModal(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setShowResetModal(false)}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Reset all changes?</Text>
            <Text style={s.modalBody}>This clears your photo, title, and toggles back to the default template.</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Pressable style={[s.smallBtn, { flex: 1, backgroundColor: '#efe9e0' }]} onPress={() => setShowResetModal(false)}><Text style={[s.smallBtnText, { color: PRIMARY }]}>Cancel</Text></Pressable>
              <Pressable style={[s.smallBtn, { flex: 1, backgroundColor: '#C0392B' }]} onPress={resetAll}><Text style={[s.smallBtnText, { color: '#FFF' }]}>Reset</Text></Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Off-screen capture targets. storyRef = full flattened artwork (Route/
          Stats). timelineStickerRef = graph only on a transparent background. */}
      <View pointerEvents="none" style={s.captureStage}>
        <ViewShot ref={storyRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }} style={{ width: STORY_W, height: STORY_H }}>
          <Artwork template={template} data={data} width={STORY_W} height={STORY_H} note={note} backgroundUri={backgroundUri} toggles={toggles} />
        </ViewShot>
        <ViewShot ref={timelineStickerRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }} style={{ width: TIMELINE_STICKER_W, height: TIMELINE_STICKER_H, backgroundColor: 'transparent' }}>
          <RouteGraph data={data.route} width={TIMELINE_STICKER_W} height={TIMELINE_STICKER_H} dark labels={false} brand showNodes={toggles.showFoodNodes} />
        </ViewShot>
      </View>
    </View>
  );
}

/* ─── Toggle row (Switch on the right) ─── */
function ToggleRow({ icon, iconBg = '#f0ece6', iconColor = PRIMARY, label, subtitle, value, onChange }: {
  icon: keyof typeof Ionicons.glyphMap; iconBg?: string; iconColor?: string; label: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <EditorRow icon={icon} iconBg={iconBg} iconColor={iconColor} label={label} subtitle={subtitle}>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: GREEN, false: '#d9d2c7' }} thumbColor="#FFF" />
    </EditorRow>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CREAM },
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', color: PRIMARY, fontFamily: Typography.fonts.bodySemiBold, fontSize: 17 },

  compact: { position: 'absolute', top: 56, left: 0, right: 0, zIndex: 20, alignItems: 'center' },
  compactInner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderRadius: 999, paddingLeft: 6, paddingRight: 14, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  compactThumb: { width: 38, height: 38, borderRadius: 8, overflow: 'hidden', backgroundColor: '#000' },
  compactLabel: { color: PRIMARY, fontFamily: Typography.fonts.bodySemiBold, fontSize: 13 },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  preview: { alignSelf: 'center', width: PREVIEW_W, height: PREVIEW_H, overflow: 'hidden', borderRadius: 18, marginTop: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,.08)', backgroundColor: '#000' },

  tabs: { alignSelf: 'center', width: PREVIEW_W, flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: '#ece5da', marginVertical: 14 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 11 },
  tabActive: { backgroundColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabText: { color: MUTED, fontFamily: Typography.fonts.bodySemiBold, fontSize: 13 },
  tabTextActive: { color: PRIMARY },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10 },
  rowCard: { backgroundColor: '#FFF', borderRadius: 14, marginBottom: 10 },
  rowIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { color: PRIMARY, fontFamily: Typography.fonts.bodyMedium, fontSize: 14 },
  rowSub: { color: MUTED, fontFamily: Typography.fonts.body, fontSize: 12, marginTop: 2 },

  linkBtn: { fontFamily: Typography.fonts.bodySemiBold, fontSize: 13 },
  pillBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: BLUE },
  pillBtnText: { fontFamily: Typography.fonts.bodySemiBold, fontSize: 13 },
  bgThumb: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#eee' },
  timelineNote: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#eef4ff', borderRadius: 14, padding: 14 },
  timelineNoteText: { flex: 1, color: '#3a5a8a', fontFamily: Typography.fonts.bodyMedium, fontSize: 12, lineHeight: 18 },

  // rowCard shares the row padding for its first line
  titleEditor: { paddingHorizontal: 14, paddingBottom: 14 },
  titleInput: { backgroundColor: '#f6f2ec', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: PRIMARY, fontFamily: Typography.fonts.bodyMedium, fontSize: 15 },
  charCount: { color: MUTED, fontFamily: Typography.fonts.body, fontSize: 11, marginTop: 6, textAlign: 'right' },
  smallBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { fontFamily: Typography.fonts.bodySemiBold, fontSize: 13 },

  resetBtn: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, paddingVertical: 12, marginTop: 2 },
  resetText: { color: MUTED, fontFamily: Typography.fonts.bodyMedium, fontSize: 13 },

  error: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: 12, backgroundColor: '#F6DCE0', marginTop: 4 },
  errorText: { flex: 1, color: '#8E2D3E', fontFamily: Typography.fonts.bodyMedium, fontSize: 12 },

  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,.06)', backgroundColor: CREAM },
  igButton: { flex: 1, height: 54, borderRadius: 27, backgroundColor: '#B72A68', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  igText: { color: '#FFF', fontFamily: Typography.fonts.bodySemiBold, fontSize: 15 },
  shareButton: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#FFF', borderWidth: 1, borderColor: 'rgba(0,0,0,.1)', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: .5 },

  toast: { position: 'absolute', bottom: 90, alignSelf: 'center', left: 0, right: 0, alignItems: 'center' },
  toastText: { backgroundColor: PRIMARY, color: '#FFF', fontFamily: Typography.fonts.bodyMedium, fontSize: 13, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, overflow: 'hidden' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'center', paddingHorizontal: 32 },
  modalCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 22 },
  modalTitle: { color: PRIMARY, fontFamily: Typography.fonts.headingBold, fontSize: 18 },
  modalBody: { color: MUTED, fontFamily: Typography.fonts.body, fontSize: 13, marginTop: 8, lineHeight: 19 },

  captureStage: { position: 'absolute', left: -5000, top: 0 },
  canvas: { overflow: 'hidden' },
  glow: { position: 'absolute', backgroundColor: 'rgba(224,57,122,.06)' },

  eyebrow: { color: Colors.routePink, fontFamily: Typography.fonts.bodySemiBold },
  heroTitle: { color: '#FFF', fontFamily: Typography.fonts.headingBold },
  heroCalories: { color: '#FFF', fontFamily: Typography.fonts.headingBold },
  heroCaloriesLabel: { color: 'rgba(255,255,255,.55)', fontFamily: Typography.fonts.bodySemiBold, letterSpacing: 3 },
  streak: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,.15)' },
  streakText: { color: '#FFF', fontFamily: Typography.fonts.bodySemiBold },
  heroWordmark: { color: 'rgba(255,255,255,.58)', fontFamily: Typography.fonts.headingBold },

  statsWordmark: { color: '#6B615B', fontFamily: Typography.fonts.bodySemiBold },
  statsCard: { backgroundColor: '#FFF', overflow: 'hidden', shadowColor: '#30241F', shadowOffset: { width: 0, height: 18 }, shadowOpacity: .1, shadowRadius: 30, elevation: 6 },
  statsRouteLabel: { color: Colors.routePink, fontFamily: Typography.fonts.bodySemiBold },
  divider: { height: 1, backgroundColor: '#EDE7E1' },
  statsTotal: { color: '#2F241E', fontFamily: Typography.fonts.headingBold },
  statsTotalLabel: { color: '#81766F', fontFamily: Typography.fonts.bodySemiBold, letterSpacing: 3 },
  macroLabel: { color: '#625852', fontFamily: Typography.fonts.bodyMedium },
  macroValue: { color: '#2F241E', fontFamily: Typography.fonts.headingSemiBold },
  macroTrack: { overflow: 'hidden', backgroundColor: '#F1E8EC' },
  statsFooter: { color: '#776D66', fontFamily: Typography.fonts.bodyMedium },
});
