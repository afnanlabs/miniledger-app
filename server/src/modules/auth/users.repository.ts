import { query, queryOne } from '../../config/db';
import type { User } from '../../types';

const USER_COLUMNS = 'id, phone_number, token_version, created_at, updated_at';

export async function findUserById(id: string): Promise<User | null> {
  return queryOne<User>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
}

export async function findUserByPhone(phoneNumber: string): Promise<User | null> {
  return queryOne<User>(`SELECT ${USER_COLUMNS} FROM users WHERE phone_number = $1`, [phoneNumber]);
}

/**
 * Returns the user for a phone number, creating it on first sign-in.
 * The `created` flag lets the API tell a new user apart from a returning one.
 */
export async function findOrCreateUser(
  phoneNumber: string,
): Promise<{ user: User; created: boolean }> {
  const inserted = await queryOne<User>(
    `INSERT INTO users (phone_number) VALUES ($1)
     ON CONFLICT (phone_number) DO NOTHING
     RETURNING ${USER_COLUMNS}`,
    [phoneNumber],
  );

  if (inserted) return { user: inserted, created: true };

  const existing = await findUserByPhone(phoneNumber);
  if (!existing) {
    // Extremely unlikely: the row was removed between the two statements.
    const recreated = await queryOne<User>(
      `INSERT INTO users (phone_number) VALUES ($1) RETURNING ${USER_COLUMNS}`,
      [phoneNumber],
    );
    if (!recreated) throw new Error('Unable to create user row');
    return { user: recreated, created: true };
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
