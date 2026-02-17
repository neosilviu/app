/**
 * REGISTRY SYSTEM - SSOT
 * NO HARDCODING - 100% baseline-driven
 */

import * as v3Module from '../../../core/entities';
import { REGISTRY_BASELINE as STATIC_BASELINE } from '../../../registry-baseline';

let _registry: any = null;

/**
 * Baseline source of truth
 */
export async function loadBaseline() {
    // Enterprise Level 10: Fast-path for server-side usage
    if (typeof globalThis !== 'undefined' && (globalThis as any).REGISTRY_BASELINE) {
        const rb = (globalThis as any).REGISTRY_BASELINE;
        if (rb.ENTITY_CONFIG && Object.keys(rb.ENTITY_CONFIG).length > 5) {
            return rb;
        }
    }
    
    const baseline = STATIC_BASELINE;

    // Enterprise Level 10: Merge V3 Modular Entities into Baseline
    try {
        if ((v3Module as any).discoverEntities) {
            await (v3Module as any).discoverEntities();
        }
        const v3Legacy = (v3Module as any).getV3EntitiesAsLegacy ? (v3Module as any).getV3EntitiesAsLegacy() : {};
        if (Object.keys(v3Legacy).length > 0) {
            if (!baseline.ENTITY_CONFIG) baseline.ENTITY_CONFIG = {};
            for (const [id, entity] of Object.entries(v3Legacy)) {
                baseline.ENTITY_CONFIG[id] = {
                    ... (entity as any),
                    isV3: true 
                };
            }
        }
    } catch (e) {
        console.warn("[REGISTRY] Failed to merge V3 entities:", e);
    }

    return baseline;
}

/**
 * Initialize registry
 */
export async function initializeRegistry(providedBaseline?: any) {
    try {
        const baseline = providedBaseline || await loadBaseline();
        _registry = JSON.parse(JSON.stringify(baseline));
        return _registry;
    } catch (error) {
        console.error('[REGISTRY] Bootstrap FAILED:', error);
        throw error;
    }
}

/**
 * Get current registry instance (SSOT)
 */
export function getRegistry() {
    if (!_registry) {
        // Synchronous fallback for basic structure
        return STATIC_BASELINE;
    }
    return _registry;
}

/**
 * Clear registry cache
 */
export function clearRegistryCache() {
    _registry = null;
}

/**
 * Legacy support for manual injection (to be removed)
 */
export function initRegistry(registry: any) {
    _registry = registry;
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
    ownKeys(target) {
        return _registry ? Reflect.ownKeys(_registry) : [];
    },
    getOwnPropertyDescriptor(target, prop) {
        if (!_registry) return undefined;
        return {
            enumerable: true,
            configurable: true,
            value: _registry[prop]
        };
    },
    has(target, prop) {
        return _registry ? prop in _registry : false;
    }
});

