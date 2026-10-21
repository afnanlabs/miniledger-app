import { env } from '../config/env';
import { todayInTimeZone } from './dates';

/**
 * The application-wide "today".
 *
 * Every overdue comparison in the API uses this value, which is the current
 * calendar date in `APP_TIMEZONE`. Passing it into SQL explicitly keeps the
 * rule identical regardless of the database server's timezone configuration.
 */
export function today(): string {
  return todayInTimeZone(env.APP_TIMEZONE);
}
