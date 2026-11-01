import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Screen, Title, Text, EmptyState, MonthStrip } from '@/components/ui';
import { spacing } from '@/theme/tokens';
import { useSessionStore } from '@/stores/session';

export default function CycleScreen(): React.ReactNode {
  const profile = useSessionStore((s) => s.profile);
  const now = new Date();

  return (
    <Screen scrollable={true} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Title>{profile?.displayName || 'Cycle'}</Title>
        <Text variant="small" color="ash" style={styles.subtitle}>
          Overview for current planning month
        </Text>
      </View>

      <View style={styles.monthStripContainer}>
        <MonthStrip
          year={now.getFullYear()}
          month={now.getMonth() + 1}
          today={now.getDate()}
          markers={[]}
        />
      </View>

      <View style={styles.content}>
        <EmptyState
          message="Nobody has started a cycle for this month. Owners and admins can start one."
          actionLabel="Refresh"
          onAction={() => {
            void useSessionStore.getState().fetchProfile();
          }}
        />
      </View>
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
    marginBottom: spacing.unit * 6,
  },
  subtitle: {
    marginTop: spacing.unit * 1,
  },
  monthStripContainer: {
    marginBottom: spacing.unit * 8,
  },
  content: {
    marginTop: spacing.unit * 4,
  },
});
