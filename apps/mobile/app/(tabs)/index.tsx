import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Divider, EmptyState, MonthStrip, Row, Screen, Text, Title } from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';
import { useGroups } from '@/hooks/use-groups';
import { useCurrentCycle } from '@/hooks/use-cycles';
import { useSessionStore } from '@/stores/session';
import { formatMonthName } from '@/services/dates';
import { getNextAction } from '@/services/cycle-actions';
import type { GroupRole } from '@mp/shared';

export default function TodayScreen(): React.ReactNode {
  const router = useRouter();
  const profile = useSessionStore((s) => s.profile);
  const user = useSessionStore((s) => s.user);
  const timezone = profile?.timezone || 'UTC';

  const { data: groupsData, isLoading: groupsLoading } = useGroups();
  const groups = groupsData?.items ?? [];
  const activeGroup = groups[0] ?? null;

  const { data: cycle, isLoading: cycleLoading } = useCurrentCycle(activeGroup?.id);

  const role = (activeGroup?.role as GroupRole) ?? null;
  const myStatusObj = cycle?.members.find((m) => m.userId === user?.id);
  const mySubmissionStatus = myStatusObj?.submissionStatus ?? 'not_started';

  const nextAction = getNextAction(cycle ?? null, role, mySubmissionStatus);

  const now = new Date();
  const todayFormatted = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: timezone,
    }).format(now);
  }, [now, timezone]);

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
          <View style={styles.actionCard}>
            <Text variant="micro" color="ash">
              Current requirement
            </Text>
            <Text variant="heading" color="ink">
              {nextAction.label}
            </Text>
            <Text variant="body" color="ash">
              {!cycle
                ? 'Nobody has started a cycle for this month. Owners and admins can start one.'
                : cycle.status === 'submission_open'
                  ? mySubmissionStatus === 'submitted' || mySubmissionStatus === 'locked'
                    ? 'Your goals are locked and ready for review.'
                    : 'Add your planned goals and estimated hours for this month.'
                  : cycle.status === 'group_review'
                    ? "Review other members' goals and leave constructive comments."
                    : 'Track your goals throughout the cycle.'}
            </Text>

            <View style={styles.cardActions}>
              <Button
                label={nextAction.label}
                variant="primary"
                disabled={nextAction.disabled}
                onPress={() => {
                  router.push('/(tabs)/month');
                }}
              />
            </View>
          </View>

          <View style={styles.monthOverview}>
            <Text variant="heading" color="ink" style={styles.overviewTitle}>
              {formatMonthName(now.getFullYear(), now.getMonth() + 1)} overview
            </Text>
            <MonthStrip
              year={cycle?.year ?? now.getFullYear()}
              month={cycle?.month ?? now.getMonth() + 1}
              today={now.getDate()}
              markers={[]}
            />
          </View>

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
  actionCard: {
    backgroundColor: colors.wash,
    padding: spacing.unit * 5,
    borderRadius: 4,
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
    borderRadius: 4,
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
