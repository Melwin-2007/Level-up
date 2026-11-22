import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TrendingUp, BarChart2, CheckCircle2 } from 'lucide-react-native';
import type { MonthOverMonthResponse } from '@mp/shared';
import { colors, radius, spacing } from '@/theme/tokens';
import { Text } from '@/components/ui/text';

export interface TrendsCardProps {
  analytics?: MonthOverMonthResponse | null;
}

export const TrendsCard: React.FC<TrendsCardProps> = ({ analytics }) => {
  if (!analytics) return null;

  if (analytics.status === 'insufficient_data') {
    return (
      <View style={styles.card} testID="analytics-insufficient-card">
        <View style={styles.headerRow}>
          <BarChart2 size={18} color={colors.ash} />
          <Text variant="heading" color="ink" style={styles.headerTitle}>
            Longitudinal Trends
          </Text>
        </View>
        <Text variant="small" color="ash" style={styles.insufficientText}>
          Month-over-month trend analytics require at least 2 completed monthly cycles.
        </Text>
        <View style={styles.progressCounter}>
          <Text variant="micro" color="ash">
            Completed: {analytics.completedCyclesCount} / {analytics.requiredCyclesCount} cycles
          </Text>
        </View>
      </View>
    );
  }

  const { summary, cycleTrends, categoryBreakdown, observations } = analytics;

  return (
    <View style={styles.card} testID="analytics-trends-card">
      <View style={styles.headerRow}>
        <TrendingUp size={18} color={colors.flare} />
        <Text variant="heading" color="ink" style={styles.headerTitle}>
          Month-over-Month Trends
        </Text>
      </View>

      {/* Progression Summary Badges */}
      {summary ? (
        <View style={styles.progressionRow}>
          <View style={styles.progressionChip}>
            <Text variant="micro" color="ash">
              Achievement
            </Text>
            <Text
              variant="heading"
              style={[
                styles.progressionValue,
                {
                  color: summary.achievementProgression >= 0 ? colors.flare : colors.ash,
                },
              ]}
            >
              {summary.achievementProgression >= 0
                ? `+${summary.achievementProgression}%`
                : `${summary.achievementProgression}%`}
            </Text>
          </View>

          <View style={styles.progressionChip}>
            <Text variant="micro" color="ash">
              Accuracy
            </Text>
            <Text
              variant="heading"
              style={[
                styles.progressionValue,
                {
                  color: summary.accuracyProgression >= 0 ? colors.flare : colors.ash,
                },
              ]}
            >
              {summary.accuracyProgression >= 0
                ? `+${summary.accuracyProgression}%`
                : `${summary.accuracyProgression}%`}
            </Text>
          </View>

          <View style={styles.progressionChip}>
            <Text variant="micro" color="ash">
              Consistency
            </Text>
            <Text
              variant="heading"
              style={[
                styles.progressionValue,
                {
                  color: summary.consistencyProgression >= 0 ? colors.flare : colors.ash,
                },
              ]}
            >
              {summary.consistencyProgression >= 0
                ? `+${summary.consistencyProgression}%`
                : `${summary.consistencyProgression}%`}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Historical Cycles List */}
      <View style={styles.sectionBlock}>
        <Text variant="small" color="ash" style={styles.subheading}>
          Cycle Performance History
        </Text>
        <View style={styles.cycleTable}>
          {cycleTrends.map((c) => (
            <View key={c.cycleId} style={styles.cycleRow}>
              <View style={styles.cycleLabelCol}>
                <Text variant="small" color="ink" style={styles.cycleLabel}>
                  {c.label}
                </Text>
                <Text variant="micro" color="ash">
                  {c.totalTasksCompleted} tasks completed
                </Text>
              </View>

              <View style={styles.cycleMetricsCol}>
                <View style={styles.metricPair}>
                  <Text variant="micro" color="ash">
                    Achieve
                  </Text>
                  <Text variant="small" color="ink">
                    {c.weightedAchievement}%
                  </Text>
                </View>

                <View style={styles.metricPair}>
                  <Text variant="micro" color="ash">
                    Accur
                  </Text>
                  <Text variant="small" color="ink">
                    {c.estimateAccuracy}%
                  </Text>
                </View>

                <View style={styles.metricPair}>
                  <Text variant="micro" color="ash">
                    Consist
                  </Text>
                  <Text variant="small" color="ink">
                    {c.consistency}%
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Goal Category Breakdown */}
      {categoryBreakdown && categoryBreakdown.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text variant="small" color="ash" style={styles.subheading}>
            Goal Category Performance
          </Text>
          <View style={styles.categoriesList}>
            {categoryBreakdown.map((cat) => (
              <View key={cat.category} style={styles.categoryRow}>
                <View style={styles.categoryInfo}>
                  <Text variant="small" color="ink">
                    {cat.category}
                  </Text>
                  <Text variant="micro" color="ash">
                    {cat.totalGoals} goals · {cat.successRate}% met
                  </Text>
                </View>
                <Text variant="small" color="flare" style={styles.categoryScore}>
                  {cat.averageScore}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Observations */}
      {observations && observations.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text variant="small" color="ash" style={styles.subheading}>
            Longitudinal Insights
          </Text>
          <View style={styles.observationsList}>
            {observations.map((obs) => (
              <View key={obs.id} style={styles.observationRow}>
                <CheckCircle2 size={14} color={colors.flare} style={styles.obsIcon} />
                <Text variant="micro" color="ink" style={styles.obsText}>
                  {obs.text}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.wash,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: spacing.unit * 4,
    marginVertical: spacing.unit * 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.unit * 3,
  },
  headerTitle: {
    marginLeft: spacing.unit * 2,
  },
  insufficientText: {
    lineHeight: 20,
    marginBottom: spacing.unit * 3,
  },
  progressCounter: {
    backgroundColor: colors.void,
    paddingHorizontal: spacing.unit * 3,
    paddingVertical: spacing.unit * 2,
    borderRadius: radius.cell,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.rule,
  },
  progressionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.unit * 4,
  },
  progressionChip: {
    flex: 1,
    backgroundColor: colors.void,
    padding: spacing.unit * 2,
    borderRadius: radius.cell,
    marginHorizontal: spacing.unit,
    borderWidth: 1,
    borderColor: colors.rule,
    alignItems: 'center',
  },
  progressionValue: {
    marginTop: spacing.unit,
  },
  sectionBlock: {
    marginTop: spacing.unit * 3,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    paddingTop: spacing.unit * 3,
  },
  subheading: {
    marginBottom: spacing.unit * 2,
  },
  cycleTable: {
    backgroundColor: colors.void,
    borderRadius: radius.cell,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  cycleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.unit * 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  cycleLabelCol: {
    flex: 1,
  },
  cycleLabel: {
    fontFamily: 'PublicSans_600SemiBold',
  },
  cycleMetricsCol: {
    flexDirection: 'row',
  },
  metricPair: {
    alignItems: 'center',
    marginLeft: spacing.unit * 3,
  },
  categoriesList: {
    backgroundColor: colors.void,
    borderRadius: radius.cell,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.unit * 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryScore: {
    fontFamily: 'PublicSans_600SemiBold',
  },
  observationsList: {
    marginTop: spacing.unit,
  },
  observationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.unit * 2,
  },
  obsIcon: {
    marginTop: 2,
    marginRight: spacing.unit * 2,
  },
  obsText: {
    flex: 1,
    lineHeight: 18,
  },
});
