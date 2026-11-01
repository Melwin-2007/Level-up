import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, spacing } from '@/theme/tokens';
import { Text } from './text';

export interface ErrorBarProps {
  message: string;
  style?: ViewStyle;
}

export const ErrorBar: React.FC<ErrorBarProps> = ({ message, style }) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.bar} />
      <Text variant="small" color="ink" style={styles.text}>
        {message}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.unit * 3,
    paddingVertical: spacing.unit * 2,
    position: 'relative',
    backgroundColor: colors.wash,
  },
  bar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.flare,
  },
  text: {
    flex: 1,
  },
});
