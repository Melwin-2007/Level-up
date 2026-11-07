import { describe, expect, it } from 'vitest';
import {
  buildMonthAvailability,
  getDayLengthHours,
  getDayOfWeek,
  getDaysInMonth,
  localSlotToUtc,
  utcToLocalSlot,
} from '../calendar';
import type { MonthAvailabilityInput, WeekdayHours } from '../types';

describe('Timezone & Calendar Handling (P31)', () => {
  const standardWorkWeek: WeekdayHours = {
    monday: 8,
    tuesday: 8,
    wednesday: 8,
    thursday: 8,
    friday: 6,
    saturday: 0,
    sunday: 0,
  };

  describe('Month Length & Leap Year Handling', () => {
    it('computes 28 days for February in a non-leap year (2026)', () => {
      expect(getDaysInMonth(2026, 2)).toBe(28);
    });

    it('computes 29 days for February in a leap year (2028)', () => {
      expect(getDaysInMonth(2028, 2)).toBe(29);
    });

    it('computes 29 days for leap century (2000) and 28 for non-leap century (1900)', () => {
      expect(getDaysInMonth(2000, 2)).toBe(29);
      expect(getDaysInMonth(1900, 2)).toBe(28);
    });

    it('computes 30 days for April and 31 days for January', () => {
      expect(getDaysInMonth(2026, 4)).toBe(30);
      expect(getDaysInMonth(2026, 1)).toBe(31);
    });
  });

  describe('Day of Week in Timezones', () => {
    it('correctly maps local dates to weekday names in Asia/Kolkata', () => {
      // 2026-11-01 is Sunday, 2026-11-02 is Monday
      expect(getDayOfWeek('2026-11-01', 'Asia/Kolkata')).toBe('sunday');
      expect(getDayOfWeek('2026-11-02', 'Asia/Kolkata')).toBe('monday');
      expect(getDayOfWeek('2026-11-06', 'Asia/Kolkata')).toBe('friday');
      expect(getDayOfWeek('2026-11-07', 'Asia/Kolkata')).toBe('saturday');
    });

    it('correctly maps local dates to weekday names in America/New_York', () => {
      expect(getDayOfWeek('2026-11-01', 'America/New_York')).toBe('sunday');
      expect(getDayOfWeek('2026-11-02', 'America/New_York')).toBe('monday');
    });
  });

  describe('Non-DST Zone: Asia/Kolkata', () => {
    it('generates 30 days for November 2026 with correct weekday hours and slots', () => {
      const input: MonthAvailabilityInput = {
        year: 2026,
        month: 11,
        timezone: 'Asia/Kolkata',
        weeklyHours: standardWorkWeek,
      };

      const days = buildMonthAvailability(input);

      expect(days).toHaveLength(30);
      expect(days[0]?.date).toBe('2026-11-01'); // Sunday -> 0 hours
      expect(days[0]?.availableMinutes).toBe(0);
      expect(days[0]?.slots).toHaveLength(0);

      expect(days[1]?.date).toBe('2026-11-02'); // Monday -> 8 hours (480 mins)
      expect(days[1]?.availableMinutes).toBe(480);
      expect(days[1]?.slots).toEqual([{ startMinute: 540, endMinute: 1020 }]);

      expect(days[5]?.date).toBe('2026-11-06'); // Friday -> 6 hours (360 mins)
      expect(days[5]?.availableMinutes).toBe(360);
      expect(days[5]?.slots).toEqual([{ startMinute: 540, endMinute: 900 }]);

      expect(days[6]?.date).toBe('2026-11-07'); // Saturday -> 0 hours
      expect(days[6]?.availableMinutes).toBe(0);
    });

    it('overrides weekday availability with dated exceptions', () => {
      const input: MonthAvailabilityInput = {
        year: 2026,
        month: 11,
        timezone: 'Asia/Kolkata',
        weeklyHours: standardWorkWeek,
        exceptions: [
          {
            date: '2026-11-02', // Monday normally 8h
            hours: 0, // Public holiday -> 0h
            reason: 'Diwali Holiday',
          },
          {
            date: '2026-11-07', // Saturday normally 0h
            hours: 4, // Weekend catch-up -> 4h
            reason: 'Make-up work',
          },
        ],
      };

      const days = buildMonthAvailability(input);
      const diwali = days.find((d) => d.date === '2026-11-02')!;
      const saturdayWork = days.find((d) => d.date === '2026-11-07')!;

      expect(diwali.availableMinutes).toBe(0);
      expect(diwali.slots).toHaveLength(0);

      expect(saturdayWork.availableMinutes).toBe(240);
      expect(saturdayWork.slots).toEqual([{ startMinute: 540, endMinute: 780 }]);
    });
  });

  describe('DST Transitions: America/New_York', () => {
    it('detects 23-hour day on spring forward and 25-hour day on fall back in 2026', () => {
      // 2026 Spring Forward: March 8, 2026
      expect(getDayLengthHours('2026-03-07', 'America/New_York')).toBe(24);
      expect(getDayLengthHours('2026-03-08', 'America/New_York')).toBe(23);
      expect(getDayLengthHours('2026-03-09', 'America/New_York')).toBe(24);

      // 2026 Fall Back: November 1, 2026
      expect(getDayLengthHours('2026-10-31', 'America/New_York')).toBe(24);
      expect(getDayLengthHours('2026-11-01', 'America/New_York')).toBe(25);
      expect(getDayLengthHours('2026-11-02', 'America/New_York')).toBe(24);
    });

    it('converts local slots to UTC accurately across EDT/EST transitions', () => {
      // Winter EST (UTC-5): 09:00 local is 14:00 UTC
      const winterUtc = localSlotToUtc('2026-01-15', 540, 'America/New_York');
      expect(winterUtc.toISOString()).toBe('2026-01-15T14:00:00.000Z');

      // Summer EDT (UTC-4): 09:00 local is 13:00 UTC
      const summerUtc = localSlotToUtc('2026-06-15', 540, 'America/New_York');
      expect(summerUtc.toISOString()).toBe('2026-06-15T13:00:00.000Z');

      // Round-trip conversion: UTC -> Local
      const localSlot = utcToLocalSlot('2026-06-15T13:00:00.000Z', 'America/New_York');
      expect(localSlot).toEqual({
        date: '2026-06-15',
        minute: 540,
      });
    });
  });

  describe('DST Transitions: Europe/London', () => {
    it('detects 23-hour day on spring forward and 25-hour day on fall back in 2026', () => {
      // 2026 BST Spring Forward: March 29, 2026 (last Sunday of March)
      expect(getDayLengthHours('2026-03-29', 'Europe/London')).toBe(23);

      // 2026 BST Fall Back: October 25, 2026 (last Sunday of October)
      expect(getDayLengthHours('2026-10-25', 'Europe/London')).toBe(25);
    });

    it('converts local slots to UTC accurately across BST/GMT transitions', () => {
      // Winter GMT (UTC+0): 09:00 local is 09:00 UTC
      const winterUtc = localSlotToUtc('2026-01-15', 540, 'Europe/London');
      expect(winterUtc.toISOString()).toBe('2026-01-15T09:00:00.000Z');

      // Summer BST (UTC+1): 09:00 local is 08:00 UTC
      const summerUtc = localSlotToUtc('2026-06-15', 540, 'Europe/London');
      expect(summerUtc.toISOString()).toBe('2026-06-15T08:00:00.000Z');

      // Round-trip conversion
      const localSlot = utcToLocalSlot('2026-06-15T08:00:00.000Z', 'Europe/London');
      expect(localSlot).toEqual({
        date: '2026-06-15',
        minute: 540,
      });
    });
  });

  describe('Clamping on Reduced-Duration Days', () => {
    it('clamps available hours to day length on 23-hour day if 24 hours requested', () => {
      const input: MonthAvailabilityInput = {
        year: 2026,
        month: 3,
        timezone: 'America/New_York',
        exceptions: [
          {
            date: '2026-03-08', // 23h spring forward day
            hours: 24, // request 24h
          },
        ],
      };

      const days = buildMonthAvailability(input);
      const springDay = days.find((d) => d.date === '2026-03-08')!;

      // Clamped to 23 hours = 1380 minutes
      expect(springDay.availableMinutes).toBe(1380);
      expect(springDay.slots[0]?.endMinute).toBeLessThanOrEqual(1440);
    });
  });
});
