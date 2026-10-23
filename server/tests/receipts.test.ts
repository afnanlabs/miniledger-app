import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { pool } from '../src/config/db';
import { MAX_RECEIPT_BYTES, RECEIPT_ROOT } from '../src/storage/receiptStorage';
import { app, authHeader, dateOffset, resetDatabase, signUp } from './helpers';

beforeAll(resetDatabase);

/** A real 1x1 PNG; the server validates the file signature, not just the MIME header. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lK3r9wAAAABJRU5ErkJggg==',
  'base64',
);

function receiptFiles(): string[] {
  if (!fs.existsSync(RECEIPT_ROOT)) return [];
  return fs.readdirSync(RECEIPT_ROOT);
}

async function receiptKey(loanId: string): Promise<string | null> {
  const result = await pool.query(
    'SELECT receipt_storage_key FROM loans WHERE id = $1',
    [loanId],
  );
  return (result.rows[0]?.receipt_storage_key as string | null | undefined) ?? null;
}

function postWithReceipt(token: string, buffer = PNG) {
  return request(app)
    .post('/api/v1/loans')
    .set(...authHeader(token))
    .field('friendName', 'Receipt Friend')
    .field('amount', '250.50')
    .field('dueDate', dateOffset(7))
    .attach('receipt', buffer, { filename: 'receipt.png', contentType: 'image/png' });
}

describe('receipt upload', () => {
  it('creates a loan without a receipt', async () => {
    const user = await signUp();

    const response = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'No Receipt', amount: '100', dueDate: dateOffset(2) })
      .expect(201);

    expect(response.body.data.receipt).toBeNull();
  });

  it('stores a valid receipt and streams it only to its owner', async () => {
    const owner = await signUp();
    const other = await signUp();

    const created = await postWithReceipt(owner.token).expect(201);
    const loanId = created.body.data.id as string;

    expect(created.body.data.receipt).toMatchObject({
      url: `/loans/${loanId}/receipt`,
      mimeType: 'image/png',
      originalName: 'receipt.png',
      sizeBytes: PNG.length,
    });

    const storageKey = await receiptKey(loanId);
    expect(storageKey).toMatch(/^receipts\/[0-9a-f-]+\.png$/);
    expect(fs.existsSync(path.join(RECEIPT_ROOT, path.basename(storageKey!)))).toBe(true);

    const download = await request(app)
      .get(`/api/v1/loans/${loanId}/receipt`)
      .set(...authHeader(owner.token))
      .expect(200);

    expect(download.headers['content-type']).toContain('image/png');
    expect(download.headers['cache-control']).toBe('private, no-store');
    expect(Buffer.isBuffer(download.body)).toBe(true);
    expect((download.body as Buffer).equals(PNG)).toBe(true);

    const crossUser = await request(app)
      .get(`/api/v1/loans/${loanId}/receipt`)
      .set(...authHeader(other.token))
      .expect(404);

    expect(crossUser.body.error.code).toBe('RECEIPT_NOT_FOUND');
  });

  it('requires authentication before accepting an upload', async () => {
    const before = receiptFiles().length;

    await request(app)
      .post('/api/v1/loans')
      .field('friendName', 'Anonymous Upload')
      .field('amount', '10')
      .field('dueDate', dateOffset(1))
      .attach('receipt', PNG, { filename: 'receipt.png', contentType: 'image/png' })
      .expect(401);

    expect(receiptFiles().length).toBe(before);
  });

  it('rejects an unsupported file type without creating a loan or file', async () => {
    const user = await signUp();
    const before = receiptFiles().length;

    const response = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .field('friendName', 'Text Receipt')
      .field('amount', '50')
      .field('dueDate', dateOffset(2))
      .attach('receipt', Buffer.from('not an image'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    expect(response.body.error.code).toBe('UNSUPPORTED_RECEIPT_TYPE');
    expect(receiptFiles().length).toBe(before);

    const list = await request(app)
      .get('/api/v1/loans')
      .set(...authHeader(user.token))
      .expect(200);
    expect(list.body.data.total).toBe(0);
  });

  it('rejects a spoofed image MIME type using the file signature', async () => {
    const user = await signUp();
    const before = receiptFiles().length;

    const response = await postWithReceipt(
      user.token,
      Buffer.from('this is not really a png'),
    ).expect(400);

    expect(response.body.error.code).toBe('INVALID_RECEIPT_FILE');
    expect(receiptFiles().length).toBe(before);

    const list = await request(app)
      .get('/api/v1/loans')
      .set(...authHeader(user.token))
      .expect(200);
    expect(list.body.data.total).toBe(0);
  });

  it('rejects an oversized receipt without creating a loan or file', async () => {
    const user = await signUp();
    const before = receiptFiles().length;

    const response = await postWithReceipt(
      user.token,
      Buffer.alloc(MAX_RECEIPT_BYTES + 1),
    ).expect(413);

    expect(response.body.error.code).toBe('RECEIPT_TOO_LARGE');
    expect(receiptFiles().length).toBe(before);

    const list = await request(app)
      .get('/api/v1/loans')
      .set(...authHeader(user.token))
      .expect(200);
    expect(list.body.data.total).toBe(0);
  });

  it('does not write a file when field validation fails', async () => {
    const user = await signUp();
    const before = receiptFiles().length;

    await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .field('friendName', 'A')
      .field('amount', 'not-money')
      .field('dueDate', dateOffset(2))
      .attach('receipt', PNG, { filename: 'receipt.png', contentType: 'image/png' })
      .expect(400);

    expect(receiptFiles().length).toBe(before);
  });

  it('removes the receipt file when its loan is deleted', async () => {
    const user = await signUp();
    const created = await postWithReceipt(user.token).expect(201);
    const loanId = created.body.data.id as string;
    const storageKey = await receiptKey(loanId);
    const absolutePath = path.join(RECEIPT_ROOT, path.basename(storageKey!));

    expect(fs.existsSync(absolutePath)).toBe(true);

    await request(app)
      .delete(`/api/v1/loans/${loanId}`)
      .set(...authHeader(user.token))
      .expect(200);

    expect(fs.existsSync(absolutePath)).toBe(false);

    await request(app)
      .get(`/api/v1/loans/${loanId}/receipt`)
      .set(...authHeader(user.token))
      .expect(404);
  });

  it('refuses a storage key that escapes the upload root', async () => {
    const user = await signUp();
    const created = await request(app)
      .post('/api/v1/loans')
      .set(...authHeader(user.token))
      .send({ friendName: 'Traversal Loan', amount: '25', dueDate: dateOffset(2) })
      .expect(201);
    const loanId = created.body.data.id as string;

    await pool.query(
      `UPDATE loans
       SET receipt_storage_key = '../outside.png',
           receipt_mime_type = 'image/png',
           receipt_size_bytes = 3
       WHERE id = $1`,
      [loanId],
    );

    const response = await request(app)
      .get(`/api/v1/loans/${loanId}/receipt`)
      .set(...authHeader(user.token))
      .expect(404);

    expect(response.body.error.code).toBe('RECEIPT_NOT_FOUND');
  });
});
