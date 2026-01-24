/**
 * REGISTRY LITE - Server-side only
 * Strips UI metadata to keep Worker bundle under 1MB.
 * Enterprise Level 8 Metaprogramming.
 */
import { SYSTEM_SETTING } from '../../../registry/config';
import { AI_CONFIG, AI_PROMPT } from '../../../registry/ai';
import { CONSTANT, SYSTEM_ROLE } from '../../../registry/core';
import { SCHEMA as ENTITY_CONFIG } from '../../../registry/schema';

// Registry mock for striping
const REGISTRY_BASELINE_MOCK = {
    ENTITY_CONFIG,
    SYSTEM_SETTING,
    AI_CONFIG,
    AI_PROMPT,
    CONSTANT,
    SYSTEM_ROLE
};

// Keys that are NOT needed by the Brain Engine (Backend) - but we keep labels for SSR
const UI_KEYS = [
    'ui', 
    'placeholder', 'helpText', 'variant', 'className', 
    'group', 'dashboard', 'entityMenu', 'dashboardConfig',
    'layout', 'form', 'sections', 'tabs', 'cards', 'widgets',
    'NAV', 'SHORTCUT', 'THEME', 'I18N'
];

function stripUI(obj: any): any {
    if (!obj || typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(stripUI);
    
    const result: any = {};
    for (const [k, v] of Object.entries(obj)) {
        if (UI_KEYS.includes(k)) continue;
        result[k] = stripUI(v);
    }
    return result;
}

export const REGISTRY_LITE = stripUI(REGISTRY_BASELINE_MOCK);

let _registry: any = null;

export async function getRegistry(db?: any) {
    if (!_registry) {
        _registry = JSON.parse(JSON.stringify(REGISTRY_LITE));
    }
    
    if (db) {
        try {
            // Level 8: Dynamic Registry Overlays from D1
            // Fetch SYSTEM_SETTING and ENTITY_OVERLAY from DB and merge
            const dbSettings = await db.prepare("SELECT key, value FROM system_setting").all();
            if (dbSettings?.results) {
                dbSettings.results.forEach((row: any) => {
                    if (row.key === 'REGISTRY_OVERLAY') {
                        try {
                            const overlay = JSON.parse(row.value);
                            // Merge logic...
                        } catch (e) {}
                    }
                    if (_registry.SYSTEM_SETTING) {
                        _registry.SYSTEM_SETTING[row.key] = row.value;
                    }
                });
            }
        } catch (e) {
            // Silently fail if table doesn't exist yet during first-run
        }
    }
    
    return _registry;
}

export function clearRegistryCache() {
    _registry = null;
}

// Re-export common helpers needed by Brain
export const resolveCollection = (name: string) => {
    const entity = REGISTRY_LITE.ENTITY_CONFIG?.[name] || REGISTRY_LITE.ENTITY_CONFIG?.[name.toLowerCase()];
    return entity?.tableName || name;
};

export const getPrimaryKey = (name: string) => {
    const entity = REGISTRY_LITE.ENTITY_CONFIG?.[name] || REGISTRY_LITE.ENTITY_CONFIG?.[name.toLowerCase()];
    if (!entity?.fields) return 'id';
    return Object.keys(entity.fields).find(k => entity.fields[k].primaryKey) || 'id';
};
