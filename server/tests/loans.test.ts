import request from 'supertest';
import { app, authHeader, dateOffset, signUp, uniquePhone , resetDatabase } from './helpers';

beforeAll(resetDatabase);

describe('POST /api/v1/loans', () => {
  it('creates a loan and returns the stored amount with two decimals', async () => {
    const user = await signUp();

    const response = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Aarav Mehta', amount: '1500', dueDate: dateOffset(7) })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.friendName).toBe('Aarav Mehta');
    expect(response.body.data.amount).toBe('1500.00');
    expect(response.body.data.status).toBe('pending');
    expect(response.body.data.isOverdue).toBe(false);
    expect(response.body.data.repaidAt).toBeNull();
  });

  it('keeps fractional amounts exact', async () => {
    const user = await signUp();

    const response = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Priya', amount: '750.50', dueDate: dateOffset(3) })
      .expect(201);

    expect(response.body.data.amount).toBe('750.50');
  });

  it('rejects an amount of zero', async () => {
    const user = await signUp();
    const response = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Rohan', amount: '0', dueDate: dateOffset(3) })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details[0].field).toBe('amount');
  });

  it('rejects a negative amount', async () => {
    const user = await signUp();
    const response = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Rohan', amount: '-100', dueDate: dateOffset(3) })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an amount with more than two decimal places', async () => {
    const user = await signUp();
    const response = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Rohan', amount: '10.999', dueDate: dateOffset(3) })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an impossible due date', async () => {
    const user = await signUp();
    const response = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Rohan', amount: '100', dueDate: '2026-02-31' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details[0].field).toBe('dueDate');
  });

  it('rejects a due date in the wrong format', async () => {
    const user = await signUp();
    const response = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Rohan', amount: '100', dueDate: '31-12-2026' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty friend name', async () => {
    const user = await signUp();
    const response = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: '  ', amount: '100', dueDate: dateOffset(3) })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires authentication', async () => {
    await request(app)
      .post('/api/v1/loans')
      .send({ friendName: 'Rohan', amount: '100', dueDate: dateOffset(3) })
      .expect(401);
  });
});

describe('GET /api/v1/loans', () => {
  it('returns only the loans of the authenticated user', async () => {
    const alice = await signUp();
    const bob = await signUp();

    await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(alice.token))
      .send({ friendName: 'Alice friend', amount: '100', dueDate: dateOffset(5) })
      .expect(201);

    await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(bob.token))
      .send({ friendName: 'Bob friend', amount: '900', dueDate: dateOffset(5) })
      .expect(201);

    const response = await request(app)
      .get('/api/v1/loans')
      .set(...authHeader(alice.token))
      .expect(200);

    expect(response.body.data.loans).toHaveLength(1);
    expect(response.body.data.loans[0].friendName).toBe('Alice friend');
    expect(response.body.data.total).toBe(1);
  });

  it('filters by status', async () => {
    const user = await signUp();

    await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Pending friend', amount: '100', dueDate: dateOffset(5) })
      .expect(201);

    const created = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Repaid friend', amount: '200', dueDate: dateOffset(5) })
      .expect(201);

    await request(app)
      .patch(`/api/v1/loans/${created.body.data.id}/repay`)
      .set(...authHeader(user.token))
      .expect(200);

    const pending = await request(app)
      .get('/api/v1/loans?status=pending')
      .set(...authHeader(user.token))
      .expect(200);
    expect(pending.body.data.loans).toHaveLength(1);
    expect(pending.body.data.loans[0].friendName).toBe('Pending friend');

    const repaid = await request(app)
      .get('/api/v1/loans?status=repaid')
      .set(...authHeader(user.token))
      .expect(200);
    expect(repaid.body.data.loans).toHaveLength(1);
    expect(repaid.body.data.loans[0].friendName).toBe('Repaid friend');
  });

  it('lists pending loans first, most urgent due date first', async () => {
    const user = await signUp();

    const create = (friendName: string, dueDate: string) =>
      request(app)
        .post('/api/v1/loans')
        .set(...authHeader(user.token))
        .send({ friendName, amount: '100', dueDate })
        .expect(201);

    await create('Later', dateOffset(30));
    await create('Overdue', dateOffset(-3));
    const settled = await create('Settled soon', dateOffset(7));

    await request(app)
      .patch(`/api/v1/loans/${settled.body.data.id}/repay`)
      .set(...authHeader(user.token))
      .expect(200);

    const response = await request(app)
      .get('/api/v1/loans')
      .set(...authHeader(user.token))
      .expect(200);

    expect(response.body.data.loans.map((loan: { friendName: string }) => loan.friendName)).toEqual([
      'Overdue',
      'Later',
      'Settled soon',
    ]);
  });

  it('rejects an invalid status filter', async () => {
    const user = await signUp();
    await request(app)
      .get('/api/v1/loans?status=unknown')
      .set(...authHeader(user.token))
      .expect(400);
  });

  it('requires authentication', async () => {
    await request(app).get('/api/v1/loans').expect(401);
  });
});

describe('GET /api/v1/loans/:id', () => {
  it('returns a single loan', async () => {
    const user = await signUp();
    const created = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Solo', amount: '420.25', dueDate: dateOffset(2) })
      .expect(201);

    const response = await request(app)
      .get(`/api/v1/loans/${created.body.data.id}`)
      .set(...authHeader(user.token))
      .expect(200);

    expect(response.body.data.id).toBe(created.body.data.id);
    expect(response.body.data.amount).toBe('420.25');
  });

  it('does not leak loans belonging to another user', async () => {
    const alice = await signUp();
    const bob = await signUp();

    const created = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(alice.token))
      .send({ friendName: 'Private', amount: '100', dueDate: dateOffset(2) })
      .expect(201);

    const response = await request(app)
      .get(`/api/v1/loans/${created.body.data.id}`)
      .set(...authHeader(bob.token))
      .expect(404);

    expect(response.body.error.code).toBe('LOAN_NOT_FOUND');
  });

  it('returns 404 for an unknown id', async () => {
    const user = await signUp();
    const response = await request(app)
      .get('/api/v1/loans/11111111-1111-4111-8111-111111111111')
      .set(...authHeader(user.token))
      .expect(404);

    expect(response.body.error.code).toBe('LOAN_NOT_FOUND');
  });

  it('returns 400 for a malformed id', async () => {
    const user = await signUp();
    await request(app)
      .get('/api/v1/loans/not-a-uuid')
      .set(...authHeader(user.token))
      .expect(400);
  });
});

describe('PATCH /api/v1/loans/:id/repay', () => {
  it('marks a pending loan as repaid', async () => {
    const user = await signUp();
    const created = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Debtor', amount: '500', dueDate: dateOffset(5) })
      .expect(201);

    const response = await request(app)
      .patch(`/api/v1/loans/${created.body.data.id}/repay`)
      .set(...authHeader(user.token))
      .expect(200);

    expect(response.body.data.status).toBe('repaid');
    expect(response.body.data.repaidAt).not.toBeNull();
    expect(response.body.data.isOverdue).toBe(false);
  });

  it('reports a conflict when the loan was already repaid', async () => {
    const user = await signUp();
    const created = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Debtor', amount: '500', dueDate: dateOffset(5) })
      .expect(201);

    await request(app)
      .patch(`/api/v1/loans/${created.body.data.id}/repay`)
      .set(...authHeader(user.token))
      .expect(200);

    const response = await request(app)
      .patch(`/api/v1/loans/${created.body.data.id}/repay`)
      .set(...authHeader(user.token))
      .expect(409);

    expect(response.body.error.code).toBe('LOAN_ALREADY_REPAID');
  });

  it('does not allow another user to repay a loan', async () => {
    const alice = await signUp();
    const bob = await signUp();

    const created = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(alice.token))
      .send({ friendName: 'Alice loan', amount: '500', dueDate: dateOffset(5) })
      .expect(201);

    const response = await request(app)
      .patch(`/api/v1/loans/${created.body.data.id}/repay`)
      .set(...authHeader(bob.token))
      .expect(404);

    expect(response.body.error.code).toBe('LOAN_NOT_FOUND');
  });

  it('requires authentication', async () => {
    await request(app)
      .patch('/api/v1/loans/11111111-1111-4111-8111-111111111111/repay')
      .expect(401);
  });
});

describe('unknown routes', () => {
  it('returns a JSON 404 for unknown endpoints', async () => {
    const response = await request(app).get('/api/v1/does-not-exist').expect(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});

describe('unique phone numbers', () => {
  it('keeps the generated numbers valid and unique', () => {
    const numbers = new Set(Array.from({ length: 50 }, () => uniquePhone()));
    expect(numbers.size).toBe(50);
    for (const number of numbers) {
      expect(number).toMatch(/^[6-9]\d{9}$/);
    }
  });
});
