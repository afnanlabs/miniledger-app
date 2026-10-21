/**
 * Safety checks for the database used by the destructive parts of the test
 * setup (migrations and TRUNCATE).
 *
 * The default database name for tests is `miniledger_test`. Refusing anything
 * that does not end in `_test` prevents a misconfigured TEST_DATABASE_URL from
 * wiping a development or production database.
 */

export const NON_TEST_DATABASE_OVERRIDE = 'ALLOW_NON_TEST_DATABASE';

const TEST_DATABASE_SUFFIX = '_test';

function databaseNameFromUrl(connectionString: string): string {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error(
      'Refusing to run destructive test setup: the test database URL is not a valid PostgreSQL connection URL.',
    );
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!databaseName) {
    throw new Error(
      'Refusing to run destructive test setup: the test database URL does not name a database.',
    );
  }

  return databaseName;
}

/**
 * Returns the database name when it is safe to use, otherwise throws.
 *
 * A non-test database is accepted only when the operator explicitly sets
 * ALLOW_NON_TEST_DATABASE=true (or passes the second argument in a unit test).
 */
export function assertSafeTestDatabase(
  connectionString: string,
  allowNonTestDatabase = process.env[NON_TEST_DATABASE_OVERRIDE] === 'true',
): string {
  const databaseName = databaseNameFromUrl(connectionString);

  if (databaseName.endsWith(TEST_DATABASE_SUFFIX)) {
    return databaseName;
  }

  if (allowNonTestDatabase) {
    console.warn(
      `WARNING: running destructive test setup against "${databaseName}" because ${NON_TEST_DATABASE_OVERRIDE}=true.`,
    );
    return databaseName;
  }

  throw new Error(
    `Refusing to run destructive test setup: database "${databaseName}" does not end in "${TEST_DATABASE_SUFFIX}". ` +
      `Set ${NON_TEST_DATABASE_OVERRIDE}=true only if you intentionally want to use a non-test database.`,
  );
}
