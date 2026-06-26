/**
 * AuthGateModal — in-brand sign-up/sign-in prompt that appears when a
 * guest user attempts any Supabase-write action (scan save, hydration
 * log, profile edit, etc.).
 *
 * After successful authentication the modal auto-closes and replays
 * the pending action so the user's work isn't lost.
 */

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/auth.store';
import { useUserStore } from '@/stores/user.store';
import { supabase } from '@/lib/supabase';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';

WebBrowser.maybeCompleteAuthSession();

export function AuthGateModal() {
  const showAuthGate = useAuthStore((s) => s.showAuthGate);
  const closeAuthGate = useAuthStore((s) => s.closeAuthGate);
  const executePendingAction = useAuthStore((s) => s.executePendingAction);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsSigningIn(true);
      setError(null);

      const redirectUri = AuthSession.makeRedirectUri();

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUri },
      });

      if (oauthError) throw oauthError;

      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

        if (result.type === 'success') {
          const { params, errorCode } = QueryParams.getQueryParams(result.url);
          if (errorCode) throw new Error(errorCode);

          const { access_token, refresh_token } = params;
          if (access_token && refresh_token) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (sessionError) throw sessionError;

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Migrate guest profile to real user
            await migrateGuestProfile();

            // Load the (possibly migrated) profile
            await useUserStore.getState().loadProfile();

            // Close the gate and replay the pending action
            closeAuthGate();
            // Small delay to let state settle before replaying
            setTimeout(() => {
              executePendingAction();
            }, 100);
          }
        }
      }
    } catch (err) {
      console.error('Auth gate sign-in error:', err);
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    closeAuthGate();
  };

  if (!showAuthGate) return null;

  return (
    <Modal
      visible={showAuthGate}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <Animated.View
          entering={FadeInDown.duration(350).springify().damping(20)}
          style={styles.card}
        >
          {/* Close button */}
          <Pressable style={styles.closeButton} onPress={handleDismiss}>
            <Ionicons name="close" size={20} color={Colors.muted} />
          </Pressable>

          {/* Logo */}
          <Animated.View entering={FadeIn.duration(400)} style={styles.logoWrap}>
            <View style={styles.logoCircle}>
              <Ionicons name="leaf" size={36} color="white" />
            </View>
          </Animated.View>

          {/* Copy */}
          <ThemedText variant="h2" align="center" style={styles.title}>
            Create your account
          </ThemedText>
          <ThemedText variant="body" color={Colors.muted} align="center" style={styles.subtitle}>
            Sign up to save your meals, track progress, and keep your data safe across devices.
          </ThemedText>

          {/* Error */}
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
              <ThemedText variant="label" color={Colors.error} style={styles.errorText}>
                {error}
              </ThemedText>
            </View>
          )}

          {/* Google sign-in button */}
          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              pressed && styles.buttonPressed,
              isSigningIn && { opacity: 0.7 },
            ]}
            onPress={handleSignIn}
            disabled={isSigningIn}
          >
            <Ionicons name="logo-google" size={22} color={Colors.brown} />
            <ThemedText variant="button" style={styles.buttonText}>
              {isSigningIn ? 'Connecting...' : 'Continue with Google'}
            </ThemedText>
          </Pressable>

          {/* Dismiss */}
          <Button
            title="Maybe later"
            variant="ghost"
            onPress={handleDismiss}
            style={styles.dismissButton}
            textStyle={{ color: Colors.muted }}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * Migrate the in-memory guest profile to the real Supabase user.
 * Re-keys the profile ID and upserts it to Supabase.
 */
async function migrateGuestProfile() {
  try {
    const userStore = useUserStore.getState();
    const { profile, isGuest } = userStore;
    if (!profile || !isGuest) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Build profile with the real user ID
    const migratedProfile = {
      ...profile,
      id: user.id,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('profiles')
      .upsert(migratedProfile, { onConflict: 'id' });

    if (error) {
      console.warn('Guest profile migration failed:', error.message);
      return;
    }

    // Update local state — no longer a guest
    userStore.loadProfile();
  } catch (err) {
    console.warn('Guest migration error:', err);
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(47, 36, 30, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    paddingTop: Spacing['3xl'],
    alignItems: 'center',
    gap: Spacing.md,
    // Soft shadow
    shadowColor: '#2F241E',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    marginBottom: Spacing.sm,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.olive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
  },
  subtitle: {
    maxWidth: 280,
    marginBottom: Spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorLight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    width: '100%',
  },
  errorText: {
    flex: 1,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    width: '100%',
    height: 52,
    borderRadius: BorderRadius.md,
    gap: Spacing.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: Colors.brown,
    fontSize: 16,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  dismissButton: {
    marginTop: Spacing.xs,
  },
});
