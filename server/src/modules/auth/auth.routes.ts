import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requestOtpSchema, verifyOtpSchema } from '../../schemas/auth.schema';
import * as authController from './auth.controller';

export const authRouter = Router();

// Controllers already wrap their async bodies with `asyncHandler`, so they can
// be mounted directly.
authRouter.post('/request-otp', validate(requestOtpSchema, 'body'), authController.requestOtp);

authRouter.post('/verify-otp', validate(verifyOtpSchema, 'body'), authController.verifyOtp);

authRouter.get('/me', requireAuth, authController.me);

authRouter.post('/logout', requireAuth, authController.logout);
