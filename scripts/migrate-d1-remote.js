#!/usr/bin/env node

/**
 * Script to migrate D1 remote with correct account ID
 * Sets CLOUDFLARE_ACCOUNT_ID environment variable before running wrangler
 */

const { execSync } = require('child_process');
const path = require('path');

const ACCOUNT_ID = '1ee6235f1d9f54e97869e1620f5cb51e';
const DB_NAME = 'studio-db';

console.log(`\n🔄 Migrating D1 Remote Database...\n`);
console.log(`📍 Account ID: ${ACCOUNT_ID}`);
console.log(`📍 Database: ${DB_NAME}\n`);

try {
  // Set environment variable and run wrangler
  const env = { ...process.env };
  env.CLOUDFLARE_ACCOUNT_ID = ACCOUNT_ID;

  const cmd = `wrangler d1 migrations apply ${DB_NAME} --remote`;
  
  console.log(`🔧 Running: ${cmd}\n`);
  
  execSync(cmd, {
    cwd: path.join(__dirname, '../frontend'),
    env,
    stdio: 'inherit'
  });

  console.log(`\n✅ Migration completed successfully!\n`);
} catch (e) {
  console.error(`\n❌ Migration failed:`, e.message);
  process.exit(1);
}
