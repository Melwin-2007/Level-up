import React, { useState } from 'react';
import { StyleSheet, View, Pressable, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { ArrowLeft, ChevronDown, ChevronUp, MessageSquarePlus } from 'lucide-react-native';
import type { OthersSubmissionGoal } from '@mp/shared';
import {
  Screen,
  Title,
  Text,
  Row,
  Divider,
  Button,
  Input,
  Field,
  Sheet,
  PriorityMarks,
  EmptyState,
  ErrorBar,
} from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';
import { useCycle } from '@/hooks/use-cycles';
import { useGroup } from '@/hooks/use-groups';
import { useOthersSubmissions } from '@/hooks/use-submissions';
import {
  useGroupReview,
  useCreateReviewMutation,
  useReviewComments,
  useAddCommentMutation,
  useCompleteReviewMutation,
} from '@/hooks/use-reviews';
import { useSessionStore } from '@/stores/session';
import { formatMonthName } from '@/services/dates';
import { mapApiError } from '@/services/api';
import { ReviewCommentList } from '@/components/review/review-comment-list';

interface GoalAccordionProps {
  goal: OthersSubmissionGoal;
  reviewId?: string;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenCommentSheet: (goal: OthersSubmissionGoal) => void;
  currentUserId?: string;
  isReviewCompleted: boolean;
  pollInterval: number | false;
}

function GoalAccordionItem({
  goal,
  reviewId,
  isExpanded,
  onToggle,
  onOpenCommentSheet,
  currentUserId,
  isReviewCompleted,
  pollInterval,
}: GoalAccordionProps): React.ReactNode {
  const { data: commentsData } = useReviewComments(reviewId, goal.id, {
    enabled: isExpanded && Boolean(reviewId),
    refetchInterval: pollInterval,
  });

  const comments = commentsData?.items ?? [];

  return (
    <View style={styles.goalAccordionContainer}>
      <Pressable
        style={styles.goalHeaderRow}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`Expand goal ${goal.title}`}
      >
        <Row style={styles.goalHeaderContent}>
          <View style={styles.goalMain}>
            <Text variant="body" color="ink" numberOfLines={1}>
              {goal.title}
            </Text>
            {goal.category ? (
              <Text variant="micro" color="ash">
                {goal.category}
              </Text>
            ) : null}
          </View>

          <View style={styles.goalMeta}>
            <PriorityMarks priority={goal.priority} />
            {goal.estimatedHours !== undefined ? (
              <Text variant="small" color="ash" tabularNums={true}>
                {goal.estimatedHours} h
              </Text>
            ) : null}
            {isExpanded ? (
              <ChevronUp size={16} color={colors.ash} />
            ) : (
              <ChevronDown size={16} color={colors.ash} />
            )}
          </View>
        </Row>
      </Pressable>

      {isExpanded ? (
        <View style={styles.goalDetailsContainer}>
          {goal.description ? (
            <Text variant="small" color="ash" style={styles.goalDescription}>
              {goal.description}
            </Text>
          ) : null}

          {goal.deadline ? (
            <Text variant="micro" color="ash" tabularNums={true} style={styles.goalDeadline}>
              Deadline: {goal.deadline}
            </Text>
          ) : null}

          {/* Success Criteria */}
          {goal.successCriteria ? (
            <View style={styles.criteriaContainer}>
              <Text variant="micro" color="ash">
                Success criteria:
              </Text>
              {goal.successCriteria.type === 'checklist' ? (
                <View style={styles.checklistDetails}>
                  {goal.successCriteria.items.map((item, i) => (
                    <Text key={i} variant="small" color="ink">
                      • {item}
                    </Text>
                  ))}
                </View>
              ) : null}
              {goal.successCriteria.type === 'metric' ? (
                <Text variant="small" color="ink">
                  Target: {goal.successCriteria.target} {goal.successCriteria.unit}
                </Text>
              ) : null}
              {goal.successCriteria.type === 'binary' ? (
                <Text variant="small" color="ink">
                  Completed / Not completed
                </Text>
              ) : null}
            </View>
          ) : null}

          <Divider style={styles.commentsDivider} />

          {/* Inline Comments */}
          <Text variant="micro" color="ash" style={styles.commentsHeading}>
            COMMENTS ({comments.length})
          </Text>

          <ReviewCommentList comments={comments} currentUserId={currentUserId} />

          {!isReviewCompleted ? (
            <Pressable
              style={styles.addCommentButton}
              onPress={() => onOpenCommentSheet(goal)}
              accessibilityRole="button"
              accessibilityLabel="Add comment"
            >
              <MessageSquarePlus size={16} color={colors.flare} />
              <Text variant="small" color="ink" style={styles.addCommentText}>
                Add comment
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Divider />
    </View>
  );
}

export default function ReviewScreen(): React.ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cycleId = id ?? '';
  const router = useRouter();
  const isFocused = useIsFocused();

  const { user } = useSessionStore();
  const currentUserId = user?.id;

  const { data: cycle, refetch: refetchCycle } = useCycle(cycleId);
  const { data: group } = useGroup(cycle?.groupId);

  const isAdminOrOwner = group?.role === 'owner' || group?.role === 'admin';

  // Group review details query
  const {
    data: review,
    isLoading: reviewLoading,
    refetch: refetchReview,
  } = useGroupReview(cycleId);

  const isReviewCompleted = Boolean(review?.completedAt);
  const pollInterval: number | false =
    isFocused && Boolean(review && !isReviewCompleted) ? 15000 : false;

  // Submissions for review
  const {
    data: submissionsData,
    isLoading: submissionsLoading,
    refetch: refetchSubmissions,
  } = useOthersSubmissions(cycleId);

  const createReviewMutation = useCreateReviewMutation(cycleId);
  const completeReviewMutation = useCompleteReviewMutation(review?.id, cycleId);
  const addCommentMutation = useAddCommentMutation(review?.id);

  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [activeCommentGoal, setActiveCommentGoal] = useState<OthersSubmissionGoal | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSheetOpen, setCommentSheetOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submissions = submissionsData?.items ?? [];

  const handleCreateReview = async () => {
    setErrorMessage(null);
    try {
      await createReviewMutation.mutateAsync();
      void refetchSubmissions();
    } catch (err) {
      setErrorMessage(mapApiError(err));
      void refetchCycle();
    }
  };

  const handleFinishReview = async () => {
    setErrorMessage(null);
    try {
      await completeReviewMutation.mutateAsync();
      setFinishConfirmOpen(false);
      void refetchCycle();
      void refetchReview();
      void refetchSubmissions();
    } catch (err) {
      setFinishConfirmOpen(false);
      setErrorMessage(mapApiError(err));
      void refetchCycle();
    }
  };

  const handleOpenCommentSheet = (goal: OthersSubmissionGoal) => {
    setActiveCommentGoal(goal);
    setCommentText('');
    setCommentError(null);
    setCommentSheetOpen(true);
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) {
      setCommentError('Comment cannot be empty.');
      return;
    }
    if (commentText.trim().length > 1000) {
      setCommentError('Comment cannot exceed 1000 characters.');
      return;
    }
    if (!activeCommentGoal) return;

    try {
      await addCommentMutation.mutateAsync({
        submissionGoalId: activeCommentGoal.id,
        comment: commentText.trim(),
      });
      setCommentSheetOpen(false);
    } catch (err) {
      setCommentError(mapApiError(err));
    }
  };

  return (
    <Screen
      scrollable={true}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={reviewLoading || submissionsLoading}
          onRefresh={() => {
            void refetchCycle();
            void refetchReview();
            void refetchSubmissions();
          }}
          tintColor={colors.flare}
        />
      }
    >
      {/* Back Bar */}
      <Pressable
        style={styles.backButton}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <ArrowLeft size={20} color={colors.ink} />
        <Text variant="small" color="ink" style={styles.backText}>
          Month
        </Text>
      </Pressable>

      {/* Header */}
      <View style={styles.header}>
        <Title>
          {cycle ? `${formatMonthName(cycle.year, cycle.month)} review` : 'Group review'}
        </Title>
        <Text variant="small" color="ash" style={styles.subline}>
          Review each other&apos;s goals and comment.
        </Text>
      </View>

      {/* Status banner */}
      {isReviewCompleted ? (
        <View style={styles.statusBanner}>
          <Text variant="small" color="ash">
            Review completed. Goals are locked for planning.
          </Text>
        </View>
      ) : null}

      {/* Error Bar */}
      {errorMessage ? (
        <View style={styles.errorContainer}>
          <ErrorBar message={errorMessage} onDismiss={() => setErrorMessage(null)} />
        </View>
      ) : null}

      {/* Start Review Button if not yet created */}
      {!review ? (
        <View style={styles.notStartedContainer}>
          <Text variant="body" color="ash" style={styles.notStartedText}>
            Review has not started yet.
          </Text>
          {isAdminOrOwner ? (
            <Button
              label="Start review"
              variant="primary"
              onPress={handleCreateReview}
              loading={createReviewMutation.isPending}
            />
          ) : null}
        </View>
      ) : null}

      {/* Grouped Goals */}
      {submissions.length === 0 ? (
        <EmptyState
          title="No submitted goals"
          message="None of the group members have submitted goals yet."
        />
      ) : (
        <View style={styles.submissionsList}>
          {submissions.map((item) => {
            const isSelf = currentUserId && item.userId === currentUserId;
            const heading = isSelf ? `${item.displayName} (Yours)` : item.displayName;

            return (
              <View key={item.id} style={styles.memberSection}>
                <View style={styles.memberHeader}>
                  <Text variant="small" color={isSelf ? 'flare' : 'ink'} style={styles.memberName}>
                    {heading}
                  </Text>
                  <Text variant="micro" color="ash" tabularNums={true}>
                    {item.goals.length} goals
                  </Text>
                </View>

                <View style={styles.goalsContainer}>
                  {item.goals.map((goal) => (
                    <GoalAccordionItem
                      key={goal.id}
                      goal={goal}
                      reviewId={review?.id}
                      isExpanded={expandedGoalId === goal.id}
                      onToggle={() =>
                        setExpandedGoalId((prev) => (prev === goal.id ? null : goal.id))
                      }
                      onOpenCommentSheet={handleOpenCommentSheet}
                      currentUserId={currentUserId}
                      isReviewCompleted={isReviewCompleted}
                      pollInterval={pollInterval}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Admin Action: Finish Review */}
      {isAdminOrOwner && review && !isReviewCompleted ? (
        <View style={styles.footerActions}>
          <Button
            label="Finish review"
            variant="secondary"
            onPress={() => setFinishConfirmOpen(true)}
          />
        </View>
      ) : null}

      {/* Add Comment Sheet */}
      <Sheet
        visible={commentSheetOpen}
        onClose={() => setCommentSheetOpen(false)}
        title="Add comment"
      >
        {activeCommentGoal ? (
          <Text variant="small" color="ink" style={styles.commentGoalTitle}>
            Goal: {activeCommentGoal.title}
          </Text>
        ) : null}

        <Field label="Comment" error={commentError ?? undefined}>
          <Input
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Feedback, questions, or notes"
            multiline={true}
            numberOfLines={4}
            maxLength={1000}
          />
        </Field>

        <View style={styles.sheetActions}>
          <Button
            label="Add comment"
            variant="primary"
            onPress={handleAddComment}
            loading={addCommentMutation.isPending}
          />
          <Button label="Cancel" variant="secondary" onPress={() => setCommentSheetOpen(false)} />
        </View>
      </Sheet>

      {/* Finish Review Confirmation Sheet */}
      <Sheet
        visible={finishConfirmOpen}
        onClose={() => setFinishConfirmOpen(false)}
        title="Finish review"
      >
        <Text variant="body" color="ink" style={styles.confirmText}>
          This locks every submitted goal. Members who have not submitted keep a draft and are left
          out.
        </Text>
        <View style={styles.sheetActions}>
          <Button
            label="Finish review"
            variant="primary"
            onPress={handleFinishReview}
            loading={completeReviewMutation.isPending}
          />
          <Button label="Cancel" variant="secondary" onPress={() => setFinishConfirmOpen(false)} />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.screenPadding,
    paddingBottom: spacing.unit * 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.unit * 3,
    minHeight: 48,
  },
  backText: {
    marginLeft: spacing.unit,
  },
  header: {
    marginBottom: spacing.unit * 4,
  },
  subline: {
    marginTop: spacing.unit,
  },
  statusBanner: {
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.input,
    padding: spacing.unit * 3,
    marginBottom: spacing.unit * 4,
  },
  errorContainer: {
    marginBottom: spacing.unit * 4,
  },
  notStartedContainer: {
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.input,
    padding: spacing.unit * 4,
    marginBottom: spacing.unit * 4,
    gap: spacing.unit * 3,
  },
  notStartedText: {
    textAlign: 'center',
  },
  submissionsList: {
    gap: spacing.unit * 5,
  },
  memberSection: {
    gap: spacing.unit * 2,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.unit,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  memberName: {
    fontWeight: '600',
  },
  goalsContainer: {},
  goalAccordionContainer: {},
  goalHeaderRow: {
    minHeight: 56,
    justifyContent: 'center',
  },
  goalHeaderContent: {
    paddingVertical: spacing.unit * 2,
  },
  goalMain: {
    flex: 1,
    marginRight: spacing.unit * 2,
  },
  goalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit * 2,
  },
  goalDetailsContainer: {
    backgroundColor: colors.wash,
    padding: spacing.unit * 3,
    borderRadius: radius.input,
    marginBottom: spacing.unit * 2,
    gap: spacing.unit * 2,
  },
  goalDescription: {
    lineHeight: 20,
  },
  goalDeadline: {
    fontWeight: '500',
  },
  criteriaContainer: {
    gap: spacing.unit / 2,
  },
  checklistDetails: {
    paddingLeft: spacing.unit,
    gap: spacing.unit / 2,
  },
  commentsDivider: {
    marginVertical: spacing.unit,
  },
  commentsHeading: {
    marginBottom: spacing.unit,
  },
  addCommentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: spacing.unit,
    marginTop: spacing.unit,
  },
  addCommentText: {
    fontWeight: '600',
  },
  footerActions: {
    marginTop: spacing.unit * 6,
  },
  commentGoalTitle: {
    marginBottom: spacing.unit * 3,
  },
  sheetActions: {
    marginTop: spacing.unit * 4,
    gap: spacing.unit * 2,
  },
  confirmText: {
    marginBottom: spacing.unit * 4,
    lineHeight: 22,
  },
});
