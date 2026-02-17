/**
 * DATA & DATABASE LAYER - SSOT
 * Merged from entity-parser, db-utils, database-client
 */

import Dexie, { type Table } from 'dexie';
import { getRegistry } from './registry';
import { deepParse, deepStringify } from './utils';

// --- ENTITY PARSER ---

export function parseEntity(entity: any, entityType?: string): any {
    if (!entity || typeof entity !== 'object') return entity;
    
    // Enterprise Level 10: Dynamic Hydration based on Registry Schema
    const registry = getRegistry();
    const result = deepParse(entity);
    
    // 2. Boolean/Numeric Flag normalization
    const systemFields = registry?.CONSTANT?.systemFields || [];
    Object.keys(result).forEach((key) => {
        const val = result[key];
        if (key === 'archived' || key === 'isSystem' || (typeof val === 'number' && (val === 0 || val === 1))) {
            // Convert numbers back to booleans if they look like flags
            if (val === 0) result[key] = false;
            else if (val === 1) result[key] = true;
        }
    });

    return result;
}

export function serializeEntity(entity: any): any {
    if (!entity || typeof entity !== 'object') return entity;
    const result = deepStringify(entity);
    
    // Normalize booleans to 0/1 for SQLite if they are still boolean
    Object.keys(result).forEach((key) => {
        const val = result[key];
        if (typeof val === 'boolean') {
            result[key] = val ? 1 : 0;
        }
    });
    
    return result;
}

export const EntityParser = {
    parse: parseEntity,
    serialize: serializeEntity
};

// --- DB UTILS ---

export function resolveCollection(name: string, registryOverride?: any): string {
    if (!name) return name;
    if (name.startsWith('_')) return name;
    const registry = registryOverride || getRegistry();
    const overrides = registry?.COLLECTION_OVERRIDES || {};
    if (overrides[name]) return overrides[name];
    
    let resolved = name;
    // Enterprise Level 10: Structural DNA Mapping (No pluralization, exact matching)
    if (!resolved.includes('_')) {
        resolved = resolved.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    }
    
    return resolved;
}

/**
 * Enterprise Level 10: Primary Key Resolution Protocol
 * Prioritizes "id" as the universal identifier, with dynamic registry-level overrides.
 */
export function getPrimaryKey(collection: string, registryOverride?: any): string {
    const resolved = resolveCollection(collection, registryOverride);
    const registry = registryOverride || getRegistry();
    const pkRules = registry?.PRIMARY_KEY_RULES || {};
    if (pkRules[resolved]) return pkRules[resolved];

    // Enterprise Level 10: Dynamic lookup in ENTITY_CONFIG
    const entityConfigs = registry?.ENTITY_CONFIG || {};
    const entDef = entityConfigs[resolved] || entityConfigs[collection];
    if (entDef?.fields) {
        // Handle both array and object formats for fields
        const fields = Array.isArray(entDef.fields) ? entDef.fields : Object.entries(entDef.fields).map(([name, f]: any) => ({ ...f, name }));
        const pkField = fields.find((f: any) => f.primary || f.primaryKey);
        if (pkField) return pkField.name || pkField.id;
    }

    // Special metadata cases
    if (resolved === '_metadata' || resolved === 'system_setting') return 'key';
    
    // Uniformity: Standardize on "id" for all business entities
    return 'id';
}

export const DB_UTILS = {
    resolveCollection,
    getPrimaryKey
};

// --- BROWSER DB (DEXIE) ---

export interface CachedConfig { id: string; data: any; updatedAt: number; }
export interface CachedData { id: string; entityType: string; data: any; updatedAt: number; }

export class AppDatabase extends Dexie {
    configs!: Table<CachedConfig>;
    entityData!: Table<CachedData>;
    constructor() {
        super('AppStudioDB');
        this.version(1).stores({
            configs: 'id, updatedAt',
            entityData: 'id, entityType, updatedAt'
        });
    }
}

export const db = (typeof window !== 'undefined' && !(window as any).__is_shim) ? new AppDatabase() : null as any;

/**
 * Legacy support for manual injection (to be removed)
 */
export function initRegistry(registry: any) {}
