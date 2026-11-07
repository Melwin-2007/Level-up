import React, { useState } from 'react';
import { StyleSheet, View, Pressable, RefreshControl, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react-native';
import type { PlanItemResponse, PlanMilestone } from '@mp/shared';
import {
  Screen,
  Title,
  Text,
  Row,
  Divider,
  Button,
  Input,
  Field,
  Sheet,
  EmptyState,
  ErrorBar,
  MonthStrip,
  type Marker,
} from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';
import { useCycle } from '@/hooks/use-cycles';
import { usePlan, useGeneratePlanMutation, useApprovePlanMutation } from '@/hooks/use-plans';
import { formatMonthName } from '@/services/dates';
import { mapApiError } from '@/services/api';

function formatTaskDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const clean = dateStr.split('T')[0];
  const parts = clean?.split('-');
  if (!parts || parts.length !== 3) return dateStr;
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const part1 = parts[1];
  const part2 = parts[2];
  if (!part1 || !part2) return dateStr;
  const monthIdx = parseInt(part1, 10) - 1;
  const day = parseInt(part2, 10);
  const mName = monthNames[monthIdx] ?? part1;
  return `${mName} ${day}`;
}

function formatMinutes(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

export default function PlanReviewScreen(): React.ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: cycle, isLoading: cycleLoading, refetch: refetchCycle } = useCycle(id);
  const {
    data: plan,
    isLoading: planLoading,
    error: planError,
    refetch: refetchPlan,
  } = usePlan(id);

  const generateMutation = useGeneratePlanMutation(id);
  const approveMutation = useApprovePlanMutation(id);

  // UI state
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
  });
  const [assistantSheetOpen, setAssistantSheetOpen] = useState(false);
  const [confirmApproveSheetOpen, setConfirmApproveSheetOpen] = useState(false);
  const [adjustmentsNote, setAdjustmentsNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const toggleWeek = (week: number): void => {
    setExpandedWeeks((prev) => ({ ...prev, [week]: !prev[week] }));
  };

  const cycleTitle = cycle ? formatMonthName(cycle.year, cycle.month) : 'Monthly Plan';
  const isBaseline = plan?.isBaseline ?? false;
  const feasibility = plan?.planSnapshot?.feasibility;
  const milestones = plan?.planSnapshot?.milestones ?? [];

  // Group milestones by target week (1 to 5)
  const weeks = [1, 2, 3, 4, 5];
  const milestonesByWeek: Record<number, PlanMilestone[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  };

  for (const m of milestones) {
    const w = m.targetWeek ?? 1;
    if (w >= 1 && w <= 5 && milestonesByWeek[w]) {
      milestonesByWeek[w]?.push(m);
    } else {
      milestonesByWeek[1]?.push(m);
    }
  }

  // Also extract plan items from response if available
  const items: PlanItemResponse[] = plan?.items ?? [];

  // Group daily tasks by week number (1 to 5)
  const dailyTasksByWeek: Record<number, PlanItemResponse[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  };

  // Map daily minutes for MonthStrip load gauges
  const dailyMinutesMap: Record<number, number> = {};

  for (const item of items) {
    if (item.itemType === 'daily_task') {
      let w = item.weekNumber;
      if (!w || w < 1 || w > 5) {
        if (item.plannedDate) {
          const day = parseInt(item.plannedDate.split('T')[0]?.split('-')[2] ?? '', 10);
          if (!isNaN(day)) {
            w = Math.min(5, Math.max(1, Math.ceil(day / 7)));
          }
        }
      }
      const finalWeek = w && w >= 1 && w <= 5 ? w : 1;
      dailyTasksByWeek[finalWeek]?.push(item);

      if (item.plannedDate) {
        const day = parseInt(item.plannedDate.split('T')[0]?.split('-')[2] ?? '', 10);
        if (!isNaN(day)) {
          dailyMinutesMap[day] = (dailyMinutesMap[day] ?? 0) + (item.estimatedMinutes ?? 0);
        }
      }
    }
  }

  // Sort daily tasks chronologically per week
  for (const w of weeks) {
    dailyTasksByWeek[w]?.sort((a, b) => {
      if (a.plannedDate && b.plannedDate && a.plannedDate !== b.plannedDate) {
        return a.plannedDate.localeCompare(b.plannedDate);
      }
      return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
    });
  }

  // Compute fill ratios for MonthStrip
  const dailyFills: Record<number, number> = {};
  const peakMinutes = Math.max(120, ...Object.values(dailyMinutesMap));
  for (const [dayStr, minutes] of Object.entries(dailyMinutesMap)) {
    const day = Number(dayStr);
    if (minutes > 0) {
      const ratio = Math.min(1.0, minutes / peakMinutes);
      dailyFills[day] = Math.max(0.15, Math.round(ratio * 100) / 100);
    }
  }

  // Daily markers on MonthStrip: deadlines and scheduled load markers
  const dailyMarkers: Marker[] = [];
  if (cycle?.submissionDeadline) {
    const d = new Date(cycle.submissionDeadline);
    if (d.getUTCFullYear() === cycle.year && d.getUTCMonth() + 1 === cycle.month) {
      dailyMarkers.push({ day: d.getUTCDate(), label: 'sub' });
    }
  }
  if (cycle?.reviewDeadline) {
    const d = new Date(cycle.reviewDeadline);
    if (d.getUTCFullYear() === cycle.year && d.getUTCMonth() + 1 === cycle.month) {
      dailyMarkers.push({ day: d.getUTCDate(), label: 'rev' });
    }
  }
  for (const [dayStr, minutes] of Object.entries(dailyMinutesMap)) {
    const day = Number(dayStr);
    if (!dailyMarkers.some((m) => m.day === day)) {
      const hours = (minutes / 60).toFixed(0);
      dailyMarkers.push({ day, label: `${hours}h` });
    }
  }

  const handleRegenerate = async (): Promise<void> => {
    try {
      setActionError(null);
      await generateMutation.mutateAsync({
        adjustmentsNote: adjustmentsNote.trim() ? adjustmentsNote.trim() : undefined,
      });
      setAdjustmentsNote('');
      setAssistantSheetOpen(false);
    } catch (err) {
      setActionError(mapApiError(err));
    }
  };

  const handleApprove = async (): Promise<void> => {
    if (!plan) return;
    try {
      setActionError(null);
      await approveMutation.mutateAsync({
        planVersionId: plan.id,
      });
      setConfirmApproveSheetOpen(false);
      Alert.alert(
        'Plan Approved',
        'Your monthly plan is now locked as your immutable baseline plan.',
        [{ text: 'Continue', onPress: () => void refetchCycle() }]
      );
    } catch (err) {
      setActionError(mapApiError(err));
      setConfirmApproveSheetOpen(false);
    }
  };

  const handleInitialGenerate = async (): Promise<void> => {
    try {
      setActionError(null);
      await generateMutation.mutateAsync({});
    } catch (err) {
      setActionError(mapApiError(err));
    }
  };

  return (
    <Screen
      scrollable={true}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={cycleLoading || planLoading}
          onRefresh={() => {
            void refetchCycle();
            void refetchPlan();
          }}
          tintColor={colors.flare}
        />
      }
    >
      {/* Top Navigation */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to month view"
        >
          <ArrowLeft size={20} color={colors.ink} />
        </Pressable>

        <View style={styles.headerTitleCol}>
          <Title>{cycleTitle}</Title>
          <Text variant="micro" color="ash">
            Monthly Plan
          </Text>
        </View>

        <View style={styles.statusBadge}>
          <Text variant="micro" color="ash">
            {isBaseline ? 'BASELINE' : (cycle?.status.toUpperCase() ?? 'PLANNING')}
          </Text>
        </View>
      </View>

      {/* "Proposed by AI" banner on unapproved plan */}
      {!isBaseline && plan ? (
        <View style={styles.aiTagBanner} testID="proposed-by-ai-badge">
          <Row style={styles.aiTagRow}>
            <Sparkles size={14} color={colors.flare} />
            <Text variant="small" color="flare" style={styles.aiTagText}>
              Proposed by AI (Version {plan.versionNumber})
            </Text>
          </Row>
          <Text variant="micro" color="ash" style={styles.aiTagSubtext}>
            Review pacing and weekly breakdown before locking your baseline.
          </Text>
        </View>
      ) : null}

      {/* Errors */}
      {planError ? (
        <View style={styles.errorContainer}>
          <ErrorBar message={mapApiError(planError)} onDismiss={() => void refetchPlan()} />
        </View>
      ) : null}

      {actionError ? (
        <View style={styles.errorContainer}>
          <ErrorBar message={actionError} onDismiss={() => setActionError(null)} />
        </View>
      ) : null}

      {/* Loading */}
      {cycleLoading || planLoading ? (
        <View style={styles.loadingContainer}>
          <Text variant="body" color="ash">
            Loading monthly plan...
          </Text>
        </View>
      ) : !plan ? (
        /* Empty State: No plan generated yet */
        <View style={styles.emptyContainer}>
          <EmptyState
            title="No Plan Generated Yet"
            message="Your submission is locked. Generate an AI-optimized schedule and weekly milestone decomposition based on your availability and priorities."
            actionLabel={generateMutation.isPending ? 'Generating...' : 'Generate Plan'}
            onAction={handleInitialGenerate}
          />
        </View>
      ) : (
        /* Plan Content */
        <View style={styles.content}>
          {/* Month Strip with Daily Planned Load */}
          {cycle ? (
            <View style={styles.monthStripWrapper} testID="plan-month-strip">
              <Row style={styles.monthStripLabelRow}>
                <Text variant="small" color="ink">
                  Daily Scheduled Load
                </Text>
                <Text variant="micro" color="ash" tabularNums={true}>
                  {Object.keys(dailyMinutesMap).length} active day
                  {Object.keys(dailyMinutesMap).length === 1 ? '' : 's'}
                </Text>
              </Row>
              <MonthStrip
                year={cycle.year}
                month={cycle.month}
                today={
                  new Date().getFullYear() === cycle.year &&
                  new Date().getMonth() + 1 === cycle.month
                    ? new Date().getDate()
                    : undefined
                }
                fills={dailyFills}
                markers={dailyMarkers}
              />
            </View>
          ) : null}

          {/* 1. Feasibility Summary Card */}
          {feasibility ? (
            <View style={styles.card}>
              <Row style={styles.cardHeader}>
                <Text variant="heading" color="ink">
                  Feasibility Summary
                </Text>
                <View
                  style={[
                    styles.verdictBadge,
                    feasibility.verdict === 'feasible' && styles.verdictFeasible,
                    feasibility.verdict === 'tight' && styles.verdictTight,
                    feasibility.verdict === 'infeasible' && styles.verdictInfeasible,
                  ]}
                  testID="feasibility-verdict-badge"
                >
                  <Text
                    variant="micro"
                    color={
                      feasibility.verdict === 'infeasible'
                        ? 'flare'
                        : feasibility.verdict === 'tight'
                          ? 'signal'
                          : 'ink'
                    }
                  >
                    {feasibility.verdict.toUpperCase()}
                  </Text>
                </View>
              </Row>

              {/* Hours & Capacity */}
              <View style={styles.capacitySection}>
                <Row style={styles.capacityRow}>
                  <Text variant="small" color="ash">
                    Capacity Load
                  </Text>
                  <Text variant="small" color="ink" tabularNums={true}>
                    {feasibility.totalEstimatedHours}h / {feasibility.totalAvailableHours}h (
                    {Math.round(feasibility.capacityRatio * 100)}%)
                  </Text>
                </Row>
                <View style={styles.capacityTrack}>
                  <View
                    style={[
                      styles.capacityFill,
                      {
                        width: `${Math.min(100, Math.round(feasibility.capacityRatio * 100))}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Rationale */}
              {feasibility.rationale ? (
                <Text variant="small" color="ash" style={styles.rationaleText}>
                  {feasibility.rationale}
                </Text>
              ) : null}

              {/* Pacing summary */}
              {plan.planSnapshot?.pacingSummary ? (
                <Row style={styles.pacingRow}>
                  <Clock size={14} color={colors.ash} />
                  <Text variant="micro" color="ash" style={styles.pacingText}>
                    {plan.planSnapshot.pacingSummary}
                  </Text>
                </Row>
              ) : null}

              {/* Conflicts if any */}
              {feasibility.conflicts && feasibility.conflicts.length > 0 ? (
                <View style={styles.conflictsContainer}>
                  <Row style={styles.conflictHeader}>
                    <AlertCircle size={14} color={colors.flare} />
                    <Text variant="small" color="flare">
                      Conflicts Detected ({feasibility.conflicts.length})
                    </Text>
                  </Row>
                  {feasibility.conflicts.map((c, idx) => (
                    <View key={idx} style={styles.conflictItem}>
                      <Text variant="micro" color="ink">
                        • [{c.type.toUpperCase()}] {c.description}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* 2. Weekly Milestones Breakdown */}
          <View style={styles.sectionHeader}>
            <Text variant="heading" color="ink">
              Weekly Milestone Breakdown
            </Text>
            <Text variant="micro" color="ash">
              {milestones.length} milestones planned
            </Text>
          </View>

          {weeks.map((week) => {
            const weekMilestones = milestonesByWeek[week] ?? [];
            const weekDailyTasks = dailyTasksByWeek[week] ?? [];
            if (weekMilestones.length === 0 && weekDailyTasks.length === 0 && week > 4) return null;
            const isExpanded = expandedWeeks[week] ?? true;
            const weekMilestoneMinutes = weekMilestones.reduce(
              (acc, m) => acc + (m.estimatedMinutes ?? 0),
              0
            );
            const weekDailyMinutes = weekDailyTasks.reduce(
              (acc, t) => acc + (t.estimatedMinutes ?? 0),
              0
            );
            const weekDisplayMinutes =
              weekDailyMinutes > 0 ? weekDailyMinutes : weekMilestoneMinutes;
            const weekHours = (weekDisplayMinutes / 60).toFixed(1);
            const weekDailyHours = (weekDailyMinutes / 60).toFixed(1);

            return (
              <View key={week} style={styles.weekCard} testID={`week-card-${week}`}>
                <Pressable
                  style={styles.weekHeader}
                  onPress={() => toggleWeek(week)}
                  accessibilityRole="button"
                  accessibilityLabel={`Toggle Week ${week}`}
                >
                  <Row style={styles.weekHeaderRow}>
                    <View style={styles.weekTitleCol}>
                      <Text variant="body" color="ink">
                        Week {week}
                      </Text>
                      <Text variant="micro" color="ash" tabularNums={true}>
                        {weekMilestones.length} milestone{weekMilestones.length === 1 ? '' : 's'}
                        {weekDailyTasks.length > 0
                          ? ` • ${weekDailyTasks.length} task${weekDailyTasks.length === 1 ? '' : 's'}`
                          : ''}{' '}
                        • {weekHours}h
                      </Text>
                    </View>
                    {isExpanded ? (
                      <ChevronUp size={16} color={colors.ash} />
                    ) : (
                      <ChevronDown size={16} color={colors.ash} />
                    )}
                  </Row>
                </Pressable>

                {isExpanded ? (
                  <View style={styles.weekContent}>
                    {weekMilestones.length === 0 && weekDailyTasks.length === 0 ? (
                      <Text variant="small" color="ash" style={styles.emptyWeekText}>
                        No milestones or daily tasks scheduled for this week.
                      </Text>
                    ) : null}

                    {/* Milestones */}
                    {weekMilestones.length > 0 ? (
                      <View style={styles.milestonesSection}>
                        {weekMilestones.map((milestone, idx) => (
                          <View key={idx} style={styles.milestoneItem}>
                            <Row style={styles.milestoneTitleRow}>
                              <View style={styles.bulletPoint} />
                              <Text variant="body" color="ink" style={styles.milestoneTitle}>
                                {milestone.title}
                              </Text>
                              <Text variant="small" color="ash" tabularNums={true}>
                                {((milestone.estimatedMinutes ?? 0) / 60).toFixed(1)}h
                              </Text>
                            </Row>

                            {milestone.description ? (
                              <Text variant="micro" color="ash" style={styles.milestoneDesc}>
                                {milestone.description}
                              </Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {/* Scheduled Daily Tasks */}
                    {weekDailyTasks.length > 0 ? (
                      <View style={styles.dailyTasksSection} testID={`week-daily-tasks-${week}`}>
                        {weekMilestones.length > 0 ? (
                          <Divider style={styles.dailyTasksDivider} />
                        ) : null}
                        <Row style={styles.subSectionHeader}>
                          <Text variant="small" color="ink" style={styles.subSectionTitle}>
                            Scheduled Daily Tasks
                          </Text>
                          <Text variant="micro" color="ash" tabularNums={true}>
                            {weekDailyTasks.length} task{weekDailyTasks.length === 1 ? '' : 's'} •{' '}
                            {weekDailyHours}h
                          </Text>
                        </Row>
                        {weekDailyTasks.map((task) => (
                          <View
                            key={task.id}
                            style={styles.dailyTaskItem}
                            testID={`daily-task-${task.id}`}
                          >
                            <Row style={styles.dailyTaskRow}>
                              <View style={styles.taskDateBadge}>
                                <Text
                                  variant="micro"
                                  color="flare"
                                  tabularNums={true}
                                  style={styles.taskDateText}
                                >
                                  {formatTaskDate(task.plannedDate)}
                                </Text>
                              </View>
                              <View style={styles.dailyTaskDetails}>
                                <Text variant="body" color="ink" style={styles.dailyTaskTitle}>
                                  {task.title}
                                </Text>
                                {task.description ? (
                                  <Text variant="micro" color="ash" style={styles.dailyTaskDesc}>
                                    {task.description}
                                  </Text>
                                ) : null}
                              </View>
                              <Text
                                variant="small"
                                color="ash"
                                tabularNums={true}
                                style={styles.taskDuration}
                              >
                                {formatMinutes(task.estimatedMinutes)}
                              </Text>
                            </Row>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}

          {/* 3. Items list fallback if decomposition has no direct milestones */}
          {milestones.length === 0 && items.length > 0 ? (
            <View style={styles.card}>
              <Text variant="heading" color="ink" style={styles.itemsTitle}>
                Planned Items ({items.length})
              </Text>
              {items.map((item) => (
                <Row key={item.id} style={styles.planItemRow}>
                  <Text variant="body" color="ink">
                    {item.title}
                  </Text>
                  <Text variant="small" color="ash" tabularNums={true}>
                    {((item.estimatedMinutes ?? 0) / 60).toFixed(1)}h
                  </Text>
                </Row>
              ))}
            </View>
          ) : null}

          {/* 4. Action Footer */}
          <View style={styles.footer}>
            {!isBaseline ? (
              <View style={styles.footerButtons}>
                <Button
                  label={approveMutation.isPending ? 'Locking Baseline...' : 'Approve Plan'}
                  variant="primary"
                  onPress={() => setConfirmApproveSheetOpen(true)}
                  disabled={approveMutation.isPending || generateMutation.isPending}
                />
                <Button
                  label="Request Changes"
                  variant="secondary"
                  onPress={() => setAssistantSheetOpen(true)}
                  disabled={approveMutation.isPending || generateMutation.isPending}
                />
              </View>
            ) : (
              <View style={styles.approvedBanner}>
                <Row style={styles.approvedRow}>
                  <CheckCircle2 size={18} color={colors.ink} />
                  <Text variant="body" color="ink">
                    Baseline Plan Approved & Locked
                  </Text>
                </Row>
                <Text variant="small" color="ash" style={styles.approvedSubtext}>
                  This plan is your official baseline for the month. Daily tracking starts when
                  execution begins.
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* AI Assistant & Adjustment Sheet */}
      <Sheet
        visible={assistantSheetOpen}
        onClose={() => setAssistantSheetOpen(false)}
        title="AI Assistant & Adjustment"
      >
        <ScrollView style={styles.sheetScroll}>
          {/* Plain-row layout for AI insights */}
          <View style={styles.insightSection}>
            <Text variant="small" color="flare" style={styles.insightHeader}>
              Plan Rationale & Pacing
            </Text>
            <View style={styles.insightRow}>
              <Text variant="micro" color="ash">
                Why this pacing?
              </Text>
              <Text variant="body" color="ink" style={styles.insightValue}>
                {plan?.planSnapshot?.pacingSummary ?? 'Standard pacing across available slots.'}
              </Text>
            </View>

            <Divider style={styles.sheetDivider} />

            <View style={styles.insightRow}>
              <Text variant="micro" color="ash">
                Capacity ratio
              </Text>
              <Text variant="body" color="ink" style={styles.insightValue}>
                {feasibility
                  ? `${Math.round(feasibility.capacityRatio * 100)}% of your available hours are utilized.`
                  : 'N/A'}
              </Text>
            </View>

            {feasibility?.goalVerdicts && feasibility.goalVerdicts.length > 0 ? (
              <>
                <Divider style={styles.sheetDivider} />
                <Text variant="small" color="flare" style={styles.insightHeader}>
                  Goal Assessments
                </Text>
                {feasibility.goalVerdicts.map((gv, idx) => (
                  <View key={idx} style={styles.goalVerdictItem}>
                    <Row style={styles.goalVerdictRow}>
                      <Text variant="small" color="ink">
                        Goal #{idx + 1}
                      </Text>
                      <Text variant="micro" color={gv.status === 'achievable' ? 'ink' : 'flare'}>
                        {gv.status.toUpperCase()}
                      </Text>
                    </Row>
                    {gv.recommendations.map((r, rIdx) => (
                      <Text key={rIdx} variant="micro" color="ash" style={styles.recText}>
                        • {r}
                      </Text>
                    ))}
                  </View>
                ))}
              </>
            ) : null}
          </View>

          <Divider style={styles.sheetDivider} />

          {/* Regeneration input form */}
          <Field
            label="Request Adjustments"
            hint="Describe adjustments you'd like (e.g. 'Shift week 1 workload to week 3', 'Pace more conservatively')."
          >
            <Input
              value={adjustmentsNote}
              onChangeText={setAdjustmentsNote}
              placeholder="e.g. Shift 5 hours from week 1 to week 2"
              multiline={true}
              numberOfLines={3}
            />
          </Field>

          <View style={styles.sheetActions}>
            <Button
              label={generateMutation.isPending ? 'Regenerating...' : 'Regenerate Plan'}
              variant="primary"
              onPress={handleRegenerate}
              disabled={generateMutation.isPending}
            />
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => setAssistantSheetOpen(false)}
            />
          </View>
        </ScrollView>
      </Sheet>

      {/* Confirmation Sheet for Approving Baseline Plan */}
      <Sheet
        visible={confirmApproveSheetOpen}
        onClose={() => setConfirmApproveSheetOpen(false)}
        title="Approve Baseline Plan"
      >
        <View style={styles.confirmContent}>
          <Text variant="body" color="ink" style={styles.confirmText}>
            Approving this plan sets it as your official, immutable baseline for the month.
          </Text>
          <Text variant="small" color="ash" style={styles.confirmSubtext}>
            Once approved, the plan snapshot cannot be edited or deleted. When all members have
            approved, the cycle will automatically advance to execution.
          </Text>

          <View style={styles.confirmActions}>
            <Button
              label={approveMutation.isPending ? 'Approving...' : 'Confirm Approval'}
              variant="primary"
              onPress={handleApprove}
              disabled={approveMutation.isPending}
            />
            <Button
              label="Keep Reviewing"
              variant="secondary"
              onPress={() => setConfirmApproveSheetOpen(false)}
            />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.unit * 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.unit * 4,
  },
  backButton: {
    padding: spacing.unit,
    marginRight: spacing.unit * 2,
  },
  headerTitleCol: {
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.unit * 2,
    paddingVertical: spacing.unit,
    borderRadius: radius.input,
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  aiTagBanner: {
    backgroundColor: colors.wash,
    borderColor: colors.oxblood,
    borderWidth: 1,
    borderRadius: radius.sheet,
    padding: spacing.unit * 4,
    marginBottom: spacing.unit * 4,
  },
  aiTagRow: {
    alignItems: 'center',
    gap: spacing.unit,
  },
  aiTagText: {
    fontWeight: '600',
  },
  aiTagSubtext: {
    marginTop: spacing.unit,
  },
  errorContainer: {
    marginBottom: spacing.unit * 4,
  },
  loadingContainer: {
    paddingVertical: spacing.unit * 10,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: spacing.unit * 8,
  },
  content: {
    gap: spacing.unit * 4,
  },
  monthStripWrapper: {
    paddingVertical: spacing.unit * 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    marginBottom: spacing.unit * 2,
  },
  monthStripLabelRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.unit,
  },
  card: {
    backgroundColor: colors.wash,
    borderColor: colors.rule,
    borderWidth: 1,
    borderRadius: radius.sheet,
    padding: spacing.unit * 4,
  },
  cardHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.unit * 2,
  },
  verdictBadge: {
    paddingHorizontal: spacing.unit * 2,
    paddingVertical: spacing.unit,
    borderRadius: radius.input,
    borderWidth: 1,
  },
  verdictFeasible: {
    borderColor: colors.ink,
    backgroundColor: colors.wash,
  },
  verdictTight: {
    borderColor: colors.signal,
    backgroundColor: colors.wash,
  },
  verdictInfeasible: {
    borderColor: colors.flare,
    backgroundColor: colors.wash,
  },
  capacitySection: {
    marginVertical: spacing.unit * 2,
  },
  capacityRow: {
    justifyContent: 'space-between',
    marginBottom: spacing.unit,
  },
  capacityTrack: {
    height: 6,
    backgroundColor: colors.rule,
    borderRadius: 3,
    overflow: 'hidden',
  },
  capacityFill: {
    height: '100%',
    backgroundColor: colors.flare,
    borderRadius: 3,
  },
  rationaleText: {
    marginTop: spacing.unit,
    lineHeight: 20,
  },
  pacingRow: {
    alignItems: 'center',
    gap: spacing.unit,
    marginTop: spacing.unit * 2,
  },
  pacingText: {
    flex: 1,
  },
  conflictsContainer: {
    marginTop: spacing.unit * 4,
    paddingTop: spacing.unit * 2,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
  },
  conflictHeader: {
    alignItems: 'center',
    gap: spacing.unit,
    marginBottom: spacing.unit,
  },
  conflictItem: {
    paddingLeft: spacing.unit * 2,
    marginVertical: 2,
  },
  sectionHeader: {
    marginTop: spacing.unit * 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  weekCard: {
    backgroundColor: colors.wash,
    borderColor: colors.rule,
    borderWidth: 1,
    borderRadius: radius.sheet,
    overflow: 'hidden',
  },
  weekHeader: {
    padding: spacing.unit * 4,
  },
  weekHeaderRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekTitleCol: {
    flex: 1,
  },
  weekContent: {
    paddingHorizontal: spacing.unit * 4,
    paddingBottom: spacing.unit * 4,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    gap: spacing.unit * 2,
  },
  emptyWeekText: {
    paddingTop: spacing.unit * 2,
    fontStyle: 'italic',
  },
  milestonesSection: {
    gap: spacing.unit * 2,
  },
  dailyTasksSection: {
    marginTop: spacing.unit * 2,
    gap: spacing.unit,
  },
  dailyTasksDivider: {
    marginBottom: spacing.unit * 2,
  },
  subSectionHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.unit,
  },
  subSectionTitle: {
    fontWeight: '600',
  },
  dailyTaskItem: {
    paddingVertical: spacing.unit,
  },
  dailyTaskRow: {
    alignItems: 'flex-start',
    gap: spacing.unit * 2,
  },
  taskDateBadge: {
    paddingHorizontal: spacing.unit,
    paddingVertical: 2,
    borderRadius: radius.cell,
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.rule,
    minWidth: 46,
    alignItems: 'center',
  },
  taskDateText: {
    fontWeight: '600',
  },
  dailyTaskDetails: {
    flex: 1,
    gap: 2,
  },
  dailyTaskTitle: {
    lineHeight: 20,
  },
  dailyTaskDesc: {
    lineHeight: 16,
  },
  taskDuration: {
    marginTop: 2,
  },
  milestoneItem: {
    paddingTop: spacing.unit * 2,
  },
  milestoneTitleRow: {
    alignItems: 'center',
    gap: spacing.unit,
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.flare,
  },
  milestoneTitle: {
    flex: 1,
  },
  milestoneDesc: {
    paddingLeft: spacing.unit * 4,
    marginTop: 2,
  },
  itemsTitle: {
    marginBottom: spacing.unit * 2,
  },
  planItemRow: {
    justifyContent: 'space-between',
    paddingVertical: spacing.unit,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  footer: {
    marginTop: spacing.unit * 4,
  },
  footerButtons: {
    gap: spacing.unit * 2,
  },
  approvedBanner: {
    padding: spacing.unit * 4,
    backgroundColor: colors.wash,
    borderColor: colors.rule,
    borderWidth: 1,
    borderRadius: radius.sheet,
  },
  approvedRow: {
    alignItems: 'center',
    gap: spacing.unit * 2,
    marginBottom: spacing.unit,
  },
  approvedSubtext: {
    lineHeight: 18,
  },
  sheetScroll: {
    maxHeight: 460,
  },
  insightSection: {
    gap: spacing.unit * 2,
    paddingVertical: spacing.unit,
  },
  insightHeader: {
    fontWeight: '600',
    marginTop: spacing.unit,
  },
  insightRow: {
    gap: spacing.unit,
  },
  insightValue: {
    lineHeight: 22,
  },
  sheetDivider: {
    marginVertical: spacing.unit * 2,
  },
  goalVerdictItem: {
    marginVertical: spacing.unit,
  },
  goalVerdictRow: {
    justifyContent: 'space-between',
  },
  recText: {
    paddingLeft: spacing.unit * 2,
    marginTop: 2,
  },
  sheetActions: {
    gap: spacing.unit * 2,
    marginTop: spacing.unit * 4,
    marginBottom: spacing.unit * 6,
  },
  confirmContent: {
    gap: spacing.unit * 2,
    paddingVertical: spacing.unit * 2,
  },
  confirmText: {
    lineHeight: 22,
  },
  confirmSubtext: {
    lineHeight: 18,
  },
  confirmActions: {
    gap: spacing.unit * 2,
    marginTop: spacing.unit * 4,
  },
});
