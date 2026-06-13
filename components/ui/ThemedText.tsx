/**
 * ThemedText component with typography variants
 */

import React from 'react';
import { Text, TextStyle, StyleProp, type TextProps } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Typography } from '@/constants/theme';

type TextVariant = 
  | 'h1' 
  | 'h2' 
  | 'h3' 
  | 'body' 
  | 'bodyMedium' 
  | 'bodySemiBold' 
  | 'label' 
  | 'labelSmall'
  | 'button';

interface ThemedTextProps extends Omit<TextProps, 'style'> {
  variant?: TextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
}

export function ThemedText({
  variant = 'body',
  color,
  align,
  style,
  children,
  ...textProps
}: ThemedTextProps) {
  const { theme } = useTheme();

  const variantStyles: Record<TextVariant, TextStyle> = {
    h1: {
      fontFamily: Typography.fonts.headingBold,
      fontSize: Typography.sizes['3xl'],
      lineHeight: Typography.sizes['3xl'] * Typography.lineHeights.tight,
    },
    h2: {
      fontFamily: Typography.fonts.headingBold,
      fontSize: Typography.sizes['2xl'],
      lineHeight: Typography.sizes['2xl'] * Typography.lineHeights.tight,
    },
    h3: {
      fontFamily: Typography.fonts.headingSemiBold,
      fontSize: Typography.sizes.xl,
      lineHeight: Typography.sizes.xl * Typography.lineHeights.tight,
    },
    body: {
      fontFamily: Typography.fonts.body,
      fontSize: Typography.sizes.base,
      lineHeight: Typography.sizes.base * Typography.lineHeights.normal,
    },
    bodyMedium: {
      fontFamily: Typography.fonts.bodyMedium,
      fontSize: Typography.sizes.base,
      lineHeight: Typography.sizes.base * Typography.lineHeights.normal,
    },
    bodySemiBold: {
      fontFamily: Typography.fonts.bodySemiBold,
      fontSize: Typography.sizes.base,
      lineHeight: Typography.sizes.base * Typography.lineHeights.normal,
    },
    label: {
      fontFamily: Typography.fonts.bodyMedium,
      fontSize: Typography.sizes.sm,
      lineHeight: Typography.sizes.sm * Typography.lineHeights.normal,
    },
    labelSmall: {
      fontFamily: Typography.fonts.bodyMedium,
      fontSize: Typography.sizes.xs,
      lineHeight: Typography.sizes.xs * Typography.lineHeights.normal,
    },
    button: {
      fontFamily: Typography.fonts.bodySemiBold,
      fontSize: Typography.sizes.md,
      lineHeight: Typography.sizes.md * Typography.lineHeights.tight,
    },
  };

  return (
    <Text
      style={[
        variantStyles[variant],
        { color: color ?? theme.text },
        align ? { textAlign: align } : undefined,
        style,
      ]}
      {...textProps}
    >
      {children}
    </Text>
  );
}
