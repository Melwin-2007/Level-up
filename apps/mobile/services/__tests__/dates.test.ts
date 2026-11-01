import {
  formatMonthName,
  formatShortDate,
  formatDateWithTime,
  getDaysInMonth,
  toIsoDateOnly,
} from '../dates';

describe('services/dates', () => {
  it('formatMonthName should format month in English', () => {
    expect(formatMonthName(2026, 11)).toBe('November');
    expect(formatMonthName(2026, 1)).toBe('January');
  });

  it('formatShortDate should format short date in specified timezone', () => {
    const utcString = '2026-11-15T18:30:00.000Z';
    expect(formatShortDate(utcString, 'UTC')).toBe('Nov 15');
    expect(formatShortDate(utcString, 'Asia/Kolkata')).toBe('Nov 16');
  });

  it('formatDateWithTime should format date and 24-hour time', () => {
    const utcString = '2026-11-15T23:59:00.000Z';
    expect(formatDateWithTime(utcString, 'UTC')).toBe('Nov 15, 23:59');
  });

  it('getDaysInMonth should return correct days for leap and non-leap years', () => {
    expect(getDaysInMonth(2026, 2)).toBe(28);
    expect(getDaysInMonth(2024, 2)).toBe(29);
    expect(getDaysInMonth(2026, 11)).toBe(30);
    expect(getDaysInMonth(2026, 12)).toBe(31);
  });

  it('toIsoDateOnly should format UTC date string', () => {
    const d = new Date(Date.UTC(2026, 10, 5));
    expect(toIsoDateOnly(d)).toBe('2026-11-05');
  });
});
