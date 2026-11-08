import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius } from '@/theme/tokens';

export type TaskStatus =
  | 'done'
  | 'completed'
  | 'in_progress'
  | 'paused'
  | 'pending'
  | 'postponed'
  | 'not_started'
  | 'draft'
  | 'submitted'
  | 'locked';

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
    case 'completed':
    case 'locked':
      return (
        <View
          style={[styles.base, containerStyle, styles.done, style]}
          accessibilityLabel={`Status: ${status}`}
        />
      );

    case 'submitted':
      return (
        <View
          style={[styles.base, containerStyle, styles.submitted, style]}
          accessibilityLabel="Status: Submitted"
        />
      );

    case 'in_progress':
    case 'paused':
    case 'draft':
      return (
        <View
          style={[styles.base, containerStyle, styles.inProgressContainer, style]}
          accessibilityLabel={`Status: ${status === 'draft' ? 'Draft' : 'In progress'}`}
        >
          <View style={styles.inProgressHalf} />
        </View>
      );

    case 'pending':
    case 'not_started':
      return (
        <View
          style={[styles.base, containerStyle, styles.pending, style]}
          accessibilityLabel={`Status: ${status === 'not_started' ? 'Not started' : 'Pending'}`}
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
  submitted: {
    backgroundColor: colors.signal,
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
