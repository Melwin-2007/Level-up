import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput } from 'react-native';
import type { TaskResponse, TaskAction } from '@mp/shared';
import { Button, Divider, Sheet, Text, StatusSquare } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';

export interface TaskActionSheetProps {
  task: TaskResponse | null;
  visible: boolean;
  onClose: () => void;
  onLogAction: (
    action: TaskAction,
    durationMinutes: number,
    note?: string,
    postponedToDate?: string
  ) => Promise<void>;
}

export const TaskActionSheet: React.FC<TaskActionSheetProps> = ({
  task,
  visible,
  onClose,
  onLogAction,
}) => {
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [mode, setMode] = useState<'default' | 'complete' | 'postpone'>('default');
  const [completionMinutes, setCompletionMinutes] = useState('30');
  const [note, setNote] = useState('');
  const [postponedDate, setPostponedDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible && task) {
      setMode('default');
      setNote('');
      setCompletionMinutes(String(task.estimatedMinutes || 30));

      // Tomorrow as default postpone date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setPostponedDate(tomorrow.toISOString().slice(0, 10));

      if (task.status === 'in_progress') {
        setIsTimerRunning(true);
      } else {
        setIsTimerRunning(false);
      }
    }
  }, [visible, task]);

  // Stopwatch interval
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  if (!task) return null;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleStartTimer = async () => {
    setIsTimerRunning(true);
    await onLogAction('start', 0);
  };

  const handlePauseTimer = async () => {
    setIsTimerRunning(false);
    const elapsedMinutes = Math.max(1, Math.round(timerSeconds / 60));
    await onLogAction('pause', elapsedMinutes);
    setTimerSeconds(0);
  };

  const handleConfirmComplete = async () => {
    setIsSubmitting(true);
    try {
      const minutes = parseInt(completionMinutes, 10) || 0;
      await onLogAction('complete', minutes, note.trim() || undefined);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmPostpone = async () => {
    setIsSubmitting(true);
    try {
      await onLogAction('postpone', 0, note.trim() || undefined, postponedDate);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Task Execution">
      <View style={styles.container}>
        <View style={styles.header}>
          <StatusSquare
            status={
              task.status === 'completed'
                ? 'completed'
                : task.status === 'in_progress'
                  ? 'in_progress'
                  : task.status === 'postponed'
                    ? 'postponed'
                    : 'pending'
            }
            size={18}
          />
          <View style={styles.headerText}>
            <Text variant="heading" color="ink">
              {task.title}
            </Text>
            <Text variant="small" color="ash">
              Estimated: {task.estimatedMinutes}m · Logged: {task.actualMinutes}m
            </Text>
          </View>
        </View>

        <Divider />

        {mode === 'default' ? (
          <View style={styles.mainActions}>
            <View style={styles.timerBox}>
              <Text variant="small" color="ash">
                Stopwatch Timer
              </Text>
              <Text variant="display" color="ink" tabularNums={true}>
                {formatTimer(timerSeconds)}
              </Text>
              <View style={styles.timerControls}>
                {!isTimerRunning ? (
                  <Button label="Start Timer" variant="primary" onPress={handleStartTimer} />
                ) : (
                  <Button label="Pause Timer" variant="secondary" onPress={handlePauseTimer} />
                )}
              </View>
            </View>

            <View style={styles.buttonRow}>
              <Button label="Complete Task" variant="primary" onPress={() => setMode('complete')} />
              <Button label="Postpone" variant="secondary" onPress={() => setMode('postpone')} />
            </View>
          </View>
        ) : mode === 'complete' ? (
          <View style={styles.formContainer}>
            <Text variant="heading" color="ink">
              Complete Task
            </Text>
            <View style={styles.inputGroup}>
              <Text variant="small" color="ash">
                Actual Duration (minutes)
              </Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={completionMinutes}
                onChangeText={setCompletionMinutes}
                placeholderTextColor={colors.ash}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text variant="small" color="ash">
                Completion Note (optional)
              </Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                multiline={true}
                value={note}
                onChangeText={setNote}
                placeholder="What did you accomplish?"
                placeholderTextColor={colors.ash}
              />
            </View>

            <View style={styles.formButtons}>
              <Button
                label="Confirm Completion"
                variant="primary"
                disabled={isSubmitting}
                onPress={handleConfirmComplete}
              />
              <Button label="Back" variant="quiet" onPress={() => setMode('default')} />
            </View>
          </View>
        ) : (
          <View style={styles.formContainer}>
            <Text variant="heading" color="ink">
              Postpone Task
            </Text>
            <View style={styles.inputGroup}>
              <Text variant="small" color="ash">
                New Scheduled Date (YYYY-MM-DD)
              </Text>
              <TextInput
                style={styles.textInput}
                value={postponedDate}
                onChangeText={setPostponedDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.ash}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text variant="small" color="ash">
                Reason / Note (optional)
              </Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                multiline={true}
                value={note}
                onChangeText={setNote}
                placeholder="Why is this postponed?"
                placeholderTextColor={colors.ash}
              />
            </View>

            <View style={styles.formButtons}>
              <Button
                label="Confirm Postpone"
                variant="primary"
                disabled={isSubmitting}
                onPress={handleConfirmPostpone}
              />
              <Button label="Back" variant="quiet" onPress={() => setMode('default')} />
            </View>
          </View>
        )}
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.unit * 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit * 3,
  },
  headerText: {
    flex: 1,
    gap: spacing.unit * 1,
  },
  mainActions: {
    gap: spacing.unit * 4,
  },
  timerBox: {
    backgroundColor: colors.wash,
    padding: spacing.unit * 4,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.rule,
    alignItems: 'center',
    gap: spacing.unit * 2,
  },
  timerControls: {
    width: '100%',
    marginTop: spacing.unit * 2,
  },
  buttonRow: {
    flexDirection: 'column',
    gap: spacing.unit * 2,
  },
  formContainer: {
    gap: spacing.unit * 3,
  },
  inputGroup: {
    gap: spacing.unit * 1,
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
    minHeight: 70,
    textAlignVertical: 'top',
  },
  formButtons: {
    gap: spacing.unit * 2,
    marginTop: spacing.unit * 2,
  },
});
