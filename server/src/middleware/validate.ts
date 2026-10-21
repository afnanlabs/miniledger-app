import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { AppError } from '../utils/AppError';

type Source = 'body' | 'query' | 'params';

export interface ValidationIssue {
  field: string;
  message: string;
}

/**
 * Validates and normalises one part of the request against a Zod schema.
 *
 * The parsed result is stored on `req.validated` instead of overwriting
 * `req.body` / `req.query` / `req.params` - Express 5 exposes `req.query` as a
 * read-only getter, so writing to it would throw.
 */
export function validate<S extends z.ZodType>(schema: S, source: Source): RequestHandler {
  return (req, _res, next) => {
    const input = source === 'body' ? req.body : source === 'query' ? req.query : req.params;

    const result = schema.safeParse(input);
    if (!result.success) {
      const details: ValidationIssue[] = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));
      next(new AppError(400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', details));
      return;
    }

    req.validated = { ...(req.validated ?? {}), [source]: result.data };
    next();
  };
}
