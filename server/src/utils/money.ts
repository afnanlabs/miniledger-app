/**
 * Decimal helpers.
 *
 * Every monetary value in MiniLedger is handled as a *string* ("1500.00").
 * JavaScript numbers are IEEE-754 doubles and cannot represent values such as
 * 0.1 + 0.2 exactly, so they are never used for storage or aggregation.
 * Aggregations happen inside PostgreSQL on `numeric` columns instead.
 */

/** At most 10 integer digits and at most 2 fraction digits, no sign. */
const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

/** Renders a JS number as a plain decimal string (never exponential notation). */
export function numberToDecimalString(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const fixed = value.toFixed(2);
  if (!fixed.includes('e') && !fixed.includes('E')) return fixed;
  return fixed.replace(/e[+-]?\d+$/i, '');
}

/** True when the string is a well formed non-negative decimal amount. */
export function isValidMoneyString(value: string): boolean {
  return MONEY_PATTERN.test(value);
}

/** True when the amount is well formed and strictly greater than zero. */
export function isPositiveMoneyString(value: string): boolean {
  if (!isValidMoneyString(value)) return false;
  const [intPart = '0', fracPart = ''] = value.split('.');
  const normalizedInt = intPart.replace(/^0+(?=\d)/, '') || '0';
  if (normalizedInt !== '0') return true;
  return /[1-9]/.test(fracPart);
}

/**
 * Normalises any decimal-ish input into the canonical "1234.50" format.
 * Pure string manipulation - no floating point arithmetic is involved.
 */
export function toMoneyString(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0.00';

  let raw = typeof value === 'number' ? numberToDecimalString(value) : String(value).trim();
  if (raw === '') return '0.00';

  let negative = false;
  if (raw.startsWith('-')) {
    negative = true;
    raw = raw.slice(1);
  }
  if (raw.startsWith('+')) raw = raw.slice(1);

  const [intRaw = '0', fracRaw = ''] = raw.split('.');
  const intPart = intRaw.replace(/^0+(?=\d)/, '') || '0';
  const fracPart = (fracRaw + '00').slice(0, 2);

  return `${negative ? '-' : ''}${intPart}.${fracPart}`;
}
