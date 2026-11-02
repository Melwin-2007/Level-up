import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { updateProfileSchema, type UserProfile } from '@mp/shared';
import {
  Button,
  Divider,
  ErrorBar,
  Field,
  Input,
  Screen,
  Sheet,
  Text,
  Title,
} from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';
import { api, mapApiError } from '@/services/api';
import { useSessionStore } from '@/stores/session';

function getTimezones(): string[] {
  try {
    if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
      return Intl.supportedValuesOf('timeZone');
    }
  } catch {
    // fallback below
  }
  return [
    'Africa/Cairo',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/New_York',
    'America/Sao_Paulo',
    'America/Toronto',
    'Asia/Bangkok',
    'Asia/Dubai',
    'Asia/Hong_Kong',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Australia/Sydney',
    'Europe/Berlin',
    'Europe/London',
    'Europe/Paris',
    'Pacific/Auckland',
    'UTC',
  ];
}

const ALL_TIMEZONES = getTimezones();

export default function OnboardingScreen(): React.ReactNode {
  const router = useRouter();
  const setProfile = useSessionStore((s) => s.setProfile);

  const initialTimezone = useMemo(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected && ALL_TIMEZONES.includes(detected)) {
        return detected;
      }
    } catch {
      // fallback
    }
    return 'Asia/Kolkata';
  }, []);

  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState(initialTimezone);
  const [tzSheetOpen, setTzSheetOpen] = useState(false);
  const [tzSearchQuery, setTzSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredTimezones = useMemo(() => {
    const q = tzSearchQuery.trim().toLowerCase();
    if (!q) {
      return ALL_TIMEZONES.slice(0, 50);
    }
    return ALL_TIMEZONES.filter((tz) => tz.toLowerCase().includes(q)).slice(0, 50);
  }, [tzSearchQuery]);

  const handleSubmit = async () => {
    setError(null);
    const result = updateProfileSchema.safeParse({
      displayName,
      timezone,
    });

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      setError(firstIssue ? firstIssue.message : 'Check your inputs and try again.');
      return;
    }

    setLoading(true);
    try {
      const profile = await api.put<UserProfile>('/me', result.data);
      setProfile(profile);
      router.replace('/(tabs)');
    } catch (err) {
      setError(mapApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scrollable={true} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Title>Welcome to Monthly</Title>
        <Text variant="small" color="ash" style={styles.subtitle}>
          Set up your profile to start planning with your group
        </Text>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <ErrorBar message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      <View style={styles.form}>
        <Field label="Display name">
          <Input
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="For example Alex Chen"
            autoCapitalize="words"
            autoCorrect={false}
          />
        </Field>

        <View style={styles.tzContainer}>
          <Text variant="small" color="ash">
            Timezone
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Timezone: ${timezone}. Tap to change.`}
            style={styles.tzSelector}
            onPress={() => {
              setTzSearchQuery('');
              setTzSheetOpen(true);
            }}
          >
            <Text variant="body" color="ink">
              {timezone}
            </Text>
            <Text variant="small" color="ink">
              Change
            </Text>
          </Pressable>
          <Text variant="micro" color="ash">
            Used to compute your cycle and deadline timestamps.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button label="Save profile" variant="primary" loading={loading} onPress={handleSubmit} />
        </View>
      </View>

      <Sheet visible={tzSheetOpen} onClose={() => setTzSheetOpen(false)} title="Select timezone">
        <View style={styles.sheetContent}>
          <Input
            value={tzSearchQuery}
            onChangeText={setTzSearchQuery}
            placeholder="Search city or region..."
            autoCapitalize="none"
            autoCorrect={false}
          />
          <FlatList
            data={filteredTimezones}
            keyExtractor={(item) => item}
            style={styles.tzList}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={Divider}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item}
                style={[styles.tzItem, item === timezone && styles.tzItemSelected]}
                onPress={() => {
                  setTimezone(item);
                  setTzSheetOpen(false);
                }}
              >
                <Text variant="body" color={item === timezone ? 'flare' : 'ink'}>
                  {item}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.unit * 12,
    paddingBottom: spacing.unit * 8,
    flexGrow: 1,
  },
  header: {
    marginBottom: spacing.unit * 8,
  },
  subtitle: {
    marginTop: spacing.unit * 2,
  },
  errorContainer: {
    marginBottom: spacing.unit * 6,
  },
  form: {
    gap: spacing.unit * 6,
  },
  tzContainer: {
    gap: spacing.unit * 2,
  },
  tzSelector: {
    height: 48,
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 4,
    paddingHorizontal: spacing.unit * 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: {
    marginTop: spacing.unit * 6,
  },
  sheetContent: {
    gap: spacing.unit * 4,
    height: 360,
  },
  tzList: {
    flex: 1,
  },
  tzItem: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.unit * 2,
  },
  tzItemSelected: {
    backgroundColor: colors.wash,
  },
});
