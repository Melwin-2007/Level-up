import { useSubmissionDraftStore } from '../submission-draft';
import { DEFAULT_WEEKLY_HOURS } from '@/services/submission-mapper';

describe('submission-draft store', () => {
  beforeEach(() => {
    useSubmissionDraftStore.setState({ drafts: {} });
  });

  it('should initialize default draft when none exists', () => {
    const draft = useSubmissionDraftStore.getState().getDraft('cycle-123');
    expect(draft.goals).toEqual([]);
    expect(draft.weeklyHours).toEqual(DEFAULT_WEEKLY_HOURS);
    expect(draft.fixedCommitments).toEqual([]);
    expect(draft.maxDailyHours).toBe(8);
  });

  it('should add and update goals for a cycle', () => {
    const { upsertGoal, getDraft } = useSubmissionDraftStore.getState();

    upsertGoal('cycle-1', { title: 'First Goal', priority: 3 });
    upsertGoal('cycle-1', { title: 'Second Goal', priority: 1 });

    let draft = getDraft('cycle-1');
    expect(draft.goals).toHaveLength(2);
    expect(draft.goals[0]?.title).toBe('First Goal');

    // Update first goal
    upsertGoal('cycle-1', { title: 'First Goal Updated', priority: 4 }, 0);
    draft = getDraft('cycle-1');
    expect(draft.goals[0]?.title).toBe('First Goal Updated');
    expect(draft.goals[0]?.priority).toBe(4);
  });

  it('should delete goal by index', () => {
    const { upsertGoal, deleteGoal, getDraft } = useSubmissionDraftStore.getState();

    upsertGoal('cycle-1', { title: 'A', priority: 1 });
    upsertGoal('cycle-1', { title: 'B', priority: 2 });
    deleteGoal('cycle-1', 0);

    const draft = getDraft('cycle-1');
    expect(draft.goals).toHaveLength(1);
    expect(draft.goals[0]?.title).toBe('B');
  });

  it('should update availability weekday hours and commitments', () => {
    const { setWeekdayHours, setCommitments, setMaxDailyHours, getDraft } =
      useSubmissionDraftStore.getState();

    setWeekdayHours('cycle-1', 'monday', 6);
    setCommitments('cycle-1', [{ title: 'Classes', hoursPerWeek: 15 }]);
    setMaxDailyHours('cycle-1', 7);

    const draft = getDraft('cycle-1');
    expect(draft.weeklyHours.monday).toBe(6);
    expect(draft.fixedCommitments).toEqual([{ title: 'Classes', hoursPerWeek: 15 }]);
    expect(draft.maxDailyHours).toBe(7);
  });

  it('should clear draft after successful submission', () => {
    const { upsertGoal, clearDraft, getDraft } = useSubmissionDraftStore.getState();

    upsertGoal('cycle-1', { title: 'Goal', priority: 1 });
    clearDraft('cycle-1');

    const draft = getDraft('cycle-1');
    expect(draft.goals).toEqual([]);
  });
});
