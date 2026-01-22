import { getRegistry, resolveCollection, getPrimaryKey, normalizeEntity, clearRegistryCache } from './core';
import { clearColumnCache } from './d1.server';

/**
 * AUTO-HEAL: Sync Table Schema (Enterprise Level 8)
 * Compares current DB columns with expected definition and ALTERS if needed.
 * This is a core feature of the No-Code Engine to handle schema evolution.
 */
export async function syncTableSchema(db: any, table: string, expectedColumns: string[], forceLog = false) {
    try {
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
                await db.exec(`ALTER TABLE "${resolved}" ADD COLUMN "${col}" TEXT`).catch((e: any) => {
                    console.warn(`[DB-AUTOHEAL] Failed to add column ${col}:`, e.message);
                });
            }
        }
    } catch (e: any) {
        if (forceLog) console.error(`[DB-AUTOHEAL] Check failed for ${table}:`, e.message);
        else console.warn(`[DB-AUTOHEAL] Check failed for ${table}:`, e.message);
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

            // Step 2: Schema Version 116 (Enterprise Architecture)
            if (migrationLevel >= 116) {
                const defCountResult = await db.query("SELECT COUNT(*) as count FROM entity_definition").catch(() => [{ count: 0 }]);
                const defCount = defCountResult[0]?.count || 0;

                if (defCount > 0) {
                    console.log(`[DB-INIT] Level 116 detected with ${defCount} entities. Verifying core columns...`);
                    
                    // Global Auto-Heal for all tables (Enterprise Level 116 Standard)
                    const allTables = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE '_metadata'");
                    for (const t of allTables) {
                        await syncTableSchema(db, t.name, ['archived', 'deletedAt', 'workspaceId', 'createdBy', 'updatedBy']);
                    }

                    // Level 8: Trigger baseline sync in background if needed (Ensures new entities appear)
                    const registry = await getRegistry();
                    if (ctx && typeof ctx.waitUntil === 'function') {
                        ctx.waitUntil(ensureBaselineSync(db, registry));
                    } else {
                        ensureBaselineSync(db, registry).catch(e => console.error("[DB-INIT] Background baseline sync failed:", e.message));
                    }

                    global.IS_DB_INITIALIZED = true;
                    return;
                }
                console.log("[DB-INIT] Level 116 detected but definitions are missing. Proceeding with sync...");
            }

            console.log(`[DB-INIT] Initializing Enterprise structure (Level 116)... Target version: 116, Current: ${migrationLevel}`);

            const schemaStatements = [
                "CREATE TABLE IF NOT EXISTS _metadata (key TEXT PRIMARY KEY, value TEXT, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP)",
                "CREATE TABLE IF NOT EXISTS entity_definition (id TEXT PRIMARY KEY, name TEXT NOT NULL, label TEXT, labelPlural TEXT, description TEXT, icon TEXT DEFAULT 'Box', colorTheme TEXT, tableName TEXT, displayField TEXT, fields TEXT NOT NULL, validations TEXT, relationships TEXT, uiConfig TEXT, menuConfig TEXT, permissions TEXT, features TEXT, layout TEXT, dashboardConfig TEXT, isSystem INTEGER DEFAULT 0, workspaceId TEXT DEFAULT 'system', archived INTEGER DEFAULT 0, archivedAt DATETIME, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, deletedAt DATETIME, createdBy TEXT, updatedBy TEXT, UNIQUE(name, workspaceId))",
                "CREATE TABLE IF NOT EXISTS system_setting (id TEXT PRIMARY KEY, namespace TEXT NOT NULL, key TEXT NOT NULL, value TEXT, dataType TEXT DEFAULT 'text', description TEXT, isSecret INTEGER DEFAULT 0, workspaceId TEXT, archived INTEGER DEFAULT 0, archivedAt DATETIME, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, deletedAt DATETIME, createdBy TEXT, updatedBy TEXT, UNIQUE(namespace, key))",
                "CREATE TABLE IF NOT EXISTS _ai_prompt (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, systemPrompt TEXT, userPromptTemplate TEXT, model TEXT, inputContext TEXT, outputField TEXT, category TEXT, description TEXT, workspaceId TEXT DEFAULT 'system', archived INTEGER DEFAULT 0, archivedAt DATETIME, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, deletedAt DATETIME, createdBy TEXT, updatedBy TEXT, isLocked INTEGER DEFAULT 0)",
                "CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, emailVerified INTEGER DEFAULT 0, image TEXT, role TEXT DEFAULT 'user', preferredLanguage TEXT DEFAULT 'ro', workspaceId TEXT, lastWorkspaceId TEXT, status TEXT DEFAULT 'active', archived INTEGER DEFAULT 0, archivedAt DATETIME, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, deletedAt DATETIME, createdBy TEXT, updatedBy TEXT)",
                "CREATE TABLE IF NOT EXISTS session (id TEXT PRIMARY KEY, expiresAt INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, ipAddress TEXT, userAgent TEXT, userId TEXT NOT NULL REFERENCES user(id), archived INTEGER DEFAULT 0, archivedAt DATETIME, deletedAt DATETIME, workspaceId TEXT, createdBy TEXT, updatedBy TEXT)",
                "CREATE TABLE IF NOT EXISTS account (id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES user(id), accountId TEXT NOT NULL, providerId TEXT NOT NULL, accessToken TEXT, refreshToken TEXT, idToken TEXT, accessTokenExpiresAt INTEGER, refreshTokenExpiresAt INTEGER, scope TEXT, password TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, archived INTEGER DEFAULT 0, archivedAt DATETIME, deletedAt DATETIME, workspaceId TEXT, createdBy TEXT, updatedBy TEXT)",
                "CREATE TABLE IF NOT EXISTS verification (id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL, expiresAt INTEGER NOT NULL, createdAt INTEGER, updatedAt INTEGER, archived INTEGER DEFAULT 0, archivedAt DATETIME, deletedAt DATETIME, workspaceId TEXT, createdBy TEXT, updatedBy TEXT)",
                "CREATE TABLE IF NOT EXISTS workspace (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, slug TEXT UNIQUE, ownerId TEXT REFERENCES user(id) ON DELETE SET NULL, avatarUrl TEXT, settings TEXT, status TEXT DEFAULT 'active', archived INTEGER DEFAULT 0, archivedAt DATETIME, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, deletedAt DATETIME, createdBy TEXT, updatedBy TEXT)",
                "CREATE TABLE IF NOT EXISTS role (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT, description TEXT, permissions TEXT, workspaceId TEXT DEFAULT 'system', archived INTEGER DEFAULT 0, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, deletedAt DATETIME, createdBy TEXT, updatedBy TEXT)",
                "CREATE TABLE IF NOT EXISTS workspace_user (id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspace(id), userId TEXT NOT NULL REFERENCES user(id), role TEXT DEFAULT 'user', permissions TEXT, archived INTEGER DEFAULT 0, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(workspaceId, userId))",
                "CREATE TABLE IF NOT EXISTS tag_assignment (id TEXT PRIMARY KEY, workspaceId TEXT, tagId TEXT, entityType TEXT, entityId TEXT, archived INTEGER DEFAULT 0, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP)",
                "CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, workspaceId TEXT, action TEXT, entityType TEXT, entityId TEXT, display_value TEXT, user TEXT, userId TEXT, details TEXT, snapshot_before TEXT, snapshot_after TEXT, version INTEGER DEFAULT 1, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, deletedAt DATETIME, archived INTEGER DEFAULT 0, createdBy TEXT, updatedBy TEXT)"
            ];
            
            // Use batch for much better performance and atomicity
            try {
                console.log(`[DB-INIT] Executing ${schemaStatements.length} schema statements via BATCH...`);
                const batch = schemaStatements.map(stmt => db.prepare(stmt));
                await db.batch(batch);
                console.log("[DB-INIT] Schema batch execution successful.");
            } catch (e: any) {
                console.error("[DB-INIT] Schema batch execution failed. Attempting sequential fallback...", e.message);
                // Fallback to sequential if batch fails
                for (const stmt of schemaStatements) {
                    console.log(`[DB-INIT] Sequential fallback: ${stmt.substring(0, 50)}...`);
                    await db.query(stmt);
                }
            }
            
            // --- AUTO-HEAL: SYSTEM CORE ---
            // Only perform auto-heal if we're not at level 116 already
            if (migrationLevel < 116) {
                console.log("[DB-INIT] Running auto-heal for core kernel tables...");
                
                await syncTableSchema(db, 'user', [
                    'name', 'email', 'role', 'workspaceId', 'status', 'archived', 'deletedAt', 'updatedAt'
                ], true);

                await syncTableSchema(db, 'account', [
                    'userId', 'accountId', 'providerId', 'accessToken', 'refreshToken', 
                    'idToken', 'accessTokenExpiresAt', 'refreshTokenExpiresAt', 'scope', 'password',
                    'workspaceId', 'archived', 'deletedAt'
                ], true);

                await syncTableSchema(db, 'workspace', [
                    'name', 'description', 'archived', 'archivedAt', 'deletedAt', 'updatedAt'
                ], true);

                await syncTableSchema(db, 'entity_definition', [
                    'label', 'labelPlural', 'description', 'icon', 'colorTheme', 
                    'tableName', 'displayField', 'fields', 'validations', 
                    'relationships', 'uiConfig', 'menuConfig', 'permissions', 
                    'features', 'layout', 'dashboardConfig', 'isSystem', 'workspaceId', 'archived', 'deletedAt', 'updatedAt'
                ], true);

                await syncTableSchema(db, '_ai_prompt', [
                    'name', 'description', 'systemPrompt', 'userPromptTemplate', 'model', 'inputContext', 'outputField', 'category', 'workspaceId', 'archived', 'deletedAt', 'updatedAt', 'isLocked'
                ], true);

                // Level 8: Handle legacy 'template' column if it exists (Rename to systemPrompt if systemPrompt is empty)
                try {
                    const columns = await db.query(`PRAGMA table_info("_ai_prompt")`);
                    if (columns.find((c: any) => c.name === 'template')) {
                        console.log("[DB-INIT] Legacy 'template' column detected in _ai_prompt. Migrating data...");
                        await db.query(`UPDATE _ai_prompt SET systemPrompt = template WHERE (systemPrompt IS NULL OR systemPrompt = '') AND template IS NOT NULL`);
                        // We don't drop columns in SQLite easily, but we can make it NULLable if we had a better DDL engine.
                        // For now, we just ensure it doesn't block inserts.
                    }
                } catch (e) {
                    console.warn("[DB-INIT] Legacy _ai_prompt migration skipped:", e.message);
                }

                // Level 8: Ensure archived exists as numeric 0 for all system entities
                await db.query("UPDATE _ai_prompt SET archived = 0 WHERE archived IS NULL").catch(() => {});
                await db.query("UPDATE entity_definition SET archived = 0 WHERE archived IS NULL").catch(() => {});
                await db.query("UPDATE workspace SET archived = 0 WHERE archived IS NULL").catch(() => {});
            }

            console.log("[DB-INIT] Updating _metadata db_version to 116...");
            await db.query("INSERT OR REPLACE INTO _metadata (key, value) VALUES ('db_version', '116')");
            clearColumnCache('entity_definition');

            // Workspace Isolation check
            try {
                console.log("[DB-INIT] Ensuring 'system' workspace exists...");
                const workspace = await db.list('workspace');
                if (workspace.length === 0 || !workspace.find((w: any) => w.id === 'system')) {
                     console.log("[DB-INIT] Creating 'system' workspace record...");
                     await db.create('workspace', { id: 'system', name: 'System Administration', description: 'Root workspace for system entities' });
                }
            } catch (e: any) {
                console.error("[DB-INIT] Failed to ensure 'system' workspace:", e.message);
            }

            console.log("[DB-INIT] Loading registry for baseline sync...");
            const registry = await getRegistry();
            
            // Level 8: Set initialized BEFORE baseline sync to allow parallel requests 
            // once core tables exist.
            global.IS_DB_INITIALIZED = true;
            console.log(`[DB-INIT] Core schema applied in ${Date.now() - start}ms; starting baseline sync in ${typeof ctx?.waitUntil === 'function' ? 'background' : 'foreground'}`);

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
    const baselineEntities = registry.ENTITY_CONFIGS || registry.ENTITY_CONFIG || registry.entity_definition || registry.entity_definition || {};
    if (baselineEntities && Object.keys(baselineEntities).length > 0) {
        const metaStatements: any[] = [];
        
        for (const [name, config] of Object.entries(baselineEntities)) {
            try {
                // syncEntityTable handles DDL (CREATE/ALTER) - keep individual as it's sensitive
                const normalized = await syncEntityTable(db, { name, ...(config as any) });
                
                if (normalized) {
                    metaStatements.push(
                        db.prepare(`INSERT OR REPLACE INTO entity_definition (
                            id, name, label, labelPlural, description, icon, colorTheme, 
                            tableName, displayField, fields, validations, relationships, 
                            uiConfig, menuConfig, permissions, features, layout, 
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
                            JSON.stringify(normalized.permissions || {}),
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
    const systemSettings = registry.system_setting || {};
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
    const roles = registry.roles || registry.SYSTEM_ROLES || {};
    if (!roles || Object.keys(roles).length === 0) return;

    console.log('[DB-INIT] Syncing system roles baseline (Batched)...');
    const statements: any[] = [];

    for (const [id, config] of Object.entries(roles)) {
        const c = config as any;
        const label = c.label;
        const nameStr = typeof label === 'object' ? (label.ro || label.en) : (label || id);
        const descriptionStr = typeof c.description === 'object' ? (c.description.ro || c.description.en) : (c.description || '');

        statements.push(
            db.prepare(`INSERT OR REPLACE INTO role (id, name, color, description, permissions, workspaceId) VALUES (?, ?, ?, ?, ?, ?)`)
                .bind(id, nameStr, c.color || '#3b82f6', descriptionStr, JSON.stringify(c.permissions || []), 'system')
        );
    }

    if (statements.length > 0) {
        await db.batch(statements).catch((e: any) => console.error("[DB-INIT] Roles batch sync failed:", e.message));
    }
}

export async function syncSystemSettingsBaseline(db: any, registry: any) {
    const namespaces: Record<string, string> = {
        'system_setting': 'system',
        'AI_CONFIG': 'ai',
        'AUTH_CONFIG': 'auth',
        'THEME': 'theme',
        'WAPP_CONFIG': 'whatsapp'
    };

    console.log('[DB-INIT] Syncing system settings baseline (Batched)...');
    const statements: any[] = [];

    for (const [registryKey, namespace] of Object.entries(namespaces)) {
        const data = registry[registryKey];
        if (!data || typeof data !== 'object' || Array.isArray(data)) continue;

        for (const [key, value] of Object.entries(data)) {
            const dataType = typeof value === 'object' && value !== null ? 'json' : typeof value;
            const finalValue = dataType === 'json' ? JSON.stringify(value) : (value === null ? '' : String(value));

            statements.push(
                db.prepare(`INSERT OR REPLACE INTO system_setting (id, namespace, key, value, dataType) VALUES (?, ?, ?, ?, ?)`)
                    .bind(`${namespace}:${key}`, namespace, key, finalValue, dataType)
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
    const prompts = registry.AI_PROMPTS;
    if (!prompts || typeof prompts !== 'object') return;

    console.log('[DB-INIT] Syncing AI prompts baseline (Batched)...');
    const statements: any[] = [];

    // Level 8: Check for legacy 'template' column to avoid NOT NULL constraints
    let hasTemplate = false;
    try {
        const columns = await db.query(`PRAGMA table_info("_ai_prompt")`);
        hasTemplate = !!columns.find((c: any) => c.name === 'template');
    } catch (e) {}

    // Categories that contain arrays of prompts
    const categories = ['system', 'global', 'workspaceTemplates'];
    
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

export async function syncEntityTable(db: any, rawDef: any) {
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
                const fname = f.name;
                if (fname && fname !== pk && fname !== 'id') {
                    let colDef = `"${fname}" ${mapFieldType(f.type)}`;
                    if (f.unique) colDef += ' UNIQUE';
                    if (f.required) colDef += ' NOT NULL';
                    colDefs.push(colDef);
                }
            });
            
            // Add standard fields (Enterprise Level 8)
            const std = ['workspaceId', 'createdAt', 'updatedAt', 'deletedAt', 'archived', 'createdBy', 'updatedBy'];
            std.forEach(s => {
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
            
            // Core system fields check
            const std = ['workspaceId', 'createdAt', 'updatedAt', 'deletedAt', 'archived', 'createdBy', 'updatedBy'];
            std.forEach(s => {
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