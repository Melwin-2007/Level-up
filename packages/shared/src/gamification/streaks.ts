import { z } from 'zod';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  activeToday: boolean;
  lastActiveDate: string | null;
}

export const streakDataSchema = z.object({
  currentStreak: z.number().int().min(0),
  longestStreak: z.number().int().min(0),
  activeToday: z.boolean(),
  lastActiveDate: z.string().nullable(),
});

/**
 * Pure day difference between two YYYY-MM-DD date strings in UTC.
 */
function dayDiff(earlierDateStr: string, laterDateStr: string): number {
  const [y1, m1, d1] = earlierDateStr.split('-').map(Number);
  const [y2, m2, d2] = laterDateStr.split('-').map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;

  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  const msPerDay = 86400000;
  return Math.round((t2 - t1) / msPerDay);
}

/**
 * Pure function to derive yesterday's YYYY-MM-DD string from today's YYYY-MM-DD.
 */
function getYesterdayStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Pure calculation of current and longest consecutive daily task execution streaks.
 * Takes unique YYYY-MM-DD strings on which at least one task was completed.
 */
export function calculateStreak(completedDates: string[], todayDateStr: string): StreakData {
  if (!completedDates || completedDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      activeToday: false,
      lastActiveDate: null,
    };
  }

  // Deduplicate and filter valid YYYY-MM-DD dates, then sort ascending
  const uniqueDates = Array.from(new Set(completedDates.filter(Boolean))).sort();
  if (uniqueDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      activeToday: false,
      lastActiveDate: null,
    };
  }

  const dateSet = new Set(uniqueDates);
  const activeToday = dateSet.has(todayDateStr);
  const lastActiveDate = uniqueDates[uniqueDates.length - 1] ?? null;

  // 1. Calculate longest streak across entire history
  let longestStreak = 1;
  let currentRun = 1;

  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = uniqueDates[i - 1];
    const curr = uniqueDates[i];
    if (prev && curr && dayDiff(prev, curr) === 1) {
      currentRun++;
      if (currentRun > longestStreak) {
        longestStreak = currentRun;
      }
    } else {
      currentRun = 1;
    }
  }

  // 2. Calculate current streak
  // Streak is alive if active today or active yesterday
  const yesterdayStr = getYesterdayStr(todayDateStr);
  let currentStreak = 0;

  let checkDateStr: string | null = null;
  if (activeToday) {
    checkDateStr = todayDateStr;
  } else if (dateSet.has(yesterdayStr)) {
    checkDateStr = yesterdayStr;
  }

  if (checkDateStr) {
    while (checkDateStr && dateSet.has(checkDateStr)) {
      currentStreak++;
      checkDateStr = getYesterdayStr(checkDateStr);
    }
  }

  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  return {
    currentStreak,
    longestStreak,
    activeToday,
    lastActiveDate,
  };
}
