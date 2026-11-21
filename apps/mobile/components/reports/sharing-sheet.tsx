import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import type { MemberSharingSettings } from '@mp/shared';
import { Sheet, Text, Button, Divider } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';

export interface SharingSheetProps {
  visible: boolean;
  onClose: () => void;
  initialSettings?: MemberSharingSettings | null;
  onSave: (settings: MemberSharingSettings) => Promise<void>;
  isSaving?: boolean;
}

export function SharingSheet({
  visible,
  onClose,
  initialSettings,
  onSave,
  isSaving = false,
}: SharingSheetProps): React.ReactElement {
  const [settings, setSettings] = useState<MemberSharingSettings>({
    shareAchievementRate: true,
    shareCompletedTasksCount: true,
    shareConsistencyScore: true,
    shareGoalTitles: false,
  });

  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
    }
  }, [initialSettings]);

  const toggleSetting = (key: keyof MemberSharingSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    await onSave(settings);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Group Sharing Privacy">
      <View style={styles.content}>
        <Text variant="small" color="ash" style={styles.description}>
          Choose which performance metrics are visible to other members in the group retrospective
          report. Group averages only aggregate shared metrics.
        </Text>

        <Divider style={styles.divider} />

        {/* Toggle 1: Achievement */}
        <Pressable
          style={styles.toggleRow}
          onPress={() => toggleSetting('shareAchievementRate')}
          accessibilityRole="switch"
          accessibilityLabel="Share achievement rate"
          accessibilityState={{ checked: settings.shareAchievementRate }}
        >
          <View style={styles.labelBlock}>
            <Text variant="body" style={styles.toggleLabel}>
              Achievement rate
            </Text>
            <Text variant="small" color="ash">
              Overall percentage achievement score
            </Text>
          </View>
          <View
            style={[
              styles.switchPill,
              settings.shareAchievementRate ? styles.switchActive : styles.switchInactive,
            ]}
          >
            <Text
              variant="micro"
              style={
                settings.shareAchievementRate ? styles.switchTextActive : styles.switchTextInactive
              }
            >
              {settings.shareAchievementRate ? 'Shared' : 'Hidden'}
            </Text>
          </View>
        </Pressable>

        {/* Toggle 2: Task Count */}
        <Pressable
          style={styles.toggleRow}
          onPress={() => toggleSetting('shareCompletedTasksCount')}
          accessibilityRole="switch"
          accessibilityLabel="Share completed task counts"
          accessibilityState={{ checked: settings.shareCompletedTasksCount }}
        >
          <View style={styles.labelBlock}>
            <Text variant="body" style={styles.toggleLabel}>
              Completed task count
            </Text>
            <Text variant="small" color="ash">
              Number of finished scheduled tasks
            </Text>
          </View>
          <View
            style={[
              styles.switchPill,
              settings.shareCompletedTasksCount ? styles.switchActive : styles.switchInactive,
            ]}
          >
            <Text
              variant="micro"
              style={
                settings.shareCompletedTasksCount
                  ? styles.switchTextActive
                  : styles.switchTextInactive
              }
            >
              {settings.shareCompletedTasksCount ? 'Shared' : 'Hidden'}
            </Text>
          </View>
        </Pressable>

        {/* Toggle 3: Consistency */}
        <Pressable
          style={styles.toggleRow}
          onPress={() => toggleSetting('shareConsistencyScore')}
          accessibilityRole="switch"
          accessibilityLabel="Share consistency score"
          accessibilityState={{ checked: settings.shareConsistencyScore }}
        >
          <View style={styles.labelBlock}>
            <Text variant="body" style={styles.toggleLabel}>
              Consistency rate
            </Text>
            <Text variant="small" color="ash">
              Active cycle days & weekly pace
            </Text>
          </View>
          <View
            style={[
              styles.switchPill,
              settings.shareConsistencyScore ? styles.switchActive : styles.switchInactive,
            ]}
          >
            <Text
              variant="micro"
              style={
                settings.shareConsistencyScore ? styles.switchTextActive : styles.switchTextInactive
              }
            >
              {settings.shareConsistencyScore ? 'Shared' : 'Hidden'}
            </Text>
          </View>
        </Pressable>

        {/* Toggle 4: Goal Titles */}
        <Pressable
          style={styles.toggleRow}
          onPress={() => toggleSetting('shareGoalTitles')}
          accessibilityRole="switch"
          accessibilityLabel="Share goal titles"
          accessibilityState={{ checked: settings.shareGoalTitles }}
        >
          <View style={styles.labelBlock}>
            <Text variant="body" style={styles.toggleLabel}>
              Goal titles
            </Text>
            <Text variant="small" color="ash">
              Names of your submitted goals
            </Text>
          </View>
          <View
            style={[
              styles.switchPill,
              settings.shareGoalTitles ? styles.switchActive : styles.switchInactive,
            ]}
          >
            <Text
              variant="micro"
              style={settings.shareGoalTitles ? styles.switchTextActive : styles.switchTextInactive}
            >
              {settings.shareGoalTitles ? 'Shared' : 'Hidden'}
            </Text>
          </View>
        </Pressable>

        <View style={styles.actionsContainer}>
          <Button
            label="Save preferences"
            variant="primary"
            onPress={handleSave}
            loading={isSaving}
            accessibilityLabel="Save sharing preferences"
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.unit * 5,
  },
  description: {
    marginBottom: spacing.unit * 4,
  },
  divider: {
    marginBottom: spacing.unit * 4,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.unit * 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.wash,
  },
  labelBlock: {
    flex: 1,
    marginRight: spacing.unit * 4,
  },
  toggleLabel: {
    color: colors.ink,
    marginBottom: 2,
  },
  switchPill: {
    paddingHorizontal: spacing.unit * 2,
    paddingVertical: 4,
    borderRadius: radius.input,
    minWidth: 64,
    alignItems: 'center',
  },
  switchActive: {
    backgroundColor: colors.signal,
  },
  switchInactive: {
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  switchTextActive: {
    color: colors.ink,
    fontFamily: 'PublicSans_600SemiBold',
  },
  switchTextInactive: {
    color: colors.ash,
    fontFamily: 'PublicSans_400Regular',
  },
  actionsContainer: {
    marginTop: spacing.unit * 6,
  },
});
