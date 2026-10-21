import { AppError } from '../../utils/AppError';
import { daysBetween, toIsoString } from '../../utils/dates';
import { toMoneyString } from '../../utils/money';
import { today } from '../../utils/clock';
import type { LoanView, LoanStatus } from '../../types';
import {
  deletePendingLoan,
  findLoanById,
  insertLoan,
  listLoans,
  markLoanRepaid,
  updatePendingLoan,
  type LoanRow,
  type UpdateLoanFields,
} from './loans.repository';

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
): Promise<LoanView> {
  const asOfDate = today();
  const created = await insertLoan({
    userId,
    friendName: input.friendName,
    amount: input.amount,
    dueDate: input.dueDate,
  });

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
  if (deleted) return;

  const existing = await findLoanById(userId, loanId, today());
  if (!existing) {
    throw AppError.notFound('Loan not found.', 'LOAN_NOT_FOUND');
  }

  throw AppError.conflict(
    'Repaid loans cannot be deleted. They are part of your repayment history.',
    'LOAN_NOT_EDITABLE',
  );
}

export type { LoanStatus };
