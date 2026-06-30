/**
 * Milestone share — captures a vertical card with the badge + reward copy
 * and hands it to the native share sheet (and Instagram Stories where
 * possible). Reached via the "Share" button on the milestone celebration.
 */

import { useMemo, useRef, useState } from 'react';
import { Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import Share, { Social } from 'react-native-share';
import ViewShot from 'react-native-view-shot';
import Svg, { Defs, LinearGradient, Polygon, Stop } from 'react-native-svg';
import { Typography } from '@/constants/theme';
import { MILESTONES, type Milestone } from '@/lib/streakMilestones';

const STORY_W = 1080;
const STORY_H = 1920;
const META_APP_ID = '1878768349457558';
const WINDOW = Dimensions.get('window');
const PREVIEW_W = Math.min(WINDOW.width - 40, 360);
const PREVIEW_H = PREVIEW_W * (STORY_H / STORY_W);

export default function MilestoneShareScreen() {
  const params = useLocalSearchParams<{ milestoneDays?: string }>();
  const days = Number(params.milestoneDays) || 0;
  const milestone = useMemo<Milestone | null>(
    () => MILESTONES.find((m) => m.days === days) ?? null,
    [days],
  );

  const storyRef = useRef<ViewShot>(null);
  const [busy, setBusy] = useState<'share' | 'instagram' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!milestone) {
    return (
      <SafeAreaView style={s.empty}>
        <Text style={s.emptyText}>Milestone not found.</Text>
        <Pressable style={s.outline} onPress={() => router.back()}>
          <Text style={s.outlineText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const capture = async () => {
    const uri = await storyRef.current?.capture?.();
    if (!uri) throw new Error('Could not create the share image.');
    return uri;
  };

  const onShare = async () => {
    setBusy('share');
    setError(null);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('The native share sheet is not available on this device.');
      }
      const uri = await capture();
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share your milestone',
        UTI: 'public.png',
      });
    } catch (reason) {
      console.error('[Milestone share]', reason);
      setError(reason instanceof Error ? reason.message : 'Could not share.');
    } finally {
      setBusy(null);
    }
  };

  const onInstagram = async () => {
    setBusy('instagram');
    setError(null);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (Platform.OS === 'android') {
        const { isInstalled } = await Share.isPackageInstalled('com.instagram.android');
        if (!isInstalled) {
          setError("Instagram isn't installed. Use the Share button instead.");
          return;
        }
      }
      const uri = await capture();
      await Share.shareSingle({
        social: Social.InstagramStories,
        stickerImage: uri,
        appId: META_APP_ID,
      });
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : '';
      if (/cancel/i.test(msg)) return;
      setError("Couldn't open Instagram. Try the Share button instead.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={s.screen}>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Pressable style={s.close} onPress={() => router.back()}>
            <Ionicons name="close" size={22} color="#FFF" />
          </Pressable>
          <View style={s.headerCopy}>
            <Text style={s.title}>Share your milestone</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <View style={[s.preview, { width: PREVIEW_W, height: PREVIEW_H }]}>
          <MilestoneArtwork milestone={milestone} width={PREVIEW_W} height={PREVIEW_H} />
        </View>

        {error && (
          <View style={s.error}>
            <Ionicons name="alert-circle-outline" size={18} color="#FFF" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <View style={s.actions}>
          <Pressable style={[s.shareButton, busy && s.disabled]} disabled={!!busy} onPress={onShare}>
            <Ionicons name="share-outline" size={20} color="#0B090D" />
            <Text style={s.shareText}>{busy === 'share' ? 'Opening…' : 'Share'}</Text>
          </Pressable>
          <Pressable style={[s.igButton, busy && s.disabled]} disabled={!!busy} onPress={onInstagram}>
            <Ionicons name="logo-instagram" size={20} color="#FFF" />
            <Text style={s.igText}>{busy === 'instagram' ? 'Opening…' : 'Story'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Off-screen render target for ViewShot at full Stories resolution. */}
      <View pointerEvents="none" style={s.captureStage}>
        <ViewShot
          ref={storyRef}
          options={{ format: 'png', quality: 1, result: 'tmpfile' }}
          style={{ width: STORY_W, height: STORY_H }}
        >
          <MilestoneArtwork milestone={milestone} width={STORY_W} height={STORY_H} />
        </ViewShot>
      </View>
    </View>
  );
}

function MilestoneArtwork({
  milestone,
  width,
  height,
}: {
  milestone: Milestone;
  width: number;
  height: number;
}) {
  const u = width / STORY_W;
  return (
    <View style={[s.canvas, { width, height }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={milestone.badgeColors[0]} stopOpacity="1" />
            <Stop offset="1" stopColor={milestone.badgeColors[1]} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Polygon points={`0,0 ${width},0 ${width},${height} 0,${height}`} fill="url(#bg)" />
      </Svg>

      <View style={[s.badgeWrap, { top: 540 * u, alignSelf: 'center' }]}>
        <HexBadgeXL emoji={milestone.emoji} days={milestone.days} size={240 * u} />
      </View>

      <View style={[s.centerCopy, { top: 920 * u }]}>
        <Text style={[s.name, { fontSize: 48 * u }]}>{milestone.name}</Text>
        <Text style={[s.subtitle, { fontSize: 18 * u, marginTop: 12 * u }]}>
          {milestone.days} days of NutriSnap
        </Text>
      </View>

      <View style={[s.bottom, { bottom: 220 * u, left: 80 * u, right: 80 * u }]}>
        <Text style={[s.reward, { fontSize: 22 * u }]}>"{milestone.rewardText}"</Text>
        <Text style={[s.wordmark, { fontSize: 22 * u, marginTop: 32 * u, letterSpacing: 4 * u }]}>
          NUTRISNAP
        </Text>
      </View>
    </View>
  );
}

function HexBadgeXL({ emoji, days, size }: { emoji: string; days: number; size: number }) {
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
        <Polygon points={polygon} fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.6)" strokeWidth={3} />
      </Svg>
      <Text style={{ fontSize: size * 0.42 }}>{emoji}</Text>
      <Text style={{ color: '#FFFFFF', fontSize: size * 0.08, marginTop: 6, letterSpacing: 1.5, fontFamily: Typography.fonts.bodySemiBold }}>
        DAY {days}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111014' },
  safe: { flex: 1, paddingHorizontal: 20 },
  header: { height: 70, flexDirection: 'row', alignItems: 'center' },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, alignItems: 'center' },
  title: { color: '#FFF', fontFamily: Typography.fonts.headingBold, fontSize: 18 },

  preview: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 18,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  canvas: { overflow: 'hidden' },
  badgeWrap: { position: 'absolute' },
  centerCopy: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  name: { color: '#FFF', fontFamily: Typography.fonts.serif, fontWeight: '500' },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontFamily: Typography.fonts.body },
  bottom: { position: 'absolute', alignItems: 'center' },
  reward: {
    color: '#FFF',
    fontFamily: Typography.fonts.serif,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 32,
  },
  wordmark: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: Typography.fonts.headingBold,
    textAlign: 'center',
  },

  actions: {
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'center',
    marginTop: 18,
    paddingBottom: 12,
    width: PREVIEW_W,
  },
  shareButton: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareText: { color: '#0B090D', fontFamily: Typography.fonts.bodySemiBold, fontSize: 15 },
  igButton: {
    height: 52,
    minWidth: 108,
    paddingHorizontal: 18,
    borderRadius: 26,
    backgroundColor: '#B72A68',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  igText: { color: '#FFF', fontFamily: Typography.fonts.bodySemiBold, fontSize: 14 },
  disabled: { opacity: 0.5 },

  error: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#8E2D3E',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: 'center',
    width: PREVIEW_W,
    marginTop: 10,
  },
  errorText: { flex: 1, color: '#FFF', fontSize: 12 },

  captureStage: { position: 'absolute', left: -5000, top: 0 },

  empty: { flex: 1, backgroundColor: '#111014', alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { color: '#FFF', fontSize: 14 },
  outline: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  outlineText: { color: '#FFF' },
});
