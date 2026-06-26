/**
 * Root layout for NutriSnap
 * Loads fonts, initializes auth, and guards routes
 */

import { useEffect, useState } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
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
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/auth.store';
import { useUserStore } from '@/stores/user.store';
import { AuthGateModal } from '@/components/ui/AuthGateModal';
import { useCoachStore } from '@/stores/coach.store';
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
      segment0 === 'coach';
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
      // Rehydrate the coach store (pinned insight + daily question budget)
      await useCoachStore.getState().loadPersistedState();
      // Try loading profile for current session
      const { session } = useAuthStore.getState();
      if (session?.user) {
        await loadProfile();
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

  useEffect(() => {
    if (fontsLoaded || fontError) {
      setAppIsReady(true);
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);



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
        <Stack.Screen name="onboarding/diet" />
        <Stack.Screen name="onboarding/transition" />
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
