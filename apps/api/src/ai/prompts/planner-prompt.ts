import type { PlannerInput } from '@mp/shared';

export const PLANNER_PROMPT_ID = 'planner-decomposition';
export const PLANNER_PROMPT_VERSION = 'v1.0';

export function buildPlannerPrompt(
  input: PlannerInput,
  adjustmentsNote?: string
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are an expert monthly productivity planner.
Your role is to analyze a member's locked monthly goals, weekly availability, exceptions, and commitments, and generate:
1. A rigorous feasibility verdict ('feasible' | 'tight' | 'infeasible') comparing required hours to available capacity.
2. An assessment per goal with risks and recommendations.
3. Explicit conflicts (capacity, deadline, or dependency violations).
4. Concrete weekly milestones (weeks 1 to 5) breaking down each goal into manageable deliverables with realistic estimated minutes.

Rules:
- Never assume more than the available weekly hours specified in the member's schedule.
- Respect dated exceptions (e.g., zero-hour vacation days).
- Ensure prerequisite goals are scheduled in earlier or concurrent weeks before dependent goals.
- All estimatedMinutes for milestones must sum approximately to the goal's estimated hours.
- If the user provided an adjustment note, adhere strictly to the requested constraints or shift in priorities.
- Return ONLY valid JSON matching the PlanDecomposition schema without Markdown backticks.`;

  const userPrompt = `Member Monthly Planning Data for ${input.cycleYear}-${String(input.cycleMonth).padStart(2, '0')}:
Timezone: ${input.timezone}

Weekly Recurring Capacity:
${JSON.stringify(input.availability.weeklyHours ?? {}, null, 2)}

Dated Exceptions:
${JSON.stringify(input.availability.exceptions ?? [], null, 2)}

Fixed Commitments & Constraints:
${JSON.stringify(input.constraints, null, 2)}

Locked Goals:
${JSON.stringify(
  input.goals.map((g) => ({
    id: g.id,
    position: g.position,
    title: g.title,
    description: g.description,
    category: g.category,
    priority: g.priority,
    estimatedHours: g.estimatedHours,
    deadline: g.deadline,
    successCriteria: g.successCriteria,
    dependencyGoalIndices: g.dependencies,
  })),
  null,
  2
)}

${adjustmentsNote ? `User Adjustment Request:\n"${adjustmentsNote}"\n` : ''}

Generate the complete PlanDecomposition JSON.`;

  return { systemPrompt, userPrompt };
}
