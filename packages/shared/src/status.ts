export const CYCLE_STATUSES = [
  'submission_open',
  'group_review',
  'planning',
  'execution',
  'completed',
  'cancelled',
] as const;

export type CycleStatus = (typeof CYCLE_STATUSES)[number];

export const SUBMISSION_STATUSES = ['draft', 'submitted', 'locked'] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const GROUP_ROLES = ['owner', 'admin', 'member'] as const;

export type GroupRole = (typeof GROUP_ROLES)[number];

export const PLAN_APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const;

export type PlanApprovalStatus = (typeof PLAN_APPROVAL_STATUSES)[number];

export const PLAN_VERSION_TYPES = ['initial', 'reoptimized'] as const;

export type PlanVersionType = (typeof PLAN_VERSION_TYPES)[number];
