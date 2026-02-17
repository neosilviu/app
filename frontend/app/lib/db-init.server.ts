import { getRegistry, resolveCollection, getPrimaryKey, normalizeEntity, clearRegistryCache, loadBaseline, type EntityDefinition } from './core';
import { getSchemaHash, getSchemaMetadata, schemaChanged, getDDLStatements } from './schema-cache.server';

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

    // Level 10: Improved signal awareness to prevent AbortError during init
    while (!global.IS_DB_INITIALIZED && (Date.now() - startTime) < maxWaitMs) {
        if (signal?.aborted) {
            console.log(`[DB-READY] Wait aborted by client signal.`);
            const abortErr = new Error("Request aborted");
            abortErr.name = "AbortError";
            throw abortErr;
        }

        if (global.DB_INIT_PROMISE) {
            try {
                // Enterprise Level 10: Added race to prevent blocking the while loop indefinitely if init hangs
                await Promise.race([
                    global.DB_INIT_PROMISE,
                    new Promise(r => setTimeout(r, 1000)) // Check every 1s
                ]);
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
    // Enterprise Level 10: Absolute Fast-Path (Isolate Warm)
    if (global.IS_DB_INITIALIZED) return;

    if (global.DB_INIT_PROMISE) {
        return global.DB_INIT_PROMISE;
    }

    // Enterprise Level 11: SMART SCHEMA HASH CHECK
    // If schema hasn't changed, skip expensive PRAGMA table_info() calls
    const codeHash = getSchemaHash();
    if (codeHash) {
        try {
            const dbHashResult = await db.query("SELECT value FROM system_setting WHERE namespace='schema' AND key='hash' LIMIT 1");
            const dbHash = dbHashResult?.[0]?.value;
            
            if (dbHash === codeHash) {
                console.log(`[DB-INIT][HASH-MATCH] ✅ Schema not changed (${codeHash.substring(0, 8)}...) - skipping expensive sync`);
                global.IS_DB_INITIALIZED = true;
                return;
            }
        } catch (e) {
            // Table might not exist yet, fall through to normal init
        }
    }

    // Enterprise Level 10: Fast-Path for Warm Starts / Sync Detection
    const SYNC_TOKEN = "v3_modular_v1.10"; // Updated to force re-sync
    const kv = ctx?.env?.KV || ctx?.KV; // Robust check


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
            console.log("[DB-INIT] Step 1: Checking _metadata table...");
            let migrationLevel = 0;
            try {
                // Enterprise Level 10: Ultra-fast check for production
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

            // DNA-Driven Schema Synchronization
            const baseline = await loadBaseline();
            const coreEntities = (baseline.ENTITY_CONFIG || {}) as Record<string, any>;

            // Enterprise Level 10: Registry-Driven Discovery
            // We identify entities to sync based on 'baseline' flag or 'isSystem' property.
            const coreEntitiesToSync = Object.entries(coreEntities)
                .filter(([_, cfg]) => (cfg as any).isSystem === true || (cfg as any).baseline === true)
                .sort(([a, configA], [b, configB]) => {
                    // Priority to prevent FK conflicts, now driven by 'priority' metadata or lexical fallback
                    const pA = (configA as any).priority || 1000;
                    const pB = (configB as any).priority || 1000;
                    if (pA !== pB) return pA - pB;
                    return a.localeCompare(b);
                })
                .map(([name]) => name);
            
            console.log(`[DB-INIT] Syncing Core DNA (${coreEntitiesToSync.length} entities)...`);
            
            // Enterprise Level 10: Parallel Discovery Phase
            const coreDdlResults = await Promise.all(coreEntitiesToSync.map(async (entityName) => {
                const config = coreEntities[entityName];
                return await syncEntityTable(db, { ...config, name: entityName }, baseline, true);
            }));

            const coreDdl: string[] = [];
            coreDdlResults.forEach(stmts => {
                if (Array.isArray(stmts)) coreDdl.push(...stmts);
            });

            if (coreDdl.length > 0) {
                console.log(`[DB-INIT] Applying ${coreDdl.length} Core DDL statements (Batched)...`);
                // Split into smaller batches to prevent D1 statement limits if needed
                const ddlChunks = [];
                for (let i = 0; i < coreDdl.length; i += 20) {
                    ddlChunks.push(coreDdl.slice(i, i + 20));
                }

                for (const chunk of ddlChunks) {
                    const batchStmts = chunk.map(sql => db.prepare(sql));
                    await db.batch(batchStmts).catch((ddlErr: any) => {
                        // Ignore common duplicate errors during concurrent boot
                        if (!ddlErr.message.includes("duplicate column name") && !ddlErr.message.includes("already exists")) {
                            console.warn(`[DB-INIT] DDL Warning in batch:`, ddlErr.message);
                        }
                    });
                }
            }

            // Step 3: Specific Migrations / Fixes (Keep only what's absolutely necessary)
            // Ensure System Workspace exists (MANDATORY for Level 10 isolation)
            try {
                const systemWorkspace = await db.query("SELECT id FROM workspace WHERE id = 'system' LIMIT 1");
                if (!systemWorkspace || systemWorkspace.length === 0) {
                    console.log("[DB-INIT][SEED] Creating mandatory 'system' workspace...");
                    await db.query(`
                        INSERT OR IGNORE INTO workspace (id, name, slug, ownerId, createdAt, updatedAt) 
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, ['system', 'System Administration', 'system', 'system', new Date().toISOString(), new Date().toISOString()]);
                } else {
                    console.log("[DB-INIT] 'system' workspace confirmed.");
                }
            } catch (e: any) {
                console.error("[DB-INIT][ERROR] System workspace seed failed:", e.message);
            }

            // Enterprise Level 11: Save schema hash to prevent expensive re-syncs
            if (codeHash) {
                try {
                    await db.query(`
                        INSERT OR REPLACE INTO system_setting 
                        (id, namespace, key, value, dataType, workspaceId, createdAt, updatedAt) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        'schema:hash',
                        'schema',
                        'hash',
                        codeHash,
                        'text',
                        'system',
                        new Date().toISOString(),
                        new Date().toISOString()
                    ]);
                    console.log(`[DB-INIT][HASH-SAVED] ✅ Saved schema hash: ${codeHash.substring(0, 8)}...`);
                } catch (e: any) {
                    console.warn("[DB-INIT] Could not save schema hash:", e.message);
                }
            }

            // Enterprise Level 10: Set initialized AFTER core sync and critical data seed
            global.IS_DB_INITIALIZED = true;
            const duration = Date.now() - start;
            console.log(`[DB-INIT] Initialization complete in ${duration}ms (Core data ready).`);

            // Enterprise Level 10: Mark setup complete and schema sync'd in KV
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
                console.log("[DB-INIT] Triggering full baseline background sync...");
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

/**
 * Ensures entity_definition table has correct schema for V3 DNA
 */
export async function ensureBaselineSync(db: any, registry: any) {
    const baselineEntities = registry.ENTITY_CONFIG || registry.entity_definition || {};
    const jsonStringify = (value: any, fallback: string | null = null) => {
        if (value === null || value === undefined) return fallback;
        if (typeof value === 'string') return value;
        try {
            return JSON.stringify(value);
        } catch {
            return fallback;
        }
    };
    
    if (baselineEntities && Object.keys(baselineEntities).length > 0) {
        const metaStatements: any[] = [];
        const ddlStatements: string[] = [];
        
        console.log(`[DB-INIT] Analyzing baseline for ${Object.keys(baselineEntities).length} entities...`);
        
        for (const [name, config] of Object.entries(baselineEntities)) {
            try {
                // Collect DDL and metadata in one pass using dryRun: true
                const syncResult = await syncEntityTable(db, { name, ...(config as any) }, registry, true);
                
                if (Array.isArray(syncResult)) {
                    ddlStatements.push(...syncResult);
                }

                // Get normalized entity for metadata store
                const normalized = normalizeEntity({ name, ...(config as any) });
                if (normalized) {
                    metaStatements.push(
                        db.prepare(`INSERT OR REPLACE INTO entity_definition (
                            id, name, label, labelPlural, tableName, icon, fields, 
                            validations, relationships, dependencies, uiConfig, menuConfig, 
                            permission, features, layout, actions, flowRules, dashboardConfig,
                            baseline, isCore, priority, excludeBaseFields, description,
                            workspaceId, isSystem
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
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
                            jsonStringify(normalized.actions || []), 
                            jsonStringify(normalized.flowRules || {}), 
                            jsonStringify(normalized.dashboardConfig || {}),
                            normalized.baseline ? 1 : 0,
                            normalized.isCore ? 1 : 0,
                            normalized.priority || 0,
                            jsonStringify(normalized.excludeBaseFields || []),
                            jsonStringify(normalized.description || ''),
                            'system',
                            normalized.isSystem ? 1 : 0
                        )
                    );
                }
            } catch (e: any) {
                console.warn(`[DB-INIT] Baseline analysis: entity '${name}' failed:`, e?.message || e);
            }
        }

        // 1. Execute DDL in chunks
        if (ddlStatements.length > 0) {
            console.log(`[DB-INIT] Applying ${ddlStatements.length} background DDL statements...`);
            for (let i = 0; i < ddlStatements.length; i += 20) {
                const chunk = ddlStatements.slice(i, i + 20);
                await db.batch(chunk.map((sql: string) => db.prepare(sql))).catch((e: any) => {
                    if (!e.message.includes("already exists") && !e.message.includes("duplicate column")) {
                         console.warn("[DB-INIT] DDL Batch error:", e.message);
                    }
                });
            }
        }

        // 2. Execute Metadata Sync in chunks
        if (metaStatements.length > 0) {
            console.log(`[DB-INIT] Syncing ${metaStatements.length} entity definitions (Batched)...`);
            for (let i = 0; i < metaStatements.length; i += 20) {
                const chunk = metaStatements.slice(i, i + 20);
                await db.batch(chunk).catch((e: any) => console.error("[DB-INIT] Entity meta batch sync failed:", e.message));
            }
        }

        // Enterprise Level 10: Absolute Cleanup (Strict DNA Enforcement)
        try {
            const baselineKeys = Object.keys(baselineEntities);
            if (baselineKeys.length > 0) {
                const placeholders = baselineKeys.map(() => '?').join(', ');
                console.log(`[DB-INIT] Cleaning up orphans...`);
                await db.query(
                    `DELETE FROM entity_definition WHERE isSystem = 1 AND name NOT IN (${placeholders})`,
                    baselineKeys
                );
            }
        } catch (e: any) {
            console.warn("[DB-INIT] Strict cleanup failed:", e.message);
        }
    }

    // Enterprise Level 10: Sync Settings, Prompts & Roles Baseline
    try {
        await syncSystemSettingsBaseline(db, registry);
        await syncAiPromptsBaseline(db, registry);
        await syncRolesBaseline(db, registry);
        await syncWorkspaceSettingsBaseline(db, registry);
    } catch (e: any) {
        console.warn(`[DB-INIT] Baseline data sync failed:`, e?.message || e);
    }

    // Enterprise Level 10: Force registry reload after sync
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
        workspaceName: systemSettings.workspace_name || '',
        language: registry.language || '',
        timezone: registry.timezone || '',
        logoUrl: systemSettings.logo_url || '',
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
    const namespaces: Record<string, string> = {};
    const coreMapping = registry?.CONSTANT?.coreNamespaceMapping || {
        'SYSTEM_SETTING': 'system',
        'AI_CONFIG': 'ai',
        'THEME': 'theme',
        'AUTH_CONFIG': 'auth'
    };
    
    // Enterprise Level 10: Ensure core namespaces are set first
    Object.entries(coreMapping).forEach(([registryKey, dbNamespace]) => {
        if (registry[registryKey]) namespaces[registryKey] = dbNamespace as string;
    });

    // Supplement with namespace mapping from registry
    const nsConfig = registry?.CONSTANT?.namespaceMapping || {};
    for (const [dbNs, regKey] of Object.entries(nsConfig)) {
        const rKey = regKey as string;
        if (registry[rKey] && !namespaces[rKey]) {
            namespaces[rKey] = dbNs;
        }
    }

    console.log(`[DB-INIT] Syncing system settings baseline (${Object.keys(namespaces).length} namespaces found)...`);
    console.log(`[DB-INIT] Namespaces to sync: ${JSON.stringify(namespaces)}`);

    const statements: any[] = [];
    const processedIds = new Set<string>();

    for (const [registryKey, namespace] of Object.entries(namespaces)) {
        const data = registry[registryKey];
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            console.log(`[DB-INIT] Skipping namespace ${registryKey} (Data type: ${typeof data}, isArray: ${Array.isArray(data)})`);
            continue;
        }

        console.log(`[DB-INIT] processing namespace ${registryKey} with ${Object.keys(data).length} keys`);
        for (const [key, value] of Object.entries(data)) {
            // Enterprise Level 10: Skip metadata keys
            if (key.startsWith('__')) continue;

            const dataType = typeof value === 'object' && value !== null ? 'json' : typeof value;
            const finalValue = dataType === 'json' ? JSON.stringify(value) : (value === null ? '' : String(value));


            // Enterprise Level 10: Normalize to lowercase for consistent ID and lookup
            const targetNamespace = namespace.toLowerCase();
            const targetKey = key.toLowerCase();
            const settingId = `${targetNamespace}:${targetKey}`;

            // Prevent duplicate IDs within the same batch which causes D1 stability issues
            if (processedIds.has(settingId)) continue;
            processedIds.add(settingId);

            // Enterprise Level 10: Use INSERT OR IGNORE to allow user overrides to persist 
            statements.push(
                db.prepare(`INSERT OR REPLACE INTO system_setting (id, namespace, key, value, dataType, workspaceId) VALUES (?, ?, ?, ?, ?, ?)`)
                    .bind(settingId, targetNamespace, key, finalValue, dataType, 'system')
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
                // DON'T throw, allow other syncs to continue
            });
            chunkIdx++;
        }
    } else {
        console.warn("[DB-INIT] No settings found to sync. Namespaces checked:", Object.keys(namespaces));
    }
}

export async function syncAiPromptsBaseline(db: any, registry: any) {
    const prompts = registry.AI_PROMPT;
    if (!prompts || typeof prompts !== 'object') return;

    console.log('[DB-INIT] Syncing AI prompts baseline (Batched)...');
    const statements: any[] = [];

    // Categories that contain arrays of prompts - Defined in Registry
    const categories = registry?.CONSTANT?.aiPromptCategory || [];
    
    for (const category of categories) {
        const promptList = prompts[category];
        if (!Array.isArray(promptList)) continue;

        for (const p of promptList) {
            const nameStr = typeof p.name === 'object' ? (p.name.en || p.name.ro) : (p.name || p.id);
            
            const sql = `INSERT OR REPLACE INTO _ai_prompt (id, name, template, systemPrompt, userPromptTemplate, model, provider, config, inputContext, outputField, category, description, isLocked, workspaceId) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            const values = [
                p.id, 
                nameStr, 
                p.template || p.content || '', // template is the main prompt
                p.content || p.systemPrompt || '', // systemPrompt fallback
                p.userPromptTemplate || '', 
                p.model || registry.AI_CONFIG?.model || '', 
                p.provider || registry.AI_CONFIG?.active_provider || '',
                p.config ? JSON.stringify(p.config) : '',
                p.inputContext || '', 
                p.outputField || 'output', 
                category,
                p.description ? (typeof p.description === 'object' ? JSON.stringify(p.description) : p.description) : '',
                p.isLocked ? 1 : 0,
                'system'
            ];

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
    // Enterprise Level 10: Unified Normalization Lens
    const entityDef = normalizeEntity(rawDef);
    if (!entityDef || !entityDef.name) return dryRun ? [] : undefined;

    const tableName = resolveCollection(entityDef.tableName || entityDef.name);
    const pk = getPrimaryKey(tableName);
    const fields = entityDef.fields;
    
    // Level 10: Dynamically pull virtual field types from constants
    const virtualFields = registry?.CONSTANT?.virtualFields || [];
    
    const sqlStatements: string[] = [];

    try {
        const rows = await db.query(`PRAGMA table_info("${tableName}")`);
        // existingColsLower is declared here so indexing logic later can reference it regardless of branch
        let existingColsLower: string[] = [];
        if (!rows || rows.length === 0) {
            const colDefs = [`"${pk}" TEXT PRIMARY KEY`];
            fields.forEach((f: any) => {
                const fname = f.name;
                const ftype = (f.type || 'text').toLowerCase();

                // Skip virtual fields
                if (virtualFields.includes(ftype)) {
                    return;
                }

                if (fname && fname !== pk) {
                    let colDef = `"${fname}" ${mapFieldType(f.type)}`;
                    if (f.unique) colDef += ' UNIQUE';
                    if (f.required) colDef += ' NOT NULL';
                    
                    // Foreign Key Support
                    if (f.relation && f.relation.target) {
                        const targetTable = resolveCollection(f.relation.tableName || f.relation.target);
                        colDef += ` REFERENCES "${targetTable}"(id) ON DELETE SET NULL`;
                    }
                    
                    colDefs.push(colDef);
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
            existingColsLower = existingColsRaw.map((n: string) => n.toLowerCase());
            
            const missing: any[] = [];
            const processedMissing = new Set<string>();

            // Enterprise Level 10: Primary Key check (Unified Lens)
            if (!existingColsLower.includes(pk.toLowerCase())) {
                missing.push({ name: pk, id: pk, type: 'text', label: 'Primary Key' });
                processedMissing.add(pk.toLowerCase());
            }

            // 1. Process fields from entity definition (Includes inherited Base fields)
            fields.forEach((f: any) => {
                const fname = f.name;
                const ftype = (f.type || 'text').toLowerCase();
                
                if (virtualFields.includes(ftype)) return;

                if (fname && !existingColsLower.includes(fname.toLowerCase())) {
                    if (!processedMissing.has(fname.toLowerCase())) {
                        missing.push(f);
                        processedMissing.add(fname.toLowerCase());
                    }
                }
            });

            if (missing.length > 0) {
                for (const col of missing) {
                    const fname = col.name || col.id;
                    let sql = `ALTER TABLE "${tableName}" ADD COLUMN "${fname}" ${mapFieldType(col.type)}`;
                    
                    // Enterprise Level 10: Dynamic Default for NOT NULL columns during schema evolution
                    if (fname === 'workspaceId' || col.required) {
                        if (fname === 'workspaceId') sql += " DEFAULT 'system'";
                        else if (fname === 'ownerId') sql += " DEFAULT 'system'";
                        else if (mapFieldType(col.type) === 'INTEGER') sql += " DEFAULT 0";
                        else if (mapFieldType(col.type) === 'REAL') sql += " DEFAULT 0.0";
                        else sql += " DEFAULT ''";
                    }
                    
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
        
        // --- ENTERPRISE LEVEL 10: AUTOMATED PERFORMANCE INDEXING ---
        // We sync indexes after table structure is ready.
        try {
            const indexSql: string[] = [];
            fields.forEach((f: any) => {
                const fname = f.name || f.id;
                if (!fname) return;

                // Unique indexing is handled during CREATE/ALTER, but we ensure it here too
                if (f.unique) {
                    indexSql.push(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_u_${tableName}_${fname}" ON "${tableName}"("${fname}")`);
                } 
                // Performance indexing based on .describe('index=true')
                else if (f.index === true) {
                    // Optimized descending index for dates (standard for createdAt)
                    const direction = (fname.toLowerCase().includes('date') || fname.toLowerCase().includes('createdat')) ? 'DESC' : 'ASC';
                    indexSql.push(`CREATE INDEX IF NOT EXISTS "idx_${tableName}_${fname}" ON "${tableName}"("${fname}" ${direction})`);
                }
            });

            // Ensure workspace isolation index
            if (!tableName.includes('workspace')) {
                indexSql.push(`CREATE INDEX IF NOT EXISTS "idx_${tableName}_ws" ON "${tableName}"("workspaceId")`);
            }

            // --- ENTERPRISE LEVEL 11: ULTIMATE PERFORMANCE COMPOSITE INDEX ---
            // DNA-Guided Optimization: Most critical path uses workspaceId + deletedAt + createdAt
            if (existingColsLower.includes('workspaceid') && existingColsLower.includes('deletedat') && existingColsLower.includes('createdat')) {
                indexSql.push(`CREATE INDEX IF NOT EXISTS "idx_${tableName}_ultimate_perf" ON "${tableName}"("workspaceId", "deletedAt", "createdAt" DESC)`);
            }

            // --- ENTERPRISE LEVEL 10: AUTO-PERFORMANCE COMPOSITE INDEX ---
            // Most queries filter by deletedAt and sort by createdAt DESC
            if (existingColsLower.includes('deletedat') && existingColsLower.includes('createdat')) {
                indexSql.push(`CREATE INDEX IF NOT EXISTS "idx_${tableName}_perf_standard" ON "${tableName}"("deletedAt", "createdAt" DESC)`);
            }

            // --- ENTERPRISE LEVEL 11: AUTH & SESSION OPTIMIZATION ---
            if (tableName === 'session' || tableName === 'account') {
                indexSql.push(`CREATE INDEX IF NOT EXISTS "idx_${tableName}_userId" ON "${tableName}"("userId")`);
                if (tableName === 'session') {
                    indexSql.push(`CREATE INDEX IF NOT EXISTS "idx_session_expires" ON "session"("expiresAt")`);
                }
            }
            if (tableName === 'user') {
                indexSql.push(`CREATE INDEX IF NOT EXISTS "idx_user_email" ON "user"("email")`);
            }

            // --- ENTERPRISE LEVEL 10: CUSTOM COMPOSITE INDEXES ---
            if (Array.isArray(entityDef.indexes)) {
                entityDef.indexes.forEach((idx: string, i: number) => {
                    // Check if it's already a full SQL or just column names
                    if (idx.toLowerCase().startsWith('create index')) {
                        indexSql.push(idx);
                    } else {
                        // idx can be "workspaceId, createdAt DESC"
                        // we slugify columns for name: idx_audit_log_workspaceid_createdat
                        const slug = idx.toLowerCase().replace(/ desc/g, '').replace(/ asc/g, '').replace(/[^a-z0-9]/g, '_');
                        indexSql.push(`CREATE INDEX IF NOT EXISTS "idx_${tableName}_${slug}" ON "${tableName}"(${idx})`);
                    }
                });
            }

            if (dryRun) {
                sqlStatements.push(...indexSql);
            } else if (indexSql.length > 0) {
                // Enterprise Level 10: Batch index creation to reduce I/O locks
                try {
                    const batchStmts = indexSql.map(sql => db.prepare(sql));
                    await db.batch(batchStmts).catch((e: any) => {
                        // Batch failure fallback to individual execution for already-existing indices
                        const isCommon = e.message.includes('already exists') || e.message.includes('duplicate');
                        if (!isCommon) console.warn(`[DB-INDEX-BATCH-WARN] ${tableName}:`, e.message);
                    });
                } catch (e) {
                    // Silent fallback for batch errors
                }
            }
        } catch (idxErr: any) {
            console.warn(`[DB-INDEX-SYNC-FAILED] ${tableName}:`, idxErr.message);
        }

        if (dryRun) return sqlStatements;
        return entityDef;
    } catch (e: any) {
        console.error(`[DB-SCHEMA] Fatal error syncing "${tableName}":`, e.message);
        throw e; // RETHROW so the caller (Brain) knows it failed
    }
}
