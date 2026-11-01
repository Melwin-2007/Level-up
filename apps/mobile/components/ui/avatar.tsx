import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius, typography } from '@/theme/tokens';
import { Text } from './text';

export interface AvatarProps {
  name: string;
  size?: number;
  style?: ViewStyle;
}

export const Avatar: React.FC<AvatarProps> = ({ name, size = 36, style }) => {
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  const fontSize = Math.round(size * 0.44);

  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: radius.avatar }, style]}
      accessibilityLabel={`Avatar for ${name}`}
    >
      <Text style={[styles.initial, { fontSize, lineHeight: fontSize + 2 }]}>{initial}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.oxblood,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: typography.families.displayBold,
    color: colors.ink,
    textAlign: 'center',
  },
});
