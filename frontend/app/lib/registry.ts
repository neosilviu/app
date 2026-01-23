/**
 * REGISTRY SYSTEM - SSOT
 * NO HARDCODING - 100% baseline-driven
 */

import { initRegistry as initData } from './data';
import { initRegistry as initCoreUtils } from './utils';
import { initRegistry as initBusinessLogic } from './logic';
import { initRegistry as initServices } from './services';

let _registry: any = null;

/**
 * Baseline source of truth
 */
export async function loadBaseline() {
    // Import TypeScript registry baseline explicitly with .ts to avoid .js conflicts
    const module = await import('../../../registry-baseline.ts');
    return module.REGISTRY_BASELINE || module.default || module;
}

/**
 * Initialize all core modules with baseline
 */
export async function initializeRegistry() {
    try {
        const baseline = await loadBaseline();
        // Level 8: Deep clone to prevent accidental pollution of the SSOT
        _registry = JSON.parse(JSON.stringify(baseline));

        // Inject into modules
        initData(baseline);
        initCoreUtils(baseline);
        initBusinessLogic(baseline);
        initServices(baseline);

        return baseline;
    } catch (error) {
        console.error('[REGISTRY] Bootstrap FAILED:', error);
        throw error;
    }
}

/**
 * Get current registry instance
 * Supports optional DB merging for server-side usage
 */
export async function getRegistry(db?: any) {
    if (!_registry) await initializeRegistry();
    
    // If DB is provided, we merge with SYSTEM_SETTING (Enterprise Level 8)
    if (db) {
        const dbSettings = await db.list('SYSTEM_SETTING');
        const settingsObj: any = {};
        
        // Legacy Mappings (Enterprise Level 8 Standard)
        const nsMap: Record<string, string> = {
            'ai': 'AI_CONFIG', 'ai_config': 'AI_CONFIG',
            'theme': 'THEME', 'ui': 'THEME', 'ui_config': 'THEME', 'uiconfig': 'THEME',
            'auth': 'AUTH_CONFIG', 'auth_config': 'AUTH_CONFIG',
            'system': 'SYSTEM_SETTING', 'system_setting': 'SYSTEM_SETTING', 'SYSTEM_SETTING': 'SYSTEM_SETTING',
            'general': 'GENERAL', 'root': 'GENERAL'
        };

        dbSettings.forEach((s: any) => {
            try {
                const rawNs = (s.namespace || 'general').toLowerCase();
                const targetNs = nsMap[rawNs] || s.namespace;
                const key = s.key;
                
                if (!settingsObj[targetNs]) settingsObj[targetNs] = {};
                
                let value = s.value;
                if (s.dataType === 'json' || (typeof s.value === 'string' && (s.value.startsWith('{') || s.value.startsWith('[')))) {
                    try { value = JSON.parse(s.value); } catch { value = s.value; }
                } else if (s.dataType === 'boolean' || s.value === 'true' || s.value === 'false') {
                    value = s.value === 'true' || s.value === '1' || s.value === 1;
                } else if (s.dataType === 'number') {
                    value = Number(s.value);
                } else if (typeof s.value === 'string') {
                    // Auto-detection for simple types
                    if (s.value === 'true') value = true;
                    else if (s.value === 'false') value = false;
                    else if (!isNaN(Number(s.value)) && s.value.trim() !== '') value = Number(s.value);
                }
                
                settingsObj[targetNs][key] = value;
            } catch (e) {
                console.error(`[REGISTRY] Failed to parse setting ${s.key}:`, e);
                // We keep going for other settings, but we log the error
            }
        });
        
        const merged = { 
            ..._registry,
            ENTITY_CONFIG: { ...(_registry.ENTITY_CONFIG || {}) }
        };
        for (const [ns, values] of Object.entries(settingsObj)) {
            if (ns === 'GENERAL') {
                Object.assign(merged, values as object);
            } else if (typeof values === 'object' && values !== null && !Array.isArray(values)) {
                merged[ns] = { ...(merged[ns] || {}), ...values };
            } else {
                merged[ns] = values;
            }
        }
        return merged;
    }
    
    return { 
        ..._registry,
        ENTITY_CONFIG: { ...(_registry.ENTITY_CONFIG || {}) }
    };
}

/**
 * Clear registry cache to force reload
 */
export function clearRegistryCache() {
    _registry = null;
}

/**
 * RBAC Helper
 */
export function hasPermission(role: string, requiredPermission: string): boolean {
    if (!_registry) return false;
    const roleDef = (_registry.SYSTEM_ROLE || {})[role];
    if (!roleDef) return false;
    const permissions = roleDef.permission || [];
    return permissions.includes('*') || permissions.includes(requiredPermission);
}

/**
 * REGISTRY_BASELINE - Single Source of Truth Proxy
 * This allows modules to import it at top-level without crashing before initialization.
 */
export const REGISTRY_BASELINE: any = new Proxy({}, {
    get(target, prop) {
        if (!_registry) {
            // Return safe defaults for known structures
            // NOTE: NAV must NOT return empty object - that breaks menu rendering
            if (prop === 'ENTITY_CONFIG') return {};
            if (prop === 'NAV') {
                console.warn("[REGISTRY] Accessing NAV before initialization!");
                return { main: [], worker: [], admin: [], user: [] };
            }
            if (prop === 'THEME') return { 
                defaultTheme: 'light', 
                storageKey: 'studio-theme',
                brand: { name: 'Studio App', primary: '#4f46e5', secondary: '#0f172a' } 
            };
            return undefined;
        }
        return _registry[prop];
    },
    ownKeys() {
        return _registry ? Reflect.ownKeys(_registry) : [];
    },
    getOwnPropertyDescriptor(target, prop) {
        return {
            enumerable: true,
            configurable: true,
        };
    }
});

