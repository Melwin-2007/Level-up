import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';

export interface PriorityMarksProps {
  priority: number; // 1 to 5
  style?: ViewStyle;
}

export const PriorityMarks: React.FC<PriorityMarksProps> = ({ priority, style }) => {
  const clampedPriority = Math.max(1, Math.min(5, Math.round(priority)));
  const marks = [1, 2, 3, 4, 5];

  return (
    <View style={[styles.container, style]} accessibilityLabel={`Priority ${clampedPriority} of 5`}>
      {marks.map((step) => {
        const isFilled = step <= clampedPriority;
        return (
          <View
            key={step}
            style={[styles.square, isFilled ? styles.filledSquare : styles.emptySquare]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit,
  },
  square: {
    width: 8,
    height: 8,
    borderRadius: radius.cell,
  },
  filledSquare: {
    backgroundColor: colors.ink,
  },
  emptySquare: {
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: 'transparent',
  },
});
