import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowRight, Plus, Minus, Calendar } from 'lucide-react-native';
import type { PlanDiff } from '@mp/shared';
import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';

export interface PlanDiffViewProps {
  diff: PlanDiff;
}

export const PlanDiffView: React.FC<PlanDiffViewProps> = ({ diff }) => {
  const hasMoved = diff.movedTasks.length > 0;
  const hasAdded = diff.addedTasks.length > 0;
  const hasRemoved = diff.removedTasks.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.summaryBox}>
        <Calendar size={18} color={colors.ash} />
        <Text variant="small" color="ink" style={styles.summaryText}>
          {diff.summary}
        </Text>
      </View>

      {hasMoved && (
        <View style={styles.section}>
          <Text variant="heading" color="ink">
            Rescheduled Tasks ({diff.movedTasks.length})
          </Text>
          <View style={styles.list}>
            {diff.movedTasks.map((task) => (
              <View key={task.taskId} style={styles.itemCard}>
                <Text variant="body" color="ink" style={styles.taskTitle}>
                  {task.title}
                </Text>
                <View style={styles.dateRow}>
                  <Text variant="micro" color="ash">
                    {task.fromDate ?? 'Unscheduled'}
                  </Text>
                  <ArrowRight size={12} color={colors.ash} />
                  <Text variant="micro" color="signal">
                    {task.toDate ?? 'Unscheduled'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {hasAdded && (
        <View style={styles.section}>
          <Text variant="heading" color="ink">
            Added Tasks ({diff.addedTasks.length})
          </Text>
          <View style={styles.list}>
            {diff.addedTasks.map((task, idx) => (
              <View key={`added-${idx}`} style={styles.itemCard}>
                <View style={styles.titleRow}>
                  <Plus size={14} color={colors.signal} />
                  <Text variant="body" color="ink" style={styles.taskTitle}>
                    {task.title}
                  </Text>
                </View>
                <Text variant="micro" color="ash">
                  {task.scheduledDate ?? 'Pending Date'} · {task.estimatedMinutes}m
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {hasRemoved && (
        <View style={styles.section}>
          <Text variant="heading" color="ink">
            Unscheduled / Dropped ({diff.removedTasks.length})
          </Text>
          <View style={styles.list}>
            {diff.removedTasks.map((task) => (
              <View key={task.taskId} style={styles.itemCard}>
                <View style={styles.titleRow}>
                  <Minus size={14} color={colors.flare} />
                  <Text variant="body" color="ash" style={styles.taskTitle}>
                    {task.title}
                  </Text>
                </View>
                <Text variant="micro" color="ash">
                  Was {task.originalDate ?? 'Unscheduled'} · {task.estimatedMinutes}m
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.unit * 4,
  },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit * 2,
    backgroundColor: colors.wash,
    padding: spacing.unit * 3,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  summaryText: {
    flex: 1,
  },
  section: {
    gap: spacing.unit * 2,
  },
  list: {
    gap: spacing.unit * 2,
  },
  itemCard: {
    backgroundColor: colors.wash,
    padding: spacing.unit * 3,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.rule,
    gap: spacing.unit * 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit * 2,
  },
  taskTitle: {
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit * 2,
    marginTop: spacing.unit * 1,
  },
});
