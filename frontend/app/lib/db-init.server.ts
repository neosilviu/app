import { getRegistry, resolveCollection, getPrimaryKey, normalizeEntity, clearRegistryCache, loadBaseline, type EntityDefinition } from './core';

// --- DB INIT STATE ---
const global = globalThis as any;
if (global.IS_DB_INITIALIZED === undefined) global.IS_DB_INITIALIZED = false;
if (global.DB_INIT_PROMISE === undefined) global.DB_INIT_PROMISE = null;
if (global.DB_INIT_STARTED === undefined) global.DB_INIT_STARTED = Date.now();
if (global.BASELINE_SYNC_STARTED === undefined) global.BASELINE_SYNC_STARTED = false;

/**
 * Wait for DB to be ready before allowing any queries
 */
export async function waitForDbReady(db: any, maxWaitMs = 15000, signal?: AbortSignal) {
    const startTime = Date.now();
    
    if (global.IS_DB_INITIALIZED) return;

    console.log(`[DB-READY] Waiting for database to be ready (Max: ${maxWaitMs}ms)...`);

    // Level 8: Improved signal awareness to prevent AbortError during init
    while (!global.IS_DB_INITIALIZED && (Date.now() - startTime) < maxWaitMs) {
        if (signal?.aborted) {
            console.log(`[DB-READY] Wait aborted by client signal.`);
            const abortErr = new Error("Request aborted");
            abortErr.name = "AbortError";
            throw abortErr;
        }

        if (global.DB_INIT_PROMISE) {
            try {
                await global.DB_INIT_PROMISE;
                if (global.IS_DB_INITIALIZED) {
                    // console.log(`[DB-READY] Initialization complete after ${Date.now() - startTime}ms.`);
                    break;
                }
            } catch (e: any) { 
                console.error(`[DB-READY] Initialization promise failed: ${e.message}`);
                break;
            }
        }
        
        await new Promise(r => setTimeout(r, 50));
    }
    
    if (!global.IS_DB_INITIALIZED) {
        console.warn(`[DB-READY] Proceeding without full initialization after ${Date.now() - startTime}ms (Status: ${global.IS_DB_INITIALIZED})`);
    }
}

/**
 * Ensures system tables exist and migrations are applied
 */
export async function ensureSystemTables(db: any, requestUrl?: string, ctx?: any) {
    if (global.IS_DB_INITIALIZED) return;
    if (global.DB_INIT_PROMISE) {
        return global.DB_INIT_PROMISE;
    }

    // Enterprise Level 8: Fast-Path for Warm Starts / Sync Detection
    const SYNC_TOKEN = "v2_core_v1"; // Update this to force re-sync
    const kv = ctx?.env?.KV;

    global.DB_INIT_PROMISE = (async () => {
        try {
            const start = Date.now();
            
            // 1. Check if already initialized in this isolate OR marked in KV
            if (kv) {
                const marker = await kv.get('db_sync_token');
                if (marker === SYNC_TOKEN) {
                    // console.log("[DB-INIT][FAST-PATH] Database already sync'd (KV Hit).");
                    global.IS_DB_INITIALIZED = true;
                    return;
                }
            }

            // DEBUG: Logam startul initializarii
            
            // Step 1: Initialize System Registry Marker
            let migrationLevel = 0;
            try {
                // Enterprise Level 8: Ultra-fast check for production
                const metaTable = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='_metadata'");
                if (!metaTable || metaTable.length === 0) {
                    console.log("[DB-INIT] No _metadata table yet. First run.");
                } else {
                    const result = await db.query("SELECT value FROM _metadata WHERE key = 'db_version' LIMIT 1");
                    if (result && result.length > 0) {
                        migrationLevel = parseInt(result[0].value || "0");
                        console.log(`[DB-INIT] Found db_version: ${migrationLevel}`);
                    }
                }
            } catch (e: any) {
                 console.warn("[DB-INIT] Transient error checking _metadata:", e.message);
            }

            // Step 2: DNA-Driven Schema Sychronization
            const baseline = await loadBaseline();
            const coreEntities = (baseline.ENTITY_CONFIG || {}) as Record<string, any>;

            // CORE TABLES: Must be ready before we mark DB as initialized
            // Better Auth depends on 'user' and 'session'
            // Setup-Admin depends on 'contact' for business profile sync
            const coreSyncList = ['user', 'session', 'account', 'verification', 'contact', 'entity_definition', 'workspace', 'system_setting', 'system_error', '_ai_prompt', 'help_content', 'system_performance_log'];
            
            console.log(`[DB-INIT] Starting Core DNA Sync (${coreSyncList.join(', ')})...`);
            for (const entityName of coreSyncList) {
                const config = coreEntities[entityName];
                if (config) {
                    await syncEntityTable(db, { ...config, name: entityName }, baseline);
                }
            }

            // Enterprise Level 8: Namespace Normalization & Deduplication Migration
            // Now that we are sure the 'system_setting' table exists and has correct columns.
            try {
                // Step A: Deduplicate records (lowercase match)
                try {
                    await db.exec("DELETE FROM system_setting WHERE rowid NOT IN (SELECT MIN(rowid) FROM system_setting GROUP BY LOWER(namespace), LOWER(key))");
                } catch (dedupErr: any) {
                    console.warn("[DB-INIT] Deduplication step failed:", dedupErr.message);
                }
                
                // Step B: Normalize remaining records to lowercase
                try {
                    await db.exec("UPDATE system_setting SET namespace = LOWER(namespace), id = LOWER(id)");
                } catch (normErr: any) {
                    console.warn("[DB-INIT] Normalization step failed:", normErr.message);
                }
            } catch (e: any) {
                console.warn("[DB-INIT] Namespace normalization procedure failed:", e.message);
            }

            // Step 3: Specific Migrations / Fixes (Keep only what's absolutely necessary)
            // Ensure System Workspace exists (MANDATORY for Level 8 isolation)
            try {
                const systemWorkspace = await db.query("SELECT id FROM workspace WHERE id = 'system' LIMIT 1");
                if (!systemWorkspace || systemWorkspace.length === 0) {
                    console.log("[DB-INIT] Creating mandatory 'system' workspace...");
                    await db.query(`INSERT INTO workspace (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)`, [
                        'system', 'System Administration', new Date().toISOString(), new Date().toISOString()
                    ]);
                }
            } catch (e: any) {
                console.warn("[DB-INIT] System workspace check/creation failed:", e.message);
            }

            // Level 8: Set initialized AFTER core sync and critical data seed
            global.IS_DB_INITIALIZED = true;

            // Enterprise Level 8: Mark setup complete and schema sync'd in KV
            try {
                if (kv) {
                    // Marker that schema is ready to avoid expensive syncEntityTable loops
                    await kv.put('db_sync_token', SYNC_TOKEN);
                    
                    // Marker that admin exists to avoid "Checking session..." delay
                    const anyUserResult = await db.query("SELECT COUNT(*) as count FROM user");
                    if (anyUserResult?.[0]?.count > 0) {
                        await kv.put('admin_exists', 'true');
                    }
                }
            } catch (e) {}

            // Run full baseline sync (ALWAYS in background to prevent AbortError from long-running ops)
            // Only start it once to avoid duplicate work
            if (!global.BASELINE_SYNC_STARTED) {
                global.BASELINE_SYNC_STARTED = true;
                const baselineSyncPromise = ensureBaselineSync(db, baseline).catch(e => {
                    console.error("[DB-INIT] Background baseline sync failed:", e.message);
                });
                
                // Only use waitUntil if available (Cloudflare Workers)
                if (ctx && typeof ctx.waitUntil === 'function') {
                    ctx.waitUntil(baselineSyncPromise);
                }
                // Otherwise just let it run in the background without blocking
            }
            
            console.log(`[DB-INIT] Initialization procedure finished in ${Date.now() - start}ms.`);

        } catch (e: any) {
            if (e?.name === 'AbortError') {
                console.error(`[DB-INIT-ABORT] Initializarea DB a fost intrerupta de client sau server (AbortError). Request=${requestUrl} Stack:`, e.stack);
            } else {
                console.error("[DB-INIT-FATAL] Database initialization CRASHED:", e.message, e.stack);
            }
            global.DB_INIT_PROMISE = null;
            throw e;
        }
    })();
    return global.DB_INIT_PROMISE;
}

export function mapFieldType(type: string): string {
    const t = (type || 'text').toLowerCase();
    if (['number', 'integer', 'int'].includes(t)) return 'REAL';
    if (['boolean', 'bool', 'toggle'].includes(t)) return 'INTEGER';
    return 'TEXT';
}

export async function ensureBaselineSync(db: any, registry: any) {
    const baselineEntities = registry.ENTITY_CONFIG || registry.ENTITY_CONFIG || registry.entity_definition || registry.entity_definition || {};
    const jsonStringify = (value: any, fallback: string | null = null) => {
        if (value === null || value === undefined) return fallback;
        if (typeof value === 'string') return value;
        try {
            return JSON.stringify(value);
        } catch {
            return fallback;
        }
    };

    const formatLabelValue = (value: any, fallback: string) => {
        if (value === null || value === undefined) return fallback;
        if (typeof value === 'string') return value;
        try {
            return JSON.stringify(value);
        } catch {
            return fallback;
        }
    };
    
    // Step 0: Ensure entity_definition has all required columns (Enterprise Level 8 Auto-Heal)
    const requiredColumns = [
        'id', 'name', 'label', 'labelPlural', 'description', 'icon', 'colorTheme',
        'tableName', 'displayField', 'fields', 'validations', 'relationships', 'dependencies',
        'uiConfig', 'menuConfig', 'permission', 'features', 'layout',
        'dashboardConfig', 'isSystem', 'workspaceId', 'createdAt', 'updatedAt'
    ];
    
    try {
        const existingCols = await db.query(`PRAGMA table_info("entity_definition")`);
        const existingColNamesLower = existingCols.map((c: any) => (c.name || '').toLowerCase());
        
        for (const col of requiredColumns) {
            if (!existingColNamesLower.includes(col.toLowerCase())) {
                const colType = ['fields', 'validations', 'relationships', 'dependencies', 'uiConfig', 'menuConfig', 'permission', 'features', 'layout', 'dashboardConfig'].includes(col) ? 'JSON' : 'TEXT';
                console.log(`[DB-INIT] AUTO-HEAL: Adding missing column "${col}" to entity_definition`);
                await db.exec(`ALTER TABLE "entity_definition" ADD COLUMN "${col}" ${colType}`);
            }
        }
    } catch (e: any) {
        console.warn("[DB-INIT] entity_definition column check failed:", e.message);
    }
    
    if (baselineEntities && Object.keys(baselineEntities).length > 0) {
        const metaStatements: any[] = [];
        
        for (const [name, config] of Object.entries(baselineEntities)) {
            try {
                // syncEntityTable handles DDL (CREATE/ALTER) - keep individual as it's sensitive
                const syncResult = await syncEntityTable(db, { name, ...(config as any) }, registry);
                
                if (syncResult && !Array.isArray(syncResult)) {
                    const normalized = syncResult as EntityDefinition;
                    metaStatements.push(
                        db.prepare(`INSERT OR REPLACE INTO entity_definition (
                            id, name, label, labelPlural, tableName, icon, fields, 
                            validations, relationships, dependencies, uiConfig, menuConfig, 
                            permission, features, layout, dashboardConfig,
                            workspaceId, isSystem
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                        .bind(
                            normalized.id || normalized.name, 
                            normalized.name, 
                            jsonStringify(normalized.label),
                            jsonStringify(normalized.labelPlural),
                            normalized.tableName || normalized.name, 
                            normalized.icon || 'Box',
                            jsonStringify(normalized.fields || []),
                            jsonStringify(normalized.validations || {}),
                            jsonStringify(normalized.relationships || []),
                            jsonStringify(normalized.dependencies || []),
                            jsonStringify(normalized.uiConfig || {}),
                            jsonStringify(normalized.menuConfig || {}),
                            jsonStringify(normalized.permission || {}),
                            jsonStringify(normalized.features || {}),
                            jsonStringify(normalized.layout || {}),
                            jsonStringify(normalized.dashboardConfig || {}),
                            'system',
                            normalized.isSystem ? 1 : 0
                        )
                    );
                }
            } catch (e: any) {
                console.warn(`[DB-INIT] Baseline sync: entity '${name}' failed:`, e?.message || e);
            }
        }

        if (metaStatements.length > 0) {
            console.log(`[DB-INIT] Syncing ${metaStatements.length} entity definitions (Batched)...`);
            await db.batch(metaStatements).catch((e: any) => console.error("[DB-INIT] Entity meta batch sync failed:", e.message));
        }
    }

    // Enterprise Level 8: Sync Settings, Prompts & Roles Baseline
    try {
        await syncSystemSettingsBaseline(db, registry);
        await syncAiPromptsBaseline(db, registry);
        await syncRolesBaseline(db, registry);
        await syncWorkspaceSettingsBaseline(db, registry);
    } catch (e: any) {
        console.warn(`[DB-INIT] Baseline data sync failed:`, e?.message || e);
    }

    // Level 8: Force registry reload after sync
    clearRegistryCache();
}

export async function syncWorkspaceSettingsBaseline(db: any, registry: any) {
    const systemSettings = registry.SYSTEM_SETTING || {};
    const aiConfig = registry.AI_CONFIG || {};
    
    console.log('[DB-INIT] Syncing workspace settings baseline (System Workspace)...');

    // Create a record for the 'system' workspace
    const settingsRecord = {
        id: 'system-settings',
        workspaceId: 'system',
        category: 'general',
        workspaceName: systemSettings.workspace_name || 'Studio App',
        language: registry.language || 'ro',
        timezone: registry.timezone || 'UTC',
        logoUrl: systemSettings.logo_url || '/logo.png',
        ai: JSON.stringify(aiConfig),
        setting: JSON.stringify(systemSettings)
    };

    // Use INSERT OR IGNORE to not overwrite if user modified it, or REPLACE if we want to force baseline
    const pk = 'id';
    const keys = Object.keys(settingsRecord);
    const sql = `INSERT OR REPLACE INTO workspace_setting (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
    
    await db.query(sql, Object.values(settingsRecord)).catch((e: any) => {
        console.warn("[DB-INIT] Failed to seed workspace_setting:", e.message);
    });
}

export async function syncRolesBaseline(db: any, registry: any) {
    const roles = registry.SYSTEM_ROLE || registry.roles || {};
    if (!roles || Object.keys(roles).length === 0) return;

    console.log('[DB-INIT] Syncing system roles baseline (Batched)...');
    const statements: any[] = [];

    for (const [id, config] of Object.entries(roles)) {
        const c = config as any;
        const label = c.label;
        const nameStr = typeof label === 'object' ? (label.ro || label.en) : (label || id);
        const descriptionStr = typeof c.description === 'object' ? (c.description.ro || c.description.en) : (c.description || '');

        statements.push(
            db.prepare(`INSERT OR REPLACE INTO role (id, name, color, description, permission, workspaceId) VALUES (?, ?, ?, ?, ?, ?)`)
                .bind(id, nameStr, c.color || '#3b82f6', descriptionStr, JSON.stringify(c.permission || []), 'system')
        );
    }

    if (statements.length > 0) {
        await db.batch(statements).catch((e: any) => console.error("[DB-INIT] Roles batch sync failed:", e.message));
    }
}

export async function syncSystemSettingsBaseline(db: any, registry: any) {
    // Enterprise Level 8: Invert the namespace mapping to find registry keys to sync
    const nsConfig = registry?.CONSTANT?.namespaceMapping || {};
    const namespaces: Record<string, string> = {};
    for (const [dbNs, regKey] of Object.entries(nsConfig)) {
        // We only sync keys that exist in the registry object
        if (registry[regKey as string]) {
            namespaces[regKey as string] = dbNs;
        }
    }

    console.log('[DB-INIT] Syncing system settings baseline (Batched)...');
    const statements: any[] = [];
    const processedIds = new Set<string>();

    for (const [registryKey, namespace] of Object.entries(namespaces)) {
        const data = registry[registryKey];
        if (!data || typeof data !== 'object' || Array.isArray(data)) continue;

        for (const [key, value] of Object.entries(data)) {
            const dataType = typeof value === 'object' && value !== null ? 'json' : typeof value;
            const finalValue = dataType === 'json' ? JSON.stringify(value) : (value === null ? '' : String(value));

            // Enterprise Level 8: Normalize to lowercase for consistent ID and lookup
            const targetNamespace = namespace.toLowerCase();
            const targetKey = key.toLowerCase();
            const settingId = `${targetNamespace}:${targetKey}`;

            // Prevent duplicate IDs within the same batch which causes D1 stability issues
            if (processedIds.has(settingId)) continue;
            processedIds.add(settingId);

            // Enterprise Level 8: Use INSERT OR IGNORE to allow user overrides to persist 
            statements.push(
                db.prepare(`INSERT OR IGNORE INTO system_setting (id, namespace, key, value, dataType) VALUES (?, ?, ?, ?, ?)`)
                    .bind(settingId, targetNamespace, key, finalValue, dataType)
            );
        }
    }

    if (statements.length > 0) {
        // Execute in chunks if there are many settings to avoid D1 limits
        const chunks = [];
        for (let i = 0; i < statements.length; i += 50) {
            chunks.push(statements.slice(i, i + 50));
        }
        console.log(`[DB-INIT] Processing ${statements.length} settings in ${chunks.length} chunks...`);
        let chunkIdx = 1;
        for (const chunk of chunks) {
            await db.batch(chunk).catch((e: any) => {
                console.error(`[DB-INIT] Settings batch ${chunkIdx} failed:`, e.message);
                throw e; // Propagate up
            });
            chunkIdx++;
        }
    }
}

export async function syncAiPromptsBaseline(db: any, registry: any) {
    const prompts = registry.AI_PROMPT;
    if (!prompts || typeof prompts !== 'object') return;

    console.log('[DB-INIT] Syncing AI prompts baseline (Batched)...');
    const statements: any[] = [];

    // Level 8: Check for legacy 'template' column to avoid NOT NULL constraints
    let hasTemplate = false;
    try {
        const columns = await db.query(`PRAGMA table_info("_ai_prompt")`);
        hasTemplate = !!columns.find((c: any) => c.name === 'template');
    } catch (e) {}

    // Categories that contain arrays of prompts - Defined in Registry
    const categories = registry?.CONSTANT?.aiPromptCategory || [];
    
    for (const category of categories) {
        const promptList = prompts[category];
        if (!Array.isArray(promptList)) continue;

        for (const p of promptList) {
            const nameStr = typeof p.name === 'object' ? (p.name.en || p.name.ro) : (p.name || p.id);
            
            // Enterprise Level 8: Unified bind to handle both legacy 'template' and new architecture
            const sql = hasTemplate 
                ? `INSERT OR REPLACE INTO _ai_prompt (id, name, systemPrompt, userPromptTemplate, model, inputContext, outputField, workspaceId, category, isLocked, template) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                : `INSERT OR REPLACE INTO _ai_prompt (id, name, systemPrompt, userPromptTemplate, model, inputContext, outputField, workspaceId, category, isLocked) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            const values = [
                p.id, 
                nameStr, 
                p.content || p.systemPrompt || '', 
                p.userPromptTemplate || '', 
                p.model || registry.AI_CONFIG?.model || '', 
                p.inputContext || '', 
                p.outputField || 'output', 
                'system',
                category,
                p.isLocked ? 1 : 0
            ];

            if (hasTemplate) {
                values.push(p.content || p.systemPrompt || '');
            }

            statements.push(db.prepare(sql).bind(...values));
        }
    }

    if (statements.length > 0) {
        const chunks = [];
        for (let i = 0; i < statements.length; i += 50) {
            chunks.push(statements.slice(i, i + 50));
        }
        console.log(`[DB-INIT] Processing ${statements.length} AI Prompts in ${chunks.length} chunks...`);
        let chunkIdx = 1;
        for (const chunk of chunks) {
            await db.batch(chunk).catch((e: any) => {
                console.error(`[DB-INIT] AI Prompts batch ${chunkIdx} failed:`, e.message);
                throw e; // Propagate up
            });
            chunkIdx++;
        }
    }
}

export async function syncEntityTable(db: any, rawDef: any, registry?: any, dryRun: boolean = false) {
    // Enterprise Level 8: Unified Normalization Lens
    const entityDef = normalizeEntity(rawDef);
    if (!entityDef || !entityDef.name) return dryRun ? [] : undefined;

    const tableName = resolveCollection(entityDef.tableName || entityDef.name);
    const pk = getPrimaryKey(tableName);
    const fields = entityDef.fields;
    
    const sqlStatements: string[] = [];

    try {
        const rows = await db.query(`PRAGMA table_info("${tableName}")`);
        if (!rows || rows.length === 0) {
            const colDefs = [`"${pk}" TEXT PRIMARY KEY`];
            fields.forEach((f: any) => {
                const fname = f.name || f.id;
                const ftype = (f.type || 'text').toLowerCase();

                // Skip virtual fields
                if (['relation-many', 'tag', 'calculation', 'formula', 'divider', 'group', 'section', 'tab', 'description', 'info-box'].includes(ftype)) {
                    return;
                }

                if (fname && fname !== pk && fname !== 'id') {
                    let colDef = `"${fname}" ${mapFieldType(f.type)}`;
                    if (f.unique) colDef += ' UNIQUE';
                    if (f.required) colDef += ' NOT NULL';
                    
                    // Level 8: Foreign Key Support
                    if (f.relation && f.relation.target) {
                        const targetTable = resolveCollection(f.relation.tableName || f.relation.target);
                        colDef += ` REFERENCES "${targetTable}"(id) ON DELETE SET NULL`;
                    }
                    
                    colDefs.push(colDef);
                }
            });
            
            // Add standard fields (Enterprise Level 8) - Defined in Registry
            const std = registry?.CONSTANT?.systemFields || [];
            std.forEach((s: string) => {
                // Skip workspaceId for workspace table (redundant)
                if (s === 'workspaceId' && tableName === 'workspace') return;
                
                if (!fields.find((f: any) => ((f.name || f.id) || '').toLowerCase() === s.toLowerCase())) {
                    colDefs.push(`"${s}" ${s === 'archived' ? 'INTEGER DEFAULT 0' : 'TEXT'}`);
                }
            });

            const sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs.join(', ')})`;
            
            if (dryRun) {
                sqlStatements.push(sql);
            } else {
                console.log(`[DB-SCHEMA-DDL] EXEC: ${sql}`);
                await db.query(sql);
            }
        } else {
            const existingColsRaw = rows.map((r: any) => r.name);
            const existingColsLower = existingColsRaw.map((n: string) => n.toLowerCase());
            
            const missing: any[] = [];
            const processedMissing = new Set<string>();

            // 1. Process fields from entity definition
            fields.forEach((f: any) => {
                const fname = f.name || f.id;
                const ftype = (f.type || 'text').toLowerCase();
                
                // Skip virtual fields that don't need a physical column
                if (['relation-many', 'tag', 'calculation', 'formula', 'divider', 'group', 'section', 'tab', 'description', 'info-box'].includes(ftype)) {
                    return;
                }

                if (fname && !existingColsLower.includes(fname.toLowerCase())) {
                    if (!processedMissing.has(fname.toLowerCase())) {
                        missing.push(f);
                        processedMissing.add(fname.toLowerCase());
                    }
                }
            });
            
            // 2. Core system fields check - From Registry
            const std = registry?.CONSTANT?.systemFields || [];
            std.forEach((s: string) => {
                // Skip workspaceId for workspace table
                if (s === 'workspaceId' && tableName === 'workspace') return;
                
                if (!existingColsLower.includes(s.toLowerCase())) {
                    if (!processedMissing.has(s.toLowerCase())) {
                        missing.push({ name: s, label: s, type: s === 'archived' ? 'boolean' : 'text' });
                        processedMissing.add(s.toLowerCase());
                    }
                }
            });

            if (missing.length > 0) {
                for (const col of missing) {
                    const fname = col.name || col.id;
                    const sql = `ALTER TABLE "${tableName}" ADD COLUMN "${fname}" ${mapFieldType(col.type)}`;
                    
                    if (dryRun) {
                        sqlStatements.push(sql);
                        if (col.unique) {
                            sqlStatements.push(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_unique_${tableName}_${fname}" ON "${tableName}"("${fname}")`);
                        }
                    } else {
                        try {
                            console.log(`[DB-SCHEMA-DDL] EXEC: ${sql}`);
                            await db.exec(sql);
                            
                            // If it's unique, we need an index because ALTER TABLE doesn't support UNIQUE directly in some SQLite versions/D1
                            if (col.unique) {
                                console.log(`[DB-SCHEMA] Creating unique index for "${tableName}.${fname}"`);
                                await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_unique_${tableName}_${fname}" ON "${tableName}"("${fname}")`);
                            }
                        } catch (e: any) {
                            console.warn(`[DB-SCHEMA] Failed to alter "${tableName}": ${e.message}`);
                        }
                    }
                }
            }
        }
        
        if (dryRun) return sqlStatements;
        return entityDef;
    } catch (e: any) {
        console.error(`[DB-SCHEMA] Fatal error syncing "${tableName}":`, e.message);
        throw e; // RETHROW so the caller (Brain) knows it failed
    }
}
