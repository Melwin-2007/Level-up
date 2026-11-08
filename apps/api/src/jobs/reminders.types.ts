export interface DailySummaryReminderData {
  type: 'daily_summary';
  userId: string;
  date: string;
  timeZone: string;
}

export interface DeadlineReminderData {
  type: 'deadline';
  cycleId: string;
  deadlineType: 'submission' | 'review';
  deadline: string;
}

export type ReminderJobData = DailySummaryReminderData | DeadlineReminderData;

export interface NotificationPayload {
  to: string; // Push token
  title: string;
  body: string;
  data?: Record<string, unknown>;
}
