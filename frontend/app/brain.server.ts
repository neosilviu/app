/**
 * BRAIN.SERVER.TS - Registry Architecture (v2.1)
 * Logic for Cloudflare D1 unified API with auto-healing and domain registration.
 */
console.log("[BRAIN-FILE] LOADED brain.server.ts");

// Silence EventEmitter memory leak warnings in development (common with hot-reloading)
if (typeof process !== 'undefined') {
    process.setMaxListeners(100);
}

// 🔒 DEDUPLICATION: Track active mutations & queries to prevent concurrent floods (Persistent across HMR)
const global = globalThis as any;
if (!global.activeMutations) {
    global.activeMutations = new Map<string, Promise<Response>>();
}
if (!global.activeQueries) {
    global.activeQueries = new Map<string, Promise<any>>();
}
const activeMutations: Map<string, Promise<Response>> = global.activeMutations;
const activeQueries: Map<string, Promise<Response>> = global.activeQueries;

import { getDb, clearColumnCache } from './lib/d1.server';
import { getAuth, verifyAuth } from "./lib/auth-core.server";
import { deepParse, deepStringify } from './lib/core';
import { resolveCollection, getPrimaryKey, normalizeEntity, getDisplayValue, renderString } from './lib/core';
import { AiService } from './lib/services';
import { isGlobalAdmin, hasPageAccess, isWorkspaceAdmin } from './lib/auth-utils';
import { ensureSystemTables, waitForDbReady, syncEntityTable } from './lib/db-init.server';
import { handleAiRequest, handleSelfHealing, handleHelpRequest } from './lib/ai.server';
import { AVAILABLE_V3_ENTITIES } from '~/../../core/entities';

// --- SERVICE REFACTOR (Enterprise Level 10) ---
import { clearKvConfigCache, synthesizeNavigation, getValCi, mergeRegistryWithD1 as _mergeRegistryWithD1 } from './lib/registry-service.server';
import { checkAccess, clearUserPermsCache, logSystemError } from './lib/auth-service.server';

// --- SYSTEM CONSTANTS (Enterprise Level 10: Registry Driven) ---
import { REGISTRY_BASELINE } from '../../registry-baseline';

// Enterprise Level 10: Global Registry Injection
if (typeof globalThis !== 'undefined') {
    (globalThis as any).REGISTRY_BASELINE = REGISTRY_BASELINE;
}

// Patch: Extend menuConfig type to allow 'badge'
type MenuConfig = {
    showInMainMenu?: boolean;
    label?: string;
    path?: string;
    category?: string;
    priority?: number;
    icon?: string;
    badge?: string;
};

const isGlobalEntity = (name: string, registry?: any) => {
    // Modular V3 Standard: Entity defines its own scope
    const entityDef = registry?.ENTITY_CONFIG?.[name];
    return entityDef?.isGlobal === true;
};

/**
 * Level 10: Self-Healing Intelligence
 * Analyzes performance logs and applies optimizations automatically.
 * (Moved to ai.server.ts)
 */

// --- TYPING ---
declare global {
    var CACHED_CONFIGS: Record<string, any>;
    var CACHE_EXPIRY: number;
}

// --- CORE HELPERS --- 
const json = (payload: any, status = 200) => Response.json(payload, { 
    status, 
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } 
});

const success = (data: any = true) => json({ success: true, data });

const error = (msg: any, status = 400, reason?: string) => {
    const errorMsg = typeof msg === 'string' ? msg : (
        typeof msg === 'object' && msg !== null ? (msg.ro || msg.en || JSON.stringify(msg)) : String(msg)
    );
    
    return json({ 
        success: false, 
        error: errorMsg,
        reason: reason || (typeof msg === 'string' ? msg : undefined)
    }, status);
};

/**
 * Enterprise Level 10: Hook Executor
 * Runs lifecycle hooks for modular v3 entities.
 */
async function executeHook(collection: string, hookName: string, context: any) {
    const v3Entity = (AVAILABLE_V3_ENTITIES as any)[collection];
    if (v3Entity?.hooks?.[hookName]) {
        try {
            console.log(`[HOOK] Executing ${hookName} for ${collection}`);
            const result = await v3Entity.hooks[hookName](context);
            // If the hook returns an object, it can modify the data being processed
            return result;
        } catch (e: any) {
            console.warn(`[HOOK-ERROR] ${hookName} failed for ${collection}:`, e.message);
            throw e; // Bubble up
        }
    }
}

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

/**
 * TRANSLATION TRANSFORMER - Enterprise Level 10
 * Converts multilingual fields (e.g. { ro: "...", en: "..." }) to a single value
 * based on the requested language, recursively through the entire response tree.
 */
const transformTranslations = (obj: any, lang: string = 'ro', registry?: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    // Handle arrays recursively
    if (Array.isArray(obj)) {
        return obj.map(item => transformTranslations(item, lang, registry));
    }

    // Enterprise Level 10: Dynamic Multilingual Detection from Registry
    const keys = Object.keys(obj);
    const supportedLangs = registry?.I18N_CONFIG?.supportedLanguages || { ro: {}, en: {} };
    const validLangs = Object.keys(supportedLangs);
    
    // Level 10: Robust Detection - Must have at least one valid language key and all keys must be 2-letter codes
    const hasValidLang = validLangs.some(l => keys.includes(l));
    const isMultilingual = keys.length > 0 && hasValidLang && keys.every(k => validLangs.includes(k) || k.length === 2);
    
    if (isMultilingual) {
        // Return based on priority: exact match -> default -> fallback -> first available
        const defaultLang = registry?.I18N_CONFIG?.defaultLanguage || 'ro';
        const fallbackLang = registry?.I18N_CONFIG?.fallbackLanguage || 'en';
        return obj[lang] ?? obj[defaultLang] ?? obj[fallbackLang] ?? obj[keys[0]] ?? '';
    }

    // Regular object: recurse into values
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        result[key] = transformTranslations(value, lang, registry);
    }
    return result;
};

/**
 * WORKFLOW STATE MACHINE - Enterprise Level 10
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
    // Enterprise Level 10: Flow rules are now defined in BOTH Registry Constants (Baseline) 
    // AND in the Entity Definition (Dynamic Builder). We merge them.
    const entityDef = (registry.ENTITY_CONFIG || {})[entityType];
    const entityFlowRules = entityDef?.flowRules || {};
    const globalFlowRules = (registry?.CONSTANT?.flowRules || {})[entityType] || {};
    
    const rules = { ...globalFlowRules, ...entityFlowRules };
    
    if (Object.keys(rules).length === 0) {
        // No flow rules defined for this entity type - allow any transition
        return { valid: true };
    }
    
    const currentStateRule = rules[fromStatus];
    if (!currentStateRule) {
        return { 
            valid: false, 
            error: `Current state '${fromStatus}' is not defined in workflow for ${entityType}`,
            nextStates: Object.keys(rules)
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
    const requiredFields = (rules[toStatus]?.requiresFields || []);
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
    const entityDef = (registry.ENTITY_CONFIG || {})[entityType];
    const entityFlowRules = entityDef?.flowRules || {};
    const globalFlowRules = (registry?.CONSTANT?.flowRules || {})[entityType] || {};
    
    const rules = { ...globalFlowRules, ...entityFlowRules };
    
    if (Object.keys(rules).length === 0 || !rules[currentStatus]) {
        return [];
    }
    
    const stateRule = rules[currentStatus];
    const nextStates = stateRule.nextStates || [];
    
    return nextStates.map((state: string) => ({
        value: state,
        label: rules[state]?.label || { ro: state, en: state },
        icon: rules[state]?.icon || 'ArrowRight',
        action: rules[state]?.action || `transition_to_${state}`,
        requiresFields: rules[state]?.requiresFields || []
    }));
};

/**
 * Enterprise Level 10: Unified Workflow Trigger Engine
 * Executes side-effects when an entity changes status
 */
const triggerFlowActions = async (
    db: any,
    entityType: string,
    id: string,
    toStatus: string,
    registry: any,
    user: any,
    env: any
) => {
    try {
        // Enterprise Level 10: Unified Flow Rules are defined in BOTH Registry Constants (Baseline) 
        // AND in the Entity Definition (Dynamic Builder). We merge them.
        const entityDef = (registry.ENTITY_CONFIG || {})[entityType];
        const entityFlowRules = entityDef?.flowRules || {};
        const globalFlowRules = (registry?.CONSTANT?.flowRules || {})[entityType] || {};
        
        const mergedRules = { ...globalFlowRules, ...entityFlowRules };
        const stateRule = mergedRules[toStatus];
        
        if (!stateRule || !stateRule.action) return;

        console.log(`[FLOW-TRIGGER] Executing '${stateRule.action}' for ${entityType}/${id} to status ${toStatus}`);

        // 1. Audit Log Entry
        await db.create('audit_log', {
            id: crypto.randomUUID(),
            action: `flow:${stateRule.action}`,
            entityType,
            entityId: id,
            details: `Status change to ${toStatus} triggered: ${stateRule.action}`,
            user: user?.email || user?.id || 'system',
            workspaceId: user?.workspaceId || 'system',
            createdAt: new Date().toISOString()
        });

        // 2. Core Actions (Modular DNA Protocol)
        // Level 10: We no longer hardcode actions here. Every action must be defined in the 
        // entity's 'actions' array and handled by the generic Unified Action Protocol.
        if (stateRule.action) {
            console.log(`[FLOW] Action Hook: ${stateRule.action} for ${entityType}/${id}`);
            // Note: The execution of the actual action is handled by the unified brain handler /ai or /action
        }

    } catch (e: any) {
        console.error(`[FLOW-TRIGGER-ERROR] ${e.message}`);
    }
};

// --- CONFIG CACHE & PENDING FETCHES ---
if (global.CACHED_CONFIGS === undefined) global.CACHED_CONFIGS = {};
if (global.PENDING_CONFIG_FETCHES === undefined) global.PENDING_CONFIG_FETCHES = {};

// Level 10: Registry logic now purely externalized to registry-service.server.ts

/**
 * Merges Registry Baseline (Template) with D1 SYSTEM_SETTING (Values)
 * Uses a short-lived cache (Level 10 Global Optimization) to prevent DB floods
 */
async function getEntityDependencies(db: any, entity: string, id: string, registry: any) {
    const dependencies: any[] = [];
    const entities = registry.entities || registry.ENTITY_CONFIG || {};
    const entityToScan = (entity || '').toLowerCase();
    
    // Enterprise Level 10: Identify all dependency checks
    const checks: any[] = [];
    for (const [otherEntity, config] of Object.entries(entities)) {
        const cfg = config as any;
        const tableName = cfg.tableName || otherEntity;
        const fields = cfg.fields || (Array.isArray(cfg.fields) ? cfg.fields : Object.entries(cfg.fields || {}).map(([name, f]) => ({ ...(f as any), name })));
        
        const fieldsArray = Array.isArray(fields) ? fields : Object.values(fields);

        for (const fieldDef of fieldsArray) {
            const fd = fieldDef as any;
            const target = (fd.relation?.target || fd.relationEntity || '').toLowerCase();
            
            if (target === entityToScan) {
                if (fd.type === 'relation' || fd.type === 'entity_relation') {
                    checks.push({
                        otherEntity,
                        label: (cfg.labelPlural?.ro || cfg.label?.ro || otherEntity),
                        type: 'relation',
                        sql: `SELECT COUNT(*) as count FROM "${tableName}" WHERE "${fd.name || fd.id}" = ?${cfg.features?.includes?.('softDelete') || cfg.features?.softDelete ? ' AND deletedAt IS NULL' : ''}`,
                        params: [id]
                    });
                } else if (fd.type === 'relation-many' || fd.type === 'tag' || fd.type === 'multi-select') {
                    checks.push({
                        otherEntity,
                        label: (cfg.labelPlural?.ro || cfg.label?.ro || otherEntity),
                        type: 'relation-many',
                        sql: `SELECT COUNT(*) as count FROM entity_relation_many WHERE sourceType = ? AND targetId = ? AND targetType = ?`,
                        params: [otherEntity, id, entityToScan]
                    });
                }
            }
        }

        // Enterprise Level 10: Authorship Tracking (createdBy)
        if (cfg.features?.includes?.('audit') || cfg.features?.auditable) {
            checks.push({
                otherEntity,
                label: (cfg.labelPlural?.ro || cfg.label?.ro || otherEntity),
                type: 'author',
                sql: `SELECT COUNT(*) as count FROM "${tableName}" WHERE createdBy = ?${cfg.features?.includes?.('softDelete') || cfg.features?.softDelete ? ' AND deletedAt IS NULL' : ''}`,
                params: [id]
            });
        }
    }

    // Enterprise Level 10: Batch Execute queries to reduce D1 round-trips
    if (checks.length > 0) {
        try {
            const results = await db.batch(checks.map(c => ({ sql: c.sql, params: c.params }))).catch(() => []);
            results.forEach((res: any, idx: number) => {
                const count = res[0]?.count || 0;
                if (count > 0) {
                    const check = checks[idx];
                    // Group results by entity to prevent duplicates in UI
                    let existing = dependencies.find(d => d.entity === check.otherEntity);
                    if (existing) {
                        existing.count += count;
                    } else {
                        dependencies.push({ 
                            entity: check.otherEntity, 
                            label: check.label,
                            count,
                            type: check.type
                        });
                    }
                }
            });
        } catch (e: any) {
            console.warn(`[BRAIN-DEPENDENCIES] Batch check failed:`, e.message);
        }
    }

    return dependencies;
}

// Enterprise Level 10: Logic for Authorship Tracking (createdBy)
async function checkAuthorship(db: any, entity: string, id: string, registry: any) {
    // This logic is often integrated into the dependency check
}

async function mergeRegistryWithD1(db: any, workspaceId: string = 'system', env?: any): Promise<any> {
    return _mergeRegistryWithD1(db, workspaceId, env);
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
                    
                    // Enterprise Level 10: Auditable Feature Guard
                    const registry = await mergeRegistryWithD1(target);

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
                        const id = method === 'set' ? args[1]?.id : args[1];
                        if (id) {
                            const current = await target.get(collection, id);
                            if (current) snapshotBefore = JSON.stringify(current);
                        }
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
                    if (entityDef) {
                        displayValue = getDisplayValue(finalAfter || JSON.parse(snapshotBefore || '{}'), entityDef);
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

// --- DOMAIN HANDLERS ---
const HANDLERS: Record<string, (ctx: any) => Promise<Response>> = {
    asset: async ({ db, parts, env }) => {
        const filename = parts[1];
        if (!filename) return error("Filename required", 400);

        const registry = await mergeRegistryWithD1(db);
        const localAgentUrl = env.VITE_SOCKET_URL || registry.CONSTANT?.directories?.apiUrl || 'http://localhost:4001';
        
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
    stats: async (ctx) => {
        const v3 = (AVAILABLE_V3_ENTITIES as any).system_setting;
        const action = v3?.actions.find((a: any) => a.id === 'stats');
        if (action) return success(await action.handler(ctx, { 
            entity: ctx.url.searchParams.get('entity'),
            type: ctx.url.searchParams.get('type') || 'count',
            field: ctx.url.searchParams.get('field')
        }));

        // Inline Fallback
        const { db, user, url, registry } = ctx;
        const entity = url.searchParams.get('entity');
        const type = url.searchParams.get('type') || 'count';
        const field = url.searchParams.get('field');
        
        if (!entity) return error("Entity required");
        const entityConfigs = registry.ENTITY_CONFIG || registry.entity || {};
        const entityDef = entityConfigs[entity];
        if (!entityDef) return error("Invalid entity", 400);
        
        const isSuper = isGlobalAdmin(user, registry);
        const whereClause = (isSuper || entity === 'workspace') ? "" : "WHERE workspaceId = ?";
        const params = (isSuper || entity === 'workspace') ? [] : [user.workspaceId || 'system'];
        
        let query = "";
        if (type === 'count') query = `SELECT COUNT(*) as value FROM ${entityDef.tableName || entity} ${whereClause}`;
        else if (type === 'sum' && field) query = `SELECT SUM(${field}) as value FROM ${entityDef.tableName || entity} ${whereClause}`;
        else return error("Invalid stat type", 400);
        
        const result = await db.query(query, params);
        return success({ value: result?.[0]?.value || 0 });
    },
    registry: async (ctx) => {
        const { op, method, body } = ctx;
        const v3 = (AVAILABLE_V3_ENTITIES as any).system_setting;
        if (!v3) return error("V3 Bridge missing: system_setting", 500);
        
        if ((op === 'get' || !op) && method === 'GET') {
            return success(await mergeRegistryWithD1(ctx.db, 'system', ctx.env));
        }

        const actionId = op === 'save' ? 'save' : (op === 'sync' ? 'sync' : (op === 'rollback' ? 'rollback' : op));
        const modularAction = v3.actions.find((a: any) => a.id === actionId);
        if (modularAction) return success(await modularAction.handler(ctx, body));
        return error(`Registry operation '${op}' not found`, 404);
    },
    entity: async (ctx) => {
        const { op, method, body } = ctx;
        const v3 = (AVAILABLE_V3_ENTITIES as any).entity_definition;
        if (!v3) return error("V3 Bridge missing: entity_definition", 500);

        if (method === 'GET' && (!op || op === 'list')) {
            const action = v3.actions.find((a: any) => a.id === 'list-all');
            return success(await action.handler(ctx));
        }

        const actionId = op === 'save' ? 'save' : (op === 'delete' ? 'delete' : (op === 'garbage-collect' ? 'garbage-collect' : op));
        const modularAction = v3.actions.find((a: any) => a.id === actionId);
        if (modularAction) return success(await modularAction.handler(ctx, body));
        return error(`Entity operation '${op}' not found`, 404);
    },
    auth: async (ctx) => {
        const { op, method, body, env } = ctx;
        const v3 = (AVAILABLE_V3_ENTITIES as any).user;
        if (!v3) return error("V3 Bridge missing: user", 500);

        if (op === "check-admin") {
            const action = v3.actions.find((a: any) => a.id === 'check-admin');
            return success(await action.handler(ctx));
        }

        if (op === "local-token") return success({ token: env.API_KEY || `dev-${Date.now()}` });

        if (op === "update-profile" || op === "setup-admin") {
            const action = v3.actions.find((a: any) => a.id === op);
            if (action) return success(await action.handler(ctx, body));
        }

        return error("Auth operation not found", 404);
    },
    workspace: async (ctx) => {
        const { op, method, body, url, registry } = ctx;
        const v3 = (AVAILABLE_V3_ENTITIES as any).workspace;
        if (!v3) return error("V3 Bridge missing: workspace", 500);

        const opMap: Record<string, string> = {
            'settings': 'get-settings',
            'list': 'list-all',
            'list-for-user': 'list-all',
            'member': 'list-members',
            'rbac': 'rbac',
            'search-contact': 'search-contact',
            'user-permission': 'user-permission',
            'switch': 'switch',
            'create': 'create',
            'update-settings': 'update-settings',
            'update-rbac': 'update-rbac',
            'add-user': 'add-member',
            'update-user-permission': 'update-member-perms',
            'remove-user': 'remove-user',
            'delete': 'delete'
        };

        const actionId = opMap[op] || op;
        const modularAction = v3.actions.find((a: any) => a.id === actionId);

        if (modularAction) {
            const input = {
                ...body,
                userId: body?.userId || url.searchParams.get('userId'),
                workspaceId: body?.workspaceId || url.searchParams.get('workspaceId') || url.searchParams.get('id'),
                q: body?.q || url.searchParams.get('q')
            };
            return success(await modularAction.handler(ctx, input));
        }

        return error(`Workspace operation '${op}' not found`, 404);
    },
    system: async (ctx) => {
        const { op, body } = ctx;
        const v3 = (AVAILABLE_V3_ENTITIES as any).system_setting;
        
        // Map common legacy ops
        const opMap: Record<string, string> = {
            'info': 'get-info',
            'local-token': 'get-token',
            'self-healing': 'self-healing',
            'db-sync': 'sync-table'
        };

        const actionId = opMap[op] || op;
        const action = v3?.actions?.find((a: any) => a.id === actionId);
        if (action) return success(await action.handler(ctx, body));

        return error("System operation not found", 404);
    },
    monitoring: async (ctx) => {
        const { op, user, registry, body } = ctx;

        // Public Exceptions
        if (op === "todos") {
            const tasks = await ctx.db.query("SELECT * FROM task WHERE workspaceId = ? AND status IN ('todo', 'in_progress') ORDER BY createdAt DESC LIMIT 10", [user?.workspaceId || 'system']).catch(() => []);
            return success(tasks);
        }

        if (!hasPageAccess(user, 'monitoring', registry)) return error("Forbidden", 403);

        const v3 = (AVAILABLE_V3_ENTITIES as any).system_setting;
        const actionMap: Record<string, string> = {
            'storage': 'monitoring-infra',
            'cloudflare': 'monitoring-infra',
            'local': 'monitoring-infra',
            'db': 'monitoring-db',
            'workers': 'monitoring-workers',
            'worker': 'monitoring-workers',
            'audits': 'monitoring-audits',
            'settings': 'monitoring-settings'
        };

        const actionId = actionMap[op] || op;
        const action = v3?.actions?.find((a: any) => a.id === actionId);
        if (action) {
            const input = (op === 'storage' || op === 'cloudflare' || op === 'local') ? { type: op === 'storage' ? 'cloudflare' : op } : body;
            return success(await action.handler(ctx, input));
        }

        return error(`Monitoring operation '${op}' not found`, 404);
    },
    db: async ({ request, parts, op, method, db, user, body, url, env, selectedLang, registry }): Promise<Response> => {
        const ctx = { 
            request, 
            parts, 
            op, 
            method, 
            db, 
            user, 
            body, 
            url, 
            env, 
            selectedLang, 
            registry,
            renderString,
            deepParse,
            getAuth,
            AiService,
            handleSelfHealing,
            clearUserPermsCache
        };
        // Step 1: Normalize Path Patterns (Enterprise Level 10)
        // Pattern: /db/collection/:table/:workspaceId?/:id?/:subAction?
        // Pattern: /db/collection/:table/item/:id
        let collection: string = "";
        let id: string | undefined;
        let subAction: string | undefined;
        let pathWorkspaceId: string | undefined;

        if (op === 'collection' && parts[2]) {
            collection = parts[2];
            
            const isGlobal = isGlobalEntity(collection, registry);

            // Level 10 Robust Parsing
            const isUuid = (str: string | undefined) => str ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) : false;
            const segment3 = (parts[3] || '').trim().toLowerCase();
            
            // Enterprise Level 10: Ambiguity Resolver
            // If we have "db/collection/table/something", is "something" a workspaceId or an ID?
            // Rule: If it's a UUID and there is NO following segment, and the method is DELETE, PUT, or GET (single), 
            // we treat it as an ID if it's not explicitly 'all', 'list' or 'system'.
            let segment3IsId = false;
            if (segment3 && !parts[4]) {
                const isExplicitWorkspace = ['all', 'list', 'system', 'workspace'].includes(segment3) || segment3.startsWith('ws-');
                if (!isExplicitWorkspace && (method !== 'GET' || !isGlobal)) {
                    // It's likely an ID because it's the only segment provided and we're not listing.
                    segment3IsId = true;
                }
            }

            const looksLikeWorkspaceId = segment3 && !segment3IsId && (
                isUuid(segment3) || 
                segment3.startsWith('ws-') || 
                ['all', 'list', 'system'].includes(segment3)
            );
            
            // Logic: If it matches workspaceId pattern, consume it as workspaceId.
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
            const subOp = (parts[1] || '').toLowerCase();
            
            // Enterprise Level 10: Handle generic endpoints (/db/list, /db/batch) where collection is in the body/query
            if ((subOp === 'list' || subOp === 'batch') && parts.length <= 2) {
                // Determine collection from body or query
                const bodyObj = (body && typeof body === 'object' && !Array.isArray(body)) ? body : {};
                collection = (url.searchParams.get('table') || bodyObj.entity || bodyObj.table || bodyObj.collection || '').toLowerCase();
                
                // Level 10: Relax collection requirement for polymorphic batch operations
                const isPolymorphicBatch = subOp === 'batch' && Array.isArray(bodyObj.operations);
                
                if (!collection && !isPolymorphicBatch) {
                    return error(`Malformed request: Collection name missing in body/query for operation '${subOp}'`, 400);
                }
                
                if (!collection && isPolymorphicBatch) collection = 'batch'; // Virtual collection for polymorphic routing

                id = undefined;
                subAction = subOp === 'batch' ? 'batch' : undefined;
            } else {
                collection = subOp;
                
                // Enterprise Level 10: Prevent reserved words from becoming collections
                const reserved = ['all', 'item', 'new', 'create'];
                if (reserved.includes(collection) && parts.length <= 2) {
                    return error(`Malformed request: Collection name missing before operation '${collection}'`, 400);
                }

                if ((parts[2] || '').toLowerCase() === 'item' && parts[3]) {
                    id = parts[3];
                    subAction = (parts[4] || '').toLowerCase();
                } else {
                    id = parts[2];
                    subAction = (parts[3] || '').toLowerCase();
                }
            }
        }

        if (!collection) return error("Table not specified", 400);

        // Normalize 'all' keyword for IDs (Enterprise Level 10 usability)
        if (id === 'all' || id === 'list' || id === 'all?') id = undefined;

        // Level 10 Robust Failsafe: Map role-aliases to current user ID for personal record fetching
        // This resolves 404s when legacy or role-interpolated links are used (e.g. /contact/superadmin)
        const roleKeywords = Object.keys(registry.SYSTEM_ROLE || {}).map(r => r.toLowerCase());
        const mappingKeywords = [...roleKeywords, 'me', 'self'];

        // Step 2: Registry & RBAC
        const entityConfigs = registry.ENTITY_CONFIG || {};
        const entityDef = Object.values(entityConfigs).find((e: any) => e.tableName === collection || e.name === collection) as any;

        if (id && mappingKeywords.includes(id.toLowerCase())) {
            // Enterprise Level 10: Mapping alias 'me/self' to current user context
            const isUserLinked = entityDef?.isCore || entityDef?.isSystem || ['contact', 'user'].includes(collection);
            if (isUserLinked) {
                if (id.toLowerCase() === 'me' || id.toLowerCase() === 'self' || id.toLowerCase() === user.role.toLowerCase()) {
                    console.log(`[BRAIN-DB-ID-MAPPING] Mapping alias '${id}' to UserID: ${user.id} (${user.email})`);
                    id = user.id;
                }
            }
        }

        // More registry setup
        const isSuper = isGlobalAdmin(user, registry);
        const isWsAdmin = isWorkspaceAdmin(user, registry);

        // Map workspaceId from path to filters if present
        let effectiveWorkspaceId: string | undefined;
        try {
            // Use safe navigation and guard against null (typeof null === 'object')
            const bodyObj = (body && typeof body === 'object' && !Array.isArray(body)) ? body : {};
            
            // Priority: Path > Query > Body > User Profile
            effectiveWorkspaceId = pathWorkspaceId || url.searchParams.get("workspaceId") || bodyObj.workspaceId || user?.workspaceId;
            
            // Enterprise Level 10: Workspace Filter Normalization
            if (effectiveWorkspaceId === 'all' || effectiveWorkspaceId === 'list') {
                // For SuperAdmins, 'all' means no filter. For others, it defaults to their workspace.
                effectiveWorkspaceId = isSuper ? undefined : (user?.workspaceId || 'system');
            }
            
            // Default workspaceId if still missing (Enterprise Level 10: Always have a context)
            if (!effectiveWorkspaceId) {
                effectiveWorkspaceId = user?.workspaceId || 'system';
            }
        } catch (e: any) {
            console.warn(`[BRAIN-DB-WS-WARN] Fallback workspaceId due to:`, e.message);
            effectiveWorkspaceId = user?.workspaceId || 'system';
        }

        const actionMap: Record<string, string> = {
            'GET': 'read', 'POST': 'create', 'PUT': 'update', 'PATCH': 'update', 'DELETE': 'delete'
        };
        let action = actionMap[method] || 'read';

        // Enterprise Level 10: Adjust action for generic /db/list or /db/query (it's a READ, not a CREATE)
        if (method === 'POST' && (op === 'list' || parts[1] === 'list' || subAction === 'list' || op === 'query')) {
            action = 'read';
        }

        // --- ENTERPRISE LEVEL 10 FEATURE LOCKS ---
        if (entityDef?.features) {
            const { creatable, editable, deletable } = entityDef.features;
            if (action === 'create' && creatable === false) return error(`Entity '${collection}' is locked: Creation disabled in Registry.`, 403);
            if (action === 'update' && editable === false) return error(`Entity '${collection}' is locked: Editing disabled in Registry.`, 403);
            if (action === 'delete' && deletable === false) return error(`Entity '${collection}' is locked: Deletion disabled in Registry.`, 403);
        }

        if (!(await checkAccess(db, user, collection, action, subAction, env))) {
            return error(`Access Denied: Nu ai permisiunea de '${action}'${subAction ? ` (${subAction})` : ''} pentru entitatea '${collection}'`, 403);
        }

        // --- UNIFIED ACTION PROTOCOL (v3) ---
        const v3Entity = (AVAILABLE_V3_ENTITIES as any)[collection];
        if (v3Entity && Array.isArray(v3Entity.actions)) {
            // Check if subAction OR id is a custom action
            // Case 1: /db/entity/item/ID/action -> subAction is 'action'
            // Case 2: /db/entity/action -> id is 'action'
            const actionId = subAction || id;
            if (actionId) {
                const modularAction = v3Entity.actions.find((a: any) => a.id === (actionId || '').toLowerCase());
                
                if (modularAction) {
                    console.log(`[BRAIN-DB-V3-ACTION] Executing ${collection}/${actionId} for user ${user.id}`);
                    
                    const ctx = {
                        db,
                        user,
                        env,
                        request,
                        registry,
                        collection,
                        id: subAction ? id : undefined, // recordId if item-level
                        effectiveWorkspaceId,
                        // v3 helpers
                        normalizeEntity,
                        syncEntityTable,
                        clearColumnCache,
                        resolveCollection,
                        getPrimaryKey,
                        renderString,
                        deepParse,
                        getAuth,
                        AiService,
                        AVAILABLE_V3_ENTITIES,
                        handleSelfHealing,
                        clearUserPermsCache
                    };
                    
                    try {
                        // Enterprise Level 10: Logic validation for modular actions
                        let validatedInput = body;
                        if (modularAction.input) {
                            const result = modularAction.input.safeParse(body);
                            if (!result.success) {
                                return error({ 
                                    ro: `Input invalid pentru acțiunea '${actionId}': ${result.error.errors.map((e: any) => e.message).join(', ')}`,
                                    en: `Invalid input for action '${actionId}': ${result.error.errors.map((e: any) => e.message).join(', ')}`
                                }, 400);
                            }
                            validatedInput = result.data;
                        }
                        
                        const result = await modularAction.handler(ctx, validatedInput);
                        return success(result);
                    } catch (e: any) {
                        console.error(`[BRAIN-DB-V3-ACTION-ERROR] ${collection}/${actionId}:`, e.message);
                        return error(e.message || "Action failed", 500);
                    }
                }
            }
        }

        const wsLog = effectiveWorkspaceId || (isSuper ? 'ALL_WORKSPACES' : 'system');
        // console.log(`[BRAIN-DB] ${method} ${collection} ws:${wsLog}${id ? ` id:${id}` : ''}${subAction ? ` [${subAction}]` : ''}`);

        const isGlobal = isGlobalEntity(collection, registry);

        if (method === 'GET' && subAction === 'export') {
            const format = url.searchParams.get('format') || 'json';
            
            const filters: any = (isSuper || collection === 'workspace') ? {} : { workspaceId: effectiveWorkspaceId };
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
            const isPolymorphic = Array.isArray(body?.operations);
            const items = isPolymorphic ? body.operations : (Array.isArray(body) ? body : (body?.items || body?.data || []));
            
            if (!Array.isArray(items)) return error("Invalid batch data: expected array");

            console.log(`[BRAIN-DB-BATCH] Processing ${items.length} ${isPolymorphic ? 'operations' : 'items'} for ${collection} (Workspace: ${effectiveWorkspaceId})`);
            
            const results: string[] = [];
            const timestamp = new Date().toISOString();

            // Level 10: Performance - Use D1 Batch for true efficiency
            const batchQueries: any[] = [];
            const columnsCache = new Map<string, string[]>();
            const afterHooksToRun: { collection: string, id: string, type: 'create'|'delete', data?: any }[] = [];

            for (const item of items) {
                // If polymorphic, extract the actual data and collection
                const targetCollection = isPolymorphic ? (item.collection || collection) : collection;
                const rawData = isPolymorphic ? item.data : item;
                const type = isPolymorphic ? (item.type || 'create') : 'create';

                if (type === 'delete') {
                    const pk = getPrimaryKey(targetCollection, registry);
                    // Level 10: Flexible ID extraction (item.id OR data.id)
                    const targetId = item.id || (rawData && typeof rawData === 'object' ? rawData[pk] : undefined);
                    
                    if (!targetId) {
                        console.warn(`[BRAIN-DB-BATCH] Missing ID for delete operation for ${targetCollection}. Operation:`, item);
                        continue;
                    }

                    // --- ENTERPRISE LEVEL 10: V3 BEFORE DELETE (BATCH) ---
                    try {
                        await executeHook(targetCollection, 'beforeDelete', { 
                            id: targetId,
                            isBatch: true,
                            user, 
                            effectiveWorkspaceId, 
                            registry, 
                            db,
                            env: (ctx as any)?.env
                        });
                    } catch (e: any) {
                        console.warn(`[HOOK-BATCH-ERROR] beforeDelete failed for ${targetCollection}/${targetId}:`, e.message);
                        continue; // Skip this item
                    }

                    const entDef = (registry?.ENTITY_CONFIG || {})[targetCollection];
                    console.log(`[BRAIN-DB-BATCH] Adding DELETE for ${targetCollection}/${targetId}. SoftDelete: ${!!entDef?.features?.softDelete}`);

                    // Enterprise Level 10: Ultra-Resilient Batch Deletion
                    // We check if the physical table actually has the 'deletedAt' column 
                    // before attempting a soft delete, even if the registry says so.
                    let validColumns = columnsCache.get(targetCollection);
                    if (!validColumns) {
                        const foundColumns = await (db as any).getTableColumns?.(targetCollection).catch(() => []) || [];
                        validColumns = foundColumns;
                        columnsCache.set(targetCollection, foundColumns);
                    }

                    const hasDeletedAt = (validColumns || []).includes('deletedAt');

                    if (entDef?.features?.softDelete && hasDeletedAt) {
                        const hasDeletedBy = (validColumns || []).includes('deletedBy');
                        
                        const sql = `UPDATE "${resolveCollection(targetCollection, registry)}" SET deletedAt = ?${hasDeletedBy ? ', deletedBy = ?' : ''} WHERE "${pk}" = ?`;
                        const params = [timestamp];
                        if (hasDeletedBy) params.push(user.id || 'system');
                        params.push(targetId);
                        
                        batchQueries.push({ sql, params });
                    } else {
                        // Hard Delete Fallback
                        const sql = `DELETE FROM "${resolveCollection(targetCollection, registry)}" WHERE "${pk}" = ?`;
                        batchQueries.push({ sql, params: [targetId] });
                    }
                    results.push(targetId);
                    afterHooksToRun.push({ collection: targetCollection, id: targetId, type: 'delete' });
                    continue;
                }

                if (!rawData || typeof rawData !== 'object') {
                    console.warn(`[BRAIN-DB-BATCH] Skipping invalid item (no data):`, item);
                    continue;
                }

                // Normalize and sanitize
                const data = { 
                    ...deepStringify(rawData), 
                    createdBy: user.id || 'system', 
                    createdAt: timestamp, 
                    updatedAt: timestamp 
                };

                // --- ENTERPRISE LEVEL 10: V3 BEFORE CREATE (BATCH) ---
                try {
                    const hookResult = await executeHook(targetCollection, 'beforeCreate', { 
                        data, 
                        isBatch: true,
                        user, 
                        effectiveWorkspaceId, 
                        registry, 
                        db,
                        env: (ctx as any)?.env
                    });
                    if (hookResult && typeof hookResult === 'object') {
                        Object.assign(data, hookResult);
                    }
                } catch (e: any) {
                    console.warn(`[HOOK-BATCH-ERROR] beforeCreate failed for ${targetCollection}:`, e.message);
                    continue; // Skip this item
                }
                
                // Special check: ensure we don't accidentally import null/empty objects
                if (Object.keys(data).length <= 4 && !data.name && !data.email && !data.phone) {
                    continue; 
                }

                // Mandatory Workspace Isolation
                if (!isGlobalEntity(targetCollection, registry)) {
                    if (!data.workspaceId || !isWsAdmin) {
                        data.workspaceId = effectiveWorkspaceId;
                    }
                }

                const pk = getPrimaryKey(targetCollection, registry);
                if (!data[pk]) {
                    data[pk] = crypto.randomUUID();
                }

        // Level 10 Optimization: Build batch query instead of sequential awaits
        // We cache columns per request to avoid unnecessary PRAGMAs in the batch loop
        let validColumns = columnsCache.get(targetCollection);
        if (!validColumns) {
            try {
                const fetchedCols = await (db as any).getTableColumns?.(targetCollection).catch((e: any) => {
                    console.error(`[BRAIN-DB-BATCH] getTableColumns failed for ${targetCollection}:`, e.message);
                    return [];
                }) || [];
                validColumns = fetchedCols;
                columnsCache.set(targetCollection, fetchedCols);
            } catch (e) {
                validColumns = [];
            }
        }

        const filteredData = { ...data };
        if (Array.isArray(validColumns) && validColumns.length > 0) {
            Object.keys(filteredData).forEach(k => {
                if (Array.isArray(validColumns) && !validColumns.includes(k)) delete filteredData[k];
            });
        } else if (targetCollection !== 'batch') {
            // Enterprise Level 10: If we can't get columns for a specific table, it might not exist
            // This is a common cause of 400s during import if the migration hasn't run
            console.warn(`[BRAIN-DB-BATCH] ⚠️ No columns found for table "${targetCollection}". Is the table created?`);
        }

        const keys = Object.keys(filteredData).filter(k => filteredData[k] !== undefined);
        if (keys.length === 0) {
            console.warn(`[BRAIN-DB-BATCH] ⚠️ Skipping item for "${targetCollection}" because it has no valid columns to insert.`);
            continue;
        }

        try {
            const sql = `INSERT OR REPLACE INTO "${resolveCollection(targetCollection, registry)}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
            batchQueries.push({ sql, params: keys.map(k => filteredData[k]) });
            results.push(data[pk]);
            afterHooksToRun.push({ collection: targetCollection, id: data[pk], type: 'create', data });
        } catch (e: any) {
            return error(`Failed to construct batch query for ${targetCollection}: ${e.message}`, 400);
        }

                // D1 batch limit is 100 statements
                if (batchQueries.length >= 100) {
                    try {
                        await (db as any).batch(batchQueries);
                        
                        // --- ENTERPRISE LEVEL 10: V3 AFTER HOOKS (BATCH-CHUNK) ---
                        // Fire and forget to avoid blocking import flow
                        const hooksToRun = [...afterHooksToRun];
                        afterHooksToRun.length = 0;
                        for (const h of hooksToRun) {
                            executeHook(h.collection, h.type === 'create' ? 'afterCreate' : 'afterDelete', {
                                id: h.id,
                                data: h.data,
                                isBatch: true,
                                user,
                                effectiveWorkspaceId,
                                registry,
                                db,
                                env: (ctx as any)?.env
                            }).catch(err => console.error(`[HOOK-BATCH-POST-CHUNK-ERROR] ${h.collection}:`, err.message));
                        }
                    } catch (err: any) {
                        return error(`Batch execution failed: ${err.message}`, 400);
                    }
                    batchQueries.length = 0;
                }
            }

            // Final flush
            if (batchQueries.length > 0) {
                try {
                    await (db as any).batch(batchQueries);

                    // --- ENTERPRISE LEVEL 10: V3 AFTER HOOKS (BATCH-FINAL) ---
                    for (const h of afterHooksToRun) {
                        executeHook(h.collection, h.type === 'create' ? 'afterCreate' : 'afterDelete', {
                            id: h.id,
                            data: h.data,
                            isBatch: true,
                            user,
                            effectiveWorkspaceId,
                            registry,
                            db,
                            env: (ctx as any)?.env
                        }).catch(err => console.error(`[HOOK-BATCH-POST-FINAL-ERROR] ${h.collection}:`, err.message));
                    }
                } catch (err: any) {
                    return error(`Batch execution failed (Final): ${err.message}`, 400);
                }
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
        // Enterprise Level 10: Unified Polymorphic Query Engine
        if ((method === 'GET' || (method === 'POST' && action === 'read')) && !id) {
            let results: any[] | null = null;
            let isPopulated = false;
            
            // Enterprise Level 10: Advanced Workspace Isolation & Inheritance
            // We initialize filters from the body if it's a POST/Query, otherwise from empty or searchParams
            let filters: any = (method === 'POST') ? { ...body } : {};
            const isGlobal = isGlobalEntity(collection, registry);
            
            // Map workspaceId from path or params for explicit filtering
            const explicitWS = pathWorkspaceId || url.searchParams.get("workspaceId") || filters.workspaceId;

            if (collection === 'workspace') {
                if (!isSuper && !isWsAdmin) filters.ownerId = user.id;
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
                filters.workspaceId = explicitWS || user.workspaceId || 'system';
            }

            if (entityDef?.permission?.ownerOnly && !isSuper && !isWsAdmin) {
                filters.createdBy = user.id;
            }
            
            // Enterprise Level 10: Soft Delete Lifecycle Management
            if (entityDef?.features?.softDelete) {
                filters.deletedAt = null;
            }

            // --- STRATEGY 2: Global Search ---
            const searchQuery = url.searchParams.get("query");
            if (searchQuery && entityDef?.searchFields && Array.isArray(entityDef.searchFields)) {
                // Enterprise Level 10: High-Performance Global Search Overlay
                const searchFields = entityDef.searchFields;
                const searchClause = searchFields.map((f: string) => `"${f}" LIKE ?`).join(' OR ');
                const baseSql = `SELECT * FROM "${resolveCollection(collection, registry)}" WHERE (${searchClause})`;
                
                const sortBy = url.searchParams.get("sortBy") || "createdAt";
                const sortOrder = url.searchParams.get("sortOrder") || "DESC";
                const limit = parseInt(url.searchParams.get("limit") || "50");
                const offset = parseInt(url.searchParams.get("offset") || "0");

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

                finalSql += ` ORDER BY "${sortBy}" ${sortOrder} LIMIT ? OFFSET ?`;
                sqlParams.push(limit, offset);

                results = await db.query(finalSql, sqlParams);
            }

            // --- STRATEGY 3: Standard List / System Fallback ---
            if (!results) {
                const options: any = { 
                    sortBy: filters.sortBy || url.searchParams.get("sortBy") || "createdAt", 
                    sortOrder: filters.sortOrder || url.searchParams.get("sortOrder") || "DESC" 
                };
                if (filters.limit || url.searchParams.get("limit")) options.limit = parseInt(filters.limit || url.searchParams.get("limit")!);
                if (filters.offset || url.searchParams.get("offset")) options.offset = parseInt(filters.offset || url.searchParams.get("offset")!);

                // Clean up filters object so it only contains database columns
                const reservedKeys = ['pageSize', 'page', 'sortBy', 'sortOrder', 'limit', 'offset', 'workspaceId', 'entity', 'table', 'collection', 'items', 'data'];
                
                url.searchParams.forEach((v: string, k: string) => { 
                    if (!reservedKeys.includes(k)) filters[k] = v; 
                });
                
                // If it's a POST, the filters already contain the body. We remove reserved keys to avoid SQL errors.
                if (method === 'POST') {
                    reservedKeys.forEach(k => delete filters[k]);
                }
                
                // Enterprise Level 10: Dynamic System Participation (Multi-Tenant DNA)
                // Entities with isSystem, isGlobal or isCore automatically include records from 'system' workspace (Global Templates, Roles, etc.)
                const includeSystem = entityDef?.isSystem === true || entityDef?.isGlobal === true || entityDef?.isCore === true;

                if (includeSystem && !isSuper && effectiveWorkspaceId) {
                    const tableName = resolveCollection(collection, registry);
                    const sortBy = options.sortBy;
                    const sortOrder = options.sortOrder;
                    const limit = options.limit || 1000; // Higher limit for related data
                    const offset = options.offset || 0;
                    
                    let sql = `SELECT * FROM "${tableName}" WHERE (workspaceId = ? OR workspaceId = 'system')`;
                    const queryParams: any[] = [effectiveWorkspaceId];

                    if (entityDef?.features?.softDelete) {
                        sql += ` AND deletedAt IS NULL`;
                    }

                    Object.entries(filters).forEach(([k, v]) => {
                        if (k === 'workspaceId' || k === 'where') return;
                        sql += ` AND "${k}" = ?`;
                        queryParams.push(v);
                    });

                    sql += ` ORDER BY "${sortBy}" ${sortOrder} LIMIT ? OFFSET ?`;
                    queryParams.push(limit, offset);
                    results = await db.query(sql, queryParams);
                    console.log(`[LIST] System Entity ${collection} (${tableName}): fetched ${results?.length || 0} records, limit=${limit}, offset=${offset}`);
                } else {
                    // Enterprise Level 11: Ensure workspace filtering for non-system entities
                    // BUT: Skip workspaceId filter for entities that exclude it from base fields
                    const excludesWorkspaceId = Array.isArray(entityDef?.excludeBaseFields) 
                        && entityDef.excludeBaseFields.includes('workspaceId');
                    
                    if (effectiveWorkspaceId && !filters.workspaceId && !excludesWorkspaceId) {
                        filters.workspaceId = effectiveWorkspaceId;
                    }
                    results = await db.list(collection, filters, options);
                    console.log(`[LIST] Regular Entity ${collection}: fetched ${results?.length || 0} records, filters=${JSON.stringify(filters)}, limit=${options.limit || 1000}`);
                }
            }

            if (!results) return error(`Failed to retrieve records for ${collection}`, 500);

            // Enterprise Level 10: Unified Relation Population Protocol
            if (results.length > 0 && entityDef?.fields) {
                // Determine which fields to populate based on Registry or direct relations
                const dependencies = Array.isArray(entityDef.dependencies) ? entityDef.dependencies : [];
                
                // Resilient field iteration for population (Support Map & Array)
                const allFields = Array.isArray(entityDef.fields) 
                    ? entityDef.fields.map((f: any) => [f.name || f.id, f])
                    : Object.entries(entityDef.fields);

                const fieldsToPopulate = allFields.filter(([name, f]: any) => {
                    const fd = f as any;
                    const isRel = fd.type === 'relation' || fd.type === 'relation-many' || fd.type === 'entity_relation' || fd.type === 'tag' || fd.type === 'multi-select';
                    if (!isRel) return false;
                    const target = (fd.relation?.target || fd.relationEntity || (fd.type === 'tag' ? 'tag' : '') || '').toLowerCase();
                    // We populate if it's a relation-many/tag/multi-select OR if it's explicitly listed in dependencies
                    return fd.type === 'relation-many' || fd.type === 'tag' || fd.type === 'multi-select' || dependencies.map((d: any) => String(d).toLowerCase()).includes(target);
                });

                if (fieldsToPopulate.length > 0) {
                    const pkField = getPrimaryKey(collection, registry);
                    const recordIds = results.map(i => i[pkField] || i.id).filter(Boolean);
                    
                    for (const [fieldName, fieldDef] of fieldsToPopulate) {
                        try {
                            const def = fieldDef as any;
                            const targetEntity = def.relationEntity || def.relation?.target || (def.type === 'tag' ? 'tag' : '');
                            if (!targetEntity) continue;

                            const targetPk = getPrimaryKey(targetEntity, registry);

                            if (def.type === 'relation-many' || def.type === 'tag' || def.type === 'multi-select') {
                                // --- MANY-TO-MANY (Universal via entity_relation_many) ---
                                // Enterprise Level 10: Deterministic D1 Chunking (Max Variable Safety)
                                const assignments: any[] = [];
                                const CHUNK_SIZE = 80;
                                for (let i = 0; i < recordIds.length; i += CHUNK_SIZE) {
                                    const chunk = recordIds.slice(i, i + CHUNK_SIZE);
                                    const chunkPlaceholder = chunk.map(() => '?').join(',');
                                    const chunkAssignments = await db.query(`SELECT sourceId as entityId, targetId as tagId FROM entity_relation_many WHERE sourceType = ? AND (fieldName = ? OR fieldName IS NULL) AND sourceId IN (${chunkPlaceholder})`, [collection, fieldName, ...chunk]).catch(() => []);
                                    assignments.push(...chunkAssignments);
                                }
                                
                                const columnIds: string[] = [];
                                for (const item of results) {
                                    const val = item[fieldName];
                                    if (typeof val === 'string' && val) {
                                        // Enterprise Level 10: Universal Relation-Many/Tag Transformer
                                        let ids: string[] = [];
                                        const cleanVal = val.trim();
                                        if (cleanVal.startsWith('[') && cleanVal.endsWith(']')) {
                                            try {
                                                const parsed = JSON.parse(cleanVal);
                                                ids = (Array.isArray(parsed) ? parsed : [parsed]).map(v => typeof v === 'object' && v ? v[targetPk] || v.id || v : String(v));
                                            } catch {
                                                ids = cleanVal.split(/[,;|]/).map((s: string) => s.trim().replace(/[\\"[\]]/g, '')).filter(Boolean);
                                            }
                                        } else {
                                            ids = cleanVal.split(/[,;|]/).map((s: string) => s.trim().replace(/[\\"[\]]/g, '')).filter(Boolean);
                                        }
                                        columnIds.push(...ids);
                                    } else if (Array.isArray(val)) {
                                        const ids = val.map((v: any) => typeof v === 'object' && v ? v[targetPk] || v.id || v : String(v)).filter(Boolean);
                                        columnIds.push(...ids);
                                    }
                                }

                                const allRelatedIds = [...new Set([...assignments.map((a: any) => a.tagId), ...columnIds])].filter(Boolean);

                                if (allRelatedIds.length > 0) {
                                    // Enterprise Level 10: Deterministic D1 Chunking (Max Variable Safety)
                                    const relatedObjects: any[] = [];
                                    const CHUNK_SIZE = 80;
                                    for (let i = 0; i < allRelatedIds.length; i += CHUNK_SIZE) {
                                        const chunk = allRelatedIds.slice(i, i + CHUNK_SIZE);
                                        const chunkResults = await db.query(`SELECT * FROM "${resolveCollection(targetEntity, registry)}" WHERE "${targetPk}" IN (${chunk.map(() => '?').join(',')})`, chunk).catch(() => []);
                                        relatedObjects.push(...chunkResults);
                                    }
                                    const objectMap = new Map(relatedObjects.map((obj: any) => [String(obj[targetPk] || obj.id || obj), deepParse(obj)]));

                                    for (const item of results) {
                                        const combinedIds = new Set<string>();
                                        const itemId = String(item[pkField] || item.id);
                                        
                                        assignments.filter((a: any) => String(a.entityId) === itemId).forEach((a: any) => combinedIds.add(String(a.tagId)));
                                        
                                        const val = item[fieldName];
                                        if (typeof val === 'string' && val) {
                                            // Enterprise Level 10: Universal Relation-Many/Tag Transformer
                                            let ids: string[] = [];
                                            const cleanVal = val.trim();
                                            if (cleanVal.startsWith('[') && cleanVal.endsWith(']')) {
                                                try {
                                                    const parsed = JSON.parse(cleanVal);
                                                    ids = (Array.isArray(parsed) ? parsed : [parsed]).map(v => typeof v === 'object' && v ? v[targetPk] || v.id || v : String(v));
                                                } catch {
                                                    ids = cleanVal.split(/[,;|]/).map((s: string) => s.trim().replace(/[\\"[\]]/g, '')).filter(Boolean);
                                                }
                                            } else {
                                                ids = cleanVal.split(/[,;|]/).map((s: string) => s.trim().replace(/[\\"[\]]/g, '')).filter(Boolean);
                                            }
                                            ids.forEach((id: string) => combinedIds.add(String(id)));
                                        } else if (Array.isArray(val)) {
                                            val.forEach((v: any) => combinedIds.add(String(v[targetPk] || v.id || v)));
                                        }

                                        item[fieldName] = Array.from(combinedIds).map(id => objectMap.get(id) || { [targetPk]: id, id });
                                    }
                                }
                            } else {
                                // --- ONE-TO-MANY / DIRECT RELATION ---
                                const allRelatedIds = [...new Set(results.map(i => {
                                    const val = i[fieldName];
                                    return (typeof val === 'object' && val) ? val[targetPk] || val.id : val;
                                }))].filter(Boolean);
                                
                                if (allRelatedIds.length > 0) {
                                    // Enterprise Level 10: Deterministic D1 Chunking (Max Variable Safety)
                                    const relatedObjects: any[] = [];
                                    const CHUNK_SIZE = 80;
                                    for (let i = 0; i < allRelatedIds.length; i += CHUNK_SIZE) {
                                        const chunk = allRelatedIds.slice(i, i + CHUNK_SIZE);
                                        const chunkResults = await db.query(`SELECT * FROM "${resolveCollection(targetEntity, registry)}" WHERE "${targetPk}" IN (${chunk.map(() => '?').join(',')})`, chunk);
                                        relatedObjects.push(...chunkResults);
                                    }
                                    const objectMap = new Map(relatedObjects.map((obj: any) => [String(obj[targetPk] || obj.id || obj), deepParse(obj)]));
                                    
                                    for (const item of results) {
                                        const id = String(item[fieldName]?.id || item[fieldName]);
                                        if (id && id !== 'undefined' && id !== 'null') {
                                            item[fieldName] = objectMap.get(id) || { [targetPk]: id, id };
                                        }
                                    }
                                }
                            }
                        } catch (e: any) {
                            console.warn(`[BRAIN-LIST-REL] Failed to populate ${fieldName} for ${collection}:`, e.message);
                        }
                    }
                }
            }

            const finalResults = results.map(deepParse);
            console.log(`[BRAIN-RESPONSE] GET /api/${collection}: returning ${finalResults.length} records. First record sample:`, finalResults[0] ? JSON.stringify(finalResults[0]).substring(0, 200) : 'NO DATA');
            return success(finalResults); 
        }

        if (method === 'GET' && id) {
            try {
                let item = await db.get(collection, id);

                // --- ENTERPRISE LEVEL 10: REGISTRY-DRIVEN SYSTEM FALLBACKS ---
                // If a role is not found in D1, check the Registry-Baseline (SSOT)
                if (!item && collection === 'role') {
                    const registry = await mergeRegistryWithD1(db);
                    const systemRoles = registry.SYSTEM_ROLE || {};
                    if (systemRoles && systemRoles[id]) {
                        console.log(`[BRAIN-DB] Role '${id}' not in DB, falling back to Registry Baseline`);
                        const roleDef = systemRoles ? systemRoles[id] : undefined;
                        item = {
                            id,
                            name: id,
                            label: roleDef.label,
                            color: roleDef.color,
                            description: roleDef.description,
                            permission: roleDef.permission,
                            isSystem: true
                        };
                    }
                }

                if (!item) {
                   console.log(`[BRAIN-DB] Item not found by ID: collection=${collection}, id=${id}. Trying alternative lookups...`);
                   
                   // Enterprise Level 10: Dynamic ID Lookup via Registry Metadata
                   const fields = entityDef?.fields || {};
                   const altFields = Object.values(fields)
                    .filter((f: any) => f.unique === true || f.isId === true || ['userId', 'email', 'phone', 'slug'].includes(f.name))
                    .map((f: any) => f.name || f.id);

                   if (altFields.length === 0) altFields.push('userId', 'email', 'name', 'slug');

                   const table = resolveCollection(collection, registry);
                   const validCols = await (db as any).getTableColumns?.(collection).catch(() => []) || [];
                   
                   for (const field of altFields) {
                       if (validCols.length > 0 && !validCols.includes(field)) continue;
                       
                       const results = await db.query(`SELECT * FROM "${table}" WHERE "${field}" = ? LIMIT 1`, [id]).catch(() => []);
                       if (results && results[0]) {
                           item = results[0];
                           console.log(`[BRAIN-DB-RECOVER] Found ${collection} record using field '${field}' for ID: ${id}`);
                           break;
                       }
                   }
                }

                if (!item) {
                   console.log(`[BRAIN-DB] 404 Item not found: collection=${collection}, id=${id}. Final recovery attempt...`);
                   
                   // Enterprise Level 10: Final Case-Insensitive Recovery for Strings
                   const table = resolveCollection(collection, registry);
                   const pk = getPrimaryKey(collection, registry);
                   const finalTry = await db.query(`SELECT * FROM "${table}" WHERE LOWER("${pk}") = LOWER(?) LIMIT 1`, [id]).catch(() => []);
                   
                   if (finalTry && finalTry[0]) {
                       item = finalTry[0];
                       console.log(`[BRAIN-DB-RECOVER] Found record via Case-Insensitive query: ${id}`);
                   } else {
                        return error("Not found", 404);
                   }
                }
                
                // Enterprise Level 10: Recursive Population Engine
                if (entityDef && entityDef.fields) {
                    const dependencies = Array.isArray(entityDef.dependencies) ? entityDef.dependencies : [];
                    const pkField = getPrimaryKey(collection, registry);
                    const itemId = String(item[pkField] || item.id);

                    // Resilient field iteration for single record population
                    const allFields = Array.isArray(entityDef.fields) 
                        ? entityDef.fields.map((f: any) => [f.name || f.id, f])
                        : Object.entries(entityDef.fields);

                    for (const [rawFieldName, fieldDef] of allFields) {
                        const def = fieldDef as any;
                        const fieldName = String(def.name || rawFieldName);
                        const target = (def.relation?.target || def.relationEntity || '').toLowerCase();
                        if (!target) continue;
                        const targetPk = getPrimaryKey(target, registry);

                        try {
                            const isMany = def.type === 'relation-many' || def.type === 'tag' || def.type === 'multi-select' || def.multiple === true;
                            
                            if (isMany) {
                                const assignments = await db.query("SELECT targetId as tagId FROM entity_relation_many WHERE sourceType = ? AND sourceId = ? AND (fieldName = ? OR fieldName IS NULL)", [collection, itemId, fieldName]).catch(() => []);
                                const tagIds = assignments.map((a: any) => String(a.tagId));
                                
                                // Also check internal column for IDs (Case-insensitive)
                                const colVal = getValCi(item, fieldName);
                                if (typeof colVal === 'string' && colVal) {
                                    // Enterprise Level 10: Universal Relation-Many/Tag Transformer
                                    let ids: string[] = [];
                                    const cleanVal = colVal.trim();
                                    if (cleanVal.startsWith('[') && cleanVal.endsWith(']')) {
                                        try {
                                            const parsed = JSON.parse(cleanVal);
                                            ids = (Array.isArray(parsed) ? parsed : [parsed]).map(v => typeof v === 'object' && v ? v[targetPk] || v.id || v : String(v));
                                        } catch {
                                            ids = cleanVal.split(/[,;|]/).map((s: string) => s.trim().replace(/[\\"]/g, '')).filter(Boolean);
                                        }
                                    } else {
                                        ids = cleanVal.split(/[,;|]/).map((s: string) => s.trim().replace(/[\\"[\]]/g, '')).filter(Boolean);
                                    }
                                    ids.forEach((id: string) => { if(!tagIds.includes(String(id))) tagIds.push(String(id)); });
                                } else if (Array.isArray(colVal)) {
                                    colVal.forEach((v: any) => {
                                        const sid = String(typeof v === 'object' ? (v[targetPk] || v.id || v) : v);
                                        if(!tagIds.includes(sid)) tagIds.push(sid);
                                    });
                                }

                                if (tagIds.length > 0) {
                                    // Enterprise Level 10: Deterministic D1 Chunking (Max Variable Safety)
                                    const relObjects: any[] = [];
                                    const CHUNK_SIZE = 80;
                                    for (let i = 0; i < tagIds.length; i += CHUNK_SIZE) {
                                        const chunk = tagIds.slice(i, i + CHUNK_SIZE);
                                        const chunkResults = await db.query(`SELECT * FROM "${resolveCollection(target, registry)}" WHERE "${targetPk}" IN (${chunk.map(() => '?').join(', ')})`, chunk).catch(() => []);
                                        relObjects.push(...chunkResults);
                                    }
                                    item[fieldName] = relObjects.map(deepParse);
                                } else {
                                    item[fieldName] = [];
                                }
                            } else if ((def.type === 'relation' || def.type === 'entity_relation') && (dependencies.map((d: any) => String(d).toLowerCase()).includes(target) || def.populate)) {
                                const relId = getValCi(item, fieldName);
                                if (relId) {
                                    const sid = typeof relId === 'object' ? (getValCi(relId, targetPk) || relId.id) : relId;
                                    const relObj = await db.get(target, String(sid));
                                    if (relObj) item[fieldName] = deepParse(relObj);
                                }
                            }
                        } catch (e: any) {
                            console.warn(`[BRAIN-GET-REL] Failed to populate ${fieldName}:`, e.message);
                        }
                    }
                }
                
                // Soft Delete check
                if (entityDef?.features?.softDelete && item.deletedAt) {
                    return error("Item has been deleted", 404);
                }

                // Enterprise Level 10: Mandatory Security & RBAC Enforcement
                // 1. SuperAdmins see everything
                // 2. workspace is a special global collection
                // 3. For everything else, check workspaceId ownership
                if (!isSuper && collection !== 'workspace') {
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
        if (method === 'POST' && (!id || id === 'new' || id === 'create')) {
            // Check if body is provided
            if (!body || Object.keys(body).length === 0) {
                // Use request instead of ctx (fix ReferenceError)
                const bodyUsed = typeof request !== 'undefined' ? request.bodyUsed : undefined;
                const contentType = typeof request !== 'undefined' ? request.headers.get('content-type') : undefined;
                console.warn(`[BRAIN-DB-POST] 400 Bad Request: Empty body for collection ${collection}. BodyUsed: ${bodyUsed}, CT: ${contentType}`);
                return error("Request body is required for POST requests (or body was consumed before parsing)", 400);
            }
            
            const data: any = { ...deepStringify(body), createdBy: user.id };
            
            const isGlobal = isGlobalEntity(collection, registry);
            if (!isGlobal) data.workspaceId = effectiveWorkspaceId;
            
            // Enterprise Level 10: Atomic Workspace Isolation
            if (!isWsAdmin && collection !== 'workspace' && !isGlobal) {
                data.workspaceId = effectiveWorkspaceId;
            }
            
            const pk = getPrimaryKey(collection, registry);
            if (!data[pk]) {
                // Enterprise Level 10: Immutable Global ID Protocol (UUID v4)
                // Unified across all entities for maximum consistency and security.
                data[pk] = crypto.randomUUID();
            }
            
            // Ensure workspaceId is set for non-global entities
            if (!isGlobal && !data.workspaceId) {
                data.workspaceId = effectiveWorkspaceId || 'system';
            }
            
            // Enterprise Level 10: Schema-Level DNA Validation
            const entityDef = registry.ENTITY_CONFIG[collection];
            if (entityDef && entityDef.fields) {
                // Enterprise Level 10: High-Resilience Field Mapping
                // Handles both the Map-based fields (Legacy/Registry) and Array-based fields (Builder/D1)
                const fieldsToValidate = Array.isArray(entityDef.fields) 
                    ? entityDef.fields.map((f: any) => [f.name || f.id, f])
                    : Object.entries(entityDef.fields);

                for (const [rawFieldName, fieldDef] of fieldsToValidate) {
                    // Safety check: ensure we have a valid field definition
                    if (!fieldDef || typeof fieldDef !== 'object') continue;

                    const def = fieldDef as any;
                    const fieldName = String(def.name || rawFieldName);

                    // Skip generated fields - they are handled by backend
                    if (def.generated) continue;
                    
                    const value = data[fieldName];
                    const isEmpty = value === undefined || value === null || value === '';

                    if (def.required && isEmpty) {
                        return error(`Câmpul obligatoriu '${fieldName}' lipsește sau este gol`, 400);
                    }
                    
                    // Validate email format
                    if (def.format === 'email' && value && typeof value === 'string') {
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(value)) {
                            return error(`Format email invalid pentru '${fieldName}'`, 400);
                        }
                    }
                }
            }

            // --- ENTERPRISE LEVEL 10: V3 BEFORE CREATE HOOK ---
            try {
                const hookResult = await executeHook(collection, 'beforeCreate', { 
                    data, 
                    user, 
                    effectiveWorkspaceId, 
                    registry, 
                    db,
                    env: (ctx as any)?.env
                });
                if (hookResult && typeof hookResult === 'object') {
                    // Update data if hook returned something
                    Object.assign(data, hookResult);
                }
            } catch (e: any) {
                return error(`V3 Hook Error (beforeCreate): ${e.message}`, 400);
            }
            
            console.log(`[BRAIN-DB-POST] Creating ${collection}:`, { data: Object.keys(data), user: { id: user.id, workspaceId: user.workspaceId }, effectiveWorkspaceId, isGlobal });
            
            // Handle relation-many fields by extracting them before insert
            const relationManyFields: any = {};
            if (entityDef && entityDef.fields) {
                const fields = Array.isArray(entityDef.fields) ? entityDef.fields : Object.values(entityDef.fields);
                for (const fieldDef of fields) {
                    const def = fieldDef as any;
                    const isRelMany = def.type === 'relation-many' || def.type === 'tag' || def.type === 'multi-select';
                    if (isRelMany && data[def.name]) {
                        relationManyFields[def.name] = data[def.name];
                        // Actually, for simplicity, we move ALL to entity_relation_many (Universal)
                        // and store them as comma-separated in the column too if it exists.
                        // But let's follow the established pattern.
                        delete data[def.name]; 
                    }
                }
            }
            
            await db.create(collection, data);

            // Enterprise Level 10: Performance Optimization - Fetch snapshot only ONCE
            let createdRecord = null;
            if (!registry?.CONSTANT?.auditExclusion?.includes(collection) || entityDef?.actions?.some((a: any) => a.id === 'on-create')) {
                createdRecord = await db.get(collection, data[pk]).catch(() => null);
            }

            // Enterprise Level 10: Unified Audit Engine (POST)
            if (!registry?.CONSTANT?.auditExclusion?.includes(collection)) {
                try {
                    const displayValue = getDisplayValue(createdRecord || data, entityDef);
                    
                    await db.create('audit_log', {
                        id: crypto.randomUUID(),
                        workspaceId: data.workspaceId || user.workspaceId || 'system',
                        entityType: collection,
                        entityId: String(data[pk]),
                        action: 'create',
                        snapshot_after: JSON.stringify(createdRecord || data),
                        display_value: displayValue,
                        user: user.email || user.id || 'system',
                        userId: user.id || 'system',
                        createdAt: new Date().toISOString()
                    });
                } catch (auditErr: any) {
                    console.warn(`[AUDIT-POST-FAILED] ${collection}:`, auditErr.message);
                }
            }
            
            // Create relation-many assignments
            for (const [fieldName, value] of Object.entries(relationManyFields)) {
                let ids: string[] = [];
                if (Array.isArray(value)) {
                    ids = value.map((v: any) => typeof v === 'object' ? (v.id || v.ID || v) : String(v)).filter(Boolean);
                } else if (typeof value === 'string' && value) {
                    ids = value.split(',').map((id: string) => id.trim()).filter((id: string) => id);
                }

                if (ids.length > 0) {
                    // Enterprise Level 10: Batch optimization for relationships (POST)
                    const fieldDef = (Array.isArray(entityDef.fields) ? entityDef.fields : Object.values(entityDef.fields)).find((f: any) => (f.name === fieldName || f.id === fieldName)) as any;
                    const targetEntity = fieldDef?.relation?.target || (fieldDef?.type === 'tag' ? 'tag' : 'unknown');
                    
                    const batch = ids.map(relatedId => ({
                        sql: `INSERT INTO entity_relation_many (id, workspaceId, targetId, targetType, sourceType, sourceId, fieldName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        params: [
                            crypto.randomUUID(),
                            data.workspaceId || effectiveWorkspaceId || 'system',
                            relatedId,
                            targetEntity,
                            collection,
                            data.id,
                            fieldName,
                            new Date().toISOString(),
                            new Date().toISOString()
                        ]
                    }));

                    if (batch.length > 0) {
                        await db.batch(batch).catch((e: any) => console.warn(`[BRAIN-DB] Failed to batch ${fieldName} assignments:`, e.message));
                    }
                }
            }

            // --- STAGE 7: TRIGGER SYSTEM (Internal Pub/Sub) ---
            if (entityDef?.actions?.some((a: any) => a.id === 'on-create')) {
                const trigger = entityDef.actions.find((a: any) => a.id === 'on-create');
                console.log(`[TRIGGER] Executing on-create for ${collection}:${data[pk]}`);
                // Execute trigger asynchronously (Fire and Forget or background)
                trigger.handler({ ...ctx, db, user, registry, env }, createdRecord || data).catch((e: any) => {
                    console.error(`[TRIGGER-ERROR] on-create ${collection}:`, e.message);
                });
            }
            
            // Level 10 Configuration Pulse
            if (entityDef?.isSystem || entityDef?.isGlobal) {
                global.CACHED_CONFIGS = {};
            }
            
            // --- PERMISSION CACHE INVALIDATION ---
            // Level 10: Logic moved to Entity Hooks (contact.ts, workspace_user.ts)
            
            return success(deepParse(data));
        }

        // ... (rest of the handler)


        // PUT/PATCH (Update, Archive, Restore)
        if (['PUT', 'PATCH'].includes(method) && id) {
            if (subAction === 'archive') {
                const archiveData = { archived: 1, archivedAt: new Date().toISOString() };
                await db.update(collection, id, archiveData);
                
                // Trigger modular hook
                await executeHook(collection, 'afterUpdate', { 
                    ctx, id, data: archiveData, user, registry, db, env: ctx.env 
                }).catch(() => {});

                return success({ id, archived: 1 });
            }
            if (subAction === 'restore') {
                const restoreData = { archived: 0, archivedAt: null };
                await db.update(collection, id, restoreData);
                
                // Trigger modular hook
                await executeHook(collection, 'afterUpdate', { 
                    ctx, id, data: restoreData, user, registry, db, env: ctx.env 
                }).catch(() => {});

                return success({ id, archived: 0 });
            }
            
            const updates = { ...deepStringify(body), updatedAt: new Date().toISOString(), updatedBy: user.id };
            
            // --- ENTERPRISE LEVEL 10: V3 BEFORE UPDATE HOOK ---
            try {
                const snapshotBefore = await db.get(collection, id).catch(() => null);
                const hookResult = await executeHook(collection, 'beforeUpdate', { 
                    id,
                    data: updates, 
                    previousData: snapshotBefore,
                    user, 
                    effectiveWorkspaceId, 
                    registry, 
                    db,
                    env: (ctx as any)?.env
                });
                if (hookResult && typeof hookResult === 'object') {
                    // Update the updates object if hook returned something
                    Object.assign(updates, hookResult);
                }
            } catch (e: any) {
                return error(`V3 Hook Error (beforeUpdate): ${e.message}`, 400);
            }

            // Enterprise Level 10: Registry-Driven Precision Validation
            if (entityDef && entityDef.fields) {
                // Enterprise Level 10: Resilient Field Update Transformation
                const fieldsToValidate = Array.isArray(entityDef.fields) 
                    ? entityDef.fields.map((f: any) => [f.name || f.id, f])
                    : Object.entries(entityDef.fields);

                for (const [rawFieldName, fieldDef] of fieldsToValidate) {
                    if (!fieldDef || typeof fieldDef !== 'object') continue;
                    const def = fieldDef as any;
                    const fieldName = String(def.name || rawFieldName);
                    
                    // We only validate fields that are present in the 'updates' object
                    // This allows partial updates (PATCH style) while still enforcing requirements if the value is being set to empty
                    if (updates[fieldName] !== undefined) {
                        const value = updates[fieldName];
                        const isEmpty = value === undefined || value === null || value === '';
                        
                        if (def.required && isEmpty) {
                            return error(`Câmpul obligatoriu '${fieldName}' nu poate fi gol`, 400);
                        }
                        
                        if (def.format === 'email' && value && typeof value === 'string') {
                            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                            if (!emailRegex.test(value)) {
                                return error(`Format email invalid pentru '${fieldName}'`, 400);
                            }
                        }
                    }
                }
            }

            // Handle relation-many fields by extracting them before update
            const relationManyFields: any = {};
            if (entityDef && entityDef.fields) {
                const fields = Array.isArray(entityDef.fields) ? entityDef.fields : Object.values(entityDef.fields);
                for (const fieldDef of fields) {
                    const def = fieldDef as any;
                    const isRelMany = def.type === 'relation-many' || def.type === 'tag' || def.type === 'multi-select';
                    if (isRelMany && updates[def.name] !== undefined) {
                        relationManyFields[def.name] = updates[def.name];
                        delete updates[def.name]; // Remove from updates
                    }
                }
            }
            
            // Enterprise Level 10: Immutable Workspace Integrity Guard
            if (!isWsAdmin) {
                delete updates.workspaceId;
            }

            // Enterprise Level 10: State Snapshotting (Before Update)
            let snapshotBefore = null;
            if (!registry?.CONSTANT?.auditExclusion?.includes(collection)) {
                snapshotBefore = await db.get(collection, id).catch(() => null);
            }

            await db.update(collection, id, updates);

            // Enterprise Level 10: Performance Optimization - Fetch snapshot only ONCE
            const snapshotAfter = await db.get(collection, id).catch(() => null);

            // Enterprise Level 10: Unified Audit Engine (UPDATE)
            if (!registry?.CONSTANT?.auditExclusion?.includes(collection)) {
                try {
                    const displayValue = getDisplayValue(snapshotAfter || updates, entityDef);
                    
                    await db.create('audit_log', {
                        id: crypto.randomUUID(),
                        workspaceId: user.workspaceId || 'system',
                        entityType: collection,
                        entityId: String(id),
                        action: 'update',
                        snapshot_before: snapshotBefore ? JSON.stringify(snapshotBefore) : null,
                        snapshot_after: JSON.stringify(snapshotAfter || updates),
                        display_value: displayValue,
                        user: user.email || user.id || 'system',
                        userId: user.id || 'system',
                        createdAt: new Date().toISOString()
                    });
                } catch (auditErr: any) {
                    console.warn(`[AUDIT-UPDATE-FAILED] ${collection}:`, auditErr.message);
                }
            }

            // --- STAGE 7: TRIGGER SYSTEM (Internal Pub/Sub) ---
            if (entityDef?.actions?.some((a: any) => a.id === 'on-update')) {
                const trigger = entityDef.actions.find((a: any) => a.id === 'on-update');
                trigger.handler({ ...ctx, db, user, registry, env }, snapshotAfter, snapshotBefore).catch((e: any) => {
                    console.error(`[TRIGGER-ERROR] on-update ${collection}:`, e.message);
                });
            }
            
            // Enterprise Level 10: Workflow State Transition Trigger
            if (updates.status) {
                await triggerFlowActions(db, collection, id, updates.status, registry, user, env);
            }

            // Update relation-many assignments
            for (const [fieldName, value] of Object.entries(relationManyFields)) {
                // Enterprise Level 10: Performance-Optimized Many-to-Many Sync
                let ids: string[] = [];
                if (Array.isArray(value)) {
                    ids = value.map((v: any) => typeof v === 'object' ? (v.id || v.ID || v) : String(v)).filter(Boolean);
                } else if (typeof value === 'string' && value) {
                    ids = value.split(',').map((id: string) => id.trim()).filter((id: string) => id);
                }

                const fieldDef = (Array.isArray(entityDef.fields) ? entityDef.fields : Object.values(entityDef.fields)).find((f: any) => f.name === fieldName) as any;
                const targetEntity = fieldDef?.relation?.target || (fieldDef?.type === 'tag' ? 'tag' : 'unknown');

                const batch = [
                    {
                        sql: "DELETE FROM entity_relation_many WHERE sourceType = ? AND sourceId = ? AND (fieldName = ? OR fieldName IS NULL)",
                        params: [collection, id, fieldName]
                    },
                    ...ids.map(relatedId => ({
                        sql: `INSERT INTO entity_relation_many (id, workspaceId, targetId, targetType, sourceType, sourceId, fieldName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        params: [
                            crypto.randomUUID(),
                            effectiveWorkspaceId || 'system',
                            relatedId,
                            targetEntity,
                            collection,
                            id,
                            fieldName,
                            new Date().toISOString(),
                            new Date().toISOString()
                        ]
                    }))
                ];

                if (batch.length > 0) {
                    await db.batch(batch).catch((e: any) => console.warn(`[BRAIN-DB] Failed to sync ${fieldName} assignments:`, e.message));
                }
            }
            
            const updated = snapshotAfter;

            // --- ENTERPRISE LEVEL 10: V3 AFTER UPDATE HOOK ---
            try {
                await executeHook(collection, 'afterUpdate', { 
                    id,
                    data: updated || { id, ...updates }, 
                    user, 
                    effectiveWorkspaceId, 
                    registry, 
                    db,
                    env: (ctx as any)?.env
                });
            } catch (e: any) {
                console.error(`[HOOK-ERROR] afterUpdate failed for ${collection}:`, e.message);
            }

            // Level 10 Configuration Pulse
            if (entityDef?.isSystem || entityDef?.isGlobal) {
                global.CACHED_CONFIGS = {};
            }
            
            return success(deepParse(updated || { id, ...updates }));
        }

        // DELETE
        if (method === 'DELETE' && id) {
            console.log(`[BRAIN-DB-DELETE] Attempting to delete ${collection}/${id}. SoftDelete: ${entityDef?.features?.softDelete}`);
            
            // Enterprise Level 10: State Snapshotting (Before Delete)
            let snapshotBefore = null;
            if (!registry?.CONSTANT?.auditExclusion?.includes(collection)) {
                snapshotBefore = await db.get(collection, id).catch(() => null);
            }

            // Enterprise Level 10: Protection for System/Core Entity Definitions
            const targetDef = (registry.ENTITY_CONFIG || {})[id || ''];
            if (collection === 'entity_definition' && (targetDef?.isCore || targetDef?.isSystem)) {
                console.warn(`[BRAIN-DB-DELETE] Blocked deletion of CORE/SYSTEM DEFINITION: ${id}`);
                return error(renderString({
                    ro: `Definiția entității sistem '${id}' nu poate fi ștearsă. Este protejată de arhitectura SSOT.`,
                    en: `System entity definition '${id}' cannot be deleted. It is protected by SSOT architecture.`
                }, selectedLang), 403);
            }
            
            // Enterprise Level 10: Deep Dependency Safety Sentinel
            const force = url.searchParams.get("force") === "true";
            if (!force) {
                const deps = await getEntityDependencies(db, collection ?? '', id ?? '', registry);
                if (deps.length > 0) {
                    console.log(`[BRAIN-DB-DELETE] Dependencies found for ${collection}/${id}: ${deps.length}`);
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

            // --- ENTERPRISE LEVEL 10: V3 BEFORE DELETE HOOK ---
            try {
                await executeHook(collection, 'beforeDelete', { 
                    id,
                    previousData: snapshotBefore,
                    user, 
                    effectiveWorkspaceId, 
                    registry, 
                    db,
                    env: (ctx as any)?.env
                });
            } catch (e: any) {
                return error(`V3 Hook Error (beforeDelete): ${e.message}`, 400);
            }

            if (entityDef?.features?.softDelete) {
                console.log(`[BRAIN-DB-DELETE] Performing SOFT-DELETE for ${collection}/${id}`);
                
                // Enterprise Level 10: Dynamic Column Discovery Check
                const validColumns = await (db as any).getTableColumns?.(collection).catch(() => []) || [];
                const hasDeletedBy = validColumns.includes('deletedBy');
                
                const updateData: any = {
                    deletedAt: new Date().toISOString()
                };
                if (hasDeletedBy) updateData.deletedBy = user.id;

                await db.update(collection, id, updateData);

                // Enterprise Level 10: Unified Audit Engine (SOFT-DELETE)
                if (!registry?.CONSTANT?.auditExclusion?.includes(collection)) {
                    try {
                        const displayValue = getDisplayValue(snapshotBefore, entityDef);
                        await db.create('audit_log', {
                            id: crypto.randomUUID(),
                            workspaceId: user.workspaceId || 'system',
                            entityType: collection,
                            entityId: String(id),
                            action: 'delete',
                            snapshot_before: snapshotBefore ? JSON.stringify(snapshotBefore) : null,
                            display_value: displayValue,
                            user: user.email || user.id || 'system',
                            userId: user.id || 'system',
                            createdAt: new Date().toISOString()
                        });
                    } catch (auditErr: any) {
                        console.warn(`[AUDIT-DELETE-FAILED] ${collection}:`, auditErr.message);
                    }
                }

                return success({ id, deleted: true, soft: true });
            }
            
            console.log(`[BRAIN-DB-DELETE] Performing HARD-DELETE for ${collection}/${id}`);
            // Delete polymorphic relation assignments before deleting the main record
            await db.query("DELETE FROM entity_relation_many WHERE sourceType = ? AND sourceId = ?", [collection, id]).catch(() => {});
            
            await db.delete(collection, id);

            // Enterprise Level 10: Unified Audit Engine (HARD-DELETE)
            if (!registry?.CONSTANT?.auditExclusion?.includes(collection)) {
                try {
                    const displayValue = getDisplayValue(snapshotBefore, entityDef);
                    await db.create('audit_log', {
                        id: crypto.randomUUID(),
                        workspaceId: user.workspaceId || 'system',
                        entityType: collection,
                        entityId: String(id),
                        action: 'delete',
                        snapshot_before: snapshotBefore ? JSON.stringify(snapshotBefore) : null,
                        display_value: displayValue,
                        user: user.email || user.id || 'system',
                        userId: user.id || 'system',
                        createdAt: new Date().toISOString()
                    });
                } catch (auditErr: any) {
                    console.warn(`[AUDIT-DELETE-FAILED] ${collection}:`, auditErr.message);
                }
            }

            // Level 10 Configuration Pulse
            if (entityDef?.isSystem || entityDef?.isGlobal) {
                global.CACHED_CONFIGS = {};
            }

            // --- ENTERPRISE LEVEL 10: V3 AFTER DELETE HOOK ---
            try {
                await executeHook(collection, 'afterDelete', { 
                    id,
                    previousData: snapshotBefore,
                    user, 
                    effectiveWorkspaceId, 
                    registry, 
                    db,
                    env: (ctx as any)?.env
                });
            } catch (e: any) {
                console.error(`[HOOK-ERROR] afterDelete failed for ${collection}:`, e.message);
            }

            return success({ id, deleted: true });
        }

        return error("Operation not allowed", 405);
    },
    ai: handleAiRequest,
    action: async (ctx: any) => {
        const { op, parts, db, user, body, url, method, env, registry } = ctx;
        const selectedLang = user?.preferredLanguage || registry?.language || 'ro';
        
        if (!user) return error("Unauthorized", 401, "User session not found");
        if (!user.workspaceId) user.workspaceId = 'system'; // Default to system workspace

        // --- ENTERPRISE LEVEL 10: UNIFIED ACTION PROTOCOL ---
        // Format: /api/action/entityName/actionId
        const entityName = parts[1];
        const actionId = parts[2];

        // If it looks like a V3 action call (entity/action) and not a legacy command
        if (entityName && actionId && !['undo', 'history', 'stats', 'workflow'].includes(entityName)) {
            // Enterprise Level 10: Unified Role-Based Access Control (RBAC) for Actions
            const hasPerm = await checkAccess(db, user, entityName, 'action', actionId, env);
            if (!hasPerm) return error(renderString({ 
                ro: `Din motive de securitate, nu aveți permisiunea de a executa acțiunea '${actionId}' pe ${entityName}.`, 
                en: `Forbidden: You do not have permission to execute action '${actionId}' on ${entityName}.` 
            }, selectedLang), 403);

            const v3Entity = (AVAILABLE_V3_ENTITIES as any)[entityName];
            const action = v3Entity?.actions?.find((a: any) => a.id === actionId);

            if (action) {
                console.log(`[BRAIN-ACTION] Protocol Match: Executing ${entityName}:${actionId} for ${user?.email}`);
                try {
                    const result = await action.handler(ctx, body);
                    return success(result);
                } catch (err: any) {
                    console.error(`[ACTION-PROTOCOL-ERROR] ${entityName}:${actionId} -`, err.message);
                    return error(err.message || "Action failed", 500);
                }
            }
        }
        
        // WORKFLOW ROUTING (Enterprise Level 10)
        // Support for legacy/action-prefixed workflow calls from older UI components
        if (op === "workflow") {
             const workflowOp = parts[2] || '';
             const workflowParts = ['workflow', workflowOp, ...parts.slice(3)];
             console.log(`[BRAIN-ACTION] Routing action/workflow to HANDLERS.workflow: op=${workflowOp}, entity=${workflowParts[2]}`);
             return await HANDLERS.workflow({ 
                ...ctx, 
                op: workflowOp, 
                parts: workflowParts 
             });
        }
        
        // UNDO (Rollback single change)
        if (op === "undo") {
            const logId = parts[2];
            if (!logId) return error(renderString({ ro: "ID jurnal lipsește", en: "Log ID required" }, selectedLang));
            
            // Bypass the proxy for the initial log fetch to avoid recursive noise
            const log = await (db as any)._target?.get('audit_log', logId) || await db.get('audit_log', logId);
            if (!log || !log.snapshot_before) return error(renderString({ ro: "Snapshot-ul nu există", en: "Snapshot not found" }, selectedLang));
            
            // Security check
            if (!(await checkAccess(db, user, log.entityType, 'update', undefined, ctx.env))) return error("Forbidden", 403);

            let beforeData;
            try {
                beforeData = typeof log.snapshot_before === 'string' ? JSON.parse(log.snapshot_before) : log.snapshot_before;
            } catch (e) {
                return error(renderString({ ro: "Format snapshot invalid", en: "Invalid snapshot format" }, selectedLang));
            }

            // Perform the update - this WILL be audited by the proxy as a separate log entry
            await db.update(log.entityType, log.entityId, beforeData);
            
            // Create undo audit entry
            await db.create('audit_log', {
                id: crypto.randomUUID(),
                action: 'system-undo',
                entityType: log.entityType,
                entityId: log.entityId,
                display_value: log.display_value,
                details: renderString({ 
                    ro: `Restaurat din log ${logId.substring(0, 8)}...`, 
                    en: `Restored from log ${logId.substring(0, 8)}...` 
                }, selectedLang),
                user: user?.email || user?.id || 'system',
                workspaceId: user?.workspaceId || log.workspaceId,
                createdAt: new Date().toISOString()
            });
            
            return success({ 
                id: log.entityId, 
                message: renderString({ ro: "Restaurare finalizată cu succes", en: "Rollback successful" }, selectedLang),
                details: renderString({ ro: `Inversat ${log.action} pe ${log.entityType}`, en: `Reverted ${log.action} on ${log.entityType}` }, selectedLang)
            });
        }
        
        // HISTORY (All audit logs with filters)
        if (op === "history") {
            // Support both POST body and GET query params to be SSR/dev-friendly
            const isGet = (method || '').toUpperCase() === 'GET';
            const limit = parseInt(isGet ? (url.searchParams.get('limit') || '100') : (body?.limit || '100'));
            const offset = parseInt(isGet ? (url.searchParams.get('offset') || '0') : (body?.offset || '0'));
            const entityType = isGet ? url.searchParams.get('entityType') || undefined : body?.entityType;
            const action = isGet ? url.searchParams.get('action') || undefined : body?.action;
            const userId = isGet ? url.searchParams.get('userId') || undefined : body?.userId;
            const workspaceId = user.workspaceId || 'system';
            
            let query = "SELECT * FROM audit_log WHERE workspaceId = ?";
            const params: any[] = [workspaceId];
            
            if (entityType) {
                query += " AND entityType = ?";
                params.push(entityType);
            }
            if (action) {
                query += " AND action = ?";
                params.push(action);
            }
            if (userId) {
                query += " AND userId = ?";
                params.push(userId);
            }
            
            query += " ORDER BY createdAt DESC LIMIT ? OFFSET ?";
            params.push(limit, offset);
            
            const logs = await db.query(query, params);
            const countRes = await db.query("SELECT COUNT(*) as total FROM audit_log WHERE workspaceId = ?", [workspaceId]);
            
            return success({
                logs: logs.map(deepParse),
                total: countRes[0]?.total || 0,
                limit,
                offset
            });
        }
        
        // ENTITY-HISTORY (History for specific entity record)
        if (op === "entity-history") {
            const entityType = parts[2];
            const entityId = parts[3];
            
            if (!entityType || !entityId) return error(renderString({ ro: "Entity Type și ID necesare", en: "Entity Type and ID required" }, selectedLang));
            
            const logs = await db.query(
                "SELECT * FROM audit_log WHERE workspaceId = ? AND entityType = ? AND entityId = ? ORDER BY createdAt DESC LIMIT 50",
                [user.workspaceId || 'system', entityType, entityId]
            );
            
            return success(logs.map(deepParse));
        }
        
        // STATS (Audit statistics)
        if (op === "stats") {
            const today = new Date();
            const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            const workspaceId = user.workspaceId || 'system';
            
            const totalRes = await db.query("SELECT COUNT(*) as total FROM audit_log WHERE workspaceId = ?", [workspaceId]);
            const weekRes = await db.query("SELECT COUNT(*) as week FROM audit_log WHERE workspaceId = ? AND createdAt > ?", [workspaceId, sevenDaysAgo.toISOString()]);
            const byActionRes = await db.query("SELECT action, COUNT(*) as count FROM audit_log WHERE workspaceId = ? GROUP BY action ORDER BY count DESC LIMIT 10", [workspaceId]);
            const byEntityRes = await db.query("SELECT COUNT(*) as count FROM audit_log WHERE workspaceId = ? GROUP BY entityType ORDER BY count DESC LIMIT 10", [workspaceId]);
            
            return success({
                total: totalRes[0]?.total || 0,
                lastWeek: weekRes[0]?.week || 0,
                byAction: byActionRes || [],
                byEntity: byEntityRes || []
            });
        }
        
        return error("Action not found", 404);
    },
    tag: async ({ op, parts, db, user, body, method }: any) => {
        const table = 'tag', relationTable = 'entity_relation_many';
        if (method === 'GET') {
            if (op === "results") {
                const assignments = await db.list(relationTable, { targetId: parts[2], targetType: 'tag', workspaceId: user.workspaceId || 'system' });
                const res = [];
                for (const a of assignments) {
                        const rec = await db.get(a.sourceType, a.sourceId);
                    if (rec) res.push({ ...deepParse(rec), _entity: a.sourceType });
                }
                return success(res);
            }
            return success((await db.list(table, { workspaceId: user.workspaceId || 'system' })).map(deepParse));
        }
        if (op === "create") return success(await db.create(table, { id: crypto.randomUUID(), ...body, workspaceId: user.workspaceId || 'system' }));
        if (op === "assign") {
             // Universalized assignment for tags
             return success(await db.create(relationTable, { 
                id: crypto.randomUUID(), 
                ...body, 
                sourceId: body.entityId, 
                sourceType: body.entityType, 
                targetId: body.tagId,
                targetType: 'tag',
                workspaceId: user.workspaceId || 'system' 
             }));
        }
        if (op === "remove") {
            const ex = await db.list(relationTable, { 
                targetId: body.tagId, 
                sourceId: body.entityId, 
                sourceType: body.entityType,
                targetType: 'tag',
                workspaceId: user.workspaceId || 'system' 
            });
            for (const item of ex) await db.delete(relationTable, item.id);
            return success();
        }
        return error("Tag operation not found");
    },
    search: async ({ db, user, url, selectedLang, env }: any) => {
        // Enterprise Level 10: High-Performance Global Search Overlay
        // Search across ALL entity types simultaneously, respecting workspace + RBAC
        
        const query = url.searchParams.get("q") || "";
        const entityTypeFilter = url.searchParams.get("type") || ""; // Optional: filter by entity type
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
        const offset = parseInt(url.searchParams.get("offset") || "0");
        
        if (!query || query.trim().length < 2) {
            return success([]);
        }
        
        const searchTerm = `%${query.toLowerCase()}%`;
        const registry = await mergeRegistryWithD1(db, user?.workspaceId || 'system', env);
        const isSuper = isGlobalAdmin(user, registry);
        
        const results: any[] = [];
        const entityConfigs = registry.ENTITY_CONFIG || {};
        
        try {
            // Iterate over all entities and search across defined searchFields
            for (const [entityName, config] of Object.entries(entityConfigs)) {
                const cfg = config as any;
                const tableName = cfg.tableName || entityName;
                
                // Skip if filtering by type and this isn't the right one
                if (entityTypeFilter && entityTypeFilter !== entityName) continue;
                
                // Skip system entities that user shouldn't see
                const isGlobal = isGlobalEntity(entityName, registry);
                const searchFields = cfg.searchFields || cfg.displayField ? [cfg.displayField] : [];
                
                // Skip if no search fields configured
                if (!searchFields || searchFields.length === 0) continue;
                
                // Security check: can user read this entity?
                if (!(await checkAccess(db, user, entityName, 'read', undefined, env))) {
                    continue;
                }
                
                try {
                    // Build search WHERE clause
                    const whereConditions = searchFields.map((f: string) => `LOWER("${f}") LIKE ?`).join(' OR ');
                    const params = searchFields.map(() => searchTerm);
                    
                    // Add workspace isolation (unless global entity or superadmin viewing system workspace)
                    let sql = `SELECT * FROM "${tableName}" WHERE (${whereConditions})`;
                    const sqlParams = [...params];
                    
                    if (!isGlobal && !isSuper) {
                        sql += ` AND workspaceId = ?`;
                        sqlParams.push(user?.workspaceId || 'system');
                    } else if (!isGlobal && isSuper) {
                        // Superadmin: can see any workspace
                        // No additional filter needed
                    }
                    
                    // Soft delete filter
                    if (cfg.features?.softDelete) {
                        sql += ` AND deletedAt IS NULL`;
                    }
                    
                    // Add limit + offset for pagination
                    sql += ` LIMIT ? OFFSET ?`;
                    sqlParams.push(String(limit), String(offset));
                    
                    const entityResults = await db.query(sql, sqlParams);
                    
                    // Format results
                    for (const item of entityResults) {
                        const displayValue = item[cfg.displayField || 'name'] || item.id;
                        results.push({
                            id: item.id,
                            type: entityName,
                            displayValue,
                            workspaceId: item.workspaceId,
                            createdAt: item.createdAt,
                            match_fields: searchFields.filter((f: string) => 
                                item[f] && String(item[f]).toLowerCase().includes(query.toLowerCase())
                            ),
                            icon: cfg.icon || 'Box',
                            label: renderString(cfg.label || {}, selectedLang),
                            link: `/${entityName}/${item.id}`
                        });
                    }
                } catch (e: any) {
                    // Log error but continue with next entity
                    console.warn(`[SEARCH-ERROR] Failed to search ${entityName}:`, e.message);
                }
            }
            
            // Sort results by relevance (exact matches first, then by creation date)
            results.sort((a, b) => {
                const aExact = a.displayValue.toLowerCase() === query.toLowerCase() ? 1 : 0;
                const bExact = b.displayValue.toLowerCase() === query.toLowerCase() ? 1 : 0;
                if (aExact !== bExact) return bExact - aExact;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
            
            return success({
                query,
                total: results.length,
                results,
                limit,
                offset
            });
        } catch (e: any) {
            console.error("[SEARCH-FATAL]", e.message);
            return error(`Search failed: ${e.message}`, 500);
        }
    },
    workflow: async ({ op, parts, db, user, body, env }: any) => {
        const registry = await mergeRegistryWithD1(db, user?.workspaceId || 'system', env);
        const selectedLang = user?.preferredLanguage || registry.language || 'ro';
        const entityType = parts[2];
        const entityId = parts[3];
        
        // WORKFLOW TRANSITION
        if (op === "transition") {
            const { toStatus } = body || {};
            if (!entityType || !entityId || !toStatus) {
                return error(renderString({ 
                    ro: "Entity type, ID și status țintă sunt necesare", 
                    en: "Entity type, ID and target status required" 
                }, selectedLang));
            }
            
            // Security check
            if (!(await checkAccess(db, user, entityType, 'update', undefined, env))) {
                return error(renderString({ 
                    ro: "Acces refuzat la această entitate", 
                    en: "Access denied to this entity" 
                }, selectedLang), 403);
            }
            
            // Get current entity
            const entity = await db.get(entityType, entityId);
            if (!entity) {
                return error(renderString({ 
                    ro: "Entitatea nu a fost găsită", 
                    en: "Entity not found" 
                }, selectedLang), 404);
            }
            
            const currentStatus = entity.status;
            
            // Validate transition
            const validation = await validateStateTransition(
                db, 
                entityType, 
                entityId, 
                currentStatus, 
                toStatus, 
                registry, 
                entity
            );
            
            if (!validation.valid) {
                return error(renderString({ 
                    ro: validation.error || "Tranziție invalidă", 
                    en: validation.error || "Invalid transition" 
                }, selectedLang), 400);
            }
            
            // Perform transition
            await db.update(entityType, entityId, { 
                status: toStatus,
                updatedAt: new Date().toISOString()
            });

            // Enterprise Level 10: Unified Workflow Side-Effect Engine
            await triggerFlowActions(db, entityType, entityId, toStatus, registry, user, env);
            
            // Audit log
            await db.create('audit_log', {
                id: crypto.randomUUID(),
                action: 'workflow-transition',
                entityType,
                entityId,
                display_value: entity[entity.displayField || 'name'] || entityId,
                details: renderString({ 
                    ro: `Tranziție de stare: ${currentStatus} → ${toStatus}`, 
                    en: `State transition: ${currentStatus} → ${toStatus}` 
                }, selectedLang),
                user: user?.email || user?.id || 'system',
                workspaceId: user?.workspaceId || entity.workspaceId,
                createdAt: new Date().toISOString()
            });
            
            return success({
                id: entityId,
                oldStatus: currentStatus,
                newStatus: toStatus,
                message: renderString({
                    ro: `Stare actualizată cu succes: ${currentStatus} → ${toStatus}`,
                    en: `Status updated successfully: ${currentStatus} → ${toStatus}`
                }, selectedLang)
            });
        }
        
        // GET AVAILABLE TRANSITIONS FOR CURRENT STATE
        if (op === "get-transitions") {
            if (!entityType || !entityId) {
                return error(renderString({ 
                    ro: "Entity type și ID necesare", 
                    en: "Entity type and ID required" 
                }, selectedLang));
            }
            
            const entity = await db.get(entityType, entityId);
            if (!entity) {
                return error(renderString({ 
                    ro: "Entitatea nu a fost găsită", 
                    en: "Entity not found" 
                }, selectedLang), 404);
            }
            
            const transitions = getNextTransitions(entityType, entity.status, registry);
            
            return success({
                currentStatus: entity.status,
                availableTransitions: transitions,
                entity: {
                    id: entityId,
                    type: entityType,
                    status: entity.status,
                    displayValue: entity[entity.displayField || 'name'] || entityId
                }
            });
        }
        
        // GET FLOW RULES FOR ENTITY TYPE
        if (op === "get-flow-rules") {
            if (!entityType) {
                return error(renderString({ 
                    ro: "Entity type necesar", 
                    en: "Entity type required" 
                }, selectedLang));
            }
            
            const flowRules = registry?.CONSTANT?.flowRules || {};
            const rules = flowRules[entityType];
            
            if (!rules) {
                return success({
                    entityType,
                    hasRules: false,
                    rules: null,
                    message: renderString({
                        ro: `Nu sunt reguli de curgere definite pentru ${entityType}`,
                        en: `No flow rules defined for ${entityType}`
                    }, selectedLang)
                });
            }
            
            return success({
                entityType,
                hasRules: true,
                rules: Object.entries(rules).map(([status, rule]: [string, any]) => ({
                    status,
                    label: rule.label,
                    icon: rule.icon,
                    nextStates: rule.nextStates,
                    requiresFields: rule.requiresFields,
                    action: rule.action
                }))
            });
        }
        
        return error("Workflow operation not found", 404);
    },
    member: async (ctx) => {
        const v3 = (AVAILABLE_V3_ENTITIES as any).workspace;
        const action = v3?.actions.find((a: any) => a.id === 'list-members');
        if (action) return success(await action.handler(ctx, { workspaceId: ctx.url.searchParams.get('workspaceId') }));
        return error("Member listing not available", 404);
    },
    help: async (ctx) => {
        return await handleHelpRequest(ctx);
    },
    upload: async (ctx) => {
        const v3 = (AVAILABLE_V3_ENTITIES as any).file;
        const action = v3?.actions.find((a: any) => a.id === 'upload');
        if (action) return success(await action.handler(ctx, ctx.body));
        return error("Upload action not found", 404);
    },
    'socket.io': async (): Promise<Response> => {
        return error("Socket.IO is not supported on Cloudflare Workers 'Brain'. Local Agent should be used for sockets.", 404);
    },
    'local-agent': async ({ parts, request, db, env, user }: any) => {
        const registry = await mergeRegistryWithD1(db, user?.workspaceId || 'system', env);
        const localAgentUrl = env.VITE_SOCKET_URL || registry.SYSTEM_SETTING?.local_agent_url || 'http://localhost:4001';
        
        const subPath = parts.slice(1).join('/');
        const targetUrl = new URL(request.url);
        const searchParams = targetUrl.search;
        const finalUrl = `${localAgentUrl.replace(/\/$/, '')}/api/${subPath}${searchParams}`;

        console.log(`[BRAIN-PROXY] Handling local-agent request: ${request.method} ${finalUrl}`);

        try {
            const hasBody = !['GET', 'HEAD', 'DELETE'].includes(request.method);
            const proxyRequest: any = {
                method: request.method,
                headers: {
                    'Content-Type': request.headers.get('Content-Type') || 'application/json',
                    'X-API-Key': env.API_KEY || 'dev-token',
                    'X-User-ID': user?.id || 'system',
                    'X-Workspace-ID': user?.workspaceId || 'system'
                }
            };
            
            if (hasBody) {
                if (request.headers.get('Content-Type')?.includes('multipart/form-data')) {
                    proxyRequest.body = await request.formData();
                } else {
                    proxyRequest.body = await request.text();
                }
            }

            const response = await fetch(finalUrl, proxyRequest);
            const responseData = await response.arrayBuffer();
            return new Response(responseData, {
                status: response.status,
                headers: {
                    'Content-Type': response.headers.get('Content-Type') || 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        } catch (e: any) {
            console.error(`[BRAIN-PROXY-ERROR] ${e.message}`);
            return error(`Agentul local nu este disponibil la ${localAgentUrl}. Verifică dacă aplicația backend este pornită.`, 503);
        }
    }
};

// --- MAIN HANDLER ---
async function _handleBrainRequest(request: Request, env: any, cfCtx?: any, preParsedBody?: any) {
    const requestId = Math.random().toString(36).substring(7);
    
    // Store env for legacy helpers if needed (not recommended but useful for deep calls)
    global.LAST_ENV = env;
    
    // 1. Unified Body Extraction (Enterprise Level 10: Resilient Payload Recovery)
    let body: any = preParsedBody;
    let recoveryLog = preParsedBody ? "Using preParsedBody" : "No pre-parsed body";

    // If body is a string that looks like JSON, parse it early
    if (typeof body === 'string' && body.trim()) {
        try {
            if (body.trim().startsWith('{') || body.trim().startsWith('[')) {
                body = JSON.parse(body);
                recoveryLog += " (Parsed JSON String)";
            }
        } catch (e) {}
    }

    // If body is FormData (from Worker or recovery), convert to plain object for the pipeline
    if (body && typeof body.get === 'function' && typeof body.entries === 'function') {
        body = Object.fromEntries(body.entries());
        recoveryLog += " (Converted FormData to Object)";
    }

    const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
    
    // Enterprise Level 10: Deep Payload Analysis
    const isBodyReallyEmpty = (body === undefined || body === null || body === "" || (typeof body === 'object' && Object.keys(body).length === 0));

    if (hasBody && isBodyReallyEmpty) {
        try {
            const contentType = request.headers.get('content-type') || '';
            const cloned = request.clone();
            
            if (contentType.includes('application/json')) {
                try {
                    body = await cloned.json();
                    recoveryLog = "Recovered via json()";
                } catch (e) {
                    const text = await cloned.text();
                    body = text ? JSON.parse(text) : {};
                    recoveryLog = "Recovered via text-then-json";
                }
            } else if (contentType.includes('form') || contentType.includes('multipart')) {
                try {
                    const fd = await cloned.formData();
                    body = Object.fromEntries(fd.entries());
                    recoveryLog = "Recovered via formData()";
                } catch (e) {
                    const text = await cloned.text();
                    body = { text };
                    recoveryLog = "Recovered via form-fallback-text";
                }
            } else {
                const text = await cloned.text();
                try { 
                    body = text ? JSON.parse(text) : {}; 
                    recoveryLog = "Recovered via raw-text-then-json";
                } catch(e) { 
                    body = text; 
                    recoveryLog = "Recovered via raw-text";
                }
            }
        } catch (e: any) {
            recoveryLog = `Recovery failed: ${e.message}. BodyUsed: ${request.bodyUsed}`;
            body = {};
        }
    }

    // Guard against null/undefined body for the rest of the flow
    if (hasBody && !body) body = {};

    // 2. Request Reconstruction
    // We create a fresh, stable Request object for the rest of the pipeline (Auth, Handlers, etc.)
    // We ensure bodyStr is ALWAYS a string if hasBody is true
    let bodyStr: string = "";
    if (hasBody) {
        if (body && typeof body === 'object') {
            bodyStr = JSON.stringify(body);
        } else if (body !== undefined && body !== null) {
            bodyStr = String(body);
        }
    }

    const req = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: hasBody ? bodyStr : undefined
    });

    try {
        const url = new URL(req.url); 
        const path = url.pathname.replace(/^\/api/, '').replace(/^\//, '').replace(/\/$/, '');
        
        // Enterprise Level 10: Dynamic Language Detection & Preference Mapping
        const urlParts = url.pathname.split('/');
        const queryLang = url.searchParams.get('lang');
        let selectedLang = (urlParts[1] === 'ro' || urlParts[1] === 'en') ? urlParts[1] : 'ro';

        // Support explicit lang override via query parameter
        if (queryLang === 'ro' || queryLang === 'en') {
            selectedLang = queryLang;
        }
        
        if (path === "health" || path === "system/health") return success({ status: "ok", service: "brain" });

        // R2 Raw File Fetch Fast-Path
        if (path.startsWith('file/raw/')) {
            if (!env.STORAGE) return error("Storage not configured", 500);
            
            // Decodare key pentru a suporta spații și caractere speciale în numele fișierelor
            const encodedKey = path.replace('file/raw/', '');
            const key = decodeURIComponent(encodedKey);
            
            console.log(`[BRAIN-R2-GET] Fetching key: ${key}`);
            const object = await env.STORAGE.get(key);
            
            if (!object) {
                console.warn(`[BRAIN-R2-GET] File not found: ${key}`);
                return error("File not found", 404);
            }
            
            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set('etag', object.httpEtag);
            
            // Forțare cache pe 1 oră în dev pentru performanță
            headers.set('cache-control', 'public, max-age=3600');
            
            // Securitate HTTP & Dev: Asigurăm că imaginea este servită cu atribute care permit afișarea
            headers.set('Access-Control-Allow-Origin', '*');
            headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
            
            // Securitate: Prevenire sniffing și asigurare Content-Type corect
            if (!headers.has('content-type')) {
                const ext = key.split('.').pop()?.toLowerCase();
                const mimeMap: Record<string, string> = {
                    'png': 'image/png',
                    'jpg': 'image/jpeg',
                    'jpeg': 'image/jpeg',
                    'gif': 'image/gif',
                    'webp': 'image/webp',
                    'svg': 'image/svg+xml',
                    'pdf': 'application/pdf'
                };
                if (ext && mimeMap[ext]) headers.set('content-type', mimeMap[ext]);
            }
            
            // Performanță: Stream body direct pentru a evita overhead-ul de memorie
            // și pentru a păstra integritatea datelor binare pe HTTP
            const stream = object.body;
            
            return new Response(stream, { 
                status: 200,
                headers 
            });
        }

        const bodyKeys = (body && typeof body === 'object') ? Object.keys(body) : [];
        const bodyType = Array.isArray(body) ? 'array' : typeof body;
        // console.log(`[BRAIN][${requestId}] Request: ${req.method} ${url.pathname} | Body Recovery: ${recoveryLog} | BodyType: ${bodyType} | BodyKeys: ${bodyKeys.length > 0 ? bodyKeys.join(',') : 'none'}`);
        
        if (path === "auth/local-token" || path === "local-token") {
            return success({ token: env.API_KEY || "dev-token" });
        }

        const parts = path.split('/');
        const resource = (parts[0] || '').toLowerCase();
        
        // Enterprise Level 10: Robust Public Route Detection (Moved earlier for optimization)
        const isPublic = [
            "health", "auth/check-admin", "check-admin", 
            "auth/setup-admin", "setup-admin", "auth/local-token", "local-token",
            "system/log-error"
        ].includes(path.toLowerCase()) || 
        resource === "config" ||
        (resource === "auth" && !path.includes('update-profile') && !path.includes('list-all'));

        // FAST-PATH: check-admin (Blazing fast for "Checking session...")
        if (path === "auth/check-admin" || path === "check-admin") {
            if (env?.KV) {
                try {
                    const cached = await env.KV.get('admin_exists');
                    if (cached === 'true') return success({ exists: true });
                } catch (e) {}
            }

            if (global.ADMIN_EXISTS_LOCAL) return success({ exists: true });

            try {
                const db = getDb(env);
                const res = await db.prepare("SELECT id FROM user LIMIT 1").first();
                if (res) {
                    global.ADMIN_EXISTS_LOCAL = true;
                    if (env?.KV) await env.KV.put('admin_exists', 'true');
                    return success({ exists: true });
                }
            } catch (e) {}
            // If table missing, we fall through to DB init, but we'll use a shorter wait
        }

        // 2. DATABASE INITIALIZATION (LEVEL 10: ENTERPRISE BOOT PROTOCOL + TURBO MODE)
        const rawDb = getDb(env);
        if (!global.IS_DB_INITIALIZED) {
            console.log(`[BRAIN][${requestId}][${path}] Triggering DB initialization (background)...`);
            const initCtx = { env, ...cfCtx };
            
            // TURBO MODE: Schedule schema sync async without blocking request
            // This prevents 1-2 minute hangs on first startup
            if (!global.DB_INIT_SCHEDULED) {
                global.DB_INIT_SCHEDULED = true;
                // Schedule in background - doesn't block this request
                setImmediate(() => {
                    ensureSystemTables(rawDb, req.url, initCtx).catch(err => 
                        console.error("[BRAIN-INIT-ERR]", err.message)
                    );
                });
            }
            
            // Level 10: Smart Wait. Public routes and session checks wait less to avoid UI hang.
            // Admin setup/check-admin waits more to ensure tables are ready.
            const isAuthCheck = path.includes('session') || path.includes('check-admin');
            const waitTime = isAuthCheck ? 2000 : 1000;  // Reduced from 1500/5000 since init is background
            await waitForDbReady(rawDb, waitTime);
        }

        // 3. BETTER-AUTH DELEGATION
        const isCustomAuth = url.pathname.includes('/check-admin') || url.pathname.includes('/setup-admin') || url.pathname.includes('/update-profile');
        if (url.pathname.startsWith('/api/auth') && !isCustomAuth) {
            const auth = getAuth(env, req);
            return await auth.handler(req);
        }

        let user = null;
        if (!isPublic) {
            try { 
                // Pass a CLONE to verifyAuth to be 100% safe
                user = await verifyAuth(req.clone() as any, env); 
                if (user) console.log(`[BRAIN][${requestId}] User: ${user.email}`);
            } catch(e: any) {
                console.warn(`[BRAIN-AUTH-WARN][${requestId}]`, e.message);
            }

            if (!user) return error("Session expired or unauthorized.", 401);
        }
        
        const db = createAuditProxy(rawDb, user);
        const registry = await mergeRegistryWithD1(db, user?.workspaceId || 'system', env);

        // SYNC REGISTRY TO DB DRIVER (Enterprise Level 10)
        getDb(env, registry);

        if (resource === "config") {
            return success({ entity: registry.ENTITY_CONFIG || {}, constants: registry, uiConfig: registry.THEME || {} });
        }

        // Handlers context use the already extracted 'body'
        const ctx = { 
            request: req, 
            env, 
            db, 
            user, 
            url, 
            parts, 
            resource, 
            op: parts[1], 
            method: req.method, 
            body, 
            cfCtx, 
            selectedLang, 
            registry,
            renderString,
            deepParse,
            getAuth,
            normalizeEntity,
            syncEntityTable,
            clearColumnCache,
            AiService,
            v3Entities: AVAILABLE_V3_ENTITIES,
            handleSelfHealing,
            clearUserPermsCache
        };
        
        if (resource === "db") {
            const table = (parts[1] === 'collection' ? (parts[2] || '') : (parts[1] || '')).toLowerCase();
            
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
            let handlerResponse;
            try {
                handlerResponse = await handler(ctx);
            } catch (err: any) {
                await logSystemError(db, err, req, { 
                    requestId, 
                    recoveryLog, 
                    userId: user?.id, 
                    userName: user?.name, 
                    workspaceId: user?.workspaceId,
                    status: 500,
                    extra: { resource, op: parts[1] }
                });
                throw err; // Re-throw for top-level catch to handle response formatting
            }
            
            // Enterprise Level 10: Dynamic Translation Transformer (Post-Process)
            const skipTransform = resource === 'entity' || resource === 'registry' || (resource === 'db' && path.includes('entity_definition')) || url.searchParams.has('raw');
            if (handlerResponse.headers.get('content-type')?.includes('application/json') && !skipTransform) {
                try {
                    // Clone before parsing JSON to avoid consuming original response body
                    const data: any = await handlerResponse.clone().json();
                    
                    // Transform multilingual fields recursively through the entire object tree
                    const transformed = transformTranslations(data, selectedLang);
                    
                    return Response.json(transformed, { 
                        status: handlerResponse.status, 
                        headers: handlerResponse.headers 
                    });
                } catch (e) {
                    // If JSON parsing fails, return original response
                    return handlerResponse;
                }
            }
            
            return handlerResponse;
        }
        
        // Enterprise Level 10: Secure CRUD Fallback
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

export async function handleBrainRequest(request: Request, env: any, cfCtx?: any, preParsedBody?: any) {
    if (request.signal.aborted) {
        return new Response(null, { status: 499 });
    }

    const origin = request.headers.get("Origin") || "";
    // Enterprise Level 10: Secure Dynamic CORS Engine
    const isAllowed = origin && (
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') ||
        origin.includes('192.168.') ||
        origin.includes('10.') ||
        origin.includes('172.') ||
        origin === env.FRONTEND_URL ||
        origin === env.BASE_URL
    );
    
    const corsHeaders: Record<string, string> = {
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-API-Key",
        "Access-Control-Allow-Credentials": "true",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Cross-Origin-Embedder-Policy": "credentialless"
    };

    if (origin) {
        corsHeaders["Access-Control-Allow-Origin"] = isAllowed ? origin : (env.FRONTEND_URL || "*");
    } else {
        // Fallback pentru request-uri simple de tip img src care nu trimit header-ul Origin pe HTTP
        corsHeaders["Access-Control-Allow-Origin"] = "*";
    }

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Recover body for deduplication and logging ONLY IF not already parsed
    let bodyToUse = preParsedBody;
    if (bodyToUse === undefined && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
        try {
            const ct = request.headers.get('content-type') || '';
            const cloned = request.clone();
            
            if (ct.includes('application/json')) {
                bodyToUse = await cloned.text();
            } else if (ct.includes('form') || ct.includes('multipart')) {
                // For FormData, we can't easily turn it into a string without consuming it correctly
                // We'll let _handleBrainRequest handle it or convert to object here
                try {
                    const fd = await cloned.formData();
                    bodyToUse = Object.fromEntries(fd.entries());
                } catch(e) {
                    bodyToUse = await cloned.text();
                }
            } else {
                bodyToUse = await cloned.text();
            }
        } catch (e) {
            console.warn('[BRAIN] Could not clone request for body recovery:', e);
        }
    }

    // 🔒 DEDUPLICATION: High-Concurrency Idempotency Guard (Enterprise Level 10)
    const method = request.method.toUpperCase();
    const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
    const isQuery = method === 'GET';
    const url = new URL(request.url);
    
    let mutationKey: string | null = null;
    let queryKey: string | null = null;

    if (isMutation) {
        // Include body summary to avoid collisions between different records on same endpoint
        // Enterprise Level 10: Precision Mutation Fingerprinting
        const contentLength = request.headers.get("content-length") || "0";
        let bodyTag = contentLength;
        
        if (bodyToUse) {
            const strBody = typeof bodyToUse === 'string' ? bodyToUse : JSON.stringify(bodyToUse);
            // Enterprise Level 10: Unique Payload Signature (Fingerprinting)
            const start = strBody.substring(0, 15).replace(/[^a-zA-Z0-9]/g, '');
            const end = strBody.substring(strBody.length - 10).replace(/[^a-zA-Z0-9]/g, '');
            bodyTag = `${strBody.length}_${start}_${end}`;
        }
            
        mutationKey = `${method}:${url.pathname}:${bodyTag}`;

        const inFlight = activeMutations.get(mutationKey);
        if (inFlight) {
            console.warn(`[BRAIN-DEDUP] 🔄 Waiting for existing mutation: ${mutationKey}`);
            try {
                const response = await inFlight;
                console.log(`[BRAIN-DEDUP] ✅ Returning shared response for mutation: ${mutationKey}`);
                return response.clone();
            } catch (e: any) {
                console.error(`[BRAIN-DEDUP] ❌ Existing mutation failed: ${e.message}`);
                // Proceed to try execution if the previous one failed catastrophically
            }
        }
    } else if (isQuery) {
        // Deduplicate overlapping GET requests (e.g. sidebar + main view requesting same list)
        // We include search params for unique cache keys, but STRIP cache-busters like 't'
        const url = new URL(request.url);
        const search = new URLSearchParams(url.search);
        search.delete('t'); // Cache-buster
        search.delete('_'); 
        search.delete('lang'); // Language is usually global or session-based, keeping it separate might be safer but here it often causes misses
        
        const cleanSearch = search.toString();
        queryKey = `GET:${url.pathname}${cleanSearch ? '?' + cleanSearch : ''}`;
        
        const inFlight = activeQueries.get(queryKey);
        if (inFlight) {
            console.log(`[BRAIN-DEDUP] 📡 Sharing results for query: ${queryKey}`);
            try {
                const response = await inFlight;
                return response.clone();
            } catch (e) {}
        }
    }

    // Wrap the handler to ensure the body is consumed and cached for clones (Idempotency)
    const executeRequest = async () => {
        try {
            // Level 10: Early abort check
            if (request.signal.aborted) {
                return new Response(null, { status: 499 });
            }

            const response = await _handleBrainRequest(request, env, cfCtx, bodyToUse);
            
            if (!response || typeof response.clone !== 'function') {
                return new Response(JSON.stringify({ success: false, error: "Internal Handler Error" }), { 
                    status: 500, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            // Eagerly consume the response body so we can share it
            const contentType = response.headers.get('content-type') || '';
            let clonedBody: any;
            
            if (contentType.includes('application/json')) {
                clonedBody = await response.json();
            } else {
                clonedBody = await response.text();
            }

            const finalHeaders = new Headers(response.headers);
            Object.entries(corsHeaders).forEach(([k, v]) => {
                finalHeaders.set(k, v);
            });

            const bodyString = typeof clonedBody === 'string' ? clonedBody : JSON.stringify(clonedBody);
            
            return new Response(bodyString, {
                status: response.status,
                statusText: response.statusText,
                headers: finalHeaders
            });
        } catch (err: any) {
            const isAbort = (err.name === 'AbortError' || (err instanceof Error && err.constructor.name === 'DOMException' && err.name === 'AbortError'));
            
            if (isAbort) {
                // Silently handle aborts
                return new Response(null, { status: 499 });
            }

            console.error('[BRAIN-EXEC-ERROR]', err);
            
            // LOG TO D1
            try {
                const db = getDb(env);
                await logSystemError(db, err, request, { status: 500 });
            } catch (e) {}

            return new Response(JSON.stringify({ 
                success: false, 
                error: err instanceof Error ? err.message : "Unknown Request Error" 
            }), { 
                status: 500, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        } finally {
            if (mutationKey) {
                activeMutations.delete(mutationKey);
                console.log(`[BRAIN-DEDUP] ✅ Cleared ${mutationKey}`);
            }
            if (queryKey) {
                activeQueries.delete(queryKey);
            }
        }
    };

    if (mutationKey || queryKey) {
        const p = executeRequest();
        if (mutationKey) {
            activeMutations.set(mutationKey, p);
            console.log(`[BRAIN-DEDUP] 📡 Tracking mutation: ${mutationKey}`);
        } else if (queryKey) {
            activeQueries.set(queryKey, p);
        }
        const finalResponse = await p;
        return finalResponse.clone();
    }

    // Default path for non-tracked requests
    try {
        if (request.signal.aborted) {
            return new Response(null, { status: 499 });
        }

        const result = await _handleBrainRequest(request, env, cfCtx, bodyToUse);
        
        // Enterprise Level 10: Binary/Stream Fast-Path
        // If the response is already a Response object with a non-json content type
        // (like images from R2), we return it as is but with CORS headers applied.
        const contentType = result.headers.get("content-type") || "";
        const isBinary = contentType && !contentType.includes("application/json") && !contentType.includes("text/plain");

        if (isBinary) {
            const finalHeaders = new Headers(result.headers);
            Object.entries(corsHeaders).forEach(([k, v]) => {
                finalHeaders.set(k, v);
            });
            return new Response(result.body, {
                status: result.status,
                headers: finalHeaders
            });
        }
        
        // If it wasn't a mutation, we still need to apply CORS headers to the result
        const finalHeaders = new Headers(result.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => {
            finalHeaders.set(k, v);
        });
        return new Response(result.body, {
            status: result.status,
            statusText: result.statusText,
            headers: finalHeaders
        });
    } catch (err: any) {
        const isAbort = (err.name === 'AbortError' || (err instanceof Error && err.constructor.name === 'DOMException' && err.name === 'AbortError'));
        
        if (isAbort) {
            return new Response(null, { status: 499 });
        }

        console.error('[BRAIN-ERROR]', err);

        // LOG TO D1
        try {
            const db = getDb(env);
            await logSystemError(db, err, request, { status: 500 });
        } catch (logErr) {
            console.error('[RECOVERY-LOG-FAILED]', logErr);
        }

        const errorResponse = error(
            err instanceof Error ? err.message : 'Internal brain error',
            500
        );
        const errorBody = await errorResponse.text();
        const finalErrHeaders = new Headers(errorResponse.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => finalErrHeaders.set(k, v));

        return new Response(errorBody, {
            status: errorResponse.status,
            statusText: errorResponse.statusText,
            headers: finalErrHeaders,
        });
    }
}


