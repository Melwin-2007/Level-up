import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { MetricResult, PlanComparisonMetric } from '@mp/shared';
import { Text, Divider } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';

export interface PlanComparisonTabProps {
  planComparison: MetricResult<PlanComparisonMetric>;
}

export function PlanComparisonTab({ planComparison }: PlanComparisonTabProps): React.ReactElement {
  const { baseline, currentPlan, scopeVariance } = planComparison.value;

  const baselineRate = Math.max(0, Math.min(100, baseline.completionRate));
  const currentRate = Math.max(0, Math.min(100, currentPlan.completionRate));

  const baselineHoursActual = (baseline.actualMinutes / 60).toFixed(1);
  const baselineHoursPlanned = (baseline.plannedMinutes / 60).toFixed(1);

  const currentHoursActual = (currentPlan.actualMinutes / 60).toFixed(1);
  const currentHoursPlanned = (currentPlan.plannedMinutes / 60).toFixed(1);

  const accessibleSummary = `Baseline plan completion: ${Math.round(
    baselineRate
  )}% (${baseline.completedTasks} of ${baseline.plannedTasks} tasks, ${baselineHoursActual}h of ${baselineHoursPlanned}h). Current reoptimized plan completion: ${Math.round(
    currentRate
  )}% (${currentPlan.completedTasks} of ${currentPlan.plannedTasks} tasks, ${currentHoursActual}h of ${currentHoursPlanned}h). Scope changes: ${scopeVariance.addedTasks} added, ${scopeVariance.removedTasks} removed, ${scopeVariance.rescheduledTasks} rescheduled.`;

  return (
    <View style={styles.container} accessible accessibilityLabel={accessibleSummary}>
      {/* Side-by-side performance bars */}
      <View style={styles.card}>
        <Text variant="heading" style={styles.cardTitle}>
          Plan Performance Comparison
        </Text>
        <Text variant="small" color="ash" style={styles.cardSubtitle}>
          Measuring adherence to your original baseline versus your approved reoptimized plan.
        </Text>

        {/* Visual Dual Bars */}
        <View style={styles.chartContainer}>
          {/* Baseline Bar */}
          <View style={styles.barRow}>
            <View style={styles.barLabelContainer}>
              <Text variant="small" style={styles.barLabel}>
                Baseline plan
              </Text>
              <Text variant="small" color="ash" style={styles.barRate}>
                {Math.round(baselineRate)}%
              </Text>
            </View>
            <Svg width="100%" height={10} viewBox="0 0 100 10">
              <Rect x="0" y="0" width="100" height="10" rx="2" fill={colors.wash} />
              <Rect x="0" y="0" width={baselineRate} height="10" rx="2" fill={colors.oxblood} />
            </Svg>
            <Text variant="micro" color="ash" style={styles.statLine}>
              {baseline.completedTasks} of {baseline.plannedTasks} tasks · {baselineHoursActual}h /{' '}
              {baselineHoursPlanned}h
            </Text>
          </View>

          {/* Current Plan Bar */}
          <View style={styles.barRow}>
            <View style={styles.barLabelContainer}>
              <Text variant="small" style={styles.barLabel}>
                Current plan
              </Text>
              <Text variant="small" color="ash" style={styles.barRate}>
                {Math.round(currentRate)}%
              </Text>
            </View>
            <Svg width="100%" height={10} viewBox="0 0 100 10">
              <Rect x="0" y="0" width="100" height="10" rx="2" fill={colors.wash} />
              <Rect
                x="0"
                y="0"
                width={currentRate}
                height="10"
                rx="2"
                fill={currentRate >= 80 ? colors.flare : colors.signal}
              />
            </Svg>
            <Text variant="micro" color="ash" style={styles.statLine}>
              {currentPlan.completedTasks} of {currentPlan.plannedTasks} tasks ·{' '}
              {currentHoursActual}h / {currentHoursPlanned}h
            </Text>
          </View>
        </View>

        <Divider />

        {/* Scope Changes Breakdown */}
        <View style={styles.scopeContainer}>
          <Text variant="small" color="ash" style={styles.scopeHeader}>
            Mid-Cycle Scope Changes
          </Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text variant="title" style={styles.statValue}>
                {scopeVariance.addedTasks}
              </Text>
              <Text variant="micro" color="ash">
                Tasks added
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text variant="title" style={styles.statValue}>
                {scopeVariance.removedTasks}
              </Text>
              <Text variant="micro" color="ash">
                Tasks removed
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text variant="title" style={styles.statValue}>
                {scopeVariance.rescheduledTasks}
              </Text>
              <Text variant="micro" color="ash">
                Rescheduled
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.unit * 5,
  },
  card: {
    backgroundColor: colors.void,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.input,
    padding: spacing.unit * 4,
  },
  cardTitle: {
    color: colors.ink,
  },
  cardSubtitle: {
    marginTop: 4,
    marginBottom: spacing.unit * 4,
  },
  chartContainer: {
    marginBottom: spacing.unit * 4,
    gap: spacing.unit * 4,
  },
  barRow: {
    gap: 4,
  },
  barLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barLabel: {
    color: colors.ink,
    fontFamily: 'PublicSans_600SemiBold',
  },
  barRate: {
    fontVariant: ['tabular-nums'],
  },
  statLine: {
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  scopeContainer: {
    marginTop: spacing.unit * 2,
  },
  scopeHeader: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.unit * 2,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.unit * 2,
  },
  statBox: {
    flex: 1,
    padding: spacing.unit * 2,
    backgroundColor: colors.wash,
    borderRadius: radius.input,
    alignItems: 'center',
  },
  statValue: {
    color: colors.flare,
    fontVariant: ['tabular-nums'],
    marginBottom: 2,
  },
});
