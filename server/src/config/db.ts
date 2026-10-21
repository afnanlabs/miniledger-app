import { Pool, types } from 'pg';
import { env } from './env';

/**
 * `pg` returns NUMERIC (OID 1700) as a string by default, which is exactly what
 * we want for money: a `numeric` column must never be converted to a JS number
 * because IEEE-754 doubles cannot represent every 2-decimal value exactly.
 * We make the behaviour explicit so a future pg upgrade cannot change it.
 */
types.setTypeParser(1700, (value: string) => value);
/** BIGINT (OID 20) is also returned as a string to avoid precision loss. */
types.setTypeParser(20, (value: string) => value);

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  application_name: 'miniledger-api',
});

/**
 * Date strategy
 * -------------
 * `loans.due_date` is a Postgres `DATE` (a calendar day, no time and no zone).
 * Every "today" comparison is done against a calendar date computed by the
 * application in `APP_TIMEZONE` and passed into SQL explicitly, so the result
 * never depends on the database server's timezone configuration.
 *
 * No session-level `SET TIME ZONE` is performed: it would race with the query
 * that opens the connection, and the explicit date parameter makes it
 * unnecessary.
 */

pool.on('error', (error) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected error on idle PostgreSQL client', error);
});

export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
