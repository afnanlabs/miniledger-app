import { z } from 'zod';

/**
 * Indian mobile numbers: 10 digits starting with 6-9.
 * Accepts `9876543210`, `+919876543210`, `91 98765 43210` and similar forms and
 * normalises them to the E.164 style `+919876543210` used as the unique key.
 */
export const phoneNumberSchema = z
  .string({ error: 'Phone number is required' })
  .trim()
  .transform((value) => value.replace(/[\s\-()]/g, ''))
  .refine((value) => /^(?:\+?91)?[6-9]\d{9}$/.test(value), {
    message: 'Enter a valid 10-digit mobile number starting with 6-9',
  })
  .transform((value) => {
    const digits = value.replace(/\D/g, '');
    return digits.length === 10 ? `+91${digits}` : `+${digits}`;
  });

/** Six digit one-time password. */
export const otpSchema = z
  .string({ error: 'OTP is required' })
  .trim()
  .regex(/^\d{6}$/, 'OTP must be exactly 6 digits');

/** Display name collected at sign-in. */
export const userNameSchema = z
  .string({ error: 'Full name is required' })
  .trim()
  .min(2, 'Full name must be at least 2 characters')
  .max(80, 'Full name must be 80 characters or fewer');

export const requestOtpSchema = z.object({
  phoneNumber: phoneNumberSchema,
  name: userNameSchema,
});

export const verifyOtpSchema = z.object({
  phoneNumber: phoneNumberSchema,
  otp: otpSchema,
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
