import path from 'node:path';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { runMigrations } from '../src/db/migrate';
import { assertSafeTestDatabase } from './testDatabase';

/**
 * Prepares the test database before the suite starts:
 *  1. applies every migration (idempotent)
 *  2. empties the tables so each run starts from a clean slate
 */
export default async function globalSetup(): Promise<void> {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.test'), override: true });

  const connectionString =
    process.env.TEST_DATABASE_URL ??
    'postgres://miniledger:miniledger_dev_pw@127.0.0.1:5432/miniledger_test';

  // This runs before migrations and TRUNCATE: never let a misconfigured test
  // URL point the destructive setup at the development database.
  assertSafeTestDatabase(connectionString);

  const pool = new Pool({ connectionString });
  try {
    await runMigrations(pool, path.resolve(__dirname, '..', 'sql'));
    await pool.query('TRUNCATE loans, otp_challenges, users RESTART IDENTITY CASCADE');
  } finally {
    await pool.end();
  }
}
