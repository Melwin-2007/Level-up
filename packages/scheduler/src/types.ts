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

export type WeekdayName =
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type WeekdayHours = Record<WeekdayName, number>;

export interface DatedException {
  /** ISO date YYYY-MM-DD */
  date: string;
  hours: number;
  reason?: string;
}

export interface MonthAvailabilityInput {
  year: number;
  /** Month index 1 to 12 */
  month: number;
  /** IANA timezone string */
  timezone: string;
  weeklyHours?: Partial<WeekdayHours>;
  exceptions?: DatedException[];
  /** Default slot start minute (defaults to 540 = 09:00) */
  defaultStartMinute?: number;
}

export type TaskExecutionStatus =
  'pending' | 'in_progress' | 'paused' | 'completed' | 'postponed' | 'cancelled';

export interface TaskExecutionItem {
  id: string;
  goalId?: string | null;
  planItemId?: string | null;
  title: string;
  description?: string | null;
  status: TaskExecutionStatus;
  scheduledDate?: string | null; // ISO YYYY-MM-DD
  estimatedMinutes: number;
  actualMinutes?: number;
  completedAt?: string | Date | null;
  priority?: number; // 1-5
  deadline?: string | null; // ISO YYYY-MM-DD
  dependencies?: string[];
}

export interface PlanItemSnapshot {
  id: string;
  goalId?: string | null;
  itemType: string;
  title: string;
  description?: string | null;
  plannedDate?: string | null;
  weekNumber?: number | null;
  estimatedMinutes: number;
  orderIndex?: number;
}

export interface SlippedTask {
  task: TaskExecutionItem;
  daysOverdue: number;
  originalScheduledDate: string;
}

export interface GoalWorkSummary {
  goalId: string;
  totalTasks: number;
  completedTasks: number;
  slippedTasks: number;
  futurePendingTasks: number;
  completedMinutes: number;
  remainingMinutes: number;
}

export interface RemainingWorkInput {
  today: string; // ISO YYYY-MM-DD
  cycleStartDate: string; // ISO YYYY-MM-DD
  cycleEndDate: string; // ISO YYYY-MM-DD
  availability: DayAvailability[];
  currentTasks: TaskExecutionItem[];
  baselinePlanItems?: PlanItemSnapshot[];
  currentPlanItems?: PlanItemSnapshot[];
  maxDailyMinutes?: number;
}

export interface RemainingWorkOutput {
  today: string;
  cycleStartDate: string;
  cycleEndDate: string;
  completedTasks: TaskExecutionItem[];
  completedMinutes: number;
  slippedTasks: SlippedTask[];
  slippedMinutes: number;
  futurePendingTasks: TaskExecutionItem[];
  futurePendingMinutes: number;
  totalRemainingMinutes: number;
  remainingCapacityMinutes: number;
  capacityDeficitMinutes: number;
  isFeasible: boolean;
  rescheduleCandidates: TaskCandidate[];
  goalSummaries: GoalWorkSummary[];
}
