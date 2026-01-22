#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const sourceFile = path.join(import.meta.dirname, 'wrangler.production.toml');
const targetFile = path.join(import.meta.dirname, 'wrangler.toml');

try {
  const content = fs.readFileSync(sourceFile, 'utf-8');
  fs.writeFileSync(targetFile, content, 'utf-8');
  console.log('✓ Production wrangler config copied to frontend/wrangler.toml');
} catch (err) {
  console.error('✗ Failed to copy production config:', err.message);
  process.exit(1);
}
