/**
 * 404 Not Found screen
 */

import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ui/ThemedText';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import { Spacing } from '@/constants/theme';

export default function NotFoundScreen() {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Ionicons name="alert-circle-outline" size={64} color={theme.textMuted} />
      <ThemedText variant="h2" style={styles.title}>
        Page Not Found
      </ThemedText>
      <ThemedText variant="body" color={theme.textMuted} align="center">
        The page you're looking for doesn't exist.
      </ThemedText>
      <Button
        title="Go Home"
        onPress={() => router.replace('/')}
        variant="primary"
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  title: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  button: {
    marginTop: Spacing.xl,
    minWidth: 150,
  },
});
