import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadows, Typography } from '@/constants/theme';
import { ThemedText } from '@/components/ui/ThemedText';
import { useEffect, useRef, useCallback } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  interpolate,
  interpolateColor,
  Easing,
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { useUIStore } from '@/stores/ui.store';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

/* ─── Tab identity configuration ──────────────────────────────── */

interface TabConfig {
  name: string;
  title: string;
  iconActive: IoniconsName;
  iconInactive: IoniconsName;
  iconSize?: number;
  /** Full-saturation identity color */
  color: string;
  /** Darker shade for border sweep gradient */
  colorDark: string;
}

const TAB_CONFIG: TabConfig[] = [
  {
    name: 'home',
    title: 'Home',
    iconActive: 'home',
    iconInactive: 'home-outline',
    color: Colors.orange, // #E8703A — terracotta orange
    colorDark: '#B8562E',
  },
  {
    name: 'camera',
    title: 'Scan',
    iconActive: 'scan-circle',
    iconInactive: 'scan-circle-outline',
    iconSize: 26,
    color: '#22C55E', // bright green
    colorDark: '#16A34A',
  },
  {
    name: 'plan',
    title: 'Progress',
    iconActive: 'stats-chart',
    iconInactive: 'stats-chart-outline',
    color: Colors.routePink, // #E0397A — route pink (shared token)
    colorDark: '#A82B5C',
  },
];

/** Identity colors in index order — drives interpolateColor */
const IDENTITY_COLORS = TAB_CONFIG.map((t) => t.color);

/* ─── Timing constants ─────────────────────────────────────────── */

/** Expo-out style curve: fast start, long gentle settle */
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const BLOB_DURATION = 600; // ms — blob slide + color blend
const SWEEP_DURATION = 700; // ms — border gradient sweep
const CONTENT_DURATION = 260; // ms — screen crossfade/slide

/* ─── Custom scene interpolator: crossfade + subtle horizontal slide ─── */

function forFadeSlide({ current }: {
  current: { progress: import('react-native').Animated.Value };
}) {
  return {
    sceneStyle: {
      opacity: current.progress.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0, 1, 0],
      }),
      transform: [{
        translateX: current.progress.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [-20, 0, 20],
        }),
      }],
    },
  };
}

/* ─── Layout entry ─────────────────────────────────────────────── */

export default function TabLayout() {
  // Safety net: if hideTabBar somehow got stuck true (e.g. a full-screen modal
  // hid the bar then unmounted before clearing the flag), entering the tabs
  // layout should always show the bar.
  const resetTabBar = useUIStore((s) => s.setHideTabBar);
  useEffect(() => {
    resetTabBar(false);
  }, [resetTabBar]);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <AnimatedTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          // Tell the navigator the bar is absolutely positioned so it
          // doesn't reserve bottom space for content.
          tabBarStyle: { position: 'absolute' },
          // Screen content crossfade + slide transition
          animation: 'fade',
          sceneStyleInterpolator: forFadeSlide,
          transitionSpec: {
            animation: 'timing',
            config: { duration: CONTENT_DURATION },
          },
        }}
      >
        <Tabs.Screen name="home" options={{ title: 'Home' }} />
        <Tabs.Screen name="camera" options={{ title: 'Scan' }} />
        <Tabs.Screen name="plan" options={{ title: 'Progress' }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

/* ─── Animated floating tab bar ────────────────────────────────── */

function AnimatedTabBar({ state, navigation }: any) {
  const { width: screenWidth } = useWindowDimensions();
  const { hideTabBar } = useUIStore();

  const tabOpa = useSharedValue(1);
  const tabY = useSharedValue(0);

  useEffect(() => {
    tabOpa.value = withTiming(hideTabBar ? 0 : 1, { duration: 250 });
    tabY.value = withTiming(hideTabBar ? 100 : 0, { duration: 250 });
  }, [hideTabBar]);

  const barAnimStyle = useAnimatedStyle(() => ({
    opacity: tabOpa.value,
    transform: [{ translateY: tabY.value }],
  }));

  // ── Measurements ──
  const NAV_W = screenWidth - 144; // left 72 + right 72
  const NAV_H = 64;
  const BR = BorderRadius.full; // 32
  const TAB_W = NAV_W / TAB_CONFIG.length;
  const BLOB_W = TAB_W;
  const BLOB_H = NAV_H;
  const BLOB_R = BR;

  // ── Current visible tab (0-2) ──
  const activeRoute = state.routes[state.index];
  const vi = TAB_CONFIG.findIndex((t) => t.name === activeRoute?.name);
  const idx = vi >= 0 ? vi : 0;

  // ── Shared values ──
  const progress = useSharedValue(idx);
  const sweepProg = useSharedValue(0);
  const sweepOpa = useSharedValue(0);
  const isMount = useRef(true);

  // ── React to tab changes ──
  useEffect(() => {
    if (isMount.current) {
      isMount.current = false;
      progress.value = idx;
      return;
    }
    // Blob slide + color blend (single shared value drives both)
    progress.value = withTiming(idx, {
      duration: BLOB_DURATION,
      easing: EASE_OUT,
    });


    // Border sweep — concurrent with blob
    sweepProg.value = 0;
    sweepOpa.value = 1;
    sweepProg.value = withTiming(1, {
      duration: SWEEP_DURATION,
      easing: EASE_OUT,
    });
    sweepOpa.value = withTiming(0, {
      duration: SWEEP_DURATION + 100,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [idx]);

  // ── Navigation handler ──
  const onPress = useCallback(
    (i: number) => {
      const cfg = TAB_CONFIG[i];
      const route = state.routes.find((r: any) => r.name === cfg.name);
      if (!route) return;
      const focused = state.routes[state.index]?.key === route.key;
      const ev = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !ev.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    },
    [state, navigation],
  );

  // ── Blob animated style (position + color from same shared value) ──
  const blobAnimStyle = useAnimatedStyle(() => {
    const tx = interpolate(progress.value, [0, 1, 2], [
      0,
      TAB_W,
      TAB_W * 2,
    ]);
    const bg = interpolateColor(progress.value, [0, 1, 2], IDENTITY_COLORS);
    return { transform: [{ translateX: tx }], backgroundColor: bg };
  });

  // ── SVG border sweep calculations ──
  const STROKE_W = 2.5;
  const svgRx = BR - 1;
  const rectW = NAV_W - STROKE_W;
  const rectH = NAV_H - STROKE_W;
  const straight =
    2 * Math.max(rectW - 2 * svgRx, 0) + 2 * Math.max(rectH - 2 * svgRx, 0);
  const perimeter = straight + 2 * Math.PI * svgRx;
  const segLen = perimeter * 0.3;

  const sweepAnimProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(sweepProg.value, [0, 1], [perimeter, 0]),
  }));
  const sweepFadeStyle = useAnimatedStyle(() => ({
    opacity: sweepOpa.value,
  }));


  // ── FAB press handler ──
  const onFabPress = useCallback(() => {
    const scanTab = TAB_CONFIG.findIndex((t) => t.name === 'camera');
    if (scanTab >= 0) onPress(scanTab);
  }, [onPress]);

  const isHome = idx === 0;

  return (
    <Animated.View style={[styles.barWrap, barAnimStyle]} pointerEvents={hideTabBar ? 'none' : 'auto'}>
      {/* ── Quick-Scan FAB — visible only on Home ── */}
      {isHome && (
        <Animated.View
          entering={FadeIn.duration(300).springify().damping(14)}
          exiting={FadeOut.duration(200)}
          style={styles.fabContainer}
        >
          <Animated.View
            entering={ZoomIn.duration(400).springify().damping(12)}
          >
            <Pressable
              onPress={onFabPress}
              style={({ pressed }) => [
                styles.fab,
                pressed && styles.fabPressed,
              ]}
              accessibilityLabel="Quick scan food"
              accessibilityRole="button"
            >
              <Ionicons name="scan-circle" size={30} color="#FFFFFF" />
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── White pill with shadow ── */}
      <View style={[styles.pill, { borderRadius: BR }]}>
        {/* Animated blob — slides between tabs with color blend */}
        <Animated.View
          style={[
            styles.blob,
            {
              width: BLOB_W,
              height: BLOB_H,
              borderRadius: BLOB_R,
              top: 0,
            },
            blobAnimStyle,
          ]}
        />

        {/* Tab buttons */}
        <View style={styles.row}>
          {TAB_CONFIG.map((tab, i) => {
            const active = idx === i;
            return (
              <Pressable
                key={tab.name}
                onPress={() => onPress(i)}
                style={styles.btn}
              >
                <Ionicons
                  name={active ? tab.iconActive : tab.iconInactive}
                  size={tab.iconSize ?? 22}
                  color={active ? tab.color : Colors.muted}
                />
                <ThemedText
                  variant="labelSmall"
                  color={active ? tab.color : Colors.muted}
                  style={styles.label}
                >
                  {tab.title}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── SVG border sweep overlay ── */}
      <Animated.View
        pointerEvents="none"
        style={[styles.sweepLayer, sweepFadeStyle]}
      >
        <Svg width={NAV_W} height={NAV_H}>
          <AnimatedRect
            x={STROKE_W / 2}
            y={STROKE_W / 2}
            width={rectW}
            height={rectH}
            rx={svgRx}
            ry={svgRx}
            fill="none"
            stroke={TAB_CONFIG[idx].colorDark}
            strokeWidth={STROKE_W}
            strokeLinecap="round"
            strokeDasharray={`${segLen} ${perimeter - segLen}`}
            animatedProps={sweepAnimProps}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

/* ─── Styles ───────────────────────────────────────────────────── */

const FAB_SIZE = 56;

const styles = StyleSheet.create({
  barWrap: {
    position: 'absolute',
    left: 72,
    right: 72,
    bottom: 22,
    height: 64,
  },
  fabContainer: {
    position: 'absolute',
    top: -FAB_SIZE + 12, // overlap the nav bar by ~12px
    right: -48, // sit ~24px from screen edge (barWrap is inset 72px)
    zIndex: 10,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.fab,
    // Override shadow color to match green
    shadowColor: '#22C55E',
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.93 }],
  },
  pill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    // Shadow for depth
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  blob: {
    position: 'absolute',
    left: 0,
    opacity: 0.15,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontFamily: Typography.fonts.bodyMedium,
    letterSpacing: 0.3,
  },
  sweepLayer: {
    ...StyleSheet.absoluteFillObject,
  },
});
