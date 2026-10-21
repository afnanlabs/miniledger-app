import fs from 'node:fs';
import path from 'node:path';
import type { Pool, PoolClient } from 'pg';

/**
 * Applies every `sql/*.sql` file exactly once.
 *
 * Files are applied in alphabetical order and recorded in `schema_migrations`,
 * so the command is safe to run again at any time - already applied files are
 * skipped and no data is dropped.
 */
export async function runMigrations(pool: Pool, sqlDir: string): Promise<string[]> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = fs
    .readdirSync(sqlDir)
    .filter((file) => file.toLowerCase().endsWith('.sql'))
    .sort();

  const applied: string[] = [];

  for (const file of files) {
    const existing = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
    if (existing.rowCount && existing.rowCount > 0) continue;

    const sql = fs.readFileSync(path.join(sqlDir, file), 'utf8');
    const client: PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied.push(file);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return applied;
}

export function defaultSqlDir(): string {
  // Resolved from the working directory so the same path works for `tsx`
  // (development) and for the compiled output in `dist` (production).
  return process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), 'sql');
}
