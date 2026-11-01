import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ReviewCommentResponse } from '@mp/shared';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/theme/tokens';
import { formatRelativeTime } from '@/services/dates';

export interface ReviewCommentListProps {
  comments: ReviewCommentResponse[];
  currentUserId?: string;
  testID?: string;
}

export function ReviewCommentList({
  comments,
  currentUserId,
  testID,
}: ReviewCommentListProps): React.ReactNode {
  if (comments.length === 0) {
    return (
      <View style={styles.emptyContainer} testID={testID}>
        <Text variant="small" color="ash">
          No comments yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      {comments.map((c) => {
        const isSelf = currentUserId && c.authorId === currentUserId;
        const displayName = isSelf ? `${c.authorName} (You)` : c.authorName;

        return (
          <View key={c.id} style={styles.commentRow} testID={`comment-${c.id}`}>
            <View style={styles.headerRow}>
              <Text variant="small" color="flare" style={styles.author}>
                {displayName}
              </Text>
              <Text variant="micro" color="ash" tabularNums={true}>
                {formatRelativeTime(c.createdAt)}
              </Text>
            </View>
            <Text variant="body" color="ink" style={styles.commentText}>
              {c.comment}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.unit * 2,
    marginVertical: spacing.unit,
  },
  emptyContainer: {
    paddingVertical: spacing.unit,
  },
  commentRow: {
    paddingLeft: spacing.unit * 2,
    borderLeftWidth: 2,
    borderLeftColor: colors.rule,
    gap: spacing.unit / 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  author: {
    fontWeight: '600',
  },
  commentText: {
    lineHeight: 20,
  },
});
