import {
  formGoalToApiGoal,
  formToSubmissionPayload,
  submissionResponseToForm,
  DEFAULT_WEEKLY_HOURS,
  type FormSubmissionState,
} from '../submission-mapper';
import type { OwnSubmissionResponse } from '@mp/shared';

describe('submission-mapper', () => {
  describe('formGoalToApiGoal', () => {
    it('should map a simple goal with title and priority', () => {
      const apiGoal = formGoalToApiGoal({
        title: '  Complete NestJS module  ',
        priority: 4,
      });

      expect(apiGoal.title).toBe('Complete NestJS module');
      expect(apiGoal.priority).toBe(4);
      expect(apiGoal.dependencies).toEqual([]);
      expect(apiGoal.description).toBeUndefined();
    });

    it('should clamp priority between 1 and 5', () => {
      expect(formGoalToApiGoal({ title: 'A', priority: 0 }).priority).toBe(1);
      expect(formGoalToApiGoal({ title: 'B', priority: 10 }).priority).toBe(5);
    });

    it('should map checklist success criteria correctly', () => {
      const apiGoal = formGoalToApiGoal({
        title: 'Launch feature',
        priority: 3,
        successCriteriaType: 'checklist',
        checklistItems: ['Write tests', '  ', 'Deploy to prod'],
      });

      expect(apiGoal.successCriteria).toEqual({
        type: 'checklist',
        items: ['Write tests', 'Deploy to prod'],
      });
    });

    it('should map metric success criteria correctly', () => {
      const apiGoal = formGoalToApiGoal({
        title: 'Exercise',
        priority: 2,
        successCriteriaType: 'metric',
        metricTarget: 50,
        metricUnit: 'km',
      });

      expect(apiGoal.successCriteria).toEqual({
        type: 'metric',
        target: 50,
        unit: 'km',
      });
    });

    it('should map binary success criteria correctly', () => {
      const apiGoal = formGoalToApiGoal({
        title: 'Pass exam',
        priority: 5,
        successCriteriaType: 'binary',
      });

      expect(apiGoal.successCriteria).toEqual({
        type: 'binary',
      });
    });
  });

  describe('formToSubmissionPayload', () => {
    it('should convert complete form state into valid submission payload', () => {
      const form: FormSubmissionState = {
        goals: [
          {
            title: 'Ship app',
            priority: 5,
            estimatedHours: 25.5,
            deadline: '2026-11-30',
          },
        ],
        weeklyHours: DEFAULT_WEEKLY_HOURS,
        fixedCommitments: [{ title: 'Work', hoursPerWeek: 40 }],
        maxDailyHours: 8,
      };

      const payload = formToSubmissionPayload(form, true);

      expect(payload.submit).toBe(true);
      expect(payload.goals).toHaveLength(1);
      expect(payload.goals[0]?.title).toBe('Ship app');
      expect(payload.goals[0]?.estimatedHours).toBe(25.5);
      expect(payload.availability.weeklyHours?.monday).toBe(4);
      expect(payload.constraints.fixedCommitments).toHaveLength(1);
      expect(payload.constraints.maxDailyHours).toBe(8);
    });
  });

  describe('submissionResponseToForm', () => {
    it('should restore form state accurately from server response', () => {
      const subResponse: OwnSubmissionResponse = {
        id: 'sub-1',
        cycleId: 'cycle-1',
        userId: 'user-1',
        status: 'submitted',
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-01T00:00:00Z',
        goals: [
          {
            id: 'g-1',
            position: 0,
            title: 'Read book',
            priority: 2,
            estimatedHours: 15,
            deadline: '2026-11-20',
            dependencies: [],
            createdAt: '2026-11-01T00:00:00Z',
            successCriteria: {
              type: 'metric',
              target: 300,
              unit: 'pages',
            },
          },
        ],
        availability: {
          weeklyHours: {
            monday: 3,
            tuesday: 3,
            wednesday: 3,
            thursday: 3,
            friday: 3,
            saturday: 6,
            sunday: 0,
          },
          exceptions: [],
        },
        constraints: {
          fixedCommitments: [{ title: 'College', hoursPerWeek: 30 }],
          maxDailyHours: 6,
        },
      };

      const restored = submissionResponseToForm(subResponse);

      expect(restored.goals).toHaveLength(1);
      expect(restored.goals[0]?.title).toBe('Read book');
      expect(restored.goals[0]?.successCriteriaType).toBe('metric');
      expect(restored.goals[0]?.metricTarget).toBe(300);
      expect(restored.goals[0]?.metricUnit).toBe('pages');
      expect(restored.weeklyHours.monday).toBe(3);
      expect(restored.weeklyHours.saturday).toBe(6);
      expect(restored.fixedCommitments[0]?.title).toBe('College');
      expect(restored.maxDailyHours).toBe(6);
    });
  });
});
