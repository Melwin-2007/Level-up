export const XP_EVENT_TYPES = {
  TASK_COMPLETED: 'task_completed',
  STREAK_BONUS: 'streak_bonus',
  CYCLE_RETROSPECTIVE: 'cycle_retrospective',
} as const;

export type XpEventType = (typeof XP_EVENT_TYPES)[keyof typeof XP_EVENT_TYPES];

export function buildTaskXpIdempotencyKey(taskId: string, version = 1): string {
  return `${taskId}:${XP_EVENT_TYPES.TASK_COMPLETED}:${version}`;
}
