import app from './hono-server.js';
import { serve } from '@hono/node-server';
console.log('Booting Hono server on port 8788...');
serve({ fetch: app.fetch, port: 8788 }, (info) => {
  console.log(`[dist/hono-dev] listening on port ${info.port}`);
});
console.log('If you see this, serve() did not throw synchronously.');
