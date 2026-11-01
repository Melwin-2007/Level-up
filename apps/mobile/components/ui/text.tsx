import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { colors, typography, type ColorToken, type TextVariant } from '@/theme/tokens';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: ColorToken;
  tabularNums?: boolean;
  children: React.ReactNode;
}

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  color = 'ink',
  tabularNums = false,
  style,
  children,
  ...props
}) => {
  const variantStyle = typography.scale[variant];
  const colorValue = colors[color];

  const computedStyle: TextStyle = {
    fontSize: variantStyle.fontSize,
    lineHeight: variantStyle.lineHeight,
    fontFamily: variantStyle.fontFamily,
    color: colorValue,
    textAlign: 'left',
    ...(variantStyle && 'letterSpacing' in variantStyle
      ? { letterSpacing: variantStyle.letterSpacing }
      : {}),
    ...(tabularNums ? { fontVariant: ['tabular-nums'] } : {}),
  };

  return (
    <RNText style={[computedStyle, style]} maxFontSizeMultiplier={1.3} {...props}>
      {children}
    </RNText>
  );
};
