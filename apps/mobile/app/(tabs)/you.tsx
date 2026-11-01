import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Screen, Title, Text, Row, Divider, Avatar, Button } from '@/components/ui';
import { spacing } from '@/theme/tokens';
import { useSessionStore } from '@/stores/session';

export default function YouScreen(): React.ReactNode {
  const profile = useSessionStore((s) => s.profile);
  const signOut = useSessionStore((s) => s.signOut);
  const [signingOut, setSigningOut] = useState(false);

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

  return (
    <Screen scrollable={true} contentContainerStyle={styles.container}>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit * 4,
    marginBottom: spacing.unit * 6,
  },
  headerInfo: {
    flex: 1,
    gap: spacing.unit * 1,
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
