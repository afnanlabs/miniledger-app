import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { authRouter } from './modules/auth/auth.routes';
import { loansRouter } from './modules/loans/loans.routes';
import { summaryRouter } from './modules/summary/summary.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false }));

  if (env.ENABLE_REQUEST_LOGGING) {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  app.get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', service: 'miniledger-api' } });
  });

  app.get('/api/v1', (_req, res) => {
    res.json({
      success: true,
      data: {
        name: 'MiniLedger API',
        version: 'v1',
        endpoints: [
          'POST   /api/v1/auth/request-otp',
          'POST   /api/v1/auth/verify-otp',
          'GET    /api/v1/auth/me',
          'POST   /api/v1/auth/logout',
          'GET    /api/v1/loans',
          'POST   /api/v1/loans',
          'GET    /api/v1/loans/:id',
          'PATCH  /api/v1/loans/:id/repay',
          'GET    /api/v1/summary',
        ],
      },
    });
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/loans', loansRouter);
  app.use('/api/v1/summary', summaryRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
