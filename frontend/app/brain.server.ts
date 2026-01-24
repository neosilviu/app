/**
 * BRAIN.SERVER.TS - Registry Architecture (v2.1)
 * Logic for Cloudflare D1 unified API with auto-healing and domain registration.
 */
console.log("[BRAIN-FILE] LOADED brain.server.ts");

// Silence EventEmitter memory leak warnings in development (common with hot-reloading)
if (typeof process !== 'undefined') {
    process.setMaxListeners(100);
}

import { getDb, clearColumnCache } from './lib/d1.server';
import { getAuth, verifyAuth } from "./lib/auth-core.server";
import { AiService, getRegistry, clearRegistryCache, resolveCollection, getPrimaryKey, normalizeEntity, safeParse, getDisplayValue, renderString } from './lib/core';
import { isGlobalAdmin, hasPermission, hasPageAccess, isWorkspaceAdmin, checkAccessAsync } from './lib/auth-utils';
import { ensureSystemTables, waitForDbReady, mapFieldType, ensureBaselineSync, syncEntityTable } from './lib/db-init.server';
import { executeEntityAction } from './lib/brain-engine.server';
import { 
    deepParse, 
    deepStringify, 
    transformTranslations, 
    convertToCSV, 
    jsonHelper as json, 
    successHelper as success, 
    errorHelper as error 
} from './lib/brain-utils.server';

/**
 * THE BRAIN - Enterprise Level 8 Metaprogramming Interface
 * Generic executor for No-Code frontend shells.
 */
export const Brain = {
    async execute(entity: string, action: 'READ' | 'WRITE' | 'DELETE', payload: any = {}, env?: any) {
        // Fallback for missing env
        const d1 = env?.cloudflare?.env?.DB || env?.DB || env?.db || (globalThis as any).DB;
        const db = getDb({ DB: d1 });
        const registry = await getRegistry(db);
        const lang = payload?.lang || 'ro';
        
        switch (action) {
            case 'READ':
                if (payload?.id) {
                    const item = await db.get(entity, payload.id);
                    if (!item) return null;
                    return transformTranslations(deepParse(item), lang);
                }
                const results = await db.list(entity);
                return transformTranslations(results.map(deepParse), lang);
                
            case 'WRITE':
                const id = payload?.id;
                const data = { ...payload };
                delete data.id;
                delete data.lang;
                
                if (id && id !== 'new') {
                    await db.update(entity, id, deepStringify(data));
                    return { success: true, id };
                } else {
                    const created = await db.create(entity, deepStringify(data));
                    const pk = getPrimaryKey(entity) || 'id';
                    return { success: true, id: created[pk] || created.id };
                }
                
            case 'DELETE':
                await db.delete(entity, payload.id);
                return { success: true };
                
            default:
                throw new Error(`Action ${action} not implemented in Brain.execute`);
        }
    }
};

// --- SYSTEM CONSTANTS (Level 8: Decoupled to Registry - NO FAILSAFES) ---
const isGlobalEntity = (name: string, registry?: any) => {
    const list = registry?.CONSTANT?.globalEntity || [];
    return list.map((e: string) => e.toLowerCase()).includes((name || '').toLowerCase());
};

// --- CACHING STRATEGY (Enterprise Level 8) ---
// UNIFIED CACHING STRATEGY:
// 1. Registry (CACHED_CONFIGS) - Merges D1 SYSTEM_SETTING with template, cached for 30 sec
// 2. Column Schema Cache (D1Driver.columnCache) - Column metadata per table
// 3. IndexedDB Cache (useEntity) - Frontend only, for offline capability
// These are the ONLY caches. Middleware request -> brain -> D1Driver handles all lookups.

// --- TYPING ---
declare global {
    var CACHED_CONFIGS: Record<string, any>;
    var CACHE_EXPIRY: number;
}

const global = globalThis as any;

/**
 * WORKFLOW STATE MACHINE - Enterprise Level 8
 */

/**
 * WORKFLOW STATE MACHINE - Enterprise Level 8
 */

/**
 * WORKFLOW STATE MACHINE - Enterprise Level 8
 */

/**
 * WORKFLOW STATE MACHINE - Enterprise Level 8
 */

/**
 * WORKFLOW STATE MACHINE - Enterprise Level 8
 */

/**
 * WORKFLOW STATE MACHINE - Enterprise Level 8
 */

/**
 * WORKFLOW STATE MACHINE - Enterprise Level 8
 * Validates and enforces state transitions based on flowRules from Registry
 */
const validateStateTransition = async (
    db: any,
    entityType: string,
    entityId: string,
    fromStatus: string,
    toStatus: string,
    registry: any,
    currentData: any
): Promise<{ valid: boolean; error?: string; nextStates?: string[] }> => {
    const flowRules = registry?.CONSTANT?.flowRules || {};
    const entityRules = flowRules[entityType];
    
    if (!entityRules) {
        // No flow rules defined for this entity type - allow any transition
        return { valid: true };
    }
    
    const currentStateRule = entityRules[fromStatus];
    if (!currentStateRule) {
        return { 
            valid: false, 
            error: `Current state '${fromStatus}' is not defined in workflow for ${entityType}`,
            nextStates: Object.keys(entityRules)
        };
    }
    
    const allowedStates = currentStateRule.nextStates || [];
    if (!allowedStates.includes(toStatus)) {
        return {
            valid: false,
            error: `Cannot transition from '${fromStatus}' to '${toStatus}'. Allowed: ${allowedStates.join(', ')}`,
            nextStates: allowedStates
        };
    }
    
    // Check required fields for the transition
    const requiredFields = currentStateRule.requiresFields || [];
    const missingFields = requiredFields.filter((f: string) => !currentData[f]);
    
    if (missingFields.length > 0) {
        return {
            valid: false,
            error: `Cannot transition to '${toStatus}'. Missing required fields: ${missingFields.join(', ')}`
        };
    }
    
    return { 
        valid: true,
        nextStates: allowedStates
    };
};

/**
 * Get allowed transitions for current state
 */
const getNextTransitions = (entityType: string, currentStatus: string, registry: any): any[] => {
    const flowRules = registry?.CONSTANT?.flowRules || {};
    const entityRules = flowRules[entityType];
    
    if (!entityRules || !entityRules[currentStatus]) {
        return [];
    }
    
    const stateRule = entityRules[currentStatus];
    const nextStates = stateRule.nextStates || [];
    const lang = 'ro'; // Default language for metadata
    
    return nextStates.map((state: string) => ({
        value: state,
        label: entityRules[state]?.label || { ro: state, en: state },
        icon: entityRules[state]?.icon || 'ArrowRight',
        action: entityRules[state]?.action || `transition_to_${state}`,
        requiresFields: entityRules[state]?.requiresFields || []
    }));
};

// --- CONFIG CACHE & PENDING FETCHES ---
if (global.CACHED_CONFIGS === undefined) global.CACHED_CONFIGS = {};
if (global.PENDING_CONFIG_FETCHES === undefined) global.PENDING_CONFIG_FETCHES = {};

/**
 * Enterprise Level 8 Navigation Synthesizer
 * Ensures consistency between baseline template and dynamic D1 entities.
 */
function synthesizeNavigation(merged: any, template: any) {
    if (!merged.NAV) return;

    // Reset dynamic groupings for synthesis
    const synthesizedNav: any = {
        ...template.NAV,
        main: [...(template.NAV?.main || [])],
        worker: [],
        entity: [],
        admin: [...(template.NAV?.admin || [])],
        shortcuts: [...(template.NAV?.shortcuts || template.NAV?.SHORTCUT || [])],
    };

    // Unified Entity-to-Nav Synthesizer
    Object.entries(merged.ENTITY_CONFIG || {}).forEach(([name, def]: [string, any]) => {
        // Enterprise Level 8: Always normalize for synthesis to ensure defaults (showInMainMenu, icons, etc)
        const norm = normalizeEntity(def);
        const menu = norm.menuConfig || {};
        
        if (menu.showInMainMenu === false) return; // Explicitly hidden

        const navItem = {
            id: name,
            label: menu.label || norm.labelPlural || norm.label || name,
            icon: menu.icon || norm.icon || 'Box',
            path: menu.path || `/${name}`,
            priority: menu.priority || 50,
            category: menu.category,
            workerName: norm.workerName,
            isSystem: norm.isSystem
        };

        // Group by Category (Enterprise Level 8 Standard)
        const cat = (menu.category || '').toLowerCase();
        
        // Level 8 Optimization: If showInMainMenu is true and NO category is specified, 
        // default to main_menu to ensure visibility for dynamic entities.
        const isMain = cat === 'main_menu' || cat.includes('meniu') || cat.includes('main') || 
                       (menu.showInMainMenu === true && !cat);

        if (isMain) {
            if (!synthesizedNav.main.find((i: any) => i.id === name)) {
                synthesizedNav.main.push(navItem);
            }
        } else if (cat === 'worker' || cat === 'workers' || cat.includes('worker') || cat.includes('app')) {
            synthesizedNav.worker.push(navItem);
        } else if (cat === 'administration' || cat.includes('admin') || cat.includes('workspace')) {
            if (!synthesizedNav.admin.find((i: any) => i.id === name)) {
                synthesizedNav.admin.push(navItem);
            }
        } else {
            synthesizedNav.entity.push(navItem);
        }
    });

    // Sort all groups by priority
    Object.keys(synthesizedNav).forEach(key => {
        if (Array.isArray(synthesizedNav[key])) {
            synthesizedNav[key].sort((a: any, b: any) => (a.priority || 99) - (b.priority || 99));
        }
    });

    merged.NAV = synthesizedNav;
}

/**
 * Merges Registry Baseline (Template) with D1 SYSTEM_SETTING (Values)
 * Uses a short-lived cache (Level 8 Optimization) to prevent DB floods
 */
async function getEntityDependencies(db: any, entity: string, id: string, registry: any) {
    const dependencies: any[] = [];
    const entityConfigs = registry.ENTITY_CONFIG || {};
    
    // Scan all entity definitions for relations pointing to this entity
    for (const [otherEntity, config] of Object.entries(entityConfigs)) {
        const cfg = config as any;
        const tableName = cfg.tableName || otherEntity;
        const fields = cfg.fields || {};
        
        for (const [fieldName, fieldDef] of Object.entries(fields)) {
            const fd = fieldDef as any;
            if (fd.type === 'relation' && fd.relation?.target === entity) {
                try {
                    // Level 8: SQL approach for performance
                    let query = `SELECT COUNT(*) as count FROM ${tableName} WHERE ${fieldName} = ?`;
                    if (cfg.features?.softDelete) query += ` AND deletedAt IS NULL`;
                    
                    const res = await db.query(query, [id]);
                    const count = res[0]?.count || 0;
                    if (count > 0) {
                        dependencies.push({ 
                            entity: otherEntity, 
                            label: (cfg.labelPlural?.ro || cfg.label?.ro || otherEntity),
                            count 
                        });
                    }
                } catch (e) {}
            }
        }
        
        // Also check authorship (createdBy)
        if (cfg.features?.auditable) {
            try {
                let query = `SELECT COUNT(*) as count FROM ${tableName} WHERE createdBy = ?`;
                if (cfg.features?.softDelete) query += ` AND deletedAt IS NULL`;

                const res = await db.query(query, [id]);
                const count = res[0]?.count || 0;
                if (count > 0) {
                    dependencies.push({ 
                        entity: otherEntity, 
                        label: (cfg.labelPlural?.ro || cfg.label?.ro || otherEntity),
                        type: 'author',
                        count 
                    });
                }
            } catch (e) {}
        }
    }
    return dependencies;
}

async function mergeRegistryWithD1(db: any, workspaceId: string = 'system'): Promise<any> {
    const now = Date.now();
    const cacheKey = `config_${workspaceId}`;
    
    // Multi-layered initialization safety
    if (!global.CACHED_CONFIGS) global.CACHED_CONFIGS = {};
    if (!global.PENDING_CONFIG_FETCHES) global.PENDING_CONFIG_FETCHES = {};

    // 0. Use PENDING FETCH if ongoing (Prevent "Thunderous Herd")
    if (global.PENDING_CONFIG_FETCHES[cacheKey]) {
        console.log(`[BRAIN-CONFIG] Reusing pending fetch for '${cacheKey}'`);
        return global.PENDING_CONFIG_FETCHES[cacheKey];
    }

    // 1. Check existing cache
    if (global.CACHED_CONFIGS[cacheKey] && global.CACHED_CONFIGS[cacheKey].expiry > now) {
        return global.CACHED_CONFIGS[cacheKey].data;
    }

    // If DB initialization is running, wait for it instead of returning a crippled template
    if (!global.IS_DB_INITIALIZED) {
        console.log('[BRAIN-CONFIG] DB not initialized — waiting for ready state...');
        await waitForDbReady(db, 8000); 
    }

    try {
        const fetchPromise = (async () => {
            console.log(`[BRAIN-CONFIG] Merging registry with D1 for workspace '${workspaceId}' (Cache Miss)...`);
            
            // 1. Get static registry (template)
            const registry = await getRegistry();
            const template = { ...registry };
            
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
            
            // 2. Load Unified Level 8 Configuration
            let settings: any[] = [];
            let entities: any[] = [];
            let prompts: any[] = [];

            try {
                // Level 8: Ultra-resilient fetching for core registry tables
                // We remove the 'archived' filter from the SQL query because schema sync might still be pending in some worker nodes/layers.
                // We will filter archived records in JS instead.
                [settings, entities, prompts] = await Promise.all([
                    db.query("SELECT * FROM SYSTEM_SETTING"),
                    db.query("SELECT * FROM entity_definition WHERE (workspaceId = 'system' OR workspaceId = ?)", [workspaceId]),
                    db.query("SELECT * FROM _ai_prompt")
                ]);
            } catch (queryErr: any) {
                console.error("[BRAIN-CONFIG] D1 Query FAILED during registry merge:", queryErr.message);
                return template;
            }
            
            // 3. Build config object from D1 values
            const configFromD1: any = {};
            for (const setting of settings) {
                const { namespace, key, value, dataType } = setting;
                try {
                    let parsedValue = value;
                    if (dataType === 'json') {
                        parsedValue = JSON.parse(value);
                    } else if (dataType === 'boolean') {
                        parsedValue = value === 'true' || value === '1' || value === 1;
                    } else if (dataType === 'number') {
                        parsedValue = Number(value);
                    } else if (typeof value === 'string') {
                        // Level 8: Auto-detect simple types if dataType is missing
                        if (value === 'true') parsedValue = true;
                        else if (value === 'false') parsedValue = false;
                        else if (!isNaN(Number(value)) && value.trim() !== '') parsedValue = Number(value);
                        else if (value.startsWith('{') || value.startsWith('[')) {
                            try { parsedValue = JSON.parse(value); } catch { }
                        }
                    }

                    if (!configFromD1[namespace]) configFromD1[namespace] = {};
                    configFromD1[namespace][key] = parsedValue;
                } catch (e: any) { }
            }
            
            // 4. Merge logic...
            const merged: any = { 
                ...template,
                ENTITY_CONFIG: { ...(template.ENTITY_CONFIG || {}) }
            };
        
        // Logical Namespace Mapping (Enterprise Level 8 Standard)
        const namespaceMapping = template.CONSTANT?.namespaceMapping || {};

        for (const [rawNs, values] of Object.entries(configFromD1)) {
            const normalizedNs = (rawNs || '').toLowerCase();
            const targetKey = namespaceMapping[normalizedNs] || rawNs;

            if (normalizedNs === 'general' || normalizedNs === 'root') {
                // Flatten GENERAL namespace back to the root of the config
                if (typeof values === 'object' && values !== null) {
                    Object.assign(merged, values);
                }
            } else if (typeof values === 'object' && values !== null && !Array.isArray(values)) {
                // Nested Merge for objects
                merged[targetKey] = { ...(merged[targetKey] || {}), ...values };
            } else {
                // Direct override for primitives
                merged[targetKey] = values;
            }
        }
        
        // Ensure property normalization (Protection against missing keys)
        if (!merged.NAV) merged.NAV = template.NAV || {};
        if (!merged.CONSTANTS) merged.CONSTANTS = template.CONSTANTS || {};
        if (!merged.AI_CONFIG) merged.AI_CONFIG = template.AI_CONFIG || {};
        if (!merged.AUTH_CONFIG) merged.AUTH_CONFIG = template.AUTH_CONFIG || {};
        if (!merged.THEME) merged.THEME = template.THEME || {};
        if (!merged.AI_PROMPT) merged.AI_PROMPT = template.AI_PROMPT || {};
        if (!merged.ENTITY_CONFIG) merged.ENTITY_CONFIG = template.ENTITY_CONFIG || {};
        if (!merged.DASHBOARD) merged.DASHBOARD = template.DASHBOARD || {};
        if (!merged.SYSTEM_SETTING) merged.SYSTEM_SETTING = template.SYSTEM_SETTING || {};
        
        if (entities.length > 0) {
            for (const ent of entities) {
                // Filter archived in-memory to avoid SQL column missing issues
                if (ent.archived == 1 || ent.archived === true) continue;

                const norm = normalizeEntity(ent);
                
                const baselineEntry = (template.ENTITY_CONFIG || {})[norm.name] || {};
                const coreEntity = (template.CONSTANT?.coreEntity || []).map((e: string) => e.toLowerCase());
                
                const isCore = coreEntity.includes(norm.name);
                
                // Enterprise Level 8: Improved System Logic
                // An entity is "system" only if it's in the core engine list or explicitly marked as system in the baseline
                const isSystem = isCore || !!baselineEntry.isSystem;

                // Level 8: Hybrid Merge (Enterprise Standard)
                // Using the unified normalizeEntity handles field conversion and nested objects
                (merged.ENTITY_CONFIG as any)[norm.name] = {
                    ...baselineEntry,
                    ...norm,
                    id: ent.id, // Keep the DB id
                    isSystem,
                    fields: norm.fieldsMap,
                    __source: 'd1_entity_definition'
                };
            }
        }

        // 6. Merge Dynamic AI Prompts
        if (prompts.length > 0) {
            const coreCategories = template.CONSTANT?.aiPromptCategory || [];
            prompts.forEach((p: any) => {
                // Filter archived in-memory to avoid SQL column missing issues
                if (p.archived == 1 || p.archived === true) return;
                
                const promptName = p.name || p.id;
                if (coreCategories.includes(promptName)) {
                    console.warn(`[BRAIN-REGISTRY] Prompt name collision: '${promptName}' is a reserved registry category. Merge skipped.`);
                    return;
                }
                (merged.AI_PROMPT as any)[promptName] = { ...p, __source: 'd1_ai_prompt' };
            });
        }

        // --- FEATURE SYNTHESIS (100% Entity-Driven) ---
        // We synthesize the navigation strictly from ENTITY_CONFIG.
        // This eliminates custom filtering logic and ensures D1 entities show up.
        synthesizeNavigation(merged, template);

        // Final Obsolete Cleanup (Remove only raw namespace duplicates if they were merged elsewhere)
        Object.keys(namespaceMapping).forEach(source => {
            const target = namespaceMapping[source];
            if (target !== source && merged[target] && merged[source]) {
                delete merged[source];
            }
        });

        // Update Global Cache (30s for Level 8 Optimization on Windows/Dev)
        // 6s was too aggressive for local development with parallel requests.
        if (!global.CACHED_CONFIGS) global.CACHED_CONFIGS = {};
        global.CACHED_CONFIGS[cacheKey] = {
            data: merged,
            expiry: Date.now() + (process.env.NODE_ENV === 'development' ? 30000 : 10000)
        };
        
        return merged;
    })();

    global.PENDING_CONFIG_FETCHES[cacheKey] = fetchPromise;
    try {
        const result = await fetchPromise;
        return result;
    } finally {
        delete global.PENDING_CONFIG_FETCHES[cacheKey];
    }
} catch (e: any) {
    console.error("[BRAIN-CONFIG-MERGE-ERROR]", e.message);
    return await getRegistry();
}
}

// --- AUDIT AUTOMATION ---
function createAuditProxy(db: any, user: any) {
    if (!db) return db;
    return new Proxy(db, {
        get(target, prop, receiver) {
            const originalMethod = Reflect.get(target, prop, receiver);
            if (typeof originalMethod !== 'function') return originalMethod;

            // Intercept methods that modify data
            if (['create', 'update', 'delete', 'set', 'insert'].includes(String(prop))) {
                return async (...args: any[]) => {
                    const [collection] = args;
                    
                    // Level 8 Auditable Feature check
                    let registry: any = null;
                    try {
                        registry = await mergeRegistryWithD1(target);
                    } catch(e) {}

                    const skipAuditList = registry?.CONSTANT?.auditExclusion || [];
                    
                    if (skipAuditList.includes(collection)) {
                        return await originalMethod.apply(target, args);
                    }

                    let entityDef: any = null;

                    try {
                        const entityConfigs = registry?.ENTITY_CONFIG || {};
                        entityDef = Object.values(entityConfigs).find((e: any) => e.tableName === collection || e.name === collection) as any;
                        
                        // Default to auditable if not specified, but if specified as false, skip.
                        if (entityDef?.features && entityDef.features.auditable === false) {
                            return await originalMethod.apply(target, args);
                        }
                    } catch (e) {
                        // If registry fails, we continue with audit as failsafe
                    }

                    let snapshotBefore = null;
                    const method = String(prop);

                    // For UPDATE, DELETE, SET, fetch snapshot before change
                    if (['update', 'delete', 'set'].includes(method)) {
                        try {
                            const id = method === 'set' ? args[1]?.id : args[1];
                            if (id) {
                                const current = await target.get(collection, id);
                                if (current) snapshotBefore = JSON.stringify(current);
                            }
                        } catch (e) {}
                    }

                    // Execute original operation
                    const result = await originalMethod.apply(target, args);

                    // Determine Entity ID and Details for audit
                    const entityId = (method === 'create' || method === 'insert') 
                        ? (result?.id || result?.ID || args[1]?.id) 
                        : args[1];
                        
                    const details = method === 'delete' ? { id: args[1] } : (method === 'update' ? args[2] : args[1]);
                    
                    let snapshotAfter = null;
                    let afterObj: any = null;
                    if (['update', 'create', 'insert', 'set'].includes(method)) {
                        try {
                            const id = entityId;
                            if (id) {
                                afterObj = await target.get(collection, id);
                                if (afterObj) snapshotAfter = JSON.stringify(afterObj);
                            }
                        } catch (e) {}
                    }

                    // Log to audit_log
                    const finalAfter = afterObj ? afterObj : (method === 'delete' ? null : result);
                    
                    let displayValue = String(entityId || '');
                    try {
                        if (entityDef) {
                            displayValue = getDisplayValue(finalAfter || JSON.parse(snapshotBefore || '{}'), entityDef);
                        }
                    } catch (e) {
                         console.warn("[BRAIN-AUTO-AUDIT] Failed to get display value:", e);
                    }

                    target.create('audit_log', {
                        id: crypto.randomUUID(),
                        action: method,
                        entityType: collection,
                        entityId: String(entityId || ''),
                        display_value: displayValue,
                        user: user?.email || user?.id || 'system',
                        workspaceId: user?.workspaceId || 'system',
                        details: typeof details === 'object' ? JSON.stringify(details) : String(details),
                        snapshot_before: snapshotBefore,
                        snapshot_after: snapshotAfter,
                        createdAt: new Date().toISOString()
                    }).catch((e: any) => console.warn("[BRAIN-AUTO-AUDIT-ERROR]", e.message));

                    return result;
                };
            }
            return originalMethod.bind(target);
        }
    });
}

// (Initialization logic moved to lib/db-init.server.ts)

// --- AI SERVICE FACTORY (Enterprise Level 8) ---
// Centralized AI Service initialization with config merging
// This replaces 3 scattered AiService instantiations in handlers
const createAiService = (env: any, registry: any, workspaceAiConfig?: any): AiService => {
    const aiConfig = workspaceAiConfig 
        ? { ...registry.AI_CONFIG, ...workspaceAiConfig }
        : registry.AI_CONFIG || {};
    
    return new AiService(env, { ai_config: aiConfig, db: null });
};

// --- PERMISSION HELPERS ---
// --- DOMAIN HANDLERS ---
const HANDLERS_CORE: Record<string, (ctx: any) => Promise<Response>> = {
    aiExtract: async ({ db, body, env, user, selectedLang }) => {
        const { entityId, sourceType, content, schema } = body;
        if (!content && sourceType === 'text') return error("Content is required", 400);

        const registry = await getRegistry(db);
        const ai = createAiService(env, registry);

        // Build the extraction prompt
        const schemaBrief = schema.map((f: any) => `- ${f.name} (${f.type}): ${renderString(f.label, selectedLang)}`).join('\n');
        
        const prompt = `
            TASK: EXTRACT SCHEMA DATA FROM CONTENT.
            
            ENTITY: ${entityId}
            FIELDS TO EXTRACT:
            ${schemaBrief}
            
            CONTENT TO ANALYZE:
            """
            ${content}
            """
            
            RULES:
            1. Return ONLY a valid JSON object.
            2. Match values to the field names exactly.
            3. For 'currency'/'number' fields, return ONLY the numeric value (no symbols).
            4. For 'date' fields, use ISO format (YYYY-MM-DD).
            5. For 'select'/'enum' fields, match one of the available options if possible.
            6. If a field is not found, do not include it in the JSON.
            7. DO NOT add any explanations or preamble.
        `;

        try {
            const response = await ai.chat(prompt, [], {
                provider: registry.AI_CONFIG?.active_provider,
                model: registry.AI_CONFIG?.preferredModel || 'gemini-1.5-flash',
                temperature: 0.1, // Low temperature for extraction
                systemPrompt: "You are a data extraction specialist. Always return valid JSON matching the requested schema."
            });

            // Extract JSON from response (handle markdown blocks)
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error("[AI-EXTRACT] No JSON found in response:", response);
                return error("No valid data could be extracted by AI", 500);
            }

            const extractedData = JSON.parse(jsonMatch[0]);
            return success(extractedData);
        } catch (e: any) {
            console.error("[AI-EXTRACT-ERROR]", e.message);
            return error(`AI Extraction failed: ${e.message}`, 500);
        }
    },
    asset: async ({ parts, db }) => {
        const id = parts[1];
        if (!id) return error("Missing asset ID");
        const asset = await db.get("asset", id);
        if (!asset) return error("Asset not found", 404);
        return success(deepParse(asset));
    },
    stats: async ({ db, user }) => {
        const counts = await db.query(`
            SELECT 'contacts' as label, COUNT(*) as value FROM contact WHERE workspaceId = ?
            UNION ALL
            SELECT 'tasks' as label, COUNT(*) as value FROM task WHERE workspaceId = ?
            UNION ALL
            SELECT 'deals' as label, COUNT(*) as value FROM deal WHERE workspaceId = ?
        `, [user.workspaceId, user.workspaceId, user.workspaceId]);
        return success(counts);
    },
    registry: async ({ db, user, registry }) => {
        return success({
            entities: registry.ENTITY_CONFIG,
            constants: registry.CONSTANT,
            theme: registry.THEME
        });
    },
    entity: async ({ db, user, registry }) => {
        // Return entity definitions for the builder
        return success(Object.values(registry.ENTITY_CONFIG || {}));
    },
    ai: async ({ op, parts, db, user, body, env }) => {
        const registry = await getRegistry(db);
        const workspaceId = user.workspaceId;
        
        // Load workspace-specific AI overrides if they exist
        let workspaceAiConfig: any = {};
        if (workspaceId) {
            const ws = await db.get('workspace', workspaceId);
            if (ws) {
                // Check dedicated AI column first, then fallback to settings JSON
                if (ws.ai) {
                    workspaceAiConfig = typeof ws.ai === 'string' ? JSON.parse(ws.ai) : ws.ai;
                } else if (ws.settings) {
                    const wsSettings = typeof ws.settings === 'string' ? JSON.parse(ws.settings) : ws.settings;
                    workspaceAiConfig = wsSettings.ai || {};
                }
            }
        }

        const ai = createAiService(env, registry, workspaceAiConfig);

        if (op === "architect" || body.action === "architect") {
            const { prompt, provider, model } = body;
            if (!prompt) return error("Prompt required");
            
            const entities = Object.entries(registry.ENTITY_CONFIG || {}).map(([id, cfg]: [any, any]) => ({ id, label: cfg.label }));
            
            const promptContext = await ai.getPrompt(db, 'entity_architect', { 
                userPrompt: prompt, 
                currentEntities: JSON.stringify(entities),
                appName: registry.appName,
                language: registry.language 
            });

            const response = await ai.chat(promptContext.prompt, [], {
                systemPrompt: promptContext.systemPrompt,
                provider: provider || registry.AI_CONFIG?.active_provider,
                model: promptContext.model || model || registry.AI_CONFIG?.model || registry.AI_CONFIG?.preferredModel,
                response_mime_type: 'application/json'
            });
            
            const result = (ai as any).engine.extractJson(response);

            // Level 8 Audit
            await db.create('audit_log', {
                id: crypto.randomUUID(),
                action: 'ai-architect',
                entityType: 'ai',
                details: JSON.stringify({ prompt: prompt.substring(0, 100) }),
                user: user?.email || user?.id || 'system',
                workspaceId: user?.workspaceId || 'system',
                createdAt: new Date().toISOString()
            });

            return result ? success(result) : success({ rawResponse: response });
        }

        if (op === "get-prompt" || body.action === "get-prompt") {
            const { name, context = {} } = body || {};
            if (!name) return error("Prompt name required");
            return success(await ai.getPrompt(db, name, context));
        }

        if (op === "chat" || body.action === "chat") {
            const { message, history = [], role, lang = registry.language, context = {} } = body || {};
            if (!message) return error("Message required");

            const languageName = (registry.I18N_CONFIG?.supportedLanguages as any)?.[lang]?.name || registry.language || 'Romanian';
            const promptContext = await ai.getPrompt(db, role || 'chat', { 
                message, 
                workspaceId, 
                lang, 
                language: languageName, 
                appName: registry.appName,
                workspace_prompt: workspaceAiConfig.customPrompts || [],
                ...context 
            });
            
            // Add language constraints from registry template if not already in system prompt
            let systemPrompt = promptContext.systemPrompt;
            if (!systemPrompt.includes(languageName) && registry.AI_PROMPT.language_instruction) {
                systemPrompt += "\n\n" + registry.AI_PROMPT.language_instruction.replace('{{language}}', languageName);
            }

            // Apply Personality from Workspace or Context
            const activePersonality = context.personality || registry.AI_CONFIG?.personality || 'professional';
            const personalityInstruction = {
                professional: "Maintain a professional, concise and business-oriented tone.",
                creative: "Be creative, expressive and inspirational. Feel free to use metaphors.",
                technical: "Be highly technical and precise. Use industry-specific terminology where appropriate.",
                friendly: "Be warm, friendly and supportive. Use approachable language.",
                analytical: "Be data-driven and analytical. Structure responses with logic and facts."
            }[activePersonality as string] || "";

            if (personalityInstruction) {
                systemPrompt += "\n\nPersonality: " + personalityInstruction;
            }
            
            const response = await ai.chat(promptContext.prompt, history, { 
                provider: registry.AI_CONFIG?.active_provider, 
                model: promptContext.model || body.model || registry.AI_CONFIG?.preferredModel || registry.AI_CONFIG?.model, 
                temperature: registry.AI_CONFIG?.temperature,
                maxTokens: registry.AI_CONFIG?.maxTokens,
                systemPrompt 
            });

            // Level 8 Audit
            await db.create('audit_log', {
                id: crypto.randomUUID(),
                action: 'ai-chat',
                entityType: 'ai',
                details: JSON.stringify({ message: message.substring(0, 100) }),
                user: user?.email || user?.id || 'system',
                workspaceId: user?.workspaceId || 'system',
                createdAt: new Date().toISOString()
            });

            return success({ response });
        }

        if (op === "import-ai" || body.action === "import-ai") {
            const registry = await getRegistry(db);
            const { text, schema = {}, entityName = 'items', lang = registry.language } = body || {};
            if (!text) return error("Text required");
            
            try {
                const promptConfig = await ai.getPrompt(db, 'ENTITY_EXTRACTION', { entityName, workspaceId, lang });
                const aiConfig = registry.AI_CONFIG;

                const result = await ai.extractEntities(text, schema, entityName, {
                    customPromptTemplate: promptConfig.prompt,
                    systemPrompt: promptConfig.systemPrompt,
                    lang,
                    provider: aiConfig.active_provider,
                    model: aiConfig.model
                });

                // Level 8 Audit
                await db.create('audit_log', {
                    id: crypto.randomUUID(),
                    action: 'ai-import',
                    entityType: 'ai',
                    details: JSON.stringify({ entityName, textLength: text.length }),
                    user: user?.email || user?.id || 'system',
                    workspaceId: user?.workspaceId || 'system',
                    createdAt: new Date().toISOString()
                });

                return success(result);
            } catch (e: any) {
                return error(`AI import failed: ${e.message}`, 500);
            }
        }

        if (op === "generate" || body.action === "generate") {
            const { prompt, model, data, temperature, personality } = body;
            if (!prompt) return error("Missing prompt");

            try {
                let finalPrompt = prompt;
                if (data && typeof data === 'object') {
                    Object.entries(data).forEach(([key, val]) => {
                        finalPrompt = finalPrompt.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), String(val || ''));
                    });
                }

                // Inject personality instruction if provided or from workspace config
                const activePersonality = personality || registry.AI_CONFIG?.personality || 'professional';
                const personalityMap: any = {
                    professional: "Maintain a professional, concise and business-oriented tone.",
                    creative: "Be creative, expressive and inspirational. Feel free to use metaphors.",
                    technical: "Be highly technical and precise. Use industry-specific terminology where appropriate.",
                    friendly: "Be warm, friendly and supportive. Use approachable language.",
                    analytical: "Be data-driven and analytical. Structure responses with logic and facts."
                };
                
                const systemPrompt = personalityMap[activePersonality] || "You are a helpful AI assistant.";

                const response = await ai.chat(finalPrompt, [], { 
                    provider: registry.AI_CONFIG?.active_provider,
                    model: model || registry.AI_CONFIG?.preferredModel || registry.AI_CONFIG?.model,
                    temperature: temperature ?? registry.AI_CONFIG?.temperature,
                    systemPrompt
                });

                return success(response);
            } catch (e: any) {
                return error(`AI Generation Error: ${e.message}`);
            }
        }
        
        if (parts[1] === "prompt") {
            if (body.action === "save") return success(await db.set("_ai_prompt", body.id || crypto.randomUUID(), { ...deepStringify(body), workspaceId, updatedAt: new Date().toISOString() }));
            return success((await db.list("_ai_prompt", { workspaceId })).map(deepParse));
        }

        return error("AI operation not found", 404);
    },
    action: async ({ op, parts, db, user, body }) => {
        const registry = await getRegistry(db);
        const selectedLang = user?.preferredLanguage || registry.language || 'ro';
        
        if (op === "undo") {
            const logId = parts[2];
            if (!logId) return error(renderString({ ro: "ID jurnal lipsește", en: "Log ID required" }, selectedLang));
            const log = await (db as any)._target?.get('audit_log', logId) || await db.get('audit_log', logId);
            if (!log || !log.snapshot_before) return error(renderString({ ro: "Snapshot-ul nu există", en: "Snapshot not found" }, selectedLang));
            if (!(await checkAccessAsync(db, user, log.entityType, 'update', registry))) return error("Forbidden", 403);
            let beforeData;
            try { beforeData = typeof log.snapshot_before === 'string' ? JSON.parse(log.snapshot_before) : log.snapshot_before; } catch (e) { return error(renderString({ ro: "Format snapshot invalid", en: "Invalid snapshot format" }, selectedLang)); }
            await db.update(log.entityType, log.entityId, beforeData);
            await db.create('audit_log', { id: crypto.randomUUID(), action: 'system-undo', entityType: log.entityType, entityId: log.entityId, display_value: log.display_value, details: renderString({ ro: `Restaurat din log ${logId.substring(0, 8)}...`, en: `Restored from log ${logId.substring(0, 8)}...` }, selectedLang), user: user?.email || user?.id || 'system', workspaceId: user?.workspaceId || log.workspaceId, createdAt: new Date().toISOString() });
            return success({ id: log.entityId, message: renderString({ ro: "Restaurare finalizată cu succes", en: "Rollback successful" }, selectedLang), details: renderString({ ro: `Inversat ${log.action} pe ${log.entityType}`, en: `Reverted ${log.action} on ${log.entityType}` }, selectedLang) });
        }
        if (op === "history") {
            const limit = parseInt(body?.limit || '100'), offset = parseInt(body?.offset || '0'), entityType = body?.entityType, action = body?.action, userId = body?.userId;
            let query = "SELECT * FROM audit_log WHERE workspaceId = ?";
            const params: any[] = [user.workspaceId];
            if (entityType) { query += " AND entityType = ?"; params.push(entityType); }
            if (action) { query += " AND action = ?"; params.push(action); }
            if (userId) { query += " AND userId = ?"; params.push(userId); }
            query += " ORDER BY createdAt DESC LIMIT ? OFFSET ?";
            params.push(limit, offset);
            const logs = await db.query(query, params);
            const countRes = await db.query("SELECT COUNT(*) as total FROM audit_log WHERE workspaceId = ?", [user.workspaceId]);
            return success({ logs: logs.map(deepParse), total: countRes[0]?.total || 0, limit, offset });
        }
        if (op === "entity-history") {
            const entityType = parts[2], entityId = parts[3];
            if (!entityType || !entityId) return error(renderString({ ro: "Entity Type și ID necesare", en: "Entity Type and ID required" }, selectedLang));
            const logs = await db.query("SELECT * FROM audit_log WHERE workspaceId = ? AND entityType = ? AND entityId = ? ORDER BY createdAt DESC LIMIT 50", [user.workspaceId, entityType, entityId]);
            return success(logs.map(deepParse));
        }
        if (op === "stats") {
            const today = new Date(), sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            const totalRes = await db.query("SELECT COUNT(*) as total FROM audit_log WHERE workspaceId = ?", [user.workspaceId]);
            const weekRes = await db.query("SELECT COUNT(*) as week FROM audit_log WHERE workspaceId = ? AND createdAt > ?", [user.workspaceId, sevenDaysAgo.toISOString()]);
            const byActionRes = await db.query("SELECT action, COUNT(*) as count FROM audit_log WHERE workspaceId = ? GROUP BY action ORDER BY count DESC LIMIT 10", [user.workspaceId]);
            const byEntityRes = await db.query("SELECT entityType, COUNT(*) as count FROM audit_log WHERE workspaceId = ? GROUP BY entityType ORDER BY count DESC LIMIT 10", [user.workspaceId]);
            return success({ total: totalRes[0]?.total || 0, lastWeek: weekRes[0]?.week || 0, byAction: byActionRes || [], byEntity: byEntityRes || [] });
        }
        return error("Action not found", 404);
    },
    tag: async ({ op, parts, db, user, body, method }) => {
        const table = 'tag', relationTable = 'tag_assignment';
        if (method === 'GET') {
            if (op === "results") {
                const assignments = await db.list(relationTable, { tagId: parts[2], workspaceId: user.workspaceId });
                const res = [];
                for (const a of assignments) {
                        const rec = await db.get(a.entityType, a.entityId);
                    if (rec) res.push({ ...deepParse(rec), _entity: a.entityType });
                }
                return success(res);
            }
            return success((await db.list(table, { workspaceId: user.workspaceId })).map(deepParse));
        }
        if (op === "create") return success(await db.create(table, { id: crypto.randomUUID(), ...body, workspaceId: user.workspaceId }));
        if (op === "assign") return success(await db.create(relationTable, { id: crypto.randomUUID(), ...body, workspaceId: user.workspaceId }));
        if (op === "remove") {
            const ex = await db.list(relationTable, { tagId: body.tagId, entityId: body.entityId, workspaceId: user.workspaceId });
            for (const item of ex) await db.delete(relationTable, item.id);
            return success();
        }
        return error("Tag operation not found");
    },
    search: async ({ db, user, url, selectedLang }) => {
        const query = url.searchParams.get("q") || "", entityTypeFilter = url.searchParams.get("type") || "", limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200), offset = parseInt(url.searchParams.get("offset") || "0");
        if (!query || query.trim().length < 2) return success([]);
        const searchTerm = `%${query.toLowerCase()}%`, registry = await getRegistry(db), isSuper = isGlobalAdmin(user, registry), results: any[] = [], entityConfigs = registry.ENTITY_CONFIG || {};
        try {
            for (const [entityName, config] of Object.entries(entityConfigs)) {
                const cfg = config as any, tableName = cfg.tableName || entityName;
                if (entityTypeFilter && entityTypeFilter !== entityName) continue;
                const isGlobal = isGlobalEntity(entityName, registry);
                const searchFields = cfg.searchFields || (cfg.displayField ? [cfg.displayField] : []);
                if (!searchFields || searchFields.length === 0) continue;
                if (!(await checkAccessAsync(db, user, entityName, 'view', registry))) continue;
                try {
                    const whereConditions = searchFields.map((f: string) => `LOWER("${f}") LIKE ?`).join(' OR ');
                    const params = searchFields.map(() => searchTerm);
                    let sql = `SELECT * FROM "${tableName}" WHERE (${whereConditions})`;
                    const sqlParams = [...params];
                    if (!isGlobal && !isSuper) { sql += ` AND workspaceId = ?`; sqlParams.push(user?.workspaceId || 'system'); }
                    if (cfg.features?.softDelete) sql += ` AND deletedAt IS NULL`;
                    sql += ` LIMIT ? OFFSET ?`; sqlParams.push(String(limit), String(offset));
                    const entityResults = await db.query(sql, sqlParams);
                    for (const item of entityResults) {
                        const displayValue = item[cfg.displayField || 'name'] || item.id;
                        results.push({ id: item.id, type: entityName, displayValue, workspaceId: item.workspaceId, createdAt: item.createdAt, match_fields: searchFields.filter((f: string) => item[f] && String(item[f]).toLowerCase().includes(query.toLowerCase())), icon: cfg.icon || 'Box', label: renderString(cfg.label || {}, selectedLang), link: `/${entityName}/${item.id}` });
                    }
                } catch (e: any) { console.warn(`[SEARCH-ERROR] Failed to search ${entityName}:`, e.message); }
            }
            results.sort((a, b) => { const aExact = a.displayValue.toLowerCase() === query.toLowerCase() ? 1 : 0, bExact = b.displayValue.toLowerCase() === query.toLowerCase() ? 1 : 0; if (aExact !== bExact) return bExact - aExact; return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); });
            return success({ query, total: results.length, results, limit, offset });
        } catch (e: any) { console.error("[SEARCH-FATAL]", e.message); return error(`Search failed: ${e.message}`, 500); }
    },
    workflow: async (ctx) => await executeEntityAction(ctx),
    member: async ({ url, db, user, selectedLang, registry }) => {
        const isSuper = isGlobalAdmin(user, registry), isWsAdmin = isWorkspaceAdmin(user, registry);
        if (!isWsAdmin && !hasPageAccess(user, 'profile', registry)) return error(renderString({ ro: "Acces neautorizat pentru vizualizarea listei de membri.", en: "Unauthorized access to member list." }, selectedLang), 403);
        const requestedWorkspaceId = url.searchParams.get('workspaceId') || user.workspaceId;
        let effectiveWorkspaceId: string | undefined = user.workspaceId;
        if (isSuper) effectiveWorkspaceId = (requestedWorkspaceId === 'all' || !requestedWorkspaceId) ? undefined : requestedWorkspaceId;
        try {
            let result: any[] = [];
            try {
                const whereClause = effectiveWorkspaceId ? "WHERE (workspaceId = ? OR workspaceId IS NULL)" : "WHERE 1=1";
                const params = effectiveWorkspaceId ? [effectiveWorkspaceId] : [];
                result = await db.query(`SELECT id, name, email, image, role, workspaceId, active FROM user ${whereClause} AND (role IS NULL OR role != 'guest') AND (active IS NULL OR active != 0) ORDER BY name ASC`, params);
            } catch (authDbErr: any) {
                const whereClause = effectiveWorkspaceId ? "WHERE workspaceId = ?" : "WHERE 1=1";
                const params = effectiveWorkspaceId ? [effectiveWorkspaceId] : [];
                result = await db.query(`SELECT id, name, email, role, workspaceId, status as active FROM contact ${whereClause} AND (role IS NULL OR role != 'guest') ORDER BY name ASC`, params);
            }
            if (result.length === 0 && effectiveWorkspaceId !== 'system') {
                 const contactsResult = await db.list('contact', { workspaceId: effectiveWorkspaceId, archived: 0 });
                 if (contactsResult.length > 0) result = contactsResult;
            }
            return success(result.map(deepParse));
        } catch (e: any) { return error(`Failed to fetch users: ${e.message}`, 500); }
    },
    help: async ({ url, db, env }) => {
        const registry = await getRegistry(db);
        const id = url.searchParams.get("id"), lang = url.searchParams.get("lang") || registry.language;
        if (!id) return error("Missing ID");
        try {
            const cached = await db.get("_help_content");
            if (cached) return success(deepParse(cached));
            const ai = createAiService(env, registry);
            const text = await ai.chat(`Create help for section: ${id}. Language: ${lang}.`, [], { systemPrompt: "Return JSON: { \"title\": \"...\", \"content\": \"...\", \"description\": \"...\" }" });
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            const result = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
            if (result.title) await db.set("_help_content", { ...result, updatedAt: new Date().toISOString() });
            return result;
        } catch (e: any) { return success({ title: id.charAt(0).toUpperCase() + id.slice(1), content: "Documentation is being generated or is temporarily unavailable.", description: "Help Content" }); }
    },
    upload: async ({ db, user, body, env }) => {
        const storage = (body instanceof FormData ? body.get('storage') : body.storage) || 'local-inbox', file = body instanceof FormData ? body.get('file') : null;
        if (!file) return error("No file provided");
        await db.create('audit_log', { id: crypto.randomUUID(), action: 'upload', entityType: 'file', details: JSON.stringify({ name: (file as any).name, size: (file as any).size, storage }), user: user?.email || user?.id || 'system', workspaceId: user?.workspaceId || 'system', createdAt: new Date().toISOString() });
        if (storage === 'local-inbox') {
            const registry = await getRegistry(db), localAgentUrl = env.VITE_SOCKET_URL || registry.CONSTANTS?.directories?.apiUrl || 'http://localhost:4001';
            try {
                const formData = new FormData();
                if (file && typeof (file as any).name === 'string') { formData.append('file', file as any, (file as any).name); } else { formData.append('file', file as any); }
                formData.append('workspaceId', user?.workspaceId || 'system');
                formData.append('userId', user?.id || 'system');
                const response = await fetch(`${localAgentUrl}/api/file/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${env.API_KEY || 'dev-token'}`, 'Accept': 'application/json' }, body: formData });
                if (!response.ok) { let errorMsg = 'Local agent upload failed'; try { const err: any = await response.json(); errorMsg = err.error || errorMsg; } catch (e) { try { errorMsg = await response.text() || errorMsg; } catch(e2) {} } return error(errorMsg, response.status); }
                return success(await response.json());
            } catch (e: any) { return error(`Agentul local nu este disponibil: ${e.message}`, 503); }
        }
        return error(`Storage provider '${storage}' not yet implemented.`, 501);
    },
    socket: async () => error("Socket.IO not supported on Worker", 404),
    localAgent: async ({ parts, request, db, env, user }) => {
        const registry = await getRegistry(db), localAgentUrl = env.VITE_SOCKET_URL || registry.SYSTEM_SETTING?.local_agent_url || 'http://localhost:4001';
        const subPath = parts.slice(1).join('/'), targetUrl = new URL(request.url), finalUrl = `${localAgentUrl.replace(/\/$/, '')}/api/${subPath}${targetUrl.search}`;
        try {
            const hasBody = !['GET', 'HEAD', 'DELETE'].includes(request.method);
            const proxyRequest: any = { method: request.method, headers: { 'Content-Type': request.headers.get('Content-Type') || 'application/json', 'X-API-Key': env.API_KEY || 'dev-token', 'X-User-ID': user?.id || 'system', 'X-Workspace-ID': user?.workspaceId || 'system' } };
            if (hasBody) proxyRequest.body = request.headers.get('Content-Type')?.includes('multipart/form-data') ? await request.formData() : await request.text();
            const response = await fetch(finalUrl, proxyRequest);
            return new Response(await response.arrayBuffer(), { status: response.status, headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json', 'Access-Control-Allow-Origin': '*' } });
        } catch (e: any) { return error(`Agentul local nu este disponibil la ${localAgentUrl}`, 503); }
    },
    workspace: async (ctx) => await executeEntityAction(ctx),
    system: async (ctx) => await executeEntityAction(ctx),
    monitoring: async ({ db, user }) => {
        const logs = await db.list('audit_log', { workspaceId: user.workspaceId }, { limit: 10, sortBy: 'createdAt', sortOrder: 'DESC' });
        return success(logs);
    },
    auth: async ({ request, env, op, user, db, body, registry }) => {
        if (op === "check-admin") {
            return success({ isAdmin: isGlobalAdmin(user, registry) });
        }
        
        if (op === "setup-admin") {
            const { email, password, name } = body;
            if (!email || !password) return error("Email and password are required");
            
            // Level 8: Protection - Only allow setup if NO users exist or NO superadmin exists
            try {
                const admins = await db.query("SELECT id FROM user WHERE role = 'superadmin' LIMIT 1");
                if (admins && admins.length > 0) {
                    return error("Sistemul este deja configurat. Setup-ul este blocat.", 403);
                }
            } catch (e) {}

            const auth = getAuth(env, request);
            try {
                // Register via Better-Auth Server API
                const result = await auth.api.signUpEmail({
                    body: { email, password, name: name || email.split('@')[0] }
                });

                if (!result || !result.user) throw new Error("Eroare la crearea utilizatorului.");

                // Promote to SuperAdmin directly in DB
                await db.exec("UPDATE user SET role = 'superadmin', workspaceId = 'system' WHERE id = ?", [result.user.id]);
                
                return success({ message: "Admin creat cu succes", user: result.user });
            } catch (err: any) {
                console.error("[SETUP-ADMIN-ERROR]", err);
                return error(`Setup eșuat: ${err.message}`, 500);
            }
        }

        const auth = getAuth(env, request);
        return await auth.handler(request);
    }
};

const HANDLERS: Record<string, (ctx: any) => Promise<Response>> = {
    'ai/extract': HANDLERS_CORE.aiExtract,
    asset: HANDLERS_CORE.asset,
    stats: HANDLERS_CORE.stats,
    registry: HANDLERS_CORE.registry,
    entity: HANDLERS_CORE.entity,
    db: async (ctx) => await executeEntityAction(ctx),
    ai: HANDLERS_CORE.ai,
    action: HANDLERS_CORE.action,
    tag: HANDLERS_CORE.tag,
    search: HANDLERS_CORE.search,
    workflow: HANDLERS_CORE.workflow,
    member: HANDLERS_CORE.member,
    help: HANDLERS_CORE.help,
    upload: HANDLERS_CORE.upload,
    'socket.io': HANDLERS_CORE.socket,
    'local-agent': HANDLERS_CORE.localAgent,
    workspace: HANDLERS_CORE.workspace,
    system: HANDLERS_CORE.system,
    monitoring: HANDLERS_CORE.monitoring,
    auth: HANDLERS_CORE.auth
};

async function _handleBrainRequest(request: Request, env: any, cfCtx?: any) {
    const requestId = Math.random().toString(36).substring(7);
    try {
        const url = new URL(request.url);
        const path = url.pathname.replace(/^\/api/, '').replace(/^\//, '').replace(/\/$/, '');
        
        // Basic Lang Detection
        const urlParts = url.pathname.split('/');
        const selectedLang = (urlParts[1] === 'ro' || urlParts[1] === 'en') ? urlParts[1] : 'ro';
        
        // 1. EXTRA-SYSTEM ENDPOINTS (No DB, No Auth, Quiet logs for health)
        if (path === "health") return success({ status: "ok" });

        console.log(`[BRAIN][${requestId}] Request: ${request.method} ${url.pathname}`);
        
        if (path === "auth/local-token" || path === "local-token") {
            return success({ token: env.API_KEY || "dev-token" });
        }

        // 2. DATABASE INITIALIZATION (LEVEL 8)
        const rawDb = getDb(env);
        if (!global.IS_DB_INITIALIZED) {
            console.log(`[BRAIN][${requestId}][${path}] Triggering DB initialization...`);
            // Pass the context for waitUntil support
            await ensureSystemTables(rawDb, request.url, cfCtx).catch(e => {
                console.error(`[BRAIN-INIT-ERROR][${requestId}]`, e.message);
            });
        }

        
        // ⚠️ CRITICAL: Block all queries until DB initialization completes
        const waitStart = Date.now();
        await waitForDbReady(rawDb, 5000); // Reduced to 5s for better responsiveness
        const waitTime = Date.now() - waitStart;
        if (waitTime > 100) {
            console.log(`[BRAIN][${requestId}] DB Ready Wait: ${waitTime}ms`);
        }

        // 3. BETTER-AUTH DELEGATION
        const isCustomAuth = url.pathname.includes('/check-admin') || 
                            url.pathname.includes('/setup-admin');
                            
        if (url.pathname.startsWith('/api/auth') && !isCustomAuth) {
            console.log(`[BRAIN-AUTH][${requestId}] Delegating to Better-Auth`);
            const auth = getAuth(env, request);
            try {
                const response = await auth.handler(request);
                console.log(`[BRAIN-AUTH][${requestId}] Better-Auth response: ${response.status}`);
                return response;
            } catch (authErr: any) {
                console.error(`[BRAIN-AUTH-ERROR][${requestId}]`, authErr.message, authErr.stack);
                throw authErr;
            }
        }

        const parts = path.split('/');
        const resource = (parts[0] || '').toLowerCase();
        const op = (parts[1] || '').toLowerCase();
        
        console.log(`[BRAIN][${requestId}] Request: ${request.method} resource="${resource}", op="${op}", path="${path}"`);

        const isPublic = [
            "health", 
            "auth/check-admin", "check-admin", 
            "auth/setup-admin", "setup-admin", 
            "auth/local-token", "local-token"
        ].includes(path.toLowerCase()) || resource === "config";

        let user = null;
        if (!isPublic) {
            try { 
                user = await verifyAuth(request, env); 
                if (user) console.log(`[BRAIN][${requestId}] User: ${user.email}`);
            } catch(e: any) {
                console.warn(`[BRAIN-AUTH-VERIFY-WARN][${requestId}]`, e.message);
            }

            if (!user) return error(renderString({
                ro: "Sesiune expirată sau neautorizată. Vă rugăm să vă autentificați din nou.",
                en: "Session expired or unauthorized. Please login again."
            }, selectedLang), 401);
        }
        
        // Wrap db with audit proxy to automate logging
        const db = createAuditProxy(rawDb, user);

        const registry = await mergeRegistryWithD1(db, user?.workspaceId || 'system');

        if (resource === "config") {
            return success({ 
                entity: registry.ENTITY_CONFIG || {}, 
                constants: registry, 
                uiConfig: registry.THEME || {} 
            });
        }

        let body: any = {};
        if (!['GET', 'DELETE'].includes(request.method)) {
            try { 
                const contentType = request.headers.get('content-type') || '';
                if (contentType.includes('multipart/form-data')) {
                    body = await request.formData();
                } else if (contentType.includes('application/json')) {
                    body = await request.json();
                } else {
                    body = await request.json().catch(() => ({}));
                }
            } catch (bodyErr: any) {
                console.warn(`[BRAIN] Failed to parse request body: ${bodyErr.message}`);
                body = {};
            }
        }

        const ctx = { request, env, db, user, url, parts, resource, op: parts[1], method: request.method, body, cfCtx, selectedLang, registry };
        
        if (resource === "db") {
            const table = (parts[1] === 'collection' ? parts[2] : parts[1]).toLowerCase();
            
            // SECURITY: Ensure system entities are filtered by workspace unless superadmin
            // We inject the workspaceId filter into the context before calling HANDLERS.db
            if (user && !isGlobalAdmin(user, registry)) {
                if (!isGlobalEntity(table, registry)) {
                    if (ctx.method === 'GET' && !url.searchParams.has('workspaceId')) {
                        url.searchParams.set('workspaceId', user.workspaceId || 'system');
                    }
                }
            }
        }

        const handler = HANDLERS[resource];
        if (handler) {
            const handlerResponse = await handler(ctx);
            
            // Enterprise Level 8: Apply Translation Transformer to JSON responses
            if (handlerResponse.headers.get('content-type')?.includes('application/json')) {
                try {
                    const data: any = await handlerResponse.json();
                    
                    // Transform multilingual fields in response data
                    if (data.data) {
                        data.data = transformTranslations(data.data, selectedLang);
                    } else if (Array.isArray(data)) {
                        return Response.json(transformTranslations(data, selectedLang), { status: handlerResponse.status });
                    }
                    
                    return Response.json(data, { status: handlerResponse.status });
                } catch (e) {
                    // If JSON parsing fails, return original response
                    return handlerResponse;
                }
            }
            
            return handlerResponse;
        }
        
        console.warn(`[BRAIN][${requestId}] No handler found for ${resource}, falling back to CRUD`);
        
        // Generic CRUD Fallback (Enterprise Level 8)
        if (request.method === 'GET') {
            const isGlobal = isGlobalEntity(resource, registry);
            const filters: any = {};
            if (!isGlobal && user) {
                filters.workspaceId = user.workspaceId;
            }
            const results = await db.list(resource, filters);
            return success(results.map(deepParse));
        }
        
        return error(`Resource ${resource} not found`, 404);

    } catch (err: any) {
        console.error("[BRAIN-FATAL] Request Error:", {
            method: request.method,
            url: request.url,
            error: err.message,
            stack: err.stack
        });
        return error(err.message, 500);
    }
}

export async function handleBrainRequest(request: Request, env: any, cfCtx?: any) {
    const origin = request.headers.get("Origin") || "";
    // Robust allowed origins check (Enterprise Level 8)
    const isAllowed = origin && (
        origin.includes('aemdpc.ro') || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') ||
        origin.includes('192.168.') ||
        origin.includes('10.') ||
        origin.includes('172.')
    );
    
    const corsHeaders: Record<string, string> = {
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-API-Key",
        "Access-Control-Allow-Credentials": "true",
    };

    if (origin) {
        corsHeaders["Access-Control-Allow-Origin"] = isAllowed ? origin : "https://service.aemdpc.ro";
    }

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const response = await _handleBrainRequest(request, env, cfCtx);
        
        // Handle case where response might not be a standard Response object or is null
        if (!response || typeof response.clone !== 'function') {
            const errorRes = new Response(JSON.stringify({ success: false, error: "Internal Handler Error" }), { 
                status: 500, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
            return errorRes;
        }

        const finalHeaders = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => {
            finalHeaders.set(k, v);
        });

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: finalHeaders
        });
    } catch (err: any) {
        console.error("[BRAIN-WRAPPER-FATAL]", err);
        return new Response(JSON.stringify({ success: false, error: err.message }), { 
            status: 500, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
    }
}

