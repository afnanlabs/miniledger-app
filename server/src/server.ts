import os from 'node:os';
import { createApp } from './app';
import { env } from './config/env';
import { closePool, pool } from './config/db';

/** Prints the LAN addresses so the phone can reach the API. */
function lanAddresses(): string[] {
  const addresses: string[] = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address);
    }
  }
  return addresses;
}

async function main(): Promise<void> {
  // Fail fast when the database is unreachable.
  await pool.query('SELECT 1');

  const app = createApp();
  const server = app.listen(env.PORT, env.HOST, () => {
    const addresses = lanAddresses();
    // eslint-disable-next-line no-console
    console.log('\n[MiniLedger] API is running');
    // eslint-disable-next-line no-console
    console.log(`  Local:   http://localhost:${env.PORT}`);
    for (const address of addresses) {
      // eslint-disable-next-line no-console
      console.log(`  Network: http://${address}:${env.PORT}   <- use this in the mobile app`);
    }
    // eslint-disable-next-line no-console
    console.log(`  Health:  http://localhost:${env.PORT}/health\n`);
  });

  const shutdown = (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`\n[MiniLedger] ${signal} received, shutting down.`);
    server.close(() => {
      closePool()
        .catch(() => undefined)
        .finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[MiniLedger] Failed to start server:', error);
  process.exit(1);
});
