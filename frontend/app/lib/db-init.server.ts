import { getRegistry, resolveCollection, getPrimaryKey, normalizeEntity, clearRegistryCache, loadBaseline } from './core';

/**
 * AUTO-HEAL: Sync Table Schema (Enterprise Level 8)
 * Compares current DB columns with expected definition and ALTERS if needed.
 * This is a core feature of the No-Code Engine to handle schema evolution.
 */
export async function syncTableSchema(db: any, table: string, expectedColumns: string[], forceLog = false) {
    const resolved = resolveCollection(table);
    if (forceLog) console.log(`[DB-AUTOHEAL] Checking schema for ${resolved}...`);
    const info = await db.query(`PRAGMA table_info("${resolved}")`);
    if (!info || info.length === 0) {
        // Table doesn't exist yet - skip auto-heal for it
        return;
    }
    const existingColumns = info.map((r: any) => r.name.toLowerCase());
    
    for (const col of expectedColumns) {
        if (!existingColumns.includes(col.toLowerCase())) {
            console.log(`[DB-AUTOHEAL] Adding missing column "${col}" to table "${resolved}"`);
            await db.exec(`ALTER TABLE "${resolved}" ADD COLUMN "${col}" TEXT`);
        }
    }
}

// --- DB INIT STATE ---
const global = globalThis as any;
if (global.IS_DB_INITIALIZED === undefined) global.IS_DB_INITIALIZED = false;
if (global.DB_INIT_PROMISE === undefined) global.DB_INIT_PROMISE = null;
if (global.DB_INIT_STARTED === undefined) global.DB_INIT_STARTED = Date.now();

/**
 * Wait for DB to be ready before allowing any queries
 */
export async function waitForDbReady(db: any, maxWaitMs = 15000) {
    const startTime = Date.now();
    
    if (global.IS_DB_INITIALIZED) return;

    console.log(`[DB-READY] Waiting for database to be ready (Max: ${maxWaitMs}ms)...`);

    // Level 8: Reduced wait time and added more granular logging
    while (!global.IS_DB_INITIALIZED && (Date.now() - startTime) < maxWaitMs) {
        if (global.DB_INIT_PROMISE) {
            try {
                await global.DB_INIT_PROMISE;
                if (global.IS_DB_INITIALIZED) {
                    console.log(`[DB-READY] Initialization complete after ${Date.now() - startTime}ms.`);
                    break;
                }
            } catch (e: any) { 
                console.error(`[DB-READY] Initialization promise failed: ${e.message}`);
                // If it failed, don't wait the full timeout, just break and let handlers fail naturally
                break;
            }
        }
        
        await new Promise(r => setTimeout(r, 200));
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
        console.log("[DB-INIT] Initialization already in progress, waiting for existing promise...");
        return global.DB_INIT_PROMISE;
    }

    global.DB_INIT_PROMISE = (async () => {
        try {
            const start = Date.now();
            console.log(`[DB-INIT] Starting database initialization check (Request: ${requestUrl || 'internal'})...`);
            
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

            // Enterprise Level 8: Namespace Normalization Migration
            try {
                await db.exec("UPDATE SYSTEM_SETTING SET namespace = LOWER(namespace), id = LOWER(id)");
            } catch (e: any) {
                console.warn("[DB-INIT] Namespace normalization skipped (table might not exist):", e.message);
            }

            // Step 2: DNA-Driven Schema Sychronization
            const baseline = await loadBaseline();
            const coreEntities = baseline.ENTITY_CONFIG || {};

            console.log(`[DB-INIT] Starting DNA-Driven Sync for ${Object.keys(coreEntities).length} entities...`);

            // Ensure physical tables for ALL entities in Registry
            for (const [name, def] of Object.entries(coreEntities)) {
                await syncEntityTable(db, { ...(def as any), name }, baseline);
            }

            // Step 3: Specific Migrations / Fixes (Keep only what's absolutely necessary)
            if (migrationLevel < 116) {
                // Workspace Isolation check (System workspace is mandatory)
                try {
                    const workspace = await db.list('workspace');
                    if (workspace.length === 0 || !workspace.find((w: any) => w.id === 'system')) {
                         await db.create('workspace', { id: 'system', name: 'System Administration' });
                    }
                } catch (e: any) {
                    console.warn("[DB-INIT] System workspace check skipped:", e.message);
                }
            }

            // Level 8: Set initialized BEFORE baseline sync
            global.IS_DB_INITIALIZED = true;
            console.log(`[DB-INIT] Core schema applied in ${Date.now() - start}ms; starting baseline sync in ${typeof ctx?.waitUntil === 'function' ? 'background' : 'foreground'}`);

            // Load registry for baseline sync
            const registry = await getRegistry();

            // Run baseline sync (use waitUntil if on Cloudflare Workers)
            if (ctx && typeof ctx.waitUntil === 'function') {
                ctx.waitUntil(ensureBaselineSync(db, registry));
            } else {
                await ensureBaselineSync(db, registry);
            }
            console.log(`[DB-INIT] Initialization procedure finished in ${Date.now() - start}ms.`);

        } catch (e: any) {
            console.error("[DB-INIT-FATAL] Database initialization CRASHED:", e.message, e.stack);
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
    if (baselineEntities && Object.keys(baselineEntities).length > 0) {
        const metaStatements: any[] = [];
        
        for (const [name, config] of Object.entries(baselineEntities)) {
            try {
                // syncEntityTable handles DDL (CREATE/ALTER) - keep individual as it's sensitive
                const normalized = await syncEntityTable(db, { name, ...(config as any) }, registry);
                
                if (normalized) {
                    metaStatements.push(
                        db.prepare(`INSERT OR REPLACE INTO entity_definition (
                            id, name, label, labelPlural, description, icon, colorTheme, 
                            tableName, displayField, fields, validations, relationships, 
                            uiConfig, menuConfig, permission, features, layout, 
                            dashboardConfig, isSystem, workspaceId
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                        .bind(
                            normalized.name, normalized.name, 
                            typeof normalized.label === 'object' ? JSON.stringify(normalized.label) : normalized.label,
                            typeof normalized.labelPlural === 'object' ? JSON.stringify(normalized.labelPlural) : normalized.labelPlural,
                            typeof normalized.description === 'object' ? JSON.stringify(normalized.description) : (normalized.description || ''), 
                            normalized.icon || 'Box', normalized.colorTheme || 'blue', 
                            normalized.tableName || normalized.name, normalized.displayField || 'name',
                            JSON.stringify(normalized.fields || {}),
                            JSON.stringify(normalized.validations || {}),
                            JSON.stringify(normalized.relationships || {}),
                            JSON.stringify(normalized.uiConfig || {}),
                            JSON.stringify(normalized.menuConfig || {}),
                            JSON.stringify(normalized.permission || {}),
                            JSON.stringify(normalized.features || {}),
                            JSON.stringify(normalized.layout || {}),
                            JSON.stringify(normalized.dashboardConfig || {}),
                            1, // isSystem
                            'system'
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
        settings: JSON.stringify(systemSettings)
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

    for (const [registryKey, namespace] of Object.entries(namespaces)) {
        const data = registry[registryKey];
        if (!data || typeof data !== 'object' || Array.isArray(data)) continue;

        for (const [key, value] of Object.entries(data)) {
            const dataType = typeof value === 'object' && value !== null ? 'json' : typeof value;
            const finalValue = dataType === 'json' ? JSON.stringify(value) : (value === null ? '' : String(value));

            // Enterprise Level 8: Use INSERT OR IGNORE to allow user overrides to persist across reboots
            // Use lowercase namespace to maintain UI consistency and avoid duplicate records
            const targetNamespace = namespace.toLowerCase();
            statements.push(
                db.prepare(`INSERT OR IGNORE INTO SYSTEM_SETTING (id, namespace, key, value, dataType) VALUES (?, ?, ?, ?, ?)`)
                    .bind(`${targetNamespace}:${key}`, targetNamespace, key, finalValue, dataType)
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
                p.model || 'gemini-1.5-pro', 
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

export async function syncEntityTable(db: any, rawDef: any, registry?: any) {
    // Enterprise Level 8: Unified Normalization Lens
    const entityDef = normalizeEntity(rawDef);
    if (!entityDef || !entityDef.name) return;

    const tableName = resolveCollection(entityDef.tableName || entityDef.name);
    const pk = getPrimaryKey(tableName);
    const fields = entityDef.fields;
    
    console.log(`[DB-SCHEMA] Syncing table: "${tableName}"`);

    try {
        const pragmaStart = Date.now();
        console.log(`[DB-SCHEMA] PRAGMA table_info start for "${tableName}"`);
        const rows = await db.query(`PRAGMA table_info("${tableName}")`);
        console.log(`[DB-SCHEMA] PRAGMA table_info for "${tableName}" completed in ${Date.now() - pragmaStart}ms`);
        if (!rows || rows.length === 0) {
            const colDefs = [`"${pk}" TEXT PRIMARY KEY`];
            fields.forEach((f: any) => {
                const fname = f.name || f.id;
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
                
                if (!fields.find((f: any) => (f.name || f.id) === s)) {
                    colDefs.push(`"${s}" ${s === 'archived' ? 'INTEGER DEFAULT 0' : 'TEXT'}`);
                }
            });

            const createStart = Date.now();
            const sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs.join(', ')})`;
            console.log(`[DB-SCHEMA-DDL] EXEC: ${sql}`);
            await db.query(sql);
            console.log(`[DB-SCHEMA] Created table "${tableName}" in ${Date.now() - createStart}ms`);
        } else {
            const existingCols = rows.map((r: any) => r.name);
            const missing = fields.filter((f: any) => {
                const fname = f.name || f.id;
                return fname && !existingCols.includes(fname);
            });
            
            // Core system fields check - From Registry
            const std = registry?.CONSTANT?.systemFields || [];
            std.forEach((s: string) => {
                // Skip workspaceId for workspace table
                if (s === 'workspaceId' && tableName === 'workspace') return;
                
                if (!existingCols.includes(s)) {
                    missing.push({ name: s, label: s, type: s === 'archived' ? 'boolean' : 'text' });
                }
            });

            if (missing.length > 0) {
                for (const col of missing) {
                    try {
                        const fname = col.name || col.id;
                        const sql = `ALTER TABLE "${tableName}" ADD COLUMN "${fname}" ${mapFieldType(col.type)}`;
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
        return entityDef;
    } catch (e: any) {
        console.error(`[DB-SCHEMA] Fatal error syncing "${tableName}":`, e.message);
        throw e; // RETHROW so the caller (Brain) knows it failed
    }
}
