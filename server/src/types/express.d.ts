import type { AuthUser } from './index';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /**
       * Parsed + validated payload produced by the `validate` middleware.
       * Express 5 makes `req.query` a read-only getter, so validated values are
       * stored here instead of being written back onto the request.
       */
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
      /** Populated by the `requireAuth` middleware. */
      user?: AuthUser;
    }
  }
}

export {};
