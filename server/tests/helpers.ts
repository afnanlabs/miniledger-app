import request from 'supertest';
import { createApp } from '../src/app';
import { pool } from '../src/config/db';

export const app = createApp();

let phoneCounter = 0;

/**
 * Empties every table. Called in `beforeAll` of each suite so test files never
 * see each other's data (Jest runs the files one after another via --runInBand).
 */
export async function resetDatabase(): Promise<void> {
  await pool.query('TRUNCATE loans, otp_challenges, users RESTART IDENTITY CASCADE');
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
}

/** Runs the full mock-OTP sign-in flow and returns a usable JWT. */
export async function signUp(phoneNumber = uniquePhone()): Promise<SignedInUser> {
  const requestResponse = await request(app)
    .post('/api/v1/auth/request-otp')
    .send({ phoneNumber })
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
