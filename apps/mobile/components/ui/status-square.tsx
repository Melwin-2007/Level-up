import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius } from '@/theme/tokens';

export type TaskStatus = 'done' | 'in_progress' | 'pending' | 'postponed';

export interface StatusSquareProps {
  status: TaskStatus;
  size?: number;
  style?: ViewStyle;
}

export const StatusSquare: React.FC<StatusSquareProps> = ({ status, size = 14, style }) => {
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: radius.cell,
  };

  switch (status) {
    case 'done':
      return (
        <View
          style={[styles.base, containerStyle, styles.done, style]}
          accessibilityLabel="Status: Done"
        />
      );

    case 'in_progress':
      return (
        <View
          style={[styles.base, containerStyle, styles.inProgressContainer, style]}
          accessibilityLabel="Status: In progress"
        >
          <View style={styles.inProgressHalf} />
        </View>
      );

    case 'pending':
      return (
        <View
          style={[styles.base, containerStyle, styles.pending, style]}
          accessibilityLabel="Status: Pending"
        />
      );

    case 'postponed':
      return (
        <View
          style={[styles.base, containerStyle, styles.postponedContainer, style]}
          accessibilityLabel="Status: Postponed"
        >
          <View style={styles.postponedDiagonal} />
        </View>
      );
  }
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  done: {
    backgroundColor: colors.flare,
  },
  inProgressContainer: {
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  inProgressHalf: {
    width: '100%',
    height: '50%',
    backgroundColor: colors.signal,
  },
  pending: {
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: 'transparent',
  },
  postponedContainer: {
    borderWidth: 1,
    borderColor: colors.ash,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postponedDiagonal: {
    position: 'absolute',
    width: '140%',
    height: 1,
    backgroundColor: colors.ash,
    transform: [{ rotate: '45deg' }],
  },
});
