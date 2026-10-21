import { query, queryOne } from '../../config/db';
import type { OtpChallenge } from '../../types';

const CHALLENGE_COLUMNS =
  'id, user_id, phone_number, code_hash, attempts, max_attempts, expires_at, consumed_at, created_at';

export interface NewOtpChallenge {
  phoneNumber: string;
  codeHash: string;
  expiresAt: Date;
  maxAttempts: number;
}

export async function createOtpChallenge(params: NewOtpChallenge): Promise<OtpChallenge> {
  const created = await queryOne<OtpChallenge>(
    `INSERT INTO otp_challenges (phone_number, code_hash, expires_at, max_attempts)
     VALUES ($1, $2, $3, $4)
     RETURNING ${CHALLENGE_COLUMNS}`,
    [params.phoneNumber, params.codeHash, params.expiresAt, params.maxAttempts],
  );
  if (!created) throw new Error('Unable to store OTP challenge');
  return created;
}

/** The most recent challenge that has not been used yet. */
export async function findLatestActiveChallenge(phoneNumber: string): Promise<OtpChallenge | null> {
  return queryOne<OtpChallenge>(
    `SELECT ${CHALLENGE_COLUMNS} FROM otp_challenges
     WHERE phone_number = $1 AND consumed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [phoneNumber],
  );
}

/** Records a failed verification attempt and returns the new attempt count. */
export async function incrementAttempts(challengeId: string): Promise<number> {
  const rows = await query<{ attempts: number }>(
    `UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts`,
    [challengeId],
  );
  return rows[0]?.attempts ?? 0;
}

/** Marks a challenge as used so the very same OTP cannot be replayed. */
export async function consumeChallenge(challengeId: string): Promise<void> {
  await query('UPDATE otp_challenges SET consumed_at = now() WHERE id = $1', [challengeId]);
}

/** Invalidates every pending challenge for a phone number (used when a new OTP is issued). */
export async function invalidateActiveChallenges(phoneNumber: string): Promise<number> {
  const rows = await query<{ id: string }>(
    `UPDATE otp_challenges SET consumed_at = now()
     WHERE phone_number = $1 AND consumed_at IS NULL
     RETURNING id`,
    [phoneNumber],
  );
  return rows.length;
}

/** Counts how many OTPs were requested for a phone number since a given moment. */
export async function countRequestsSince(phoneNumber: string, since: Date): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM otp_challenges
     WHERE phone_number = $1 AND created_at >= $2`,
    [phoneNumber, since],
  );
  return Number.parseInt(rows[0]?.count ?? '0', 10);
}
