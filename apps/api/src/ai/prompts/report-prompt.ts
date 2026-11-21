import { z } from 'zod';
import { reportInsightSchema, type CycleReportMetrics } from '@mp/shared';

export const REPORT_PROMPT_ID = 'report-insights';
export const REPORT_PROMPT_VERSION = 'v1.0';

export const reportInsightsLlmOutputSchema = z.object({
  insights: z.array(reportInsightSchema).min(1).max(5),
});

export type ReportInsightsLlmOutput = z.infer<typeof reportInsightsLlmOutputSchema>;

export function buildReportPrompt(
  metrics: CycleReportMetrics,
  cycleYear: number,
  cycleMonth: number,
  regenerationNote?: string
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are an objective productivity analyst generating retrospective monthly report insights for a member.
Your task is to analyze the member's calculated performance metrics for the month and produce 2 to 4 structured, evidence-based insights.

CRITICAL RULES:
1. EVIDENCE-BASED CITATIONS: Every insight MUST cite at least one metric ID from the computed metrics:
   - 'weighted_achievement'
   - 'task_execution'
   - 'estimate_accuracy'
   - 'consistency'
   - 'plan_comparison'
2. CITATION INTEGRITY: Each citation must include the exact metricId, its formatted metricValue, and a factual reason explaining the connection.
3. NO CAUSAL SPECULATION ABOUT MOTIVES: Never make psychological claims, evaluate intentions, or speculate about emotions, laziness, procrastination, or motivation. Stick strictly to observed scheduling and execution numbers.
4. ACTIONABLE & CONSTRUCTIVE: Recommendations must be concrete and measurable (e.g. 'Allocate buffer time on Thursdays where active days dropped', 'Decompose tasks >90m').
5. Output format: Return ONLY valid JSON matching the schema without markdown backticks.`;

  const userPrompt = `Monthly Cycle Performance Metrics for ${cycleYear}-${String(cycleMonth).padStart(2, '0')}:

Weighted Achievement:
- Score: ${metrics.weightedAchievement.value.score}%
- Total Weight: ${metrics.weightedAchievement.value.totalWeight}
- Goals: ${JSON.stringify(
    metrics.weightedAchievement.value.goals.map((g) => ({
      title: g.title,
      weight: g.weight,
      rawScore: g.rawScore,
      criteriaType: g.criteriaType,
      details: g.calculationDetails,
    })),
    null,
    2
  )}

Task Execution:
- Tasks: ${metrics.taskExecution.displayValue}
- Completed: ${metrics.taskExecution.value.completedTasks}
- In Progress: ${metrics.taskExecution.value.inProgressTasks}
- Postponed: ${metrics.taskExecution.value.postponedTasks}
- Cancelled: ${metrics.taskExecution.value.cancelledTasks}
- Total Estimated: ${metrics.taskExecution.value.totalEstimatedMinutes}m
- Total Actual: ${metrics.taskExecution.value.totalActualMinutes}m

Estimation Accuracy:
- Accuracy: ${metrics.estimateAccuracy.displayValue}
- Variance: ${metrics.estimateAccuracy.value.varianceMinutes}m
- Tasks Evaluated: ${metrics.estimateAccuracy.value.completedTasksCount}

Consistency:
- Active Days: ${metrics.consistency.displayValue}
- Weekly Breakdown: ${JSON.stringify(metrics.consistency.value.weeklyCompletion)}

Dual Plan Adherence:
- Baseline Adherence: ${metrics.planComparison.value.baseline.completionRate}%
- Reoptimized Plan Adherence: ${metrics.planComparison.value.currentPlan.completionRate}%
- Scope Changes: ${JSON.stringify(metrics.planComparison.value.scopeVariance)}

${regenerationNote ? `Regeneration Request Note:\n"${regenerationNote}"\n` : ''}

Generate structured insights analyzing performance adhering to all rules.`;

  return { systemPrompt, userPrompt };
}
