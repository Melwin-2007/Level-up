import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Shield } from 'lucide-react-native';
import type { GroupReportResponse } from '@mp/shared';
import { Text, Divider, Button } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';

export interface GroupReportTabProps {
  groupReport: GroupReportResponse | null;
  onOpenSharingSettings: () => void;
}

export function GroupReportTab({
  groupReport,
  onOpenSharingSettings,
}: GroupReportTabProps): React.ReactElement {
  if (!groupReport) {
    return (
      <View style={styles.emptyContainer}>
        <Text variant="heading" style={styles.emptyTitle}>
          No group report available
        </Text>
        <Text variant="body" color="ash" style={styles.emptyText}>
          Group aggregate reports are generated once cycle execution has started.
        </Text>
      </View>
    );
  }

  const { metrics } = groupReport;
  const avgAchievement = Math.max(0, Math.min(100, metrics.averageAchievementRate));
  const avgConsistency = Math.max(0, Math.min(100, metrics.averageConsistency));

  const accessibleGroupSummary = `Group report: ${Math.round(
    avgAchievement
  )}% average achievement, ${metrics.totalCompletedTasks} total tasks completed, ${Math.round(
    avgConsistency
  )}% average consistency, across ${metrics.participatingMembers} participating members of ${
    metrics.totalMembers
  }.`;

  return (
    <View style={styles.container} accessible accessibilityLabel={accessibleGroupSummary}>
      {/* Group Aggregates Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text variant="heading" style={styles.cardTitle}>
            Group Aggregates
          </Text>
          <Text variant="small" color="ash">
            {metrics.participatingMembers} of {metrics.totalMembers} active
          </Text>
        </View>

        {/* Dual Visual Bars */}
        <View style={styles.chartSection}>
          <View style={styles.barBlock}>
            <View style={styles.barLabelRow}>
              <Text variant="small" style={styles.barLabel}>
                Average achievement
              </Text>
              <Text variant="small" style={styles.barValue}>
                {Math.round(avgAchievement)}%
              </Text>
            </View>
            <Svg width="100%" height={8} viewBox="0 0 100 8">
              <Rect x="0" y="0" width="100" height="8" rx="2" fill={colors.wash} />
              <Rect
                x="0"
                y="0"
                width={avgAchievement}
                height="8"
                rx="2"
                fill={avgAchievement >= 80 ? colors.flare : colors.signal}
              />
            </Svg>
          </View>

          <View style={styles.barBlock}>
            <View style={styles.barLabelRow}>
              <Text variant="small" style={styles.barLabel}>
                Average consistency
              </Text>
              <Text variant="small" style={styles.barValue}>
                {Math.round(avgConsistency)}%
              </Text>
            </View>
            <Svg width="100%" height={8} viewBox="0 0 100 8">
              <Rect x="0" y="0" width="100" height="8" rx="2" fill={colors.wash} />
              <Rect x="0" y="0" width={avgConsistency} height="8" rx="2" fill={colors.oxblood} />
            </Svg>
          </View>
        </View>

        <Divider style={styles.cardDivider} />

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text variant="title" style={styles.statNumber}>
              {metrics.totalCompletedTasks}
            </Text>
            <Text variant="micro" color="ash">
              Tasks completed
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text variant="title" style={styles.statNumber}>
              {metrics.participatingMembers}
            </Text>
            <Text variant="micro" color="ash">
              Members reporting
            </Text>
          </View>
        </View>
      </View>

      {/* Member Privacy Control Banner */}
      <View style={styles.privacyBanner}>
        <View style={styles.privacyIconWrapper}>
          <Shield size={18} color={colors.ash} />
        </View>
        <View style={styles.privacyTextContainer}>
          <Text variant="small" style={styles.privacyHeading}>
            Privacy isolation enabled
          </Text>
          <Text variant="micro" color="ash">
            Each member chooses what to share with the group.
          </Text>
        </View>
        <Button
          label="Sharing"
          variant="secondary"
          onPress={onOpenSharingSettings}
          accessibilityLabel="Open sharing settings"
          style={styles.sharingButton}
        />
      </View>

      {/* Member Summaries */}
      <Text variant="heading" style={styles.sectionTitle}>
        Member Retrospectives
      </Text>

      {metrics.memberSummaries.map((member) => (
        <View
          key={member.userId}
          style={styles.memberCard}
          accessible
          accessibilityLabel={`Member ${member.displayName}: ${
            member.achievementRate !== null
              ? `${Math.round(member.achievementRate)}% achievement`
              : 'achievement private'
          }`}
        >
          <View style={styles.memberNameRow}>
            <Text variant="heading" style={styles.memberName}>
              {member.displayName}
            </Text>
          </View>

          <View style={styles.memberMetricsRow}>
            <View style={styles.memberMetricItem}>
              <Text variant="micro" color="ash">
                Achievement
              </Text>
              <Text variant="body" style={styles.memberMetricValue}>
                {member.achievementRate !== null
                  ? `${Math.round(member.achievementRate)}%`
                  : 'Private'}
              </Text>
            </View>

            <View style={styles.memberMetricItem}>
              <Text variant="micro" color="ash">
                Tasks
              </Text>
              <Text variant="body" style={styles.memberMetricValue}>
                {member.tasksCompleted !== null ? member.tasksCompleted : 'Private'}
              </Text>
            </View>

            <View style={styles.memberMetricItem}>
              <Text variant="micro" color="ash">
                Consistency
              </Text>
              <Text variant="body" style={styles.memberMetricValue}>
                {member.consistencyRate !== null
                  ? `${Math.round(member.consistencyRate)}%`
                  : 'Private'}
              </Text>
            </View>
          </View>

          {member.goalTitles && member.goalTitles.length > 0 ? (
            <View style={styles.goalsContainer}>
              <Text variant="micro" color="ash" style={styles.goalsTitle}>
                Shared goals:
              </Text>
              {member.goalTitles.map((g, idx) => (
                <Text key={idx} variant="small" style={styles.goalItem}>
                  · {g}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.unit * 5,
  },
  emptyContainer: {
    padding: spacing.unit * 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: colors.ink,
    marginBottom: spacing.unit * 2,
  },
  emptyText: {
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.void,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.input,
    padding: spacing.unit * 4,
    marginBottom: spacing.unit * 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.unit * 4,
  },
  cardTitle: {
    color: colors.ink,
  },
  chartSection: {
    gap: spacing.unit * 4,
    marginBottom: spacing.unit * 4,
  },
  barBlock: {
    gap: 4,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barLabel: {
    color: colors.ink,
  },
  barValue: {
    color: colors.flare,
    fontVariant: ['tabular-nums'],
  },
  cardDivider: {
    marginBottom: spacing.unit * 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.unit * 4,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.wash,
    borderRadius: radius.input,
    padding: spacing.unit * 2,
    alignItems: 'center',
  },
  statNumber: {
    color: colors.flare,
    fontVariant: ['tabular-nums'],
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.input,
    padding: spacing.unit * 2,
    marginBottom: spacing.unit * 5,
  },
  privacyIconWrapper: {
    marginRight: spacing.unit * 2,
  },
  privacyTextContainer: {
    flex: 1,
  },
  privacyHeading: {
    color: colors.ink,
    fontFamily: 'PublicSans_600SemiBold',
  },
  sharingButton: {
    height: 36,
    paddingHorizontal: spacing.unit * 2,
  },
  sectionTitle: {
    color: colors.ink,
    marginBottom: spacing.unit * 4,
  },
  memberCard: {
    backgroundColor: colors.void,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.input,
    padding: spacing.unit * 4,
    marginBottom: spacing.unit * 2,
  },
  memberNameRow: {
    marginBottom: spacing.unit,
  },
  memberName: {
    color: colors.ink,
  },
  memberMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.unit,
    borderTopWidth: 1,
    borderTopColor: colors.wash,
  },
  memberMetricItem: {
    flex: 1,
  },
  memberMetricValue: {
    color: colors.ink,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  goalsContainer: {
    marginTop: spacing.unit,
    paddingTop: spacing.unit,
    borderTopWidth: 1,
    borderTopColor: colors.wash,
  },
  goalsTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  goalItem: {
    color: colors.ink,
    paddingVertical: 1,
  },
});
