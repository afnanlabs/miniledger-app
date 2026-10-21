import request from 'supertest';
import { app, authHeader, signUp, uniquePhone , resetDatabase } from './helpers';
import { pool } from '../src/config/db';

beforeAll(resetDatabase);

describe('POST /api/v1/auth/request-otp', () => {
  it('rejects a phone number that is not a valid Indian mobile number', async () => {
    const response = await request(app)
      .post('/api/v1/auth/request-otp')
      .send({ phoneNumber: '12345' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details[0].field).toBe('phoneNumber');
  });

  it('rejects a missing phone number', async () => {
    const response = await request(app).post('/api/v1/auth/request-otp').send({}).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('normalises the phone number and returns the OTP expiry', async () => {
    const response = await request(app)
      .post('/api/v1/auth/request-otp')
      .send({ phoneNumber: ' 98765 43210 ' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.expiresInSeconds).toBeGreaterThan(0);
    expect(response.body.data.devOtp).toMatch(/^\d{6}$/);
  });

  it('blocks further requests once the per-number limit is reached', async () => {
    const phoneNumber = uniquePhone();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app).post('/api/v1/auth/request-otp').send({ phoneNumber }).expect(200);
    }

    const response = await request(app)
      .post('/api/v1/auth/request-otp')
      .send({ phoneNumber })
      .expect(429);

    expect(response.body.error.code).toBe('OTP_REQUEST_LIMIT');
  });
});

describe('POST /api/v1/auth/verify-otp', () => {
  it('rejects a wrong OTP and reports the remaining attempts', async () => {
    const phoneNumber = uniquePhone();
    await request(app).post('/api/v1/auth/request-otp').send({ phoneNumber }).expect(200);

    const response = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber, otp: '000000' })
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_OTP');
    expect(response.body.error.details.attemptsRemaining).toBe(4);
  });

  it('rejects an OTP that is not six digits', async () => {
    const response = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber: uniquePhone(), otp: '123' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('issues a JWT for a correct OTP', async () => {
    const phoneNumber = uniquePhone();
    const otpResponse = await request(app)
      .post('/api/v1/auth/request-otp')
      .send({ phoneNumber })
      .expect(200);

    const response = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber, otp: otpResponse.body.data.devOtp })
      .expect(200);

    expect(typeof response.body.data.token).toBe('string');
    expect(response.body.data.user.phoneNumber).toBe(`+91${phoneNumber}`);
  });

  it('cannot reuse an OTP once it has been verified', async () => {
    const phoneNumber = uniquePhone();
    const otpResponse = await request(app)
      .post('/api/v1/auth/request-otp')
      .send({ phoneNumber })
      .expect(200);

    await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber, otp: otpResponse.body.data.devOtp })
      .expect(200);

    const response = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber, otp: otpResponse.body.data.devOtp })
      .expect(400);

    expect(response.body.error.code).toBe('OTP_NOT_FOUND');
  });

  it('rejects an OTP that has expired', async () => {
    const phoneNumber = uniquePhone();
    const otpResponse = await request(app)
      .post('/api/v1/auth/request-otp')
      .send({ phoneNumber })
      .expect(200);

    // Simulate the five minute window elapsing.
    await pool.query(
      `UPDATE otp_challenges SET expires_at = now() - interval '1 minute' WHERE phone_number = $1`,
      [`+91${phoneNumber}`],
    );

    const response = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber, otp: otpResponse.body.data.devOtp })
      .expect(400);

    expect(response.body.error.code).toBe('OTP_EXPIRED');
  });

  it('invalidates the previous OTP when a new one is requested', async () => {
    const phoneNumber = uniquePhone();
    const first = await request(app)
      .post('/api/v1/auth/request-otp')
      .send({ phoneNumber })
      .expect(200);

    const second = await request(app)
      .post('/api/v1/auth/request-otp')
      .send({ phoneNumber })
      .expect(200);

    const stale = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber, otp: first.body.data.devOtp })
      .expect(400);
    // The old challenge is invalidated, so the stale code is checked against the
    // newest challenge and rejected. (OTP_NOT_FOUND covers the case where no
    // active challenge exists at all.)
    expect(['INVALID_OTP', 'OTP_NOT_FOUND']).toContain(stale.body.error.code);

    const fresh = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber, otp: second.body.data.devOtp })
      .expect(200);
    expect(typeof fresh.body.data.token).toBe('string');
  });
});

describe('GET /api/v1/auth/me', () => {
  it('requires a token', async () => {
    const response = await request(app).get('/api/v1/auth/me').expect(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a malformed token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set(...authHeader('not-a-real-token'))
      .expect(401);
    expect(response.body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns the signed-in user', async () => {
    const user = await signUp();
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set(...authHeader(user.token))
      .expect(200);

    expect(response.body.data.id).toBe(user.userId);
    expect(response.body.data.phoneNumber).toBe(`+91${user.phoneNumber}`);
    expect(new Date(response.body.data.createdAt).toString()).not.toBe('Invalid Date');
    expect(response.body.data.tokenVersion).toBeUndefined();
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('revokes the token that was used to log out', async () => {
    const user = await signUp();

    await request(app)
      .post('/api/v1/auth/logout')
      .set(...authHeader(user.token))
      .expect(200);

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set(...authHeader(user.token))
      .expect(401);

    expect(response.body.error.code).toBe('TOKEN_REVOKED');
  });

  it('requires authentication', async () => {
    await request(app).post('/api/v1/auth/logout').expect(401);
  });
});
