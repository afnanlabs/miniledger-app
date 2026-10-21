import { addDays, daysBetween, isValidDateString, todayInTimeZone } from '../src/utils/dates';
import { isPositiveMoneyString, isValidMoneyString, toMoneyString } from '../src/utils/money';

describe('money helpers', () => {
  it('formats values with exactly two decimals', () => {
    expect(toMoneyString('1500')).toBe('1500.00');
    expect(toMoneyString('1500.5')).toBe('1500.50');
    expect(toMoneyString('1500.555')).toBe('1500.55');
    expect(toMoneyString(1500.5)).toBe('1500.50');
    expect(toMoneyString(null)).toBe('0.00');
    expect(toMoneyString(undefined)).toBe('0.00');
    expect(toMoneyString('')).toBe('0.00');
  });

  it('removes leading zeros without touching the value', () => {
    expect(toMoneyString('000012.30')).toBe('12.30');
    expect(toMoneyString('0.05')).toBe('0.05');
  });

  it('validates the decimal format', () => {
    expect(isValidMoneyString('1500.00')).toBe(true);
    expect(isValidMoneyString('1500.0')).toBe(true);
    expect(isValidMoneyString('1500')).toBe(true);
    expect(isValidMoneyString('1500.000')).toBe(false);
    expect(isValidMoneyString('-1500')).toBe(false);
    expect(isValidMoneyString('15.00.00')).toBe(false);
    expect(isValidMoneyString('abc')).toBe(false);
  });

  it('detects positive amounts without floating point maths', () => {
    expect(isPositiveMoneyString('0.01')).toBe(true);
    expect(isPositiveMoneyString('0.00')).toBe(false);
    expect(isPositiveMoneyString('0')).toBe(false);
    expect(isPositiveMoneyString('000.10')).toBe(true);
  });
});

describe('date helpers', () => {
  it('accepts real calendar dates only', () => {
    expect(isValidDateString('2026-02-28')).toBe(true);
    expect(isValidDateString('2024-02-29')).toBe(true);
    expect(isValidDateString('2026-02-31')).toBe(false);
    expect(isValidDateString('2026-13-01')).toBe(false);
    expect(isValidDateString('26-01-01')).toBe(false);
    expect(isValidDateString('')).toBe(false);
  });

  it('counts whole days between calendar dates', () => {
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
    expect(daysBetween('2026-01-01', '2026-01-02')).toBe(1);
    expect(daysBetween('2026-01-02', '2026-01-01')).toBe(-1);
    expect(daysBetween('2026-02-27', '2026-03-01')).toBe(2);
  });

  it('adds days to a calendar date', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('resolves today inside the requested timezone', () => {
    const instant = new Date('2026-01-01T19:30:00.000Z');
    // 19:30 UTC is already the next day in Kolkata (UTC+5:30).
    expect(todayInTimeZone('UTC', instant)).toBe('2026-01-01');
    expect(todayInTimeZone('Asia/Kolkata', instant)).toBe('2026-01-02');
  });
});
