import { closePool, pool } from '../src/config/db';
import { defaultSqlDir, runMigrations } from '../src/db/migrate';

async function main(): Promise<void> {
  const applied = await runMigrations(pool, defaultSqlDir());

  if (applied.length === 0) {
    // eslint-disable-next-line no-console
    console.log('[MiniLedger] Database is already up to date. No changes applied.');
  } else {
    for (const file of applied) {
      // eslint-disable-next-line no-console
      console.log(`[MiniLedger] Applied migration: ${file}`);
    }
  }
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[MiniLedger] Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    closePool().catch(() => undefined);
  });
