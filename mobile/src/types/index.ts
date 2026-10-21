export interface User {
  id: string;
  phoneNumber: string;
  /** Null for accounts that signed in before names were collected. */
  name: string | null;
  createdAt: string;
}

export interface RequestOtpResponse {
  message: string;
  expiresInSeconds: number;
  isNewUser: boolean;
  /** Present only when the server runs with EXPOSE_OTP_IN_RESPONSE=true. */
  devOtp?: string;
}

export interface VerifyOtpResponse {
  token: string;
  expiresInSeconds: number;
  user: User;
}

export type LoanStatus = 'pending' | 'repaid';

export interface Loan {
  id: string;
  friendName: string;
  /** Decimal string, e.g. "1500.00". Never parsed into a float. */
  amount: string;
  /** Calendar date, YYYY-MM-DD. */
  dueDate: string;
  status: LoanStatus;
  repaidAt: string | null;
  isOverdue: boolean;
  daysOverdue: number;
  createdAt: string;
  updatedAt: string;
}

export interface LoanListResponse {
  loans: Loan[];
  total: number;
  limit: number;
  offset: number;
  asOfDate: string;
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

export interface CreateLoanInput {
  friendName: string;
  amount: string;
  dueDate: string;
}

/** PATCH accepts any subset of the create fields. */
export type UpdateLoanInput = Partial<CreateLoanInput>;

export interface FieldError {
  field: string;
  message: string;
}
