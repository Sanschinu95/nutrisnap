/**
 * Authentication screen - Google OAuth + Email/Password
 */

import { View, StyleSheet, Image, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ThemedText } from '@/components/ui/ThemedText';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/auth.store';
import { Spacing, Colors } from '@/constants/theme';

export default function AuthScreen() {
  const { theme } = useTheme();
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, isLoading, error } = useAuthStore();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleEmailAuth = async () => {
    if (!email || !password) return;
    
    if (isSignUp) {
      const result = await signUpWithEmail(email, password);
      if (result.success) {
        // Show message about email confirmation if needed
      }
    } else {
      await signInWithEmail(email, password);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Logo and branding */}
          <View style={styles.branding}>
            <View style={[styles.logoContainer, { backgroundColor: theme.primary }]}>
              <Ionicons name="leaf" size={48} color={theme.white} />
            </View>
            <ThemedText variant="h1" style={styles.appName}>
              NutriSnap
            </ThemedText>
            <ThemedText
              variant="body"
              color={theme.textMuted}
              align="center"
              style={styles.tagline}
            >
              Your transformation starts here
            </ThemedText>
          </View>

          {/* Auth options */}
          <View style={styles.authSection}>
            {!showEmailForm ? (
              <>
                {/* Google Sign In */}
                <Pressable
                  onPress={handleGoogleSignIn}
                  disabled={isLoading}
                  style={({ pressed }) => [
                    styles.googleButton,
                    { backgroundColor: theme.white },
                    pressed && styles.googleButtonPressed,
                  ]}
                >
                  <Image
                    source={{ uri: 'https://www.google.com/favicon.ico' }}
                    style={styles.googleIcon}
                  />
                  <ThemedText
                    variant="button"
                    color={Colors.brown}
                    style={styles.googleButtonText}
                  >
                    {isLoading ? 'Signing in...' : 'Continue with Google'}
                  </ThemedText>
                </Pressable>

                {/* Divider */}
                <View style={styles.divider}>
                  <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                  <ThemedText variant="label" color={theme.textMuted} style={styles.dividerText}>
                    or
                  </ThemedText>
                  <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                </View>

                {/* Email option */}
                <Pressable
                  onPress={() => setShowEmailForm(true)}
                  style={({ pressed }) => [
                    styles.emailButton,
                    { borderColor: theme.border },
                    pressed && styles.googleButtonPressed,
                  ]}
                >
                  <Ionicons name="mail-outline" size={20} color={theme.text} style={{ marginRight: Spacing.md }} />
                  <ThemedText variant="button" color={theme.text}>
                    Continue with Email
                  </ThemedText>
                </Pressable>
              </>
            ) : (
              <>
                {/* Email/Password Form */}
                <TextInput
                  placeholder="Email"
                  placeholderTextColor={theme.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[
                    styles.input,
                    { 
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    }
                  ]}
                />
                <TextInput
                  placeholder="Password"
                  placeholderTextColor={theme.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  style={[
                    styles.input,
                    { 
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    }
                  ]}
                />

                <Button
                  title={isLoading ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                  onPress={handleEmailAuth}
                  disabled={isLoading || !email || !password}
                  style={styles.submitButton}
                />

                <Pressable onPress={() => setIsSignUp(!isSignUp)}>
                  <ThemedText variant="label" color={theme.primary} align="center" style={styles.toggleText}>
                    {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                  </ThemedText>
                </Pressable>

                <Pressable onPress={() => setShowEmailForm(false)}>
                  <ThemedText variant="label" color={theme.textMuted} align="center" style={styles.backText}>
                    ← Back to options
                  </ThemedText>
                </Pressable>
              </>
            )}

            {error && (
              <ThemedText
                variant="label"
                color={theme.error}
                align="center"
                style={styles.errorText}
              >
                {error}
              </ThemedText>
            )}
          </View>

          {/* Legal text */}
          <View style={styles.legalSection}>
            <ThemedText
              variant="labelSmall"
              color={theme.textMuted}
              align="center"
            >
              By continuing you agree to our{' '}
              <ThemedText variant="labelSmall" color={theme.primary}>
                Terms
              </ThemedText>
              {' & '}
              <ThemedText variant="labelSmall" color={theme.primary}>
                Privacy Policy
              </ThemedText>
            </ThemedText>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
  },
  branding: {
    alignItems: 'center',
    marginBottom: Spacing['4xl'],
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  appName: {
    marginBottom: Spacing.sm,
  },
  tagline: {
    maxWidth: 250,
  },
  authSection: {
    marginBottom: Spacing['2xl'],
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.xl,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  googleButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: Spacing.md,
  },
  googleButtonText: {
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.xl,
    borderRadius: 16,
    borderWidth: 1,
  },
  input: {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    fontSize: 16,
    borderWidth: 1,
  },
  submitButton: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  toggleText: {
    marginBottom: Spacing.md,
  },
  backText: {
    marginTop: Spacing.sm,
  },
  errorText: {
    marginTop: Spacing.base,
  },
  legalSection: {
    position: 'absolute',
    bottom: Spacing['2xl'],
    left: Spacing.xl,
    right: Spacing.xl,
  },
});
