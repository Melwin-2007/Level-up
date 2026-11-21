import React, { useState } from 'react';
import { StyleSheet, View, Pressable, RefreshControl, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Screen, Title, Text, Button, EmptyState } from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';
import { useCycle } from '@/hooks/use-cycles';
import {
  useIndividualReport,
  useGroupReport,
  useRegenerateReportMutation,
  useUpdateSharingMutation,
} from '@/hooks/use-reports';
import {
  MetricCard,
  PlanComparisonTab,
  GroupReportTab,
  ReportInsightsList,
  SharingSheet,
  RegenerateSheet,
} from '@/components/reports';
import { formatMonthName } from '@/services/dates';

type ReportTab = 'individual' | 'group';

export default function CycleReportScreen(): React.ReactElement {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<ReportTab>('individual');
  const [isSharingOpen, setIsSharingOpen] = useState(false);
  const [isRegenerateOpen, setIsRegenerateOpen] = useState(false);

  const { data: cycle, isLoading: isCycleLoading } = useCycle(id);
  const {
    data: individualReport,
    isLoading: isIndividualLoading,
    refetch: refetchIndividual,
    isRefetching: isIndividualRefetching,
  } = useIndividualReport(id);

  const {
    data: groupReport,
    refetch: refetchGroup,
    isRefetching: isGroupRefetching,
  } = useGroupReport(id);

  const regenerateMutation = useRegenerateReportMutation(id);
  const updateSharingMutation = useUpdateSharingMutation(id);

  const isRefreshing = isIndividualRefetching || isGroupRefetching;

  const handleRefresh = async () => {
    await Promise.all([refetchIndividual(), refetchGroup()]);
  };

  const monthTitle = cycle
    ? `${formatMonthName(cycle.year, cycle.month)} Report`
    : 'Monthly Report';
  const cycleStatusSubtitle = cycle ? `Cycle phase: ${cycle.status}` : '';

  return (
    <Screen style={styles.screen}>
      {/* Top Header Bar */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back to cycle"
        >
          <ArrowLeft size={24} color={colors.ink} />
        </Pressable>

        <View style={styles.titleContainer}>
          <Title>{monthTitle}</Title>
          {cycleStatusSubtitle ? (
            <Text variant="small" color="ash" style={styles.subtitle}>
              {cycleStatusSubtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Tabs Row */}
      <View style={styles.tabsRow} accessibilityRole="tablist">
        <Pressable
          style={[styles.tabButton, activeTab === 'individual' && styles.tabButtonActive]}
          onPress={() => setActiveTab('individual')}
          accessibilityRole="tab"
          accessibilityLabel="Your report tab"
          accessibilityState={{ selected: activeTab === 'individual' }}
        >
          {activeTab === 'individual' ? <View style={styles.activeBar} /> : null}
          <Text
            variant="heading"
            style={[
              styles.tabLabel,
              activeTab === 'individual' ? styles.tabLabelActive : styles.tabLabelInactive,
            ]}
          >
            Your report
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === 'group' && styles.tabButtonActive]}
          onPress={() => setActiveTab('group')}
          accessibilityRole="tab"
          accessibilityLabel="Group report tab"
          accessibilityState={{ selected: activeTab === 'group' }}
        >
          {activeTab === 'group' ? <View style={styles.activeBar} /> : null}
          <Text
            variant="heading"
            style={[
              styles.tabLabel,
              activeTab === 'group' ? styles.tabLabelActive : styles.tabLabelInactive,
            ]}
          >
            Group report
          </Text>
        </Pressable>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.flare}
          />
        }
      >
        {activeTab === 'individual' ? (
          <View>
            {/* Action Bar */}
            <View style={styles.actionBar}>
              <Button
                label="Regenerate"
                variant="secondary"
                onPress={() => setIsRegenerateOpen(true)}
                accessibilityLabel="Regenerate report with note"
                style={styles.actionBtn}
              />

              <Button
                label="Privacy"
                variant="secondary"
                onPress={() => setIsSharingOpen(true)}
                accessibilityLabel="Open group sharing preferences"
                style={styles.actionBtn}
              />
            </View>

            {/* Individual Report Data */}
            {individualReport ? (
              <View>
                {/* Metric 1: Weighted Achievement */}
                <MetricCard
                  title="Weighted Achievement"
                  subtitle="Primary success score weighted by goal priority"
                  displayValue={individualReport.metrics.weightedAchievement.displayValue}
                  formula={individualReport.metrics.weightedAchievement.formula}
                  inputs={individualReport.metrics.weightedAchievement.inputs}
                  percentage={individualReport.metrics.weightedAchievement.value.score}
                />

                {/* Metric 2: Task Execution */}
                <MetricCard
                  title="Task Execution"
                  subtitle="Completion rate and minute accounting across scheduled tasks"
                  displayValue={individualReport.metrics.taskExecution.displayValue}
                  formula={individualReport.metrics.taskExecution.formula}
                  inputs={individualReport.metrics.taskExecution.inputs}
                  percentage={individualReport.metrics.taskExecution.value.completionRate}
                />

                {/* Metric 3: Estimate Accuracy */}
                <MetricCard
                  title="Estimate Accuracy"
                  subtitle="Adherence of actual logged minutes to task estimates"
                  displayValue={individualReport.metrics.estimateAccuracy.displayValue}
                  formula={individualReport.metrics.estimateAccuracy.formula}
                  inputs={individualReport.metrics.estimateAccuracy.inputs}
                  percentage={individualReport.metrics.estimateAccuracy.value.accuracyRatio}
                />

                {/* Metric 4: Consistency */}
                <MetricCard
                  title="Active Consistency"
                  subtitle="Ratio of active days and weekly execution balance"
                  displayValue={individualReport.metrics.consistency.displayValue}
                  formula={individualReport.metrics.consistency.formula}
                  inputs={individualReport.metrics.consistency.inputs}
                  percentage={individualReport.metrics.consistency.value.activeDaysRatio}
                />

                {/* Plan Comparison Section */}
                <PlanComparisonTab planComparison={individualReport.metrics.planComparison} />

                {/* Retrospective AI Insights */}
                <ReportInsightsList insights={individualReport.insights} />
              </View>
            ) : isIndividualLoading || isCycleLoading ? (
              <View style={styles.loadingContainer}>
                <Text variant="body" color="ash">
                  Loading report...
                </Text>
              </View>
            ) : (
              <EmptyState
                title="No report generated yet"
                message="Reports are computed automatically during cycle execution and completed phases."
              />
            )}
          </View>
        ) : (
          <View>
            <GroupReportTab
              groupReport={groupReport ?? null}
              onOpenSharingSettings={() => setIsSharingOpen(true)}
            />
          </View>
        )}
      </ScrollView>

      {/* Sheets */}
      <SharingSheet
        visible={isSharingOpen}
        onClose={() => setIsSharingOpen(false)}
        initialSettings={individualReport?.sharingSettings}
        onSave={async (settings) => {
          await updateSharingMutation.mutateAsync(settings);
        }}
        isSaving={updateSharingMutation.isPending}
      />

      <RegenerateSheet
        visible={isRegenerateOpen}
        onClose={() => setIsRegenerateOpen(false)}
        onRegenerate={async (note) => {
          await regenerateMutation.mutateAsync({ note });
        }}
        isSubmitting={regenerateMutation.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.void,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.unit * 4,
    paddingTop: spacing.unit * 4,
    paddingBottom: spacing.unit * 2,
  },
  backButton: {
    padding: spacing.unit,
    marginRight: spacing.unit * 2,
  },
  titleContainer: {
    flex: 1,
  },
  subtitle: {
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    backgroundColor: colors.void,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.unit * 4,
    alignItems: 'center',
    position: 'relative',
  },
  tabButtonActive: {
    backgroundColor: colors.wash,
  },
  activeBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.flare,
  },
  tabLabel: {
    fontSize: 16,
  },
  tabLabelActive: {
    color: colors.ink,
    fontFamily: 'PublicSans_600SemiBold',
  },
  tabLabelInactive: {
    color: colors.ash,
    fontFamily: 'PublicSans_400Regular',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.unit * 4,
    paddingBottom: spacing.unit * 8,
  },
  actionBar: {
    flexDirection: 'row',
    gap: spacing.unit * 2,
    marginBottom: spacing.unit * 4,
    justifyContent: 'flex-end',
  },
  actionBtn: {
    height: 38,
    paddingHorizontal: spacing.unit * 3,
  },
  loadingContainer: {
    padding: spacing.unit * 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
