import { z } from 'zod';

export const XP_RULES = {
  TASK_COMPLETION_BASE_XP: 25,
  MINUTES_PER_BONUS_XP: 5,
  MAX_DURATION_BONUS_XP: 25,
} as const;

/**
 * Calculates XP awarded for completing a daily task.
 * Base 25 XP + 1 XP per 5 minutes of estimated work, capped at +25 XP (50 XP total).
 */
export function calculateTaskCompletionXp(estimatedMinutes?: number | null): {
  amount: number;
  reason: string;
  breakdown: { base: number; durationBonus: number };
} {
  const base = XP_RULES.TASK_COMPLETION_BASE_XP;
  const duration = Math.max(0, estimatedMinutes ?? 0);
  const durationBonus = Math.min(
    XP_RULES.MAX_DURATION_BONUS_XP,
    Math.floor(duration / XP_RULES.MINUTES_PER_BONUS_XP)
  );

  return {
    amount: base + durationBonus,
    reason: 'task_completed',
    breakdown: {
      base,
      durationBonus,
    },
  };
}

/**
 * Total cumulative XP required to reach Level L.
 * Formula: 50 * (L - 1) * L
 * Level 1: 0 XP
 * Level 2: 100 XP
 * Level 3: 300 XP
 * Level 4: 600 XP
 * Level 5: 1000 XP
 */
export function xpThresholdForLevel(level: number): number {
  if (level <= 1) return 0;
  return 50 * (level - 1) * level;
}

/**
 * Derives user level from the ledger sum.
 * Exact inverse of the quadratic threshold curve.
 */
export function calculateLevel(totalXp: number): number {
  const xp = Math.max(0, totalXp);
  // Solving L^2 - L - (xp / 50) = 0 using quadratic formula
  return Math.floor((1 + Math.sqrt(1 + 4 * (xp / 50))) / 2);
}

export interface LevelProgress {
  level: number;
  totalXp: number;
  currentLevelBaseXp: number;
  nextLevelBaseXp: number;
  xpIntoCurrentLevel: number;
  xpNeededForNextLevel: number;
  progressRatio: number; // 0.0 to 1.0
}

/**
 * Computes exact level progress and percentage toward the next level.
 */
export function calculateLevelProgress(totalXp: number): LevelProgress {
  const xp = Math.max(0, totalXp);
  const level = calculateLevel(xp);
  const currentLevelBaseXp = xpThresholdForLevel(level);
  const nextLevelBaseXp = xpThresholdForLevel(level + 1);
  const xpNeededForNextLevel = nextLevelBaseXp - currentLevelBaseXp;
  const xpIntoCurrentLevel = xp - currentLevelBaseXp;
  const progressRatio =
    xpNeededForNextLevel > 0
      ? Math.min(1, Math.max(0, xpIntoCurrentLevel / xpNeededForNextLevel))
      : 1;

  return {
    level,
    totalXp: xp,
    currentLevelBaseXp,
    nextLevelBaseXp,
    xpIntoCurrentLevel,
    xpNeededForNextLevel,
    progressRatio,
  };
}

export const xpTransactionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  amount: z.number().int(),
  reason: z.string(),
  idempotencyKey: z.string(),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdAt: z.string().datetime(),
});

export type XpTransactionResponse = z.infer<typeof xpTransactionSchema>;

export const userXpSummarySchema = z.object({
  level: z.number().int().min(1),
  totalXp: z.number().int().min(0),
  currentLevelBaseXp: z.number().int().min(0),
  nextLevelBaseXp: z.number().int().min(0),
  xpIntoCurrentLevel: z.number().int().min(0),
  xpNeededForNextLevel: z.number().int().min(0),
  progressRatio: z.number().min(0).max(1),
  transactionsCount: z.number().int().min(0),
});

export type UserXpSummary = z.infer<typeof userXpSummarySchema>;

export const xpSummaryResponseSchema = z.object({
  summary: userXpSummarySchema,
  recentTransactions: z.array(xpTransactionSchema),
});

export type XpSummaryResponse = z.infer<typeof xpSummaryResponseSchema>;
