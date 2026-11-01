import { computeMonthStripLayout, getDaysInMonth, getFillColor } from '../month-strip';
import { colors } from '@/theme/tokens';

describe('MonthStrip Layout Math & Tiers', () => {
  const containerWidth360 = 360 - 40; // 320dp available on 360dp-wide screen (padding 20 each side)

  it('should compute cell width >= 8dp and not require scroll for 31 days on 360dp screen', () => {
    const layout = computeMonthStripLayout(31, containerWidth360);
    expect(layout.cellWidth).toBeGreaterThanOrEqual(8);
    expect(layout.requiresScroll).toBe(false);
  });

  it('should compute cell width >= 8dp and not require scroll for 30 days on 360dp screen', () => {
    const layout = computeMonthStripLayout(30, containerWidth360);
    expect(layout.cellWidth).toBeGreaterThanOrEqual(8);
    expect(layout.requiresScroll).toBe(false);
  });

  it('should compute cell width >= 8dp and not require scroll for 28 days on 360dp screen', () => {
    const layout = computeMonthStripLayout(28, containerWidth360);
    expect(layout.cellWidth).toBeGreaterThanOrEqual(8);
    expect(layout.requiresScroll).toBe(false);
  });

  it('should trigger horizontal scroll when screen is too narrow to fit 8dp cells', () => {
    const narrowWidth = 150; // narrow container
    const layout = computeMonthStripLayout(31, narrowWidth, 8, 2);
    expect(layout.requiresScroll).toBe(true);
    expect(layout.cellWidth).toBe(8);
  });

  it('should correctly calculate days in month for regular and leap years', () => {
    expect(getDaysInMonth(2026, 11)).toBe(30); // November
    expect(getDaysInMonth(2026, 12)).toBe(31); // December
    expect(getDaysInMonth(2026, 2)).toBe(28); // February 2026 non-leap
    expect(getDaysInMonth(2024, 2)).toBe(29); // February 2024 leap
  });

  it('should tier gauge fill colors according to ratio in DESIGN.md', () => {
    // Below 0.5 -> oxblood
    expect(getFillColor(0.2)).toBe(colors.oxblood);
    expect(getFillColor(0.49)).toBe(colors.oxblood);

    // 0.5 to under 1.0 -> signal
    expect(getFillColor(0.5)).toBe(colors.signal);
    expect(getFillColor(0.75)).toBe(colors.signal);
    expect(getFillColor(0.99)).toBe(colors.signal);

    // 1.0 -> flare
    expect(getFillColor(1.0)).toBe(colors.flare);
  });
});
