import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import type { PlanVersionResponse } from '@mp/shared';
import { Button, Divider, Sheet, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';
import { PlanDiffView } from './plan-diff-view';

export interface PlanVersionSheetProps {
  visible: boolean;
  onClose: () => void;
  versions: PlanVersionResponse[];
  onApproveVersion?: (versionId: string) => Promise<void>;
  approving?: boolean;
}

export const PlanVersionSheet: React.FC<PlanVersionSheetProps> = ({
  visible,
  onClose,
  versions,
  onApproveVersion,
  approving = false,
}) => {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    versions[0]?.id ?? null
  );

  const activeVersion = versions.find((v) => v.id === selectedVersionId) ?? versions[0];

  const diff = activeVersion?.planSnapshot?.diff;
  const isPendingReoptimized =
    activeVersion?.versionType === 'reoptimized' && activeVersion?.approvalStatus === 'pending';

  return (
    <Sheet visible={visible} onClose={onClose} title="Plan Version History">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.versionSelector}>
          {versions.map((ver) => {
            const isSelected = (activeVersion?.id ?? '') === ver.id;
            return (
              <TouchableOpacity
                key={ver.id}
                onPress={() => setSelectedVersionId(ver.id)}
                style={[styles.versionCard, isSelected && styles.versionCardSelected]}
              >
                <View style={styles.versionHeader}>
                  <Text variant="heading" color="ink">
                    v{ver.versionNumber} ({ver.versionType})
                  </Text>
                  {ver.isBaseline && (
                    <View style={styles.badgeBaseline}>
                      <Text variant="micro" color="ink">
                        Baseline
                      </Text>
                    </View>
                  )}
                  {ver.approvalStatus === 'pending' && (
                    <View style={styles.badgePending}>
                      <Text variant="micro" color="flare">
                        Pending
                      </Text>
                    </View>
                  )}
                </View>
                <Text variant="micro" color="ash">
                  {ver.approvalStatus === 'approved'
                    ? `Approved · ${ver.items.length} items`
                    : `Created · ${ver.items.length} items`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Divider />

        {activeVersion && (
          <View style={styles.detailsContainer}>
            <View style={styles.versionMeta}>
              <Text variant="title" color="ink">
                Version {activeVersion.versionNumber}
              </Text>
              <Text variant="small" color="ash">
                {activeVersion.planSnapshot?.pacingSummary ?? 'No pacing summary available.'}
              </Text>
            </View>

            {diff ? (
              <PlanDiffView diff={diff} />
            ) : (
              <View style={styles.noDiffBox}>
                <Text variant="small" color="ash">
                  Initial baseline plan. No modifications against prior version.
                </Text>
              </View>
            )}

            {isPendingReoptimized && onApproveVersion && (
              <View style={styles.approvalSection}>
                <Button
                  label="Approve Reoptimized Plan"
                  variant="primary"
                  loading={approving}
                  disabled={approving}
                  onPress={async () => {
                    await onApproveVersion(activeVersion.id);
                    onClose();
                  }}
                />
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.unit * 4,
    paddingBottom: spacing.unit * 6,
  },
  versionSelector: {
    gap: spacing.unit * 2,
  },
  versionCard: {
    backgroundColor: colors.wash,
    padding: spacing.unit * 3,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.rule,
    gap: spacing.unit * 1,
  },
  versionCardSelected: {
    borderColor: colors.signal,
  },
  versionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit * 2,
  },
  badgeBaseline: {
    backgroundColor: colors.oxblood,
    paddingHorizontal: spacing.unit * 2,
    paddingVertical: spacing.unit * 0.5,
    borderRadius: radius.cell,
  },
  badgePending: {
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.flare,
    paddingHorizontal: spacing.unit * 2,
    paddingVertical: spacing.unit * 0.5,
    borderRadius: radius.cell,
  },
  detailsContainer: {
    gap: spacing.unit * 3,
  },
  versionMeta: {
    gap: spacing.unit * 1,
  },
  noDiffBox: {
    backgroundColor: colors.wash,
    padding: spacing.unit * 4,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.rule,
    alignItems: 'center',
  },
  approvalSection: {
    marginTop: spacing.unit * 2,
  },
});
