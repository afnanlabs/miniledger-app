import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async request handler so that a rejected promise is forwarded to
 * Express' error pipeline. Keeps the route handlers free of try/catch noise.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
