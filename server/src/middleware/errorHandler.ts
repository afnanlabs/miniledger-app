import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `Cannot ${req.method} ${req.originalUrl}`));
};

/**
 * Central error handler.
 *
 * Only `AppError` instances (and validation problems) are described to the
 * client. Everything else is logged on the server and answered with a generic
 * message so database details, stack traces and secrets never leak.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please check the highlighted fields.',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        success: false,
        error: {
          code: 'RECEIPT_TOO_LARGE',
          message: 'Receipt must be 5 MB or smaller.',
        },
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: {
        code: 'RECEIPT_UPLOAD_ERROR',
        message: 'The receipt upload could not be processed. Send one image in the "receipt" field.',
      },
    });
    return;
  }

  // Multer can surface a malformed multipart body as a plain Error.
  if (
    error instanceof Error &&
    /multipart|unexpected end of form/i.test(error.message)
  ) {
    res.status(400).json({
      success: false,
      error: {
        code: 'RECEIPT_UPLOAD_ERROR',
        message: 'The receipt upload could not be processed.',
      },
    });
    return;
  }

  // Malformed JSON body produced by express.json()
  if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.parse.failed') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' },
    });
    return;
  }

  // eslint-disable-next-line no-console
  console.error('[unhandled-error]', error);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong on our side. Please try again.',
    },
  });
};
