import fs from 'node:fs';
import { AppError } from '../../utils/AppError';
import { daysBetween, toIsoString } from '../../utils/dates';
import { toMoneyString } from '../../utils/money';
import { today } from '../../utils/clock';
import type { LoanView, LoanStatus } from '../../types';
import {
  MAX_RECEIPT_BYTES,
  deleteReceiptFile,
  detectImageMime,
  isAllowedReceiptMime,
  resolveReceiptPath,
  storeReceipt,
  type StoredReceipt,
} from '../../storage/receiptStorage';
import {
  deletePendingLoan,
  findLoanById,
  findLoanReceipt,
  insertLoan,
  listLoans,
  markLoanRepaid,
  updatePendingLoan,
  type LoanRow,
  type UpdateLoanFields,
} from './loans.repository';

export interface ReceiptUploadFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface LoanReceiptFile {
  absolutePath: string;
  mimeType: string;
  originalName: string | null;
  sizeBytes: number;
}

export function toLoanView(row: LoanRow): LoanView {
  return {
    id: row.id,
    friendName: row.friend_name,
    amount: toMoneyString(row.amount),
    dueDate: row.due_date,
    status: row.status,
    repaidAt: toIsoString(row.repaid_at),
    isOverdue: row.is_overdue,
    daysOverdue: row.days_overdue,
    createdAt: toIsoString(row.created_at) ?? '',
    updatedAt: toIsoString(row.updated_at) ?? '',
    receipt:
      row.receipt_storage_key &&
      row.receipt_mime_type &&
      row.receipt_size_bytes !== null
        ? {
            url: `/loans/${row.id}/receipt`,
            mimeType: row.receipt_mime_type,
            originalName: row.receipt_original_name,
            sizeBytes: row.receipt_size_bytes,
          }
        : null,
  };
}

export interface LoanListResult {
  loans: LoanView[];
  total: number;
  limit: number;
  offset: number;
  asOfDate: string;
}

export async function listLoansForUser(
  userId: string,
  options: { status: 'pending' | 'repaid' | 'all'; limit: number; offset: number },
): Promise<LoanListResult> {
  const asOfDate = today();
  const { loans, total } = await listLoans(userId, { ...options, today: asOfDate });

  return {
    loans: loans.map(toLoanView),
    total,
    limit: options.limit,
    offset: options.offset,
    asOfDate,
  };
}

export async function createLoanForUser(
  userId: string,
  input: { friendName: string; amount: string; dueDate: string },
  receiptFile?: ReceiptUploadFile,
): Promise<LoanView> {
  const asOfDate = today();
  let storedReceipt: StoredReceipt | null = null;

  if (receiptFile) {
    if (receiptFile.buffer.length > MAX_RECEIPT_BYTES) {
      throw new AppError(413, 'RECEIPT_TOO_LARGE', 'Receipt must be 5 MB or smaller.');
    }

    // The MIME header is not trusted: the bytes must actually be a supported
    // image. The detected type also determines the stored file extension.
    const detectedMime = detectImageMime(receiptFile.buffer);
    if (!detectedMime) {
      throw new AppError(
        400,
        'INVALID_RECEIPT_FILE',
        'Receipt must be a valid JPEG, PNG, or WebP image.',
      );
    }

    storedReceipt = await storeReceipt(
      receiptFile.buffer,
      detectedMime,
      receiptFile.originalname,
    );
  }

  let created: Awaited<ReturnType<typeof insertLoan>>;
  try {
    created = await insertLoan({
      userId,
      friendName: input.friendName,
      amount: input.amount,
      dueDate: input.dueDate,
      receipt: storedReceipt
        ? {
            storageKey: storedReceipt.storageKey,
            mimeType: storedReceipt.mimeType,
            originalName: storedReceipt.originalName,
            sizeBytes: storedReceipt.sizeBytes,
          }
        : null,
    });
  } catch (error) {
    // The file was written first so the loan never points at a missing file.
    // If the database insert fails, remove it rather than leave an orphan.
    if (storedReceipt) {
      await deleteReceiptFile(storedReceipt.storageKey).catch((cleanupError) => {
        // eslint-disable-next-line no-console
        console.error('[receipt-cleanup] Unable to remove receipt after failed loan insert', cleanupError);
      });
    }
    throw error;
  }

  const isOverdue = created.status === 'pending' && created.due_date < asOfDate;

  return toLoanView({
    ...created,
    is_overdue: isOverdue,
    days_overdue: isOverdue ? daysBetween(created.due_date, asOfDate) : 0,
  });
}

/**
 * Returns a single loan owned by the authenticated user.
 *
 * Loans owned by somebody else are reported as "not found" on purpose - the API
 * never reveals whether a given id exists for another account.
 */
export async function getLoanForUser(userId: string, loanId: string): Promise<LoanView> {
  const row = await findLoanById(userId, loanId, today());
  if (!row) {
    throw AppError.notFound('Loan not found.', 'LOAN_NOT_FOUND');
  }
  return toLoanView(row);
}

export async function repayLoanForUser(userId: string, loanId: string): Promise<LoanView> {
  const asOfDate = today();
  const updated = await markLoanRepaid(userId, loanId, asOfDate);

  if (updated) {
    return toLoanView(updated);
  }

  // Nothing was updated: either the loan does not exist for this user, or it
  // has already been repaid.
  const existing = await findLoanById(userId, loanId, asOfDate);
  if (!existing) {
    throw AppError.notFound('Loan not found.', 'LOAN_NOT_FOUND');
  }

  throw AppError.conflict('This loan has already been marked as repaid.', 'LOAN_ALREADY_REPAID');
}

/**
 * Repaid loans are immutable: changing or deleting them would rewrite settled
 * history and the financial summary. They must be corrected before repayment.
 */
export async function updateLoanForUser(
  userId: string,
  loanId: string,
  fields: UpdateLoanFields,
): Promise<LoanView> {
  const asOfDate = today();
  const updated = await updatePendingLoan(userId, loanId, fields, asOfDate);

  if (updated) {
    return toLoanView(updated);
  }

  const existing = await findLoanById(userId, loanId, asOfDate);
  if (!existing) {
    throw AppError.notFound('Loan not found.', 'LOAN_NOT_FOUND');
  }

  throw AppError.conflict(
    'Repaid loans cannot be edited. Create a new loan instead.',
    'LOAN_NOT_EDITABLE',
  );
}

export async function deleteLoanForUser(userId: string, loanId: string): Promise<void> {
  const deleted = await deletePendingLoan(userId, loanId);
  if (deleted) {
    if (deleted.receiptStorageKey) {
      // The database row is already gone. A failed unlink must not turn a
      // successful delete into an error; log it so the orphan can be cleaned up.
      await deleteReceiptFile(deleted.receiptStorageKey).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('[receipt-cleanup] Unable to remove receipt for deleted loan', error);
      });
    }
    return;
  }

  const existing = await findLoanById(userId, loanId, today());
  if (!existing) {
    throw AppError.notFound('Loan not found.', 'LOAN_NOT_FOUND');
  }

  throw AppError.conflict(
    'Repaid loans cannot be deleted. They are part of your repayment history.',
    'LOAN_NOT_EDITABLE',
  );
}

/**
 * Resolves an owned receipt for streaming. A missing row, a loan owned by
 * another user, and an invalid storage key all produce the same 404 so the API
 * does not reveal whether a receipt exists elsewhere.
 */
export async function getLoanReceiptForUser(
  userId: string,
  loanId: string,
): Promise<LoanReceiptFile> {
  const row = await findLoanReceipt(userId, loanId);

  if (
    !row ||
    !row.receipt_storage_key ||
    !row.receipt_mime_type ||
    row.receipt_size_bytes === null ||
    !isAllowedReceiptMime(row.receipt_mime_type)
  ) {
    throw AppError.notFound('Receipt not found.', 'RECEIPT_NOT_FOUND');
  }

  const absolutePath = resolveReceiptPath(row.receipt_storage_key);
  if (!absolutePath) {
    throw AppError.notFound('Receipt not found.', 'RECEIPT_NOT_FOUND');
  }

  try {
    await fs.promises.access(absolutePath, fs.constants.R_OK);
  } catch {
    throw AppError.notFound('Receipt not found.', 'RECEIPT_NOT_FOUND');
  }

  return {
    absolutePath,
    mimeType: row.receipt_mime_type,
    originalName: row.receipt_original_name,
    sizeBytes: row.receipt_size_bytes,
  };
}

export type { LoanStatus };
