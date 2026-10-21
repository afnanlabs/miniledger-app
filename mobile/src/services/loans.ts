import { apiRequest } from './api';
import type { CreateLoanInput, Loan, LoanListResponse, LoanStatus } from '../types';

export const loansService = {
  list(status: LoanStatus | 'all' = 'all'): Promise<LoanListResponse> {
    const query = status === 'all' ? '' : `?status=${status}`;
    return apiRequest<LoanListResponse>(`/loans${query}`);
  },

  create(input: CreateLoanInput): Promise<Loan> {
    return apiRequest<Loan>('/loans', { method: 'POST', body: input });
  },

  get(id: string): Promise<Loan> {
    return apiRequest<Loan>(`/loans/${id}`);
  },

  repay(id: string): Promise<Loan> {
    return apiRequest<Loan>(`/loans/${id}/repay`, { method: 'PATCH' });
  },
};
