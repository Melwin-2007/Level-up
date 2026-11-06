import type {
  SuccessCriteria,
  AvailabilityInput,
  ConstraintsInput,
} from '../validation/submissions.js';

export interface PlannerGoal {
  id: string;
  position: number;
  title: string;
  description?: string;
  category?: string;
  priority: number;
  estimatedHours?: number;
  deadline?: string;
  successCriteria?: SuccessCriteria;
  dependencies: number[];
}

export interface PlannerInput {
  cycleId: string;
  userId: string;
  cycleMonth: number;
  cycleYear: number;
  timezone: string;
  goals: PlannerGoal[];
  availability: AvailabilityInput;
  constraints: ConstraintsInput;
  historicalStats: null;
}
