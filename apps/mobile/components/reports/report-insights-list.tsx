import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ReportInsight } from '@mp/shared';
import { Text, Divider } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';

export interface ReportInsightsListProps {
  insights?: ReportInsight[] | null;
}

const METRIC_LABELS: Record<string, string> = {
  weighted_achievement: 'Achievement',
  task_execution: 'Task execution',
  estimate_accuracy: 'Estimate accuracy',
  consistency: 'Consistency',
  plan_comparison: 'Plan comparison',
};

export function ReportInsightsList({
  insights,
}: ReportInsightsListProps): React.ReactElement | null {
  if (!insights || insights.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text variant="heading" style={styles.headerTitle}>
        Retrospective Insights
      </Text>
      <Text variant="small" color="ash" style={styles.headerSubtitle}>
        Evidence-backed observations citing your verified cycle metrics.
      </Text>

      <View style={styles.card}>
        {insights.map((insight, index) => (
          <View key={insight.id || index} style={styles.insightBlock}>
            {index > 0 ? <Divider style={styles.divider} /> : null}

            <Text variant="heading" style={styles.insightTitle}>
              {insight.title}
            </Text>

            <View style={styles.section}>
              <Text variant="micro" color="ash" style={styles.sectionTag}>
                Observation
              </Text>
              <Text variant="body" style={styles.sectionText}>
                {insight.observation}
              </Text>
            </View>

            <View style={styles.section}>
              <Text variant="micro" color="ash" style={styles.sectionTag}>
                Recommendation
              </Text>
              <Text variant="body" style={styles.sectionText}>
                {insight.recommendation}
              </Text>
            </View>

            {/* Citations list */}
            {insight.citations && insight.citations.length > 0 ? (
              <View style={styles.citationsContainer}>
                <Text variant="micro" color="ash" style={styles.citationsHeader}>
                  Cited metrics:
                </Text>
                <View style={styles.citationsList}>
                  {insight.citations.map((c, i) => (
                    <View key={i} style={styles.citationBadge}>
                      <Text variant="micro" style={styles.citationText}>
                        {METRIC_LABELS[c.metricId] || c.metricId}: {c.metricValue}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.unit * 5,
  },
  headerTitle: {
    color: colors.ink,
  },
  headerSubtitle: {
    marginTop: 4,
    marginBottom: spacing.unit * 4,
  },
  card: {
    backgroundColor: colors.void,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.input,
    padding: spacing.unit * 4,
  },
  insightBlock: {
    marginVertical: spacing.unit,
  },
  divider: {
    marginBottom: spacing.unit * 4,
  },
  insightTitle: {
    color: colors.ink,
    marginBottom: spacing.unit,
  },
  section: {
    marginTop: spacing.unit,
  },
  sectionTag: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  sectionText: {
    color: colors.ink,
  },
  citationsContainer: {
    marginTop: spacing.unit * 2,
    paddingTop: spacing.unit,
  },
  citationsHeader: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  citationsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.unit,
  },
  citationBadge: {
    paddingHorizontal: spacing.unit * 2,
    paddingVertical: 2,
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.oxblood,
    borderRadius: radius.input,
  },
  citationText: {
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
});
