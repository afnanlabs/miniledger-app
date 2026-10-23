import fs from 'node:fs';
import request from 'supertest';
import { createApp } from '../src/app';
import { pool } from '../src/config/db';
import { RECEIPT_ROOT } from '../src/storage/receiptStorage';
import { assertSafeTestDatabase } from './testDatabase';

export const app = createApp();

let phoneCounter = 0;

/**
 * Empties every table. Called in `beforeAll` of each suite so test files never
 * see each other's data (Jest runs the files one after another via --runInBand).
 */
export async function resetDatabase(): Promise<void> {
  // Keep the guard next to the destructive statement as well, so directly
  // invoking this helper can never truncate a non-test database.
  assertSafeTestDatabase(process.env.DATABASE_URL ?? '');
  await pool.query('TRUNCATE loans, otp_challenges, users RESTART IDENTITY CASCADE');
  await fs.promises.rm(RECEIPT_ROOT, { recursive: true, force: true });
}

/** A unique, valid Indian mobile number per call. */
export function uniquePhone(): string {
  phoneCounter += 1;
  // 9876543xxx - always a valid 10 digit number starting with 9.
  return `9876543${String(phoneCounter).padStart(3, '0')}`;
}

export interface SignedInUser {
  token: string;
  userId: string;
  phoneNumber: string;
  name: string;
}

/** Runs the full mock-OTP sign-in flow and returns a usable JWT. */
export async function signUp(
  phoneNumber = uniquePhone(),
  name = 'Test User',
): Promise<SignedInUser> {
  const requestResponse = await request(app)
    .post('/api/v1/auth/request-otp')
    .send({ phoneNumber, name })
    .expect(200);

  const otp = requestResponse.body.data.devOtp as string;
  expect(typeof otp).toBe('string');

  const verifyResponse = await request(app)
    .post('/api/v1/auth/verify-otp')
    .send({ phoneNumber, otp })
    .expect(200);

  return {
    token: verifyResponse.body.data.token as string,
    userId: verifyResponse.body.data.user.id as string,
    phoneNumber,
    name,
  };
}

export function authHeader(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`];
}

/** Calendar date `days` from today, in the timezone the API uses (UTC in tests). */
export function dateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
