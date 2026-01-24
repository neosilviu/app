/**
 * DATA & DATABASE LAYER - SSOT
 * Merged from entity-parser, db-utils, database-client
 */

let _registry: any = null;

export function initRegistry(registry: any) {
    _registry = registry;
}

// Enterprise Level 8: Dynamic DX for Dexie to prevent SSR leakage
let _dexieInstance: any = null;

export async function getBrowserDb() {
    if (typeof window === "undefined") return null;
    if (!_dexieInstance) {
        const DexieModule = await import("dexie");
        const Dexie = DexieModule.default;
        
        class AppDatabase extends Dexie {
            configs!: any;
            entityData!: any;
            constructor() {
                super("AppStudioDB");
                this.version(1).stores({
                    configs: "id, updatedAt",
                    entityData: "id, entityType, updatedAt"
                });
            }
        }
        _dexieInstance = new AppDatabase();
    }
    return _dexieInstance;
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

    // Enterprise Level 8: Check ENTITY_CONFIG mappings from Registry first
    const entityConfigs = _registry?.ENTITY_CONFIG || {};
    if (entityConfigs[name] && entityConfigs[name].tableName) {
        return entityConfigs[name].tableName;
    }

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
    if (resolved.includes('session')) return 'sessionId';
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

// Use getBrowserDb() instead of direct export to avoid SSR leaks
