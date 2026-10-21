/**
 * Date helpers.
 *
 * `loans.due_date` is a Postgres `DATE` - a calendar day without time or zone.
 * The API therefore never mixes `DATE` and `TIMESTAMPTZ` when comparing values.
 * "Today" is resolved in `APP_TIMEZONE` and passed into SQL explicitly, which
 * keeps the overdue rule identical on the server, in the tests and on-device.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True when the value is a syntactically valid and real calendar date. */
export function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split('-').map((part) => Number.parseInt(part, 10));
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Today's calendar date in the given IANA timezone, formatted as YYYY-MM-DD. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

/**
 * Whole days between two calendar dates (`to - from`).
 * Both dates are interpreted as UTC midnights, so the result is timezone free.
 */
export function daysBetween(fromDate: string, toDate: string): number {
  const from = Date.parse(`${fromDate}T00:00:00.000Z`);
  const to = Date.parse(`${toDate}T00:00:00.000Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

/** ISO-8601 representation of a timestamp column, or null. */
export function toIsoString(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Adds `days` to a calendar date and returns the new `YYYY-MM-DD` value. */
export function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
