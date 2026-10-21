import type { Request, Response } from 'express';

/**
 * Every successful response uses the same envelope:
 * `{ "success": true, "data": ... }`
 */
export function sendOk<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({ success: true, data });
}

/** Reads the body that the `validate` middleware parsed and normalised. */
export function validatedBody<T>(req: Request): T {
  return (req.validated?.body ?? {}) as T;
}

/** Reads the query parameters that the `validate` middleware parsed. */
export function validatedQuery<T>(req: Request): T {
  return (req.validated?.query ?? {}) as T;
}

/** Reads the route parameters that the `validate` middleware parsed. */
export function validatedParams<T>(req: Request): T {
  return (req.validated?.params ?? {}) as T;
}

/** The authenticated user, guaranteed to exist behind `requireAuth`. */
export function currentUser(req: Request): NonNullable<Request['user']> {
  if (!req.user) {
    throw new Error('currentUser() called on an unauthenticated request');
  }
  return req.user;
}
