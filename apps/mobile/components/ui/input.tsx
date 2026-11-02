import React, { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export interface InputProps extends TextInputProps {
  style?: ViewStyle;
  hasError?: boolean;
}

export const Input: React.FC<InputProps> = ({
  style,
  hasError = false,
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <TextInput
      style={[styles.input, isFocused && styles.focused, hasError && styles.error, style]}
      placeholderTextColor={colors.ash}
      selectionColor={colors.flare}
      onFocus={(e) => {
        setIsFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        onBlur?.(e);
      }}
      maxFontSizeMultiplier={1.3}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    height: spacing.touchTargetMin,
    minHeight: spacing.touchTargetMin,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.input,
    paddingHorizontal: spacing.unit * 3,
    color: colors.ink,
    fontFamily: typography.families.text,
    fontSize: 16,
    lineHeight: 24,
    backgroundColor: 'transparent',
    textAlignVertical: 'center',
    outlineWidth: 0,
  },
  focused: {
    borderColor: colors.flare,
  },
  error: {
    borderColor: colors.flare,
  },
});
