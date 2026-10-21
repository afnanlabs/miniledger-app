import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { toIsoString } from '../../utils/dates';
import type { AuthUser, JwtPayload, User } from '../../types';
import { JWT_AUDIENCE, JWT_ISSUER } from '../../middleware/auth';
import {
  consumeChallenge,
  countRequestsSince,
  createOtpChallenge,
  findLatestActiveChallenge,
  incrementAttempts,
  invalidateActiveChallenges,
} from './otp.repository';
import { bumpTokenVersion, findOrCreateUser, findUserByPhone } from './users.repository';

const BCRYPT_ROUNDS = 10;

export interface UserDto {
  id: string;
  phoneNumber: string;
  /** Null only for accounts created before names were collected. */
  name: string | null;
  createdAt: string;
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    phoneNumber: user.phone_number,
    name: user.name ?? null,
    createdAt: toIsoString(user.created_at) ?? '',
  };
}

/** Cryptographically secure six digit code. */
export function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function signToken(user: User): string {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: user.id,
    phone: user.phone_number,
    ver: user.token_version,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

export interface RequestOtpResult {
  message: string;
  expiresInSeconds: number;
  isNewUser: boolean;
  /** Only present when EXPOSE_OTP_IN_RESPONSE is enabled (development helper). */
  devOtp?: string;
}

/**
 * Creates a mock OTP challenge for a phone number.
 *
 * The name submitted with the request is stored on the challenge and applied
 * when the code is verified.
 *
 * MOCK IMPLEMENTATION - no SMS provider is involved. The code is printed to the
 * server terminal (development only) so it can be typed into the mobile app.
 */
export async function requestOtp(phoneNumber: string, name: string): Promise<RequestOtpResult> {
  const windowStart = new Date(Date.now() - env.OTP_REQUEST_WINDOW_SECONDS * 1000);
  const recentRequests = await countRequestsSince(phoneNumber, windowStart);

  if (recentRequests >= env.OTP_MAX_REQUESTS_PER_WINDOW) {
    const waitMinutes = Math.ceil(env.OTP_REQUEST_WINDOW_SECONDS / 60);
    throw AppError.tooManyRequests(
      `Too many OTP requests for this number. Please try again in ${waitMinutes} minute(s).`,
      'OTP_REQUEST_LIMIT',
    );
  }

  // Only the newest code may be used.
  await invalidateActiveChallenges(phoneNumber);

  const code = generateOtp();
  const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000);

  await createOtpChallenge({
    phoneNumber,
    requestedName: name,
    codeHash,
    expiresAt,
    maxAttempts: env.OTP_MAX_VERIFY_ATTEMPTS,
  });

  const existingUser = await findUserByPhone(phoneNumber);

  if (env.LOG_OTP_TO_CONSOLE) {
    // eslint-disable-next-line no-console
    console.log(
      `\n[MiniLedger] MOCK OTP for ${phoneNumber} -> ${code}  (valid for ${env.OTP_TTL_SECONDS}s)\n`,
    );
  }

  const result: RequestOtpResult = {
    message: 'OTP sent. Check the backend terminal for the code.',
    expiresInSeconds: env.OTP_TTL_SECONDS,
    isNewUser: !existingUser,
  };

  if (env.EXPOSE_OTP_IN_RESPONSE) {
    result.devOtp = code;
  }

  return result;
}

export interface VerifyOtpResult {
  token: string;
  expiresInSeconds: number;
  user: UserDto;
}

/** Verifies a mock OTP against the stored challenge and issues a JWT. */
export async function verifyOtp(phoneNumber: string, otp: string): Promise<VerifyOtpResult> {
  const challenge = await findLatestActiveChallenge(phoneNumber);

  if (!challenge) {
    throw new AppError(
      400,
      'OTP_NOT_FOUND',
      'No active OTP for this number. Please request a new code.',
    );
  }

  if (challenge.expires_at.getTime() <= Date.now()) {
    await consumeChallenge(challenge.id);
    throw new AppError(400, 'OTP_EXPIRED', 'That OTP has expired. Please request a new code.');
  }

  if (challenge.attempts >= challenge.max_attempts) {
    throw AppError.tooManyRequests(
      'Too many incorrect attempts for this OTP. Please request a new code.',
      'OTP_ATTEMPTS_EXCEEDED',
    );
  }

  const matches = await bcrypt.compare(otp, challenge.code_hash);
  if (!matches) {
    const attempts = await incrementAttempts(challenge.id);
    const remaining = Math.max(challenge.max_attempts - attempts, 0);
    throw new AppError(
      400,
      'INVALID_OTP',
      remaining > 0
        ? `Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Incorrect OTP. Please request a new code.',
      { attemptsRemaining: remaining },
    );
  }

  // The OTP is single use - invalidate it before issuing the token.
  await consumeChallenge(challenge.id);

  // The name travels with the challenge, so it is bound to the code that was
  // actually verified. A returning user is never duplicated; their stored name
  // is refreshed if they submitted a different one.
  const { user } = await findOrCreateUser(phoneNumber, challenge.requested_name);
  const token = signToken(user);

  return {
    token,
    expiresInSeconds: 7 * 24 * 60 * 60,
    user: toUserDto(user),
  };
}

/**
 * Logout strategy
 * ---------------
 * The token itself is stateless, but every token carries the user's token
 * version. Bumping that version invalidates *all* tokens that were issued
 * before this call, so a logout on one device also signs the account out
 * everywhere. The client additionally deletes the stored token.
 */
export async function logout(user: AuthUser): Promise<void> {
  await bumpTokenVersion(user.id);
}
