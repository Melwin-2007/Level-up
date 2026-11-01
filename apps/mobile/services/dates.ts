export function formatMonthName(year: number, month: number, timeZone = 'UTC'): string {
  const date = new Date(Date.UTC(year, month - 1, 15));
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    timeZone,
  }).format(date);
}

export function formatShortDate(date: string | Date, timeZone = 'UTC'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(d);
}

export function formatDateWithTime(date: string | Date, timeZone = 'UTC'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(d);
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function toIsoDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
