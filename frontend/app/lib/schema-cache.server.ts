/**
 * SCHEMA CACHE & METADATA UTILITIES (Enterprise Level 11)
 * Runtime access to pre-compiled schema metadata
 * 
 * Server-only file - do not import on client side
 * ZERO parsing overhead - direct in-memory access
 */

// Dynamic imports to prevent bundling errors in browser
let fs: any = null;
let path: any = null;

if (typeof require !== 'undefined' && typeof process !== 'undefined') {
  try {
    fs = require('fs');
    path = require('path');
  } catch (e) {
    // Silently fail if not in Node environment
  }
}

// Global in-memory caches (Singleton pattern)
let SCHEMA_METADATA_CACHE: Record<string, any> | null = null;
let SCHEMA_HASH_CACHE: string | null = null;
let DDL_STATEMENTS_CACHE: string[] | null = null;

/**
 * Load pre-compiled schema metadata ONCE
 * Subsequent calls return cached value (O(1))
 */
export function getSchemaMetadata(): Record<string, any> {
  if (SCHEMA_METADATA_CACHE) return SCHEMA_METADATA_CACHE;
  
  try {
    const cacheDir = path.join(process.cwd(), '.schema-cache');
    const metadataPath = path.join(cacheDir, 'schema.meta.json');
    
    if (!fs.existsSync(metadataPath)) {
      console.warn('[SCHEMA-CACHE] schema.meta.json not found - run build first');
      return {};
    }
    
    const content = fs.readFileSync(metadataPath, 'utf8');
    SCHEMA_METADATA_CACHE = JSON.parse(content);
    
    console.log(`[SCHEMA-CACHE] Loaded metadata for ${Object.keys(SCHEMA_METADATA_CACHE || {}).length} entities`);
    return SCHEMA_METADATA_CACHE || {};
  } catch (e) {
    console.error('[SCHEMA-CACHE] Failed to load metadata:', e);
    return {};
  }
}

/**
 * Get current code schema hash
 */
export function getSchemaHash(): string {
  if (SCHEMA_HASH_CACHE) return SCHEMA_HASH_CACHE;
  
  if (!fs || !path) return '';
  
  try {
    const cacheDir = path.join(process.cwd(), '.schema-cache');
    const hashPath = path.join(cacheDir, 'schema.hash');
    
    if (!fs.existsSync(hashPath)) {
      // Normal on first run (schema.hash generated at build time only)
      return '';
    }
    
    const hash = fs.readFileSync(hashPath, 'utf8').trim();
    SCHEMA_HASH_CACHE = hash;
    return hash;
  } catch (e) {
    console.error('[SCHEMA-CACHE] Failed to read hash:', e);
    return '';
  }
}

/**
 * Get pre-compiled DDL statements
 */
export function getDDLStatements(): string[] {
  if (DDL_STATEMENTS_CACHE) return DDL_STATEMENTS_CACHE;
  
  if (!fs || !path) return [];
  
  try {
    const cacheDir = path.join(process.cwd(), '.schema-cache');
    const ddlPath = path.join(cacheDir, 'schema.ddl.sql');
    
    if (!fs.existsSync(ddlPath)) {
      console.warn('[SCHEMA-CACHE] schema.ddl.sql not found');
      return [];
    }
    
    const content = fs.readFileSync(ddlPath, 'utf8');
    const parsed = content.split(';').filter((s: string) => s.trim().length > 0);
    DDL_STATEMENTS_CACHE = parsed;
    
    console.log(`[SCHEMA-CACHE] Loaded ${parsed.length} DDL statements`);
    return parsed;
  } catch (e) {
    console.error('[SCHEMA-CACHE] Failed to read DDL:', e);
    return [];
  }
}

/**
 * Get entity metadata by ID
 * Usage: const metadata = getEntityMetadata('product')
 */
export function getEntityMetadata(entityId: string): any {
  const all = getSchemaMetadata();
  return all ? (all[entityId.toLowerCase()] || null) : null;
}

/**
 * Get all field definitions for an entity
 */
export function getEntityFields(entityId: string): any[] {
  const meta = getEntityMetadata(entityId);
  return meta?.fields || [];
}

/**
 * Check if schema needs sync (compares hashes)
 * @param dbHash Hash stored in database
 * @returns true if code schema is newer
 */
export function schemaChanged(dbHash: string): boolean {
  const codeHash = getSchemaHash();
  const changed = codeHash !== dbHash;
  
  if (changed) {
    console.log(`[SCHEMA-CACHE] ⚠️  Schema changed: ${dbHash.substring(0, 8)}... → ${codeHash.substring(0, 8)}...`);
  } else {
    console.log(`[SCHEMA-CACHE] ✅ Schema unchanged (${codeHash.substring(0, 8)}...)`);
  }
  
  return changed;
}

/**
 * Invalidate caches (useful for testing or after migrations)
 */
export function invalidateSchemaCache(): void {
  SCHEMA_METADATA_CACHE = null;
  SCHEMA_HASH_CACHE = null;
  DDL_STATEMENTS_CACHE = null;
  console.log('[SCHEMA-CACHE] Cleared caches');
}
