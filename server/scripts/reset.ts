import { closePool, pool } from '../src/config/db';
import { defaultSqlDir, runMigrations } from '../src/db/migrate';

/**
 * DESTROYS all data and recreates the schema.
 * Requires the `--yes` flag so it cannot be triggered by accident.
 */
async function main(): Promise<void> {
  if (!process.argv.includes('--yes')) {
    // eslint-disable-next-line no-console
    console.error('[MiniLedger] Reset is destructive. Re-run with: npm run db:reset -- --yes');
    process.exitCode = 1;
    return;
  }

  await pool.query(`
    DROP TABLE IF EXISTS loans CASCADE;
    DROP TABLE IF EXISTS otp_challenges CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS schema_migrations CASCADE;
  `);

  const applied = await runMigrations(pool, defaultSqlDir());
  // eslint-disable-next-line no-console
  console.log(`[MiniLedger] Database reset. Applied: ${applied.join(', ') || 'nothing'}`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[MiniLedger] Reset failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    closePool().catch(() => undefined);
  });
