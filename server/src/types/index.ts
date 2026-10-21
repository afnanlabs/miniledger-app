/** Loan lifecycle state stored in `loans.status`. */
export type LoanStatus = 'pending' | 'repaid';

export interface User {
  id: string;
  phone_number: string;
  /** Display name. Null for accounts created before names were collected. */
  name: string | null;
  token_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface OtpChallenge {
  id: string;
  user_id: string | null;
  phone_number: string;
  /** Name submitted with the request, or null when it was not provided. */
  requested_name: string | null;
  code_hash: string;
  attempts: number;
  max_attempts: number;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
}

export interface Loan {
  id: string;
  user_id: string;
  friend_name: string;
  /** Kept as a decimal string - never converted to a JS number. */
  amount: string;
  /** Calendar date, `YYYY-MM-DD`. */
  due_date: string;
  status: LoanStatus;
  repaid_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface AuthUser {
  id: string;
  phoneNumber: string;
  /** Null for accounts that have not provided a name yet. */
  name: string | null;
  tokenVersion: number;
  /** ISO-8601 timestamp of when the account was created. */
  createdAt: string;
}

export interface JwtPayload {
  /** User id. */
  sub: string;
  /** Phone number of the signed-in user. */
  phone: string;
  /** Token version - bumped on logout to revoke previously issued tokens. */
  ver: number;
  iat?: number;
  exp?: number;
}

export interface Summary {
  totalLent: string;
  totalRepaid: string;
  overdueAmount: string;
  pendingAmount: string;
  currency: string;
  loanCount: number;
  pendingCount: number;
  repaidCount: number;
  overdueCount: number;
  asOfDate: string;
}

export interface LoanView {
  id: string;
  friendName: string;
  amount: string;
  dueDate: string;
  status: LoanStatus;
  repaidAt: string | null;
  isOverdue: boolean;
  daysOverdue: number;
  createdAt: string;
  updatedAt: string;
}
