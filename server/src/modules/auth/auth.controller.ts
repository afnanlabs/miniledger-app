import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { currentUser, sendOk, validatedBody } from '../../utils/http';
import type { RequestOtpInput, VerifyOtpInput } from '../../schemas/auth.schema';
import * as authService from './auth.service';

export const requestOtp = asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumber } = validatedBody<RequestOtpInput>(req);
  const result = await authService.requestOtp(phoneNumber);
  sendOk(res, result);
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumber, otp } = validatedBody<VerifyOtpInput>(req);
  const result = await authService.verifyOtp(phoneNumber, otp);
  sendOk(res, result);
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  // Mirrors the user object returned by `verify-otp`.
  sendOk(res, {
    id: user.id,
    phoneNumber: user.phoneNumber,
    createdAt: user.createdAt,
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  await authService.logout(user);
  sendOk(res, { message: 'Signed out successfully. This device has been logged out.' });
});
