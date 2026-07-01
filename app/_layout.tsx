/**
 * Root layout for NutriSnap
 * Loads fonts, initializes auth, and guards routes
 */

import { useEffect, useState } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, LogBox, View, StyleSheet } from 'react-native';

// Our onboarding wheel pickers deliberately nest a vertical FlatList inside a
// vertical ScrollView with `nestedScrollEnabled` on both. The framework's
// warning about this pattern is intended for accidental nesting, not the
// controlled setup we have, so suppress it in dev.
LogBox.ignoreLogs(['VirtualizedLists should never be nested']);
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import {
  useFonts,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/auth.store';
import { useUserStore } from '@/stores/user.store';
import { AuthGateModal } from '@/components/ui/AuthGateModal';
import { useCoachStore } from '@/stores/coach.store';
import { useActivityStore } from '@/stores/activity.store';
import { useTreatDayStore } from '@/stores/treatDay.store';
import { useStreakStore } from '@/stores/streak.store';
import { initializeNotifications, scheduleWaterReminders, scheduleMealReminder, scheduleCoachWeeklyReview } from '@/lib/notifications';

// Keep splash screen visible while we load resources
SplashScreen.preventAutoHideAsync();

function useProtectedRoute() {
  const segments = useSegments();
  const { session, isInitialized } = useAuthStore();
  const { profile, isGuest } = useUserStore();

  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';
    const inFutureYou = segments[0] === 'future-you';
    const inTabs = segments[0] === '(tabs)';
    // Valid in-app screens that authenticated users should reach.
    // Anything NOT in this list (or one of the other groups) is treated as the
    // welcome/landing route — which means the guard will redirect signed-in users
    // away from it. Add new top-level screens here when you create them.
    const segment0 = segments[0] as string | undefined;
    const inAppScreen =
      segment0 === 'share-story' ||
      segment0 === 'confirm' ||
      segment0 === 'legal' ||
      segment0 === 'coach' ||
      segment0 === 'scan-tutorial' ||
      segment0 === 'sleep-detail' ||
      segment0 === 'steps-detail' ||
      segment0 === 'streak-detail' ||
      segment0 === 'treat-day' ||
      segment0 === 'milestone-share';
    const isWelcome = !inAuthGroup && !inOnboarding && !inFutureYou && !inTabs && !inAppScreen;

    const hasCompletedOnboarding = profile?.onboarding_complete === true;
    const isAuthenticated = !!session;
    const isGuestWithProfile = isGuest && hasCompletedOnboarding;

    if (!isAuthenticated && !isGuestWithProfile) {
      // Not signed in and not a guest with profile
      // Allow: welcome screen, auth pages, and onboarding flow
      if (!inAuthGroup && !isWelcome && !inOnboarding) {
        router.replace('/');
      }
    } else if (isAuthenticated && !hasCompletedOnboarding) {
      // Signed in but no completed profile -> onboarding
      if (!inOnboarding && !inFutureYou && !isWelcome) {
        router.replace('/onboarding');
      }
    } else {
      // Authenticated + profile complete, OR guest with completed onboarding -> main app
      // Allow future-you as a transition screen
      if (inAuthGroup || inOnboarding || isWelcome) {
        router.replace('/(tabs)/home');
      }
    }
  }, [session, isInitialized, profile, isGuest, segments]);
}

export default function RootLayout() {
  const { theme } = useTheme();
  const [appIsReady, setAppIsReady] = useState(false);
  const initialize = useAuthStore((s) => s.initialize);
  const loadProfile = useUserStore((s) => s.loadProfile);

  const [fontsLoaded, fontError] = useFonts({
    // Preload @expo/vector-icons font glyph atlases via the same useFonts
    // hook. Without this, the lazy ExpoAsset.downloadAsync path hits a
    // malformed `?unstable_path=...` URL on Android dev builds and 50+ icons
    // fail to render — every Ionicon shows as a tofu box.
    ...Ionicons.font,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });

  useEffect(() => {
    async function prepare() {
      await initialize();
      // Rehydrate the coach store (pinned insights + daily question budget)
      const { session } = useAuthStore.getState();
      const currentUserId = session?.user?.id ?? null;
      await useCoachStore.getState().loadPersistedState(currentUserId);
      // Try loading profile for current session
      if (session?.user) {
        await loadProfile();
        // Kick off step/sleep tracking (lazy: pedometer module is optional).
        useActivityStore.getState().initialize(session.user.id);
        // Surface any unlocked/active treat day for the Home banner + overlay.
        useTreatDayStore.getState().loadTreatDayState(session.user.id);
        // Load streaks (also applies grace-day catch-up on stale streaks).
        useStreakStore.getState().loadStreak(session.user.id);
      }
      // Initialize notifications
      const granted = await initializeNotifications();
      if (granted) {
        // Schedule default reminders
        const { archetype } = useUserStore.getState();
        await scheduleWaterReminders();
        // Default meal reminder at 12:00 PM
        await scheduleMealReminder(12, 0, archetype);
        // Sunday 8 PM coach weekly review
        await scheduleCoachWeeklyReview();
      }
    }
    prepare();
  }, [initialize, loadProfile]);

  // Wait for BOTH fonts and auth-init before dismissing the splash. Otherwise
  // a signed-in user briefly sees the Welcome (Get Started / Log In) screen
  // for the ~1s that auth resolution takes on cold start.
  const isAuthInitialized = useAuthStore((s) => s.isInitialized);
  useEffect(() => {
    if ((fontsLoaded || fontError) && isAuthInitialized) {
      setAppIsReady(true);
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isAuthInitialized]);

  // Re-check the morning sleep prompt and refresh today's step total whenever
  // the user brings the app back to the foreground (covers "opened at 6am,
  // backgrounded, reopened at 8am" and similar).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      if (status !== 'active') return;
      const userId = useAuthStore.getState().user?.id ?? null;
      if (!userId) return;
      useActivityStore.getState().checkSleepPromptStatus(userId);
      useActivityStore.getState().refreshSteps();
      useTreatDayStore.getState().loadTreatDayState(userId);
    });
    return () => sub.remove();
  }, []);



  useProtectedRoute();

  if (!appIsReady) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]} />
    );
  }



  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/index" />

        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="onboarding/transition" />
        <Stack.Screen name="sleep-detail" />
        <Stack.Screen name="steps-detail" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="future-you"
          options={{
            animation: 'fade',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="confirm"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="share-story"
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="legal"
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="coach"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
      <AuthGateModal />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
  },

});
