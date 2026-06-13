/**
 * Authentication screen - Google OAuth flow via Supabase
 */

import { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/user.store';
import { useAuthStore } from '@/stores/auth.store';
import { Spacing, Colors, BorderRadius } from '@/constants/theme';

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const { theme } = useTheme();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsSigningIn(true);

      const redirectUri = AuthSession.makeRedirectUri();
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
        },
      });

      if (error) throw error;

      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        
        if (result.type === 'success') {
          // Parse hash/search params from the return URL
          const { params, errorCode } = QueryParams.getQueryParams(result.url);
          
          if (errorCode) throw new Error(errorCode);
          
          const { access_token, refresh_token } = params;
          if (access_token && refresh_token) {
            // Set session directly in Supabase
            const { error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            
            if (sessionError) throw sessionError;
            
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // We wait to load the profile so the layout guard routes properly.
            // The store listeners will naturally update and trigger the _layout guard.
            await useUserStore.getState().loadProfile();
          }
        }
      }
    } catch (error) {
      console.error('OAuth error:', error);
      Alert.alert('Authentication Failed', error instanceof Error ? error.message : 'An error occurred during sign in.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <Animated.View
          entering={FadeIn.duration(600)}
          style={styles.logoWrapper}
        >
          <View style={[styles.logoContainer, { backgroundColor: theme.primary }]}>
            <Ionicons name="leaf" size={64} color="white" />
          </View>
          <ThemedText variant="h1" align="center" style={styles.title}>
            NutriSnap
          </ThemedText>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(600).delay(200).springify().damping(20).stiffness(100)}
          style={styles.bottomSection}
        >
          <ThemedText variant="body" color={theme.textMuted} align="center" style={styles.tagline}>
            Your transformation starts here
          </ThemedText>

          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              pressed && styles.buttonPressed,
              isSigningIn && { opacity: 0.7 }
            ]}
            onPress={handleSignIn}
            disabled={isSigningIn}
          >
            <Ionicons name="logo-google" size={24} color={Colors.brown} />
            <ThemedText variant="button" style={styles.buttonText}>
              {isSigningIn ? 'Connecting...' : 'Continue with Google'}
            </ThemedText>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: 100,
    paddingBottom: Spacing['4xl'],
  },
  logoWrapper: {
    alignItems: 'center',
    marginTop: Spacing['4xl'],
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 40,
    letterSpacing: -1,
  },
  bottomSection: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.xl,
  },
  tagline: {
    marginBottom: Spacing.sm,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: 52,
    borderRadius: 16,
    gap: Spacing.base,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
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
});
