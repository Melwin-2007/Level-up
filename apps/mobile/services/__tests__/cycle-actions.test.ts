import { getNextAction } from '../cycle-actions';
import type { CycleStatus } from '@mp/shared';

describe('services/cycle-actions', () => {
  const baseCycle = {
    id: 'cycle-1',
    year: 2026,
    month: 11,
    submissionDeadline: '2026-11-05T23:59:59.000Z',
    reviewDeadline: '2026-11-07T23:59:59.000Z',
  };

  it('should return Start Month for owner/admin when no cycle exists', () => {
    const action = getNextAction(null, 'owner', null);
    expect(action.action).toBe('create_cycle');
    expect(action.label).toMatch(/^Start /);
  });

  it('should return waiting for member when no cycle exists', () => {
    const action = getNextAction(null, 'member', null);
    expect(action.action).toBe('none');
    expect(action.disabled).toBe(true);
  });

  describe('submission_open phase', () => {
    const cycle = { ...baseCycle, status: 'submission_open' as CycleStatus };

    it('should prompt Submit goals when submission is not started', () => {
      const action = getNextAction(cycle, 'member', 'not_started');
      expect(action.action).toBe('submit_goals');
      expect(action.label).toBe('Submit goals');
      expect(action.secondaryAction).toBeUndefined();
    });

    it('should prompt Submit goals when submission is in draft', () => {
      const action = getNextAction(cycle, 'member', 'draft');
      expect(action.action).toBe('submit_goals');
    });

    it('should show Goals submitted when already submitted', () => {
      const action = getNextAction(cycle, 'member', 'submitted');
      expect(action.action).toBe('view_submission');
      expect(action.label).toBe('Goals submitted');
    });

    it('should show Goals locked when already locked', () => {
      const action = getNextAction(cycle, 'member', 'locked');
      expect(action.action).toBe('view_submission');
      expect(action.label).toBe('Goals locked');
    });

    it('should offer Move to group review secondary action to owner/admin', () => {
      const action = getNextAction(cycle, 'owner', 'submitted');
      expect(action.secondaryAction).toBe('advance_to_review');
      expect(action.confirmMessage).toBe(
        'This locks every submitted goal. Members who have not submitted keep a draft and are left out.'
      );
    });
  });

  describe('group_review phase', () => {
    const cycle = { ...baseCycle, status: 'group_review' as CycleStatus };

    it('should offer Review goals to regular member', () => {
      const action = getNextAction(cycle, 'member', 'submitted');
      expect(action.action).toBe('review_goals');
      expect(action.label).toBe('Review goals');
    });

    it('should offer Finish review secondary action to owner', () => {
      const action = getNextAction(cycle, 'owner', 'submitted');
      expect(action.action).toBe('review_goals');
      expect(action.secondaryAction).toBe('finish_review');
    });
  });

  describe('planning and execution phases', () => {
    it('should offer View monthly plan during planning', () => {
      const cycle = { ...baseCycle, status: 'planning' as CycleStatus };
      const action = getNextAction(cycle, 'member', 'locked');
      expect(action.action).toBe('view_plan');
    });

    it('should offer Track progress during execution', () => {
      const cycle = { ...baseCycle, status: 'execution' as CycleStatus };
      const action = getNextAction(cycle, 'member', 'locked');
      expect(action.action).toBe('view_plan');
    });
  });

  describe('completed and cancelled phases', () => {
    it('should disable actions when cycle is completed', () => {
      const cycle = { ...baseCycle, status: 'completed' as CycleStatus };
      const action = getNextAction(cycle, 'owner', 'locked');
      expect(action.action).toBe('none');
      expect(action.disabled).toBe(true);
    });

    it('should disable actions when cycle is cancelled', () => {
      const cycle = { ...baseCycle, status: 'cancelled' as CycleStatus };
      const action = getNextAction(cycle, 'owner', 'locked');
      expect(action.action).toBe('none');
      expect(action.disabled).toBe(true);
    });
  });
});
