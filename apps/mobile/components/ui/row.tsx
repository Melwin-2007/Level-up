import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, spacing } from '@/theme/tokens';

export interface RowProps {
  children: React.ReactNode;
  onPress?: () => void;
  selected?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export const Row: React.FC<RowProps> = ({
  children,
  onPress,
  selected = false,
  style,
  accessibilityLabel,
}) => {
  const content = (
    <View style={[styles.row, selected && styles.selectedRow, style]}>
      {selected && <View style={styles.selectedBar} />}
      {children}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    minHeight: spacing.rowMinHeight,
    width: '100%',
  },
  row: {
    minHeight: spacing.rowMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.unit * 3,
    position: 'relative',
  },
  pressed: {
    backgroundColor: colors.wash,
  },
  selectedRow: {
    backgroundColor: colors.wash,
  },
  selectedBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.oxblood,
  },
});
