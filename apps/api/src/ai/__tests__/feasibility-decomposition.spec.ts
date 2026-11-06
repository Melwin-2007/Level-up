import { describe, it, expect, vi } from 'vitest';
import {
  planDecompositionSchema,
  feasibilityReportSchema,
  type PlanDecomposition,
  type PlannerInput,
} from '@mp/shared';
import {
  buildPlannerPrompt,
  PLANNER_PROMPT_ID,
  PLANNER_PROMPT_VERSION,
} from '../prompts/planner-prompt.js';
import { FakeLlmClient } from '../fake-llm.client.js';
import { AiService } from '../ai.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

describe('Feasibility and Decomposition (P22)', () => {
  const goal1Id = '11111111-1111-1111-1111-111111111111';
  const goal2Id = '22222222-2222-2222-2222-222222222222';
  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const cycleId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  const mockPlannerInput: PlannerInput = {
    cycleId,
    userId,
    cycleMonth: 11,
    cycleYear: 2026,
    timezone: 'Asia/Kolkata',
    goals: [
      {
        id: goal1Id,
        position: 0,
        title: 'Core Backend Engine',
        description: 'Build core scheduling engine',
        priority: 1,
        estimatedHours: 40,
        deadline: '2026-11-20',
        dependencies: [],
      },
      {
        id: goal2Id,
        position: 1,
        title: 'Frontend Integration',
        description: 'Connect UI to engine',
        priority: 2,
        estimatedHours: 20,
        deadline: '2026-11-28',
        dependencies: [0],
      },
    ],
    availability: {
      weeklyHours: {
        monday: 8,
        tuesday: 8,
        wednesday: 8,
        thursday: 8,
        friday: 8,
        saturday: 0,
        sunday: 0,
      },
      exceptions: [],
    },
    constraints: { fixedCommitments: [] },
    historicalStats: null,
  };

  const validDecomposition: PlanDecomposition = {
    feasibility: {
      verdict: 'feasible',
      totalEstimatedHours: 60,
      totalAvailableHours: 160,
      capacityRatio: 0.375,
      goalVerdicts: [
        {
          goalId: goal1Id,
          status: 'achievable',
          risks: [],
          recommendations: ['Prioritize in Week 1-2'],
        },
        {
          goalId: goal2Id,
          status: 'achievable',
          risks: ['Blocked by goal 1'],
          recommendations: ['Begin in Week 3 after backend milestone'],
        },
      ],
      conflicts: [],
      rationale: 'Total estimated load (60h) is well within member capacity (160h).',
    },
    milestones: [
      {
        goalId: goal1Id,
        title: 'Engine architecture and tests',
        targetWeek: 1,
        estimatedMinutes: 1200,
        dependencies: [],
      },
      {
        goalId: goal1Id,
        title: 'Complete backend scheduling logic',
        targetWeek: 2,
        estimatedMinutes: 1200,
        dependencies: [],
      },
      {
        goalId: goal2Id,
        title: 'Connect UI to planner endpoints',
        targetWeek: 3,
        estimatedMinutes: 1200,
        dependencies: [],
      },
    ],
    pacingSummary: 'Healthy 20 hours/week pace leaving buffer for review and QA.',
  };

  describe('Schema Validation', () => {
    it('should validate feasibility report schema standalone', () => {
      const parsed = feasibilityReportSchema.safeParse(validDecomposition.feasibility);
      expect(parsed.success).toBe(true);
    });

    it('should validate a healthy plan decomposition', () => {
      const parsed = planDecompositionSchema.safeParse(validDecomposition);
      expect(parsed.success).toBe(true);
    });

    it('should reject invalid verdict enum', () => {
      const invalid = {
        ...validDecomposition,
        feasibility: {
          ...validDecomposition.feasibility,
          verdict: 'impossible', // invalid enum
        },
      };
      const parsed = planDecompositionSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('should reject milestone with invalid week number', () => {
      const invalid = {
        ...validDecomposition,
        milestones: [
          {
            goalId: goal1Id,
            title: 'Test',
            targetWeek: 6, // max is 5
            estimatedMinutes: 60,
            dependencies: [],
          },
        ],
      };
      const parsed = planDecompositionSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('should accept infeasible report with capacity and deadline conflicts', () => {
      const infeasibleReport: PlanDecomposition = {
        feasibility: {
          verdict: 'infeasible',
          totalEstimatedHours: 120,
          totalAvailableHours: 40,
          capacityRatio: 3.0,
          goalVerdicts: [
            {
              goalId: goal1Id,
              status: 'unrealistic',
              risks: ['Demands 300% of available monthly bandwidth'],
              recommendations: ['Drop to 15 hours or defer goal 2'],
            },
          ],
          conflicts: [
            {
              type: 'capacity',
              description: 'Required hours (120h) exceed available capacity (40h) by 80 hours',
              goalIds: [goal1Id],
            },
            {
              type: 'deadline',
              description:
                'Goal 2 deadline (Nov 10) occurs before prerequisite Goal 1 deadline (Nov 20)',
              goalIds: [goal1Id, goal2Id],
            },
          ],
          rationale: 'Overloaded cycle with severe time deficit and dependency deadline conflict.',
        },
        milestones: [
          {
            goalId: goal1Id,
            title: 'Critical subset only',
            targetWeek: 1,
            estimatedMinutes: 1200,
            dependencies: [],
          },
        ],
        pacingSummary: 'Immediate goal scope reduction required.',
      };

      const parsed = planDecompositionSchema.safeParse(infeasibleReport);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.feasibility.verdict).toBe('infeasible');
        expect(parsed.data.feasibility.conflicts).toHaveLength(2);
      }
    });
  });

  describe('buildPlannerPrompt', () => {
    it('should format system prompt and user prompt with member data', () => {
      const { systemPrompt, userPrompt } = buildPlannerPrompt(mockPlannerInput);

      expect(systemPrompt).toContain('PlanDecomposition');
      expect(systemPrompt).toContain('expert monthly productivity planner');
      expect(userPrompt).toContain('2026-11');
      expect(userPrompt).toContain('Asia/Kolkata');
      expect(userPrompt).toContain('Core Backend Engine');
      expect(userPrompt).toContain('Frontend Integration');
    });

    it('should append user adjustments note when supplied', () => {
      const note = 'Focus only on backend in weeks 1 and 2, shift frontend to week 4';
      const { userPrompt } = buildPlannerPrompt(mockPlannerInput, note);

      expect(userPrompt).toContain('User Adjustment Request:');
      expect(userPrompt).toContain(note);
    });
  });

  describe('Integration with AiService & Audit Logging', () => {
    it('should process plan decomposition and log action with model and prompt metadata', async () => {
      const fakeClient = new FakeLlmClient();
      fakeClient.setDefaultResponse(validDecomposition);

      const mockCreate = vi.fn().mockResolvedValue({ id: 'log-ai-1' });
      const mockPrisma = {
        aiActionLog: {
          create: mockCreate,
        },
      } as unknown as PrismaService;

      const aiService = new AiService(fakeClient, mockPrisma);
      const { systemPrompt, userPrompt } = buildPlannerPrompt(mockPlannerInput);

      const result = await aiService.generateStructured({
        promptId: PLANNER_PROMPT_ID,
        promptVersion: PLANNER_PROMPT_VERSION,
        systemPrompt,
        userPrompt,
        schema: planDecompositionSchema,
        userId,
        actionType: 'plan_decomposition',
      });

      expect(result.data.feasibility.verdict).toBe('feasible');
      expect(result.data.milestones).toHaveLength(3);
      expect(result.promptId).toBe(PLANNER_PROMPT_ID);
      expect(result.promptVersion).toBe(PLANNER_PROMPT_VERSION);

      // Verify audit log
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          actionType: 'plan_decomposition',
          model: 'fake-model-v1',
          promptTokens: 150,
          completionTokens: 250,
        }),
      });
    });
  });
});
