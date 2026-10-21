import { query, queryOne } from '../../config/db';
import { toMoneyString } from '../../utils/money';
import { today } from '../../utils/clock';
import type { Summary } from '../../types';

interface SummaryRow {
  total_lent: string;
  total_repaid: string;
  pending_amount: string;
  overdue_amount: string;
  loan_count: number;
  pending_count: number;
  repaid_count: number;
  overdue_count: number;
}

/**
 * Financial summary for one user.
 *
 * All aggregation happens inside PostgreSQL on `numeric` columns, so the
 * results are exact decimal values - no JavaScript floating point arithmetic
 * is involved anywhere in the calculation.
 *
 * Definitions:
 *  - totalLent     : every loan ever created (repaid ones included)
 *  - totalRepaid   : loans that have been marked as repaid
 *  - pendingAmount : loans still awaiting repayment
 *  - overdueAmount : pending loans whose due date is before today
 */
export async function getSummaryForUser(userId: string): Promise<Summary> {
  const asOfDate = today();

  const row = await queryOne<SummaryRow>(
    `SELECT
       -- SUM(numeric) is unbounded; do not cast it back to NUMERIC(12,2), which
       -- would overflow once a user has more than one maximum-value loan.
       COALESCE(SUM(amount), 0)                                                        AS total_lent,
       COALESCE(SUM(amount) FILTER (WHERE status = 'repaid'), 0)                        AS total_repaid,
       COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)                       AS pending_amount,
       COALESCE(SUM(amount) FILTER (WHERE status = 'pending' AND due_date < $2::date), 0)
                                                                                                 AS overdue_amount,
       COUNT(*)::int                                                                  AS loan_count,
       COUNT(*) FILTER (WHERE status = 'pending')::int                                 AS pending_count,
       COUNT(*) FILTER (WHERE status = 'repaid')::int                                  AS repaid_count,
       COUNT(*) FILTER (WHERE status = 'pending' AND due_date < $2::date)::int          AS overdue_count
     FROM loans
     WHERE user_id = $1`,
    [userId, asOfDate],
  );

  return {
    totalLent: toMoneyString(row?.total_lent ?? '0'),
    totalRepaid: toMoneyString(row?.total_repaid ?? '0'),
    overdueAmount: toMoneyString(row?.overdue_amount ?? '0'),
    pendingAmount: toMoneyString(row?.pending_amount ?? '0'),
    currency: 'INR',
    loanCount: row?.loan_count ?? 0,
    pendingCount: row?.pending_count ?? 0,
    repaidCount: row?.repaid_count ?? 0,
    overdueCount: row?.overdue_count ?? 0,
    asOfDate,
  };
}
