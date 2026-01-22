import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 1. Determine base environment (check if already set by PM2)
const initialEnv = process.env.NODE_ENV;
console.log(`[CONFIG] initialEnv: ${initialEnv}`);

// 2. Load environment variables with safety
const devEnv = path.resolve(__dirname, '../../.dev/.env.v2-dev');
const prodEnv = path.resolve(__dirname, '../.env.v2');

// Load production config as base if it exists
if (fs.existsSync(prodEnv)) {
    dotenv.config({ path: prodEnv });
}

// ONLY load dev overrides if we are NOT in production
if (initialEnv !== 'production' && fs.existsSync(devEnv)) {
    dotenv.config({ path: devEnv, override: true });
}

// 3. Final environment check
const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

/**
 * Global Configuration for Backend V2
 * 
 * Note: Most dynamic settings should come from the Registry,
 * this file is for static infrastructure config (ports, paths).
 */
export const config = {
  port: parseInt(process.env.PORT || (isDev ? '4001' : '5000'), 10),
  env: process.env.NODE_ENV || 'development',
  // Separation: Use .dev DB in development, specific db folder in production
  dbPath: isDev 
    ? path.resolve(__dirname, '../../.dev/local_db_dev.sqlite') 
    : path.resolve(__dirname, '../', process.env.DB_PATH || 'db/local_db.sqlite'),
  logLevel: process.env.LOG_LEVEL || 'info',
  
  paths: {
    root: path.resolve(__dirname, '../../'),
    inbox: path.resolve(__dirname, '../../local-inbox'),
    logs: path.resolve(__dirname, '../logs')
  }
};
