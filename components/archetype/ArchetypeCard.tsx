/**
 * ArchetypeCard — Animated, premium archetype selection card
 * Features: spring scale on select, glow shadow, pulse animation, tagline + macro preview
 */

import React, { useEffect } from 'react';
import { StyleSheet, Pressable, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ui/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { ARCHETYPES, type ArchetypeKey } from '@/constants/archetypes';
import { ArchetypeColors, Spacing, BorderRadius, Shadows } from '@/constants/theme';

interface ArchetypeCardProps {
  archetypeKey: ArchetypeKey;
  isSelected: boolean;
  onSelect: (key: ArchetypeKey) => void;
  width: number;
}

const SPRING_CONFIG = {
  damping: 12,
  stiffness: 180,
  mass: 0.8,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ArchetypeCard({ archetypeKey, isSelected, onSelect, width }: ArchetypeCardProps) {
  const { theme } = useTheme();
  const archetype = ARCHETYPES[archetypeKey];
  const colors = ArchetypeColors[archetypeKey];

  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  // Handle selection animation
  useEffect(() => {
    if (isSelected) {
      // Scale up with spring
      scale.value = withSpring(1.05, SPRING_CONFIG);
      // Glow in
      glowOpacity.value = withTiming(1, { duration: 300 });
      // Subtle pulse after selection
      pulseScale.value = withDelay(
        300,
        withSequence(
          withTiming(1.02, { duration: 400 }),
          withTiming(1.0, { duration: 400 }),
          withTiming(1.01, { duration: 300 }),
          withTiming(1.0, { duration: 300 })
        )
      );
    } else {
      scale.value = withSpring(1, SPRING_CONFIG);
      glowOpacity.value = withTiming(0, { duration: 200 });
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [isSelected, scale, glowOpacity, pulseScale]);

  const animatedCardStyle = useAnimatedStyle(() => {
    const combinedScale = scale.value * pulseScale.value;
    return {
      transform: [{ scale: combinedScale }],
    };
  });

  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: interpolate(glowOpacity.value, [0, 1], [0, 0.6], Extrapolation.CLAMP),
    shadowRadius: interpolate(glowOpacity.value, [0, 1], [0, 16], Extrapolation.CLAMP),
    elevation: interpolate(glowOpacity.value, [0, 1], [0, 12], Extrapolation.CLAMP),
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(archetypeKey);
  };

  const proteinPct = Math.round(archetype.macros.protein * 100);
  const carbsPct = Math.round(archetype.macros.carbs * 100);
  const fatPct = Math.round(archetype.macros.fat * 100);

  return (
    <AnimatedPressable
      onPress={handlePress}
      style={[
        styles.container,
        {
          width,
          backgroundColor: isSelected ? colors.primary : theme.card,
          borderColor: isSelected ? colors.accent : theme.border,
        },
        animatedCardStyle,
        isSelected && animatedGlowStyle,
      ]}
    >
      {/* Icon circle */}
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: isSelected ? 'rgba(255,255,255,0.15)' : colors.primary + '20',
          },
        ]}
      >
        <ThemedText variant="h2">{archetype.emoji}</ThemedText>
      </View>

      {/* Name */}
      <ThemedText
        variant="bodyMedium"
        color={isSelected ? 'white' : theme.text}
        style={styles.name}
      >
        {archetype.name}
      </ThemedText>

      {/* Tagline / description */}
      <ThemedText
        variant="labelSmall"
        color={isSelected ? 'rgba(255,255,255,0.8)' : theme.textMuted}
        align="center"
        style={styles.tagline}
      >
        {archetype.description}
      </ThemedText>

      {/* Macro preview pills */}
      <View style={styles.macroRow}>
        <View style={[styles.macroPill, { backgroundColor: isSelected ? 'rgba(255,255,255,0.15)' : colors.primary + '15' }]}>
          <ThemedText
            variant="labelSmall"
            color={isSelected ? 'rgba(255,255,255,0.9)' : colors.accent}
          >
            P {proteinPct}%
          </ThemedText>
        </View>
        <View style={[styles.macroPill, { backgroundColor: isSelected ? 'rgba(255,255,255,0.15)' : colors.primary + '15' }]}>
          <ThemedText
            variant="labelSmall"
            color={isSelected ? 'rgba(255,255,255,0.9)' : colors.accent}
          >
            C {carbsPct}%
          </ThemedText>
        </View>
        <View style={[styles.macroPill, { backgroundColor: isSelected ? 'rgba(255,255,255,0.15)' : colors.primary + '15' }]}>
          <ThemedText
            variant="labelSmall"
            color={isSelected ? 'rgba(255,255,255,0.9)' : colors.accent}
          >
            F {fatPct}%
          </ThemedText>
        </View>
      </View>

      {/* Selected indicator */}
      {isSelected && (
        <View style={[styles.selectedDot, { backgroundColor: colors.accent }]} />
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  name: {
    marginBottom: 2,
  },
  tagline: {
    marginBottom: Spacing.sm,
    minHeight: 24,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: Spacing.xs,
  },
  macroPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  selectedDot: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
