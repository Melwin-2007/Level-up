import React, { useState } from 'react';
import { Pressable, RefreshControl, Share, StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  Divider,
  EmptyState,
  ErrorBar,
  Field,
  Input,
  Row,
  Screen,
  Sheet,
  Text,
  Title,
} from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';
import { useCreateGroup, useGroup, useGroups, useJoinGroup } from '@/hooks/use-groups';
import { mapApiError } from '@/services/api';

export default function GroupScreen(): React.ReactNode {
  const {
    data: groupsData,
    isLoading: groupsLoading,
    error: groupsError,
    refetch: refetchGroups,
  } = useGroups();

  const groups = groupsData?.items ?? [];
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const activeGroupId = selectedGroupId || (groups[0]?.id ?? null);
  const {
    data: activeGroup,
    isLoading: activeGroupLoading,
    refetch: refetchActiveGroup,
  } = useGroup(activeGroupId || undefined);

  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const [joinSheetOpen, setJoinSheetOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  const createGroupMutation = useCreateGroup();
  const joinGroupMutation = useJoinGroup();

  const handleRefresh = async () => {
    await Promise.all([refetchGroups(), refetchActiveGroup()]);
  };

  const handleCreateGroup = async () => {
    setCreateError(null);
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      setCreateError('Group name cannot be empty');
      return;
    }

    try {
      const created = await createGroupMutation.mutateAsync({ name: trimmed });
      setSelectedGroupId(created.id);
      setNewGroupName('');
      setCreateSheetOpen(false);
    } catch (err) {
      setCreateError(mapApiError(err));
    }
  };

  const handleJoinGroup = async () => {
    setJoinError(null);
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      setJoinError('Invite code is required');
      return;
    }

    try {
      const joined = await joinGroupMutation.mutateAsync({ inviteCode: code });
      setSelectedGroupId(joined.id);
      setInviteCode('');
      setJoinSheetOpen(false);
    } catch (err) {
      setJoinError(mapApiError(err));
    }
  };

  const handleShareInviteCode = async (code: string) => {
    try {
      await Share.share({
        message: `Join my group on Monthly with invite code: ${code}`,
      });
    } catch {
      // share cancelled or failed
    }
  };

  return (
    <Screen
      scrollable={true}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={groupsLoading || activeGroupLoading}
          onRefresh={handleRefresh}
          tintColor={colors.flare}
        />
      }
    >
      <View style={styles.topBar}>
        <Title>Groups</Title>
        <View style={styles.topActions}>
          <Button
            label="Join"
            variant="secondary"
            onPress={() => {
              setJoinError(null);
              setInviteCode('');
              setJoinSheetOpen(true);
            }}
          />
          <Button
            label="Create"
            variant="primary"
            onPress={() => {
              setCreateError(null);
              setNewGroupName('');
              setCreateSheetOpen(true);
            }}
          />
        </View>
      </View>

      {groupsError ? (
        <View style={styles.errorContainer}>
          <ErrorBar message={mapApiError(groupsError)} onDismiss={() => void refetchGroups()} />
        </View>
      ) : null}

      {groupsLoading ? (
        <View style={styles.loadingPlaceholder} />
      ) : groups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            message="Create a group or join one with an invite code."
            actionLabel="Create a group"
            onAction={() => setCreateSheetOpen(true)}
          />
        </View>
      ) : (
        <View style={styles.content}>
          {groups.length > 1 ? (
            <View style={styles.groupSelector}>
              <Text variant="small" color="ash">
                Select group
              </Text>
              <View style={styles.groupPills}>
                {groups.map((g) => (
                  <Pressable
                    key={g.id}
                    style={[styles.groupPill, g.id === activeGroupId && styles.groupPillActive]}
                    accessibilityRole="button"
                    accessibilityLabel={g.name}
                    onPress={() => setSelectedGroupId(g.id)}
                  >
                    <Text variant="small" color={g.id === activeGroupId ? 'flare' : 'ink'}>
                      {g.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {activeGroupLoading ? (
            <View style={styles.loadingPlaceholder} />
          ) : activeGroup ? (
            <View style={styles.detailSection}>
              <View style={styles.groupHeader}>
                <Title>{activeGroup.name}</Title>
                <Text variant="small" color="ash">
                  Role: {activeGroup.role}
                </Text>
              </View>

              {activeGroup.inviteCode ? (
                <View style={styles.inviteBox}>
                  <View style={styles.inviteTextCol}>
                    <Text variant="micro" color="ash">
                      Invite code
                    </Text>
                    <Text variant="title" color="flare" tabularNums={true}>
                      {activeGroup.inviteCode}
                    </Text>
                  </View>
                  <Button
                    label="Share"
                    variant="secondary"
                    onPress={() => handleShareInviteCode(activeGroup.inviteCode!)}
                  />
                </View>
              ) : null}

              <Divider style={styles.divider} />

              <View style={styles.membersSection}>
                <Text variant="heading" color="ink" style={styles.sectionHeader}>
                  Members ({activeGroup.members.length})
                </Text>
                {activeGroup.members.map((m) => (
                  <View key={m.userId}>
                    <Row style={styles.memberRow}>
                      <View style={styles.memberLeft}>
                        <Avatar name={m.displayName} size={36} />
                        <View style={styles.memberNameCol}>
                          <Text variant="body" color="ink">
                            {m.displayName}
                          </Text>
                          <Text variant="micro" color="ash">
                            {m.role}
                          </Text>
                        </View>
                      </View>
                    </Row>
                    <Divider />
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      )}

      {/* Create Group Sheet */}
      <Sheet
        visible={createSheetOpen}
        onClose={() => setCreateSheetOpen(false)}
        title="Create group"
      >
        <View style={styles.sheetForm}>
          {createError ? (
            <ErrorBar message={createError} onDismiss={() => setCreateError(null)} />
          ) : null}
          <Field label="Group name">
            <Input
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="For example Focus Friends"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={60}
            />
          </Field>
          <View style={styles.sheetActions}>
            <Button
              label="Create group"
              variant="primary"
              loading={createGroupMutation.isPending}
              onPress={handleCreateGroup}
            />
          </View>
        </View>
      </Sheet>

      {/* Join Group Sheet */}
      <Sheet visible={joinSheetOpen} onClose={() => setJoinSheetOpen(false)} title="Join group">
        <View style={styles.sheetForm}>
          {joinError ? <ErrorBar message={joinError} onDismiss={() => setJoinError(null)} /> : null}
          <Field label="Invite code" hint="8 characters from group owner">
            <Input
              value={inviteCode}
              onChangeText={(text) => setInviteCode(text.toUpperCase())}
              placeholder="ABCDEF23"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
            />
          </Field>
          <View style={styles.sheetActions}>
            <Button
              label="Join group"
              variant="primary"
              loading={joinGroupMutation.isPending}
              onPress={handleJoinGroup}
            />
          </View>
        </View>
      </Sheet>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.unit * 6,
  },
  topActions: {
    flexDirection: 'row',
    gap: spacing.unit * 3,
  },
  errorContainer: {
    marginBottom: spacing.unit * 4,
  },
  loadingPlaceholder: {
    height: 1,
    backgroundColor: colors.rule,
    marginVertical: spacing.unit * 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.unit * 12,
  },
  content: {
    flex: 1,
  },
  groupSelector: {
    gap: spacing.unit * 2,
    marginBottom: spacing.unit * 6,
  },
  groupPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.unit * 2,
  },
  groupPill: {
    paddingHorizontal: spacing.unit * 4,
    paddingVertical: spacing.unit * 2,
    backgroundColor: colors.wash,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  groupPillActive: {
    borderColor: colors.flare,
  },
  detailSection: {
    gap: spacing.unit * 4,
  },
  groupHeader: {
    gap: spacing.unit * 1,
  },
  inviteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.wash,
    padding: spacing.unit * 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  inviteTextCol: {
    gap: spacing.unit * 1,
  },
  divider: {
    marginVertical: spacing.unit * 2,
  },
  membersSection: {
    gap: spacing.unit * 2,
  },
  sectionHeader: {
    marginBottom: spacing.unit * 2,
  },
  memberRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: spacing.unit * 2,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit * 3,
  },
  memberNameCol: {
    gap: spacing.unit * 0.5,
  },
  sheetForm: {
    gap: spacing.unit * 4,
    paddingTop: spacing.unit * 2,
  },
  sheetActions: {
    marginTop: spacing.unit * 4,
  },
});
