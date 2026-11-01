import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { Text } from './text';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
}) => {
  const isInteractive = !disabled && !loading;

  return (
    <Pressable
      onPress={isInteractive ? onPress : undefined}
      disabled={!isInteractive}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'quiet' && styles.quiet,
        pressed && isInteractive && variant === 'primary' && styles.primaryPressed,
        pressed && isInteractive && variant === 'secondary' && styles.secondaryPressed,
        pressed && isInteractive && variant === 'quiet' && styles.quietPressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.ink} />
      ) : (
        <Text style={[styles.label, variant === 'quiet' && styles.quietLabel]}>{label}</Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    height: spacing.buttonHeight,
    minHeight: spacing.touchTargetMin,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.unit * 4,
  },
  primary: {
    backgroundColor: colors.signal,
  },
  primaryPressed: {
    backgroundColor: colors.oxblood,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.rule,
  },
  secondaryPressed: {
    backgroundColor: colors.wash,
    borderColor: colors.oxblood,
  },
  quiet: {
    backgroundColor: 'transparent',
  },
  quietPressed: {
    backgroundColor: colors.wash,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontFamily: typography.families.textSemiBold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
    textAlign: 'center',
  },
  quietLabel: {
    color: colors.ash,
  },
});
