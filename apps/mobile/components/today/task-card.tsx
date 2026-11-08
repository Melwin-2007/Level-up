import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import type { TaskResponse } from '@mp/shared';
import { StatusSquare, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';

export interface TaskCardProps {
  task: TaskResponse;
  onPress: (task: TaskResponse) => void;
  onQuickStart?: (task: TaskResponse) => void;
  onQuickPause?: (task: TaskResponse) => void;
  onQuickComplete?: (task: TaskResponse) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onPress,
  onQuickStart,
  onQuickPause,
  onQuickComplete,
}) => {
  const isPending = task.status === 'pending';
  const isInProgress = task.status === 'in_progress';
  const isCompleted = task.status === 'completed';
  const isPostponed = task.status === 'postponed';

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.card, isInProgress && styles.cardActive, isCompleted && styles.cardCompleted]}
      onPress={() => onPress(task)}
      accessibilityRole="button"
      accessibilityLabel={`Task: ${task.title}, Status: ${task.status}`}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
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
            size={16}
          />
          <Text
            variant="heading"
            color={isCompleted ? 'ash' : 'ink'}
            style={[styles.title, isCompleted && styles.titleCompleted]}
            numberOfLines={2}
          >
            {task.title}
          </Text>
        </View>

        <Text variant="micro" color={isCompleted ? 'ash' : 'flare'} tabularNums={true}>
          {formatDuration(task.estimatedMinutes)}
        </Text>
      </View>

      {task.description ? (
        <Text variant="small" color="ash" numberOfLines={2} style={styles.description}>
          {task.description}
        </Text>
      ) : null}

      <View style={styles.footerRow}>
        <Text variant="micro" color="ash" tabularNums={true}>
          {task.actualMinutes > 0
            ? `${formatDuration(task.actualMinutes)} spent`
            : isPostponed
              ? 'Postponed'
              : 'Not started'}
        </Text>

        <View style={styles.actions}>
          {isPending && onQuickStart ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onQuickStart(task)}
              accessibilityLabel="Start task"
            >
              <Text variant="micro" color="ink">
                Start
              </Text>
            </TouchableOpacity>
          ) : null}

          {isInProgress ? (
            <>
              {onQuickPause ? (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => onQuickPause(task)}
                  accessibilityLabel="Pause task"
                >
                  <Text variant="micro" color="ash">
                    Pause
                  </Text>
                </TouchableOpacity>
              ) : null}
              {onQuickComplete ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnComplete]}
                  onPress={() => onQuickComplete(task)}
                  accessibilityLabel="Complete task"
                >
                  <Text variant="micro" color="ink">
                    Done
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.wash,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: spacing.unit * 4,
    gap: spacing.unit * 2,
  },
  cardActive: {
    borderColor: colors.flare,
    backgroundColor: colors.wash,
  },
  cardCompleted: {
    opacity: 0.7,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.unit * 2,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit * 3,
    flex: 1,
  },
  title: {
    flex: 1,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
  },
  description: {
    paddingLeft: spacing.unit * 7,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.unit * 1,
    paddingLeft: spacing.unit * 7,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.unit * 2,
  },
  actionBtn: {
    paddingVertical: spacing.unit * 1,
    paddingHorizontal: spacing.unit * 3,
    borderRadius: radius.cell,
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  actionBtnComplete: {
    backgroundColor: colors.signal,
    borderColor: colors.signal,
  },
});
