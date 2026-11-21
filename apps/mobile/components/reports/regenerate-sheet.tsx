import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Sheet, Text, Button, Input, ErrorBar } from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';

export interface RegenerateSheetProps {
  visible: boolean;
  onClose: () => void;
  onRegenerate: (note: string) => Promise<void>;
  isSubmitting?: boolean;
}

export function RegenerateSheet({
  visible,
  onClose,
  onRegenerate,
  isSubmitting = false,
}: RegenerateSheetProps): React.ReactElement {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = note.trim();
    if (trimmed.length < 5) {
      setError('Please provide at least 5 characters explaining the regeneration.');
      return;
    }
    setError(null);
    try {
      await onRegenerate(trimmed);
      setNote('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regeneration failed');
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Regenerate Report">
      <View style={styles.content}>
        <Text variant="small" color="ash" style={styles.description}>
          Reports are immutable once generated. Generating a fresh report creates a new version with
          an audit note explaining why it was regenerated.
        </Text>

        {error ? <ErrorBar message={error} style={styles.errorBar} /> : null}

        <View style={styles.inputContainer}>
          <Text variant="small" style={styles.inputLabel}>
            Reason for regeneration
          </Text>
          <Input
            value={note}
            onChangeText={(text) => {
              setNote(text);
              if (error) setError(null);
            }}
            placeholder="e.g. Updated completed tasks after retrospective"
            accessibilityLabel="Reason for regeneration"
          />
        </View>

        <View style={styles.actions}>
          <Button
            label="Regenerate now"
            variant="primary"
            onPress={handleSubmit}
            loading={isSubmitting}
            accessibilityLabel="Confirm report regeneration"
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.unit * 5,
  },
  description: {
    marginBottom: spacing.unit * 4,
  },
  errorBar: {
    marginBottom: spacing.unit * 4,
  },
  inputContainer: {
    marginBottom: spacing.unit * 5,
  },
  inputLabel: {
    color: colors.ink,
    marginBottom: spacing.unit,
    fontFamily: 'PublicSans_600SemiBold',
  },
  actions: {
    marginTop: spacing.unit * 2,
  },
});
