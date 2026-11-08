import { localSlotToUtc, utcToLocalSlot } from '@mp/scheduler';

export function calculateNextReminderDelay(
  now: Date,
  timezone: string,
  reminderTime = '09:00'
): number {
  const [hourStr, minStr] = reminderTime.split(':');
  const targetMinuteOfDay = parseInt(hourStr ?? '9', 10) * 60 + parseInt(minStr ?? '0', 10);

  const localNow = utcToLocalSlot(now, timezone);
  let targetDate = localNow.date;

  if (localNow.minute >= targetMinuteOfDay) {
    // Already past reminder time today in local timezone, advance to tomorrow
    const [y, m, d] = targetDate.split('-').map(Number);
    if (y !== undefined && m !== undefined && d !== undefined) {
      const tomorrow = new Date(Date.UTC(y, m - 1, d + 1));
      targetDate = tomorrow.toISOString().slice(0, 10);
    }
  }

  const targetUtc = localSlotToUtc(targetDate, targetMinuteOfDay, timezone);
  return Math.max(0, targetUtc.getTime() - now.getTime());
}

export function buildDailyTaskSummaryNotification(taskCount: number): {
  title: string;
  body: string;
} {
  return {
    title: 'Daily Tasks',
    body:
      taskCount === 0
        ? 'No tasks scheduled for today.'
        : `You have ${taskCount} task${taskCount === 1 ? '' : 's'} scheduled today.`,
  };
}

export function buildDeadlineReminderNotification(
  type: 'submission' | 'review',
  hoursRemaining: number
): { title: string; body: string } {
  const label = type === 'submission' ? 'Goal submission' : 'Group review';
  return {
    title: `${label} Deadline`,
    body: `${label} closes in ${hoursRemaining} hours. Check your cycle to stay on track.`,
  };
}
