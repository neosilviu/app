/**
 * DATA & DATABASE LAYER - SSOT
 * Merged from entity-parser, db-utils, database-client
 */

import Dexie, { type Table } from 'dexie';

let _registry: any = null;

export function initRegistry(registry: any) {
    _registry = registry;
}

// --- ENTITY PARSER ---

export function parseEntity(entity: any): any {
    if (!entity || typeof entity !== 'object') return entity;
    const JSON_FIELDS = _registry?.JSON_FIELDS || [];
    const NUMERIC_FLAGS = _registry?.NUMERIC_FLAGS || [];
    const result = { ...entity };
    Object.keys(result).forEach((key) => {
        const val = result[key];
        if (typeof val === 'string' && val.length > 1 && (val.startsWith('{') || val.startsWith('['))) {
            if (JSON_FIELDS.includes(key)) {
                try { result[key] = JSON.parse(val); } catch (e) { }
            }
        }
        if (NUMERIC_FLAGS.includes(key)) {
            if (typeof val === 'string' && val.trim() !== '') {
                const parsed = Number(val);
                if (!isNaN(parsed)) result[key] = parsed;
            } else if (typeof val === 'boolean') {
                result[key] = val ? 1 : 0;
            }
        }
    });
    return result;
}

export function serializeEntity(entity: any): any {
    if (!entity || typeof entity !== 'object') return entity;
    const JSON_FIELDS = _registry?.JSON_FIELDS || [];
    const NUMERIC_FLAGS = _registry?.NUMERIC_FLAGS || [];
    const result = { ...entity };
    Object.keys(result).forEach((key) => {
        const val = result[key];
        if (val !== null && typeof val === 'object' && JSON_FIELDS.includes(key)) {
            result[key] = JSON.stringify(val);
        }
        if (typeof val === 'boolean' && NUMERIC_FLAGS.includes(key)) {
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

export function resolveCollection(name: string): string {
    if (!name) return name;
    if (name.startsWith('_')) return name;
    const overrides = _registry?.COLLECTION_OVERRIDES || {};
    if (overrides[name]) return overrides[name];
    
    let resolved = name;
    // Enterprise Level 8: Direct mapping strategy. 
    // We only apply snake_case normalization but NO automatic pluralization.
    if (!resolved.includes('_')) {
        resolved = resolved.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    }
    
    return resolved;
}

export function getPrimaryKey(collection: string): string {
    const resolved = resolveCollection(collection);
    const pkRules = _registry?.PRIMARY_KEY_RULES || {};
    if (pkRules[resolved]) return pkRules[resolved];
    if (resolved === '_metadata') return 'key';
    if (resolved === 'whatsapp_chats' || resolved === 'chat_settings') return 'chatId';
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
