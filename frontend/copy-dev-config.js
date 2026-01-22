#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const sourceFile = path.join(import.meta.dirname, '..', '.dev', 'wrangler-dev.toml');
const targetFile = path.join(import.meta.dirname, 'wrangler.toml');

try {
  const content = fs.readFileSync(sourceFile, 'utf-8');
  fs.writeFileSync(targetFile, content, 'utf-8');
  console.log('✓ Dev wrangler config copied to frontend/wrangler.toml');
} catch (err) {
  console.error('✗ Failed to copy dev config:', err.message);
  process.exit(1);
}
