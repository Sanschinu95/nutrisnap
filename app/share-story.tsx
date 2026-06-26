import React, { useMemo, useRef, useState } from 'react';
import { Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import Share, { Social } from 'react-native-share';
import ViewShot from 'react-native-view-shot';
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { Colors, Typography } from '@/constants/theme';

const STORY_W = 1080;
const STORY_H = 1920;
const STICKER_W = 756;
const ROUTE_STICKER_H = 650;
const STATS_STICKER_H = 930;
const META_APP_ID = '1878768349457558';
const WINDOW = Dimensions.get('window');
const PREVIEW_W = Math.min(WINDOW.width - 40, 360, Math.max(250, (WINDOW.height - 245) * STORY_W / STORY_H));
const PREVIEW_H = PREVIEW_W * STORY_H / STORY_W;

type Template = 'route' | 'stats';
type RouteDatum = { calories: number; timestamp?: string; thumbnailUrl?: string };
type ShareData = { calories: number; streak: number; protein: number; carbs: number; fat: number; route: RouteDatum[] };
type Params = Partial<Record<'calories' | 'streak' | 'protein' | 'carbs' | 'fat' | 'chartData', string>>;

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

function tangents(points: { x: number; y: number }[]) {
  if (points.length < 2) return new Array(points.length).fill(0) as number[];
  const delta = points.slice(0, -1).map((point, i) => (points[i + 1].y - point.y) / (points[i + 1].x - point.x || 1));
  const slope = [delta[0]];
  for (let i = 1; i < points.length - 1; i += 1) slope.push(delta[i - 1] * delta[i] <= 0 ? 0 : (delta[i - 1] + delta[i]) / 2);
  slope.push(delta[delta.length - 1]);
  delta.forEach((d, i) => {
    if (Math.abs(d) < 1e-12) { slope[i] = 0; slope[i + 1] = 0; return; }
    const a = slope[i] / d; const b = slope[i + 1] / d; const sum = a * a + b * b;
    if (sum > 9) { const scale = 3 / Math.sqrt(sum); slope[i] = scale * a * d; slope[i + 1] = scale * b * d; }
  });
  return slope;
}

function spline(points: { x: number; y: number }[]) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  const slope = tangents(points);
  return points.slice(0, -1).reduce((path, point, i) => {
    const next = points[i + 1]; const dx = (next.x - point.x) / 3;
    return `${path} C ${point.x + dx} ${point.y + slope[i] * dx}, ${next.x - dx} ${next.y - slope[i + 1] * dx}, ${next.x} ${next.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function minuteOfDay(value: string | undefined, index: number, count: number) {
  if (value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getHours() * 60 + date.getMinutes();
    const match = value.match(/^(\d{1,2}):(\d{2})/);
    if (match) return Number(match[1]) * 60 + Number(match[2]);
  }
  return count === 1 ? 720 : 420 + index / (count - 1) * 840;
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

function RouteGraph({ data, width, height, dark, labels = true, brand = false }: {
  data: RouteDatum[]; width: number; height: number; dark: boolean; labels?: boolean; brand?: boolean;
}) {
  const u = width / 920; const padX = 54 * u; const padTop = 62 * u; const padBottom = (labels ? 80 : 42) * u;
  const maxCal = Math.max(...data.map(item => item.calories), 1);
  const minutes = data.map((item, i) => minuteOfDay(item.timestamp, i, data.length));
  const min = Math.min(...minutes); const max = Math.max(...minutes);
  const points = data.map((item, i) => ({
    x: padX + (max === min ? .5 : (minutes[i] - min) / (max - min)) * (width - padX * 2),
    y: padTop + (1 - item.calories / maxCal) * (height - padTop - padBottom),
  }));
  const path = spline(points); const baseline = height - padBottom + 12 * u;
  const area = points.length > 1 ? `${path} L ${points.at(-1)!.x} ${baseline} L ${points[0].x} ${baseline} Z` : '';
  const gradientId = `route-${dark ? 'd' : 'l'}-${Math.round(width)}`;
  return <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    <Defs>
      <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={Colors.routePink} stopOpacity={dark ? .42 : .28} /><Stop offset="1" stopColor={Colors.routePink} stopOpacity="0" /></LinearGradient>
      {data.map((_, i) => <ClipPath id={`clip-${Math.round(width)}-${i}`} key={i}><Circle cx={points[i].x} cy={points[i].y} r={25 * u} /></ClipPath>)}
    </Defs>
    {area ? <Path d={area} fill={`url(#${gradientId})`} /> : null}
    {dark && path ? <Path d={path} stroke={Colors.routePink} strokeWidth={18 * u} opacity={.2} fill="none" strokeLinecap="round" /> : null}
    {path ? <Path d={path} stroke={Colors.routePink} strokeWidth={8 * u} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
    {points.map((point, i) => {
      const r = 25 * u; const image = data[i].thumbnailUrl;
      return <G key={i}>
        <Circle cx={point.x} cy={point.y} r={r + 7 * u} fill={dark ? '#151219' : '#FFF'} stroke={Colors.routePink} strokeWidth={5 * u} />
        {image ? <SvgImage href={image} x={point.x - r} y={point.y - r} width={r * 2} height={r * 2} clipPath={`url(#clip-${Math.round(width)}-${i})`} preserveAspectRatio="xMidYMid slice" /> : <Circle cx={point.x} cy={point.y} r={r} fill={dark ? '#31232C' : '#F7DCE7'} />}
        {!image ? <Circle cx={point.x} cy={point.y} r={7 * u} fill={Colors.routePink} /> : null}
      </G>;
    })}
    {labels ? points.map((point, i) => <SvgText key={i} x={point.x} y={height - 22 * u} fill={dark ? 'rgba(255,255,255,.58)' : '#786F68'} fontSize={22 * u} fontWeight="600" textAnchor="middle">{timeLabel(data[i].timestamp, i)}</SvgText>) : null}
    {brand ? <SvgText x={width - 30 * u} y={36 * u} fill={dark ? 'rgba(255,255,255,.72)' : '#5F5550'} fontSize={22 * u} fontWeight="800" textAnchor="end" letterSpacing={2 * u}>NUTRISNAP</SvgText> : null}
  </Svg>;
}

function RouteHero({ data, width, height }: { data: ShareData; width: number; height: number }) {
  const u = width / STORY_W;
  return <View style={[s.canvas, { width, height, backgroundColor: '#0B090D' }]}>
    <View style={[s.glow, { width: 760 * u, height: 760 * u, borderRadius: 380 * u, top: 480 * u, left: 160 * u }]} />
    <View style={{ position: 'absolute', top: 280 * u, left: 80 * u }}>
      <Text style={[s.eyebrow, { fontSize: 26 * u, letterSpacing: 6 * u }]}>TODAY'S NUTRITION ROUTE</Text>
      <Text style={[s.heroTitle, { fontSize: 70 * u, lineHeight: 78 * u, marginTop: 16 * u }]}>Every meal{`\n`}shaped the day.</Text>
    </View>
    <View style={{ position: 'absolute', top: 600 * u, left: 80 * u }}><RouteGraph data={data.route} width={920 * u} height={590 * u} dark /></View>
    <View style={{ position: 'absolute', top: 1260 * u, left: 80 * u, right: 80 * u, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <View><Text style={[s.heroCalories, { fontSize: 112 * u, lineHeight: 120 * u }]}>{Math.round(data.calories).toLocaleString()}</Text><Text style={[s.heroCaloriesLabel, { fontSize: 28 * u, marginTop: 8 * u }]}>CALORIES LOGGED</Text></View>
      <View style={[s.streak, { borderRadius: 40 * u, paddingHorizontal: 28 * u, paddingVertical: 18 * u, marginBottom: 12 * u }]}><Text style={{ fontSize: 31 * u }}>🔥</Text><Text style={[s.streakText, { fontSize: 27 * u, marginLeft: 10 * u }]}>{data.streak} day streak</Text></View>
    </View>
    <Text style={[s.heroWordmark, { bottom: 280 * u, right: 80 * u, fontSize: 28 * u, letterSpacing: 5 * u }]}>NUTRISNAP</Text>
  </View>;
}

function MacroBar({ label, value, max, u }: { label: string; value: number; max: number; u: number }) {
  const progress = Math.max(.06, Math.min(1, value / Math.max(max, 1)));
  return <View style={{ marginTop: 24 * u }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}><Text style={[s.macroLabel, { fontSize: 25 * u }]}>{label}</Text><Text style={[s.macroValue, { fontSize: 27 * u }]}>{Math.round(value)}g</Text></View>
    <View style={[s.macroTrack, { height: 14 * u, borderRadius: 7 * u, marginTop: 10 * u }]}><View style={{ width: `${progress * 100}%`, height: '100%', borderRadius: 7 * u, backgroundColor: Colors.routePink }} /></View>
  </View>;
}

function StatsContent({ data, width }: { data: ShareData; width: number }) {
  const u = width / 900; const maxMacro = Math.max(data.protein, data.carbs, data.fat, 1);
  return <View style={{ width, paddingHorizontal: 54 * u, paddingTop: 52 * u, paddingBottom: 58 * u }}>
    <View style={{ height: 500 * u }}><Text style={[s.statsRouteLabel, { fontSize: 23 * u, letterSpacing: 4 * u, marginLeft: 18 * u }]}>YOUR ROUTE</Text><RouteGraph data={data.route} width={792 * u} height={440 * u} dark={false} /></View>
    <View style={[s.divider, { marginHorizontal: 18 * u }]} />
    <View style={{ paddingHorizontal: 18 * u, paddingTop: 34 * u }}>
      <Text style={[s.statsTotal, { fontSize: 78 * u, lineHeight: 84 * u }]}>{Math.round(data.calories).toLocaleString()}</Text><Text style={[s.statsTotalLabel, { fontSize: 23 * u, marginTop: 4 * u }]}>CALORIES TODAY</Text>
      <View style={{ marginTop: 24 * u }}><MacroBar label="Protein" value={data.protein} max={maxMacro} u={u} /><MacroBar label="Carbs" value={data.carbs} max={maxMacro} u={u} /><MacroBar label="Fat" value={data.fat} max={maxMacro} u={u} /></View>
    </View>
  </View>;
}

function StatsCard({ data, width, height }: { data: ShareData; width: number; height: number }) {
  const u = width / STORY_W;
  return <View style={[s.canvas, { width, height, backgroundColor: '#F5F0E8' }]}>
    <View style={{ position: 'absolute', top: 275 * u, left: 90 * u, width: 900 * u }}><Text style={[s.statsWordmark, { fontSize: 27 * u, letterSpacing: 5 * u, marginBottom: 28 * u }]}>NUTRISNAP · DAILY SNAPSHOT</Text><View style={[s.statsCard, { width: 900 * u, borderRadius: 52 * u }]}><StatsContent data={data} width={900 * u} /></View></View>
    <Text style={[s.statsFooter, { bottom: 275 * u, left: 90 * u, fontSize: 24 * u }]}>A day of meals, mapped.</Text>
  </View>;
}

function Artwork({ template, data, width, height }: { template: Template; data: ShareData; width: number; height: number }) {
  return template === 'route' ? <RouteHero data={data} width={width} height={height} /> : <StatsCard data={data} width={width} height={height} />;
}

function Sticker({ template, data }: { template: Template; data: ShareData }) {
  if (template === 'stats') return <View style={{ width: STICKER_W, height: STATS_STICKER_H, backgroundColor: 'transparent', justifyContent: 'center' }}><View style={[s.statsCard, { width: STICKER_W, borderRadius: 40 }]}><StatsContent data={data} width={STICKER_W} /></View></View>;
  return <View style={{ width: STICKER_W, height: ROUTE_STICKER_H, backgroundColor: 'transparent', justifyContent: 'center' }}><RouteGraph data={data.route} width={STICKER_W} height={560} dark labels={false} brand /></View>;
}

export default function ShareStoryScreen() {
  const params = useLocalSearchParams() as Params;
  const [template, setTemplate] = useState<Template>('route');
  const [busy, setBusy] = useState<'share' | 'instagram' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const storyRef = useRef<ViewShot>(null); const stickerRef = useRef<ViewShot>(null);
  const data = useMemo<ShareData>(() => ({ calories: numeric(params.calories, 1842), streak: numeric(params.streak, 5), protein: numeric(params.protein, 87), carbs: numeric(params.carbs, 214), fat: numeric(params.fat, 63), route: parseRoute(params.chartData) }), [params]);
  const capture = async (ref: React.RefObject<ViewShot | null>) => { const uri = await ref.current?.capture?.(); if (!uri) throw new Error('Could not create the share image.'); return uri; };

  const share = async () => {
    setBusy('share'); setError(null);
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); if (!await Sharing.isAvailableAsync()) throw new Error('The native share sheet is not available on this device.'); const uri = await capture(storyRef); await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your NutriSnap story', UTI: 'public.png' }); }
    catch (reason) { console.error('[Share story] Universal share failed:', reason); setError(reason instanceof Error ? reason.message : 'Could not share this image.'); }
    finally { setBusy(null); }
  };
  const instagram = async () => {
    setBusy('instagram'); setError(null);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (Platform.OS === 'android') {
        const { isInstalled } = await Share.isPackageInstalled('com.instagram.android');
        if (!isInstalled) {
          setError('Instagram isn\u2019t installed on this device. Use the Share button instead.');
          return;
        }
      }
      const stickerImage = await capture(stickerRef);
      await Share.shareSingle({ social: Social.InstagramStories, stickerImage, appId: META_APP_ID });
    } catch (reason) {
      console.error('[InstagramShare]', reason);
      const message = reason instanceof Error ? reason.message : '';
      // User-cancelled shares are not errors — silently ignore
      if (/cancel/i.test(message)) return;
      // Show a helpful message; do NOT navigate away
      setError('Couldn\u2019t open Instagram. Try the Share button instead.');
    } finally {
      setBusy(null);
    }
  };
  const stickerHeight = template === 'route' ? ROUTE_STICKER_H : STATS_STICKER_H;
  return <View style={s.screen}>
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Pressable accessibilityLabel="Close" style={s.close} onPress={() => router.back()}><Ionicons name="close" size={25} color="#FFF" /></Pressable><View style={s.headerCopy}><Text style={s.title}>Share your day</Text><Text style={s.subtitle}>Choose how your route shows up.</Text></View><View style={{ width: 44 }} /></View>
      <View style={s.tabs}>{([['route', 'Route Hero'], ['stats', 'Stats Card']] as const).map(([value, label]) => <Pressable key={value} style={[s.tab, template === value && s.tabActive]} onPress={() => { Haptics.selectionAsync(); setTemplate(value); setError(null); }}><Text style={[s.tabText, template === value && s.tabTextActive]}>{label}</Text></Pressable>)}</View>
      <View style={s.preview}><Artwork template={template} data={data} width={PREVIEW_W} height={PREVIEW_H} /></View>
      {error ? <View style={s.error}><Ionicons name="alert-circle-outline" size={18} color="#FFF" /><Text style={s.errorText}>{error}</Text><Pressable onPress={() => setError(null)}><Ionicons name="close" size={17} color="rgba(255,255,255,.7)" /></Pressable></View> : null}
      <View style={s.actions}><Pressable style={[s.shareButton, busy && s.disabled]} disabled={!!busy} onPress={share}><Ionicons name="share-outline" size={21} color="#0B090D" /><Text style={s.shareText}>{busy === 'share' ? 'Opening…' : 'Share'}</Text></Pressable><Pressable accessibilityLabel="Share to Instagram Stories" style={[s.igButton, busy && s.disabled]} disabled={!!busy} onPress={instagram}><Ionicons name="logo-instagram" size={22} color="#FFF" /><Text style={s.igText}>{busy === 'instagram' ? 'Opening…' : 'Story'}</Text></Pressable></View>
    </SafeAreaView>
    <View pointerEvents="none" style={s.captureStage}><ViewShot ref={storyRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }} style={{ width: STORY_W, height: STORY_H }}><Artwork template={template} data={data} width={STORY_W} height={STORY_H} /></ViewShot><ViewShot ref={stickerRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }} style={{ width: STICKER_W, height: stickerHeight, backgroundColor: 'transparent' }}><Sticker template={template} data={data} /></ViewShot></View>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111014' }, safe: { flex: 1, paddingHorizontal: 20 }, header: { height: 70, flexDirection: 'row', alignItems: 'center' }, close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.1)' }, headerCopy: { flex: 1, alignItems: 'center' }, title: { color: '#FFF', fontFamily: Typography.fonts.headingBold, fontSize: 18 }, subtitle: { color: 'rgba(255,255,255,.55)', fontFamily: Typography.fonts.body, fontSize: 12, marginTop: 2 },
  tabs: { alignSelf: 'center', width: PREVIEW_W, flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.08)', marginVertical: 8 }, tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 }, tabActive: { backgroundColor: '#FFF' }, tabText: { color: 'rgba(255,255,255,.62)', fontFamily: Typography.fonts.bodySemiBold, fontSize: 13 }, tabTextActive: { color: '#151219' },
  preview: { alignSelf: 'center', width: PREVIEW_W, height: PREVIEW_H, overflow: 'hidden', borderRadius: 18, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,.12)' }, actions: { flexDirection: 'row', gap: 12, width: PREVIEW_W, alignSelf: 'center', marginTop: 14, paddingBottom: 12 }, shareButton: { flex: 1, height: 52, borderRadius: 26, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, shareText: { color: '#0B090D', fontFamily: Typography.fonts.bodySemiBold, fontSize: 15 }, igButton: { height: 52, minWidth: 108, paddingHorizontal: 18, borderRadius: 26, backgroundColor: '#B72A68', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, igText: { color: '#FFF', fontFamily: Typography.fonts.bodySemiBold, fontSize: 14 }, disabled: { opacity: .5 },
  error: { width: PREVIEW_W, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: 12, backgroundColor: '#8E2D3E', marginTop: 10 }, errorText: { flex: 1, color: '#FFF', fontFamily: Typography.fonts.bodyMedium, fontSize: 12 }, captureStage: { position: 'absolute', left: -5000, top: 0 }, canvas: { overflow: 'hidden' }, glow: { position: 'absolute', backgroundColor: 'rgba(224,57,122,.06)' },
  eyebrow: { color: Colors.routePink, fontFamily: Typography.fonts.bodySemiBold }, heroTitle: { color: '#FFF', fontFamily: Typography.fonts.headingBold }, heroCalories: { color: '#FFF', fontFamily: Typography.fonts.headingBold }, heroCaloriesLabel: { color: 'rgba(255,255,255,.55)', fontFamily: Typography.fonts.bodySemiBold, letterSpacing: 3 }, streak: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,.15)' }, streakText: { color: '#FFF', fontFamily: Typography.fonts.bodySemiBold }, heroWordmark: { position: 'absolute', color: 'rgba(255,255,255,.58)', fontFamily: Typography.fonts.headingBold },
  statsWordmark: { color: '#6B615B', fontFamily: Typography.fonts.bodySemiBold }, statsCard: { backgroundColor: '#FFF', overflow: 'hidden', shadowColor: '#30241F', shadowOffset: { width: 0, height: 18 }, shadowOpacity: .1, shadowRadius: 30, elevation: 6 }, statsRouteLabel: { color: Colors.routePink, fontFamily: Typography.fonts.bodySemiBold }, divider: { height: 1, backgroundColor: '#EDE7E1' }, statsTotal: { color: '#2F241E', fontFamily: Typography.fonts.headingBold }, statsTotalLabel: { color: '#81766F', fontFamily: Typography.fonts.bodySemiBold, letterSpacing: 3 }, macroLabel: { color: '#625852', fontFamily: Typography.fonts.bodyMedium }, macroValue: { color: '#2F241E', fontFamily: Typography.fonts.headingSemiBold }, macroTrack: { overflow: 'hidden', backgroundColor: '#F1E8EC' }, statsFooter: { position: 'absolute', color: '#776D66', fontFamily: Typography.fonts.bodyMedium },
});
