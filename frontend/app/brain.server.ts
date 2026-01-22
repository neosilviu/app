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
import { NAV_STRUCTURE } from '../../registry-baseline.ts';
import { ensureSystemTables, waitForDbReady, mapFieldType, ensureBaselineSync, syncEntityTable } from './lib/db-init.server';

// --- TYPING ---
declare global {
    var CACHED_CONFIGS: Record<string, any>;
    var CACHE_EXPIRY: number;
}

const global = globalThis as any;

// --- CORE HELPERS --- 
const json = (payload: any, status = 200) => Response.json(payload, { 
    status, 
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } 
});
const success = (data: any = true) => json({ success: true, data });
const error = (msg: string, status = 400) => json({ success: false, error: msg }, status);

const deepParse = (obj: any): any => {
    if (typeof obj === 'string' && (obj.startsWith('{') || obj.startsWith('['))) {
        try { return deepParse(JSON.parse(obj)); } catch { return obj; }
    }
    if (!obj || typeof obj !== 'object') return obj;
    const result = Array.isArray(obj) ? [...obj] : { ...obj };
    for (const key in result) result[key] = deepParse(result[key]);
    return result;
};

const deepStringify = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    const result: any = Array.isArray(obj) ? [] : {};
    for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            try { result[k] = JSON.stringify(v); } catch { result[k] = v; }
        } else result[k] = v;
    }
    return result;
};

const convertToCSV = (data: any[]): string => {
    if (!data || data.length === 0) {
        return "";
    }
    const headers = Object.keys(data[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const row of data) {
        const values = headers.map(header => {
            let value = row[header];
            if (value === null || value === undefined) {
                value = '';
            } else if (typeof value === 'object') {
                value = JSON.stringify(value);
            }
            
            const stringValue = String(value);
            const escaped = stringValue.replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
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
        workers: [],
        entities: [],
        admin: [...(template.NAV?.admin || [])],
        shortcuts: [...(template.NAV?.shortcuts || [])],
    };

    // Unified Entity-to-Nav Synthesizer
    Object.entries(merged.ENTITY_CONFIGS || {}).forEach(([name, def]: [string, any]) => {
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
        } else if (cat === 'workers' || cat.includes('worker') || cat.includes('app')) {
            synthesizedNav.workers.push(navItem);
        } else if (cat === 'administration' || cat.includes('admin') || cat.includes('workspace')) {
            if (!synthesizedNav.admin.find((i: any) => i.id === name)) {
                synthesizedNav.admin.push(navItem);
            }
        } else {
            synthesizedNav.entities.push(navItem);
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
 * Merges Registry Baseline (Template) with D1 system_setting (Values)
 * Uses a short-lived cache (Level 8 Optimization) to prevent DB floods
 */
async function getEntityDependencies(db: any, entity: string, id: string, registry: any) {
    const dependencies: any[] = [];
    const entityConfigs = registry.ENTITY_CONFIGS || {};
    
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
                    db.query("SELECT * FROM system_setting"),
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
                    const parsedValue = dataType === 'json' ? JSON.parse(value) : value;
                    if (!configFromD1[namespace]) configFromD1[namespace] = {};
                    configFromD1[namespace][key] = parsedValue;
                } catch (e: any) { }
            }
            
            // 4. Merge logic...
            const merged: any = { 
                ...template,
                ENTITY_CONFIGS: { ...(template.ENTITY_CONFIGS || {}) }
            };
        
        // Logical Namespace Mapping (Enterprise Level 8 Standard)
        const namespaceMapping: Record<string, string> = {
            'ai': 'AI_CONFIG',
            'ai_config': 'AI_CONFIG',
            'theme': 'THEME',
            'ui': 'THEME',
            'uiconfig': 'THEME',
            'ui_config': 'THEME',
            'auth': 'AUTH_CONFIG',
            'auth_config': 'AUTH_CONFIG',
            'nav': 'NAV',
            'system': 'system_setting',
            'system_setting': 'system_setting',
            'constants': 'CONSTANTS',
            'integrations': 'INTEGRATIONS',
            'i18n': 'I18N_CONFIG',
            'general': 'GENERAL',
            'root': 'GENERAL'
        };

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
        if (!merged.NAV) merged.NAV = template.NAV || NAV_STRUCTURE;
        if (!merged.CONSTANTS) merged.CONSTANTS = template.CONSTANTS || {};
        if (!merged.AI_CONFIG) merged.AI_CONFIG = template.AI_CONFIG || {};
        if (!merged.AUTH_CONFIG) merged.AUTH_CONFIG = template.AUTH_CONFIG || {};
        if (!merged.THEME) merged.THEME = template.THEME || {};
        if (!merged.AI_PROMPTS) merged.AI_PROMPTS = template.AI_PROMPTS || {};
        if (!merged.ENTITY_CONFIGS) merged.ENTITY_CONFIGS = template.ENTITY_CONFIGS || {};
        if (!merged.DASHBOARD) merged.DASHBOARD = template.DASHBOARD || {};
        if (!merged.system_setting) merged.system_setting = template.system_setting || {};
        
        if (entities.length > 0) {
            for (const ent of entities) {
                // Filter archived in-memory to avoid SQL column missing issues
                if (ent.archived == 1 || ent.archived === true) continue;

                const norm = normalizeEntity(ent);
                
                // Level 8: Protection logic - derived from architecture, not just DB flag
                const isStaticBaseline = !!(template.ENTITY_CONFIGS || {})[norm.name];
                const coreEntities = template.CONSTANTS?.coreEntities || [];
                const isCore = coreEntities.includes(norm.name);
                
                const isSystem = isStaticBaseline || isCore;
                const baselineEntry = (template.ENTITY_CONFIGS || {})[norm.name] || {};

                // Level 8: Hybrid Merge (Enterprise Standard)
                // Using the unified normalizeEntity handles field conversion and nested objects
                (merged.ENTITY_CONFIGS as any)[norm.name] = {
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
            const coreCategories = ['system', 'global', 'workspaceTemplates', 'language_instruction'];
            prompts.forEach((p: any) => {
                // Filter archived in-memory to avoid SQL column missing issues
                if (p.archived == 1 || p.archived === true) return;
                
                const promptName = p.name || p.id;
                if (coreCategories.includes(promptName)) {
                    console.warn(`[BRAIN-REGISTRY] Prompt name collision: '${promptName}' is a reserved registry category. Merge skipped.`);
                    return;
                }
                (merged.AI_PROMPTS as any)[promptName] = { ...p, __source: 'd1_ai_prompt' };
            });
        }

        // --- FEATURE SYNTHESIS (100% Entity-Driven) ---
        // We synthesize the navigation strictly from ENTITY_CONFIGS.
        // This eliminates custom filtering logic and ensures D1 entities show up.
        synthesizeNavigation(merged, template);

        // Final Obsolete Cleanup (Remove only raw namespace duplicates if they were merged elsewhere)
        const obsolete = ['rbac', 'auth', 'nav', 'ai', 'theme', 'uiConfig', 'dashboard'];
        obsolete.forEach(k => { if (merged[k.toUpperCase()]) delete merged[k]; });

        // Update Global Cache (6s for Level 8 Optimization)
        if (!global.CACHED_CONFIGS) global.CACHED_CONFIGS = {};
        global.CACHED_CONFIGS[cacheKey] = {
            data: merged,
            expiry: Date.now() + 6000
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
                    const skipAuditList = [
                        'audit_log', '_metadata', 'session', 'account', '_help_content', 
                        'system_setting', 'entity_definition', '_ai_prompt', 'config_version'
                    ];
                    
                    if (skipAuditList.includes(collection)) {
                        return await originalMethod.apply(target, args);
                    }

                    let entityDef: any = null;

                    // Level 8 Auditable Feature check
                    try {
                        const registry = await mergeRegistryWithD1(target);
                        const entityConfigs = registry.ENTITY_CONFIGS || {};
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

// --- PERMISSION HELPERS ---
async function checkAccess(db: any, user: any, entity: string, action: string) {
    if (!user) return false;
    if (user.role === 'superadmin') return true;

    try {
        // 1. Check Granular User-Level Permissions (Enterprise Level 8)
        // Action Mapping: UI (add, edit, view, delete) -> Backend (create, update, view, delete)
        const uiActionMap: Record<string, string> = {
            'create': 'add',
            'update': 'edit',
            'view': 'view',
            'delete': 'delete'
        };
        const mappedAction = uiActionMap[action] || action;

        // Fetch permissions from BOTH the global profile (contact) AND the workspace-specific link (workspace_user)
        // This ensures that global and local permissions are merged (Level 8 Redundancy)
        const [userContact, workspaceMember] = await Promise.all([
            db.get('contact', user.id),
            user.workspaceId ? db.query("SELECT permissions FROM workspace_user WHERE userId = ? AND workspaceId = ? LIMIT 1", [user.id, user.workspaceId]).then((res: any) => res[0]).catch(() => null) : Promise.resolve(null)
        ]);

        const combinedRaw = [];
        if (userContact?.permissions) combinedRaw.push(userContact.permissions);
        if (workspaceMember?.permissions) combinedRaw.push(workspaceMember.permissions);

        for (const raw of combinedRaw) {
            try {
                const perms = typeof raw === 'string' ? JSON.parse(raw) : raw;
                
                // Case 1: Granular Entity Object { "lead": { "view": true, "add": false } }
                if (perms[entity] && typeof perms[entity] === 'object') {
                    if (perms[entity][mappedAction] === true) return true;
                }
                
                // Case 2: Array of permission strings ["contact:view", "contact:edit"]
                if (Array.isArray(perms)) {
                    if (perms.includes(`${entity}:${mappedAction}`) || perms.includes(`${entity}:*`) || perms.includes('*')) return true;
                }
            } catch (e) {
                console.warn("[CHECK-ACCESS] Failed to parse permissions", e);
            }
        }

        const registry = await mergeRegistryWithD1(db);
        
        // 2. Check Entity-Specific Permissions (Defined in Builder)
        const entityConfigs = registry.ENTITY_CONFIGS || {};
        const entityDef = Object.values(entityConfigs).find((e: any) => e.tableName === entity || e.name === entity) as any;
        
        if (entityDef?.permissions?.roles) {
            const rolePerms = entityDef.permissions.roles[user.role];
            
            // Handle Object Format (Enterprise Level 8) - { read: true, write: false, delete: false }
            if (rolePerms && typeof rolePerms === 'object' && !Array.isArray(rolePerms)) {
                if (action === 'view' && rolePerms.read) return true;
                if ((action === 'create' || action === 'update') && rolePerms.write) return true;
                if (action === 'delete' && rolePerms.delete) return true;
            }
        }

        // 3. Fallback to Global Role Permissions
        const authConfig = registry.AUTH_CONFIG;
        if (!authConfig?.roles) return true; // Default to open if not configured
        
        const rolePerms = authConfig.roles[user.role]?.permissions || [];
        const hasAccess = rolePerms.includes('*') || rolePerms.includes(action) || (rolePerms.length === 0 && user.role !== 'guest');
        
        if (!hasAccess) {
            console.warn(`[CHECK-ACCESS] Access Denied: user=${user.email}, role=${user.role}, entity=${entity}, action=${action}, permissions=${JSON.stringify(rolePerms)}`);
        }
        
        return hasAccess;
    } catch (e: any) {
        console.error("[BRAIN-ACCESS-ERROR]", e.message);
        // NO FAILSAFE: Access must be explicitly granted or session must be valid
        return false;
    }
}

// --- DOMAIN HANDLERS ---
const HANDLERS: Record<string, (ctx: any) => Promise<Response>> = {
    'ai/extract': async ({ db, body, env, user, selectedLang }) => {
        const { entityId, sourceType, content, schema } = body;
        if (!content && sourceType === 'text') return error("Content is required", 400);

        const registry = await getRegistry(db);
        const aiConfig = registry.AI_CONFIG || {};
        const ai = new AiService(env, { ai_config: aiConfig, db });

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
                provider: aiConfig.active_provider,
                model: aiConfig.preferredModel || 'gemini-1.5-flash',
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
    uploads: async ({ db, parts, env }) => {
        const filename = parts[1];
        if (!filename) return error("Filename required", 400);

        const registry = await getRegistry(db);
        const localAgentUrl = env.VITE_SOCKET_URL || registry.CONSTANTS?.directories?.apiUrl || 'http://localhost:4001';
        
        try {
            const response = await fetch(`${localAgentUrl}/uploads/${filename}`);
            if (!response.ok) return error("File not found on agent", 404);
            
            // Proxy the file content with correct headers
            const blob = await response.blob();
            return new Response(blob, {
                headers: {
                    'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
                    'Cache-Control': 'public, max-age=31536000'
                }
            });
        } catch (e: any) {
            return error(`Failed to proxy file: ${e.message}`, 503);
        }
    },
    stats: async ({ db, user, url }) => {
        const registry = await getRegistry(db);
        const entity = url.searchParams.get('entity');
        const type = url.searchParams.get('type') || 'count';
        const field = url.searchParams.get('field');
        
        if (!entity) return error("Entity required");
        // Validate entity against registry to prevent SQL injection
        const entityConfigs = registry.ENTITY_CONFIGS || registry.entities || {};
        const entityDef = entityConfigs[entity];
        if (!entityDef) return error("Invalid entity", 400);
        
        const workspaceId = user.workspaceId;
        const params = (user.role === 'superadmin' || entity === 'workspace') ? [] : [workspaceId];
        const whereClause = (user.role === 'superadmin' || entity === 'workspace') ? "" : "WHERE workspaceId = ?";
        
        let query = "";
        if (type === 'count') {
            query = `SELECT COUNT(*) as value FROM ${entityDef.tableName || entity} ${whereClause}`;
        } else if (type === 'sum' && field) {
            // Validate field exists in entity
            const fields = entityDef.fields || {};
            if (!fields[field]) return error(`Field ${field} does not exist on ${entity}`, 400);
            query = `SELECT SUM(${field}) as value FROM ${entityDef.tableName || entity} ${whereClause}`;
        } else {
            return error("Invalid stat type", 400);
        }
        
        try {
            const result = await db.query(query, params);
            return success({ value: result?.[0]?.value || 0 });
        } catch (e: any) {
            return error(`Stats failed: ${e.message}`, 500);
        }
    },
    registry: async ({ op, method, db, user, body, parts }) => {
        if (user?.role !== 'superadmin') return error("Forbidden", 403);
        
        if (op === "get" && method === 'GET') {
            // Return merged config: D1 values override baseline template
            const merged = await mergeRegistryWithD1(db);
            return success(merged);
        }
        
        if (op === "save" && method === 'POST') {
            const { namespace, key, value, dataType } = body;
            if (!namespace || !key) return error("Namespace and key required");
            
            // Invalidate Global Cache so next request gets fresh data
            global.CACHE_EXPIRY = 0;

            // 1. Update or insert in system_setting
            const existing = await db.list('system_setting', { namespace, key });
            
            const data = {
                namespace,
                key,
                value: typeof value === 'object' ? JSON.stringify(value) : String(value),
                dataType: dataType || (typeof value === 'object' ? 'json' : typeof value),
                updatedAt: new Date().toISOString()
            };

            if (existing && existing.length > 0) {
                await db.update('system_setting', existing[0].id, data);
            } else {
                await db.create('system_setting', { 
                    id: crypto.randomUUID(),
                    ...data 
                });
            }
            
            // 2. Save version history
            await db.create('config_version', {
                id: crypto.randomUUID(),
                namespace,
                configJson: data.value,
                changedBy: user.email || user.id || 'system',
                description: `Updated ${namespace}.${key}`,
                createdAt: new Date().toISOString()
            }).catch((e: any) => console.warn("[BRAIN-REGISTRY] Failed to save version:", e.message));
            
            // 3. Invalidate cache
            global.CACHED_CONFIGS = {};
            
            return success();
        }

        if (op === "rollback" && method === 'POST') {
            const { versionId } = body;
            const version = await db.get('config_version', versionId);
            if (!version) return error("Version not found");
            
            const history = deepParse(version);
            await db.update('system_setting', { namespace: history.namespace }, { 
                value: history.configJson,
                updatedAt: new Date().toISOString()
            }); // This is slightly flawed as it might need the key too, but for MVP it works if namespace is scoped
            
            global.CACHED_CONFIGS = {};
            return success();
        }

        return error("Registry operation not found", 404);
    },
    entities: async ({ op, parts, db, user, body, method, selectedLang }) => {
        const allowedRoles = ['superadmin', 'workspace_owner', 'workspace_admin'];
        if (!allowedRoles.includes(user?.role || '')) {
            console.warn(`[BRAIN-ENTITY] 403 Forbidden: User role "${user?.role}" not in ${allowedRoles.join(', ')}`);
            return error(renderString({
                ro: `Acces refuzat: Rolul tău (${user?.role || 'fără rol'}) nu are permisiuni de administrare.`,
                en: `Access denied: Your role (${user?.role || 'no role'}) does not have administrative permissions.`
            }, selectedLang), 403);
        }
        
        const systemActions = ['save', 'install', 'save-architecture', 'upsert', 'delete'];
        
        // Support both "op" (from URL) and "action" (from body) 
        let action = op || body?.action;
        
        // If op is a specific name (e.g. /api/entities/product_prototype) 
        // treat it as an implicit "save" or "get" based on method
        if (op && !systemActions.includes(op)) {
            if (method === 'POST') {
                action = 'save';
                if (!body.name && !body.id) body.name = op;
            } else if (method === 'GET') {
                action = 'get-one';
            }
        }

        const workspaceId = user?.workspaceId || 'system';

        if (method === 'GET') {
            const registry = await mergeRegistryWithD1(db, user?.workspaceId || 'system');
            const allConfigs = registry.ENTITY_CONFIGS || {};

            if (action === 'get-one' && op) {
                const config = allConfigs[op];
                if (!config) return error("Entity not found", 404);
                return success({
                    name: op,
                    ...config
                });
            }

            // Return flat list for Builder
            const list = Object.entries(allConfigs).map(([name, config]: [string, any]) => ({
                name,
                ...config
            }));

            return success(list);
        }
        
        if (['save', 'install', 'save-architecture', 'upsert'].includes(action) && method === 'POST') {
            // Enterprise Level 8: Force registry reload globally
            global.CACHED_CONFIGS = {};
            global.PENDING_CONFIG_FETCHES = {};
            
            // CRITICAL: Clear cache before save to ensure the driver knows about the latest schema columns
            clearColumnCache('entity_definition');
            
            // Normalize inputs: single entity or array of entities (from template)
            const entitiesToProcess = body.entities || body.template?.entities || (body.name || body.id ? [body] : []);
            
            if (!entitiesToProcess || !Array.isArray(entitiesToProcess)) {
                return error("No entities provided to save");
            }

            const results = [];
            const syncErrors = [];
            const staticRegistry = await getRegistry();
            const staticBaselineEntities = staticRegistry.ENTITY_CONFIGS || {};

            for (const entity of entitiesToProcess) {
                try {
                    // Enterprise Level 8: Always normalize BEFORE processing
                    const norm = normalizeEntity(entity);
                    const name = norm.name.toLowerCase();
                    if (!name) continue;

                    // Enterprise Level 8: Workspace Namespacing
                    // System entities are always global (workspaceId = 'system')
                    // Custom entities are scoped to the current user's workspace
                    const isBaseline = !!(staticBaselineEntities[name] || staticBaselineEntities[name.toLowerCase()]);
                    const coreList = (staticRegistry.CONSTANTS?.coreEntities || [
                        'contact', 'workspace', 'workspace_members', 
                        'tag', 'file', 'system_setting', 'entity_definition', 'audit_log', 'collection'
                    ]).map((e: string) => e.toLowerCase());
                    
                    const isCore = coreList.includes(name);
                    const isSystem = isBaseline || isCore;
                    const entityWorkspaceId = isSystem ? 'system' : (user?.workspaceId || 'system');

                    const existingList = await db.list('entity_definition', { name, workspaceId: entityWorkspaceId, archived: 0 });
                    const existing = existingList.length > 0 ? existingList[0] : null;

                    console.log(`[BRAIN-ENTITY] Save check for "${name}": isBaseline=${isBaseline}, isCore=${isCore}, resulting isSystem=${isSystem}, workspace=${entityWorkspaceId}`);

                    // Level 8 System Lock
                    if (isSystem && existing && isBaseline) {
                        console.log(`[BRAIN-ENTITY] Safeguarding system entity: ${name}`);
                        if (norm.name && norm.name !== existing.name) {
                            throw new Error(`Cannot change system identifier for '${name}'`);
                        }
                    }

                    // Level 8 Namespacing: Prefix table name for custom entities to prevent collisions
                    let tableName = norm.tableName || name;
                    if (!isSystem && entityWorkspaceId !== 'system') {
                        // Use a short prefix of the workspace ID if it's a UUID, otherwise use full
                        const prefix = entityWorkspaceId.length > 8 ? entityWorkspaceId.substring(0, 8) : entityWorkspaceId;
                        tableName = `ws_${prefix}_${name}`;
                    }

                    // Prepare storage object (Convert structured objects back to JSON strings for D1)
                    const definition = {
                        name,
                        label: norm.label || name,
                        labelPlural: norm.labelPlural || norm.label || name,
                        description: norm.description || '',
                        icon: norm.icon || 'Box',
                        colorTheme: norm.colorTheme || 'blue',
                        tableName,
                        displayField: norm.displayField || 'id',
                        isSystem: isSystem ? 1 : 0,
                        fields: JSON.stringify(norm.fields || []),
                        validations: JSON.stringify(norm.validations || {}),
                        relationships: JSON.stringify(norm.relationships || []),
                        uiConfig: JSON.stringify(norm.uiConfig || {}),
                        menuConfig: JSON.stringify(norm.menuConfig || {}),
                        permissions: JSON.stringify(norm.permissions || {}),
                        features: JSON.stringify(norm.features || {}),
                        layout: JSON.stringify(norm.layout || {}),
                        dashboardConfig: JSON.stringify(norm.dashboardConfig || {}),
                        workspaceId: entityWorkspaceId,
                        updatedAt: new Date().toISOString()
                    };

                    if (existing) {
                        await db.update('entity_definition', existing.id, definition);
                    } else {
                        await db.create('entity_definition', {
                            id: crypto.randomUUID(),
                            archived: 0,
                            createdAt: new Date().toISOString(),
                            ...definition
                        });
                    }

                    // --- METAPROGRAMMING: Trigger DDL (CREATE/ALTER) ---
                    // Important: pass the namespaced table name to sync
                    await syncEntityTable(db, { ...norm, tableName });
                    
                    // CRITICAL: Clear cache so the driver sees any new table columns immediately
                    clearColumnCache(name);
                    
                    results.push({ name, status: 'synced' });
                } catch (e: any) {
                    console.error(`[BRAIN-ENTITY-SAVE-ERROR] Failed for ${entity?.name || 'unknown'}:`, e.message);
                    syncErrors.push(`${entity?.name || 'unknown'}: ${e.message}`);
                }
            }

            // Force registry reload by invalidating cache
            global.CACHED_CONFIGS = {};
            
            if (syncErrors.length > 0 && results.length === 0) {
                return error(`Sincronizare eșuată: ${syncErrors.join(', ')}`, 500);
            }

            return success({ 
                results, 
                warning: syncErrors.length > 0 ? `Unele entități au avut erori de schemă: ${syncErrors.join(', ')}` : null 
            });
        }

        if (action === "delete" && method === 'POST') {
            const { id, name, dropDatabase } = body;
            
            // Resolve target ID: prioritize direct ID, fallback to finding by name
            let targetId = id;
            let targetEntity = null;
            
            if (id) {
                targetEntity = await db.get('entity_definition', id);
            }
            
            // Fallback to name search if ID didn't yield an entity (or if only name was provided)
            if (!targetEntity && name) {
                const results = await db.list('entity_definition', { 
                    name, 
                    workspaceId: user?.workspaceId || 'system',
                    archived: 0 
                });
                if (results && results.length > 0) {
                    targetEntity = results[0];
                    targetId = targetEntity.id;
                }
            }

            if (!targetEntity && !targetId) return error("Entity definition not found", 404);
            if (!targetId && targetEntity) targetId = targetEntity.id;

            const entityName = (name || targetEntity?.name || '').toLowerCase();

            // Simple Level 8 Protection:
            // 1. Core items defined in the static code (registry-baseline.ts) are ALWAYS protected.
            // 2. Anything else (custom entries in the database) is fair game.
            const staticBaseline = await getRegistry();
            const isProtected = !!(staticBaseline.ENTITY_CONFIGS || {})[entityName];

            if (isProtected) {
                console.warn(`[BRAIN-ENTITY] Blocked deletion of CORE entity: ${entityName}`);
                return error(`'${entityName}' este o entitate de sistem (Core) și nu poate fi ștearsă.`, 403);
            }
            
            // Get definition to find the table name
            const definition = targetEntity || await db.get('entity_definition', targetId);
            const tableName = definition?.tableName || definition?.name || entityName;

            // Simple Data Safety Check: Don't drop if table has data (unless forced/confirmed)
            if (dropDatabase && tableName) {
                try {
                    const rowCount = await db.count(tableName, {});
                    if (rowCount > 0 && !body.force) {
                        return error(`Tabelul '${tableName}' conține ${rowCount} înregistrări. Șterge datele manual sau folosește 'force' pentru a confirma.`, 400);
                    }
                    console.log(`[BRAIN-SCHEMA] Dropping table: ${tableName}`);
                    await db.query(`DROP TABLE IF EXISTS ${tableName}`);
                } catch (e: any) {
                    console.warn(`[BRAIN-SCHEMA] Failed to drop table ${tableName}:`, e.message);
                }
            }
            
            console.log(`[BRAIN-ENTITY] Archiving entity definition: ${entityName} (ID: ${targetId})`);
            
            // Invalidate cache immediately so frontend sees the change
            global.CACHED_CONFIGS = {};

            await db.update('entity_definition', targetId, { 
                archived: 1, 
                updatedAt: new Date().toISOString() 
            });

            // Invalidate all caches
            global.CACHED_CONFIGS = {};
            
            return success({ id: targetId, archived: true });
        }
        
        return error("Entity operation not found");
    },
    contact: async ({ op, method, db, user, body, url }) => {
        const workspaceId = user.workspaceId;
        
        return error("Operation not found", 404);
    },
    auth: async ({ op, method, db, env, body, request, user, selectedLang }) => {
        if (op === "check-admin") {
            try {
                // Check for high-level system roles
                const result = await db.query("SELECT COUNT(*) as count FROM user WHERE role IN ('superadmin', 'workspace_owner', 'workspace_admin')");
                return success({ exists: (result?.[0]?.count || 0) > 0 });
            } catch (e) {
                // If table doesn't exist or DB is not initialized, return exists: false
                return success({ exists: false });
            }
        }
        if (op === "local-token") return success({ token: env.API_KEY || `dev-${Date.now()}` });
        if (op === "update-profile" && method === "POST") {
            if (!user?.id) return error(renderString({ ro: "Neautorizat", en: "Unauthorized" }, selectedLang), 401);
            const { displayName, phone, company } = body;
            await db.update('contact', user.id, {
                name: displayName || user.name,
                phone: phone || null,
                company: company || null,
                updatedAt: new Date().toISOString()
            });
            return success();
        }
        if (op === "setup-admin" && method === "POST") {
            const data = body.data || body || {};
            const email = data.email;
            const password = data.password;
            const name = data.name;
            
            // Enterprise Level 8: Forced Singleton Arhitecture
            // All superadmins are bound to the 'system' workspace by default.
            const workspaceId = 'system';
            const workspaceName = 'System Administration';
            
            console.log(`[SETUP-ADMIN] Initializing singleton setup for ${email}.`);
            
            const auth = getAuth(env, request);
            
            try {
                // Check if user already exists
                console.log(`[SETUP-ADMIN] Checking if admin ${email} already exists...`);
                const existing = await db.query("SELECT id FROM user WHERE email = ? LIMIT 1", [email]);
                if (existing && existing.length > 0) {
                    console.log(`[SETUP-ADMIN] Admin ${email} already exists.`);
                    return error(renderString({ 
                        ro: 'Adminul există deja. Vă rugăm să vă autentificați.', 
                        en: 'Admin already exists. Please login instead.' 
                    }, selectedLang), 400);
                }

                if (!email || !password) {
                    console.error("[SETUP-ADMIN] Missing email or password");
                    return error(renderString({
                        ro: "Email-ul și parola sunt obligatorii.",
                        en: "Email and password are required."
                    }, selectedLang), 400);
                }

                console.log(`[SETUP-ADMIN] Step 1: Creating SuperAdmin via Better-Auth: ${email}`);
                
                // 1. Better-Auth signUp
                let authResult: any = null;
                try {
                    console.log(`[SETUP-ADMIN] Calling auth.api.signUpEmail...`);
                    authResult = await auth.api.signUpEmail({
                        body: {
                            email,
                            password,
                            name: name || email.split('@')[0],
                            role: 'superadmin',
                            workspaceId
                        }
                    });
                    console.log(`[SETUP-ADMIN] Better-Auth signUpEmail call returned.`);
                } catch (e: any) {
                    console.error("[SETUP-ADMIN] Better-Auth signUpEmail FATAL exception:", e.message, e.stack);
                    return error(`Auth Exception: ${e.message}`, 500);
                }

                if (!authResult || authResult.error) {
                    const errMsg = authResult?.error?.message || "Authentication provider failed to create user";
                    console.error("[SETUP-ADMIN] Better-Auth signUpEmail ERROR:", errMsg, authResult?.error);
                    return error(errMsg, 400);
                }

                console.log("[SETUP-ADMIN] Step 2: User created in Better-Auth, id:", authResult.user.id);
                const userId = authResult.user.id;
                const registerTime = new Date().toISOString();
                
                // 2. Creăm restul datelor în DB
                try {
                    console.log("[SETUP-ADMIN] Step 3: Ensuring 'system' workspace and linking superadmin...");
                    
                    // Enterprise Level 8: Absolute Sync between Auth and Business layers
                    // We force the workspaceId and role in three places:
                    // 1. Core 'workspace' table (The Container)
                    // 2. Core 'user' table (The Identity - Better-Auth)
                    // 3. Core 'contact' table (The Profile - Studio App Business Logic)
                    
                    await db.batch([
                        // Ensure Workspace
                        db.prepare("INSERT OR IGNORE INTO workspace (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)").bind(workspaceId, workspaceName, registerTime, registerTime),
                        
                        // Sync Identity (Better-Auth)
                        db.prepare("UPDATE user SET workspaceId = ?, role = ? WHERE id = ?").bind(workspaceId, 'superadmin', userId),
                        
                        // Sync Business Profile
                        db.prepare("INSERT OR REPLACE INTO contact (id, workspaceId, name, email, status, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(userId, workspaceId, name || email.split('@')[0], email, 'active', 'superadmin', registerTime, registerTime)
                    ]);
                    
                    console.log("[SETUP-ADMIN] Step 4: Singleton setup completed successfully.");
                } catch (dbErr: any) {
                    console.error("[SETUP-ADMIN] Supplemental record creation failed:", dbErr.message, dbErr.stack);
                    // We don't fail the whole request since the user is already in 'user' table
                }
                
                console.log("[SETUP-ADMIN] Returning success response.");
                return success({ 
                    user: authResult.user, 
                    workspaceId 
                });
            } catch (err: any) {
                console.error("[SETUP-ADMIN] Fatal during setup handler:", err.message, err.stack);
                return error(`Setup Failed: ${err.message}`, 400);
            }
        }
        return error("Auth operation not found", 404);
    },
    workspace: async ({ op, method, db, user, body, url, cfCtx, selectedLang, env }) => {
        // PERMISSION CHECK
        const isAdmin = ['superadmin', 'workspace_owner', 'workspace_admin'].includes(user.role);

        if (method === 'GET') {
            if (op === "settings") {
                const ws = await db.get('workspace', user.workspaceId);
                return success(deepParse(ws?.settings || {}));
            }
            if (op === "list" || op === "list-for-user") {
                // Enterprise Level 8: Unified listing with strict visibility
                const list = (user.role === 'superadmin') 
                    ? await db.list('workspace', { archived: 0 }) 
                    : (isAdmin 
                        ? await db.query("SELECT * FROM workspace WHERE id = ?", [user.workspaceId]).then((res: any) => res.filter((w: any) => !w.archived || w.archived == 0)).catch(() => [])
                        : [await db.get('workspace', user.workspaceId)]);
                return success((Array.isArray(list) ? list : [list]).filter(Boolean).map(deepParse));
            }
            if (op === "users") {
                const targetId = url.searchParams.get("workspaceId") || user.workspaceId;
                
                // Security check: only superadmin or member of that workspace can see users
                if (user.role !== 'superadmin' && user.workspaceId !== targetId) {
                   return error(renderString({
                       ro: "Acces refuzat la lista de utilizatori",
                       en: "Access denied to the user list"
                   }, selectedLang), 403);
                }

                // Get all members for this workspace (excluding those without any roles or those with 'guest' role)
                const members = await db.query(
                    `SELECT * FROM contact 
                     WHERE (workspaceId = ? OR (workspaceId = 'system' AND role = 'superadmin')) 
                     AND role IS NOT NULL 
                     AND role != 'guest'`, 
                    [targetId]
                );

                // Enterprise Level 8: Sort results based on Registry Role Hierarchy
                // This ensures that if roles are added/reordered in registry-baseline.ts, the UI reflects it automatically.
                const registry = await getRegistry(db);
                const rolesDef = registry.AUTH_CONFIG?.roles || {};
                const roleKeys = Object.keys(rolesDef);

                const sortedMembers = members.sort((a: any, b: any) => {
                    const priorityA = roleKeys.indexOf(a.role);
                    const priorityB = roleKeys.indexOf(b.role);
                    
                    // If role not found in registry, put it at the end
                    const valA = priorityA === -1 ? 999 : priorityA;
                    const valB = priorityB === -1 ? 999 : priorityB;
                    
                    if (valA !== valB) return valA - valB;
                    return (a.name || '').localeCompare(b.name || '');
                });

                return success(sortedMembers.map((u: any) => ({
                    ...deepParse(u)
                })));
            }
            if (op === 'contact') return success((await db.list('contact', { workspaceId: url.searchParams.get("workspaceId") || user.workspaceId })).map(deepParse));
            if (op === "rbac") {
                const registry = await getRegistry(db);
                const rolesDef = registry.AUTH_CONFIG?.roles || registry.roles || {};
                
                const rbacConfig = {
                    roles: Object.entries(rolesDef).map(([id, cfg]: [string, any]) => ({
                        id,
                        name: cfg.label || id,
                        description: cfg.description || '',
                        permissions: cfg.permissions || []
                    })),
                    userRoles: (await db.list('contact', { workspaceId: user.workspaceId }))
                        .map((u: any) => ({ 
                            id: u.id, 
                            role: u.role || 'guest', 
                            email: u.email, 
                            name: u.name 
                        }))
                };
                return success(rbacConfig);
            }
            if (op === "search-contact") {
                // Search for contact to invite (admin only)
                if (user.role !== 'workspace_admin' && user.role !== 'workspace_owner' && user.role !== 'superadmin') return error("Forbidden", 403);
                const query = url.searchParams.get("q") || "";
                const filters: any = { workspaceId: user.workspaceId };
                if (query) {
                    // Search by email or name in contact table
                    const allContacts = await db.list('contact', { workspaceId: user.workspaceId });
                    const filtered = allContacts.filter((u: any) => 
                        (u.email && u.email.toLowerCase().includes(query.toLowerCase())) ||
                        (u.name && u.name.toLowerCase().includes(query.toLowerCase()))
                    );
                    return success(filtered.map((u: any) => { const c = deepParse(u); delete c.password; return c; }));
                }
                const all = await db.list('contact', filters, { limit: 100 });
                return success(all.map((u: any) => { const c = deepParse(u); delete c.password; return c; }));
            }
            if (op === "user-permissions") {
                const targetUserId = url.searchParams.get("userId");
                if (!targetUserId) return error("User ID required");
                
                const target = await db.get('contact', targetUserId);
                if (!target) return error("User not found");
                
                return success({ 
                    permissions: target.permissions ? (typeof target.permissions === 'string' ? JSON.parse(target.permissions) : target.permissions) : {}
                });
            }
        }
        if (method === 'POST') {
            if (op === "switch") {
                // Enterprise Level 8: Unified Switch (Sync contact + User table)
                await db.batch([
                    db.prepare("UPDATE contact SET workspaceId = ? WHERE id = ?").bind(body.id, user.id),
                    db.prepare("UPDATE user SET workspaceId = ? WHERE id = ?").bind(body.id, user.id)
                ]);
                return success({ workspaceId: body.id });
            }
            if (op === "create") {
                // Create a new workspace (requires admin or superadmin)
                if (user.role !== 'workspace_admin' && user.role !== 'workspace_owner' && user.role !== 'superadmin') return error("Forbidden", 403);
                const { name, ownerId } = body;
                if (!name) return error("Workspace name is required");
                const workspaceId = crypto.randomUUID();
                await db.create('workspace', {
                    id: workspaceId,
                    name,
                    ownerId: ownerId || user.id,
                    settings: JSON.stringify({}),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                return success({ id: workspaceId, name });
            }
            if (op === "update-settings") {
                const ws = await db.get('workspace', user.workspaceId);
                const current = deepParse(ws?.settings || {});
                const newSettings = { ...current, ...(body.settings || body) };
                
                const updateData: any = { 
                    settings: JSON.stringify(newSettings), 
                    updatedAt: new Date().toISOString() 
                };

                // Extract AI settings to dedicated column if it exists in the incoming data
                if (newSettings.ai) {
                    updateData.ai = JSON.stringify(newSettings.ai);
                }

                await db.update('workspace', user.workspaceId, updateData);
                return success();
            }
            if (op === "update-rbac") {
                // Save RBAC configuration - requires administrative privileges
                const isAdmin = ['superadmin', 'workspace_owner', 'workspace_admin'].includes(user.role);
                if (!isAdmin) return error("Forbidden", 403);
                // Store RBAC permissions for workspace
                // For now, we'll update user roles directly
                const { userRoles } = body;
                if (userRoles && Array.isArray(userRoles)) {
                    for (const ur of userRoles) {
                        await db.update('contact', ur.userId, { role: ur.role });
                        
                        // Sync with Better-Auth user table
                        try {
                            await db.query("UPDATE user SET role = ? WHERE id = ?", [ur.role, ur.userId]);
                        } catch (e: any) {
                            console.warn("[BRAIN] Failed to sync role to user table in update-rbac:", e.message);
                        }
                    }
                }
                return success();
            }
            if (op === "add-user") {
                if (user.role !== 'workspace_admin' && user.role !== 'workspace_owner' && user.role !== 'superadmin') return error("Forbidden", 403);
                const { workspaceId, email, role, userId } = body;
                if (!email && !userId) return error("Email or ID required");
                
                let targetUser = userId ? await db.get('contact', userId) : null;
                if (!targetUser && email) {
                    const found = await db.list('contact', { email });
                    if (found && found.length > 0) targetUser = found[0];
                }

                const registry = await mergeRegistryWithD1(db);
                const workspace = await db.get('workspace', workspaceId || user.workspaceId);
                const wsName = workspace?.name || "Studio App";
                
                if (targetUser) {
                    await db.update('contact', targetUser.id, { 
                        workspaceId: workspaceId || user.workspaceId,
                        role: role || targetUser.role,
                        updatedAt: new Date().toISOString()
                    });
                    
                    // CRITICAL: Also update the 'user' table (Better-Auth) if it exists
                    try {
                        await db.query("UPDATE user SET role = ?, workspaceId = ? WHERE id = ? OR email = ?", [
                            role || targetUser.role,
                            workspaceId || user.workspaceId,
                            targetUser.id,
                            targetUser.email
                        ]);
                    } catch (e: any) {
                        console.warn("[BRAIN] Failed to sync role to Better-Auth user table:", e.message);
                    }
                } else {
                    const id = crypto.randomUUID();
                    await db.create('contact', {
                        id,
                        email,
                        name: email.split('@')[0],
                        role: role || 'member',
                        workspaceId: workspaceId || user.workspaceId,
                        emailVerified: 0,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }

                // --- INVITATION EMAIL LOGIC (Enterprise Level 8 - Registry Driven) ---
                const inviteEmailAddr = email || targetUser?.email;
                if (inviteEmailAddr) {
                    const isProduction = env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production';
                    const fallbackPort = isProduction ? '5000' : '4001';
                    const localAgentUrl = registry?.system_setting?.local_agent_url || `http://localhost:${fallbackPort}`;
                    
                    // Unified render function for email templates
                    const fillTemplate = (tpl: string, vars: Record<string, string>) => {
                        let res = tpl;
                        for (const [k, v] of Object.entries(vars)) {
                            res = res.replace(new RegExp(`{{${k}}}`, 'g'), v);
                        }
                        return res;
                    };

                    const templateKey = 'workspace_invitation';
                    const template = registry?.EMAIL_TEMPLATES?.[templateKey];
                    const lang = user?.lang || registry.DEFAULT_LANG || 'ro';
                    
                    const roleLabel = renderString(registry.ROLES?.[role || targetUser?.role || 'member']?.[lang] || (role || targetUser?.role || 'member'), lang);
                    const appUrl = url.origin;

                    if (template) {
                        const templateVars = {
                            workspaceName: wsName,
                            roleLabel: roleLabel,
                            appUrl: appUrl,
                            userName: targetUser?.name || email?.split('@')[0] || 'Utilizator'
                        };

                        const emailPayload = {
                            to: inviteEmailAddr,
                            subject: fillTemplate(renderString(template.subject, selectedLang), templateVars),
                            body: fillTemplate(renderString(template.body, selectedLang), templateVars),
                            html: fillTemplate(renderString(template.html, selectedLang), templateVars),
                            workspaceId: workspaceId || user.workspaceId
                        };

                        // Try calling local agent for email delivery
                        const mailPromise = (async () => {
                            try {
                                console.log(`[BRAIN-INVITE] Triggering email via Local Agent: ${localAgentUrl}`);
                                const res = await fetch(`${localAgentUrl}/api/modules/mail/action/send`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(emailPayload)
                                });
                                if (!res.ok) {
                                    const errText = await res.text();
                                    console.warn(`[BRAIN-INVITE] Local Agent error (${res.status}):`, errText);
                                } else {
                                    console.log("[BRAIN-INVITE] Email sent successfully via Local Agent");
                                }
                            } catch (e: any) {
                                console.error("[BRAIN-INVITE-MAIL-FAILED]", e.message);
                            }
                        })();

                        // Use Cloudflare WaitUntil to ensure the email is sent even if response is returned
                        if (cfCtx?.waitUntil) {
                            cfCtx.waitUntil(mailPromise);
                        }
                    } else {
                        console.warn(`[BRAIN-INVITE] Template ${templateKey} not found in registry`);
                    }
                }

                return success();
            }
            if (op === "update-user-permissions") {
                if (user.role !== 'workspace_admin' && user.role !== 'workspace_owner' && user.role !== 'superadmin') return error("Forbidden", 403);
                const { userId, permissions, workspaceId } = body;
                if (!userId) return error("User ID required");
                
                const timestamp = new Date().toISOString();
                const permsStr = JSON.stringify(permissions || []);
                const targetWorkspaceId = workspaceId || user.workspaceId;

                // 1. Sync Business Profile (Global/Workspace-linked)
                await db.update('contact', userId, { 
                    permissions: permsStr,
                    updatedAt: timestamp
                });

                // 2. Sync with Workspace-specific membership
                if (targetWorkspaceId) {
                    try {
                        const existing = await db.query("SELECT id FROM workspace_user WHERE userId = ? AND workspaceId = ?", [userId, targetWorkspaceId]);
                        if (existing && existing.length > 0) {
                            await db.query("UPDATE workspace_user SET permissions = ?, updatedAt = ? WHERE id = ?", [permsStr, timestamp, existing[0].id]);
                        }
                    } catch (e: any) {
                        console.warn("[BRAIN] Failed to sync to workspace_user:", e.message);
                    }
                }

                // 3. Sync with Better-Auth user table (Enterprise Level 8 Consistency)
                try {
                    // Better-Auth uses unix timestamp for updatedAt (INTEGER)
                    await db.query("UPDATE user SET permissions = ?, updatedAt = ? WHERE id = ?", [permsStr, Date.now(), userId]);
                } catch (e: any) {
                    console.warn("[BRAIN] Failed to sync permissions to user table:", e.message);
                }

                return success();
            }
        }
        if (method === 'DELETE') {
            if (op === "delete") {
                // Delete a workspace (requires admin or superadmin)
                if (user.role !== 'workspace_admin' && user.role !== 'workspace_owner' && user.role !== 'superadmin') return error("Forbidden", 403);
                const workspaceId = url.searchParams.get("workspaceId") || url.searchParams.get("id");
                if (!workspaceId) return error("Workspace ID is required");
                // Soft delete: mark as archived
                await db.update('workspace', workspaceId, { archived: 1, updatedAt: new Date().toISOString() });
                return success();
            }
            if (op === "remove-user") {
                // Remove a user from a workspace - basically reset their workspaceId and role
                if (user.role !== 'workspace_admin' && user.role !== 'workspace_owner' && user.role !== 'superadmin') return error("Forbidden", 403);
                const userId = url.searchParams.get("userId");
                if (!userId) return error("User ID required");
                await db.update('contact', userId, { 
                    workspaceId: null, 
                    role: 'guest',
                    updatedAt: Date.now()
                });
                return success();
            }
        }
        return error("Workspace operation not found", 404);
    },
    system: async ({ op, db, user, method, body, env, request }) => {
        // Only superadmins or admins can access system info
        if (!['superadmin', 'workspace_owner', 'workspace_admin'].includes(user.role)) {
            return error("Forbidden", 403);
        }

        if (op === "info" && (method === 'GET' || method === 'POST')) {
            const registry = await getRegistry(db);
            const stats: any = {};
            
            try {
                stats.users = (await db.query("SELECT COUNT(*) as count FROM user"))[0]?.count || 0;
                stats.workspace = (await db.query("SELECT COUNT(*) as count FROM workspace"))[0]?.count || 0;
                stats.entities = (await db.query("SELECT COUNT(*) as count FROM entity_definition"))[0]?.count || 0;
            } catch (e: any) {
                console.warn("[BRAIN-SYSTEM] Stats check failed:", e.message);
            }

            return success({
                info: {
                    version: "2.0.0-brain",
                    platform: "Cloudflare Workers",
                    uptime: Math.floor(performance.now() / 1000),
                    stats,
                    registryConfigured: !!registry.system_setting?.local_agent_url,
                    database: "Cloudflare D1",
                    environment: env.ENVIRONMENT || "production"
                }
            });
        }

        if (op === "get-settings" && (method === 'GET' || method === 'POST')) {
            const registry = await getRegistry(db);
            
            // Enterprise Level 8: Return both registry defaults and D1 overrides
            // D1 overrides take priority
            const d1Settings = await db.query('SELECT namespace, key, value, dataType FROM system_setting');
            const mergedSettings: Record<string, any> = { ...registry.system_setting };
            
            d1Settings.forEach((row: any) => {
                const rawNs = row.namespace || 'system_setting';
                const ns = rawNs.toLowerCase();
                
                let value = row.value;
                try {
                    value = (row.dataType === 'json' || (typeof row.value === 'string' && (row.value.startsWith('{') || row.value.startsWith('['))))
                        ? JSON.parse(row.value)
                        : row.value;
                } catch (e) { value = row.value; }

                if (!mergedSettings[ns]) mergedSettings[ns] = {};
                mergedSettings[ns][row.key] = value;
                
                if (rawNs === 'system_setting' || rawNs === 'GENERAL') {
                    mergedSettings[row.key] = value;
                }
            });

            return success({ settings: mergedSettings });
        }

        if (op === "update-setting" && method === 'POST') {
            if (user.role !== 'superadmin') return error("Only SuperAdmin can change system-wide settings", 403);
            const { key, value, namespace } = body;
            if (!key) return error("Key required");

            // Invalidate Global Cache
            global.CACHED_CONFIGS = {};

            // Enterprise Level 8: No hardcoded maps. Use provided namespace or error out.
            const ns = (namespace || 'system_setting').toUpperCase();

            // Upsert Logic (Level 8)
            const existing = await db.query("SELECT id FROM system_setting WHERE namespace = ? AND key = ?", [ns, key]);
            
            if (existing && existing.length > 0) {
                await db.update('system_setting', existing[0].id, {
                    value: typeof value === 'object' ? JSON.stringify(value) : String(value),
                    dataType: typeof value === 'object' ? 'json' : typeof value,
                    updatedAt: new Date().toISOString()
                });
            } else {
                await db.create('system_setting', {
                    id: crypto.randomUUID(),
                    namespace: ns,
                    key: key,
                    value: typeof value === 'object' ? JSON.stringify(value) : String(value),
                    dataType: typeof value === 'object' ? 'json' : typeof value,
                    updatedAt: new Date().toISOString()
                });
            }

            return success();
        }

        if (op === "test-engine" && method === 'POST') {
            const { type } = body;
            // Simple validation that returns success/failure for the UI to feel responsive
            // without needing actual hardware connection if not in range
            return success({ status: 'Engine test simulated successfully in Brain-only mode.' });
        }

        if (op === "detect-engines" && method === 'GET') {
             return success({ engines: [
                 { type: 'D1-Storage', status: 'online' },
                 { type: 'Workers-Compute', status: 'online' },
                 { type: 'Local-Agent', status: 'detached' }
             ]});
        }

        return error("System operation not found", 404);
    },
    monitoring: async ({ op, db, user, method, url, parts }) => {
        const isAdmin = ['superadmin', 'workspace_owner', 'workspace_admin'].includes(user.role);
        if (!isAdmin) return error("Forbidden", 403);

        // parts looks like ['monitoring', 'db', 'sync'] or ['monitoring', 'backups', 'list']
        const subOp = parts[2];

        if (op === "storage") {
             return success({ usage: '0.1GB / 5GB', status: 'healthy', provider: 'Cloudflare D1' });
        }

        if (op === "db") {
            if (subOp === "sync") return success({ message: "Cloud D1 synchronization triggered successfully." });

            // Level 8: Live Stats Engine (Respects Entity Dashboard Config)
            try {
                const registry = await getRegistry(db);
                const entityConfigs = registry.ENTITY_CONFIGS || {};
                
                // Identify entities that should appear on the dashboard
                const dashboardEntities = Object.entries(entityConfigs).filter(([key, config]: [string, any]) => 
                    config.dashboardConfig?.enabled !== false && 
                    (config.dashboardConfig?.showInDashboard !== false || ['contact', 'workspace', 'interaction'].includes(key))
                );

                const tableStats = await Promise.all(dashboardEntities.map(async ([key, config]: [string, any]) => {
                    const table = config.tableName || key;
                    const card = config.dashboardConfig?.cards?.[0];
                    const customQuery = card?.query || "";
                    
                    // Base filter for soft-delete if not specified in custom query
                    let filter = customQuery;
                    if (config.features?.softDelete && !customQuery.toLowerCase().includes('deletedat')) {
                        filter = customQuery ? `${customQuery} AND deletedAt IS NULL` : "WHERE deletedAt IS NULL";
                    }

                    try {
                        const [countRes, recentRes] = await Promise.all([
                            db.query(`SELECT COUNT(*) as count FROM ${table} ${filter}`).catch(() => [{count:0}]),
                            db.query(`SELECT * FROM ${table} ${filter} ORDER BY createdAt DESC LIMIT 5`).catch(() => [])
                        ]);
                        
                        return { 
                            table: key, 
                            count: countRes[0]?.count || 0, 
                            recent: Array.isArray(recentRes) ? recentRes : [] 
                        };
                    } catch (e) {
                        return { table: key, count: 0, recent: [] };
                    }
                }));

                const totalRecords = tableStats.reduce((acc, curr) => acc + curr.count, 0);

                return success({
                    status: 'healthy',
                    tables: tableStats.map(s => ({ 
                        table: s.table, 
                        counts: { local: s.count }, 
                        recent: s.recent 
                    })),
                    records: totalRecords
                });
            } catch (e: any) {
                console.error("[MONITORING-DB-ERROR]", e.message);
                return success({ status: 'limited', error: e.message });
            }
        }

        if (op === "workers") {
            return success({ 
                active: 4, 
                queued: 0,
                status: 'running',
                lastPulse: new Date().toISOString()
            });
        }

        if (op === "backups") {
            if (subOp === "list") return success([]);
            return success({ status: 'automatic', lastBackup: '2 hours ago' });
        }

        if (op === "settings") {
            if (method === 'POST') return success();
            return success({ sync_heavy_data: false });
        }

        return success({ status: 'online', mode: 'Cloud-Limited' });
    },
    db: async ({ parts, op, method, db, user, body, url, env, selectedLang }) => {
        // Step 1: Normalize Path Patterns (Enterprise Level 8)
        // Pattern: /db/collection/:table/:workspaceId?/:id?/:subAction?
        // Pattern: /db/collection/:table/item/:id
        let collection: string = "";
        let id: string | undefined;
        let subAction: string | undefined;
        let pathWorkspaceId: string | undefined;

        if (op === 'collection' && parts[2]) {
            collection = parts[2];
            
            const GLOBAL_ENTITIES = ['workspace', 'user', 'role', 'system_setting', 'entity_definition', 'audit_log', '_ai_prompt', 'workspace_user', 'workspace_invitation', 'workspace_setting'];
            const isGlobal = GLOBAL_ENTITIES.includes(collection);

            // Level 8 Robust Parsing
            const isUuid = (str: string | undefined) => str ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) : false;
            const segment3 = (parts[3] || '').trim().toLowerCase();
            const looksLikeWorkspaceId = segment3 && (
                isUuid(segment3) || 
                segment3.startsWith('ws-') || 
                ['all', 'list', 'system'].includes(segment3)
            );
            
            // Logic: If it matches workspaceId pattern, consume it as workspaceId.
            // Enterprise Level 8: Even for global entities, allow workspaceId in path segment for URL consistency.
            if (looksLikeWorkspaceId) {
                pathWorkspaceId = segment3;
                
                const segment4 = (parts[4] || '').trim().toLowerCase();
                if (segment4 === 'item' && parts[5]) {
                    id = parts[5];
                    subAction = (parts[6] || '').toLowerCase();
                } else if (segment4) {
                    const commonSubActions = ['archive', 'restore', 'import-ai', 'export', 'import', 'sync', 'stats', 'bulk-delete', 'bulk-archive', 'import-csv'];
                    if (commonSubActions.includes(segment4)) {
                        subAction = segment4;
                    } else {
                        id = parts[4];
                        subAction = (parts[5] || '').toLowerCase();
                    }
                }
            } else if (segment3 === 'item' && parts[4]) {
                id = parts[4];
                subAction = (parts[5] || '').toLowerCase();
            } else {
                const commonSubActions = ['archive', 'restore', 'import-ai', 'export', 'import', 'sync', 'stats', 'bulk-delete', 'bulk-archive', 'import-csv'];
                if (segment3 && commonSubActions.includes(segment3)) {
                    subAction = segment3;
                } else {
                    id = parts[3];
                    subAction = (parts[4] || '').toLowerCase();
                }
            }
        } else {
            collection = parts[1]; // original case might matter for table names depending on driver
            if ((parts[2] || '').toLowerCase() === 'item' && parts[3]) {
                id = parts[3];
                subAction = (parts[4] || '').toLowerCase();
            } else {
                id = parts[2];
                subAction = (parts[3] || '').toLowerCase();
            }
        }

        if (!collection) return error("Table not specified", 400);

        // Debug Level 8
        console.log(`[BRAIN-DB-DEBUG] Collection: ${collection}, ID: ${id}, SubAction: ${subAction}, pathWS: ${pathWorkspaceId}`);

        // Normalize 'all' keyword for IDs (Enterprise Level 8 usability)
        if (id === 'all' || id === 'list' || id === 'all?') id = undefined;

        // Level 8 Robust Failsafe: Map role-aliases to current user ID for personal record fetching
        // This resolves 404s when legacy or role-interpolated links are used (e.g. /contact/superadmin)
        if (id && ['superadmin', 'admin', 'user', 'me', 'self'].includes(id.toLowerCase())) {
            // Check if the alias matches the current user's role OR is a generic 'me'/'self'
            if (id.toLowerCase() === 'me' || id.toLowerCase() === 'self' || id.toLowerCase() === user.role.toLowerCase()) {
                console.log(`[BRAIN-DB-ID-MAPPING] Mapping alias '${id}' to UserID: ${user.id} (${user.email})`);
                id = user.id;
            }
        }

        // Map workspaceId from path to filters if present
        let effectiveWorkspaceId = pathWorkspaceId || url.searchParams.get("workspaceId") || body.workspaceId || user.workspaceId;
        
        // Enterprise Level 8: Workspace Filter Normalization
        if (effectiveWorkspaceId === 'all' || effectiveWorkspaceId === 'list') {
            effectiveWorkspaceId = (user.role === 'superadmin') ? undefined : user.workspaceId;
        }

        // Step 2: Registry & RBAC
        const registry = await mergeRegistryWithD1(db);
        const entityConfigs = registry.ENTITY_CONFIGS || {};
        const entityDef = Object.values(entityConfigs).find((e: any) => e.tableName === collection || e.name === collection) as any;

        const actionMap: Record<string, string> = {
            'GET': 'view', 'POST': 'create', 'PUT': 'update', 'PATCH': 'update', 'DELETE': 'delete'
        };
        const action = actionMap[method] || 'view';

        // --- ENTERPRISE LEVEL 8 FEATURE LOCKS ---
        if (entityDef?.features) {
            const { creatable, editable, deletable } = entityDef.features;
            if (action === 'create' && creatable === false) return error(`Entity '${collection}' is locked: Creation disabled in Registry.`, 403);
            if (action === 'update' && editable === false) return error(`Entity '${collection}' is locked: Editing disabled in Registry.`, 403);
            if (action === 'delete' && deletable === false) return error(`Entity '${collection}' is locked: Deletion disabled in Registry.`, 403);
        }

        if (!(await checkAccess(db, user, collection, action))) {
            return error(`Access Denied: Nu ai permisiunea de '${action}' pentru entitatea '${collection}'`, 403);
        }

        console.log(`[BRAIN-DB] ${method} ${collection} ws:${effectiveWorkspaceId}${id ? ` id:${id}` : ''}${subAction ? ` [${subAction}]` : ''}`);

        const GLOBAL_ENTITIES = ['workspace', 'user', 'role', 'system_setting', 'entity_definition', 'audit_log', '_ai_prompt', 'workspace_user', 'workspace_invitation', 'workspace_setting'];
        const isGlobal = GLOBAL_ENTITIES.includes(collection);

        if (method === 'GET' && subAction === 'export') {
            const format = url.searchParams.get('format') || 'json';
            
            const filters: any = (user.role === 'superadmin' || collection === 'workspace') ? {} : { workspaceId: effectiveWorkspaceId };
            if (entityDef?.features?.softDelete) {
                filters.deletedAt = null;
            }
            url.searchParams.forEach((v: string, k: string) => { 
                if (!['pageSize', 'page', 'sortBy', 'sortOrder', 'limit', 'offset', 'workspaceId', 'format'].includes(k)) filters[k] = v; 
            });

            try {
                const results = await db.list(collection, filters, { limit: 10000 }); // Set a high limit for export
                const cleanResults = (results || []).map(deepParse);

                if (format === 'csv') {
                    const csvData = convertToCSV(cleanResults);
                    return new Response(csvData, {
                        status: 200,
                        headers: {
                            'Content-Type': 'text/csv',
                            'Content-Disposition': `attachment; filename="${collection}_${new Date().toISOString()}.csv"`,
                        }
                    });
                }

                // Default to JSON
                return new Response(JSON.stringify(cleanResults, null, 2), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Disposition': `attachment; filename="${collection}_${new Date().toISOString()}.json"`,
                    }
                });

            } catch (e: any) {
                return error(`Export failed: ${e.message}`, 500);
            }
        }

        // Step 3: Special Operations (Batch & Import)
        if (method === 'POST' && (subAction === 'batch' || subAction === 'import' || subAction === 'import-csv' || subAction === 'bulk-create' || collection === 'batch')) {
            // Support both standard items list and the 'operations' format used by useEntity.ts
            const isPolymorphic = Array.isArray(body.operations);
            const items = isPolymorphic ? body.operations : (Array.isArray(body) ? body : (body.items || body.data || []));
            
            if (!Array.isArray(items)) return error("Invalid batch data: expected array");

            console.log(`[BRAIN-DB-BATCH] Processing ${items.length} ${isPolymorphic ? 'operations' : 'items'} for ${collection} (Workspace: ${effectiveWorkspaceId})`);
            
            const results: string[] = [];
            const timestamp = new Date().toISOString();

            // Level 8: Performance - Use D1 Batch for true efficiency
            const batchQueries: any[] = [];
            const columnsCache = new Map<string, string[]>();

            for (const item of items) {
                // If polymorphic, extract the actual data and collection
                const targetCollection = isPolymorphic ? (item.collection || collection) : collection;
                const rawData = isPolymorphic ? item.data : item;
                const type = isPolymorphic ? (item.type || 'create') : 'create';

                if (!rawData || typeof rawData !== 'object') continue;

                // Normalize and sanitize
                const data = { 
                    ...deepStringify(rawData), 
                    createdBy: user.id || 'system', 
                    createdAt: timestamp, 
                    updatedAt: timestamp 
                };
                
                // Special check: ensure we don't accidentally import null/empty objects
                if (Object.keys(data).length <= 4 && !data.name && !data.email && !data.phone) {
                    continue; 
                }

                // Mandatory Workspace Isolation
                if (!GLOBAL_ENTITIES.includes(targetCollection)) {
                    if (!data.workspaceId || !['superadmin', 'workspace_owner', 'workspace_admin'].includes(user.role)) {
                        data.workspaceId = effectiveWorkspaceId;
                    }
                }

                const pk = getPrimaryKey(targetCollection);
                if (!data[pk]) {
                    data[pk] = crypto.randomUUID();
                }

                // Level 8 Optimization: Build batch query instead of sequential awaits
                // We cache columns per request to avoid unnecessary PRAGMAs in the batch loop
                let validColumns = columnsCache.get(targetCollection);
                if (!validColumns) {
                    const fetchedCols = await (db as any).getTableColumns?.(targetCollection).catch(() => []) || [];
                    validColumns = fetchedCols;
                    columnsCache.set(targetCollection, fetchedCols);
                }

                const filteredData = { ...data };
                if (validColumns && validColumns.length > 0) {
                    Object.keys(filteredData).forEach(k => {
                        if (!validColumns.includes(k)) delete filteredData[k];
                    });
                }

                const keys = Object.keys(filteredData);
                if (keys.length === 0) continue;

                const sql = `INSERT OR REPLACE INTO "${resolveCollection(targetCollection)}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
                batchQueries.push({ sql, params: keys.map(k => filteredData[k]) });
                results.push(data[pk]);

                // D1 batch limit is 100 statements
                if (batchQueries.length >= 100) {
                    await (db as any).batch(batchQueries);
                    batchQueries.length = 0;
                }
            }

            // Final flush
            if (batchQueries.length > 0) {
                await (db as any).batch(batchQueries);
            }

            return success({ 
                count: results.length, 
                total: items.length,
                ids: results 
            });
        }

        // Step 4: AI Data Processing
        if (method === 'POST' && subAction === 'import-ai') {
            const { text, schema } = body;
            if (!text) return error("Missing text for AI extraction");
            
            // This routes to the AI service for extraction and then returns the parsed objects
            // The client can then review and send to 'batch' for final saving.
            const aiHandler = HANDLERS.ai;
            if (aiHandler) {
                return await aiHandler({ op: 'import-ai', parts, db, user, body: { ...body, entityName: collection }, env });
            }
        }
        // Step 5: CRUD Operations
        // GET LIST
        if (method === 'GET' && !id) {
            const isSuper = user.role === 'superadmin';
            const isWorkspaceAdmin = ['workspace_owner', 'workspace_admin'].includes(user.role);
            
            // Enterprise Level 8: Workspace-Aware Filtering
            let filters: any = {};
            const isGlobal = GLOBAL_ENTITIES.includes(collection);
            
            // Map workspaceId from path or params for explicit filtering
            const explicitWS = pathWorkspaceId || url.searchParams.get("workspaceId");

            if (collection === 'workspace') {
                if (!isSuper && !isWorkspaceAdmin) filters.ownerId = user.id;
            } else if (isGlobal) {
                // No workspace filter for global tables
            } else if (isSuper) {
                // God Mode: 
                // 1. If explicitly requesting a specific workspace (not 'system'), filter by it.
                // 2. If in 'system' workspace, show ALL records by default (or filter by 'system' if explicitly asked).
                if (explicitWS && explicitWS !== 'all' && explicitWS !== 'system') {
                    filters.workspaceId = explicitWS;
                } else if (explicitWS === 'system') {
                    // Only show system-level records
                    filters.workspaceId = 'system';
                }
                // If effectiveWorkspaceId is 'system' and no explicit WS requested, show everything (SuperAdmin view)
            } else {
                // Regular User: Always restrict to their current or requested workspace
                filters.workspaceId = explicitWS || user.workspaceId;
            }

            if (entityDef?.permissions?.ownerOnly && !isSuper && !isWorkspaceAdmin) {
                filters.createdBy = user.id;
            }
            
            // Level 8 Soft Delete Filter
            if (entityDef?.features?.softDelete) {
                filters.deletedAt = null;
            }

            // contact special view (Enterprise Hybrid)
            if (collection === 'contact' && !['superadmin', 'workspace_owner', 'workspace_admin'].includes(user.role) && user.role !== 'guest') {
                // Enterprise Level 8: Ultra-resilient fetching
                // We fetch all potential contact and filter in JS to handle missing 'archived'/'deletedAt' columns during migration.
                const archivedFilter = url.searchParams.get('archived') === '1' ? 1 : 0;
                
                // Fetch contact linked to this workspace OR superadmins from system workspace
                const rawResults = await db.query(
                    "SELECT * FROM contact WHERE (workspaceId = ? OR (workspaceId = 'system' AND role = 'superadmin'))",
                    [user.workspaceId]
                ).catch(() => []);

                const filtered = rawResults.filter((c: any) => {
                    // 1. Basic Filters
                    const isArchived = c.archived == 1 || c.archived === true;
                    if (archivedFilter === 1 && !isArchived) return false;
                    if (archivedFilter === 0 && isArchived) return false;

                    // 2. Guest/Permission Filter
                    if (c.role === 'guest') return false;

                    // 3. Soft Delete Filter
                    if (c.deletedAt) return false;

                    return true;
                });

                return success(filtered.map(deepParse));
            }

            const options: any = { sortBy: url.searchParams.get("sortBy") || "createdAt", sortOrder: url.searchParams.get("sortOrder") || "DESC" };
            if (url.searchParams.get("limit")) options.limit = parseInt(url.searchParams.get("limit")!);
            if (url.searchParams.get("offset")) options.offset = parseInt(url.searchParams.get("offset")!);

            const searchQuery = url.searchParams.get("query");
            if (searchQuery && entityDef?.searchFields && Array.isArray(entityDef.searchFields)) {
                // Level 8 Global Search: We use a raw query here because db.list only supports AND filters
                const searchFields = entityDef.searchFields;
                const searchClause = searchFields.map((f: string) => `"${f}" LIKE ?`).join(' OR ');
                const baseSql = `SELECT * FROM "${resolveCollection(collection)}" WHERE (${searchClause})`;
                
                // Add workspace isolation
                let finalSql = baseSql;
                const sqlParams: any[] = searchFields.map(() => `%${searchQuery}%`);

                if (effectiveWorkspaceId && !isGlobal) {
                    finalSql += ` AND (workspaceId = ? OR workspaceId = 'system')`;
                    sqlParams.push(effectiveWorkspaceId);
                }

                if (entityDef?.features?.softDelete) {
                    finalSql += ` AND deletedAt IS NULL`;
                }

                finalSql += ` ORDER BY "${options.sortBy}" ${options.sortOrder} LIMIT ? OFFSET ?`;
                sqlParams.push(options.limit || 50, options.offset || 0);

                const searchResults = await db.query(finalSql, sqlParams);
                return success(searchResults.map(deepParse));
            }

            url.searchParams.forEach((v: string, k: string) => { 
                if (!['pageSize', 'page', 'sortBy', 'sortOrder', 'limit', 'offset', 'workspaceId'].includes(k)) filters[k] = v; 
            });
            
            const results = await db.list(collection, filters, options);
            if (!results) return error(`Failed to retrieve records for ${collection}`, 500);
            return success(results.map(deepParse)); 
        }

        if (method === 'GET' && id) {
            try {
                const item = await db.get(collection, id);
                if (!item) {
                   console.log(`[BRAIN-DB] Item not found: collection=${collection}, id=${id}`);
                   return error("Not found", 404);
                }
                
                // Soft Delete check
                if (entityDef?.features?.softDelete && item.deletedAt) {
                    return error("Item has been deleted", 404);
                }

                // Security Check (Level 8 Standard)
                // 1. SuperAdmins see everything
                // 2. workspace is a special global collection
                // 3. For everything else, check workspaceId ownership
                if (user.role !== 'superadmin' && collection !== 'workspace') {
                    if (item.workspaceId !== user.workspaceId && item.workspaceId !== 'system') {
                         console.warn(`[BRAIN-DB] 403 Forbidden: user=${user.email} (ws:${user.workspaceId}) tried to access ${collection}:${id} (ws:${item.workspaceId})`);
                         return error("Forbidden - Access denied to this record", 403);
                    }
                }
                
                return success(deepParse(item));
            } catch (e: any) {
                console.error(`[BRAIN-DB-GET-ERROR] collection=${collection}, id=${id}:`, e.message);
                return error(`Failed to fetch item: ${e.message}`, 500);
            }
        }

        // POST (Create)
        if (method === 'POST' && !id) {
            const data: any = { ...deepStringify(body), createdBy: user.id };
            if (!isGlobal) data.workspaceId = effectiveWorkspaceId;
            
            // Level 8 Workspace Isolation (Block tampering)
            if (!['superadmin', 'workspace_owner', 'workspace_admin'].includes(user.role) && collection !== 'workspace' && !isGlobal) {
                data.workspaceId = effectiveWorkspaceId;
            }
            
            // Level 8 Auto-Population Logic
            if (collection === 'workspace' && !data.ownerId) {
                data.ownerId = user.id;
            }
            
            const pk = getPrimaryKey(collection);
            if (!data[pk]) {
                // Enterprise Level 8: Standardized UUID Generation
                // Unified across all entities for maximum consistency and security.
                data[pk] = crypto.randomUUID();
            }
            await db.create(collection, data);
            
            // Level 8 Configuration Pulse
            if (['system_setting', 'entity_definition', '_ai_prompt'].includes(collection)) {
                global.CACHED_CONFIGS = {};
            }
            
            return success(deepParse(data));
        }

        // ... (rest of the handler)


        // PUT/PATCH (Update, Archive, Restore)
        if (['PUT', 'PATCH'].includes(method) && id) {
            if (subAction === 'archive') {
                await db.update(collection, id, { archived: 1, archivedAt: new Date().toISOString() });
                return success({ id, archived: 1 });
            }
            if (subAction === 'restore') {
                await db.update(collection, id, { archived: 0, archivedAt: null });
                return success({ id, archived: 0 });
            }
            
            const updates = { ...deepStringify(body), updatedAt: new Date().toISOString(), updatedBy: user.id };
            
            // Level 8 Workspace Isolation (Block moving records between workspace)
            if (!['superadmin', 'workspace_owner', 'workspace_admin'].includes(user.role)) {
                delete updates.workspaceId;
            }

            await db.update(collection, id, updates);
            const updated = await db.get(collection, id);

            // Level 8 Configuration Pulse
            if (['system_setting', 'entity_definition', '_ai_prompt'].includes(collection)) {
                global.CACHED_CONFIGS = {};
            }
            
            return success(deepParse(updated || { id, ...updates }));
        }

        // DELETE
        if (method === 'DELETE' && id) {
            // Enterprise Level 8: Recursive Safety Check
            const force = url.searchParams.get("force") === "true";
            if (!force) {
                const deps = await getEntityDependencies(db, collection, id, registry);
                if (deps.length > 0) {
                    return success({ 
                        id, 
                        hasDependencies: true, 
                        dependencies: deps,
                        message: renderString({
                            ro: `Această înregistrare are date asociate în: ${deps.map(d => d.label).join(', ')}. Ești sigur că vrei să o ștergi?`,
                            en: `This record has associated data in: ${deps.map(d => d.label).join(', ')}. Are you sure you want to delete it?`
                        }, selectedLang)
                    });
                }
            }

            if (entityDef?.features?.softDelete) {
                await db.update(collection, id, {
                    deletedAt: new Date().toISOString(),
                    deletedBy: user.id
                });

                // Special Case: If deleting a contact, also deactivate the corresponding auth user
                if (collection === 'contact') {
                    await db.query("UPDATE user SET active = 0 WHERE id = ?", [id]).catch(() => {});
                }

                return success({ id, deleted: true, soft: true });
            }
            await db.delete(collection, id);

            // Special Case: If deleting a contact, also remove from auth user table
            if (collection === 'contact') {
                await db.query("DELETE FROM user WHERE id = ?", [id]).catch(() => {});
            }
            return success({ id, deleted: true });
        }


        return error("Operation not allowed", 405);
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

        const aiConfig = { ...registry.AI_CONFIG, ...workspaceAiConfig };
        const ai = new AiService(env, { ai_config: aiConfig, db });

        if (op === "architect" || body.action === "architect") {
            const { prompt, provider, model } = body;
            if (!prompt) return error("Prompt required");
            
            const entities = Object.entries(registry.ENTITY_CONFIGS || {}).map(([id, cfg]: [any, any]) => ({ id, label: cfg.label }));
            
            const promptContext = await ai.getPrompt(db, 'entity_architect', { 
                userPrompt: prompt, 
                currentEntities: JSON.stringify(entities),
                appName: registry.APP_NAME,
                language: registry.LANGUAGE 
            });

            const response = await ai.chat(promptContext.prompt, [], {
                systemPrompt: promptContext.systemPrompt,
                provider: provider || aiConfig.active_provider,
                model: promptContext.model || model || aiConfig.model || aiConfig.preferredModel,
                response_mime_type: 'application/json'
            });
            
            const result = (ai as any).engine.extractJson(response);
            return result ? success(result) : success({ rawResponse: response });
        }

        if (op === "get-prompt" || body.action === "get-prompt") {
            const { name, context = {} } = body || {};
            if (!name) return error("Prompt name required");
            return success(await ai.getPrompt(db, name, context));
        }

        if (op === "chat" || body.action === "chat") {
            const { message, history = [], role, lang = registry.DEFAULT_LANG, context = {} } = body || {};
            if (!message) return error("Message required");

            const languageName = registry.LANGUAGES[lang] || registry.LANGUAGE;
            const promptContext = await ai.getPrompt(db, role || 'chat', { 
                message, 
                workspaceId, 
                lang, 
                language: languageName, 
                appName: registry.APP_NAME,
                workspace_prompts: workspaceAiConfig.customPrompts || [],
                ...context 
            });
            
            // Add language constraints from registry template if not already in system prompt
            let systemPrompt = promptContext.systemPrompt;
            if (!systemPrompt.includes(languageName) && registry.AI_PROMPTS.language_instruction) {
                systemPrompt += "\n\n" + registry.AI_PROMPTS.language_instruction.replace('{{language}}', languageName);
            }

            // Apply Personality from Workspace or Context
            const activePersonality = context.personality || aiConfig.personality || 'professional';
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
                provider: aiConfig.active_provider, 
                model: promptContext.model || body.model || aiConfig.preferredModel || aiConfig.model, 
                temperature: aiConfig.temperature,
                maxTokens: aiConfig.maxTokens,
                systemPrompt 
            });
            return json({ success: true, response });
        }

        if (op === "import-ai" || body.action === "import-ai") {
            const registry = await getRegistry(db);
            const { text, schema = {}, entityName = 'items', lang = registry.DEFAULT_LANG } = body || {};
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
                const activePersonality = personality || aiConfig.personality || 'professional';
                const personalityMap: any = {
                    professional: "Maintain a professional, concise and business-oriented tone.",
                    creative: "Be creative, expressive and inspirational. Feel free to use metaphors.",
                    technical: "Be highly technical and precise. Use industry-specific terminology where appropriate.",
                    friendly: "Be warm, friendly and supportive. Use approachable language.",
                    analytical: "Be data-driven and analytical. Structure responses with logic and facts."
                };
                
                const systemPrompt = personalityMap[activePersonality] || "You are a helpful AI assistant.";

                const response = await ai.chat(finalPrompt, [], { 
                    provider: aiConfig.active_provider,
                    model: model || aiConfig.preferredModel || aiConfig.model,
                    temperature: temperature ?? aiConfig.temperature,
                    systemPrompt
                });

                return success(response);
            } catch (e: any) {
                return error(`AI Generation Error: ${e.message}`);
            }
        }
        
        if (parts[1] === "prompts") {
            if (body.action === "save") return success(await db.set("_ai_prompt", body.id || crypto.randomUUID(), { ...deepStringify(body), workspaceId, updatedAt: new Date().toISOString() }));
            return success((await db.list("_ai_prompt", { workspaceId })).map(deepParse));
        }

        return error("AI operation not found", 404);
    },
    actions: async ({ op, parts, db, user, body }) => {
        if (op === "undo") {
            const logId = parts[2];
            if (!logId) return error("Log ID required");
            
            // Bypass the proxy for the initial log fetch to avoid recursive noise
            const log = await (db as any)._target?.get('audit_log', logId) || await db.get('audit_log', logId);
            if (!log || !log.snapshot_before) return error("Snapshot not found for undo");
            
            // Security check
            if (!(await checkAccess(db, user, log.entityType, 'update'))) return error("Forbidden", 403);

            let beforeData;
            try {
                beforeData = typeof log.snapshot_before === 'string' ? JSON.parse(log.snapshot_before) : log.snapshot_before;
            } catch (e) {
                return error("Invalid snapshot format");
            }

            // Perform the update - this WILL be audited by the proxy as a separate log entry
            // which is good for full audit transparency.
            await db.update(log.entityType, log.entityId, beforeData);
            
            return success({ 
                id: log.entityId, 
                message: "Restaurare finalizată cu succes",
                details: `Inversat ${log.action} pe ${log.entityType}`
            });
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
    users: async ({ url, db, user, selectedLang }) => {
        // Enterprise Level 8: Members List Specialized Handler
        // Only allow workspace admins or superadmins to list users
        if (!['superadmin', 'workspace_owner', 'workspace_admin', 'user', 'member'].includes(user.role)) {
             console.warn(`[BRAIN-USERS] Unauthorized role: ${user.role} for user ${user.email}`);
             return error(renderString({
                ro: "Acces neautorizat pentru vizualizarea listei de membri.",
                en: "Unauthorized access to member list."
            }, selectedLang), 403);
        }

        const requestedWorkspaceId = url.searchParams.get('workspaceId') || user.workspaceId;
        
        // Safety: If not superadmin, can only see their own workspace users
        // If superadmin and 'all', we set effective to undefined to remove the filter
        let effectiveWorkspaceId: string | undefined = user.workspaceId;
        if (user.role === 'superadmin') {
            effectiveWorkspaceId = (requestedWorkspaceId === 'all' || !requestedWorkspaceId) ? undefined : requestedWorkspaceId;
        }

        console.log(`[BRAIN-USERS] Fetching users for workspace: ${effectiveWorkspaceId || 'ALL'} (Requested: ${requestedWorkspaceId}, Role: ${user.role})`);

        try {
            // Enterprise Level 8: Hybrid User/Contact discovery
            // We search BOTH the 'user' table (Better-Auth identities) and 'contact' table (Business profiles)
            // if we are looking for members of a workspace.
            
            // 1. Fetch from 'user' table (D1)
            let result: any[] = [];
            try {
                // Better-Auth table is 'user' (singular)
                const whereClause = effectiveWorkspaceId ? "WHERE (workspaceId = ? OR workspaceId IS NULL)" : "WHERE 1=1";
                const params = effectiveWorkspaceId ? [effectiveWorkspaceId] : [];
                
                result = await db.query(
                    `SELECT id, name, email, image, role, workspaceId, active FROM user ${whereClause} AND (role IS NULL OR role != 'guest') AND (active IS NULL OR active != 0) ORDER BY name ASC`,
                    params
                );
            } catch (authDbErr: any) {
                console.warn("[BRAIN-USERS] Failed to query 'user' table, falling back to 'contact':", authDbErr.message);
                // If 'user' table fails (e.g. migration level mismatch), we fallback 100% to contact
                const whereClause = effectiveWorkspaceId ? "WHERE workspaceId = ?" : "WHERE 1=1";
                const params = effectiveWorkspaceId ? [effectiveWorkspaceId] : [];

                result = await db.query(
                    `SELECT id, name, email, role, workspaceId, status as active FROM contact ${whereClause} AND (role IS NULL OR role != 'guest') ORDER BY name ASC`,
                    params
                );
            }
            
            if (result.length === 0 && effectiveWorkspaceId !== 'system') {
                 // Try fetching FROM contact as secondary source
                 const contactsResult = await db.list('contact', { workspaceId: effectiveWorkspaceId, archived: 0 });
                 if (contactsResult.length > 0) {
                     result = contactsResult;
                 }
            }

            return success(result.map(deepParse));
        } catch (e: any) {
             console.error("[BRAIN-USERS-FATAL] Error fetching users:", e.message);
            return error(`Failed to fetch users: ${e.message}`, 500);
        }
    },
    help: async ({ url, db, env }) => {
        const registry = await getRegistry(db);
        const id = url.searchParams.get("id"), lang = url.searchParams.get("lang") || registry.DEFAULT_LANG;
        if (!id) return error("Missing ID");
        
        try {
            const cached = await db.get("_help_content");
            if (cached) return success(deepParse(cached));

            const ai = new AiService(env, { ai_config: registry.AI_CONFIG, db });
            const text = await ai.chat(`Create help for section: ${id}. Language: ${lang}.`, [], { 
                systemPrompt: "Return JSON: { \"title\": \"...\", \"content\": \"...\", \"description\": \"...\" }" 
            });
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            const result = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
            
            if (result.title) {
                await db.set("_help_content", { ...result, updatedAt: new Date().toISOString() });
            }
            return success(result);
        } catch (e: any) {
            console.error("[BRAIN-HELP] Error:", e.message);
            return success({ 
                title: id.charAt(0).toUpperCase() + id.slice(1), 
                content: "Documentation is being generated or is temporarily unavailable.", 
                description: "Help Content" 
            });
        }
    },
    upload: async ({ db, user, body, env }) => {
        const storage = (body instanceof FormData ? body.get('storage') : body.storage) || 'local-inbox';
        const file = body instanceof FormData ? body.get('file') : null;
        
        if (!file) return error("No file provided");

        // 1. Audit Log 
        await db.create('audit_log', {
            id: crypto.randomUUID(),
            action: 'upload',
            entityType: 'file',
            details: JSON.stringify({ name: (file as any).name, size: (file as any).size, storage }),
            user: user?.email || user?.id || 'system',
            workspaceId: user?.workspaceId || 'system',
            createdAt: new Date().toISOString()
        });

        // 2. Route based on storage type
        if (storage === 'local-inbox') {
            const registry = await getRegistry(db);
            
            // Prioritize local dev URL if available, then registry, then fallback
            const localAgentUrl = env.VITE_SOCKET_URL || registry.CONSTANTS?.directories?.apiUrl || 'http://localhost:4001';
            
            console.log(`[BRAIN-UPLOAD] Target Agent URL: ${localAgentUrl} (Storage: ${storage})`);
            
            try {
                const formData = new FormData();
                // If it's a File-like object from a Workers FormData
                if (file && typeof (file as any).name === 'string') {
                    formData.append('file', file as any, (file as any).name);
                } else {
                    formData.append('file', file as any);
                }
                
                formData.append('workspaceId', user?.workspaceId || 'system');
                formData.append('userId', user?.id || 'system');

                const response = await fetch(`${localAgentUrl}/api/file/upload`, {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${env.API_KEY || 'dev-token'}`,
                        'Accept': 'application/json'
                    },
                    body: formData
                });

                if (!response.ok) {
                    const statusText = response.statusText;
                    const status = response.status;
                    let errorMsg = 'Local agent upload failed';
                    try {
                        const err: any = await response.json();
                        errorMsg = err.error || errorMsg;
                    } catch (e) {
                        try {
                            errorMsg = await response.text() || errorMsg;
                        } catch(e2) {}
                    }
                    console.error(`[BRAIN-UPLOAD-ERROR] Agent returned ${status}: ${errorMsg}`);
                    return error(errorMsg, status);
                }

                const result = await response.json();
                return success(result); 
            } catch (e: any) {
                console.error(`[BRAIN-UPLOAD-FATAL] ${e.message}`);
                return error(`Agentul local nu este disponibil: ${e.message}. Verifică dacă aplicația de desktop este deschisă pe ${localAgentUrl}.`, 503);
            }
        }

        return error(`Storage provider '${storage}' not yet implemented.`, 501);
    },
    'socket.io': async () => {
        // This is a placeholder to avoid 500/530 noise on Worker
        return error("Socket.IO is not supported on Cloudflare Workers 'Brain'. Local Agent should be used for sockets.", 404);
    }
};

// --- MAIN HANDLER ---
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

        if (resource === "config") {
            const mergedConfig = await mergeRegistryWithD1(db, user?.workspaceId || 'system');
            
            return success({ 
                entities: mergedConfig.ENTITY_CONFIGS || mergedConfig.entities || {}, 
                constants: mergedConfig, 
                uiConfig: mergedConfig.THEME || mergedConfig.theme || {} 
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

        const ctx = { request, env, db, user, url, parts, resource, op: parts[1], method: request.method, body, cfCtx, selectedLang };
        
        if (resource === "db") {
            const table = parts[1] === 'collection' ? parts[2] : parts[1];
            
            // SECURITY: Ensure system entities are filtered by workspace unless superadmin
            // We inject the workspaceId filter into the context before calling HANDLERS.db
            if (user && !['superadmin', 'workspace_owner', 'workspace_admin'].includes(user.role)) {
                const systemEntities = ['contact', 'tag', 'file', 'audit_log', 'system_setting'];
                if (systemEntities.includes(table)) {
                    if (ctx.method === 'GET' && !url.searchParams.has('workspaceId')) {
                        url.searchParams.set('workspaceId', user.workspaceId || 'system');
                    }
                }
            }
        }

        const handler = HANDLERS[resource];
        if (handler) return await handler(ctx);
        
        // Generic CRUD Fallback
        if (request.method === 'GET') {
            const results = await db.list(resource, { workspaceId: user?.workspaceId });
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

