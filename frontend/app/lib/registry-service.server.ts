/**
 * REGISTRY SERVICE - Enterprise Level 10
 * Orchestrates Registry templates with D1 dynamic definitions and KV caching.
 */
import { getRegistry } from './registry';
import { normalizeEntity, safeParse } from './core';
import { waitForDbReady } from './db-init.server';

// --- TYPES ---
type MenuConfig = {
    showInMainMenu?: boolean;
    label?: string;
    path?: string;
    category?: string;
    priority?: number;
    icon?: string;
    badge?: string;
};

const global = globalThis as any;

/**
 * Enterprise Level 10: Case-Insensitive Object Key Lookup
 */
export const getValCi = (obj: any, key: string): any => {
    if (!obj || !key) return undefined;
    if (obj[key] !== undefined) return obj[key];
    const low = key.toLowerCase();
    const match = Object.keys(obj).find(k => k.toLowerCase() === low);
    return match ? obj[match] : undefined;
};

/**
 * Enterprise Level 10 Cache Management
 */
export async function clearKvConfigCache(env: any, workspaceId?: string) {
    try {
        if (!global.CACHED_CONFIGS) global.CACHED_CONFIGS = {};
        
        if (workspaceId) {
            const cacheKey = `config_${workspaceId}`;
            delete global.CACHED_CONFIGS[cacheKey];
            if (env?.KV) await env.KV.delete(cacheKey);
            console.log(`[CACHE] Invalidated workspace cache: ${workspaceId}`);
        } else {
            // Global Flush
            global.CACHED_CONFIGS = {};
            if (env?.KV) {
                const list = await env.KV.list({ prefix: 'config_' });
                for (const key of list.keys) {
                    await env.KV.delete(key.name);
                }
            }
            console.log('[CACHE] Global registry flush executed');
        }
    } catch (e: any) {
        console.warn('[CACHE] Error clearing KV cache:', e.message);
    }
}

/**
 * Enterprise Level 10 Navigation Synthesizer
 */
export function synthesizeNavigation(merged: any, template: any) {
    if (!merged || !merged.NAV || !template || !template.NAV) return;

    const groups: any = {
        main: JSON.parse(JSON.stringify(template.NAV?.main || [])),
        admin: JSON.parse(JSON.stringify(template.NAV?.admin || [])),
        worker: JSON.parse(JSON.stringify(template.NAV?.worker || [])),
        user: JSON.parse(JSON.stringify(template.NAV?.user || [])),
        entity: JSON.parse(JSON.stringify(template.NAV?.entity || [])),
        shortcuts: JSON.parse(JSON.stringify(template.NAV?.shortcuts || [])),
    };

    const mergeLabels = (val: any, fallback: any) => {
        if (!val) return fallback;
        
        // Enterprise Level 10: Support all languages defined in I18N_CONFIG
        const langs = Object.keys(template.I18N_CONFIG?.supportedLanguages || { ro: {}, en: {} });

        if (typeof val === 'object') {
            const hasAnyLang = langs.some(l => val[l]);
            if (hasAnyLang) {
                if (typeof fallback === 'object' && fallback !== null) {
                    const merged: any = {};
                    langs.forEach(l => {
                        merged[l] = (val[l] && val[l] !== '[object Object]') ? val[l] : (fallback[l] || '');
                    });
                    return merged;
                }
                return val;
            }
            return fallback;
        }
        if (typeof val === 'string' && val.trim() !== '' && val !== '[object Object]') return val;
        return fallback;
    };

    Object.entries(merged.ENTITY_CONFIG || {}).forEach(([name, def]: [string, any]) => {
        // Anti-corruption (Level 10): Skip internal numeric keys or corrupted objects
        if (!name || name === 'undefined' || name === '[object Object]' || !isNaN(Number(name))) return;
        
        if (name === 'entity') console.warn(`[REGISTRY-NAV] Found unexpected 'entity' key in ENTITY_CONFIG!`);
        const norm = normalizeEntity(def);
        const menu: MenuConfig = norm.menuConfig || {};

        if (menu.showInMainMenu === false) {
            Object.keys(groups).forEach(g => {
                groups[g] = groups[g].filter((item: any) => item.id !== name);
            });
            return;
        }

        let cat = (menu.category || '').toLowerCase();
        
        // Enterprise Level 10: Smart Categorization for untagged entities
        if (!cat) {
            const isSystem = norm.isSystem === true;
            const isCore = norm.isCore === true;
            
            if (isSystem) cat = 'administration';
            else if (isCore) cat = 'main_menu';
            else cat = 'entity';
        }

        let targetGroup = 'entity';
        const isMain = cat === 'main_menu' || cat.includes('meniu') || cat.includes('main') || (menu.showInMainMenu === true && !cat);
        const isAdmin = cat === 'administration' || cat.includes('admin') || cat.includes('workspace') || cat === 'system';
        const isWorker = cat === 'worker' || cat === 'workers' || cat.includes('worker') || cat.includes('app');
        const isUser = cat === 'user' || cat === 'profile';

        if (isMain) targetGroup = 'main';
        else if (isAdmin) targetGroup = 'admin';
        else if (isWorker) targetGroup = 'worker';
        else if (isUser) targetGroup = 'user';

        let existing: any = null;
        let currentGroupName = '';
        for (const gname of Object.keys(groups)) {
            // Check by ID or Path (Enterprise Level 10: Deduplication by Concept)
            const found = groups[gname].find((i: any) => i.id === name || (i.path === `/${name}` && i.id !== 'dashboard'));
            if (found) {
                existing = found;
                currentGroupName = gname;
                break;
            }
        }

        if (existing) {
            existing.label = mergeLabels(menu.label, existing.label);
            existing.icon = menu.icon || existing.icon;
            existing.badge = menu.badge || existing.badge;
            existing.path = menu.path || existing.path || `/${name}`;

            if (currentGroupName !== targetGroup) {
                // Enterprise Level 10: Strict Uniqueness (Cleanup old group before move)
                Object.keys(groups).forEach(g => {
                    groups[g] = groups[g].filter((i: any) => i.id !== existing.id && i.id !== name);
                });
                groups[targetGroup].push(existing);
            }
        } else {
            const label: any = menu.label || norm.labelPlural || norm.label;
            
            // Enterprise Level 10: Strict UI Pollution Prevention
            // Don't add to sidebar if there is no label (prevent ghost icons from uninstalled entities)
            const hasUsefulLabel = label && (
                (typeof label === 'string' && label.trim() !== '') || 
                (typeof label === 'object' && (label.ro?.trim() || label.en?.trim()))
            );

            if (hasUsefulLabel) {
                groups[targetGroup].push({
                    id: name,
                    label: label || { ro: '', en: '' },
                    icon: menu.icon || norm.icon || 'Circle',
                    path: menu.path || `/${name}`,
                    priority: menu.priority || 100,
                    badge: menu.badge
                });
            }
        }
    });

    Object.keys(groups).forEach(g => {
        groups[g] = groups[g].sort((a: any, b: any) => (a.priority || 100) - (b.priority || 100));
    });

    merged.NAV = groups;
}

/**
 * Enterprise Level 10: Merge Registry with D1 Dynamic Definitions
 * FAST-PATH: Return STATIC baseline immediately, merge D1 async in background
 */
export async function mergeRegistryWithD1(db: any, workspaceId: string = 'system', env?: any, skipD1Blocking: boolean = true): Promise<any> {
    const now = Date.now();
    const cacheKey = `config_${workspaceId}`;
    const effectiveEnv = env || (globalThis as any).LAST_ENV;
    
    if (!global.CACHED_CONFIGS) global.CACHED_CONFIGS = {};
    if (!global.PENDING_CONFIG_FETCHES) global.PENDING_CONFIG_FETCHES = {};
    if (!global.BACKGROUND_D1_MERGES) global.BACKGROUND_D1_MERGES = {};

    if (global.PENDING_CONFIG_FETCHES[cacheKey]) {
        return global.PENDING_CONFIG_FETCHES[cacheKey];
    }

    if (global.CACHED_CONFIGS[cacheKey] && global.CACHED_CONFIGS[cacheKey].expiry > now) {
        return global.CACHED_CONFIGS[cacheKey].data;
    }

    // TURBO MODE: Return static baseline immediately on initial request (EVEN IF DB NOT INITIALIZED)
    // This makes SSR return in <100ms instead of waiting 5-8 seconds for D1
    if (skipD1Blocking) {
        const registry = await getRegistry();
        const fastFallback = JSON.parse(JSON.stringify(registry));
        synthesizeNavigation(fastFallback, registry);
        
        // Schedule D1 merge in background (non-blocking) - only if DB is ready
        if (global.IS_DB_INITIALIZED && !global.BACKGROUND_D1_MERGES[cacheKey]) {
            global.BACKGROUND_D1_MERGES[cacheKey] = true;
            mergeRegistryWithD1(db, workspaceId, env, false).catch(e => {
                console.warn(`[REGISTRY-BG] Background merge failed: ${e.message}`);
                delete global.BACKGROUND_D1_MERGES[cacheKey];
            }).then(() => {
                delete global.BACKGROUND_D1_MERGES[cacheKey];
            });
        }
        
        return fastFallback;
    }

    // Enterprise Level 11: KV Fast-Path & Circuit Breaker
    // In local development/Windows, KV can be slow (file system based).
    // We disable KV check for 'system' workspace to prevent stalls.
    const isWinDev = typeof process !== 'undefined' && (process.env.NODE_ENV === 'development' || process.platform === 'win32');
    
    // Non-blocking KV check: if it takes >200ms, skip to D1 (Turbo Mode)
    if (effectiveEnv?.KV && !isWinDev && !skipD1Blocking) {
        try {
            const kvPromise = Promise.race([
                effectiveEnv.KV.get(cacheKey, 'json'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('KV timeout')), 200))
            ]);
            const kvCached = await kvPromise;
            if (kvCached) {
                global.CACHED_CONFIGS[cacheKey] = {
                    data: kvCached,
                    expiry: Date.now() + 30000 
                };
                return kvCached;
            }
        } catch (kvErr) {
            // Silently skip on timeout or error in background mode
        }
    }

    if (!global.IS_DB_INITIALIZED) {
        await waitForDbReady(db, 8000); 
    }

    try {
        const fetchPromise = (async () => {
            // 1. Get static registry (template)
            const registry = await getRegistry();
            const template = JSON.parse(JSON.stringify(registry));
            
            // Fallback: If DB initialization COMPLETELY failed after timeout, return early but synthesize
            if (!global.IS_DB_INITIALIZED) {
                console.warn('[BRAIN-CONFIG] DB still not ready — synthesizing template registry fallback');
                const fallbackMerged = { 
                    ...template, 
                    isInitialized: false, // Tell frontend it's a fallback
                    isFallback: true 
                };
                synthesizeNavigation(fallbackMerged, template);
                return fallbackMerged;
            }
            
            // 2. Load Unified Level 10 Configuration (with timeout in Turbo Mode)
            const queryTimeout = skipD1Blocking ? 1000 : 8000; // 1s timeout in fast-path, 8s in background
            const queryPromises = [
                Promise.race([
                    db.query("SELECT * FROM system_setting LIMIT 500"),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('system_setting timeout')), queryTimeout))
                ]),
                Promise.race([
                    db.query("SELECT * FROM entity_definition WHERE (workspaceId = 'system' OR workspaceId = ?) LIMIT 500", [workspaceId]),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('entity_definition timeout')), queryTimeout))
                ]),
                Promise.race([
                    db.query("SELECT * FROM _ai_prompt LIMIT 500"),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('_ai_prompt timeout')), queryTimeout))
                ])
            ];
            
            const [settings, entities, prompts] = await Promise.all(queryPromises).catch((e: any) => {
                if (skipD1Blocking) {
                    console.warn("[REGISTRY-SERVICE] D1 query timeout in fast-path (expected):", e.message);
                } else {
                    console.error("[REGISTRY-SERVICE] D1 fetch failed:", e.message);
                }
                return [[], [], []];
            });
            
            // 3. Build config object from D1 values
            const configFromD1: any = {};
            for (const setting of settings) {
                const { namespace, key, value, dataType } = setting;
                let parsedValue = value;
                if (dataType === 'json') {
                    try { parsedValue = JSON.parse(value); } catch(e) { parsedValue = value; }
                } else if (dataType === 'boolean') {
                    parsedValue = value === 'true' || value === '1' || value === 1;
                } else if (dataType === 'number') {
                    parsedValue = Number(value);
                } else if (typeof value === 'string') {
                    if (value === 'true') parsedValue = true;
                    else if (value === 'false') parsedValue = false;
                    else if (!isNaN(Number(value)) && value.trim() !== '') parsedValue = Number(value);
                    else if (value.startsWith('{') || value.startsWith('[')) {
                        try { parsedValue = JSON.parse(value); } catch(e) { parsedValue = value; }
                    }
                }

                if (!configFromD1[namespace]) configFromD1[namespace] = {};
                configFromD1[namespace][key.toLowerCase()] = parsedValue;
            }
            
            // 4. Merge logic...
            const merged: any = { 
                ...template,
                ENTITY_CONFIG: { ...(template.ENTITY_CONFIG || {}) }
            };
        
            const namespaceMapping = template.CONSTANT?.namespaceMapping || {};

            for (const [rawNs, values] of Object.entries(configFromD1)) {
                const normalizedNs = (rawNs || '').toLowerCase();
                const targetKey = namespaceMapping[normalizedNs] || rawNs;

                if (normalizedNs === 'general' || normalizedNs === 'root') {
                    if (typeof values === 'object' && values !== null) {
                        Object.assign(merged, values);
                    }
                } else if (typeof values === 'object' && values !== null && !Array.isArray(values)) {
                    merged[targetKey] = { ...(merged[targetKey] || {}), ...values };
                } else {
                    merged[targetKey] = values;
                }
            }

            // Ensure property normalization
            if (!merged.NAV) merged.NAV = template.NAV || { main: [], admin: [], worker: [], user: [], entity: [], shortcuts: [] };
            if (!merged.ENTITY_CONFIG) merged.ENTITY_CONFIG = template.ENTITY_CONFIG || {};

            // Enterprise Level 10: AI Model Inventory Logic (Merged from Registry Core)
            const aiInventoryOverrides = merged.SYSTEM_SETTING?.ai_inventory_overrides;
            if (aiInventoryOverrides && merged.AI_CONFIG) {
                const overrides = aiInventoryOverrides;
                let registryModels = Array.isArray(merged.AI_CONFIG.models) ? [...merged.AI_CONFIG.models] : [];

                registryModels = registryModels.map((m: any) => {
                    const ov = overrides[m.id];
                    if (ov) {
                        return { 
                            ...m, 
                            enabled: ov.enabled !== undefined ? ov.enabled : true,
                            name: ov.internalName || m.name 
                        };
                    }
                    return { ...m, enabled: true };
                });

                Object.entries(overrides).forEach(([id, ov]: [string, any]) => {
                    if (ov.enabled && !registryModels.find(m => m.id === id)) {
                        registryModels.push({
                            id,
                            name: ov.internalName || id,
                            provider: ov.provider || 'unknown',
                            capabilities: ov.capabilities || ['chat'],
                            enabled: true,
                            type: 'dynamic-promoted'
                        });
                    }
                });
                merged.AI_CONFIG.models = registryModels;
            }

            if (entities.length > 0) {
                for (const ent of entities) {
                    const norm = normalizeEntity(ent);
                    const entityName = norm.name;

                    if (ent.archived == 1 || ent.archived === true) {
                        if (merged.ENTITY_CONFIG && (merged.ENTITY_CONFIG as any)[entityName]) {
                            delete (merged.ENTITY_CONFIG as any)[entityName];
                        }
                        continue;
                    }
                    
                    const baselineEntry = (template.ENTITY_CONFIG || {})[entityName] || {};
                    const isCore = norm.isCore === true || !!baselineEntry.isCore;
                    const isSystem = norm.isSystem === true || !!baselineEntry.isSystem;

                    const d1FieldsValid = norm.fields && norm.fields.length > 0;
                    const finalFields = d1FieldsValid ? norm.fieldsMap : (baselineEntry.fields || {});

                    (merged.ENTITY_CONFIG as any)[norm.name] = {
                        ...baselineEntry,
                        ...norm,
                        id: ent.id, 
                        isCore,
                        isSystem,
                        fields: finalFields, 
                        fieldsArray: d1FieldsValid ? norm.fields : Object.values(finalFields),
                        __source: 'd1_entity_definition'
                    };

                    // Enterprise Level 10: Deep Merge for UI/Menu configs to prevent clobbering
                    if (baselineEntry.menuConfig) {
                        (merged.ENTITY_CONFIG as any)[norm.name].menuConfig = {
                            ...baselineEntry.menuConfig,
                            ...norm.menuConfig
                        };
                    }
                    if (baselineEntry.features) {
                        (merged.ENTITY_CONFIG as any)[norm.name].features = {
                            ...baselineEntry.features,
                            ...norm.features
                        };
                    }
                    if (baselineEntry.uiConfig) {
                        (merged.ENTITY_CONFIG as any)[norm.name].uiConfig = {
                            ...baselineEntry.uiConfig,
                            ...norm.uiConfig
                        };
                    }
                }
            }

            if (prompts.length > 0) {
                const coreCategories = template.CONSTANT?.aiPromptCategory || [];
                if (!merged.AI_PROMPT) merged.AI_PROMPT = {};
                
                prompts.forEach((p: any) => {
                    if (p.archived == 1 || p.archived === true) return;
                    
                    const promptName = p.slug || p.name || p.id;
                    if (coreCategories.includes(promptName)) return;

                    const config = typeof p.config === 'string' ? safeParse(p.config, {}) : (p.config || {});
                    
                    (merged.AI_PROMPT as any)[promptName] = { 
                        ...p, 
                        config,
                        __source: 'd1_ai_prompt' 
                    };

                    // PROMOTION: If a prompt uses a specific model not in inventory, add it
                    if (config.model && merged.AI_CONFIG) {
                        const models = merged.AI_CONFIG.models || [];
                        if (!models.some((m: any) => m.id === config.model)) {
                            models.push({
                                id: config.model,
                                name: config.model.split('/').pop() || config.model,
                                provider: config.model.includes('gpt') ? 'openai' : (config.model.includes('claude') ? 'anthropic' : 'google'),
                                capabilities: ['chat'],
                                enabled: true,
                                type: 'dynamic-promoted'
                            });
                        }
                    }
                });
            }

            // Synthesize Navigation
            synthesizeNavigation(merged, template);
            
            // Enterprise Level 10: Logical Normalization for Frontend
            // We use non-enumerable properties to avoid clashing with entity names in loops (Level 10)
            Object.defineProperty(merged, 'entity', { value: merged.ENTITY_CONFIG || {}, enumerable: false, writable: true });
            Object.defineProperty(merged, 'navigation', { value: merged.NAV || {}, enumerable: false, writable: true });
            
            merged.constants = { 
                ...merged,
                SYSTEM_SETTING: merged.SYSTEM_SETTING || {},
                ENTITY_CONFIG: merged.ENTITY_CONFIG || {}
            };

            if (effectiveEnv?.KV && !isWinDev) {
                await effectiveEnv.KV.put(cacheKey, JSON.stringify(merged), { expirationTtl: 3600 }).catch(() => {});
            }

            return merged;
        })();

        global.PENDING_CONFIG_FETCHES[cacheKey] = fetchPromise;
        const result = await fetchPromise;
        
        global.CACHED_CONFIGS[cacheKey] = {
            data: result,
            expiry: Date.now() + 30000 
        };
        delete global.PENDING_CONFIG_FETCHES[cacheKey];

        return result;
    } catch (e: any) {
        console.error(`[REGISTRY-SERVICE] Critical merge failure for '${workspaceId}':`, e.message);
        delete global.PENDING_CONFIG_FETCHES[cacheKey];
        return (await getRegistry()); // Fallback to template
    }
}
