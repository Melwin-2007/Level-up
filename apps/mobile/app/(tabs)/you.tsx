import React, { useState } from 'react';
import { View, StyleSheet, Alert, RefreshControl } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Flame, Award, CheckCircle2 } from 'lucide-react-native';
import { Screen, Title, Text, Row, Divider, Avatar, Button } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';
import { useSessionStore } from '@/stores/session';
import { useGamification } from '@/hooks/use-gamification';

export default function YouScreen(): React.ReactNode {
  const profile = useSessionStore((s) => s.profile);
  const signOut = useSessionStore((s) => s.signOut);
  const [signingOut, setSigningOut] = useState(false);

  const { data: gamification, refetch, isRefetching } = useGamification();

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      Alert.alert('Sign out', 'Could not sign out. Check your connection.');
    } finally {
      setSigningOut(false);
    }
  };

  const level = gamification?.level;
  const streak = gamification?.streak;
  const achievements = gamification?.achievements ?? [];

  const progressPercent = level ? Math.round(level.progressRatio * 100) : 0;

  return (
    <Screen
      scrollable={true}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={colors.flare}
        />
      }
    >
      {/* Header Profile */}
      <View style={styles.header}>
        <Avatar name={profile?.displayName || 'User'} size={48} />
        <View style={styles.headerInfo}>
          <Title>{profile?.displayName || 'Your profile'}</Title>
          <Text variant="small" color="ash">
            Member
          </Text>
        </View>
      </View>

      <Divider />

      {/* Level & XP Progression */}
      {level ? (
        <View style={styles.gamificationSection} testID="gamification-level-section">
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text variant="heading" color="ink">
                Level {level.level}
              </Text>
              <Text variant="micro" color="ash" style={styles.xpSubtext}>
                {level.totalXp} total XP
              </Text>
            </View>
            <Text variant="title" style={styles.levelBadgeText}>
              L{level.level}
            </Text>
          </View>

          <View style={styles.progressBarContainer}>
            <Svg width="100%" height={8} viewBox="0 0 100 8">
              <Rect x="0" y="0" width="100" height="8" rx="2" fill={colors.wash} />
              <Rect
                x="0"
                y="0"
                width={progressPercent}
                height="8"
                rx="2"
                fill={progressPercent >= 80 ? colors.flare : colors.signal}
              />
            </Svg>
            <View style={styles.progressTextRow}>
              <Text variant="micro" color="ash">
                {level.xpIntoCurrentLevel} / {level.xpNeededForNextLevel} XP to Level{' '}
                {level.level + 1}
              </Text>
              <Text variant="micro" color="ash">
                {progressPercent}%
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Daily Streak */}
      {streak ? (
        <View style={styles.streakCard} testID="gamification-streak-card">
          <View style={styles.streakIconCol}>
            <Flame size={24} color={streak.activeToday ? colors.flare : colors.ash} />
          </View>
          <View style={styles.streakTextCol}>
            <View style={styles.streakHeaderRow}>
              <Text variant="heading" color="ink">
                {streak.currentStreak} day streak
              </Text>
              <Text variant="micro" color="ash">
                Best: {streak.longestStreak}d
              </Text>
            </View>
            <Text variant="small" color="ash" style={styles.streakSubtext}>
              {streak.activeToday
                ? 'Streak completed for today'
                : 'Complete a task today to extend your streak'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Secondary Achievements List */}
      {achievements.length > 0 ? (
        <View style={styles.achievementsSection} testID="gamification-achievements-section">
          <View style={styles.achievementsHeader}>
            <Award size={16} color={colors.ash} />
            <Text variant="small" color="ash" style={styles.achievementsTitle}>
              Achievements
            </Text>
          </View>

          <View style={styles.achievementsList}>
            {achievements.map((ach) => (
              <View key={ach.id} style={styles.achievementRow}>
                <View style={styles.achievementStatusIcon}>
                  {ach.isUnlocked ? (
                    <CheckCircle2 size={16} color={colors.flare} />
                  ) : (
                    <View style={styles.lockedSquare} />
                  )}
                </View>

                <View style={styles.achievementContent}>
                  <View style={styles.achievementTitleRow}>
                    <Text
                      variant="small"
                      style={ach.isUnlocked ? styles.achTitleUnlocked : styles.achTitleLocked}
                    >
                      {ach.title}
                    </Text>
                    <Text variant="micro" color="ash">
                      +{ach.xpReward} XP
                    </Text>
                  </View>
                  <Text variant="micro" color="ash" style={styles.achDesc}>
                    {ach.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Divider />

      {/* Profile Details */}
      <View style={styles.section}>
        <Row style={styles.rowContent}>
          <Text variant="body" color="ash">
            Display name
          </Text>
          <Text variant="body" color="ink">
            {profile?.displayName || 'Not set'}
          </Text>
        </Row>
        <Divider />
        <Row style={styles.rowContent}>
          <Text variant="body" color="ash">
            Timezone
          </Text>
          <Text variant="body" color="ink">
            {profile?.timezone || 'Not set'}
          </Text>
        </Row>
      </View>

      <Divider />

      {/* Sign Out */}
      <View style={styles.actions}>
        <Button label="Sign out" variant="secondary" loading={signingOut} onPress={handleSignOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.unit * 10,
    paddingBottom: spacing.unit * 8,
    flexGrow: 1,
    backgroundColor: colors.void,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit * 4,
    marginBottom: spacing.unit * 4,
  },
  headerInfo: {
    flex: 1,
    gap: spacing.unit * 1,
  },
  gamificationSection: {
    paddingVertical: spacing.unit * 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.unit * 2,
  },
  xpSubtext: {
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  levelBadgeText: {
    color: colors.flare,
    fontVariant: ['tabular-nums'],
  },
  progressBarContainer: {
    marginTop: spacing.unit,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.input,
    padding: spacing.unit * 3,
    marginBottom: spacing.unit * 4,
  },
  streakIconCol: {
    marginRight: spacing.unit * 3,
  },
  streakTextCol: {
    flex: 1,
  },
  streakHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakSubtext: {
    marginTop: 2,
  },
  achievementsSection: {
    marginBottom: spacing.unit * 4,
  },
  achievementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit,
    marginBottom: spacing.unit * 2,
  },
  achievementsTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  achievementsList: {
    gap: spacing.unit * 2,
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.unit,
  },
  achievementStatusIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: spacing.unit * 2,
  },
  lockedSquare: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 2,
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  achTitleUnlocked: {
    color: colors.ink,
    fontFamily: 'PublicSans_600SemiBold',
  },
  achTitleLocked: {
    color: colors.ash,
    fontFamily: 'PublicSans_400Regular',
  },
  achDesc: {
    marginTop: 2,
  },
  section: {
    marginVertical: spacing.unit * 4,
  },
  rowContent: {
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  actions: {
    marginTop: spacing.unit * 8,
  },
});
