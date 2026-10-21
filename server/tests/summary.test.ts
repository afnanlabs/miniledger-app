import request from 'supertest';
import { app, authHeader, dateOffset, signUp , resetDatabase } from './helpers';

async function createLoan(
  token: string,
  body: { friendName: string; amount: string; dueDate: string },
): Promise<string> {
  const response = await request(app)
    .post('/api/v1/loans')
    .set(...authHeader(token))
    .send(body)
    .expect(201);
  return response.body.data.id as string;
}

beforeAll(resetDatabase);

describe('GET /api/v1/summary', () => {
  it('returns zeroed totals when the user has no loans', async () => {
    const user = await signUp();

    const response = await request(app)
      .get('/api/v1/summary')
      .set(...authHeader(user.token))
      .expect(200);

    expect(response.body.data).toMatchObject({
      totalLent: '0.00',
      totalRepaid: '0.00',
      overdueAmount: '0.00',
      pendingAmount: '0.00',
      currency: 'INR',
      loanCount: 0,
    });
  });

  it('separates pending, repaid and overdue money', async () => {
    const user = await signUp();

    await createLoan(user.token, {
      friendName: 'Pending',
      amount: '1000.00',
      dueDate: dateOffset(5),
    });
    await createLoan(user.token, {
      friendName: 'Overdue',
      amount: '300.00',
      dueDate: dateOffset(-2),
    });
    const repaidId = await createLoan(user.token, {
      friendName: 'Repaid',
      amount: '500.00',
      dueDate: dateOffset(-10),
    });

    await request(app)
      .patch(`/api/v1/loans/${repaidId}/repay`)
      .set(...authHeader(user.token))
      .expect(200);

    const response = await request(app)
      .get('/api/v1/summary')
      .set(...authHeader(user.token))
      .expect(200);

    const summary = response.body.data;
    // Total lent counts every loan, repaid ones included.
    expect(summary.totalLent).toBe('1800.00');
    expect(summary.totalRepaid).toBe('500.00');
    expect(summary.pendingAmount).toBe('1300.00');
    // Only the pending loan that is past its due date counts as overdue.
    expect(summary.overdueAmount).toBe('300.00');
    expect(summary.loanCount).toBe(3);
    expect(summary.pendingCount).toBe(2);
    expect(summary.repaidCount).toBe(1);
    expect(summary.overdueCount).toBe(1);
    expect(summary.currency).toBe('INR');
  });

  it('treats a loan due today as not overdue', async () => {
    const user = await signUp();

    await createLoan(user.token, {
      friendName: 'Due today',
      amount: '250.00',
      dueDate: dateOffset(0),
    });

    const response = await request(app)
      .get('/api/v1/summary')
      .set(...authHeader(user.token))
      .expect(200);

    expect(response.body.data.overdueAmount).toBe('0.00');
    expect(response.body.data.pendingAmount).toBe('250.00');
    expect(response.body.data.overdueCount).toBe(0);
  });

  it('treats a loan due tomorrow as not overdue', async () => {
    const user = await signUp();

    await createLoan(user.token, {
      friendName: 'Due tomorrow',
      amount: '250.00',
      dueDate: dateOffset(1),
    });

    const response = await request(app)
      .get('/api/v1/summary')
      .set(...authHeader(user.token))
      .expect(200);

    expect(response.body.data.overdueAmount).toBe('0.00');
    expect(response.body.data.pendingAmount).toBe('250.00');
    expect(response.body.data.overdueCount).toBe(0);
  });

  it('treats a loan due yesterday as overdue', async () => {
    const user = await signUp();

    await createLoan(user.token, {
      friendName: 'Due yesterday',
      amount: '250.00',
      dueDate: dateOffset(-1),
    });

    const response = await request(app)
      .get('/api/v1/summary')
      .set(...authHeader(user.token))
      .expect(200);

    expect(response.body.data.overdueAmount).toBe('250.00');
    expect(response.body.data.overdueCount).toBe(1);
  });

  it('stops counting a repaid loan as overdue even with a past due date', async () => {
    const user = await signUp();

    const id = await createLoan(user.token, {
      friendName: 'Late but repaid',
      amount: '400.00',
      dueDate: dateOffset(-30),
    });

    let response = await request(app)
      .get('/api/v1/summary')
      .set(...authHeader(user.token))
      .expect(200);
    expect(response.body.data.overdueAmount).toBe('400.00');

    await request(app)
      .patch(`/api/v1/loans/${id}/repay`)
      .set(...authHeader(user.token))
      .expect(200);

    response = await request(app)
      .get('/api/v1/summary')
      .set(...authHeader(user.token))
      .expect(200);

    expect(response.body.data.overdueAmount).toBe('0.00');
    expect(response.body.data.pendingAmount).toBe('0.00');
    expect(response.body.data.totalRepaid).toBe('400.00');
    expect(response.body.data.totalLent).toBe('400.00');
  });

  it('never includes another user’s loans', async () => {
    const alice = await signUp();
    const bob = await signUp();

    await createLoan(bob.token, {
      friendName: 'Bob loan',
      amount: '999.99',
      dueDate: dateOffset(-1),
    });

    const response = await request(app)
      .get('/api/v1/summary')
      .set(...authHeader(alice.token))
      .expect(200);

    expect(response.body.data.totalLent).toBe('0.00');
    expect(response.body.data.overdueAmount).toBe('0.00');
  });

  it('sums decimals without floating point drift', async () => {
    const user = await signUp();

    await createLoan(user.token, { friendName: 'Small A', amount: '0.10', dueDate: dateOffset(1) });
    await createLoan(user.token, { friendName: 'Small B', amount: '0.20', dueDate: dateOffset(1) });

    const response = await request(app)
      .get('/api/v1/summary')
      .set(...authHeader(user.token))
      .expect(200);

    expect(response.body.data.totalLent).toBe('0.30');
  });

  it('aggregates multiple maximum-value loans without numeric overflow', async () => {
    const user = await signUp();

    // Two maximum NUMERIC(12,2) amounts add up beyond NUMERIC(12,2). The summary
    // must use an unbounded numeric aggregate instead of casting the total back.
    await createLoan(user.token, {
      friendName: 'Maximum A',
      amount: '9999999999.99',
      dueDate: dateOffset(-1),
    });
    await createLoan(user.token, {
      friendName: 'Maximum B',
      amount: '9999999999.99',
      dueDate: dateOffset(-1),
    });

    const response = await request(app)
      .get('/api/v1/summary')
      .set(...authHeader(user.token))
      .expect(200);

    expect(response.body.data).toMatchObject({
      totalLent: '19999999999.98',
      pendingAmount: '19999999999.98',
      overdueAmount: '19999999999.98',
      totalRepaid: '0.00',
      loanCount: 2,
      overdueCount: 2,
    });
  });

  it('requires authentication', async () => {
    await request(app).get('/api/v1/summary').expect(401);
  });
});
