import { DatabaseDriver } from '../db/driver';
import { RegistryManager } from './registry';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()],
  defaultMeta: { service: 'entity-sync' }
});

export class EntitySync {
  private db: DatabaseDriver;
  private registry: RegistryManager;

  constructor() {
    this.db = DatabaseDriver.getInstance();
    this.registry = RegistryManager.getInstance();
  }

  /**
   * Synchronize all entities in the Registry with the SQLite Database.
   * - Creates tables if they don't exist.
   * - Adds missing columns.
   * - DOES NOT delete columns (safe mode).
   */
  public async syncAll(): Promise<void> {
    const reg = this.registry.get();
    const entityConfigs = reg.entity; // From Registry ENTITY_CONFIGS

    logger.info(`Syncing ${Object.keys(entityConfigs).length} entities to DB...`);

    for (const [entityKey, def] of Object.entries(entityConfigs)) {
      const defTyped = def as any;
      const tableName = defTyped.tableName || entityKey;
      
      // 1. Sync SQL Table
      await this.syncTable(tableName, defTyped);

      // 2. Sync Entity Definition Metadata to DB (for Brain/Frontend visibility)
      // This ensures that even if an entity is defined in code (System Entities),
      // the Brain (Cloudflare) sees it via the common 'entity_definition' table.
      await this.syncMetadata(entityKey, defTyped);
    }
  }

  /**
   * Sync metadata to the entity_definition table
   */
  private async syncMetadata(name: string, def: any): Promise<void> {
    try {
      await this.db.run(
        `INSERT INTO entity_definition (id, name, label, labelPlural, icon, fields, menuConfig, isSystem, workspaceId, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(name, workspaceId) DO UPDATE SET 
            label = excluded.label,
            labelPlural = excluded.labelPlural,
            icon = excluded.icon,
            fields = excluded.fields,
            menuConfig = excluded.menuConfig,
            isSystem = excluded.isSystem,
            updatedAt = CURRENT_TIMESTAMP`,
        [
          `sys_${name}`, 
          name, 
          def.label || name, 
          def.labelPlural || def.label || name, 
          def.icon || 'Box', 
          JSON.stringify(def.fields || {}), 
          JSON.stringify(def.menuConfig || {}), 
          1, // isSystem
          'system' // Always 'system' for system baseline entities
        ]
      );
    } catch (e: any) {
      logger.error(`Failed to sync metadata for ${name}: ${e.message}`, { error: e });
    }
  }

  private async syncTable(tableName: string, def: any): Promise<void> {
    if (!def || !def.fields) return;

    // Adapt Registry structure (Object) to Sync logic (Array)
    const fieldsArray = Object.entries(def.fields).map(([name, config]: [string, any]) => ({
      name,
      ...config
    }));

    // Check if table exists
    const tableExists = await this.db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [tableName]
    );

    if (!tableExists) {
      await this.createTable(tableName, fieldsArray);
    } else {
      await this.alterTable(tableName, fieldsArray);
    }
  }

  private async createTable(tableName: string, fields: any[]): Promise<void> {
    if(!fields || fields.length === 0) return;

    const hasId = fields.some(f => f.name.toLowerCase() === 'id');
    const hasCreatedAt = fields.some(f => f.name.toLowerCase() === 'createdat' || f.name.toLowerCase() === 'created_at');
    const hasUpdatedAt = fields.some(f => f.name.toLowerCase() === 'updatedat' || f.name.toLowerCase() === 'updated_at');
    const hasWorkspaceId = fields.some(f => f.name.toLowerCase() === 'workspaceid');
    const hasArchived = fields.some(f => f.name.toLowerCase() === 'archived');
    const hasDeletedAt = fields.some(f => f.name.toLowerCase() === 'deletedat');
    const hasCreatedBy = fields.some(f => f.name.toLowerCase() === 'createdby');
    const hasUpdatedBy = fields.some(f => f.name.toLowerCase() === 'updatedby');

    const columnDefs = fields.map(field => this.getFieldDef(field)).join(', ');

    let extraFields = [];
    if (!hasId) extraFields.push(`id TEXT PRIMARY KEY`);
    if (!hasWorkspaceId) extraFields.push(`workspaceId TEXT`);
    if (!hasArchived) extraFields.push(`archived INTEGER DEFAULT 0`);
    if (!hasDeletedAt) extraFields.push(`deletedAt DATETIME`);
    if (!hasCreatedBy) extraFields.push(`createdBy TEXT`);
    if (!hasUpdatedBy) extraFields.push(`updatedBy TEXT`);
    if (!hasCreatedAt) extraFields.push(`createdAt DATETIME DEFAULT CURRENT_TIMESTAMP`);
    if (!hasUpdatedAt) extraFields.push(`updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP`);

    const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${extraFields.length > 0 ? extraFields.join(', ') + ', ' : ''}${columnDefs})`;
    
    logger.info(`Creating table ${tableName}...`);
    await this.db.run(sql);
  }

  private async alterTable(tableName: string, fields: any[]): Promise<void> {
    const existingCols = await this.db.query(`PRAGMA table_info(${tableName})`);
    const existingColNames = new Set(existingCols.map((c: any) => c.name.toLowerCase()));

    // Level 8 Core fields check
    const coreFields = [
      { name: 'workspaceId', type: 'text' },
      { name: 'archived', type: 'integer', default: '0' },
      { name: 'deletedAt', type: 'datetime' },
      { name: 'createdBy', type: 'text' },
      { name: 'updatedBy', type: 'text' }
    ];

    for (const core of coreFields) {
      if (!existingColNames.has(core.name.toLowerCase())) {
        logger.info(`Adding core column ${core.name} to ${tableName}...`);
        await this.db.run(`ALTER TABLE ${tableName} ADD COLUMN ${core.name} ${core.type.toUpperCase()}${core.default ? ` DEFAULT ${core.default}` : ''}`);
      }
    }

    for (const field of fields) {
      if (!existingColNames.has(field.name.toLowerCase())) {
        logger.info(`Adding column ${field.name} to ${tableName}...`);
        const colDef = this.getFieldDef(field);
        await this.db.run(`ALTER TABLE ${tableName} ADD COLUMN ${colDef}`);
      }
    }
  }

  private getFieldDef(field: any): string {
    let type = 'TEXT';
    switch (field.type) {
      case 'number':
      case 'integer':
      case 'int':
        type = 'INTEGER'; break;
      case 'float':
      case 'real':
      case 'decimal':
        type = 'REAL'; break;
      case 'boolean':
      case 'bool':
        type = 'INTEGER'; break; // 0 or 1
      case 'date':
      case 'datetime':
      case 'timestamp':
        type = 'DATETIME'; break;
      default: type = 'TEXT';
    }

    let constraints = '';
    if (field.primaryKey) constraints += ' PRIMARY KEY';
    if (field.unique) constraints += ' UNIQUE';
    if (field.required) constraints += ' NOT NULL';

    return `${field.name} ${type}${constraints}`;
  }
}

