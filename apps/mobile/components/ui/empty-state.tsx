import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { spacing } from '@/theme/tokens';
import { Button } from './button';
import { Text } from './text';

export interface EmptyStateProps {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  actionLabel,
  onAction,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {title ? (
        <Text variant="heading" color="ink" style={styles.title}>
          {title}
        </Text>
      ) : null}
      <Text variant="body" color="ash" style={styles.message}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.unit * 6,
    width: '100%',
    alignItems: 'flex-start',
  },
  title: {
    marginBottom: spacing.unit * 2,
  },
  message: {
    marginBottom: spacing.unit * 4,
    maxWidth: 400,
  },
  action: {
    alignSelf: 'flex-start',
  },
});
