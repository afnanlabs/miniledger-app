import { ApiError, apiRequest } from './api';
import type {
  CreateLoanInput,
  Loan,
  LoanListResponse,
  LoanStatus,
  UpdateLoanInput,
} from '../types';

/** The API caps a page at 100 rows; the app walks every page. */
const PAGE_SIZE = 100;

function listPage(
  status: LoanStatus | 'all',
  limit: number,
  offset: number,
): Promise<LoanListResponse> {
  const params = [`limit=${limit}`, `offset=${offset}`];
  if (status !== 'all') params.push(`status=${status}`);
  return apiRequest<LoanListResponse>(`/loans?${params.join('&')}`);
}

export const loansService = {
  /**
   * Loads every page so the UI never silently hides loans past the API's page
   * limit. Counts and filters therefore operate on the complete dataset.
   */
  async listAll(status: LoanStatus | 'all' = 'all'): Promise<LoanListResponse> {
    const loans: Loan[] = [];
    let offset = 0;
    let total = 0;
    let asOfDate = '';

    // Guard against a server that ignores `offset` and returns the same page.
    // Failing loudly is better than showing an incomplete ledger.
    for (let pageNumber = 0; pageNumber < 1000; pageNumber += 1) {
      const page = await listPage(status, PAGE_SIZE, offset);
      total = page.total;
      asOfDate = page.asOfDate;
      loans.push(...page.loans);

      offset += page.loans.length;
      if (page.loans.length === 0 || offset >= total) {
        return { loans, total, limit: loans.length, offset: 0, asOfDate };
      }
    }

    throw new ApiError(
      'This ledger is too large to load at once. Please contact support.',
      0,
      'PAGINATION_LIMIT',
    );
  },

  create(input: CreateLoanInput): Promise<Loan> {
    return apiRequest<Loan>('/loans', { method: 'POST', body: input });
  },

  get(id: string): Promise<Loan> {
    return apiRequest<Loan>(`/loans/${id}`);
  },

  update(id: string, input: UpdateLoanInput): Promise<Loan> {
    return apiRequest<Loan>(`/loans/${id}`, { method: 'PATCH', body: input });
  },

  remove(id: string): Promise<{ id: string }> {
    return apiRequest<{ id: string }>(`/loans/${id}`, { method: 'DELETE' });
  },

  repay(id: string): Promise<Loan> {
    return apiRequest<Loan>(`/loans/${id}/repay`, { method: 'PATCH' });
  },
};
