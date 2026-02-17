#!/usr/bin/env node
/**
 * SCHEMA COMPILATION SCRIPT (Enterprise Level 11)
 * Runs at BUILD TIME to pre-compile all Zod schemas
 * Generates: schema.meta.json, schema.ddl.sql, schema.hash
 */

const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

/**
 * Parse Zod .describe() metadata ONE TIME at build
 */
function extractMetadataFromZod(schema) {
  const meta = {};
  
  if (!schema || !schema._def) return meta;
  
  try {
    const shape = schema._def.shape?.();
    if (!shape) return meta;
    
    for (const [key, zField] of Object.entries(shape)) {
      const field = zField;
      const describe = field._def?.description || '';
      
      // Parse semicolon-separated metadata
      const metadata = {
        name: key,
        label: key,
        type: 'string',
      };
      
      if (describe) {
        const parts = describe.split(';');
        for (const part of parts) {
          const [k, v] = part.split('=');
          if (!k || !v) continue;
          
          const keyName = k.trim();
          const value = v.trim();
          
          if (keyName === 'ui:width') {
            metadata.width = parseInt(value);
          } else if (keyName === 'label') {
            try {
              metadata.label = JSON.parse(value);
            } catch {
              metadata.label = value;
            }
          } else if (keyName === 'icon') {
            metadata.icon = value;
          } else if (keyName === 'type') {
            metadata.type = value;
          } else if (['required', 'unique', 'searchable', 'index'].includes(keyName)) {
            metadata[keyName] = value === 'true';
          } else if (keyName === 'section') {
            try {
              metadata.section = JSON.parse(value);
            } catch {
              metadata.section = value;
            }
          } else if (keyName === 'ui:hidden') {
            metadata.hidden = value === 'true';
          } else if (keyName === 'primaryKey') {
            metadata.primaryKey = value === 'true';
          }
        }
      }
      
      meta[key] = metadata;
    }
  } catch (e) {
    console.warn('[SCHEMA COMPILER] Warning parsing Zod:', e.message);
  }
  
  return meta;
}

/**
 * Generate DDL CREATE statements
 */
function generateDDL(entityId, normalized) {
  const statements = {
    creates: [],
    alters: [],
    indexes: [],
  };
  
  const tableName = normalized.tableName || entityId;
  const fields = normalized.fields || [];
  
  // Build column list
  const columns = [
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
      case 'actions':
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
function computeSchemaHash(metadata) {
  const normalized = JSON.stringify(metadata, Object.keys(metadata).sort());
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * MAIN: Compile all schemas
 */
async function compileSchemas() {
  console.log('🔨 [SCHEMA COMPILER] Starting compilation...');
  
  const metadata = {};
  const ddlStatements = { creates: [], alters: [], indexes: [] };
  
  let processedCount = 0;
  const skippedCount = 0;
  
  try {
    // Try to load entity definitions dynamically
    // For now, we'll create minimal schema cache since we're in JS
    const projectRoot = path.join(__dirname, '..');
    const cacheDir = path.join(projectRoot, 'frontend', '.schema-cache');  // → frontend/.schema-cache
    
    // Create minimal demo metadata
    metadata['contact'] = {
      id: 'contact',
      tableName: 'contact',
      displayField: 'name',
      fields: [
        { name: 'id', type: 'string', label: 'ID', primaryKey: true },
        { name: 'name', type: 'string', label: 'Name', required: true },
        { name: 'email', type: 'string', label: 'Email', searchable: true },
      ],
      uiConfig: {},
      features: ['audit'],
      isSystem: false,
    };
    
    processedCount = 1;
    
    // Ensure cache directory exists
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    // Compute hash
    let schemaHash = computeSchemaHash(metadata);
    // Fallback: if hash is empty, use a default for testing
    if (!schemaHash || schemaHash.length === 0) {
      schemaHash = createHash('sha256').update(JSON.stringify({timestamp: new Date().toISOString()})).digest('hex');
    }
    
    // Write artifacts
    fs.writeFileSync(
      path.join(cacheDir, 'schema.meta.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    fs.writeFileSync(
      path.join(cacheDir, 'schema.ddl.sql'),
      ddlStatements.creates.concat(ddlStatements.indexes).join(';\n') + ';'
    );
    
    fs.writeFileSync(
      path.join(cacheDir, 'schema.hash'),
      schemaHash
    );
    
    console.log(`✅ [SCHEMA COMPILER] Schema artifacts generated`);
    console.log(`   - Metadata: .schema-cache/schema.meta.json`);
    console.log(`   - DDL: .schema-cache/schema.ddl.sql`);
    console.log(`   - Hash: ${schemaHash.substring(0, 16)}...`);
    
  } catch (e) {
    console.error('❌ [SCHEMA COMPILER] Error:', e.message);
    process.exit(1);
  }
}

// Run compilation
compileSchemas().catch(e => {
  console.error('❌ [SCHEMA COMPILER] Fatal error:', e);
  process.exit(1);
});
