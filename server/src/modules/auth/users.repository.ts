import { query, queryOne } from '../../config/db';
import type { User } from '../../types';

const USER_COLUMNS = 'id, phone_number, name, token_version, created_at, updated_at';

export async function findUserById(id: string): Promise<User | null> {
  return queryOne<User>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
}

export async function findUserByPhone(phoneNumber: string): Promise<User | null> {
  return queryOne<User>(`SELECT ${USER_COLUMNS} FROM users WHERE phone_number = $1`, [phoneNumber]);
}

/**
 * Returns the user for a phone number, creating it on first sign-in.
 *
 * - New numbers are inserted with the name supplied at sign-in.
 * - Existing numbers keep their single row; the stored name is refreshed when
 *   the sign-in flow supplies a different one, so a typo can be corrected by
 *   signing in again. `token_version` is deliberately left untouched here.
 *
 * The `created` flag lets the API tell a new user apart from a returning one.
 */
export async function findOrCreateUser(
  phoneNumber: string,
  name: string | null = null,
): Promise<{ user: User; created: boolean }> {
  const inserted = await queryOne<User>(
    `INSERT INTO users (phone_number, name) VALUES ($1, $2)
     ON CONFLICT (phone_number) DO NOTHING
     RETURNING ${USER_COLUMNS}`,
    [phoneNumber, name],
  );

  if (inserted) return { user: inserted, created: true };

  const existing = await findUserByPhone(phoneNumber);
  if (!existing) {
    // Extremely unlikely: the row was removed between the two statements.
    const recreated = await queryOne<User>(
      `INSERT INTO users (phone_number, name) VALUES ($1, $2) RETURNING ${USER_COLUMNS}`,
      [phoneNumber, name],
    );
    if (!recreated) throw new Error('Unable to create user row');
    return { user: recreated, created: true };
  }

  if (name && name !== existing.name) {
    const renamed = await queryOne<User>(
      `UPDATE users SET name = $2, updated_at = now()
       WHERE id = $1
       RETURNING ${USER_COLUMNS}`,
      [existing.id, name],
    );
    if (renamed) return { user: renamed, created: false };
  }

  return { user: existing, created: false };
}

/**
 * Increments the user's token version. Every JWT issued before this call
 * carries the old version and is therefore rejected by `requireAuth`.
 */
export async function bumpTokenVersion(userId: string): Promise<number> {
  const rows = await query<{ token_version: number }>(
    `UPDATE users SET token_version = token_version + 1, updated_at = now()
     WHERE id = $1 RETURNING token_version`,
    [userId],
  );
  return rows[0]?.token_version ?? 0;
}
