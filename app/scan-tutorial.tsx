/**
 * First-time scan tutorial. Four slides teaching good scanning habits.
 * Shown once per user; `has_seen_scan_tutorial` on the profile persists the
 * outcome so signing out and back in on the same device doesn't re-trigger.
 */

import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuthStore } from '@/stores/auth.store';
import { setScanTutorialSeenInSession, useUserStore } from '@/stores/user.store';
import { Typography } from '@/constants/theme';

const PRIMARY_GREEN = '#22C55E';
const CREAM = '#F7F4EE';
const DOT_INACTIVE = '#efe9e0';
const TEXT_PRIMARY = '#2F241E';
const TEXT_SECONDARY = '#5a4f45';
const TEXT_MUTED = '#8a7e74';

interface TutorialSlide {
  headline: string;
  subtitle: string;
  image: number;
  accessibilityLabel: string;
}

// TODO: swap the nt4 image on the "Scan the Ingredients" slide for a real
// packaged-food-with-label photo when one is available.
const TUTORIAL_SLIDES: TutorialSlide[] = [
  {
    headline: 'Include a Reference Object',
    subtitle: 'Adding common items helps size estimation.',
    image: require('../assets/scan/nt1.png'),
    accessibilityLabel:
      'Two food photos. Top: a tofu bowl with garlic bread and a drink glass beside it, marked with a green checkmark. Bottom: the same bowl alone, marked with a red X.',
  },
  {
    headline: 'One Meal Per Photo',
    subtitle: 'Take separate shots for each meal or snack.',
    image: require('../assets/scan/nt3.png'),
    accessibilityLabel:
      'Two food photos. Top: a single meal on its own plate, marked with a green checkmark. Bottom: multiple different meals grouped in one shot, marked with a red X.',
  },
  {
    headline: 'Scan the Ingredients',
    subtitle: 'For packaged food, snap the nutrition label so macros register accurately.',
    image: require('../assets/scan/nt4.png'),
    accessibilityLabel:
      'Reference photo used for the packaged-food ingredients tip.',
  },
  {
    headline: 'Capture the Full Volume',
    subtitle: 'Frame the whole meal so quantity is visible.',
    image: require('../assets/scan/nt2.png'),
    accessibilityLabel:
      'Two food photos. Top: a pasta bowl framed wide so the full portion is visible, marked with a green checkmark. Bottom: the same pasta cropped too tightly, marked with a red X.',
  },
];

export default function ScanTutorialScreen() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const markSeen = useUserStore((s) => s.markScanTutorialSeen);
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<TutorialSlide>>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === TUTORIAL_SLIDES.length - 1;

  const goToIndex = useCallback(
    (nextIdx: number) => {
      if (nextIdx < 0 || nextIdx > TUTORIAL_SLIDES.length - 1) return;
      Haptics.selectionAsync();
      listRef.current?.scrollToIndex({ index: nextIdx, animated: true });
    },
    [],
  );

  const finish = useCallback(async () => {
    Haptics.selectionAsync();
    // Session-level flag so the Scan tab's useFocusEffect skips a re-push
    // even if the Supabase write hasn't landed or userId is momentarily null.
    setScanTutorialSeenInSession();
    // Always update local Zustand state (works for guests too). Supabase
    // write inside is skipped when userId is null.
    markSeen(userId ?? '').catch((err) =>
      console.warn('markScanTutorialSeen threw:', err),
    );
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/camera' as any);
  }, [userId, markSeen]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIdx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (nextIdx !== index) {
      setIndex(nextIdx);
      Haptics.selectionAsync();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.dotsRow}>
          {TUTORIAL_SLIDES.map((_, i) => (
            <View
              key={i}
              accessibilityLabel={`Slide ${i + 1} of ${TUTORIAL_SLIDES.length}`}
              style={[
                styles.dot,
                i === index ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
        <Pressable
          style={styles.closeButton}
          onPress={finish}
          accessibilityLabel="Skip tutorial and start scanning"
          accessibilityRole="button"
          hitSlop={12}
        >
          <Ionicons name="close" size={22} color={TEXT_MUTED} />
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={TUTORIAL_SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index: i }) => (
          <View style={{ width }}>
            <SlideView slide={item} isCurrent={i === index} />
          </View>
        )}
      />

      <View style={styles.bottomBar}>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          onPress={() => (isLast ? finish() : goToIndex(index + 1))}
          accessibilityRole="button"
        >
          <ThemedText style={styles.primaryButtonText}>
            {isLast ? 'Start Scanning' : 'Next'}
          </ThemedText>
        </Pressable>
        {index > 0 && (
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={() => goToIndex(index - 1)}
            accessibilityRole="button"
          >
            <ThemedText style={styles.secondaryButtonText}>Back</ThemedText>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

/* ─── Slide body ──────────────────────────────────────────────── */

function SlideView({ slide, isCurrent }: { slide: TutorialSlide; isCurrent: boolean }) {
  const step = TUTORIAL_SLIDES.indexOf(slide) + 1;
  return (
    <View style={styles.slide}>
      <View style={styles.slideHeader}>
        <ThemedText style={styles.stepLabel}>Scan tip {step} of {TUTORIAL_SLIDES.length}</ThemedText>
        <ThemedText style={styles.headline}>{slide.headline}</ThemedText>
        <ThemedText style={styles.subtitle}>{slide.subtitle}</ThemedText>
      </View>

      <Animated.View
        entering={isCurrent ? FadeIn.duration(220) : undefined}
        style={styles.imageWrap}
        accessibilityLabel={slide.accessibilityLabel}
        accessible
      >
        <Image source={slide.image} style={styles.image} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CREAM },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  dotsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dot: {
    width: 36,
    borderRadius: 999,
  },
  dotActive: {
    height: 8,
    backgroundColor: PRIMARY_GREEN,
  },
  dotInactive: {
    height: 6,
    backgroundColor: DOT_INACTIVE,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  slide: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    justifyContent: 'flex-start',
  },
  slideHeader: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  stepLabel: { fontSize: 12, color: TEXT_MUTED },
  headline: {
    fontSize: 26,
    fontFamily: Typography.fonts.headingBold,
    color: TEXT_PRIMARY,
    textAlign: 'center',
    lineHeight: 32,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },

  imageWrap: {
    flex: 1,
    marginTop: 24,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fill the wrap and let resizeMode="contain" letterbox the actual image so
  // it's centered and never cropped. The source PNGs are ~1:1 with a stacked
  // good/bad pair inside.
  image: {
    flex: 1,
    width: '100%',
    borderRadius: 20,
  },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
  },
  primaryButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: PRIMARY_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: Typography.fonts.bodySemiBold,
  },
  secondaryButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#e8f5ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: PRIMARY_GREEN,
    fontSize: 16,
    fontFamily: Typography.fonts.bodySemiBold,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
});
