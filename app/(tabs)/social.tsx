/**
 * Social tab - Coming soon holding screen
 */

import { useState } from 'react';
import { View, StyleSheet, TextInput, Alert, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ui/ThemedText';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';

export default function SocialScreen() {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      setIsSubmitting(true);
      Keyboard.dismiss();

      // Mock: just accept the email locally
      console.log('[mock] Waitlist signup:', email.trim().toLowerCase());
      {
        setIsSubmitted(true);
        setEmail('');
      }
    } catch (error) {
      console.error('Waitlist signup error:', error);
      Alert.alert('Error', 'Failed to join waitlist. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        {/* Illustration */}
        <View style={[styles.illustration, { backgroundColor: theme.card }]}>
          <Ionicons name="people" size={64} color={theme.primary} />
          <View style={styles.illustrationAccent}>
            <Ionicons name="trophy" size={24} color={theme.accent} />
          </View>
        </View>

        {/* Title */}
        <ThemedText variant="h1" align="center" style={styles.title}>
          Coming Soon 🌿
        </ThemedText>

        {/* Description */}
        <ThemedText
          variant="body"
          color={theme.textMuted}
          align="center"
          style={styles.description}
        >
          Challenges, friends, and archetype leaderboards are on the way.
        </ThemedText>

        {/* Email capture */}
        {!isSubmitted ? (
          <View style={styles.signupContainer}>
            <ThemedText
              variant="bodyMedium"
              align="center"
              style={styles.signupLabel}
            >
              Get notified when we launch
            </ThemedText>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="Enter your email"
                placeholderTextColor={theme.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button
                title="Notify Me"
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={isSubmitting}
                variant="primary"
                style={styles.submitButton}
              />
            </View>
          </View>
        ) : (
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle" size={48} color={theme.primary} />
            <ThemedText
              variant="bodyMedium"
              align="center"
              style={styles.successText}
            >
              You're on the list! We'll notify you when Social launches.
            </ThemedText>
          </View>
        )}
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  illustration: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
    position: 'relative',
  },
  illustrationAccent: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    marginBottom: Spacing.base,
  },
  description: {
    maxWidth: 280,
    marginBottom: Spacing['3xl'],
  },
  signupContainer: {
    width: '100%',
    maxWidth: 400,
  },
  signupLabel: {
    marginBottom: Spacing.md,
  },
  inputRow: {
    flexDirection: 'column',
    gap: Spacing.md,
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.base,
    fontSize: 16,
    borderWidth: 1,
  },
  submitButton: {
    width: '100%',
  },
  successContainer: {
    alignItems: 'center',
    maxWidth: 280,
  },
  successText: {
    marginTop: Spacing.base,
  },
});
