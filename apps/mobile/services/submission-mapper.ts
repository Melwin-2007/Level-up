import type {
  GoalInput,
  SubmissionInput,
  SuccessCriteria,
  OwnSubmissionResponse,
} from '@mp/shared';

export type SuccessCriteriaType = 'checklist' | 'metric' | 'binary' | 'none';

export interface FormGoal {
  id?: string;
  title: string;
  description?: string;
  category?: string;
  priority: number;
  estimatedHours?: number;
  deadline?: string;
  successCriteriaType?: SuccessCriteriaType;
  checklistItems?: string[];
  metricTarget?: number;
  metricUnit?: string;
}

export interface FormAvailability {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
}

export interface FormCommitment {
  title: string;
  hoursPerWeek: number;
}

export interface FormSubmissionState {
  goals: FormGoal[];
  weeklyHours: FormAvailability;
  fixedCommitments: FormCommitment[];
  maxDailyHours?: number;
}

export const DEFAULT_WEEKLY_HOURS: FormAvailability = {
  monday: 4,
  tuesday: 4,
  wednesday: 4,
  thursday: 4,
  friday: 4,
  saturday: 0,
  sunday: 0,
};

export function formGoalToApiGoal(g: FormGoal): GoalInput {
  let successCriteria: SuccessCriteria | undefined;

  if (g.successCriteriaType === 'checklist') {
    const validItems = (g.checklistItems ?? []).map((item) => item.trim()).filter(Boolean);
    if (validItems.length > 0) {
      successCriteria = {
        type: 'checklist',
        items: validItems,
      };
    }
  } else if (g.successCriteriaType === 'metric') {
    if (g.metricTarget !== undefined && g.metricUnit?.trim()) {
      successCriteria = {
        type: 'metric',
        target: g.metricTarget,
        unit: g.metricUnit.trim(),
      };
    }
  } else if (g.successCriteriaType === 'binary') {
    successCriteria = {
      type: 'binary',
    };
  }

  const goal: GoalInput = {
    title: g.title.trim(),
    priority: Math.max(1, Math.min(5, g.priority || 1)),
    dependencies: [],
  };

  if (g.description?.trim()) {
    goal.description = g.description.trim();
  }
  if (g.category?.trim()) {
    goal.category = g.category.trim();
  }
  if (g.estimatedHours !== undefined && !Number.isNaN(g.estimatedHours) && g.estimatedHours > 0) {
    goal.estimatedHours = Math.round(g.estimatedHours * 100) / 100;
  }
  if (g.deadline?.trim()) {
    goal.deadline = g.deadline.trim();
  }
  if (successCriteria) {
    goal.successCriteria = successCriteria;
  }

  return goal;
}

export function formToSubmissionPayload(
  form: FormSubmissionState,
  submit: boolean
): SubmissionInput {
  const apiGoals: GoalInput[] = form.goals.map(formGoalToApiGoal);

  return {
    goals: apiGoals,
    availability: {
      weeklyHours: form.weeklyHours,
      exceptions: [],
    },
    constraints: {
      fixedCommitments: form.fixedCommitments.filter((c) => c.title.trim().length > 0),
      ...(form.maxDailyHours !== undefined && form.maxDailyHours > 0
        ? { maxDailyHours: form.maxDailyHours }
        : {}),
    },
    submit,
  };
}

export function submissionResponseToForm(sub: OwnSubmissionResponse): FormSubmissionState {
  const goals: FormGoal[] = sub.goals.map((g) => {
    let successCriteriaType: SuccessCriteriaType = 'none';
    let checklistItems: string[] | undefined;
    let metricTarget: number | undefined;
    let metricUnit: string | undefined;

    if (g.successCriteria) {
      if (g.successCriteria.type === 'checklist') {
        successCriteriaType = 'checklist';
        checklistItems = g.successCriteria.items;
      } else if (g.successCriteria.type === 'metric') {
        successCriteriaType = 'metric';
        metricTarget = g.successCriteria.target;
        metricUnit = g.successCriteria.unit;
      } else if (g.successCriteria.type === 'binary') {
        successCriteriaType = 'binary';
      }
    }

    return {
      id: g.id,
      title: g.title,
      description: g.description,
      category: g.category,
      priority: g.priority,
      estimatedHours: g.estimatedHours,
      deadline: g.deadline,
      successCriteriaType,
      checklistItems,
      metricTarget,
      metricUnit,
    };
  });

  const weeklyHours: FormAvailability = {
    monday: sub.availability?.weeklyHours?.monday ?? DEFAULT_WEEKLY_HOURS.monday,
    tuesday: sub.availability?.weeklyHours?.tuesday ?? DEFAULT_WEEKLY_HOURS.tuesday,
    wednesday: sub.availability?.weeklyHours?.wednesday ?? DEFAULT_WEEKLY_HOURS.wednesday,
    thursday: sub.availability?.weeklyHours?.thursday ?? DEFAULT_WEEKLY_HOURS.thursday,
    friday: sub.availability?.weeklyHours?.friday ?? DEFAULT_WEEKLY_HOURS.friday,
    saturday: sub.availability?.weeklyHours?.saturday ?? DEFAULT_WEEKLY_HOURS.saturday,
    sunday: sub.availability?.weeklyHours?.sunday ?? DEFAULT_WEEKLY_HOURS.sunday,
  };

  const fixedCommitments: FormCommitment[] = (sub.constraints?.fixedCommitments ?? []).map((c) => ({
    title: c.title,
    hoursPerWeek: c.hoursPerWeek,
  }));

  return {
    goals,
    weeklyHours,
    fixedCommitments,
    maxDailyHours: sub.constraints?.maxDailyHours,
  };
}
