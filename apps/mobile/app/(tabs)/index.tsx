import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Divider, EmptyState, MonthStrip, Row, Screen, Text, Title } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';
import { useGroups } from '@/hooks/use-groups';
import { useCurrentCycle } from '@/hooks/use-cycles';
import { useTasks, useLogTaskActionMutation } from '@/hooks/use-tasks';
import { useSessionStore } from '@/stores/session';
import { formatMonthName } from '@/services/dates';
import { getNextAction } from '@/services/cycle-actions';
import { TaskCard } from '@/components/today/task-card';
import { TaskActionSheet } from '@/components/today/task-action-sheet';
import type { GroupRole, TaskResponse, TaskAction } from '@mp/shared';

export default function TodayScreen(): React.ReactNode {
  const router = useRouter();
  const profile = useSessionStore((s) => s.profile);
  const user = useSessionStore((s) => s.user);
  const timezone = profile?.timezone || 'UTC';

  const [selectedTask, setSelectedTask] = useState<TaskResponse | null>(null);
  const [isSheetVisible, setIsSheetVisible] = useState(false);

  const { data: groupsData, isLoading: groupsLoading } = useGroups();
  const groups = groupsData?.items ?? [];
  const activeGroup = groups[0] ?? null;

  const { data: cycle, isLoading: cycleLoading } = useCurrentCycle(activeGroup?.id);

  const role = (activeGroup?.role as GroupRole) ?? null;
  const myStatusObj = cycle?.members.find((m) => m.userId === user?.id);
  const mySubmissionStatus = myStatusObj?.submissionStatus ?? 'not_started';

  const nextAction = getNextAction(cycle ?? null, role, mySubmissionStatus);

  const now = useMemo(() => new Date(), []);
  const todayFormatted = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: timezone,
    }).format(now);
  }, [now, timezone]);

  const todayIso = useMemo(() => {
    return now.toISOString().slice(0, 10);
  }, [now]);

  const { data: todayTasks, isLoading: tasksLoading } = useTasks({
    date: todayIso,
    cycleId: cycle?.id,
  });

  const fills = useMemo(() => {
    if (!todayTasks || todayTasks.length === 0) return {};
    const completed = todayTasks.filter((t) => t.status === 'completed').length;
    const ratio = completed / todayTasks.length;
    return { [now.getDate()]: ratio };
  }, [todayTasks, now]);

  const logActionMutation = useLogTaskActionMutation(selectedTask?.id);

  const handleOpenTaskSheet = (task: TaskResponse) => {
    setSelectedTask(task);
    setIsSheetVisible(true);
  };

  const handleCloseTaskSheet = () => {
    setIsSheetVisible(false);
    setSelectedTask(null);
  };

  const handleLogAction = async (
    action: TaskAction,
    durationMinutes: number,
    note?: string,
    postponedToDate?: string
  ) => {
    if (!selectedTask) return;
    await logActionMutation.mutateAsync({
      action,
      durationMinutes,
      note,
      postponedToDate,
    });
  };

  return (
    <Screen scrollable={true} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="small" color="ink" tabularNums={true}>
          {todayFormatted}
        </Text>
        <Title>{profile?.displayName ? `Hello, ${profile.displayName}` : 'Today'}</Title>
        <Text variant="small" color="ash">
          {activeGroup ? activeGroup.name : 'No active group'}
        </Text>
      </View>

      <Divider style={styles.divider} />

      {groupsLoading || cycleLoading ? (
        <View style={styles.loadingPlaceholder} />
      ) : !activeGroup ? (
        <EmptyState
          message="Create a group or join one with an invite code."
          actionLabel="Go to groups"
          onAction={() => router.push('/(tabs)/group')}
        />
      ) : (
        <View style={styles.content}>
          <View style={styles.monthOverview}>
            <Text variant="heading" color="ink" style={styles.overviewTitle}>
              {formatMonthName(now.getFullYear(), now.getMonth() + 1)} overview
            </Text>
            <MonthStrip
              year={cycle?.year ?? now.getFullYear()}
              month={cycle?.month ?? now.getMonth() + 1}
              today={now.getDate()}
              markers={[]}
              fills={fills}
            />
          </View>

          {/* Daily Tasks Section */}
          <View style={styles.tasksSection}>
            <View style={styles.sectionHeader}>
              <Text variant="heading" color="ink">
                Today&apos;s Tasks
              </Text>
              {todayTasks && todayTasks.length > 0 ? (
                <Text variant="micro" color="ash" tabularNums={true}>
                  {todayTasks.filter((t) => t.status === 'completed').length} / {todayTasks.length}{' '}
                  done
                </Text>
              ) : null}
            </View>

            {tasksLoading ? (
              <View style={styles.loadingPlaceholder} />
            ) : todayTasks && todayTasks.length > 0 ? (
              <View style={styles.taskList}>
                {todayTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onPress={handleOpenTaskSheet}
                    onQuickStart={async (t) => {
                      setSelectedTask(t);
                      await logActionMutation.mutateAsync({ action: 'start', durationMinutes: 0 });
                    }}
                    onQuickPause={async (t) => {
                      setSelectedTask(t);
                      await logActionMutation.mutateAsync({ action: 'pause', durationMinutes: 0 });
                    }}
                    onQuickComplete={async (t) => {
                      setSelectedTask(t);
                      await logActionMutation.mutateAsync({
                        action: 'complete',
                        durationMinutes: t.estimatedMinutes,
                      });
                    }}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyTasksBox}>
                <Text variant="small" color="ash">
                  No tasks scheduled for today.
                </Text>
              </View>
            )}
          </View>

          {/* Pre-execution cycle requirement card */}
          {cycle && cycle.status !== 'execution' ? (
            <View style={styles.actionCard}>
              <Text variant="micro" color="ash">
                Current requirement
              </Text>
              <Text variant="heading" color="ink">
                {nextAction.label}
              </Text>
              <Text variant="body" color="ash">
                {cycle.status === 'submission_open'
                  ? mySubmissionStatus === 'submitted' || mySubmissionStatus === 'locked'
                    ? 'Your goals are locked and ready for review.'
                    : 'Add your planned goals and estimated hours for this month.'
                  : cycle.status === 'group_review'
                    ? "Review other members' goals and leave constructive comments."
                    : cycle.status === 'planning'
                      ? 'Review and approve your AI-generated baseline plan.'
                      : 'Track your goals throughout the cycle.'}
              </Text>

              <View style={styles.cardActions}>
                <Button
                  label={nextAction.label}
                  variant="primary"
                  disabled={nextAction.disabled}
                  onPress={() => {
                    if (cycle.status === 'planning') {
                      router.push(`/cycles/${cycle.id}/plan`);
                    } else {
                      router.push('/(tabs)/month');
                    }
                  }}
                />
              </View>
            </View>
          ) : null}

          {cycle ? (
            <View style={styles.summaryBox}>
              <Row style={styles.summaryRow}>
                <Text variant="small" color="ash">
                  Cycle status
                </Text>
                <Text variant="small" color="ink">
                  {cycle.status === 'submission_open'
                    ? 'Submitting goals'
                    : cycle.status === 'group_review'
                      ? 'Group review'
                      : cycle.status === 'planning'
                        ? 'Planning'
                        : cycle.status === 'execution'
                          ? 'Execution'
                          : cycle.status}
                </Text>
              </Row>
              <Divider />
              <Row style={styles.summaryRow}>
                <Text variant="small" color="ash">
                  Group members
                </Text>
                <Text variant="small" color="ink" tabularNums={true}>
                  {cycle.members.length}
                </Text>
              </Row>
            </View>
          ) : null}
        </View>
      )}

      <TaskActionSheet
        task={selectedTask}
        visible={isSheetVisible}
        onClose={handleCloseTaskSheet}
        onLogAction={handleLogAction}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.unit * 8,
    paddingBottom: spacing.unit * 8,
    flexGrow: 1,
  },
  header: {
    gap: spacing.unit * 1,
  },
  divider: {
    marginVertical: spacing.unit * 4,
  },
  loadingPlaceholder: {
    height: 1,
    backgroundColor: colors.rule,
    marginVertical: spacing.unit * 6,
  },
  content: {
    gap: spacing.unit * 6,
  },
  tasksSection: {
    gap: spacing.unit * 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskList: {
    gap: spacing.unit * 3,
  },
  emptyTasksBox: {
    backgroundColor: colors.wash,
    padding: spacing.unit * 5,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.rule,
    alignItems: 'center',
  },
  actionCard: {
    backgroundColor: colors.wash,
    padding: spacing.unit * 5,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.rule,
    gap: spacing.unit * 3,
  },
  cardActions: {
    marginTop: spacing.unit * 2,
  },
  monthOverview: {
    gap: spacing.unit * 3,
  },
  overviewTitle: {
    marginBottom: spacing.unit * 1,
  },
  summaryBox: {
    backgroundColor: colors.wash,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.rule,
    paddingHorizontal: spacing.unit * 4,
  },
  summaryRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: spacing.unit * 3,
  },
});
