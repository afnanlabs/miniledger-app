import { apiRequest } from './api';
import type { RequestOtpResponse, User, VerifyOtpResponse } from '../types';

export const authService = {
  requestOtp(phoneNumber: string): Promise<RequestOtpResponse> {
    return apiRequest<RequestOtpResponse>('/auth/request-otp', {
      method: 'POST',
      body: { phoneNumber },
    });
  },

  verifyOtp(phoneNumber: string, otp: string): Promise<VerifyOtpResponse> {
    return apiRequest<VerifyOtpResponse>('/auth/verify-otp', {
      method: 'POST',
      body: { phoneNumber, otp },
    });
  },

  me(): Promise<User> {
    return apiRequest<User>('/auth/me');
  },

  logout(): Promise<{ message: string }> {
    return apiRequest<{ message: string }>('/auth/logout', { method: 'POST' });
  },
};
