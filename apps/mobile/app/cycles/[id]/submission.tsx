import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Animated,
  AccessibilityInfo,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Plus, Minus, Trash2 } from 'lucide-react-native';
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
import {
  useOwnSubmission,
  useSaveSubmissionMutation,
  useLockSubmissionMutation,
} from '@/hooks/use-submissions';
import { useSubmissionDraftStore } from '@/stores/submission-draft';
import {
  formToSubmissionPayload,
  submissionResponseToForm,
  type FormGoal,
  type FormAvailability,
  type SuccessCriteriaType,
} from '@/services/submission-mapper';
import { formatMonthName, getDaysInMonth } from '@/services/dates';
import { mapApiError } from '@/services/api';

const WEEKDAYS: Array<{ key: keyof FormAvailability; label: string }> = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

export default function SubmissionScreen(): React.ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cycleId = id ?? '';
  const router = useRouter();

  const { data: cycle, refetch: refetchCycle } = useCycle(cycleId);
  const {
    data: serverSubmission,
    isLoading: submissionLoading,
    refetch: refetchSubmission,
  } = useOwnSubmission(cycleId);

  const saveMutation = useSaveSubmissionMutation(cycleId);
  const lockMutation = useLockSubmissionMutation(cycleId);

  const {
    getDraft,
    setDraft,
    upsertGoal,
    deleteGoal,
    setWeekdayHours,
    setCommitments,
    setMaxDailyHours,
    clearDraft,
  } = useSubmissionDraftStore();

  const draft = getDraft(cycleId);

  const [activeGoalIndex, setActiveGoalIndex] = useState<number | null>(null);
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Goal Form Sheet state
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [goalCategory, setGoalCategory] = useState('');
  const [goalPriority, setGoalPriority] = useState(1);
  const [goalHours, setGoalHours] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');
  const [goalCriteriaType, setGoalCriteriaType] = useState<SuccessCriteriaType>('none');
  const [checklistItems, setChecklistItems] = useState<string[]>(['']);
  const [metricTarget, setMetricTarget] = useState('');
  const [metricUnit, setMetricUnit] = useState('');
  const [goalErrors, setGoalErrors] = useState<Record<string, string>>({});

  // Commitment input state
  const [newCommitmentTitle, setNewCommitmentTitle] = useState('');
  const [newCommitmentHours, setNewCommitmentHours] = useState('');

  // Lock animation
  const fillAnim = useRef(new Animated.Value(0)).current;

  // Hydrate draft from server submission if draft is empty and server submission exists
  useEffect(() => {
    if (serverSubmission && draft.goals.length === 0) {
      const restored = submissionResponseToForm(serverSubmission);
      setDraft(cycleId, () => restored);
    }
  }, [serverSubmission, draft.goals.length, cycleId, setDraft]);

  const isLocked = serverSubmission?.status === 'locked';
  const isSubmitted = serverSubmission?.status === 'submitted';

  const openNewGoalSheet = () => {
    if (isLocked) return;
    setActiveGoalIndex(null);
    setGoalTitle('');
    setGoalDescription('');
    setGoalCategory('');
    setGoalPriority(1);
    setGoalHours('');
    setGoalDeadline(
      cycle
        ? `${cycle.year}-${String(cycle.month).padStart(2, '0')}-${String(
            getDaysInMonth(cycle.year, cycle.month)
          ).padStart(2, '0')}`
        : ''
    );
    setGoalCriteriaType('none');
    setChecklistItems(['']);
    setMetricTarget('');
    setMetricUnit('');
    setGoalErrors({});
    setGoalSheetOpen(true);
  };

  const openEditGoalSheet = (index: number) => {
    if (isLocked) return;
    const g = draft.goals[index];
    if (!g) return;

    setActiveGoalIndex(index);
    setGoalTitle(g.title);
    setGoalDescription(g.description ?? '');
    setGoalCategory(g.category ?? '');
    setGoalPriority(g.priority);
    setGoalHours(g.estimatedHours !== undefined ? String(g.estimatedHours) : '');
    setGoalDeadline(g.deadline ?? '');
    setGoalCriteriaType(g.successCriteriaType ?? 'none');
    setChecklistItems(g.checklistItems && g.checklistItems.length > 0 ? g.checklistItems : ['']);
    setMetricTarget(g.metricTarget !== undefined ? String(g.metricTarget) : '');
    setMetricUnit(g.metricUnit ?? '');
    setGoalErrors({});
    setGoalSheetOpen(true);
  };

  const validateGoal = (): boolean => {
    const errs: Record<string, string> = {};
    if (!goalTitle.trim()) {
      errs.title = 'Give the goal a title (up to 120 characters).';
    } else if (goalTitle.trim().length > 120) {
      errs.title = 'Title cannot exceed 120 characters.';
    }

    if (goalHours.trim()) {
      const h = Number(goalHours.trim());
      if (Number.isNaN(h) || h < 0.25 || h > 400) {
        errs.hours = 'Enter hours as a number, for example 12 or 7.5.';
      }
    }

    if (goalDeadline.trim() && cycle) {
      const regex = /^\d{4}-\d{2}-\d{2}$/;
      if (!regex.test(goalDeadline.trim())) {
        errs.deadline = 'Format must be YYYY-MM-DD.';
      } else {
        const [y, m] = goalDeadline.trim().split('-').map(Number);
        if (y !== cycle.year || m !== cycle.month) {
          errs.deadline = `Deadline must fall in ${formatMonthName(cycle.year, cycle.month)}.`;
        }
      }
    }

    if (goalCriteriaType === 'metric') {
      const targetNum = Number(metricTarget.trim());
      if (!metricTarget.trim() || Number.isNaN(targetNum)) {
        errs.metric = 'Target must be a number.';
      }
      if (!metricUnit.trim()) {
        errs.metric = 'Unit is required.';
      }
    } else if (goalCriteriaType === 'checklist') {
      const valid = checklistItems.map((i) => i.trim()).filter(Boolean);
      if (valid.length === 0) {
        errs.checklist = 'At least one checklist item is required.';
      }
    }

    setGoalErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveGoal = () => {
    if (!validateGoal()) return;

    const parsedHours = goalHours.trim() ? Number(goalHours.trim()) : undefined;
    const parsedTarget = metricTarget.trim() ? Number(metricTarget.trim()) : undefined;

    const goalToSave: FormGoal = {
      title: goalTitle.trim(),
      description: goalDescription.trim() || undefined,
      category: goalCategory.trim() || undefined,
      priority: goalPriority,
      estimatedHours: parsedHours,
      deadline: goalDeadline.trim() || undefined,
      successCriteriaType: goalCriteriaType,
      checklistItems:
        goalCriteriaType === 'checklist'
          ? checklistItems.map((i) => i.trim()).filter(Boolean)
          : undefined,
      metricTarget: goalCriteriaType === 'metric' ? parsedTarget : undefined,
      metricUnit: goalCriteriaType === 'metric' ? metricUnit.trim() : undefined,
    };

    upsertGoal(cycleId, goalToSave, activeGoalIndex ?? undefined);
    setGoalSheetOpen(false);
  };

  const handleDeleteActiveGoal = () => {
    if (activeGoalIndex !== null) {
      deleteGoal(cycleId, activeGoalIndex);
      setGoalSheetOpen(false);
    }
  };

  const handleSaveDraft = async () => {
    if (isLocked) return;
    setErrorMessage(null);
    try {
      const payload = formToSubmissionPayload(draft, false);
      await saveMutation.mutateAsync({
        payload,
        isExisting: Boolean(serverSubmission),
      });
      clearDraft(cycleId);
    } catch (err) {
      setErrorMessage(mapApiError(err));
      void refetchCycle();
    }
  };

  const handleSubmit = async () => {
    if (isLocked) return;
    setErrorMessage(null);

    if (draft.goals.length === 0) {
      setErrorMessage('Add at least one goal to submit.');
      return;
    }

    try {
      const payload = formToSubmissionPayload(draft, true);
      await saveMutation.mutateAsync({
        payload,
        isExisting: Boolean(serverSubmission),
      });
      clearDraft(cycleId);
    } catch (err) {
      setErrorMessage(mapApiError(err));
      void refetchCycle();
    }
  };

  const handleLock = async () => {
    setErrorMessage(null);
    try {
      const isReduced = await AccessibilityInfo.isReduceMotionEnabled();
      await lockMutation.mutateAsync();
      setLockConfirmOpen(false);
      clearDraft(cycleId);

      if (!isReduced) {
        Animated.timing(fillAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: false,
        }).start();
      }
    } catch (err) {
      setLockConfirmOpen(false);
      setErrorMessage(mapApiError(err));
      void refetchCycle();
    }
  };

  const handleAddCommitment = () => {
    if (!newCommitmentTitle.trim()) return;
    const hours = Number(newCommitmentHours.trim()) || 0;
    setCommitments(cycleId, [
      ...draft.fixedCommitments,
      { title: newCommitmentTitle.trim(), hoursPerWeek: hours },
    ]);
    setNewCommitmentTitle('');
    setNewCommitmentHours('');
  };

  const handleRemoveCommitment = (index: number) => {
    if (isLocked) return;
    const updated = draft.fixedCommitments.filter((_, i) => i !== index);
    setCommitments(cycleId, updated);
  };

  return (
    <Screen
      scrollable={true}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={submissionLoading}
          onRefresh={() => {
            void refetchCycle();
            void refetchSubmission();
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

      {/* Title & Status */}
      <View style={styles.header}>
        <Title>
          {cycle ? `${formatMonthName(cycle.year, cycle.month)} goals` : 'Goals submission'}
        </Title>
        <Text variant="small" color="ash" style={styles.subline}>
          Add the goals you want to finish this month. Include how many hours each needs.
        </Text>
      </View>

      {/* Lock status banner & orchestrated motion */}
      {isLocked ? (
        <View style={styles.lockedBanner}>
          <Animated.View
            style={[
              styles.motionFill,
              {
                width: fillAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
          <Text variant="small" color="ash">
            This submission is locked and cannot be edited.
          </Text>
        </View>
      ) : null}

      {/* Error Bar */}
      {errorMessage ? (
        <View style={styles.errorContainer}>
          <ErrorBar message={errorMessage} onDismiss={() => setErrorMessage(null)} />
        </View>
      ) : null}

      {/* Goals Section */}
      <View style={styles.sectionHeader}>
        <Text variant="small" color="ash">
          GOALS ({draft.goals.length})
        </Text>
      </View>

      {draft.goals.length === 0 ? (
        <EmptyState
          title="No goals yet"
          message="Add the goals you want to finish this month. Include how many hours each needs."
          actionLabel={isLocked ? undefined : 'Add goal'}
          onAction={openNewGoalSheet}
        />
      ) : (
        <View style={styles.goalList}>
          {draft.goals.map((g, idx) => (
            <Pressable
              key={idx}
              style={styles.goalRow}
              onPress={() => openEditGoalSheet(idx)}
              disabled={isLocked}
              accessibilityRole="button"
              accessibilityLabel={`Edit goal ${g.title}`}
            >
              <Row style={styles.goalRowContent}>
                <View style={styles.goalMain}>
                  <Text variant="body" color="ink" numberOfLines={1}>
                    {g.title}
                  </Text>
                  {g.category ? (
                    <Text variant="micro" color="ash">
                      {g.category}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.goalMeta}>
                  <PriorityMarks priority={g.priority} />
                  {g.estimatedHours !== undefined ? (
                    <Text variant="small" color="ash" tabularNums={true}>
                      {g.estimatedHours} h
                    </Text>
                  ) : null}
                </View>
              </Row>
              <Divider />
            </Pressable>
          ))}

          {!isLocked ? (
            <Button
              label="Add goal"
              variant="secondary"
              onPress={openNewGoalSheet}
              style={styles.addGoalButton}
            />
          ) : null}
        </View>
      )}

      {/* Availability Section */}
      <View style={styles.sectionHeader}>
        <Text variant="small" color="ash">
          WEEKLY AVAILABILITY
        </Text>
      </View>

      <View style={styles.availabilityCard}>
        {WEEKDAYS.map(({ key, label }) => {
          const currentHours = draft.weeklyHours[key];
          return (
            <View key={key}>
              <Row style={styles.stepperRow}>
                <Text variant="body" color="ink">
                  {label}
                </Text>
                <View style={styles.stepperControls}>
                  <Pressable
                    style={styles.stepperButton}
                    onPress={() => {
                      if (!isLocked) {
                        setWeekdayHours(cycleId, key, Math.max(0, currentHours - 1));
                      }
                    }}
                    disabled={isLocked || currentHours <= 0}
                    accessibilityLabel={`Decrease ${label} hours`}
                  >
                    <Minus
                      size={16}
                      color={currentHours > 0 && !isLocked ? colors.ink : colors.ash}
                    />
                  </Pressable>

                  <Text variant="body" color="ink" tabularNums={true} style={styles.stepperValue}>
                    {currentHours} h
                  </Text>

                  <Pressable
                    style={styles.stepperButton}
                    onPress={() => {
                      if (!isLocked) {
                        setWeekdayHours(cycleId, key, Math.min(24, currentHours + 1));
                      }
                    }}
                    disabled={isLocked || currentHours >= 24}
                    accessibilityLabel={`Increase ${label} hours`}
                  >
                    <Plus
                      size={16}
                      color={currentHours < 24 && !isLocked ? colors.ink : colors.ash}
                    />
                  </Pressable>
                </View>
              </Row>
              <Divider />
            </View>
          );
        })}

        {/* Max Daily Hours */}
        <Row style={styles.stepperRow}>
          <Text variant="body" color="ink">
            Max daily hours
          </Text>
          <View style={styles.stepperControls}>
            <Pressable
              style={styles.stepperButton}
              onPress={() => {
                if (!isLocked) {
                  const current = draft.maxDailyHours ?? 8;
                  setMaxDailyHours(cycleId, Math.max(1, current - 1));
                }
              }}
              disabled={isLocked || (draft.maxDailyHours ?? 8) <= 1}
              accessibilityLabel="Decrease max daily hours"
            >
              <Minus size={16} color={!isLocked ? colors.ink : colors.ash} />
            </Pressable>

            <Text variant="body" color="ink" tabularNums={true} style={styles.stepperValue}>
              {draft.maxDailyHours ?? 8} h
            </Text>

            <Pressable
              style={styles.stepperButton}
              onPress={() => {
                if (!isLocked) {
                  const current = draft.maxDailyHours ?? 8;
                  setMaxDailyHours(cycleId, Math.min(24, current + 1));
                }
              }}
              disabled={isLocked || (draft.maxDailyHours ?? 8) >= 24}
              accessibilityLabel="Increase max daily hours"
            >
              <Plus size={16} color={!isLocked ? colors.ink : colors.ash} />
            </Pressable>
          </View>
        </Row>
      </View>

      {/* Fixed Commitments */}
      <View style={styles.sectionHeader}>
        <Text variant="small" color="ash">
          FIXED COMMITMENTS
        </Text>
      </View>

      <View style={styles.commitmentsList}>
        {draft.fixedCommitments.map((c, i) => (
          <Row key={i} style={styles.commitmentRow}>
            <View style={styles.commitmentInfo}>
              <Text variant="body" color="ink">
                {c.title}
              </Text>
              <Text variant="micro" color="ash">
                {c.hoursPerWeek} h/week
              </Text>
            </View>
            {!isLocked ? (
              <Pressable
                style={styles.deleteButton}
                onPress={() => handleRemoveCommitment(i)}
                accessibilityLabel={`Remove commitment ${c.title}`}
              >
                <Trash2 size={16} color={colors.ash} />
              </Pressable>
            ) : null}
          </Row>
        ))}

        {!isLocked ? (
          <View style={styles.addCommitmentRow}>
            <View style={styles.addCommitmentInputs}>
              <Input
                placeholder="Commitment (e.g. Work, Classes)"
                value={newCommitmentTitle}
                onChangeText={setNewCommitmentTitle}
                style={styles.commitmentTitleInput}
              />
              <Input
                placeholder="Hours/wk"
                value={newCommitmentHours}
                onChangeText={setNewCommitmentHours}
                keyboardType="numeric"
                style={styles.commitmentHoursInput}
              />
            </View>
            <Button
              label="Add"
              variant="secondary"
              onPress={handleAddCommitment}
              disabled={!newCommitmentTitle.trim()}
            />
          </View>
        ) : null}
      </View>

      {/* Bottom Action Buttons */}
      {!isLocked ? (
        <View style={styles.footerActions}>
          {isSubmitted ? (
            <>
              <Button
                label="Lock goals"
                variant="primary"
                onPress={() => setLockConfirmOpen(true)}
                loading={lockMutation.isPending}
              />
              <Button
                label="Save draft"
                variant="secondary"
                onPress={handleSaveDraft}
                loading={saveMutation.isPending}
              />
            </>
          ) : (
            <>
              <Button
                label="Submit goals"
                variant="primary"
                onPress={handleSubmit}
                loading={saveMutation.isPending}
              />
              <Button
                label="Save draft"
                variant="secondary"
                onPress={handleSaveDraft}
                loading={saveMutation.isPending}
              />
            </>
          )}
        </View>
      ) : null}

      {/* Add / Edit Goal Sheet */}
      <Sheet
        visible={goalSheetOpen}
        onClose={() => setGoalSheetOpen(false)}
        title={activeGoalIndex !== null ? 'Edit goal' : 'New goal'}
      >
        <Field label="Title" error={goalErrors.title}>
          <Input
            value={goalTitle}
            onChangeText={setGoalTitle}
            placeholder="e.g. Finish DSA course"
            maxLength={120}
          />
        </Field>

        <Field label="Description">
          <Input
            value={goalDescription}
            onChangeText={setGoalDescription}
            placeholder="Optional details or context"
            multiline={true}
            numberOfLines={3}
          />
        </Field>

        <Field label="Category">
          <Input
            value={goalCategory}
            onChangeText={setGoalCategory}
            placeholder="e.g. Learning, Work, Health"
            maxLength={40}
          />
        </Field>

        {/* Priority Picker: 5 tappable squares */}
        <Field label="Priority (1 to 5)">
          <View style={styles.priorityPicker}>
            {[1, 2, 3, 4, 5].map((level) => {
              const active = level <= goalPriority;
              return (
                <Pressable
                  key={level}
                  style={styles.prioritySquareTouch}
                  onPress={() => setGoalPriority(level)}
                  accessibilityRole="button"
                  accessibilityLabel={`Priority ${level}`}
                >
                  <View
                    style={[
                      styles.prioritySquare,
                      active ? styles.prioritySquareActive : styles.prioritySquareInactive,
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Estimated hours" error={goalErrors.hours}>
          <Input
            value={goalHours}
            onChangeText={setGoalHours}
            placeholder="e.g. 40 or 12.5"
            keyboardType="decimal-pad"
          />
        </Field>

        <Field label="Deadline" error={goalErrors.deadline}>
          <Input value={goalDeadline} onChangeText={setGoalDeadline} placeholder="YYYY-MM-DD" />
        </Field>

        {/* Success Criteria Type Picker */}
        <Field label="Success criteria">
          <View style={styles.criteriaTypeSelector}>
            {(['none', 'checklist', 'metric', 'binary'] as SuccessCriteriaType[]).map((type) => (
              <Pressable
                key={type}
                style={[
                  styles.criteriaTypePill,
                  goalCriteriaType === type && styles.criteriaTypePillActive,
                ]}
                onPress={() => setGoalCriteriaType(type)}
              >
                <Text
                  variant="micro"
                  color={goalCriteriaType === type ? 'flare' : 'ink'}
                  style={styles.criteriaPillText}
                >
                  {type}
                </Text>
              </Pressable>
            ))}
          </View>
        </Field>

        {/* Dynamic fields for Success Criteria */}
        {goalCriteriaType === 'checklist' ? (
          <View style={styles.criteriaBox}>
            <Text variant="micro" color="ash" style={styles.criteriaBoxTitle}>
              Checklist items
            </Text>
            {checklistItems.map((item, i) => (
              <Row key={i} style={styles.checklistItemRow}>
                <Input
                  value={item}
                  onChangeText={(val) => {
                    const next = [...checklistItems];
                    next[i] = val;
                    setChecklistItems(next);
                  }}
                  placeholder={`Item ${i + 1}`}
                  style={styles.checklistItemInput}
                />
                <Pressable
                  onPress={() => {
                    const next = checklistItems.filter((_, idx) => idx !== i);
                    setChecklistItems(next.length ? next : ['']);
                  }}
                  style={styles.deleteButton}
                  accessibilityLabel="Remove checklist item"
                >
                  <Trash2 size={16} color={colors.ash} />
                </Pressable>
              </Row>
            ))}
            <Button
              label="+ Add item"
              variant="quiet"
              onPress={() => setChecklistItems([...checklistItems, ''])}
            />
            {goalErrors.checklist ? (
              <Text variant="micro" color="ink">
                {goalErrors.checklist}
              </Text>
            ) : null}
          </View>
        ) : null}

        {goalCriteriaType === 'metric' ? (
          <View style={styles.criteriaBox}>
            <Field label="Target number" error={goalErrors.metric}>
              <Input
                value={metricTarget}
                onChangeText={setMetricTarget}
                placeholder="e.g. 50"
                keyboardType="numeric"
              />
            </Field>
            <Field label="Unit">
              <Input
                value={metricUnit}
                onChangeText={setMetricUnit}
                placeholder="e.g. km, chapters, users"
              />
            </Field>
          </View>
        ) : null}

        <View style={styles.sheetActions}>
          <Button label="Save goal" variant="primary" onPress={handleSaveGoal} />
          {activeGoalIndex !== null ? (
            <Button label="Delete goal" variant="quiet" onPress={handleDeleteActiveGoal} />
          ) : null}
        </View>
      </Sheet>

      {/* Lock Confirmation Sheet */}
      <Sheet visible={lockConfirmOpen} onClose={() => setLockConfirmOpen(false)} title="Lock goals">
        <Text variant="body" color="ink" style={styles.confirmText}>
          Locked goals cannot be edited. Your group will see them for review.
        </Text>
        <View style={styles.sheetActions}>
          <Button
            label="Lock goals"
            variant="primary"
            onPress={handleLock}
            loading={lockMutation.isPending}
          />
          <Button label="Cancel" variant="secondary" onPress={() => setLockConfirmOpen(false)} />
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
  lockedBanner: {
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.input,
    padding: spacing.unit * 3,
    marginBottom: spacing.unit * 4,
    overflow: 'hidden',
    position: 'relative',
  },
  motionFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.oxblood,
  },
  errorContainer: {
    marginBottom: spacing.unit * 4,
  },
  sectionHeader: {
    marginTop: spacing.unit * 4,
    marginBottom: spacing.unit * 2,
  },
  goalList: {
    marginBottom: spacing.unit * 2,
  },
  goalRow: {
    minHeight: 56,
    justifyContent: 'center',
  },
  goalRowContent: {
    paddingVertical: spacing.unit * 2,
  },
  goalMain: {
    flex: 1,
    marginRight: spacing.unit * 2,
  },
  goalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit * 3,
  },
  addGoalButton: {
    marginTop: spacing.unit * 2,
  },
  availabilityCard: {
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.input,
    paddingHorizontal: spacing.unit * 3,
  },
  stepperRow: {
    minHeight: 56,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit * 2,
  },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 40,
    textAlign: 'center',
  },
  commitmentsList: {
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.input,
    padding: spacing.unit * 3,
    gap: spacing.unit * 2,
  },
  commitmentRow: {
    minHeight: 48,
  },
  commitmentInfo: {
    flex: 1,
  },
  deleteButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCommitmentRow: {
    marginTop: spacing.unit * 2,
    gap: spacing.unit * 2,
  },
  addCommitmentInputs: {
    flexDirection: 'row',
    gap: spacing.unit * 2,
  },
  commitmentTitleInput: {
    flex: 2,
  },
  commitmentHoursInput: {
    flex: 1,
  },
  footerActions: {
    marginTop: spacing.unit * 6,
    gap: spacing.unit * 3,
  },
  priorityPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit * 2,
  },
  prioritySquareTouch: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prioritySquare: {
    width: 24,
    height: 24,
    borderRadius: radius.cell,
  },
  prioritySquareActive: {
    backgroundColor: colors.ink,
  },
  prioritySquareInactive: {
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: 'transparent',
  },
  criteriaTypeSelector: {
    flexDirection: 'row',
    gap: spacing.unit,
  },
  criteriaTypePill: {
    paddingVertical: spacing.unit,
    paddingHorizontal: spacing.unit * 2,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.wash,
  },
  criteriaTypePillActive: {
    borderColor: colors.flare,
  },
  criteriaPillText: {
    textTransform: 'uppercase',
  },
  criteriaBox: {
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.input,
    padding: spacing.unit * 3,
    gap: spacing.unit * 2,
    marginBottom: spacing.unit * 3,
  },
  criteriaBoxTitle: {
    marginBottom: spacing.unit,
  },
  checklistItemRow: {
    gap: spacing.unit,
  },
  checklistItemInput: {
    flex: 1,
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
