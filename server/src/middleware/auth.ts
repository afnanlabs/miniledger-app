import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { toIsoString } from '../utils/dates';
import { findUserById } from '../modules/auth/users.repository';
import type { JwtPayload } from '../types';

export const JWT_ISSUER = 'miniledger';
export const JWT_AUDIENCE = 'miniledger-mobile';

/**
 * Verifies the `Authorization: Bearer <token>` header.
 *
 * The token carries a `ver` (token version) claim. The version stored on the
 * user row is compared against it, which is how logout revokes tokens that
 * were already issued (see `auth.service.logout`).
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.toLowerCase().startsWith('bearer ')) {
      throw AppError.unauthorized('Authentication required. Please log in.');
    }

    const token = header.slice(7).trim();
    if (!token) {
      throw AppError.unauthorized('Authentication required. Please log in.');
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as JwtPayload;
    } catch {
      throw AppError.unauthorized('Your session is invalid or has expired. Please log in again.', 'INVALID_TOKEN');
    }

    const user = await findUserById(payload.sub);
    if (!user) {
      throw AppError.unauthorized('Your session is no longer valid. Please log in again.', 'INVALID_TOKEN');
    }

    if (user.token_version !== payload.ver) {
      throw AppError.unauthorized('You have been signed out. Please log in again.', 'TOKEN_REVOKED');
    }

    req.user = {
      id: user.id,
      phoneNumber: user.phone_number,
      tokenVersion: user.token_version,
      createdAt: toIsoString(user.created_at) ?? '',
    };
    next();
  } catch (error) {
    next(error);
  }
};
