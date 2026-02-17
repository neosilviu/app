#!/usr/bin/env node
/**
 * SCHEMA COMPILATION SCRIPT (Enterprise Level 11)
 * Runs at BUILD TIME to pre-compile all Zod schemas
 * Generates: schema.meta.json, schema.ddl.sql, schema.hash
 * 
 * This eliminates runtime parsing overhead and enables smart D1 sync
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

// Import all entities (v3 modular system)
import * as entities from '../core/entities/all_entities';

interface CompiledMetadata {
  [entityId: string]: {
    id: string;
    tableName: string;
    displayField: string;
    fields: Array<{
      name: string;
      label: string;
      type: string;
      required?: boolean;
      index?: boolean;
      unique?: boolean;
      width?: string;
      [key: string]: any;
    }>;
    uiConfig: any;
    features: string[];
    isSystem: boolean;
  };
}

interface DDLStatements {
  creates: string[];
  alters: string[];
  indexes: string[];
}

/**
 * Parse Zod .describe() metadata ONE TIME at build
 */
function extractMetadataFromZod(schema: any): Record<string, any> {
  const meta: Record<string, any> = {};
  
  if (!schema || !schema._def) return meta;
  
  const shape = schema._def.shape();
  for (const [key, zField] of Object.entries(shape)) {
    const field = zField as any;
    const describe = field._def?.description || '';
    
    // Parse semicolon-separated metadata
    const metadata: Record<string, any> = {
      name: key,
      label: key,
      type: 'string',
    };
    
    if (describe) {
      const parts = describe.split(';');
      for (const part of parts) {
        const [k, v] = part.split('=');
        if (!k || !v) continue;
        
        const key = k.trim();
        const value = v.trim();
        
        if (key === 'ui:width') {
          metadata.width = parseInt(value);
        } else if (key === 'label') {
          metadata.label = JSON.parse(value);
        } else if (key === 'icon') {
          metadata.icon = value;
        } else if (key === 'type') {
          metadata.type = value;
        } else if (key === 'required' || key === 'unique' || key === 'searchable' || key === 'index') {
          metadata[key] = value === 'true';
        } else if (key === 'section') {
          metadata.section = JSON.parse(value);
        } else if (key === 'ui:hidden') {
          metadata.hidden = value === 'true';
        } else if (key === 'primaryKey') {
          metadata.primaryKey = value === 'true';
        }
      }
    }
    
    meta[key] = metadata;
  }
  
  return meta;
}

/**
 * Generate DDL CREATE/ALTER statements
 */
function generateDDL(entityId: string, normalized: any): DDLStatements {
  const statements: DDLStatements = {
    creates: [],
    alters: [],
    indexes: [],
  };
  
  const tableName = normalized.tableName || entityId;
  const fields = normalized.fields || [];
  
  // Build column list
  const columns: string[] = [
    'id TEXT PRIMARY KEY',
    'workspaceId TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE',
  ];
  
  for (const field of fields) {
    if (field.name === 'id' || field.name === 'workspaceId') continue;
    
    let colDef = `${field.name} `;
    
    // Map field type to SQL type
    switch (field.type) {
      case 'number':
      case 'currency':
        colDef += 'NUMERIC';
        break;
      case 'boolean':
        colDef += 'INTEGER DEFAULT 0';
        break;
      case 'datetime':
      case 'date':
      case 'time':
        colDef += 'DATETIME';
        break;
      case 'json':
      case 'file':
      case 'relation-many':
      case 'tag':
      case 'multi-select':
        colDef += 'TEXT';
        break;
      default:
        colDef += 'TEXT';
    }
    
    if (field.required) colDef += ' NOT NULL';
    if (field.unique) colDef += ' UNIQUE';
    
    columns.push(colDef);
  }
  
  // Add system fields
  columns.push('archived INTEGER DEFAULT 0');
  columns.push('createdAt DATETIME DEFAULT CURRENT_TIMESTAMP');
  columns.push('updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP');
  columns.push('deletedAt DATETIME');
  columns.push('createdBy TEXT');
  columns.push('updatedBy TEXT');
  
  // Generate CREATE TABLE
  const createStmt = `CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${columns.join(',\n  ')}\n)`;
  statements.creates.push(createStmt);
  
  // Generate indexes for searchable fields
  for (const field of fields) {
    if (field.index || field.searchable || field.name === 'workspaceId') {
      const indexName = `idx_${tableName}_${field.name}`;
      statements.indexes.push(
        `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${field.name})`
      );
    }
  }
  
  return statements;
}

/**
 * Compute hash of all schemas for runtime comparison
 */
function computeSchemaHash(metadata: CompiledMetadata): string {
  const normalized = JSON.stringify(metadata, Object.keys(metadata).sort());
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * MAIN: Compile all schemas
 */
function compileSchemas() {
  console.log('🔨 [SCHEMA COMPILER] Starting compilation...');
  
  const metadata: CompiledMetadata = {};
  const ddlStatements: DDLStatements = { creates: [], alters: [], indexes: [] };
  
  let processedCount = 0;
  
  // Process each entity
  for (const [id, entity] of Object.entries(entities)) {
    try {
      const normalized: any = {
        id,
        tableName: (entity as any).tableName || id,
        displayField: (entity as any).displayField || 'name',
        fields: (entity as any).fields || [],
        uiConfig: (entity as any).uiConfig || {},
        features: (entity as any).features || [],
        isSystem: (entity as any).isSystem || false,
      };
      
      // Extract Zod metadata if schema exists
      if ((entity as any).schema) {
        const zodMeta = extractMetadataFromZod((entity as any).schema);
        normalized.fields = Object.values(zodMeta);
      }
      
      metadata[id] = normalized;
      
      // Generate DDL
      const ddl = generateDDL(id, normalized);
      ddlStatements.creates.push(...ddl.creates);
      ddlStatements.alters.push(...ddl.alters);
      ddlStatements.indexes.push(...ddl.indexes);
      
      processedCount++;
    } catch (e) {
      console.warn(`⚠️  [SCHEMA COMPILER] Error processing ${id}:`, (e as Error).message);
    }
  }
  
  // Compute hash
  const schemaHash = computeSchemaHash(metadata);
  
  // Write artifacts to PROJECT_ROOT
  const projectRoot = path.join(__dirname, '..');
  
  fs.mkdirSync(path.join(projectRoot, '.schema-cache'), { recursive: true });
  
  fs.writeFileSync(
    path.join(projectRoot, '.schema-cache', 'schema.meta.json'),
    JSON.stringify(metadata, null, 2)
  );
  
  fs.writeFileSync(
    path.join(projectRoot, '.schema-cache', 'schema.ddl.sql'),
    ddlStatements.creates.concat(ddlStatements.indexes).join(';\n') + ';'
  );
  
  fs.writeFileSync(
    path.join(projectRoot, '.schema-cache', 'schema.hash'),
    schemaHash
  );
  
  console.log(`✅ [SCHEMA COMPILER] Compiled ${processedCount} entities`);
  console.log(`   - Metadata: .schema-cache/schema.meta.json`);
  console.log(`   - DDL: .schema-cache/schema.ddl.sql (${ddlStatements.creates.length} creates, ${ddlStatements.indexes.length} indexes)`);
  console.log(`   - Hash: ${schemaHash}`);
}

// Run if called directly
if (require.main === module) {
  compileSchemas();
}

export { compileSchemas, CompiledMetadata };
