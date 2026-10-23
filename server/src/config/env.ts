import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

/**
 * Local development defaults.
 *
 * These make a fresh clone runnable against a local PostgreSQL instance without
 * any extra setup. In `production` the application refuses to boot while these
 * defaults are in use - real deployments must provide their own credentials.
 */
const LOCAL_DEV_DEFAULTS = {
  DATABASE_URL: 'postgres://miniledger:miniledger_dev_pw@127.0.0.1:5432/miniledger',
  JWT_SECRET: 'local-development-only-secret-do-not-use-in-production',
} as const;

const booleanFlag = z
  .enum(['true', 'false'])
  .default('true')
  .transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),

  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().min(1).optional(),

  /** Directory for uploaded files. Defaults to `<server cwd>/uploads`. */
  UPLOAD_DIR: z.string().min(1).optional(),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),

  /** Timezone used to decide which calendar day counts as "today". */
  APP_TIMEZONE: z.string().min(1).default('Asia/Kolkata'),

  OTP_TTL_SECONDS: z.coerce.number().int().min(10).max(3600).default(300),
  OTP_MAX_VERIFY_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
  OTP_MAX_REQUESTS_PER_WINDOW: z.coerce.number().int().min(1).max(100).default(5),
  OTP_REQUEST_WINDOW_SECONDS: z.coerce.number().int().min(10).max(86400).default(900),

  LOG_OTP_TO_CONSOLE: booleanFlag,
  EXPOSE_OTP_IN_RESPONSE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),

  CORS_ORIGIN: z.string().default('*'),
  ENABLE_REQUEST_LOGGING: booleanFlag,
});

const rawEnv = { ...process.env };

// Apply local-dev defaults only when nothing was supplied.
const withDefaults: Record<string, unknown> = { ...rawEnv };
if (!rawEnv.DATABASE_URL && rawEnv.NODE_ENV !== 'production') {
  withDefaults.DATABASE_URL = LOCAL_DEV_DEFAULTS.DATABASE_URL;
}
if (!rawEnv.JWT_SECRET && rawEnv.NODE_ENV !== 'production') {
  withDefaults.JWT_SECRET = LOCAL_DEV_DEFAULTS.JWT_SECRET;
}

const parsed = envSchema.safeParse(withDefaults);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${details}`);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

if (isProduction) {
  if (env.JWT_SECRET === LOCAL_DEV_DEFAULTS.JWT_SECRET) {
    // eslint-disable-next-line no-console
    console.error('JWT_SECRET must be explicitly configured in production.');
    process.exit(1);
  }
  if (env.DATABASE_URL === LOCAL_DEV_DEFAULTS.DATABASE_URL) {
    // eslint-disable-next-line no-console
    console.error('DATABASE_URL must be explicitly configured in production.');
    process.exit(1);
  }
  if (env.LOG_OTP_TO_CONSOLE || env.EXPOSE_OTP_IN_RESPONSE) {
    // eslint-disable-next-line no-console
    console.warn(
      'WARNING: mock OTP logging is enabled in production. Set LOG_OTP_TO_CONSOLE=false and EXPOSE_OTP_IN_RESPONSE=false.',
    );
  }
}

export type Env = typeof env;
