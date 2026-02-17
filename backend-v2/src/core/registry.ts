import { DatabaseDriver } from '../db/driver';
import winston from 'winston';

export interface Registry {
  entity: Record<string, any>;
  [key: string]: any;
}

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()],
  defaultMeta: { service: 'registry-core' }
});

export class RegistryManager {
  private static instance: RegistryManager;
  private registry: Registry | null = null;
  private db: DatabaseDriver;

  private constructor() {
    this.db = DatabaseDriver.getInstance();
  }

  public static getInstance(): RegistryManager {
    if (!RegistryManager.instance) {
      RegistryManager.instance = new RegistryManager();
    }
    return RegistryManager.instance;
  }

  public async load(): Promise<Registry> {
    logger.info('Loading Registry...');
    let v3Legacy: Record<string, any> = {};
    try {
      const { loadRegistry } = require('../../registry-entities');
      v3Legacy = loadRegistry();
    } catch (e) {
      logger.warn('V3 registry JSON not found or failed to load. Only baseline entities will be available.');
    }
    this.registry = { entity: { ...v3Legacy } };
    logger.info(`Registry loaded. ${Object.keys(this.registry.entity || {}).length} entities.`);
    return this.registry;
  }
}

