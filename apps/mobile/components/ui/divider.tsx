import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors } from '@/theme/tokens';

export interface DividerProps {
  style?: ViewStyle;
}

export const Divider: React.FC<DividerProps> = ({ style }) => {
  return <View style={[styles.divider, style]} />;
};

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.rule,
    width: '100%',
  },
});
