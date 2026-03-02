/**
 * Card component with theme support
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable, StyleProp } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { BorderRadius, Spacing, Shadows } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'hero' | 'flat';
  padding?: keyof typeof Spacing | number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Card({
  children,
  variant = 'default',
  padding = 'base',
  onPress,
  style,
}: CardProps) {
  const { theme, isDark } = useTheme();

  const getVariantStyles = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      backgroundColor: theme.card,
      borderRadius: variant === 'hero' ? BorderRadius.lg : BorderRadius.md,
    };

    if (!isDark && variant !== 'flat') {
      return {
        ...baseStyle,
        ...Shadows.card,
      };
    }

    if (variant === 'flat') {
      return {
        ...baseStyle,
        borderWidth: 1,
        borderColor: theme.border,
      };
    }

    return baseStyle;
  };

  const paddingValue = typeof padding === 'number' 
    ? padding 
    : Spacing[padding];

  const containerStyle: ViewStyle = {
    ...getVariantStyles(),
    padding: paddingValue,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          containerStyle,
          pressed && styles.pressed,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[containerStyle, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
