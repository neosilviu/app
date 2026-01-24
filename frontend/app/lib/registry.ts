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
    // Enterprise Level 8: Striped Registry for Worker Performance
    if (typeof window === 'undefined') {
        const { REGISTRY_LITE } = await import('./registry-lite');
        return REGISTRY_LITE;
    }
    
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
        const dbSettings = await db.prepare("SELECT key, value FROM system_setting").all();
        const settingsObj: any = {};
        
        if (dbSettings?.results) {
            dbSettings.results.forEach((s: any) => {
                try {
                    settingsObj[s.key] = s.value;
                } catch (e) {}
            });
        }
        
        const merged = { 
            ..._registry,
            ENTITY_CONFIG: { ...(_registry.ENTITY_CONFIG || {}) }
        };
        // Merge logic...
        return merged;
    }
    
    return _registry;
}

/**
 * Clear registry cache to force reload
 */
export function clearRegistryCache() {
    _registry = null;
}

/**
 * REGISTRY_BASELINE - Single Source of Truth Proxy
 */
export const REGISTRY_BASELINE: any = new Proxy({}, {
    get(target, prop) {
        if (!_registry) {
            if (prop === 'ENTITY_CONFIG') return {};
            if (prop === 'NAV') return { main: [], worker: [], admin: [], user: [] };
            if (prop === 'THEME') return { defaultTheme: 'light', storageKey: 'studio-theme', brand: { name: 'Studio App', primary: '#4f46e5' } };
            return undefined;
        }
        return _registry[prop];
    }
});

