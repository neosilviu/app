import { safeEnv } from '../utils/env';

export const DATABASE_CONFIG = {
  type: safeEnv('DATABASE_TYPE', 'sqlite'),
  sqlite: {
    filename: safeEnv('DATABASE_PATH', './db/local_db.sqlite'),
    memory: false,
    verbose: false,
  },
  d1: {
    accountIdEnvVar: 'CLOUDFLARE_ACCOUNT_ID',
    apiTokenEnvVar: 'CLOUDFLARE_API_TOKEN',
    databaseIdEnvVar: 'CLOUDFLARE_D1_DATABASE_ID',
  },
  migrations: {
    enabled: true,
    autoMigrate: true,
    migrationDir: './migrations',
  },
  connection: {
    timeout: 5000,
    maxConnections: 10,
    idleTimeout: 30000,
  },
} as const;
