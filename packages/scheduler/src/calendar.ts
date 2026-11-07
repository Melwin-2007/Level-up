import type {
  DatedException,
  DayAvailability,
  MonthAvailabilityInput,
  TimeSlot,
  WeekdayName,
} from './types';

/**
 * Returns the exact number of days in a month (1..12), accounting for leap years.
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Returns the day of the week in lowercase for a given local date string YYYY-MM-DD and IANA timezone.
 */
export function getDayOfWeek(date: string, timezone: string): WeekdayName {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  // Use noon UTC to avoid date edge issues when querying timezone day
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
  });
  return formatter.format(dt).toLowerCase() as WeekdayName;
}

/**
 * Converts a local date string YYYY-MM-DD and minute (0..1440) in a given IANA timezone to a UTC Date.
 */
export function localSlotToUtc(date: string, minute: number, timezone: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const hour = Math.floor(minute / 60);
  const min = minute % 60;
  const targetLocalMs = Date.UTC(y, m - 1, d, hour, min, 0, 0);

  const guess = new Date(targetLocalMs);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });

  const parts = formatter.formatToParts(guess);
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : 0;
  };

  const localGuessMs = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second')
  );

  const offsetMs = localGuessMs - guess.getTime();
  return new Date(targetLocalMs - offsetMs);
}

/**
 * Converts a UTC Date or ISO string to the local date YYYY-MM-DD and minute in a given IANA timezone.
 */
export function utcToLocalSlot(
  utcDateOrIso: Date | string,
  timezone: string
): { date: string; minute: number } {
  const dt = typeof utcDateOrIso === 'string' ? new Date(utcDateOrIso) : utcDateOrIso;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const parts = formatter.formatToParts(dt);
  const get = (type: Intl.DateTimeFormatPartTypes): string => {
    return parts.find((p) => p.type === type)?.value ?? '00';
  };

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));

  return {
    date: `${year}-${month}-${day}`,
    minute: hour * 60 + minute,
  };
}

/**
 * Computes the duration of a local day in hours (24 on standard days, 23 on spring forward, 25 on fall back).
 */
export function getDayLengthHours(date: string, timezone: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const nextDt = new Date(Date.UTC(y, m - 1, d + 1));
  const nextDateStr = nextDt.toISOString().slice(0, 10);

  const startUtc = localSlotToUtc(date, 0, timezone);
  const endUtc = localSlotToUtc(nextDateStr, 0, timezone);

  return (endUtc.getTime() - startUtc.getTime()) / (1000 * 60 * 60);
}

/**
 * Computes the member's available minutes and daily slots per local date for the cycle month.
 */
export function buildMonthAvailability(input: MonthAvailabilityInput): DayAvailability[] {
  const { year, month, timezone, weeklyHours, exceptions = [], defaultStartMinute = 540 } = input;
  const totalDays = getDaysInMonth(year, month);
  const monthStr = String(month).padStart(2, '0');

  // Index exceptions by date for fast lookup
  const exceptionMap = new Map<string, DatedException>();
  for (const exc of exceptions) {
    exceptionMap.set(exc.date, exc);
  }

  const result: DayAvailability[] = [];

  for (let day = 1; day <= totalDays; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${monthStr}-${dayStr}`;

    const dayOfWeek = getDayOfWeek(dateStr, timezone);
    const dayLengthHours = getDayLengthHours(dateStr, timezone);

    let rawHours = 0;
    const exception = exceptionMap.get(dateStr);

    if (exception !== undefined) {
      rawHours = exception.hours;
    } else if (weeklyHours) {
      rawHours = weeklyHours[dayOfWeek] ?? 0;
    }

    // Clamp hours to the actual day length in the local timezone (e.g. 23 on DST spring forward)
    const effectiveHours = Math.max(0, Math.min(rawHours, dayLengthHours));
    const availableMinutes = Math.round(effectiveHours * 60);

    const slots: TimeSlot[] = [];

    if (availableMinutes > 0) {
      // Calculate start and end minute
      let startMinute = defaultStartMinute;
      if (startMinute + availableMinutes > 1440) {
        startMinute = Math.max(0, 1440 - availableMinutes);
      }

      slots.push({
        startMinute,
        endMinute: startMinute + availableMinutes,
      });
    }

    result.push({
      date: dateStr,
      availableMinutes,
      slots,
    });
  }

  return result;
}
