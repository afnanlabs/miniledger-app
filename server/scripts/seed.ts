import { closePool, pool } from '../src/config/db';
import { env } from '../src/config/env';
import { defaultSqlDir, runMigrations } from '../src/db/migrate';
import { addDays, todayInTimeZone } from '../src/utils/dates';

/**
 * Inserts a demo account with a handful of loans so the mobile app has
 * something to show. Safe to run repeatedly - the demo user is recreated.
 */
async function main(): Promise<void> {
  await runMigrations(pool, defaultSqlDir());

  const phoneNumber = '+919876543210';
  const name = 'Afnan Khan';

  const user = await pool.query(
    `INSERT INTO users (phone_number, name) VALUES ($1, $2)
     ON CONFLICT (phone_number) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
     RETURNING id, phone_number`,
    [phoneNumber, name],
  );

  const userId = user.rows[0].id as string;

  await pool.query('DELETE FROM loans WHERE user_id = $1', [userId]);

  const today = todayInTimeZone(env.APP_TIMEZONE);
  const inDays = (days: number): string => addDays(today, days);

  const samples = [
    { friend: 'Aarav Mehta', amount: '1500.00', dueDate: inDays(6) },
    { friend: 'Priya Sharma', amount: '750.50', dueDate: inDays(-3) },
    { friend: 'Rohan Kapoor', amount: '2200.00', dueDate: inDays(12) },
    { friend: 'Sana Khan', amount: '400.00', dueDate: inDays(-10) },
  ];

  for (const sample of samples) {
    await pool.query(
      `INSERT INTO loans (user_id, friend_name, amount, due_date) VALUES ($1, $2, $3, $4::date)`,
      [userId, sample.friend, sample.amount, sample.dueDate],
    );
  }

  // eslint-disable-next-line no-console
  console.log('[MiniLedger] Seed data created.');
  // eslint-disable-next-line no-console
  console.log(`  Demo phone number: ${phoneNumber}`);
  // eslint-disable-next-line no-console
  console.log(`  Demo name: ${name}`);
  // eslint-disable-next-line no-console
  console.log('  Request an OTP in the app and read the code from this terminal.');
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[MiniLedger] Seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    closePool().catch(() => undefined);
  });
