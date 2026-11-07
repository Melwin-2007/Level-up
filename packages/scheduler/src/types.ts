export interface TimeSlot {
  /** Minutes from midnight (0..1440) */
  startMinute: number;
  /** Minutes from midnight (0..1440) */
  endMinute: number;
}

export interface DayAvailability {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Total available minutes on this day */
  availableMinutes: number;
  /** Specific time windows available on this day */
  slots: TimeSlot[];
}

export interface FixedSlot {
  /** Target date YYYY-MM-DD */
  date: string;
  startMinute: number;
  endMinute: number;
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

export interface TaskCandidate {
  id: string;
  goalId: string;
  title: string;
  estimatedMinutes: number;
  /** Priority 1 to 5, where 5 is highest */
  priority: number;
  /** Deadline ISO date YYYY-MM-DD */
  deadline: string;
  /** IDs of prerequisite task candidates */
  dependencies?: string[];
  /** Optional preferred time of day */
  preferredTimeOfDay?: TimeOfDay;
  /** Optional fixed date and time slot */
  fixedSlot?: FixedSlot;
}

export interface ScheduledTask {
  taskId: string;
  goalId: string;
  date: string;
  startMinute: number;
  endMinute: number;
  durationMinutes: number;
}

export type UnscheduledReason =
  | 'insufficient_capacity'
  | 'deadline_unreachable'
  | 'unmet_dependency'
  | 'daily_limit_exceeded'
  | 'conflict';

export interface UnscheduledTask {
  taskId: string;
  goalId: string;
  reason: UnscheduledReason;
  details: string;
}

export type ConstraintViolationType =
  'overlap' | 'capacity_exceeded' | 'deadline_passed' | 'dependency_order' | 'outside_slot';

export interface ConstraintViolation {
  type: ConstraintViolationType;
  taskId: string;
  message: string;
}

export interface TradeoffExplanation {
  taskId: string;
  goalId: string;
  explanation: string;
}

export interface SchedulerInput {
  tasks: TaskCandidate[];
  availability: DayAvailability[];
  maxDailyMinutes?: number;
}

export interface SchedulerOutput {
  scheduled: ScheduledTask[];
  unscheduled: UnscheduledTask[];
  violations: ConstraintViolation[];
  tradeoffs: TradeoffExplanation[];
}
