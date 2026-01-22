import { DatabaseDriver } from '../db/driver';
import winston from 'winston';
// We import the baseline directly. ensure tsconfig includes this path or allows it.
// @ts-ignore - Importing outside of rootDir
import { CORE_CONSTANTS, NAV_STRUCTURE, system_setting, ENTITY_CONFIG, I18N, THEME_CONFIG, AUTH_CONFIG } from '../../../registry-baseline';

// Define the shape of the Registry based on what we know
export interface Registry {
  nav: typeof NAV_STRUCTURE;
  constants: typeof CORE_CONSTANTS;
  system: typeof system_setting;
  entities: typeof ENTITY_CONFIG | Record<string, any>; // Baseline + Dynamic entity definitions
  uiConfig: typeof THEME_CONFIG | Record<string, any>;
  i18n: typeof I18N | Record<string, any>;
  prompts: Record<string, string>;
  models: Record<string, any>;
  roles: any;
  [key: string]: any;
}

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()],
  defaultMeta: { service: 'registry-core' }
});

// Platform-level Infrastructure Entities (Managed by V2)
const SYSTEM_ENTITIES = {
  interaction: {
    label: 'Conversație',
    labelPlural: 'Conversații',
    icon: 'MessageSquare',
    tableName: 'interaction',
    displayField: 'content',
    isSystem: true,
    workerName: 'whatsapp',
    fields: {
       id: { type: 'uuid', primaryKey: true, generated: 'uuid', hidden: true },
       type: { type: 'enum', enum: ['whatsapp', 'gmail'], label: 'Channel' },
       direction: { type: 'enum', enum: ['inbound', 'outbound'], label: 'Direction' },
       channel_id: { type: 'string', label: 'From/To' },
       content: { type: 'textarea', label: 'Message Text' },
       status: { type: 'string', label: 'Status' }
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'Aplicații & Workeri',
      icon: 'MessageSquare',
      path: '/comms',
      priority: 1
    }
  },
  printing: {
    label: 'Printing',
    labelPlural: 'Printing',
    icon: 'Printer',
    tableName: 'printing_session',
    displayField: 'name',
    isSystem: true,
    workerName: 'printing',
    fields: {
       id: { type: 'uuid', primaryKey: true, generated: 'uuid', hidden: true },
       name: { type: 'string', label: 'Session Name' },
       status: { type: 'enum', enum: ['active', 'completed', 'archived'], label: 'Status' },
       config: { type: 'json' }
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'Aplicații & Workeri',
      icon: 'Printer',
      path: '/printing',
      priority: 2
    }
  },
  monitoring: {
    label: 'Monitoring',
    labelPlural: 'Monitoring',
    icon: 'Activity',
    tableName: 'system_status',
    displayField: 'id',
    isSystem: true,
    fields: {
       id: { type: 'uuid', primaryKey: true, generated: 'uuid', hidden: true },
       service_name: { type: 'string' },
       status: { type: 'string' },
       last_check: { type: 'datetime' }
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'Administrare Workspace',
      icon: 'Activity',
      path: '/monitoring',
      priority: 3
    }
  }
};

const SYSTEM_I18N = {
  ro: {
    sidebar: {
      interaction: "Interacțiuni",
      printing: "Imprimare",
      monitoring: "Monitorizare Sistem",
    },
    entities: {
      interaction: { label: "Interacțiune", labelPlural: "Interacțiuni" },
      printing: { label: "Imprimare", labelPlural: "Sesiuni Imprimare" },
      monitoring: { label: "Monitorizare", labelPlural: "Status Sistem" }
    }
  },
  en: {
    sidebar: {
      interaction: "interaction",
      printing: "Printing",
      monitoring: "System Monitor",
    },
    entities: {
      interaction: { label: "Interaction", labelPlural: "interaction" },
      printing: { label: "Printing", labelPlural: "Printing Sessions" },
      monitoring: { label: "Monitoring", labelPlural: "System Status" }
    }
  }
};

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

  /**
   * Load and Merge Registry from Baseline + Database
   */
  public async load(): Promise<Registry> {
    logger.info('Loading Registry...');

    // 1. Start with Baseline
    const completeRegistry: Registry = {
      nav: { ...NAV_STRUCTURE },
      constants: { ...CORE_CONSTANTS },
      system: { ...system_setting },
      entities: { ...ENTITY_CONFIG, ...SYSTEM_ENTITIES },
      uiConfig: { ...THEME_CONFIG },
      i18n: { ...I18N },
      prompts: {},
      models: {},
      roles: { ...AUTH_CONFIG.roles }
    };

    // Merge system translations safely
    const sysI18n = SYSTEM_I18N as any;
    Object.keys(sysI18n).forEach(lang => {
      const target = (completeRegistry.i18n as any)[lang] || {};
      Object.keys(sysI18n[lang]).forEach(ns => {
        target[ns] = { ...(target[ns] || {}), ...sysI18n[lang][ns] };
      });
      (completeRegistry.i18n as any)[lang] = target;
    });

    // 1.5 Auto-sync System Translations to DB (for Cloud/Brain visibility)
    // This allows the Cloud Brain to see these translations without them being in the static baseline file.
    await this.syncSystemTranslationsToDb();

    // 2. Load System Settings from DB (D1)
    // Table: system_setting (key, value, type, group)
    try {
      const settings = await this.db.query('SELECT * FROM system_setting');
      settings.forEach((row: any) => {
        // Handle dot notation (e.g., 'app.enable_workers')
        if (row.key.includes('.')) {
          const parts = row.key.split('.');
          let current = completeRegistry.system as any;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
          }
          current[parts[parts.length - 1]] = this.parseValue(row.value, row.dataType);
        } else {
          (completeRegistry.system as any)[row.key] = this.parseValue(row.value, row.dataType);
        }
      });
    } catch (e: any) {
      if (e.message.includes('no such table')) {
        logger.warn('Table system_setting does not exist. Using baseline only.');
      } else {
        logger.error('Error loading system_setting', e);
      }
    }

    // 3. Load Entity Definitions from DB
    // ...
    // previous logic continues
    this.registry = completeRegistry;
    logger.info(`Registry loaded. ${Object.keys(completeRegistry.entities).length} dynamic entities.`);
    
    return this.registry;
  }

  /**
   * Sync System Translations to the database so they are visible to the Cloud Brain.
   */
  private async syncSystemTranslationsToDb(): Promise<void> {
    try {
      const sysI18n = SYSTEM_I18N as any;
      for (const lang of Object.keys(sysI18n)) {
        for (const ns of Object.keys(sysI18n[lang])) {
          const namespace = 'I18N';
          const key = `${lang}.${ns}`;
          const value = JSON.stringify(sysI18n[lang][ns]);
          const id = `sys_i18n_${lang}_${ns}`;
          
          await this.db.run(
            'INSERT INTO system_setting (id, namespace, key, value, dataType) VALUES (?, ?, ?, ?, ?) ON CONFLICT(namespace, key) DO UPDATE SET value = ?',
            [id, namespace, key, value, 'json', value]
          );
        }
      }
      logger.info('System translations synchronized to database.');
    } catch (e: any) {
      logger.error('Failed to sync system translations:', e.message);
    }
  }

  /**
   * Safe getter with dot notation support
   */
  public get(path?: string, defaultValue: any = undefined): any {
    if (!this.registry) return defaultValue;
    if (!path) return this.registry;
    
    const parts = path.split('.');
    let current: any = this.registry;

    // Special case: if path starts with system, nav, constants, search there first as they are top level keys
    // Otherwise, we search the entire registry or specific groups.
    // Based on our structure: Registry { nav, constants, system, entities... }
    
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') return defaultValue;
      current = current[part];
    }

    return current !== undefined ? current : defaultValue;
  }

  /**
   * Update a setting in DB and local cache
   */
  public async updateSetting(key: string, value: any): Promise<boolean> {
    try {
      const type = typeof value;
      let dbValue = value;
      if (type === 'object') dbValue = JSON.stringify(value);
      if (type === 'boolean') dbValue = value ? 'true' : 'false';

      // 1. Update DB (D1)
      const id = `system:${key}`;
      const namespace = 'system';
      
      await this.db.run(
        'INSERT INTO system_setting (id, namespace, key, value, dataType) VALUES (?, ?, ?, ?, ?) ON CONFLICT(namespace, key) DO UPDATE SET value = ?, dataType = ?',
        [id, namespace, key, String(dbValue), type, String(dbValue), type]
      );

      // 2. Update local cache
      if (this.registry) {
        if (key.includes('.')) {
          const parts = key.split('.');
          let current = this.registry.system as any;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
          }
          current[parts[parts.length - 1]] = value;
        } else {
          (this.registry.system as any)[key] = value;
        }
      }

      logger.info(`Setting updated: ${key} = ${value}`);
      return true;
    } catch (e) {
      logger.error(`Failed to update setting: ${key}`, e);
      return false;
    }
  }

  /**
   * Bulk update settings
   */
  public async updateSettings(settings: Record<string, any>): Promise<boolean> {
    try {
      for (const [key, value] of Object.entries(settings)) {
        await this.updateSetting(key, value);
      }
      return true;
    } catch (e) {
      logger.error('Failed to bulk update settings', e);
      return false;
    }
  }



  /**
   * Helper to parse values from DB string
   */
  private parseValue(value: string, dataType: string): any {
    if (dataType === 'json' || dataType === 'object' || dataType === 'array') {
      try { return JSON.parse(value); } catch { return value; }
    }
    if (dataType === 'number') return Number(value);
    if (dataType === 'boolean') return value === 'true' || value === '1';
    return value;
  }
}

