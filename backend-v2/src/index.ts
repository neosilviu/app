import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config';
import winston from 'winston';
import { DatabaseDriver } from './db/driver';
import { RegistryManager } from './core/registry';
import { apiRoutes } from './api/routes';

import { EntitySync } from './core/entity-sync';
import { SystemSchema } from './core/system-schema';
import { SocketManager } from './services/SocketManager';
import { WorkerManager } from './core/WorkerManager';

// Increase listeners for development HMR/reloads
if (typeof process !== 'undefined') {
  process.setMaxListeners(100);
}

// Logger setup,
const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

/**
 * Main Server Entry Point
 */
async function bootstrap() {
  logger.info(`🚀 Starting Backend v2 in ${config.env.toUpperCase()} mode...`);
  logger.info(`🔌 Port: ${config.port}`);
  
  // 1. Initialize DB
  await DatabaseDriver.getInstance().connect();

  // 1.5 System Schema
  await SystemSchema.ensureTables();

  // 2. Initialize Registry
  await RegistryManager.getInstance().load();

  // 3. Sync Database Schema
  const syncer = new EntitySync();
  await syncer.syncAll();

  const app = express();
  const httpServer = createServer(app);

  // 4. Initialize Socket.IO
  SocketManager.getInstance().initialize(httpServer);

  // 5. Initialize & Start Workers (Reactive)
  const workerManager = WorkerManager.getInstance();
  await workerManager.refreshState();

  // Middleware
  app.use(cors({
    origin: (origin, callback) => {
      // Allow all subdomains of aemdpc.ro and localhost
      if (!origin || 
          origin.includes('aemdpc.ro') || 
          origin.includes('localhost') || 
          origin.includes('127.0.0.1') ||
          origin.includes('192.168.') ||
          origin.includes('10.0.') ||
          origin.includes('172.')) {
        return callback(null, true);
      }
      console.warn(`[CORS-REJECT] Origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-Id', 'X-Requested-With', 'Accept', 'Origin']
  }));
  app.use(express.json());

  // API Routes - Support both legacy /api and /api/v2
  app.use('/api', apiRoutes);
  app.use('/api/v2', apiRoutes);

  // Serve Local Inbox as static files for previews
  app.use('/uploads', express.static(config.paths.inbox));

  // Health Check - Support both /health and /api/health for proxy compatibility
  const healthHandler = (req: any, res: any) => {
    res.json({ 
      status: 'ok', 
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'backend-v2',
      instance: process.env.NODE_APP_INSTANCE || '0'
    });
  };
  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // Start Server
  httpServer.listen(config.port, '0.0.0.0', () => {
    logger.info(`✅ Server ready on http://0.0.0.0:${config.port}`);
    logger.info(`📂 Database: ${config.dbPath}`);
  });

  // Graceful Shutdown
  const shutdown = async () => {
    logger.info('🛑 Shutting down backend...');
    // Close DB connection
    await DatabaseDriver.getInstance().disconnect();
    logger.info('👋 Backend stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch(err => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
