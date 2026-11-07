import type {
  SuccessCriteria,
  AvailabilityInput,
  ConstraintsInput,
} from '../validation/submissions.js';
import type { PlanDecomposition } from '../validation/planner.js';

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

export interface PlanItemResponse {
  id: string;
  planVersionId: string;
  goalId?: string | null;
  itemType: string;
  title: string;
  description?: string | null;
  weekNumber?: number | null;
  estimatedMinutes: number;
  orderIndex: number;
  createdAt: string;
}

export interface PlanVersionResponse {
  id: string;
  cycleId: string;
  userId: string;
  versionNumber: number;
  versionType: string;
  approvalStatus: string;
  isBaseline: boolean;
  planSnapshot: PlanDecomposition;
  approvedAt: string | null;
  createdAt: string;
  items: PlanItemResponse[];
}
