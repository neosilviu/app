import app from './hono-server.ts';
import { serve } from '@hono/node-server';

process.on('uncaughtException', (err: any) => {
  console.error('uncaughtException in hono-dev:', (err && ((err as any).stack || (err as any).message)) || err);
  process.exit(1);
});
process.on('unhandledRejection', (r) => {
  console.error('unhandledRejection in hono-dev:', r);
});

console.log('Booting Hono server on port 8788...');
try {
  serve({ fetch: app.fetch, port: 8788 }, (info) => {
    console.log(`[hono-dev] listening on port ${info.port}`);
  });
  console.log('serve() invoked successfully');
} catch (err: any) {
  console.error('serve() threw synchronously:', ((err as any)?.stack || (err as any)?.message) || err);
  process.exit(1);
}
