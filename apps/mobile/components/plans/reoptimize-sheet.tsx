import React, { useState } from 'react';
import { StyleSheet, View, TextInput } from 'react-native';
import { Button, Sheet, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';

export interface ReoptimizeSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  loading?: boolean;
}

export const ReoptimizeSheet: React.FC<ReoptimizeSheetProps> = ({
  visible,
  onClose,
  onSubmit,
  loading = false,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setError('Please provide at least 10 characters explaining the schedule shift.');
      return;
    }
    setError(null);
    try {
      await onSubmit(trimmed);
      setReason('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reoptimization failed';
      setError(msg);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Reoptimize Schedule">
      <View style={styles.container}>
        <Text variant="body" color="ash">
          Recalculate your schedule for remaining days based on slipped tasks and current capacity.
        </Text>

        <View style={styles.inputGroup}>
          <Text variant="small" color="ink">
            Reason for Adjustment
          </Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            multiline={true}
            value={reason}
            onChangeText={(text) => {
              setReason(text);
              if (error) setError(null);
            }}
            placeholder="e.g. Slipped behind on daily tasks due to urgent client work"
            placeholderTextColor={colors.ash}
          />
          {error && (
            <Text variant="micro" color="flare">
              {error}
            </Text>
          )}
        </View>

        <View style={styles.buttonRow}>
          <Button
            label="Generate Reoptimized Plan"
            variant="primary"
            loading={loading}
            disabled={loading || reason.trim().length < 10}
            onPress={handleSubmit}
          />
          <Button label="Cancel" variant="quiet" onPress={onClose} />
        </View>
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.unit * 4,
  },
  inputGroup: {
    gap: spacing.unit * 2,
  },
  textInput: {
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.input,
    paddingHorizontal: spacing.unit * 3,
    paddingVertical: spacing.unit * 2,
    color: colors.ink,
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttonRow: {
    gap: spacing.unit * 2,
    marginTop: spacing.unit * 2,
  },
});
