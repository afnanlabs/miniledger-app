import path from 'node:path';
import dotenv from 'dotenv';
import { assertSafeTestDatabase } from './testDatabase';

/**
 * Runs before every test file. It prepares the environment *before* any
 * module of the application is imported, because `src/config/env` reads
 * `process.env` exactly once at import time.
 */
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.test'), override: true, quiet: true });

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://miniledger:miniledger_dev_pw@127.0.0.1:5432/miniledger_test';
assertSafeTestDatabase(process.env.DATABASE_URL);
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-only-secret-value-not-used-anywhere-else';
process.env.APP_TIMEZONE = process.env.TEST_APP_TIMEZONE ?? 'UTC';
process.env.LOG_OTP_TO_CONSOLE = 'false';
// The tests read the generated OTP from the API response instead of scraping
// the terminal output.
process.env.EXPOSE_OTP_IN_RESPONSE = 'true';
process.env.ENABLE_REQUEST_LOGGING = 'false';
process.env.OTP_MAX_REQUESTS_PER_WINDOW = process.env.OTP_MAX_REQUESTS_PER_WINDOW ?? '5';

/**
 * Each test file gets its own module registry, so it also gets its own pg Pool.
 * Closing it here keeps Jest from hanging on an open handle.
 */
afterAll(async () => {
  const { closePool } = await import('../src/config/db');
  await closePool().catch(() => undefined);
});
