import { query, queryOne } from '../../config/db';
import type { LoanStatus } from '../../types';

/**
 * `amount` is cast to text so the driver hands us the exact decimal string and
 * `due_date` is rendered with `to_char` so the value is always `YYYY-MM-DD`
 * regardless of the database's DateStyle setting.
 */
const LOAN_COLUMNS = `
  id,
  user_id,
  friend_name,
  amount::text AS amount,
  to_char(due_date, 'YYYY-MM-DD') AS due_date,
  status,
  repaid_at,
  created_at,
  updated_at
`;

/**
 * Overdue helpers.
 *
 * A loan is overdue when it is still `pending` and its due date is *strictly
 * before* today. A loan due today is not overdue yet, and a repaid loan is
 * never overdue - even when its due date lies in the past.
 *
 * `todayRef` is the positional parameter holding today's calendar date
 * (`YYYY-MM-DD`), resolved by the application in `APP_TIMEZONE`.
 */
function overdueColumns(todayRef: string): string {
  return `
    (status = 'pending' AND due_date < ${todayRef}::date) AS is_overdue,
    (CASE WHEN status = 'pending' AND due_date < ${todayRef}::date
          THEN (${todayRef}::date - due_date)::int ELSE 0 END) AS days_overdue
  `;
}

export interface LoanRow {
  id: string;
  user_id: string;
  friend_name: string;
  amount: string;
  due_date: string;
  status: LoanStatus;
  repaid_at: Date | null;
  created_at: Date;
  updated_at: Date;
  is_overdue: boolean;
  days_overdue: number;
}

export interface ListLoansOptions {
  status: 'pending' | 'repaid' | 'all';
  limit: number;
  offset: number;
  /** Today's calendar date, `YYYY-MM-DD`, resolved by the application. */
  today: string;
}

export async function listLoans(
  userId: string,
  options: ListLoansOptions,
): Promise<{ loans: LoanRow[]; total: number }> {
  const filters: string[] = ['user_id = $1'];
  const params: unknown[] = [userId];

  if (options.status !== 'all') {
    params.push(options.status);
    filters.push(`status = $${params.length}`);
  }

  // The "today" parameter is appended after the filters so its position is
  // known, and the filter parameters keep their original numbering.
  params.push(options.today);
  const todayRef = `$${params.length}`;

  const countRows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM loans WHERE ${filters.join(' AND ')}`,
    params.slice(0, params.length - 1),
  );
  const total = Number.parseInt(countRows[0]?.count ?? '0', 10);

  const rows = await query<LoanRow>(
    `SELECT ${LOAN_COLUMNS}, ${overdueColumns(todayRef)}
     FROM loans
     WHERE ${filters.join(' AND ')}
     ORDER BY
       CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
       due_date ASC,
       created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, options.limit, options.offset],
  );

  return { loans: rows, total };
}

export async function findLoanById(
  userId: string,
  loanId: string,
  today: string,
): Promise<LoanRow | null> {
  return queryOne<LoanRow>(
    `SELECT ${LOAN_COLUMNS}, ${overdueColumns('$3')}
     FROM loans
     WHERE id = $1 AND user_id = $2`,
    [loanId, userId, today],
  );
}

export async function insertLoan(params: {
  userId: string;
  friendName: string;
  amount: string;
  dueDate: string;
}): Promise<Omit<LoanRow, 'is_overdue' | 'days_overdue'>> {
  const created = await queryOne<Omit<LoanRow, 'is_overdue' | 'days_overdue'>>(
    `INSERT INTO loans (user_id, friend_name, amount, due_date)
     VALUES ($1, $2, $3, $4::date)
     RETURNING ${LOAN_COLUMNS}`,
    [params.userId, params.friendName, params.amount, params.dueDate],
  );
  if (!created) throw new Error('Unable to create loan');
  return created;
}

/**
 * Marks a pending loan as repaid.
 *
 * The `status = 'pending'` guard makes the update atomic: a second attempt
 * affects zero rows and is reported as a conflict by the service layer.
 */
export async function markLoanRepaid(
  userId: string,
  loanId: string,
  today: string,
): Promise<LoanRow | null> {
  return queryOne<LoanRow>(
    `UPDATE loans
     SET status = 'repaid', repaid_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND status = 'pending'
     RETURNING ${LOAN_COLUMNS}, ${overdueColumns('$3')}`,
    [loanId, userId, today],
  );
}
