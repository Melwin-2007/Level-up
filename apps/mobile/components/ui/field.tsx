import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, spacing } from '@/theme/tokens';
import { Text } from './text';

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export const Field: React.FC<FieldProps> = ({ label, hint, error, children, style }) => {
  return (
    <View style={[styles.container, style]}>
      <Text variant="small" color="ash" style={styles.label}>
        {label}
      </Text>
      <View style={styles.inputWrapper}>{children}</View>
      {error ? (
        <View style={styles.errorWrapper}>
          <View style={styles.errorBar} />
          <Text variant="small" color="ink" style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="small" color="ash" style={styles.hint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: spacing.unit * 2,
  },
  label: {
    marginBottom: spacing.unit * 1.5,
  },
  inputWrapper: {
    width: '100%',
  },
  hint: {
    marginTop: spacing.unit * 1.5,
  },
  errorWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.unit * 1.5,
    paddingLeft: spacing.unit * 2,
    position: 'relative',
  },
  errorBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.flare,
  },
  errorText: {
    flex: 1,
  },
});
