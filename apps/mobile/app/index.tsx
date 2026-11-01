import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Divider, Screen, Text, Title } from '@/components/ui';
import { spacing } from '@/theme/tokens';

export default function IndexScreen(): React.ReactNode {
  const router = useRouter();

  return (
    <Screen scrollable={true}>
      <View style={styles.header}>
        <Title>Monthly</Title>
        <Text variant="body" color="ash" style={styles.subtitle}>
          Group accountability for friends.
        </Text>
      </View>

      <Divider style={styles.divider} />

      {__DEV__ && (
        <View style={styles.devSection}>
          <Text variant="small" color="ash" style={styles.devLabel}>
            Development tools
          </Text>
          <Button label="Open design kit" variant="secondary" onPress={() => router.push('/kit')} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.unit * 6,
    paddingBottom: spacing.unit * 4,
  },
  subtitle: {
    marginTop: spacing.unit * 2,
  },
  divider: {
    marginVertical: spacing.unit * 4,
  },
  devSection: {
    marginTop: spacing.unit * 4,
  },
  devLabel: {
    marginBottom: spacing.unit * 2,
  },
});
