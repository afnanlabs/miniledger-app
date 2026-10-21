import request from 'supertest';
import { app, authHeader, dateOffset, signUp, uniquePhone, resetDatabase } from './helpers';

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

  it('paginates without changing the total or repeating loans', async () => {
    const user = await signUp();

    for (let index = 1; index <= 5; index += 1) {
      await request(app)
        .post('/api/v1/loans')
        .set(...authHeader(user.token))
        .send({ friendName: `Friend ${index}`, amount: '100', dueDate: dateOffset(index) })
        .expect(201);
    }

    const page = await request(app)
      .get('/api/v1/loans?limit=2&offset=2')
      .set(...authHeader(user.token))
      .expect(200);

    expect(page.body.data.total).toBe(5);
    expect(page.body.data.limit).toBe(2);
    expect(page.body.data.offset).toBe(2);
    expect(page.body.data.loans.map((loan: { friendName: string }) => loan.friendName)).toEqual([
      'Friend 3',
      'Friend 4',
    ]);

    const secondPage = await request(app)
      .get('/api/v1/loans?limit=2&offset=4')
      .set(...authHeader(user.token))
      .expect(200);

    expect(secondPage.body.data.loans.map((loan: { friendName: string }) => loan.friendName)).toEqual([
      'Friend 5',
    ]);
    expect(page.body.data.asOfDate).toBe(secondPage.body.data.asOfDate);
  });

  it('supports status filters and pagination together', async () => {
    const user = await signUp();

    for (let index = 1; index <= 3; index += 1) {
      const created = await request(app)
        .post('/api/v1/loans')
        .set(...authHeader(user.token))
        .send({ friendName: `Pending ${index}`, amount: '100', dueDate: dateOffset(index) })
        .expect(201);

      if (index === 3) {
        await request(app)
          .patch(`/api/v1/loans/${created.body.data.id}/repay`)
          .set(...authHeader(user.token))
          .expect(200);
      }
    }

    const response = await request(app)
      .get('/api/v1/loans?status=pending&limit=1&offset=1')
      .set(...authHeader(user.token))
      .expect(200);

    expect(response.body.data.total).toBe(2);
    expect(response.body.data.loans).toHaveLength(1);
    expect(response.body.data.loans[0].friendName).toBe('Pending 2');
  });

  it('rejects a page size above the maximum', async () => {
    const user = await signUp();
    await request(app)
      .get('/api/v1/loans?limit=101')
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

describe('PATCH /api/v1/loans/:id', () => {
  it('updates all editable fields on a pending loan', async () => {
    const user = await signUp();
    const created = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Old name', amount: '100', dueDate: dateOffset(2) })
      .expect(201);

    const response = await request(app)
      .patch(`/api/v1/loans/${created.body.data.id}`)
      .set(...authHeader(user.token))
      .send({ friendName: 'New name', amount: '1500.5', dueDate: dateOffset(9) })
      .expect(200);

    expect(response.body.data.friendName).toBe('New name');
    expect(response.body.data.amount).toBe('1500.50');
    expect(response.body.data.dueDate).toBe(dateOffset(9));
    expect(response.body.data.status).toBe('pending');
    expect(response.body.data.repaidAt).toBeNull();
  });

  it('allows updating a single field', async () => {
    const user = await signUp();
    const created = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Keep me', amount: '250', dueDate: dateOffset(4) })
      .expect(201);

    const response = await request(app)
      .patch(`/api/v1/loans/${created.body.data.id}`)
      .set(...authHeader(user.token))
      .send({ amount: '999.99' })
      .expect(200);

    expect(response.body.data.friendName).toBe('Keep me');
    expect(response.body.data.amount).toBe('999.99');
    expect(response.body.data.dueDate).toBe(dateOffset(4));
  });

  it('recalculates overdue state when the due date moves into the past', async () => {
    const user = await signUp();
    const created = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Late payer', amount: '300', dueDate: dateOffset(4) })
      .expect(201);

    const response = await request(app)
      .patch(`/api/v1/loans/${created.body.data.id}`)
      .set(...authHeader(user.token))
      .send({ dueDate: dateOffset(-2) })
      .expect(200);

    expect(response.body.data.dueDate).toBe(dateOffset(-2));
    expect(response.body.data.isOverdue).toBe(true);
    expect(response.body.data.daysOverdue).toBe(2);
  });

  it('accepts the maximum supported amount', async () => {
    const user = await signUp();
    const created = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Boundary', amount: '1', dueDate: dateOffset(4) })
      .expect(201);

    const response = await request(app)
      .patch(`/api/v1/loans/${created.body.data.id}`)
      .set(...authHeader(user.token))
      .send({ amount: '9999999999.99' })
      .expect(200);

    expect(response.body.data.amount).toBe('9999999999.99');
  });

  it('rejects an empty update body', async () => {
    const user = await signUp();
    const created = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'No changes', amount: '100', dueDate: dateOffset(2) })
      .expect(201);

    const response = await request(app)
      .patch(`/api/v1/loans/${created.body.data.id}`)
      .set(...authHeader(user.token))
      .send({})
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('validates updated fields', async () => {
    const user = await signUp();
    const created = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Validate me', amount: '100', dueDate: dateOffset(2) })
      .expect(201);

    await request(app)
      .patch(`/api/v1/loans/${created.body.data.id}`)
      .set(...authHeader(user.token))
      .send({ friendName: 'A' })
      .expect(400);

    await request(app)
      .patch(`/api/v1/loans/${created.body.data.id}`)
      .set(...authHeader(user.token))
      .send({ amount: '0' })
      .expect(400);

    await request(app)
      .patch(`/api/v1/loans/${created.body.data.id}`)
      .set(...authHeader(user.token))
      .send({ amount: '10000000000' })
      .expect(400);

    await request(app)
      .patch(`/api/v1/loans/${created.body.data.id}`)
      .set(...authHeader(user.token))
      .send({ dueDate: '2026-02-30' })
      .expect(400);
  });

  it('does not allow another user to update a loan', async () => {
    const alice = await signUp();
    const bob = await signUp();
    const created = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(alice.token))
      .send({ friendName: 'Alice private', amount: '100', dueDate: dateOffset(2) })
      .expect(201);

    const response = await request(app)
      .patch(`/api/v1/loans/${created.body.data.id}`)
      .set(...authHeader(bob.token))
      .send({ amount: '1' })
      .expect(404);

    expect(response.body.error.code).toBe('LOAN_NOT_FOUND');
  });

  it('returns 404 for an unknown loan and 400 for a malformed id', async () => {
    const user = await signUp();
    await request(app)
      .patch('/api/v1/loans/11111111-1111-4111-8111-111111111111')
      .set(...authHeader(user.token))
      .send({ amount: '1' })
      .expect(404);

    await request(app)
      .patch('/api/v1/loans/not-a-uuid')
      .set(...authHeader(user.token))
      .send({ amount: '1' })
      .expect(400);
  });

  it('refuses to edit a repaid loan', async () => {
    const user = await signUp();
    const created = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Settled', amount: '500', dueDate: dateOffset(2) })
      .expect(201);

    await request(app)
      .patch(`/api/v1/loans/${created.body.data.id}/repay`)
      .set(...authHeader(user.token))
      .expect(200);

    const response = await request(app)
      .patch(`/api/v1/loans/${created.body.data.id}`)
      .set(...authHeader(user.token))
      .send({ amount: '1' })
      .expect(409);

    expect(response.body.error.code).toBe('LOAN_NOT_EDITABLE');
  });

  it('requires authentication', async () => {
    await request(app)
      .patch('/api/v1/loans/11111111-1111-4111-8111-111111111111')
      .send({ amount: '1' })
      .expect(401);
  });
});

describe('DELETE /api/v1/loans/:id', () => {
  it('deletes a pending loan and removes it from the list', async () => {
    const user = await signUp();
    const created = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Mistake', amount: '100', dueDate: dateOffset(2) })
      .expect(201);

    const response = await request(app)
      .delete(`/api/v1/loans/${created.body.data.id}`)
      .set(...authHeader(user.token))
      .expect(200);

    expect(response.body.data.id).toBe(created.body.data.id);

    await request(app)
      .get(`/api/v1/loans/${created.body.data.id}`)
      .set(...authHeader(user.token))
      .expect(404);

    const list = await request(app)
      .get('/api/v1/loans')
      .set(...authHeader(user.token))
      .expect(200);
    expect(list.body.data.total).toBe(0);
  });

  it('does not allow another user to delete a loan', async () => {
    const alice = await signUp();
    const bob = await signUp();
    const created = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(alice.token))
      .send({ friendName: 'Alice private', amount: '100', dueDate: dateOffset(2) })
      .expect(201);

    await request(app)
      .delete(`/api/v1/loans/${created.body.data.id}`)
      .set(...authHeader(bob.token))
      .expect(404);

    await request(app)
      .get(`/api/v1/loans/${created.body.data.id}`)
      .set(...authHeader(alice.token))
      .expect(200);
  });

  it('returns 404 for an unknown loan and 400 for a malformed id', async () => {
    const user = await signUp();
    await request(app)
      .delete('/api/v1/loans/11111111-1111-4111-8111-111111111111')
      .set(...authHeader(user.token))
      .expect(404);

    await request(app)
      .delete('/api/v1/loans/not-a-uuid')
      .set(...authHeader(user.token))
      .expect(400);
  });

  it('refuses to delete a repaid loan', async () => {
    const user = await signUp();
    const created = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Settled', amount: '500', dueDate: dateOffset(2) })
      .expect(201);

    await request(app)
      .patch(`/api/v1/loans/${created.body.data.id}/repay`)
      .set(...authHeader(user.token))
      .expect(200);

    const response = await request(app)
      .delete(`/api/v1/loans/${created.body.data.id}`)
      .set(...authHeader(user.token))
      .expect(409);

    expect(response.body.error.code).toBe('LOAN_NOT_EDITABLE');

    await request(app)
      .get(`/api/v1/loans/${created.body.data.id}`)
      .set(...authHeader(user.token))
      .expect(200);
  });

  it('requires authentication', async () => {
    await request(app)
      .delete('/api/v1/loans/11111111-1111-4111-8111-111111111111')
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
