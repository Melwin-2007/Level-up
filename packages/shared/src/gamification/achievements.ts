import { z } from 'zod';
import { streakDataSchema } from './streaks.js';
import { userXpSummarySchema } from './xp.js';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  target: number;
  xpReward: number;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first_step',
    title: 'First Step',
    description: 'Complete your first scheduled task.',
    target: 1,
    xpReward: 50,
  },
  {
    id: 'momentum',
    title: 'Momentum',
    description: 'Maintain a 3-day task execution streak.',
    target: 3,
    xpReward: 75,
  },
  {
    id: 'week_unbroken',
    title: 'Week Unbroken',
    description: 'Maintain a 7-day task execution streak.',
    target: 7,
    xpReward: 150,
  },
  {
    id: 'decathlete',
    title: 'Decathlete',
    description: 'Complete 10 scheduled tasks.',
    target: 10,
    xpReward: 100,
  },
  {
    id: 'half_century',
    title: 'Half Century',
    description: 'Complete 50 scheduled tasks.',
    target: 50,
    xpReward: 250,
  },
  {
    id: 'accuracy_pro',
    title: 'Estimator',
    description: 'Complete 5 tasks within 15 minutes of estimate.',
    target: 5,
    xpReward: 100,
  },
];

export interface AchievementEvaluationContext {
  completedTasksCount: number;
  longestStreak: number;
  accurateTasksCount: number;
  awardedAchievementIds: string[];
}

export interface EvaluatedAchievement {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  target: number;
  currentProgress: number;
  isUnlocked: boolean;
  isNewlyUnlocked: boolean;
}

/**
 * Pure evaluation of achievement unlock states from execution metrics and awarded ledger entries.
 */
export function evaluateAchievements(
  context: AchievementEvaluationContext
): EvaluatedAchievement[] {
  const awardedSet = new Set(context.awardedAchievementIds);

  return ACHIEVEMENTS.map((def) => {
    let currentProgress = 0;

    switch (def.id) {
      case 'first_step':
      case 'decathlete':
      case 'half_century':
        currentProgress = context.completedTasksCount;
        break;
      case 'momentum':
      case 'week_unbroken':
        currentProgress = context.longestStreak;
        break;
      case 'accuracy_pro':
        currentProgress = context.accurateTasksCount;
        break;
      default:
        currentProgress = 0;
    }

    const isUnlocked = currentProgress >= def.target || awardedSet.has(def.id);
    const isNewlyUnlocked = isUnlocked && !awardedSet.has(def.id);

    return {
      id: def.id,
      title: def.title,
      description: def.description,
      xpReward: def.xpReward,
      target: def.target,
      currentProgress: Math.min(def.target, currentProgress),
      isUnlocked,
      isNewlyUnlocked,
    };
  });
}

export const achievementItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  xpReward: z.number().int().min(0),
  target: z.number().int().min(1),
  currentProgress: z.number().int().min(0),
  isUnlocked: z.boolean(),
  isNewlyUnlocked: z.boolean(),
});

export type AchievementItem = z.infer<typeof achievementItemSchema>;

export const gamificationOverviewSchema = z.object({
  level: userXpSummarySchema,
  streak: streakDataSchema,
  achievements: z.array(achievementItemSchema),
});

export type GamificationOverview = z.infer<typeof gamificationOverviewSchema>;
