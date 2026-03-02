/**
 * Button component with primary, secondary, and ghost variants
 */

import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { ThemedText } from './ThemedText';
import { BorderRadius, Spacing, Shadows } from '@/constants/theme';
import * as Haptics from 'expo-haptics';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  haptic?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  textStyle,
  haptic = true,
}: ButtonProps) {
  const { theme, isDark } = useTheme();

  const handlePress = () => {
    if (!disabled && !loading) {
      if (haptic) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onPress();
    }
  };

  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    const baseContainer: ViewStyle = {
      borderRadius: BorderRadius.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    };

    switch (variant) {
      case 'primary':
        return {
          container: {
            ...baseContainer,
            backgroundColor: theme.accent,
            ...(isDark ? {} : Shadows.card),
          },
          text: { color: theme.white },
        };
      case 'secondary':
        return {
          container: {
            ...baseContainer,
            backgroundColor: theme.primary,
            ...(isDark ? {} : Shadows.card),
          },
          text: { color: theme.white },
        };
      case 'ghost':
        return {
          container: {
            ...baseContainer,
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: theme.border,
          },
          text: { color: theme.text },
        };
      case 'danger':
        return {
          container: {
            ...baseContainer,
            backgroundColor: theme.error,
          },
          text: { color: theme.white },
        };
      default:
        return {
          container: baseContainer,
          text: { color: theme.text },
        };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'small':
        return {
          container: {
            paddingVertical: Spacing.sm,
            paddingHorizontal: Spacing.base,
            minHeight: 36,
          },
          text: { fontSize: 13 },
        };
      case 'large':
        return {
          container: {
            paddingVertical: Spacing.base,
            paddingHorizontal: Spacing.xl,
            minHeight: 52,
          },
          text: { fontSize: 16 },
        };
      default:
        return {
          container: {
            paddingVertical: Spacing.md,
            paddingHorizontal: Spacing.lg,
            minHeight: 44,
          },
          text: { fontSize: 14 },
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        variantStyles.container,
        sizeStyles.container,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variantStyles.text.color}
          size="small"
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <>{icon}</>
          )}
          <ThemedText
            variant="button"
            color={variantStyles.text.color as string}
            style={[
              sizeStyles.text,
              icon && iconPosition === 'left' ? { marginLeft: Spacing.sm } : undefined,
              icon && iconPosition === 'right' ? { marginRight: Spacing.sm } : undefined,
              textStyle,
            ]}
          >
            {title}
          </ThemedText>
          {icon && iconPosition === 'right' && (
            <>{icon}</>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
});
