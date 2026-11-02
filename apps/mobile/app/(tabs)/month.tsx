import React, { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  Divider,
  EmptyState,
  ErrorBar,
  MonthStrip,
  Row,
  Screen,
  Sheet,
  StatusSquare,
  Text,
  Title,
} from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';
import { useGroups } from '@/hooks/use-groups';
import { useAdvanceCycle, useCreateCycle, useCurrentCycle } from '@/hooks/use-cycles';
import { useSessionStore } from '@/stores/session';
import { formatDateWithTime, formatMonthName } from '@/services/dates';
import { getNextAction } from '@/services/cycle-actions';
import { mapApiError } from '@/services/api';
import type { GroupRole } from '@mp/shared';

const STATUS_LABELS: Record<string, string> = {
  none: 'Not started',
  not_started: 'Not started',
  draft: 'Draft',
  submitted: 'Submitted',
  locked: 'Locked',
};

export default function MonthScreen(): React.ReactNode {
  const router = useRouter();
  const profile = useSessionStore((s) => s.profile);
  const user = useSessionStore((s) => s.user);
  const timezone = profile?.timezone || 'UTC';

  const { data: groupsData, isLoading: groupsLoading } = useGroups();
  const groups = groupsData?.items ?? [];
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const activeGroup = groups.find((g) => g.id === selectedGroupId) ?? groups[0] ?? null;
  const activeGroupId = activeGroup?.id ?? undefined;

  const {
    data: cycle,
    isLoading: cycleLoading,
    error: cycleError,
    refetch: refetchCycle,
  } = useCurrentCycle(activeGroupId);

  const role = (activeGroup?.role as GroupRole) ?? null;
  const myStatusObj = cycle?.members.find((m) => m.userId === user?.id);
  const mySubmissionStatus = myStatusObj?.submissionStatus ?? 'not_started';

  const nextAction = getNextAction(cycle ?? null, role, mySubmissionStatus);

  const [confirmSheetOpen, setConfirmSheetOpen] = useState(false);
  const [createCycleSheetOpen, setCreateCycleSheetOpen] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  const advanceCycleMutation = useAdvanceCycle(cycle?.id, activeGroupId);
  const createCycleMutation = useCreateCycle(activeGroupId);

  const handleAdvance = async () => {
    setAdvanceError(null);
    setAdvancing(true);
    try {
      await advanceCycleMutation.mutateAsync({});
      setConfirmSheetOpen(false);
    } catch (err) {
      setAdvanceError(mapApiError(err));
    } finally {
      setAdvancing(false);
    }
  };

  const handleCreateDefaultCycle = async () => {
    setAdvanceError(null);
    if (!activeGroupId) return;

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;

    // Default deadlines: submission in 5 days, review in 7 days
    const subDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const revDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    try {
      await createCycleMutation.mutateAsync({
        year,
        month,
        submissionDeadline: subDate.toISOString(),
        reviewDeadline: revDate.toISOString(),
      });
      setCreateCycleSheetOpen(false);
    } catch (err) {
      setAdvanceError(mapApiError(err));
    }
  };

  const now = new Date();
  const currentDay = now.getDate();

  const submissionMarkers = [];
  if (cycle?.submissionDeadline) {
    const subDay = new Date(cycle.submissionDeadline).getDate();
    submissionMarkers.push({ day: subDay, label: 'SUB' });
  }
  if (cycle?.reviewDeadline) {
    const revDay = new Date(cycle.reviewDeadline).getDate();
    submissionMarkers.push({ day: revDay, label: 'REV' });
  }

  const submittedCount =
    cycle?.members.filter(
      (m) => m.submissionStatus === 'submitted' || m.submissionStatus === 'locked'
    ).length ?? 0;
  const totalCount = cycle?.members.length ?? 0;

  return (
    <Screen
      scrollable={true}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={groupsLoading || cycleLoading}
          onRefresh={() => void refetchCycle()}
          tintColor={colors.flare}
        />
      }
    >
      {/* Top Group Selector if multiple */}
      {groups.length > 1 ? (
        <View style={styles.groupSelector}>
          {groups.map((g) => (
            <Pressable
              key={g.id}
              style={[styles.groupPill, g.id === activeGroupId && styles.groupPillActive]}
              accessibilityRole="button"
              accessibilityLabel={g.name}
              onPress={() => setSelectedGroupId(g.id)}
            >
              <Text variant="micro" color={g.id === activeGroupId ? 'flare' : 'ink'}>
                {g.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {cycleError ? (
        <View style={styles.errorContainer}>
          <ErrorBar message={mapApiError(cycleError)} onDismiss={() => void refetchCycle()} />
        </View>
      ) : null}

      {advanceError ? (
        <View style={styles.errorContainer}>
          <ErrorBar message={advanceError} onDismiss={() => setAdvanceError(null)} />
        </View>
      ) : null}

      {groupsLoading || cycleLoading ? (
        <View style={styles.loadingPlaceholder} />
      ) : !activeGroup ? (
        <EmptyState
          message="Create a group or join one with an invite code."
          actionLabel="View groups"
          onAction={() => {}}
        />
      ) : !cycle ? (
        <View style={styles.emptyCycle}>
          <Title>{formatMonthName(now.getFullYear(), now.getMonth() + 1)}</Title>
          <Text variant="small" color="ash" style={styles.subline}>
            No cycle running for {activeGroup.name}
          </Text>
          <View style={styles.monthStripWrapper}>
            <MonthStrip
              year={now.getFullYear()}
              month={now.getMonth() + 1}
              today={currentDay}
              markers={[]}
            />
          </View>
          <EmptyState
            message="Nobody has started a cycle for this month. Owners and admins can start one."
            actionLabel={
              role === 'owner' || role === 'admin'
                ? `Start ${formatMonthName(now.getFullYear(), now.getMonth() + 1)}`
                : undefined
            }
            onAction={
              role === 'owner' || role === 'admin' ? () => setCreateCycleSheetOpen(true) : undefined
            }
          />
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.header}>
            <Title>{formatMonthName(cycle.year, cycle.month)}</Title>
            <Text variant="small" color="ash" style={styles.subline}>
              {submittedCount} of {totalCount} submitted
            </Text>
          </View>

          {/* Month Strip */}
          <View style={styles.monthStripWrapper}>
            <MonthStrip
              year={cycle.year}
              month={cycle.month}
              today={currentDay}
              markers={submissionMarkers}
            />
          </View>

          {/* Phase Deadlines */}
          <View style={styles.phaseBox}>
            <Row style={styles.phaseRow}>
              <Text variant="small" color="ink">
                Submitting goals
              </Text>
              <Text variant="micro" color="ink" tabularNums={true}>
                {formatDateWithTime(cycle.submissionDeadline, timezone)}
              </Text>
            </Row>
            <Divider />
            <Row style={styles.phaseRow}>
              <Text variant="small" color="ink">
                Group review
              </Text>
              <Text variant="micro" color="ash" tabularNums={true}>
                {formatDateWithTime(cycle.reviewDeadline, timezone)}
              </Text>
            </Row>
          </View>

          {/* Primary & Secondary Actions */}
          <View style={styles.actions}>
            <Button
              label={nextAction.label}
              variant="primary"
              disabled={nextAction.disabled}
              onPress={() => {
                if (
                  nextAction.action === 'submit_goals' ||
                  nextAction.action === 'view_submission'
                ) {
                  router.push(`/cycles/${cycle.id}/submission`);
                } else if (nextAction.action === 'review_goals') {
                  router.push(`/cycles/${cycle.id}/review`);
                } else if (nextAction.action === 'create_cycle') {
                  setCreateCycleSheetOpen(true);
                }
              }}
            />

            {nextAction.secondaryLabel ? (
              <Button
                label={nextAction.secondaryLabel}
                variant="secondary"
                onPress={() => setConfirmSheetOpen(true)}
              />
            ) : null}
          </View>

          <Divider style={styles.divider} />

          {/* Member Submissions List */}
          <View style={styles.memberListSection}>
            <Text variant="heading" color="ink" style={styles.memberListTitle}>
              Member submissions
            </Text>
            {cycle.members.map((m) => (
              <View key={m.userId}>
                <Row style={styles.memberRow}>
                  <Text variant="body" color="ink">
                    {m.displayName}
                  </Text>
                  <View style={styles.statusCol}>
                    <StatusSquare
                      status={m.submissionStatus === 'none' ? 'not_started' : m.submissionStatus}
                    />
                    <Text variant="small" color="ash">
                      {STATUS_LABELS[m.submissionStatus] ?? m.submissionStatus}
                    </Text>
                  </View>
                </Row>
                <Divider />
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Confirmation Sheet for advancing cycle */}
      <Sheet
        visible={confirmSheetOpen}
        onClose={() => setConfirmSheetOpen(false)}
        title={nextAction.confirmTitle || 'Confirm transition'}
      >
        <View style={styles.confirmContent}>
          <Text variant="body" color="ash">
            {nextAction.confirmMessage ||
              'This locks every submitted goal. Members who have not submitted keep a draft and are left out.'}
          </Text>
          <View style={styles.sheetBtnGroup}>
            <Button label="Confirm" variant="primary" loading={advancing} onPress={handleAdvance} />
            <Button label="Cancel" variant="quiet" onPress={() => setConfirmSheetOpen(false)} />
          </View>
        </View>
      </Sheet>

      {/* Create Cycle Sheet */}
      <Sheet
        visible={createCycleSheetOpen}
        onClose={() => setCreateCycleSheetOpen(false)}
        title={`Start ${formatMonthName(now.getFullYear(), now.getMonth() + 1)}`}
      >
        <View style={styles.confirmContent}>
          <Text variant="body" color="ash">
            Start a new monthly planning cycle for {activeGroup?.name}. Deadlines will be set to 5
            days for goal submission and 2 days for review.
          </Text>
          <View style={styles.sheetBtnGroup}>
            <Button
              label="Start cycle"
              variant="primary"
              loading={createCycleMutation.isPending}
              onPress={handleCreateDefaultCycle}
            />
            <Button label="Cancel" variant="quiet" onPress={() => setCreateCycleSheetOpen(false)} />
          </View>
        </View>
      </Sheet>
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
  groupSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.unit * 2,
    marginBottom: spacing.unit * 4,
  },
  groupPill: {
    paddingHorizontal: spacing.unit * 3,
    paddingVertical: spacing.unit * 1,
    backgroundColor: colors.wash,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  groupPillActive: {
    borderColor: colors.flare,
  },
  errorContainer: {
    marginBottom: spacing.unit * 4,
  },
  loadingPlaceholder: {
    height: 1,
    backgroundColor: colors.rule,
    marginVertical: spacing.unit * 6,
  },
  emptyCycle: {
    gap: spacing.unit * 4,
    paddingVertical: spacing.unit * 6,
  },
  content: {
    gap: spacing.unit * 4,
  },
  header: {
    gap: spacing.unit * 1,
  },
  subline: {
    marginTop: spacing.unit * 0.5,
  },
  monthStripWrapper: {
    marginVertical: spacing.unit * 2,
  },
  phaseBox: {
    backgroundColor: colors.wash,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.rule,
    paddingHorizontal: spacing.unit * 3,
    marginVertical: spacing.unit * 2,
  },
  phaseRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: spacing.unit * 3,
  },
  actions: {
    gap: spacing.unit * 3,
    marginTop: spacing.unit * 2,
  },
  divider: {
    marginVertical: spacing.unit * 4,
  },
  memberListSection: {
    gap: spacing.unit * 2,
  },
  memberListTitle: {
    marginBottom: spacing.unit * 2,
  },
  memberRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: spacing.unit * 2,
  },
  statusCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit * 2,
  },
  confirmContent: {
    gap: spacing.unit * 6,
    paddingTop: spacing.unit * 2,
  },
  sheetBtnGroup: {
    gap: spacing.unit * 3,
  },
});
