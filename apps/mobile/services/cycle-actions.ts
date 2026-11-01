import type { CycleStatus, GroupRole, MemberSubmissionStatus } from '@mp/shared';
import { formatMonthName } from './dates';

export type UserSubmissionState = MemberSubmissionStatus | 'not_started' | null;

export interface CycleActionContext {
  cycle: {
    id: string;
    status: CycleStatus;
    year: number;
    month: number;
    submissionDeadline: string;
    reviewDeadline: string;
  } | null;
  role: GroupRole | null;
  mySubmissionStatus: UserSubmissionState;
}

export type ActionType =
  | 'create_cycle'
  | 'submit_goals'
  | 'view_submission'
  | 'review_goals'
  | 'advance_to_review'
  | 'finish_review'
  | 'view_plan'
  | 'none';

export interface NextAction {
  label: string;
  action: ActionType;
  secondaryLabel?: string;
  secondaryAction?: ActionType;
  disabled?: boolean;
  confirmTitle?: string;
  confirmMessage?: string;
}

export function getNextAction(
  cycle: CycleActionContext['cycle'],
  role: GroupRole | null,
  mySubmissionStatus: UserSubmissionState
): NextAction {
  const isAdminOrOwner = role === 'owner' || role === 'admin';

  if (!cycle) {
    if (isAdminOrOwner) {
      const nextMonth = new Date().getMonth() + 1;
      const monthName = formatMonthName(new Date().getFullYear(), nextMonth);
      return {
        label: `Start ${monthName}`,
        action: 'create_cycle',
      };
    }
    return {
      label: 'Waiting for group cycle',
      action: 'none',
      disabled: true,
    };
  }

  switch (cycle.status) {
    case 'submission_open': {
      let primary: NextAction;
      if (mySubmissionStatus === 'locked') {
        primary = {
          label: 'Goals locked',
          action: 'view_submission',
        };
      } else if (
        mySubmissionStatus === 'none' ||
        mySubmissionStatus === 'not_started' ||
        mySubmissionStatus === 'draft'
      ) {
        primary = {
          label: 'Submit goals',
          action: 'submit_goals',
        };
      } else {
        primary = {
          label: 'Goals submitted',
          action: 'view_submission',
        };
      }

      if (isAdminOrOwner) {
        primary.secondaryLabel = 'Move to group review';
        primary.secondaryAction = 'advance_to_review';
        primary.confirmTitle = 'Move to group review';
        primary.confirmMessage =
          'This locks every submitted goal. Members who have not submitted keep a draft and are left out.';
      }
      return primary;
    }

    case 'group_review': {
      const primary: NextAction = {
        label: 'Review goals',
        action: 'review_goals',
      };

      if (isAdminOrOwner) {
        primary.secondaryLabel = 'Finish review';
        primary.secondaryAction = 'finish_review';
        primary.confirmTitle = 'Finish review';
        primary.confirmMessage =
          'This locks every submitted goal. Members who have not submitted keep a draft and are left out.';
      }
      return primary;
    }

    case 'planning': {
      return {
        label: 'View monthly plan',
        action: 'view_plan',
      };
    }

    case 'execution': {
      return {
        label: 'Track monthly progress',
        action: 'view_plan',
      };
    }

    case 'completed': {
      return {
        label: 'Cycle finished',
        action: 'none',
        disabled: true,
      };
    }

    case 'cancelled': {
      return {
        label: 'Cycle cancelled',
        action: 'none',
        disabled: true,
      };
    }

    default: {
      return {
        label: 'No action available',
        action: 'none',
        disabled: true,
      };
    }
  }
}
